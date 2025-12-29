const NAV_LINKS = [
    { href: './index.html', label: 'Home' },
    { href: './games.html', label: 'Games' },
    { href: './forms.html', label: 'Forums' },
    { href: './pages.html', label: 'Pages' },
    { href: './about.html', label: 'About' },
    { href: './privacy.html', label: 'Legal' },
    { href: './mod.html', label: 'Admin' }
];

export function renderNavbar(container) {
    const current = location.pathname.split('/').pop() || 'index.html';
    const links = NAV_LINKS.map(l => `<li class="nav-item"><a class="nav-link${l.href.includes(current) ? ' active' : ''}" href="${l.href}">${l.label}</a></li>`).join('');
    
    container.innerHTML = `
<nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top border-bottom border-primary">
    <div class="container-fluid px-4">
        <a class="navbar-brand fw-bold" href="./index.html">Arcator</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto">${links}</ul>
            <div id="user-section" class="d-flex align-items-center"><a href="./users.html" class="btn btn-primary btn-sm">Sign In</a></div>
        </div>
    </div>
</nav>`;
}

export function renderUserSection(user, profile) {
    const section = document.getElementById('user-section');
    if (!section) return;
    
    if (user) {
        const photo = profile?.photoURL || user.photoURL || './defaultuser.png';
        const name = profile?.displayName || user.displayName || 'User';
        section.innerHTML = `<a href="./users.html" class="d-flex align-items-center text-decoration-none gap-2"><img src="${photo}" class="profile-img" alt="Profile"><span class="text-light">${name}</span></a>`;
    } else {
        section.innerHTML = `<a href="./users.html" class="btn btn-primary btn-sm">Sign In</a>`;
    }
}

export function renderFooter(container) {
    container.innerHTML = `
<footer class="mt-auto py-4 bg-dark border-top border-primary">
    <div class="container-fluid px-4">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
            <div class="d-flex gap-3">
                <a href="https://bluemaps.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">Blue Maps</a>
                <a href="https://wiki.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">Wiki</a>
            </div>
            <div class="text-secondary">© 2025 Arcator</div>
        </div>
    </div>
</footer>`;
}

export async function initPage(AuthService) {
    const navbar = document.getElementById('navbar-placeholder');
    const footer = document.getElementById('footer-placeholder');
    
    if (navbar) renderNavbar(navbar);
    if (footer) renderFooter(footer);
    
    try {
        await AuthService.ready();
        AuthService.onAuthChange(({ user, profile }) => {
            renderUserSection(user, profile);
            const theme = profile?.themePreference || 'dark';
            const fontSize = profile?.fontScaling || 'normal';
            document.documentElement.setAttribute('data-bs-theme', theme);
            document.documentElement.setAttribute('data-font-size', fontSize);
        });
    } catch (e) {
        console.error('Auth init error:', e);
    }
}

// Auto-init: import this for simple pages that only need nav/footer/theme
export async function initApp() {
    const { default: AuthService } = await import('./AuthService.js');
    await initPage(AuthService);
    return AuthService;
}
