const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, saveDatabase } = require('./database');

// ── Optional .env loader (no dependency) ──
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
})();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security ──
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(s => s.trim()) } : {}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Trop de requêtes.' } }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Sessions ──
const sessions = new Map();
function generateToken() { return require('crypto').randomBytes(32).toString('hex'); }
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Non autorisé' });
  req.adminId = sessions.get(token);
  next();
}

// ── Helper: run query and return results as array of objects ──
function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) { results.push(stmt.getAsObject()); }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  // Get last insert rowid
  const res = db.exec('SELECT last_insert_rowid() as id');
  saveDatabase();
  return res.length > 0 ? res[0].values[0][0] : null;
}

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const user = queryOne('SELECT * FROM admin_users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const token = generateToken();
  sessions.set(token, user.id);
  res.json({ token, username: user.username });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  sessions.delete(req.headers.authorization?.replace('Bearer ', ''));
  res.json({ message: 'OK' });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => { res.json({ valid: true }); });

// ══════════════════════════════════════
//  CONTACTS
// ══════════════════════════════════════

app.post('/api/contacts', (req, res) => {
  const { name, email, phone, service, message, date } = req.body;
  if (!name || !email || !phone || !service || !message) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });
  try {
    const id = runSql('INSERT INTO contacts (name, email, phone, service, message, date_wished) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, service, message, date || null]);
    runSql("INSERT INTO stats (type, value) VALUES ('form_submission', 1)");
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/contacts', authMiddleware, (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM contacts';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  const total = queryOne('SELECT COUNT(*) as count FROM contacts' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const contacts = queryAll(sql, params);
  res.json({ contacts, total: total?.count || 0 });
});

app.patch('/api/contacts/:id', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!['new', 'in_progress', 'completed', 'archived'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  runSql('UPDATE contacts SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
  res.json({ success: true });
});

// ══════════════════════════════════════
//  RESERVATIONS
// ══════════════════════════════════════

app.get('/api/reservations/slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date requise' });
  const allSlots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
  const booked = queryAll("SELECT reservation_time FROM reservations WHERE reservation_date = ? AND status IN ('pending','confirmed')", [date]).map(r => r.reservation_time);
  res.json({ date, slots: allSlots.map(time => ({ time, available: !booked.includes(time) })) });
});

app.post('/api/reservations', (req, res) => {
  const { name, email, phone, vehicle_type, vehicle_plate, service, address, city, postal_code, date, time, notes } = req.body;
  if (!name || !email || !phone || !vehicle_type || !service || !address || !city || !date || !time) {
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis' });
  }
  const existing = queryOne("SELECT id FROM reservations WHERE reservation_date = ? AND reservation_time = ? AND status IN ('pending','confirmed')", [date, time]);
  if (existing) return res.status(409).json({ error: 'Ce créneau est déjà réservé.' });
  try {
    const id = runSql('INSERT INTO reservations (name, email, phone, vehicle_type, vehicle_plate, service, address, city, postal_code, reservation_date, reservation_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, vehicle_type, vehicle_plate || null, service, address, city, postal_code || null, date, time, notes || null]);
    runSql("INSERT INTO stats (type, value) VALUES ('reservation', 1)");
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/reservations', authMiddleware, (req, res) => {
  const { status, date, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (date) { sql += ' AND reservation_date = ?'; params.push(date); }
  const total = queryOne('SELECT COUNT(*) as count FROM reservations', []);
  sql += ' ORDER BY reservation_date ASC, reservation_time ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const reservations = queryAll(sql, params);
  res.json({ reservations, total: total?.count || 0 });
});

app.patch('/api/reservations/:id', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  runSql('UPDATE reservations SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
  res.json({ success: true });
});

app.delete('/api/reservations/:id', authMiddleware, (req, res) => {
  runSql('DELETE FROM reservations WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ══════════════════════════════════════
//  STATS
// ══════════════════════════════════════

app.get('/api/stats/dashboard', authMiddleware, (req, res) => {
  const totalContacts = queryOne('SELECT COUNT(*) as count FROM contacts')?.count || 0;
  const rating = queryOne("SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as count FROM testimonials WHERE approved = 1");
  const newContacts = queryOne("SELECT COUNT(*) as count FROM contacts WHERE status = 'new'")?.count || 0;
  const totalReservations = queryOne('SELECT COUNT(*) as count FROM reservations')?.count || 0;
  const pendingReservations = queryOne("SELECT COUNT(*) as count FROM reservations WHERE status = 'pending'")?.count || 0;
  const monthVisits = queryOne("SELECT COALESCE(SUM(value),0) as count FROM stats WHERE type = 'visit' AND date >= date('now','start of month')")?.count || 0;
  const monthForms = queryOne("SELECT COALESCE(SUM(value),0) as count FROM stats WHERE type = 'form_submission' AND date >= date('now','start of month')")?.count || 0;
  const monthCalls = queryOne("SELECT COALESCE(SUM(value),0) as count FROM stats WHERE type = 'call' AND date >= date('now','start of month')")?.count || 0;
  const weeklyActivity = queryAll("SELECT date, type, SUM(value) as total FROM stats WHERE date >= date('now','-7 days') GROUP BY date, type ORDER BY date ASC");
  const recentContacts = queryAll('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5');
  const recentReservations = queryAll('SELECT * FROM reservations ORDER BY created_at DESC LIMIT 5');
  const topServices = queryAll('SELECT service, COUNT(*) as count FROM reservations GROUP BY service ORDER BY count DESC LIMIT 5');

  res.json({
    overview: {
      totalContacts, newContacts, totalReservations, pendingReservations, monthVisits, monthForms, monthCalls,
      avgRating: rating?.avg_rating != null ? rating.avg_rating : null,
      ratingsCount: rating?.count || 0
    },
    weeklyActivity, recentContacts, recentReservations, topServices
  });
});

app.post('/api/stats/visit', (req, res) => {
  runSql("INSERT INTO stats (type, value) VALUES ('visit', 1)");
  res.json({ success: true });
});

// Public stats for the homepage counters (no auth needed)
app.get('/api/stats/public', (req, res) => {
  const vehiclesWashed = queryOne("SELECT COUNT(*) as count FROM reservations WHERE status = 'completed'")?.count || 0;
  const rating = queryOne('SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as count FROM testimonials WHERE approved = 1');
  const count = rating?.count || 0;
  const positive = count > 0
    ? (queryOne('SELECT COUNT(*) as count FROM testimonials WHERE approved = 1 AND rating >= 4')?.count || 0)
    : 0;
  res.json({
    vehiclesWashed,
    avgRating: rating?.avg_rating != null ? rating.avg_rating : null,
    ratingCount: count,
    satisfactionPct: count > 0 ? Math.round((positive / count) * 100) : null
  });
});

// ══════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════

app.get('/api/settings', (req, res) => {
  const rows = queryAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/settings', authMiddleware, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    const existing = queryOne('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing) {
      runSql("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [value, key]);
    } else {
      runSql("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }
  }
  res.json({ success: true });
});

// ══════════════════════════════════════
//  TESTIMONIALS
// ══════════════════════════════════════

app.get('/api/testimonials', (req, res) => {
  res.json(queryAll('SELECT * FROM testimonials WHERE approved = 1 ORDER BY id DESC'));
});

// Public submission — published on the site only after admin approval
app.post('/api/testimonials', (req, res) => {
  const cleanName = String(req.body?.name || '').trim();
  const cleanMessage = String(req.body?.message || '').trim();
  const cleanLocation = String(req.body?.location || '').trim();
  const cleanRating = Math.min(5, Math.max(1, parseInt(req.body?.rating, 10) || 5));
  if (cleanName.length < 2 || cleanName.length > 80) return res.status(400).json({ error: 'Nom requis (2 à 80 caractères)' });
  if (cleanMessage.length < 5 || cleanMessage.length > 1000) return res.status(400).json({ error: 'Message requis (5 à 1000 caractères)' });
  if (cleanLocation.length > 80) return res.status(400).json({ error: 'Localisation trop longue' });
  try {
    const id = runSql('INSERT INTO testimonials (name, location, rating, message, approved) VALUES (?, ?, ?, ?, 0)',
      [cleanName, cleanLocation || null, cleanRating, cleanMessage]);
    res.json({ success: true, id, message: 'Merci ! Votre avis sera publié après validation.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: list all testimonials for moderation
app.get('/api/testimonials/admin', authMiddleware, (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM testimonials';
  const params = [];
  if (status === 'approved') sql += ' WHERE approved = 1';
  if (status === 'pending') sql += ' WHERE approved = 0';
  sql += ' ORDER BY approved ASC, id DESC';
  res.json(queryAll(sql, params));
});

// Admin: publish or hide a testimonial
app.patch('/api/testimonials/:id', authMiddleware, (req, res) => {
  runSql('UPDATE testimonials SET approved = ? WHERE id = ?', [req.body?.approved ? 1 : 0, parseInt(req.params.id)]);
  res.json({ success: true });
});

// Admin: delete a testimonial
app.delete('/api/testimonials/:id', authMiddleware, (req, res) => {
  runSql('DELETE FROM testimonials WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

// ══════════════════════════════════════
//  SPA FALLBACK
// ══════════════════════════════════════

app.get('/reservation', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reservation.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Start ──
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n  🚗 CNH Service - Lavage Auto`);
    console.log(`  Serveur: http://localhost:${PORT}`);
    console.log(`  Admin:   http://localhost:${PORT}/admin`);
    console.log(`  Résa:    http://localhost:${PORT}/reservation\n`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
