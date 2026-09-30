const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const store = require('./db');
const attachSocial = require('./social');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const SESSION_COOKIE = 'cq_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CATALOG_FILE = path.join(PUBLIC_DIR, 'data', 'catalog.json');
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const WORLD_ROAD_X = [240, 720, 1200, 1680, 2160];
const WORLD_ROAD_Y = [220, 700, 1180];
const SIDEWALK_HALF_WIDTH = 45;
const VEHICLE_ROAD_HALF_WIDTH = 20;

function roadDistance(x, y) {
  return Math.min(
    ...WORLD_ROAD_X.map(roadX => Math.abs(x - roadX)),
    ...WORLD_ROAD_Y.map(roadY => Math.abs(y - roadY))
  );
}

function isGrassPosition(x, y) {
  return roadDistance(x, y) > SIDEWALK_HALF_WIDTH;
}

app.set('trust proxy', 1);
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: '10kb' }));

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const weaponById = Object.fromEntries(catalog.weapons.map(w => [w.id, w]));
const powerupById = Object.fromEntries(catalog.powerups.map(p => [p.id, p]));

const db = store.loadState();
const dirtyPlayers = new Set();
let listingsDirty = false;
let saveTimer = null;

function flushSave() {
  saveTimer = null;
  const players = [...dirtyPlayers].map(id => db.players[id]).filter(Boolean);
  dirtyPlayers.clear();
  if (players.length) store.savePlayers(players);
  if (listingsDirty) {
    listingsDirty = false;
    store.saveListings(db.listings);
  }
}

function scheduleSave(playerIds = [], listingsChanged = false) {
  playerIds.forEach(id => id && dirtyPlayers.add(id));
  if (listingsChanged) listingsDirty = true;
  if (!saveTimer) saveTimer = setTimeout(flushSave, 300);
}

// ---------- Auth ----------

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sessionUserId(cookieHeader) {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE];
  return token ? store.getSessionUserId(sha256(token)) : null;
}

function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  store.createSession(sha256(token), userId, Date.now() + SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const entry = attempts.get(req.ip);
  if (!entry || entry.reset < now) {
    attempts.set(req.ip, { count: 1, reset: now + 15 * 60 * 1000 });
    return next();
  }
  if (++entry.count > 20) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  next();
}

// Adopt an old browser-only player (pre-accounts) if nobody has claimed it yet.
function createAccountPlayer(legacyId, name) {
  if (typeof legacyId === 'string' && db.players[legacyId] && !store.getUserById(legacyId)) {
    return db.players[legacyId];
  }
  const id = 'p_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
  db.players[id] = newPlayer(id, name);
  db.players[id].online = false;
  return db.players[id];
}

function accountInfo(userId) {
  const user = store.getUserById(userId);
  const player = db.players[userId];
  if (!user || !player) return null;
  return { id: user.id, username: user.username, email: user.email, name: player.name, hasPassword: !!user.password_hash };
}

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

app.get('/api/me', (req, res) => {
  const userId = sessionUserId(req.headers.cookie);
  const info = userId && accountInfo(userId);
  if (!info) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: info });
});

app.post('/api/profile', rateLimit, (req, res) => {
  const userId = sessionUserId(req.headers.cookie);
  const user = userId && store.getUserById(userId);
  const player = userId && db.players[userId];
  if (!user || !player) return res.status(401).json({ error: 'Not signed in.' });

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!name || name.length > 24 || /[\u0000-\u001f\u007f]/.test(name)) {
    return res.status(400).json({ error: 'Display name must be 1-24 characters.' });
  }
  if (username && !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers, _ or -.' });
  }
  if (username) {
    const existing = store.getUserByUsername(username);
    if (existing && existing.id !== userId) return res.status(409).json({ error: 'That username is taken.' });
    try {
      store.updateUsername(userId, username);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'That username is taken.' });
      throw error;
    }
  }

  player.name = name;
  scheduleSave([userId]);
  io.to('lobby').emit('onlinePlayers', onlineList());
  res.json({ user: accountInfo(userId) });
});

app.post('/api/password', rateLimit, (req, res) => {
  const userId = sessionUserId(req.headers.cookie);
  const user = userId && store.getUserById(userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  if (!user.username) return res.status(400).json({ error: 'Set a username before adding a password.' });
  const { currentPassword, newPassword } = req.body || {};
  if (user.password_hash && (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200) {
    return res.status(400).json({ error: 'Password must be 8-200 characters.' });
  }
  store.updatePasswordHash(userId, hashPassword(newPassword));
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) {
    const currentTokenHash = sha256(token);
    store.deleteOtherSessions(userId, currentTokenHash);
    for (const socket of io.sockets.sockets.values()) {
      const socketToken = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
      if (socket.currentPlayerId === userId && socketToken !== token) socket.disconnect(true);
    }
  }
  res.json({ user: accountInfo(userId) });
});

app.post('/api/register', rateLimit, (req, res) => {
  const { username, password, legacyId } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers, _ or -.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (store.getUserByUsername(username)) {
    return res.status(409).json({ error: 'That username is taken.' });
  }
  const player = createAccountPlayer(legacyId, username);
  store.savePlayers([player]);
  store.createUser({ id: player.id, username, password_hash: hashPassword(password) });
  startSession(req, res, player.id);
  res.json({ user: accountInfo(player.id) });
});

app.post('/api/login', rateLimit, (req, res) => {
  const { username, password } = req.body || {};
  const user = typeof username === 'string' && store.getUserByUsername(username);
  if (!user || typeof password !== 'string' || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  startSession(req, res, user.id);
  res.json({ user: accountInfo(user.id) });
});

app.post('/api/google', rateLimit, async (req, res) => {
  if (!googleClient) return res.status(404).json({ error: 'Google sign-in is not configured.' });
  const { credential, legacyId } = req.body || {};
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: String(credential || ''), audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return res.status(401).json({ error: 'Google sign-in failed.' });
  }
  if (!payload || !payload.sub) return res.status(401).json({ error: 'Google sign-in failed.' });
  let user = store.getUserByGoogle(payload.sub);
  if (!user) {
    const name = String(payload.given_name || payload.name || 'Minifig').slice(0, 24);
    const player = createAccountPlayer(legacyId, name);
    store.savePlayers([player]);
    store.createUser({ id: player.id, google_sub: payload.sub, email: payload.email || null });
    user = store.getUserById(player.id);
  }
  startSession(req, res, user.id);
  res.json({ user: accountInfo(user.id) });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) store.deleteSession(sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

function newPlayer(id, name) {
  return {
    id,
    name: name || 'Minifig',
    cred: 100,
    lifetimeCred: 100,
    inventory: { weapons: [], powerups: [] },
    equipped: { weapons: [], powerups: [] },
    builtItems: [],
    home: { houseBuildId: null, art: [], furniture: [] },
    vehicleBuildId: null,
    world: { x: 400, y: 300, homeX: 125, homeY: 155, homePlaced: false, inVehicle: false, vehicleParked: false },
    hunt: { level: 1, runCred: 0, inFight: false },
    friends: [],
    friendRequests: [],
    sentRequests: [],
    online: true
  };
}

function publicPlayer(p) {
  const { id, name, cred, lifetimeCred, inventory, equipped, builtItems, home, vehicleBuildId, world } = p;
  return {
    id, name, cred, lifetimeCred, inventory, equipped, builtItems,
    hunt: p.hunt || { level: 1, runCred: 0, inFight: false },
    home: home || { houseBuildId: null, art: [], furniture: [] },
    vehicleBuildId: vehicleBuildId || null,
    world: world || { x: 400, y: 300, homeX: 125, homeY: 155 }
  };
}

// Drop references to a creation the player no longer owns.
function releaseBuild(p, buildId) {
  if (!p) return;
  if (p.vehicleBuildId === buildId) p.vehicleBuildId = null;
  if (!p.home) return;
  if (p.home.houseBuildId === buildId) {
    p.home.houseBuildId = null;
    p.home.art = [];
    p.home.furniture = [];
    return;
  }
  p.home.art = (p.home.art || []).map(id => (id === buildId ? null : id));
  p.home.furniture = (p.home.furniture || []).map(id => (id === buildId ? null : id));
}

function onlineList() {
  return Object.values(db.players)
    .filter(p => p.online)
    .map(p => {
      const house = (p.builtItems || []).find(b => b.id === p.home?.houseBuildId);
      const vehicle = (p.builtItems || []).find(b => b.id === p.vehicleBuildId);
      return {
        id: p.id,
        name: p.name,
        lifetimeCred: p.lifetimeCred,
        world: p.world || { x: 400, y: 300, homeX: 125, homeY: 155 },
        house: house && p.world && (p.world.homePlaced === true ||
          (p.world.homePlaced === undefined && (p.world.homeX !== 125 || p.world.homeY !== 155)))
          ? { id: house.id, name: house.name }
          : null,
        vehicle: vehicle ? { id: vehicle.id, name: vehicle.name } : null
      };
    });
}

function worldAssets() {
  return Object.values(db.players)
    .filter(p => p.online)
    .map(p => {
      const house = (p.builtItems || []).find(b => b.id === p.home?.houseBuildId);
      const vehicle = (p.builtItems || []).find(b => b.id === p.vehicleBuildId);
      const placed = !!p.world && (p.world.homePlaced === true ||
        (p.world.homePlaced === undefined && (p.world.homeX !== 125 || p.world.homeY !== 155)));
      return {
        id: p.id,
        house: house && placed ? { ...house, model: house.model || [] } : null,
        vehicle: vehicle ? { ...vehicle, model: vehicle.model || [] } : null
      };
    });
}

function findSocketByPlayerId(id) {
  for (const [, s] of io.sockets.sockets) {
    if (s.currentPlayerId === id) return s;
  }
  return null;
}

const social = attachSocial({ io, db, store, catalog, weaponById, powerupById, scheduleSave, publicPlayer, releaseBuild });

io.use((socket, next) => {
  const userId = sessionUserId(socket.handshake.headers.cookie);
  if (!userId || !db.players[userId]) return next(new Error('unauthorized'));
  socket.userId = userId;
  next();
});

io.on('connection', socket => {
  socket.currentPlayerId = null;

  socket.on('join', () => {
    const id = socket.userId;
    socket.currentPlayerId = id;
    db.players[id].online = true;
    socket.join('lobby');
    socket.join('player:' + id);

    socket.emit('joined', {
      player: publicPlayer(db.players[id]),
      catalog,
      listings: db.listings
    });

    io.to('lobby').emit('onlinePlayers', onlineList());
    io.to('lobby').emit('worldAssets', worldAssets());
    social.onJoin(id);
  });

  social.register(socket);

  // Client is trusted for its own solo progress (store gear, equip loadout,
  // built creations); only trade actions below are server-validated.
  socket.on('syncPlayer', patch => {
    const p = db.players[socket.currentPlayerId];
    if (!p) return;
    if (patch.cred !== undefined) p.cred = Math.max(0, Math.round(patch.cred));
    if (patch.lifetimeCred !== undefined) p.lifetimeCred = Math.max(p.lifetimeCred, Math.round(patch.lifetimeCred));
    if (patch.inventory) p.inventory = patch.inventory;
    if (patch.equipped) p.equipped = patch.equipped;
    if (patch.builtItems) p.builtItems = patch.builtItems;
    if (patch.home) {
      p.home = patch.home;
      if (!p.home.houseBuildId && p.world) p.world.homePlaced = false;
    }
    if (patch.vehicleBuildId !== undefined) {
      p.vehicleBuildId = patch.vehicleBuildId;
      if (!p.vehicleBuildId && p.world) {
        p.world.inVehicle = false;
        p.world.vehicleParked = false;
      }
    }
    if (patch.hunt && typeof patch.hunt === 'object') {
      const level = Math.round(Number(patch.hunt.level));
      const runCred = Math.round(Number(patch.hunt.runCred));
      const before = p.hunt && p.hunt.level;
      p.hunt = {
        level: Number.isFinite(level) ? Math.min(50, Math.max(1, level)) : 1,
        runCred: Number.isFinite(runCred) ? Math.max(0, runCred) : 0,
        inFight: patch.hunt.inFight === true
      };
      if (p.hunt.level !== before) social.onHuntChanged(p.id);
    }
    scheduleSave([p.id]);
    io.to('lobby').emit('onlinePlayers', onlineList());
    io.to('lobby').emit('worldAssets', worldAssets());
  });

  socket.on('worldMove', ({ x, y }) => {
    const p = db.players[socket.currentPlayerId];
    if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
    p.world = p.world || { homeX: 125, homeY: 155 };
    const nextX = Math.max(40, Math.min(WORLD_WIDTH - 40, Math.round(x)));
    const nextY = Math.max(40, Math.min(WORLD_HEIGHT - 40, Math.round(y)));
    if (p.world.inVehicle && roadDistance(nextX, nextY) > VEHICLE_ROAD_HALF_WIDTH) return;
    p.world.x = nextX;
    p.world.y = nextY;
    if (p.world.inVehicle) {
      p.world.vehicleX = nextX;
      p.world.vehicleY = nextY;
    }
    scheduleSave([p.id]);
    socket.to('lobby').volatile.emit('worldPlayers', onlineList());
  });

  socket.on('placeHome', ({ x, y } = {}, ack) => {
    const p = db.players[socket.currentPlayerId];
    const house = p && (p.builtItems || []).find(b => b.id === p.home?.houseBuildId);
    if (!p || !house || !Array.isArray(house.model) || !house.model.length) {
      if (typeof ack === 'function') ack({ error: 'Choose a brick-built house first.' });
      return;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 85 || x > WORLD_WIDTH - 85 || y < 85 || y > WORLD_HEIGHT - 85 || !isGrassPosition(x, y)) {
      if (typeof ack === 'function') ack({ error: 'Place your house on a clear patch of grass, away from roads and sidewalks.' });
      return;
    }
    p.world = p.world || { x: 400, y: 300 };
    p.world.homeX = Math.max(85, Math.min(WORLD_WIDTH - 85, Math.round(x)));
    p.world.homeY = Math.max(85, Math.min(WORLD_HEIGHT - 85, Math.round(y)));
    p.world.homePlaced = true;
    scheduleSave([p.id]);
    io.to('lobby').emit('worldPlayers', onlineList());
    io.to('lobby').emit('worldAssets', worldAssets());
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('vehicleMode', ({ inVehicle } = {}, ack) => {
    const p = db.players[socket.currentPlayerId];
    const vehicle = p && (p.builtItems || []).find(b => b.id === p.vehicleBuildId);
    if (!p || !p.world || typeof inVehicle !== 'boolean') return;
    if (inVehicle) {
      if (!vehicle || !Array.isArray(vehicle.model) || !vehicle.model.length) {
        if (typeof ack === 'function') ack({ error: 'Choose a brick-built vehicle in My Home first.' });
        return;
      }
      if (roadDistance(p.world.x, p.world.y) > VEHICLE_ROAD_HALF_WIDTH) {
        if (typeof ack === 'function') ack({ error: 'Move onto a road before getting in.' });
        return;
      }
      if (p.world.vehicleParked && Math.hypot(p.world.x - p.world.vehicleX, p.world.y - p.world.vehicleY) > 70) {
        if (typeof ack === 'function') ack({ error: 'Walk closer to your parked vehicle first.' });
        return;
      }
      p.world.vehicleParked = false;
      p.world.inVehicle = true;
      p.world.vehicleX = p.world.x;
      p.world.vehicleY = p.world.y;
    } else {
      if (!p.world.inVehicle) return;
      p.world.inVehicle = false;
      p.world.vehicleParked = true;
      p.world.vehicleX = p.world.x;
      p.world.vehicleY = p.world.y;
    }
    scheduleSave([p.id]);
    socket.emit('playerUpdated', publicPlayer(p));
    io.to('lobby').emit('worldPlayers', onlineList());
    if (typeof ack === 'function') ack({ ok: true, inVehicle: p.world.inVehicle });
  });

  socket.on('buyItem', ({ itemId, kind }) => {
    const p = db.players[socket.currentPlayerId];
    if (!p) return;
    const item = kind === 'weapon' ? weaponById[itemId] : powerupById[itemId];
    if (!item) return;
    if (p.cred < item.cost) {
      socket.emit('actionError', { message: 'Not enough creds.' });
      return;
    }
    p.cred -= item.cost;
    if (kind === 'weapon') p.inventory.weapons.push(itemId);
    else p.inventory.powerups.push(itemId);
    scheduleSave([p.id]);
    socket.emit('playerUpdated', publicPlayer(p));
  });

  socket.on('listBuild', ({ build }) => {
    const p = db.players[socket.currentPlayerId];
    if (!p || !build) return;
    const built = p.builtItems.find(b => b.id === build.id);
    if (!built || built.listed) return;
    built.listed = true;
    const listing = {
      id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      buildId: built.id,
      sellerId: p.id,
      sellerName: p.name,
      name: built.name,
      category: built.category || 'other',
      thumbnail: built.thumbnail,
      model: built.model || null,
      grid: built.grid || null,
      brickCount: built.brickCount || (built.model ? built.model.length : 0),
      price: Math.max(1, Math.round(build.price))
    };
    db.listings.push(listing);
    releaseBuild(p, built.id);
    scheduleSave([p.id], true);
    io.to('lobby').emit('listingsUpdated', db.listings);
    socket.emit('playerUpdated', publicPlayer(p));
  });

  socket.on('cancelListing', ({ listingId }) => {
    const idx = db.listings.findIndex(l => l.id === listingId && l.sellerId === socket.currentPlayerId);
    if (idx === -1) return;
    const listing = db.listings[idx];
    const seller = db.players[listing.sellerId];
    if (seller) {
      const built = seller.builtItems.find(b => b.id === listing.buildId);
      if (built) built.listed = false;
    }
    db.listings.splice(idx, 1);
    scheduleSave([listing.sellerId], true);
    io.to('lobby').emit('listingsUpdated', db.listings);
  });

  socket.on('buyListing', ({ listingId }) => {
    const buyer = db.players[socket.currentPlayerId];
    const idx = db.listings.findIndex(l => l.id === listingId);
    if (!buyer || idx === -1) return;
    const listing = db.listings[idx];
    if (listing.sellerId === buyer.id) return;
    if (buyer.cred < listing.price) {
      socket.emit('actionError', { message: 'Not enough creds for that build.' });
      return;
    }
    const seller = db.players[listing.sellerId];
    buyer.cred -= listing.price;
    if (seller) {
      seller.cred += listing.price;
      seller.builtItems = seller.builtItems.filter(b => b.id !== listing.buildId);
      releaseBuild(seller, listing.buildId);
    }
    buyer.builtItems.push({
      id: 'owned_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: listing.name,
      category: listing.category || 'other',
      thumbnail: listing.thumbnail,
      model: listing.model || null,
      grid: listing.grid || null,
      brickCount: listing.brickCount || 0,
      listed: false,
      boughtFrom: listing.sellerName
    });
    db.listings.splice(idx, 1);
    scheduleSave([buyer.id, listing.sellerId], true);

    socket.emit('playerUpdated', publicPlayer(buyer));
    io.to('lobby').emit('listingsUpdated', db.listings);
    if (seller) {
      const sellerSocket = findSocketByPlayerId(listing.sellerId);
      if (sellerSocket) {
        sellerSocket.emit('playerUpdated', publicPlayer(seller));
        sellerSocket.emit('itemSold', { name: listing.name, price: listing.price, buyer: buyer.name });
      }
    }
  });

  socket.on('disconnect', () => {
    const id = socket.currentPlayerId;
    if (id && db.players[id] && !findSocketByPlayerId(id)) {
      db.players[id].online = false;
      io.to('lobby').emit('onlinePlayers', onlineList());
      social.onOffline(id);
    }
  });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (saveTimer) clearTimeout(saveTimer);
    flushSave();
    process.exit(0);
  });
}

server.listen(PORT, () => {
  console.log(`Brick Cred running at http://localhost:${PORT}`);
});
