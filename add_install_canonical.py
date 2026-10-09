with open('public/install.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add canonical link
content = content.replace(
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">',
    '<link rel="canonical" href="https://cnhservices.ca/install">\n    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">'
)

with open('public/install.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("install.html canonical added")