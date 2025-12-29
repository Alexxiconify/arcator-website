import { db, COLLECTIONS, collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment } from './firebase-init.js';

const DataService = {
    async _list(col, opts = {}) {
        try {
            const q = query(collection(db, col), orderBy(opts.order || 'createdAt', opts.dir || 'desc'), limit(opts.maxResults || 50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(`_list ${col}:`, e); return []; }
    },
    async _get(col, id) {
        try {
            const snap = await getDoc(doc(db, col, id));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch { return null; }
    },
    async _add(col, data) {
        const docData = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        const ref = await addDoc(collection(db, col), docData);
        return { id: ref.id, ...docData };
    },
    async _update(col, id, data) { await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() }); },
    async _delete(col, id) { await deleteDoc(doc(db, col, id)); },

    getForums(opts) { return this._list(COLLECTIONS.FORMS, opts); },
    getForum(id) { return this._get(COLLECTIONS.FORMS, id); },
    async createForum(data, userId) { return this._add(COLLECTIONS.FORMS, { ...data, authorId: userId, commentCount: 0, votes: 0 }); },
    updateForum(id, data) { return this._update(COLLECTIONS.FORMS, id, data); },
    deleteForum(id) { return this._delete(COLLECTIONS.FORMS, id); },

    getComments(forumId, opts) { return this._list(COLLECTIONS.SUBMISSIONS(forumId), { ...opts, order: 'createdAt', dir: 'asc' }); },
    async addComment(forumId, data, userId, profile) {
        const comment = await this._add(COLLECTIONS.SUBMISSIONS(forumId), { 
            content: data.content, authorId: userId, authorName: profile?.displayName || 'Anonymous', 
            authorPhoto: profile?.photoURL || './defaultuser.png', parentCommentId: data.parentCommentId || null 
        });
        await this._update(COLLECTIONS.FORMS, forumId, { commentCount: increment(1) }).catch(() => {});
        return comment;
    },
    updateComment(forumId, commentId, data) { return this._update(COLLECTIONS.SUBMISSIONS(forumId), commentId, data); },
    async deleteComment(forumId, commentId) {
        await this._delete(COLLECTIONS.SUBMISSIONS(forumId), commentId);
        await this._update(COLLECTIONS.FORMS, forumId, { commentCount: increment(-1) }).catch(() => {});
    },

    getPages(opts) { return this._list(COLLECTIONS.PAGES, opts); },
    getPage(id) { return this._get(COLLECTIONS.PAGES, id); },
    createPage(data) { return this._add(COLLECTIONS.PAGES, data); },
    updatePage(id, data) { return this._update(COLLECTIONS.PAGES, id, data); },
    deletePage(id) { return this._delete(COLLECTIONS.PAGES, id); },

    getUsers(opts) { return this._list(COLLECTIONS.USER_PROFILES, opts); },
    
    async getConversations(userId) {
        if (!userId) return [];
        try {
            const q = query(collection(db, COLLECTIONS.CONVERSATIONS), where('participants', 'array-contains', userId));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error('getConversations:', e); return []; }
    },

    getMessages(convId, opts) { return this._list(COLLECTIONS.CONV_MESSAGES(convId), { ...opts, order: 'createdAt', dir: 'asc' }); },

    subscribeToComments(forumId, cb) {
        return onSnapshot(query(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), orderBy('createdAt', 'asc')), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    },
    subscribeToMessages(convId, cb) {
        return onSnapshot(query(collection(db, COLLECTIONS.CONV_MESSAGES(convId)), orderBy('createdAt', 'asc')), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    },

    async sendMessage(convId, content, senderId) {
        const msg = await this._add(COLLECTIONS.CONV_MESSAGES(convId), { content, senderId });
        await this._update(COLLECTIONS.CONVERSATIONS, convId, { lastMessage: content, lastMessageTime: serverTimestamp() });
        return msg;
    },
    updateMessage(convId, msgId, data) { return this._update(COLLECTIONS.CONV_MESSAGES(convId), msgId, data); },
    deleteMessage(convId, msgId) { return this._delete(COLLECTIONS.CONV_MESSAGES(convId), msgId); },

    async createConversation(participants, name = null, description = null) {
        return this._add(COLLECTIONS.CONVERSATIONS, { participants, name, description, lastMessage: '', lastMessageTime: serverTimestamp() });
    },
    async searchUsersByHandle(handle) {
        if (!handle) return [];
        try {
            const q = query(collection(db, COLLECTIONS.USER_PROFILES), where('handle', '==', handle.toLowerCase()), limit(5));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },
    updateConversation(convId, data) { return this._update(COLLECTIONS.CONVERSATIONS, convId, data); }
};

export default DataService;
