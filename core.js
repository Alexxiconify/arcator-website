<<<<<<< HEAD
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


function renderNavbarSkeleton() {
    try {
        const navbar = document.getElementById('navbar-placeholder');
        if (!navbar) return;

        navbar.innerHTML = `
            <nav class="navbar">
                <div class="container navbar-content">
                    <div class="flex items-center gap-4">
                        <a href="./index.html" class="text-xl font-bold no-underline">Arcator</a>
                        <div class="flex items-center gap-4">
                            <a href="./index.html" class="nav-link">Home</a>
                            <a href="./games.html" class="nav-link">Games</a>
                            <a href="./forms.html" class="nav-link">Forms</a>
                            <a href="./pages.html" class="nav-link">Pages</a>
                            <a href="./about.html" class="nav-link">About</a>
                            <a href="./mod.html" class="nav-link">Admin</a>
                        </div>
                    </div>
                    <div id="user-section" class="flex items-center gap-4">
                        <div class="sign-in-prompt">Loading…</div>
                    </div>
                </div>
            </nav>`;
    } catch (err) {

        console.warn('Failed to render navbar skeleton', err);
    }
}

function renderFooterSkeleton() {
    try {
        const footer = document.getElementById('footer-placeholder');
        if (!footer) return;
        footer.innerHTML = `
            <footer class="footer bg-surface">
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
    } catch (err) {
        console.warn('Failed to render footer skeleton', err);
    }
}


function ensureContentFills() {
    try {

        let content = document.querySelector('body > main');
        if (!content) {

            const children = Array.from(document.body.children).filter(el => el.id !== 'navbar-placeholder' && el.id !== 'footer-placeholder');

            content = children.find(el => el.tagName.toLowerCase() === 'main' || el.classList.contains('page') || el.classList.contains('container')) || children[0];
        }
        if (content) {
            content.style.flex = '1 0 auto';
            content.style.minHeight = '0';
        }
    } catch (err) {
        console.warn('ensureContentFills failed', err);
    }
}


function watchForContentChanges() {
    try {
        const observer = new MutationObserver(() => {
            ensureContentFills();
        });
        observer.observe(document.body, {childList: true, subtree: true});


        window.addEventListener('DOMContentLoaded', () => {
            ensureContentFills();
        });
    } catch (err) {
        console.warn('watchForContentChanges failed', err);
    }
}


function adjustFooterPosition() {
    try {

        const footerPlaceholder = document.getElementById('footer-placeholder');
        const footer = footerPlaceholder?.querySelector('.footer') || document.querySelector('.footer');
        if (!footer) return;

        const bodyHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const main = document.querySelector('body > main') || document.querySelector('.container') || document.body;

        if (bodyHeight <= viewportHeight) {

            footer.style.position = 'fixed';
            footer.style.bottom = '0';
            footer.style.left = '0';
            footer.style.right = '0';
            footer.style.width = '100%';
            footer.style.zIndex = String((Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-index-navbar')) || 100) - 1);

            if (main) main.style.paddingBottom = `calc(var(--footer-height) + 1rem)`;
        } else {

            footer.style.position = '';
            footer.style.bottom = '';
            footer.style.left = '';
            footer.style.right = '';
            footer.style.width = '';
            footer.style.zIndex = '';
            if (main) main.style.paddingBottom = '';
        }
    } catch (err) {
        console.warn('adjustFooterPosition failed', err);
    }
}


window.addEventListener('resize', () => adjustFooterPosition());


const footerObserver = new MutationObserver(() => adjustFooterPosition());
footerObserver.observe(document.body, {childList: true, subtree: true});


adjustFooterPosition();


renderNavbarSkeleton();
renderFooterSkeleton();
ensureContentFills();
watchForContentChanges();

let currentNavbarUnsubscribe = null;

function getElement(id) {
    return document.getElementById(id);
}


export async function loadUserProfile(userId) {
    if (!userId) return null;
    try {

        const profile = await getUserProfileFromFirestore(userId);
        if (profile) return profile;


        const defaultProfile = {
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isAdmin: userId === HARD_CODED_ADMIN_UID,
            themePreference: 'dark'
        };
        await setUserProfileInFirestore(userId, defaultProfile);
        return await getUserProfileFromFirestore(userId);
    } catch (err) {
        console.warn('loadUserProfile error', err);
        return null;
    }
}


function onAuthStateChanged(user) {
    const userSection = getElement('user-section');
    if (!userSection) return;

    userSection.innerHTML = ''; // Clear previous content

    if (user) {

        const {uid, displayName, photoURL} = user;


        const isAdmin = uid === HARD_CODED_ADMIN_UID;

        const adminLink = isAdmin ? `<a href="./mod.html" class="nav-link">Admin</a>` : '';

        userSection.innerHTML = `
            <div class="flex items-center gap-4">
                <a href="./profile.html" class="flex items-center gap-2 no-underline">
                    <img src="${photoURL || ASSETS.DEFAULT_USER}" alt="${displayName}'s avatar" class="w-8 h-8 rounded-full">
                    <span class="text-text">${displayName || 'User'}</span>
                </a>
                ${adminLink}
                <button id="sign-out-btn" class="btn btn-primary">Sign Out</button>
            </div>
        `;


        document.getElementById('sign-out-btn').addEventListener('click', async () => {
            try {
                await auth.signOut();
                showMessageBox('Signed out successfully', 'info');
            } catch (err) {
                showMessageBox('Sign out failed: ' + err.message, 'error');
            }
        });
    } else {

        userSection.innerHTML = `
            <a href="./users.html" class="btn btn-primary">Sign In</a>
        `;
    }
}


async function initApp() {
    try {

        renderNavbarSkeleton();
        renderFooterSkeleton();


        ensureContentFills();


        watchForContentChanges();


        auth.onAuthStateChanged(onAuthStateChanged);


        const preloadedImages = [ASSETS.DEFAULT_USER, ASSETS.DEFAULT_HERO];
        preloadedImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });


        document.getElementById('navbar-placeholder').innerHTML = navbarHTML;
        document.getElementById('footer-placeholder').innerHTML = footerHTML;


        ensureContentFills();
    } catch (err) {
        console.warn('initApp failed', err);
    }
}


export async function loadNavbar(user, userProfile) {
    const navbar = getElement('navbar-placeholder');
    if (!navbar) return;

    navbar.innerHTML = navbarHTML;

    const userSection = document.getElementById('user-section');
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


    const currentPage = globalThis.location.pathname.split('/').pop() || 'index.html';
    navbar.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href').replace('./', '') === currentPage) {
            link.classList.add('nav-link-active');
        } else {
            link.classList.remove('nav-link-active');
        }
    });
}

export function loadFooter() {
    const footer = getElement('footer-placeholder');
    if (!footer) return;
    footer.innerHTML = footerHTML;
}

export async function initializePage(pageName, requireAuth = false) {
    try {
        await themeManager.init();

        if (currentNavbarUnsubscribe) {
            currentNavbarUnsubscribe();
            currentNavbarUnsubscribe = null;
        }

        const user = await new Promise(resolve => {
            const unsubscribe = auth.onAuthStateChanged(u => {
                unsubscribe();
                resolve(u);
            });
        });

        if (requireAuth && !user) {

            showMessageBox('This page requires sign-in. Please sign in to continue.', true);
            return false;
        }

        const userProfile = user ? await loadUserProfile(user.uid) : null;
        await loadNavbar(user, userProfile);

        if (user) {
            currentNavbarUnsubscribe = auth.onAuthStateChanged(async u => {
                const profile = u ? await loadUserProfile(u.uid) : null;
                await loadNavbar(u, profile);
            });
        }

        console.log(`Page ${pageName} initialized successfully`);
        return true;
    } catch (err) {
        console.error('initializePage error', err);
        showMessageBox('Failed to initialize page', true);
        return false;
    }
=======
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


function renderNavbarSkeleton() {
    try {
        const navbar = document.getElementById('navbar-placeholder');
        if (!navbar) return;

        navbar.innerHTML = `
            <nav class="navbar">
                <div class="container navbar-content">
                    <div class="flex items-center gap-4">
                        <a href="./index.html" class="text-xl font-bold no-underline">Arcator</a>
                        <div class="flex items-center gap-4">
                            <a href="./index.html" class="nav-link">Home</a>
                            <a href="./games.html" class="nav-link">Games</a>
                            <a href="./forms.html" class="nav-link">Forms</a>
                            <a href="./pages.html" class="nav-link">Pages</a>
                            <a href="./about.html" class="nav-link">About</a>
                            <a href="./mod.html" class="nav-link">Admin</a>
                        </div>
                    </div>
                    <div id="user-section" class="flex items-center gap-4">
                        <div class="sign-in-prompt">Loading…</div>
                    </div>
                </div>
            </nav>`;
    } catch (err) {

        console.warn('Failed to render navbar skeleton', err);
    }
}

function renderFooterSkeleton() {
    try {
        const footer = document.getElementById('footer-placeholder');
        if (!footer) return;
        footer.innerHTML = `
            <footer class="footer bg-surface">
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
    } catch (err) {
        console.warn('Failed to render footer skeleton', err);
    }
}


function ensureContentFills() {
    try {

        let content = document.querySelector('body > main');
        if (!content) {

            const children = Array.from(document.body.children).filter(el => el.id !== 'navbar-placeholder' && el.id !== 'footer-placeholder');

            content = children.find(el => el.tagName.toLowerCase() === 'main' || el.classList.contains('page') || el.classList.contains('container')) || children[0];
        }
        if (content) {
            content.style.flex = '1 0 auto';
            content.style.minHeight = '0';
        }
    } catch (err) {
        console.warn('ensureContentFills failed', err);
    }
}


function watchForContentChanges() {
    try {
        const observer = new MutationObserver(() => {
            ensureContentFills();
        });
        observer.observe(document.body, {childList: true, subtree: true});


        window.addEventListener('DOMContentLoaded', () => {
            ensureContentFills();
        });
    } catch (err) {
        console.warn('watchForContentChanges failed', err);
    }
}


function adjustFooterPosition() {
    try {

        const footerPlaceholder = document.getElementById('footer-placeholder');
        const footer = footerPlaceholder?.querySelector('.footer') || document.querySelector('.footer');
        if (!footer) return;

        const bodyHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const main = document.querySelector('body > main') || document.querySelector('.container') || document.body;

        if (bodyHeight <= viewportHeight) {

            footer.style.position = 'fixed';
            footer.style.bottom = '0';
            footer.style.left = '0';
            footer.style.right = '0';
            footer.style.width = '100%';
            footer.style.zIndex = String((Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-index-navbar')) || 100) - 1);

            if (main) main.style.paddingBottom = `calc(var(--footer-height) + 1rem)`;
        } else {

            footer.style.position = '';
            footer.style.bottom = '';
            footer.style.left = '';
            footer.style.right = '';
            footer.style.width = '';
            footer.style.zIndex = '';
            if (main) main.style.paddingBottom = '';
        }
    } catch (err) {
        console.warn('adjustFooterPosition failed', err);
    }
}


window.addEventListener('resize', () => adjustFooterPosition());


const footerObserver = new MutationObserver(() => adjustFooterPosition());
footerObserver.observe(document.body, {childList: true, subtree: true});


adjustFooterPosition();


renderNavbarSkeleton();
renderFooterSkeleton();
ensureContentFills();
watchForContentChanges();

let currentNavbarUnsubscribe = null;

function getElement(id) {
    return document.getElementById(id);
}


export async function loadUserProfile(userId) {
    if (!userId) return null;
    try {

        const profile = await getUserProfileFromFirestore(userId);
        if (profile) return profile;


        const defaultProfile = {
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isAdmin: userId === HARD_CODED_ADMIN_UID,
            themePreference: 'dark'
        };
        await setUserProfileInFirestore(userId, defaultProfile);
        return await getUserProfileFromFirestore(userId);
    } catch (err) {
        console.warn('loadUserProfile error', err);
        return null;
    }
}


function onAuthStateChanged(user) {
    const userSection = getElement('user-section');
    if (!userSection) return;

    userSection.innerHTML = ''; // Clear previous content

    if (user) {

        const {uid, displayName, photoURL} = user;


        const isAdmin = uid === HARD_CODED_ADMIN_UID;

        const adminLink = isAdmin ? `<a href="./mod.html" class="nav-link">Admin</a>` : '';

        userSection.innerHTML = `
            <div class="flex items-center gap-4">
                <a href="./profile.html" class="flex items-center gap-2 no-underline">
                    <img src="${photoURL || ASSETS.DEFAULT_USER}" alt="${displayName}'s avatar" class="w-8 h-8 rounded-full">
                    <span class="text-text">${displayName || 'User'}</span>
                </a>
                ${adminLink}
                <button id="sign-out-btn" class="btn btn-primary">Sign Out</button>
            </div>
        `;


        document.getElementById('sign-out-btn').addEventListener('click', async () => {
            try {
                await auth.signOut();
                showMessageBox('Signed out successfully', 'info');
            } catch (err) {
                showMessageBox('Sign out failed: ' + err.message, 'error');
            }
        });
    } else {

        userSection.innerHTML = `
            <a href="./users.html" class="btn btn-primary">Sign In</a>
        `;
    }
}


async function initApp() {
    try {

        renderNavbarSkeleton();
        renderFooterSkeleton();


        ensureContentFills();


        watchForContentChanges();


        auth.onAuthStateChanged(onAuthStateChanged);


        const preloadedImages = [ASSETS.DEFAULT_USER, ASSETS.DEFAULT_HERO];
        preloadedImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });


        document.getElementById('navbar-placeholder').innerHTML = navbarHTML;
        document.getElementById('footer-placeholder').innerHTML = footerHTML;


        ensureContentFills();
    } catch (err) {
        console.warn('initApp failed', err);
    }
}


export async function loadNavbar(user, userProfile) {
    const navbar = getElement('navbar-placeholder');
    if (!navbar) return;

    navbar.innerHTML = navbarHTML;

    const userSection = document.getElementById('user-section');
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


    const currentPage = globalThis.location.pathname.split('/').pop() || 'index.html';
    navbar.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href').replace('./', '') === currentPage) {
            link.classList.add('nav-link-active');
        } else {
            link.classList.remove('nav-link-active');
        }
    });
}

export function loadFooter() {
    const footer = getElement('footer-placeholder');
    if (!footer) return;
    footer.innerHTML = footerHTML;
}

export async function initializePage(pageName, requireAuth = false) {
    try {
        await themeManager.init();

        if (currentNavbarUnsubscribe) {
            currentNavbarUnsubscribe();
            currentNavbarUnsubscribe = null;
        }

        const user = await new Promise(resolve => {
            const unsubscribe = auth.onAuthStateChanged(u => {
                unsubscribe();
                resolve(u);
            });
        });

        if (requireAuth && !user) {

            showMessageBox('This page requires sign-in. Please sign in to continue.', true);
            return false;
        }

        const userProfile = user ? await loadUserProfile(user.uid) : null;
        await loadNavbar(user, userProfile);

        if (user) {
            currentNavbarUnsubscribe = auth.onAuthStateChanged(async u => {
                const profile = u ? await loadUserProfile(u.uid) : null;
                await loadNavbar(u, profile);
            });
        }

        console.log(`Page ${pageName} initialized successfully`);
        return true;
    } catch (err) {
        console.error('initializePage error', err);
        showMessageBox('Failed to initialize page', true);
        return false;
    }
>>>>>>> 45bdfcda71152709c7beaa1a0cffd06a95a5cec7
}