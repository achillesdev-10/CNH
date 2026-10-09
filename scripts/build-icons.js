#!/usr/bin/env node
/**
 * CNH Service — Build Icons
 * Génère toutes les icônes PWA à partir du logo SVG source (public/brand/logo.svg)
 * Sortie dans public/icons/
 * Vérifie qu'aucune icône Apple n'a de pixel transparent et que les tailles sont exactes.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { DOMParser } = require('svgson');

const SOURCE_SVG = path.join(__dirname, '..', 'public', 'brand', 'logo.svg');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// Configuration des icônes à générer
const ICON_SPECS = [
  // Apple Touch Icon (DOIT être opaque, 180x180, sans coins arrondis - iOS les arrondit)
  { name: 'apple-touch-icon.png', size: 180, format: 'png', opaque: true, background: '#0ea5e9', maskable: false },

  // Favicons standards
  { name: 'icon-16.png', size: 16, format: 'png', opaque: false, maskable: false },
  { name: 'icon-32.png', size: 32, format: 'png', opaque: false, maskable: false },

  // PWA icons "any"
  { name: 'icon-192.png', size: 192, format: 'png', opaque: false, maskable: false },
  { name: 'icon-512.png', size: 512, format: 'png', opaque: false, maskable: false },

  // PWA icons "maskable" (zone de sécurité 80% = padding 10% de chaque côté)
  { name: 'icon-192-maskable.png', size: 192, format: 'png', opaque: false, maskable: true, safeZone: 0.8 },
  { name: 'icon-512-maskable.png', size: 512, format: 'png', opaque: false, maskable: true, safeZone: 0.8 },

  // SVG source pour le manifest (copie simple)
  { name: 'icon.svg', size: null, format: 'svg', source: true },
  { name: 'icon-maskable.svg', size: null, format: 'svg', source: true, maskable: true },
];

async function generateIcons() {
  console.log('🔨 Génération des icônes PWA...');
  
  // Vérifier que le fichier source existe
  if (!fs.existsSync(SOURCE_SVG)) {
    console.error(`❌ Fichier source introuvable : ${SOURCE_SVG}`);
    process.exit(1);
  }

  // Créer le dossier de sortie
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Lire le SVG source
  const sourceSvg = fs.readFileSync(SOURCE_SVG, 'utf8');
  const svgBuffer = Buffer.from(sourceSvg);

  let hasErrors = false;

  for (const spec of ICON_SPECS) {
    const outputPath = path.join(OUTPUT_DIR, spec.name);
    
    try {
      if (spec.source) {
        // Copie simple du SVG source
        fs.copyFileSync(SOURCE_SVG, outputPath);
        console.log(`✅ ${spec.name} (copie SVG source)`);
        continue;
      }

      let pipeline = sharp(svgBuffer, { density: 300 });

      if (spec.maskable && spec.safeZone) {
        // Pour les icônes maskable : ajouter du padding pour respecter la zone de sécurité 80%
        const padding = Math.round(spec.size * (1 - spec.safeZone) / 2);
        pipeline = pipeline.resize(spec.size, spec.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }).extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      } else if (spec.opaque) {
        // Icône Apple Touch : fond opaque, pas de transparence
        pipeline = pipeline.resize(spec.size, spec.size, {
          fit: 'contain',
          background: spec.background || '#0ea5e9'
        }).flatten({ background: spec.background || '#0ea5e9' });
      } else {
        // Icônes standards avec transparence
        pipeline = pipeline.resize(spec.size, spec.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      }

      if (spec.format === 'png') {
        await pipeline.png({ compressionLevel: 9 }).toFile(outputPath);
      }

      // Vérifications post-génération
      if (spec.name === 'apple-touch-icon.png') {
        await verifyAppleTouchIcon(outputPath, spec.size);
      }

      console.log(`✅ ${spec.name} (${spec.size}x${spec.size}${spec.maskable ? ' maskable' : ''})`);
    } catch (err) {
      console.error(`❌ Erreur pour ${spec.name} :`, err.message);
      hasErrors = true;
    }
  }

  // Vérifier que toutes les icônes requises existent
  const requiredIcons = [
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-192-maskable.png',
    'icon-512-maskable.png',
    'icon.svg',
    'icon-maskable.svg',
  ];

  for (const req of requiredIcons) {
    const p = path.join(OUTPUT_DIR, req);
    if (!fs.existsSync(p)) {
      console.error(`❌ Icône requise manquante : ${req}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n❌ Certaines icônes n\'ont pas pu être générées ou validées.');
    process.exit(1);
  }

  console.log('\n✅ Toutes les icônes générées et validées avec succès !');
}

async function verifyAppleTouchIcon(filePath, expectedSize) {
  const metadata = await sharp(filePath).metadata();
  
  if (metadata.width !== expectedSize || metadata.height !== expectedSize) {
    throw new Error(`Taille incorrecte : ${metadata.width}x${metadata.height} au lieu de ${expectedSize}x${expectedSize}`);
  }
  
  if (metadata.channels === 4) {
    // Vérifier s'il y a des pixels transparents
    const { data } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const alphaChannel = data.slice(3, data.length, 4);
    const hasTransparent = alphaChannel.some(a => a < 255);
    
    if (hasTransparent) {
      throw new Error('L\'icône Apple Touch contient des pixels transparents (doit être opaque)');
    }
  }
  
  console.log(`   ✓ Vérification Apple Touch Icon : ${metadata.width}x${metadata.height}, opaque: ${metadata.channels === 3 || !metadata.hasAlpha}`);
}

// Exécution
generateIcons().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});