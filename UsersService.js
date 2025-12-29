import AuthService from './AuthService.js';
import { initPage } from './UIService.js';
import { GoogleAuthProvider, GithubAuthProvider, TwitterAuthProvider, OAuthProvider } from './firebase-init.js';
import { $, setVal, setCheck, toggleClass, syncGithub, syncDiscord } from './Utils.js';

let currentUser = null;
let currentProfile = null;

export async function init() {
    await initPage(AuthService);
    
    AuthService.onAuthChange(({ user, profile, providerData }) => {
        currentUser = user;
        currentProfile = profile;
        toggleClass('auth-section', 'd-none', !!user);
        toggleClass('settings-section', 'd-none', !user);
        if (user) {
            populateSettings(profile);
            updateDiscordNotifAvailability(profile);
            updateLinkedAccounts(profile, providerData);
        }
    });
    
    setupEventListeners();
}

function populateSettings(profile) {
    if (!profile) return;
    
    setVal('displayName', profile.displayName);
    setVal('handle', profile.handle);
    setVal('email', profile.email);
    setVal('photoURL', profile.photoURL);
    if ($('profile-pic')) $('profile-pic').src = profile.photoURL || './defaultuser.png';
    
    setVal('discordId', profile.discordId);
    if ($('manual-discord-pic')) $('manual-discord-pic').src = profile.discordPic || './defaultuser.png';
    
    setVal('githubURL', profile.githubURL);
    if ($('manual-github-pic')) {
        const match = profile.githubURL?.match(/github\.com\/([^/?#\s]+)/i);
        $('manual-github-pic').src = profile.githubPic || (match ? `https://github.com/${match[1]}.png` : './defaultuser.png');
    }
    
    setVal('theme', profile.themePreference || 'dark');
    setVal('fontScaling', profile.fontScaling || 'normal');
    setCheck('reducedMotion', profile.reducedMotion);
    setCheck('highContrast', profile.highContrast);
    
    setCheck('emailNotif', profile.emailNotifications ?? true);
    setCheck('pushNotif', profile.pushNotifications ?? true);
    setCheck('discordNotif', profile.discordNotifications);
    setVal('notifFrequency', profile.notificationFrequency || 'immediate');
    
    setCheck('profileVisible', profile.profileVisible ?? true);
    setCheck('activityTracking', profile.activityTracking ?? true);
    setCheck('thirdPartySharing', profile.thirdPartySharing);
    setVal('dataRetention', profile.dataRetention || '365');
}

function updateDiscordNotifAvailability(profile) {
    const el = $('discordNotif');
    const container = el?.closest('.form-check');
    const hasDiscord = !!(profile?.discordId || profile?.discordURL || profile?.provider === 'discord');
    
    if (container) {
        el.disabled = !hasDiscord;
        if (!hasDiscord) el.checked = false;
        container.classList.toggle('opacity-50', !hasDiscord);
        container.title = hasDiscord ? '' : 'Link your Discord first';
    }
}

function updateLinkedAccounts(profile, providerData = []) {
    const linkedProviders = providerData.map(p => p.providerId);
    const isOAuthLinked = (id) => linkedProviders.some(p => p === id || p === `${id}.com`);
    const getOAuthInfo = (id) => providerData.find(p => p.providerId === id || p.providerId === `${id}.com`)?.email;

    const providers = {
        google: { id: 'google.com', btn: 'link-google-btn', status: 'google-status', info: 'google-info', provider: new GoogleAuthProvider() },
        github: { id: 'github.com', btn: 'link-github-btn', status: 'github-status', info: 'github-info', provider: new GithubAuthProvider() },
        twitter: { id: 'twitter.com', btn: 'link-twitter-btn', status: 'twitter-status', info: 'twitter-info', provider: new TwitterAuthProvider() },
        discord: { id: 'discord.com', btn: 'link-discord-btn', status: 'discord-status', info: 'discord-info', provider: new OAuthProvider('discord.com') }
    };

    Object.entries(providers).forEach(([key, p]) => {
        const isLinked = isOAuthLinked(key);
        const statusEl = $(p.status);
        const infoEl = $(p.info);
        const btnEl = $(p.btn);

        if (statusEl) {
            statusEl.className = `badge ${isLinked ? 'bg-success' : 'bg-secondary'}`;
            statusEl.textContent = isLinked ? 'Linked' : 'Not Linked';
        }
        if (infoEl) infoEl.textContent = isLinked ? (getOAuthInfo(key) || 'Linked') : '';
        if (btnEl) {
            btnEl.textContent = isLinked ? 'Unlink' : 'Link';
            btnEl.onclick = async () => {
                try {
                    if (isLinked) {
                        await AuthService.unlinkProvider(p.id);
                        Swal.fire('Unlinked', `Your ${key} account has been unlinked.`, 'success');
                    } else {
                        await AuthService.linkProvider(p.provider);
                        Swal.fire('Linked', `Your ${key} account has been linked.`, 'success');
                    }
                } catch (e) {
                    console.error(`${key} link error:`, e);
                    Swal.fire('Error', e.message, 'error');
                }
            };
        }
    });
}

function setupEventListeners() {
    $('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await AuthService.login($('login-email').value, $('login-password').value);
            Swal.fire('Welcome!', 'You have successfully signed in.', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });

    $('logout-btn')?.addEventListener('click', () => {
        AuthService.logout();
        localStorage.removeItem('arcator_user_cache');
    });

    ['google', 'github', 'twitter', 'discord'].forEach(id => {
        $(`${id}-btn`)?.addEventListener('click', async () => {
            try {
                await AuthService[`loginWith${id.charAt(0).toUpperCase() + id.slice(1)}`]();
                Swal.fire('Welcome!', `Signed in with ${id}.`, 'success');
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        });
    });

    $('photoURL')?.addEventListener('input', (e) => {
        if ($('profile-pic')) $('profile-pic').src = e.target.value || './defaultuser.png';
    });

    const ghSync = (val) => syncGithub(val, { pic: $('manual-github-pic'), input: $('photoURL'), mainPic: $('profile-pic') });
    $('githubURL')?.addEventListener('input', (e) => ghSync(e.target.value));
    $('githubURL')?.addEventListener('blur', (e) => ghSync(e.target.value));

    $('discordId')?.addEventListener('input', (e) => {
        syncDiscord(e.target.value, { pic: $('manual-discord-pic'), input: $('photoURL'), mainPic: $('profile-pic') });
        const discordNotifEl = $('discordNotif');
        if (discordNotifEl) {
            discordNotifEl.disabled = !e.target.value;
            if (!e.target.value) discordNotifEl.checked = false;
        }
    });

    $('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const githubPic = ghSync($('githubURL').value);
        const discordPic = syncDiscord($('discordId').value, { pic: $('manual-discord-pic') });

        const data = {
            displayName: $('displayName').value,
            handle: $('handle').value,
            email: $('email').value,
            photoURL: $('photoURL').value,
            discordId: $('discordId').value,
            githubURL: $('githubURL').value,
            githubPic: githubPic || currentProfile?.githubPic || '',
            discordPic: discordPic || currentProfile?.discordPic || '',
            themePreference: $('theme').value,
            fontScaling: $('fontScaling').value,
            reducedMotion: $('reducedMotion').checked,
            highContrast: $('highContrast').checked,
            emailNotifications: $('emailNotif').checked,
            pushNotifications: $('pushNotif').checked,
            discordNotifications: $('discordNotif').checked,
            notificationFrequency: $('notifFrequency').value,
            profileVisible: $('profileVisible').checked,
            activityTracking: $('activityTracking').checked,
            thirdPartySharing: $('thirdPartySharing').checked,
            dataRetention: $('dataRetention').value
        };

        try {
            await AuthService.updateProfile(currentUser.uid, data);
            Swal.fire('Saved!', 'Your settings have been updated.', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });
}

init();
