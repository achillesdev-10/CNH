with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ('lang=fr-CA', 'lang="fr-CA"' in content),
    ('canonical cnhservices.ca', 'cnhservices.ca' in content and 'vercel.app' not in content.split('<link rel="canonical"')[1].split('>')[0]),
    ('apple-touch-icon size', 'sizes="180x180"' in content),
    ('Rive-Sud in keywords', 'Rive-Sud' in content),
    ('Laurentides removed', 'Laurentides' not in content or content.count('Laurentides') == 0),
    ('Font Awesome removed', 'font-awesome' not in content.lower()),
    ('sprite.svg referenced', 'sprite.svg' in content),
    ('lang=fr-CA', 'lang="fr-CA"' in content),
]

for name, result in checks:
    print(f"{name}: {result}")