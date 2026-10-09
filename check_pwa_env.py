for f in ['public/index.html', 'public/install.html']:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    print(f + ': pwa-env.js = ' + str('pwa-env.js' in content))