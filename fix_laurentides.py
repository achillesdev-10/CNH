with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all remaining Laurentides with Rive-Sud
content = content.replace('les Laurentides', 'la Rive-Sud')
content = content.replace('Les Laurentides', 'La Rive-Sud')
content = content.replace('des Laurentides', 'de la Rive-Sud')
content = content.replace('Laurentides', 'Rive-Sud')

# Also fix the JSON-LD areaServed
content = content.replace('"areaServed": ["Grand MontrÃ©al","Rive-Sud"]', '"areaServed": ["Grand Montréal","Rive-Sud","Longueuil","Brossard","Saint-Lambert","Boucherville","Saint-Bruno-de-Montarville","La Prairie","Candiac","Chambly"]')

# Fix the hero text that was garbled
content = content.replace('chez vous, dans le Grand MontrÃ©al et les Rive-Sud', 'chez vous, dans le Grand Montréal et la Rive-Sud')
content = content.replace('Grand MontrÃ©al et les Rive-Sud', 'Grand Montréal et la Rive-Sud')
content = content.replace('Grand MontrÃ©al & Rive-Sud', 'Grand Montréal & Rive-Sud')
content = content.replace('Grand MontrÃ©al et la Rive-Sud', 'Grand Montréal et la Rive-Sud')

# Fix the garbled characters
content = content.replace('Ã©', 'é')
content = content.replace('Ã ', 'à')
content = content.replace('Ã§', 'ç')
content = content.replace('Ã´', 'ô')
content = content.replace('Ãª', 'ê')
content = content.replace('Ã»', 'û')
content = content.replace('Ã¨', 'è')
content = content.replace('Ã®', 'î')
content = content.replace('Ã¢', 'â')
content = content.replace('Ã¹', 'ù')
content = content.replace('Ã¯', 'ï')
content = content.replace('Ã¼', 'ü')
content = content.replace('Ã¶', 'ö')
content = content.replace('Ã¤', 'ä')
content = content.replace('Ã¬', 'ì')
content = content.replace('Ã²', 'ò')
content = content.replace('Ã¹', 'ù')

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done fixing Laurentides and garbled chars")