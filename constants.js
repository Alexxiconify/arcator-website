
export const APP_CONFIG = {
    name: 'Arcator',
    version: '1.0.0',
    domain: 'arcator.co.uk',
    apiUrl: 'https://api.arcator.co.uk',
    defaultLocale: 'en-GB',
    maxUploadSize: 10 * 1024 * 1024, // 10MB
    maxFileNameLength: 255,
    maxDescriptionLength: 1000,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedFileTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    themes: {
        light: {
            id: 'light',
            name: 'Light Theme',
            colors: {
                primary: '#0066cc',
                secondary: '#6c757d',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                light: '#f8f9fa',
                dark: '#343a40',
                background: '#ffffff',
                text: '#212529',
                link: '#0066cc',
                border: '#dee2e6'
            }
        },
        dark: {
            id: 'dark',
            name: 'Dark Theme',
            colors: {
                primary: '#375a7f',
                secondary: '#444444',
                success: '#00bc8c',
                danger: '#e74c3c',
                warning: '#f39c12',
                info: '#3498db',
                light: '#303030',
                dark: '#222222',
                background: '#222222',
                text: '#ffffff',
                link: '#0066cc',
                border: '#444444'
            }
        }
    },
    urls: {
        home: '/',
        login: './users.html',
        register: '/register',
        profile: '/profile',
        settings: '/settings',
        about: '/about',
        contact: '/contact',
        terms: '/terms',
        privacy: '/privacy',
        help: '/help',
        admin: '/admin'
    },
    HARD_CODED_ADMIN_UID: 'CEch8cXWemSDQnM3dHVKPt0RGpn2',
    timeouts: {
        notification: 5000,
        debounce: 300,
        throttle: 1000,
        sessionExpiry: 3600000 // 1 hour
    },
    limits: {
        maxLoginAttempts: 5,
        maxTitleLength: 100,
        maxTagLength: 30,
        maxTagsCount: 10,
        maxCommentLength: 500,
        maxNameLength: 50,
        maxHandleLength: 30
    },
    regex: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        handle: /^[a-z0-9_.]{3,30}$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
        url: /^https?:\/\/.+/
    },
    __firebase_config: undefined,
    __app_id: undefined,
    defaultTheme() {
        const body = document.body; // Or document.getElementById('content');
        body.classList.add('theme-light');
    }
};


export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyARkp-8Bg9pgPUcv_KD2Ab2yvv_ktSVxkg",
    authDomain: "arcator.firebaseapp.com",
    projectId: "arcator",
    storageBucket: "arcator.appspot.com",
    messagingSenderId: "939025670674",
    appId: "1:939025670674:web:60950a89a07ae8295c8497"
};

export const AUTH_ERRORS = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in or use a different email.',
    'auth/invalid-email': 'Invalid email address format.',
    'auth/operation-not-allowed': 'Operation not allowed. Please contact support.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.'
};

export const USER_ROLES = {
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    USER: 'user',
    GUEST: 'guest'
};

export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

export const FILE_TYPES = {
    IMAGE: 'image',
    DOCUMENT: 'document',
    VIDEO: 'video',
    AUDIO: 'audio',
    OTHER: 'other'
};

export const CONTENT_TYPES = {
    TEXT: 'text',
    HTML: 'html',
    MARKDOWN: 'markdown',
    JSON: 'json'
};

export const DATE_FORMATS = {
    FULL: 'MMMM D, YYYY h:mm A',
    SHORT: 'MM/DD/YYYY',
    TIME: 'h:mm A',
    ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ'
};

export const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
};

export const EVENT_TYPES = {
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    PROFILE_UPDATE: 'profile_update',
    SETTINGS_CHANGE: 'settings_change',
    THEME_CHANGE: 'theme_change',
    ERROR: 'error'
};


export const HARD_CODED_ADMIN_UID = APP_CONFIG.HARD_CODED_ADMIN_UID || 'CEch8cXWemSDQnM3dHVKPt0RGpn2';