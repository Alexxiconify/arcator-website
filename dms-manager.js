import {
    auth,
    collection,
    COLLECTIONS,
    db,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from './firebase-init.js';
import {showMessageBox} from './utils.js';

class DMsManager {
    constructor() {
        this.currentUser = null;
        this.messageListeners = new Map();
    }

    async init() {
        this.currentUser = auth.currentUser;
        if (!this.currentUser) return;
        try {
            return await this.loadUserDMs();
        } catch (error) {
            console.error('Error initializing DMs:', error);
            showMessageBox('Failed to load messages', true);
        }
    }

    async loadUserDMs() {
        if (!this.currentUser) return [];
        try {
            const q = query(collection(db, COLLECTIONS.DMS), where('participants', 'array-contains', this.currentUser.uid));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error('Error loading DMs:', error);
            return [];
        }
    }

    async getDM(dmId) {
        if (!this.currentUser || !dmId) return null;
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.DMS, dmId));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch (error) {
            return null;
        }
    }

    async getOrCreateDM(otherUserId) {
        if (!this.currentUser || !otherUserId) return null;
        const q = query(collection(db, COLLECTIONS.DMS), where('participants', 'array-contains', this.currentUser.uid));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            if (d.data().participants?.includes(otherUserId)) return { id: d.id, ...d.data() };
        }
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const data = { createdAt: serverTimestamp(), participants: [this.currentUser.uid, otherUserId], lastMessage: null, lastMessageAt: null };
        await setDoc(doc(db, COLLECTIONS.DMS, id), data);
        return { id, ...data };
    }

    async sendMessage(dmId, content) {
        if (!this.currentUser || !dmId || !content) return null;
        try {
            const dm = await this.getDM(dmId);
            if (!dm) throw new Error('DM not found');
            const receiverIds = dm.participants.filter(p => p !== this.currentUser.uid);
            const messageData = { conversationId: dmId, content, sender: this.currentUser.uid, receiverIds, createdAt: serverTimestamp(), edited: false };
            const messageRef = doc(collection(db, COLLECTIONS.MESSAGES));
            await setDoc(messageRef, messageData);
            await updateDoc(doc(db, COLLECTIONS.DMS, dmId), { lastMessage: content, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
            return { id: messageRef.id, ...messageData };
        } catch (error) {
            showMessageBox('Failed to send message', true);
            return null;
        }
    }

    async editMessage(messageId, newContent) {
        if (!this.currentUser || !messageId || !newContent) return false;
        try {
            const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
            const snap = await getDoc(ref);
            if (!snap.exists() || snap.data().sender !== this.currentUser.uid) throw new Error('Unauthorized');
            await updateDoc(ref, { content: newContent, edited: true, editedAt: serverTimestamp() });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteMessage(messageId) {
        if (!this.currentUser || !messageId) return false;
        try {
            const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
            const snap = await getDoc(ref);
            if (!snap.exists() || snap.data().sender !== this.currentUser.uid) throw new Error('Unauthorized');
            const data = snap.data();
            await deleteDoc(ref);
            const dm = await this.getDM(data.conversationId);
            if (dm && dm.lastMessage === data.content) {
                const recent = await this.getRecentMessages(data.conversationId, 1);
                await updateDoc(doc(db, COLLECTIONS.DMS, data.conversationId), { lastMessage: recent[0]?.content || null, lastMessageAt: recent[0]?.createdAt || null });
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    async getRecentMessages(dmId, limitCount = 1) {
        if (!this.currentUser || !dmId) return [];
        try {
            const q = query(collection(db, COLLECTIONS.MESSAGES), where('conversationId', '==', dmId), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.slice(0, limitCount).map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            return [];
        }
    }

    subscribeToMessages(dmId, callback) {
        if (!this.currentUser || !dmId || !callback) return null;
        const q = query(collection(db, COLLECTIONS.MESSAGES), where('conversationId', '==', dmId), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, error => callback([]));
        this.messageListeners.set(dmId, unsubscribe);
        return unsubscribe;
    }

    cleanup() {
        this.messageListeners.forEach(u => u());
        this.messageListeners.clear();
    }
}

export {DMsManager};
export const dmsManager = new DMsManager();