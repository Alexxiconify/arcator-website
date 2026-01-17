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

const userCache = {};

async function fetchAuthor(uid) {
    if (!uid || userCache[uid]) return;
    try {
        const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid));
        userCache[uid] = snap.exists() ? snap.data() : { displayName: 'Unknown User', photoURL: './defaultuser.png', uid };
    } catch (e) { console.error(`Fetch error ${uid}:`, e); }
}

function getAuthor(uid) {
    if (userCache[uid]) return userCache[uid];
    const store = Alpine.store('auth');
    if (store?.user?.uid === uid && store.profile) return store.profile;
    return { displayName: 'Unknown', photoURL: './defaultuser.png' };
}

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
                            if (!this.isAdmin) console.log("Not admin? Run this in console: Alpine.store('auth').makeMeAdmin()");
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
            console.log("You are now an admin!");
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

        init() {
            this.$watch('$store.auth.user', u => { if (u) this.loadConversations(); else { this.conversations = []; this.selectedConv = null; } });
            if (Alpine.store('auth').user) this.loadConversations();
        },

        async loadConversations() {
            const user = Alpine.store('auth').user; if (!user) return;
            const snap = await getDocs(query(collection(db, COLLECTIONS.CONVERSATIONS), where('participants', 'array-contains', user.uid)));
            const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const allParticipants = [...new Set(convs.flatMap(c => c.participants))];
            await Promise.all(allParticipants.map(fetchAuthor));
            this.conversations = convs;
        },

        getAuthor, fetchAuthor, formatDate,

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
            this.unsubscribe = onSnapshot(query(collection(db, COLLECTIONS.CONV_MESSAGES(conv.id)), orderBy('createdAt', 'asc')), snap => {
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
            const content = await promptEditor('Edit', '', msg.content);
            if (content) await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), msg.id), { content });
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
        tab: 'dashboard',
        mobileMenu: false,
        loading: true,
        isAdmin: false,
        currentUser: null,
        
        users: [],
        pages: [],
        threads: [],
        dms: [],
        wikiSections: [],
        
        searchUser: '',

        navItems: [
            { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
            { id: 'users', label: 'Users', icon: 'bi-people' },
            { id: 'pages', label: 'Pages', icon: 'bi-file-earmark-text' },
            { id: 'wiki', label: 'Wiki', icon: 'bi-book' },
            { id: 'forums', label: 'Forums', icon: 'bi-chat-square-text' },
            { id: 'dms', label: 'Messages', icon: 'bi-envelope' }
        ],

        get stats() {
            return [
                { label: 'Total Users', value: this.users.length, icon: 'bi-people', color: 'text-primary' },
                { label: 'Pages', value: this.pages.length, icon: 'bi-file-earmark', color: 'text-success' },
                { label: 'Threads', value: this.threads.length, icon: 'bi-chat-square-text', color: 'text-warning' },
                { label: 'Messages', value: this.dms.length, icon: 'bi-envelope', color: 'text-info' }
            ];
        },

        get pageTitle() {
            return this.tab.charAt(0).toUpperCase() + this.tab.slice(1);
        },

        get filteredUsers() {
            if (!this.searchUser) return this.users;
            const lower = this.searchUser.toLowerCase();
            return this.users.filter(u => 
                (u.displayName && u.displayName.toLowerCase().includes(lower)) ||
                (u.email && u.email.toLowerCase().includes(lower))
            );
        },

        get recentActivity() {
            const acts = [
                ...this.threads.map(t => ({ id: t.id, text: `New thread: ${t.title}`, time: t.createdAt, icon: 'bi-chat-square-text text-warning' })),
                ...this.dms.map(d => ({ id: d.id, text: `Message in ${d.participantNames ? Object.values(d.participantNames).join(', ') : 'Conversation'}`, time: d.lastMessageTime, icon: 'bi-envelope text-info' }))
            ];
            return acts.sort((a, b) => {
                const ta = a.time?.seconds || 0;
                const tb = b.time?.seconds || 0;
                return tb - ta;
            }).slice(0, 5);
        },

        async init() {
            document.addEventListener('admin-edit-msg', (e) => this.editMessage(e.detail.cid, {id: e.detail.mid, content: e.detail.content}));
            document.addEventListener('admin-del-msg', (e) => this.deleteMessage(e.detail.cid, e.detail.mid));
            document.addEventListener('admin-edit-comment', (e) => this.editComment(e.detail.tid, {id: e.detail.cid, content: e.detail.content}));
            document.addEventListener('admin-del-comment', (e) => this.deleteComment(e.detail.tid, e.detail.cid));

            Alpine.effect(async () => {
                const store = Alpine.store('auth');
                if (!store.loading) {
                    if (store.user) {
                        this.currentUser = store.user;
                        this.isAdmin = store.isAdmin;
                        if (this.isAdmin) await this.refreshAll();
                    } else {
                        this.isAdmin = false;
                    }
                    this.loading = false;
                }
            });
        },

        async refreshAll() {
            try {
                const [uSnap, pSnap, tSnap, dSnap, wSnap] = await Promise.all([
                    getDocs(collection(db, COLLECTIONS.USER_PROFILES)),
                    getDocs(collection(db, COLLECTIONS.PAGES)),
                    getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc'))),
                    getDocs(query(collection(db, COLLECTIONS.CONVERSATIONS), orderBy('lastMessageTime', 'desc'))),
                    getDocs(collection(db, COLLECTIONS.WIKI_PAGES))
                ]);

                this.users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.pages = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.threads = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.dms = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.wikiSections = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.error('Refresh failed', e);
                Swal.fire('Error', 'Failed to load data', 'error');
            }
        },

        getAuthorName(uid) {
            const u = this.users.find(x => x.id === uid);
            return u ? (u.displayName || u.email) : 'Unknown';
        },

        getDMName(dm) {
            if (dm.name && dm.name !== 'Chat') return dm.name;
            return dm.participants.map(uid => this.getAuthorName(uid)).join(', ');
        },

        formatDate(ts) { return formatDate(ts); },

        async createPage() { await Alpine.store('mgmt').createPage(() => this.refreshAll()); },
        async editPage(page) { await Alpine.store('mgmt').editPage(page, () => this.refreshAll()); },
        async deletePage(id) { await Alpine.store('mgmt').deletePage(id, () => this.refreshAll()); },

        async createWikiSection() { await Alpine.store('mgmt').createWikiSection(() => this.refreshAll()); },
        async editWikiSection(section) { await Alpine.store('mgmt').editWikiSection(section, () => this.refreshAll()); },
        async manageWikiEditors(section) { await Alpine.store('mgmt').manageWikiEditors(section, this.users, () => this.refreshAll()); },
        async deleteWikiSection(id) { await Alpine.store('mgmt').deleteWikiSection(id, () => this.refreshAll()); },

        async editUser(user) {
            const isSelf = this.currentUser.uid === user.id;
            const { value } = await Swal.fire({
                title: 'Edit User Profile',
                width: '800px',
                html: `
                    <div class="text-start admin-modal-scroll">
                        <h6 class="text-primary mb-3">General Info</h6>
                        <div class="row g-2 mb-3">
                            ${[
                                { id: 'eu-name', label: 'Display Name', value: user.displayName || '' },
                                { id: 'eu-handle', label: 'Handle', value: user.handle || '' },
                                { id: 'eu-email', label: 'Email', value: user.email || '' },
                                { id: 'eu-photo', label: 'Photo URL', value: user.photoURL || '' },
                                { id: 'eu-css', label: 'Custom CSS', value: user.customCSS || '' }
                            ].map(f => `
                                <div class="col-md-6">
                                    <label class="form-label small">${f.label}</label>
                                    <input id="${f.id}" class="form-control form-control-sm" value="${f.value}">
                                </div>
                            `).join('')}
                            <div class="col-md-6">
                                <label class="form-label small">Role</label>
                                <select id="eu-role" class="form-select form-select-sm">
                                    <option value="user" ${!user.admin && user.role !== 'staff' ? 'selected' : ''}>User</option>
                                    <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
                                    <option value="admin" ${user.admin ? 'selected' : ''}>Admin</option>
                                </select>
                            </div>
                        </div>

                        <h6 class="text-primary mb-3 border-top pt-3">Social & Links</h6>
                        <div class="row g-2 mb-3">
                            ${[
                                { id: 'eu-discordId', label: 'Discord ID', value: user.discordId || '' },
                                { id: 'eu-discordTag', label: 'Discord Tag', value: user.discordTag || '' },
                                { id: 'eu-discordPic', label: 'Discord Pic URL', value: user.discordPic || '' },
                                { id: 'eu-discordURL', label: 'Discord URL', value: user.discordURL || '' },
                                { id: 'eu-githubPic', label: 'GitHub Pic URL', value: user.githubPic || '' },
                                { id: 'eu-githubURL', label: 'GitHub URL', value: user.githubURL || '' }
                            ].map(f => `
                                <div class="col-md-6">
                                    <label class="form-label small">${f.label}</label>
                                    <input id="${f.id}" class="form-control form-control-sm" value="${f.value}">
                                </div>
                            `).join('')}
                        </div>

                        <h6 class="text-primary mb-3 border-top pt-3">Preferences</h6>
                        <div class="row g-2 mb-3">
                            <div class="col-md-4"><label class="form-label small">Theme</label><select id="eu-theme" class="form-select form-select-sm"><option value="dark" ${user.themePreference === 'dark' ? 'selected' : ''}>Dark</option><option value="light" ${user.themePreference === 'light' ? 'selected' : ''}>Light</option></select></div>
                            <div class="col-md-4"><label class="form-label small">Font Scaling</label><select id="eu-font" class="form-select form-select-sm"><option value="small" ${user.fontScaling === 'small' ? 'selected' : ''}>Small</option><option value="normal" ${user.fontScaling === 'normal' ? 'selected' : ''}>Normal</option><option value="large" ${user.fontScaling === 'large' ? 'selected' : ''}>Large</option></select></div>
                            <div class="col-md-4"><label class="form-label small">Data Retention (Days)</label><input type="number" id="eu-retention" class="form-control form-control-sm" value="${user.dataRetention || 365}"></div>
                            <div class="col-md-4"><label class="form-label small">Notif. Frequency</label><select id="eu-freq" class="form-select form-select-sm"><option value="immediate" ${user.notificationFrequency === 'immediate' ? 'selected' : ''}>Immediate</option><option value="daily" ${user.notificationFrequency === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${user.notificationFrequency === 'weekly' ? 'selected' : ''}>Weekly</option></select></div>
                            <div class="col-md-4"><label class="form-label small">Shortcuts</label><select id="eu-shortcuts" class="form-select form-select-sm"><option value="enabled" ${user.keyboardShortcuts === 'enabled' ? 'selected' : ''}>Enabled</option><option value="disabled" ${user.keyboardShortcuts === 'disabled' ? 'selected' : ''}>Disabled</option></select></div>
                        </div>
                        <div class="row g-2 mt-2">
                            <div class="col-md-6"><label class="form-label small">Glass Color</label><input id="eu-glassColor" class="form-control form-control-sm" value="${user.glassColor || ''}" placeholder="#000000"></div>
                            <div class="col-md-6"><label class="form-label small">Glass Opacity</label><input id="eu-glassOpacity" type="number" step="0.05" min="0" max="1" class="form-control form-control-sm" value="${user.glassOpacity || 0.95}"></div>
                            <div class="col-md-6"><label class="form-label small">Glass Blur</label><input id="eu-glassBlur" type="number" class="form-control form-control-sm" value="${user.glassBlur || ''}" placeholder="px"></div>
                            <div class="col-12"><label class="form-label small">Background Image</label><input id="eu-bgImg" class="form-control form-control-sm" value="${user.backgroundImage || ''}" placeholder="URL"></div>
                        </div>

                        <h6 class="text-primary mb-3 border-top pt-3">Flags & Settings</h6>
                        <div class="row g-2">
                            ${[
                                { id: 'eu-activity', label: 'Activity Tracking', checked: user.activityTracking },
                                { id: 'eu-debug', label: 'Debug Mode', checked: user.debugMode },
                                { id: 'eu-discordLinked', label: 'Discord Linked', checked: user.discordLinked },
                                { id: 'eu-discordNotif', label: 'Discord Notifs', checked: user.discordNotifications },
                                { id: 'eu-emailNotif', label: 'Email Notifs', checked: user.emailNotifications },
                                { id: 'eu-focus', label: 'Focus Indicators', checked: user.focusIndicators },
                                { id: 'eu-contrast', label: 'High Contrast', checked: user.highContrast },
                                { id: 'eu-visible', label: 'Profile Visible', checked: user.profileVisible },
                                { id: 'eu-push', label: 'Push Notifs', checked: user.pushNotifications },
                                { id: 'eu-motion', label: 'Reduced Motion', checked: user.reducedMotion },
                                { id: 'eu-reader', label: 'Screen Reader', checked: user.screenReader },
                                { id: 'eu-sharing', label: '3rd Party Sharing', checked: user.thirdPartySharing }
                            ].map(f => `
                                <div class="col-md-4">
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" id="${f.id}" ${f.checked ? 'checked' : ''}>
                                        <label class="form-check-label small">${f.label}</label>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `,
                showCancelButton: true,
                preConfirm: () => ({
                    displayName: document.getElementById('eu-name').value,
                    handle: document.getElementById('eu-handle').value,
                    email: document.getElementById('eu-email').value,
                    photoURL: document.getElementById('eu-photo').value,
                    role: document.getElementById('eu-role').value,
                    admin: document.getElementById('eu-role').value === 'admin',
                    customCSS: document.getElementById('eu-css').value,
                    discordId: document.getElementById('eu-discordId').value,
                    discordTag: document.getElementById('eu-discordTag').value,
                    discordPic: document.getElementById('eu-discordPic').value,
                    discordURL: document.getElementById('eu-discordURL').value,
                    githubPic: document.getElementById('eu-githubPic').value,
                    githubURL: document.getElementById('eu-githubURL').value,
                    themePreference: document.getElementById('eu-theme').value,
                    fontScaling: document.getElementById('eu-font').value,
                    dataRetention: parseInt(document.getElementById('eu-retention').value),
                    notificationFrequency: document.getElementById('eu-freq').value,
                    keyboardShortcuts: document.getElementById('eu-shortcuts').value,
                    backgroundImage: document.getElementById('eu-bgImg').value,
                    glassColor: document.getElementById('eu-glassColor').value,
                    glassOpacity: parseFloat(document.getElementById('eu-glassOpacity').value),
                    glassBlur: parseInt(document.getElementById('eu-glassBlur').value),
                    activityTracking: document.getElementById('eu-activity').checked,
                    debugMode: document.getElementById('eu-debug').checked,
                    discordLinked: document.getElementById('eu-discordLinked').checked,
                    discordNotifications: document.getElementById('eu-discordNotif').checked,
                    emailNotifications: document.getElementById('eu-emailNotif').checked,
                    focusIndicators: document.getElementById('eu-focus').checked,
                    highContrast: document.getElementById('eu-contrast').checked,
                    profileVisible: document.getElementById('eu-visible').checked,
                    pushNotifications: document.getElementById('eu-push').checked,
                    reducedMotion: document.getElementById('eu-motion').checked,
                    screenReader: document.getElementById('eu-reader').checked,
                    thirdPartySharing: document.getElementById('eu-sharing').checked
                })
            });
            if (value) {
                if (isSelf && !value.admin) {
                    Swal.fire('Error', 'You cannot remove your own admin status', 'error');
                    return;
                }
                await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, user.id), value);
                await this.refreshAll();
                Swal.fire('Success', 'User updated', 'success');
            }
        },

        async editThread(thread) {
            const { value } = await Swal.fire({
                title: 'Edit Thread',
                html: `
                    <input id="et-title" class="form-control mb-2" placeholder="Title" value="${thread.title}">
                    <input id="et-tags" class="form-control mb-2" placeholder="Tags (comma separated)" value="${thread.tags || ''}">
                    <select id="et-cat" class="form-select mb-2">
                        <option value="General">General</option>
                        <option value="Announcements">Announcements</option>
                        <option value="Support">Support</option>
                        <option value="Gaming">Gaming</option>
                        <option value="Discussion">Discussion</option>
                    </select>
                    <div class="form-check text-start mb-2">
                        <input class="form-check-input" type="checkbox" id="et-locked" ${thread.locked ? 'checked' : ''}>
                        <label class="form-check-label" for="et-locked">Lock Thread</label>
                    </div>
                    <textarea id="et-desc" class="form-control" rows="5" placeholder="Description">${thread.description}</textarea>
                `,
                didOpen: () => document.getElementById('et-cat').value = thread.category || 'General',
                showCancelButton: true,
                preConfirm: () => ({
                    title: document.getElementById('et-title').value,
                    tags: document.getElementById('et-tags').value,
                    category: document.getElementById('et-cat').value,
                    locked: document.getElementById('et-locked').checked,
                    description: document.getElementById('et-desc').value
                })
            });
            if (value) {
                await updateDoc(doc(db, COLLECTIONS.FORMS, thread.id), value);
                await this.refreshAll();
                Swal.fire('Success', 'Thread updated', 'success');
            }
        },

        async deleteThread(id) {
            if ((await Swal.fire({ title: 'Delete Thread?', icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(doc(db, COLLECTIONS.FORMS, id));
                await this.refreshAll();
                Swal.fire('Deleted', '', 'success');
            }
        },

        async viewThread(thread) {
            const snap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(thread.id)), orderBy('createdAt', 'asc')));
            const comments = snap.docs.map(d => {
                const data = d.data();
                const author = this.getAuthorName(data.authorId);
                return `
                    <div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25">
                        <div class="d-flex justify-content-between">
                            <small class="text-info">${author}</small>
                            <small class="text-muted">${this.formatDate(data.createdAt)}</small>
                        </div>
                        <div class="my-1">${data.content}</div>
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-sm btn-outline-secondary py-0" onclick="document.dispatchEvent(new CustomEvent('admin-edit-comment', {detail: {tid: '${thread.id}', cid: '${d.id}', content: '${data.content.replace(/'/g, "\\'")}'}}))">Edit</button>
                            <button class="btn btn-sm btn-outline-danger py-0" onclick="document.dispatchEvent(new CustomEvent('admin-del-comment', {detail: {tid: '${thread.id}', cid: '${d.id}'}}))">Del</button>
                        </div>
                    </div>`;
            }).join('');
            
            Swal.fire({
                title: thread.title,
                html: `<div class="text-start">${thread.description}</div><hr><div class="text-start admin-list-scroll">${comments || 'No comments'}</div>`,
                width: 800
            });
        },

        async viewDM(dm) {
            const snap = await getDocs(query(collection(db, COLLECTIONS.CONV_MESSAGES(dm.id)), orderBy('createdAt', 'asc')));
            const msgs = snap.docs.map(d => {
                const data = d.data();
                const author = dm.participantNames ? dm.participantNames[data.senderId] : this.getAuthorName(data.senderId);
                return `
                    <div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25">
                        <div class="d-flex justify-content-between">
                            <small class="text-info">${author}</small>
                            <small class="text-muted">${this.formatDate(data.createdAt)}</small>
                        </div>
                        <div class="my-1">${data.content}</div>
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-sm btn-outline-secondary py-0" onclick="document.dispatchEvent(new CustomEvent('admin-edit-msg', {detail: {cid: '${dm.id}', mid: '${d.id}', content: '${data.content.replace(/'/g, "\\'")}'}}))">Edit</button>
                            <button class="btn btn-sm btn-outline-danger py-0" onclick="document.dispatchEvent(new CustomEvent('admin-del-msg', {detail: {cid: '${dm.id}', mid: '${d.id}'}}))">Del</button>
                        </div>
                    </div>`;
            }).join('');

            Swal.fire({
                title: 'Conversation Log',
                html: `<div class="text-start" style="max-height:400px;overflow-y:auto">${msgs || 'No messages'}</div>`,
                width: 600
            });
        },

        async deleteDM(id) {
            if ((await Swal.fire({ title: 'Delete Conversation?', icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(doc(db, COLLECTIONS.CONVERSATIONS, id));
                await this.refreshAll();
                Swal.fire('Deleted', '', 'success');
            }
        },

        async deleteMessage(convId, msgId) {
            if ((await Swal.fire({ title: 'Delete Message?', icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(convId), msgId));
                const openModal = Swal.getPopup();
                if (openModal) {
                    const dm = this.dms.find(d => d.id === convId);
                    if (dm) this.viewDM(dm);
                }
            }
        },

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
        censusHeader: [],
        censusData: [],
        censusLoading: true,
        adminLoading: true,
        adminContent: '',
        sortBy: 'name',

        async init() {
            await this.loadCensus();
            await this.loadAdminDoc();
        },

        parseCSV(text) {
            const rows = [];
            let row = [], field = '', inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const c = text[i], next = text[i+1];
                if (c === '"') { if (inQuotes && next === '"') { field += '"'; i++; } else inQuotes = !inQuotes; }
                else if (c === ',' && !inQuotes) { row.push(field.trim()); field = ''; }
                else if ((c === '\n' || c === '\r') && !inQuotes) { if (field || row.length) { row.push(field.trim()); rows.push(row); } row = []; field = ''; if (c === '\r' && next === '\n') i++; }
                else field += c;
            }
            if (field || row.length) { row.push(field.trim()); rows.push(row); }
            return rows;
        },

        async loadCensus() {
            try {
                const url = 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=1977273024';
                const res = await fetch(url);
                const csv = await res.text();
                const rows = this.parseCSV(csv);
                
                if (rows.length < 2) throw new Error('No data');
                
                this.censusHeader = rows[0];
                this.censusData = rows.slice(1).filter(r => r[0] && r[0].length > 0);
                this.censusLoading = false;
            } catch (e) {
                console.error('Census error:', e);
                this.censusLoading = false;
            }
        },

        async loadAdminDoc() {
            try {
                const url = 'https://docs.google.com/document/d/1WvxTStjkBbQh9dp-59v1jJbaLPuofrnk_4N12mSMFo4/export?format=html';
                const res = await fetch(url);
                const html = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                this.adminContent = doc.body.innerHTML;
                this.adminLoading = false;
            } catch (e) {
                console.error('Admin doc error:', e);
                this.adminLoading = false;
            }
        },

        get filteredCensus() {
            let data = [...this.censusData];
            if (this.sortBy === 'name') data.sort((a,b) => a[0].localeCompare(b[0]));
            else if (this.sortBy === 'total') data.sort((a,b) => (parseInt(b[1])||0) - (parseInt(a[1])||0));
            return data;
        }
    }));
}

function registerAll() {
    registerAuthStore();
    registerForumData();
    registerMessageData();
    registerPageWikiManagement();
    registerWikiApp();
    registerPagesData();
    registerAdminDashboard();
    registerResourcesData();
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
