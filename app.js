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
const COLLECTIONS = {
    USERS: 'user_profiles', 
    USER_PROFILES: 'user_profiles', 
    FORMS: `${art}/public/data/forms`,
    SUBMISSIONS: (formId) => `${art}/public/data/forms/${formId}/submissions`,
    CONVERSATIONS: 'conversations',
    CONV_MESSAGES: (convId) => `conversations/${convId}/messages`,
    THEMES: `${art}/public/data/custom_themes`,
    PAGES: `${art}/public/data/temp_pages`,
    WIKI_CONFIG: `${art}/public/data/wiki_config`,
    WIKI_PAGES: `${art}/public/data/wiki_pages`
};

const firebaseReadyPromise = new Promise(r => { const u = auth.onAuthStateChanged(() => { u(); r(true); }); });
const getCurrentUser = () => auth.currentUser;

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const now = new Date();
    const diff = now - d;
    const isToday = d.toDateString() === now.toDateString();
    
    if (typeof dayjs !== 'undefined') {
        if (isToday) return dayjs(d).format('HH:mm:ss');
        if (diff < 86400000 * 7) return dayjs(d).format('ddd HH:mm');
        return dayjs(d).format('DD/MM/YY HH:mm');
    }
    const pad = n => String(n).padStart(2, '0');
    if (isToday) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)}`;
}

function generateProfilePic(name) {
    const colors = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'];
    const hash = [...name].reduce((a, c) => a + c.codePointAt(0), 0);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colors[Math.abs(hash) % colors.length];
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2), 100, 100);
    return canvas.toDataURL('image/png');
}

function randomIdentity() {
    const adj = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Bright', 'Cool', 'Smart'];
    const noun = ['Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Tiger', 'Lion', 'Owl'];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    return { displayName: `${a} ${n}`, handle: `${a.toLowerCase()}${n}${Math.floor(Math.random() * 1000)}` };
}

const NAV_HTML = `
<nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top border-bottom border-primary">
    <div class="container-fluid px-4">
        <a class="navbar-brand fw-bold" href="./index.html">Arcator</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto">
                <li class="nav-item"><a class="nav-link" href="./index.html">Home</a></li>
                <li class="nav-item"><a class="nav-link" href="./wiki.html">Wiki</a></li>
                <li class="nav-item"><a class="nav-link" href="./forms.html">Forums</a></li>
                <li class="nav-item"><a class="nav-link" href="./pages.html">Pages</a></li>
                <li class="nav-item"><a class="nav-link" href="./resources.html">Resources</a></li>
                <li class="nav-item d-none" id="admin-link"><a class="nav-link" href="./mod.html">Admin</a></li>
            </ul>
            <div id="user-section" class="d-flex align-items-center">
                <a href="./users.html" class="btn btn-primary btn-sm" id="sign-in-btn">Sign In</a>
                <a href="./users.html" class="d-none align-items-center text-decoration-none gap-2" id="user-profile-link">
                    <img src="./defaultuser.png" class="profile-img" alt="Profile" id="user-avatar">
                    <span class="text-light" id="user-name">User</span>
                </a>
            </div>
        </div>
    </div>
</nav>`;

const FOOTER_HTML = `
<footer class="mt-auto py-4 bg-dark border-top border-primary">
    <div class="container-fluid px-4">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
            <div class="d-flex gap-3">
                <a href="https://ssmp.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">SSMP Blue Maps</a>
                <a href="https://wiki.arcator.co.uk" class="text-secondary text-decoration-none" target="_blank" rel="noopener">Wiki</a>
            </div>
            <div class="text-secondary">© 2025 Arcator</div>
        </div>
    </div>
</footer>`;

function initLayout() {
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (navPlaceholder) {
        navPlaceholder.innerHTML = NAV_HTML;
        const current = location.pathname.split('/').pop() || 'index.html';
        const links = navPlaceholder.querySelectorAll('.nav-link');
        links.forEach(l => {
            if (l.getAttribute('href') === `./${current}` || (current === 'index.html' && l.getAttribute('href') === './index.html')) {
                l.classList.add('active');
            }
        });
    }

    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) footerPlaceholder.innerHTML = FOOTER_HTML;

    // Re-run user section update in case auth loaded before layout
    if (window.Alpine) {
        const store = Alpine.store('auth');
        if (store && !store.loading) {
            updateUserSection(store.user, store.profile, store.isAdmin);
        }
    }
}

function updateUserSection(user, profile, isAdmin = false) {
    const signInBtn = document.getElementById('sign-in-btn');
    const profileLink = document.getElementById('user-profile-link');
    const avatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const adminLink = document.getElementById('admin-link');
    
    if (!signInBtn || !profileLink) return;
    
    if (user) {
        signInBtn.classList.add('d-none');
        profileLink.classList.remove('d-none');
        profileLink.classList.add('d-flex');
        if (avatar) avatar.src = profile?.photoURL || user.photoURL || './defaultuser.png';
        if (userName) userName.textContent = profile?.displayName || user.displayName || 'User';
        if (adminLink) {
            if (isAdmin) adminLink.classList.remove('d-none');
            else adminLink.classList.add('d-none');
        }
    } else {
        signInBtn.classList.remove('d-none');
        profileLink.classList.add('d-none');
        profileLink.classList.remove('d-flex');
        if (adminLink) adminLink.classList.add('d-none');
    }
}

const DEFAULT_THEME = 'dark';

function cacheUser(user, profile) {
    localStorage.setItem('arcator_user_cache', JSON.stringify({
        uid: user.uid,
        displayName: profile?.displayName || user.displayName,
        photoURL: profile?.photoURL || user.photoURL,
        themePreference: profile?.themePreference || 'dark',
        fontScaling: profile?.fontScaling || 'normal',
        backgroundImage: profile?.backgroundImage,
        glassColor: profile?.glassColor,
        glassOpacity: profile?.glassOpacity,
        glassBlur: profile?.glassBlur
    }));
}

function updateTheme(theme = 'dark', fontSize = 'normal', customCSS = '', bgImg = '', glassColor = '', glassOpacity = 0.95, glassBlur = '') {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    
    // Background Image
    if (bgImg) document.body.style.backgroundImage = `url('${bgImg}')`;
    else document.body.style.backgroundImage = ''; 

    // Glass Theme
    const root = document.documentElement;
    if (glassColor && glassOpacity !== '') {
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
        };
        const rgb = hexToRgb(glassColor);
        if (rgb) {
            root.style.setProperty('--glass-bg', `rgba(${rgb}, ${glassOpacity})`);
        }
    } else {
        root.style.removeProperty('--glass-bg');
    }

    let style = document.getElementById('custom-css-style');
    if (!style) { style = document.createElement('style'); style.id = 'custom-css-style'; document.head.appendChild(style); }
    
    let css = customCSS || '';
    if (glassBlur) {
        css += ` .glass-card, .card { backdrop-filter: blur(${glassBlur}px) !important; } body::before { backdrop-filter: blur(${Math.max(0, glassBlur - 5)}px) !important; }`;
    }
    style.textContent = css;
}

const userCache = {};

async function fetchAuthor(uid) {
    if (!uid || userCache[uid]) return;
    try {
        const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid));
        if (snap.exists()) {
            userCache[uid] = snap.data();
        } else {
            console.warn(`Author not found: ${uid}`);
            userCache[uid] = { displayName: 'Unknown User', photoURL: './defaultuser.png', uid };
        }
    } catch (e) { console.error(`Fetch error ${uid}:`, e); }
}

function getAuthor(uid) {
    if (userCache[uid]) return userCache[uid];
    const store = Alpine.store('auth');
    if (store.user?.uid === uid && store.profile) return store.profile;
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
        threads: [], loading: true, showCreateModal: false,
        newThread: { title: '', category: '', tags: '' }, quill: null,

        async init() {
            this.loadThreads();
            this.$watch('showCreateModal', v => { if (v && !this.quill) this.$nextTick(() => { this.quill = new Quill(this.$refs.createEditor, { theme: 'snow', placeholder: 'Describe your thread...' }); }); });
        },

        async loadThreads() {
            const snap = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
            const threads = await Promise.all(snap.docs.map(async d => {
                const data = { id: d.id, ...d.data(), expanded: true, comments: [], loadingComments: false, quill: null };
                const cSnap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(d.id)), orderBy('createdAt', 'asc')));
                data.comments = cSnap.docs.map(cd => ({ id: cd.id, ...cd.data() }));
                return data;
            }));
            const allIds = [...new Set([...threads.map(t => t.authorId), ...threads.flatMap(t => t.comments.map(c => c.authorId))].filter(Boolean))];
            await Promise.all(allIds.map(fetchAuthor));
            this.threads = threads;
            this.loading = false;
        },

        getAuthor, fetchAuthor, formatDate,

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
                const snap = await getDocs(query(collection(db, COLLECTIONS.SUBMISSIONS(thread.id)), orderBy('createdAt', 'asc')));
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
            const content = await promptEditor('Reply', '', '', 'Write reply...');
            if (content) {
                const user = Alpine.store('auth').user;
                await addDoc(collection(db, COLLECTIONS.SUBMISSIONS(thread.id)), { content, authorId: user.uid, createdAt: serverTimestamp(), parentCommentId: parent.parentCommentId || parent.id });
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
            const html = `<input id="s1" class="swal2-input" value="${thread.title}"><input id="s2" class="swal2-input" value="${thread.tags||''}"><select id="s3" class="swal2-input"><option value="announcements"${thread.category==='announcements'?' selected':''}>Announcements</option><option value="gaming"${thread.category==='gaming'?' selected':''}>Gaming</option><option value="discussion"${thread.category==='discussion'?' selected':''}>Discussion</option><option value="support"${thread.category==='support'?' selected':''}>Support</option></select><textarea id="ed-thread-content" class="form-control" rows="10">${thread.description || ''}</textarea>`;
            const { value } = await Swal.fire({ title: 'Edit', html, preConfirm: () => [document.getElementById('s1').value, document.getElementById('s2').value, document.getElementById('s3').value, document.getElementById('ed-thread-content').value] });
            if (value) {
                await updateDoc(doc(db, COLLECTIONS.FORMS, thread.id), { title: value[0], tags: value[1], category: value[2], description: value[3], updatedAt: serverTimestamp() });
                Object.assign(thread, { title: value[0], tags: value[1], category: value[2], description: value[3] });
            }
        },

        async editComment(forumId, comment) {
            const content = await promptEditor('Edit', '', comment.content);
            if (content) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), comment.id), { content }); comment.content = content; }
        },

        async censorComment(forumId, comment) {
            const content = await promptEditor('Redact', '', comment.content);
            if (content) { await updateDoc(doc(db, COLLECTIONS.SUBMISSIONS(forumId), comment.id), { content, censored: true }); comment.content = content; comment.censored = true; }
        }
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

function registerAll() {
    registerAuthStore();
    registerForumData();
    registerMessageData();
}

document.addEventListener('alpine:init', registerAll);
if (window.Alpine) registerAll();
document.addEventListener('DOMContentLoaded', initLayout);

export {
    app, auth, db, projectId, appId, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, COLLECTIONS, firebaseReadyPromise, getCurrentUser, formatDate, generateProfilePic, randomIdentity, initLayout, updateUserSection, collection, collectionGroup, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, startAfter, serverTimestamp, increment, onAuthStateChanged, onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, linkWithPopup, linkWithCredential, unlink, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, TwitterAuthProvider, EmailAuthProvider, signOut, updateProfile, sendPasswordResetEmail
};
