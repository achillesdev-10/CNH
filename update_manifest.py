import json

with open('public/manifest.webmanifest', 'r', encoding='utf-8') as f:
    manifest = json.load(f)

# Update manifest
manifest['description'] = 'Service de lavage automobile professionnel à domicile — Grand Montréal & Rive-Sud. Réservez votre lavage, consultez nos services et tarifs directement depuis l\'application.'
manifest['lang'] = 'fr-CA'
manifest['screenshots'] = []  # Will be populated by build:screenshots
manifest['shortcuts'][1]['url'] = '/?source=pwa#contact'  # Fix malformed shortcut URL

with open('public/manifest.webmanifest', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print("Manifest updated")