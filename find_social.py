with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the social links section
idx = content.find('document.querySelectorAll(\'a[href^="https://wa.me/"]\')')
if idx >= 0:
    print('Found at', idx)
    print(repr(content[idx:idx+500]))
else:
    print('Not found')
    # Try different search
    idx = content.find('wa.me')
    print('wa.me at:', idx)
    if idx >= 0:
        print(repr(content[idx:idx+200]))