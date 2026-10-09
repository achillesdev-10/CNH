with open('public/offline.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Update meta description to include Rive-Sud
content = content.replace(
    'meta name="description" content="Vous êtes actuellement hors connexion"',
    'meta name="description" content="CNH Service - Lavage Auto à Domicile - Grand Montréal & Rive-Sud - Hors connexion"'
)

with open('public/offline.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated offline.html')