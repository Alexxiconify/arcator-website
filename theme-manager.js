import {auth, COLLECTIONS, db, doc, getDoc, setDoc} from './firebase-init.js';
import {showMessageBox} from './utils.js';

const DEFAULT_THEME = {
    id: 'oled-dark',
    name: 'OLED Dark',
    variables: {
        '--color-bg': '#000000',
        '--color-surface': '#0A0A0A',
        '--color-surface-2': '#111111',
        '--color-surface-3': '#1A1A1A',
        '--color-text': '#FFFFFF',
        '--color-text-2': '#A0AEC0',
        '--color-text-3': '#718096',
        '--color-accent': '#1a4b91',
        '--color-accent-light': '#2563eb',
        '--color-accent-dark': '#1e3a8a',
        '--color-error': '#DC2626',
        '--color-success': '#059669',
        '--color-warning': '#D97706'
    }
};

class ThemeManager {
    constructor() {
        this.currentTheme = DEFAULT_THEME;
        this.isInitialized = false;
        this.root = document.documentElement;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            await this.applyTheme(DEFAULT_THEME);
            await this.loadUserTheme();
            this.isInitialized = true;
        } catch (error) {
            console.error('Theme initialization error:', error);
            await this.applyTheme(DEFAULT_THEME);
        }
    }

    async loadUserTheme() {
        if (!auth.currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, auth.currentUser.uid));

            if (!userDoc.exists()) return;

            const userData = userDoc.data();
            const themeId = userData?.themePreference;

            if (!themeId || typeof themeId !== 'string') return;

            const themeDoc = await getDoc(doc(db, COLLECTIONS.THEMES, themeId));

            if (themeDoc.exists()) {
                const themeData = themeDoc.data();
                if (!themeData) return;

                await this.applyTheme({
                    id: themeDoc.id,
                    name: themeData.name || 'Custom Theme',
                    variables: themeData.variables || {}
                });
            }
        } catch (error) {
            console.error('Error loading user theme:', error);
        }
    }

    async applyTheme(theme) {
        if (!theme || typeof theme !== 'object') {
            console.error('Invalid theme object:', theme);
            return false;
        }

        try {

            Object.entries(DEFAULT_THEME.variables).forEach(([key, value]) => {
                if (typeof key === 'string' && typeof value === 'string') {
                    this.root.style.setProperty(key, value);
                }
            });


            if (theme.variables && typeof theme.variables === 'object') {
                Object.entries(theme.variables).forEach(([key, value]) => {
                    if (typeof key === 'string' && typeof value === 'string') {
                        this.root.style.setProperty(key, value);
                    }
                });
            }

            this.currentTheme = theme;

            if (typeof theme.id === 'string') {
                await this.saveThemePreference(theme.id);
            }

            return true;
        } catch (error) {
            console.error('Error applying theme:', error);
            showMessageBox('Failed to apply theme', true);
            return false;
        }
    }

    async saveThemePreference(themeId) {
        if (!auth.currentUser || typeof themeId !== 'string') return;

        try {
            await setDoc(doc(db, COLLECTIONS.USER_PROFILES, auth.currentUser.uid), {
                themePreference: themeId,
                lastUpdated: new Date()
            }, {merge: true});
            return true;
        } catch (error) {
            console.error('Error saving theme preference:', error);
            return false;
        }
    }

    toggleTheme() {
        // simple toggle between default and last applied theme
        const current = this.getCurrentTheme();
        if (current && current.id && current.id !== DEFAULT_THEME.id) {
            // switch back to default
            this.applyTheme(DEFAULT_THEME).catch(() => {
            });
        } else {
            // no custom theme available, keep DEFAULT; if there is a stored themePreference, try to load it
            const stored = this.currentTheme;
            if (stored && stored.id && stored.id !== DEFAULT_THEME.id) {
                this.applyTheme(stored).catch(() => {
                });
            } else {
                // nothing to toggle to; reapply DEFAULT
                this.applyTheme(DEFAULT_THEME).catch(() => {
                });
            }
        }
    }

    getCurrentTheme() {
        return this.currentTheme || DEFAULT_THEME;
    }
}

export const themeManager = new ThemeManager();