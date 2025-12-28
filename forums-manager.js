<<<<<<< HEAD
import {
    addDoc,
    auth,
    collection,
    COLLECTIONS,
    db,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getUserProfileFromFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from './firebase-init.js';
import {showMessageBox} from './utils.js';
import {initializePage, loadNavbar} from './core.js';
import {themeManager} from './theme-manager.js';
import {HARD_CODED_ADMIN_UID} from './constants.js';

const ASSETS = {DEFAULT_USER: './defaultuser.png'};
const BTN_STYLE = 'background:none;border:none;color:var(--color-accent);cursor:pointer;padding:0;font-size:0.9rem;text-decoration:none;margin-right:0.75rem;';
const INPUT_STYLE = 'background:transparent !important;border:1px solid var(--color-accent);color:var(--color-text);padding:0.5rem;border-radius:0.375rem;width:100%;';

class ForumsManager {
    currentUser = null;
    userProfile = null;
    selectedUserId = null;
    currentDMId = null;
    messageUnsubscribe = null;
    conversationsUnsubscribe = null;
    profilesCache = new Map();

    getDMSRef() {
        return collection(db, 'conversations');
    }

    getDMDocRef(dmId) {
        return doc(db, 'conversations', String(dmId));
    }

    getMessagesRef(dmId) {
        return collection(db, 'conversations', String(dmId), 'messages');
    }

    formatTimestamp(timestamp) {
        if (!timestamp?.toDate) return '';
        const d = timestamp.toDate();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    async init() {
        try {
            this.currentUser = auth.currentUser;
            if (this.currentUser) {
                this.userProfile = await getUserProfileFromFirestore(this.currentUser.uid);
                this.profilesCache.set(this.currentUser.uid, this.userProfile);
            }
            await initializePage('forms');
            await themeManager.init();
            await loadNavbar(this.currentUser, this.userProfile);
            this.setupTabs();
            this.setupCreateThread();
            this.setupCreateMessage();
            await this.loadForums();
            this.loadMessages();
        } catch (error) { console.error('Init error:', error); }
    }

    setupTabs() {
        const btns = { forums: document.getElementById('forums-tab-btn'), messages: document.getElementById('messages-tab-btn') };
        const tabs = { forums: document.getElementById('forums-tab'), messages: document.getElementById('messages-tab') };
        const switchTab = (active) => Object.keys(btns).forEach(k => {
            btns[k]?.classList.toggle('active', k === active);
            tabs[k]?.classList.toggle('active', k === active);
        });
        btns.forums?.addEventListener('click', () => switchTab('forums'));
        btns.messages?.addEventListener('click', () => switchTab('messages'));
    }

    setupCreateThread() {
        const form = document.getElementById('create-thread-form');
        document.getElementById('create-thread-btn')?.addEventListener('click', () => form?.classList.toggle('visible'));
        document.getElementById('cancel-thread-btn')?.addEventListener('click', () => form?.classList.remove('visible'));
        document.getElementById('new-thread-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!auth.currentUser) return showMessageBox('Sign in required', true);
            try {
                await addDoc(collection(db, COLLECTIONS.FORMS), {
                    title: document.getElementById('thread-title')?.value.trim(),
                    description: document.getElementById('thread-description')?.value.trim(),
                    category: document.getElementById('thread-category')?.value,
                    tags: (document.getElementById('thread-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
                    createdAt: serverTimestamp(),
                    authorId: auth.currentUser.uid,
                    createdBy: auth.currentUser.displayName || auth.currentUser.email,
                    pinned: false, reactions: {}
                });
                showMessageBox('Thread created!');
                form?.classList.remove('visible');
                e.target.reset();
                await this.loadForums();
            } catch (error) { showMessageBox('Failed to create thread', true); }
        });
    }

    setupCreateMessage() {
        const form = document.getElementById('create-message-form');
        const searchInput = document.getElementById('recipient-search');
        const searchResults = document.getElementById('search-results');
        const startBtn = document.getElementById('start-conversation-btn');

        document.getElementById('create-message-btn')?.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display !== 'none') searchInput?.focus();
        });

        document.getElementById('cancel-message-btn')?.addEventListener('click', () => {
            form.style.display = 'none';
            searchInput.value = '';
            searchResults.style.display = 'none';
            this.selectedUserId = null;
            startBtn.disabled = true;
        });

        searchInput?.addEventListener('input', async (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (q.length < 2) return searchResults.style.display = 'none';
            const users = await this.searchUsers(q);
            this.displaySearchResults(users, searchResults);
            searchResults.querySelectorAll('.user-search-result').forEach(res => {
                res.addEventListener('click', () => {
                    this.selectedUserId = res.dataset.userId;
                    startBtn.disabled = false;
                    searchResults.style.display = 'none';
                    searchInput.value = res.dataset.userName;
                });
            });
        });

        startBtn?.addEventListener('click', async () => {
            if (!this.selectedUserId || !auth.currentUser) return;
            const dmId = await this.createOrGetConversation(auth.currentUser.uid, this.selectedUserId);
            form.style.display = 'none';
            setTimeout(() => {
                const dmItem = document.querySelector(`[data-dm-id="${dmId}"]`);
                if (dmItem) dmItem.click();
            }, 500);
        });
    }

    async searchUsers(queryStr) {
        const snapshot = await getDocs(collection(db, COLLECTIONS.USER_PROFILES));
        const results = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            if (doc.id === auth.currentUser?.uid) return;
            if (doc.id.toLowerCase().includes(queryStr) || (user.displayName || '').toLowerCase().includes(queryStr) || (user.handle || '').toLowerCase().includes(queryStr)) {
                results.push({ id: doc.id, displayName: user.displayName || user.email || 'User', handle: user.handle || '', photoURL: user.photoURL || ASSETS.DEFAULT_USER });
            }
        });
        return results;
    }

    displaySearchResults(users, container) {
        container.innerHTML = users.length ? users.map(u => `
            <div class="user-search-result" data-user-id="${u.id}" data-user-name="${u.displayName}" style="padding:0.75rem;border-bottom:1px solid var(--color-accent-dark);cursor:pointer;display:flex;gap:0.75rem;align-items:center;">
                <img src="${u.photoURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                <div>
                    <div style="font-weight:600;">${u.displayName}</div>
                    ${u.handle ? `<div style="font-size:0.75rem;color:var(--color-text-2);">@${u.handle}</div>` : ''}
                </div>
            </div>`).join('') : '<div style="padding:0.75rem;">No users found</div>';
        container.style.display = 'block';
    }

    async createOrGetConversation(currentUserId, recipientUserId) {
        const q = query(this.getDMSRef(), where('participants', 'array-contains', currentUserId));
        const existing = await getDocs(q);
        for (const d of existing.docs) if (d.data().participants?.includes(recipientUserId)) return d.id;
        const recipient = await getUserProfileFromFirestore(recipientUserId);
        const current = await getUserProfileFromFirestore(currentUserId);
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(this.getDMDocRef(id), {
            participants: [currentUserId, recipientUserId], createdAt: serverTimestamp(), lastMessage: '', lastMessageTime: serverTimestamp(),
            participantNames: { [currentUserId]: current?.displayName || 'User', [recipientUserId]: recipient?.displayName || 'User' }
        });
        return id;
    }

    async loadForums() {
        const list = document.getElementById('forums-list');
        if (!list) return;
        list.innerHTML = 'Loading...';
        const threads = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
        const elements = await Promise.all(threads.docs.map(d => this.createThreadElement(d)));
        list.innerHTML = elements.join('');
    }

    async createThreadElement(doc) {
        const t = doc.data();
        const id = doc.id;
        const emoji = {announcements: '📢', gaming: '🎮', discussion: '💬', support: '🤝', feedback: '💡'}[t.category] || '📝';
        let authorDisplay = t.createdBy || 'Unknown';
        if (t.authorId) {
            const p = await getUserProfileFromFirestore(t.authorId);
            authorDisplay = p?.handle ? `${p.displayName} <span style="font-size:0.75rem;color:var(--color-text-2);">@${p.handle}</span>` : (p?.displayName || authorDisplay);
        }
        const posts = (await getDocs(collection(db, COLLECTIONS.FORMS, id, COLLECTIONS.SUBMISSIONS))).size;
        const canEdit = auth.currentUser?.uid === t.authorId || auth.currentUser?.uid === HARD_CODED_ADMIN_UID;

        return `<div class="forum-thread" id="thread-${id}">
            <div class="forum-thread-header" data-thread-id="${id}">
                <button class="forum-toggle-btn">▼</button>
                <div class="forum-content">
                    <h3 class="forum-title" id="title-${id}">${emoji} ${t.title}</h3>
                    <div class="forum-meta">
                        By ${authorDisplay} • ${posts} posts
                        ${canEdit ? `<button data-action="edit-thread" data-thread-id="${id}" style="${BTN_STYLE}">Edit</button>` : ''}
                    </div>
                </div>
            </div>
            <div id="edit-thread-form-${id}" style="display:none;padding:1rem;background:var(--color-surface-2);">
                <input type="text" id="edit-thread-title-${id}" value="${t.title}" style="${INPUT_STYLE}margin-bottom:0.5rem;">
                <textarea id="edit-thread-desc-${id}" style="${INPUT_STYLE}margin-bottom:0.5rem;">${t.description}</textarea>
                <button data-action="save-thread-edit" data-thread-id="${id}" data-author-id="${t.authorId}" style="${BTN_STYLE}">Save</button>
                <button onclick="document.getElementById('edit-thread-form-${id}').style.display='none'" style="${BTN_STYLE}">Cancel</button>
            </div>
            <div class="forum-body" id="body-${id}">
                <p id="desc-${id}">${t.description}</p>
                <div id="comments-${id}"></div>
                ${auth.currentUser ? `<form data-thread-id="${id}" class="comment-form"><textarea placeholder="Comment..." style="${INPUT_STYLE}background:transparent !important;"></textarea><button type="submit" style="${BTN_STYLE}">Post</button></form>` : ''}
            </div>
        </div>`;
    }

    async toggleThread(id) {
        const body = document.getElementById(`body-${id}`);
        if (!body) return;
        if (body.classList.toggle('expanded')) await this.loadComments(id);
    }

    async loadComments(threadId) {
        const container = document.getElementById(`comments-${threadId}`);
        if (!container) return;
        const list = await getDocs(query(collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS), orderBy('createdAt', 'asc')));
        const comments = await Promise.all(list.docs.map(async d => {
            const data = d.data();
            const author = data.authorId ? await getUserProfileFromFirestore(data.authorId) : null;
            return {
                ...data,
                id: d.id,
                replies: [],
                authorName: author?.displayName || 'Anonymous',
                authorHandle: author?.handle || null,
                authorPhoto: author?.photoURL || ASSETS.DEFAULT_USER
            };
        }));
        const map = new Map(comments.map(c => [c.id, c]));
        const roots = [];
        comments.forEach(c => c.parentCommentId ? map.get(c.parentCommentId)?.replies.push(c) : roots.push(c));
        container.innerHTML = roots.map(c => this.renderComment(c, threadId, 0)).join('');
    }

    calculateVotes(reactions) {
        let score = 0, userVote = null;
        Object.keys(reactions || {}).forEach(k => {
            const [emoji, uid] = k.split('_');
            if (emoji === '👍') { score++; if (uid === auth.currentUser?.uid) userVote = '👍'; }
            else if (emoji === '👎') { score--; if (uid === auth.currentUser?.uid) userVote = '👎'; }
        });
        return { score, userVote };
    }

    renderComment(c, threadId, depth) {
        const { score, userVote } = this.calculateVotes(c.reactions);
        const canEdit = auth.currentUser?.uid === c.authorId;
        const isAdmin = auth.currentUser?.uid === HARD_CODED_ADMIN_UID;
        const timeStr = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : 'Just now';
        const editedStr = c.editedAt ? ` (edited ${c.editedAt.toDate ? c.editedAt.toDate().toLocaleString() : ''})` : '';

        let content = c.content;
        // Only show admin edit indicator if edited by non-author
        if (c.editedBy && c.editedBy !== c.authorId) {
            content = `[${content}] <span style="color:var(--color-accent);font-weight:bold;font-size:0.75rem;">[Edited by Admin]</span>`;
        }
        if (c.censored) content = `<span style="color:var(--color-text-2);font-style:italic;">[CENSORED: ${c.censorReason || 'Inappropriate content'}]</span>`;

        return `<div class="comment depth-${Math.min(depth, 3)}" data-comment-id="${c.id}">
            <div class="comment-header" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                <img src="${c.authorPhoto}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                <div style="display:flex;flex-direction:column;">
                    <span style="font-weight:600;">${c.authorName} ${c.authorHandle ? `<span style="font-size:0.75rem;color:var(--color-text-2);">@${c.authorHandle}</span>` : ''}</span>
                    <span style="font-size:0.75rem;color:var(--color-text-2);">${timeStr}${editedStr}</span>
                </div>
            </div>
            <div class="comment-text" id="text-${c.id}">${content}</div>
            <div class="comment-actions">
                <button data-action="reply" data-comment-id="${c.id}" style="${BTN_STYLE}">Reply</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👍" style="${BTN_STYLE}${userVote === '👍' ? 'font-weight:bold;' : ''}">👍</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👎" style="${BTN_STYLE}${userVote === '👎' ? 'font-weight:bold;' : ''}">👎</button>
                <span style="margin-right:0.75rem;">${score}</span>
                <button data-action="emoji" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">😊</button>
                ${(canEdit || isAdmin) ? `<button data-action="edit" data-comment-id="${c.id}" data-thread-id="${threadId}" data-author-id="${c.authorId}" style="${BTN_STYLE}">Edit</button>` : ''}
                ${isAdmin ? `<button data-action="censor" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">Censor</button>` : ''}
                ${(canEdit || isAdmin) ? `<button data-action="delete" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}color:var(--color-error, #ff4444);">Delete</button>` : ''}
            </div>
            <div id="emoji-picker-${c.id}" style="display:none;margin-top:0.5rem;padding:0.5rem;background:var(--color-surface-2);border-radius:0.375rem;"></div>
            <div id="edit-form-${c.id}" style="display:none;margin-top:0.5rem;">
                <textarea id="edit-text-${c.id}" style="${INPUT_STYLE}background:transparent !important;margin-bottom:0.5rem;">${c.content}</textarea>
                <button data-action="save-edit" data-comment-id="${c.id}" data-thread-id="${threadId}" data-author-id="${c.authorId}" style="${BTN_STYLE}">Save</button>
                <button onclick="document.getElementById('edit-form-${c.id}').style.display='none'" style="${BTN_STYLE}">Cancel</button>
            </div>
            <div id="censor-form-${c.id}" style="display:none;margin-top:0.5rem;">
                <input type="text" id="censor-reason-${c.id}" placeholder="Reason for censoring..." style="${INPUT_STYLE}background:transparent !important;margin-bottom:0.5rem;">
                <button data-action="submit-censor" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">Censor</button>
                <button onclick="document.getElementById('censor-form-${c.id}').style.display='none'" style="${BTN_STYLE}">Cancel</button>
            </div>
            <div id="reply-${c.id}" style="display:none;margin-top:0.5rem;"><textarea style="${INPUT_STYLE}background:transparent !important;margin-bottom:0.5rem;"></textarea><button data-action="submit-reply" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">Post</button></div>
            ${c.replies?.length ? `<div class="replies">${c.replies.map(r => this.renderComment(r, threadId, depth + 1)).join('')}</div>` : ''}
        </div>`;
    }

    async handleAction(btn) {
        const {action, commentId, threadId, emoji, messageId, dmId, authorId} = btn.dataset;
        const toggle = (id) => { const el = document.getElementById(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; };

        if (action === 'reply') toggle(`reply-${commentId}`);
        if (action === 'edit') toggle(`edit-form-${commentId}`);
        if (action === 'censor') toggle(`censor-form-${commentId}`);
        if (action === 'emoji') this.toggleEmojiPicker(commentId, threadId);
        if (action === 'vote') await this.voteComment(threadId, commentId, emoji);
        if (action === 'delete') await this.deleteComment(commentId, threadId);
        if (action === 'submit-censor') await this.submitCensor(commentId, threadId);
        if (action === 'custom-react') await this.reactComment(threadId, commentId, emoji);
        if (action === 'save-edit') await this.submitEdit(commentId, threadId, authorId);
        if (action === 'submit-reply') await this.submitReply(commentId, threadId);
        if (action === 'edit-thread') toggle(`edit-thread-form-${threadId}`);
        if (action === 'save-thread-edit') await this.saveThreadEdit(threadId, authorId);

        // DM message actions
        if (action === 'edit-message') toggle(`edit-msg-${messageId}`);
        if (action === 'save-message-edit') await this.saveMessageEdit(messageId, dmId);
        if (action === 'delete-message') await this.deleteMessage(messageId, dmId);
        if (action === 'censor-message') await this.censorMessage(messageId, dmId);
    }

    toggleEmojiPicker(commentId, threadId) {
        const el = document.getElementById(`emoji-picker-${commentId}`);
        if (!el) return;
        if (el.style.display === 'none') {
            const ems = ['❤️', '😂', '🔥', '👀', '😍', '🙏', '💯', '✨', '🎉', '🚀'];
            el.innerHTML = ems.map(e => `<button data-action="custom-react" data-comment-id="${commentId}" data-thread-id="${threadId}" data-emoji="${e}" style="${BTN_STYLE}font-size:1.2rem;">${e}</button>`).join('');
            el.style.display = 'block';
        } else el.style.display = 'none';
    }

    async voteComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        const other = `${emoji === '👍' ? '👎' : '👍'}_${auth.currentUser.uid}`;
        delete reacts[other];
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async reactComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async submitEdit(cId, tId, authorId) {
        const text = document.getElementById(`edit-text-${cId}`)?.value.trim();
        if (!text) return;
        const isAdminEdit = auth.currentUser?.uid !== authorId;
        await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), {
            content: text,
            edited: true,
            editedAt: serverTimestamp(),
            editedBy: isAdminEdit ? auth.currentUser.uid : null
        });
        await this.loadComments(tId);
    }

    async submitCensor(cId, tId) {
        const reason = document.getElementById(`censor-reason-${cId}`)?.value.trim();
        await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), {
            censored: true,
            censorReason: reason || 'Inappropriate content',
            censoredAt: serverTimestamp()
        });
        await this.loadComments(tId);
    }

    async submitReply(cId, tId) {
        const text = document.querySelector(`#reply-${cId} textarea`).value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), {
            content: text, authorId: auth.currentUser.uid, parentCommentId: cId, createdAt: serverTimestamp(), reactions: {}
        });
        await this.loadComments(tId);
    }

    async deleteComment(cId, tId) {
        if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId));
        await this.loadComments(tId);
    }

    async saveThreadEdit(threadId, authorId) {
        const title = document.getElementById(`edit-thread-title-${threadId}`).value.trim();
        const desc = document.getElementById(`edit-thread-desc-${threadId}`).value.trim();
        if (!title || !desc) return;
        const isAdminEdit = auth.currentUser?.uid !== authorId;
        await updateDoc(doc(db, COLLECTIONS.FORMS, threadId), {
            title: isAdminEdit ? `[${title}]` : title,
            description: isAdminEdit ? `[${desc}]` : desc,
            editedAt: serverTimestamp(),
            editedBy: isAdminEdit ? auth.currentUser.uid : null
        });
        await this.loadForums();
    }

    async loadMessages() {
        const list = document.getElementById('dm-list');
        if (!list || !auth.currentUser) return;

        await this.ensureNotes();

        const q = query(this.getDMSRef(), where('participants', 'array-contains', auth.currentUser.uid));

        if (this.conversationsUnsubscribe) this.conversationsUnsubscribe();

        this.conversationsUnsubscribe = onSnapshot(q, async (snapshot) => {
            const items = await Promise.all(snapshot.docs.map(async d => {
                const data = d.data();
                const other = data.participants.find(p => p !== auth.currentUser.uid);
                let p = null;
                if (other) {
                    if (this.profilesCache.has(other)) p = this.profilesCache.get(other);
                    else {
                        p = await getUserProfileFromFirestore(other);
                        this.profilesCache.set(other, p);
                    }
                } else p = this.userProfile;

                return {
                    id: d.id,
                    name: other ? (p?.displayName || 'User') : 'My Notes',
                    photo: p?.photoURL || ASSETS.DEFAULT_USER,
                    active: d.id === this.currentDMId
                };
            }));

            list.innerHTML = items.map(i => `
                <div class="dm-item ${i.active ? 'active' : ''}" data-dm-id="${i.id}" style="display:flex;align-items:center;gap:0.5rem;padding:0.75rem;">
                    <img src="${i.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                    <span>${i.name}</span>
                </div>`).join('');
        });
    }

    async ensureNotes() {
        const id = `notes_${auth.currentUser.uid}`;
        const ref = this.getDMDocRef(id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, {
                participants: [auth.currentUser.uid],
                createdAt: serverTimestamp(),
                lastMessage: 'Notes',
                lastMessageTime: serverTimestamp()
            });
        }
    }

    async loadDMMessages(dmId) {
        if (this.messageUnsubscribe) this.messageUnsubscribe();
        this.currentDMId = dmId;

        document.querySelectorAll('.dm-item').forEach(i => i.classList.toggle('active', i.dataset.dmId === dmId));

        const dmDoc = await getDoc(this.getDMDocRef(dmId));
        if (dmDoc.exists()) {
            const data = dmDoc.data();
            const other = data.participants.find(p => p !== auth.currentUser.uid);
            let p = null;
            if (other) {
                if (this.profilesCache.has(other)) p = this.profilesCache.get(other);
                else {
                    p = await getUserProfileFromFirestore(other);
                    this.profilesCache.set(other, p);
                }
            } else p = this.userProfile;

            document.getElementById('dm-header').textContent = other ? (p?.displayName || 'User') : 'My Notes';
        }

        const q = query(this.getMessagesRef(dmId), orderBy('createdAt', 'asc'));
        const self = this;
        this.messageUnsubscribe = onSnapshot(q, async (snapshot) => {
            const container = document.getElementById('dm-body');
            const messages = await Promise.all(snapshot.docs.map(async d => {
                const msg = d.data();
                const isMine = msg.sender === auth.currentUser.uid;
                let senderProfile = self.profilesCache.get(msg.sender);
                if (!senderProfile) {
                    senderProfile = await getUserProfileFromFirestore(msg.sender);
                    self.profilesCache.set(msg.sender, senderProfile);
                }
                return {id: d.id, ...msg, isMine, photo: senderProfile?.photoURL || ASSETS.DEFAULT_USER};
            }));

            container.innerHTML = messages.map(m => {
                const timeStr = self.formatTimestamp(m.createdAt);
                let content = m.content;
                if (m.censored) content = `<span style="color:var(--color-text-2);font-style:italic;">[Message Hidden]</span>`;

                return `
                <div class="msg-row" style="display:flex;align-items:flex-end;margin-bottom:0.75rem;justify-content:${m.isMine ? 'flex-end' : 'flex-start'};">
                    ${!m.isMine ? `<img src="${m.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-right:0.5rem;">` : ''}
                    <div class="dm-message ${m.isMine ? 'mine' : 'theirs'}">
                        <div>${content}</div>
                        <div id="edit-msg-${m.id}" style="display:none;margin-top:0.5rem;">
                            <textarea id="edit-msg-text-${m.id}" style="${INPUT_STYLE}min-width:150px;margin-bottom:0.25rem;">${m.content}</textarea>
                            <div><button data-action="save-message-edit" data-message-id="${m.id}" data-dm-id="${dmId}" style="${BTN_STYLE}font-size:0.7rem;">Save</button>
                            <button onclick="document.getElementById('edit-msg-${m.id}').style.display='none'" style="${BTN_STYLE}font-size:0.7rem;">Cancel</button></div>
                        </div>
                        <div style="font-size:0.65rem;color:${m.isMine ? 'rgba(255,255,255,0.7)' : 'var(--color-text-2)'};margin-top:0.35rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                            <span>${timeStr}</span>
                            ${m.isMine ? `
                                <button data-action="edit-message" data-message-id="${m.id}" style="${BTN_STYLE}font-size:0.65rem;margin:0;color:inherit;">Edit</button>
                                <button data-action="delete-message" data-message-id="${m.id}" data-dm-id="${dmId}" style="${BTN_STYLE}font-size:0.65rem;margin:0;color:#ff6b6b;">Delete</button>
                            ` : `
                                <button data-action="censor-message" data-message-id="${m.id}" data-dm-id="${dmId}" style="${BTN_STYLE}font-size:0.65rem;margin:0;color:inherit;">Hide</button>
                            `}
                        </div>
                    </div>
                    ${m.isMine ? `<img src="${m.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-left:0.5rem;">` : ''}
                </div>`;
            }).join('');
            container.scrollTop = container.scrollHeight;
        });

        document.getElementById('dm-form').style.display = 'flex';
        document.getElementById('dm-input').focus();
    }

    async sendDMMessage() {
        const input = document.getElementById('dm-input');
        const content = input.value.trim();
        if (!content || !this.currentDMId) return;
        await addDoc(this.getMessagesRef(this.currentDMId), {
            content,
            sender: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });
        input.value = '';
    }

    async saveMessageEdit(messageId, dmId) {
        const text = document.getElementById(`edit-msg-text-${messageId}`)?.value.trim();
        if (!text) return;
        await updateDoc(doc(db, 'conversations', String(dmId), 'messages', String(messageId)), {
            content: text,
            edited: true,
            editedAt: serverTimestamp()
        });
        document.getElementById(`edit-msg-${messageId}`).style.display = 'none';
    }

    async deleteMessage(messageId, dmId) {
        if (!confirm('Delete this message?')) return;
        await deleteDoc(doc(db, 'conversations', String(dmId), 'messages', String(messageId)));
    }

    async censorMessage(messageId, dmId) {
        await updateDoc(doc(db, 'conversations', String(dmId), 'messages', String(messageId)), {
            censored: true,
            censoredAt: serverTimestamp()
        });
    }

    setupEventDelegation() {
        document.addEventListener('click', e => {
            const header = e.target.closest('.forum-thread-header');
            if (header && !e.target.closest('button[data-action]')) return this.toggleThread(header.dataset.threadId);
            const dmItem = e.target.closest('.dm-item');
            if (dmItem) return this.loadDMMessages(dmItem.dataset.dmId);
            const btn = e.target.closest('[data-action]');
            if (btn) this.handleAction(btn);
        });
        document.addEventListener('submit', e => {
            if (e.target.classList.contains('comment-form')) { e.preventDefault(); this.postComment(e, e.target.dataset.threadId); }
        });
        document.getElementById('dm-send-btn')?.addEventListener('click', () => this.sendDMMessage());
        document.getElementById('dm-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendDMMessage(); }
        });
    }

    async postComment(e, tId) {
        const text = e.target.querySelector('textarea').value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), { content: text, authorId: auth.currentUser.uid, createdAt: serverTimestamp(), reactions: {} });
        e.target.reset();
        await this.loadComments(tId);
    }
}

const forumsManager = new ForumsManager();
window.forumsManager = forumsManager;
document.addEventListener('DOMContentLoaded', () => { forumsManager.init(); forumsManager.setupEventDelegation(); });
=======
import {
    addDoc,
    auth,
    collection,
    COLLECTIONS,
    db,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getUserProfileFromFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from './firebase-init.js';
import {showMessageBox} from './utils.js';
import {initializePage, loadNavbar} from './core.js';
import {themeManager} from './theme-manager.js';
import {HARD_CODED_ADMIN_UID} from './constants.js';

const ASSETS = {DEFAULT_USER: './defaultuser.png'};
const BTN_STYLE = 'background:none;border:none;color:var(--color-accent);cursor:pointer;padding:0;font-size:0.9rem;text-decoration:none;margin-right:0.75rem;';
const INPUT_STYLE = 'background:transparent !important;border:1px solid var(--color-accent);color:var(--color-text);padding:0.5rem;border-radius:0.375rem;width:100%;';

class ForumsManager {
    currentUser = null;
    userProfile = null;
    selectedUserId = null;
    currentDMId = null;
    messageUnsubscribe = null;
    conversationsUnsubscribe = null;
    profilesCache = new Map();

    getDMSRef() {
        return collection(db, 'conversations');
    }

    getDMDocRef(dmId) {
        return doc(db, 'conversations', String(dmId));
    }

    getMessagesRef(dmId) {
        return collection(db, 'conversations', String(dmId), 'messages');
    }

    formatTimestamp(timestamp) {
        if (!timestamp?.toDate) return '';
        const d = timestamp.toDate();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    async init() {
        try {
            this.currentUser = auth.currentUser;
            if (this.currentUser) {
                this.userProfile = await getUserProfileFromFirestore(this.currentUser.uid);
                this.profilesCache.set(this.currentUser.uid, this.userProfile);
            }
            await initializePage('forms');
            await themeManager.init();
            await loadNavbar(this.currentUser, this.userProfile);
            this.setupTabs();
            this.setupCreateThread();
            this.setupCreateMessage();
            await this.loadForums();
            this.loadMessages();
        } catch (error) { console.error('Init error:', error); }
    }

    setupTabs() {
        const btns = { forums: document.getElementById('forums-tab-btn'), messages: document.getElementById('messages-tab-btn') };
        const tabs = { forums: document.getElementById('forums-tab'), messages: document.getElementById('messages-tab') };
        const switchTab = (active) => Object.keys(btns).forEach(k => {
            btns[k]?.classList.toggle('active', k === active);
            tabs[k]?.classList.toggle('active', k === active);
        });
        btns.forums?.addEventListener('click', () => switchTab('forums'));
        btns.messages?.addEventListener('click', () => switchTab('messages'));
    }

    setupCreateThread() {
        const form = document.getElementById('create-thread-form');
        document.getElementById('create-thread-btn')?.addEventListener('click', () => form?.classList.toggle('visible'));
        document.getElementById('cancel-thread-btn')?.addEventListener('click', () => form?.classList.remove('visible'));
        document.getElementById('new-thread-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!auth.currentUser) return showMessageBox('Sign in required', true);
            try {
                await addDoc(collection(db, COLLECTIONS.FORMS), {
                    title: document.getElementById('thread-title')?.value.trim(),
                    description: document.getElementById('thread-description')?.value.trim(),
                    category: document.getElementById('thread-category')?.value,
                    tags: (document.getElementById('thread-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
                    createdAt: serverTimestamp(),
                    authorId: auth.currentUser.uid,
                    createdBy: auth.currentUser.displayName || auth.currentUser.email,
                    pinned: false, reactions: {}
                });
                showMessageBox('Thread created!');
                form?.classList.remove('visible');
                e.target.reset();
                await this.loadForums();
            } catch (error) { showMessageBox('Failed to create thread', true); }
        });
    }

    setupCreateMessage() {
        const form = document.getElementById('create-message-form');
        const searchInput = document.getElementById('recipient-search');
        const searchResults = document.getElementById('search-results');
        const startBtn = document.getElementById('start-conversation-btn');

        document.getElementById('create-message-btn')?.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display !== 'none') searchInput?.focus();
        });

        document.getElementById('cancel-message-btn')?.addEventListener('click', () => {
            form.style.display = 'none';
            searchInput.value = '';
            searchResults.style.display = 'none';
            this.selectedUserId = null;
            startBtn.disabled = true;
        });

        searchInput?.addEventListener('input', async (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (q.length < 2) return searchResults.style.display = 'none';
            const users = await this.searchUsers(q);
            this.displaySearchResults(users, searchResults);
            searchResults.querySelectorAll('.user-search-result').forEach(res => {
                res.addEventListener('click', () => {
                    this.selectedUserId = res.dataset.userId;
                    startBtn.disabled = false;
                    searchResults.style.display = 'none';
                    searchInput.value = res.dataset.userName;
                });
            });
        });

        startBtn?.addEventListener('click', async () => {
            if (!this.selectedUserId || !auth.currentUser) return;
            const dmId = await this.createOrGetConversation(auth.currentUser.uid, this.selectedUserId);
            form.style.display = 'none';
            setTimeout(() => {
                const dmItem = document.querySelector(`[data-dm-id="${dmId}"]`);
                if (dmItem) dmItem.click();
            }, 500);
        });
    }

    async searchUsers(queryStr) {
        const snapshot = await getDocs(collection(db, COLLECTIONS.USER_PROFILES));
        const results = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            if (doc.id === auth.currentUser?.uid) return;
            if (doc.id.toLowerCase().includes(queryStr) || (user.displayName || '').toLowerCase().includes(queryStr) || (user.handle || '').toLowerCase().includes(queryStr)) {
                results.push({ id: doc.id, displayName: user.displayName || user.email || 'User', handle: user.handle || '', photoURL: user.photoURL || ASSETS.DEFAULT_USER });
            }
        });
        return results;
    }

    displaySearchResults(users, container) {
        container.innerHTML = users.length ? users.map(u => `
            <div class="user-search-result" data-user-id="${u.id}" data-user-name="${u.displayName}" style="padding:0.75rem;border-bottom:1px solid var(--color-accent-dark);cursor:pointer;display:flex;gap:0.75rem;align-items:center;">
                <img src="${u.photoURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                <div>
                    <div style="font-weight:600;">${u.displayName}</div>
                    ${u.handle ? `<div style="font-size:0.75rem;color:var(--color-text-2);">@${u.handle}</div>` : ''}
                </div>
            </div>`).join('') : '<div style="padding:0.75rem;">No users found</div>';
        container.style.display = 'block';
    }

    async createOrGetConversation(currentUserId, recipientUserId) {
        const q = query(this.getDMSRef(), where('participants', 'array-contains', currentUserId));
        const existing = await getDocs(q);
        for (const d of existing.docs) if (d.data().participants?.includes(recipientUserId)) return d.id;
        const recipient = await getUserProfileFromFirestore(recipientUserId);
        const current = await getUserProfileFromFirestore(currentUserId);
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(this.getDMDocRef(id), {
            participants: [currentUserId, recipientUserId], createdAt: serverTimestamp(), lastMessage: '', lastMessageTime: serverTimestamp(),
            participantNames: { [currentUserId]: current?.displayName || 'User', [recipientUserId]: recipient?.displayName || 'User' }
        });
        return id;
    }

    async loadForums() {
        const list = document.getElementById('forums-list');
        if (!list) return;
        list.innerHTML = 'Loading...';
        const threads = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
        const elements = await Promise.all(threads.docs.map(d => this.createThreadElement(d)));
        list.innerHTML = elements.join('');
    }

    async createThreadElement(doc) {
        const t = doc.data();
        const id = doc.id;
        const emoji = {announcements: '📢', gaming: '🎮', discussion: '💬', support: '🤝', feedback: '💡'}[t.category] || '📝';
        let authorDisplay = t.createdBy || 'Unknown';
        if (t.authorId) {
            const p = await getUserProfileFromFirestore(t.authorId);
            authorDisplay = p?.handle ? `${p.displayName} <span style="font-size:0.75rem;color:var(--color-text-2);">@${p.handle}</span>` : (p?.displayName || authorDisplay);
        }
        const posts = (await getDocs(collection(db, COLLECTIONS.FORMS, id, COLLECTIONS.SUBMISSIONS))).size;
        const canEdit = auth.currentUser?.uid === t.authorId || auth.currentUser?.uid === HARD_CODED_ADMIN_UID;

        return `<div class="forum-thread" id="thread-${id}">
            <div class="forum-thread-header" data-thread-id="${id}">
                <button class="forum-toggle-btn">▼</button>
                <div class="forum-content">
                    <h3 class="forum-title" id="title-${id}">${emoji} ${t.title}</h3>
                    <div class="forum-meta">
                        By ${authorDisplay} • ${posts} posts
                        ${canEdit ? `<button data-action="edit-thread" data-thread-id="${id}" style="${BTN_STYLE}">Edit</button>` : ''}
                    </div>
                </div>
            </div>
            <div id="edit-thread-form-${id}" style="display:none;padding:1rem;background:var(--color-surface-2);">
                <input type="text" id="edit-thread-title-${id}" value="${t.title}" style="${INPUT_STYLE}margin-bottom:0.5rem;">
                <textarea id="edit-thread-desc-${id}" style="${INPUT_STYLE}margin-bottom:0.5rem;">${t.description}</textarea>
                <button data-action="save-thread-edit" data-thread-id="${id}" data-author-id="${t.authorId}" style="${BTN_STYLE}">Save</button>
                <button onclick="document.getElementById('edit-thread-form-${id}').style.display='none'" style="${BTN_STYLE}">Cancel</button>
            </div>
            <div class="forum-body" id="body-${id}">
                <p id="desc-${id}">${t.description}</p>
                <div id="comments-${id}"></div>
                ${auth.currentUser ? `<form data-thread-id="${id}" class="comment-form"><textarea placeholder="Comment..." style="${INPUT_STYLE}background:transparent !important;"></textarea><button type="submit" style="${BTN_STYLE}">Post</button></form>` : ''}
            </div>
        </div>`;
    }

    async toggleThread(id) {
        const body = document.getElementById(`body-${id}`);
        if (!body) return;
        if (body.classList.toggle('expanded')) await this.loadComments(id);
    }

    async loadComments(threadId) {
        const container = document.getElementById(`comments-${threadId}`);
        if (!container) return;
        const list = await getDocs(query(collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS), orderBy('createdAt', 'asc')));
        const comments = await Promise.all(list.docs.map(async d => {
            const data = d.data();
            const author = data.authorId ? await getUserProfileFromFirestore(data.authorId) : null;
            return {
                ...data,
                id: d.id,
                replies: [],
                authorName: author?.displayName || 'Anonymous',
                authorHandle: author?.handle || null,
                authorPhoto: author?.photoURL || ASSETS.DEFAULT_USER
            };
        }));
        const map = new Map(comments.map(c => [c.id, c]));
        const roots = [];
        comments.forEach(c => c.parentCommentId ? map.get(c.parentCommentId)?.replies.push(c) : roots.push(c));
        container.innerHTML = roots.map(c => this.renderComment(c, threadId, 0)).join('');
    }

    calculateVotes(reactions) {
        let score = 0, userVote = null;
        Object.keys(reactions || {}).forEach(k => {
            const [emoji, uid] = k.split('_');
            if (emoji === '👍') { score++; if (uid === auth.currentUser?.uid) userVote = '👍'; }
            else if (emoji === '👎') { score--; if (uid === auth.currentUser?.uid) userVote = '👎'; }
        });
        return { score, userVote };
    }

    renderComment(c, threadId, depth) {
        const { score, userVote } = this.calculateVotes(c.reactions);
        const canEdit = auth.currentUser?.uid === c.authorId;
        const isAdmin = auth.currentUser?.uid === HARD_CODED_ADMIN_UID;
        const timeStr = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : 'Just now';
        const editedStr = c.editedAt ? ` (edited ${c.editedAt.toDate ? c.editedAt.toDate().toLocaleString() : ''})` : '';

        let content = c.content;
        // Only show admin edit indicator if edited by non-author
        if (c.editedBy && c.editedBy !== c.authorId) {
            content = `[${content}] <span style="color:var(--color-accent);font-weight:bold;font-size:0.75rem;">[Edited by Admin]</span>`;
        }
        if (c.censored) content = `<span style="color:var(--color-text-2);font-style:italic;">[CENSORED: ${c.censorReason || 'Inappropriate content'}]</span>`;

        return `<div class="comment depth-${Math.min(depth, 3)}" data-comment-id="${c.id}">
            <div class="comment-header" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                <img src="${c.authorPhoto}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                <div style="display:flex;flex-direction:column;">
                    <span style="font-weight:600;">${c.authorName} ${c.authorHandle ? `<span style="font-size:0.75rem;color:var(--color-text-2);">@${c.authorHandle}</span>` : ''}</span>
                    <span style="font-size:0.75rem;color:var(--color-text-2);">${timeStr}${editedStr}</span>
                </div>
            </div>
            <div class="comment-text" id="text-${c.id}">${content}</div>
            <div class="comment-actions">
                <button data-action="reply" data-comment-id="${c.id}" style="${BTN_STYLE}">Reply</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👍" style="${BTN_STYLE}${userVote === '👍' ? 'font-weight:bold;' : ''}">👍</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👎" style="${BTN_STYLE}${userVote === '👎' ? 'font-weight:bold;' : ''}">👎</button>
                <span style="margin-right:0.75rem;">${score}</span>
                <button data-action="emoji" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">😊</button>
                ${(canEdit || isAdmin) ? `<button data-action="edit" data-comment-id="${c.id}" data-thread-id="${threadId}" data-author-id="${c.authorId}" style="${BTN_STYLE}">Edit</button>` : ''}
                ${isAdmin ? `<button data-action="censor" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">Censor</button>` : ''}
                ${(canEdit || isAdmin) ? `<button data-action="delete" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}color:var(--color-error, #ff4444);">Delete</button>` : ''}
            </div>
            <div id="emoji-picker-${c.id}" style="display:none;margin-top:0.5rem;padding:0.5rem;background:var(--color-surface-2);border-radius:0.375rem;"></div>
            <div id="edit-form-${c.id}" style="display:none;margin-top:0.5rem;">
                <textarea id="edit-text-${c.id}" style="${INPUT_STYLE}background:transparent !important;margin-bottom:0.5rem;">${c.content}</textarea>
                <button data-action="save-edit" data-comment-id="${c.id}" data-thread-id="${threadId}" data-author-id="${c.authorId}" style="${BTN_STYLE}">Save</button>
                <button onclick="document.getElementById('edit-form-${c.id}').style.display='none'" style="${BTN_STYLE}">Cancel</button>
            </div>
            <div id="censor-form-${c.id}" style="display:none;margin-top:0.5rem;">
                <input type="text" id="censor-reason-${c.id}" placeholder="Reason for censoring..." style="${INPUT_STYLE}background:transparent !important;margin-bottom:0.5rem;">
                <button data-action="submit-censor" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">Censor</button>
                <button onclick="document.getElementById('censor-form-${c.id}').style.display='none'" style="${BTN_STYLE}">Cancel</button>
            </div>
            <div id="reply-${c.id}" style="display:none;margin-top:0.5rem;"><textarea style="${INPUT_STYLE}background:transparent !important;margin-bottom:0.5rem;"></textarea><button data-action="submit-reply" data-comment-id="${c.id}" data-thread-id="${threadId}" style="${BTN_STYLE}">Post</button></div>
            ${c.replies?.length ? `<div class="replies">${c.replies.map(r => this.renderComment(r, threadId, depth + 1)).join('')}</div>` : ''}
        </div>`;
    }

    async handleAction(btn) {
        const {action, commentId, threadId, emoji, messageId, dmId, authorId} = btn.dataset;
        const toggle = (id) => { const el = document.getElementById(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; };

        if (action === 'reply') toggle(`reply-${commentId}`);
        if (action === 'edit') toggle(`edit-form-${commentId}`);
        if (action === 'censor') toggle(`censor-form-${commentId}`);
        if (action === 'emoji') this.toggleEmojiPicker(commentId, threadId);
        if (action === 'vote') await this.voteComment(threadId, commentId, emoji);
        if (action === 'delete') await this.deleteComment(commentId, threadId);
        if (action === 'submit-censor') await this.submitCensor(commentId, threadId);
        if (action === 'custom-react') await this.reactComment(threadId, commentId, emoji);
        if (action === 'save-edit') await this.submitEdit(commentId, threadId, authorId);
        if (action === 'submit-reply') await this.submitReply(commentId, threadId);
        if (action === 'edit-thread') toggle(`edit-thread-form-${threadId}`);
        if (action === 'save-thread-edit') await this.saveThreadEdit(threadId, authorId);

        // DM message actions
        if (action === 'edit-message') toggle(`edit-msg-${messageId}`);
        if (action === 'save-message-edit') await this.saveMessageEdit(messageId, dmId);
        if (action === 'delete-message') await this.deleteMessage(messageId, dmId);
        if (action === 'censor-message') await this.censorMessage(messageId, dmId);
    }

    toggleEmojiPicker(commentId, threadId) {
        const el = document.getElementById(`emoji-picker-${commentId}`);
        if (!el) return;
        if (el.style.display === 'none') {
            const ems = ['❤️', '😂', '🔥', '👀', '😍', '🙏', '💯', '✨', '🎉', '🚀'];
            el.innerHTML = ems.map(e => `<button data-action="custom-react" data-comment-id="${commentId}" data-thread-id="${threadId}" data-emoji="${e}" style="${BTN_STYLE}font-size:1.2rem;">${e}</button>`).join('');
            el.style.display = 'block';
        } else el.style.display = 'none';
    }

    async voteComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        const other = `${emoji === '👍' ? '👎' : '👍'}_${auth.currentUser.uid}`;
        delete reacts[other];
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async reactComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async submitEdit(cId, tId, authorId) {
        const text = document.getElementById(`edit-text-${cId}`)?.value.trim();
        if (!text) return;
        const isAdminEdit = auth.currentUser?.uid !== authorId;
        await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), {
            content: text,
            edited: true,
            editedAt: serverTimestamp(),
            editedBy: isAdminEdit ? auth.currentUser.uid : null
        });
        await this.loadComments(tId);
    }

    async submitCensor(cId, tId) {
        const reason = document.getElementById(`censor-reason-${cId}`)?.value.trim();
        await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), {
            censored: true,
            censorReason: reason || 'Inappropriate content',
            censoredAt: serverTimestamp()
        });
        await this.loadComments(tId);
    }

    async submitReply(cId, tId) {
        const text = document.querySelector(`#reply-${cId} textarea`).value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), {
            content: text, authorId: auth.currentUser.uid, parentCommentId: cId, createdAt: serverTimestamp(), reactions: {}
        });
        await this.loadComments(tId);
    }

    async deleteComment(cId, tId) {
        if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId));
        await this.loadComments(tId);
    }

    async saveThreadEdit(threadId, authorId) {
        const title = document.getElementById(`edit-thread-title-${threadId}`).value.trim();
        const desc = document.getElementById(`edit-thread-desc-${threadId}`).value.trim();
        if (!title || !desc) return;
        const isAdminEdit = auth.currentUser?.uid !== authorId;
        await updateDoc(doc(db, COLLECTIONS.FORMS, threadId), {
            title: isAdminEdit ? `[${title}]` : title,
            description: isAdminEdit ? `[${desc}]` : desc,
            editedAt: serverTimestamp(),
            editedBy: isAdminEdit ? auth.currentUser.uid : null
        });
        await this.loadForums();
    }

    async loadMessages() {
        const list = document.getElementById('dm-list');
        if (!list || !auth.currentUser) return;

        await this.ensureNotes();

        const q = query(this.getDMSRef(), where('participants', 'array-contains', auth.currentUser.uid));

        if (this.conversationsUnsubscribe) this.conversationsUnsubscribe();

        this.conversationsUnsubscribe = onSnapshot(q, async (snapshot) => {
            const items = await Promise.all(snapshot.docs.map(async d => {
                const data = d.data();
                const other = data.participants.find(p => p !== auth.currentUser.uid);
                let p = null;
                if (other) {
                    if (this.profilesCache.has(other)) p = this.profilesCache.get(other);
                    else {
                        p = await getUserProfileFromFirestore(other);
                        this.profilesCache.set(other, p);
                    }
                } else p = this.userProfile;

                return {
                    id: d.id,
                    name: other ? (p?.displayName || 'User') : 'My Notes',
                    photo: p?.photoURL || ASSETS.DEFAULT_USER,
                    active: d.id === this.currentDMId
                };
            }));

            list.innerHTML = items.map(i => `
                <div class="dm-item ${i.active ? 'active' : ''}" data-dm-id="${i.id}" style="display:flex;align-items:center;gap:0.5rem;padding:0.75rem;">
                    <img src="${i.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                    <span>${i.name}</span>
                </div>`).join('');
        });
    }

    async ensureNotes() {
        const id = `notes_${auth.currentUser.uid}`;
        const ref = this.getDMDocRef(id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, {
                participants: [auth.currentUser.uid],
                createdAt: serverTimestamp(),
                lastMessage: 'Notes',
                lastMessageTime: serverTimestamp()
            });
        }
    }

    async loadDMMessages(dmId) {
        if (this.messageUnsubscribe) this.messageUnsubscribe();
        this.currentDMId = dmId;

        document.querySelectorAll('.dm-item').forEach(i => i.classList.toggle('active', i.dataset.dmId === dmId));

        const dmDoc = await getDoc(this.getDMDocRef(dmId));
        if (dmDoc.exists()) {
            const data = dmDoc.data();
            const other = data.participants.find(p => p !== auth.currentUser.uid);
            let p = null;
            if (other) {
                if (this.profilesCache.has(other)) p = this.profilesCache.get(other);
                else {
                    p = await getUserProfileFromFirestore(other);
                    this.profilesCache.set(other, p);
                }
            } else p = this.userProfile;

            document.getElementById('dm-header').textContent = other ? (p?.displayName || 'User') : 'My Notes';
        }

        const q = query(this.getMessagesRef(dmId), orderBy('createdAt', 'asc'));
        const self = this;
        this.messageUnsubscribe = onSnapshot(q, async (snapshot) => {
            const container = document.getElementById('dm-body');
            const messages = await Promise.all(snapshot.docs.map(async d => {
                const msg = d.data();
                const isMine = msg.sender === auth.currentUser.uid;
                let senderProfile = self.profilesCache.get(msg.sender);
                if (!senderProfile) {
                    senderProfile = await getUserProfileFromFirestore(msg.sender);
                    self.profilesCache.set(msg.sender, senderProfile);
                }
                return {id: d.id, ...msg, isMine, photo: senderProfile?.photoURL || ASSETS.DEFAULT_USER};
            }));

            container.innerHTML = messages.map(m => {
                const timeStr = self.formatTimestamp(m.createdAt);
                let content = m.content;
                if (m.censored) content = `<span style="color:var(--color-text-2);font-style:italic;">[Message Hidden]</span>`;

                return `
                <div class="msg-row" style="display:flex;align-items:flex-end;margin-bottom:0.75rem;justify-content:${m.isMine ? 'flex-end' : 'flex-start'};">
                    ${!m.isMine ? `<img src="${m.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-right:0.5rem;">` : ''}
                    <div class="dm-message ${m.isMine ? 'mine' : 'theirs'}">
                        <div>${content}</div>
                        <div id="edit-msg-${m.id}" style="display:none;margin-top:0.5rem;">
                            <textarea id="edit-msg-text-${m.id}" style="${INPUT_STYLE}min-width:150px;margin-bottom:0.25rem;">${m.content}</textarea>
                            <div><button data-action="save-message-edit" data-message-id="${m.id}" data-dm-id="${dmId}" style="${BTN_STYLE}font-size:0.7rem;">Save</button>
                            <button onclick="document.getElementById('edit-msg-${m.id}').style.display='none'" style="${BTN_STYLE}font-size:0.7rem;">Cancel</button></div>
                        </div>
                        <div style="font-size:0.65rem;color:${m.isMine ? 'rgba(255,255,255,0.7)' : 'var(--color-text-2)'};margin-top:0.35rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                            <span>${timeStr}</span>
                            ${m.isMine ? `
                                <button data-action="edit-message" data-message-id="${m.id}" style="${BTN_STYLE}font-size:0.65rem;margin:0;color:inherit;">Edit</button>
                                <button data-action="delete-message" data-message-id="${m.id}" data-dm-id="${dmId}" style="${BTN_STYLE}font-size:0.65rem;margin:0;color:#ff6b6b;">Delete</button>
                            ` : `
                                <button data-action="censor-message" data-message-id="${m.id}" data-dm-id="${dmId}" style="${BTN_STYLE}font-size:0.65rem;margin:0;color:inherit;">Hide</button>
                            `}
                        </div>
                    </div>
                    ${m.isMine ? `<img src="${m.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-left:0.5rem;">` : ''}
                </div>`;
            }).join('');
            container.scrollTop = container.scrollHeight;
        });

        document.getElementById('dm-form').style.display = 'flex';
        document.getElementById('dm-input').focus();
    }

    async sendDMMessage() {
        const input = document.getElementById('dm-input');
        const content = input.value.trim();
        if (!content || !this.currentDMId) return;
        await addDoc(this.getMessagesRef(this.currentDMId), {
            content,
            sender: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });
        input.value = '';
    }

    async saveMessageEdit(messageId, dmId) {
        const text = document.getElementById(`edit-msg-text-${messageId}`)?.value.trim();
        if (!text) return;
        await updateDoc(doc(db, 'conversations', String(dmId), 'messages', String(messageId)), {
            content: text,
            edited: true,
            editedAt: serverTimestamp()
        });
        document.getElementById(`edit-msg-${messageId}`).style.display = 'none';
    }

    async deleteMessage(messageId, dmId) {
        if (!confirm('Delete this message?')) return;
        await deleteDoc(doc(db, 'conversations', String(dmId), 'messages', String(messageId)));
    }

    async censorMessage(messageId, dmId) {
        await updateDoc(doc(db, 'conversations', String(dmId), 'messages', String(messageId)), {
            censored: true,
            censoredAt: serverTimestamp()
        });
    }

    setupEventDelegation() {
        document.addEventListener('click', e => {
            const header = e.target.closest('.forum-thread-header');
            if (header && !e.target.closest('button[data-action]')) return this.toggleThread(header.dataset.threadId);
            const dmItem = e.target.closest('.dm-item');
            if (dmItem) return this.loadDMMessages(dmItem.dataset.dmId);
            const btn = e.target.closest('[data-action]');
            if (btn) this.handleAction(btn);
        });
        document.addEventListener('submit', e => {
            if (e.target.classList.contains('comment-form')) { e.preventDefault(); this.postComment(e, e.target.dataset.threadId); }
        });
        document.getElementById('dm-send-btn')?.addEventListener('click', () => this.sendDMMessage());
        document.getElementById('dm-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendDMMessage(); }
        });
    }

    async postComment(e, tId) {
        const text = e.target.querySelector('textarea').value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), { content: text, authorId: auth.currentUser.uid, createdAt: serverTimestamp(), reactions: {} });
        e.target.reset();
        await this.loadComments(tId);
    }
}

const forumsManager = new ForumsManager();
window.forumsManager = forumsManager;
document.addEventListener('DOMContentLoaded', () => { forumsManager.init(); forumsManager.setupEventDelegation(); });
export { forumsManager, ForumsManager };
import {
    auth,
    COLLECTIONS,
    db,
    getUserProfileFromFirestore,
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    deleteDoc,
    where,
    onSnapshot
} from './firebase-init.js';
import {showMessageBox} from './utils.js';
import {initializePage, loadNavbar} from './core.js';
import {themeManager} from './theme-manager.js';
import {HARD_CODED_ADMIN_UID} from './constants.js';

const ASSETS = {DEFAULT_USER: './defaultuser.png'};

class ForumsManager {
    currentUser = null;
    userProfile = null;
    selectedUserId = null;
    currentDMId = null;
    messageUnsubscribe = null;

    getDMSRef() { return collection(db, COLLECTIONS.DMS); }
    getDMDocRef(dmId) { return doc(db, COLLECTIONS.DMS, dmId); }
    getMessagesRef() { return collection(db, COLLECTIONS.MESSAGES); }

    async init() {
        try {
            this.currentUser = auth.currentUser;
            if (this.currentUser) this.userProfile = await getUserProfileFromFirestore(this.currentUser.uid);
            await initializePage('forms');
            await themeManager.init();
            await loadNavbar(this.currentUser, this.userProfile);
            this.setupTabs();
            this.setupCreateThread();
            this.setupCreateMessage();
            await this.loadForums();
            await this.loadMessages();
        } catch (error) { console.error('Init error:', error); }
    }

    setupTabs() {
        const btns = { forums: document.getElementById('forums-tab-btn'), messages: document.getElementById('messages-tab-btn') };
        const tabs = { forums: document.getElementById('forums-tab'), messages: document.getElementById('messages-tab') };
        const switchTab = (active) => Object.keys(btns).forEach(k => {
            btns[k]?.classList.toggle('active', k === active);
            tabs[k]?.classList.toggle('active', k === active);
        });
        btns.forums?.addEventListener('click', () => switchTab('forums'));
        btns.messages?.addEventListener('click', () => switchTab('messages'));
    }

    setupCreateThread() {
        const form = document.getElementById('create-thread-form');
        document.getElementById('create-thread-btn')?.addEventListener('click', () => form?.classList.toggle('visible'));
        document.getElementById('cancel-thread-btn')?.addEventListener('click', () => form?.classList.remove('visible'));
        document.getElementById('new-thread-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!auth.currentUser) return showMessageBox('Sign in required', true);
            try {
                await addDoc(collection(db, COLLECTIONS.FORMS), {
                    title: document.getElementById('thread-title')?.value.trim(),
                    description: document.getElementById('thread-description')?.value.trim(),
                    category: document.getElementById('thread-category')?.value,
                    tags: (document.getElementById('thread-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
                    createdAt: serverTimestamp(),
                    authorId: auth.currentUser.uid,
                    createdBy: auth.currentUser.displayName || auth.currentUser.email,
                    pinned: false, reactions: {}
                });
                showMessageBox('Thread created!');
                form?.classList.remove('visible');
                e.target.reset();
                await this.loadForums();
            } catch (error) { showMessageBox('Failed to create thread', true); }
        });
    }

    setupCreateMessage() {
        const form = document.getElementById('create-message-form');
        const searchInput = document.getElementById('recipient-search');
        const searchResults = document.getElementById('search-results');
        const startBtn = document.getElementById('start-conversation-btn');

        document.getElementById('create-message-btn')?.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display !== 'none') searchInput?.focus();
        });

        document.getElementById('cancel-message-btn')?.addEventListener('click', () => {
            form.style.display = 'none';
            searchInput.value = '';
            searchResults.style.display = 'none';
            this.selectedUserId = null;
            startBtn.disabled = true;
        });

        searchInput?.addEventListener('input', async (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (q.length < 2) return searchResults.style.display = 'none';
            const users = await this.searchUsers(q);
            this.displaySearchResults(users, searchResults);
            searchResults.querySelectorAll('.user-search-result').forEach(res => {
                res.addEventListener('click', () => {
                    this.selectedUserId = res.dataset.userId;
                    startBtn.disabled = false;
                    searchResults.style.display = 'none';
                    searchInput.value = res.dataset.userName;
                });
            });
        });

        startBtn?.addEventListener('click', async () => {
            if (!this.selectedUserId || !auth.currentUser) return;
            const dmId = await this.createOrGetConversation(auth.currentUser.uid, this.selectedUserId);
            form.style.display = 'none';
            await this.loadMessages();
            const dmItem = document.querySelector(`[data-dm-id="${dmId}"]`);
            if (dmItem) dmItem.click();
        });
    }

    async searchUsers(queryStr) {
        const snapshot = await getDocs(collection(db, COLLECTIONS.USER_PROFILES));
        const results = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            if (doc.id === auth.currentUser?.uid) return;
            if (doc.id.toLowerCase().includes(queryStr) || (user.displayName || '').toLowerCase().includes(queryStr) || (user.handle || '').toLowerCase().includes(queryStr)) {
                results.push({ id: doc.id, displayName: user.displayName || user.email || 'User', handle: user.handle || '', photoURL: user.photoURL || ASSETS.DEFAULT_USER });
            }
        });
        return results;
    }

    displaySearchResults(users, container) {
        container.innerHTML = users.length ? users.map(u => `
            <div class="user-search-result" data-user-id="${u.id}" data-user-name="${u.displayName}" style="padding:0.75rem;border-bottom:1px solid var(--color-accent-dark);cursor:pointer;display:flex;gap:0.75rem;align-items:center;">
                <img src="${u.photoURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                <div>
                    <div style="font-weight:600;">${u.displayName}</div>
                    ${u.handle ? `<div style="font-size:0.75rem;color:var(--color-text-2);">@${u.handle}</div>` : ''}
                </div>
            </div>`).join('') : '<div style="padding:0.75rem;">No users found</div>';
        container.style.display = 'block';
    }

    async createOrGetConversation(currentUserId, recipientUserId) {
        const q = query(this.getDMSRef(), where('participants', 'array-contains', currentUserId));
        const existing = await getDocs(q);
        for (const d of existing.docs) if (d.data().participants?.includes(recipientUserId)) return d.id;
        const recipient = await getUserProfileFromFirestore(recipientUserId);
        const current = await getUserProfileFromFirestore(currentUserId);
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(this.getDMDocRef(id), {
            participants: [currentUserId, recipientUserId], createdAt: serverTimestamp(), lastMessage: '', lastMessageTime: serverTimestamp(),
            participantNames: { [currentUserId]: current?.displayName || 'User', [recipientUserId]: recipient?.displayName || 'User' }
        });
        return id;
    }

    async loadForums() {
        const list = document.getElementById('forums-list');
        if (!list) return;
        list.innerHTML = 'Loading...';
        const threads = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
        const elements = await Promise.all(threads.docs.map(d => this.createThreadElement(d)));
        list.innerHTML = elements.join('');
    }

    async createThreadElement(doc) {
        const t = doc.data();
        const id = doc.id;
        const emoji = {announcements: '📢', gaming: '🎮', discussion: '💬', support: '🤝', feedback: '💡'}[t.category] || '📝';
        let authorDisplay = t.createdBy || 'Unknown';
        if (t.authorId) {
            const p = await getUserProfileFromFirestore(t.authorId);
            authorDisplay = p?.handle ? `${p.displayName} <span style="font-size:0.75rem;color:var(--color-text-2);">@${p.handle}</span>` : (p?.displayName || authorDisplay);
        }
        const posts = (await getDocs(collection(db, COLLECTIONS.FORMS, id, COLLECTIONS.SUBMISSIONS))).size;
        return `<div class="forum-thread" id="thread-${id}">
            <div class="forum-thread-header" data-thread-id="${id}">
                <button class="forum-toggle-btn">▼</button>
                <div class="forum-content">
                    <h3 class="forum-title">${emoji} ${t.title}</h3>
                    <div class="forum-meta">By ${authorDisplay} • ${posts} posts</div>
                </div>
            </div>
            <div class="forum-body" id="body-${id}">
                <p>${t.description}</p>
                <div id="comments-${id}"></div>
                ${auth.currentUser ? `<form data-thread-id="${id}" class="comment-form"><textarea placeholder="Comment..."></textarea><button type="submit">Post</button></form>` : ''}
            </div>
        </div>`;
    }

    async toggleThread(id) {
        const body = document.getElementById(`body-${id}`);
        if (!body) return;
        if (body.classList.toggle('expanded')) await this.loadComments(id);
    }

    async loadComments(threadId) {
        const container = document.getElementById(`comments-${threadId}`);
        if (!container) return;
        const list = await getDocs(query(collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS), orderBy('createdAt', 'asc')));
        const comments = await Promise.all(list.docs.map(async d => {
            const data = d.data();
            const author = data.authorId ? await getUserProfileFromFirestore(data.authorId) : null;
            return {
                ...data,
                id: d.id,
                replies: [],
                authorName: author?.displayName || 'Anonymous',
                authorHandle: author?.handle || null,
                authorPhoto: author?.photoURL || ASSETS.DEFAULT_USER
            };
        }));
        const map = new Map(comments.map(c => [c.id, c]));
        const roots = [];
        comments.forEach(c => c.parentCommentId ? map.get(c.parentCommentId)?.replies.push(c) : roots.push(c));
        container.innerHTML = roots.map(c => this.renderComment(c, threadId, 0)).join('');
    }

    calculateVotes(reactions) {
        let score = 0, userVote = null;
        Object.keys(reactions || {}).forEach(k => {
            const [emoji, uid] = k.split('_');
            if (emoji === '👍') { score++; if (uid === auth.currentUser?.uid) userVote = '👍'; }
            else if (emoji === '👎') { score--; if (uid === auth.currentUser?.uid) userVote = '👎'; }
        });
        return { score, userVote };
    }

    renderComment(c, threadId, depth) {
        const { score, userVote } = this.calculateVotes(c.reactions);
        const canEdit = auth.currentUser?.uid === c.authorId;
        const isAdmin = auth.currentUser?.uid === HARD_CODED_ADMIN_UID;
        return `<div class="comment depth-${Math.min(depth, 3)}" data-comment-id="${c.id}">
            <div class="comment-header" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                <img src="${c.authorPhoto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                <span style="font-weight:600;">${c.authorName}</span>
                ${c.authorHandle ? `<span style="font-size:0.75rem;color:var(--color-text-2);">@${c.authorHandle}</span>` : ''}
            </div>
            <div class="comment-text" id="text-${c.id}">${c.content}</div>
            <div class="comment-actions">
                <button data-action="reply" data-comment-id="${c.id}">Reply</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👍" class="${userVote === '👍' ? 'active' : ''}">👍</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👎" class="${userVote === '👎' ? 'active' : ''}">👎</button>
                <span>${score}</span>
                <button data-action="emoji" data-comment-id="${c.id}" data-thread-id="${threadId}">😊</button>
                ${canEdit ? `<button data-action="edit" data-comment-id="${c.id}" data-thread-id="${threadId}">Edit</button>` : ''}
                ${(canEdit || isAdmin) ? `<button data-action="delete" data-comment-id="${c.id}" data-thread-id="${threadId}" data-is-admin="${isAdmin && !canEdit}">Delete</button>` : ''}
            </div>
            <div id="emoji-picker-${c.id}" style="display:none;"></div>
            <div id="edit-form-${c.id}" style="display:none;"><textarea id="edit-text-${c.id}">${c.content}</textarea><button data-action="save-edit" data-comment-id="${c.id}" data-thread-id="${threadId}">Save</button></div>
            <div id="reply-${c.id}" style="display:none;"><textarea></textarea><button data-action="submit-reply" data-comment-id="${c.id}" data-thread-id="${threadId}">Post</button></div>
            ${c.replies?.length ? `<div class="replies">${c.replies.map(r => this.renderComment(r, threadId, depth + 1)).join('')}</div>` : ''}
        </div>`;
    }

    async handleAction(btn) {
        const { action, commentId, threadId, emoji, isAdmin } = btn.dataset;
        const toggle = (id) => { const el = document.getElementById(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; };
        if (action === 'reply') toggle(`reply-${commentId}`);
        if (action === 'edit') toggle(`edit-form-${commentId}`);
        if (action === 'emoji') this.toggleEmojiPicker(commentId, threadId);
        if (action === 'vote') await this.voteComment(threadId, commentId, emoji);
        if (action === 'delete') await this.deleteComment(commentId, threadId, isAdmin);
        if (action === 'custom-react') await this.reactComment(threadId, commentId, emoji);
        if (action === 'save-edit') await this.submitEdit(commentId, threadId);
        if (action === 'submit-reply') await this.submitReply(commentId, threadId);
    }

    toggleEmojiPicker(commentId, threadId) {
        const el = document.getElementById(`emoji-picker-${commentId}`);
        if (!el) return;
        if (el.style.display === 'none') {
            const ems = ['❤️', '😂', '🔥', '👀', '😍', '🙏', '💯', '✨', '🎉', '🚀'];
            el.innerHTML = ems.map(e => `<button data-action="custom-react" data-comment-id="${commentId}" data-thread-id="${threadId}" data-emoji="${e}">${e}</button>`).join('');
            el.style.display = 'block';
        } else el.style.display = 'none';
    }

    async voteComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        const other = `${emoji === '👍' ? '👎' : '👍'}_${auth.currentUser.uid}`;
        delete reacts[other];
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async reactComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async submitEdit(cId, tId) {
        const text = document.getElementById(`edit-text-${cId}`)?.value.trim();
        if (!text) return;
        await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), { content: text, editedAt: serverTimestamp() });
        await this.loadComments(tId);
    }

    async submitReply(cId, tId) {
        const text = document.querySelector(`#reply-${cId} textarea`).value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), {
            content: text, authorId: auth.currentUser.uid, parentCommentId: cId, createdAt: serverTimestamp(), reactions: {}
        });
        await this.loadComments(tId);
    }

    async deleteComment(cId, tId, isAdmin) {
        if (isAdmin === 'true') await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), { content: '===REMOVED BY ADMIN===', censored: true });
        else if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId));
        await this.loadComments(tId);
    }

    async loadMessages() {
        const list = document.getElementById('dm-list');
        if (!list || !auth.currentUser) return;
        const q = query(this.getDMSRef(), where('participants', 'array-contains', auth.currentUser.uid));
        const dms = await getDocs(q);
        if (dms.empty) {
            await this.ensureNotes();
            await this.loadMessages(); // Re-run to show notes
            return;
        }
        const items = await Promise.all(dms.docs.map(async d => {
            const data = d.data();
            const other = data.participants.find(p => p !== auth.currentUser.uid);
            const p = other ? await getUserProfileFromFirestore(other) : null;
            return { id: d.id, name: p?.displayName || 'My Notes', photo: p?.photoURL || ASSETS.DEFAULT_USER };
        }));
        list.innerHTML = items.map(i => `<div class="dm-item" data-dm-id="${i.id}"><img src="${i.photo}"><span>${i.name}</span></div>`).join('');
    }

    async ensureNotes() {
        const id = `notes_${auth.currentUser.uid}`;
        await setDoc(this.getDMDocRef(id), { participants: [auth.currentUser.uid], createdAt: serverTimestamp(), lastMessage: 'Notes', lastMessageTime: serverTimestamp() });
    }

    async loadDMMessages(dmId) {
        if (this.messageUnsubscribe) this.messageUnsubscribe();
        this.currentDMId = dmId;
        
        // Update header
        const dmDoc = await getDoc(this.getDMDocRef(dmId));
        if (dmDoc.exists()) {
            const data = dmDoc.data();
            const other = data.participants.find(p => p !== auth.currentUser.uid);
            const p = other ? await getUserProfileFromFirestore(other) : null;
            document.getElementById('dm-header').textContent = p?.displayName || 'My Notes';
        }

        const q = query(this.getMessagesRef(), where('conversationId', '==', dmId), orderBy('createdAt', 'asc'));
        this.messageUnsubscribe = onSnapshot(q, (snapshot) => {
            document.getElementById('dm-body').innerHTML = snapshot.docs.map(d => `<div class="msg ${d.data().sender === auth.currentUser.uid ? 'mine' : 'theirs'}">${d.data().content}</div>`).join('');
            document.getElementById('dm-body').scrollTop = document.getElementById('dm-body').scrollHeight;
        });
        document.getElementById('dm-form').style.display = 'flex';
    }

    async sendDMMessage() {
        const input = document.getElementById('dm-input');
        const content = input.value.trim();
        if (!content || !this.currentDMId) return;
        const snap = await getDoc(this.getDMDocRef(this.currentDMId));
        await addDoc(this.getMessagesRef(), {
            conversationId: this.currentDMId, content, sender: auth.currentUser.uid,
            receiverIds: snap.data().participants.filter(p => p !== auth.currentUser.uid), createdAt: serverTimestamp()
        });
        input.value = '';
    }

    setupEventDelegation() {
        document.addEventListener('click', e => {
            const header = e.target.closest('.forum-thread-header');
            if (header) return this.toggleThread(header.dataset.threadId);
            const dmItem = e.target.closest('.dm-item');
            if (dmItem) return this.loadDMMessages(dmItem.dataset.dmId);
            const btn = e.target.closest('[data-action]');
            if (btn) this.handleAction(btn);
        });
        document.addEventListener('submit', e => {
            if (e.target.classList.contains('comment-form')) { e.preventDefault(); this.postComment(e, e.target.dataset.threadId); }
        });
        document.getElementById('dm-send-btn')?.addEventListener('click', () => this.sendDMMessage());
        document.getElementById('dm-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendDMMessage(); }
        });
    }

    async postComment(e, tId) {
        const text = e.target.querySelector('textarea').value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), { content: text, authorId: auth.currentUser.uid, createdAt: serverTimestamp(), reactions: {} });
        e.target.reset();
        await this.loadComments(tId);
    }
}

const forumsManager = new ForumsManager();
window.forumsManager = forumsManager;
document.addEventListener('DOMContentLoaded', () => { forumsManager.init(); forumsManager.setupEventDelegation(); });
>>>>>>> 45bdfcda71152709c7beaa1a0cffd06a95a5cec7
export { forumsManager, ForumsManager };