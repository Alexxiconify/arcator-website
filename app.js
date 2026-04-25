

import { 
  db, auth, srvTs as serverTimestamp,
  collection, doc, query, where, orderBy,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, getCountFromServer
} from './js/firebase.js';
import { indexDoc, removeDoc, markSearchReady } from './js/search.js';
import './js/keys.js';
import './js/glitch.js';
import './js/auth.js?v=20260425';
// Delay Alpine dependent logic until it's ready
let Alpine, Swal, Quill;

const getWikiIcon = (id) => {
    const icons = {
        home: 'bi-house',
        servers: 'bi-hdd-network',
        software: 'bi-code-square',
        sysadmin: 'bi-terminal',
        machines: 'bi-pc-display',
        staff: 'bi-people',
        mcadmin: 'bi-shield-lock',
        growth: 'bi-graph-up'
    };
    const key = (id || '').toLowerCase();
    if (key.includes('home') || key.includes('welcome')) return icons.home;
    if (key.includes('growth')) return icons.growth;
    if (key.includes('machine')) return icons.machines;
    if (key.includes('staff')) return icons.staff;
    if (key.includes('donations')) return 'bi-cash-coin';
    if (key.includes('mcadmin')) return icons.mcadmin;
    if (key.includes('sysadmin')) return icons.sysadmin;
    if (key.includes('server')) return icons.servers;
    if (key.includes('software')) return icons.software;
    return 'bi-file-text';
};

const registerAll = () => {
    registerUsersStore(); 
    registerPageWikiManagement(); 
    registerForumData(); 
    registerWikiApp(); 
    registerPagesData(); 
    registerAdminDashboard(); 
    registerResourcesData(); 
    registerMessageData();
    
    // Direct store sync
    Alpine.effect(() => {
        const s = Alpine.store('auth');
        if (s && !s.loading) {
            updateUserSection(s.user, s.profile, s.isAdmin);
        }
    });

    // Custom Directives
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
};

const initAlpine = () => {
    if (globalThis.AlpineInitialized) return;
    Alpine = globalThis.Alpine;
    Swal = globalThis.Swal;
    Quill = globalThis.Quill;
    
    if (Alpine) {
        registerAll();
        initLayout();
        globalThis.AlpineInitialized = true;
    }
};

if (globalThis.Alpine) {
    initAlpine();
} else {
    document.addEventListener('alpine:init', initAlpine);
}
const DEFAULT_PROFILE_PIC = './defaultuser.png';
const DEFAULT_THEME_NAME = 'dark';

const COLLECTIONS = {
    DOCS: 'docs',
    ADMINS: 'admins',
    BANS: 'bans',
    GLOBAL: 'global',
    USERS: 'docs',
    USER_PROFILES: 'docs',
    FORMS: 'docs',
    SUBMISSIONS: () => 'docs',
    CONVERSATIONS: 'docs',
    CONV_MESSAGES: () => 'docs',
    THEMES: 'docs',
    PAGES: 'docs',
    WIKI_CONFIG: 'docs',
    WIKI_PAGES: 'docs'
};

const DOC_KIND = { ARTICLE: 'article', PROFILE: 'profile', MESSAGE: 'message' };
const profileDocId = uid => `u_${uid}`;
const pageDocId = slug => `pg_${(slug || '').toLowerCase().replaceAll(/[^a-z0-9-]/g, '-') || crypto.randomUUID()}`;
const wikiDocId = id => `~w2601-${(id || '').toLowerCase().replaceAll(/[^a-z0-9-]/g, '-') || crypto.randomUUID()}`;
const isWikiDocId = id => typeof id === 'string' && (id.startsWith('wk_') || id.startsWith('wiki_') || id.startsWith('~w'));
const isPageDocId = id => typeof id === 'string' && id.startsWith('pg_');
const docsCollection = () => collection(db, COLLECTIONS.DOCS);
const docsRef = id => doc(db, COLLECTIONS.DOCS, id);

function makeDocShape({ kind, authorId, title = '', body = '', photoURL = '', parent = null, allowReplies = false, allowPublicEdits = false, pinned = false, featured = false, spoiler = false }) {
    const isProfile = kind === DOC_KIND.PROFILE;
    const isMessage = kind === DOC_KIND.MESSAGE;
    const isArticle = kind === DOC_KIND.ARTICLE;

    // Enforce validPhotoURL: empty or https://... up to 492 chars
    const safePhotoURL = (photoURL || '').startsWith('https://') ? photoURL.slice(0, 492) : '';

    const base = {
        kind,
        authorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Rule: Message title empty. Article max 500. Profile max 100.
        title: (() => {
            if (isMessage) return '';
            if (isArticle) return title.slice(0, 500);
            return title.slice(0, 100);
        })(),
        body,
        // Rule: Message photoURL empty.
        photoURL: isMessage ? '' : safePhotoURL,
        // Rule: allowReplies == false unless article/profile
        allowReplies: (isArticle || isProfile) ? !!allowReplies : false,
        // Rule: allowPublicEdits == false unless article
        allowPublicEdits: isArticle ? !!allowPublicEdits : false,
        pinned: !!pinned,
        featured: !!featured,
        spoiler: !!spoiler,
        reactions: {},
        lastReplyAt: serverTimestamp(),
        bodyIsHTML: false
    };
    if (isMessage) {
        return { ...base, parent: parent || '' };
    }
    return base;
}

function parseProfileData(d, uid) {
    let payload = {};
    let bio = (d?.body || '').trim();
    const metaMatch = bio.match(/<!--\s*ARCATOR_META:\s*({.*})\s*-->/);
    if (metaMatch) {
        try { payload = JSON.parse(metaMatch[1]); bio = bio.replace(metaMatch[0], '').trim(); } catch(e) {}
    } else {
        try { payload = JSON.parse(bio); bio = payload.bio || ''; } catch(e) {}
    }
    return {
        uid,
        bio,
        displayName: payload.displayName || d?.title || 'Unknown User',
        handle: payload.handle || '',
        photoURL: payload.photoURL || d?.photoURL || DEFAULT_PROFILE_PIC,
        glassColor: payload.glassColor || '#000000',
        ...payload
    };
}

const encodeProfileBody = (data, optBio) => {
    const meta = {
        displayName: data.displayName || '',
        handle: data.handle || '',
        email: data.email || '',
        customCSS: data.customCSS || '',
        themePreference: data.themePreference || DEFAULT_THEME_NAME,
        fontScaling: data.fontScaling || 'normal',
        backgroundImage: data.backgroundImage || '',
        glassColor: data.glassColor || '',
        glassOpacity: Number.isFinite(data.glassOpacity) ? data.glassOpacity : 0.95,
        glassBlur: Number.isFinite(data.glassBlur) ? data.glassBlur : null,
        discordId: data.discordId || '',
        discordTag: data.discordTag || '',
        discordPic: data.discordPic || '',
        discordURL: data.discordURL || '',
        githubPic: data.githubPic || '',
        githubURL: data.githubURL || ''
    };
    const b = optBio !== undefined ? optBio : (data.bio || '');
    const cleanBio = b.replaceAll(/<!--\s*ARCATOR_META:.*?-->/g, '').trim();
    return `${cleanBio}\n\n<!-- ARCATOR_META:${JSON.stringify(meta)} -->`;
};

const safeBody = value => (value || '').toString().trim() || '...';
const parseBodyJson = body => {
    if (!body) return {};
    const str = String(body);
    const metaMatch = str.match(/<!--\s*ARCATOR_META:\s*({.*})\s*-->/);
    if (metaMatch) {
         try {
             const payload = JSON.parse(metaMatch[1]);
             payload.content = str.replace(metaMatch[0], '').trim();
             return payload;
         } catch(e) {}
    }
    try { return JSON.parse(str); } catch { return { content: str }; }
};
const pagePayload = (slug, content, authorId) => safeBody(`${content || ''}<!-- ARCATOR_META:${JSON.stringify({ type: 'page', slug, authorId, content: undefined })} -->`);
const wikiPayload = (sectionId, content, allowedEditors = []) => safeBody(`${content || ''}<!-- ARCATOR_META:${JSON.stringify({ type: 'wiki', sectionId, allowedEditors, content: undefined })} -->`);

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
const NAV_HTML = `
<nav class="arc-nav" aria-label="Main">
  <menu>
    <li><a href="/index.html" class="arc-nav-brand fw-bold">Arcator</a></li>
    <li class="arc-nav-group d-flex">
        <a href="/wiki.html"><i class="bi bi-book"></i> Wiki</a>
        <a href="/forms.html"><i class="bi bi-chat-square-dots"></i> Forums</a>
        <a href="/pages.html"><i class="bi bi-file-earmark-text"></i> Pages</a>
        <a href="/resources.html"><i class="bi bi-box-seam"></i> Resources</a>
    </li>
    <li class="arc-nav-group d-flex secondary flex-grow-1 justify-content-center">
        <a href="/hub.html"><i class="bi bi-grid me-1"></i> Apps & Hub</a>
    </li>
    <li class="arc-nav-group d-flex social">
        <a href="https://discord.gg/GwArgw2" title="Discord" target="_blank"><i class="bi bi-discord"></i></a>
        <a href="https://codeberg.org/Arcator" title="Codeberg" target="_blank"><i class="bi bi-git"></i></a>
    </li>
    <li class="d-none" id="admin-link"><a href="/mod.html" class="text-warning">Admin</a></li>
    <li class="arc-user-section">
      <a href="/users.html" id="sign-in-btn" class="btn btn-sm btn-primary">Sign In</a>
      <a href="/users.html" class="d-none arc-profile-link" id="user-profile-link">
        <img src="/defaultuser.png" class="avatar-sm rounded-circle" alt="Profile" id="user-avatar" style="width:32px;height:32px;object-fit:cover;">
      </a>
    </li>
  </menu>
</nav>`;

function initLayout() {
    const nav = document.getElementById('navbar-placeholder');
    if (nav) {
        nav.innerHTML = NAV_HTML;
        const cur = location.pathname.split('/').pop() || 'index.html';
        const curRoot = '/' + cur;
        nav.querySelectorAll('menu a').forEach(l => {
            const href = l.getAttribute('href');
            if (href === curRoot || href === cur || (cur === 'index.html' && (href === '/' || href === '/index.html'))) {
                l.setAttribute('aria-current', 'page');
            }
        });
    }
    
    if (globalThis.Alpine) {
        const s = Alpine.store('auth');
        if (s && !s.loading) {
            updateUserSection(s.user, s.profile, s.isAdmin);
        }
    }
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
/** Theme management moved to js/ui.js **/

function registerUsersStore() {
    Alpine.store('users', {
        cache: {},
        async fetch(uid) {
            if (!uid || this.cache[uid]) return;
            try {
                const snap = await getDoc(docsRef(profileDocId(uid)));
                const data = snap.exists() ? parseProfileData(snap.data(), uid) : { displayName: 'Unknown User', photoURL: './defaultuser.png', uid };
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

/** Auth store moved to js/auth.js **/

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
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.ARTICLE), orderBy('createdAt', 'desc')));
            this.threads = await Promise.all(snap.docs.map(d => this.mapThreadDoc(d)));
            this.threads = this.threads.filter(t => !isPageDocId(t.id) && !isWikiDocId(t.id));
            this.threads.forEach(t => indexDoc({ kind: 'thread', id: t.id, title: t.title, body: (t.description || '').replaceAll(/<[^>]+>/g, ' ') }));
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
        mapThreadDoc(d) {
            const raw = d.data();
            const threadObj = {
                id: d.id,
                ...raw,
                description: raw.body || '',
                expanded: false,
                comments: [],
                commentCount: 0,
                loadingComments: false,
                quill: null
            };
            // Lazily evaluate N+1 message counts backward passively so the UI doesn't hitch
            const q = query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', d.id));
            getCountFromServer(q).then(countSnap => {
                threadObj.commentCount = countSnap.data().count;
            }).catch(() => {});
            return threadObj;
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
            await addDoc(docsCollection(), makeDocShape({
                kind: DOC_KIND.ARTICLE,
                authorId: u.uid,
                title: this.newThread.title || 'Untitled',
                body: safeBody(this.quill.root.innerHTML),
                photoURL: '',
                allowReplies: true,
                allowPublicEdits: false,
                pinned: false,
                featured: false,
                spoiler: false
            }));
            this.showCreateModal = false; this.newThread = { title: '', category: '', tags: '' }; this.quill.root.innerHTML = ''; this.loadThreads();
        },
        async toggleThread(t) {
            t.expanded = !t.expanded;
            if (t.expanded && !t.comments.length && t.commentCount > 0) {
                t.loadingComments = true;
                const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', t.id), orderBy('createdAt', 'asc')));
                t.comments = snap.docs.map(d => ({ id: d.id, ...d.data(), content: d.data().body || '', parentCommentId: null }));
                t.commentCount = t.comments.length;
                await Promise.all([...new Set(t.comments.map(c => c.authorId).filter(Boolean))].map(fetchAuthor));
                t.loadingComments = false;
            }
        },
        getReplies() { return []; },
        async softDeleteThread(t) {
            if (confirm(t.spoiler ? 'Un-censor?' : 'Censor?')) {
                await updateDoc(docsRef(t.id), {
                    allowReplies: t.allowReplies !== false,
                    allowPublicEdits: t.allowPublicEdits === true,
                    pinned: t.pinned === true,
                    featured: t.featured === true,
                    spoiler: !t.spoiler,
                    updatedAt: serverTimestamp()
                });
                t.spoiler = !t.spoiler;
            }
        },
        async deleteThread(id) { if (confirm('Delete?')) { await deleteDoc(docsRef(id)); removeDoc(id); this.threads = this.threads.filter(t => t.id !== id); } },
        async postComment(fid) {
            const t = this.threads.find(t => t.id === fid); if (!t?.quill) return;
            const c = t.quill.root.innerHTML; if (!c || c === '<p><br></p>') return;
            const batch = writeBatch(db);
            const newCommentRef = doc(docsCollection());
            batch.set(newCommentRef, makeDocShape({
                kind: DOC_KIND.MESSAGE,
                authorId: Alpine.store('auth').user.uid,
                parent: fid,
                title: '',
                body: safeBody(c),
                photoURL: ''
            }));
            batch.update(docsRef(fid), { lastReplyAt: serverTimestamp() });
            await batch.commit();
            t.quill.root.innerHTML = '';
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', fid), orderBy('createdAt', 'asc')));
            t.comments = snap.docs.map(d => ({ id: d.id, ...d.data(), content: d.data().body || '', parentCommentId: null }));
            t.commentCount = t.comments.length;
        },
        async vote(fid, c, type) {
            const u = Alpine.store('auth').user; if (!u) return Swal.fire('Error', 'Sign in to vote', 'error');
            const r = { ...c.reactions };
            const uid = u.uid;
            const mine = { ...r[uid] };
            if (type === 'up' || type === 'down') {
                const other = type === 'up' ? 'down' : 'up';
                if (mine[type]) delete mine[type];
                else { mine[type] = true; delete mine[other]; }
            } else if (mine[type]) delete mine[type]; else mine[type] = true;
            r[uid] = mine;
            await updateDoc(docsRef(c.id), { reactions: r });
            c.reactions = r;
        },
        hasVoted(c, t) { const u = Alpine.store('auth').user; return Boolean(u && c.reactions?.[u.uid]?.[t]); },
        getVoteScore(c) {
            if (!c.reactions) { return 0; }
            let s = 0;
            for (const uid of Object.keys(c.reactions)) {
                if (c.reactions[uid]?.up) { s++; }
                if (c.reactions[uid]?.down) { s--; }
            }
            return s;
        },
        getReactions(c) {
            if (!c.reactions) { return {}; }
            const res = {};
            for (const uid of Object.keys(c.reactions)) {
                const mine = c.reactions[uid] || {};
                for (const e of Object.keys(mine)) {
                    if (e !== 'up' && e !== 'down' && mine[e]) { res[e] = (res[e] || 0) + 1; }
                }
            }
            return res;
        },
        async replyTo(t, p) {
            const c = await promptEditor('Reply', '', '', 'Write reply...');
            if (c) {
                const batch = writeBatch(db);
                const newCommentRef = doc(docsCollection());
                batch.set(newCommentRef, makeDocShape({
                    kind: DOC_KIND.MESSAGE,
                    authorId: Alpine.store('auth').user.uid,
                    parent: t.id,
                    title: '',
                    body: safeBody(c),
                    photoURL: ''
                }));
                batch.update(docsRef(t.id), { lastReplyAt: serverTimestamp() });
                await batch.commit();
                const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', t.id), orderBy('createdAt', 'asc')));
                t.comments = snap.docs.map(d => ({ id: d.id, ...d.data(), content: d.data().body || '', parentCommentId: null }));
                t.commentCount = t.comments.length;
            }
        },
        async deleteComment(fid, cid) {
            if (!confirm('Delete?')) return;
            await deleteDoc(docsRef(cid));
            const t = this.threads.find(t => t.id === fid);
            if (t) {
                const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', fid), orderBy('createdAt', 'asc')));
                t.comments = snap.docs.map(d => ({ id: d.id, ...d.data(), content: d.data().body || '', parentCommentId: null }));
                t.commentCount = t.comments.length;
            }
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
            if (v) {
                await updateDoc(docsRef(t.id), { title: (v[0] || '').slice(0, 500), body: safeBody(v[3]), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() });
                Object.assign(t, { title: v[0], tags: v[1], category: v[2], description: v[3] });
            }
        },
        async editComment(fid, c) { const res = await promptEditor('Edit', '', c.content); if (res) { await updateDoc(docsRef(c.id), { title: '', body: safeBody(res), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() }); c.content = res; } },
        async censorComment(fid, c) { const res = await promptEditor('Redact', '', c.content); if (res) { await updateDoc(docsRef(c.id), { title: '', body: safeBody(res), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() }); c.content = res; c.censored = true; } }
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
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.ARTICLE), orderBy('updatedAt', 'desc')));
            this.conversations = snap.docs
                .map(d => {
                    let payload = {};
                    try { payload = JSON.parse(d.data().body || '{}'); } catch { payload = {}; }
                    return {
                        id: d.id,
                        ...d.data(),
                        name: d.data().title,
                        participants: Array.isArray(payload.participants) ? payload.participants : [],
                        participantNames: payload.participantNames || {}
                    };
                })
                .filter(c => c.id.startsWith('cv_') && c.participants.includes(u.uid));
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
            const q = query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', c.id), orderBy('createdAt', 'asc'));
            this.unsubscribe = onSnapshot(q, snap => this.handleMessageSnapshot(snap));
        },
        handleMessageSnapshot(snap) {
            this.messages = snap.docs.map(d => ({ id: d.id, ...d.data(), content: d.data().body || '', senderId: d.data().authorId }));
            this.$nextTick(() => this.scrollToBottom());
        },
        scrollToBottom() { const el = document.getElementById('msg-list'); if (el) el.scrollTop = el.scrollHeight; },
        async sendMessage() {
            if (!this.newMessage.trim() || !this.selectedConv) return;
            const u = Alpine.store('auth').user, batch = writeBatch(db), newMsgRef = doc(docsCollection());
            batch.set(newMsgRef, makeDocShape({ kind: DOC_KIND.MESSAGE, authorId: u.uid, parent: this.selectedConv.id, title: '', body: safeBody(this.newMessage), photoURL: '' }));
            batch.update(docsRef(this.selectedConv.id), { lastReplyAt: serverTimestamp() });
            await batch.commit(); this.newMessage = '';
        },
        async deleteMessage(id) { if (confirm('Delete?')) await deleteDoc(docsRef(id)); },
        async editMessage(m) { const c = await promptEditor('Edit', '', m.content); if (c) await updateDoc(docsRef(m.id), { title: '', body: safeBody(c), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() }); },
        async createConversation() {
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.PROFILE), orderBy('title', 'asc'))), u = Alpine.store('auth').user, others = snap.docs.map(d => ({ id: d.data().authorId, ...parseProfileData(d.data(), d.data().authorId) })).filter(x => x.id !== u.uid);
            if (!others.length) return Swal.fire('No users', '', 'info');
            const opts = others.map(x => `<option value="${x.id}">${x.displayName || x.email}</option>`).join('');
            const { value: id } = await Swal.fire({ title: 'New Conversation', html: `<select id="new-conv">${opts}</select>`, preConfirm: () => document.getElementById('new-conv').value, showCancelButton: true });
            if (id) {
                const ex = this.conversations.find(c => c.participants.includes(id) && c.participants.length === 2);
                if (ex) return this.selectConv(ex);
                const me = getAuthor(u.uid).displayName || 'Me';
                const other = getAuthor(id).displayName || 'User';
                await setDoc(docsRef(`cv_${crypto.randomUUID()}`), makeDocShape({
                    kind: DOC_KIND.ARTICLE,
                    authorId: u.uid,
                    title: `${me}, ${other}`,
                    body: safeBody(JSON.stringify({ participants: [u.uid, id], participantNames: { [u.uid]: me, [id]: other } })),
                    photoURL: '',
                    allowReplies: true,
                    allowPublicEdits: false
                }));
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
            const { value: v } = await Swal.fire({ title: 'Create Page', html: '<input id="np-title" class="mb-2" placeholder="Title"><input id="np-slug" class="mb-2" placeholder="Slug"><textarea id="np-content" rows="10" placeholder="HTML Content"></textarea>', showCancelButton: true, preConfirm: () => ({ title: document.getElementById('np-title').value, slug: document.getElementById('np-slug').value, content: document.getElementById('np-content').value, authorId: Alpine.store('auth').user.uid }) });
            if (v) {
                const id = pageDocId(v.slug);
                await setDoc(docsRef(id), makeDocShape({ kind: DOC_KIND.ARTICLE, authorId: v.authorId, title: v.title || 'Untitled', body: pagePayload(v.slug, v.content, v.authorId), photoURL: '', allowReplies: false, allowPublicEdits: false }));
                if (cb) { cb(); }
                Swal.fire('Success', 'Page created', 'success');
            }
        },
        async editPage(p, cb) {
            const { value: v } = await Swal.fire({ title: 'Edit Page', width: '800px', html: `<input id="ep-title" class="mb-2" placeholder="Title"><input id="ep-slug" class="mb-2" placeholder="Slug"><textarea id="ep-content" class="font-monospace" rows="15" placeholder="HTML Content"></textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('ep-title').value = p.title; document.getElementById('ep-slug').value = p.slug; document.getElementById('ep-content').value = p.content; }, preConfirm: () => ({ title: document.getElementById('ep-title').value, slug: document.getElementById('ep-slug').value, content: document.getElementById('ep-content').value, updatedAt: serverTimestamp() }) });
            if (v) {
                await updateDoc(docsRef(p.id), { title: (v.title || '').slice(0, 500), body: pagePayload(v.slug, v.content, p.authorId), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() });
                if (cb) { cb(); }
                Swal.fire('Success', 'Page updated', 'success');
            }
        },
        async deletePage(id, cb) {
            if ((await Swal.fire({ title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(docsRef(id));
                removeDoc(id);
                if (cb) { cb(); }
                Swal.fire('Deleted', 'Page has been deleted.', 'success');
            }
        },
        async createWikiSection(cb) {
            const { value: v } = await Swal.fire({ title: 'Create Wiki Section', html: '<input id="nw-id" class="mb-2" placeholder="Section ID (e.g. servers)"><textarea id="nw-content" class="font-monospace" rows="12" placeholder="HTML Content"></textarea>', showCancelButton: true, preConfirm: () => ({ id: document.getElementById('nw-id').value.toLowerCase().replaceAll(/\s+/g, '-'), content: document.getElementById('nw-content').value }) });
            if (v?.id) {
                const uid = Alpine.store('auth').user?.uid;
                await setDoc(docsRef(wikiDocId(v.id)), makeDocShape({ kind: DOC_KIND.ARTICLE, authorId: uid, title: v.id, body: wikiPayload(v.id, v.content, []), photoURL: '', allowReplies: false, allowPublicEdits: false }));
                if (cb) { cb(); }
                Swal.fire('Success', 'Wiki section created', 'success');
            }
        },
        async editWikiSection(s, cb) {
            const { value: v } = await Swal.fire({ title: `Edit: ${escapeHtml(s.id)}`, width: '900px', html: `<textarea id="ew-content" class="font-monospace" rows="20"></textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('ew-content').value = s.content || ''; }, preConfirm: () => document.getElementById('ew-content').value });
            if (v !== undefined) {
                const payload = parseBodyJson(s.body);
                await updateDoc(docsRef(s.id), { title: (payload.sectionId || s.id.replace(/^wk_/, '')).slice(0, 500), body: wikiPayload(payload.sectionId || s.id, v, payload.allowedEditors || []), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() });
                if (cb) { cb(); }
                Swal.fire('Success', 'Wiki section updated', 'success');
            }
        },
        async manageWikiEditors(s, users, cb) {
            const cur = s.allowedEditors || [];
            const opts = users.map(u => `<option value="${escapeHtml(u.id)}" ${cur.includes(u.id) ? 'selected' : ''}>${escapeHtml(u.displayName || u.email)}</option>`).join('');
            const { value: v } = await Swal.fire({ title: `Allowed Editors: ${escapeHtml(s.id)}`, html: `<p class="text-muted small">Admins can always edit. Select users who can also edit this section:</p><select id="ew-editors" multiple size="10">${opts}</select>`, showCancelButton: true, preConfirm: () => Array.from(document.getElementById('ew-editors').selectedOptions).map(o => o.value) });
            if (v !== undefined) {
                const payload = parseBodyJson(s.body);
                await updateDoc(docsRef(s.id), { title: (payload.sectionId || s.id.replace(/^wk_/, '')).slice(0, 500), body: wikiPayload(payload.sectionId || s.id, payload.content || '', v), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() });
                if (cb) { cb(); }
                Swal.fire('Success', 'Editors updated', 'success');
            }
        },
        async deleteWikiSection(id, cb) {
            if ((await Swal.fire({ title: 'Delete Wiki Section?', text: 'This cannot be undone!', icon: 'warning', showCancelButton: true })).isConfirmed) {
                await deleteDoc(docsRef(id));
                removeDoc(id);
                if (cb) { cb(); }
                Swal.fire('Deleted', 'Section removed.', 'success');
            }
        }
    });
}

function wikiApp() {
    return {
        tab: 'home', loading: true, tabs: [], tabContent: {}, tabMeta: {},
        get currentUser() { return Alpine.store('auth')?.user; },
        get isAdmin() { return Alpine.store('auth')?.isAdmin; },
        get canEdit() { return this.currentUser && (this.isAdmin || this.tabMeta[this.tab]?.allowedEditors?.includes(this.currentUser.uid)); },
        async init() {
            await firebaseReadyPromise;
            this.loading = true;
            try {
                const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.ARTICLE)));
                const docs = [];
                snap.forEach(d => {
                    const id = d.id;
                    if (id.startsWith('wk_') || id.startsWith('wiki_') || id.startsWith('~w')) {
                        docs.push({ id: d.id, ...d.data() });
                    }
                });

                docs.forEach(doc => {
                    const payload = parseBodyJson(doc.body);
                    let sectionId = doc.id;
                    if (sectionId.startsWith('wk_')) sectionId = sectionId.substring(3);
                    else if (sectionId.startsWith('wiki_')) sectionId = sectionId.substring(5);
                    else if (sectionId.startsWith('~w')) sectionId = sectionId.replace(/^~w\d*-/, '');

                    const content = payload.content || doc.body;
                    this.tabContent[sectionId] = content;
                    this.tabMeta[sectionId] = { ...payload, docId: doc.id };

                    this.tabs.push({ 
                        id: sectionId, 
                        label: doc.title || (sectionId.charAt(0).toUpperCase() + sectionId.slice(1)), 
                        icon: getWikiIcon(sectionId) 
                    });
                });

                const coreOrder = ['home', 'machines', 'growth', 'mcadmin', 'servers', 'software', 'staff', 'sysadmin'];
                this.tabs.sort((a, b) => {
                    const aMeta = this.tabMeta[a.id] || {};
                    const bMeta = this.tabMeta[b.id] || {};
                    const aIsCore = aMeta.docId?.startsWith('~w2601-');
                    const bIsCore = bMeta.docId?.startsWith('~w2601-');

                    if (aIsCore && bIsCore) {
                        const aIdx = coreOrder.indexOf(a.id);
                        const bIdx = coreOrder.indexOf(b.id);
                        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
                    }
                    if (aIsCore) return -1;
                    if (bIsCore) return 1;
                    return a.label.localeCompare(b.label);
                });

                const urlParams = new URL(globalThis.location.href).searchParams;
                const queryPage = urlParams.get('page') || urlParams.get('tab');
                if (queryPage && this.tabContent[queryPage]) {
                    this.tab = queryPage;
                } else if (!this.tabContent[this.tab] && this.tabs.length > 0) {
                    this.tab = this.tabs[0].id;
                }

                this.loading = false;
                this.$nextTick(() => this.renderTab(this.tab));
            } catch (err) {
                console.error("Wiki error:", err);
                this.loading = false;
            } finally {
                markSearchReady();
            }
        },
        renderTab(id) { 
            const container = document.getElementById('wiki-main-container');
            if (container && this.tabContent[id]) { 
                container.innerHTML = typeof marked !== 'undefined' ? marked.parse(this.tabContent[id]) : this.tabContent[id]; 
                container.querySelectorAll('[x-data]').forEach(x => Alpine.initTree(x)); 
            } 
        },
        isTransitioning: false,
        selectTab(id) {
            if (this.tab === id || this.isTransitioning) return;
            if (document.startViewTransition) {
                this.isTransitioning = true;
                const transition = document.startViewTransition(() => {
                    this.tab = id;
                    this.$nextTick(() => this.renderTab(id));
                });
                transition.finished.finally(() => this.isTransitioning = false).catch(()=>{});
            } else {
                this.tab = id;
                this.$nextTick(() => this.renderTab(id));
            }
        },
        async editCurrentTab() {
            const content = this.tabContent[this.tab] || '';
            const { value } = await Swal.fire({ title: `Edit: ${this.tabs.find(t => t.id === this.tab)?.label}`, width: '900px', html: `<textarea id="wiki-edit" class="font-monospace" rows="20"></textarea>`, showCancelButton: true, didOpen: () => { document.getElementById('wiki-edit').value = content; }, preConfirm: () => document.getElementById('wiki-edit').value });
            if (value !== undefined) {
                const meta = this.tabMeta[this.tab] || {};
                const docId = meta.docId || wikiDocId(this.tab);
                await updateDoc(docsRef(docId), { title: this.tab.slice(0, 500), body: wikiPayload(this.tab, value, meta.allowedEditors || []), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() });
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
        async loadPagesList() {
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.ARTICLE), orderBy('createdAt', 'desc')));
            this.pages = snap.docs
                .filter(d => isPageDocId(d.id))
                .map(d => {
                    const raw = d.data();
                    const payload = parseBodyJson(raw.body);
                    return { id: d.id, ...raw, slug: payload.slug || d.id.replace(/^pg_/, ''), content: payload.content || '', authorId: payload.authorId || raw.authorId };
                });
            this.pages.forEach(p => indexDoc({ kind: 'page', id: p.id, title: p.title, body: (p.content || '').replaceAll(/<[^>]+>/g, ' ') }));
            if (!this.currentPageId) this.loading = false;
            markSearchReady();
        },
        async loadSinglePage(id) {
            const snap = await getDoc(docsRef(id));
            if (snap.exists()) {
                const raw = snap.data();
                const payload = parseBodyJson(raw.body);
                this.currentPage = { id: snap.id, ...raw, slug: payload.slug || snap.id.replace(/^pg_/, ''), content: payload.content || '', authorId: payload.authorId || raw.authorId };
                document.title = `${this.currentPage.title || 'Page'} - Arcator`;
                await this.loadAuthor(this.currentPage.authorId);
            }
            this.loading = false;
        },
        async loadAuthor(uid) {
            if (!uid) return;
            await Alpine.store('users').fetch(uid);
            this.authorName = Alpine.store('users').get(uid).displayName || 'Unknown';
        },
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
            const acts = [...this.threads.map(t => ({ id: t.id, text: `New thread: ${t.title}`, time: t.createdAt, icon: 'bi-chat-square-text text-warning' })), ...this.dms.map(d => ({ id: d.id, text: `Message in ${d.participantNames ? Object.values(d.participantNames).join(', ') : 'Conversation'}`, time: d.lastReplyAt, icon: 'bi-envelope text-info' }))];
            return [...acts].sort((a, b) => (b.time?.seconds || 0) - (a.time?.seconds || 0)).slice(0, 5);
        },
        async init() {
            const evs = [['admin-edit-msg', e => this.editMessage(e.detail.cid, { id: e.detail.mid, content: e.detail.content })], ['admin-del-msg', e => this.deleteMessage(e.detail.cid, e.detail.mid)], ['admin-edit-comment', e => this.editComment(e.detail.tid, { id: e.detail.cid, content: e.detail.content })], ['admin-del-comment', e => this.deleteComment(e.detail.tid, e.detail.cid)]];
            evs.forEach(([n, h]) => document.addEventListener(n, h));
            Alpine.effect(async () => { const s = Alpine.store('auth'); if (!s.loading) { if (s.user) { this.currentUser = s.user; this.isAdmin = s.isAdmin; if (this.isAdmin) await this.refreshAll(); } this.loading = false; } });
        },
        async refreshAll() {
            const [profiles, articles] = await Promise.all([
                getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.PROFILE))),
                getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.ARTICLE), orderBy('createdAt', 'desc')))
            ]);
            this.users = profiles.docs.map(x => ({ id: x.data().authorId, docId: x.id, ...parseProfileData(x.data(), x.data().authorId) }));
            this.pages = articles.docs.filter(x => isPageDocId(x.id)).map(x => {
                const p = parseBodyJson(x.data().body);
                return { id: x.id, ...x.data(), slug: p.slug || x.id.replace(/^pg_/, ''), content: p.content || '', authorId: p.authorId || x.data().authorId };
            });
            this.threads = articles.docs.filter(x => !isPageDocId(x.id) && !isWikiDocId(x.id) && !x.id.startsWith('cv_')).map(x => ({ id: x.id, ...x.data(), description: x.data().body || '' }));
            this.dms = articles.docs.filter(x => x.id.startsWith('cv_')).map(x => {
                const p = parseBodyJson(x.data().body);
                return { id: x.id, ...x.data(), participants: p.participants || [], participantNames: p.participantNames || {} };
            });
            this.wikiSections = articles.docs.filter(x => isWikiDocId(x.id)).map(x => {
                const p = parseBodyJson(x.data().body);
                return { id: x.id, ...x.data(), sectionId: p.sectionId || x.id.replace(/^wk_/, ''), content: p.content || '', allowedEditors: p.allowedEditors || [] };
            });
        },
        getAuthorName(uid) { return Alpine.store('users').get(uid).displayName || 'Unknown'; },
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
            const merged = { ...this.users.find(x => x.id === uid), ...v };
            await updateDoc(docsRef(profileDocId(uid)), {
                title: (merged.displayName || 'User').slice(0, 100),
                body: safeBody(encodeProfileBody(merged)),
                photoURL: merged.photoURL?.startsWith('https://') ? merged.photoURL : '',
                bodyIsHTML: false,
                updatedAt: serverTimestamp()
            });
            if (v.admin) await setDoc(doc(db, COLLECTIONS.ADMINS, uid), { appointedAt: serverTimestamp() }).catch(e => console.error('Failed to add admin', e));
            else await deleteDoc(doc(db, COLLECTIONS.ADMINS, uid)).catch(e => console.error('Failed to remove admin', e));
            this.refreshAll(); Swal.fire('Success', 'User updated', 'success');
        },
        async editThread(t) {
            const { value: v } = await Swal.fire({ title: 'Edit Thread', html: `<input id="et-title" class="mb-2" placeholder="Title"><input id="et-tags" class="mb-2" placeholder="Tags"><select id="et-cat" class="mb-2"><option value="General">General</option><option value="Announcements">Announcements</option><option value="Support">Support</option><option value="Gaming">Gaming</option><option value="Discussion">Discussion</option></select><div class="form-check text-start mb-2"><input type="checkbox" id="et-locked"><label >Lock</label></div><textarea id="et-desc" rows="5"></textarea>`, didOpen: () => { document.getElementById('et-title').value = t.title; document.getElementById('et-tags').value = t.tags || ''; document.getElementById('et-cat').value = t.category || 'General'; document.getElementById('et-locked').checked = t.locked || false; document.getElementById('et-desc').value = t.description; }, showCancelButton: true, preConfirm: () => ({ title: document.getElementById('et-title').value, tags: document.getElementById('et-tags').value, category: document.getElementById('et-cat').value, locked: document.getElementById('et-locked').checked, description: document.getElementById('et-desc').value }) });
            if (v) { await updateDoc(docsRef(t.id), { title: (v.title || '').slice(0, 500), body: safeBody(v.description), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() }); this.refreshAll(); }
        },
        async deleteThread(id) { if (confirm('Delete?')) { await deleteDoc(docsRef(id)); this.refreshAll(); } },
        async viewThread(t) {
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', t.id), orderBy('createdAt', 'asc'))), Html = snap.docs.map(d => this.renderCommentForAdmin(t.id, d)).join('');
            Swal.fire({ title: escapeHtml(t.title), html: `<div class="text-start">${DOMPurify.sanitize(t.description)}</div><hr><div class="text-start admin-list-scroll">${Html || 'No comments'}</div>`, width: 800, didOpen: () => this.setupAdminCommentEvents(Swal.getHtmlContainer(), t.id, snap.docs) });
        },
        renderCommentForAdmin(tid, d) {
            const data = d.data();
            return `<div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25"><div class="d-flex justify-content-between"><small class="text-info">${escapeHtml(this.getAuthorName(data.authorId))}</small><small class="text-muted">${this.formatDate(data.createdAt)}</small></div><div class="my-1">${DOMPurify.sanitize(data.body || '')}</div><div class="d-flex gap-2 justify-content-end"><button class="btn-sm btn-outline-secondary py-0 edit-comment-btn" data-tid="${tid}" data-cid="${d.id}">Edit</button><button class="btn-sm btn-outline-danger py-0 del-comment-btn" data-tid="${tid}" data-cid="${d.id}">Del</button></div></div>`;
        },
        setupAdminCommentEvents(container, tid, docs) {
            container.querySelectorAll('.edit-comment-btn').forEach(btn => btn.onclick = () => this.dispatchEditComment(btn.dataset.cid, tid, docs));
            container.querySelectorAll('.del-comment-btn').forEach(btn => btn.onclick = () => this.dispatchDeleteComment(btn.dataset.cid, tid));
        },
        dispatchEditComment(cid, tid, docs) { const d = docs.find(x => x.id === cid); if (d) document.dispatchEvent(new CustomEvent('admin-edit-comment', { detail: { tid, cid: d.id, content: d.data().body || '' } })); },
        dispatchDeleteComment(cid, tid) { document.dispatchEvent(new CustomEvent('admin-del-comment', { detail: { tid, cid } })); },
        async viewDM(dm) {
            const snap = await getDocs(query(docsCollection(), where('kind', '==', DOC_KIND.MESSAGE), where('parent', '==', dm.id), orderBy('createdAt', 'asc'))), Html = snap.docs.map(d => this.renderMessageForAdmin(dm, d)).join('');
            Swal.fire({ title: 'Conversation Log', html: `<div class="text-start admin-list-scroll">${Html || 'No messages'}</div>`, width: 600, didOpen: () => this.setupAdminMessageEvents(Swal.getHtmlContainer(), dm.id, snap.docs) });
        },
        renderMessageForAdmin(dm, d) {
            const data = d.data(), s = dm.participantNames ? dm.participantNames[data.authorId] : this.getAuthorName(data.authorId);
            return `<div class="mb-2 p-2 border rounded border-secondary bg-dark bg-opacity-25"><div class="d-flex justify-content-between"><small class="text-info">${escapeHtml(s)}</small><small class="text-muted">${this.formatDate(data.createdAt)}</small></div><div class="my-1">${DOMPurify.sanitize(data.body || '')}</div><div class="d-flex gap-2 justify-content-end"><button class="btn-sm btn-outline-secondary py-0 edit-msg-btn" data-cid="${dm.id}" data-mid="${d.id}">Edit</button><button class="btn-sm btn-outline-danger py-0 del-msg-btn" data-cid="${dm.id}" data-mid="${d.id}">Del</button></div></div>`;
        },
        setupAdminMessageEvents(container, cid, docs) {
            container.querySelectorAll('.edit-msg-btn').forEach(btn => btn.onclick = () => this.dispatchEditMessage(btn.dataset.mid, cid, docs));
            container.querySelectorAll('.del-msg-btn').forEach(btn => btn.onclick = () => this.dispatchDeleteMessage(btn.dataset.mid, cid));
        },
        dispatchEditMessage(mid, cid, docs) { const d = docs.find(x => x.id === mid); if (d) document.dispatchEvent(new CustomEvent('admin-edit-msg', { detail: { cid, mid: d.id, content: d.data().body || '' } })); },
        dispatchDeleteMessage(mid, cid) { document.dispatchEvent(new CustomEvent('admin-del-msg', { detail: { cid, mid } })); },
        async deleteDM(id) { if (confirm('Delete?')) { await deleteDoc(docsRef(id)); this.refreshAll(); } },
        async deleteMessage(cid, mid) { if (confirm('Delete?')) { await deleteDoc(docsRef(mid)); const dm = this.dms.find(d => d.id === cid); if (dm) this.viewDM(dm); } },
        async editMessage(cid, m) { const res = await promptEditor('Edit', '', m.content); if (res) { await updateDoc(docsRef(m.id), { title: '', body: safeBody(res), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() }); const dm = this.dms.find(d => d.id === cid); if (dm) this.viewDM(dm); } },
        async deleteComment(tid, cid) { if (confirm('Delete?')) { await deleteDoc(docsRef(cid)); const t = this.threads.find(x => x.id === tid); if (t) this.viewThread(t); } },
        async editComment(tid, c) { const res = await promptEditor('Edit', '', c.content); if (res) { await updateDoc(docsRef(c.id), { title: '', body: safeBody(res), photoURL: '', bodyIsHTML: false, updatedAt: serverTimestamp() }); const t = this.threads.find(x => x.id === tid); if (t) this.viewThread(t); } }
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

// Cleanup removed registerAll call here as it's moved to initAlpine

function updateSpinnerState(el, loading, isSm) {
    if (loading) {
        el.style.setProperty('display', isSm ? 'block' : 'flex', 'important');
    } else {
        el.style.setProperty('display', 'none', 'important');
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayout);
} else {
    initLayout();
}

const projectId = "arcator-v2";
const appId = "1:171774915460:web:2fc364da8a1bd095eae3d1";

export {projectId, appId, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, COLLECTIONS, firebaseReadyPromise, getCurrentUser, formatDate, generateProfilePic, randomIdentity, initLayout, updateUserSection };
export {auth, db} from './js/firebase.js';