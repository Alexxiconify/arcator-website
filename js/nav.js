const ID_VIEWS  = new Set(['docs', 'profile']);
const SORT_KEYS = new Set(['active']);

function parse(url) {
  const u = new URL(url);
  const s = u.pathname.split('/').filter(Boolean);
  if (!s.length) return { view: 'home', id: null, section: null, sort: null, edit: false, user: null };
  const view = s[0];
  const seg1 = s[1] || null;
  if (view === 'new') {
    return { view, id: null, section: u.searchParams.get('section'), sort: null, edit: false, user: null };
  }
  return {
    view,
    id:   ID_VIEWS.has(view)                         ? seg1 : null,
    section:  null,
    sort: !ID_VIEWS.has(view) && SORT_KEYS.has(seg1) ? seg1 : null,
    edit: u.searchParams.has('edit'),
    user: u.searchParams.get('user') || null,
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.store('nav', {
    route: parse(location.href),

    init() {
      // Per-page navigation: we don't intercept 'navigate' events anymore 
      // as the user wants separate HTML pages.
    },

    go(path) { if (path !== location.pathname) navigation.navigate(path); },
    back(fallback) { if (navigation.canGoBack) history.back(); else if (fallback) this.go(fallback); },
    setUser(uid) {
      const u = new URL(location.href);
      uid ? u.searchParams.set('user', uid) : u.searchParams.delete('user');
      history.replaceState(null, '', u);
      this.route.user = uid || null;
    },
  });
});

export {};
