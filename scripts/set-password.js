#!/usr/bin/env node
/*
 * ── CNH Service — changer le mot de passe admin ──
 *
 * Met à jour le mot de passe d'un utilisateur admin (bcrypt) dans la base
 * courante : fichier local cnh_service.db, ou Turso si TURSO_DATABASE_URL
 * et TURSO_AUTH_TOKEN sont définis.
 *
 * Usage :
 *   node scripts/set-password.js                # admin (saisie interactive, cachée)
 *   node scripts/set-password.js monadmin       # autre utilisateur
 *   ADMIN_PASSWORD='...' node scripts/set-password.js   # via variable d'env (CI)
 *
 * Invalide aussi les sessions existantes de cet utilisateur (les anciens
 * tokens ne fonctionnent plus après le changement).
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const readline = require('readline');

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

const USERNAME = process.argv[2] || 'admin';
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';

// ── Saisie interactive avec masquage (aucune dépendance) ──
function promptHidden(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let input = '';
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdout.write(query);
    const onData = (char) => {
      if (char === '\u0003') process.exit(130); // Ctrl+C
      if (char === '\r' || char === '\n') {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(input);
      } else if (char === '\u007f' || char === '\b') {
        input = input.slice(0, -1);
        stdout.write('\b \b');
      } else {
        input += char;
        stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

(async () => {
  let password = ENV_PASSWORD;
  if (!password) {
    password = await promptHidden('Nouveau mot de passe (min. 8 caractères) : ');
    const confirm = await promptHidden('Confirmer le mot de passe : ');
    if (password !== confirm) {
      console.error('❌ Les deux saisies ne correspondent pas.');
      process.exit(1);
    }
  }
  if (password.length < 8) {
    console.error('❌ Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  const { initDatabase, queryOne, runSql } = require('../database');
  await initDatabase();

  const hash = bcrypt.hashSync(password, 10);
  const user = await queryOne('SELECT id FROM admin_users WHERE username = ?', [USERNAME]);

  if (!user) {
    await runSql('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [USERNAME, hash]);
    console.log(`✅ Utilisateur "${USERNAME}" créé avec le nouveau mot de passe.`);
  } else {
    await runSql('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    // Invalide les sessions existantes de cet utilisateur
    const killed = await runSql('DELETE FROM sessions WHERE admin_id = ?', [user.id]);
    console.log(`✅ Mot de passe de "${USERNAME}" mis à jour.`);
    console.log(killed ? '   Sessions existantes invalidées.' : '   Aucune session active.');
  }
  console.log('   Pensez à mettre à jour vos documents / gestionnaires de mots de passe.');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Erreur :', err.message || err);
  process.exit(1);
});

// Note: en mode Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN dans .env ou
// l'environnement), le mot de passe est mis à jour sur la base distante.