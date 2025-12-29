import { db, COLLECTIONS, collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from './firebase-init.js';

const DataService = {
    async getForums(opts = {}) {
        try {
            const q = query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error('getForums:', e); return []; }
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
            const q = query(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), orderBy('createdAt', 'asc'), limit(opts.maxResults || 100));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error('getComments:', e); return []; }
    },

    async addComment(forumId, data, userId, profile) {
        const comment = { content: data.content, authorId: userId, authorName: profile?.displayName || 'Anonymous', authorPhoto: profile?.photoURL || './defaultuser.png', parentCommentId: data.parentCommentId || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        const ref = await addDoc(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), comment);
        return { id: ref.id, ...comment };
    },

    async updateComment(forumId, commentId, data) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), commentId), { ...data, updatedAt: serverTimestamp() }); },
    async deleteComment(forumId, commentId) { await deleteDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), commentId)); },

    async getPages(opts = {}) {
        try {
            const q = query(collection(db, COLLECTIONS.PAGES), orderBy('createdAt', 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error('getPages:', e); return []; }
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
        } catch (e) { console.error('getUsers:', e); return []; }
    },

    async getConversations(userId) {
        if (!userId) return [];
        try {
            const q = query(collection(db, COLLECTIONS.CONVERSATIONS), where('participants', 'array-contains', userId));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error('getConversations:', e); return []; }
    },

    async getMessages(convId, opts = {}) {
        if (!convId) return [];
        try {
            const q = query(collection(db, COLLECTIONS.CONV_MESSAGES(convId)), orderBy('createdAt', 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        } catch (e) { console.error('getMessages:', e); return []; }
    },

    subscribeToComments(forumId, cb) {
        return onSnapshot(query(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), orderBy('createdAt', 'asc')), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    },

    subscribeToMessages(convId, cb) {
        return onSnapshot(query(collection(db, COLLECTIONS.CONV_MESSAGES(convId)), orderBy('createdAt', 'asc')), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    },

    async sendMessage(convId, content, senderId) {
        const msg = { content, senderId, createdAt: serverTimestamp() };
        const ref = await addDoc(collection(db, COLLECTIONS.CONV_MESSAGES(convId)), msg);
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, convId), { lastMessage: content, lastMessageTime: serverTimestamp() });
        return { id: ref.id, ...msg };
    },

    async updateMessage(convId, msgId, data) {
        await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(convId), msgId), { ...data, updatedAt: serverTimestamp() });
    },

    async deleteMessage(convId, msgId) {
        await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(convId), msgId));
    },

    async createConversation(participants, name = null) {
        const conv = { participants, name, createdAt: serverTimestamp(), lastMessage: '', lastMessageTime: serverTimestamp() };
        const ref = await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), conv);
        return { id: ref.id, ...conv };
    },

    async searchUsersByHandle(handle) {
        if (!handle) return [];
        try {
            const q = query(collection(db, COLLECTIONS.USER_PROFILES), where('handle', '==', handle.toLowerCase()), limit(5));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async updateConversation(convId, data) {
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, convId), { ...data, updatedAt: serverTimestamp() });
    }
};

export default DataService;
