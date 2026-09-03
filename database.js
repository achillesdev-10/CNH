const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cnh_service.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      message TEXT NOT NULL,
      date_wished TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value INTEGER DEFAULT 1,
      date TEXT DEFAULT (date('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      rating INTEGER DEFAULT 5,
      message TEXT NOT NULL,
      approved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed admin
  const adminCheck = db.exec("SELECT id FROM admin_users WHERE username = 'admin'");
  if (!adminCheck.length || !adminCheck[0].values.length) {
    const hash = bcrypt.hashSync('cnh2026', 10);
    db.run("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", ['admin', hash]);
    console.log('✅ Default admin created (admin / cnh2026)');
  }

  // Seed settings
  const defaultSettings = {
    email: 'cnh4314@gmail.com',
    phone: '+1 450 230 2509',
    whatsapp: '14502302509',
    hours: 'Lun-Ven: 8h–18h | Sam: 9h–16h | Dim: Sur rendez-vous',
    address: 'Grand Montréal & Laurentides',
    welcome_msg: 'Bonjour CNH Service, je souhaite un devis pour un lavage auto.',
    site_title: 'CNH Service | Lavage Auto à Domicile'
  };
  const settingsCheck = db.exec("SELECT COUNT(*) as c FROM settings");
  if (settingsCheck[0].values[0][0] === 0) {
    for (const [k, v] of Object.entries(defaultSettings)) {
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [k, v]);
    }
  }

  // Note: no sample contacts/reservations/stats are inserted — the admin
  // dashboard only shows real submissions.
  // No demo testimonials: only real client reviews submitted on the site
  // and approved by the admin feed the testimonials and the rating.

  // Save to disk
  saveDatabase();
  console.log('✅ Database initialized');

  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 30 seconds
setInterval(saveDatabase, 30000);

// Save on exit
process.on('exit', saveDatabase);
process.on('SIGINT', () => { saveDatabase(); process.exit(); });

module.exports = { initDatabase, getDb: () => db, saveDatabase };
