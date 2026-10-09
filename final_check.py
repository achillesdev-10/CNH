import os

checks = {
    'CHANGELOG-VISUEL.md': 'CHANGELOG-VISUEL.md',
    'docs/PWA-IPHONE.md': 'docs/PWA-IPHONE.md',
    'public/brand/logo.svg': 'public/brand/logo.svg',
    'scripts/build-icons.js': 'scripts/build-icons.js',
    'scripts/build-screenshots.js': 'scripts/build-screenshots.js',
    'scripts/build-svg-sprite.js': 'scripts/build-svg-sprite.js',
    'scripts/purge-old-data.js': 'scripts/purge-old-data.js',
    'public/js/pwa-env.js': 'public/js/pwa-env.js',
    'docs/PWA-IPHONE.md': 'docs/PWA-IPHONE.md',
    'CHANGELOG-VISUEL.md': 'CHANGELOG-VISUEL.md',
}

for name, path in checks.items():
    exists = os.path.exists(path)
    size = os.path.getsize(path) if exists else 0
    print(f'{name}: {"OK" if exists else "MISSING"} ({size} bytes)')