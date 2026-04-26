import {
  auth,
  collection,
  db,
  deleteField,
  doc,
  FieldPath,
  getCountFromServer,
  getDoc,
  query,
  runTransaction,
  setDoc,
  srvTs,
  updateDoc,
  where,
  writeBatch,
} from './firebase.js';
import { PROFILE_ZEROED } from './constants.js';
import { isValidEmojiKey } from './sanitize.js';

export const customRef = id => doc(db, 'custom', id);
export const getCustom = async id => {
  try { const snap = await getDoc(customRef(id)); return snap.exists() ? snap.data().temp : null; }
  catch(e) { return null; /* */ }
};

//  Helpers 

export function requireVerified() {
  const u = auth.currentUser;
  if (!u || !u.emailVerified) throw new Error('verified auth required');
  return u.uid;
}

async function preflightParent(parentId) {
  const snap = await getDoc(doc(db, 'docs', parentId));
  if (!snap.exists()) throw new Error(`parent ${parentId} does not exist`);
  const parent = snap.data();
  if (!['article', 'profile'].includes(parent.kind))
    throw new Error(`message cannot have parent of kind ${parent.kind}`);
  if (parent.allowReplies !== true) throw new Error('parent does not allow replies');
}

//  Writes ─

export async function createArticle(input) {
  const uid = requireVerified();
  const ref = doc(collection(db, 'docs'));
  const data = {
    kind: 'article',
    authorId: uid,
    title: (input.title || 'Untitled').slice(0, 500),
    body: input.body,
    photoURL: (input.photoURL || '').startsWith('https://') ? input.photoURL.slice(0, 492) : '',
    allowReplies: input.allowReplies ?? true,
    allowPublicEdits: input.allowPublicEdits ?? false,
    pinned: false,
    featured: false,
    spoiler: false,
    reactions: {},
    createdAt: srvTs(),
    updatedAt: srvTs(),
    lastReplyAt: srvTs()
  };
  await setDoc(ref, data);
  await setDoc(customRef(ref.id), { temp: input.temp ?? '' });
  signalCron();
  return ref.id;
}

export async function createMessage(parentId, body) {
  const uid = requireVerified();
  const msgRef = doc(collection(db, 'docs'));
  const data = {
    kind: 'message',
    parent: parentId,
    authorId: uid,
    title: '',
    body,
    photoURL: '',
    allowReplies: false,
    allowPublicEdits: false,
    pinned: false,
    featured: false,
    spoiler: false,
    reactions: {},
    createdAt: srvTs(),
    updatedAt: srvTs(),
    lastReplyAt: srvTs()
  };
  await preflightParent(parentId);
  const batch = writeBatch(db);
  batch.set(msgRef, data);
  batch.set(customRef(msgRef.id), { temp: '' });
  batch.update(doc(db, 'docs', parentId), { lastReplyAt: srvTs() });
  await batch.commit();
  return msgRef.id;
}

export async function zeroProfile() {
  const uid = requireVerified();
  const ref = doc(db, 'docs', `u_${uid}`);
  await updateDoc(ref, { ...PROFILE_ZEROED, updatedAt: srvTs() });
  delete Alpine.store('profiles')[uid];
  signalCron();
}

export async function toggleReaction(ref, emoji, reactions) {
  if (!isValidEmojiKey(emoji)) throw new Error('invalid emoji');
  const uid = requireVerified();
  const userReactions = reactions[uid] ?? {};
  if (!userReactions[emoji] && Object.keys(userReactions).length >= 20)
    throw new Error('per-user reaction limit reached (20)');
  await updateDoc(
    ref,
    new FieldPath('reactions', uid, emoji),
    userReactions[emoji] ? deleteField() : true,
  );
}

export function signalCron() {
  updateDoc(doc(db, 'global', 'lastUpdate'), { clientSignal: srvTs() }).catch(() => {});
}

async function saveWithConflictDetection(ref, localUpdatedAt, fields) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('NOT_FOUND');
    const live = snap.data();
    if (!live.updatedAt.isEqual(localUpdatedAt)) throw new Error('CONFLICT');
    const { temp, ...core } = fields;
    tx.update(ref, { ...core, updatedAt: srvTs() });
    if (temp !== undefined) tx.set(customRef(ref.id), { temp });
  });
}

async function gatedSave(opName, allowed, ref, ts, changes) {
  const bad = Object.keys(changes).find((k) => !allowed.includes(k));
  if (bad) throw new Error(`${opName}: unexpected field "${bad}"`);
  await saveWithConflictDetection(ref, ts, changes);
}

export const editContent = (ref, ts, c) =>
  gatedSave('editContent', ['title', 'body', 'photoURL', 'bodyIsHTML', 'temp'], ref, ts, {
    ...c,
    title: c.title ? c.title.slice(0, 500) : undefined,
    photoURL: c.photoURL ? (c.photoURL.startsWith('https://') ? c.photoURL.slice(0, 492) : '') : undefined,
    bodyIsHTML: false,
  });
export const editFlags = (ref, ts, c) =>
  gatedSave(
    'editFlags',
    ['allowReplies', 'allowPublicEdits', 'pinned', 'featured', 'spoiler'],
    ref,
    ts,
    c,
  );

export function markRead(docId, lastReplyAtMs) {
  if (docId) localStorage.setItem(`arcator:lastread:${docId}`, String(lastReplyAtMs));
}

export async function getMsgCount(docId, lastReplyAtMs) {
  const key = `arcator:msgcount:${docId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { ts, count } = JSON.parse(raw);
      if (ts === lastReplyAtMs) return count;
    }
    const snap = await getCountFromServer(
      query(collection(db, 'docs'), where('parent', '==', docId), where('kind', '==', 'message')),
    );
    const count = snap.data().count;
    localStorage.setItem(key, JSON.stringify({ ts: lastReplyAtMs, count }));
    return count;
  } catch {
    return null;
  }
}

window.hasUnread = (docId, lastReplyAtMs) => {
  const raw = localStorage.getItem(`arcator:lastread:${docId}`);
  if (!raw) return lastReplyAtMs > 0;
  return Number(raw) !== lastReplyAtMs;
};
