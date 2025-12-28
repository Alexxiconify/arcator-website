import {auth, getUserProfileFromFirestore, setUserProfileInFirestore} from "./firebase-init.js";
import {showMessageBox} from "./utils.js";
import {HARD_CODED_ADMIN_UID} from "./constants.js";
import {themeManager} from "./theme-manager.js";

const ASSETS = {
    DEFAULT_USER: './defaultuser.png',
    DEFAULT_HERO: './creativespawn.png'
};

const navbarHTML = `
<nav class="navbar">
    <div class="container navbar-content">
        <div class="flex items-center gap-4">
            <a href="./index.html" class="text-xl font-bold text-text hover:text-accent-light no-underline">Arcator</a>
            <div class="flex items-center gap-4">
                <a href="./index.html" class="nav-link">Home</a>
                <a href="./games.html" class="nav-link">Games</a>
                <a href="./forms.html" class="nav-link">Forms</a>
                <a href="./pages.html" class="nav-link">Pages</a>
                <a href="./about.html" class="nav-link">About</a>
                <a href="./mod.html" class="nav-link">Admin</a>
            </div>
        </div>
        <div id="user-section" class="flex items-center gap-4"></div>
    </div>
</nav>`;

const footerHTML = `
<footer class="footer bg-surface mt-auto">
    <div class="container py-4">
        <div class="flex justify-between items-center">
            <div class="flex gap-4">
                <a href="https://bluemaps.arcator.co.uk" class="footer-link" target="_blank" rel="noopener">Blue Maps</a>
                <a href="https://wiki.arcator.co.uk" class="footer-link" target="_blank" rel="noopener">Wiki</a>
            </div>
            <div class="text-text-2">&copy; ${new Date().getFullYear()} Arcator</div>
        </div>
    </div>
</footer>`;

const getElement = (id) => document.getElementById(id);

let currentNavbarUnsubscribe = null;

// Render skeleton placeholders on load
function renderSkeletons() {
    const navbar = getElement('navbar-placeholder');
    const footer = getElement('footer-placeholder');
    if (navbar) navbar.innerHTML = navbarHTML.replace('</div>\n</nav>', '<div class="sign-in-prompt">Loading…</div></div>\n</nav>');
    if (footer) footer.innerHTML = footerHTML;
}

// Ensure main content fills viewport
function ensureContentFills() {
    const content = document.querySelector('body > main') ||
        Array.from(document.body.children).find(el =>
            el.id !== 'navbar-placeholder' && el.id !== 'footer-placeholder' &&
            (el.tagName === 'MAIN' || el.classList.contains('page') || el.classList.contains('container'))
        );
    if (content) {
        content.style.flex = '1 0 auto';
        content.style.minHeight = '0';
    }
}

// Sticky footer when content is short
function adjustFooterPosition() {
    const footer = getElement('footer-placeholder')?.querySelector('.footer') || document.querySelector('.footer');
    if (!footer) return;

    const isShort = document.documentElement.scrollHeight <= window.innerHeight;
    const main = document.querySelector('body > main, .container') || document.body;
    const zIndex = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-index-navbar')) || 100;

    if (isShort) {
        Object.assign(footer.style, {position: 'fixed', bottom: '0', left: '0', right: '0', width: '100%', zIndex: zIndex - 1});
        if (main) main.style.paddingBottom = 'calc(var(--footer-height) + 1rem)';
    } else {
        Object.assign(footer.style, {position: '', bottom: '', left: '', right: '', width: '', zIndex: ''});
        if (main) main.style.paddingBottom = '';
    }
}

// Initialize observers and listeners
window.addEventListener('resize', adjustFooterPosition);
new MutationObserver(adjustFooterPosition).observe(document.body, {childList: true, subtree: true});
new MutationObserver(ensureContentFills).observe(document.body, {childList: true, subtree: true});

// Initial render
renderSkeletons();
ensureContentFills();
adjustFooterPosition();

export async function loadUserProfile(userId) {
    if (!userId) return null;
    try {
        let profile = await getUserProfileFromFirestore(userId);
        if (!profile) {
            profile = {
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                isAdmin: userId === HARD_CODED_ADMIN_UID,
                themePreference: 'dark'
            };
            await setUserProfileInFirestore(userId, profile);
        }
        return profile;
    } catch (err) {
        console.warn('loadUserProfile error', err);
        return null;
    }
}

export async function loadNavbar(user, userProfile) {
    const navbar = getElement('navbar-placeholder');
    if (!navbar) return;

    navbar.innerHTML = navbarHTML;
    const userSection = getElement('user-section');
    if (!userSection) return;

    if (user) {
        const photoURL = userProfile?.photoURL || user.photoURL || ASSETS.DEFAULT_USER;
        const displayName = userProfile?.displayName || user.displayName || user.email || 'User';
        userSection.innerHTML = `
            <div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition" onclick="location.href='./users.html'">
                <img src="${photoURL}" alt="Profile" class="profile-image">
                <span class="text-text text-sm font-medium">${displayName}</span>
            </div>`;
    } else {
        userSection.innerHTML = `<a href="./users.html" class="btn-primary">Sign In</a>`;
    }

    // Highlight current page
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    navbar.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('nav-link-active', link.getAttribute('href')?.replace('./', '') === currentPage);
    });
}

export function loadFooter() {
    const footer = getElement('footer-placeholder');
    if (footer) footer.innerHTML = footerHTML;
}

export async function initializePage(pageName, requireAuth = false) {
    try {
        await themeManager.init();

        if (currentNavbarUnsubscribe) {
            currentNavbarUnsubscribe();
            currentNavbarUnsubscribe = null;
        }

        const user = await new Promise(resolve => {
            const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
        });

        if (requireAuth && !user) {
            showMessageBox('This page requires sign-in. Please sign in to continue.', true);
            return false;
        }

        const userProfile = user ? await loadUserProfile(user.uid) : null;
        await loadNavbar(user, userProfile);

        if (user) {
            currentNavbarUnsubscribe = auth.onAuthStateChanged(async u => {
                await loadNavbar(u, u ? await loadUserProfile(u.uid) : null);
            });
        }

        console.log(`Page ${pageName} initialized`);
        return true;
    } catch (err) {
        console.error('initializePage error', err);
        showMessageBox('Failed to initialize page', true);
        return false;
    }
}