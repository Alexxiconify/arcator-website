import { hasMarkdown } from './markdown.js';
import { SANITIZERS } from './sanitize.js';

//  Editor ─

const FIELD_DEFAULTS = {
  title: {
    name: 'title',
    type: 'text',
    max: 500,
    required: true,
    placeholder: 'Title',
    sanitize: 'collapse',
  },
  body: {
    name: 'body',
    type: 'textarea',
    min: 2,
    max: 40000,
    rows: 8,
    required: true,
    placeholder: 'Markdown',
    sanitize: 'trim',
  },
  photoURL: {
    name: 'photoURL',
    type: 'url',
    max: 500,
    pattern: 'https://.+',
    label: 'Photo URL',
    placeholder: 'https://...',
    sanitize: 'trim',
  },
};

function expandFields(fields) {
  return fields.map((f) =>
    typeof f === 'string' ? FIELD_DEFAULTS[f] || { name: f, type: 'text' } : f,
  );
}

export function reactionSummary(reactions, uid) {
  const out = {};
  for (const [reactor, emojis] of Object.entries(reactions))
    for (const e of Object.keys(emojis)) {
      const entry = (out[e] ??= { count: 0, mine: false, reactors: [] });
      entry.count++;
      if (reactor === uid) {
        entry.mine = true;
        entry.reactors.unshift(reactor);
      } else entry.reactors.push(reactor);
    }
  for (const entry of Object.values(out)) {
    const cap = entry.count <= 3 ? entry.count : entry.count <= 6 ? 3 : 2;
    entry.overflow = entry.count - cap;
    entry.reactors = entry.reactors.slice(0, cap);
  }
  return out;
}

export function askConfirm(message) {
  const dlg = document.getElementById('confirm-dialog');
  if (dlg.open) return Promise.resolve(false);
  dlg.querySelector('[data-msg]').textContent = message;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true });
  });
}

export function makeEditor(fields, submitFn, opts = {}) {
  const fieldDefs = expandFields(fields);
  const bodyField = fieldDefs.find((f) => f.type === 'textarea')?.name ?? null;
  const draftKeyFn = opts.draftKey
    ? typeof opts.draftKey === 'function'
      ? opts.draftKey
      : () => opts.draftKey
    : null;
  let _autosaveTimer = null;
  const _lsKey = () => {
    const k = draftKeyFn?.();
    return k ? `draft:${k}` : null;
  };
  const _save = (draft) => {
    const k = _lsKey();
    if (!k) return;
    const href = typeof opts.draftHref === 'function' ? opts.draftHref() : opts.draftHref;
    if (!href) return;
    localStorage.setItem(
      k,
      JSON.stringify({ draft, savedAt: Date.now(), href, kind: opts.draftKind }),
    );
  };
  const _clear = () => {
    const k = _lsKey();
    if (k) localStorage.removeItem(k);
  };
  const _load = () => {
    const k = _lsKey();
    const raw = k && localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  };
  return {
    editing: !!opts.startOpen,
    saving: false,
    err: '',
    draft: Object.fromEntries(fieldDefs.map((f) => [f.name, ''])),
    fieldDefs,
    bodyField,
    submitLabel: opts.submitLabel || 'Save',
    startOpen: !!opts.startOpen,
    hasMarkdown,
    _editorInit() {
      if (draftKeyFn && opts.startOpen) {
        const saved = _load();
        if (saved)
          fieldDefs.forEach((f) => {
            if (saved.draft[f.name] != null) this.draft[f.name] = saved.draft[f.name];
          });
      }
      if (draftKeyFn)
        this.$watch('draft', (d) => {
          clearTimeout(_autosaveTimer);
          _autosaveTimer = setTimeout(() => {
            const total = fieldDefs.reduce(
              (n, f) => n + (typeof d[f.name] === 'string' ? d[f.name].length : 0),
              0,
            );
            if (total <= 3) {
              _clear();
              return;
            }
            _save(d);
          }, 1000);
        });
    },
    start(data) {
      fieldDefs.forEach((f) => (this.draft[f.name] = data?.[f.name] ?? ''));
      if (draftKeyFn) {
        const saved = _load();
        if (saved)
          fieldDefs.forEach((f) => {
            if (saved.draft[f.name] != null) this.draft[f.name] = saved.draft[f.name];
          });
      }
      this.editing = true;
      this.err = '';
    },
    cancel() {
      this.editing = false;
      this.err = '';
      _clear();
    },
    startWithQuote({ body, authorName }) {
      this.start({
        body: '> ' + (authorName ?? 'User') + ' said:\n> ' + body.replace(/\n/g, '\n> ') + '\n\n',
      });
    },
    async save() {
      this.saving = true;
      this.err = '';
      try {
        const clean = Object.fromEntries(
          fieldDefs.map((f) => [
            f.name,
            typeof this.draft[f.name] === 'string' && f.sanitize
              ? (SANITIZERS[f.sanitize] ?? ((v) => v))(this.draft[f.name])
              : this.draft[f.name],
          ]),
        );
        for (const f of fieldDefs) {
          const v = clean[f.name];
          if (f.required && !v) throw new Error(`${f.label ?? f.name} is required.`);
          if (f.min && typeof v === 'string' && v.length < f.min)
            throw new Error(`${f.label ?? f.name} must be at least ${f.min} characters.`);
          if (f.max && typeof v === 'string' && v.length > f.max)
            throw new Error(`${f.label ?? f.name} exceeds ${f.max} characters.`);
        }
        await submitFn(clean);
        _clear();
        this.draft = Object.fromEntries(fieldDefs.map((f) => [f.name, '']));
        this.editing = !!opts.startOpen;
      } catch (e) {
        if (e.message === 'CONFLICT')
          this.err = 'Someone else edited this — reload to see changes, then retry.';
        else if (e.message === 'NOT_FOUND') this.err = 'This document no longer exists.';
        else this.err = e.message;
      } finally {
        this.saving = false;
      }
    },
  };
}
