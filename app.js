
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { createUserWithEmailAndPassword, getAuth, GithubAuthProvider, GoogleAuthProvider, OAuthProvider, TwitterAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, linkWithPopup, unlink, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, initializeFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { indexDoc, removeDoc, markSearchReady } from './js/search.js';
import './js/keys.js';
import './js/glitch.js';

const cfg = { apiKey: "AIzaSyAYzo2zbIZwq9PYZmsXI6_RTnzbNSEpzwQ", authDomain: "arcator-v2.firebaseapp.com", databaseURL: "https://arcator-v2-default-rtdb.firebaseio.com", projectId: "arcator-v2", storageBucket: "arcator-v2.firebasestorage.app", messagingSenderId: "171774915460", appId: "1:171774915460:web:97b95c10b81fe4c7eae3d1", measurementId: "G-36VY36ECG5" };
const app = initializeApp(cfg);
app.automaticDataCollectionEnabled = false;
const auth = getAuth(app);
const db = initializeFirestore(app, {});
const projectId = cfg.projectId;
const appId = cfg.appId;
const DEFAULT_PROFILE_PIC = './defaultuser.png';
const DEFAULT_THEME_NAME = 'dark';

const COLLECTIONS = { USERS: 'user_profiles', USER_PROFILES: 'user_profiles', FORMS: 'forms', SUBMISSIONS: (formId) => `forms/${formId}/submissions`, CONVERSATIONS: 'conversations', CONV_MESSAGES: (convId) => `conversations/${convId}/messages`, THEMES: 'custom_themes', PAGES: 'temp_pages', WIKI_CONFIG: 'wiki_config', WIKI_PAGES: 'wiki_pages' };

const firebaseReadyPromise = new Promise(r => { const u = auth.onAuthStateChanged(() => { u(); r(true); }); });
const getCurrentUser = () => auth.currentUser;

const formatDate = ts => {
    if (!ts) { return ''; }
    const d = new Date(ts.seconds ? ts.seconds * 1000 : ts), now = new Date();
    return (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
const escapeHtml = str => {
    if (!str) { return ''; }
    return String(str).replaceAll(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
};
const generateProfilePic = name => { const colors = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'], canvas = document.createElement('canvas'); canvas.width = canvas.height = 200; const ctx = canvas.getContext('2d'), hash = [...name].reduce((a, c) => a + c.codePointAt(0), 0); ctx.fillStyle = colors[Math.abs(hash) % colors.length]; ctx.fillRect(0, 0, 200, 200); ctx.fillStyle = '#FFF'; ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2), 100, 100); return canvas.toDataURL('image/png'); };
const randomIdentity = () => { const adj = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Bright', 'Cool', 'Smart'], noun = ['Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Tiger', 'Lion', 'Owl']; const a = adj[Math.floor(Math.random() * adj.length)], n = noun[Math.floor(Math.random() * noun.length)]; return { displayName: `${a} ${n}`, handle: `${a.toLowerCase()}${n}${Math.floor(Math.random() * 1000)}` }; };
const NAV_HTML = `<nav class="arc-nav" aria-label="Main"><menu><li><a href="./index.html" class="arc-nav-brand">Arcator</a></li><li><a href="./wiki.html">Wiki</a></li><li><a href="./forms.html">Forums</a></li><li><a href="./pages.html">Pages</a></li><li><a href="./resources.html">Resources</a></li><li><a href="https://jylina.arcator.co.uk/hub">Hub Maps</a></li><li><a href="https://jylina.arcator.co.uk/stats">Stats</a></li><li><a href="https://discord.gg/GwArgw2">Discord</a></li><li><a href="https://apollo.arcator.co.uk/standalone/souls/">Soul Vis</a></li><li><a href="https://apollo.arcator.co.uk/standalone/joins.html">Social Graph</a></li><li class="d-none" id="admin-link"><a href="./mod.html">Admin</a></li><li class="arc-user-section"><a href="./users.html" id="sign-in-btn">Sign In</a><a href="./users.html" class="d-none arc-profile-link" id="user-profile-link"><img src="./defaultuser.png" class="avatar-sm" alt="Profile" id="user-avatar"></a></li></menu></nav>`;
const FOOTER_HTML = `<footer class="arc-footer"><div class="container-fluid px-4 arc-footer-inner"><div class="d-flex gap-3"><a href="https://jylina.arcator.co.uk/ssmp" class="text-secondary text-decoration-none" target="_blank" rel="noopener">SSMP Blue Maps</a><a href="https://wiki.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">Wiki</a></div><span class="text-secondary">© 2026 Arcator</span></div></footer>`;
function initLayout() {
    const nav = document.getElementById('navbar-placeholder'), foot = document.getElementById('footer-placeholder');
    if (nav) {
        nav.innerHTML = NAV_HTML;
        const cur = location.pathname.split('/').pop() || 'index.html';
        nav.querySelectorAll('menu a').forEach(l => (l.getAttribute('href') === `./${cur}` || (cur === 'index.html' && l.getAttribute('href') === './index.html')) && l.setAttribute('aria-current', 'page'));
    }
    if (foot) foot.innerHTML = FOOTER_HTML;
    if (globalThis.Alpine) { const s = Alpine.store('auth'); s && !s.loading && updateUserSection(s.user, s.profile, s.isAdmin); }
}
function updateUserSection(u, p, isAdmin = false) {
    const btn = document.getElementById('sign-in-btn'), link = document.getElementById('user-profile-link'), av = document.getElementById('user-avatar'), adm = document.getElementById('admin-link');
    if (!btn || !link) return;
    if (u) {
        btn.classList.add('d-none'); link.classList.replace('d-none', 'd-flex');
        if (av) av.src = p?.photoURL || u.photoURL || './defaultuser.png';
        if (adm) adm.classList.toggle('d-none', !isAdmin);
    } else {
        btn.classList.remove('d-none'); link.classList.replace('d-flex', 'd-none');
        if (adm) adm.classList.add('d-none');
    }
}
const cacheUser = (u, p) => localStorage.setItem('arcator_user_cache', JSON.stringify({ uid: u.uid, displayName: p?.displayName || u.displayName, photoURL: p?.photoURL || u.photoURL, themePreference: p?.themePreference || 'dark', fontScaling: p?.fontScaling || 'normal', backgroundImage: p?.backgroundImage, glassColor: p?.glassColor, glassOpacity: p?.glassOpacity, glassBlur: p?.glassBlur }));
const updateTheme = (t = 'dark', f = 'normal', css = '', bg = '', gc = '', go = 0.95, gb = '') => {
    const r = document.documentElement;
    r.dataset.theme = t; r.dataset.fontSize = f;
    document.body.style.backgroundImage = bg ? `url('${bg}')` : '';
    if (gc && go) {
        const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(gc);
        if (rgb) { r.style.setProperty('--glass-bg', `rgba(${Number.parseInt(rgb[1], 16)}, ${Number.parseInt(rgb[2], 16)}, ${Number.parseInt(rgb[3], 16)}, ${go})`); }
    } else { r.style.removeProperty('--glass-bg'); }
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
                } catch (e) {
                    console.warn('Failed to parse cached user data:', e);
                }
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

                            // Check admins collection for source of truth
                            try {
                                const adminSnap = await getDoc(doc(db, 'admins', u.uid));
                                this.isAdmin = adminSnap.exists();
                            } catch (e) {
                                console.error('Admin check failed:', e);
                                this.isAdmin = false;
                            }
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

        async checkAdmin() { return this.isAdmin; },

        async login(email, password) {
            const result = await signInWithEmailAndPassword(auth, email, password);
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => { });
            return result.user;
        },

        async signup(email, password, displayName, handle) {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            const photoURL = generateProfilePic(displayName);
            await updateProfile(user, { displayName, photoURL });
            const profile = { uid: user.uid, displayName, email, photoURL, handle, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), themePreference: DEFAULT_THEME_NAME };
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
            const provider = this.getProvider(providerName);
            const result = await signInWithPopup(auth, provider);

            if (providerName === 'discord') {
                await this.syncDiscordData(result);
            }

            if (result._tokenResponse?.isNewUser) {
                await this.initializeNewUser(result, providerName);
            } else {
                await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => { });
            }
            return result.user;
        },

        async syncDiscordData(result) {
            const accessToken = result._tokenResponse?.accessToken;
            if (!accessToken) { return; }
            try {
                const resp = await fetch('https://discord.com/api/v10/users/@me', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (resp.ok) {
                    const d = await resp.json();
                    await setDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), {
                        discordId: d.id,
                        discordTag: `${d.username}#${d.discriminator}`,
                        discordPic: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png` : null
                    }, { merge: true });
                }
            } catch (e) {
                console.error('Failed to fetch Discord user data', e);
            }
        },

        async initializeNewUser(result, providerName) {
            const { displayName: rn, handle } = randomIdentity();
            const displayName = result.user.displayName || rn;
            const photoURL = result.user.photoURL || generateProfilePic(displayName);
            await setDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), {
                uid: result.user.uid, displayName, email: result.user.email || '', photoURL, handle,
                themePreference: DEFAULT_THEME_NAME, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), provider: providerName
            });
        },

        async saveProfile(uid, profileData) {
            const safeData = { ...profileData };
            delete safeData.admin; delete safeData.role; delete safeData.staff; delete safeData.uid; delete safeData.createdAt;
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, uid), safeData);
            this.profile = { ...this.profile, ...safeData };
            cacheUser(this.user, this.profile);
            updateTheme(this.profile.themePreference, this.profile.fontScaling, this.profile.customCSS);
            updateUserSection(this.user, this.profile, this.isAdmin);
        },

        getProvider(name) {
            switch (name) {
                case 'google': { const g = new GoogleAuthProvider(); g.setCustomParameters({ prompt: 'select_account' }); return g; }
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

function forumData() {
    return {
        threads: [], loading: true, showCreateModal: false, newThread: { title: '', category: '', tags: '' }, quill: null,
        async init() {
            this.loadThreads();
            this.$watch('showCreateModal', v => this.handleCreateModalToggle(v));
        },
        handleCreateModalToggle(v) {
            if (v && !this.quill) {
                this.$nextTick(() => { this.initializeQuill(); });
            }
        },
        initializeQuill() {
            this.quill = new Quill(this.$refs.createEditor, {
                theme: 'snow',
                placeholder: 'Describe your thread...'
            });
        },
        async loadThreads() {
            const snap = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
            this.threads = await Promise.all(snap.docs.map(d => this.mapThreadDoc(d)));
            this.threads.forEach(t => indexDoc({ kind: 'thread', id: t.id, title: t.title, body: (t.description || '').replace(/<[^>]+>/g, ' ') }));
            const ids = this.getUniqueAuthorIds();
            await Promise.all(ids.map(fetchAuthor));
            this.loading = false;
            markSearchReady();
        },
        getUniqueAuthorIds() {
            const authors = this.threads.map(t => t.authorId);
            const commentAuthors = this.threads.flatMap(t => {
                return t.comments.map(c => c.authorId);
            });
            return [...new Set([...authors, ...commentAuthors].filter(Boolean))];
        },
        async mapThreadDoc(d) {
            const data = { id: d.id, ...d.data(), expanded: true, comments: [], loadingComments: false, quill: null };
            const cSnap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(d.id)), orderBy('createdAt', 'asc')));
            data.comments = cSnap.docs.map(cd => ({ id: cd.id, ...cd.data() }));
            return data;
        },
        getAuthor, fetchAuthor, formatDate,
        getThreadMeta(t) {
            const a = getAuthor(t.authorId);
            const authorName = a.displayName || 'Unknown';
            const profileImg = `<img src="${a.photoURL || './defaultuser.png'}" class="profile-img-sm me-1" alt="">`;
            const tagStr = t.tags ? `<span class="badge bg-secondary me-1">${t.tags}</span>` : '';
            const catStr = t.category ? t.category[0].toUpperCase() + t.category.slice(1) : 'General';
            return `${tagStr} ${profileImg} ${authorName} • ${catStr} • ${formatDate(t.createdAt)} • ${t.commentCount || 0} comments`;
        },
        async createThread() {
            if (!this.quill) { return; }
            const u = Alpine.store('auth').user;
            if (!u) { return; }
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
        async deleteThread(id) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.FORMS, id)); removeDoc(id); this.threads = this.threads.filter(t => t.id !== id); } },
        async postComment(fid) {
            const t = this.threads.find(t => t.id === fid); if (!t?.quill) return;
            const c = t.quill.root.innerHTML; if (!c || c === '<p><br></p>') return;
            const batch = writeBatch(db);
            const newCommentRef = doc(collection(db, COLLECTIONS.SUBMISSIONS(fid)));
            batch.set(newCommentRef, { content: c, authorId: Alpine.store('auth').user.uid, createdAt: serverTimestamp(), parentCommentId: null });
            batch.update(doc(db, COLLECTIONS.FORMS, fid), { commentCount: increment(1) });
            await batch.commit();
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
        getVoteScore(c) {
            if (!c.reactions) { return 0; }
            let s = 0;
            for (const k of Object.keys(c.reactions)) {
                if (k.startsWith('up_')) { s++; }
                if (k.startsWith('down_')) { s--; }
            }
            return s;
        },
        getReactions(c) {
            if (!c.reactions) { return {}; }
            const res = {};
            for (const k of Object.keys(c.reactions)) {
                const e = k.split('_')[0];
                if (e !== 'up' && e !== 'down') { res[e] = (res[e] || 0) + 1; }
            }
            return res;
        },
        async replyTo(t, p) {
            const c = await promptEditor('Reply', '', '', 'Write reply...');
            if (c) {
                const batch = writeBatch(db);
                const newCommentRef = doc(collection(db, COLLECTIONS.SUBMISSIONS(t.id)));
                batch.set(newCommentRef, { content: c, authorId: Alpine.store('auth').user.uid, createdAt: serverTimestamp(), parentCommentId: p.parentCommentId || p.id });
                batch.update(doc(db, COLLECTIONS.FORMS, t.id), { commentCount: increment(1) });
                await batch.commit();
                t.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(t.id)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
            }
        },
        async deleteComment(fid, cid) {
            if (!confirm('Delete?')) return;
            const batch = writeBatch(db);
            batch.update(doc(db, COLLECTIONS.FORMS, fid), { commentCount: increment(-1) });
            batch.delete(doc(db, COLLECTIONS.SUBMISSIONS(fid), cid));
            await batch.commit();
            const t = this.threads.find(t => t.id === fid); if (t) t.comments = (await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(fid)), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
        },
        async editThread(t) {
            const { value: v } = await Swal.fire({
                title: 'Edit',
                html: `<input id="s1" class="swal2-input" placeholder="Title"><input id="s2" class="swal2-input" placeholder="Tags"><select id="s3" class="swal2-input"><option value="announcements">Announcements</option><option value="gaming">Gaming</option><option value="discussion">Discussion</option><option value="support">Support</option></select><textarea id="ed-thread-content" rows="10"></textarea>`,
                didOpen: () => {
                    document.getElementById('s1').value = t.title;
                    document.getElementById('s2').value = t.tags || '';
                    document.getElementById('s3').value = t.category || 'discussion';
                    document.getElementById('ed-thread-content').value = t.description || '';
                },
                preConfirm: () => [
                    document.getElementById('s1').value,
                    document.getElementById('s2').value,
                    document.getElementById('s3').value,
                    document.getElementById('ed-thread-content').value
                ]
            });
            if (v) { await updateDoc(doc(db, COLLECTIONS.FORMS, t.id), { title: v[0], tags: v[1], category: v[2], description: v[3], updatedAt: serverTimestamp() }); Object.assign(t, { title: v[0], tags: v[1], category: v[2], description: v[3] }); }
        },
        async editComment(fid, c) { const res = await promptEditor('Edit', '', c.content); if (res) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(fid), c.id), { content: res }); c.content = res; } },
        async censorComment(fid, c) { const res = await promptEditor('Redact', '', c.content); if (res) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(fid), c.id), { content: res, censored: true }); c.content = res; c.censored = true; } }
    };
}
function registerForumData() {
    Alpine.data('forumData', forumData);
}

function messageData() {
    return {
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
            const u = Alpine.store('auth').user;
            if (c.name && c.name !== 'Notes') return c.name;
            if (c.participants.length === 1) return 'Notes';
            return c.participants.filter(id => id !== u.uid).map(id => getAuthor(id).displayName).join(', ') || 'Chat';
        },
        async selectConv(c) {
            this.selectedConv = c; if (this.unsubscribe) this.unsubscribe();
            const q = query(collection(db, COLLECTIONS.CONV_MESSAGES(c.id)), orderBy('createdAt', 'asc'));
            this.unsubscribe = onSnapshot(q, snap => this.handleMessageSnapshot(snap));
        },
        handleMessageSnapshot(snap) {
            this.messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.$nextTick(() => this.scrollToBottom());
        },
        scrollToBottom() { const el = document.getElementById('msg-list'); if (el) el.scrollTop = el.scrollHeight; },
        async sendMessage() {
            if (!this.newMessage.trim() || !this.selectedConv) return;
            const u = Alpine.store('auth').user, batch = writeBatch(db), newMsgRef = doc(collection(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id)));
            batch.set(newMsgRef, { content: this.newMessage, senderId: u.uid, createdAt: serverTimestamp() });
            batch.update(doc(db, COLLECTIONS.CONVERSATIONS, this.selectedConv.id), { lastMessage: this.newMessage, lastMessageTime: serverTimestamp() });
            await batch.commit(); this.newMessage = '';
        },
        async deleteMessage(id) { if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), id)); },
        async editMessage(m) { const c = await promptEditor('Edit', '', m.content); if (c) await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(this.selectedConv.id), m.id), { content: c }); },
        async createConversation() {
            const snap = await getDocs(collection(db, COLLECTIONS.USER_PROFILES)), u = Alpine.store('auth').user, others = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.id !== u.uid);
            if (!others.length) return Swal.fire('No users', '', 'info');
            const opts = others.map(x => `<option value="${x.id}">${x.displayName || x.email}</option>`).join('');
            const { value: id } = await Swal.fire({ title: 'New Conversation', html: `<select id="new-conv">${opts}</select>`, preConfirm: () => document.getElementById('new-conv').value, showCancelButton: true });
            if (id) {
                const ex = this.conversations.find(c => c.participants.includes(id) && c.participants.length === 2);
                if (ex) return this.selectConv(ex);
                await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), { participants: [u.uid, id], createdAt: serverTimestamp(), lastMessageTime: serverTimestamp() });
                this.loadConversations();
            }
        }
    };
}
function registerMessageData() {
    Alpine.data('messageData', messageData);
}

function registerPageWikiManagement() {
    Alpine.store('mgmt', {
        async createPage(cb) {
            const { value: v } = await Swal.fire({ title: 'Create Page', html: '<input id="np-title" class="mb-2" placeholder="Title"><input id="np-slug" class="mb-2" placeholder="Slug"><textarea id="np-content" rows="10" placeholder="HTML Content"></textarea>', showCancelButton: true, preConfirm: () => ({ title: document.getElementById('np-title').value, slug: document.getElementById('np-slug').value, content: document.getElementById('np-content').value, authorId: Alpine.store('auth').user.uid, createdAt: serverTimestamp() }) });
            if (v) {
                await addDoc(collection(db, COLLECTIONS.PAGES), v);
                if (cb) { cb(); }
                Swal.fire('Success', 'Page created', 'success');
            }
        },
        async editPage(p, cb) {
            const { value: v } = await Swal.fire({ title: 'Edit Page', width: '800px', html: `<input id="ep-title" class="mb-2" placeholder="Title"><input id="ep-slug" class="mb-2" placeholder="Slug"><textarea id="ep-content" class="font-monospace" rows="15" placeholder="HTML Content"></textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('ep-title').value = p.title; document.getElementById('ep-slug').value = p.slug; document.getElementById('ep-content').value = p.content; }, preConfirm: () => ({ title: document.getElementById('ep-title').value, slug: document.getElementById('ep-slug').value, content: document.getElementById('ep-content').value, updatedAt: serverTimestamp() }) });
            if (v) {
                await updateDoc(doc(db, COLLECTIONS.PAGES, p.id), v);
                if (cb) { cb(); }
                Swal.fire('Success', 'Page updated', 'success');
            }
        },
        async deletePage(id, cb) {
            if ((await Swal.fire({ title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(doc(db, COLLECTIONS.PAGES, id));
                removeDoc(id);
                if (cb) { cb(); }
                Swal.fire('Deleted', 'Page has been deleted.', 'success');
            }
        },
        async createWikiSection(cb) {
            const { value: v } = await Swal.fire({ title: 'Create Wiki Section', html: '<input id="nw-id" class="mb-2" placeholder="Section ID (e.g. servers)"><textarea id="nw-content" class="font-monospace" rows="12" placeholder="HTML Content"></textarea>', showCancelButton: true, preConfirm: () => ({ id: document.getElementById('nw-id').value.toLowerCase().replaceAll(/\s+/g, '-'), content: document.getElementById('nw-content').value }) });
            if (v?.id) {
                await setDoc(doc(db, COLLECTIONS.WIKI_PAGES, v.id), { content: v.content, allowedEditors: [], updatedAt: serverTimestamp() });
                if (cb) { cb(); }
                Swal.fire('Success', 'Wiki section created', 'success');
            }
        },
        async editWikiSection(s, cb) {
            const { value: v } = await Swal.fire({ title: `Edit: ${escapeHtml(s.id)}`, width: '900px', html: `<textarea id="ew-content" class="font-monospace" rows="20"></textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('ew-content').value = s.content || ''; }, preConfirm: () => document.getElementById('ew-content').value });
            if (v !== undefined) {
                await updateDoc(doc(db, COLLECTIONS.WIKI_PAGES, s.id), { content: v, updatedAt: serverTimestamp() });
                if (cb) { cb(); }
                Swal.fire('Success', 'Wiki section updated', 'success');
            }
        },
        async manageWikiEditors(s, users, cb) {
            const cur = s.allowedEditors || [];
            const opts = users.map(u => `<option value="${escapeHtml(u.id)}" ${cur.includes(u.id) ? 'selected' : ''}>${escapeHtml(u.displayName || u.email)}</option>`).join('');
            const { value: v } = await Swal.fire({ title: `Allowed Editors: ${escapeHtml(s.id)}`, html: `<p class="text-muted small">Admins can always edit. Select users who can also edit this section:</p><select id="ew-editors" multiple size="10">${opts}</select>`, showCancelButton: true, preConfirm: () => Array.from(document.getElementById('ew-editors').selectedOptions).map(o => o.value) });
            if (v !== undefined) {
                await updateDoc(doc(db, COLLECTIONS.WIKI_PAGES, s.id), { allowedEditors: v, updatedAt: serverTimestamp() });
                if (cb) { cb(); }
                Swal.fire('Success', 'Editors updated', 'success');
            }
        },
        async deleteWikiSection(id, cb) {
            if ((await Swal.fire({ title: 'Delete Wiki Section?', text: 'This cannot be undone!', icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(doc(db, COLLECTIONS.WIKI_PAGES, id));
                removeDoc(id);
                if (cb) { cb(); }
                Swal.fire('Deleted', 'Section removed.', 'success');
            }
        }
    });
}

function wikiApp() {
    return {
        tab: 'home', loading: true, tabs: [{ id: 'home', label: 'Welcome', icon: 'bi-house' }, { id: 'servers', label: 'Servers', icon: 'bi-hdd-network' }, { id: 'software', label: 'Software', icon: 'bi-code-square' }, { id: 'sysadmin', label: 'Sysadmin', icon: 'bi-terminal' }, { id: 'machines', label: 'Machines', icon: 'bi-pc-display' }, { id: 'staff', label: 'Staff', icon: 'bi-people' }, { id: 'mcadmin', label: 'MCAdmin', icon: 'bi-shield-lock' }, { id: 'growth', label: 'Growth Plans', icon: 'bi-graph-up' }], tabContent: {}, tabMeta: {},
        get currentUser() { return Alpine.store('auth')?.user; },
        get isAdmin() { return Alpine.store('auth')?.isAdmin; },
        get canEdit() { return this.currentUser && (this.isAdmin || this.tabMeta[this.tab]?.allowedEditors?.includes(this.currentUser.uid)); },
        async init() {
            await firebaseReadyPromise;
            const snap = await getDocs(collection(db, COLLECTIONS.WIKI_PAGES));
            snap.forEach(d => { const data = d.data(); this.tabContent[d.id] = data.content; this.tabMeta[d.id] = { allowedEditors: data.allowedEditors || [], updatedAt: data.updatedAt }; indexDoc({ kind: 'wiki', id: d.id, title: this.tabs.find(t => t.id === d.id)?.label ?? d.id, body: (data.content || '').replace(/<[^>]+>/g, ' ') }); });
            this.loading = false; this.$nextTick(() => this.renderTab(this.tab));
            markSearchReady();
        },
        renderTab(id) { const el = document.querySelector(`.wiki-content[data-tab="${id}"]`); if (el && this.tabContent[id]) { el.innerHTML = this.tabContent[id]; el.querySelectorAll('[x-data]').forEach(x => Alpine.initTree(x)); } },
        selectTab(id) { document.startViewTransition ? document.startViewTransition(() => { this.tab = id; this.$nextTick(() => this.renderTab(id)); }) : (this.tab = id, this.$nextTick(() => this.renderTab(id))); },
        async editCurrentTab() {
            const content = this.tabContent[this.tab] || '';
            const { value } = await Swal.fire({ title: `Edit: ${this.tabs.find(t => t.id === this.tab)?.label}`, width: '900px', html: `<textarea id="wiki-edit" class="font-monospace" rows="20"></textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('wiki-edit').value = content; }, preConfirm: () => document.getElementById('wiki-edit').value });
            if (value !== undefined) {
                await updateDoc(doc(db, COLLECTIONS.WIKI_PAGES, this.tab), { content: value, updatedAt: serverTimestamp() });
                this.tabContent[this.tab] = value; this.renderTab(this.tab); Swal.fire('Saved', 'Wiki section updated', 'success');
            }
        }
    };
}
function registerWikiApp() { Alpine.data('wikiApp', wikiApp); }

function pagesData() {
    return {
        pages: [], currentPage: null, currentPageId: new URL(location.href).searchParams.get('id'), loading: true, authorName: 'Unknown',
        get currentUser() { return Alpine.store('auth')?.user; },
        get isAdmin() { return Alpine.store('auth')?.isAdmin; },
        get canEdit() { return this.currentUser && (this.isAdmin || this.currentPage?.authorId === this.currentUser.uid); },
        async init() { await firebaseReadyPromise; await this.loadPagesList(); if (this.currentPageId) await this.loadSinglePage(this.currentPageId); },
        async loadPagesList() { const snap = await getDocs(query(collection(db, COLLECTIONS.PAGES), orderBy('createdAt', 'desc'))); this.pages = snap.docs.map(d => ({ id: d.id, ...d.data() })); this.pages.forEach(p => indexDoc({ kind: 'page', id: p.id, title: p.title, body: (p.content || '').replace(/<[^>]+>/g, ' ') })); if (!this.currentPageId) this.loading = false; markSearchReady(); },
        async loadSinglePage(id) {
            const snap = await getDoc(doc(db, COLLECTIONS.PAGES, id));
            if (snap.exists()) { this.currentPage = { id: snap.id, ...snap.data() }; document.title = `${this.currentPage.title || 'Page'} - Arcator`; await this.loadAuthor(this.currentPage.createdBy || this.currentPage.authorId); }
            this.loading = false;
        },
        async loadAuthor(uid) { if (!uid) { return; } const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid)); this.authorName = snap.exists() ? (snap.data().displayName || snap.data().email || 'Unknown') : uid; },
        formatDate: ts => formatDate(ts),
        renderContent(c) { if (!c) { return ''; } const isHtml = /<[a-z][\s\S]*>/i.test(c); return DOMPurify.sanitize(isHtml ? c : marked.parse(c)); },
        async createPage() { await Alpine.store('mgmt').createPage(() => this.loadPagesList()); },
        async editPage() { if (this.currentPage) await Alpine.store('mgmt').editPage(this.currentPage, () => this.loadSinglePage(this.currentPage.id)); },
        async deletePage() { if (this.currentPage) await Alpine.store('mgmt').deletePage(this.currentPage.id, () => { const go = () => { globalThis.location.href = 'pages.html'; }; document.startViewTransition ? document.startViewTransition(go) : go(); }); }
    };
}
function registerPagesData() { Alpine.data('pagesData', pagesData); }

function adminDashboard() {
    return {
        tab: 'dashboard', loading: true, isAdmin: false, currentUser: null, users: [], pages: [], threads: [], dms: [], wikiSections: [], searchUser: '',
        navItems: [{ id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' }, { id: 'users', label: 'Users', icon: 'bi-people' }, { id: 'pages', label: 'Pages', icon: 'bi-file-earmark-text' }, { id: 'wiki', label: 'Wiki', icon: 'bi-book' }, { id: 'forums', label: 'Forums', icon: 'bi-chat-square-text' }, { id: 'dms', label: 'Messages', icon: 'bi-envelope' }],
        get stats() { return [{ label: 'Total Users', value: this.users.length, icon: 'bi-people', color: 'text-primary' }, { label: 'Pages', value: this.pages.length, icon: 'bi-file-earmark', color: 'text-success' }, { label: 'Threads', value: this.threads.length, icon: 'bi-chat-square-text', color: 'text-warning' }, { label: 'Messages', value: this.dms.length, icon: 'bi-envelope', color: 'text-info' }]; },
        get pageTitle() { return this.tab.charAt(0).toUpperCase() + this.tab.slice(1); },
        get filteredUsers() {
            if (!this.searchUser) return this.users;
            const l = this.searchUser.toLowerCase();
            return this.users.filter(u => (u.displayName?.toLowerCase().includes(l)) || (u.email?.toLowerCase().includes(l)));
        },
        get recentActivity() {
            const acts = [...this.threads.map(t => ({ id: t.id, text: `New thread: ${t.title}`, time: t.createdAt, icon: 'bi-chat-square-text text-warning' })), ...this.dms.map(d => ({ id: d.id, text: `Message in ${d.participantNames ? Object.values(d.participantNames).join(', ') : 'Conversation'}`, time: d.lastMessageTime, icon: 'bi-envelope text-info' }))];
            return [...acts].sort((a, b) => (b.time?.seconds || 0) - (a.time?.seconds || 0)).slice(0, 5);
        },
        async init() {
            const evs = [['admin-edit-msg', e => this.editMessage(e.detail.cid, { id: e.detail.mid, content: e.detail.content })], ['admin-del-msg', e => this.deleteMessage(e.detail.cid, e.detail.mid)], ['admin-edit-comment', e => this.editComment(e.detail.tid, { id: e.detail.cid, content: e.detail.content })], ['admin-del-comment', e => this.deleteComment(e.detail.tid, e.detail.cid)]];
            evs.forEach(([n, h]) => document.addEventListener(n, h));
            Alpine.effect(async () => { const s = Alpine.store('auth'); if (!s.loading) { if (s.user) { this.currentUser = s.user; this.isAdmin = s.isAdmin; if (this.isAdmin) await this.refreshAll(); } this.loading = false; } });
        },
        async refreshAll() {
            const [u, p, t, d, w] = await Promise.all([getDocs(collection(db, COLLECTIONS.USER_PROFILES)), getDocs(collection(db, COLLECTIONS.PAGES)), getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc'))), getDocs(query(collection(db, COLLECTIONS.CONVERSATIONS), orderBy('lastMessageTime', 'desc'))), getDocs(collection(db, COLLECTIONS.WIKI_PAGES))]);
            this.users = u.docs.map(x => ({ id: x.id, ...x.data() })); this.pages = p.docs.map(x => ({ id: x.id, ...x.data() })); this.threads = t.docs.map(x => ({ id: x.id, ...x.data() })); this.dms = d.docs.map(x => ({ id: x.id, ...x.data() })); this.wikiSections = w.docs.map(x => ({ id: x.id, ...x.data() }));
        },
        getAuthorName(uid) { const u = this.users.find(x => x.id === uid); return u ? (u.displayName || u.email) : 'Unknown'; },
        getDMName(dm) { return (dm.name && dm.name !== 'Chat') ? dm.name : dm.participants.map(id => this.getAuthorName(id)).join(', '); },
        formatDate: ts => formatDate(ts),
        async createPage() { await Alpine.store('mgmt').createPage(() => this.refreshAll()); },
        async editPage(p) { await Alpine.store('mgmt').editPage(p, () => this.refreshAll()); },
        async deletePage(id) { await Alpine.store('mgmt').deletePage(id, () => this.refreshAll()); },
        async createWikiSection() { await Alpine.store('mgmt').createWikiSection(() => this.refreshAll()); },
        async editWikiSection(s) { await Alpine.store('mgmt').editWikiSection(s, () => this.refreshAll()); },
        async manageWikiEditors(s) { await Alpine.store('mgmt').manageWikiEditors(s, this.users, () => this.refreshAll()); },
        async deleteWikiSection(id) { await Alpine.store('mgmt').deleteWikiSection(id, () => this.refreshAll()); },
        async editUser(u) {
            if (!this.isAdmin) return Swal.fire('Error', 'Unauthorized', 'error');
            const { value: v } = await Swal.fire({ title: 'Edit User', width: '800px', html: this.getEditUserHtml(u), showCancelButton: true, preConfirm: () => this.getEditUserFormValues() });
            if (v) await this.saveUserEdit(u.id, v);
        },
        getEditUserHtml(u) { return `<div class="text-start admin-modal-scroll">${[this.getGeneralSectionHtml(u), this.getSocialSectionHtml(u), this.getPreferenceSectionHtml(u), this.getFlagsSectionHtml(u)].join('')}</div>`; },
        getGeneralSectionHtml(u) {
            const fields = [{ id: 'eu-name', l: 'Name', v: u.displayName || '' }, { id: 'eu-handle', l: 'Handle', v: u.handle || '' }, { id: 'eu-email', l: 'Email', v: u.email || '' }, { id: 'eu-photo', l: 'Photo', v: u.photoURL || '' }, { id: 'eu-css', l: 'CSS', v: u.customCSS || '' }];
            const inputs = fields.map(f => `<div class="col-md-6"><label class="small">${f.l}</label><input id="${f.id}" class="btn-sm" value="${escapeHtml(f.v)}"></div>`).join('');
            const roleSelect = `<div class="col-md-6"><label class="small">Role</label><select id="eu-role" class="btn-sm"><option value="user" ${!u.admin && u.role !== 'staff' ? 'selected' : ''}>User</option><option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option><option value="admin" ${u.admin ? 'selected' : ''}>Admin</option></select></div>`;
            return `<h6 class="text-primary mb-3">General</h6><div class="row g-2 mb-3">${inputs}${roleSelect}</div>`;
        },
        getSocialSectionHtml(u) {
            const fields = [{ id: 'eu-discordId', l: 'Discord ID', v: u.discordId || '' }, { id: 'eu-discordTag', l: 'Discord Tag', v: u.discordTag || '' }, { id: 'eu-discordPic', l: 'Discord Pic', v: u.discordPic || '' }, { id: 'eu-discordURL', l: 'Discord URL', v: u.discordURL || '' }, { id: 'eu-githubPic', l: 'GitHub Pic', v: u.githubPic || '' }, { id: 'eu-githubURL', l: 'GitHub URL', v: u.githubURL || '' }];
            const inputs = fields.map(f => `<div class="col-md-6"><label class="small">${f.l}</label><input id="${f.id}" class="btn-sm" value="${escapeHtml(f.v)}"></div>`).join('');
            return `<h6 class="text-primary mb-3 border-top pt-3">Social</h6><div class="row g-2 mb-3">${inputs}</div>`;
        },
        getPreferenceSectionHtml(u) { return `<h6 class="text-primary mb-3 border-top pt-3">Preferences</h6><div class="row g-2 mb-3"><div class="col-md-4"><label class="small">Theme</label><select id="eu-theme" class="btn-sm"><option value="dark" ${u.themePreference === 'dark' ? 'selected' : ''}>Dark</option><option value="light" ${u.themePreference === 'light' ? 'selected' : ''}>Light</option></select></div><div class="col-md-4"><label class="small">Font</label><select id="eu-font" class="btn-sm"><option value="small" ${u.fontScaling === 'small' ? 'selected' : ''}>Small</option><option value="normal" ${u.fontScaling === 'normal' ? 'selected' : ''}>Normal</option><option value="large" ${u.fontScaling === 'large' ? 'selected' : ''}>Large</option></select></div><div class="col-md-4"><label class="small">Retention</label><input type="number" id="eu-retention" class="btn-sm" value="${u.dataRetention || 365}"></div></div><div class="row g-2 mt-2"><div class="col-md-6"><label class="small">Glass Color</label><input id="eu-glassColor" class="btn-sm" value="${escapeHtml(u.glassColor || '')}"></div><div class="col-md-6"><label class="small">Opacity</label><input id="eu-glassOpacity" type="number" step="0.05" class="btn-sm" value="${u.glassOpacity || 0.95}"></div><div class="col-md-6"><label class="small">Blur</label><input id="eu-glassBlur" type="number" class="btn-sm" value="${u.glassBlur || ''}"></div><div class="col-12"><label class="small">Background</label><input id="eu-bgImg" class="btn-sm" value="${escapeHtml(u.backgroundImage || '')}"></div></div>`; },
        getFlagsSectionHtml(u) {
            const flags = [{ id: 'eu-activity', l: 'Activity', c: u.activityTracking }, { id: 'eu-debug', l: 'Debug', c: u.debugMode }, { id: 'eu-discordLinked', l: 'Discord Linked', c: u.discordLinked }, { id: 'eu-discordNotif', l: 'Discord Notifs', c: u.discordNotifications }, { id: 'eu-emailNotif', l: 'Email Notifs', c: u.emailNotifications }, { id: 'eu-focus', l: 'Focus', c: u.focusIndicators }, { id: 'eu-contrast', l: 'Contrast', c: u.highContrast }, { id: 'eu-visible', l: 'Visible', c: u.profileVisible }, { id: 'eu-push', l: 'Push', c: u.pushNotifications }, { id: 'eu-motion', l: 'Motion', c: u.reducedMotion }, { id: 'eu-reader', l: 'Reader', c: u.screenReader }, { id: 'eu-sharing', l: 'Sharing', c: u.thirdPartySharing }];
            const checks = flags.map(f => `<div class="col-md-4"><div class="form-check"><input type="checkbox" id="${f.id}" ${f.c ? 'checked' : ''}> <label class="small">${f.l}</label></div></div>`).join('');
            return `<h6 class="text-primary mb-3 border-top pt-3">Flags</h6><div class="row g-2">${checks}</div>`;
        },
        getEditUserFormValues() {
            return {
                displayName: document.getElementById('eu-name').value, handle: document.getElementById('eu-handle').value, email: document.getElementById('eu-email').value, photoURL: document.getElementById('eu-photo').value, role: document.getElementById('eu-role').value, admin: document.getElementById('eu-role').value === 'admin', customCSS: document.getElementById('eu-css').value, discordId: document.getElementById('eu-discordId').value, discordTag: document.getElementById('eu-discordTag').value, discordPic: document.getElementById('eu-discordPic').value, discordURL: document.getElementById('eu-discordURL').value, githubPic: document.getElementById('eu-githubPic').value, githubURL: document.getElementById('eu-githubURL').value, themePreference: document.getElementById('eu-theme').value, fontScaling: document.getElementById('eu-font').value, dataRetention: Number.parseInt(document.getElementById('eu-retention').value, 10), glassColor: document.getElementById('eu-glassColor').value, glassOpacity: Number.parseFloat(document.getElementById('eu-glassOpacity').value), glassBlur: Number.parseInt(document.getElementById('eu-glassBlur').value, 10), backgroundImage: document.getElementById('eu-bgImg').value, activityTracking: document.getElementById('eu-activity').checked, debugMode: document.getElementById('eu-debug').checked, discordLinked: document.getElementById('eu-discordLinked').checked, discordNotifications: document.getElementById('eu-discordNotif').checked, emailNotifications: document.getElementById('eu-emailNotif').checked, focusIndicators: document.getElementById('eu-focus').checked, highContrast: document.getElementById('eu-contrast').checked, profileVisible: document.getElementById('eu-visible').checked, pushNotifications: document.getElementById('eu-push').checked, reducedMotion: document.getElementById('eu-motion').checked, screenReader: document.getElementById('eu-reader').checked, thirdPartySharing: document.getElementById('eu-sharing').checked, updatedAt: serverTimestamp()
            };
        },
        async saveUserEdit(uid, v) {
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, uid), v);
            if (v.admin) await setDoc(doc(db, 'admins', uid), { appointedAt: serverTimestamp() }).catch(e => console.error("Failed to add admin", e));
            else await deleteDoc(doc(db, 'admins', uid)).catch(e => console.error("Failed to remove admin", e));
            this.refreshAll(); Swal.fire('Success', 'User updated', 'success');
        },
        async editThread(t) {
            const { value: v } = await Swal.fire({ title: 'Edit Thread', html: `<input id="et-title" class="mb-2" placeholder="Title"><input id="et-tags" class="mb-2" placeholder="Tags"><select id="et-cat" class="mb-2"><option value="General">General</option><option value="Announcements">Announcements</option><option value="Support">Support</option><option value="Gaming">Gaming</option><option value="Discussion">Discussion</option></select><div class="form-check text-start mb-2"><input type="checkbox" id="et-locked"><label >Lock</label></div><textarea id="et-desc" rows="5"></textarea>`, didOpen: () => { document.getElementById('et-title').value = t.title; document.getElementById('et-tags').value = t.tags || ''; document.getElementById('et-cat').value = t.category || 'General'; document.getElementById('et-locked').checked = t.locked || false; document.getElementById('et-desc').value = t.description; }, showCancelButton: true, preConfirm: () => ({ title: document.getElementById('et-title').value, tags: document.getElementById('et-tags').value, category: document.getElementById('et-cat').value, locked: document.getElementById('et-locked').checked, description: document.getElementById('et-desc').value }) });
            if (v) { await updateDoc(doc(db, COLLECTIONS.FORMS, t.id), v); this.refreshAll(); }
        },
        async deleteThread(id) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.FORMS, id)); this.refreshAll(); } },
        async viewThread(t) {
            const snap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(t.id)), orderBy('createdAt', 'asc'))), Html = snap.docs.map(d => this.renderCommentForAdmin(t.id, d)).join('');
            Swal.fire({ title: escapeHtml(t.title), html: `<div class="text-start">${DOMPurify.sanitize(t.description)}</div><hr><div class="text-start admin-list-scroll">${Html || 'No comments'}</div>`, width: 800, didOpen: () => this.setupAdminCommentEvents(Swal.getHtmlContainer(), t.id, snap.docs) });
        },
        renderCommentForAdmin(tid, d) {
            const data = d.data();
            return `<div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25"><div class="d-flex justify-content-between"><small class="text-info">${escapeHtml(this.getAuthorName(data.authorId))}</small><small class="text-muted">${this.formatDate(data.createdAt)}</small></div><div class="my-1">${DOMPurify.sanitize(data.content)}</div><div class="d-flex gap-2 justify-content-end"><button class="btn-sm btn-outline-secondary py-0 edit-comment-btn" data-tid="${tid}" data-cid="${d.id}">Edit</button><button class="btn-sm btn-outline-danger py-0 del-comment-btn" data-tid="${tid}" data-cid="${d.id}">Del</button></div></div>`;
        },
        setupAdminCommentEvents(container, tid, docs) {
            container.querySelectorAll('.edit-comment-btn').forEach(btn => btn.onclick = () => this.dispatchEditComment(btn.dataset.cid, tid, docs));
            container.querySelectorAll('.del-comment-btn').forEach(btn => btn.onclick = () => this.dispatchDeleteComment(btn.dataset.cid, tid));
        },
        dispatchEditComment(cid, tid, docs) { const d = docs.find(x => x.id === cid); if (d) document.dispatchEvent(new CustomEvent('admin-edit-comment', { detail: { tid, cid: d.id, content: d.data().content } })); },
        dispatchDeleteComment(cid, tid) { document.dispatchEvent(new CustomEvent('admin-del-comment', { detail: { tid, cid } })); },
        async viewDM(dm) {
            const snap = await getDocs(query(collection(db, COLLECTIONS.CONV_MESSAGES(dm.id)), orderBy('createdAt', 'asc'))), Html = snap.docs.map(d => this.renderMessageForAdmin(dm, d)).join('');
            Swal.fire({ title: 'Conversation Log', html: `<div class="text-start admin-list-scroll">${Html || 'No messages'}</div>`, width: 600, didOpen: () => this.setupAdminMessageEvents(Swal.getHtmlContainer(), dm.id, snap.docs) });
        },
        renderMessageForAdmin(dm, d) {
            const data = d.data(), s = dm.participantNames ? dm.participantNames[data.senderId] : this.getAuthorName(data.senderId);
            return `<div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25"><div class="d-flex justify-content-between"><small class="text-info">${escapeHtml(s)}</small><small class="text-muted">${this.formatDate(data.createdAt)}</small></div><div class="my-1">${DOMPurify.sanitize(data.content)}</div><div class="d-flex gap-2 justify-content-end"><button class="btn-sm btn-outline-secondary py-0 edit-msg-btn" data-cid="${dm.id}" data-mid="${d.id}">Edit</button><button class="btn-sm btn-outline-danger py-0 del-msg-btn" data-cid="${dm.id}" data-mid="${d.id}">Del</button></div></div>`;
        },
        setupAdminMessageEvents(container, cid, docs) {
            container.querySelectorAll('.edit-msg-btn').forEach(btn => btn.onclick = () => this.dispatchEditMessage(btn.dataset.mid, cid, docs));
            container.querySelectorAll('.del-msg-btn').forEach(btn => btn.onclick = () => this.dispatchDeleteMessage(btn.dataset.mid, cid));
        },
        dispatchEditMessage(mid, cid, docs) { const d = docs.find(x => x.id === mid); if (d) document.dispatchEvent(new CustomEvent('admin-edit-msg', { detail: { cid, mid: d.id, content: d.data().content } })); },
        dispatchDeleteMessage(mid, cid) { document.dispatchEvent(new CustomEvent('admin-del-msg', { detail: { cid, mid } })); },
        async deleteDM(id) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.CONVERSATIONS, id)); this.refreshAll(); } },
        async deleteMessage(cid, mid) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.CONV_MESSAGES(cid), mid)); const dm = this.dms.find(d => d.id === cid); if (dm) this.viewDM(dm); } },
        async editMessage(cid, m) { const res = await promptEditor('Edit', '', m.content); if (res) { await updateDoc(doc(db, COLLECTIONS.CONV_MESSAGES(cid), m.id), { content: res }); const dm = this.dms.find(d => d.id === cid); if (dm) this.viewDM(dm); } },
        async deleteComment(tid, cid) { if (confirm('Delete?')) { await deleteDoc(doc(db, COLLECTIONS.SUBMISSIONS(tid), cid)); await updateDoc(doc(db, COLLECTIONS.FORMS, tid), { commentCount: increment(-1) }); const t = this.threads.find(x => x.id === tid); if (t) this.viewThread(t); } },
        async editComment(tid, c) { const res = await promptEditor('Edit', '', c.content); if (res) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(tid), c.id), { content: res }); const t = this.threads.find(x => x.id === tid); if (t) this.viewThread(t); } }
    };
}
function registerAdminDashboard() { Alpine.data('adminDashboard', adminDashboard); }

function resourcesData() {
    return {
        resTab: 'census', censusHeader: [], censusData: [], censusLoading: true, adminLoading: true, adminContent: '', sortBy: 'name',
        async init() { await this.loadCensus(); await this.loadAdminDoc(); },
        parseCSV(text) {
            const result = []; let row = [], field = '', inQuotes = false, i = 0;
            while (i < text.length) {
                const char = text[i];
                if (char === '"') {
                    const quoteResult = this.handleCSVQuote(text, i, inQuotes, field);
                    i = quoteResult.index; inQuotes = quoteResult.inQuotes; field = quoteResult.field;
                } else if (!inQuotes && char === ',') { row.push(field.trim()); field = ''; }
                else if (!inQuotes && (char === '\n' || char === '\r')) {
                    this.handleCSVLineEnd(row, field, result); row = []; field = '';
                    if (char === '\r' && text[i + 1] === '\n') { i++; }
                } else field += char;
                i++;
            }
            if (field || row.length) { result.push([...row, field.trim()]); }
            return result;
        },
        handleCSVQuote(text, i, inQuotes, field) {
            const next = text[i + 1];
            if (inQuotes && next === '"') return { index: i + 1, inQuotes: true, field: field + '"' };
            return { index: i, inQuotes: !inQuotes, field };
        },
        handleCSVLineEnd(row, field, result) { if (field || row.length) { row.push(field.trim()); result.push(row); } },
        async loadCensus() {
            try {
                const csv = await (await fetch('https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=1977273024')).text();
                const rows = this.parseCSV(csv);
                this.censusHeader = rows[0]; this.censusData = rows.slice(1).filter(r => r[0]?.length);
            } catch (e) { console.error('Census error:', e); } this.censusLoading = false;
        },
        async loadAdminDoc() {
            try {
                const html = await (await fetch('https://docs.google.com/document/d/1WvxTStjkBbQh9dp-59v1jJbaLPuofrnk_4N12mSMFo4/export?format=html')).text();
                this.adminContent = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
            } catch (e) { console.error('Admin error:', e); } this.adminLoading = false;
        },
        get filteredCensus() {
            let d = [...this.censusData];
            if (this.sortBy === 'name') d.sort((a, b) => a[0].localeCompare(b[0]));
            else if (this.sortBy === 'total') d.sort((a, b) => (Number.parseInt(b[1], 10) || 0) - (Number.parseInt(a[1], 10) || 0));
            return d;
        }
    };
}
function registerResourcesData() {
    Alpine.data('resourcesData', resourcesData);
}

function registerAll() {
    registerAuthStore(); registerUsersStore(); registerPageWikiManagement(); registerForumData(); registerWikiApp(); registerPagesData(); registerAdminDashboard(); registerResourcesData(); registerMessageData();
}

document.addEventListener('alpine:init', () => {
    Alpine.directive('spinner', (el, { modifiers, expression }, { evaluateLater, effect }) => {
        const getLoading = evaluateLater(expression);
        const isSm = modifiers.includes('sm');
        const sizeClass = isSm ? 'spinner-border-sm' : '';
        const containerClasses = isSm ? ['text-center', 'py-1'] : ['d-flex', 'justify-content-center', 'align-items-center', 'vh-80'];

        el.classList.add(...containerClasses);
        el.innerHTML = `<div class="spinner-border text-primary ${sizeClass}" role="status"></div>`;

        effect(() => {
            getLoading(loading => updateSpinnerState(el, loading, isSm));
        });
    });
    registerAll();
});
function updateSpinnerState(el, loading, isSm) {
    if (loading) {
        el.style.setProperty('display', isSm ? 'block' : 'flex', 'important');
    } else {
        el.style.setProperty('display', 'none', 'important');
    }
}
if (globalThis.Alpine) { registerAll(); }
document.addEventListener('DOMContentLoaded', initLayout);

export { app, auth, db, projectId, appId, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, COLLECTIONS, firebaseReadyPromise, getCurrentUser, formatDate, generateProfilePic, randomIdentity, initLayout, updateUserSection };
export { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, linkWithPopup, linkWithCredential, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, TwitterAuthProvider, EmailAuthProvider, signOut, updateProfile, sendPasswordResetEmail, unlink, onAuthStateChanged, onIdTokenChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
export { increment, startAfter, limit, where, deleteDoc, orderBy, query, onSnapshot, updateDoc, getDocs, addDoc, getDoc, setDoc, serverTimestamp, collection, collectionGroup, doc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
