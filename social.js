// Friends, direct messages, gifts/trades between friends, and co-op Beast Hunter parties.
const crypto = require('crypto');
const { LEVELS } = require('./public/js/levels.js');

const MAX_PARTY = 4;
const MAX_LIST = 200;
const OFFER_TTL_MS = 10 * 60 * 1000;
const FIST_COOLDOWN = 400;
const WEAPON_COOLDOWN = 700;

module.exports = function attachSocial({ io, db, store, catalog, weaponById, powerupById, scheduleSave, publicPlayer, releaseBuild }) {
  const offers = new Map();
  const parties = new Map();
  const partyOf = new Map();
  const partyInvites = new Map();

  const uid = prefix => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const emitTo = (id, event, data) => io.to('player:' + id).emit(event, data);
  const notice = (id, message) => emitTo(id, 'notice', { message });
  const toInt = v => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN);

  function social(p) {
    if (!Array.isArray(p.friends)) p.friends = [];
    if (!Array.isArray(p.friendRequests)) p.friendRequests = [];
    if (!Array.isArray(p.sentRequests)) p.sentRequests = [];
    return p;
  }

  function brief(id) {
    const p = db.players[id];
    if (!p) return null;
    return { id, name: p.name, online: !!p.online, lifetimeCred: p.lifetimeCred || 0, level: (p.hunt && p.hunt.level) || 1 };
  }

  const areFriends = (a, b) => !!a && !!b && social(a).friends.includes(b.id);

  // ---------- Server-side combat stats (mirrors getCombatStats in state.js) ----------

  function combatStats(p) {
    let tier = catalog.tiers[0];
    for (const t of catalog.tiers) if ((p.lifetimeCred || 0) >= t.threshold) tier = t;
    const weapons = ((p.equipped && p.equipped.weapons) || []).slice(0, 3).map(id => weaponById[id]).filter(Boolean);
    const powerups = ((p.equipped && p.equipped.powerups) || []).slice(0, 2).map(id => powerupById[id]).filter(Boolean);
    const house = (p.builtItems || []).find(b => p.home && b.id === p.home.houseBuildId);
    let comfort = 0;
    if (house) {
      const owns = id => (p.builtItems || []).some(b => b.id === id);
      comfort = Math.min(60, Math.round((house.brickCount || 20) / 2)) +
        (p.home.art || []).filter(owns).length * 8 +
        (p.home.furniture || []).filter(owns).length * 5;
    }
    const baseAttack = 5 + tier.bonusAttack;
    let attack = baseAttack + weapons.reduce((s, w) => s + w.attack, 0);
    let health = 100 + tier.bonusHealth + comfort * 2;
    let defense = 0, attackMult = 1, revive = 0;
    powerups.forEach(pu => {
      if (pu.health) health += pu.health;
      if (pu.defense) defense += pu.defense;
      if (pu.attackMult) attackMult *= pu.attackMult;
      if (pu.revive) revive += pu.revive;
    });
    return {
      attack: Math.round(attack * attackMult),
      unarmedAttack: Math.round(baseAttack * attackMult),
      hasWeapons: weapons.length > 0,
      health, defense, revive
    };
  }

  // ---------- Payloads ----------

  function offerView(o) {
    const from = db.players[o.fromId], to = db.players[o.toId];
    return { ...o, fromName: from ? from.name : '?', toName: to ? to.name : '?' };
  }

  function socialPayload(id) {
    const p = social(db.players[id]);
    const now = Date.now();
    const invites = [...(partyInvites.get(id) || new Map())]
      .filter(([partyId]) => parties.has(partyId))
      .map(([partyId, fromId]) => ({ partyId, from: brief(fromId) }));
    return {
      friends: p.friends.map(brief).filter(Boolean),
      incoming: p.friendRequests.map(brief).filter(Boolean),
      outgoing: p.sentRequests.map(brief).filter(Boolean),
      offers: [...offers.values()].filter(o => o.expires > now && (o.fromId === id || o.toId === id)).map(offerView),
      partyInvites: invites
    };
  }

  function pushSocial(id) {
    if (db.players[id]) emitTo(id, 'social', socialPayload(id));
  }

  function pushFriendsOf(id) {
    const p = db.players[id];
    if (p) social(p).friends.forEach(pushSocial);
  }

  function partyPayload(party) {
    const f = party.fight;
    return {
      id: party.id,
      leader: party.leader,
      members: party.members.map(brief).filter(Boolean),
      fighting: !!f,
      level: f ? f.lvl.level : ((db.players[party.leader].hunt || {}).level || 1)
    };
  }

  function pushParty(party) {
    const payload = partyPayload(party);
    party.members.forEach(id => emitTo(id, 'party', payload));
  }

  function fightPayload(fight, event) {
    return {
      level: fight.lvl.level,
      name: fight.lvl.name,
      isBoss: fight.lvl.isBoss,
      reward: fight.lvl.reward,
      enemyHp: Math.max(0, fight.enemyHp),
      enemyMax: fight.enemyMax,
      members: Object.entries(fight.members).map(([id, m]) => {
        const p = db.players[id];
        return { id, name: p ? p.name : '?', lifetimeCred: p ? p.lifetimeCred : 0, hp: Math.max(0, m.hp), max: m.max, weapons: m.weapons, dmg: m.dmg };
      }),
      event: event || null
    };
  }

  function broadcastFight(party, event) {
    const payload = fightPayload(party.fight, event);
    party.members.forEach(id => emitTo(id, 'partyFight', payload));
  }

  // ---------- Friends ----------

  function removeFrom(list, id) {
    const i = list.indexOf(id);
    if (i !== -1) list.splice(i, 1);
  }

  function makeFriends(a, b) {
    social(a); social(b);
    [a.friendRequests, a.sentRequests].forEach(l => removeFrom(l, b.id));
    [b.friendRequests, b.sentRequests].forEach(l => removeFrom(l, a.id));
    if (!a.friends.includes(b.id)) a.friends.push(b.id);
    if (!b.friends.includes(a.id)) b.friends.push(a.id);
    scheduleSave([a.id, b.id]);
    pushSocial(a.id);
    pushSocial(b.id);
    notice(a.id, `🤝 You and ${b.name} are now friends!`);
    notice(b.id, `🤝 You and ${a.name} are now friends!`);
  }

  function findPlayerByName(name) {
    const clean = name.trim().slice(0, 24);
    if (!clean) return null;
    const user = store.getUserByUsername(clean);
    if (user && db.players[user.id]) return db.players[user.id];
    const lower = clean.toLowerCase();
    return Object.values(db.players).find(p => String(p.name).toLowerCase() === lower && store.getUserById(p.id)) || null;
  }

  // ---------- Items ----------

  function checkItem(p, kind, itemId) {
    if (typeof itemId !== 'string') return 'Pick an item.';
    if (kind === 'weapon' || kind === 'powerup') {
      const key = kind === 'weapon' ? 'weapons' : 'powerups';
      const item = (kind === 'weapon' ? weaponById : powerupById)[itemId];
      if (!item) return 'Unknown item.';
      const owned = (p.inventory[key] || []).filter(x => x === itemId).length;
      const equipped = ((p.equipped && p.equipped[key]) || []).filter(x => x === itemId).length;
      if (!owned) return `You don't own a ${item.name}.`;
      if (owned - equipped < 1) return `Unequip your ${item.name} first.`;
      return null;
    }
    if (kind === 'build') {
      const build = (p.builtItems || []).find(b => b.id === itemId);
      if (!build) return 'You no longer own that creation.';
      if (build.listed) return 'Cancel its marketplace listing first.';
      return null;
    }
    return 'Unknown item type.';
  }

  function itemInfo(p, kind, itemId) {
    if (kind === 'weapon') return { name: weaponById[itemId].name, thumbnail: null };
    if (kind === 'powerup') return { name: powerupById[itemId].name, thumbnail: null };
    const b = p.builtItems.find(x => x.id === itemId);
    return { name: b.name, thumbnail: b.thumbnail || null };
  }

  // Caller must run checkItem first.
  function moveItem(from, to, kind, itemId) {
    if (kind === 'weapon' || kind === 'powerup') {
      const key = kind === 'weapon' ? 'weapons' : 'powerups';
      removeFrom(from.inventory[key], itemId);
      to.inventory[key].push(itemId);
      return;
    }
    const idx = from.builtItems.findIndex(b => b.id === itemId);
    const [build] = from.builtItems.splice(idx, 1);
    releaseBuild(from, build.id);
    to.builtItems.push({ ...build, id: uid('owned'), listed: false, boughtFrom: from.name });
  }

  function refreshPlayers(...players) {
    players.forEach(p => emitTo(p.id, 'playerUpdated', publicPlayer(p)));
  }

  function dropOffersBetween(a, b) {
    for (const [id, o] of offers) {
      if ((o.fromId === a && o.toId === b) || (o.fromId === b && o.toId === a)) offers.delete(id);
    }
  }

  // ---------- Parties & team fights ----------

  function beastAttack(party) {
    const fight = party.fight;
    if (!fight) return;
    const alive = Object.entries(fight.members).filter(([, m]) => m.hp > 0);
    if (!alive.length) return endFight(party, false);
    const [targetId, m] = alive[Math.floor(Math.random() * alive.length)];
    const dmg = Math.max(1, Math.round((fight.lvl.enemyAttack - m.defense) * (0.85 + Math.random() * 0.3)));
    m.hp -= dmg;
    let revived = false;
    if (m.hp <= 0 && m.revives > 0) {
      m.revives--;
      m.hp = Math.round(m.max * 0.3);
      revived = true;
    }
    broadcastFight(party, { type: 'beastHit', target: targetId, dmg, revived });
    if (Object.values(fight.members).every(x => x.hp <= 0)) endFight(party, false);
  }

  function loseRun(p) {
    const h = p.hunt || { level: 1, runCred: 0 };
    const lost = Math.min(p.cred, h.runCred || 0);
    p.cred -= lost;
    p.hunt = { level: 1, runCred: 0, inFight: false };
    return lost;
  }

  function endFight(party, won) {
    const fight = party.fight;
    if (!fight) return;
    clearInterval(fight.timer);
    party.fight = null;
    const ids = Object.keys(fight.members).filter(id => db.players[id]);
    const share = won ? Math.max(1, Math.floor(fight.lvl.reward / Math.max(1, ids.length))) : 0;
    const results = {};
    ids.forEach(id => {
      const p = db.players[id];
      const m = fight.members[id];
      p.hunt = p.hunt || { level: 1, runCred: 0, inFight: false };
      if (won) {
        p.cred += share;
        p.lifetimeCred += share;
        if (m.onRun) {
          p.hunt.runCred += share;
          p.hunt.level++;
          if (p.hunt.level > LEVELS.length) p.hunt = { level: 1, runCred: 0, inFight: false };
        }
        results[id] = { share, advanced: m.onRun };
      } else {
        results[id] = { lost: m.onRun ? loseRun(p) : 0, reset: m.onRun };
      }
    });
    scheduleSave(ids);
    ids.forEach(id => {
      emitTo(id, 'playerUpdated', publicPlayer(db.players[id]));
      emitTo(id, 'partyFightEnd', { won, name: fight.lvl.name, level: fight.lvl.level, reward: fight.lvl.reward, share, players: ids.length, result: results[id] });
    });
    pushParty(party);
  }

  function fleeFight(party, id) {
    const fight = party.fight;
    const m = fight && fight.members[id];
    if (!m) return;
    const p = db.players[id];
    if (p && m.onRun) {
      const lost = loseRun(p);
      scheduleSave([id]);
      emitTo(id, 'playerUpdated', publicPlayer(p));
      if (lost) notice(id, `You fled the team fight and lost ${lost} creds. Back to level 1.`);
    }
    delete fight.members[id];
    emitTo(id, 'partyFightEnd', { won: false, fled: true, name: fight.lvl.name, level: fight.lvl.level, share: 0, players: 0, result: {} });
    if (!Object.keys(fight.members).length) {
      clearInterval(fight.timer);
      party.fight = null;
    }
  }

  function leaveParty(id) {
    const party = parties.get(partyOf.get(id));
    if (!party) return;
    if (party.fight) fleeFight(party, id);
    party.members = party.members.filter(m => m !== id);
    partyOf.delete(id);
    emitTo(id, 'party', null);
    if (!party.members.length) {
      if (party.fight) clearInterval(party.fight.timer);
      parties.delete(party.id);
      return;
    }
    if (party.leader === id) party.leader = party.members[0];
    if (party.fight && Object.values(party.fight.members).every(m => m.hp <= 0)) endFight(party, false);
    else if (party.fight) broadcastFight(party, { type: 'left', id });
    pushParty(party);
  }

  // ---------- Socket wiring ----------

  function register(socket) {
    const me = () => db.players[socket.currentPlayerId];
    const fail = message => socket.emit('actionError', { message });
    const friendOf = (p, otherId) => {
      const other = typeof otherId === 'string' ? db.players[otherId] : null;
      return other && areFriends(p, other) ? other : null;
    };

    socket.on('friendRequest', payload => {
      const p = me();
      if (!p || !payload) return;
      let target = typeof payload.targetId === 'string' ? db.players[payload.targetId] : null;
      if (!target && typeof payload.name === 'string') target = findPlayerByName(payload.name);
      if (!target || !store.getUserById(target.id)) return fail('No player with that name.');
      if (target.id === p.id) return fail("That's you!");
      social(p); social(target);
      if (p.friends.includes(target.id)) return fail(`You're already friends with ${target.name}.`);
      if (p.friendRequests.includes(target.id)) return makeFriends(p, target);
      if (p.sentRequests.includes(target.id)) return fail('Request already sent.');
      if (p.sentRequests.length >= MAX_LIST || target.friendRequests.length >= MAX_LIST) return fail('Too many pending requests.');
      p.sentRequests.push(target.id);
      target.friendRequests.push(p.id);
      scheduleSave([p.id, target.id]);
      pushSocial(p.id);
      pushSocial(target.id);
      notice(p.id, `Friend request sent to ${target.name}.`);
      notice(target.id, `👋 ${p.name} wants to be friends!`);
    });

    socket.on('friendRespond', ({ fromId, accept } = {}) => {
      const p = me();
      const other = typeof fromId === 'string' ? db.players[fromId] : null;
      if (!p || !other || !social(p).friendRequests.includes(fromId)) return;
      if (accept) return makeFriends(p, other);
      removeFrom(p.friendRequests, fromId);
      removeFrom(social(other).sentRequests, p.id);
      scheduleSave([p.id, other.id]);
      pushSocial(p.id);
      pushSocial(other.id);
    });

    socket.on('friendRemove', ({ friendId } = {}) => {
      const p = me();
      const other = typeof friendId === 'string' ? db.players[friendId] : null;
      if (!p || !other) return;
      social(p); social(other);
      [p.friends, p.sentRequests, p.friendRequests].forEach(l => removeFrom(l, other.id));
      [other.friends, other.sentRequests, other.friendRequests].forEach(l => removeFrom(l, p.id));
      dropOffersBetween(p.id, other.id);
      scheduleSave([p.id, other.id]);
      pushSocial(p.id);
      pushSocial(other.id);
    });

    socket.on('giftSend', ({ to, kind, itemId, amount } = {}) => {
      const p = me();
      const other = p && friendOf(p, to);
      if (!other) return fail('You can only gift to friends.');
      let label;
      if (kind === 'cred') {
        const n = toInt(amount);
        if (!(n >= 1)) return fail('Enter an amount of creds.');
        if (n > p.cred) return fail("You don't have that many creds.");
        p.cred -= n;
        other.cred += n;
        label = `${n} creds`;
      } else {
        const err = checkItem(p, kind, itemId);
        if (err) return fail(err);
        label = itemInfo(p, kind, itemId).name;
        moveItem(p, other, kind, itemId);
      }
      scheduleSave([p.id, other.id]);
      refreshPlayers(p, other);
      notice(p.id, `🎁 Sent ${label} to ${other.name}.`);
      notice(other.id, `🎁 ${p.name} gifted you ${label}!`);
    });

    socket.on('offerSend', ({ to, kind, itemId, price } = {}) => {
      const p = me();
      const other = p && friendOf(p, to);
      if (!other) return fail('You can only sell to friends.');
      const err = checkItem(p, kind, itemId);
      if (err) return fail(err);
      const n = toInt(price);
      if (!(n >= 1 && n <= 10000000)) return fail('Set a price of at least 1 cred.');
      const mine = [...offers.values()].filter(o => o.fromId === p.id).length;
      if (mine >= 20) return fail('You have too many open offers.');
      const info = itemInfo(p, kind, itemId);
      const offer = { id: uid('o'), fromId: p.id, toId: other.id, kind, itemId, name: info.name, thumbnail: info.thumbnail, price: n, expires: Date.now() + OFFER_TTL_MS };
      offers.set(offer.id, offer);
      pushSocial(p.id);
      pushSocial(other.id);
      notice(p.id, `Offer sent: ${info.name} to ${other.name} for 💰${n}.`);
      notice(other.id, `💼 ${p.name} offers you ${info.name} for 💰${n}. See Friends.`);
    });

    socket.on('offerRespond', ({ offerId, accept } = {}) => {
      const p = me();
      const offer = offers.get(offerId);
      if (!p || !offer || offer.toId !== p.id) return;
      const seller = db.players[offer.fromId];
      if (!accept || offer.expires < Date.now() || !seller) {
        offers.delete(offer.id);
        pushSocial(p.id);
        if (seller) {
          pushSocial(seller.id);
          if (!accept) notice(seller.id, `${p.name} declined your offer for ${offer.name}.`);
        }
        return;
      }
      if (p.cred < offer.price) return fail('Not enough creds for that offer.');
      const err = checkItem(seller, offer.kind, offer.itemId);
      if (err) {
        offers.delete(offer.id);
        pushSocial(p.id);
        pushSocial(seller.id);
        return fail(`${seller.name} can't sell that anymore.`);
      }
      moveItem(seller, p, offer.kind, offer.itemId);
      p.cred -= offer.price;
      seller.cred += offer.price;
      offers.delete(offer.id);
      scheduleSave([p.id, seller.id]);
      refreshPlayers(p, seller);
      pushSocial(p.id);
      pushSocial(seller.id);
      notice(p.id, `✅ You bought ${offer.name} from ${seller.name}.`);
      notice(seller.id, `💸 ${p.name} bought your ${offer.name} for ${offer.price} creds!`);
    });

    socket.on('offerCancel', ({ offerId } = {}) => {
      const offer = offers.get(offerId);
      if (!offer || offer.fromId !== socket.currentPlayerId) return;
      offers.delete(offer.id);
      pushSocial(offer.fromId);
      pushSocial(offer.toId);
    });

    socket.on('partyInvite', ({ to } = {}) => {
      const p = me();
      const other = p && friendOf(p, to);
      if (!other) return fail('You can only team up with friends.');
      if (!other.online) return fail(`${other.name} is offline.`);
      let party = parties.get(partyOf.get(p.id));
      if (!party) {
        party = { id: uid('party'), leader: p.id, members: [p.id], fight: null };
        parties.set(party.id, party);
        partyOf.set(p.id, party.id);
        pushParty(party);
      }
      if (party.members.includes(other.id)) return fail(`${other.name} is already on your team.`);
      if (party.members.length >= MAX_PARTY) return fail(`Teams are limited to ${MAX_PARTY} hunters.`);
      if (!partyInvites.has(other.id)) partyInvites.set(other.id, new Map());
      partyInvites.get(other.id).set(party.id, p.id);
      pushSocial(other.id);
      notice(p.id, `Team invite sent to ${other.name}.`);
      notice(other.id, `⚔ ${p.name} invited you to hunt beasts together!`);
    });

    socket.on('partyAccept', ({ partyId } = {}) => {
      const p = me();
      const invites = p && partyInvites.get(p.id);
      const party = parties.get(partyId);
      if (!invites || !invites.has(partyId)) return;
      invites.delete(partyId);
      if (!party) {
        pushSocial(p.id);
        return fail('That team has disbanded.');
      }
      if (party.fight) return fail('That team is mid-fight. Try again in a moment.');
      if (party.members.length >= MAX_PARTY) return fail('That team is full.');
      if (partyOf.get(p.id) !== party.id) leaveParty(p.id);
      party.members.push(p.id);
      partyOf.set(p.id, party.id);
      pushParty(party);
      pushSocial(p.id);
      party.members.filter(id => id !== p.id).forEach(id => notice(id, `${p.name} joined your team!`));
    });

    socket.on('partyDecline', ({ partyId } = {}) => {
      const p = me();
      const invites = p && partyInvites.get(p.id);
      if (invites) invites.delete(partyId);
      if (p) pushSocial(p.id);
    });

    socket.on('partyLeave', () => {
      if (socket.currentPlayerId) leaveParty(socket.currentPlayerId);
    });

    socket.on('partyFightStart', () => {
      const p = me();
      const party = p && parties.get(partyOf.get(p.id));
      if (!party) return;
      if (party.leader !== p.id) return fail('Only the team leader can start the fight.');
      if (party.fight) return;
      if (party.members.length < 2) return fail('Invite a friend to your team first.');
      const busy = party.members.map(id => db.players[id]).find(m => !m || !m.online || (m.hunt && m.hunt.inFight));
      if (busy) return fail(`${busy ? busy.name : 'A teammate'} isn't ready.`);
      const lvl = LEVELS[Math.min(LEVELS.length, Math.max(1, (p.hunt && p.hunt.level) || 1)) - 1];
      const n = party.members.length;
      const enemyMax = Math.round(lvl.enemyHealth * (1 + 0.5 * (n - 1)));
      const fight = { lvl, enemyHp: enemyMax, enemyMax, members: {}, timer: null };
      party.members.forEach(id => {
        const m = db.players[id];
        const s = combatStats(m);
        fight.members[id] = {
          hp: s.health, max: s.health, defense: s.defense, revives: s.revive,
          weapons: s.hasWeapons, lastHit: 0, dmg: 0,
          onRun: ((m.hunt && m.hunt.level) || 1) === lvl.level
        };
      });
      fight.timer = setInterval(() => beastAttack(party), lvl.isBoss ? 950 : 1100);
      party.fight = fight;
      pushParty(party);
      broadcastFight(party, { type: 'start' });
    });

    socket.on('partyHit', ({ mode } = {}) => {
      const p = me();
      const party = p && parties.get(partyOf.get(p.id));
      const fight = party && party.fight;
      const m = fight && fight.members[p.id];
      if (!m || m.hp <= 0) return;
      const s = combatStats(p);
      const weapons = mode === 'weapons' && s.hasWeapons;
      const now = Date.now();
      // Small allowance for network jitter on top of the client-side cooldown.
      if (now - m.lastHit < (weapons ? WEAPON_COOLDOWN : FIST_COOLDOWN) - 60) return;
      m.lastHit = now;
      m.weapons = weapons;
      const dmg = Math.max(1, Math.round((weapons ? s.attack : s.unarmedAttack) * (0.85 + Math.random() * 0.3)));
      fight.enemyHp -= dmg;
      m.dmg += dmg;
      broadcastFight(party, { type: 'hit', by: p.id, dmg });
      if (fight.enemyHp <= 0) endFight(party, true);
    });
  }

  setInterval(() => {
    const now = Date.now();
    for (const [id, o] of offers) if (o.expires < now) offers.delete(id);
  }, 60 * 1000).unref();

  return {
    register,
    onJoin(id) {
      social(db.players[id]);
      pushSocial(id);
      pushFriendsOf(id);
      const party = parties.get(partyOf.get(id));
      emitTo(id, 'party', party ? partyPayload(party) : null);
    },
    onOffline(id) {
      leaveParty(id);
      partyInvites.delete(id);
      pushFriendsOf(id);
    },
    onHuntChanged(id) {
      const party = parties.get(partyOf.get(id));
      if (party) pushParty(party);
    }
  };
};
