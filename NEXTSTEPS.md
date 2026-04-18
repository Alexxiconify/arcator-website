# Frontend Tech Debt PR — Plan

## Scope & Non-Goals

**This PR refactors the frontend only.** It replaces custom code with native platform features, removes dead code, fixes latent bugs, and consolidates duplicated patterns. The visual design and every user-facing feature stay identical.

**Explicitly out of scope:**

- Backend / Firestore schema: `forms`, `submissions`, `conversations`, `messages`, `wiki_pages`, `temp_pages`, `user_profiles`, `admins`, `custom_themes`, `artifacts/{projectId}` — unchanged.
- Auth: Google, GitHub, Twitter, Apple, Discord, email/password continue to work.
- Features: forums (nested replies, up/down votes, emoji reactions, censor/delete, categories), direct messages (real-time), wiki (8 tabs, per-section editors), pages (slug system), resources (Google Sheet + Doc embeds), admin dashboard — all preserved.
- Per-user theming: `customCSS`, `backgroundImage`, `glassColor`, `glassOpacity`, `glassBlur`, `fontScaling`, `themePreference` continue to apply. Only the plumbing that delivers them changes.
- Firebase SDK stays `firebase/firestore` (not `/lite`) — `onSnapshot` is still needed for DMs.
- No build tools, no bundler, no TypeScript, no client-side router. Per `AI.md`.

---

## 1. Native Platform Replacements

### 1.1 SweetAlert2 → `<dialog>` + `<form method="dialog">`

**35 `Swal.fire(...)` call sites** across `app.js`. Every one builds an HTML string in the `html:` property, mounts it with a `didOpen` hook that calls `document.getElementById(...).value = ...`, and reads values back in a `preConfirm` hook. Native `<dialog>` removes every step of that dance:

- Focus moves to the first interactive element on `showModal()`; returns to the opener on close.
- `Esc` closes the dialog; the browser manages `inert` on the rest of the page.
- `<form method="dialog">` makes a submit button close the dialog and expose `dialog.returnValue`.
- Inputs bind to Alpine state via `x-model` — no `document.getElementById`.
- Native form validation (`required`, `minlength`, `type="email"`, `pattern`) works without custom `preConfirm` checks.
- `::backdrop` pseudo-element handles backdrop styling; add `dialog::backdrop { backdrop-filter: blur(4px); }` once in `styles.css`.

**Concrete before/after (from `mgmt.createPage`):**

```js
// Before — 4 lines that hide ~30 lines of modal machinery
const { value: v } = await Swal.fire({
  title: 'Create Page',
  html: '<input id="np-title" class="mb-2" placeholder="Title"><input id="np-slug" class="mb-2" placeholder="Slug"><textarea id="np-content" rows="10" placeholder="HTML Content"></textarea>',
  showCancelButton: true,
  preConfirm: () => ({ title: document.getElementById('np-title').value, slug: document.getElementById('np-slug').value, content: document.getElementById('np-content').value, createdAt: serverTimestamp() })
});
if (v) { await addDoc(collection(db, COLLECTIONS.PAGES), v); if (cb) cb(); Swal.fire('Success', 'Page created', 'success'); }
```

```html
<!-- After — in pages.html, reusable dialog -->
<dialog x-ref="createDialog">
  <form method="dialog" @submit.prevent="submit()">
    <input x-model="form.title" placeholder="Title" required>
    <input x-model="form.slug" placeholder="Slug" required pattern="[a-z0-9-]+">
    <textarea x-model="form.content" rows="10" placeholder="HTML Content"></textarea>
    <menu>
      <button value="cancel" formnovalidate>Cancel</button>
      <button value="confirm">Create</button>
    </menu>
  </form>
</dialog>
```

```js
// Alpine method
async createPage() {
  this.form = { title: '', slug: '', content: '' };
  this.$refs.createDialog.showModal();
},
async submit() {
  await addDoc(collection(db, COLLECTIONS.PAGES), { ...this.form, createdAt: serverTimestamp() });
  this.$refs.createDialog.close();
  this.loadPagesList();
  this.toast('Page created'); // small helper replacing the success Swal.fire
}
```

**Call sites to migrate** (inventory):

- `forumData` — `editThread`, `editComment`, `censorComment`, `replyTo` (via `promptEditor`), the inline `showCreateModal` form (already Alpine, just upgrade shell to `<dialog>`).
- `messageData` — `createConversation` (user picker), `editMessage`.
- `mgmt` store — `createPage`, `editPage`, `deletePage` (confirm), `createWikiSection`, `editWikiSection`, `manageWikiEditors`, `deleteWikiSection`.
- `adminDashboard` — `editUser` (the biggest offender, ~100 lines of HTML string building and 30+ `getElementById` reads), `editThread`, `viewThread`, `viewDM`, `editMessage`, `editComment`, `deleteThread`/`deleteDM` (`confirm()` dialogs).
- `wikiApp` — `editCurrentTab`.
- All `Swal.fire('Success', ..., 'success')` and `Swal.fire('Error', e.message, 'error')` toasts → lightweight `<dialog>` or `<output>` toast component (one implementation, used everywhere).

**The `promptEditor` helper** currently does double duty: plain HTML forms via `html:` parameter, or Quill editor via an in-modal `div#swal-editor`. Split into:
- Alpine HTML dialogs (above).
- A single reusable `<dialog id="quill-dialog">` with a `<div x-ref="quillHost">` that a component mounts Quill into on `@toggle="if($event.target.open) initQuill()"`. No more "build Swal, wait for didOpen, then poke Quill into the Swal DOM."

**Side effects of this migration:**

1. **Four cross-component `CustomEvent` dispatches disappear.** `admin-edit-comment`, `admin-del-comment`, `admin-edit-msg`, `admin-del-msg` exist only because SweetAlert's modal DOM is outside Alpine's reactive scope, so buttons rendered by `didOpen` can't call component methods directly. Once the modal is a `<dialog>` inside the component's own template, those buttons call methods normally. Delete:
   - The 4 `document.addEventListener('admin-*', ...)` calls in `adminDashboard.init()`.
   - The 4 `document.dispatchEvent(new CustomEvent('admin-*', ...))` calls in `viewThread` / `viewDM`.
2. **Latent bug fix:** `admin-del-comment` listener is registered **three times** (app.js lines 574–576 are identical). After this migration, the three lines cease to exist at all. Before that migration lands, delete lines 575–576 as a standalone tiny commit.

**Dependency removed:** `<script src="…sweetalert2@11.26.24">` — ~40 KB gzipped, loaded on 6 of 9 pages.

---

### 1.2 Hand-rolled dropdowns → Popover API

**6 `{ open: false }` dropdown components** use the same pattern:

```html
<div class="dropdown" x-data="{ open: false }">
  <button @click="open = !open">⋮</button>
  <ul class="dropdown-menu" x-show="open" @click.outside="open = false" @click="open = false" x-cloak>…</ul>
</div>
```

Becomes:

```html
<button popovertarget="menu-thread-{{ id }}" popovertargetaction="toggle">⋮</button>
<ul id="menu-thread-{{ id }}" popover>…</ul>
```

The browser handles: top-layer placement (no z-index wars), light-dismiss on outside click, `Esc` to close, auto-close when another auto-popover opens. Baseline since April 2025.

Anchor positioning for the menu's placement relative to its trigger: use CSS anchor positioning where supported, fall back to `position: absolute` on the popover with manual top/left set via Alpine (current behavior is already manual).

---

### 1.3 Expand/collapse → `<details>` / `<summary>`

Forum thread rows currently use: `thread.expanded`, `toggleThread()`, `▼/▶` glyphs, `x-show="thread.expanded"`, lazy comment fetch inside the toggle method.

Replace with:

```html
<details @toggle="if ($event.target.open && !thread.commentsLoaded) loadComments(thread)">
  <summary><!-- title, meta, badges --></summary>
  <!-- comments -->
</details>
```

Free keyboard accessibility, no Alpine state for expansion, no `x-cloak` flicker. Also applies to the collapsible wiki-sidebar sections if used elsewhere.

**Also delete:** the `<script defer src="…@alpinejs/collapse…">` tag in `wiki.html`. The plugin is loaded but `x-collapse` is **never used** in the project (0 occurrences).

---

### 1.4 `arcator_user_cache` localStorage → Alpine `$persist`

Current code manages a `localStorage` entry by hand:

- `cacheUser(u, p)` — manually picks 9 profile fields, `JSON.stringify`, writes.
- `init()` reads it, `JSON.parse` inside a `try/catch`, pre-renders optimistically.
- `saveProfile` re-caches.
- `logout` removes.

Replace:

```js
// Add the plugin script — ~1 KB
// <script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.x/dist/cdn.min.js"></script>

Alpine.store('auth', {
  profile: Alpine.$persist(null).as('arcator_profile'),
  user: Alpine.$persist(null).as('arcator_user'),  // just uid + a couple basics for rehydration
  loading: true,
  isAdmin: false,
  // …
});
```

Alpine rehydrates `profile` synchronously on init — no flash of unstyled UI, no manual parsing. `saveProfile` becomes `this.profile = { ...this.profile, ...update }` and persistence is automatic. `logout` becomes `this.profile = null`.

Delete `cacheUser` and the localStorage read/write logic — ~25 lines.

---

## 2. Dead Code & Latent Bugs (Verified by grep)

All of these are small, surgical, independently committable.

### 2.1 Broken constant reference (silent data bug)

`app.js` lines 224 & 270: `themePreference: DEFAULT_THEME` — but the constant is `DEFAULT_THEME_NAME`. Every new user created via email signup or OAuth first-time sign-in has been getting `themePreference: undefined` written to Firestore. Fix: change both sites to `DEFAULT_THEME_NAME`, or accept that `'dark'` is fine and inline it.

### 2.2 Triple-registered event listener

`app.js` lines 574–576 register the **same** `admin-del-comment` listener three times:

```js
document.addEventListener('admin-del-comment', e => this.deleteComment(e.detail.tid, e.detail.cid));
document.addEventListener('admin-del-comment', e => this.deleteComment(e.detail.tid, e.detail.cid));
document.addEventListener('admin-del-comment', e => this.deleteComment(e.detail.tid, e.detail.cid));
```

Every admin comment deletion fires three deletes. Fix: delete lines 575 and 576.

### 2.3 Unused Firebase imports

Confirmed by grep — these names appear only in the import statement and the dead export at line 804:

- From `firebase-auth.js`: `onIdTokenChanged`, `EmailAuthProvider`, `linkWithCredential`, `sendPasswordResetEmail`.
- From `firebase-firestore.js`: `collectionGroup`, `limit`, `startAfter`.

Trim the import lists.

### 2.4 Dead exports

`app.js` line 804 exports ~50 symbols, including `app`, `auth`, `db`, all the Firebase functions, and locally-defined helpers. **Nothing imports from `app.js`** — it's loaded as `<script type="module" src="./app.js">`, never imported. The entire `export { ... }` block is dead weight. Delete it.

### 2.5 No-op Firebase config

Line 86: `app.automaticDataCollectionEnabled = false;` — not a valid property on the Firebase 12 modular `FirebaseApp`. Silently does nothing. If data-collection opt-out is actually desired, it lives on `getAnalytics(app).app.automaticDataCollectionEnabled` or is set via `initializeApp({ ..., automaticDataCollectionEnabled: false })`. For now: delete the line.

### 2.6 Duplicate & dead `COLLECTIONS` keys

```js
COLLECTIONS = { USERS: 'user_profiles', USER_PROFILES: 'user_profiles', …, THEMES: 'custom_themes', … }
```

- `USERS` is never referenced — all sites use `USER_PROFILES`. Delete `USERS`.
- `THEMES` is never referenced anywhere in the codebase. Delete.

### 2.7 Dead helper constants

- `DEFAULT_PROFILE_PIC = './defaultuser.png'` — defined, exported, never read. Code uses the hardcoded string `'./defaultuser.png'` ~10 places. Either use the constant everywhere, or delete it and keep the hardcoded strings. Recommend: inline.
- `DEFAULT_THEME_NAME` — keep (it's the correct constant for §2.1).
- `getCurrentUser = () => auth.currentUser` — defined, exported, never called. Delete.

### 2.8 Duplicate `registerAll` invocation

`app.js` line 799 (inside `alpine:init`) and line 801 (`if (window.Alpine) registerAll()`). The second call triggers on any page where Alpine has already been loaded before the module runs — and re-registers every store, which Alpine tolerates but will warn about in dev builds. Remove line 801. The `alpine:init` event is reliable.

### 2.9 Dead Alpine plugin

`wiki.html` loads `@alpinejs/collapse@3.14.0` but `x-collapse` is used **0 times** in the project. Remove the script tag.

### 2.10 `DEFAULT_THEME_NAME` vs `'dark'` inconsistency

Some sites use `DEFAULT_THEME_NAME`, others hardcode `'dark'`, and the broken `DEFAULT_THEME` reference gets `undefined`. Pick one. Recommend: keep `DEFAULT_THEME_NAME`, replace all hardcoded `'dark'` defaults with it.

---

## 3. Consolidation

### 3.1 Card classes → one (`.glass-card`)

Grep counts: `.glass-card` × 19, `.accent-card` × 7, `.hover-card` × 4, `.list-item-card` × 1.

Merge to `.glass-card` as the single surface class. Where a variant is genuinely needed (`accent-card` for highlighted sections in the user profile; `hover-card` for interactive tiles on the landing page), use modifier classes on the base: `.glass-card.is-accent`, `.glass-card.is-interactive`. Delete `.list-item-card` entirely — its one use can be a plain `<article>` styled by Pico.

Search-and-replace across: `forms.html`, `index.html`, `mod.html`, `pages.html`, `resources.html`, `users.html`, `wiki.html`. Delete the 3 redundant rules from `styles.css`.

### 3.2 Loading states → one pattern

Three different loading UIs exist:

1. `x-spinner="loading"` custom directive (registered in `app.js`).
2. `.loading-pulse` / `.loading-spinner` div (`resources.html`).
3. Inline `<div class="spinner-border">` (scattered).

Pick **`x-spinner`** since Alpine reactivity already drives it, and rewrite the other two. Alternatively, drop the custom directive and use native `<progress aria-busy="true" x-show="loading">` (Pico styles `<progress>` natively) — the simpler choice by ~15 lines.

### 3.3 `updateUserSection` → Alpine bindings

`updateUserSection(u, p, isAdmin)` directly mutates DOM: `classList.add('d-none')`, `classList.replace('d-flex', 'd-none')`, sets `av.src`, toggles the admin link. It's called 6 times from inside `registerAuthStore` and `initLayout`, which is manual reactivity on top of a reactive framework.

Since `$store.auth` already has `user`, `profile`, and `isAdmin`, the navbar HTML can just bind to them:

```html
<!-- NAV_HTML becomes -->
<a id="sign-in-btn" href="./users.html" x-show="!$store.auth.user">Sign In</a>
<a href="./users.html" x-show="$store.auth.user" class="arc-profile-link">
  <img :src="$store.auth.profile?.photoURL || './defaultuser.png'" class="avatar-sm">
</a>
<li x-show="$store.auth.isAdmin" x-cloak><a href="./mod.html">Admin</a></li>
```

Delete: `updateUserSection` entirely, its 6 call sites, the final 3 lines of `initLayout` that peek at the store. Saves ~25 lines + removes 4 imperative `classList` operations.

### 3.4 `updateTheme` → one reactive sink

Currently `updateTheme(t, f, css, bg, gc, go, gb)` is called from `init()`, `saveProfile`, and the localStorage rehydration path, each with a 7-arg call. It sets `<html data-theme>`, `<html data-font-size>`, `body.style.backgroundImage`, `--glass-bg` inline, and injects a `<style id="custom-css-style">`.

Keep the feature. Simplify the plumbing: make `updateTheme` a pure effect that reads from the (now `$persist`ed) `profile` store:

```js
// in auth store init
Alpine.effect(() => {
  const p = this.profile ?? {};
  const root = document.documentElement;
  root.dataset.theme = p.themePreference ?? 'dark';
  root.dataset.fontSize = p.fontScaling ?? 'normal';
  // … etc.
});
```

One effect, one source of truth, no 7-arg calls. Custom CSS stays injected via `<style>` but wrapped in `@layer user { … }` so it can't accidentally outweigh Pico utilities.

### 3.5 Duplicate modal logic between `forumData` / `pagesData` and `adminDashboard`

`editThread`, `editComment`, `deleteComment` (and the DM equivalents) exist in both the user-facing data component and the admin dashboard with nearly identical SweetAlert markup. After §1.1, they all share the same underlying `<dialog>` element anyway. Extract the method bodies onto the `mgmt` store; `forumData.editThread(t) = () => Alpine.store('mgmt').editThread(t, () => this.loadThreads())`. Same pattern already used for page/wiki ops.

### 3.6 Profile page: move giant inline `x-data` to `Alpine.data()`

`users.html` line 2014 has a ~400-character inline `x-data="{ ... }"` with getters, watchers, and an `x-init` hook. Pattern already exists for `forumData`, `wikiApp`, `pagesData`, etc. — be consistent:

```js
// app.js
function registerProfilePage() {
  Alpine.data('profilePage', () => ({
    email: '', password: '', displayName: '', handle: '',
    isSignUp: false, settingsTab: 'profile',
    profile: {},
    get user() { return Alpine.store('auth').user; },
    get storeProfile() { return Alpine.store('auth').profile; },
    init() {
      this.$watch('storeProfile', v => { if (v) this.profile = { ...v }; });
      if (this.storeProfile) this.profile = { ...this.storeProfile };
    }
  }));
}
```

HTML becomes `<main x-data="profilePage">`.

### 3.7 Linked-providers buttons → loop

`users.html` has 4 near-identical buttons for Google / GitHub / Discord / Twitter, each a ~300-character inline expression. Provider-id format is inconsistent (`'google.com'` vs `'oidc.oidc.discord'`). Extract:

```js
// in profilePage data
providers: [
  { key: 'google',  id: 'google.com',       label: 'Google',  icon: 'bi-google' },
  { key: 'github',  id: 'github.com',       label: 'GitHub',  icon: 'bi-github' },
  { key: 'discord', id: 'oidc.oidc.discord', label: 'Discord', icon: 'bi-discord' },
  { key: 'twitter', id: 'twitter.com',      label: 'Twitter', icon: 'bi-twitter-x' },
],
toggleProvider(p) {
  const fn = this.$store.auth.isProviderLinked(p.id)
    ? this.$store.auth.unlinkProvider(p.id)
    : this.$store.auth.linkProvider(p.key);
  return fn.catch(e => this.toast(e.message, 'error'));
}
```

```html
<template x-for="p in providers" :key="p.key">
  <button
    :class="$store.auth.isProviderLinked(p.id) ? 'btn-outline-danger' : 'btn-outline-primary'"
    @click="toggleProvider(p)">
    <i class="bi" :class="p.icon"></i>
    <span x-text="$store.auth.isProviderLinked(p.id) ? 'Unlink ' + p.label : 'Link ' + p.label"></span>
  </button>
</template>
```

Provider-id normalization has exactly one home.

### 3.8 Icons: pick one system

Bootstrap Icons (`<i class="bi …">`) used 51 times. Emoji spans (`<span class="emoji-icon">✏️</span>`) used 10 times — sometimes **next to** a Bootstrap icon doing the same thing. Drop `.emoji-icon`, replace the 10 emoji-span sites with the equivalent `bi-*` icon.

---

## 4. CSS Simplification (`styles.css`)

Target: roughly half the current ~270 lines. Visual output unchanged.

### Keep

- Pico v2 base (already loaded via CDN — not in `styles.css`).
- `.glass-card` and its `--glass-bg`, `--glass-blur`, `--glass-opacity` custom properties. **This is the project's signature look — leave it.**
- `.sidebar`, `.main-content` — layout primitives actually load-bearing on `wiki.html`, `pages.html`, `index.html`.
- `.avatar-sm`, `.avatar-profile`, `.profile-img-sm` — the avatar size variants used in the navbar, comments, profile header.
- `.fade-in`, `.nav-link-custom`, `.nav-link.active` — custom UI that Pico doesn't cover.
- `:root` custom properties driving the theme system.
- `[x-cloak] { display: none !important; }` — needed for Alpine's initial paint.

### Remove or collapse

- `.accent-card`, `.hover-card`, `.list-item-card` → fold into `.glass-card` as optional modifiers (§3.1).
- `.emoji-icon` → delete (§3.8).
- **The Bootstrap-utility lookalike layer.** The following classes appear in the HTML but compete with Pico's built-in styling or with inline styles that already work. Audit each one against actual use count; delete any rule whose selector appears ≤ 2 times in the HTML:
  - Layout: `.d-flex`, `.d-none`, `.d-md-none`, `.d-grid`, `.d-flex-column`, `.justify-content-*`, `.align-items-*`, `.flex-wrap`, `.flex-column`
  - Spacing: `.g-*`, `.gap-*`, `.px-*`, `.py-*`, `.p-*`, `.m-*`, `.mb-*`, `.mt-*`, `.me-*`, `.ms-*`
  - Grid: `.row`, `.col-*`, `.container-fluid` — Pico has `.grid` which covers most needs; where it doesn't, use inline `style="display:grid;grid-template-columns:..."` for the handful of real cases.
  - Sizing: `.w-100`, `.w-auto`, `.h-100`, `.vh-*`
  - Text: `.text-*`, `.fw-*`, `.font-monospace`, `.lead`, `.small`
  - Color: `.bg-*`, `.border-*`
  - Buttons: `.btn-*`, `.btn-outline-*`, `.btn-sm`, `.btn-lg` — Pico already styles `<button>`; prefer `<button>` and `<button class="secondary">` / `<button class="outline">` (Pico variants). Keep only a custom `.btn-sm` if genuinely needed for compact toolbars.
  - Nav: `.nav-pills`, `.nav-link`, `.nav-item`
  - Forms: `.form-check`, `.form-switch` — Pico's `<input type="checkbox" role="switch">` gives a switch natively.
  - Misc: `.position-fixed`, `.object-fit-cover`, `.opacity-*`, `.display-*`, `.rounded-*`

**Method:** write a small shell script that counts each class in the HTML files, delete any CSS rule whose selector has count ≤ 2, review the diff. What remains is what's load-bearing.

### Add

- `dialog::backdrop { background: rgba(0,0,0,.5); backdrop-filter: blur(4px); }` — styles all new native modals at once.
- `@layer user { … }` wrapper for the per-user custom CSS injection — prevents user CSS from overriding essential layout.

---

## 5. Alpine Idiom Cleanups

### 5.1 `x-cloak` — pick a pattern

10 uses, inconsistent. Add the global rule (`[x-cloak] { display: none !important; }`) once in `styles.css`, and use `x-cloak` on the top-level `x-data` container of every page. Don't mix `x-cloak` with `x-show="!loading"` toggles on the same element.

### 5.2 Permission getters → store methods

`get canEdit()` exists in both `wikiApp` and `pagesData` with different logic. `$store.auth.isAdmin` is accessed inline in templates in ~15 places. Consolidate:

```js
// on auth store
canEditWikiSection(sectionId) {
  if (!this.user) return false;
  if (this.isAdmin) return true;
  const section = Alpine.store('wiki').sections?.[sectionId];
  return section?.allowedEditors?.includes(this.user.uid) ?? false;
},
canEditPage(page) {
  return this.user && (this.isAdmin || page?.authorId === this.user.uid);
},
canModerateThread(thread) {
  return this.user && (this.isAdmin || thread?.authorId === this.user.uid);
}
```

Templates call `$store.auth.canEditPage(page)` — one source of truth for permissions.

### 5.3 Inline `x-data` blocks → `Alpine.data()`

Per §3.6 and as a general rule, any `x-data` longer than ~80 characters moves to a named `Alpine.data()` factory. Matches the existing convention.

### 5.4 Prefer `@starting-style` for transitions over `x-transition` where content is not Alpine-reactive

`<dialog>` and `[popover]` entries/exits can animate with pure CSS via `@starting-style` and `transition-behavior: allow-discrete`. Not required for this PR, but where `x-transition` is only being used to fade a modal in/out, the native CSS route is less code.

---

## 6. Per-file Impact

| File | Changes |
|---|---|
| `app.js` | Remove dead imports (7), fix `DEFAULT_THEME` bug, delete dupe `admin-del-comment` listeners, delete `cacheUser` + localStorage logic (swap for `$persist`), delete `updateUserSection`, delete `COLLECTIONS.USERS` + `COLLECTIONS.THEMES`, delete `getCurrentUser` + `DEFAULT_PROFILE_PIC` constants, delete `app.automaticDataCollectionEnabled` line, delete `export {…}` block, delete duplicated `registerAll()` call, rewrite all `Swal.fire` sites to trigger `<dialog>` refs, extract `registerProfilePage`, consolidate admin/user dialog logic into `mgmt`, consolidate permission checks, swap `updateTheme` for Alpine effect. |
| `styles.css` | Drop `.accent-card`, `.hover-card`, `.list-item-card`, `.emoji-icon`. Sweep Bootstrap-utility rules: keep only selectors used ≥ 3 times. Add `dialog::backdrop` + `@layer user`. Keep glass system, sidebar/main-content, avatars, fade-in, `:root` tokens. Target: ~half current line count. |
| `forms.html` | `<dialog>` for create thread (already Alpine — just re-shell), edit thread, reply, edit/censor comment. `popover` on ⋮ dropdowns. `<details>` for thread expansion. Switch Quill host to the shared quill-dialog. Delete SweetAlert2 script tag. |
| `mod.html` | `<dialog>` for edit user, edit thread, view thread, view DM, edit/delete comment, edit/delete message. Delete all `document.dispatchEvent(new CustomEvent('admin-*'))` calls and their counterparts. Delete SweetAlert2 script tag. |
| `pages.html` | `<dialog>` for create/edit/delete page. Sidebar current-page link can just bind to `currentPageId`. Delete SweetAlert2 script tag (still need DOMPurify + marked). |
| `wiki.html` | `<dialog>` for edit section. Delete `<script …@alpinejs/collapse>` tag (unused). Delete SweetAlert2 script tag. |
| `users.html` | Move inline `x-data` to `profilePage` Alpine factory. Extract provider-link buttons via `x-for`. Replace emoji spans with `bi-*` icons. Delete SweetAlert2 script tag. |
| `resources.html` | Unify loading state to `x-spinner` or `<progress>`. Drop redundant utility classes after CSS sweep. |
| `index.html` | Drop redundant utility classes. No behavior change. |
| `404.html` | Drop unused Alpine script tag (the page has no `x-data`). Trivial. |

---

## 7. Suggested Commit Order

Each commit is independently mergeable and leaves the app in a shipping state.

1. **Dead code & bug fixes.** Delete unused imports, fix `DEFAULT_THEME` typo, delete dupe `admin-del-comment` listeners (lines 575–576), delete `COLLECTIONS.USERS` + `COLLECTIONS.THEMES`, delete `getCurrentUser`, delete `app.automaticDataCollectionEnabled`, delete double `registerAll`, delete `@alpinejs/collapse` script tag, delete `export {…}` block. **Tiny, high-confidence.**
2. **`$persist` swap** for `arcator_user_cache`. Add persist plugin script, replace `cacheUser` plumbing. Isolated.
3. **`<details>`** for forum expansion. One file (`forms.html`), one method rewrite.
4. **`popover`** for all `{ open: false }` dropdowns. Search-and-replace by pattern.
5. **`<dialog>` migration**, one consumer per commit, in order: `pagesData` → `mgmt` (pages + wiki) → `wikiApp` → `forumData` → `messageData` → `adminDashboard`. Each commit keeps SweetAlert2 loaded but uses it for fewer sites.
6. **Delete SweetAlert2** `<script>` tags across all pages. One commit.
7. **Replace `updateUserSection` + nav/footer** with Alpine bindings. Remove imperative DOM manipulation.
8. **Consolidate modal logic** between admin and user-facing components onto `mgmt` store. Delete CustomEvent pipes.
9. **Extract inline `x-data`** to `Alpine.data()` (users.html provider-link buttons and profile page).
10. **Consolidate card classes** — search/replace HTML, delete 3 CSS rules.
11. **CSS sweep** — audit utility classes against HTML usage, delete unused rules. Diff review.
12. **Icon unification** — replace 10 `.emoji-icon` spans with `bi-*` icons. Delete `.emoji-icon` class.
