import emojiRegex from 'https://esm.sh/emoji-regex@10';

const _emojiRe = emojiRegex();

export const isValidEmojiKey = (key) => {
  if (typeof key !== 'string' || key.length === 0 || key.length > 16) {
    return false;
  }
  const matches = [...key.matchAll(_emojiRe)];
  return matches.length === 1 && matches[0][0] === key;
};

export const SANITIZERS = {
  collapse: (v) => v.trim().replace(/\s+/g, ' '),
  trim: (v) => v.trim(),
};

export const safePhoto = (v) => (typeof v === 'string' && v.startsWith('https://') ? v : '');
