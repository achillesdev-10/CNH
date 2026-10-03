with open('public/install.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Update iOS instructions to use cnhservices.ca
content = content.replace(
    'Ouvrez <strong>cnhservices.vercel.app</strong> dans <strong>Safari</strong>.',
    'Ouvrez <strong>cnhservices.ca</strong> dans <strong>Safari</strong>.'
)

# Fix 2: Update QR code to use cnhservices.ca/install (local static QR)
# Replace the QR code image src
content = content.replace(
    'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fcnhservices.vercel.app%2Finstall',
    'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fcnhservices.ca%2Finstall'
)

# Fix 3: Add safe-area padding to body and sections
# Update body padding
content = content.replace(
    'body{font-family:\'Inter\',sans-serif;min-height:100vh;background:linear-gradient(160deg,#0b1220,#0c2c47 55%,#075985);color:#fff;padding:32px 16px 48px}',
    'body{font-family:\'Inter\',sans-serif;min-height:100vh;background:linear-gradient(160deg,#0b1220,#0c2c47 55%,#075985);color:#fff;padding:32px 16px calc(48px + env(safe-area-inset-bottom,0px))}'
)

# Add safe-area padding to platform sections
content = content.replace(
    '.platform{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:26px 22px;margin-bottom:20px;backdrop-filter:blur(10px);animation:fadeUp .5s ease both}',
    '.platform{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:26px 22px;margin-bottom:20px;backdrop-filter:blur(10px);animation:fadeUp .5s ease both;padding-bottom:calc(26px + env(safe-area-inset-bottom,0px))}'
)

# Add safe-area padding to QR section
content = content.replace(
    '.qr{margin-top:22px;text-align:center}',
    '.qr{margin-top:22px;text-align:center;padding-bottom:env(safe-area-inset-bottom,0px)}'
)

# Add safe-area to desktop actions
content = content.replace(
    '.desktop-actions{margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center}',
    '.desktop-actions{margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0px)}'
)

# Fix 4: Update meta tags for PWA
# Add apple-touch-icon with size
content = content.replace(
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">'
)

# Add manifest link if not present (already there)
# Add theme-color media
# Already has theme-color

# Add viewport-fit=cover if not present
# Already has viewport-fit=cover

# Fix 5: Update the QR code alt text
content = content.replace(
    'alt="QR code vers la page d\'installation CNH Service sur mobile"',
    'alt="QR code vers la page d\'installation CNH Service sur mobile - https://cnhservices.ca/install"'
)

# Fix 6: Update the iOS steps to not mention vercel.app anywhere
content = content.replace(
    'cnhservices.vercel.app',
    'cnhservices.ca'
)

with open('public/install.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("install.html updated")