export const $ = (id) => document.getElementById(id);
export const setVal = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
export const setCheck = (id, val) => { const el = $(id); if (el) el.checked = val ?? false; };
export const toggleClass = (id, cls, force) => $(id)?.classList.toggle(cls, force);

export const syncGithub = (url, elements = {}) => {
    const { pic, input, mainPic } = elements;
    if (!url) {
        if (pic) pic.src = './defaultuser.png';
        return null;
    }
    const match = url.match(/(?:github\.com\/|github\.io\/)?([^/?#\s]+)$|github\.com\/([^/?#\s]+)/i);
    const username = match ? (match[1] || match[2]) : (url.includes('/') ? null : url.trim());
    if (username && !username.includes('.') && !username.includes(':')) {
        const newPhoto = `https://github.com/${username}.png`;
        if (pic) pic.src = newPhoto;
        if (input && (!input.value || input.value.includes('github.com') || input.value.includes('discord'))) {
            input.value = newPhoto;
            if (mainPic) mainPic.src = newPhoto;
        }
        return newPhoto;
    }
    if (pic) pic.src = './defaultuser.png';
    return null;
};

export const syncDiscord = (id, elements = {}) => {
    const { pic, input, mainPic } = elements;
    const cleanId = id.trim();
    if (!cleanId) {
        if (pic) pic.src = './defaultuser.png';
        return null;
    }
    if (pic) pic.src = './defaultuser.png';
    return null;
};
