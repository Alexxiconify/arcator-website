
const NAV_HTML = `
<nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top border-bottom border-primary">
    <div class="container-fluid px-4">
        <a class="navbar-brand fw-bold" href="./index.html">Arcator</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto">
                <li class="nav-item"><a class="nav-link" href="./index.html">Home</a></li>
                <li class="nav-item"><a class="nav-link" href="./games.html">Games</a></li>
                <li class="nav-item"><a class="nav-link" href="./wiki.html">Wiki</a></li>
                <li class="nav-item"><a class="nav-link" href="./forms.html">Forums</a></li>
                <li class="nav-item"><a class="nav-link" href="./pages.html">Pages</a></li>
                <li class="nav-item"><a class="nav-link" href="./resources.html">Resources</a></li>
                <li class="nav-item"><a class="nav-link" href="./about.html">About</a></li>
                <li class="nav-item"><a class="nav-link" href="./privacy.html">Legal</a></li>
                <li class="nav-item" id="admin-link" style="display:none"><a class="nav-link" href="./mod.html">Admin</a></li>
            </ul>
            <div id="user-section" class="d-flex align-items-center">
                <a href="./users.html" class="btn btn-primary btn-sm" id="sign-in-btn">Sign In</a>
                <a href="./users.html" class="d-none align-items-center text-decoration-none gap-2" id="user-profile-link">
                    <img src="./defaultuser.png" class="profile-img" alt="Profile" id="user-avatar">
                    <span class="text-light" id="user-name">User</span>
                </a>
            </div>
        </div>
    </div>
</nav>`;

const FOOTER_HTML = `
<footer class="mt-auto py-4 bg-dark border-top border-primary">
    <div class="container-fluid px-4">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
            <div class="d-flex gap-3">
                <a href="https://ssmp.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">SSMP Blue Maps</a>
                <a href="https://wiki.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">Wiki</a>
            </div>
            <div class="text-secondary">© 2025 Arcator</div>
        </div>
    </div>
</footer>`;

export function initLayout() {
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (navPlaceholder) {
        navPlaceholder.innerHTML = NAV_HTML;
        const current = location.pathname.split('/').pop() || 'index.html';
        const links = navPlaceholder.querySelectorAll('.nav-link');
        links.forEach(l => {
            if (l.getAttribute('href') === `./${current}` || (current === 'index.html' && l.getAttribute('href') === './index.html')) {
                l.classList.add('active');
            }
        });
    }

    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) footerPlaceholder.innerHTML = FOOTER_HTML;
}

export function updateUserSection(user, profile, isAdmin = false) {
    const signInBtn = document.getElementById('sign-in-btn');
    const profileLink = document.getElementById('user-profile-link');
    const avatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const adminLink = document.getElementById('admin-link');
    
    if (!signInBtn || !profileLink) return;
    
    if (user) {
        signInBtn.classList.add('d-none');
        profileLink.classList.remove('d-none');
        profileLink.classList.add('d-flex');
        if (avatar) avatar.src = profile?.photoURL || user.photoURL || './defaultuser.png';
        if (userName) userName.textContent = profile?.displayName || user.displayName || 'User';
        if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
    } else {
        signInBtn.classList.remove('d-none');
        profileLink.classList.add('d-none');
        profileLink.classList.remove('d-flex');
        if (adminLink) adminLink.style.display = 'none';
    }
}
