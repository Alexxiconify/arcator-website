import MiniSearch from 'https://cdn.jsdelivr.net/npm/minisearch/+esm';

const ms = new MiniSearch({
  fields: ['title', 'body'],
  storeFields: ['title', 'kind', 'href', 'body'],
});

const _recentIds = [];

export function indexDoc(d) {
  if (!d || (d.kind === 'message' && !d.body?.trim())) {
    return;
  }
  let href = `/docs/${d.id}`;
  if (d.kind === 'profile') {
    href = `/profile/${d.authorId}`;
  } else if (d.kind === 'message') {
    const isProfile = d.parent.startsWith('u_');
    href = isProfile ? `/profile/${d.parent.slice(2)}` : `/docs/${d.parent}`;
  }
  const entry = {
    id: d.id,
    title: d.title ?? '',
    body: (d.body ?? '').slice(0, 2000),
    kind: d.kind,
    href,
  };
  ms.has(d.id) ? ms.replace(entry) : ms.add(entry);
  if (d.kind !== 'message') {
    const i = _recentIds.indexOf(d.id);
    if (i !== -1) {
      _recentIds.splice(i, 1);
    }
    _recentIds.unshift(d.id);
    if (_recentIds.length > 12) {
      _recentIds.pop();
    }
  }
}

// Lightweight index for author stubs loaded by hydrateAuthors.
// Does not overwrite a full profile already indexed by indexDoc.
export function indexStub(uid, title) {
  const id = `u_${uid}`;
  if (!ms.has(id)) {
    ms.add({ id, title, body: '', kind: 'profile', href: `/profile/${uid}` });
  }
}

export function recentResults() {
  return _recentIds.map((id) => ms.getStoredFields(id)).filter(Boolean);
}

export function removeDoc(id) {
  if (ms.has(id)) ms.remove({ id });
  const i = _recentIds.indexOf(id);
  if (i !== -1) _recentIds.splice(i, 1);
}

export function searchDocs(query) {
  return ms
    .search(query, {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3 },
      boostDocument: (_, __, f) => (f.kind === 'message' ? 0.5 : 1),
    })
    .slice(0, 15);
}
export function markSearchReady() {
  console.log('Search index is ready.');
}
