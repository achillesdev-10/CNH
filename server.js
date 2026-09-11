const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initDatabase, queryAll, queryOne, runSql } = require('./database');

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

// ── Helpers ──
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// Wrap async route handlers so rejected promises reach the error middleware
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Heures de rendez-vous proposées (source unique de vérité)
const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

// Clés autorisées pour les paramètres publics du site
const ALLOWED_SETTINGS = ['email', 'phone', 'whatsapp', 'hours', 'address', 'welcome_msg', 'site_title'];

const cleanInt = (value, def, min, max) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
};

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));

// Sessions are stored in the database so they survive serverless cold starts
async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    const session = await queryOne('SELECT admin_id FROM sessions WHERE token = ?', [token]);
    if (!session) return res.status(401).json({ error: 'Non autorisé' });
    req.adminId = session.admin_id;
    next();
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const user = await queryOne('SELECT * FROM admin_users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const token = generateToken();
  await runSql('INSERT INTO sessions (token, admin_id) VALUES (?, ?)', [token, user.id]);
  // Cleanup: drop sessions older than 30 days
  await runSql("DELETE FROM sessions WHERE created_at < datetime('now', '-30 days')");
  res.json({ token, username: user.username });
}));

app.post('/api/auth/logout', authMiddleware, asyncHandler(async (req, res) => {
  await runSql('DELETE FROM sessions WHERE token = ?', [req.headers.authorization?.replace('Bearer ', '')]);
  res.json({ message: 'OK' });
}));

app.get('/api/auth/verify', authMiddleware, (req, res) => { res.json({ valid: true }); });

// ══════════════════════════════════════
//  CONTACTS
// ══════════════════════════════════════

app.post('/api/contacts', asyncHandler(async (req, res) => {
  const { name, email, phone, service, message, date } = req.body;
  if (!name || !email || !phone || !service || !message) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
  try {
    const id = await runSql('INSERT INTO contacts (name, email, phone, service, message, date_wished) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, service, message, date || null]);
    await runSql("INSERT INTO stats (type, value) VALUES ('form_submission', 1)");
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}));

app.get('/api/contacts', authMiddleware, asyncHandler(async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM contacts';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  const total = await queryOne('SELECT COUNT(*) as count FROM contacts' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(cleanInt(limit, 50, 1, 200), cleanInt(offset, 0, 0, 1000000));
  const contacts = await queryAll(sql, params);
  res.json({ contacts, total: total?.count || 0 });
}));

app.patch('/api/contacts/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['new', 'in_progress', 'completed', 'archived'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  await runSql('UPDATE contacts SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
  res.json({ success: true });
}));

// ══════════════════════════════════════
//  RESERVATIONS
// ══════════════════════════════════════

app.get('/api/reservations/slots', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date requise' });
  const booked = (await queryAll("SELECT reservation_time FROM reservations WHERE reservation_date = ? AND status IN ('pending','confirmed')", [date])).map(r => r.reservation_time);
  res.json({ date, slots: TIME_SLOTS.map(time => ({ time, available: !booked.includes(time) })) });
}));

app.post('/api/reservations', asyncHandler(async (req, res) => {
  const { name, email, phone, vehicle_type, vehicle_plate, service, address, city, postal_code, date, time, notes, extras } = req.body;
  if (!name || !email || !phone || !vehicle_type || !service || !address || !city || !date || !time) {
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ error: 'Date invalide' });
  if (!TIME_SLOTS.includes(time)) return res.status(400).json({ error: 'Heure invalide' });
  const extraNames = Array.isArray(extras)
    ? extras.map(e => String(e).trim()).filter(Boolean)
    : (typeof extras === 'string' && extras.trim() ? extras.split(',').map(e => e.trim()).filter(Boolean) : []);
  const cleanExtras = extraNames.length ? extraNames.join(', ').slice(0, 500) : null;
  const { total: priceTotal, surcharge: vehicleSurcharge } = await computeReservationPricing(service, extraNames, vehicle_type);
  const existing = await queryOne("SELECT id FROM reservations WHERE reservation_date = ? AND reservation_time = ? AND status IN ('pending','confirmed')", [date, time]);
  if (existing) return res.status(409).json({ error: 'Ce créneau est déjà réservé.' });
  try {
    const id = await runSql('INSERT INTO reservations (name, email, phone, vehicle_type, vehicle_plate, service, address, city, postal_code, reservation_date, reservation_time, notes, extras, price_total, vehicle_surcharge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, vehicle_type, vehicle_plate || null, service, address, city, postal_code || null, date, time, notes || null, cleanExtras, priceTotal, vehicleSurcharge]);
    await runSql("INSERT INTO stats (type, value) VALUES ('reservation', 1)");
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}));

app.get('/api/reservations', authMiddleware, asyncHandler(async (req, res) => {
  const { status, date, limit = 50, offset = 0 } = req.query;
  let where = '';
  const params = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (date) { where += ' AND reservation_date = ?'; params.push(date); }
  // Le total doit refléter les mêmes filtres que la liste
  const total = await queryOne('SELECT COUNT(*) as count FROM reservations WHERE 1=1' + where, params);
  const sql = 'SELECT * FROM reservations WHERE 1=1' + where + ' ORDER BY reservation_date ASC, reservation_time ASC LIMIT ? OFFSET ?';
  params.push(cleanInt(limit, 50, 1, 200), cleanInt(offset, 0, 0, 1000000));
  const reservations = await queryAll(sql, params);
  res.json({ reservations, total: total?.count || 0 });
}));

// ── Export CSV des réservations (respecte le filtre `status` de l'admin) ──
// Séparateur « ; » et décimales à la française : ouverture directe dans Excel FR.
const RESERVATION_STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé' };

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function csvTotal(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
}

app.get('/api/reservations/export.csv', authMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) { where = ' WHERE status = ?'; params.push(status); }
  const rows = await queryAll('SELECT * FROM reservations' + where + ' ORDER BY reservation_date ASC, reservation_time ASC', params);

  const header = ['#', 'Nom', 'Email', 'Téléphone', 'Type de véhicule', 'Plaque', 'Service', 'Extras', 'Supplément véhicule ($)', 'Total ($)', 'Date', 'Heure', 'Adresse', 'Ville', 'Code postal', 'Notes', 'Statut', 'Créée le'];
  const lines = [header.map(csvCell).join(';')];
  for (const r of rows) {
    lines.push([
      r.id, r.name, r.email, r.phone, r.vehicle_type, r.vehicle_plate, r.service, r.extras,
      csvTotal(r.vehicle_surcharge), csvTotal(r.price_total), r.reservation_date, r.reservation_time,
      r.address, r.city, r.postal_code, r.notes, RESERVATION_STATUS_LABELS[r.status] || r.status, r.created_at
    ].map(csvCell).join(';'));
  }

  // BOM UTF-8 pour que les accents s'affichent correctement dans Excel
  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cnh-reservations-' + stamp + (status ? '-' + status : '') + '.csv"');
  res.send(csv);
}));

app.patch('/api/reservations/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  await runSql('UPDATE reservations SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
  res.json({ success: true });
}));

app.delete('/api/reservations/:id', authMiddleware, asyncHandler(async (req, res) => {
  await runSql('DELETE FROM reservations WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
}));

// ══════════════════════════════════════
//  STATS
// ══════════════════════════════════════

app.get('/api/stats/dashboard', authMiddleware, asyncHandler(async (req, res) => {
  const totalContacts = (await queryOne('SELECT COUNT(*) as count FROM contacts'))?.count || 0;
  const rating = await queryOne("SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as count FROM testimonials WHERE approved = 1");
  const newContacts = (await queryOne("SELECT COUNT(*) as count FROM contacts WHERE status = 'new'"))?.count || 0;
  const totalReservations = (await queryOne('SELECT COUNT(*) as count FROM reservations'))?.count || 0;
  const pendingReservations = (await queryOne("SELECT COUNT(*) as count FROM reservations WHERE status = 'pending'"))?.count || 0;
  const monthVisits = (await queryOne("SELECT COALESCE(SUM(value),0) as count FROM stats WHERE type = 'visit' AND date >= date('now','start of month')"))?.count || 0;
  const monthForms = (await queryOne("SELECT COALESCE(SUM(value),0) as count FROM stats WHERE type = 'form_submission' AND date >= date('now','start of month')"))?.count || 0;
  const monthCalls = (await queryOne("SELECT COALESCE(SUM(value),0) as count FROM stats WHERE type = 'call' AND date >= date('now','start of month')"))?.count || 0;
  const weeklyActivity = await queryAll("SELECT date, type, SUM(value) as total FROM stats WHERE date >= date('now','-7 days') GROUP BY date, type ORDER BY date ASC");
  const recentContacts = await queryAll('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5');
  const recentReservations = await queryAll('SELECT * FROM reservations ORDER BY created_at DESC LIMIT 5');
  const topServices = await queryAll('SELECT service, COUNT(*) as count FROM reservations GROUP BY service ORDER BY count DESC LIMIT 5');

  res.json({
    overview: {
      totalContacts, newContacts, totalReservations, pendingReservations, monthVisits, monthForms, monthCalls,
      avgRating: rating?.avg_rating != null ? rating.avg_rating : null,
      ratingsCount: rating?.count || 0
    },
    weeklyActivity, recentContacts, recentReservations, topServices
  });
}));

app.post('/api/stats/visit', asyncHandler(async (req, res) => {
  await runSql("INSERT INTO stats (type, value) VALUES ('visit', 1)");
  res.json({ success: true });
}));

// Public stats for the homepage counters (no auth needed)
app.get('/api/stats/public', asyncHandler(async (req, res) => {
  const vehiclesWashed = (await queryOne("SELECT COUNT(*) as count FROM reservations WHERE status = 'completed'"))?.count || 0;
  const rating = await queryOne('SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as count FROM testimonials WHERE approved = 1');
  const count = rating?.count || 0;
  const positive = count > 0
    ? ((await queryOne('SELECT COUNT(*) as count FROM testimonials WHERE approved = 1 AND rating >= 4'))?.count || 0)
    : 0;
  res.json({
    vehiclesWashed,
    avgRating: rating?.avg_rating != null ? rating.avg_rating : null,
    ratingCount: count,
    satisfactionPct: count > 0 ? Math.round((positive / count) * 100) : null
  });
}));

// ══════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════

app.get('/api/settings', asyncHandler(async (req, res) => {
  const rows = await queryAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
}));

app.put('/api/settings', authMiddleware, asyncHandler(async (req, res) => {
  const updates = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    // N'accepter que les clés connues et des valeurs texte simples
    if (!ALLOWED_SETTINGS.includes(key)) continue;
    if (value === null || value === undefined || typeof value === 'object') continue;
    updates[key] = String(value).slice(0, 500);
  }
  for (const [key, value] of Object.entries(updates)) {
    const existing = await queryOne('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing) {
      await runSql("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [value, key]);
    } else {
      await runSql("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }
  }
  res.json({ success: true });
}));

// ══════════════════════════════════════
//  GRILLE TARIFAIRE (PRICING)
// ══════════════════════════════════════

const PRICING_CATEGORIES = ['service', 'package', 'vehicle', 'extra'];

// Accepte un tableau ou du texte (une caractéristique par ligne)
function parseFeatures(value) {
  let list = [];
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string') list = value.split(/\r?\n/);
  return list.map(f => String(f).trim()).filter(Boolean).slice(0, 12).map(f => f.slice(0, 160));
}

function serializePricing(row) {
  let features = [];
  if (row.features) {
    try { features = parseFeatures(JSON.parse(row.features)); } catch (err) { features = []; }
  }
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description || '',
    price: Number(row.price) || 0,
    unit: row.unit || '',
    icon: row.icon || '',
    features,
    price_from: !!row.price_from,
    bookable: !!row.bookable,
    active: !!row.active,
    sort_order: Number(row.sort_order) || 0
  };
}

// Valide un tarif. `partial` = true pour un PATCH (seuls les champs envoyés sont traités)
function readPricingPayload(body, partial) {
  const out = {};
  if (!partial || 'category' in body) {
    const category = String(body.category || '');
    if (!PRICING_CATEGORIES.includes(category)) return { error: 'Catégorie invalide' };
    out.category = category;
  }
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 80) return { error: 'Nom requis (2 à 80 caractères)' };
    out.name = name;
  }
  if (!partial || 'price' in body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000) return { error: 'Prix invalide' };
    out.price = Math.round(price * 100) / 100;
  }
  if (body.description !== undefined) out.description = String(body.description).trim().slice(0, 600);
  if (body.unit !== undefined) out.unit = String(body.unit).trim().slice(0, 20);
  if (body.icon !== undefined) {
    const icon = String(body.icon).trim();
    out.icon = /^fa-[a-z0-9-]{1,40}$/.test(icon) ? icon : '';
  }
  if (body.features !== undefined) out.features = JSON.stringify(parseFeatures(body.features));
  if (body.price_from !== undefined) out.price_from = body.price_from ? 1 : 0;
  if (body.bookable !== undefined) out.bookable = body.bookable ? 1 : 0;
  if (body.active !== undefined) out.active = body.active ? 1 : 0;
  if (body.sort_order !== undefined) out.sort_order = cleanInt(body.sort_order, 0, -999, 999);
  return { data: out };
}

// Grille utilisée par les pages publiques (lignes actives uniquement)
app.get('/api/pricing', asyncHandler(async (req, res) => {
  const rows = await queryAll('SELECT * FROM pricing WHERE active = 1 ORDER BY category ASC, sort_order ASC, id ASC');
  res.json(rows.map(serializePricing));
}));

// Admin : toutes les lignes, y compris désactivées
app.get('/api/pricing/admin', authMiddleware, asyncHandler(async (req, res) => {
  const rows = await queryAll('SELECT * FROM pricing ORDER BY category ASC, sort_order ASC, id ASC');
  res.json(rows.map(serializePricing));
}));

app.post('/api/pricing', authMiddleware, asyncHandler(async (req, res) => {
  const { data, error } = readPricingPayload(req.body || {}, false);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(data);
  const id = await runSql('INSERT INTO pricing (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')',
    cols.map(c => data[c]));
  res.json({ success: true, id });
}));

app.patch('/api/pricing/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });
  if (!await queryOne('SELECT id FROM pricing WHERE id = ?', [id])) return res.status(404).json({ error: 'Tarif introuvable' });
  const { data, error } = readPricingPayload(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(data);
  if (!cols.length) return res.status(400).json({ error: 'Aucune modification' });
  await runSql('UPDATE pricing SET ' + cols.map(c => c + ' = ?').join(', ') + ", updated_at = datetime('now') WHERE id = ?",
    cols.map(c => data[c]).concat([id]));
  res.json({ success: true });
}));

app.delete('/api/pricing/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });
  await runSql('DELETE FROM pricing WHERE id = ?', [id]);
  res.json({ success: true });
}));

// Total estimé d'une réservation, calculé côté serveur depuis la grille tarifaire
// (jamais depuis le client) et figé au moment de la réservation.
// La grille ne contient qu'un prix : un type de véhicule sans supplément reste à 0 $,
// donc « tout type de véhicules = même prix » (voir DEFAULT_PRICING).
async function computeReservationPricing(serviceName, extraNames, vehicleType) {
  const rows = await queryAll('SELECT category, name, price FROM pricing WHERE active = 1');
  const prices = new Map(rows.filter(r => r.category !== 'vehicle').map(r => [r.name, Number(r.price) || 0]));
  const vehicles = new Map(rows.filter(r => r.category === 'vehicle').map(r => [r.name, Number(r.price) || 0]));
  const surcharge = vehicles.get(vehicleType) || 0;
  // Service retiré de la grille : on ne devine pas de prix, on laisse le total vide.
  if (!prices.has(serviceName)) return { total: null, surcharge };
  let total = prices.get(serviceName);
  for (const name of extraNames) {
    if (prices.has(name)) total += prices.get(name);
  }
  total += surcharge;
  return { total: Math.round(total * 100) / 100, surcharge };
}

// ══════════════════════════════════════
//  TESTIMONIALS
// ══════════════════════════════════════

app.get('/api/testimonials', asyncHandler(async (req, res) => {
  res.json(await queryAll('SELECT * FROM testimonials WHERE approved = 1 ORDER BY id DESC'));
}));

// Public submission — published on the site only after admin approval
app.post('/api/testimonials', asyncHandler(async (req, res) => {
  const cleanName = String(req.body?.name || '').trim();
  const cleanMessage = String(req.body?.message || '').trim();
  const cleanLocation = String(req.body?.location || '').trim();
  const cleanRating = Math.min(5, Math.max(1, parseInt(req.body?.rating, 10) || 5));
  if (cleanName.length < 2 || cleanName.length > 80) return res.status(400).json({ error: 'Nom requis (2 à 80 caractères)' });
  if (cleanMessage.length < 5 || cleanMessage.length > 1000) return res.status(400).json({ error: 'Message requis (5 à 1000 caractères)' });
  if (cleanLocation.length > 80) return res.status(400).json({ error: 'Localisation trop longue' });
  try {
    const id = await runSql('INSERT INTO testimonials (name, location, rating, message, approved) VALUES (?, ?, ?, ?, 0)',
      [cleanName, cleanLocation || null, cleanRating, cleanMessage]);
    res.json({ success: true, id, message: 'Merci ! Votre avis sera publié après validation.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}));

// Admin: list all testimonials for moderation
app.get('/api/testimonials/admin', authMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM testimonials';
  if (status === 'approved') sql += ' WHERE approved = 1';
  if (status === 'pending') sql += ' WHERE approved = 0';
  sql += ' ORDER BY approved ASC, id DESC';
  res.json(await queryAll(sql));
}));

// Admin: publish or hide a testimonial
app.patch('/api/testimonials/:id', authMiddleware, asyncHandler(async (req, res) => {
  await runSql('UPDATE testimonials SET approved = ? WHERE id = ?', [req.body?.approved ? 1 : 0, parseInt(req.params.id)]);
  res.json({ success: true });
}));

// Admin: delete a testimonial
app.delete('/api/testimonials/:id', authMiddleware, asyncHandler(async (req, res) => {
  await runSql('DELETE FROM testimonials WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true });
}));

// ══════════════════════════════════════
//  SPA FALLBACK
// ══════════════════════════════════════

app.get('/reservation', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reservation.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── 404 JSON pour les routes API inconnues ──
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

// ── Error handling ──
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

// ── Start (local / VPS only — Vercel exports the app instead) ──
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n  🚗 CNH Service - Lavage Auto`);
    console.log(`  Serveur: http://localhost:${PORT}`);
    console.log(`  Admin:   http://localhost:${PORT}/admin`);
    console.log(`  Résa:    http://localhost:${PORT}/reservation\n`);
  });
}

if (require.main === module && !process.env.VERCEL) {
  start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
}

module.exports = app;