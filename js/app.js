import {
  db,
  deleteDoc,
  doc,
  collection,
  onSnapshot,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  srvTs,
} from './firebase.js';
import { getAuthorInfo, hydrateAuthors } from './profiles.js';
import { indexDoc, removeDoc, recentResults, searchDocs } from './search.js';
import {
  CATEGORY_ROUTES,
  docAuthor,
  IFRAME_VIEWS,
  ROUTES,
  SURFACES,
  sectionOf,
} from './views.js';
import {
  createArticle,
  createMessage,
  editContent,
  editFlags,
  getMsgCount,
  markRead,
  requireVerified,
  signalCron,
  toggleReaction,
  zeroProfile,
} from './writes.js';
import { askConfirm, makeEditor, reactionSummary } from './editor.js';
import { maybeRepair } from './repair.js';

async function confirmDelete(ref, title) {
  if (!(await askConfirm(title ? `Delete "${title}"?` : 'Delete this?'))) return false;
  await deleteDoc(ref);
  return true;
}

const _docCache = new Map();

//  Stores & Components 

document.addEventListener('alpine:init', () => {
  Alpine.store('site', {
    lastUpdate: null,
    _now: Date.now(),
    get ageMin() {
      return this.lastUpdate ? Math.floor((this._now - this.lastUpdate) / 60_000) : null;
    },
    get stalenessClass() {
      const m = this.ageMin;
      if (m === null || m < 75) return 'muted';
      if (m < 180) return 'warn';
      return 'err';
    },
    init() {
      setInterval(() => { this._now = Date.now(); }, 60_000);
      onSnapshot(
        doc(db, 'global', 'lastUpdate'),
        (snap) => {
          if (snap.exists()) this.lastUpdate = snap.data().lastCronRun?.toMillis() ?? null;
        },
        () => {},
      );
    },
  });

  Alpine.store('ui', {
    fullscreen: false,
    init() {
      document.addEventListener('fullscreenchange', () => {
        this.fullscreen = !!document.fullscreenElement;
      });
      Alpine.effect(() => {
        Alpine.store('nav').route.view;
        Alpine.store('nav').route.id;
        if (document.fullscreenElement) document.exitFullscreen();
      });
      Alpine.effect(() => {
        const v = Alpine.store('nav').route.view;
        document.title = (v !== 'home' ? v[0].toUpperCase() + v.slice(1) + ' — ' : '') + 'Arcator';
      });
    },
    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    },
    get hasIframe() {
      return Alpine.store('nav').route.view in IFRAME_VIEWS;
    },
  });

  Alpine.store('listDensity', {
    compact: localStorage.getItem('listDensity') === 'compact',
    toggle() {
      this.compact = !this.compact;
      localStorage.setItem('listDensity', this.compact ? 'compact' : 'card');
    },
  });

  let _emojiInit = null;
  Alpine.store('emoji', {
    _cb: null,
    async open(cb) {
      this._cb = cb;
      if (!_emojiInit) {
        _emojiInit = Promise.all([
          import('https://cdn.jsdelivr.net/npm/emoji-mart@5/+esm'),
          fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data').then((r) => r.json()),
        ]).then(([{ Picker }, data]) => {
          new Picker({
            data,
            theme: 'dark',
            parent: document.getElementById('emoji-picker'),
            onEmojiSelect: (e) => Alpine.store('emoji').pick(e.native),
          });
        });
      }
      await _emojiInit;
      document.getElementById('emoji-picker').showPopover();
    },
    pick(emoji) {
      const cb = this._cb;
      this._cb = null;
      cb?.(emoji);
      document.getElementById('emoji-picker').hidePopover();
    },
  });

  //  docItem 
  // Unified component for rendering a single doc in expanded or compact mode.
  // Takes either a string id (self-subscribing) or a data object (injected from list).

  function makeDocItem(source, surface, opts = {}) {
    const expanded = opts.expanded ?? false;
    const isLive = typeof source === 'string' || typeof source === 'function';
    const idFn = isLive ? (typeof source === 'function' ? source : () => source) : null;

    let unsub = null,
      _currentId = null,
      _self = null;

    const editor = expanded
      ? makeEditor(
          surface.editor,
          async (d) => {
            const current = _self.data;
            await editContent(doc(db, 'docs', current.id ?? idFn?.()), current.updatedAt, d);
          },
          {
            draftKey: () => {
              const id = idFn?.() ?? _self?.data?.id;
              return id ? `edit-${id}` : null;
            },
            draftHref: () => {
              const id = idFn?.() ?? _self?.data?.id;
              return id ? `/docs/${id}?edit` : null;
            },
            draftKind: 'edit',
          },
        )
      : { editing: false, saving: false };

    const item = {
      ...editor,
      expanded,
      // Doc state
      _rawData: isLive ? null : (source ?? null),
      loading: isLive,
      error: null,
      get data() {
        return this._rawData;
      },
      ref() {
        const d = this.data;
        return d?.id ? doc(db, 'docs', d.id) : null;
      },
      // Surface getters
      get author() {
        return this.data ? docAuthor(this.data) : null;
      },
      get title() {
        const d = this.data;
        return d ? surface.title(d) : null;
      },
      get body() {
        const d = this.data;
        return d ? surface.body(d) : '';
      },
      get preview() {
        const d = this.data;
        return d ? surface.subtitle(d) : '';
      },
      get href() {
        const d = this.data;
        return d ? surface.href(d) : null;
      },
      get showMeta() {
        return surface.showMeta;
      },
      get showAuthorByLine() {
        return surface.showAuthorByLine ?? true;
      },
      get avatarSize() {
        return surface.avatarSize ?? null;
      },
      get datePrefix() {
        return surface.datePrefix ?? 'on';
      },
      get createdAt() {
        const d = this.data;
        return d ? surface.createdAt(d) : null;
      },
      get canEdit() {
        const d = this.data;
        return d ? surface.canEdit(d) : false;
      },
      get canDelete() {
        const d = this.data;
        return d ? surface.canDelete(d) : false;
      },
      get canReply() {
        const d = this.data;
        return d ? surface.canReply(d) : false;
      },
      get canQuote() {
        const d = this.data;
        return d ? surface.canQuote(d) : false;
      },
      get canReact() {
        return surface.canReact();
      },
      get canEditFlags() {
        const d = this.data;
        return expanded && d ? surface.canEditFlags(d) : false;
      },
      get messageCount() {
        return this.data?.messageCount ?? null;
      },

      emitQuote() {
        window.dispatchEvent(
          new CustomEvent('quote', { detail: { body: this.body, authorName: this.author?.name } }),
        );
      },
      async toggleFlag(name) {
        const d = this.data;
        if (!d) return;
        try {
          await editFlags(this.ref(), d.updatedAt, { [name]: !d[name] });
        } catch (e) {
          this.err = e.message;
        }
      },
      async handleDelete() {
        const before = this.data;
        try {
          if (!(await confirmDelete(this.ref(), this.title))) return;
          if (before?.kind === 'article') signalCron();
          if (expanded) {
            const r = surface.redirectAfterDelete?.(before);
            if (r) Alpine.store('nav').go(r);
          }
        } catch (e) {
          this.err = e.message;
        }
      },

      _subscribe(id) {
        unsub?.();
        if (id !== _currentId) {
          const cached = _docCache.get(id) ?? null;
          this._rawData = cached;
          this.loading = cached === null;
          this.error = null;
        }
        _currentId = id;
        if (!id) {
          this.loading = false;
          return;
        }
        unsub = onSnapshot(
          doc(db, 'docs', id),
          (snap) => {
            this.loading = false;
            this._rawData = snap.exists()
              ? { id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) }
              : null;
            if (this._rawData) {
              _docCache.set(id, this._rawData);
              indexDoc(this._rawData);
              maybeRepair(this._rawData);
            } else {
              _docCache.delete(id);
              removeDoc(id);
            }
            this.error = snap.exists() ? null : 'Not found';
          },
          (e) => {
            this.loading = false;
            this.error = e.message;
            this._rawData = null;
          },
        );
      },

      init() {
        _self = this;
        if (isLive) {
          this._subscribe(idFn());
          this.$watch(idFn, (id) => this._subscribe(id));
        }
        if (expanded) {
          this._editorInit?.();
          if (opts.autoEdit && Alpine.store('nav').route.edit) {
            history.replaceState(null, '', location.pathname);
            if (this.data && this.canEdit) {
              this.start(this.data);
              return;
            }
            this.$watch('data', (d) => {
              if (d && this.canEdit && !this.editing) this.start(d);
            });
          }
        }
      },
      destroy() {
        unsub?.();
      },
    };
    return item;
  }

  Alpine.data('docItem', (source, opts = {}) =>
    makeDocItem(source, opts.surface ?? SURFACES.article, opts),
  );

  Alpine.data('reactions', (refFn, reactionsFn) => ({
    get summary() {
      return reactionSummary(reactionsFn() ?? {}, Alpine.store('auth').user?.uid);
    },
    init() {
      const hydrate = () => Object.keys(reactionsFn() ?? {}).forEach(getAuthorInfo);
      hydrate();
      this.$watch(reactionsFn, hydrate);
    },
    toggle(emoji) {
      if (!Alpine.store('auth').canWrite) return;
      const uid = Alpine.store('auth').user.uid;
      const r = reactionsFn() ?? {};
      r[uid] ??= {};
      const preState = { [uid]: { ...r[uid] } };
      if (r[uid][emoji]) {
        delete r[uid][emoji];
        if (!Object.keys(r[uid]).length) delete r[uid];
      } else {
        r[uid][emoji] = true;
      }
      toggleReaction(refFn(), emoji, preState);
    },
    pick() {
      Alpine.store('emoji').open((e) => this.toggle(e));
    },
  }));

  //  docPage 
  // Unified page component for content-view and profile-view.
  // Renders a self-subscribing docItem + child list + optional extra sections.

  Alpine.data('docPage', () => {
    const view = Alpine.store('nav').route.view;
    const isProfile = view === 'profile';
    const surface = isProfile ? SURFACES.profile : SURFACES.article;
    const idFn = isProfile
      ? () => {
          const id = Alpine.store('nav').route.id;
          return id ? `u_${id}` : null;
        }
      : () => Alpine.store('nav').route.id;

    const item = makeDocItem(idFn, surface, { expanded: true, autoEdit: !isProfile });
    const itemInit = item.init;
    const itemDestroy = item.destroy;

    const page = Object.defineProperties({}, Object.getOwnPropertyDescriptors(item));
    page.isProfile = isProfile;
    page._isAdmin = false;
    Object.defineProperties(page, {
      isOwnProfile: {
        get() {
          return isProfile && Alpine.store('auth').user?.uid === this.data?.authorId;
        },
      },
      canManageUser: {
        get() {
          return (
            isProfile && Alpine.store('auth').admin && this.data?.authorId && !this.isOwnProfile
          );
        },
      },
      categorySlug: {
        get() {
          return sectionOf(this.data);
        },
      },
      categoryLabel: {
        get() {
          return CATEGORY_ROUTES[this.categorySlug]?.heading ?? 'All';
        },
      },
    });
    page.zero = async () => {
      if (!(await askConfirm('Anonymize your profile?'))) return;
      await zeroProfile();
      Alpine.store('nav').go('/');
    };
    page.grantAdmin = async function () {
      const uid = this.data?.authorId;
      if (!uid) return;
      await setDoc(doc(db, 'admins', uid), { addedAt: srvTs(), addedBy: requireVerified() });
      this._isAdmin = true;
    };
    page.revokeAdmin = async function () {
      const uid = this.data?.authorId;
      if (!uid) return;
      await deleteDoc(doc(db, 'admins', uid));
      this._isAdmin = false;
    };
    page.ban = async function () {
      const uid = this.data?.authorId;
      if (!uid) return;
      if (!(await askConfirm('Ban ' + (this.data.title ?? uid) + '?'))) return;
      try {
        await setDoc(doc(db, 'bans', uid), {
          bannedBy: requireVerified(),
          bannedAt: srvTs(),
          reason: 'Banned by admin',
        });
        signalCron();
      } catch (e) {
        this.err = e.message;
      }
    };
    page.init = function () {
      itemInit.call(this);
      let _watchedDocId = null;
      this.$watch('data', (d) => {
        if (d?.id && d.id !== _watchedDocId) {
          _watchedDocId = d.id;
          markRead(d.id, d.lastReplyAt?.toMillis?.() ?? 0);
        }
        if (isProfile && d?.kind === 'profile' && d.authorId) {
          Alpine.store('profiles')[d.authorId] = { title: d.title, photoURL: d.photoURL };
          if (Alpine.store('auth').admin) {
            this._isAdmin = false;
            getDoc(doc(db, 'admins', d.authorId))
              .then((s) => { this._isAdmin = s.exists(); })
              .catch(() => {});
          }
        }
      });
    };
    page.destroy = function () {
      itemDestroy.call(this);
    };
    return page;
  });

  //  newContentEditor ─

  Alpine.data('newContentEditor', () => {
    const ed = makeEditor(
      SURFACES.article.editor,
      async (d) => {
        const id = await createArticle({ ...d, ...preset });
        Alpine.store('nav').go('/docs/' + id);
      },
      {
        startOpen: true,
        submitLabel: 'Create',
        draftKey: 'new-article',
        draftHref: '/new',
        draftKind: 'new',
      },
    );
    const urlCat = Alpine.store('nav').route.section;
    let selectedCat = urlCat && CATEGORY_ROUTES[urlCat]?.preset ? urlCat : 'forum';
    let preset = CATEGORY_ROUTES[selectedCat].preset;
    return {
      ...ed,
      selectedCat,
      get pageTitle() {
        const h = CATEGORY_ROUTES[this.selectedCat]?.heading;
        return h ? `New ${h} Article` : 'New Article';
      },
      selectCat(cat) {
        this.selectedCat = cat;
        selectedCat = cat;
        preset = CATEGORY_ROUTES[cat]?.preset ?? {};
      },
      init() {
        this._editorInit?.();
      },
    };
  });

  //  replyComposer ─

  Alpine.data('replyComposer', (parentId) => ({
    ...makeEditor(SURFACES.message.editor, (d) => createMessage(parentId, d.body), {
      startOpen: true,
      submitLabel: 'Reply',
      draftKey: `reply:${parentId}`,
      draftHref: parentId.startsWith('u_') ? `/profile/${parentId.slice(2)}` : `/docs/${parentId}`,
      draftKind: 'reply',
    }),
  }));

  //  docList 
  // Unified list component. `live` flag is the single structural discriminator:
  // live=true → onSnapshot, ascending, bounded, expanded messages, composer
  // live=false → getDocs, descending, infinite scroll, compact cards, counts

  function buildListQuery(sort, opts, lim, cursor, filterUser = '') {
    const filter = opts.filter;
    let constraints;
    if (filter) {
      constraints = [];
      if (filter.kind)
        constraints.push(
          Array.isArray(filter.kind)
            ? where('kind', 'in', filter.kind)
            : where('kind', '==', filter.kind),
        );
      if (filter.parent) constraints.push(where('parent', '==', filter.parent));
      if (filter.allowReplies !== undefined)
        constraints.push(where('allowReplies', '==', filter.allowReplies));
      if (filter.allowPublicEdits !== undefined)
        constraints.push(where('allowPublicEdits', '==', filter.allowPublicEdits));
      if (filterUser) constraints.push(where('authorId', '==', filterUser));
    } else {
      constraints = [where('kind', '==', 'article')];
      if (filterUser) constraints.push(where('authorId', '==', filterUser));
    }
    constraints.push(orderBy(sort, opts.order === 'asc' ? 'asc' : 'desc'), limit(lim));
    if (cursor) constraints.push(startAfter(cursor));
    return query(collection(db, 'docs'), ...constraints);
  }

  const _listComponent = (sortInit, opts = {}) => {
    const live = !!opts.live;
    const pageLimit = opts.limit ?? 25;
    let unsub = null,
      _lastDoc = null,
      _fetchSeq = 0;
    return {
      emptyText: 'Nothing here yet.',
      signupNew: false,
      browseTabs: false,
      showSelectors: false,
      showUserFilter: false,
      newHref: null,
      heading: '',
      ...opts,
      showDensityToggle: live,
      itemExpanded: live,
      hasComposer: live,
      itemSurface: live
        ? SURFACES.message
        : opts.filter?.kind === 'profile'
          ? SURFACES.profile
          : SURFACES.article,
      get parentId() {
        return opts.filter?.parent ?? null;
      },
      docs: [],
      loading: true,
      error: null,
      hasMore: false,
      filterUser: opts.showUserFilter ? (Alpine.store('nav').route.user ?? '') : '',

      async _fetch(cursor) {
        this.loading = true;
        this.error = null;
        const mine = ++_fetchSeq;
        try {
          const snap = await getDocs(
            buildListQuery(sortInit, opts, pageLimit + 1, cursor, this.filterUser),
          );
          if (mine !== _fetchSeq) return;
          _lastDoc = snap.docs[pageLimit - 1] ?? (cursor ? _lastDoc : null);
          const raw = snap.docs
            .slice(0, pageLimit)
            .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
          const [, counts] = await Promise.all([
            hydrateAuthors(raw),
            Promise.all(raw.map((d) => getMsgCount(d.id, d.lastReplyAt?.toMillis?.() ?? 0))),
          ]);
          if (mine !== _fetchSeq) return;
          counts.forEach((c, i) => {
            raw[i].messageCount = c;
          });
          raw.forEach(indexDoc);
          raw.forEach(maybeRepair);
          this.docs = cursor ? [...this.docs, ...raw] : raw;
          this.hasMore = snap.size > pageLimit;
        } catch (e) {
          if (mine !== _fetchSeq) return;
          this.error = e.message;
        }
        this.loading = false;
      },
      _load() {
        return this._fetch(null);
      },
      loadMore() {
        if (this.loading || !this.hasMore) return;
        return this._fetch(_lastDoc);
      },
      _subscribe() {
        unsub?.();
        this.loading = true;
        let seq = 0;
        unsub = onSnapshot(
          buildListQuery(sortInit, opts, pageLimit, null, ''),
          async (snap) => {
            const mine = ++seq;
            const docs = snap.docs.map((d) => ({
              id: d.id,
              ...d.data({ serverTimestamps: 'estimate' }),
            }));
            await hydrateAuthors(docs);
            if (mine !== seq) return;
            docs.forEach(indexDoc);
            docs.forEach(maybeRepair);
            this.docs = docs;
            this.loading = false;
          },
          (e) => {
            this.error = e.message;
            this.loading = false;
          },
        );
      },
      init() {
        live ? this._subscribe() : this._load();
        if (opts.showUserFilter) {
          if (this.filterUser) getAuthorInfo(this.filterUser);
          this.$watch('filterUser', (v) => {
            Alpine.store('nav').setUser(v);
            this._load();
          });
          this.$watch(
            () => Alpine.store('nav').route.user,
            (v) => {
              const next = v ?? '';
              if (next !== this.filterUser) this.filterUser = next;
            },
          );
        }
      },
      destroy() {
        unsub?.();
      },
    };
  };

  Alpine.data('listFor', _listComponent);

  Alpine.data('repliesFeed', (parentId, heading = 'Replies') =>
    _listComponent('createdAt', {
      live: true,
      filter: { parent: parentId, kind: 'message' },
      order: 'asc',
      limit: 100,
      heading,
      emptyText: `No ${heading.toLowerCase()} yet.`,
    }),
  );

  //  Other components ─

  Alpine.data('iframeTabsView', () => ({
    get view() {
      return IFRAME_VIEWS[Alpine.store('nav').route.view];
    },
    tab: null,
    init() {
      this.tab = this.view.tabs[0].key;
    },
    get currentTab() {
      return this.view.tabs.find((t) => t.key === this.tab) ?? this.view.tabs[0];
    },
  }));

  Alpine.data('loginDialog', () => ({
    signup: false,
    email: '',
    password: '',
    displayName: '',
    notice: null,
    loading: false,
    async _run(fn, closeOnSuccess = true) {
      if (this.loading) return;
      this.loading = true;
      this.notice = null;
      try {
        await fn();
        if (closeOnSuccess) this.$el.closest('dialog').close();
      } catch (e) {
        this.notice = { kind: 'error', msg: e.message };
      } finally {
        this.loading = false;
      }
    },
    submitEmail() {
      const a = Alpine.store('auth');
      this._run(() =>
        this.signup
          ? a.signUpEmail(this.email, this.password, this.displayName)
          : a.signInEmail(this.email, this.password),
      );
    },
    oauth(method) {
      this._run(() => Alpine.store('auth')[method]());
    },
    forgot() {
      this._run(async () => {
        await Alpine.store('auth').resetPassword(this.email);
        this.notice = { kind: 'ok', msg: 'Reset link sent — check your email.' };
      }, false);
    },
  }));

  Alpine.data('countdown', () => {
    const BD = { month: 11, day: 11, founded: 2010 };
    function diff() {
      const tz = Temporal.Now.timeZoneId();
      const now = Temporal.Now.zonedDateTimeISO(tz);
      const today = now.toPlainDate();
      let target = Temporal.PlainDate.from({ year: today.year, month: BD.month, day: BD.day });
      if (Temporal.PlainDate.compare(target, today) <= 0) target = target.add({ years: 1 });
      const {
        days: d,
        hours: h,
        minutes: m,
        seconds: s,
      } = now.until(target.toZonedDateTime(tz), { largestUnit: 'days' });
      const age = target.year - BD.founded;
      const p = [];
      if (d) p.push(d + ' day' + (d !== 1 ? 's' : ''));
      if (h) p.push(h + ' hour' + (h !== 1 ? 's' : ''));
      if (m) p.push(m + ' minute' + (m !== 1 ? 's' : ''));
      p.push(s + ' second' + (s !== 1 ? 's' : ''));
      const j = p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p.at(-1) : p[0];
      const o = (n) => {
        const r = n % 100;
        return r > 10 && r < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
      };
      return j + " till Arcator's " + age + o(age) + ' birthday!';
    }
    let timer;
    return {
      label: diff(),
      _start() {
        timer = setInterval(() => (this.label = diff()), 1000);
      },
      _stop() {
        clearInterval(timer);
        timer = null;
      },
      init() {
        this._start();
        document.addEventListener(
          'visibilitychange',
          (this._onVis = () => (document.hidden ? this._stop() : this._start())),
        );
      },
      destroy() {
        this._stop();
        document.removeEventListener('visibilitychange', this._onVis);
      },
    };
  });

  Alpine.data('greeter', () => ({
    open: false,
    msg: '',
    greets: [
      'hi',
      'hey',
      'hello',
      'helo',
      'sup',
      "what's up",
      'greetings',
      'how are you',
      'hiya',
      "what's going on",
      'konichiwa',
      'welcome',
      'wb',
      '👋',
      'hai',
      'yo',
      'yowza',
      'chur',
      'ciao',
      'whaddup',
      'heyyyy',
      'hii',
      'allo',
      'kia ora',
      'hallo',
    ],
    pick() {
      this.msg = this.greets[Math.floor(Math.random() * this.greets.length)];
      this.open = !this.open;
    },
  }));

  Alpine.data('currentRoute', () => ({
    get tmpl() {
      const v = Alpine.store('nav').route.view;
      const entry = ROUTES[v] || ROUTES['*'];
      if (entry.guard === 'in' && !Alpine.store('auth').canWrite) return 'status-page';
      const tmpl = entry.tmpl;
      return tmpl === 'doc-list' ? `doc-list:${v}` : tmpl;
    },
    get status() {
      const guarded =
        ROUTES[Alpine.store('nav').route.view]?.guard === 'in' && !Alpine.store('auth').canWrite;
      return guarded
        ? {
            title: 'Sign in required',
            body: 'Please sign in to create content.',
            link: { href: '/all', label: 'Back to content' },
            signIn: true,
          }
        : {
            title: 'Page not found',
            body: "The page you're looking for doesn't exist.",
            link: { href: '/', label: 'Go home' },
            signIn: false,
          };
    },
  }));

  Alpine.data('draftRecovery', () => ({
    drafts: [],
    init() {
      this.scan();
      this.$watch(
        () => Alpine.store('nav').route.view,
        () => this.scan(),
      );
    },
    scan() {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith('draft:')) continue;
        const { draft, href, kind } = JSON.parse(localStorage.getItem(k) || '{}');
        if (!href) continue;
        if (kind === 'edit') {
          const docId = href.split('/')[2]?.split('?')[0];
          if (docId) {
            getDoc(doc(db, 'docs', docId)).then((snap) => {
              if (!snap.exists()) { localStorage.removeItem(k); this.scan(); }
            });
          }
        }
        const title = draft?.title?.trim();
        const preview = draft?.body?.trim().slice(0, 35);
        const fallback =
          kind === 'reply' ? 'Continue reply' : kind === 'edit' ? 'Edit draft' : 'New post draft';
        items.push({ key: k, href, label: title || (preview ? `"${preview}…"` : fallback) });
      }
      this.drafts = items;
    },
    discard(key) {
      localStorage.removeItem(key);
      this.scan();
    },
  }));

  //  cmdPalette ─

  Alpine.data('cmdPalette', () => ({
    query: '',
    sel: 0,

    get results() {
      const q = this.query.trim();
      return q ? searchDocs(q) : recentResults();
    },

    go(href) {
      Alpine.store('nav').go(href);
      document.getElementById('cmd-dialog').close();
      this.query = '';
      this.sel = 0;
    },

    onKeydown(e) {
      const n = this.results.length;
      if (!n) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.sel = (this.sel + 1) % n;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.sel = (this.sel - 1 + n) % n;
      } else if (e.key === 'Enter') {
        const r = this.results[this.sel];
        if (r) this.go(r.href);
      }
    },

    reset() {
      this.query = '';
      this.sel = 0;
    },
  }));
});

const TAGLINES = ['Spacetime\'s most resilient Minecraft network!','The name was randomly generated!','Not dead yet!','Blocks and all everywhere!','100% Homemade!','Dynamic and enterprisey!','Randomly generated taglines!','[WAS] Run from a tiny spare room in Hackney!','The most electrifying Minecraft server on the internet!','A series of tubes!','Still alive (for now)!','The best thing since sliced bread!','Brilliant for procrastination!','Made in Germany!','Provided with absolutely no warranty!','Linux-based!','...or your money back!','99.8% of players would recommend it!','We built our own world... BWONNNNNG!!!','Not safe for sanity; causes profound addiction!','And we\'re back!'];

{
  const el = document.querySelector('.tagline');
  if (el) {
    function* shuffledCycle(arr) {
      while (true) {
        const deck = [...arr];
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        yield* deck;
      }
    }
    const seq = shuffledCycle(TAGLINES);
    setInterval(() => { el.textContent = seq.next().value; }, 6000);
  }
}
