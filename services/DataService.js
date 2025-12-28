import { db, COLLECTIONS, collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from '../firebase-init.js';

const DataService = {
    async getForums(opts = {}) {
        try {
            const q = query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async getForum(id) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.FORMS, id));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch { return null; }
    },

    async createForum(data, userId) {
        const forum = { ...data, authorId: userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), commentCount: 0, votes: 0 };
        const ref = await addDoc(collection(db, COLLECTIONS.FORMS), forum);
        return { id: ref.id, ...forum };
    },

    async updateForum(id, data) { await updateDoc(doc(db, COLLECTIONS.FORMS, id), { ...data, updatedAt: serverTimestamp() }); },
    async deleteForum(id) { await deleteDoc(doc(db, COLLECTIONS.FORMS, id)); },

    async getComments(forumId, opts = {}) {
        try {
            const q = query(collection(db, COLLECTIONS.FORMS, forumId, 'comments'), orderBy('createdAt', 'asc'), limit(opts.maxResults || 100));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async addComment(forumId, data, userId, profile) {
        const comment = { content: data.content, authorId: userId, authorName: profile?.displayName || 'Anonymous', authorPhoto: profile?.photoURL || './defaultuser.png', parentCommentId: data.parentCommentId || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        const ref = await addDoc(collection(db, COLLECTIONS.FORMS, forumId, 'comments'), comment);
        return { id: ref.id, ...comment };
    },

    async updateComment(forumId, commentId, data) { await updateDoc(doc(db, COLLECTIONS.FORMS, forumId, 'comments', commentId), { ...data, updatedAt: serverTimestamp() }); },
    async deleteComment(forumId, commentId) { await deleteDoc(doc(db, COLLECTIONS.FORMS, forumId, 'comments', commentId)); },

    async getPages(opts = {}) {
        try {
            const q = query(collection(db, COLLECTIONS.PAGES), orderBy('createdAt', 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async getPage(id) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.PAGES, id));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch { return null; }
    },

    async getUsers(opts = {}) {
        try {
            const q = query(collection(db, COLLECTIONS.USER_PROFILES), orderBy('createdAt', 'desc'), limit(opts.maxResults || 100));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async getDMs(userId) {
        if (!userId) return [];
        try {
            const snap = await getDocs(collection(db, COLLECTIONS.DMS(userId)));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async getMessages(userId, dmId, opts = {}) {
        if (!userId || !dmId) return [];
        try {
            const q = query(collection(db, COLLECTIONS.MESSAGES(userId, dmId)), orderBy('createdAt', 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        } catch { return []; }
    },

    subscribeToComments(forumId, cb) {
        return onSnapshot(query(collection(db, COLLECTIONS.FORMS, forumId, 'comments'), orderBy('createdAt', 'asc')), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    },

    subscribeToMessages(userId, dmId, cb) {
        return onSnapshot(query(collection(db, COLLECTIONS.MESSAGES(userId, dmId)), orderBy('createdAt', 'asc')), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
};

export default DataService;
