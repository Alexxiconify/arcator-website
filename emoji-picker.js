// Simplified Emoji Picker
let emojiData = [], filteredEmojis = [], currentCategory = 'all';
const CATEGORIES = ['smileys','animals','food','activities','travel','objects','symbols','flags','other'];

async function loadEmojiData() {
    if (emojiData.length) return emojiData;
    try { emojiData = await (await fetch('./emoji.json')).json(); return emojiData; }
    catch (e) { console.error('loadEmojis:', e); return []; }
}

export function toggleEmojiPicker(pickerId = 'emoji-picker') {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    picker.classList.contains('hidden') ? showEmojiPicker(pickerId) : hideEmojiPicker(pickerId);
}

export async function showEmojiPicker(pickerId = 'emoji-picker') {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    picker.classList.remove('hidden');
    if (!emojiData.length) await loadEmojiData();
    filteredEmojis = emojiData;
    renderEmojis(filteredEmojis, pickerId);
    renderEmojiTabs(pickerId);
    const search = picker.querySelector('.emoji-search');
    if (search) setTimeout(() => search.focus(), 100);
}

export function hideEmojiPicker(pickerId = 'emoji-picker') {
    document.getElementById(pickerId)?.classList.add('hidden');
}

export function renderEmojis(emojis, pickerId = 'emoji-picker') {
    const list = document.getElementById(pickerId)?.querySelector('.emoji-list');
    if (!list) return;
    const filtered = currentCategory === 'all' ? emojis : emojis.filter(e => (e.category || 'other') === currentCategory);
    list.innerHTML = filtered.length ? filtered.map(e =>
        `<span class="emoji-item" title="${e.name}" onclick="insertEmoji(':${e.name}:','${pickerId}')">${e.emoji}</span>`
    ).join('') : '<div class="text-text-2">No emojis found</div>';
}

function renderEmojiTabs(pickerId) {
    const tabs = document.getElementById(pickerId)?.querySelector('.emoji-tabs');
    if (!tabs) return;
    tabs.innerHTML = `<button class="emoji-tab${currentCategory === 'all' ? ' active' : ''}" onclick="setEmojiCategory('all','${pickerId}')">All</button>` +
        CATEGORIES.map(c => `<button class="emoji-tab${currentCategory === c ? ' active' : ''}" onclick="setEmojiCategory('${c}','${pickerId}')">${c[0].toUpperCase()}${c.slice(1)}</button>`).join('');
}

window.setEmojiCategory = (cat, pickerId) => {
    currentCategory = cat;
    renderEmojis(filteredEmojis, pickerId);
    renderEmojiTabs(pickerId);
};

window.insertEmoji = (code, pickerId = 'emoji-picker', targetId = null) => {
    let target = targetId ? document.getElementById(targetId) : document.getElementById(pickerId)?.closest('.emoji-input-container')?.querySelector('textarea, input[type="text"]');
    if (!target) return;
    const {selectionStart: start, selectionEnd: end, value} = target;
    target.value = value.substring(0, start) + code + value.substring(end);
    target.setSelectionRange(start + code.length, start + code.length);
    target.focus();
    target.dispatchEvent(new Event('input', {bubbles: true}));
    hideEmojiPicker(pickerId);
};

export function filterEmojis(term, pickerId = 'emoji-picker') {
    filteredEmojis = term.trim() ? emojiData.filter(e => e.name.toLowerCase().includes(term.toLowerCase())) : emojiData;
    renderEmojis(filteredEmojis, pickerId);
}

export function createEmojiPickerHTML(pickerId = 'emoji-picker') {
    return `<div id="${pickerId}" class="emoji-picker hidden">
        <div class="emoji-picker-header"><input type="text" placeholder="Search..." class="emoji-search form-input" oninput="filterEmojis(this.value,'${pickerId}')"></div>
        <div class="emoji-tabs"></div>
        <div class="emoji-list"></div>
    </div>`;
}

export function createEmojiInputContainer(inputId, pickerId = 'emoji-picker', type = 'textarea', placeholder = '', cls = '') {
    const tag = type === 'textarea' ? 'textarea' : 'input';
    const attrs = type === 'textarea' ? 'rows="4"' : 'type="text"';
    return `<div class="emoji-input-container">
        <${tag} id="${inputId}" ${attrs} placeholder="${placeholder}" class="${cls}" required></${tag}>
        <button type="button" class="emoji-picker-btn" onclick="toggleEmojiPicker('${pickerId}')" title="Add emoji">😊</button>
        ${createEmojiPickerHTML(pickerId)}
    </div>`;
}

// Setup click-outside handler
document.addEventListener('click', e => {
    document.querySelectorAll('.emoji-picker:not(.hidden)').forEach(picker => {
        if (!picker.contains(e.target) && !e.target.closest('.emoji-picker-btn')) picker.classList.add('hidden');
    });
});

export {loadEmojiData};