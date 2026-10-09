files = ['public/install.html', 'public/admin.html', 'public/offline.html']
for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    print(f + ': Rive-Sud=' + str('Rive-Sud' in content) + ', Laurentides=' + str('Laurentides' in content))