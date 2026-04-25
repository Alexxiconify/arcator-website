import { getAuthorInfo } from './profiles.js';

const isOwnerOrAdmin = aid => Alpine?.store('auth')?.user?.uid === aid || Alpine?.store('auth')?.admin;
const ownsDoc = d => !!(d && isOwnerOrAdmin(d.authorId));

const IFRAME_VIEWS = {
  maps: {
    tabs: [
      { key: 'hub',         label: 'Hub 🗺️',       src: 'https://jylina.arcator.co.uk/hub/', description: 'Our oldest server and freebuild.' },
      { key: 'ssmp',        label: 'SSMP 🗺️',      src: 'https://jylina.arcator.co.uk/ssmp/', description: 'The main survival server since 2019.' },
      { key: 'friendgraph', label: 'Friend Graph',  src: 'https://apollo.arcator.co.uk/standalone/joins.html', description: 'Visual graph of who invited who.' },
      { key: 'joingraph',   label: 'Join Graph',    src: 'https://apollo.arcator.co.uk/standalone/souls/', description: 'Press space to unpause. Every second is 2 days. Each green name is someone\'s first join and each red name was their last leave..' },
      { key: 'stats',       label: 'MC Stats',      src: 'https://jylina.arcator.co.uk/plan/network/overview', description: 'Minecraft server stats.' }
    ]
  },
  games: {
    tabs: [
      { key: 'console',  label: 'Console',  src: '/console/', description: 'A read only view of Onfim\'s network.' },
      { key: 'tag',      label: 'Tag',      src: '/tag/', description: 'Multiplayer tag game. WASD keys.' },
      { key: 'spelling', label: 'Spelling', src: '/spelling/', description: 'Word spelling challenge game.' }
    ]
  },
  resources: {
    tabs: [
      { key: 'planning',  label: 'Planning',        src: 'https://docs.google.com/document/d/1WvxTStjkBbQh9dp-59v1jJbaLPuofrnk_4N12mSMFo4/view', description: 'Community coordination notes.' },
      { key: 'census',    label: 'Census',          src: 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/view', description: 'A spreadsheet with everyone\'s our interests.' },
      { key: 'guidebook', label: 'Guidebook',       src: 'https://apollo.arcator.co.uk/guide.html', description: 'Comprehensive staffing guide.' },
      { key: 'sshguide',  label: 'SSH Guide',       src: 'https://docs.google.com/document/d/12jVogFvlsBPtT2WmkWJmV-uCJ6fd02XHRNZf5anO4dc/view', description: 'A guide on how to use SSH' },
      { key: 'oldchat',   label: 'Old Chat [Login]',src: 'https://apollo.arcator.co.uk/chat/index.html', description: 'Old chat logs since 2010 (requires login).' }
    ]
  }
};

const docAuthor = d => {
  if (!d) return { id: '', name: 'Anonymous', photo: '' };
  const p = Alpine?.store('profiles')?.[d.authorId];
  if (!p && d.authorId) getAuthorInfo(d.authorId);
  return { id: d.authorId, name: p?.title ?? d.authorId?.slice(0, 8) ?? 'Unknown', photo: p?.photoURL ?? '' };
};

const CATEGORY_ROUTES = {
  forum:   { filter: {kind: 'article', allowReplies: true,  allowPublicEdits: false}, preset: {allowReplies: true,  allowPublicEdits: false}, heading: 'Forum',   newHref: '/new?section=forum', emptyText: 'No posts yet. Be the first!', showSelectors: true, showUserFilter: true },
  wiki:    { filter: {kind: 'article', allowPublicEdits: true},                       preset: {allowReplies: false, allowPublicEdits: true},  heading: 'Wiki',    newHref: '/new?section=wiki',  emptyText: 'No wiki pages yet.',          showSelectors: true, showUserFilter: true },
  pages:   { filter: {kind: 'article', allowReplies: false, allowPublicEdits: false}, preset: {allowReplies: false, allowPublicEdits: false}, heading: 'Pages',   newHref: '/new?section=pages', emptyText: 'No pages yet.',               showSelectors: true, showUserFilter: true },
  members: { filter: {kind: 'profile'},  heading: 'Members', newHref: null, emptyText: 'No members yet.',   showSelectors: true, signupNew: true },
  all:     { filter: {kind: 'article'},  heading: 'All',     newHref: null, emptyText: 'Nothing here yet.', showSelectors: true, showUserFilter: true },
};

export const sectionOf = d =>
  !d               ? 'all'     :
  d.kind === 'profile' ? 'members' :
  d.kind === 'message' ? null      :
  d.allowPublicEdits   ? 'wiki'    :
  d.allowReplies === false ? 'pages' : 'forum';

const BROWSE_TABS = Object.entries(CATEGORY_ROUTES).map(([id, r]) => ({ id, label: r.heading, href: '/' + id }));

// Surface factory — shared defaults, only override what differs per kind.
function surface(overrides) {
  return {
    title:     d => d?.title?.trim() ?? '',
    body:      d => d?.body?.trim() ?? '',
    author:    docAuthor,
    createdAt: d => d?.createdAt ?? null,
    subtitle:  d => {
      if (!d?.body) return '';
      return d.body.slice(0, 500)
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [label](url) → label, ![alt](url) → alt
        .replace(/[*_~`#>\\|]+/g, ' ')             // markdown symbols → space
        .replace(/\s+/g, ' ').trim().slice(0, 150);
    },
    href:      d => d ? '/docs/' + d.id : null,
    showMeta:  true,
    canEdit:      ownsDoc,
    canDelete:    ownsDoc,
    canReply:     () => false,
    canQuote:     d => { const b = d?.body?.trim(); return !!(b && b.length <= 200); },
    canEditFlags: () => false,
    canReact:     () => true,
    redirectAfterDelete: () => '/all',
    editor: ['title', 'body'],
    ...overrides,
  };
}

const SURFACES = {
  article: surface({
    href: d => d ? `/docs/${d.id}` : null,
    canEdit:      d => ownsDoc(d) || (d?.allowPublicEdits === true && Alpine.store('auth').user?.emailVerified),
    canReply:     d => d?.allowReplies === true,
    canEditFlags: ownsDoc,
    redirectAfterDelete: d => '/' + sectionOf(d),
  }),
  message: surface({
    title:     () => null,
    subtitle:  d => d?.body?.replace(/\s+/g, ' ').trim().slice(0, 150) ?? '',
    href:      () => null,
    canReply:  () => true,
    redirectAfterDelete: () => null,
    editor: ['body'],
  }),
  profile: surface({
    href:             d => d?.authorId ? '/profile/' + d.authorId : null,
    showAuthorByLine: false,
    avatarSize:       'lg',
    datePrefix:       'registered',
    canReply:         d => !!d?.allowReplies,
    canDelete:        () => false,
    canEditFlags:     ownsDoc,
    redirectAfterDelete: () => null,
    editor: [{ name: 'title', type: 'text', max: 100, required: true, sanitize: 'collapse', placeholder: 'Title' }, 'body', 'photoURL'],
  }),
};

export const FLAG_DEFS = [
  { name: 'allowReplies',     label: 'Allow replies',      kinds: ['article', 'profile'] },
  { name: 'allowPublicEdits', label: 'Allow public edits', kinds: ['article'] },
  { name: 'pinned',           label: 'Pinned'   },
  { name: 'featured',         label: 'Featured' },
  { name: 'spoiler',          label: 'Spoiler'  },
];


const HOME_VARIANTS = [
  { title: 'Welcome to Arcator!',
	  body: 'An open friend group for all :) We play games, chat, and love meeting new people.',
    videoId: '0_hSeETBTus',
    footer: '(Click that cyndaquil to time travel!)' },
  { title: 'Welcome to Arcator (2016)!',
    body: 'The philosophy of Arcator has always been to provide a fun experience, meaning even new users can build straight away. It is frustrating when it can take weeks to become trusted. If you want a place where you can just play, meet people, and worry about ranks later, Arcator is the place for you.',
    videoId: 'DCFWLstv3mU',
    footer: 'SINCE 2010! Come and join us — it\'s easy. Just put the following: arcator.co.uk and type the command below.' },
  { title: 'A True Freebuild… and More! (2011)',
    body: 'Arcator (pronounced: ɑrkətɔr) is a multi-server, UK-based Minecraft network. We offer a friendly, social environment and pretty decent admins, and we also have an absolute zero tolerance policy on griefing. This is your only warning.',
    videoId: 'ywVljjljLvs',
    footer: 'For detailed server information and specifications, visit' },
  { title: 'Arcator (2010)',
    body: '',
    videoId: '-HsGRt4OKpE',
    footer: 'The Alpha map is still available; come and see it!' }
];

const NAV_LINKS = [
  { ids: ['home'],      label: 'Home',      href: '/' },
  { ids: ['forum', 'wiki', 'pages', 'members', 'all'], label: 'Browse', href: '/forum', smartBrowse: true },
  { ids: ['maps'],      label: 'Visuals',   href: '/maps' },
  { ids: ['resources'], label: 'Resources', href: '/resources' },
  { ids: ['games'],     label: 'Games',     href: '/games' },
  { ids: [],            label: 'Discord',   href: 'http://discord.gg/GwArgw2', target: '_blank', rel: 'noopener noreferrer' }
];

const ROUTES = {
  home:      { tmpl: 'home' },
  forum:     { tmpl: 'doc-list' },
  wiki:      { tmpl: 'doc-list' },
  pages:     { tmpl: 'doc-list' },
  all:       { tmpl: 'doc-list' },
  members:   { tmpl: 'doc-list' },
  docs:      { tmpl: 'doc-page' },
  'new':     { tmpl: 'new-view', guard: 'in' },
  profile:   { tmpl: 'doc-page' },
  maps:      { tmpl: 'iframe-tabs' },
  games:     { tmpl: 'iframe-tabs' },
  resources: { tmpl: 'iframe-tabs' },
  '*':       { tmpl: 'status-page' },
};

export { SURFACES, ROUTES, CATEGORY_ROUTES, NAV_LINKS, HOME_VARIANTS, IFRAME_VIEWS, docAuthor };
window.SURFACES         = SURFACES;
window.CATEGORY_ROUTES  = CATEGORY_ROUTES;
window.sectionOf        = sectionOf;
window.BROWSE_TABS     = BROWSE_TABS;
window.NAV_LINKS       = NAV_LINKS;
window.HOME_VARIANTS   = HOME_VARIANTS;
window.FLAG_DEFS       = FLAG_DEFS;
