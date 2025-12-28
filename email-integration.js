export function getEmailJSStatus() {
    console.log("getEmailJSStatus called");
    return {serviceId: "", templateId: "", publicKey: ""};
}

export function getSMTPServerStatus() {
    console.log("getSMTPServerStatus called");
    return {host: "", port: "", secure: false, username: "", password: ""};
}

export function initializeEmailJS() {
    console.log("initializeEmailJS called");
}

export function initializeSMTPIntegration() {
    console.log("initializeSMTPIntegration called");
}

export function saveCredentials(type, credentials) {
    console.log(`saveCredentials called for ${type}`, credentials);
}

export function sendEmailViaSMTP(to, subject, body) {
    console.log(`sendEmailViaSMTP called to ${to} with subject ${subject}`);
    if (body) console.debug("Email body:", body);

    void body;
    return Promise.resolve();
}

export function testEmailJSConnection() {
    console.log("testEmailJSConnection called");
    return Promise.resolve(true);
}

export function testSMTPServerConnection() {
    console.log("testSMTPServerConnection called");
    return Promise.resolve(true);
}


export default {
    getEmailJSStatus,
    getSMTPServerStatus,
    initializeEmailJS,
    initializeSMTPIntegration,
    saveCredentials,
    sendEmailViaSMTP,
    testEmailJSConnection,
    testSMTPServerConnection,
};