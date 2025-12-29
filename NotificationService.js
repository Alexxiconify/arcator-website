import { db, COLLECTIONS, doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from './firebase-init.js';

// Notification types
const TYPES = { COMMENT: 'comment', MENTION: 'mention', DM: 'dm', SYSTEM: 'system' };

const NotificationService = {
    async _queue(notification, channel, to = null) {
        await addDoc(collection(db, 'notification_queue'), { ...notification, channel, ...(to ? { to } : {}) });
    },

    async send(userId, type, title, message, data = {}) {
        const profile = await this.getProfile(userId);
        if (!profile) return;

        const notification = { userId, type, title, message, data, read: false, createdAt: serverTimestamp() };

        if (profile.emailNotifications && profile.email) await this._queue(notification, 'email', profile.email);
        if (profile.pushNotifications) await this._queue(notification, 'push');
        if (profile.discordNotifications && profile.discordId) await this._queue(notification, 'discord', profile.discordId);

        await addDoc(collection(db, COLLECTIONS.USER_PROFILES, userId, 'notifications'), notification);
    },

    async getProfile(userId) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, userId));
            return snap.exists() ? snap.data() : null;
        } catch { return null; }
    },

    async canUseDiscord(userId) {
        const profile = await this.getProfile(userId);
        return !!profile?.discordId;
    },

    async getNotifications(userId, limit = 20) {
        try {
            const { getDocs, query, orderBy, limit: limitFn } = await import('./firebase-init.js');
            const q = query(collection(db, COLLECTIONS.USER_PROFILES, userId, 'notifications'), orderBy('createdAt', 'desc'), limitFn(limit));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    async markRead(userId, notificationId) {
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, userId, 'notifications', notificationId), { read: true });
    },

    async markAllRead(userId) {
        const notifications = await this.getNotifications(userId, 100);
        await Promise.all(notifications.filter(n => !n.read).map(n => this.markRead(userId, n.id)));
    },

    notifyComment(uid, name, title, fid) { return this.send(uid, TYPES.COMMENT, 'New Comment', `${name} commented on "${title}"`, { fid, type: 'comment' }); },
    notifyReply(uid, name, fid) { return this.send(uid, TYPES.COMMENT, 'New Reply', `${name} replied to your comment`, { fid, type: 'reply' }); },
    notifyDM(uid, name, cid) { return this.send(uid, TYPES.DM, 'New Message', `${name} sent you a message`, { cid, type: 'dm' }); },
    notifyMention(uid, name, ctx, ctxId) { return this.send(uid, TYPES.MENTION, 'You were mentioned', `${name} mentioned you`, { ctx, ctxId, type: 'mention' }); },

    TYPES
};

export default NotificationService;
