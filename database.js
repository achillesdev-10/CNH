const bcrypt = require('bcryptjs');
const path = require('path');

// ── Mode detection ─────────────────────────────────────────────
// If TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are set, use Turso
// (managed libSQL/SQLite) — this is the mode used on Vercel where the
// filesystem is read-only and ephemeral.
// Otherwise fall back to the local sql.js file (cnh_service.db).
// NOTE: evaluated lazily, not at module load, because server.js loads
// .env AFTER requiring this module.
function usingTurso() {
  return !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

let db = null;      // sql.js Database instance (local mode)
let client = null;  // libsql client (Turso mode)
let initPromise = null;

// ── Schema ─────────────────────────────────────────────────────
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    date_wished TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    vehicle_plate TEXT,
    service TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT,
    reservation_date TEXT NOT NULL,
    reservation_time TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    value INTEGER DEFAULT 1,
    date TEXT DEFAULT (date('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    rating INTEGER DEFAULT 5,
    message TEXT NOT NULL,
    approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];

// ── Seed data ──────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  email: 'cnh4314@gmail.com',
  phone: '+1 450 230 2509',
  whatsapp: '14502302509',
  hours: 'Lun-Ven: 8h–18h | Sam: 9h–16h | Dim: Sur rendez-vous',
  address: 'Grand Montréal & Laurentides',
  welcome_msg: 'Bonjour CNH Service, je souhaite un devis pour un lavage auto.',
  site_title: 'CNH Service | Lavage Auto à Domicile'
};

// sql.js (sync) seeding
function seedLocal() {
  const adminCheck = db.exec("SELECT id FROM admin_users WHERE username = 'admin'");
  if (!adminCheck.length || !adminCheck[0].values.length) {
    const hash = bcrypt.hashSync('cnh2026', 10);
    db.run("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", ['admin', hash]);
    console.log('✅ Default admin created (admin / cnh2026)');
  }
  const settingsCheck = db.exec("SELECT COUNT(*) as c FROM settings");
  if (settingsCheck[0].values[0][0] === 0) {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [k, v]);
    }
  }
}

// Turso (async) seeding — idempotent, safe to run on every cold start
async function seedTurso() {
  const admin = await client.execute({ sql: "SELECT id FROM admin_users WHERE username = 'admin'" });
  if (!admin.rows.length) {
    const hash = bcrypt.hashSync('cnh2026', 10);
    await client.execute({
      sql: "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
      args: ['admin', hash]
    });
  }
  const count = await client.execute({ sql: 'SELECT COUNT(*) as c FROM settings' });
  if (Number(count.rows[0].c) === 0) {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        args: [k, v]
      });
    }
  }
}

// ── Init ───────────────────────────────────────────────────────
async function initDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (usingTurso()) {
      const { createClient } = require('@libsql/client');
      client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      });
      for (const sql of SCHEMA) await client.execute({ sql });
      await seedTurso();
      console.log('✅ Turso database ready');
      return client;
    }

    // Local mode: sql.js + file persistence (as before)
    const initSqlJs = require('sql.js');
    const fs = require('fs');
    const DB_PATH = path.join(__dirname, 'cnh_service.db');
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    for (const sql of SCHEMA) db.run(sql);
    seedLocal();
    saveDatabase();
    console.log('✅ Local SQLite database initialized');
    return db;
  })();
  return initPromise;
}

// ── Query helpers (async in both modes) ────────────────────────
async function queryAll(sql, params = []) {
  await initDatabase();
  if (usingTurso()) {
    const res = await client.execute({ sql, args: params });
    return res.rows.map(row => (row.toJSON ? row.toJSON() : row));
  }
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Runs a write query and returns the last inserted row id (or null)
async function runSql(sql, params = []) {
  await initDatabase();
  if (usingTurso()) {
    const res = await client.execute({ sql, args: params });
    // lastInsertRowid is a BigInt in @libsql/client — return a plain number
    // like the local mode does, so it can be serialized in JSON responses.
    const rid = res.lastInsertRowid;
    return rid == null ? null : Number(rid);
  }
  db.run(sql, params);
  const res = db.exec('SELECT last_insert_rowid() as id');
  saveDatabase();
  return res.length > 0 ? res[0].values[0][0] : null;
}

// ── Persistence (local mode only; Turso persists server-side) ──
function saveDatabase() {
  if (usingTurso() || !db) return;
  const fs = require('fs');
  const data = db.export();
  fs.writeFileSync(path.join(__dirname, 'cnh_service.db'), Buffer.from(data));
}

if (!usingTurso()) {
  // Auto-save every 30 seconds (local mode)
  setInterval(saveDatabase, 30000);

  // Save on exit (local mode)
  process.on('exit', saveDatabase);
  process.on('SIGINT', () => { saveDatabase(); process.exit(); });
}

module.exports = { initDatabase, queryAll, queryOne, runSql, saveDatabase };