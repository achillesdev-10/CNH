with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and update the WhatsApp/social links section
old = '''document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function(a){ a.href = waUrl; });'''
new = '''document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function(a){ a.href = waUrl; });
            // Update Facebook link
            var fbUrl = s.facebook_url || 'https://web.facebook.com/cnhservices';
            document.querySelectorAll('a[href^="https://facebook.com"], a[href^="https://web.facebook.com"]').forEach(function(a){
                a.href = fbUrl;
            });
            // Update Instagram link (hide if empty)
            var igUrl = s.instagram_url || '';
            var igLinks = document.querySelectorAll('a[href^="https://instagram.com"], a[href^="https://www.instagram.com"]');
            if (igUrl) {
                igLinks.forEach(function(a){ a.href = igUrl; a.style.display = ''; });
            } else {
                igLinks.forEach(function(a){ a.style.display = 'none'; });
            }'''

content = content.replace(old, new)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')