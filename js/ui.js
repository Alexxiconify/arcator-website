/* UI Utilities for Arcator */

export const updateTheme = (t = 'dark', f = 'normal', css = '', bg = '', gc = '', go = 0.95, gb = '') => {
    const r = document.documentElement;
    r.dataset.theme = t; 
    r.dataset.fontSize = f;
    
    document.body.style.backgroundImage = bg ? `url('${bg}')` : '';
    
    if (gc && go) {
        const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(gc);
        if (rgb) {
            r.style.setProperty('--glass-bg', `rgba(${Number.parseInt(rgb[1], 16)}, ${Number.parseInt(rgb[2], 16)}, ${Number.parseInt(rgb[3], 16)}, ${go})`);
        }
    } else {
        r.style.removeProperty('--glass-bg');
    }

    let s = document.getElementById('custom-css-style');
    if (!s) {
        s = document.createElement('style');
        s.id = 'custom-css-style';
        document.head.appendChild(s);
    }
    s.textContent = (css || '') + (gb ? `
        .glass-card, .card, .sidebar, .modal-content { backdrop-filter: blur(${gb}px) !important; }
        body::before { backdrop-filter: blur(${Math.max(0, gb - 5)}px) !important; }
    ` : '');
};

export const cacheUser = (u, p) => {
    localStorage.setItem('arcator_user_cache', JSON.stringify({
        uid: u.uid,
        displayName: p?.displayName || u.displayName,
        photoURL: p?.photoURL || u.photoURL,
        themePreference: p?.themePreference || 'dark',
        fontScaling: p?.fontScaling || 'normal',
        backgroundImage: p?.backgroundImage,
        glassColor: p?.glassColor,
        glassOpacity: p?.glassOpacity,
        glassBlur: p?.glassBlur
    }));
};
