with open('public/offline.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add canonical
content = content.replace(
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">\n    <link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="canonical" href="https://cnhservices.ca/offline">\n    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">\n    <link rel="manifest" href="/manifest.webmanifest">'
)

with open('public/offline.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("offline.html canonical added")