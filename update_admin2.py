with open('public/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add canonical
content = content.replace(
    '<meta name="theme-color" content="#0f172a">',
    '<meta name="theme-color" content="#0f172a">\n    <link rel="canonical" href="https://cnhservices.ca/admin">'
)

# Fix 2: Replace Font Awesome with sprite.svg
content = content.replace(
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
    '<link rel="preload" as="style" href="/icons/sprite.svg">\n    <link rel="stylesheet" href="/icons/sprite.svg" media="print" onload="this.media=\'all\'">\n    <script>document.documentElement.classList.add(\'js\');</script>'
)

# Fix 3: Add safe-area padding to body
content = content.replace(
    'body{font-family:\'Inter\',sans-serif;font-size:16px;line-height:1.6;color:#1e293b;background:#f0f4f8;min-height:100vh}',
    'body{font-family:\'Inter\',sans-serif;font-size:16px;line-height:1.6;color:#1e293b;background:#f0f4f8;min-height:100vh;padding-bottom:env(safe-area-inset-bottom,0px)}'
)

# Fix 2: Add safe-area padding to topbar
content = content.replace(
    '.topbar{background:rgba(255,255,255,.97);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--gray-200);padding:14px 28px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;transition:box-shadow .3s ease}',
    '.topbar{background:rgba(255,255,255,.97);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--gray-200);padding:14px 28px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;transition:box-shadow .3s ease;padding-top:calc(14px + env(safe-area-inset-top,0px))}'
)

# Fix 3: Add safe-area padding to card-body
content = content.replace(
    '.card-body{padding:22px}',
    '.card-body{padding:22px;padding-bottom:calc(22px + env(safe-area-inset-bottom,0px))}'
)

# Fix 3: Add safe-area to modals
content = content.replace(
    '.modal{background:var(--white);border-radius:20px;padding:28px;width:100%;max-width:400px;box-shadow:0 24px 60px rgba(2,6,23,.3);text-align:center;transform:scale(.92) translateY(10px);transition:transform .3s cubic-bezier(.34,1.56,.64,1)}',
    '.modal{background:var(--white);border-radius:20px;padding:28px;width:100%;max-width:400px;box-shadow:0 24px 60px rgba(2,6,23,.3);text-align:center;transform:scale(.92) translateY(10px);transition:transform .3s cubic-bezier(.34,1.56,.64,1);padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))}'
)

# Fix 3: Add focus-visible styles
content = content.replace(
    'a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid rgba(14,165,233,.45);outline-offset:2px}',
    'a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid rgba(14,165,233,.45);outline-offset:2px}\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation: none !important; transition: none !important; }\n}'
)

# Replace Font Awesome with sprite.svg
content = content.replace(
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
    '<link rel="preload" as="style" href="/icons/sprite.svg">\n    <link rel="stylesheet" href="/icons/sprite.svg" media="print" onload="this.media=\'all\'">\n    <script>document.documentElement.classList.add(\'js\');</script>'
)

# Fix 4: Update form inputs font-size
content = content.replace(
    '.login-card input{width:100%;padding:13px 16px;border:2px solid var(--gray-200);border-radius:12px;font-family:\'Inter\',sans-serif;font-size:.9rem;background:var(--gray-100);transition:all .3s ease}',
    '.login-card input{width:100%;padding:13px 16px;border:2px solid var(--gray-200);border-radius:12px;font-family:\'Inter\',sans-serif;font-size:1rem;background:var(--gray-100);transition:all .3s ease}'
)

content = content.replace(
    '.settings-grid input,.settings-grid textarea{width:100%;padding:12px 16px;border:2px solid var(--gray-200);border-radius:12px;font-family:\'Inter\',sans-serif;font-size:.9rem;background:var(--gray-100);transition:all .3s ease}',
    '.settings-grid input,.settings-grid textarea{width:100%;padding:12px 16px;border:2px solid var(--gray-200);border-radius:12px;font-family:\'Inter\',sans-serif;font-size:1rem;background:var(--gray-100);transition:all .3s ease}'
)

# Fix 5: Add prefers-reduced-motion
content = content.replace(
    'a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid rgba(14,165,233,.45);outline-offset:2px}',
    'a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid rgba(14,165,233,.45);outline-offset:2px}\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation: none !important; transition: none !important; }\n}'
)

# Replace Font Awesome with sprite.svg
content = content.replace(
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
    '<link rel="preload" as="style" href="/icons/sprite.svg">\n    <link rel="stylesheet" href="/icons/sprite.svg" media="print" onload="this.media=\'all\'">\n    <script>document.documentElement.classList.add(\'js\');</script>'
)

# Add js class script
content = content.replace(
    '<script>\n    // ── PWA : service worker (sans jamais cacher les appels API authentifiés) ──',
    '<script>document.documentElement.classList.add(\'js\');</script>\n    <script>\n    // ── PWA : service worker (sans jamais cacher les appels API authentifiés) ──'
)

with open('public/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("admin.html updated")