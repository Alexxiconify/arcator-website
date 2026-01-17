import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1/+esm';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {createUserWithEmailAndPassword, getAuth, GithubAuthProvider, GoogleAuthProvider, OAuthProvider, TwitterAuthProvider, EmailAuthProvider, onAuthStateChanged, onIdTokenChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, linkWithPopup, linkWithCredential, unlink, signOut, updateProfile} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, initializeFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const cfg = {apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4", authDomain: "arcator-web.firebaseapp.com", databaseURL: "https://arcator-web-default-rtdb.firebaseio.com", projectId: "arcator-web", storageBucket: "arcator-web.firebasestorage.app", messagingSenderId: "1033082068049", appId: "1:1033082068049:web:dd154c8b188bde1930ec70", measurementId: "G-DJXNT1L7CM"};
const app = initializeApp(cfg);
const auth = getAuth(app);
const db = initializeFirestore(app, {});
const projectId = cfg.projectId;
const appId = cfg.appId;
const DEFAULT_PROFILE_PIC = './defaultuser.png';
const DEFAULT_THEME_NAME = 'dark';

const art = `artifacts/${projectId}`;
const COLLECTIONS = {USERS: 'user_profiles', USER_PROFILES: 'user_profiles', FORMS: `${art}/public/data/forms`, SUBMISSIONS: (formId) => `${art}/public/data/forms/${formId}/submissions`, CONVERSATIONS: 'conversations', CONV_MESSAGES: (convId) => `conversations/${convId}/messages`, THEMES: `${art}/public/data/custom_themes`, PAGES: `${art}/public/data/temp_pages`, WIKI_CONFIG: `${art}/public/data/wiki_config`, WIKI_PAGES: `${art}/public/data/wiki_pages`};

const firebaseReadyPromise = new Promise(r => { const u = auth.onAuthStateChanged(() => { u(); r(true); }); });
const getCurrentUser = () => auth.currentUser;

const formatDate = ts => {
    if (!ts) return '';
    const d = ts.seconds ? dayjs(ts.seconds * 1000) : dayjs(ts);
    return d.isSame(dayjs(), 'day') ? d.format('HH:mm') : d.format('DD/MM/YY');
};
const generateProfilePic = name => {
    const colors = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'], canvas = document.createElement('canvas');
    canvas.width = canvas.height = 200;
    const ctx = canvas.getContext('2d'), hash = [...name].reduce((a, c) => a + c.codePointAt(0), 0);
    ctx.fillStyle = colors[Math.abs(hash) % colors.length];
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2), 100, 100);
    return canvas.toDataURL('image/png');
};
const randomIdentity = () => {
    const adj = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Bright', 'Cool', 'Smart'], noun = ['Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Tiger', 'Lion', 'Owl'];
    const a = adj[Math.floor(Math.random() * adj.length)], n = noun[Math.floor(Math.random() * noun.length)];
    return { displayName: `${a} ${n}`, handle: `${a.toLowerCase()}${n}${Math.floor(Math.random() * 1000)}` };
};
const NAV_HTML = `<nav class="arc-nav"><div class="container-fluid px-4"><a class="navbar-brand fw-bold" href="./index.html">Arcator</a><button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"><span class="navbar-toggler-icon"></span></button><div class="collapse navbar-collapse" id="navbarNav"><ul class="navbar-nav me-auto"><li class="nav-item"><a class="nav-link" href="./wiki.html">Wiki</a></li><li class="nav-item"><a class="nav-link" href="./forms.html">Forums</a></li><li class="nav-item"><a class="nav-link" href="./pages.html">Pages</a></li><li class="nav-item"><a class="nav-link" href="./resources.html">Resources</a></li><li class="nav-item d-none" id="admin-link"><a class="nav-link" href="./mod.html">Admin</a></li></ul><div class="arc-user-section"><a href="./users.html" class="btn btn-primary btn-sm" id="sign-in-btn">Sign In</a><a href="./users.html" class="d-none arc-profile-link" id="user-profile-link"><img src="./defaultuser.png" class="arc-profile-img" alt="Profile" id="user-avatar"><span class="text-light" id="user-name">User</span></a></div></div></div></nav>`;
const FOOTER_HTML = `<footer class="arc-footer"><div class="container-fluid px-4"><div class="arc-flex-between"><div class="d-flex gap-3"><a href="https://ssmp.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">SSMP Blue Maps</a><a href="https://wiki.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">Wiki</a></div><div class="text-secondary">© 2025 Arcator</div></div></div></footer>`;
function initLayout() {
    const nav = document.getElementById('navbar-placeholder'), foot = document.getElementById('footer-placeholder');
    if (nav) {
        nav.innerHTML = NAV_HTML;
        const cur = location.pathname.split('/').pop() || 'index.html';
        nav.querySelectorAll('.nav-link').forEach(l => (l.getAttribute('href') === `./${cur}` || (cur === 'index.html' && l.getAttribute('href') === './index.html')) && l.classList.add('active'));
    }
    if (foot) foot.innerHTML = FOOTER_HTML;
    if (window.Alpine) { const s = Alpine.store('auth'); s && !s.loading && updateUserSection(s.user, s.profile, s.isAdmin); }
}
function updateUserSection(u, p, isAdmin = false) {
    const btn = document.getElementById('sign-in-btn'), link = document.getElementById('user-profile-link'), av = document.getElementById('user-avatar'), name = document.getElementById('user-name'), adm = document.getElementById('admin-link');
    if (!btn || !link) return;
    if (u) {
        btn.classList.add('d-none'); link.classList.replace('d-none', 'd-flex');
        if (av) av.src = p?.photoURL || u.photoURL || './defaultuser.png';
        if (name) name.textContent = p?.displayName || u.displayName || 'User';
        if (adm) adm.classList.toggle('d-none', !isAdmin);
    } else {
        btn.classList.remove('d-none'); link.classList.replace('d-flex', 'd-none');
        if (adm) adm.classList.add('d-none');
    }
}
const cacheUser = (u, p) => localStorage.setItem('arcator_user_cache', JSON.stringify({uid: u.uid, displayName: p?.displayName || u.displayName, photoURL: p?.photoURL || u.photoURL, themePreference: p?.themePreference || 'dark', fontScaling: p?.fontScaling || 'normal', backgroundImage: p?.backgroundImage, glassColor: p?.glassColor, glassOpacity: p?.glassOpacity, glassBlur: p?.glassBlur}));
const updateTheme = (t = 'dark', f = 'normal', css = '', bg = '', gc = '', go = 0.95, gb = '') => {
    const r = document.documentElement;
    r.setAttribute('data-bs-theme', t); r.setAttribute('data-font-size', f);
    document.body.style.backgroundImage = bg ? `url('${bg}')` : '';
    if (gc && go !== '') {
        const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(gc);
        if (rgb) r.style.setProperty('--glass-bg', `rgba(${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}, ${go})`);
    } else r.style.removeProperty('--glass-bg');
    let s = document.getElementById('custom-css-style');
    if (!s) { s = document.createElement('style'); s.id = 'custom-css-style'; document.head.appendChild(s); }
    s.textContent = (css || '') + (gb ? ` .glass-card, .card { backdrop-filter: blur(${gb}px) !important; } body::before { backdrop-filter: blur(${Math.max(0, gb - 5)}px) !important; }` : '');
};

function registerUsersStore() {
    Alpine.store('users', {
        cache: {},
        async fetch(uid) {
            if (!uid || this.cache[uid]) return;
            try {
                const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid));
                const data = snap.exists() ? snap.data() : { displayName: 'Unknown User', photoURL: './defaultuser.png', uid };
                this.cache = { ...this.cache, [uid]: data };
            } catch (e) { console.error(`Fetch error ${uid}:`, e); }
        },
        get(uid) {
            if (this.cache[uid]) return this.cache[uid];
            const s = Alpine.store('auth');
            if (s?.user?.uid === uid && s.profile) return s.profile;
            return { displayName: 'Unknown', photoURL: './defaultuser.png' };
        }
    });
}
const fetchAuthor = uid => Alpine.store('users').fetch(uid);
const getAuthor = uid => Alpine.store('users').get(uid);

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
                    updateTheme(data.themePreference, data.fontScaling, data.customCSS, data.backgroundImage, data.glassColor, data.glassOpacity, data.glassBlur);
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
                            updateTheme(this.profile.themePreference, this.profile.fontScaling, this.profile.customCSS, this.profile.backgroundImage, this.profile.glassColor, this.profile.glassOpacity, this.profile.glassBlur);
                            this.isAdmin = this.profile.admin === true || this.profile.staff === true || this.profile.role === 'staff';
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

        async checkAdmin(uid) { return this.isAdmin; },

        async makeMeAdmin() {
            if (!this.user) return console.error("Sign in first");
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, this.user.uid), { admin: true });
            this.isAdmin = true;
            this.profile.admin = true;
            location.reload();
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

// Helper for SweetAlert + Quill
async function promptEditor(title, html = '', initialContent = '', placeholder = '') {
    let q = null;
    const { value } = await Swal.fire({
        title,
        html: html || `<div id="swal-editor" style="height:150px;background:#222;color:#fff"></div>`,
        showCancelButton: true,
        didOpen: () => {
            if (!html) {
                q = new Quill('#swal-editor', { theme: 'snow', placeholder });
                if (initialContent) q.root.innerHTML = initialContent;
            }
        },
        preConfirm: () => {
            if (html) return true; // Custom HTML form case
            const c = q.root.innerHTML;
            if (!c || c === '<p><br></p>') { Swal.showValidationMessage('Content required'); return false; }
            return c;
        }
    });
    return value;
}

function registerForumData() {
    Alpine.data('forumData', () => ({
        threads: [], loading: true, showCreateModal: false, newThread: { title: '', category: '', tags: '' }, quill: null,
        async init() { this.loadThreads(); this.$watch('showCreateModal', v => { if (v && !this.quill) this.$nextTick(() => { this.quill = new Quill(this.$refs.createEditor, { theme: 'snow', placeholder: 'Describe your thread...' }); }); }); },
        async loadThreads() {
            const snap = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
            this.threads = await Promise.all(snap.docs.map(async d => {
                const data = { id: d.id, ...d.data(), expanded: true, comments: [], loadingComments: false, quill: null };
                const cSnap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(d.id)), orderBy('createdAt', 'asc')));
                data.comments = cSnap.docs.map(cd => ({ id: cd.id, ...cd.data() }));
                return data;
            }));
            const ids = [...new Set([...this.threads.map(t => t.authorId), ...this.threads.flatMap(t => t.comments.map(c => c.authorId))].filter(Boolean))];
            await Promise.all(ids.map(fetchAuthor)); this.loading = false;
        },
        getAuthor, fetchAuthor, formatDate,
        getThreadMeta(t) {
            let n = 'System', p = '';
            if (t.authorId) { const a = getAuthor(t.authorId); n = a.displayName || 'Unknown'; p = `<img src="${a.photoURL || './defaultuser.png'}" class="profile-img-sm me-1" alt="">`; }
            return `${t.tags ? `<span class="badge bg-secondary me-1">${t.tags}</span>` : ''} ${p} ${n} • ${t.category ? t.category[0].toUpperCase() + t.category.slice(1) : 'General'} • ${formatDate(t.createdAt)} • ${t.commentCount || 0} comments`;
        },
        async createThread() {
            if (!this.quill) return; const u = Alpine.store('auth').user; if (!u) return;
            await addDoc(collection(db, COLLECTIONS.FORMS), { ...this.newThread, description: this.quill.root.innerHTML, authorId: u.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), commentCount: 0, votes: 0 });
            this.showCreateModal = false; this.newThread = { title: '', category: '', tags: '' }; this.quill.root.innerHTML = ''; this.loadThreads();
        },
        async toggleThread(t) {
            t.expanded = !t.expanded;
            if (t.expanded && !t.comments.length) {
                t.loadingComments = true;
                const snap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(t.id)), orderBy('createdAt', 'asc')));
                t.comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                await Promise.all([...new Set(t.comments.map(c => c.authorId).filter(Boolean))].map(fetchAuthor));
                t.loadingComments = false;
            }
        },
        getReplies(t, pid) { return t.comments.filter(c => c.parentCommentId === pid); },
        async softDeleteThread(t) { if (confirm(t.censored ? 'Un-censor?' : 'Censor?')) { await updateDoc(doc(db, COLLECTIONS.FORMS, t.id), { censored: !t.censored }); t.censored = !t.censored; } },
        async deleteThread(id) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.FORMS, id)); this.threads = this.threads.filter(t => t.id !== id); } },
        async postComment(fid) {
            const t = this.threads.find(t => t.id === fid); if (!t?.quill) return;
            const c = t.quill.root.innerHTML; if (!c || c === '<p><br></p>') return;
            await addDoc(collection(db, COLLECTIONS.SUBMISSIONS(fid)), { content: c, authorId: Alpine.store('auth').user.uid, createdAt: serverTimestamp(), parentCommentId: null });
            await updateDoc(doc(db, COLLECTIONS.FORMS, fid), { commentCount: increment(1) });
            t.quill.root.innerHTML = ''; t.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(fid)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
        },
        async vote(fid, c, type) {
            const u = Alpine.store('auth').user; if (!u) return Swal.fire('Error', 'Sign in to vote', 'error');
            const r = c.reactions || {}, uid = u.uid;
            if (type === 'up' || type === 'down') { const k = `${type}_${uid}`, o = type === 'up' ? `down_${uid}` : `up_${uid}`; if (r[k]) delete r[k]; else { r[k] = true; delete r[o]; } }
            else { const k = `${type}_${uid}`, was = r[k]; Object.keys(r).forEach(x => { const [e, id] = x.split('_'); if (id === uid && e !== 'up' && e !== 'down') delete r[x]; }); if (!was) r[k] = true; }
            await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(fid), c.id), { reactions: r }); c.reactions = r;
        },
        hasVoted(c, t) { const u = Alpine.store('auth').user; return u && c.reactions?.[`${t}_${u.uid}`]; },
        getVoteScore(c) { if (!c.reactions) return 0; let s = 0; Object.keys(c.reactions).forEach(k => { if (k.startsWith('up_')) s++; if (k.startsWith('down_')) s--; }); return s; },
        getReactions(c) { if (!c.reactions) return {}; const res = {}; Object.keys(c.reactions).forEach(k => { const e = k.split('_')[0]; if (e !== 'up' && e !== 'down') res[e] = (res[e] || 0) + 1; }); return res; },
        async replyTo(t, p) {
            const c = await promptEditor('Reply', '', '', 'Write reply...');
            if (c) {
                await addDoc(collection(db, COLLECTIONS.SUBMISSIONS(t.id)), { content: c, authorId: Alpine.store('auth').user.uid, createdAt: serverTimestamp(), parentCommentId: p.parentCommentId || p.id });
                await updateDoc(doc(db, COLLECTIONS.FORMS, t.id), { commentCount: increment(1) });
                t.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(t.id)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
            }
        },
        async deleteComment(fid, cid) {
            if (!confirm('Delete?')) return;
            await updateDoc(doc(db, COLLECTIONS.FORMS, fid), { commentCount: increment(-1) });
            await deleteDoc(doc(db, COLLECTIONS.SUBMISSIONS(fid), cid));
            const t = this.threads.find(t => t.id === fid); if (t) t.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(fid)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
        },
        async editThread(t) {
            const html = `<input id="s1" class="swal2-input" value="${t.title}"><input id="s2" class="swal2-input" value="${t.tags||''}"><select id="s3" class="swal2-input"><option value="announcements"${t.category==='announcements'?' selected':''}>Announcements</option><option value="gaming"${t.category==='gaming'?' selected':''}>Gaming</option><option value="discussion"${t.category==='discussion'?' selected':''}>Discussion</option><option value="support"${t.category==='support'?' selected':''}>Support</option></select><textarea id="ed-thread-content" class="form-control" rows="10">${t.description || ''}</textarea>`;
            const { value: v } = await Swal.fire({ title: 'Edit', html, preConfirm: () => [document.getElementById('s1').value, document.getElementById('s2').value, document.getElementById('s3').value, document.getElementById('ed-thread-content').value] });
            if (v) { await updateDoc(doc(db, COLLECTIONS.FORMS, t.id), { title: v[0], tags: v[1], category: v[2], description: v[3], updatedAt: serverTimestamp() }); Object.assign(t, { title: v[0], tags: v[1], category: v[2], description: v[3] }); }
        },
        async editComment(fid, c) { const res = await promptEditor('Edit', '', c.content); if (res) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(fid), c.id), { content: res }); c.content = res; } },
        async censorComment(fid, c) { const res = await promptEditor('Redact', '', c.content); if (res) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(fid), c.id), { content: res, censored: true }); c.content = res; c.censored = true; } }
    }));
}

function registerMessageData() {
    Alpine.data('messageData', () => ({
        conversations: [], selectedConv: null, messages: [], newMessage: '', unsubscribe: null,
        init() { this.$watch('$store.auth.user', u => u ? this.loadConversations() : (this.conversations = [], this.selectedConv = null)); if (Alpine.store('auth').user) this.loadConversations(); },
        async loadConversations() {
            const u = Alpine.store('auth').user; if (!u) return;
            const snap = await getDocs(query(collection(db, COLLECTIONS.CONVERSATIONS), where('participants', 'array-contains', u.uid)));
            this.conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            await Promise.all([...new Set(this.conversations.flatMap(c => c.participants))].map(fetchAuthor));
        },
        getAuthor, fetchAuthor, formatDate,
        getConvName(c) {
            const u = Alpine.store('auth').user; if (c.name && c.name !== 'Notes') return c.name; if (c.participants.length === 1) return 'Notes';
            return c.participants.filter(id => id !== u.uid).map(id => getAuthor(id).displayName).join(', ') || 'Chat';
        },
        async selectConv(c) {
            this.selectedConv = c; if (this.unsubscribe) this.unsubscribe();
            this.unsubscribe = onSnapshot(query(collection(db, COLLECTIONS.CONV_MESSAGES(c.id)), orderBy('createdAt', 'asc')), snap => {
                this.messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.$nextTick(() => { const el = document.getElementById('msg-list'); if (el) el.scrollTop = el.scrollHeight; });
            });
        },
        async sendMessage() {
            if (!this.newMessage.trim() || !this.selectedConv) return; const u = Alpine.store('auth').user;
            await addDoc(collection(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id)), { content: this.newMessage, senderId: u.uid, createdAt: serverTimestamp() });
            await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, this.selectedConv.id), { lastMessage: this.newMessage, lastMessageTime: serverTimestamp() });
            this.newMessage = '';
        },
        async deleteMessage(id) { if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), id)); },
        async editMessage(m) { const c = await promptEditor('Edit', '', m.content); if (c) await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), m.id), { content: c }); },
        async createConversation() {
            const snap = await getDocs(collection(db, COLLECTIONS.USER_PROFILES)); const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const u = Alpine.store('auth').user; const others = users.filter(x => x.id !== u.uid); if (!others.length) return Swal.fire('No users', '', 'info');
            const opts = others.map(x => `<option value="${x.id}">${x.displayName || x.email}</option>`).join('');
            const { value: id } = await Swal.fire({ title: 'New Conversation', html: `<select id="new-conv" class="form-select">${opts}</select>`, preConfirm: () => document.getElementById('new-conv').value, showCancelButton: true });
            if (id) { const ex = this.conversations.find(c => c.participants.includes(id) && c.participants.length === 2); if (ex) return this.selectConv(ex); await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), { participants: [u.uid, id], createdAt: serverTimestamp(), lastMessageTime: serverTimestamp() }); this.loadConversations(); }
        }
    }));
}

function registerPageWikiManagement() {
    Alpine.store('mgmt', {
        async createPage(cb) {
            const { value: v } = await Swal.fire({ title: 'Create Page', html: '<input id="np-title" class="form-control mb-2" placeholder="Title"><input id="np-slug" class="form-control mb-2" placeholder="Slug"><textarea id="np-content" class="form-control" rows="10" placeholder="HTML Content"></textarea>', showCancelButton: true, preConfirm: () => ({ title: document.getElementById('np-title').value, slug: document.getElementById('np-slug').value, content: document.getElementById('np-content').value, createdAt: serverTimestamp() }) });
            if (v) { await addDoc(collection(db, COLLECTIONS.PAGES), v); if (cb) cb(); Swal.fire('Success', 'Page created', 'success'); }
        },
        async editPage(p, cb) {
            const { value: v } = await Swal.fire({ title: 'Edit Page', width: '800px', html: `<input id="ep-title" class="form-control mb-2" placeholder="Title" value="${p.title}"><input id="ep-slug" class="form-control mb-2" placeholder="Slug" value="${p.slug}"><textarea id="ep-content" class="form-control font-monospace" rows="15" placeholder="HTML Content">${p.content}</textarea>`, showCancelButton: true, preConfirm: () => ({ title: document.getElementById('ep-title').value, slug: document.getElementById('ep-slug').value, content: document.getElementById('ep-content').value, updatedAt: serverTimestamp() }) });
            if (v) { await updateDoc(doc(db, COLLECTIONS.PAGES, p.id), v); if (cb) cb(); Swal.fire('Success', 'Page updated', 'success'); }
        },
        async deletePage(id, cb) {
            if ((await Swal.fire({ title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true })).isConfirmed) { await deleteDoc(doc(db, COLLECTIONS.PAGES, id)); if (cb) cb(); Swal.fire('Deleted', 'Page has been deleted.', 'success'); }
        },
        async createWikiSection(cb) {
            const { value: v } = await Swal.fire({ title: 'Create Wiki Section', html: '<input id="nw-id" class="form-control mb-2" placeholder="Section ID (e.g. servers)"><textarea id="nw-content" class="form-control font-monospace" rows="12" placeholder="HTML Content"></textarea>', showCancelButton: true, preConfirm: () => ({ id: document.getElementById('nw-id').value.toLowerCase().replace(/\s+/g, '-'), content: document.getElementById('nw-content').value }) });
            if (v?.id) { await setDoc(doc(db, COLLECTIONS.WIKI_PAGES, v.id), { content: v.content, allowedEditors: [], updatedAt: serverTimestamp() }); if (cb) cb(); Swal.fire('Success', 'Wiki section created', 'success'); }
        },
        async editWikiSection(s, cb) {
            const { value: v } = await Swal.fire({ title: `Edit: ${s.id}`, width: '900px', html: `<textarea id="ew-content" class="form-control font-monospace" rows="20">${s.content || ''}</textarea>`, showCancelButton: true, preConfirm: () => document.getElementById('ew-content').value });
            if (v !== undefined) { await updateDoc(doc(db, COLLECTIONS.WIKI_PAGES, s.id), { content: v, updatedAt: serverTimestamp() }); if (cb) cb(); Swal.fire('Success', 'Wiki section updated', 'success'); }
        },
        async manageWikiEditors(s, users, cb) {
            const cur = s.allowedEditors || [], opts = users.map(u => `<option value="${u.id}" ${cur.includes(u.id) ? 'selected' : ''}>${u.displayName || u.email}</option>`).join('');
            const { value: v } = await Swal.fire({ title: `Allowed Editors: ${s.id}`, html: `<p class="text-muted small">Admins can always edit. Select users who can also edit this section:</p><select id="ew-editors" class="form-select" multiple size="10">${opts}</select>`, showCancelButton: true, preConfirm: () => Array.from(document.getElementById('ew-editors').selectedOptions).map(o => o.value) });
            if (v !== undefined) { await updateDoc(doc(db, COLLECTIONS.WIKI_PAGES, s.id), { allowedEditors: v, updatedAt: serverTimestamp() }); if (cb) cb(); Swal.fire('Success', 'Editors updated', 'success'); }
        },
        async deleteWikiSection(id, cb) {
            if ((await Swal.fire({ title: 'Delete Wiki Section?', text: 'This cannot be undone!', icon: 'warning', showCancelButton: true })).isConfirmed) { await deleteDoc(doc(db, COLLECTIONS.WIKI_PAGES, id)); if (cb) cb(); Swal.fire('Deleted', 'Section removed.', 'success'); }
        }
    });
}

function registerWikiApp() {
    Alpine.data('wikiApp', () => ({
        tab: 'home', showSidebar: false, loading: true, tabs: [{id:'home',label:'Welcome',icon:'bi-house'},{id:'servers',label:'Servers',icon:'bi-hdd-network'},{id:'software',label:'Software',icon:'bi-code-square'},{id:'sysadmin',label:'Sysadmin',icon:'bi-terminal'},{id:'machines',label:'Machines',icon:'bi-pc-display'},{id:'staff',label:'Staff',icon:'bi-people'},{id:'mcadmin',label:'MCAdmin',icon:'bi-shield-lock'},{id:'growth',label:'Growth Plans',icon:'bi-graph-up'}], tabContent: {}, tabMeta: {},
        get currentUser() { return Alpine.store('auth')?.user; },
        get isAdmin() { return Alpine.store('auth')?.isAdmin; },
        get canEdit() { if (!this.currentUser) return false; if (this.isAdmin) return true; return this.tabMeta[this.tab]?.allowedEditors?.includes(this.currentUser.uid); },
        async init() {
            await firebaseReadyPromise;
            const snap = await getDocs(collection(db, COLLECTIONS.WIKI_PAGES));
            snap.forEach(d => { const data = d.data(); this.tabContent[d.id] = data.content; this.tabMeta[d.id] = { allowedEditors: data.allowedEditors || [], updatedAt: data.updatedAt }; });
            this.loading = false; this.$nextTick(() => this.renderTab(this.tab));
        },
        renderTab(id) { const el = document.querySelector(`.wiki-content[data-tab="${id}"]`); if (el && this.tabContent[id]) { el.innerHTML = this.tabContent[id]; el.querySelectorAll('[x-data]').forEach(x => Alpine.initTree(x)); } },
        selectTab(id) { this.tab = id; this.showSidebar = false; this.$nextTick(() => this.renderTab(id)); },
        async editCurrentTab() {
            const content = this.tabContent[this.tab] || '';
            const { value } = await Swal.fire({ title: `Edit: ${this.tabs.find(t => t.id === this.tab)?.label}`, width: '900px', html: `<textarea id="wiki-edit" class="form-control font-monospace" rows="20">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('wiki-edit').value = content; }, preConfirm: () => document.getElementById('wiki-edit').value });
            if (value !== undefined) {
                await updateDoc(doc(db, COLLECTIONS.WIKI_PAGES, this.tab), { content: value, updatedAt: serverTimestamp() });
                this.tabContent[this.tab] = value; this.renderTab(this.tab); Swal.fire('Saved', 'Wiki section updated', 'success');
            }
        }
    }));
}

function registerPagesData() {
    Alpine.data('pagesData', () => ({
        pages: [], currentPage: null, currentPageId: new URL(location.href).searchParams.get('id'), loading: true, authorName: 'Unknown', showSidebar: false,
        get currentUser() { return Alpine.store('auth')?.user; },
        get isAdmin() { return Alpine.store('auth')?.isAdmin; },
        get canEdit() { return this.currentUser && (this.isAdmin || this.currentPage?.authorId === this.currentUser.uid); },
        async init() { await firebaseReadyPromise; await this.loadPagesList(); if (this.currentPageId) await this.loadSinglePage(this.currentPageId); },
        async loadPagesList() { const snap = await getDocs(query(collection(db, COLLECTIONS.PAGES), orderBy('createdAt', 'desc'))); this.pages = snap.docs.map(d => ({ id: d.id, ...d.data() })); if (!this.currentPageId) this.loading = false; },
        async loadSinglePage(id) {
            const snap = await getDoc(doc(db, COLLECTIONS.PAGES, id));
            if (snap.exists()) { this.currentPage = { id: snap.id, ...snap.data() }; document.title = `${this.currentPage.title || 'Page'} - Arcator`; await this.loadAuthor(this.currentPage.createdBy || this.currentPage.authorId); }
            this.loading = false;
        },
        async loadAuthor(uid) { if (!uid) return; const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid)); this.authorName = snap.exists() ? (snap.data().displayName || snap.data().email || 'Unknown') : uid; },
        formatDate(ts) { return formatDate(ts); },
        renderContent(c) { return c ? DOMPurify.sanitize(/<[a-z][\s\S]*>/i.test(c) ? c : marked.parse(c)) : ''; },
        async createPage() { await Alpine.store('mgmt').createPage(() => this.loadPagesList()); },
        async editPage() { if (this.currentPage) await Alpine.store('mgmt').editPage(this.currentPage, () => this.loadSinglePage(this.currentPage.id)); },
        async deletePage() { if (this.currentPage) await Alpine.store('mgmt').deletePage(this.currentPage.id, () => window.location.href = 'pages.html'); }
    }));
}

function registerAdminDashboard() {
    Alpine.data('adminDashboard', () => ({
        tab: 'dashboard', mobileMenu: false, loading: true, isAdmin: false, currentUser: null, users: [], pages: [], threads: [], dms: [], wikiSections: [], searchUser: '',
        navItems: [{id:'dashboard',label:'Dashboard',icon:'bi-speedometer2'},{id:'users',label:'Users',icon:'bi-people'},{id:'pages',label:'Pages',icon:'bi-file-earmark-text'},{id:'wiki',label:'Wiki',icon:'bi-book'},{id:'forums',label:'Forums',icon:'bi-chat-square-text'},{id:'dms',label:'Messages',icon:'bi-envelope'}],
        get stats() { return [{label:'Total Users',value:this.users.length,icon:'bi-people',color:'text-primary'},{label:'Pages',value:this.pages.length,icon:'bi-file-earmark',color:'text-success'},{label:'Threads',value:this.threads.length,icon:'bi-chat-square-text',color:'text-warning'},{label:'Messages',value:this.dms.length,icon:'bi-envelope',color:'text-info'}]; },
        get pageTitle() { return this.tab.charAt(0).toUpperCase() + this.tab.slice(1); },
        get filteredUsers() { if (!this.searchUser) return this.users; const l = this.searchUser.toLowerCase(); return this.users.filter(u => (u.displayName?.toLowerCase().includes(l)) || (u.email?.toLowerCase().includes(l))); },
        get recentActivity() {
            const acts = [...this.threads.map(t => ({id:t.id,text:`New thread: ${t.title}`,time:t.createdAt,icon:'bi-chat-square-text text-warning'})),...this.dms.map(d => ({id:d.id,text:`Message in ${d.participantNames?Object.values(d.participantNames).join(', '):'Conversation'}`,time:d.lastMessageTime,icon:'bi-envelope text-info'}))];
            return acts.sort((a,b) => (b.time?.seconds||0) - (a.time?.seconds||0)).slice(0,5);
        },
        async init() {
            document.addEventListener('admin-edit-msg', e => this.editMessage(e.detail.cid, {id:e.detail.mid,content:e.detail.content}));
            document.addEventListener('admin-del-msg', e => this.deleteMessage(e.detail.cid, e.detail.mid));
            document.addEventListener('admin-edit-comment', e => this.editComment(e.detail.tid, {id:e.detail.cid,content:e.detail.content}));
            document.addEventListener('admin-del-comment', e => this.deleteComment(e.detail.tid, e.detail.cid));
            Alpine.effect(async () => { const s = Alpine.store('auth'); if (!s.loading) { if (s.user) { this.currentUser = s.user; this.isAdmin = s.isAdmin; if (this.isAdmin) await this.refreshAll(); } this.loading = false; } });
        },
        async refreshAll() {
            const [u,p,t,d,w] = await Promise.all([getDocs(collection(db, COLLECTIONS.USER_PROFILES)),getDocs(collection(db, COLLECTIONS.PAGES)),getDocs(query(collection(db, COLLECTIONS.FORMS),orderBy('createdAt','desc'))),getDocs(query(collection(db, COLLECTIONS.CONVERSATIONS),orderBy('lastMessageTime','desc'))),getDocs(collection(db, COLLECTIONS.WIKI_PAGES))]);
            this.users = u.docs.map(x => ({id:x.id,...x.data()})); this.pages = p.docs.map(x => ({id:x.id,...x.data()})); this.threads = t.docs.map(x => ({id:x.id,...x.data()})); this.dms = d.docs.map(x => ({id:x.id,...x.data()})); this.wikiSections = w.docs.map(x => ({id:x.id,...x.data()}));
        },
        getAuthorName(uid) { const u = this.users.find(x => x.id === uid); return u ? (u.displayName || u.email) : 'Unknown'; },
        getDMName(dm) { return (dm.name && dm.name !== 'Chat') ? dm.name : dm.participants.map(uid => this.getAuthorName(uid)).join(', '); },
        formatDate(ts) { return formatDate(ts); },
        async createPage() { await Alpine.store('mgmt').createPage(() => this.refreshAll()); },
        async editPage(p) { await Alpine.store('mgmt').editPage(p, () => this.refreshAll()); },
        async deletePage(id) { await Alpine.store('mgmt').deletePage(id, () => this.refreshAll()); },
        async createWikiSection() { await Alpine.store('mgmt').createWikiSection(() => this.refreshAll()); },
        async editWikiSection(s) { await Alpine.store('mgmt').editWikiSection(s, () => this.refreshAll()); },
        async manageWikiEditors(s) { await Alpine.store('mgmt').manageWikiEditors(s, this.users, () => this.refreshAll()); },
        async deleteWikiSection(id) { await Alpine.store('mgmt').deleteWikiSection(id, () => this.refreshAll()); },

        async editUser(u) {
            const { value: v } = await Swal.fire({
                title: 'Edit User', width: '800px',
                html: `<div class="text-start admin-modal-scroll"><h6 class="text-primary mb-3">General</h6><div class="row g-2 mb-3">${[{id:'eu-name',l:'Name',v:u.displayName||''},{id:'eu-handle',l:'Handle',v:u.handle||''},{id:'eu-email',l:'Email',v:u.email||''},{id:'eu-photo',l:'Photo',v:u.photoURL||''},{id:'eu-css',l:'CSS',v:u.customCSS||''}].map(f=>`<div class="col-md-6"><label class="small">${f.l}</label><input id="${f.id}" class="form-control form-control-sm" value="${f.v}"></div>`).join('')}<div class="col-md-6"><label class="small">Role</label><select id="eu-role" class="form-select form-select-sm"><option value="user" ${!u.admin&&u.role!=='staff'?'selected':''}>User</option><option value="staff" ${u.role==='staff'?'selected':''}>Staff</option><option value="admin" ${u.admin?'selected':''}>Admin</option></select></div></div><h6 class="text-primary mb-3 border-top pt-3">Social</h6><div class="row g-2 mb-3">${[{id:'eu-discordId',l:'Discord ID',v:u.discordId||''},{id:'eu-discordTag',l:'Discord Tag',v:u.discordTag||''},{id:'eu-discordPic',l:'Discord Pic',v:u.discordPic||''},{id:'eu-discordURL',l:'Discord URL',v:u.discordURL||''},{id:'eu-githubPic',l:'GitHub Pic',v:u.githubPic||''},{id:'eu-githubURL',l:'GitHub URL',v:u.githubURL||''}].map(f=>`<div class="col-md-6"><label class="small">${f.l}</label><input id="${f.id}" class="form-control form-control-sm" value="${f.v}"></div>`).join('')}</div><h6 class="text-primary mb-3 border-top pt-3">Preferences</h6><div class="row g-2 mb-3"><div class="col-md-4"><label class="small">Theme</label><select id="eu-theme" class="form-select form-select-sm"><option value="dark" ${u.themePreference==='dark'?'selected':''}>Dark</option><option value="light" ${u.themePreference==='light'?'selected':''}>Light</option></select></div><div class="col-md-4"><label class="small">Font</label><select id="eu-font" class="form-select form-select-sm"><option value="small" ${u.fontScaling==='small'?'selected':''}>Small</option><option value="normal" ${u.fontScaling==='normal'?'selected':''}>Normal</option><option value="large" ${u.fontScaling==='large'?'selected':''}>Large</option></select></div><div class="col-md-4"><label class="small">Retention</label><input type="number" id="eu-retention" class="form-control form-control-sm" value="${u.dataRetention||365}"></div></div><div class="row g-2 mt-2"><div class="col-md-6"><label class="small">Glass Color</label><input id="eu-glassColor" class="form-control form-control-sm" value="${u.glassColor||''}"></div><div class="col-md-6"><label class="small">Opacity</label><input id="eu-glassOpacity" type="number" step="0.05" class="form-control form-control-sm" value="${u.glassOpacity||0.95}"></div><div class="col-md-6"><label class="small">Blur</label><input id="eu-glassBlur" type="number" class="form-control form-control-sm" value="${u.glassBlur||''}"></div><div class="col-12"><label class="small">Background</label><input id="eu-bgImg" class="form-control form-control-sm" value="${u.backgroundImage||''}"></div></div><h6 class="text-primary mb-3 border-top pt-3">Flags</h6><div class="row g-2">${[{id:'eu-activity',l:'Activity',c:u.activityTracking},{id:'eu-debug',l:'Debug',c:u.debugMode},{id:'eu-discordLinked',l:'Discord Linked',c:u.discordLinked},{id:'eu-discordNotif',l:'Discord Notifs',c:u.discordNotifications},{id:'eu-emailNotif',l:'Email Notifs',c:u.emailNotifications},{id:'eu-focus',l:'Focus',c:u.focusIndicators},{id:'eu-contrast',l:'Contrast',c:u.highContrast},{id:'eu-visible',l:'Visible',c:u.profileVisible},{id:'eu-push',l:'Push',c:u.pushNotifications},{id:'eu-motion',l:'Motion',c:u.reducedMotion},{id:'eu-reader',l:'Reader',c:u.screenReader},{id:'eu-sharing',l:'Sharing',c:u.thirdPartySharing}].map(f=>`<div class="col-md-4"><div class="form-check"><input type="checkbox" class="form-check-input" id="${f.id}" ${f.c?'checked':''}> <label class="small">${f.l}</label></div></div>`).join('')}</div></div>`,
                showCancelButton: true,
                preConfirm: () => ({
                    displayName: document.getElementById('eu-name').value, handle: document.getElementById('eu-handle').value, email: document.getElementById('eu-email').value, photoURL: document.getElementById('eu-photo').value, role: document.getElementById('eu-role').value, admin: document.getElementById('eu-role').value === 'admin', customCSS: document.getElementById('eu-css').value, discordId: document.getElementById('eu-discordId').value, discordTag: document.getElementById('eu-discordTag').value, discordPic: document.getElementById('eu-discordPic').value, discordURL: document.getElementById('eu-discordURL').value, githubPic: document.getElementById('eu-githubPic').value, githubURL: document.getElementById('eu-githubURL').value, themePreference: document.getElementById('eu-theme').value, fontScaling: document.getElementById('eu-font').value, dataRetention: parseInt(document.getElementById('eu-retention').value), glassColor: document.getElementById('eu-glassColor').value, glassOpacity: parseFloat(document.getElementById('eu-glassOpacity').value), glassBlur: parseInt(document.getElementById('eu-glassBlur').value), backgroundImage: document.getElementById('eu-bgImg').value, activityTracking: document.getElementById('eu-activity').checked, debugMode: document.getElementById('eu-debug').checked, discordLinked: document.getElementById('eu-discordLinked').checked, discordNotifications: document.getElementById('eu-discordNotif').checked, emailNotifications: document.getElementById('eu-emailNotif').checked, focusIndicators: document.getElementById('eu-focus').checked, highContrast: document.getElementById('eu-contrast').checked, profileVisible: document.getElementById('eu-visible').checked, pushNotifications: document.getElementById('eu-push').checked, reducedMotion: document.getElementById('eu-motion').checked, screenReader: document.getElementById('eu-reader').checked, thirdPartySharing: document.getElementById('eu-sharing').checked, updatedAt: serverTimestamp()
                })
            });
            if (v) { await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, u.id), v); this.refreshAll(); Swal.fire('Success', 'User updated', 'success'); }
        },

        async editThread(t) {
            const { value: v } = await Swal.fire({ title: 'Edit Thread', html: `<input id="et-title" class="form-control mb-2" value="${t.title}"><input id="et-tags" class="form-control mb-2" value="${t.tags||''}"><select id="et-cat" class="form-select mb-2"><option value="General">General</option><option value="Announcements">Announcements</option><option value="Support">Support</option><option value="Gaming">Gaming</option><option value="Discussion">Discussion</option></select><div class="form-check text-start mb-2"><input class="form-check-input" type="checkbox" id="et-locked" ${t.locked?'checked':''}> <label class="form-check-label">Lock</label></div><textarea id="et-desc" class="form-control" rows="5">${t.description}</textarea>`, didOpen: () => document.getElementById('et-cat').value = t.category || 'General', showCancelButton: true, preConfirm: () => ({ title: document.getElementById('et-title').value, tags: document.getElementById('et-tags').value, category: document.getElementById('et-cat').value, locked: document.getElementById('et-locked').checked, description: document.getElementById('et-desc').value }) });
            if (v) { await updateDoc(doc(db, COLLECTIONS.FORMS, t.id), v); this.refreshAll(); }
        },
        async deleteThread(id) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.FORMS, id)); this.refreshAll(); } },
        async viewThread(t) {
            const snap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(t.id)), orderBy('createdAt', 'asc')));
            const html = snap.docs.map(d => { const data = d.data(); return `<div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25"><div class="d-flex justify-content-between"><small class="text-info">${this.getAuthorName(data.authorId)}</small><small class="text-muted">${this.formatDate(data.createdAt)}</small></div><div class="my-1">${data.content}</div><div class="d-flex gap-2 justify-content-end"><button class="btn btn-sm btn-outline-secondary py-0" onclick="document.dispatchEvent(new CustomEvent('admin-edit-comment', {detail: {tid: '${t.id}', cid: '${d.id}', content: '${data.content.replace(/'/g, "\\'")}'}}))">Edit</button><button class="btn btn-sm btn-outline-danger py-0" onclick="document.dispatchEvent(new CustomEvent('admin-del-comment', {detail: {tid: '${t.id}', cid: '${d.id}'}}))">Del</button></div></div>`; }).join('');
            Swal.fire({ title: t.title, html: `<div class="text-start">${t.description}</div><hr><div class="text-start admin-list-scroll">${html || 'No comments'}</div>`, width: 800 });
        },

        async viewDM(dm) {
            const snap = await getDocs(query(collection(db, COLLECTIONS.CONV_MESSAGES(dm.id)), orderBy('createdAt', 'asc')));
            const html = snap.docs.map(d => { const data = d.data(); return `<div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25"><div class="d-flex justify-content-between"><small class="text-info">${dm.participantNames ? dm.participantNames[data.senderId] : this.getAuthorName(data.senderId)}</small><small class="text-muted">${this.formatDate(data.createdAt)}</small></div><div class="my-1">${data.content}</div><div class="d-flex gap-2 justify-content-end"><button class="btn btn-sm btn-outline-secondary py-0" onclick="document.dispatchEvent(new CustomEvent('admin-edit-msg', {detail: {cid: '${dm.id}', mid: '${d.id}', content: '${data.content.replace(/'/g, "\\'")}'}}))">Edit</button><button class="btn btn-sm btn-outline-danger py-0" onclick="document.dispatchEvent(new CustomEvent('admin-del-msg', {detail: {cid: '${dm.id}', mid: '${d.id}'}}))">Del</button></div></div>`; }).join('');
            Swal.fire({ title: 'Conversation Log', html: `<div class="text-start" style="max-height:400px;overflow-y:auto">${html || 'No messages'}</div>`, width: 600 });
        },
        async deleteDM(id) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.CONVERSATIONS, id)); this.refreshAll(); } },
        async deleteMessage(cid, mid) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(cid), mid)); const dm = this.dms.find(d => d.id === cid); if (dm) this.viewDM(dm); } },

        async editMessage(convId, msg) {
            const { value } = await Swal.fire({
                title: 'Edit Message',
                input: 'textarea',
                inputValue: msg.content,
                showCancelButton: true
            });
            if (value) {
                await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(convId), msg.id), { content: value });
                const openModal = Swal.getPopup();
                if (openModal) {
                    const dm = this.dms.find(d => d.id === convId);
                    if (dm) this.viewDM(dm);
                }
            }
        },

        async deleteComment(threadId, commentId) {
            if ((await Swal.fire({ title: 'Delete Comment?', icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(doc(db, COLLECTIONS.SUBMISSIONS(threadId), commentId));
                await updateDoc(doc(db, COLLECTIONS.FORMS, threadId), { commentCount: increment(-1) });
                const openModal = Swal.getPopup();
                if (openModal) {
                    const t = this.threads.find(x => x.id === threadId);
                    if (t) this.viewThread(t);
                }
            }
        },

        async editComment(threadId, comment) {
            const { value } = await Swal.fire({
                title: 'Edit Comment',
                input: 'textarea',
                inputValue: comment.content,
                showCancelButton: true
            });
            if (value) {
                await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(threadId), comment.id), { content: value });
                const openModal = Swal.getPopup();
                if (openModal) {
                    const t = this.threads.find(x => x.id === threadId);
                    if (t) this.viewThread(t);
                }
            }
        }
    }));
}

function registerResourcesData() {
    Alpine.data('resourcesData', () => ({
        censusHeader: [], censusData: [], censusLoading: true, adminLoading: true, adminContent: '', sortBy: 'name',
        async init() { await this.loadCensus(); await this.loadAdminDoc(); },
        parseCSV(t) {
            const res = []; let r = [], f = '', q = false;
            for (let i = 0; i < t.length; i++) {
                const c = t[i], n = t[i+1];
                if (c === '"') { if (q && n === '"') { f += '"'; i++; } else q = !q; }
                else if (c === ',' && !q) { r.push(f.trim()); f = ''; }
                else if ((c === '\n' || c === '\r') && !q) { if (f || r.length) { r.push(f.trim()); res.push(r); } r = []; f = ''; if (c === '\r' && n === '\n') i++; }
                else f += c;
            }
            if (f || r.length) { r.push(f.trim()); res.push(r); } return res;
        },
        async loadCensus() {
            try {
                const csv = await (await fetch('https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=1977273024')).text();
                const rows = this.parseCSV(csv); if (rows.length < 2) throw 0;
                this.censusHeader = rows[0]; this.censusData = rows.slice(1).filter(r => r[0]?.length);
            } catch (e) {} this.censusLoading = false;
        },
        async loadAdminDoc() {
            try {
                const html = await (await fetch('https://docs.google.com/document/d/1WvxTStjkBbQh9dp-59v1jJbaLPuofrnk_4N12mSMFo4/export?format=html')).text();
                this.adminContent = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
            } catch (e) {} this.adminLoading = false;
        },
        get filteredCensus() {
            let d = [...this.censusData];
            if (this.sortBy === 'name') d.sort((a,b) => a[0].localeCompare(b[0]));
            else if (this.sortBy === 'total') d.sort((a,b) => (parseInt(b[1])||0) - (parseInt(a[1])||0));
            return d;
        }
    }));
}

function registerAll() {
    registerAuthStore(); registerUsersStore(); registerPageWikiManagement(); registerForumData(); registerWikiApp(); registerPagesData(); registerAdminDashboard(); registerResourcesData(); registerMessageData();
}

document.addEventListener('alpine:init', () => {
    Alpine.directive('spinner', (el, { value, modifiers, expression }, { evaluateLater, effect }) => {
        const getLoading = evaluateLater(expression);
        const isSm = modifiers.includes('sm');
        const sizeClass = isSm ? 'spinner-border-sm' : '';
        const containerClasses = isSm ? ['text-center', 'py-1'] : ['d-flex', 'justify-content-center', 'align-items-center', 'vh-80'];
        
        el.classList.add(...containerClasses);
        el.innerHTML = `<div class="spinner-border text-primary ${sizeClass}" role="status"></div>`;
        
        effect(() => {
            getLoading(loading => {
                if (loading) {
                    el.style.setProperty('display', isSm ? 'block' : 'flex', 'important');
                } else {
                    el.style.setProperty('display', 'none', 'important');
                }
            });
        });
    });
    registerAll();
});
if (window.Alpine) { registerAll(); }
document.addEventListener('DOMContentLoaded', initLayout);

export {app, auth, db, projectId, appId, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, COLLECTIONS, firebaseReadyPromise, getCurrentUser, formatDate, generateProfilePic, randomIdentity, initLayout, updateUserSection, collection, collectionGroup, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, startAfter, serverTimestamp, increment, onAuthStateChanged, onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, linkWithPopup, linkWithCredential, unlink, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, TwitterAuthProvider, EmailAuthProvider, signOut, updateProfile, sendPasswordResetEmail};
