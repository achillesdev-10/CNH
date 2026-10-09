/**
 * CNH Service — PWA Environment Detection
 * Module partagé pour détecter l'environnement d'exécution de la PWA
 * Inclus dans index.html et install.html
 */

(function() {
    'use strict';

    // ── iOS Detection ──────────────────────────────────────────────
    // Inclut iPadOS qui se déclare "MacIntel" avec maxTouchPoints > 1
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // ── Safari iOS Detection ───────────────────────────────────────
    // Safari sur iOS a "Safari" dans l'UA mais pas "CriOS", "FxiOS", etc.
    var isSafariIOS = isIOS && /Safari/.test(navigator.userAgent) &&
                      !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);

    // ── Third-party Browser iOS Detection ──────────────────────────
    // Navigateurs tiers sur iOS (Chrome, Firefox, Edge, Opera, etc.)
    // À partir d'iOS 16.4, ils supportent l'ajout à l'écran d'accueil
    var isThirdPartyBrowserIOS = isIOS &&
        /CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);

    // ── In-App Browser Detection ───────────────────────────────────
    // Navigateurs intégrés (Facebook, Instagram, Messenger, etc.)
    // L'installation y est impossible, faut rediriger vers Safari
    var isInAppBrowser = false;
    var ua = navigator.userAgent || '';

    var inAppTokens = [
        'FBAN', 'FBAV', 'FB_IAB', 'FBIOS',           // Facebook
        'Instagram',                                 // Instagram
        'Messenger',                                 // Messenger
        'Snapchat',                                  // Snapchat
        'TikTok', 'musical_ly', 'Bytedance',         // TikTok
        'Line/',                                     // LINE
        'GSA/', 'GoogleApp',                         // Google App / GSA
        'MicroMessenger',                            // WeChat
        'Twitter', 'TwitterWebView',                 // Twitter/X
        'LinkedInApp',                               // LinkedIn
        'Pinterest',                                 // Pinterest
        'Reddit',                                    // Reddit
        'Discord',                                   // Discord
        'Telegram',                                  // Telegram
        'VK',                                        // VK
        'YaBrowser',                                 // Yandex
        'MIUI',                                      // Xiaomi
        'Huawei',                                    // Huawei
        'SamsungBrowser',                            // Samsung Browser (in-app)
    ];

    for (var i = 0; i < inAppTokens.length; i++) {
        if (ua.indexOf(inAppTokens[i]) !== -1) {
            isInAppBrowser = true;
            break;
        }
    }

    // Heuristique supplémentaire : iOS sans Safari/Chrome/Firefox/Edge = probablement in-app
    if (!isInAppBrowser && isIOS) {
        var knownBrowsers = /Safari|CriOS|FxiOS|OPiOS|EdgiOS/;
        if (!knownBrowsers.test(ua)) {
            isInAppBrowser = true;
        }
    }

    // ── Standalone/PWA Mode Detection ──────────────────────────────
    // Détecte si l'app tourne en mode installé (standalone)
    var isStandalone = false;
    try {
        var displayModes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];
        for (var i = 0; i < displayModes.length; i++) {
            if (window.matchMedia('(display-mode: ' + displayModes[i] + ')').matches) {
                isStandalone = true;
                break;
            }
        }
        // iOS < 16 : seule source fiable
        if (!isStandalone && navigator.standalone === true) {
            isStandalone = true;
        }
    } catch (e) {
        // Ignorer les erreurs matchMedia
    }

    // ── Export ─────────────────────────────────────────────────────
    window.PWAEnv = {
        isIOS: isIOS,
        isSafariIOS: isSafariIOS,
        isThirdPartyBrowserIOS: isThirdPartyBrowserIOS,
        isInAppBrowser: isInAppBrowser,
        isStandalone: isStandalone,
        userAgent: ua
    };

    // Debug en développement
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('[PWAEnv]', {
            isIOS: isIOS,
            isSafariIOS: isSafariIOS,
            isThirdPartyBrowserIOS: isThirdPartyBrowserIOS,
            isInAppBrowser: isInAppBrowser,
            isStandalone: isStandalone
        });
    }
})();