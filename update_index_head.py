#!/usr/bin/env python3
# Update index.html head section

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the head section (from <head> to </head> is too complex, let's do targeted replacements)

# 1. Fix html lang
content = content.replace('<html lang="fr">', '<html lang="fr-CA">')

# 2. Fix title
content = content.replace(
    '<title>CNH Service | Lavage Auto à Domicile Professionnel | Grand Montréal</title>',
    '<title>CNH Service | Lavage Auto à Domicile Professionnel | Grand Montréal & Rive-Sud</title>'
)

# 3. Fix meta description
content = content.replace(
    'CNH Service offre un lavage auto professionnel à domicile dans le Grand Montréal et les Laurentides. Lavage extérieur, intérieur, detailing, nettoyage moteur. Devis gratuit! ☎ +1 450 230 2509',
    'CNH Service offre un lavage auto professionnel à domicile dans le Grand Montréal et la Rive-Sud. Lavage extérieur, intérieur, detailing, nettoyage moteur. Devis gratuit! ☎ +1 450 230 2509'
)

# 4. Fix keywords
content = content.replace(
    'lavage auto domicile, lavage voiture professionnel, detailing auto, lavage extérieur intérieur, Grand Montréal, Laurentides, lavage mobile, nettoyage auto, CNH Service',
    'lavage auto domicile, lavage voiture professionnel, detailing auto, lavage extérieur intérieur, Grand Montréal, Rive-Sud, Longueuil, Brossard, Saint-Lambert, Boucherville, Saint-Bruno-de-Montarville, La Prairie, Candiac, Chambly, lavage mobile, nettoyage auto, CNH Service'
)

# 5. Fix canonical
content = content.replace(
    '<link rel="canonical" href="https://cnhservices.vercel.app">',
    '<link rel="canonical" href="https://cnhservices.ca">'
)

# 5. Fix OG tags
content = content.replace(
    '<meta property="og:description" content="Lavage auto professionnel à domicile dans le Grand Montréal et les Laurentides. Devis gratuit en ligne.">',
    '<meta property="og:description" content="Lavage auto professionnel à domicile dans le Grand Montréal et la Rive-Sud. Devis gratuit en ligne.">'
)

content = content.replace(
    '<meta property="og:url" content="https://cnhservices.vercel.app">',
    '<meta property="og:url" content="https://cnhservices.ca">'
)

content = content.replace(
    '<meta property="og:image" content="https://cnhservices.vercel.app/og-image.jpg">',
    '<meta property="og:image" content="https://cnhservices.ca/og-image.jpg">'
)

content = content.replace(
    '<meta property="og:image:alt" content="CNH Service — lavage auto à domicile dans le Grand Montréal et les Laurentides">',
    '<meta property="og:image:alt" content="CNH Service — lavage auto à domicile dans le Grand Montréal et la Rive-Sud">'
)

# Twitter cards
content = content.replace(
    '<meta name="twitter:description" content="Lavage auto professionnel à domicile dans le Grand Montréal et les Laurentides. Devis gratuit en ligne.">',
    '<meta name="twitter:description" content="Lavage auto professionnel à domicile dans le Grand Montréal et la Rive-Sud. Devis gratuit en ligne.">'
)

content = content.replace(
    '<meta name="twitter:image" content="https://cnhservices.vercel.app/og-image.jpg">',
    '<meta name="twitter:image" content="https://cnhservices.ca/og-image.jpg">'
)

content = content.replace(
    '<meta name="twitter:image:alt" content="CNH Service — lavage auto à domicile dans le Grand Montréal et les Laurentides">',
    '<meta name="twitter:image:alt" content="CNH Service — lavage auto à domicile dans le Grand Montréal et la Rive-Sud">'
)

# Fix apple-touch-icon size
content = content.replace(
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">'
)

# Fix lang to fr-CA
content = content.replace('<html lang="fr">', '<html lang="fr-CA">')

# Add theme-color for dark mode
content = content.replace(
    '<meta name="theme-color" content="#0f172a">',
    '<meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: light)">'
)

# Replace Font Awesome CDN with local sprite
# Remove the FA stylesheet link and preconnect
old_fa = '''    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">'''

new_fonts = '''    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"></noscript>
    <link rel="preload" as="style" href="/icons/sprite.svg">
    <link rel="stylesheet" href="/icons/sprite.svg" media="print" onload="this.media='all'">
    <script>document.documentElement.classList.add('js');</script>'''

content = content.replace(old_fa, new_fonts)

# Save
with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Head section updated")