import { auth, db, COLLECTIONS, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onAuthStateChanged, signInWithPopup, linkWithPopup, unlink, GoogleAuthProvider, GithubAuthProvider, TwitterAuthProvider, OAuthProvider, collection, query, orderBy, getDocs, where, onSnapshot, increment } from './firebase-init.js';
import { generateProfilePic, randomIdentity, formatDate } from './helpers.js';
import { updateUserSection } from './layout.js';

const DEFAULT_THEME = 'dark';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function cacheUser(user, profile) {
    localStorage.setItem('arcator_user_cache', JSON.stringify({
        uid: user.uid,
        displayName: profile?.displayName || user.displayName,
        photoURL: profile?.photoURL || user.photoURL,
        themePreference: profile?.themePreference || 'dark',
        fontScaling: profile?.fontScaling || 'normal'
    }));
}

function updateTheme(theme = 'dark', fontSize = 'normal', customCSS = '') {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    let style = document.getElementById('custom-css-style');
    if (!style) { style = document.createElement('style'); style.id = 'custom-css-style'; document.head.appendChild(style); }
    style.textContent = customCSS || '';
}

// ============================================================================
// AUTH STORE - Core authentication state
// ============================================================================

function registerAuthStore() {
    Alpine.store('auth', {
        user: null,
        profile: null,
        loading: true,
        isAdmin: false,

        async init() {
            const cached = localStorage.getItem('arcator_user_cache');
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    this.user = { uid: data.uid, ...data };
                    this.profile = data;
                    updateTheme(data.themePreference, data.fontScaling, data.customCSS);
                    updateUserSection(this.user, this.profile, false);
                } catch (e) {}
            }

            onAuthStateChanged(auth, async (u) => {
                this.user = u;
                if (u) {
                    try {
                        const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, u.uid));
                        if (snap.exists()) {
                            this.profile = snap.data();
                            cacheUser(u, this.profile);
                            updateTheme(this.profile.themePreference, this.profile.fontScaling, this.profile.customCSS);
                            this.isAdmin = this.profile.admin === true;
                        }
                    } catch (e) { console.error('Profile load error:', e); }
                } else {
                    this.profile = null;
                    this.isAdmin = false;
                    localStorage.removeItem('arcator_user_cache');
                }
                this.loading = false;
                updateUserSection(this.user, this.profile, this.isAdmin);
            });
        },

        async login(email, password) {
            const result = await signInWithEmailAndPassword(auth, email, password);
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
            return result.user;
        },

        async signup(email, password, displayName, handle) {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            const photoURL = generateProfilePic(displayName);
            await updateProfile(user, { displayName, photoURL });
            const profile = { uid: user.uid, displayName, email, photoURL, handle, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), themePreference: DEFAULT_THEME };
            await setDoc(doc(db, COLLECTIONS.USER_PROFILES, user.uid), profile);
            return { user, profile };
        },

        async logout() {
            await signOut(auth);
            this.user = null;
            this.profile = null;
            localStorage.removeItem('arcator_user_cache');
            updateUserSection(null, null, false);
        },

        async loginWithProvider(providerName) {
            let provider;
            switch (providerName) {
                case 'google': provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); break;
                case 'github': provider = new GithubAuthProvider(); break;
                case 'twitter': provider = new TwitterAuthProvider(); break;
                case 'apple': provider = new OAuthProvider('apple.com'); break;
                case 'discord': provider = new OAuthProvider('oidc.oidc.discord'); break;
            }
            
            const result = await signInWithPopup(auth, provider);
            if (providerName === 'discord') {
                const accessToken = result._tokenResponse?.accessToken;
                if (accessToken) {
                    try {
                        const resp = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
                        if (resp.ok) {
                            const discData = await resp.json();
                            await setDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), {
                                discordId: discData.id,
                                discordTag: `${discData.username}#${discData.discriminator}`,
                                discordPic: discData.avatar ? `https://cdn.discordapp.com/avatars/${discData.id}/${discData.avatar}.png` : null
                            }, { merge: true });
                        }
                    } catch (e) { console.error('Failed to fetch Discord user data', e); }
                }
            }
            if (result._tokenResponse?.isNewUser) {
                const { displayName: rn, handle } = randomIdentity();
                const displayName = result.user.displayName || rn;
                const photoURL = result.user.photoURL || generateProfilePic(displayName);
                await setDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { 
                    uid: result.user.uid, displayName, email: result.user.email || '', photoURL, handle, 
                    themePreference: DEFAULT_THEME, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), provider: providerName 
                });
            } else {
                await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
            }
            return result.user;
        },

        async saveProfile(uid, profileData) {
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, uid), profileData);
            this.profile = { ...this.profile, ...profileData };
            cacheUser(this.user, this.profile);
            updateTheme(this.profile.themePreference, this.profile.fontScaling, this.profile.customCSS);
            updateUserSection(this.user, this.profile, this.isAdmin);
        },

        getProvider(name) {
            switch (name) {
                case 'google': const g = new GoogleAuthProvider(); g.setCustomParameters({ prompt: 'select_account' }); return g;
                case 'github': return new GithubAuthProvider();
                case 'twitter': return new TwitterAuthProvider();
                case 'apple': return new OAuthProvider('apple.com');
                case 'discord': return new OAuthProvider('oidc.oidc.discord');
            }
        },

        async linkProvider(providerName) { await linkWithPopup(auth.currentUser, this.getProvider(providerName)); this.user = auth.currentUser; },
        async unlinkProvider(providerId) { await unlink(auth.currentUser, providerId); this.user = auth.currentUser; },
        isProviderLinked(providerId) { return this.user?.providerData?.some(p => p.providerId === providerId) || false; }
    });
}

// ============================================================================
// FORUM DATA - Forum threads and comments (for forms.html)
// ============================================================================

function registerForumData() {
    const userCache = {};

    async function fetchAuthor(uid) {
        if (!uid || userCache[uid]) return;
        try {
            const snap = await getDoc(doc(db, 'user_profiles', uid));
            if (snap.exists()) userCache[uid] = snap.data();
        } catch (e) { console.error('Failed to fetch author:', e); }
    }

    function getAuthor(uid) {
        if (userCache[uid]) return userCache[uid];
        const store = Alpine.store('auth');
        if (store.user?.uid === uid && store.profile) return store.profile;
        return { displayName: 'Unknown', photoURL: './defaultuser.png' };
    }

    Alpine.data('forumData', () => ({
        threads: [], loading: true, showCreateModal: false,
        newThread: { title: '', category: '', tags: '' }, quill: null,

        async init() {
            this.loadThreads();
            this.$watch('showCreateModal', v => { if (v && !this.quill) this.$nextTick(() => { this.quill = new Quill(this.$refs.createEditor, { theme: 'snow', placeholder: 'Describe your thread...' }); }); });
        },

        async loadThreads() {
            const q = query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const threads = await Promise.all(snap.docs.map(async d => {
                const data = { id: d.id, ...d.data(), expanded: true, comments: [], loadingComments: false, quill: null };
                const cq = query(collection(db, COLLECTIONS.SUBMISSIONS(d.id)), orderBy('createdAt', 'asc'));
                const cSnap = await getDocs(cq);
                data.comments = cSnap.docs.map(cd => ({ id: cd.id, ...cd.data() }));
                return data;
            }));
            this.threads = threads;
            const allIds = [...new Set([...threads.map(t => t.authorId), ...threads.flatMap(t => t.comments.map(c => c.authorId))].filter(Boolean))];
            await Promise.all(allIds.map(fetchAuthor));
            this.loading = false;
        },

        getAuthor, fetchAuthor, formatDate(ts) { return formatDate(ts); },

        getThreadMeta(thread) {
            let name = 'System', pic = '';
            if (thread.authorId) { const a = getAuthor(thread.authorId); name = a.displayName || 'Unknown'; pic = `<img src="${a.photoURL || './defaultuser.png'}" class="profile-img-sm me-1" alt="">`; }
            const cat = thread.category ? thread.category[0].toUpperCase() + thread.category.slice(1) : 'General';
            return `${thread.tags ? `<span class="badge bg-secondary me-1">${thread.tags}</span>` : ''} ${pic} ${name} • ${cat} • ${formatDate(thread.createdAt)} • ${thread.commentCount || 0} comments`;
        },

        async createThread() {
            if (!this.quill) return;
            const user = Alpine.store('auth').user; if (!user) return;
            await addDoc(collection(db, COLLECTIONS.FORMS), { ...this.newThread, description: this.quill.root.innerHTML, authorId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), commentCount: 0, votes: 0 });
            this.showCreateModal = false; this.newThread = { title: '', category: '', tags: '' }; this.quill.root.innerHTML = ''; this.loadThreads();
        },

        async toggleThread(thread) {
            thread.expanded = !thread.expanded;
            if (thread.expanded && thread.comments.length === 0) {
                thread.loadingComments = true;
                const q = query(collection(db, COLLECTIONS.SUBMISSIONS(thread.id)), orderBy('createdAt', 'asc'));
                const snap = await getDocs(q);
                thread.comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                await Promise.all([...new Set(thread.comments.map(c => c.authorId).filter(Boolean))].map(fetchAuthor));
                thread.loadingComments = false;
            }
        },

        getReplies(thread, parentId) { return thread.comments.filter(c => c.parentCommentId === parentId); },

        async softDeleteThread(thread) { if (!confirm(thread.censored ? 'Un-censor?' : 'Censor?')) return; await updateDoc(doc(db, COLLECTIONS.FORMS, thread.id), { censored: !thread.censored }); thread.censored = !thread.censored; },
        async deleteThread(threadId) { if (!confirm('Delete?')) return; await deleteDoc(doc(db, COLLECTIONS.FORMS, threadId)); this.threads = this.threads.filter(t => t.id !== threadId); },

        async postComment(forumId) {
            const thread = this.threads.find(t => t.id === forumId); if (!thread?.quill) return;
            const content = thread.quill.root.innerHTML; if (!content || content === '<p><br></p>') return;
            const user = Alpine.store('auth').user;
            await addDoc(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), { content, authorId: user.uid, createdAt: serverTimestamp(), parentCommentId: null });
            await updateDoc(doc(db, COLLECTIONS.FORMS, forumId), { commentCount: increment(1) });
            thread.quill.root.innerHTML = '';
            const q = query(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), orderBy('createdAt', 'asc'));
            thread.comments = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async vote(forumId, comment, type) {
            const user = Alpine.store('auth').user; if (!user) return Swal.fire('Error', 'Sign in to vote', 'error');
            const reactions = comment.reactions || {}; const uid = user.uid;
            if (type === 'up' || type === 'down') {
                const key = `${type}_${uid}`, other = type === 'up' ? `down_${uid}` : `up_${uid}`;
                if (reactions[key]) delete reactions[key]; else { reactions[key] = true; delete reactions[other]; }
            } else {
                const key = `${type}_${uid}`; const was = reactions[key];
                Object.keys(reactions).forEach(k => { const [e, u] = k.split('_'); if (u === uid && e !== 'up' && e !== 'down') delete reactions[k]; });
                if (!was) reactions[key] = true;
            }
            await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), comment.id), { reactions }); comment.reactions = reactions;
        },

        hasVoted(comment, type) { const u = Alpine.store('auth').user; return u && comment.reactions?.[`${type}_${u.uid}`]; },
        getVoteScore(comment) { if (!comment.reactions) return 0; let s = 0; Object.keys(comment.reactions).forEach(k => { if (k.startsWith('up_')) s++; if (k.startsWith('down_')) s--; }); return s; },
        getReactions(comment) { if (!comment.reactions) return {}; const c = {}; Object.keys(comment.reactions).forEach(k => { const e = k.split('_')[0]; if (e !== 'up' && e !== 'down') c[e] = (c[e] || 0) + 1; }); return c; },

        async replyTo(thread, parent) {
            let q = null;
            const { value } = await Swal.fire({ title: 'Reply', html: '<div id="swal-reply-editor" style="height:150px;background:#222;color:#fff"></div>', showCancelButton: true, didOpen: () => { q = new Quill('#swal-reply-editor', { theme: 'snow', placeholder: 'Write reply...' }); }, preConfirm: () => { const c = q.root.innerHTML; if (!c || c === '<p><br></p>') Swal.showValidationMessage('Enter reply'); return c; } });
            if (value) {
                const user = Alpine.store('auth').user;
                await addDoc(collection(db, COLLECTIONS.SUBMISSIONS(thread.id)), { content: value, authorId: user.uid, createdAt: serverTimestamp(), parentCommentId: parent.parentCommentId || parent.id });
                await updateDoc(doc(db, COLLECTIONS.FORMS, thread.id), { commentCount: increment(1) });
                thread.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(thread.id)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
            }
        },

        async deleteComment(forumId, commentId) {
            if (!confirm('Delete?')) return;
            await updateDoc(doc(db, COLLECTIONS.FORMS, forumId), { commentCount: increment(-1) });
            await deleteDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), commentId));
            const thread = this.threads.find(t => t.id === forumId);
            if (thread) thread.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(forumId)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async editThread(thread) {
            const { value } = await Swal.fire({ title: 'Edit', html: `<input id="s1" class="swal2-input" value="${thread.title}"><input id="s2" class="swal2-input" value="${thread.tags||''}"><select id="s3" class="swal2-input"><option value="announcements"${thread.category==='announcements'?' selected':''}>Announcements</option><option value="gaming"${thread.category==='gaming'?' selected':''}>Gaming</option><option value="discussion"${thread.category==='discussion'?' selected':''}>Discussion</option><option value="support"${thread.category==='support'?' selected':''}>Support</option></select>`, preConfirm: () => [document.getElementById('s1').value, document.getElementById('s2').value, document.getElementById('s3').value] });
            if (value) { await updateDoc(doc(db, COLLECTIONS.FORMS, thread.id), { title: value[0], tags: value[1], category: value[2], updatedAt: serverTimestamp() }); Object.assign(thread, { title: value[0], tags: value[1], category: value[2] }); }
        },

        async editComment(forumId, comment) {
            let q = null;
            const { value } = await Swal.fire({ title: 'Edit', html: '<div id="swal-edit" style="height:150px;background:#222;color:#fff"></div>', showCancelButton: true, didOpen: () => { q = new Quill('#swal-edit', { theme: 'snow' }); q.root.innerHTML = comment.content; }, preConfirm: () => q.root.innerHTML });
            if (value) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), comment.id), { content: value }); comment.content = value; }
        },

        async censorComment(forumId, comment) {
            let q = null;
            const { value } = await Swal.fire({ title: 'Redact', html: '<div id="swal-censor" style="height:150px;background:#222;color:#fff"></div>', showCancelButton: true, didOpen: () => { q = new Quill('#swal-censor', { theme: 'snow' }); q.root.innerHTML = comment.content; }, preConfirm: () => q.root.innerHTML });
            if (value !== undefined) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), comment.id), { content: value, censored: true }); comment.content = value; comment.censored = true; }
        }
    }));
}

// ============================================================================
// MESSAGE DATA - Direct messages (for forms.html)
// ============================================================================

function registerMessageData() {
    const userCache = {};

    async function fetchAuthor(uid) {
        if (!uid || userCache[uid]) return;
        try { const snap = await getDoc(doc(db, 'user_profiles', uid)); if (snap.exists()) userCache[uid] = snap.data(); } catch (e) {}
    }

    function getAuthor(uid) {
        if (userCache[uid]) return userCache[uid];
        const s = Alpine.store('auth'); if (s.user?.uid === uid && s.profile) return s.profile;
        return { displayName: 'Unknown', photoURL: './defaultuser.png' };
    }

    Alpine.data('messageData', () => ({
        conversations: [], selectedConv: null, messages: [], newMessage: '', unsubscribe: null,

        init() {
            this.$watch('$store.auth.user', u => { if (u) this.loadConversations(); else { this.conversations = []; this.selectedConv = null; } });
            if (Alpine.store('auth').user) this.loadConversations();
        },

        async loadConversations() {
            const user = Alpine.store('auth').user; if (!user) return;
            const q = query(collection(db, COLLECTIONS.CONVERSATIONS), where('participants', 'array-contains', user.uid));
            const snap = await getDocs(q);
            this.conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            await Promise.all([...new Set(this.conversations.flatMap(c => c.participants))].map(fetchAuthor));
        },

        getAuthor, fetchAuthor, formatDate(ts) { return formatDate(ts); },

        getConvName(conv) {
            const user = Alpine.store('auth').user;
            if (conv.name && conv.name !== 'Notes') return conv.name;
            if (conv.participants.length === 1) return 'Notes';
            const others = conv.participants.filter(id => id !== user.uid);
            return others.map(id => getAuthor(id).displayName).join(', ') || 'Chat';
        },

        async selectConv(conv) {
            this.selectedConv = conv;
            if (this.unsubscribe) this.unsubscribe();
            const q = query(collection(db, COLLECTIONS.CONV_MESSAGES(conv.id)), orderBy('createdAt', 'asc'));
            this.unsubscribe = onSnapshot(q, snap => {
                this.messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.$nextTick(() => { const el = document.getElementById('msg-list'); if (el) el.scrollTop = el.scrollHeight; });
            });
        },

        async sendMessage() {
            if (!this.newMessage.trim() || !this.selectedConv) return;
            const user = Alpine.store('auth').user;
            await addDoc(collection(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id)), { content: this.newMessage, senderId: user.uid, createdAt: serverTimestamp() });
            await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, this.selectedConv.id), { lastMessage: this.newMessage, lastMessageTime: serverTimestamp() });
            this.newMessage = '';
        },

        async deleteMessage(msgId) { if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), msgId)); },

        async editMessage(msg) {
            let q = null;
            const { value } = await Swal.fire({ title: 'Edit', html: '<div id="swal-msg" style="height:150px;background:#222;color:#fff"></div>', showCancelButton: true, didOpen: () => { q = new Quill('#swal-msg', { theme: 'snow' }); q.root.innerHTML = msg.content; }, preConfirm: () => q.root.innerHTML });
            if (value) await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), msg.id), { content: value });
        },

        async createConversation() {
            const snap = await getDocs(collection(db, COLLECTIONS.USER_PROFILES));
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentUser = Alpine.store('auth').user;
            const others = users.filter(u => u.id !== currentUser.uid);
            if (!others.length) { Swal.fire('No users', 'No other users to message.', 'info'); return; }
            const opts = others.map(u => `<option value="${u.id}">${u.displayName || u.email || 'Unknown'}</option>`).join('');
            const { value: uid } = await Swal.fire({ title: 'New Conversation', html: `<select id="new-conv" class="form-select">${opts}</select>`, preConfirm: () => document.getElementById('new-conv').value, showCancelButton: true });
            if (uid) {
                const existing = this.conversations.find(c => c.participants.includes(uid) && c.participants.length === 2);
                if (existing) { this.selectConv(existing); return; }
                await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), { participants: [currentUser.uid, uid], createdAt: serverTimestamp(), lastMessageTime: serverTimestamp() });
                this.loadConversations();
            }
        }
    }));
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function registerAll() {
    registerAuthStore();
    registerForumData();
    registerMessageData();
}

if (window.Alpine) registerAll();
else document.addEventListener('alpine:init', registerAll);
