import MiniSearch from 'https://cdn.jsdelivr.net/npm/minisearch/+esm';

const ms = new MiniSearch({
  fields: ['title', 'body'],
  storeFields: ['title', 'kind', 'href', 'body'],
});

let readyResolve;
export const searchReady = new Promise(r => readyResolve = r);

let readySections = 0;
export function markSearchReady() {
  if (++readySections >= 3) readyResolve();
}

// Map as ordered LRU: O(1) insert/delete/check; insertion order = oldest→newest
const _recents = new Map();
const MAX_RECENTS = 12;

export function indexDoc(d) {
  const isPage = d.kind === 'page';
  const href =
    d.kind === 'thread' ? './forms.html'
    : d.kind === 'wiki'   ? './wiki.html'
    : `./pages.html?id=${d.id}`;

  const entry = {
    id: d.id,
    title: d.title ?? '',
    body: isPage ? (d.body ?? '').slice(0, 2000) : '',
    kind: d.kind,
    href,
  };
  ms.has(d.id) ? ms.replace(entry) : ms.add(entry);

  _recents.delete(d.id);
  _recents.set(d.id, true);
  if (_recents.size > MAX_RECENTS) _recents.delete(_recents.keys().next().value);
}

export function recentResults() {
  return [..._recents.keys()].reverse().map(id => ms.getStoredFields(id)).filter(Boolean);
}

export function removeDoc(id) {
  if (ms.has(id)) ms.remove({ id, ...ms.getStoredFields(id) });
  _recents.delete(id);
}

export function searchDocs(query) {
  return ms.search(query, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 3 },
  }).slice(0, 15);
}
