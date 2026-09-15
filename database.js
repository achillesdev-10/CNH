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
    extras TEXT,
    price_total REAL,
    vehicle_surcharge REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    unit TEXT DEFAULT '/ véhicule',
    icon TEXT,
    features TEXT,
    price_from INTEGER DEFAULT 0,
    bookable INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// ── Grille tarifaire par défaut ─────────────────────────────────
// Insérée uniquement si la table `pricing` est vide. Ensuite, tout est
// modifiable depuis l'admin (onglet Tarifs) sans toucher au code.
const DEFAULT_PRICING = [
  // Services à l'unité
  { category: 'service', name: 'Lavage Extérieur', price: 35, icon: 'fa-spray-can-sparkles', price_from: 1, bookable: 1, sort_order: 1, description: 'Lavage complet de la carrosserie, des jantes, des pneus et des vitres avec produits biologiques.' },
  { category: 'service', name: 'Lavage Intérieur', price: 45, icon: 'fa-couch', price_from: 1, bookable: 1, sort_order: 2, description: 'Aspiration, nettoyage du tableau de bord, des sièges, des portes et traitement des odeurs.' },
  { category: 'service', name: 'Detailing Complet', price: 85, icon: 'fa-wand-magic-sparkles', price_from: 1, bookable: 1, sort_order: 3, description: 'Lavage extérieur et intérieur complet + cire, dressing des pneus et finition premium.' },
  { category: 'service', name: 'Nettoyage Moteur', price: 55, icon: 'fa-gears', price_from: 1, bookable: 1, sort_order: 4, description: 'Nettoyage en profondeur du compartiment moteur avec dégraissant professionnel.' },
  { category: 'service', name: 'Protection Cire', price: 65, icon: 'fa-shield-halved', price_from: 1, bookable: 1, sort_order: 5, description: 'Application de cire haute protection pour garder votre voiture brillante plus longtemps.' },
  { category: 'service', name: 'Tous types de véhicules', price: 120, icon: 'fa-truck-pickup', price_from: 0, bookable: 0, sort_order: 6, description: 'Berline, VUS, minivan, camion ou pick-up : le même tarif unique de 120 $ pour un lavage complet.' },
  { category: 'service', name: 'Lavage de flotte', price: 0, unit: 'Sur devis', icon: 'fa-truck-fast', price_from: 0, bookable: 0, sort_order: 7, description: 'Lavage de flotte de véhicules de tout genre : trailers, camions de béton, boom et pompes à béton. Tarification établie sur devis.' },

  // Forfaits (affichés dans la section Tarifs)
  { category: 'package', name: 'Essentiel', price: 35, icon: 'fa-star', price_from: 0, bookable: 1, sort_order: 1, description: 'Lavage extérieur complet, jantes, pneus et séchage.', features: ['Lavage extérieur complet', 'Jantes & pneus', 'Essuie-glaces', 'Séchage'] },
  { category: 'package', name: 'Confort', price: 70, icon: 'fa-star', price_from: 0, bookable: 1, sort_order: 2, description: 'Extérieur + intérieur complet (aspiration, tableau de bord, pneus).', features: ['Tout le forfait Essentiel', 'Aspiration intérieure', 'Nettoyage tableau de bord', 'Dressing des pneus', 'Rafraîchissement odeurs'] },
  { category: 'package', name: 'Premium', price: 120, icon: 'fa-crown', price_from: 0, bookable: 1, sort_order: 3, description: 'Service complet : extérieur, intérieur, cire, moteur, cuir et tapis — tous types de véhicules.', features: ['Tout le forfait Confort', 'Tous types de véhicules (prix fixe)', 'Cire haute protection', 'Nettoyage moteur', 'Traitement cuir/vinyle', 'Nettoyage des tapis'] },

  // Types de véhicule : supplément appliqué automatiquement au total de la réservation
  // (montants à 0 $ par défaut — à définir dans l'admin, onglet Tarifs)
  { category: 'vehicle', name: 'Berline', price: 0, price_from: 0, bookable: 1, sort_order: 1, description: 'Supplément véhicule de type berline.' },
  { category: 'vehicle', name: 'SUV', price: 0, price_from: 0, bookable: 1, sort_order: 2, description: 'Supplément véhicule de type SUV.' },
  { category: 'vehicle', name: 'Minivan', price: 0, price_from: 0, bookable: 1, sort_order: 3, description: 'Supplément véhicule de type minivan.' },
  { category: 'vehicle', name: 'Camion / Pick-up', price: 0, price_from: 0, bookable: 1, sort_order: 4, description: 'Supplément camion ou pick-up.' },
  { category: 'vehicle', name: 'Coupé / Roadster', price: 0, price_from: 0, bookable: 1, sort_order: 5, description: 'Supplément coupé ou roadster.' },
  { category: 'vehicle', name: 'Autre', price: 0, price_from: 0, bookable: 1, sort_order: 6, description: 'Autre type de véhicule.' },

  // Options de soins esthétiques et extras (sur demande)
  { category: 'extra', name: 'Nettoyage & Brillance des pneus', price: 15, icon: 'fa-circle-dot', price_from: 0, bookable: 1, sort_order: 1, description: "Dégraissage complet du flanc des pneus, élimination de la poussière de frein et application d'un traitement lustrant longue durée (effet mouillé et protecteur UV)." },
  { category: 'extra', name: 'Soin & Traitement à la cire des cuirs', price: 45, icon: 'fa-couch', price_from: 0, bookable: 1, sort_order: 2, description: "Nettoyage en profondeur des pores du cuir avec un savon doux spécifique, suivi de l'application d'une cire/crème nourrissante qui redonne de la souplesse et prévient les craquelures." },
  { category: 'extra', name: 'Protection carrosserie (Cire Express)', price: 30, icon: 'fa-shield-halved', price_from: 0, bookable: 1, sort_order: 3, description: "Application d'une cire de finition hydrophobe à haute brillance après lavage, protégeant la peinture contre les agressions du béton et de la saleté de chantier." },
  { category: 'extra', name: 'Shampoing des tapis et tissus', price: 60, icon: 'fa-water', price_from: 0, bookable: 1, sort_order: 4, description: 'Extraction par injection/extraction des taches tenaces, boue incrustée et odeurs dans les tapis de sol et sièges en tissu des cabines.' }
];

const PRICING_COLUMNS = ['category', 'name', 'description', 'price', 'unit', 'icon', 'features', 'price_from', 'bookable', 'active', 'sort_order'];

function pricingSeedValues(row) {
  return PRICING_COLUMNS.map(col => {
    if (col === 'features') return row.features ? JSON.stringify(row.features) : null;
    if (col === 'sort_order') return row.sort_order == null ? 0 : row.sort_order;
    if (col === 'price_from') return row.price_from || 0;
    if (col === 'bookable') return row.bookable == null ? 1 : row.bookable;
    if (col === 'active') return row.active == null ? 1 : row.active;
    if (col === 'unit') return row.unit || '/ véhicule';
    return row[col] == null ? null : row[col];
  });
}

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

// ── Migrations (idempotentes, exécutées à chaque démarrage) ────
// Les bases créées avant l'ajout d'une colonne ont besoin d'un ALTER TABLE :
// CREATE TABLE IF NOT EXISTS ne modifie pas une table existante.
async function tableColumns(table) {
  if (usingTurso()) {
    const res = await client.execute({ sql: "SELECT name FROM pragma_table_info('" + table + "')" });
    return res.rows.map(row => row.name);
  }
  const res = db.exec("SELECT name FROM pragma_table_info('" + table + "')");
  return res.length ? res[0].values.map(v => v[0]) : [];
}

async function addColumnIfMissing(table, column, type) {
  try {
    const cols = await tableColumns(table);
    if (!cols.length || cols.includes(column)) return;
    const sql = 'ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + type;
    if (usingTurso()) await client.execute({ sql });
    else { db.run(sql); saveDatabase(); }
    console.log('✅ Migration : colonne ' + table + '.' + column + ' ajoutée');
  } catch (err) {
    // Ne jamais empêcher le démarrage de l'application à cause d'une migration
    console.warn('⚠️  Migration ' + table + '.' + column + ' ignorée :', err.message);
  }
}

async function migrate() {
  await addColumnIfMissing('reservations', 'extras', 'TEXT');
  await addColumnIfMissing('reservations', 'price_total', 'REAL');
  await addColumnIfMissing('reservations', 'vehicle_surcharge', 'REAL');
}

// ── Grille tarifaire (seed unique, éditable ensuite via l'admin) ─
async function seedPricing() {
  const insertSql = 'INSERT INTO pricing (' + PRICING_COLUMNS.join(', ') + ') VALUES (' + PRICING_COLUMNS.map(() => '?').join(', ') + ')';
  if (usingTurso()) {
    const count = await client.execute({ sql: 'SELECT COUNT(*) as c FROM pricing' });
    if (Number(count.rows[0].c) > 0) return;
    for (const row of DEFAULT_PRICING) {
      await client.execute({ sql: insertSql, args: pricingSeedValues(row) });
    }
  } else {
    const res = db.exec('SELECT COUNT(*) as c FROM pricing');
    if (res.length && res[0].values[0][0] > 0) return;
    for (const row of DEFAULT_PRICING) db.run(insertSql, pricingSeedValues(row));
  }
  console.log('✅ Grille tarifaire initialisée (' + DEFAULT_PRICING.length + ' lignes)');
}

// ── Migrations de contenu de la grille tarifaire ──────────────
// Les bases déjà initialisées ne repassent pas par le seed complet :
// ces lignes du défaut sont insérées si elles sont absentes.
const PRICING_MIGRATION_ROWS = [
  { category: 'service', name: 'Lavage de flotte', price: 0, unit: 'Sur devis', icon: 'fa-truck-fast', price_from: 0, bookable: 0, sort_order: 7, description: 'Lavage de flotte de véhicules de tout genre : trailers, camions de béton, boom et pompes à béton. Tarification établie sur devis.' }
];

async function ensurePricingRow(row) {
  try {
    const insertSql = 'INSERT INTO pricing (' + PRICING_COLUMNS.join(', ') + ') VALUES (' + PRICING_COLUMNS.map(() => '?').join(', ') + ')';
    const checkSql = 'SELECT COUNT(*) as c FROM pricing WHERE category = ? AND name = ?';
    const args = [row.category, row.name];
    let exists;
    if (usingTurso()) {
      const res = await client.execute({ sql: checkSql, args });
      exists = Number(res.rows[0].c) > 0;
      if (!exists) await client.execute({ sql: insertSql, args: pricingSeedValues(row) });
    } else {
      const stmt = db.prepare(checkSql);
      stmt.bind(args);
      stmt.step();
      exists = stmt.get()[0] > 0;
      stmt.free();
      if (!exists) db.run(insertSql, pricingSeedValues(row));
    }
    if (!exists) console.log('✅ Grille tarifaire : ligne « ' + row.name + ' » ajoutée');
  } catch (err) {
    // Ne jamais empêcher le démarrage de l'application à cause d'une migration
    console.warn('⚠️  Ajout de la ligne « ' + row.name + ' » ignoré :', err.message);
  }
}

async function migratePricingRows() {
  for (const row of PRICING_MIGRATION_ROWS) await ensurePricingRow(row);
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
      await migrate();
      await seedTurso();
      await seedPricing();
      await migratePricingRows();
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
    await migrate();
    seedLocal();
    await seedPricing();
    await migratePricingRows();
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