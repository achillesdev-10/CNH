with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# C1: Add mobile action bar (C1) - replaces floating buttons on mobile
# Add the mobile action bar HTML before the closing body tag
mobile_action_bar = '''
    <!-- Barre d'action mobile fixe (C1) -->
    <div class="mobile-action-bar" id="mobileActionBar" role="toolbar" aria-label="Actions principales">
        <a href="/reservation" class="mobile-action-btn primary" aria-label="R\u00e9server un lavage">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>R\u00e9server</span>
        </a>
        <a href="https://wa.me/14502302509?text=Bonjour%20CNH%20Service%2C%20je%20souhaite%20un%20devis%20pour%20un%20lavage%20auto." target="_blank" rel="noopener" class="mobile-action-btn" aria-label="WhatsApp">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>WhatsApp</span>
        </a>
        <a href="tel:+14502302509" class="mobile-action-btn" aria-label="Appeler">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 0 3.33.82 12.84 12.84 0 0 0 2.81-.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Appeler</span>
        </a>
    </div>'''

# Add the mobile action bar HTML before </body>
content = content.replace('</body>', mobile_action_bar + '\n</body>')

# Add CSS for mobile action bar
mobile_action_css = '''
    /* Barre d'action mobile fixe (C1) */
    .mobile-action-bar {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        background: rgba(255,255,255,.98);
        backdrop-filter: blur(20px) saturate(180%);
        border-top: 1px solid var(--gray-200);
        padding: calc(8px + env(safe-area-inset-bottom,0px)) env(safe-area-inset-right,0px) calc(8px + env(safe-area-inset-bottom,0px)) env(safe-area-inset-left,0px);
        box-shadow: 0 -4px 20px rgba(0,0,0,.08);
    }

    @media (max-width: 767px) {
        .mobile-action-bar {
            display: flex;
            justify-content: space-around;
            align-items: center;
        }
        /* Masquer les boutons flottants sur mobile */
        .whatsapp-float,
        .install-float,
        .back-to-top {
            display: none !important;
        }
    }

    .mobile-action-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        color: var(--slate);
        text-decoration: none;
        font-size: .7rem;
        font-weight: 600;
        border-radius: 10px;
        transition: all .2s ease;
        min-width: 64px;
    }

    .mobile-action-btn:hover,
    .mobile-action-btn:focus {
        color: var(--blue);
        background: var(--blue-light);
        transform: translateY(-2px);
    }

    .mobile-action-btn.primary {
        color: var(--white);
        background: linear-gradient(135deg, var(--blue), var(--blue-dark));
    }

    .mobile-action-btn.primary:hover,
    .mobile-action-btn.primary:focus {
        color: var(--white);
        background: linear-gradient(135deg, var(--blue-dark), var(--blue-deeper));
        transform: translateY(-2px);
    }

    .mobile-action-btn svg {
        width: 22px;
        height: 22px;
    }

    /* Masquer les boutons flottants sur mobile */
    @media (max-width: 767px) {
        .mobile-action-bar {
            display: flex;
            justify-content: space-around;
            align-items: center;
        }
        .whatsapp-float,
        .install-float,
        .back-to-top {
            display: none !important;
        }
    }

    .mobile-action-btn:hover,
    .mobile-action-btn:focus {
        color: var(--blue);
        background: var(--blue-light);
        transform: translateY(-2px);
    }

    .mobile-action-btn.primary:hover,
    .mobile-action-btn.primary:focus {
        color: var(--white);
        background: linear-gradient(135deg, var(--blue-dark), var(--blue-deeper));
        transform: translateY(-2px);
    }

    .mobile-action-btn svg {
        width: 22px;
        height: 22px;
    }

    @media (min-width: 768px) {
        .install-float {
            display: none !important;
        }
    }'''

# Add CSS before prefers-reduced-motion
content = content.replace(
    '@media (prefers-reduced-motion: reduce) {',
    mobile_action_css + '\n\n@media (prefers-reduced-motion: reduce) {'
)

# Add mobile action bar HTML before </body>
content = content.replace('</body>', mobile_action_bar + '\n</body>')

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("C1: Mobile action bar added")