import AuthService from './AuthService.js';
import { initPage } from './UIService.js';
import { GoogleAuthProvider, GithubAuthProvider, TwitterAuthProvider, OAuthProvider } from './firebase-init.js';

let currentUser = null;
let currentProfile = null;

export async function init() {
    await initPage(AuthService);
    
    AuthService.onAuthChange(({ user, profile, providerData }) => {
        currentUser = user;
        currentProfile = profile;
        if (user) {
            document.getElementById('auth-section').classList.add('d-none');
            document.getElementById('settings-section').classList.remove('d-none');
            populateSettings(profile);
            updateDiscordNotifAvailability(profile);
            updateLinkedAccounts(profile, providerData);
        } else {
            document.getElementById('auth-section').classList.remove('d-none');
            document.getElementById('settings-section').classList.add('d-none');
        }
    });
    
    setupEventListeners();
}

function populateSettings(profile) {
    if (!profile) return;
    
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val ?? false; };
    
    // Profile info
    setVal('displayName', profile.displayName);
    setVal('handle', profile.handle);
    setVal('email', profile.email);
    setVal('photoURL', profile.photoURL);
    const pic = document.getElementById('profile-pic');
    if (pic) pic.src = profile.photoURL || './defaultuser.png';
    
    setVal('discordId', profile.discordId);
    const discordPic = document.getElementById('manual-discord-pic');
    if (discordPic) discordPic.src = profile.discordPic || './defaultuser.png';
    
    setVal('githubURL', profile.githubURL);
    const githubPic = document.getElementById('manual-github-pic');
    if (githubPic) {
        const match = profile.githubURL?.match(/github\.com\/([^/?#\s]+)/i);
        githubPic.src = profile.githubPic || (match ? `https://github.com/${match[1]}.png` : './defaultuser.png');
    }
    
    // Appearance
    setVal('theme', profile.themePreference || 'dark');
    setVal('fontScaling', profile.fontScaling || 'normal');
    setCheck('reducedMotion', profile.reducedMotion);
    setCheck('highContrast', profile.highContrast);
    
    // Notifications
    setCheck('emailNotif', profile.emailNotifications ?? true);
    setCheck('pushNotif', profile.pushNotifications ?? true);
    setCheck('discordNotif', profile.discordNotifications);
    setVal('notifFrequency', profile.notificationFrequency || 'immediate');
    
    // Privacy
    setCheck('profileVisible', profile.profileVisible ?? true);
    setCheck('activityTracking', profile.activityTracking ?? true);
    setCheck('thirdPartySharing', profile.thirdPartySharing);
    setVal('dataRetention', profile.dataRetention || '365');
}

function updateDiscordNotifAvailability(profile) {
    const discordNotifEl = document.getElementById('discordNotif');
    const discordNotifContainer = discordNotifEl?.closest('.form-check');
    const hasDiscord = !!(profile?.discordId || profile?.discordURL || profile?.provider === 'discord');
    
    if (discordNotifContainer) {
        if (hasDiscord) {
            discordNotifEl.disabled = false;
            discordNotifContainer.classList.remove('opacity-50');
            discordNotifContainer.title = '';
        } else {
            discordNotifEl.disabled = true;
            discordNotifEl.checked = false;
            discordNotifContainer.classList.add('opacity-50');
            discordNotifContainer.title = 'Link your Discord first';
        }
    }
}

function updateLinkedAccounts(profile, providerData = []) {
    const linkedProviders = providerData.map(p => p.providerId);
    
    // Precise matching for OAuth provider IDs
    const isOAuthLinked = (id) => linkedProviders.some(p => p === id || p === `${id}.com`);
    const getOAuthInfo = (id) => providerData.find(p => p.providerId === id || p.providerId === `${id}.com`)?.email;

    const providers = {
        google: { 
            linked: isOAuthLinked('google'), 
            info: getOAuthInfo('google')
        },
        github: { 
            linked: isOAuthLinked('github') || !!profile?.githubURL, 
            info: getOAuthInfo('github') || profile?.githubURL
        },
        discord: { 
            linked: isOAuthLinked('discord') || !!profile?.discordId || !!profile?.discordLinked, 
            info: getOAuthInfo('discord') || profile?.discordId
        },
        twitter: { 
            linked: isOAuthLinked('twitter'), 
            info: getOAuthInfo('twitter')
        }
    };
    
    Object.entries(providers).forEach(([name, { linked, info }]) => {
        const status = document.getElementById(`${name}-status`);
        const btn = document.getElementById(`link-${name}-btn`);
        const infoEl = document.getElementById(`${name}-info`);
        const isOAuth = isOAuthLinked(name);
        
        if (status) {
            status.textContent = linked ? (isOAuth ? 'Linked (OAuth)' : 'Linked (Manual)') : 'Not Linked';
            status.className = `badge ${linked ? 'bg-success' : 'bg-secondary'}`;
        }
        if (btn) {
            if (isOAuth) {
                btn.textContent = 'Unlink';
                btn.className = 'btn btn-outline-danger btn-sm';
                btn.style.display = 'inline-block';
            } else {
                btn.textContent = 'Link';
                btn.className = 'btn btn-outline-primary btn-sm';
                // Hide link button if already manually linked, unless it's discord which has a fallback
                btn.style.display = (linked && name !== 'discord') ? 'none' : 'inline-block';
            }
        }
        if (infoEl) {
            infoEl.textContent = info || '';
            infoEl.classList.toggle('d-none', !info);
        }
    });
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

    document.getElementById('twitter-btn')?.addEventListener('click', async () => {
        try { await AuthService.loginWithTwitter(); } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });

    document.getElementById('discord-btn')?.addEventListener('click', async () => {
        try { await AuthService.loginWithDiscord(); } catch (e) { Swal.fire('Error', e.message, 'error'); }
    });

    document.getElementById('logout-btn').onclick = async () => {
        localStorage.removeItem('arcator_user_cache');
        await AuthService.logout();
        Swal.fire('Signed out', '', 'info');
    };

    // Live theme preview
    document.getElementById('theme').onchange = (e) => {
        document.documentElement.setAttribute('data-bs-theme', e.target.value);
    };

    // Live font scaling preview
    document.getElementById('fontScaling').onchange = (e) => {
        document.documentElement.setAttribute('data-font-size', e.target.value);
    };

    // Link account buttons - these link additional providers to existing account
    const handleLink = async (name, provider, providerId) => {
        const btn = document.getElementById(`link-${name}-btn`);
        const isLinked = btn?.textContent === 'Unlink';
        
        try {
            if (isLinked) {
                const result = await Swal.fire({
                    title: `Unlink ${name}?`,
                    text: `You will no longer be able to sign in with ${name}.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, unlink it'
                });
                if (result.isConfirmed) {
                    await AuthService.unlinkProvider(providerId);
                    Swal.fire('Unlinked', `${name} account unlinked`, 'success');
                }
            } else {
                if (name === 'discord') {
                    try {
                        await AuthService.linkProvider(new OAuthProvider('discord.com'));
                        Swal.fire('Linked', 'Discord account linked via OAuth', 'success');
                    } catch (e) {
                        if (e.code === 'auth/operation-not-allowed' || e.code === 'auth/invalid-provider-id') {
                            await AuthService.loginWithDiscord();
                        } else {
                            throw e;
                        }
                    }
                } else {
                    await AuthService.linkProvider(provider);
                    Swal.fire({
                        title: 'Linked!',
                        text: `${name} account has been successfully linked.`,
                        icon: 'success',
                        confirmButtonText: 'Great'
                    });
                }
            }
        } catch (e) { 
            console.error(`Link error (${name}):`, e);
            let msg = e.message;
            if (e.code === 'auth/operation-not-allowed') {
                msg = `${name} login is not enabled in your Firebase Console. Please enable it under Authentication > Sign-in method.`;
            } else if (e.code === 'auth/credential-already-in-use') {
                msg = `This ${name} account is already linked to another user. Please sign out and sign in with ${name} if you want to use that account.`;
            } else if (e.code === 'auth/email-already-in-use') {
                msg = `The email associated with this ${name} account is already in use by another user.`;
            }
            Swal.fire('Linking Failed', msg, 'error'); 
        }
    };

    document.getElementById('link-google-btn')?.addEventListener('click', () => handleLink('google', new GoogleAuthProvider(), 'google.com'));
    document.getElementById('link-github-btn')?.addEventListener('click', () => handleLink('github', new GithubAuthProvider(), 'github.com'));
    document.getElementById('link-discord-btn')?.addEventListener('click', () => handleLink('discord', new OAuthProvider('discord.com'), 'discord.com'));
    document.getElementById('link-twitter-btn')?.addEventListener('click', () => handleLink('twitter', new TwitterAuthProvider(), 'twitter.com'));

    // Live profile picture preview
    document.getElementById('photoURL')?.addEventListener('input', (e) => {
        const pic = document.getElementById('profile-pic');
        if (pic) pic.src = e.target.value || './defaultuser.png';
    });

    // Auto-pull profile picture from GitHub
    const syncGithub = (url) => {
        const githubPic = document.getElementById('manual-github-pic');
        const photoInput = document.getElementById('photoURL');
        const mainPic = document.getElementById('profile-pic');
        if (!url) {
            if (githubPic) githubPic.src = './defaultuser.png';
            return null;
        }

        // Match full URL or just username
        const match = url.match(/(?:github\.com\/|github\.io\/)?([^/?#\s]+)$|github\.com\/([^/?#\s]+)/i);
        const username = match ? (match[1] || match[2]) : (url.includes('/') ? null : url.trim());
        
        if (username && !username.includes('.') && !username.includes(':')) {
            const newPhoto = `https://github.com/${username}.png`;
            if (githubPic) githubPic.src = newPhoto;
            if (photoInput && (!photoInput.value || photoInput.value.includes('github.com') || photoInput.value.includes('discord'))) {
                photoInput.value = newPhoto;
                if (mainPic) mainPic.src = newPhoto;
            }
            return newPhoto;
        }
        
        if (githubPic) githubPic.src = './defaultuser.png';
        return null;
    };

    document.getElementById('githubURL')?.addEventListener('input', (e) => syncGithub(e.target.value));
    document.getElementById('githubURL')?.addEventListener('blur', (e) => syncGithub(e.target.value));

    // Auto-pull profile picture from Discord
    const syncDiscord = (id) => {
        const discordPic = document.getElementById('manual-discord-pic');
        const photoInput = document.getElementById('photoURL');
        const mainPic = document.getElementById('profile-pic');
        const cleanId = id.trim();
        
        if (!cleanId) {
            if (discordPic) discordPic.src = './defaultuser.png';
            return null;
        }

        // Manual ID lookup is no longer supported without a proxy/backend.
        // We rely on the stored profile.discordPic from official OAuth.
        if (discordPic) discordPic.src = './defaultuser.png';
        return null;
    };

    document.getElementById('discordId')?.addEventListener('input', (e) => {
        const id = e.target.value;
        syncDiscord(id);
        const discordNotifEl = document.getElementById('discordNotif');
        if (discordNotifEl) {
            discordNotifEl.disabled = !id;
            if (!id) discordNotifEl.checked = false;
        }
    });
    document.getElementById('discordId')?.addEventListener('blur', (e) => syncDiscord(e.target.value));

    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const discordNotifEnabled = document.getElementById('discordNotif').checked;
            const hasDiscord = !!document.getElementById('discordId').value;
            
            const githubURL = document.getElementById('githubURL').value;
            const discordId = document.getElementById('discordId').value;
            
            await AuthService.updateProfile(currentUser.uid, {
                // Profile
                displayName: document.getElementById('displayName').value,
                handle: document.getElementById('handle').value,
                email: document.getElementById('email').value,
                photoURL: document.getElementById('photoURL').value,
                discordId: discordId,
                githubURL: githubURL,
                
                // Pulled Social Pics
                githubPic: syncGithub(githubURL),
                discordPic: syncDiscord(discordId),
                
                // Appearance
                themePreference: document.getElementById('theme').value,
                fontScaling: document.getElementById('fontScaling').value,
                reducedMotion: document.getElementById('reducedMotion').checked,
                highContrast: document.getElementById('highContrast').checked,
                
                // Notifications
                emailNotifications: document.getElementById('emailNotif').checked,
                pushNotifications: document.getElementById('pushNotif').checked,
                discordNotifications: hasDiscord ? discordNotifEnabled : false,
                notificationFrequency: document.getElementById('notifFrequency').value,
                
                // Privacy
                profileVisible: document.getElementById('profileVisible').checked,
                activityTracking: document.getElementById('activityTracking').checked,
                thirdPartySharing: document.getElementById('thirdPartySharing').checked,
                dataRetention: parseInt(document.getElementById('dataRetention').value) || 365
            });
            Swal.fire('Saved', 'Settings updated', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };
}

init();
