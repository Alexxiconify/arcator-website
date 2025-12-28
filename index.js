export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replaceAll(/[&<>"']/g, function (char) {
        return map[char];
    });
}

export function sanitizeHandle(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input.toLowerCase().replaceAll(/[^a-z0-9_-]/g, '');

}


const emojiMap = {
    'smile': '😊',
    'happy': '😄',
    'joy': '😂',
    'laugh': '🤣',
    'thumbsup': '👍',
    'thumbsdown': '👎',
    'heart': '❤️',
    'fire': '🔥',
    'thinking': '🤔',
    'clap': '👏',
    'rocket': '🚀'
};

export function parseMentions(text) {


    const mentionRegex = /@([a-zA-Z0-9_]+)/g;

    return text.replaceAll(mentionRegex, (match, username) => {

        return `<a href="/user/${username}" class="mention" title="View ${username}'s profile">@${username}</a>`;
    });
}

export function parseEmojis(text) {


    const emojiRegex = /:([a-zA-Z0-9_]+):/g;

    return text.replaceAll(emojiRegex, (match, emojiName) => {
        const unicodeEmoji = emojiMap[emojiName.toLowerCase()];

        if (unicodeEmoji) {

            return `<span class="custom-emoji" role="img" aria-label="${emojiName}">${unicodeEmoji}</span>`;
        } else {

            return match;
        }
    });
}