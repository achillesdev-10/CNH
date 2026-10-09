with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Include pwa-env.js before the other scripts
content = content.replace(
    '<script>document.documentElement.classList.add(\'js\');</script>',
    '<script>document.documentElement.classList.add(\'js\');</script>\n    <script src="/js/pwa-env.js"></script>'
)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("pwa-env.js added to index.html")