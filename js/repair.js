import { PROFILE_ZEROED } from './constants.js';
import { db, deleteField, doc, updateDoc } from './firebase.js';
import { removeDoc } from './search.js';
import { editFlags, signalCron } from './writes.js';

//  Queue ─

const _pending = new Set();
let _chain = Promise.resolve();

function enqueue(key, fn) {
  if (_pending.has(key)) {
    return;
  }
  _pending.add(key);
  _chain = _chain.then(fn).finally(() => _pending.delete(key));
}

//  Pure helpers 

function cleanReactionsMap(reactions) {
  let dirty = false;
  const out = {};
  let count = 0;
  for (const [uid, sub] of Object.entries(reactions)) {
    if (count >= 200) {
      dirty = true;
      break;
    }
    if (!sub || typeof sub !== 'object') {
      dirty = true;
      continue;
    }
    const entries = Object.entries(sub);
    const clean = entries.filter(([, v]) => v === true).slice(0, 20);
    if (clean.length !== entries.length) {
      dirty = true;
    }
    if (clean.length) {
      out[uid] = Object.fromEntries(clean);
      count++;
    } else {
      dirty = true;
    }
  }
  return dirty ? out : null;
}

//  Repair ops 

let _cronSignaled = false;

function nudgeCron() {
  if (_cronSignaled) {
    return;
  }
  _cronSignaled = true;
  signalCron();
}

export function maybeRepair(d) {
  if (!d) {
    return;
  }
  const auth = Alpine.store('auth');
  const uid = auth.user?.uid;
  const admin = auth.admin;

  // A3: search index — prune stale entries for empty messages
  if (d.kind === 'message' && !d.body?.trim()) {
    removeDoc(d.id);
  }

  // A2: profile cache resync
  if (d.kind === 'profile' && d.authorId) {
    const cached = Alpine.store('profiles')[d.authorId];
    if (cached && (cached.title !== d.title || cached.photoURL !== d.photoURL)) {
      Alpine.store('profiles')[d.authorId] = { title: d.title, photoURL: d.photoURL };
    }
  }

  if (!d.reactions || !uid) {
    return;
  }
  const ref = () => doc(db, 'docs', d.id);

  if (admin) {
    // B1: full reactions normalization
    const cleaned = cleanReactionsMap(d.reactions);
    if (cleaned) {
      enqueue(`react:${d.id}`, () => updateDoc(ref(), { reactions: cleaned }));
    }

    // B2: message with allowReplies=true violates domain
    if (d.kind === 'message' && d.allowReplies === true && d.updatedAt) {
      enqueue(`flags:${d.id}`, () => editFlags(ref(), d.updatedAt, { allowReplies: false }));
    }

    // B3: lastReplyAt < createdAt anomaly
    if (
      d.lastReplyAt?.toMillis &&
      d.createdAt?.toMillis &&
      d.lastReplyAt.toMillis() < d.createdAt.toMillis()
    ) {
      nudgeCron();
    }

    // B4: sentinel profile past grace window (7 days)
    if (
      d.kind === 'profile' &&
      d.title === PROFILE_ZEROED.title &&
      d.body === PROFILE_ZEROED.body &&
      d.updatedAt?.toMillis &&
      d.updatedAt.toMillis() < Date.now() - 7 * 86_400_000
    ) {
      nudgeCron();
    }
  } else if (auth.canWrite) {
    // A1: own-submap reactions cleanup
    const sub = d.reactions[uid];
    if (!sub) {
      return;
    }
    const cleaned = cleanReactionsMap({ [uid]: sub });
    if (!cleaned) {
      return;
    }
    const patch = cleaned[uid];
    enqueue(`react:${d.id}`, () =>
      updateDoc(ref(), { [`reactions.${uid}`]: patch ?? deleteField() }),
    );
  }
}
