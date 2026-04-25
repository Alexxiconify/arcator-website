document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const dlg = document.getElementById('cmd-dialog');
    if (dlg?.open) dlg.close();
    else {
      dlg?.showModal();
      dlg?.querySelector('input')?.focus();
    }
  }
});

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const inInput = () => {
  const el = document.activeElement;
  return el && (EDITABLE.has(el.tagName) || el.isContentEditable);
};

const G_CHORDS = {
  h: () => '/',
  f: () => '/forum',
  w: () => '/wiki',
  v: () => '/maps',
  r: () => '/resources',
  n: () => (Alpine.store('auth').canWrite ? '/new' : null),
  p: () => {
    const uid = Alpine.store('auth').user?.uid;
    return uid ? `/profile/${uid}` : null;
  },
};

const indicator = document.getElementById('vim-indicator');
const dialog = document.getElementById('keys-help');
let gTimer = null;

function setG(on) {
  indicator.hidden = !on;
  clearTimeout(gTimer);
  if (on) {
    gTimer = setTimeout(() => setG(false), 300);
  }
}

function focusCard(dir) {
  const cards = [...document.querySelectorAll('[data-vim-card]')];
  if (!cards.length) {
    return;
  }
  const cur = cards.indexOf(document.activeElement);
  const next = cards.at(cur < 0 ? (dir > 0 ? 0 : -1) : cur + dir);
  next?.focus({ preventScroll: true });
  next?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function focusReply() {
  const ta = document.querySelector('[data-reply-zone] textarea');
  if (!ta) {
    return;
  }
  ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ta.focus();
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }
  if (inInput()) {
    return;
  }
  if (document.querySelector('dialog[open]')) {
    return;
  }

  const { key } = e;

  if (!indicator.hidden) {
    setG(false);
    const dest = G_CHORDS[key];
    if (dest) {
      const path = dest();
      if (path) {
        e.preventDefault();
        Alpine.store('nav').go(path);
      }
    }
    return;
  }

  switch (key) {
    case 'g':
      e.preventDefault();
      setG(true);
      break;
    case 'j':
      e.preventDefault();
      focusCard(1);
      break;
    case 'k':
      e.preventDefault();
      focusCard(-1);
      break;
    case 'o': {
      const el = document.activeElement;
      if (el && 'vimCard' in el.dataset) {
        el.click();
      }
      break;
    }
    case 'r':
      focusReply();
      break;
    case 'e':
      document.querySelector('[data-vim-edit]')?.click();
      break;
    case 'd':
      e.preventDefault();
      Alpine.store('listDensity').toggle();
      break;
    case '?':
      dialog.showModal();
      break;
  }
});
