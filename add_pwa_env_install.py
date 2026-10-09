with open('public/install.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add pwa-env.js before the inline script
content = content.replace(
    '<script>\n    (function() {',
    '<script src="/js/pwa-env.js"></script>\n    <script>\n    (function() {'
)

with open('public/install.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("pwa-env.js added to install.html")