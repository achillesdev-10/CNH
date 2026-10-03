with open('public/install.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire script section with enhanced version using PWAEnv
old_script = '''    <script>
    (function() {
        var ua = navigator.userAgent || '';
        var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var isAndroid = /Android/.test(ua);
        var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone === true;'''

new_script = '''    <script>
    (function() {
        // Utiliser PWAEnv pour la détection d'environnement
        var isIOS = window.PWAEnv && window.PWAEnv.isIOS;
        var isSafariIOS = window.PWAEnv && window.PWAEnv.isSafariIOS;
        var isThirdPartyBrowserIOS = window.PWAEnv && window.PWAEnv.isThirdPartyBrowserIOS;
        var isInAppBrowser = window.PWAEnv && window.PWAEnv.isInAppBrowser;
        var isStandalone = window.PWAEnv && window.PWAEnv.isStandalone;
        var isAndroid = /Android/.test(navigator.userAgent || '');'''

content = content.replace(old_script, new_script)

# Update the standalone detection to use PWAEnv
old_standalone = '''        // Application déjà installée (mode standalone) : message dédié, pas d'appel insistant.
        if (isStandalone) {'''

new_standalone = '''        // Application déjà installée (mode standalone) : message dédié, pas d'appel insistant.
        // isStandalone vient de PWAEnv (détecte standalone, minimal-ui, fullscreen, window-controls-overlay, navigator.standalone)
        if (isStandalone) {'''

content = content.replace(old_standalone, new_standalone)

# Add in-app browser panel logic
# Find the section where iOS/Android/desktop cards are highlighted
old_highlight = '''        // Mise en avant de la carte correspondant à l'appareil détecté.
        if (isIOS) {
            document.getElementById('iosCard').style.borderColor = 'rgba(125,211,252,.55)';
            document.getElementById('iosCard').style.background = 'rgba(14,165,233,.1)';
        } else if (isAndroid) {
            document.getElementById('androidCard').style.borderColor = 'rgba(52,211,153,.55)';
            document.getElementById('androidCard').style.background = 'rgba(16,185,129,.08)';
        } else {
            document.getElementById('desktopCard').style.borderColor = 'rgba(125,211,252,.55)';
        }'''

new_highlight = '''        // ── Panneau "Ouvrez dans Safari" pour navigateurs in-app ─────────────
        // Si on est dans un navigateur in-app (Facebook, Instagram, etc.), afficher un panneau
        // spécial au lieu des étapes normales
        var inAppPanel = null;
        function showInAppPanel() {
            if (inAppPanel) return;
            var panel = document.createElement('div');
            panel.id = 'inAppPanel';
            panel.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:#0f172a;color:#fff;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,.3);border-bottom:1px solid rgba(14,165,233,.3)';
            panel.innerHTML = '<div style="max-width:680px;margin:0 auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
                '<div style="flex:1;min-width:200px"><strong>Ouvrez dans Safari pour installer</strong><br>' +
                '<small>Vous êtes dans une application (Facebook, Instagram, etc.) où l\'installation est impossible.</small></div>' +
                '<button id="copyLinkBtn" style="background:#0ea5e9;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer">Copier le lien</button>' +
                '<button id="closeInAppPanel" style="background:rgba(255,255,255,.1);color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer">Fermer</button>' +
                '</div>';
            document.body.insertBefore(panel, document.body.firstChild);
            inAppPanel = panel;

            // Copier le lien
            document.getElementById('copyLinkBtn').addEventListener('click', function() {
                var url = 'https://cnhservices.ca/install';
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(function() {
                        alert('Lien copié ! Ouvrez Safari et collez-le dans la barre d\'adresse.');
                    });
                } else {
                    // Fallback
                    prompt('Copiez ce lien et ouvrez-le dans Safari :', url);
                }
            });

            // Fermer le panneau
            document.getElementById('closeInAppPanel').addEventListener('click', function() {
                if (inAppPanel) {
                    inAppPanel.remove();
                    inAppPanel = null;
                }
            });
        }

        // ── Détection et affichage selon l'environnement ────────────────────
        var isInAppBrowser = window.PWAEnv && window.PWAEnv.isInAppBrowser;
        var isSafariIOS = window.PWAEnv && window.PWAEnv.isSafariIOS;
        var isThirdPartyBrowserIOS = window.PWAEnv && window.PWAEnv.isThirdPartyBrowserIOS;'''

content = content.replace(old_highlight, new_highlight)

# Update the iOS/Android/desktop highlighting logic
old_device_highlight = '''        // Mise en avant de la carte correspondant à l'appareil détecté.
        if (isIOS) {
            document.getElementById('iosCard').style.borderColor = 'rgba(125,211,252,.55)';
            document.getElementById('iosCard').style.background = 'rgba(14,165,233,.1)';
        } else if (isAndroid) {
            document.getElementById('androidCard').style.borderColor = 'rgba(52,211,153,.55)';
            document.getElementById('androidCard').style.background = 'rgba(16,185,129,.08)';
        } else {
            document.getElementById('desktopCard').style.borderColor = 'rgba(125,211,252,.55)';
        }'''

new_device_highlight = '''        // Affichage conditionnel selon l'environnement
        if (isInAppBrowser) {
            // Navigateur in-app : afficher le panneau "Ouvrez dans Safari"
            showInAppPanel();
            // Masquer les cartes normales, afficher un message
            document.getElementById('iosCard').style.display = 'none';
            document.getElementById('androidCard').style.display = 'none';
            document.getElementById('desktopCard').style.display = 'none';
        } else if (isIOS) {
            document.getElementById('iosCard').style.borderColor = 'rgba(125,211,252,.55)';
            document.getElementById('iosCard').style.background = 'rgba(14,165,233,.1)';
            document.getElementById('androidCard').style.display = 'none';
            document.getElementById('desktopCard').style.display = 'none';
        } else if (isAndroid) {
            document.getElementById('androidCard').style.borderColor = 'rgba(52,211,153,.55)';
            document.getElementById('androidCard').style.background = 'rgba(16,185,129,.08)';
            document.getElementById('iosCard').style.display = 'none';
            document.getElementById('desktopCard').style.display = 'none';
        } else {
            document.getElementById('desktopCard').style.borderColor = 'rgba(125,211,252,.55)';
            document.getElementById('iosCard').style.display = 'none';
            document.getElementById('androidCard').style.display = 'none';
        }'''

content = content.replace(old_device_highlight, new_device_highlight)

with open('public/install.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("install.html A3/A4 updates applied")