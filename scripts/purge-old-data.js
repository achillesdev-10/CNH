#!/usr/bin/env node
/*
 * CNH Service — purge des anciennes donnees (Loi 25)
 *
 * Supprime/anonymise les donnees depassant la duree de retention.
 * Mode --dry-run par defaut (n'affiche que ce qui serait fait).
 *
 * Usage :
 *   node scripts/purge-old-data.js                    # dry-run
 *   node scripts/purge-old-data.js --execute          # execution reelle
 *   node scripts/purge-old-data.js --months 24        # retention 24 mois (defaut)
 *   node scripts/purge-old-data.js --tables contacts,reservations,testimonials
 *
 * Tables concernees :
 *   - contacts : 36 mois apres derniere interaction (creation si pas de maj)
 *   - reservations : 36 mois apres date de reservation (sauf factures : 7 ans)
 *   - testimonials : suppression si demande client (flag) ou > 36 mois sans validation
 */

const path = require('path');
const fs = require('fs');

// Load .env like server.js does (no dependency)
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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

const { initDatabase, queryAll, runSql, usingTurso } = require('../database');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const DRY_RUN = !process.argv.includes('--execute');
const RETENTION_MONTHS = Math.max(1, parseInt(arg('months', '36'), 10));
const TABLES_ARG = arg('tables', 'contacts,reservations,testimonials');
const TABLES = TABLES_ARG.split(',').map(t => t.trim()).filter(Boolean);

const CUTOFF_DATE = new Date();
CUTOFF_DATE.setMonth(CUTOFF_DATE.getMonth() - RETENTION_MONTHS);
const CUTOFF_ISO = CUTOFF_DATE.toISOString().slice(0, 19).replace('T', ' ');

async function purgeContacts() {
  console.log('\nPurge contacts (retention:', RETENTION_MONTHS, 'mois)...');
  const cutoff = CUTOFF_ISO;
  // On considere created_at comme derniere interaction si pas de updated_at
  const rows = await queryAll(
    `SELECT id, email, created_at FROM contacts WHERE created_at < ? AND (status = 'completed' OR status = 'archived')`,
    [cutoff]
  );
  console.log(`  Trouve ${rows.length} contact(s) a purger`);
  if (!DRY_RUN && rows.length) {
    for (const r of rows) {
      // Anonymiser plutot que supprimer pour garder l'integrite referentielle si besoin
      await runSql(
        `UPDATE contacts SET name = 'Supprime', email = 'supprime@local', phone = '', message = '', notes = '', status = 'purged' WHERE id = ?`,
        [r.id]
      );
    }
  }
  console.log(`  ${DRY_RUN ? '[DRY-RUN] ' : ''}${rows.length} contact(s) ${DRY_RUN ? 'seraient purgés' : 'purgés'}`);
  return rows.length;
}

async function purgeReservations() {
  console.log('\nPurge reservations (retention:', RETENTION_MONTHS, 'mois)...');
  const cutoff = CUTOFF_ISO;
  // On purge les reservations terminees/annulees anciennes
  // Attention : les factures (7 ans) doivent etre conservees separement
  const rows = await queryAll(
    `SELECT id, email, reservation_date FROM reservations WHERE reservation_date < ? AND status IN ('completed','cancelled')`,
    [cutoff]
  );
  console.log(`  Trouve ${rows.length} reservation(s) a purger`);
  if (!DRY_RUN && rows.length) {
    for (const r of rows) {
      await runSql(
        `UPDATE reservations SET name = 'Supprime', email = 'supprime@local', phone = '', address = '', city = '', postal_code = '', notes = '', extras = '', vehicle_plate = '', status = 'purged' WHERE id = ?`,
        [r.id]
      );
    }
  }
  console.log(`  ${DRY_RUN ? '[DRY-RUN] ' : ''}${rows.length} reservation(s) ${DRY_RUN ? 'seraient purgées' : 'purgées'}`);
  return rows.length;
}

async function purgeTestimonials() {
  console.log('\nPurge testimonials (retention:', RETENTION_MONTHS, 'mois)...');
  const cutoff = CUTOFF_ISO;
  // Purger les temoignages en attente tres anciens ou refuses
  const rows = await queryAll(
    `SELECT id FROM testimonials WHERE created_at < ? AND (approved = 0 OR approved = 2)`,
    [cutoff]
  );
  console.log(`  Trouve ${rows.length} temoignage(s) a purger`);
  if (!DRY_RUN && rows.length) {
    for (const r of rows) {
      await runSql(`DELETE FROM testimonials WHERE id = ?`, [r.id]);
    }
  }
  console.log(`  ${DRY_RUN ? '[DRY-RUN] ' : ''}${rows.length} temoignage(s) ${DRY_RUN ? 'seraient purgés' : 'purgés'}`);
  return rows.length;
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  CNH Service — Purge donnees Loi 25');
  console.log('═══════════════════════════════════════');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN (aucune modification)' : 'EXECUTION REELLE');
  console.log('Retention:', RETENTION_MONTHS, 'mois');
  console.log('Date de coupure:', CUTOFF_ISO);
  console.log('Tables:', TABLES.join(', '));
  console.log('Base:', usingTurso() ? 'Turso' : 'Local (sql.js)');
  console.log('');

  await initDatabase();

  let total = 0;
  if (TABLES.includes('contacts')) total += await purgeContacts();
  if (TABLES.includes('reservations')) total += await purgeReservations();
  if (TABLES.includes('testimonials')) total += await purgeTestimonials();

  console.log('\n═══════════════════════════════════════');
  console.log(`Total: ${total} enregistrement(s) ${DRY_RUN ? 'a purger' : 'purgés'}`);
  if (DRY_RUN) {
    console.log('Attention: Mode dry-run : relancez avec --execute pour appliquer');
  } else {
    console.log('Purge terminee');
  }
  console.log('═══════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});