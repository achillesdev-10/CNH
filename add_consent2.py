with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<div class="hp" aria-hidden="true"><label for="hpReview">Ne pas remplir</label><input type="text" id="hpReview" tabindex="-1" autocomplete="off"></div>'
new = '<div class="form-group"><label><input type="checkbox" id="t_consent" required> J\'accepte la <a href="/confidentialite">Politique de confidentialité</a> et la publication de mon avis *</label></div>\n                    <div class="hp" aria-hidden="true"><label for="hpReview">Ne pas remplir</label><input type="text" id="hpReview" tabindex="-1" autocomplete="off"></div>'

content = content.replace(old, new)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done review form consent')