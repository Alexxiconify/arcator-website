import { db, doc, getDoc } from './firebase.js';
import { indexStub } from './search.js';

const _inFlight = new Map();

export async function getAuthorInfo(uid) {
  const store = Alpine?.store('profiles');
  if (!store) return { title: 'Anonymous', photoURL: '' };
  if (store[uid]) return store[uid];
  if (_inFlight.has(uid)) return _inFlight.get(uid);
  const promise = (async () => {
    try {
      const snap = await getDoc(doc(db, 'docs', `u_${uid}`));
      const v = snap.exists()
        ? { title: snap.data().title, photoURL: snap.data().photoURL }
        : { title: 'Anonymous', photoURL: '' };
      Alpine.store('profiles')[uid] = v;
      indexStub(uid, v.title);
      return v;
    } catch {
      return { title: 'Anonymous', photoURL: '' };
    } finally {
      _inFlight.delete(uid);
    }
  })();
  _inFlight.set(uid, promise);
  return promise;
}

export async function hydrateAuthors(docs) {
  const store = Alpine?.store('profiles') ?? {};
  const missing = [...new Set(docs.map((d) => d.authorId))].filter((uid) => !store[uid]);
  await Promise.all(missing.map(getAuthorInfo));
}
