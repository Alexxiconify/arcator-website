import { searchDocs, recentResults, searchReady } from './search.js';

// Navigation API with location.assign fallback (Firefox lacks Navigation API)
const navigate = 'navigation' in globalThis
  ? (url) => globalThis.navigation.navigate(url)
  : (url) => location.assign(url);

const KIND_LABEL = { thread: 'Thread', message: 'Reply', page: 'Page', wiki: 'Wiki', profile: 'User' };

// Module-scope DOM refs — assigned in initUI
let indicator = null;
let helpDialog = null;
let cmdDialog = null;

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const inInput = () => {
  const el = document.activeElement;
  return el && (EDITABLE.has(el.tagName) || el.isContentEditable);
};

const G_CHORDS = {
  h: () => './index.html',
  f: () => './forms.html',
  w: () => './wiki.html',
  v: () => 'https://jylina.arcator.co.uk/hub',
  r: () => './resources.html',
  n: () => (Alpine?.store('auth')?.user ? './forms.html' : null),
  p: () => (Alpine?.store('auth')?.user ? './users.html' : null),
};

let gTimer = null;
function setG(on) {
  if (!indicator) return;
  on ? indicator.showPopover() : indicator.hidePopover();
  clearTimeout(gTimer);
  if (on) gTimer = setTimeout(() => setG(false), 1500);
}

let indexReady = false;

searchReady.then(() => { indexReady = true; });

function openPalette() {
  cmdDialog?.showModal();
  const input = cmdDialog?.querySelector('input');
  if (input) {
    input.focus();
    if (!indexReady) {
      renderResults([{ title: 'Indexing search...', kind: 'loading', href: '#' }]);
      searchReady.then(() => renderResults(recentResults()));
    } else {
      renderResults(recentResults());
    }
  }
}

// Single merged listener for all keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Search palette — works everywhere
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    cmdDialog?.open ? cmdDialog.close() : openPalette();
    return;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (inInput()) return;
  if (document.querySelector('dialog[open]')) return;
  if (Alpine?.store('auth')?.profile?.keyboardShortcuts === 'disabled') return;

  const { key } = e;

  // g-chord in progress
  if (indicator?.matches(':popover-open')) {
    setG(false);
    const dest = G_CHORDS[key];
    const path = dest?.();
    if (path) { e.preventDefault(); navigate(path); }
    return;
  }

  switch (key) {
    case 'g': e.preventDefault(); setG(true); break;
    case '?': helpDialog?.showModal(); break;
  }
});

// DOM construction — no innerHTML for dynamic content
function renderResults(results) {
  const ul = cmdDialog?.querySelector('ul');
  if (!ul) return;

  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'cmd-empty';
    li.textContent = 'No results';
    ul.replaceChildren(li);
    return;
  }

  ul.replaceChildren(
    ...results.map((r) => {
      const kind = Object.assign(document.createElement('span'), {
        className: 'cmd-kind',
        textContent: KIND_LABEL[r.kind] ?? r.kind,
      });
      const title = Object.assign(document.createElement('span'), {
        textContent: r.title || r.href,
      });
      const a = Object.assign(document.createElement('a'), {
        className: 'cmd-result',
        href: r.href,
      });
      a.append(kind, title);
      const li = document.createElement('li');
      li.append(a);
      return li;
    }),
  );
}

function buildShortcutRows() {
  return [
    ['Ctrl+K', 'Open search'],
    ['?', 'Show shortcuts'],
    ['g h', 'Home'],
    ['g f', 'Forums'],
    ['g w', 'Wiki'],
    ['g v', 'Hub Maps'],
    ['g r', 'Resources'],
    ['g n', 'New thread'],
    ['g p', 'Your profile'],
  ].map(([k, v]) => {
    const kbd = Object.assign(document.createElement('kbd'), { textContent: k });
    const tdKey = document.createElement('td');
    tdKey.style.cssText = 'padding:.35rem .75rem .35rem 0;white-space:nowrap';
    tdKey.append(kbd);
    const tdDesc = Object.assign(document.createElement('td'), { textContent: v });
    tdDesc.style.cssText = 'padding:.35rem 0;opacity:.75';
    const tr = document.createElement('tr');
    tr.append(tdKey, tdDesc);
    return tr;
  });
}

function wireCmdDialog() {
  const input = cmdDialog.querySelector('input');
  const ul = cmdDialog.querySelector('ul');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    renderResults(q ? searchDocs(q) : recentResults());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const target = cmdDialog.querySelector('.cmd-result:focus') ?? cmdDialog.querySelector('.cmd-result');
      if (target) { navigate(target.href); cmdDialog.close(); }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdDialog.querySelector('.cmd-result')?.focus();
    }
  });

  ul.addEventListener('keydown', (e) => {
    const links = [...ul.querySelectorAll('.cmd-result')];
    const idx = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      links[idx + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx <= 0 ? input.focus() : links[idx - 1]?.focus();
    }
  });

  ul.addEventListener('click', (e) => {
    if (e.target.closest('.cmd-result')) cmdDialog.close();
  });

  cmdDialog.addEventListener('close', () => {
    input.value = '';
    ul.replaceChildren();
  });

  // Close on backdrop click
  cmdDialog.addEventListener('click', (e) => {
    if (e.target === cmdDialog) cmdDialog.close();
  });
}

function initUI() {
  const style = document.createElement('style');
  style.textContent = `
    #vim-indicator {
      position: fixed; bottom: 1rem; right: 1rem; inset: auto 1rem 1rem auto;
      font-size: .75rem; padding: .25rem .6rem;
      background: var(--arc-primary); color: #fff;
      border-radius: .25rem; pointer-events: none;
      margin: 0; border: none;
    }
    #cmd-dialog {
      border: none; padding: 0; background: transparent;
      position: fixed; top: 5rem; left: 50%; transform: translateX(-50%);
      width: min(560px, 90vw); margin: 0; overflow: visible;
    }
    #cmd-dialog::backdrop { background: rgba(0,0,0,.5); backdrop-filter: blur(2px); }
    #cmd-dialog input { width: 100%; margin: 0; padding: .5rem .75rem; border-radius: .375rem; }
    #cmd-results { list-style: none; padding: 0; margin: 0; max-height: 320px; overflow-y: auto; }
    .cmd-result {
      display: flex; align-items: center; gap: .75rem;
      padding: .55rem 1rem; color: inherit; text-decoration: none;
      border-top: 1px solid var(--glass-border);
    }
    .cmd-result:hover, .cmd-result:focus { background: rgba(255,255,255,.05); outline: none; }
    .cmd-kind { opacity: .5; font-size: .7rem; min-width: 4rem; }
    .cmd-empty { padding: .75rem 1rem; opacity: .5; font-size: .875rem; }
    #keys-help { border: none; padding: 0; background: transparent; }
    #keys-help::backdrop { background: rgba(0,0,0,.5); backdrop-filter: blur(2px); }
  `;
  document.head.appendChild(style);

  // Popover API for vim g-chord indicator (top-layer, no z-index wars)
  indicator = document.createElement('kbd');
  indicator.id = 'vim-indicator';
  indicator.setAttribute('popover', 'manual');
  indicator.textContent = 'g–';

  // keys-help dialog
  helpDialog = document.createElement('dialog');
  helpDialog.id = 'keys-help';

  const helpCard = document.createElement('div');
  helpCard.className = 'glass-card p-4';
  helpCard.style.cssText = 'min-width:260px;max-width:400px';

  const helpHeader = document.createElement('div');
  helpHeader.className = 'd-flex justify-content-between align-items-center mb-3';
  const helpTitle = Object.assign(document.createElement('strong'), { textContent: 'Keyboard shortcuts' });
  const closeBtn = Object.assign(document.createElement('button'), { className: 'btn-link', textContent: '✕' });
  closeBtn.addEventListener('click', () => helpDialog.close());
  helpHeader.append(helpTitle, closeBtn);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse';
  const tbody = document.createElement('tbody');
  tbody.append(...buildShortcutRows());
  table.append(tbody);

  const hint = Object.assign(document.createElement('p'), {
    className: 'small mt-3 mb-0',
    textContent: 'Disable in Profile → Preferences → Keyboard Shortcuts',
  });
  hint.style.opacity = '.5';

  helpCard.append(helpHeader, table, hint);
  helpDialog.append(helpCard);
  helpDialog.addEventListener('click', (e) => { if (e.target === helpDialog) helpDialog.close(); });

  // cmd-dialog (Ctrl+K search palette)
  cmdDialog = document.createElement('dialog');
  cmdDialog.id = 'cmd-dialog';

  const cmdCard = document.createElement('div');
  cmdCard.className = 'glass-card';
  cmdCard.style.cssText = 'padding:0;overflow:hidden';

  const inputWrap = document.createElement('div');
  inputWrap.style.padding = '.5rem';
  const searchInput = Object.assign(document.createElement('input'), {
    type: 'search',
    className: 'search-input',
    placeholder: 'Search pages, threads, wiki…',
    autocomplete: 'off',
  });
  inputWrap.append(searchInput);

  const resultList = document.createElement('ul');
  resultList.id = 'cmd-results';
  resultList.setAttribute('role', 'listbox');

  cmdCard.append(inputWrap, resultList);
  cmdDialog.append(cmdCard);

  document.body.append(indicator, helpDialog, cmdDialog);
  wireCmdDialog();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
