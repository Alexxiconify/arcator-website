import {auth, COLLECTIONS, db, doc, getDoc, getUserProfileFromFirestore, setDoc, updateDoc} from "./firebase-init.js";
import {themeManager} from "./theme-manager.js";
import {showMessageBox} from './utils.js';

const DEFAULT_SETTINGS = {
    preferences: {fontSize:'16px',fontFamily:'Inter, sans-serif',backgroundPattern:'none',headingSizeMultiplier:'1.6',lineHeight:'1.6',letterSpacing:'0px',backgroundOpacity:'50'},
    accessibility: {highContrast:false,largeCursor:false,focusIndicators:true,colorblindFriendly:false,reducedMotion:false,disableAnimations:false,keyboardNavigation:true,skipLinks:true,textToSpeech:false,readingGuide:false,syntaxHighlighting:true,wordSpacing:'0'},
    communication: {dmPermissions:'everyone',mentionPermissions:'everyone'},
    notifications: {emailNotifications:true,inAppNotifications:true,announcementNotifications:true,communityNotifications:true,securityNotifications:true,maintenanceNotifications:true,frequency:'immediate'},
    privacy: {profileVisibility:true,activityVisibility:true,analyticsConsent:false,dataRetention:'90'},
    advanced: {lowBandwidthMode:false,disableImages:false,minimalUi:false,debugMode:false,showPerformanceMetrics:false,enableExperimentalFeatures:false,customCSS:'',keyboardShortcuts:'enabled',disabledShortcuts:[]}
};

const $ = id => document.getElementById(id);

export class SettingsManager {
    currentSettings = null;
    isInitialized = false;

    async init() {
        if (this.isInitialized) return;
        const user = auth.currentUser;
        if (user) await this.loadSettings(user.uid);
        this.isInitialized = true;
        this.setupEventListeners();
    }

    async loadSettings(uid) {
        if (!uid) return null;
        try {
            const userProfile = await getUserProfileFromFirestore(uid);
            if (!userProfile) return null;
            const settingsDoc = await getDoc(doc(db, 'user_settings', uid));
            this.currentSettings = {...DEFAULT_SETTINGS, ...userProfile, ...(settingsDoc.exists() ? settingsDoc.data() : {})};
            this.applySettingsToForm(this.currentSettings);
            await this.applyPreferencesToPage(this.currentSettings);
            return this.currentSettings;
        } catch (e) { this.handleError(e, 'Load Settings'); return null; }
    }

    applySettingsToForm(s) {
        const set = (id, val, checkbox = false) => { const el = $(id); if (el) checkbox ? el.checked = !!val : el.value = val ?? ''; };
        set('display-name-input', s.displayName);
        set('handle-input', s.handle);
        set('email-input', s.email);
        set('email-notifications', s.notifications?.emailNotifications ?? true, true);
        set('inapp-notifications', s.notifications?.inAppNotifications ?? true, true);
        set('announcement-notifications', s.notifications?.announcementNotifications ?? true, true);
        set('community-notifications', s.notifications?.communityNotifications ?? true, true);
        set('maintenance-notifications', s.notifications?.maintenanceNotifications ?? true, true);
        set('profile-visibility', s.privacy?.profileVisibility ?? true, true);
        set('activity-visibility', s.privacy?.activityVisibility ?? true, true);
        set('data-retention', s.privacy?.dataRetention ?? '90');
        set('high-contrast', s.accessibility?.highContrast ?? false, true);
        set('font-size', s.accessibility?.fontSize ?? 'medium');
        set('reduced-motion', s.accessibility?.reducedMotion ?? false, true);
        set('screen-reader', s.accessibility?.screenReader ?? false, true);
        set('dm-permissions', s.communication?.dmPermissions ?? 'everyone');
        set('mention-permissions', s.communication?.mentionPermissions ?? 'everyone');
        set('low-bandwidth', s.advanced?.lowBandwidth ?? false, true);
        set('debug-mode', s.advanced?.debugMode ?? false, true);
        set('keyboard-shortcuts', s.advanced?.keyboardShortcuts ?? true, true);
        set('experimental-features', s.advanced?.experimentalFeatures ?? false, true);
        set('custom-css', s.advanced?.customCSS ?? '');
    }

    getDefaultSettings() { return DEFAULT_SETTINGS; }

    async saveProfile() {
        const user = auth.currentUser;
        if (!user) { showMessageBox('You must be logged in to save profile settings.', true); return false; }
        try {
            const displayName = $('display-name-input')?.value?.trim();
            if (!displayName) { showMessageBox('Display name is required.', true); return false; }
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, user.uid), {
                displayName, handle: $('handle-input')?.value?.trim(), email: $('email-input')?.value?.trim(),
                photoURL: $('profile-picture-url-input')?.value?.trim(), lastUpdated: new Date().toISOString()
            });
            showMessageBox('Profile updated successfully!');
            return true;
        } catch (e) { this.handleError(e, 'Save Profile'); return false; }
    }

    async saveSection(name, getData) {
        const user = auth.currentUser;
        if (!user) { showMessageBox(`You must be logged in to save ${name}.`, true); return false; }
        try {
            const data = getData();
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, user.uid), {[name.toLowerCase()]: data, lastUpdated: new Date().toISOString()});
            showMessageBox(`${name} saved successfully!`);
            return true;
        } catch (e) { this.handleError(e, `Save ${name}`); return false; }
    }

    async savePreferences() {
        return this.saveSection('Preferences', () => ({
            fontSize: $('font-size-select')?.value, fontFamily: $('font-family-select')?.value,
            backgroundPattern: $('background-pattern-select')?.value, headingSizeMultiplier: $('heading-size-multiplier')?.value,
            lineHeight: $('line-height-select')?.value, letterSpacing: $('letter-spacing-select')?.value,
            backgroundOpacity: $('background-opacity-range')?.value
        }));
    }

    async saveNotifications() {
        return this.saveSection('Notifications', () => ({
            emailNotifications: $('email-notifications-checkbox')?.checked, inAppNotifications: $('inapp-notifications-checkbox')?.checked,
            announcementNotifications: $('announcement-notifications-checkbox')?.checked, communityNotifications: $('community-notifications-checkbox')?.checked,
            securityNotifications: $('security-notifications-checkbox')?.checked, maintenanceNotifications: $('maintenance-notifications-checkbox')?.checked,
            frequency: $('notification-frequency-select')?.value
        }));
    }

    async savePrivacy() {
        return this.saveSection('Privacy', () => ({
            profileVisibility: $('profile-visibility-checkbox')?.checked, activityVisibility: $('activity-visibility-checkbox')?.checked,
            analyticsConsent: $('analytics-consent-checkbox')?.checked, dataRetention: $('data-retention-select')?.value
        }));
    }

    async saveAccessibility() {
        const data = {
            highContrast: $('high-contrast-checkbox')?.checked, largeCursor: $('large-cursor-checkbox')?.checked,
            focusIndicators: $('focus-indicators-checkbox')?.checked, colorblindFriendly: $('colorblind-friendly-checkbox')?.checked,
            reducedMotion: $('reduced-motion-checkbox')?.checked, disableAnimations: $('disable-animations-checkbox')?.checked,
            keyboardNavigation: $('keyboard-navigation-checkbox')?.checked, skipLinks: $('skip-links-checkbox')?.checked,
            textToSpeech: $('text-to-speech-checkbox')?.checked, readingGuide: $('reading-guide-checkbox')?.checked,
            syntaxHighlighting: $('syntax-highlighting-checkbox')?.checked, wordSpacing: $('word-spacing-checkbox')?.checked
        };
        const result = await this.saveSection('Accessibility', () => data);
        if (result) await this.applyAccessibilitySettings(data);
        return result;
    }

    async saveAdvanced() {
        const data = {
            lowBandwidthMode: $('low-bandwidth-mode-checkbox')?.checked, disableImages: $('disable-images-checkbox')?.checked,
            minimalUi: $('minimal-ui-checkbox')?.checked, debugMode: $('debug-mode-checkbox')?.checked,
            showPerformanceMetrics: $('show-performance-metrics-checkbox')?.checked, enableExperimentalFeatures: $('enable-experimental-features-checkbox')?.checked,
            customCSS: $('custom-css-textarea')?.value, keyboardShortcuts: $('keyboard-shortcuts-toggle')?.value,
            disabledShortcuts: Array.from(document.querySelectorAll('.shortcut-disable-btn.disabled')).map(b => b.getAttribute('data-shortcut')).filter(Boolean)
        };
        const result = await this.saveSection('Advanced', () => data);
        if (result) await this.applyAdvancedSettings(data);
        return result;
    }

    async applyUserSettings(s) {
        if (!s) return;
        try {
            if (s.themePreference) await themeManager.applyTheme(s.themePreference);
            if (s.preferences) this.applyPreferences(s.preferences);
            if (s.accessibilitySettings) await this.applyAccessibilitySettings(s.accessibilitySettings);
            if (s.advancedSettings) await this.applyAdvancedSettings(s.advancedSettings);
            this.currentSettings = s;
            return true;
        } catch (e) { this.handleError(e, 'Apply User Settings'); return false; }
    }

    applyPreferences(p) {
        if (!p) return;
        const root = document.documentElement;
        if (p.fontSize) root.style.setProperty('--base-font-size', p.fontSize);
        if (p.fontFamily) root.style.setProperty('--font-family', p.fontFamily);
        if (p.letterSpacing) root.style.setProperty('--letter-spacing', p.letterSpacing);
        if (p.lineHeight) root.style.setProperty('--line-height', p.lineHeight);
        if (p.backgroundPattern) document.body.style.backgroundImage = p.backgroundPattern === 'none' ? 'none' : `url(assets/patterns/${p.backgroundPattern})`;
        if (p.backgroundOpacity) root.style.setProperty('--bg-opacity', p.backgroundOpacity + '%');
        if (p.headingSizeMultiplier) {
            const m = parseFloat(p.headingSizeMultiplier);
            ['h1','h2','h3','h4','h5','h6'].forEach((t, i) => root.style.setProperty(`--${t}-size`, `${(1 + (6 - i) * 0.2) * m}rem`));
        }
    }

    async applyPreferencesToPage(s) {
        if (!s?.preferences) return;
        const {preferences: p} = s, root = document.documentElement;
        if (p.fontSize) root.style.setProperty('--font-size-base', p.fontSize);
        if (p.fontFamily) root.style.setProperty('--font-family', p.fontFamily);
        if (p.headingSizeMultiplier) root.style.setProperty('--heading-size-multiplier', p.headingSizeMultiplier);
        if (p.lineHeight) root.style.setProperty('--line-height', p.lineHeight);
        if (p.letterSpacing) root.style.setProperty('--letter-spacing', p.letterSpacing);
        if (p.backgroundPattern && p.backgroundPattern !== 'none') root.style.setProperty('--background-pattern', `url('${p.backgroundPattern}')`);
        if (p.backgroundOpacity) root.style.setProperty('--background-opacity', p.backgroundOpacity + '%');
    }

    async applyAccessibilitySettings(s) {
        if (!s) return;
        const root = document.documentElement;
        root.classList.toggle('high-contrast', s.highContrast);
        root.classList.toggle('large-cursor', s.largeCursor);
        root.classList.toggle('focus-visible', s.focusIndicators);
        root.classList.toggle('colorblind-friendly', s.colorblindFriendly);
        root.classList.toggle('reduced-motion', s.reducedMotion);
        root.classList.toggle('no-animations', s.disableAnimations);
        this.toggleSkipLinks(s.skipLinks);
        this.toggleTextToSpeech(s.textToSpeech);
        this.toggleReadingGuide(s.readingGuide);
        this.toggleSyntaxHighlighting(s.syntaxHighlighting);
        if (s.wordSpacing) root.style.setProperty('--word-spacing', s.wordSpacing + 'px');
    }

    async applyAdvancedSettings(s) {
        if (!s) return;
        const root = document.documentElement;
        root.classList.toggle('low-bandwidth-mode', s.lowBandwidthMode);
        root.classList.toggle('minimal-ui', s.minimalUi);
        root.classList.toggle('debug-mode', s.debugMode);
        if (s.disableImages) {
            document.querySelectorAll('img').forEach(img => { img.loading = 'lazy'; if (!img.dataset.src) { img.dataset.src = img.src; img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; } });
        } else {
            document.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; delete img.dataset.src; });
        }
        await this.applyCustomCSS(s.customCSS);
        root.classList.toggle('experimental-features', s.enableExperimentalFeatures);
        s.disabledShortcuts?.forEach(sc => { const btn = document.querySelector(`[data-shortcut="${sc}"]`); if (btn) { btn.classList.add('disabled'); btn.setAttribute('aria-disabled', 'true'); } });
    }

    initializeKeyboardShortcuts() { document.addEventListener('keydown', this.handleKeyboardShortcut); }
    disableKeyboardShortcuts() { document.removeEventListener('keydown', this.handleKeyboardShortcut); }

    handleKeyboardShortcut = (e) => {
        if (e.target.matches('input, textarea, [contenteditable]')) return;
        const shortcut = this.getActiveShortcuts().find(s => s.key === e.key && s.ctrl === e.ctrlKey && s.alt === e.altKey && s.shift === e.shiftKey);
        if (shortcut) { e.preventDefault(); this.executeShortcut(shortcut); }
    }

    executeShortcut(s) {
        if (s.action === 'toggleTheme') themeManager.toggleTheme();
        else if (s.action === 'toggleSidebar') document.documentElement.classList.toggle('sidebar-collapsed');
        else if (s.action === 'toggleFullscreen') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    }

    getActiveShortcuts() {
        if (!auth.currentUser || this.currentSettings?.advanced?.keyboardShortcuts === 'disabled') return [];
        const defaults = [{key:'d',ctrl:true,alt:false,shift:false,action:'toggleTheme'},{key:'b',ctrl:true,alt:false,shift:false,action:'toggleSidebar'},{key:'f',ctrl:true,alt:false,shift:false,action:'toggleFullscreen'}];
        return this.currentSettings?.advanced?.disabledShortcuts ? defaults.filter(s => !this.currentSettings.advanced.disabledShortcuts.includes(s.action)) : defaults;
    }

    async applyCustomCSS(css) {
        if (!css) return;
        let el = $('user-custom-css');
        if (!el) { el = document.createElement('style'); el.id = 'user-custom-css'; document.head.appendChild(el); }
        el.innerHTML = css;
    }

    toggleSkipLinks(enabled) { const el = $('skip-to-content-link'); if (el) { el.style.display = enabled ? 'block' : 'none'; enabled ? el.setAttribute('href', '#main-content') : el.removeAttribute('href'); } }
    toggleReadingGuide(enabled) { const el = $('reading-guide'); if (el) el.style.display = enabled ? 'block' : 'none'; }
    toggleTextToSpeech(enabled) { document.documentElement.classList.toggle('text-to-speech-enabled', !!enabled); if (enabled && window.speechSynthesis) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance('Text to speech enabled')); } }
    toggleSyntaxHighlighting(enabled) { document.querySelectorAll('pre code').forEach(b => b.classList.toggle('syntax-highlight', enabled)); }

    handleError(e, ctx) {
        console.error(`Error in ${ctx}:`, e);
        showMessageBox(e?.code === 'permission-denied' ? 'Insufficient permissions to access Firestore.' : `An error occurred: ${e?.message ?? e}`, true);
    }

    async saveSettings(section, settings) {
        const user = auth.currentUser;
        if (!user) { showMessageBox('You must be logged in to save settings', true); return false; }
        try { await setDoc(doc(db, 'user_settings', user.uid), {[section]: settings}, {merge: true}); showMessageBox('Settings saved!'); return true; }
        catch (e) { console.error('saveSettings:', e); showMessageBox('Failed: ' + e.message, true); return false; }
    }

    setupEventListeners() {
        const forms = [
            ['profile-settings-form', () => ({displayName: $('display-name-input').value, handle: $('handle-input').value, email: $('email-input').value}), 'profile'],
            ['notification-settings-form', () => ({emailNotifications: $('email-notifications').checked, inAppNotifications: $('inapp-notifications').checked, announcementNotifications: $('announcement-notifications').checked, communityNotifications: $('community-notifications').checked, maintenanceNotifications: $('maintenance-notifications').checked}), 'notifications'],
            ['privacy-settings-form', () => ({profileVisibility: $('profile-visibility').checked, activityVisibility: $('activity-visibility').checked, dataRetention: $('data-retention').value}), 'privacy'],
            ['accessibility-settings-form', () => ({highContrast: $('high-contrast').checked, fontSize: $('font-size').value, reducedMotion: $('reduced-motion').checked, screenReader: $('screen-reader').checked}), 'accessibility'],
            ['communication-settings-form', () => ({dmPermissions: $('dm-permissions').value, mentionPermissions: $('mention-permissions').value}), 'communication'],
            ['advanced-settings-form', () => ({lowBandwidth: $('low-bandwidth').checked, debugMode: $('debug-mode').checked, keyboardShortcuts: $('keyboard-shortcuts').checked, experimentalFeatures: $('experimental-features').checked, customCSS: $('custom-css').value}), 'advanced']
        ];
        forms.forEach(([id, getData, section]) => $(id)?.addEventListener('submit', async e => { e.preventDefault(); await this.saveSettings(section, getData()); }));
    }
}

export const settingsManager = new SettingsManager();
export const initializeKeyboardShortcuts = () => settingsManager.initializeKeyboardShortcuts();
export const disableKeyboardShortcuts = () => settingsManager.disableKeyboardShortcuts();