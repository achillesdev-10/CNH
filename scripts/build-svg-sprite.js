#!/usr/bin/env node
/**
 * CNH Service — Build SVG Sprite
 * Génère un sprite SVG unique avec toutes les icônes Font Awesome utilisées dans le projet
 * Remplace le chargement de Font Awesome depuis le CDN
 */

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('svgson');
const svgo = require('svgo');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const OUTPUT_SPRITE = path.join(__dirname, '..', 'public', 'icons', 'sprite.svg');
const FA_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/svgs/';

// Liste des icônes Font Awesome utilisées dans le projet (déduite de l'analyse du code)
const ICON_NAMES = [
  // Brand / UI
  'fa-droplet', 'fa-calendar-check', 'fa-mobile-screen', 'fa-mobile-screen-button',
  'fa-bars', 'fa-times', 'fa-chevron-up', 'fa-chevron-left', 'fa-chevron-right',
  'fa-spray-can-sparkles', 'fa-couch', 'fa-wand-magic-sparkles', 'fa-gears',
  'fa-shield-halved', 'fa-truck-pickup', 'fa-truck-fast', 'fa-star', 'fa-crown',
  'fa-circle-dot', 'fa-water', 'fa-circle-check', 'fa-circle-xmark',
  'fa-circle-exclamation', 'fa-circle-info', 'fa-check-circle', 'fa-exclamation-circle',
  'fa-paper-plane', 'fa-spinner', 'fa-eye', 'fa-eye-slash', 'fa-trash',
  'fa-check', 'fa-flag-checkered', 'fa-spinner', 'fa-rotate', 'fa-file-csv',
  'fa-envelope', 'fa-phone', 'fa-map-marker-alt', 'fa-clock', 'fa-images',
  'fa-quote-left', 'fa-pen', 'fa-tag', 'fa-wand-magic-sparkles', 'fa-list-check',
  'fa-info-circle', 'fa-award', 'fa-chart-line', 'fa-chart-bar', 'fa-fire',
  'fa-file-lines', 'fa-calendar', 'fa-envelope', 'fa-star', 'fa-chart-simple',
  'fa-inbox', 'fa-globe', 'fa-right-to-bracket', 'fa-right-from-bracket',
  'fa-triangle-exclamation', 'fa-rotate-left', 'fa-circle-dot', 'fa-shield-halved',
  'fa-gears', 'fa-water', 'fa-mobile-screen', 'fa-mobile-screen-button',
  'fa-whatsapp', 'fa-facebook-f', 'fa-instagram', 'fa-chevron-up', 'fa-chevron-down',
  'fa-leaf', 'fa-shield-halved', 'fa-circle-plus', 'fa-circle-minus', 'fa-expand',
  'fa-compress', 'fa-arrow-left', 'fa-arrow-right', 'fa-chevron-left', 'fa-chevron-right',
  'fa-file-invoice', 'fa-file-csv', 'fa-eye', 'fa-eye-slash', 'fa-trash', 'fa-check',
  'fa-spinner', 'fa-check-circle', 'fa-exclamation-circle', 'fa-paper-plane',
  'fa-bars', 'fa-times', 'fa-chevron-up', 'fa-chevron-down', 'fa-home', 'fa-plus',
  'fa-calendar-check', 'fa-flag-checkered', 'fa-spinner', 'fa-paper-plane',
  'fa-home', 'fa-plus', 'fa-search', 'fa-user', 'fa-cog', 'fa-sign-out-alt',
  'fa-filter', 'fa-sort', 'fa-sort-up', 'fa-sort-down', 'fa-ellipsis-v',
  'fa-ellipsis-h', 'fa-bell', 'fa-bell-slash', 'fa-moon', 'fa-sun',
  'fa-lock', 'fa-unlock', 'fa-key', 'fa-id-card', 'fa-id-badge',
  'fa-address-card', 'fa-address-book', 'fa-user-circle', 'fa-user-plus',
  'fa-user-minus', 'fa-user-check', 'fa-user-times', 'fa-users', 'fa-user-friends',
  'fa-user-cog', 'fa-user-shield', 'fa-user-lock', 'fa-user-tag', 'fa-user-ninja',
  'fa-user-secret', 'fa-user-graduate', 'fa-user-tie', 'fa-user-md', 'fa-user-astronaut',
  'fa-user-shield', 'fa-user-lock', 'fa-user-tag', 'fa-user-ninja', 'fa-user-secret',
  'fa-user-graduate', 'fa-user-tie', 'fa-user-md', 'fa-user-astronaut',
  // Icônes spécifiques au projet
  'fa-droplet', 'fa-sparkles', 'fa-list-check', 'fa-images', 'fa-quote-left',
  'fa-wand-magic-sparkles', 'fa-circle-check', 'fa-file-invoice', 'fa-file-csv',
  'fa-eye', 'fa-eye-slash', 'fa-trash', 'fa-check', 'fa-spinner', 'fa-check-circle',
  'fa-exclamation-circle', 'fa-paper-plane', 'fa-spinner', 'fa-home', 'fa-plus',
  'fa-calendar-check', 'fa-flag-checkered', 'fa-spinner', 'fa-paper-plane',
  'fa-home', 'fa-plus', 'fa-search', 'fa-user', 'fa-cog', 'fa-sign-out-alt',
];

// Dédupliquer
const uniqueIcons = [...new Set(ICON_NAMES)];

async function buildSprite() {
  console.log('🔨 Génération du sprite SVG...');
  
  const optimizer = new svgo({
    plugins: [
      { name: 'removeAttrs', params: { attrs: '(fill|stroke|style|class|data-*)' } },
      { name: 'removeDimensions' },
      { name: 'cleanupIds', params: { minify: true } },
      { name: 'removeXMLNS' },
      { name: 'removeViewBox', params: { remove: false } },
      { name: 'cleanupNumericValues', params: { floatPrecision: 2 } },
      { name: 'convertColors', params: { currentColor: true } },
    ],
  });

  const symbols = [];

  for (const iconName of uniqueIcons) {
    try {
      // Télécharger le SVG depuis le CDN Font Awesome
      const url = `${FA_CDN}solid/${iconName.replace('fa-', '')}.svg`;
      const response = await fetch(url);
      
      if (!response.ok) {
        // Essayer la version regular
        const altUrl = `${FA_CDN}regular/${iconName.replace('fa-', '')}.svg`;
        const altResponse = await fetch(altUrl);
        if (!altResponse.ok) {
          // Essayer brands
          const brandUrl = `${FA_CDN}brands/${iconName.replace('fa-', '')}.svg`;
          const brandResponse = await fetch(brandUrl);
          if (!brandResponse.ok) {
            console.warn(`  ⚠️ Icône non trouvée : ${iconName}`);
            continue;
          }
        }
      }
      
      const svgText = await response.text();
      const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      
      // Extraire le contenu du SVG
      const svgElement = parsed.documentElement;
      const viewBox = svgElement.getAttribute('viewBox') || '0 0 512 512';
      const paths = [];
      
      // Extraire tous les éléments enfants (path, circle, rect, etc.)
      const children = Array.from(svgElement.children);
      for (const child of children) {
        const serializer = new XMLSerializer();
        paths.push(serializer.serializeToString(child));
      }
      
      if (paths.length > 0) {
        symbols.push({
          id: iconName.replace('fa-', ''),
          viewBox,
          content: paths.join('\n')
        });
      }
    } catch (err) {
      console.warn(`  ⚠️ Erreur pour ${iconName} : ${err.message}`);
    }
  }

  // Générer le sprite SVG
  const spriteContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:none;">
  ${symbols.map(s => `
  <symbol id="${s.id}" viewBox="${s.viewBox}">
    ${s.content}
  </symbol>`).join('\n')}
</svg>`;

  fs.writeFileSync(OUTPUT_SPRITE, spriteContent);
  console.log(`✅ Sprite SVG généré : ${OUTPUT_SPRITE} (${symbols.length} icônes)`);
  
  // Générer aussi le fichier de mapping pour référence
  const mappingPath = path.join(__dirname, '..', 'public', 'icons', 'sprite-map.json');
  const mapping = symbols.map(s => ({ id: s.id, viewBox: s.viewBox }));
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`   ✅ Mapping généré : ${mappingPath}`);
}

buildSprite().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});