with open('public/offline.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add manifest link
content = content.replace(
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">\n    <link rel="manifest" href="/manifest.webmanifest">'
)

# Fix 2: Add safe-area padding to body
content = content.replace(
    'body{font-family:\'Inter\',sans-serif;min-height:100vh;background:linear-gradient(160deg,#0b1220,#0c2c47 55%,#075985);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}',
    'body{font-family:\'Inter\',sans-serif;min-height:100vh;background:linear-gradient(160deg,#0b1220,#0c2c47 55%,#075985);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;padding-bottom:env(safe-area-inset-bottom,0px)}'
)

# Fix 2: Add safe-area to box
content = content.replace(
    '.box{max-width:420px;width:100%}',
    '.box{max-width:420px;width:100%;padding-bottom:env(safe-area-inset-bottom,0px)}'
)

# Fix 3: Add focus-visible
content = content.replace(
    'button:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,165,233,.45)}',
    'button:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,165,233,.45)}\n\n    a:focus-visible,button:focus-visible{outline:3px solid rgba(14,165,233,.45);outline-offset:2px}'
)

# Add prefers-reduced-motion media query at end of style
content = content.replace(
    'button:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,165,233,.45)}',
    'button:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,165,233,.45)}\n\n@media (prefers-reduced-motion: reduce) {\n  * { animation: none !important; transition: none !important; }\n}'
)

with open('public/offline.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("offline.html updated")