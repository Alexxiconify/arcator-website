import AuthService from './AuthService.js';
import { initPage } from './UIService.js';

let currentUser = null;

export async function init() {
    await initPage(AuthService);
    
    AuthService.onAuthChange(({ user, profile }) => {
        currentUser = user;
        if (user) {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('settings-section').style.display = 'flex';
            populateSettings(profile);
        } else {
            document.getElementById('auth-section').style.display = 'flex';
            document.getElementById('settings-section').style.display = 'none';
        }
    });
    
    setupEventListeners();
}

function populateSettings(profile) {
    if (!profile) return;
    document.getElementById('displayName').value = profile.displayName || '';
    document.getElementById('handle').value = profile.handle || '';
    document.getElementById('email').value = profile.email || '';
    document.getElementById('photoURL').value = profile.photoURL || '';
    document.getElementById('discordURL').value = profile.discordURL || '';
    document.getElementById('githubURL').value = profile.githubURL || '';
    document.getElementById('theme').value = profile.themePreference || 'dark';
    document.getElementById('fontScaling').value = profile.fontScaling || 'normal';
    document.getElementById('emailNotif').checked = profile.emailNotifications ?? true;
    document.getElementById('pushNotif').checked = profile.pushNotifications ?? true;
    document.getElementById('discordNotif').checked = profile.discordNotifications ?? false;
    document.getElementById('profileVisible').checked = profile.profileVisible ?? true;
    document.getElementById('activityTracking').checked = profile.activityTracking ?? true;
}

function setupEventListeners() {
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            await AuthService.login(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
            Swal.fire('Success', 'Logged in', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };

    document.getElementById('google-btn').onclick = async () => {
        try { await AuthService.loginWithGoogle(); } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };

    document.getElementById('github-btn').onclick = async () => {
        try { await AuthService.loginWithGithub(); } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };

    document.getElementById('logout-btn').onclick = async () => {
        await AuthService.logout();
        Swal.fire('Signed out', '', 'info');
    };

    document.getElementById('theme').onchange = (e) => {
        document.documentElement.setAttribute('data-bs-theme', e.target.value);
    };

    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            await AuthService.updateProfile(currentUser.uid, {
                displayName: document.getElementById('displayName').value,
                handle: document.getElementById('handle').value,
                email: document.getElementById('email').value,
                photoURL: document.getElementById('photoURL').value,
                discordURL: document.getElementById('discordURL').value,
                githubURL: document.getElementById('githubURL').value,
                themePreference: document.getElementById('theme').value,
                fontScaling: document.getElementById('fontScaling').value,
                emailNotifications: document.getElementById('emailNotif').checked,
                pushNotifications: document.getElementById('pushNotif').checked,
                discordNotifications: document.getElementById('discordNotif').checked,
                profileVisible: document.getElementById('profileVisible').checked,
                activityTracking: document.getElementById('activityTracking').checked
            });
            Swal.fire('Saved', 'Settings updated', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };
}

init();
