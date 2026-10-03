const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initDatabase, queryAll, queryOne, runSql } = require('./database');
const { notifyNewReservation, notifyNewContact, sendClientConfirmation } = require('./mailer');

// ── Optional .env loader (no dependency) ──
(function loadEnv() {
  if (process.env.NODE_ENV === 'test') return; // Skip .env in test mode
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

// Trust proxy for correct IP detection behind Vercel/ngingx
app.set('trust proxy', 1);

// ── Security ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://*.unsplash.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: { features: { camera: [], microphone: [], geolocation: [] } }
}));

const corsOrigin = process.env.CORS_ORIGIN || 'https://cnhservices.ca,https://www.cnhservices.ca';
app.use(cors({ origin: corsOrigin.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Trop de requêtes.' } }));

// Stricter rate limiter for public POST endpoints (5 per 10 min per IP)
const publicPostLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limiter for login (5 attempts per 15 min per IP+username)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ':' + (req.body?.username || 'unknown')
});

// Stricter rate limiter for /api/stats/visit
const visitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de requêtes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ── Static & PWA (AVANT le static général pour contrôler les en-têtes) ──
// Le service worker est servi sans aucun cache : un SW obsolète côté client
// est la première cause de PWA "bloquée" après un déploiement.
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Icônes PWA : cache long (fichiers immuables en pratique)
app.use('/icons', express.static(path.join(__dirname, 'public', 'icons'), {
  maxAge: '30d',
  immutable: true
}));

app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// Wrap async route handlers so rejected promises reach the error middleware
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Clés autorisées pour les paramètres publics du site
const ALLOWED_SETTINGS = ['email', 'phone', 'whatsapp', 'hours', 'address', 'welcome_msg', 'site_title', 'time_slots', 'service_cities', 'facebook_url', 'instagram_url'];

const cleanInt = (value, def, min, max) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
};

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));

// Get time slots from settings (with fallback to default)
async function getTimeSlots() {
  const settings = await queryAll('SELECT key, value FROM settings WHERE key IN (?, ?)', ['time_slots', 'service_cities']);
  const timeSlotsStr = settings.find(s => s.key === 'time_slots')?.value;
  if (timeSlotsStr) {
    return timeSlotsStr.split(',').map(s => s.trim()).filter(Boolean);
  }
  return ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
}

// Sessions are stored in the database so they survive serverless cold starts
async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await queryOne('SELECT admin_id, created_at FROM sessions WHERE token = ?', [tokenHash]);
    if (!session) return res.status(401).json({ error: 'Non autorisé' });
    // Check session max age (7 days)
    const createdAt = new Date(session.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > 7 * 24 * 60 * 60 * 1000) {
      await runSql('DELETE FROM sessions WHERE token = ?', [tokenHash]);
      return res.status(401).json({ error: 'Session expirée' });
    }
    req.adminId = session.admin_id;
    next();
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════

app.post('/api/auth/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const user = await queryOne('SELECT * FROM admin_users WHERE username = ?', [username]);
  // Constant-time comparison: always hash compare even if user not found
  const hashToCompare = user?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinva';
  const valid = await bcrypt.compare(password, hashToCompare);
  if (!user || !valid) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  // Block login if password is still the default 'cnh2026'
  if (await bcrypt.compare('cnh2026', user.password_hash)) {
    await runSql('DELETE FROM sessions WHERE admin_id = ?', [user.id]);
    console.warn(`🚫 Connexion bloquée pour admin "${username}" : mot de passe par défaut détecté. Lancez : node scripts/set-password.js`);
    return res.status(403).json({ error: 'Mot de passe par défaut détecté. Changez-le avec scripts/set-password.js avant de vous connecter.' });
  }
  const token = generateToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await runSql('INSERT INTO sessions (token, admin_id) VALUES (?, ?)', [tokenHash, user.id]);
  // Cleanup: drop sessions older than 7 days
  await runSql("DELETE FROM sessions WHERE created_at < datetime('now', '-7 days')");
  res.json({ token, username: user.username });
}));

app.post('/api/auth/logout', authMiddleware, asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await runSql('DELETE FROM sessions WHERE token = ?', [tokenHash]);
  }
  res.json({ message: 'OK' });
}));

app.get('/api/auth/verify', authMiddleware, (req, res) => { res.json({ valid: true }); });

// ══════════════════════════════════════
//  CONTACTS
// ══════════════════════════════════════

app.post('/api/contacts', publicPostLimiter, asyncHandler(async (req, res) => {
  const { name, email, phone, service, message, date, hp, consent } = req.body;
  // Honeypot check (server-side)
  if (hp && hp.trim() !== '') {
    return res.status(200).json({ success: true });
  }
  if (!name || !email || !phone || !service || !message) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
  // Validation lengths
  if (name.length > 80 || email.length > 120 || phone.length > 25 || service.length > 80 || message.length > 1000) {
    return res.status(400).json({ error: 'Données trop longues' });
  }
  if (!consent) return res.status(400).json({ error: 'Consentement requis' });
  try {
    const id = await runSql('INSERT INTO contacts (name, email, phone, service, message, date_wished, consent_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      [name, email, phone, service, message, date || null]);
    await runSql("INSERT INTO stats (type, value) VALUES ('form_submission', 1)");
    // Send emails (non-blocking)
    const contactData = { id, name, email, phone, service, message, date_wished: date || null };
    notifyNewContact(contactData).catch(err => console.error('[Mailer] notifyNewContact failed:', err.message));
    sendClientConfirmation({ ...contactData, name, email }, true).catch(err => console.error('[Mailer] sendClientConfirmation failed:', err.message));
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
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ error: 'Date invalide' });
  const timeSlots = await getTimeSlots();
  const booked = (await queryAll("SELECT reservation_time FROM reservations WHERE reservation_date = ? AND status IN ('pending','confirmed')", [date])).map(r => r.reservation_time);
  res.json({ date, slots: timeSlots.map(time => ({ time, available: !booked.includes(time) })) });
}));

app.post('/api/reservations', publicPostLimiter, asyncHandler(async (req, res) => {
  const { name, email, phone, vehicle_type, vehicle_plate, service, address, city, postal_code, date, time, notes, extras, hp, consent } = req.body;
  // Honeypot check (server-side)
  if (hp && hp.trim() !== '') {
    return res.status(200).json({ success: true });
  }
  // Validate required fields
  if (!name || !email || !phone || !vehicle_type || !service || !address || !city || !date) {
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis' });
  }
  // Validate types
  if (typeof name !== 'string' || typeof email !== 'string' || typeof phone !== 'string' ||
      typeof vehicle_type !== 'string' || typeof service !== 'string' || typeof address !== 'string' ||
      typeof city !== 'string') {
    return res.status(400).json({ error: 'Types de données invalides' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
  // Validate lengths
  if (name.length > 80 || email.length > 120 || phone.length > 25 || vehicle_type.length > 80 ||
      service.length > 80 || address.length > 150 || city.length > 80 ||
      (postal_code && postal_code.length > 10) || (vehicle_plate && vehicle_plate.length > 15) ||
      (notes && notes.length > 1000)) {
    return res.status(400).json({ error: 'Données trop longues' });
  }
  if (!consent) return res.status(400).json({ error: 'Consentement requis' });
  // Validate date format and range
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ error: 'Date invalide' });
  const requestedDate = new Date(date + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 90);
  if (requestedDate < today) return res.status(400).json({ error: 'Date dans le passé' });
  if (requestedDate > maxDate) return res.status(400).json({ error: 'Date trop lointaine (max 90 jours)' });
  // Créneau horaire facultatif pour les prestations « Sur devis » : l'horaire réel
  // est convenu avec le client lors de l'établissement du devis.
  const timeSlots = await getTimeSlots();
  if (time && !timeSlots.includes(time)) return res.status(400).json({ error: 'Heure invalide' });
  const isQuoteService = await isQuoteServiceName(service);
  if (!time && !isQuoteService) return res.status(400).json({ error: 'Heure requise' });
  // Validate vehicle_type against active pricing
  const vehicleRow = await queryOne('SELECT name FROM pricing WHERE active = 1 AND category = ? AND name = ?', ['vehicle', vehicle_type]);
  if (!vehicleRow) return res.status(400).json({ error: 'Type de véhicule invalide' });
  // Validate extras against active pricing
  const extraNames = Array.isArray(extras)
    ? extras.map(e => String(e).trim()).filter(Boolean)
    : (typeof extras === 'string' && extras.trim() ? extras.split(',').map(e => e.trim()).filter(Boolean) : []);
  for (const extraName of extraNames) {
    const extraRow = await queryOne('SELECT name FROM pricing WHERE active = 1 AND category = ? AND name = ?', ['extra', extraName]);
    if (!extraRow) return res.status(400).json({ error: 'Option invalide : ' + extraName });
  }
  const cleanExtras = extraNames.length ? extraNames.join(', ').slice(0, 500) : null;
  const { total: priceTotal, surcharge: vehicleSurcharge } = await computeReservationPricing(service, extraNames, vehicle_type);
  const existing = time
    ? await queryOne("SELECT id FROM reservations WHERE reservation_date = ? AND reservation_time = ? AND status IN ('pending','confirmed')", [date, time])
    : null;
  if (existing) return res.status(409).json({ error: 'Ce créneau est déjà réservé.' });
  // Notes : pour un devis, on indique que l'horaire réel sera convenu avec le client
  const notesValue = notes || null;
  const timeValue = time || TIME_PENDING;
  const notesForDb = (isQuoteService && !time && notesValue)
    ? notesValue + ' [Horaire à convenir — prestation sur devis]'
    : (isQuoteService && !time ? 'Horaire à convenir — prestation sur devis' : notesValue);
  try {
    const id = await runSql('INSERT INTO reservations (name, email, phone, vehicle_type, vehicle_plate, service, address, city, postal_code, reservation_date, reservation_time, notes, extras, price_total, vehicle_surcharge, consent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      [name, email, phone, vehicle_type, vehicle_plate || null, service, address, city, postal_code || null, date, timeValue, notesForDb, cleanExtras, priceTotal, vehicleSurcharge]);
    await runSql("INSERT INTO stats (type, value) VALUES ('reservation', 1)");
    // Send emails (non-blocking)
    const reservationData = { id, name, email, phone, vehicle_type, vehicle_plate: vehicle_plate || null, service, address, city, postal_code: postal_code || null, reservation_date: date, reservation_time: timeValue, notes: notesForDb, extras: cleanExtras, price_total: priceTotal, vehicle_surcharge: vehicleSurcharge };
    notifyNewReservation(reservationData).catch(err => console.error('[Mailer] notifyNewReservation failed:', err.message));
    sendClientConfirmation(reservationData).catch(err => console.error('[Mailer] sendClientConfirmation failed:', err.message));
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
  const reservations = (await queryAll(sql, params)).map(serializeReservation);
  res.json({ reservations, total: total?.count || 0 });
}));

// ── Export CSV des réservations (respecte le filtre `status` de l'admin) ──
// Séparateur « ; » et décimales à la française : ouverture directe dans Excel FR.
const RESERVATION_STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé' };

function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // Neutralize formula injection: prefix with ' if value starts with = + - @ tab or carriage return
  if (/^[=+\-@\t\r\n]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

function csvTotal(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
}

// Une prestation sans tarif (ex. « Sur devis ») n'a pas d'horaire fixé : le total
// est vide (devis à établir) et le créneau réel est convenu avec le client.
function csvSeance(time, priceTotal) {
  if (!time || time === TIME_PENDING) {
    return (priceTotal === null || priceTotal === undefined || priceTotal === '') ? 'Sur devis' : '';
  }
  return String(time);
}

function csvHeure(time) {
  return time === TIME_PENDING ? '' : time;
}

app.get('/api/reservations/export.csv', authMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) { where = ' WHERE status = ?'; params.push(status); }
  const rows = await queryAll('SELECT * FROM reservations' + where + ' ORDER BY reservation_date ASC, reservation_time ASC', params);

  const header = ['#', 'Nom', 'Email', 'Téléphone', 'Type de véhicule', 'Plaque', 'Service', 'Extras', 'Supplément véhicule ($)', 'Total ($)', 'Date', 'Séance', 'Heure', 'Adresse', 'Ville', 'Code postal', 'Notes', 'Statut', 'Créée le'];
  const lines = [header.map(csvCell).join(';')];
  for (const r of rows) {
    lines.push([
      r.id, r.name, r.email, r.phone, r.vehicle_type, r.vehicle_plate, r.service, r.extras,
      csvTotal(r.vehicle_surcharge), csvTotal(r.price_total), r.reservation_date, csvSeance(r.reservation_time, r.price_total), csvHeure(r.reservation_time),
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
  const topServices = await queryAll("SELECT service, COUNT(*) as count, SUM(CASE WHEN price_total IS NULL THEN 1 ELSE 0 END) as quotes FROM reservations GROUP BY service ORDER BY count DESC LIMIT 5");
  const topServicesRows = topServices.map(s => ({ ...s, quotes: Number(s.quotes) || 0 }));

  res.json({
    overview: {
      totalContacts, newContacts, totalReservations, pendingReservations, monthVisits, monthForms, monthCalls,
      avgRating: rating?.avg_rating != null ? rating.avg_rating : null,
      ratingsCount: rating?.count || 0
    },
    weeklyActivity, recentContacts, recentReservations, topServices: topServicesRows
  });
}));

app.post('/api/stats/visit', visitLimiter, asyncHandler(async (req, res) => {
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

const QUOTE_UNIT = 'Sur devis';

// Les schémas (local et Turso) imposent reservation_time NOT NULL : pour les
// prestations « Sur devis » dont l'horaire n'est pas encore fixé, on stocke
// ce marqueur en base, puis serializeReservation() le présente comme null à
// l'admin et aux exports.
const TIME_PENDING = 'À convenir';

function serializeReservation(row) {
  if (row && row.reservation_time === TIME_PENDING) row.reservation_time = null;
  return row;
}

// Prestations facturées sur devis : aucune ligne de grille active ne porte
// ce nom (ou sa ligne a un prix nul avec une unité « Sur devis »), donc le
// total d'une réservation restera vide et le créneau horaire est facultatif.
async function isQuoteServiceName(serviceName) {
  const name = String(serviceName || '').trim();
  if (!name) return false;
  const row = await queryOne('SELECT price, unit FROM pricing WHERE active = 1 AND name = ?', [name]);
  return !row || (Number(row.price) === 0 && String(row.unit || '') === QUOTE_UNIT);
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
// Pour une prestation « Sur devis » (ex. lavage de flotte), le total reste vide :
// les extras retenus restent enregistrés, le prix sera fixé après contact.
async function computeReservationPricing(serviceName, extraNames, vehicleType) {
  const rows = await queryAll('SELECT category, name, price FROM pricing WHERE active = 1');
  const prices = new Map(rows.filter(r => r.category !== 'vehicle').map(r => [r.name, Number(r.price) || 0]));
  const vehicles = new Map(rows.filter(r => r.category === 'vehicle').map(r => [r.name, Number(r.price) || 0]));
  const surcharge = vehicles.get(vehicleType) || 0;
  // Service retiré de la grille : on ne devine pas de prix, on laisse le total vide.
  if (!prices.has(serviceName)) return { total: null, surcharge };
  // Prestation « Sur devis » : le total reste vide, l'équipe fixe le prix après contact.
  if (await isQuoteServiceName(serviceName)) return { total: null, surcharge };
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
app.post('/api/testimonials', publicPostLimiter, asyncHandler(async (req, res) => {
  const { name, message, location, rating, hp, consent } = req.body;
  // Honeypot check (server-side)
  if (hp && hp.trim() !== '') {
    return res.status(200).json({ success: true });
  }
  if (!consent) return res.status(400).json({ error: 'Consentement requis' });
  const cleanName = String(name || '').trim();
  const cleanMessage = String(message || '').trim();
  const cleanLocation = String(location || '').trim();
  const cleanRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
  if (cleanName.length < 2 || cleanName.length > 80) return res.status(400).json({ error: 'Nom requis (2 à 80 caractères)' });
  if (cleanMessage.length < 5 || cleanMessage.length > 1000) return res.status(400).json({ error: 'Message requis (5 à 1000 caractères)' });
  if (cleanLocation.length > 80) return res.status(400).json({ error: 'Localisation trop longue' });
  try {
    const id = await runSql('INSERT INTO testimonials (name, location, rating, message, approved, consent_at) VALUES (?, ?, ?, ?, 0, datetime(\'now\'))',
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
//  REDIRECT MIDDLEWARE (vercel.app -> cnhservices.ca, www -> non-www)
// ══════════════════════════════════════
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const isVercel = host.includes('.vercel.app');
  const isWww = host.startsWith('www.');
  const targetHost = 'cnhservices.ca';
  
  if (isVercel || isWww) {
    const newUrl = `https://${targetHost}${req.originalUrl}`;
    return res.redirect(301, newUrl);
  }
  next();
});

// ══════════════════════════════════════
//  LEGAL PAGES
// ══════════════════════════════════════
app.get('/confidentialite', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confidentialite.html')));
app.get('/conditions', (req, res) => res.sendFile(path.join(__dirname, 'public', 'conditions.html')));

// ══════════════════════════════════════
//  SPA FALLBACK
// ══════════════════════════════════════

app.get('/reservation', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reservation.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/install', (req, res) => res.sendFile(path.join(__dirname, 'public', 'install.html')));
app.get('/offline', (req, res) => res.sendFile(path.join(__dirname, 'public', 'offline.html')));

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