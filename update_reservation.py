with open('public/reservation.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Update canonical and meta tags
content = content.replace(
    '<meta name="description" content="Réservez votre lavage auto à domicile avec CNH Service. Choisissez votre forfait, date et créneau horaire en quelques clics.">',
    '<meta name="description" content="Réservez votre lavage auto à domicile avec CNH Service sur la Rive-Sud de Montréal. Choisissez votre forfait, date et créneau horaire en quelques clics.">'
)

# Add canonical
content = content.replace(
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="canonical" href="https://cnhservices.ca/reservation">\n    <link rel="manifest" href="/manifest.webmanifest">'
)

# Fix 2: Add OG tags
og_tags = '''    <meta property="og:title" content="Réservation | CNH Service - Lavage Auto à Domicile">
    <meta property="og:description" content="Réservez votre lavage auto à domicile sur la Rive-Sud de Montr\u00e9al. Choisissez votre forfait, date et cr\u00e9neau horaire en quelques clics.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://cnhservices.ca/reservation">
    <meta property="og:image" content="https://cnhservices.ca/og-image.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="R\u00e9servation | CNH Service - Lavage Auto \u00e0 Domicile">
    <meta name="twitter:description" content="R\u00e9servez votre lavage auto \u00e0 domicile sur la Rive-Sud de Montr\u00e9al. Choisissez votre forfait, date et cr\u00e9neau horaire en quelques clics.">'''

content = content.replace(
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
    ''
)

# Add OG tags and sprite reference
content = content.replace(
    '<link rel="apple-mobile-web-app-title" content="CNH Service">',
    '<meta name="apple-mobile-web-app-title" content="CNH Service">\n    <link rel="preload" as="style" href="/icons/sprite.svg">\n    <link rel="stylesheet" href="/icons/sprite.svg" media="print" onload="this.media=\'all\'">\n    <script>document.documentElement.classList.add(\'js\');</script>'
)

# Fix 3: Add safe-area padding to body
content = content.replace(
    'body{font-family:\'Inter\',sans-serif;font-size:16px;line-height:1.6;color:#1e293b;background:linear-gradient(180deg,#f0f9ff 0%,#f8fafc 30%,#f1f5f9 100%);min-height:100vh}',
    'body{font-family:\'Inter\',sans-serif;font-size:16px;line-height:1.6;color:#1e293b;background:linear-gradient(180deg,#f0f9ff 0%,#f8fafc 30%,#f1f5f9 100%);min-height:100vh;padding-bottom:env(safe-area-inset-bottom,0px)}'
)

# Fix 4: Add safe-area padding to form card
content = content.replace(
    '.form-card{background:var(--white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:36px;margin-bottom:24px;animation:fadeScale .5s ease;border:1px solid rgba(255,255,255,.8);transition:box-shadow .3s ease}',
    '.form-card{background:var(--white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:36px;margin-bottom:24px;animation:fadeScale .5s ease;border:1px solid rgba(255,255,255,.8);transition:box-shadow .3s ease;padding-bottom:calc(36px + env(safe-area-inset-bottom,0px))}'
)

# Fix 5: Add safe-area to top-bar
content = content.replace(
    '.top-bar{background:rgba(255,255,255,.97);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--gray-200);padding:14px 0;position:sticky;top:0;z-index:100;transition:box-shadow .3s ease}',
    '.top-bar{background:rgba(255,255,255,.97);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--gray-200);padding:14px 0;position:sticky;top:0;z-index:100;transition:box-shadow .3s ease;padding-top:calc(14px + env(safe-area-inset-top,0px))}'
)

# Replace Font Awesome with sprite.svg
content = content.replace(
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
    '<link rel="preload" as="style" href="/icons/sprite.svg">\n    <link rel="stylesheet" href="/icons/sprite.svg" media="print" onload="this.media=\'all\'">\n    <script>document.documentElement.classList.add(\'js\');</script>'
)

# Fix html lang
content = content.replace(
    '<html lang="fr">',
    '<html lang="fr-CA">'
)

# Add js class script
content = content.replace(
    '<meta name="apple-mobile-web-app-title" content="CNH Service">',
    '<meta name="apple-mobile-web-app-title" content="CNH Service">\n    <link rel="preload" as="style" href="/icons/sprite.svg">\n    <script>document.documentElement.classList.add(\'js\');</script>'
)

# Fix 8: Update form inputs to have font-size >= 16px
content = content.replace(
    '.form-group input,.form-group select,.form-group textarea{width:100%;padding:13px 16px;border:2px solid var(--gray-200);border-radius:12px;font-family:\'Inter\',sans-serif;font-size:.9rem;transition:all .3s ease;background:var(--gray-100)}',
    '.form-group input,.form-group select,.form-group textarea{width:100%;padding:13px 16px;border:2px solid var(--gray-200);border-radius:12px;font-family:\'Inter\',sans-serif;font-size:1rem;transition:all .3s ease;background:var(--gray-100)}'
)

# Fix 9: Update calendar font-size
content = content.replace(
    '.cal-day{padding:12px 6px;border-radius:10px;font-size:.88rem;font-weight:500;color:var(--slate);cursor:pointer;transition:all .25s ease;position:relative}',
    '.cal-day{padding:12px 6px;border-radius:10px;font-size:1rem;font-weight:500;color:var(--slate);cursor:pointer;transition:all .25s ease;position:relative}'
)

# Fix 10: Update time slots font-size
content = content.replace(
    '.slot{padding:12px 10px;border:2px solid var(--gray-200);border-radius:10px;text-align:center;font-size:.88rem;font-weight:600;color:var(--slate);cursor:pointer;transition:all .25s ease;background:var(--white)}',
    '.slot{padding:12px 10px;border:2px solid var(--gray-200);border-radius:10px;text-align:center;font-size:1rem;font-weight:600;color:var(--slate);cursor:pointer;transition:all .25s ease;background:var(--white)}'
)

# Fix 11: Update extra options font-size
content = content.replace(
    '.extra-opt .eo-head strong{font-size:.9rem;color:var(--slate)}',
    '.extra-opt .eo-head strong{font-size:1rem;color:var(--slate)}'
)

# Fix 12: Add focus-visible styles
content = content.replace(
    '.btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}',
    '.btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}\n\n        /* Focus visible */\n        a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid rgba(14,165,233,.45);outline-offset:2px}'
)

# Fix 13: Add prefers-reduced-motion
content = content.replace(
    '@media(max-width:600px){.form-row,.form-row-3{grid-template-columns:1fr}.calendar-grid{gap:2px}.cal-day{padding:10px 2px;font-size:.82rem}.slots-grid{grid-template-columns:repeat(3,1fr)}.top-bar .container{padding:0 12px}.form-card{padding:24px}}',
    '@media(max-width:600px){.form-row,.form-row-3{grid-template-columns:1fr}.calendar-grid{gap:2px}.cal-day{padding:10px 2px;font-size:.82rem}.slots-grid{grid-template-columns:repeat(3,1fr)}.top-bar .container{padding:0 12px}.form-card{padding:24px}}\n\n@media (prefers-reduced-motion: reduce) {\n  .reveal, .reveal-left, .reveal-right, .reveal-scale,\n  .loader, .hero-float, .pulse-wa, .spin,\n  [style*="animation"], [style*="transition"] {\n    animation: none !important;\n    transition: none !important;\n  }\n  .reveal, .reveal-left, .reveal-right, .reveal-scale {\n    opacity: 1 !important;\n    transform: none !important;\n  }\n}'
)

# Add js class script
content = content.replace(
    '<script>\n    (function() {',
    '<script>document.documentElement.classList.add(\'js\');</script>\n    <script>\n    (function() {'
)

# Fix html lang
content = content.replace(
    '<html lang="fr">',
    '<html lang="fr-CA">'
)

with open('public/reservation.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("reservation.html updated")