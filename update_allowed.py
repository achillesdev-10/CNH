with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "ALLOWED_SETTINGS = ['email', 'phone', 'whatsapp', 'hours', 'address', 'welcome_msg', 'site_title', 'time_slots', 'service_cities'];"
new = "ALLOWED_SETTINGS = ['email', 'phone', 'whatsapp', 'hours', 'address', 'welcome_msg', 'site_title', 'time_slots', 'service_cities', 'facebook_url', 'instagram_url'];"

content = content.replace(old, new)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')