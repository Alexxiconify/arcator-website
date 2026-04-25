import emojiRegex from 'https://esm.sh/emoji-regex@10';
import { Temporal as _Temporal } from 'https://cdn.jsdelivr.net/npm/@js-temporal/polyfill@latest/+esm';

const _emojiRe = emojiRegex();

export const Temporal = globalThis.Temporal ?? _Temporal;

//  Constants 

export const PROFILE_STUB_BODY = 'They have not made a profile yet.';
export const PROFILE_ZEROED    = { title: 'Deleted User', body: 'Deleted User', photoURL: '', bodyIsHTML: false };



//  Emoji 

export function isValidEmojiKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 16) return false;
  const matches = [...key.matchAll(_emojiRe)];
  return matches.length === 1 && matches[0][0] === key;
}

//  Markdown ─

const _ytRe = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:\S+=\S+&)*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})[^\n]*(?:\n|$)/;

marked.use({
  gfm: true,
  extensions: [
    {
      name: 'youtube',
      level: 'block',
      start: src => { const m = src.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//); return m?.index ?? -1; },
      tokenizer(src) {
        const m = _ytRe.exec(src);
        if (m) return { type: 'youtube', raw: m[0], videoId: m[1] };
      },
      renderer: t => `<lite-youtube videoid="${t.videoId}" nocookie params="rel=0"></lite-youtube>\n`,
    },
    {
      name: 'spoiler',
      level: 'inline',
      start: src => src.indexOf('||'),
      tokenizer(src) {
        const m = src.match(/^\|\|([^|]+)\|\|/);
        if (m) return { type: 'spoiler', raw: m[0], text: m[1] };
      },
      renderer: t => `<span class="spoiler">${t.text}</span>`,
    },
  ],
});

export const md = (s, { html = false } = {}) => DOMPurify.sanitize(
  html ? (s || '') : marked.parse(s || ''),
  { ADD_TAGS: ['lite-youtube'], ADD_ATTR: ['videoid', 'nocookie', 'params'] },
);

export const hasMarkdown = (s) => /[*_#>`\[\]\\]/.test(s?.trim() ?? '');

export const toInstant = ts =>
  ts == null ? null
  : Temporal.Instant.fromEpochMilliseconds(ts.toMillis?.() ?? +ts);

export const fmtISO = ts => toInstant(ts)?.toString() ?? '';

export const wasEdited = d => {
  const u = toInstant(d.updatedAt), c = toInstant(d.createdAt);
  return u != null && c != null && Temporal.Instant.compare(u, c) > 0;
};

export const fmtAbsolute = ts => {
  const d = toInstant(ts);
  if (!d) return '';
  const date = new Date(d.epochMilliseconds);
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${month}, ${date.getFullYear()} - ${hh}:${mm}`;
};

export const timeAgo = ts => {
  const d = toInstant(ts);
  if (!d) return '';
  const secs = Math.round((Date.now() - d.epochMilliseconds) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

export const articleMetaHover = data => {
  if (!data) return '';
  const ms = ts => ts?.toMillis?.() ?? 0;
  const candidates = [
    { key: 'posted', ts: data.createdAt, show: true },
    { key: 'active', ts: data.lastReplyAt, show: !!data.lastReplyAt && ms(data.lastReplyAt) !== ms(data.createdAt) },
    { key: 'edited', ts: data.updatedAt, show: wasEdited(data) },
  ].filter(m => m.show && m.ts);
  if (!candidates.length) return '';
  const latest = candidates.reduce((a, b) => ms(b.ts) > ms(a.ts) ? b : a);
  return `${latest.key} ${timeAgo(latest.ts)}`;
};

export const SANITIZERS = {
  collapse: v => v.trim().replace(/\s+/g, ' '),
  trim:     v => v.trim(),
};

export const safePhoto = v => typeof v === 'string' && v.startsWith('https://') ? v : '';

// Window globals for inline HTML access
window.fmtISO           = fmtISO;
window.fmtAbsolute      = fmtAbsolute;
window.articleMetaHover = articleMetaHover;
window.md               = md;
