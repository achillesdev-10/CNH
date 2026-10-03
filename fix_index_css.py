with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix B1: Hero section - change min-height:100vh to min-height:100svh, add padding-top with safe-area
content = content.replace(
    '.hero{min-height:100vh;background:linear-gradient(155deg,#0b1220 0%,#0c2c47 48%,#075985 100%);display:flex;align-items:center;text-align:center;color:var(--white);position:relative;overflow:hidden}',
    '.hero{min-height:100svh;background:linear-gradient(155deg,#0b1220 0%,#0c2c47 48%,#075985 100%);display:flex;align-items:center;text-align:center;color:var(--white);position:relative;overflow:hidden;padding-top:calc(var(--header-height, 70px) + env(safe-area-inset-top,0px) + 24px)}'
)

# Add CSS variable for header height (to be set by JS)
# We'll add this to the :root section

# Fix B3: Hero stats - limit to 4, show only if > 0, horizontal scroll
# This requires HTML changes, will do separately

# Fix B5: Add .js class fallback for reveal animations
# Add noscript fallback styles

# Add prefers-reduced-motion media query
prefers_reduced = '''
@media (prefers-reduced-motion: reduce) {
  .reveal, .reveal-left, .reveal-right, .reveal-scale,
  .loader, .hero-float, .pulse-wa, .spin,
  [style*="animation"], [style*="transition"] {
    animation: none !important;
    transition: none !important;
  }
  .reveal, .reveal-left, .reveal-right, .reveal-scale {
    opacity: 1 !important;
    transform: none !important;
  }
  .hero-stat strong, .animate-num {
    animation: none !important;
  }
}'''

# Add to the end of the style block
content = content.replace(
    '@media(max-width:480px){.hero-stats{gap:12px}.hero-stat{flex-basis:calc(50% - 6px);max-width:none;padding:14px}.hero-stat strong{font-size:1.6rem}.services-grid,.pricing-grid{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.form-row{grid-template-columns:1fr}.testimonials-grid{grid-template-columns:1fr}}',
    '@media(max-width:480px){.hero-stats{gap:12px}.hero-stat{flex-basis:calc(50% - 6px);max-width:none;padding:14px}.hero-stat strong{font-size:1.6rem}.services-grid,.pricing-grid{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.form-row{grid-template-columns:1fr}.testimonials-grid{grid-template-columns:1fr}}' + prefers_reduced
)

# Add .js class fallback for reveal animations
content = content.replace(
    '.reveal{opacity:0;transform:translateY(40px);transition:all .7s cubic-bezier(.4,0,.2,1)}',
    '.js .reveal{opacity:0;transform:translateY(40px);transition:all .7s cubic-bezier(.4,0,.2,1)}'
)
content = content.replace(
    '.reveal-left{opacity:0;transform:translateX(-40px);transition:all .7s cubic-bezier(.4,0,.2,1)}',
    '.js .reveal-left{opacity:0;transform:translateX(-40px);transition:all .7s cubic-bezier(.4,0,.2,1)}'
)
content = content.replace(
    '.reveal-right{opacity:0;transform:translateX(40px);transition:all .7s cubic-bezier(.4,0,.2,1)}',
    '.js .reveal-right{opacity:0;transform:translateX(40px);transition:all .7s cubic-bezier(.4,0,.2,1)}'
)
content = content.replace(
    '.reveal-scale{opacity:0;transform:scale(.9);transition:all .7s cubic-bezier(.4,0,.2,1)}',
    '.js .reveal-scale{opacity:0;transform:scale(.9);transition:all .7s cubic-bezier(.4,0,.2,1)}'
)

# Add noscript fallback
noscript_style = '''
<noscript>
<style>
  .reveal, .reveal-left, .reveal-right, .reveal-scale { opacity: 1 !important; transform: none !important; transition: none !important; }
  .loader { display: none !important; }
  .js-only { display: none !important; }
  .no-js { display: block !important; }
</style>
</noscript>'''

content = content.replace('</head>', noscript_style + '\n</head>')

# Add header height CSS variable
content = content.replace(
    ':root{--blue:#0ea5e9;--blue-dark:#0284c7;--blue-deeper:#0369a1;--blue-light:#e0f2fe;--navy:#0f172a;--slate:#1e293b;--slate-light:#334155;--gray-100:#f1f5f9;--gray-200:#e2e8f0;--gray-300:#cbd5e1;--gray-400:#94a3b8;--gray-500:#64748b;--white:#fff;--green:#10b981;--green-dark:#059669;--red:#ef4444;--amber:#f59e0b;--shadow-sm:0 1px 3px rgba(0,0,0,.08);--shadow-md:0 4px 12px rgba(0,0,0,.1);--shadow-lg:0 10px 30px rgba(0,0,0,.12);--shadow-xl:0 20px 50px rgba(0,0,0,.15);--radius:12px;--radius-lg:16px;--transition:.3s cubic-bezier(.4,0,.2,1)}',
    ':root{--blue:#0ea5e9;--blue-dark:#0284c7;--blue-deeper:#0369a1;--blue-light:#e0f2fe;--navy:#0f172a;--slate:#1e293b;--slate-light:#334155;--gray-100:#f1f5f9;--gray-200:#e2e8f0;--gray-300:#cbd5e1;--gray-400:#94a3b8;--gray-500:#64748b;--white:#fff;--green:#10b981;--green-dark:#059669;--red:#ef4444;--amber:#f59e0b;--shadow-sm:0 1px 3px rgba(0,0,0,.08);--shadow-md:0 4px 12px rgba(0,0,0,.1);--shadow-lg:0 10px 30px rgba(0,0,0,.12);--shadow-xl:0 20px 50px rgba(0,0,0,.15);--radius:12px;--radius-lg:16px;--transition:.3s cubic-bezier(.4,0,.2,1);--header-height:70px;--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);--safe-left:env(safe-area-inset-left,0px);--safe-right:env(safe-area-inset-right,0px)}'
)

# Update hero content padding to use CSS variable
content = content.replace(
    '.hero-content{position:relative;z-index:1;padding:120px 0 60px}',
    '.hero-content{position:relative;z-index:1;padding:calc(var(--header-height, 70px) + var(--safe-top) + 24px) 0 60px}'
)

# Remove the 800ms loader delay and make it conditional
content = content.replace(
    'setTimeout(function(){ document.getElementById(\'loader\').classList.add(\'hidden\'); }, 800);',
    'if(document.readyState === "complete"){ document.getElementById("loader").classList.add("hidden"); } else { window.addEventListener("load", function(){ document.getElementById("loader").classList.add("hidden"); }); }'
)

# Add header height calculation in JS
header_height_js = '''
        // ── Header height for CSS variable ──
        function updateHeaderHeight(){
            var header = document.getElementById("header");
            if(header){
                document.documentElement.style.setProperty("--header-height", header.offsetHeight + "px");
            }
        }
        updateHeaderHeight();
        window.addEventListener("resize", updateHeaderHeight);
        window.addEventListener("scroll", updateHeaderHeight);
'''

content = content.replace(
    'document.getElementById(\'currentYear\').textContent = new Date().getFullYear();',
    'document.getElementById(\'currentYear\').textContent = new Date().getFullYear();' + header_height_js
)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("CSS/JS updates applied")