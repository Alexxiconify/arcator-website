const _global = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});

function hasOwn(name) {
    try {
        return Object.prototype.hasOwnProperty.call(_global, name);
    } catch (e) {
        return false;
    }
}

export function getAppId() {
    if (hasOwn('__app_id')) return _global.__app_id;
    return undefined;
}

export function setAppId(id) {
    try {
        if (typeof id !== 'undefined') {
            _global.__app_id = id;
        } else {
            delete _global.__app_id;
        }
    } catch (e) {
        console.warn('Failed to set app ID:', e);
    }
}

export function getFirebaseConfig() {
    if (hasOwn('__firebase_config')) {
        const config = _global.__firebase_config;
        if (typeof config === 'string') {
            try {
                return JSON.parse(config);
            } catch (e) {
                console.warn('Failed to parse __firebase_config:', e);
            }
        }
        return config;
    }
    return undefined;
}

export function setFirebaseConfig(config) {
    try {
        if (typeof config !== 'undefined') {
            _global.__firebase_config = typeof config === 'string' ? config : JSON.stringify(config);
        } else {
            delete _global.__firebase_config;
        }
    } catch (e) {
        console.warn('Failed to set Firebase config:', e);
    }
}

export function getInitialAuthToken() {
    if (hasOwn('__initial_auth_token')) return _global.__initial_auth_token;
    return undefined;
}

export function setInitialAuthToken(token) {
    try {
        if (typeof token !== 'undefined') {
            _global.__initial_auth_token = token;
        } else {
            delete _global.__initial_auth_token;
        }
    } catch (e) {
        console.warn('Failed to set initial auth token:', e);
    }
}


void getAppId;
void setAppId;
void getFirebaseConfig;
void setFirebaseConfig;
void getInitialAuthToken;
void setInitialAuthToken;