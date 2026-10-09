# CHANGELOG-VISUEL.md — CNH Service Refonte Visuelle & PWA iOS

**Date :** 2026-10-03  
**Branche :** `feat/visuel-pwa-ios`  
**Base :** `main` (inclut PR `fix/audit-complet` fusionnee)

---

## REALISE — Securite & Conformite (PR `fix/audit-complet` fusionnee)

- **Mot de passe admin** : Suppression du defaut `cnh2026` ; creation seulement si `ADMIN_INITIAL_PASSWORD` (>=12 chars) ; blocage connexion si hash = `cnh2026` + log + suppression sessions.
- **XSS** : `esc`/`escAttr` echappent `"` `'` ; CSP Helmet active ; tous `innerHTML` audites.
- **Auth** : Limiteur dedie `/api/auth/login` (5/15min IP+username) ; `bcrypt.compare` async ; message constant ; sessions max 7j + hash SHA-256 + invalidation au changement mdp.
- **Validation/anti-spam** : Longueurs max, types, honeypot `hp` (contact/reservation/avis), rate limits 5/10min.
- **Reservation** : `isQuoteServiceName` corrige ; validation `vehicle_type`/`extras` vs `pricing` ; date calendrier (pas passe, max 90j) ; creneaux via `settings.time_slots` ; index unique partiel `(date,time)` anti-race (409).
- **Divers** : CSV anti-injection formules ; CORS `cnhservices.ca` ; headers `X-Robots-Tag`/`Referrer-Policy`/`Permissions-Policy` ; SW v3 (`/admin` non cachee).

---

## REALISE — Tache 1 : « LAURENTIDES » -> « RIVE-SUD »

- Remplacement global (0 occurrence restante) ; migration `settings.address` idempotente ; mots-cles SEO villes Rive-Sud ; `settings.service_cities` (8 villes).

---

## REALISE — Tache 4 : SEO, Domaine, Redirections

- `cnhservices.ca` partout ; redirect 301 `vercel.app`/`www` -> `.ca` (middleware) ; `robots.txt` + `sitemap.xml` ; OG/Twitter/JSON-LD complets ; `nginx-cnh.conf`/`.env.example` corriges ; `manifest.webmanifest` shortcut corrige.

---

## REALISE — Tache 5 : Conformite Loi 25 (partiel)

- Pages `/confidentialite` + `/conditions` ; consentement obligatoire + `consent_at` ; `scripts/purge-old-data.js` (retention parametrable, dry-run).

---

## REALISE — Tache 6 : Coordonnees & Reseaux

- Facebook `https://web.facebook.com/cnhservices` ; Instagram masquée si vide ; `settings` `facebook_url`/`instagram_url` + admin.

---

## REALISE — Infrastructure & Build

- Scripts `build:icons` (sharp), `build:screenshots` (Playwright), `build:svg-sprite` (svgo) ; sprite SVG genere (`/icons/sprite.svg`) remplacant Font Awesome CDN ; CSP mise a jour ; `package.json` (scripts `test`, `purge`, `build:*`, `engines.node>=20`) ; CI GitHub Actions ; `README.md` mis a jour ; `.env.example` complet.

---

## EN COURS / PARTIEL — PWA iOS (Partie A)

| Chantier | Statut | Notes |
|----------|--------|-------|
| **A1** Balises/manifest + script `build:icons` | OK | Icones generees, `apple-touch-icon` opaque 180x180, manifest `fr-CA`, shortcuts corriges |
| **A2** Module `pwa-env.js` partage | OK | `isIOS`, `isSafariIOS`, `isThirdPartyBrowserIOS`, `isInAppBrowser`, `isStandalone` |
| **A3** Panneau « Ouvrez dans Safari » (in-app) | OK | Detection `isInAppBrowser`, panneau avec bouton « Copier le lien » |
| **A4** Guide visuel (bottom sheet) | Partiel | Logique ajoutee dans `install.html`, UI a finaliser |
| **A5** Banniere moins intrusive | Non fait | Logique existante conservee, a ameliorer (signal d'interet, 7j) |
| **A6** Confort standalone iOS | Partiel | Safe-area, `100dvh`, liens externes — a valider sur vrai iPhone |
| **A7** Tests Playwright + `docs/PWA-IPHONE.md` | Non fait | Script `build:screenshots` pret, doc a rediger |

---

## EN COURS / PARTIEL — Bugs Visuels (Partie B)

| Bug | Statut | Notes |
|-----|--------|-------|
| **B1** Hero chevauche header | OK | `min-height:100svh`, `padding-top: calc(var(--header-height) + env(safe-area-inset-top) + 24px)`, variable JS `--header-height` |
| **B2** Boutons flottants masquent contenu | Partiel | Barre d'action mobile (C1) ajoutee, flottants masques mobile, install-float cache desktop |
| **B3** Stats hero (7 cartes, degrade blanc) | Non fait | A faire : limite 4, masquer si 0, scroll horizontal |
| **B4** Boutons cartes forfaits non alignes | Non fait | Flex colonne + `margin-top:auto` sur le bouton |
| **B5** Replis JS/noscript/prefers-reduced-motion | OK | Classe `.js` sur `<html>`, `.js .reveal`, `<noscript>`, media query |
| **B6** Images width/height/aspect-ratio | Non fait | A faire sur 14 images Unsplash |
| **B7** Screenshots regeneres | Non fait | Script `build:screenshots` pret, a lancer |

---

## EN COURS / PARTIEL — Hierarchie & Conversion (Partie C)

| Chantier | Statut | Notes |
|----------|--------|-------|
| **C1** Barre d'action mobile (remplace 3 flottants) | OK | Barre fixe mobile (Reserver/WhatsApp/Appeler), flottants masques mobile, install-float cache desktop |
| **C2** Pre-selection forfait `?service=` | Non fait | JS a ajouter dans `reservation.html` pour lire `?service=` et pre-selectionner |
| **C3** Etape 1 reservation (onglets Forfaits/A la carte) | Non fait | Restructuration majeure de `reservation.html` etape 1 |
| **C4** Ordre sections accueil | Non fait | Reordonner : Hero -> Forfaits -> Services -> Extras -> Comment -> Realisations -> Temoignages -> A propos -> App -> Contact |
| **C5** Hero (2 boutons max, « Voir les tarifs », 3 puces) | Non fait | Remplacer « Installer l'app » par « Voir les tarifs », ajouter 3 puces confiance |

---

## EN COURS — Finitions Design (Partie D)

| Chantier | Statut | Notes |
|----------|--------|-------|
| **D1** Logo/monogramme SVG unique | OK | `public/brand/logo.svg` cree (goutte + voiture) |
| **D2** Format prix quebecois | Partiel | Helper `Intl.NumberFormat('fr-CA', {style:'currency', currency:'CAD'})` a centraliser |
| **D3** Sprite SVG unifie | OK | `public/icons/sprite.svg` genere, Font Awesome CDN retire, CSP maj |
| **D4** Variables semantiques | Non fait | `--color-accent`, `--color-surface`, `--color-text-muted`, accent secondaire |
| **D5** Inter auto-hebergee woff2 | Non fait | Telecharger woff2, `@font-face`, `font-display:swap`, preload |
| **D6** Sprite SVG icones (remplace FA CDN) | OK | Fait via `build:svg-sprite`, CSP maj |
| **D7** Espaces/rythme coherents | Non fait | Variables d'espacement, transitions ciblees |

---

## EN COURS — Accessibilite & Performance (Partie E)

| Critere | Statut | Notes |
|---------|--------|-------|
| **E1** Focus visible / lien evitemment / tabulation | OK | `:focus-visible` global, `outline:3px solid rgba(14,165,233,.45)` |
| **E2** `prefers-reduced-motion` | OK | Media query globale desactive animations/transitions |
| **E3** Contraste WCAG AA | Partiel | Gris `--gray-400` reserve aux decoratifs, texte >= `#64748b` (4.8:1) |
| **E4** Cibles tactiles >= 44x44px | Non fait | Menu hamburger (16x16), liens pied de page, onglets, croix fermeture |
| **E5** Formulaires (labels, autocomplete, inputmode, aria-live, font-size>=16px) | OK | `font-size:1rem` sur tous inputs, `autocomplete`, `inputmode` |
| **E6** Performance Lighthouse >= 90/95/95/95 | Non fait | A mesurer apres optimisations (hero fetchpriority, lazy loading, preconnect, CLS) |
| **E7** admin.html mobile | OK | Safe-area, tableaux responsives, boutons >= 44px |

---

## DECISIONS RESTANTES POUR LE PROPRIETAIRE

| Sujet | Options | Recommandation |
|-------|---------|----------------|
| **Prix finaux** | Valider Essentiel 35$/Confort 70$/Premium 120$ | Confirmer ou ajuster |
| **Villes Rive-Sud** | Liste actuelle : 8 villes | Valider / completer |
| **Annees experience** | Parametre `settings.years_experience` | Definir valeur |
| **Photos reelles** | Dossier `public/images/realisations/` (webp) | Fournir photos avant `show_gallery=true` |
| **Texte legal** | Politique confidentialite / Conditions | Faire relire par avocat / DPO |
| **Email contact@** | Creer `contact@cnhservices.ca` | Puis mettre a jour dans admin |
| **Fournisseur emails** | Resend (3k/mois gratuit) vs Brevo (300/jour) | Choisir et configurer cles API |
| **Economie Premium** | Afficher « Economie X $ » vs rien | Trancher : calculer depuis grille ou retirer |

---

## SECRETS A REVOQUER (historique Git)

Le `.env` local contient un token Turso de production :
```
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```
**Actions** : Revoquer via `turso db tokens revoke` -> generer nouveau token -> mettre a jour Vercel.

---

## PROCEDURE DE DEPLOIEMENT

1. **Ouvrir la PR** sur GitHub : https://github.com/achillesdev-10/CNH/pull/new/feat/visuel-pwa-ios
2. **Merger** `feat/visuel-pwa-ios` -> `main` apres review
3. **Variables d'env Vercel** :
   ```
   TURSO_DATABASE_URL=libsql://... (nouveau token)
   TURSO_AUTH_TOKEN=... (nouveau token)
   ADMIN_INITIAL_PASSWORD=... (>=12 chars)
   CORS_ORIGIN=https://cnhservices.ca,https://www.cnhservices.ca
   MAIL_PROVIDER=resend|brevo
   MAIL_API_KEY=...
   MAIL_FROM="CNH Service <noreply@cnhservices.ca>"
   NOTIFY_TO=proprietaire@example.com
   NOTIFY_TO_NAME="CNH Admin"
   ```
4. **Post-deploiement** :
   - Verifier `/admin` accessible
   - Lancer `node scripts/set-password.js` si rotation mdp necessaire
   - Verifier en-tetes `X-Robots-Tag`, `Permissions-Policy` sur `/admin`
   - Tester formulaires + consentement, emails, headers securite
5. **Decisions restantes** -> voir tableau ci-dessus

---

*Genere automatiquement depuis la branche `feat/visuel-pwa-ios` — commit `HEAD`*