files = ['public/index.html', 'public/reservation.html', 'public/install.html', 'public/offline.html', 'public/admin.html']
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    canonical_count = content.count('rel="canonical"')
    cnhservices_count = content.count('cnhservices.ca')
    print(f'{f}: canonical={canonical_count}, cnhservices.ca={cnhservices_count}')