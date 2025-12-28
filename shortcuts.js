import {showMessageBox} from './utils.js';

const pageUrls = {
    home: './index.html', about: './about.html', games: './games.html',
    forms: './forms.html', users: './users.html', admin: './mod.html', privacy: './privacy.html'
};

const shortcuts = {h: 'home', a: 'about', g: 'games', f: 'forms', u: 'users', d: 'admin', k: 'search', '/': 'help'};

export function executeShortcut(key, showSearchModal, showHelpModal) {
    const url = pageUrls[key];
    if (url) return url.startsWith('http') ? window.open(url, '_blank') : (location.href = url);
    if (key === 'search' && typeof showSearchModal === 'function') showSearchModal();
    else if (key === 'help' && typeof showHelpModal === 'function') showHelpModal();
}

export function initShortcuts(showSearchModal, showHelpModal) {
    document.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea, select') || !e.ctrlKey || e.shiftKey || e.altKey) return;
        const action = shortcuts[e.key.toLowerCase()];
        if (action) { e.preventDefault(); executeShortcut(action, showSearchModal, showHelpModal); }
    });
}

export async function handleLogout() {
    try {
        const {auth} = await import('./firebase-init.js');
        if (auth?.currentUser) { await auth.signOut(); location.reload(); }
    } catch (e) { showMessageBox('Failed to logout', true); }
}