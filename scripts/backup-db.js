#!/usr/bin/env node
/*
 * ── CNH Service — backup automatique de la base de données ──
 *
 * Vérifie l'intégrité de cnh_service.db (sql.js) puis copie une sauvegarde
 * horodatée dans le dossier "backups" (ou --dir). Supprime les plus anciennes
 * copies au-delà de --keep (défaut : 30).
 *
 * Usage :
 *   node scripts/backup-db.js                      # backups/cnh_service_YYYY-...db
 *   node scripts/backup-db.js --dir /var/backups --keep 30
 *
 * Idéal en tâche cron (voir README — section Sauvegardes).
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'cnh_service.db');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const BACKUP_DIR = arg('dir', path.join(ROOT, 'backups'));
const KEEP = Math.max(1, parseInt(arg('keep', '30'), 10));

(async () => {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Base introuvable :', DB_PATH);
    process.exit(1);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const SQL = await initSqlJs();
  let db;
  try {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } catch (e) {
    console.error('Impossible de lire la base (écriture en cours ?) :', e.message);
    process.exit(1);
  }

  const check = db.exec('PRAGMA integrity_check');
  const status = check && check[0] && check[0].values[0] && check[0].values[0][0];
  if (status !== 'ok') {
    console.error("Échec du contrôle d'intégrité :", status);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(BACKUP_DIR, 'cnh_service_' + stamp + '.db');
  fs.writeFileSync(file, Buffer.from(db.export()));
  console.log('Backup OK :', file, '(' + fs.statSync(file).size + ' octets)');

  // Rétention : garder les KEEP sauvegardes les plus récentes
  const pattern = /^cnh_service_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/;
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => pattern.test(f)).sort();
  while (files.length > KEEP) {
    const old = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    console.log('Ancienne sauvegarde supprimée :', old);
  }
})();
