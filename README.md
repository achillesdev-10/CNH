# 🚗 CNH Service - Lavage Auto à Domicile

Site web professionnel avec backend Node.js pour une entreprise de lavage auto à domicile au Canada.

## 🚀 Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer le serveur
npm start

# Le serveur démarre sur http://localhost:3000
```

## 📁 Structure du projet

```
├── server.js          # Serveur Express (API REST)
├── database.js        # Base de données : Turso (Vercel) ou SQLite locale (sql.js)
├── package.json       # Dépendances Node.js
├── vercel.json        # Configuration de déploiement Vercel (serverless)
├── ecosystem.config.js# Configuration PM2 (production VPS)
├── .env.example       # Variables d'environnement (copier vers .env)
├── deploy/
│   └── nginx-cnh.conf # Exemple de reverse proxy Nginx
├── scripts/
│   ├── backup-db.js   # Sauvegarde DB + rétention (npm run backup)
│   └── set-password.js# Changer le mot de passe admin (local ou Turso)
├── cnh_service.db     # Base de données locale (auto-générée, hors Vercel)
├── public/
│   ├── index.html     # Site principal
│   ├── reservation.html  # Page de réservation avec calendrier
│   └── admin.html     # Dashboard admin protégé
└── README.md
```

## 🔐 Accès Admin

| Champ | Valeur |
|-------|--------|
| URL | http://localhost:3000/admin |
| Utilisateur | `admin` |
| Mot de passe | **défini par vous** — voir `scripts/set-password.js` |

> ⚠️ À la première installation, le script de seed crée le compte `admin` avec un
> mot de passe par défaut **`cnh2026`** si aucun admin n'existe. **Changez-le
> immédiatement avant toute mise en production** :
>
> ```bash
> node scripts/set-password.js            # saisie interactive (masquée)
> # ou sans interaction (CI) :
> ADMIN_PASSWORD='...' node scripts/set-password.js
> ```
>
> Le script fonctionne aussi bien sur la base locale (`cnh_service.db`) que sur
> Turso (définissez `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN`), et invalide les
> sessions existantes de l'utilisateur après le changement.

## 📡 API Endpoints

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion admin |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/verify` | Vérifier le token |

### Contacts
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/contacts` | Envoyer un message |
| GET | `/api/contacts` | Lister les contacts (admin) |
| PATCH | `/api/contacts/:id` | Modifier le statut |

### Réservations
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/reservations/slots?date=YYYY-MM-DD` | Créneaux disponibles |
| POST | `/api/reservations` | Créer une réservation |
| GET | `/api/reservations` | Lister les réservations (admin) |
| PATCH | `/api/reservations/:id` | Modifier le statut |
| DELETE | `/api/reservations/:id` | Supprimer |

### Stats & Settings
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/stats/dashboard` | Statistiques (admin) |
| POST | `/api/stats/visit` | Enregistrer une visite |
| GET | `/api/stats/public` | Compteurs publics (voitures lavées, note) |
| GET | `/api/settings` | Paramètres publics |
| PUT | `/api/settings` | Modifier les paramètres (admin) |

### Témoignages
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/testimonials` | Témoignages approuvés (public) |
| POST | `/api/testimonials` | Soumettre un témoignage (modération) |
| GET | `/api/testimonials/admin` | Lister tous les témoignages (admin) |
| PATCH | `/api/testimonials/:id` | Approuver / masquer (admin) |
| DELETE | `/api/testimonials/:id` | Supprimer (admin) |

## 🗄️ Base de données

Deux modes, détectés automatiquement dans `database.js` :

- **Turso** (libSQL/SQLite managé) — activé quand `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` sont définis. **Requis sur Vercel**, où le filesystem est éphémère et en lecture seule. La base persiste côté Turso, et les sessions admin sont stockées en base pour survivre aux cold starts serverless.
- **Local** (sql.js) — mode par défaut (dev / VPS). La base `cnh_service.db` est sauvegardée automatiquement toutes les 30 secondes.

Tables :
- `admin_users` — Utilisateurs administrateurs
- `contacts` — Messages du formulaire de contact
- `reservations` — Réservations en ligne
- `settings` — Paramètres du site
- `stats` — Statistiques de visite
- `testimonials` — Témoignages clients (modérés)
- `sessions` — Tokens de session admin (persistants)

## 🌐 Déploiement (VPS Linux + PM2 + Nginx)

### 1. Prérequis
- Un VPS (DigitalOcean, Linode, OVH, …) avec Node.js ≥ 18 : `node -v`
- PM2 global : `npm install -g pm2`
- Nginx : `sudo apt install nginx`

### 2. Installation de l'application
```bash
# Uploader le dossier du projet sur le serveur, puis :
cd cnh-service
npm install --omit=dev          # ou: npm install
cp .env.example .env            # ajuster PORT etc. si besoin
node server.js                  # test rapide -> http://localhost:3000
```

### 3. Lancer avec PM2 (redémarrage auto + au reboot)
```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup                  # exécuter la commande affichée
pm2 logs cnh-service         # voir les logs
pm2 restart cnh-service      # après un futur déploiement
```

### 4. Reverse proxy Nginx + HTTPS
```bash
sudo cp deploy/nginx-cnh.conf /etc/nginx/sites-available/cnhservice
sudo ln -s /etc/nginx/sites-available/cnhservice /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cnhservice.com -d www.cnhservice.com   # HTTPS auto
```
Le fichier `deploy/nginx-cnh.conf` contient la config prête à l'emploi (proxy vers `127.0.0.1:3000`, gzip, commentaires pour certbot).

### 5. Sauvegardes automatiques (script + cron)
La base SQLite (`cnh_service.db`) est écrite automatiquement toutes les 30 s par l'application.
Le script `scripts/backup-db.js` vérifie l'intégrité de la base puis enregistre une copie horodatée dans `backups/`, en ne conservant que les 30 plus récentes (`--keep` pour changer).

Test rapide :
```bash
mkdir -p logs backups
npm run backup                 # ou : node scripts/backup-db.js --dir /var/backups
ls backups/                    # -> cnh_service_2026-09-03T14-05-00.db
```

Planification quotidienne avec cron (2 h 30 du matin) :
```bash
crontab -e
# ajouter la ligne suivante (adapter le chemin du projet et le chemin de node) :
30 2 * * * cd /var/www/cnh-service && /usr/bin/node scripts/backup-db.js >> logs/backup.log 2>&1
```
Conseils :
- Vérifier régulièrement `tail -f logs/backup.log` (ligne `Backup OK : ...`)
- Pour une rétention de 90 jours : `--keep 90`
- Sauvegarder aussi le dossier sur un stockage externe (ex. rsync hebdomadaire de `backups/`)
- Cron s'exécute avec la base au repos la nuit : la copie est fiable même sans arrêter PM2

### 6. Vérifications finales
- Ouvrir `https://www.cnhservice.com` et `/admin`
- Si vous fixez `CORS_ORIGIN` dans `.env`, seuls ces domaines sont autorisés via l'API
- Firewall : n'ouvrir que les ports 80 et 443 (le port Node reste interne)

## ▲ Déploiement Vercel (serverless + Turso)

### 1. Créer une base Turso
```bash
# Installer l'outil Turso puis créer une base (gratuit pour démarrer)
npm install -g @libsql/cli     # ou: curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create cnh-service
turso db show cnh-service      # récupérer l'URL (libsql://cnh-service-xxxx.turso.io)
turso db tokens create cnh-service   # récupérer le token d'accès
```

### 2. Connecter le dépôt sur Vercel
1. Importer le dépôt GitHub sur https://vercel.com (framework : **Other**).
2. Ajouter les variables d'environnement :
   - `TURSO_DATABASE_URL` → l'URL `libsql://...` de la base
   - `TURSO_AUTH_TOKEN` → le token généré
   - (optionnel) `CORS_ORIGIN` → ex. `https://www.cnhservice.com`
3. Déployer. `vercel.json` route toutes les requêtes vers `server.js` (les sessions et les données vivent dans Turso, pas sur le filesystem).
4. Ouvrir `https://<projet>.vercel.app/admin` — connectez-vous avec le compte `admin` créé au premier démarrage, puis **changez immédiatement le mot de passe** avec `node scripts/set-password.js` (en définissant `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` pour viser la base Turso).

> Les fichiers `cnh_service.db`, `backups/` et le script `scripts/backup-db.js` ne servent qu'en mode local/VPS : sur Vercel, les sauvegardes sont gérées par Turso.
