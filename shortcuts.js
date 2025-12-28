import {showMessageBox} from './utils.js';


const pageUrls = {
    home: './index.html',
    about: './about.html',
    games: './games.html',
    forms: './forms.html',
    users: './users.html',
    admin: './mod.html',
    privacy: './privacy.html',
    logout: '#',
    search: '#',
    help: '#'
};


export function executeShortcut(shortcutKey, showSearchModal, showHelpModal) {
    const url = pageUrls[shortcutKey];

    if (url && url !== "#") {
        if (url.startsWith("http")) {
            window.open(url, "_blank");
        } else {
            window.location.href = url;
        }
    } else {
        switch (shortcutKey) {
            case "search":
                if (typeof showSearchModal === 'function') showSearchModal();
                break;
            case "help":
                if (typeof showHelpModal === 'function') showHelpModal();
                break;
        }
    }
}

async function handleLogout() {
    try {
        const {auth} = await import('./firebase-init.js');
        if (auth?.currentUser) {
            await auth.signOut();
            window.location.reload();
        }
    } catch (error) {
        console.error('Logout failed:', error);
        showMessageBox('Failed to logout. Please try again.', true);
    }
}


export function initShortcuts() {
    document.addEventListener('keydown', (e) => {

        if (e.target.matches('input, textarea, select')) return;

        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            switch (e.key.toLowerCase()) {
                case 'h': // Home
                    e.preventDefault();
                    executeShortcut('home');
                    break;
                case 'a': // About
                    e.preventDefault();
                    executeShortcut('about');
                    break;
                case 'g': // Games
                    e.preventDefault();
                    executeShortcut('games');
                    break;
                case 'f': // Forms
                    e.preventDefault();
                    executeShortcut('forms');
                    break;
                case 'u': // Users
                    e.preventDefault();
                    executeShortcut('users');
                    break;
                case 'd': // Admin
                    e.preventDefault();
                    executeShortcut('admin');
                    break;
                case 'k': // Search
                    e.preventDefault();
                    executeShortcut('search');
                    break;
                case '/': // Help
                    e.preventDefault();
                    executeShortcut('help');
                    break;
            }
        }
    });
}