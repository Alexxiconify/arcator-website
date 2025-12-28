const escapeMap = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
const emojiMap = {
    smile: '😊', happy: '😄', joy: '😂', laugh: '🤣', thumbsup: '👍',
    thumbsdown: '👎', heart: '❤️', fire: '🔥', thinking: '🤔', clap: '👏', rocket: '🚀'
};

export const escapeHtml = text => text.replaceAll(/[&<>"']/g, c => escapeMap[c]);
export const sanitizeHandle = input => (typeof input === 'string' ? input.toLowerCase().replaceAll(/[^a-z0-9_-]/g, '') : '');
export const parseMentions = text => text.replaceAll(/@([a-zA-Z0-9_]+)/g, (_, u) => `<a href="/user/${u}" class="mention" title="View ${u}'s profile">@${u}</a>`);
export const parseEmojis = text => text.replaceAll(/:([a-zA-Z0-9_]+):/g, (m, n) => emojiMap[n.toLowerCase()] ? `<span class="custom-emoji" role="img" aria-label="${n}">${emojiMap[n.toLowerCase()]}</span>` : m);