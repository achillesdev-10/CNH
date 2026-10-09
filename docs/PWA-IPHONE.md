# Guide de test PWA sur iPhone — CNH Service

**Version :** 1.0  
**Date :** 2026-10-03  
**Audience :** Proprietaire / QA

---

## Objectif

Verifier que l'application CNH Service s'installe et fonctionne correctement sur iPhone (iOS 16+), y compris depuis des liens partages dans Facebook, WhatsApp, Messenger, Instagram, etc.

---

## Pre-requis

- iPhone avec iOS 16.4+ (pour support `beforeinstallprompt` dans navigateurs tiers)
- Safari (navigateur par defaut)
- Chrome/Edge/Firefox sur iOS (optionnel, pour tester navigateurs tiers)
- Acces a l'URL de production : `https://cnhservices.ca`
- Compte admin pour verifier `/admin` (optionnel)

---

## 1. Test d'installation standard (Safari)

### Etape 1 : Ouvrir le site
1. Ouvrir **Safari** sur l'iPhone
2. Saisir `https://cnhservices.ca` dans la barre d'adresse
2. Attendre le chargement complet (hero visible, pas de loader)

### Etape 2 : Verifier les pre-requis PWA
- [ ] L'icone `apple-touch-icon` (180x180, opaque, fond bleu CNH) est chargee
- [ ] Le manifest se charge : `https://cnhservices.ca/manifest.webmanifest` (200 OK)
- [ ] Le Service Worker s'enregistre : `https://cnhservices.ca/sw.js` (200 OK)
- [ ] Pas d'erreur console liee au CSP ou aux ressources

### Etape 3 : Installation via le menu Partager
1. Toucher le bouton **Partager** (carré avec fleche vers le haut, en bas de l'ecran)
2. Faire defiler la liste d'actions jusqu'a **« Sur l'ecran d'accueil »**
3. Toucher **« Sur l'ecran d'accueil »**
4. Verifier le nom affiche : **« CNH Service »**
5. Verifier l'icone : fond bleu CNH, goutte + voiture blanche (sans coins noirs)
6. Laisser **« Ouvrir comme application »** active si proposee (iOS 18+)
7. Appuyer sur **« Ajouter »** (en haut a droite)

### Etape 4 : Verifier l'installation
1. L'icone **CNH Service** apparait sur l'ecran d'accueil
2. Toucher l'icone : l'app s'ouvre en **plein ecran** (pas de barre Safari, pas de barre d'adresse)
3. La barre d'etat iOS (heure, batterie) est visible et lisible (texte blanc sur fond navy)
4. Naviguer : Hero -> Tarifs -> Reservation -> Contact
5. Tester le formulaire de reservation : les champs ne zooment pas (font-size >= 16px)
6. Tester le lien WhatsApp : s'ouvre dans l'app WhatsApp native (pas dans Safari)
7. Tester le lien tel: : ouvre l'app Telephone
8. Tester le lien mailto: : ouvre l'app Mail

---

## 2. Test depuis navigateurs tiers (Chrome/Edge/Firefox iOS)

> **Note :** Depuis iOS 16.4, les navigateurs tiers supportent `beforeinstallprompt`.

1. Installer **Chrome** ou **Edge** depuis l'App Store
2. Ouvrir `https://cnhservices.ca` dans le navigateur tiers
3. Verifier que l'installation fonctionne via le menu `...` -> **« Ajouter a l'ecran d'accueil »**
4. Verifier que l'app s'ouvre en standalone (pas de barre d'adresse du navigateur)

---

## 3. Test depuis liens in-app (Facebook, Instagram, WhatsApp, Messenger, etc.)

> **Critique :** La majorite du trafic mobile vient de ces apps. L'installation y est **impossible** directement.

### Test depuis Facebook / Messenger
1. Ouvrir l'app **Facebook** ou **Messenger**
2. Rechercher la page **« CNH Service »** ou cliquer un lien partage `https://cnhservices.ca`
3. Le site s'ouvre dans le **navigateur integre** (in-app browser)
4. **Verifier :** Un panneau en haut s'affiche : **« Ouvrez dans Safari pour installer »**
5. Le panneau propose :
   - Bouton **« Copier le lien »** -> copie `https://cnhservices.ca/install` dans le presse-papiers
   - Instructions selon l'app : Facebook/Instagram -> menu `...` -> **« Ouvrir dans le navigateur »**
   - Bouton **« Fermer »** pour masquer le panneau

### Test depuis Instagram
1. Ouvrir l'app **Instagram**
2. Cliquer le lien dans la bio ou un story swipe-up vers `cnhservices.ca`
3. Meme verification : panneau « Ouvrez dans Safari » affiche

### Test depuis WhatsApp
1. Ouvrir WhatsApp, discussion avec le numero CNH
2. Cliquer le lien `https://cnhservices.ca`
4. Meme verification : panneau affiche (WhatsApp in-app browser)

---

## 4. Test de l'ecran d'installation (`/install`)

1. Ouvrir `https://cnhservices.ca/install` dans Safari
2. Verifier :
   - La carte **iOS** est en **premier** (ordre : iOS -> Android -> Desktop)
   - L'etape 1 iOS dit : « Ouvrez **cnhservices.ca** dans **Safari** » (PAS `vercel.app`)
   - Le QR code pointe vers `https://cnhservices.ca/install` (pas `vercel.app`)
   - Le bouton **« Installer »** (Android) n'apparait que si `beforeinstallprompt` dispo
   - Le message « Deja installe » apparait si `isStandalone=true`

---

## 4. Test du mode standalone (app deja installee)

1. Si l'app est deja installee, l'ouvrir depuis l'ecran d'accueil
2. Verifier :
   - **Pas** de banniere d'installation
   - **Pas** de section « Application officielle » (cachee via `.pwa-standalone`)
   - **Pas** de bouton flottant « Installer l'app »
   - Liens externes (WhatsApp, tel:, mailto:, Facebook) s'ouvrent correctement
   - Page `/reservation` : calendrier, selecteur date, clavier ne masquent pas les champs (safe-area bottom)
   - `/admin` accessible, tableaux responsives, boutons >= 44px

---

## 5. Test de desinstallation / reinstallation

1. Supprimer l'icone de l'ecran d'accueil (appui long -> « Supprimer l'app »)
2. Aller dans **Reglages > Safari > Avance > Donnees des sites** -> chercher `cnhservices.ca` -> « Supprimer »
3. Revenir a l'etape 1 et re-tester l'installation complete

---

## 6. Checklist de validation finale

| Critere | OK / KO | Commentaires |
|---------|---------|--------------|
| Icone 180x180 opaque (pas de pixels transparents) | | |
| Nom affiche : « CNH Service » | | |
| Splash screen (fond navy, pas flash blanc) | | |
| Barre d'etat lisible (texte blanc sur navy) | | |
| Plein ecran (pas de barre Safari) | | |
| Installation depuis Safari : < 20 sec | | |
| Installation depuis Facebook -> panneau « Ouvrez dans Safari » | | |
| Installation depuis WhatsApp -> panneau | | |
| Installation depuis Instagram -> panneau | | |
| Lien WhatsApp ouvre l'app native | | |
| Lien tel: ouvre Telephone | | |
| Lien mailto: ouvre Mail | | |
| Formulaire reservation : pas de zoom au focus | | |
| Reservation complete -> email confirmation recu | | |
| `/admin` accessible, tableaux lisibles mobile | | |
| `X-Robots-Tag: noindex` sur `/admin` | | |
| `Permissions-Policy` present | | |
| `Content-Security-Policy` sans `unsafe-eval` | | |
| Pas de `vercel.app` ni `Laurentides` dans le code | | |
| Mots-cles SEO : Rive-Sud, Longueuil, Brossard, etc. | | |

---

## Signatures

**Testeur :** ________________________  
**Date :** ________________________  
**Environnement (iOS version, modele) :** ________________________  
**Resultat global :** PASS / FAIL  
**Commentaires :** _______________________________________________