const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'brickcred.db');
const LEGACY_JSON = path.join(__dirname, 'db.json');

const sql = new Database(DB_PATH);
sql.pragma('journal_mode = WAL');
sql.pragma('foreign_keys = ON');

sql.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY REFERENCES players(id),
    username TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    email TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    data TEXT NOT NULL,
    position INTEGER NOT NULL
  );
`);

const stmts = {
  allPlayers: sql.prepare('SELECT data FROM players'),
  upsertPlayer: sql.prepare(`INSERT INTO players (id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
  allListings: sql.prepare('SELECT data FROM listings ORDER BY position'),
  clearListings: sql.prepare('DELETE FROM listings'),
  insertListing: sql.prepare('INSERT INTO listings (id, seller_id, data, position) VALUES (?, ?, ?, ?)'),
  userById: sql.prepare('SELECT * FROM users WHERE id = ?'),
  userByUsername: sql.prepare('SELECT * FROM users WHERE username = ?'),
  userByGoogle: sql.prepare('SELECT * FROM users WHERE google_sub = ?'),
  insertUser: sql.prepare(`INSERT INTO users (id, username, password_hash, google_sub, email, created_at)
    VALUES (@id, @username, @password_hash, @google_sub, @email, @created_at)`),
  insertSession: sql.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
  sessionUser: sql.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?'),
  deleteSession: sql.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  purgeSessions: sql.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
};

const savePlayers = sql.transaction(players => {
  const now = Date.now();
  for (const p of players) {
    const { online, ...rest } = p;
    stmts.upsertPlayer.run(p.id, JSON.stringify(rest), now);
  }
});

const saveListings = sql.transaction(listings => {
  stmts.clearListings.run();
  listings.forEach((l, i) => stmts.insertListing.run(l.id, l.sellerId, JSON.stringify(l), i));
});

function loadState() {
  const players = {};
  for (const row of stmts.allPlayers.all()) {
    const p = JSON.parse(row.data);
    p.online = false;
    players[p.id] = p;
  }
  const listings = stmts.allListings.all().map(row => JSON.parse(row.data));
  return { players, listings };
}

// One-time import of the old db.json so existing progress carries over.
function importLegacyJson() {
  const hasPlayers = sql.prepare('SELECT 1 FROM players LIMIT 1').get();
  if (hasPlayers || !fs.existsSync(LEGACY_JSON)) return;
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8'));
    savePlayers(Object.values(legacy.players || {}));
    saveListings(legacy.listings || []);
    console.log(`Imported ${Object.keys(legacy.players || {}).length} players from db.json`);
  } catch (e) {
    console.error('Failed to import db.json', e);
  }
}

importLegacyJson();
stmts.purgeSessions.run(Date.now());

module.exports = {
  loadState,
  savePlayers,
  saveListings,
  getUserById: id => stmts.userById.get(id),
  getUserByUsername: username => stmts.userByUsername.get(username),
  getUserByGoogle: sub => stmts.userByGoogle.get(sub),
  createUser: user => stmts.insertUser.run({ username: null, password_hash: null, google_sub: null, email: null, created_at: Date.now(), ...user }),
  createSession: (tokenHash, userId, expiresAt) => stmts.insertSession.run(tokenHash, userId, expiresAt),
  getSessionUserId: tokenHash => stmts.sessionUser.get(tokenHash, Date.now())?.user_id || null,
  deleteSession: tokenHash => stmts.deleteSession.run(tokenHash),
};
