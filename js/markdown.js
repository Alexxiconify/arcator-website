import { marked } from 'https://cdn.jsdelivr.net/npm/marked/+esm';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/+esm';

const _ytRe =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:\S+=\S+&)*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})[^\n]*(?:\n|$)/;

marked.use({
  gfm: true,
  extensions: [
    {
      name: 'youtube',
      level: 'block',
      start: (src) => {
        const m = src.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//);
        return m?.index ?? -1;
      },
      tokenizer(src) {
        const m = _ytRe.exec(src);
        if (m) {
          return { type: 'youtube', raw: m[0], videoId: m[1] };
        }
      },
      renderer: (t) =>
        `<lite-youtube videoid="${t.videoId}" nocookie params="rel=0"></lite-youtube>\n`,
    },
    {
      name: 'spoiler',
      level: 'inline',
      start: (src) => src.indexOf('||'),
      tokenizer(src) {
        const m = src.match(/^\|\|([^|]+)\|\|/);
        if (m) {
          return { type: 'spoiler', raw: m[0], text: m[1] };
        }
      },
      renderer: (t) => `<span class="spoiler">${t.text}</span>`,
    },
  ],
});

export const md = (s, { html = false } = {}) =>
  DOMPurify.sanitize(html ? s || '' : marked.parse(s || ''), {
    ADD_TAGS: ['lite-youtube'],
    ADD_ATTR: ['videoid', 'nocookie', 'params'],
  });

export const hasMarkdown = (s) => /[*_#>`[\]\\]/.test(s?.trim() ?? '');

window.md = md;
