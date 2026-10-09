#!/usr/bin/env node
/**
 * CNH Service — Build Screenshots
 * Génère les captures d'écran pour le manifest PWA avec Playwright (chromium + webkit)
 * Viewports : 360x640, 390x844, 768x1024, 1366x768
 * Pages : index, reservation, install
 */

const fs = require('fs');
const path = require('path');
const { chromium, webkit } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'screenshots');

const VIEWPORTS = [
  { name: 'mobile-small', width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'mobile-iphone', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: false, hasTouch: true },
  { name: 'desktop', width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

const PAGES = [
  { path: '/', name: 'accueil', label: 'Page d\'accueil de CNH Service' },
  { path: '/reservation', name: 'reservation', label: 'Page de réservation de CNH Service' },
  { path: '/install', name: 'install', label: 'Page d\'installation de CNH Service' },
];

const BROWSERS = [
  { name: 'chromium', launcher: chromium },
  { name: 'webkit', launcher: webkit },
];

async function buildScreenshots() {
  console.log('📸 Génération des captures d\'écran PWA...');
  console.log(`   URL de base : ${BASE_URL}`);
  console.log(`   Navigateurs : ${BROWSERS.map(b => b.name).join(', ')}`);
  console.log(`   Viewports : ${VIEWPORTS.map(v => `${v.name} (${v.width}x${v.height})`).join(', ')}`);
  console.log(`   Pages : ${PAGES.map(p => p.name).join(', ')}`);

  // Créer le dossier de sortie
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Lancer les navigateurs
  const browsers = await Promise.all(
    BROWSERS.map(async ({ name, launcher }) => {
      const browser = await launcher.launch();
      console.log(`   ✓ ${name} lancé`);
      return { name, browser };
    })
  );

  let totalScreenshots = 0;
  let failedScreenshots = 0;

  for (const { name: browserName, browser } of browsers) {
    for (const viewport of VIEWPORTS) {
      for (const page of PAGES) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: viewport.deviceScaleFactor,
          isMobile: viewport.isMobile,
          hasTouch: viewport.hasTouch,
          userAgent: viewport.isMobile 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            : undefined,
        });

        const page = await context.newPage();
        
        try {
          const url = `${BASE_URL}${page.path}`;
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          
          // Attendre que les polices et images soient chargées
          await page.waitForLoadState('networkidle');
          await page.evaluate(() => document.fonts.ready);
          
          // Attendre un peu pour les animations
          await page.waitForTimeout(500);
          
          const filename = `${page.name}-${viewport.name}-${browserName}.webp`;
          const outputPath = path.join(OUTPUT_DIR, filename);
          
          await page.screenshot({
            path: outputPath,
            fullPage: page.path !== '/install', // install.html n'est pas une page à défilement
            type: 'webp',
            quality: 85,
          });
          
          // Optimiser avec sharp si disponible
          try {
            const sharp = require('sharp');
            await sharp(outputPath)
              .webp({ quality: 80, effort: 6 })
              .toFile(outputPath + '.tmp');
            fs.renameSync(outputPath + '.tmp', outputPath);
          } catch (e) {
            // sharp pas dispo ou erreur, on garde l'original
          }
          
          const stats = fs.statSync(outputPath);
          console.log(`   ✅ ${browserName} / ${viewport.name} / ${page.name} (${(stats.size / 1024).toFixed(1)} KB)`);
          totalScreenshots++;
        } catch (err) {
          console.error(`   ❌ ${browserName} / ${viewport.name} / ${page.name} : ${err.message}`);
          failedScreenshots++;
        } finally {
          await context.close();
        }
      }
    }
    
    await browser.close();
  }

  // Générer le manifest mis à jour avec les nouvelles screenshots
  await updateManifest();

  console.log(`\n✅ ${totalScreenshots} captures générées${failedScreenshots > 0 ? ` (${failedScreenshots} échouées)` : ''}`);
  
  if (failedScreenshots > 0) {
    process.exit(1);
  }
}

async function updateManifest() {
  const manifestPath = path.join(__dirname, '..', 'public', 'manifest.webmanifest');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Mettre à jour les screenshots avec les nouveaux fichiers
  const screenshots = [];
  
  for (const page of PAGES) {
    for (const viewport of VIEWPORTS.filter(v => v.isMobile)) {
      for (const browser of BROWSERS) {
        const filename = `${page.name}-${viewport.name}-${browser.name}.webp`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        if (fs.existsSync(filepath)) {
          const stats = fs.statSync(filepath);
          screenshots.push({
            src: `/screenshots/${filename}`,
            sizes: `${viewport.width}x${viewport.height}`,
            type: 'image/webp',
            form_factor: viewport.width < viewport.height ? 'narrow' : 'wide',
            label: `${page.label} (${viewport.name}, ${browser.name})`
          });
        }
      }
    }
  }

  // Ajouter aussi les versions desktop
  for (const page of PAGES) {
    for (const viewport of VIEWPORTS.filter(v => !v.isMobile)) {
      for (const browser of BROWSERS) {
        const filename = `${page.name}-${viewport.name}-${browser.name}.webp`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        if (fs.existsSync(filepath)) {
          screenshots.push({
            src: `/screenshots/${filename}`,
            sizes: `${viewport.width}x${viewport.height}`,
            type: 'image/webp',
            form_factor: 'wide',
            label: `${page.label} (${viewport.name}, ${browser.name})`
          });
        }
      }
    }
  }

  manifest.screenshots = screenshots;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ manifest.webmanifest mis à jour avec ${screenshots.length} screenshots`);
}

// Exécution
buildScreenshots().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});