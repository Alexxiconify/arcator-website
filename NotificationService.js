import { db, COLLECTIONS, doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from './firebase-init.js';

// Notification types
const TYPES = { COMMENT: 'comment', MENTION: 'mention', DM: 'dm', SYSTEM: 'system' };

const NotificationService = {
    // Queue notification in Firebase for backend processing
    async send(userId, type, title, message, data = {}) {
        const profile = await this.getProfile(userId);
        if (!profile) return;

        const notification = {
            userId,
            type,
            title,
            message,
            data,
            read: false,
            createdAt: serverTimestamp()
        };

        // Queue for email if enabled
        if (profile.emailNotifications && profile.email) {
            await addDoc(collection(db, 'notification_queue'), {
                ...notification,
                channel: 'email',
                to: profile.email
            });
        }

        // Queue for push if enabled
        if (profile.pushNotifications) {
            await addDoc(collection(db, 'notification_queue'), {
                ...notification,
                channel: 'push'
            });
        }

        // Queue for Discord if enabled AND linked
        if (profile.discordNotifications && profile.discordId) {
            await addDoc(collection(db, 'notification_queue'), {
                ...notification,
                channel: 'discord',
                discordId: profile.discordId
            });
        }

        // Store in user notifications
        await addDoc(collection(db, COLLECTIONS.USER_PROFILES, userId, 'notifications'), notification);
    },

    async getProfile(userId) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, userId));
            return snap.exists() ? snap.data() : null;
        } catch { return null; }
    },

    // Check if Discord notifications are available for user
    async canUseDiscord(userId) {
        const profile = await this.getProfile(userId);
        return !!(profile?.discordId || profile?.discordURL);
    },

    // Get user's notifications
    async getNotifications(userId, limit = 20) {
        try {
            const { getDocs, query, orderBy, limit: limitFn } = await import('./firebase-init.js');
            const q = query(
                collection(db, COLLECTIONS.USER_PROFILES, userId, 'notifications'),
                orderBy('createdAt', 'desc'),
                limitFn(limit)
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    // Mark notification as read
    async markRead(userId, notificationId) {
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, userId, 'notifications', notificationId), { read: true });
    },

    // Mark all as read
    async markAllRead(userId) {
        const notifications = await this.getNotifications(userId, 100);
        await Promise.all(notifications.filter(n => !n.read).map(n => this.markRead(userId, n.id)));
    },

    // Notify on new comment
    async notifyComment(forumAuthorId, commenterName, forumTitle, forumId) {
        await this.send(forumAuthorId, TYPES.COMMENT, 'New Comment', 
            `${commenterName} commented on "${forumTitle}"`,
            { forumId, type: 'comment' }
        );
    },

    // Notify on reply
    async notifyReply(parentAuthorId, replierName, forumId) {
        await this.send(parentAuthorId, TYPES.COMMENT, 'New Reply',
            `${replierName} replied to your comment`,
            { forumId, type: 'reply' }
        );
    },

    // Notify on new DM
    async notifyDM(recipientId, senderName, convId) {
        await this.send(recipientId, TYPES.DM, 'New Message',
            `${senderName} sent you a message`,
            { convId, type: 'dm' }
        );
    },

    // Notify on mention
    async notifyMention(mentionedUserId, mentionerName, context, contextId) {
        await this.send(mentionedUserId, TYPES.MENTION, 'You were mentioned',
            `${mentionerName} mentioned you`,
            { context, contextId, type: 'mention' }
        );
    },

    TYPES
};

export default NotificationService;
