with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<div class="hp" aria-hidden="true"><label for="hp">Ne pas remplir</label><input type="text" id="hp" tabindex="-1" autocomplete="off"></div>'
new = '<div class="form-group"><label><input type="checkbox" id="c_consent" required> J\'accepte la <a href="/confidentialite">Politique de confidentialité</a> et le traitement de mes données *</label></div>\n                        <div class="hp" aria-hidden="true"><label for="hp">Ne pas remplir</label><input type="text" id="hp" tabindex="-1" autocomplete="off"></div>'

content = content.replace(old, new)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done contact form consent')