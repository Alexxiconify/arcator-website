const _global = globalThis ?? window ?? {};

const hasOwn = (name) => Object.prototype.hasOwnProperty.call(_global, name);

export function getAppId() { return hasOwn('__app_id') ? _global.__app_id : undefined; }

export function setAppId(id) {
    if (id !== undefined) _global.__app_id = id;
    else delete _global.__app_id;
}

export function getFirebaseConfig() {
    if (!hasOwn('__firebase_config')) return undefined;
    const cfg = _global.__firebase_config;
    if (typeof cfg === 'string') try { return JSON.parse(cfg); } catch { return cfg; }
    return cfg;
}

export function setFirebaseConfig(config) {
    if (config !== undefined) _global.__firebase_config = typeof config === 'string' ? config : JSON.stringify(config);
    else delete _global.__firebase_config;
}

export function getInitialAuthToken() { return hasOwn('__initial_auth_token') ? _global.__initial_auth_token : undefined; }

export function setInitialAuthToken(token) {
    if (token !== undefined) _global.__initial_auth_token = token;
    else delete _global.__initial_auth_token;
}