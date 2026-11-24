// Learn in Motion: a no-backend PWA for scrolling through what you want to learn.
// Data lives in localStorage on this device. Export a backup from the menu.
import { discover, loadFeed, fromFeed, appleEpisode, FeedError } from './feeds.js';
import { youtubeVideos, youtubeHighlight, showEpisodes, podcastShows, hnStories, devArticles, wikiArticles, blogFeeds } from './discover.js';
import { findTranscript, loadTranscript } from './transcript.js';

const STORE_KEY = 'lim.items.v1';
const SOURCES_KEY = 'lim.sources.v1';
const PREFS_KEY = 'lim.prefs.v1';
const SYNC_EVERY = 30 * 60 * 1000; // check followed sources at most every 30 minutes
const FIRST_FOLLOW_ITEMS = 3;      // a newly followed source brings in its 3 latest posts
const MAX_NEW_PER_SYNC = 10;       // per source, so a busy feed can't flood Up next
const DISCOVER_KEY = 'lim.discover.v1';
const DSEEN_KEY = 'lim.discover.seen.v1';
const DISCOVER_STALE = 6 * 3600 * 1000; // suggestions refresh after 6 hours
const PRESET_INTERESTS = ['AI', 'Programming', 'Psychology', 'Productivity', 'Science', 'Math', 'History', 'Philosophy',
  'Business', 'Investing', 'Health', 'Design', 'Startups', 'Writing', 'Physics', 'Space'];
const QUERY_VARIANTS = ['', ' for beginners', ' lecture', ' deep dive', ' history', ' tips'];

/* ------------------------------------------------------------------ icons */
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  play: '<path d="M7 5.5v13l11-6.5z" fill="currentColor"/>',
  stack: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.7 4.7 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.2 1.5 1.4 2.5"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  sparkle: '<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  back15: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><text x="12.2" y="15.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui, sans-serif">15</text>',
  fwd30: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/><text x="11.8" y="15.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui, sans-serif">30</text>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor" stroke="none"/>',
  yt: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>',
  shrink: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>',
  expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------------------------------------------------------------- helpers */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const safeUrl = (u) => {
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch { return ''; }
};
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const faviconOf = (it) => it.logo || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainOf(it.url || it.link || it.feedUrl))}&sz=128`;
const hueOf = (it) => hash(it.videoId || domainOf(it.url) || it.id) % 360;
const fmtTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const fmtDuration = (s) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
};
const ago = (ts) => {
  const min = (Date.now() - ts) / 60000;
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.floor(min)}m ago`;
  if (min < 1440) return `${Math.floor(min / 60)}h ago`;
  if (min < 10080) return `${Math.floor(min / 1440)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

/* ------------------------------------------------------------ link parsing */
function extractUrl(text) {
  text = String(text || '').trim();
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  let s = m ? m[0] : text.split(/\s+/)[0] || '';
  s = s.replace(/[.,;:!?'"]+$/, '');
  while (s.endsWith(')') && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) s = s.slice(0, -1);
  if (!/^https?:\/\//i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$|\?)/.test(s)) s = 'https://' + s;
    else return null;
  }
  try { return new URL(s); } catch { return null; }
}

function parseTime(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return +t;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

function parseYouTube(u) {
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null, vertical = false;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) { id = m[2]; vertical = m[1] === 'shorts'; }
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  return { id, vertical, start: parseTime(u.searchParams.get('t') || u.searchParams.get('start')) };
}

const LINK_BASE = { videoId: '', start: 0, vertical: false, spotifyId: '', spotifyKind: '', appleShow: '', appleEpisode: '', appleCountry: '' };

/** Turns pasted text into a canonical link with its type, or null. */
function parseLink(text) {
  const u = extractUrl(text);
  if (!u) return null;
  const yt = parseYouTube(u);
  if (yt) {
    const url = yt.vertical
      ? `https://www.youtube.com/shorts/${yt.id}`
      : `https://www.youtube.com/watch?v=${yt.id}${yt.start ? `&t=${yt.start}s` : ''}`;
    return { ...LINK_BASE, url, type: 'youtube', videoId: yt.id, start: yt.start, vertical: yt.vertical };
  }
  const sp = u.hostname === 'open.spotify.com' && u.pathname.match(/\/(episode|show)\/([A-Za-z0-9]{22})/);
  if (sp) return { ...LINK_BASE, url: `https://open.spotify.com/${sp[1]}/${sp[2]}`, type: 'spotify', spotifyKind: sp[1], spotifyId: sp[2] };
  if (u.hostname === 'podcasts.apple.com') {
    const show = u.pathname.match(/\/id(\d+)/)?.[1];
    const ep = u.searchParams.get('i') || '';
    const cc = u.pathname.match(/^\/([a-z]{2})\//)?.[1] || 'us';
    if (show && /^\d+$/.test(ep)) {
      return { ...LINK_BASE, url: `https://podcasts.apple.com/${cc}/podcast/id${show}?i=${ep}`, type: 'podcast', appleShow: show, appleEpisode: ep, appleCountry: cc };
    }
  }
  for (const k of [...u.searchParams.keys()]) {
    if (/^utm_|^(fbclid|gclid|mc_cid|mc_eid|igshid|si)$/i.test(k)) u.searchParams.delete(k);
  }
  return { ...LINK_BASE, url: u.href, type: 'web' };
}

/** If a link points at something you'd follow rather than save, say what it is. */
function sourceHint(text) {
  const u = extractUrl(text);
  if (!u) return '';
  const host = u.hostname.replace(/^(www|m)\./, '');
  const seg = u.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com') {
    if (u.pathname === '/playlist' && u.searchParams.get('list')) return 'a YouTube playlist';
    if (seg[0] && /^(@|channel$|c$|user$)/.test(seg[0])) return 'a YouTube channel';
  }
  if (host === 'podcasts.apple.com' && /\/id\d+/.test(u.pathname) && !u.searchParams.get('i')) return 'a podcast';
  if (host === 'open.spotify.com' && seg.includes('show')) return 'a podcast';
  if (host.endsWith('.substack.com') && !seg.length) return 'a newsletter';
  if (host === 'medium.com' && seg.length === 1 && seg[0].startsWith('@')) return 'a Medium blog';
  if (/(^|\/)(feed|rss|atom)(\.xml)?\/?$|\.(rss|xml)$/i.test(u.pathname)) return 'an RSS feed';
  return '';
}

const keyOf = (p) =>
  p.type === 'youtube' ? 'yt:' + p.videoId
    : p.type === 'spotify' ? 'sp:' + p.spotifyId
      : p.appleEpisode ? 'ap:' + p.appleEpisode
        : p.audioUrl ? 'au:' + p.audioUrl.split('?')[0]
          : (p.url || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

function fallbackTitle(it) {
  if (it.type === 'youtube') return it.vertical ? 'YouTube Short' : 'YouTube video';
  if (it.type === 'spotify') return it.spotifyKind === 'show' ? 'Spotify podcast' : 'Spotify episode';
  if (it.type === 'podcast') return 'Podcast episode';
  try {
    const u = new URL(it.url);
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_+]+/g, ' ').trim();
    return seg && !/^\d+$/.test(seg) ? seg[0].toUpperCase() + seg.slice(1) : domainOf(it.url);
  } catch { return it.url; }
}
const displayTitle = (it) => it.title || fallbackTitle(it);

/* --------------------------------------------------------------- the data */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const audioUrl = safeUrl(raw.audioUrl);
  let parsed = parseLink(String(raw.url || ''));
  // Podcast episodes from a feed: the link may be any web page, the audio file is what matters.
  if (raw.type === 'podcast' && audioUrl && (!parsed || parsed.type === 'web')) {
    parsed = { ...LINK_BASE, url: parsed?.url || audioUrl, type: 'podcast' };
  }
  if (!parsed) return null;
  return {
    id: str(raw.id, 64) || uid(),
    ...parsed,
    title: str(raw.title, 300),
    customTitle: !!raw.customTitle,
    author: str(raw.author, 120),
    description: str(raw.description, 600),
    image: safeUrl(raw.image),
    logo: safeUrl(raw.logo),
    topic: str(raw.topic, 40).trim(),
    note: str(raw.note, 5000),
    status: raw.status === 'learned' ? 'learned' : 'new',
    createdAt: Number(raw.createdAt) || Date.now(),
    publishedAt: Number(raw.publishedAt) || null,
    learnedAt: Number(raw.learnedAt) || null,
    audioUrl: parsed.type === 'podcast' ? audioUrl : '',
    duration: Math.max(0, Math.round(Number(raw.duration) || 0)),
    progress: Math.max(0, Math.round(Number(raw.progress) || 0)),
    sourceId: str(raw.sourceId, 64),
    // Podcast subtitles: the show's feed, the episode's transcript link, when we last looked, and a sync fix.
    feedUrl: parsed.type === 'podcast' ? safeUrl(raw.feedUrl) : '',
    transcriptUrl: parsed.type === 'podcast' ? safeUrl(raw.transcriptUrl) : '',
    transcriptType: ['vtt', 'srt', 'json', 'html', 'text'].includes(raw.transcriptType) ? raw.transcriptType : '',
    transcriptChecked: Number(raw.transcriptChecked) || 0,
    ccOffset: Math.max(-7200, Math.min(7200, Number(raw.ccOffset) || 0)),
    // YouTube: where the "Most replayed" part starts (0 = none), and when we looked it up.
    highlight: parsed.type === 'youtube' ? Math.max(0, Math.round(Number(raw.highlight) || 0)) : 0,
    highlightEnd: parsed.type === 'youtube' ? Math.max(0, Math.round(Number(raw.highlightEnd) || 0)) : 0,
    highlightChecked: parsed.type === 'youtube' ? Number(raw.highlightChecked) || 0 : 0,
    metaPending: !!raw.metaPending,
    metaTries: Number(raw.metaTries) || 0,
  };
}

const KINDS = { youtube: 'YouTube', podcast: 'Podcast', blog: 'Blog' };
function normalizeSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const feedUrl = safeUrl(raw.feedUrl);
  if (!feedUrl) return null;
  return {
    id: str(raw.id, 64) || uid(),
    feedUrl,
    kind: KINDS[raw.kind] ? raw.kind : 'blog',
    title: str(raw.title, 200) || domainOf(feedUrl),
    image: safeUrl(raw.image),
    link: safeUrl(raw.link) || feedUrl,
    topic: str(raw.topic, 40).trim(),
    createdAt: Number(raw.createdAt) || Date.now(),
    checkedAt: Number(raw.checkedAt) || 0,
    since: Number(raw.since) || 0, // newest publish date seen, so old posts in long feeds never count as new
    error: str(raw.error, 120),
    seen: Array.isArray(raw.seen) ? raw.seen.filter((k) => typeof k === 'string').slice(0, 400) : [],
  };
}

function normalizeDiscover(raw) {
  const empty = { builtAt: 0, round: 0, key: '', cards: [] };
  if (!raw || !Array.isArray(raw.cards)) return empty;
  const info = (f) => (f && typeof f === 'object'
    ? { kind: KINDS[f.kind] ? f.kind : 'blog', feedUrl: safeUrl(f.feedUrl), site: safeUrl(f.site), title: str(f.title, 200), image: safeUrl(f.image), link: safeUrl(f.link), sub: str(f.sub, 120) }
    : null);
  const cards = raw.cards.map((c) => {
    if (c?.type === 'sources') {
      const sources = (c.sources || []).map(info).filter((x) => x && (x.feedUrl || x.site)).slice(0, 8);
      return sources.length ? { id: str(c.id, 64) || uid(), type: 'sources', interest: str(c.interest, 40), sources } : null;
    }
    const item = normalizeItem(c?.item);
    return item ? { id: item.id, type: 'item', interest: str(c.interest, 40), item, follow: info(c.follow) } : null;
  }).filter(Boolean);
  return { builtAt: Number(raw.builtAt) || 0, round: Number(raw.round) || 0, key: str(raw.key, 500), cards };
}

const state = {
  items: load(STORE_KEY, []).map(normalizeItem).filter(Boolean),
  sources: load(SOURCES_KEY, []).map(normalizeSource).filter(Boolean),
  prefs: Object.assign({ view: 'queue', topic: '', shuffle: false, compact: false, captions: true, autoplay: true, highlights: true, rate: 1, railOpen: true, actionMessages: false, theme: 'auto', interests: [], dInterest: '' }, load(PREFS_KEY, {})),
  discover: normalizeDiscover(load(DISCOVER_KEY, null)),
  dseen: new Set(load(DSEEN_KEY, []).filter((k) => typeof k === 'string')),
  seed: Math.floor(Math.random() * 1e9),
};
if (!Array.isArray(state.prefs.interests)) state.prefs.interests = [];
state.prefs.interests = state.prefs.interests.filter((t) => typeof t === 'string').map((t) => t.slice(0, 40)).slice(0, 10);

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.items)); }
  catch { toast('Storage is full. Export a backup from the menu.'); }
}
const persistSources = () => { try { localStorage.setItem(SOURCES_KEY, JSON.stringify(state.sources)); } catch {} };
const persistPrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch {} };
const byId = (id) => state.items.find((i) => i.id === id);
const dcardById = (id) => state.discover.cards.find((c) => c.id === id);
const findItem = (id) => byId(id) || dcardById(id)?.item; // saved item, or a suggestion in Discover
const persistDiscover = () => {
  try {
    localStorage.setItem(DISCOVER_KEY, JSON.stringify(state.discover));
    localStorage.setItem(DSEEN_KEY, JSON.stringify([...state.dseen].slice(-3000)));
  } catch {}
};
const inView = (it, view = state.prefs.view) => (view === 'learned' ? it.status === 'learned' : it.status !== 'learned');
const learnedToday = () => state.items.filter((i) => i.learnedAt && i.learnedAt >= startOfToday()).length;
const matchTopic = (t) =>
  [...state.items, ...state.sources].find((i) => i.topic && i.topic.toLowerCase() === t.toLowerCase())?.topic || t[0].toUpperCase() + t.slice(1);

function visibleItems() {
  const { view, topic, shuffle } = state.prefs;
  const list = state.items.filter((i) => inView(i) && (!topic || i.topic === topic));
  if (view === 'learned') return list.sort((a, b) => (b.learnedAt || 0) - (a.learnedAt || 0));
  if (shuffle) return list.sort((a, b) => hash(a.id + state.seed) - hash(b.id + state.seed));
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

/* ---------------------------------------------------------------- metadata */
async function getJSON(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (json.error || json.status === 'fail') throw new Error(json.error || json.message || 'failed');
    return json;
  } finally { clearTimeout(timer); }
}

async function fetchMeta(it) {
  if (it.type === 'youtube') {
    const watch = encodeURIComponent(`https://www.youtube.com/watch?v=${it.videoId}`);
    const d = await getJSON(`https://www.youtube.com/oembed?format=json&url=${watch}`)
      .catch(() => getJSON(`https://noembed.com/embed?url=${watch}`));
    return { title: d.title, author: d.author_name };
  }
  if (it.type === 'spotify') {
    const d = await getJSON(`https://open.spotify.com/oembed?url=${encodeURIComponent(it.url)}`);
    return { title: d.title, image: d.thumbnail_url, author: 'Spotify' };
  }
  if (it.type === 'podcast') {
    if (!it.appleShow) return {}; // episodes from a feed already have everything
    const { show, episode: ep } = await appleEpisode(it.appleShow, it.appleEpisode, it.appleCountry);
    if (ep) {
      return {
        title: ep.trackName, author: ep.collectionName, image: ep.artworkUrl600 || show?.artworkUrl600,
        audioUrl: ep.episodeUrl, duration: Math.round((ep.trackTimeMillis || 0) / 1000), description: ep.shortDescription || ep.description,
        feedUrl: show?.feedUrl,
      };
    }
    if (!show) throw new Error('not found');
    return { author: show.collectionName, image: show.artworkUrl600 }; // older episode: plays through Apple's embed
  }
  try {
    const { data: d = {} } = await getJSON(`https://api.microlink.io/?url=${encodeURIComponent(it.url)}`);
    const bigEnough = d.image && (!d.image.width || d.image.width >= 300); // skip tiny inline images
    return { title: d.title, author: d.publisher || d.author, description: d.description, image: bigEnough ? d.image.url : '', logo: d.logo?.url };
  } catch {
    // Fallback when microlink's free daily limit is hit: Jina Reader gives at least the title.
    const { data: d = {} } = await getJSON(`https://r.jina.ai/${it.url}`, { headers: { Accept: 'application/json' } });
    return { title: d.title, description: d.description };
  }
}

async function enrich(it) {
  if (!navigator.onLine) return;
  it.metaTries = (it.metaTries || 0) + 1;
  try {
    const m = await fetchMeta(it);
    if (!byId(it.id)) return; // deleted meanwhile
    if (!it.customTitle && m.title) it.title = String(m.title).slice(0, 300);
    if (m.author) it.author = String(m.author).slice(0, 120);
    if (m.description && !it.description) it.description = String(m.description).replace(/\s+/g, ' ').slice(0, 600);
    if (m.image) it.image = safeUrl(m.image);
    if (m.logo) it.logo = safeUrl(m.logo);
    if (m.audioUrl && it.type === 'podcast') it.audioUrl = safeUrl(m.audioUrl);
    if (m.feedUrl && it.type === 'podcast') it.feedUrl = safeUrl(m.feedUrl);
    if (m.duration) it.duration = m.duration;
    it.metaPending = false;
  } catch {
    if (it.metaTries >= 3) it.metaPending = false; // give up quietly, fallback title stays
  }
  persist();
  updateCardEl(it);
}

function retryPendingMeta() {
  state.items.filter((i) => i.metaPending).slice(0, 8).forEach((i, n) => setTimeout(() => enrich(i), n * 400));
}

/* --------------------------------------------------------------- rendering */
const feed = $('#feed');
const topicsEl = $('#topics');

const isAudioType = (it) => it.type === 'podcast' || it.type === 'spotify';
const mediaClass = (it) => 'media' + (it.vertical ? ' vertical' : '') + (isAudioType(it) ? ' square' : '');
const artHTML = (it) => (it.image
  ? `<img class="thumb" src="${esc(it.image)}" alt="" loading="lazy" decoding="async" data-hide-on-error>`
  : `<span class="art-fallback">${icon('mic')}</span>`);

// Button on each card's source line: switches all cards between big pictures and compact (small thumbnail,
// more text). It sits outside the picture so a playing video or episode never covers it.
const sizeBtnHTML = () => `<button type="button" class="size-toggle" data-act="compact" aria-label="Compact cards" aria-pressed="${!!state.prefs.compact}">${icon('shrink')}${icon('expand')}</button>`;
const mediaHTML = (it) => mediaBodyHTML(it);

function mediaBodyHTML(it) {
  const title = esc(displayTitle(it));
  if (it.type === 'youtube') {
    const base = `https://i.ytimg.com/vi/${it.videoId}`;
    return `<button type="button" data-act="play" aria-label="Play: ${title}">
        <img class="thumb" src="${base}/maxresdefault.jpg" data-fallback="${base}/hqdefault.jpg" alt="" loading="lazy" decoding="async">
        <span class="play">${icon('play')}</span>
      </button>`;
  }
  if (isAudioType(it)) {
    return `<button type="button" data-act="play" aria-label="Play: ${title}">
        ${artHTML(it)}
        <span class="play">${icon('play')}</span>
      </button>`;
  }
  if (it.image) {
    return `<a href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="Open: ${title}">
        <img class="thumb" src="${esc(it.image)}" data-fallback-tile alt="" loading="lazy" decoding="async">
      </a>`;
  }
  return tileHTML(it);
}

function tileHTML(it) {
  return `<a class="tile" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="Open: ${esc(displayTitle(it))}">
      <img src="${esc(faviconOf(it))}" alt="" loading="lazy" data-hide-on-error>
      <span>${esc(domainOf(it.url))}</span>
    </a>`;
}

// Under every picture: what it is and how long (live time while a video plays), the most replayed
// part, and the big/compact toggle at the right end.
const hlChipHTML = (it) => (it.type === 'youtube' && state.prefs.highlights && it.highlight > 0
  ? `<button type="button" class="ms-hl" data-act="to-highlight" aria-label="Jump to the most replayed part, at ${fmtTime(it.highlight)}">${icon('star')}${fmtTime(it.highlight)}</button>`
  : '');
function stripText(it) {
  if (it.type === 'youtube') {
    return [it.vertical ? 'Short' : 'YouTube', it.progress > 30 ? `${fmtTime(it.progress)} in` : it.start ? `from ${fmtTime(it.start)}` : '', it.duration && fmtTime(it.duration)].filter(Boolean).join(' · ');
  }
  if (it.type === 'spotify') return 'Spotify';
  if (it.type === 'podcast') return ['Podcast', it.duration && fmtDuration(it.duration), it.progress > 30 && `${fmtTime(it.progress)} in`].filter(Boolean).join(' · ');
  return 'Article';
}
function stripHTML(it) {
  return `<div class="media-strip">
      ${it.type === 'youtube' ? '<input type="range" class="ms-seek" min="0" max="1000" step="1" value="0" aria-label="Position in video" hidden>' : ''}
      <div class="ms-row"><span class="ms-text">${esc(stripText(it))}</span>${hlChipHTML(it)}${sizeBtnHTML()}</div>
    </div>`;
}
function renderStrip(card, it) {
  const strip = card.querySelector('.stack > .media-strip');
  if (strip) strip.outerHTML = stripHTML(it);
}

// The action rail: icon buttons down the right side; ⋯ at the bottom folds them away.
const railHTML = (items) => `<div class="rail" role="toolbar" aria-label="Actions" aria-orientation="vertical">
    <div class="rail-items">${items}</div>
    <button type="button" class="rail-btn rail-toggle" data-act="rail" aria-expanded="${!!state.prefs.railOpen}" aria-label="${state.prefs.railOpen ? 'Hide actions' : 'Show actions'}" title="${state.prefs.railOpen ? 'Hide actions' : 'Show actions'}">${icon('more')}</button>
  </div>`;

function toggleRail() {
  state.prefs.railOpen = !state.prefs.railOpen;
  persistPrefs();
  feed.classList.toggle('rail-closed', !state.prefs.railOpen);
  const label = state.prefs.railOpen ? 'Hide actions' : 'Show actions';
  feed.querySelectorAll('.rail-toggle').forEach((b) => { b.setAttribute('aria-expanded', String(state.prefs.railOpen)); b.setAttribute('aria-label', label); b.title = label; });
}

function bodyHTML(it, dcard) {
  const learned = it.status === 'learned';
  const when = dcard ? (it.publishedAt ? ago(it.publishedAt) : '')
    : learned ? `Learned ${ago(it.learnedAt || it.createdAt)}` : ago(it.publishedAt || it.createdAt);
  const topic = dcard ? dcard.interest : it.topic;
  return `<div class="meta">
      <img class="fav" src="${esc(faviconOf(it))}" alt="" loading="lazy" data-hide-on-error>
      <span class="source">${esc(it.author || domainOf(it.url))}</span>
      ${when ? `<span class="when">· ${esc(when)}</span>` : ''}
      ${topic ? `<button type="button" class="chip" data-act="topic" data-topic="${esc(topic)}">#${esc(topic)}</button>` : ''}
    </div>
    <h2 class="title">${esc(displayTitle(it))}</h2>
    ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
    ${it.note ? `<button type="button" class="takeaway" data-act="note"><span class="label">${icon('bulb')}Takeaway</span><p>${esc(it.note)}</p></button>` : ''}
    ${isWatch(it) ? '' : `<a class="read-btn" href="${esc(it.url)}" target="_blank" rel="noopener">${{ spotify: 'Open in Spotify', podcast: 'Open the episode' }[it.type] || 'Read the article'}${icon('external')}</a>`}`;
}

function actionsHTML(it) {
  const learned = it.status === 'learned';
  const open = { youtube: 'Open in YouTube', spotify: 'Open in Spotify', podcast: 'Open the episode page' }[it.type] || 'Read the article';
  const got = learned ? 'Learned. Tap to move it back to Up next' : 'Got it: mark as learned';
  return `<button type="button" class="rail-btn primary${learned ? ' on' : ''}" data-act="learned" aria-pressed="${learned}" aria-label="${got}" title="${learned ? 'Learned' : 'Got it'}">${icon('check')}</button>
    <button type="button" class="rail-btn${it.note ? ' has-note' : ''}" data-act="note" aria-label="${it.note ? 'Edit your note' : 'Write a note'}" title="Note">${icon('pen')}</button>
    <a class="rail-btn" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="${open}" title="${open}">${icon(it.type === 'youtube' ? 'yt' : 'external')}</a>`;
}

// Sideways, a card the app plays (a video, an episode) is all picture and controls; any other is read.
const isWatch = (it) => it.type === 'youtube' || (it.type === 'podcast' && !!it.audioUrl);

function cardHTML(it, dcard) {
  return `<article class="card ${isWatch(it) ? 'watch' : 'read'}" data-id="${esc(it.id)}" data-type="${esc(it.type)}" style="--hue:${hueOf(it)}">
    <div class="card-inner">
      <div class="content"><div class="stack">
        <div class="${mediaClass(it)}">${mediaHTML(it)}</div>
        ${stripHTML(it)}
        <div class="body">${bodyHTML(it, dcard)}</div>
      </div></div>
      ${railHTML(dcard ? discoverActionsHTML(dcard) : actionsHTML(it))}
    </div>
  </article>`;
}

const emptyBtn = (act, label, primary) => `<button class="btn ${primary ? 'primary' : 'ghost'}" data-act="${act}">${label}</button>`;
function emptyHTML() {
  const { view, topic } = state.prefs;
  const block = (art, title, text, buttons, extra = '', after = '') =>
    `<div class="empty"><div class="art">${icon(art)}</div><h2>${title}</h2><p>${text}</p>${extra}<div class="row">${buttons.join('')}</div>${after}</div>`;

  if (topic) {
    return block('stack', `Nothing in ${esc(topic)}`, 'Pick another topic, or save something new.',
      [emptyBtn('clear-topic', 'Show all'), emptyBtn('add', 'Save a link', true)]);
  }
  if (view === 'learned') {
    return block('cap', 'Nothing learned yet',
      'When you finish a video or article, tap <b>Got it</b>. It moves here with your takeaway so you can review it later.',
      [emptyBtn('view-queue', 'Go to Up next', true)]);
  }
  if (!state.items.length) {
    const install = isIOS && !isStandalone() ? `<button class="linkish" data-act="install">Tip: add it to your Home Screen first</button>` : '';
    return block('stack', 'Your learning feed', 'Save videos, podcasts and articles, or follow channels and newsletters. Then scroll through them one at a time.',
      [emptyBtn('add', 'Save a link', true), emptyBtn('follow', 'Follow a source')],
      `<ol class="steps"><li>Copy a link from YouTube, Spotify, Safari or anywhere</li><li>Tap <b>+</b>, then <b>Paste</b></li><li>Watch, listen or read, write a takeaway, tap <b>Got it</b></li></ol>`,
      `<button class="linkish" data-act="view-discover">Or let Discover find things for you</button>${install}`);
  }
  const total = state.items.filter((i) => i.status === 'learned').length;
  const today = learnedToday();
  return block('check', 'All caught up',
    `You've learned ${total} thing${total === 1 ? '' : 's'}${today ? `, ${today} today` : ''}. Save more, or review what you learned.`,
    [emptyBtn('view-learned', 'Review learned'), emptyBtn('view-discover', 'Discover more', true)],
    '', state.sources.length ? `<button class="linkish" data-act="sync">Check my sources for new posts</button>` : '');
}

function renderTopics() {
  if (state.prefs.view === 'discover') {
    const sel = state.prefs.dInterest;
    topicsEl.innerHTML = state.prefs.interests.length
      ? `<button class="chip" data-topic="" aria-pressed="${!sel}">For you</button>` +
        state.prefs.interests.map((t) => `<button class="chip" data-topic="${esc(t)}" aria-pressed="${sel === t}">${esc(t)}</button>`).join('') +
        `<button class="chip edit" data-top-act="interests">${icon('pen')}Edit</button>`
      : '<span class="view-title">Discover</span>';
    return;
  }
  const pool = state.items.filter((i) => inView(i));
  const counts = new Map();
  for (const i of pool) if (i.topic) counts.set(i.topic, (counts.get(i.topic) || 0) + 1);
  const topics = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const sel = state.prefs.topic;
  if (sel && !counts.has(sel)) topics.unshift(sel);
  if (!topics.length) {
    topicsEl.innerHTML = `<span class="view-title">${state.prefs.view === 'learned' ? 'Learned' : 'Up next'}</span>`;
    return;
  }
  topicsEl.innerHTML =
    `<button class="chip" data-topic="" aria-pressed="${!sel}">All<span class="n">${pool.length}</span></button>` +
    topics.map((t) => `<button class="chip" data-topic="${esc(t)}" aria-pressed="${sel === t}">${esc(t)}<span class="n">${counts.get(t) || 0}</span></button>`).join('');
}

function updateChrome() {
  const learned = state.items.filter((i) => i.status === 'learned').length;
  $('#countQueue').textContent = state.items.length - learned;
  $('#countLearned').textContent = learned;
  document.querySelectorAll('.tab[data-view]').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.view === state.prefs.view)));
  feed.classList.toggle('compact', !!state.prefs.compact);
  feed.classList.toggle('rail-closed', !state.prefs.railOpen);
  $('#discoverRefresh').hidden = state.prefs.view !== 'discover' || !state.prefs.interests.length;
  const shuffleBtn = $('#shuffleBtn');
  shuffleBtn.hidden = state.prefs.view !== 'queue';
  shuffleBtn.setAttribute('aria-pressed', String(!!state.prefs.shuffle));
  renderTopics();
}

const io = new IntersectionObserver((entries) => {
  if (layoutShift) return; // the page is being resized (e.g. back from fullscreen): cards only seem to move
  for (const e of entries) {
    if (e.intersectionRatio < 0.35) { stopMedia(e.target); delete e.target.dataset.autoTried; }
    // Start the next card while it's still sliding in, so it plays as soon as it lands.
    else if (e.intersectionRatio >= 0.6) activate(e.target);
  }
}, { root: feed, threshold: [0, 0.35, 0.6] });

// A card's text scrolls on its own when it doesn't fit. Fade the edge where more text is hidden.
function updateFade(content) {
  if (!content) return;
  const max = content.scrollHeight - content.clientHeight;
  content.classList.toggle('fade-b', max > 2 && content.scrollTop < max - 2);
  content.classList.toggle('fade-t', max > 2 && content.scrollTop > 2);
}
const fadeRO = new ResizeObserver((entries) => { for (const e of entries) updateFade(e.target.closest('.content')); });
feed.addEventListener('scroll', (e) => { if (e.target.classList?.contains('content')) updateFade(e.target); }, { capture: true, passive: true });

function render({ keepScroll = false } = {}) {
  const top = feed.scrollTop;
  feed.querySelectorAll('.card').forEach(stopMedia); // save podcast positions before the DOM goes away
  io.disconnect();
  fadeRO.disconnect();
  updateChrome();
  // Replace the cards but keep the shared YouTube player (the last child): moving or recreating
  // it would reload it and lose its permission to play sound.
  let html;
  if (state.prefs.view === 'discover') html = discoverHTML();
  else {
    const list = visibleItems();
    html = list.length ? list.map((it) => cardHTML(it)).join('') : emptyHTML();
  }
  [...feed.children].forEach((el) => { if (el !== ytHost) el.remove(); });
  feed.insertAdjacentHTML('afterbegin', html);
  feed.querySelectorAll('.card').forEach((c) => io.observe(c));
  feed.querySelectorAll('.content, .stack').forEach((el) => fadeRO.observe(el));
  feed.scrollTop = keepScroll ? top : 0;
  scheduleSettle();
}

const cardEl = (id) => feed.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
const currentIndex = () => Math.round(feed.scrollTop / Math.max(1, feed.clientHeight));

function updateCardEl(it) {
  const card = cardEl(it.id);
  if (!card) return;
  card.querySelector('.body').innerHTML = bodyHTML(it);
  card.querySelector('.rail-items').innerHTML = actionsHTML(it);
  const media = card.querySelector('.media');
  if (!media.dataset.playing) {
    media.className = mediaClass(it);
    media.innerHTML = mediaHTML(it);
    renderStrip(card, it);
  }
}

function removeCardEl(card) {
  if (!card) return;
  stopMedia(card);
  card.classList.add('leaving');
  setTimeout(() => {
    io.unobserve(card);
    card.remove();
    updateChrome();
    if (!feed.querySelector('.card')) render();
  }, 280);
}

function jumpTo(id) {
  const el = cardEl(id);
  if (el) feed.scrollTop = el.offsetTop;
}

/* ------------------------------------------------------------ media play */
// Where to start: where you left off, the time in the link, or the most replayed part.
function startOf(it) {
  if (it.progress > 30 && (!it.duration || it.progress < it.duration - 30)) return { at: it.progress, why: 'resume' };
  if (it.start) return { at: it.start, why: 'link' };
  if (it.type === 'youtube' && state.prefs.highlights && it.highlight > 0) return { at: it.highlight, why: 'highlight' };
  return { at: 0, why: '' };
}

function play(card, it, { auto = false, from = null } = {}) {
  const media = card.querySelector('.media');
  if (!media || media.dataset.playing) return;
  const title = esc(displayTitle(it));
  if (it.type === 'youtube') {
    playYouTube(media, it, auto, from); // the shared player sits on top of the picture
  } else if (it.type === 'podcast' && it.audioUrl) {
    playAudio(media, it, auto);
  } else if (auto) {
    return; // Spotify and older Apple episodes play in their own embeds, which only start from a tap
  } else if (it.type === 'spotify') {
    media.classList.add('embed');
    media.innerHTML = `<iframe src="https://open.spotify.com/embed/${it.spotifyKind}/${it.spotifyId}" title="${title}"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
  } else if (it.type === 'podcast' && it.appleShow) {
    media.classList.add('embed', 'apple');
    media.innerHTML = `<iframe src="https://embed.podcasts.apple.com/${it.appleCountry}/podcast/id${it.appleShow}?i=${it.appleEpisode}&theme=${isDark() ? 'dark' : 'light'}" title="${title}"
        allow="autoplay *; encrypted-media *; clipboard-write"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"></iframe>`;
  } else {
    return;
  }
  media.dataset.playing = '1';
  card.classList.add('playing'); // full-size player, even in compact mode
  card.querySelector('.content').scrollTop = 0;
}

// At the end of a video or episode, ask for the takeaway (with "Save & mark learned").
function finished(it) {
  if (!byId(it.id) || it.status === 'learned' || document.querySelector('dialog[open]')) return;
  openNote(it, 'Finished. What will you remember?');
}

/* YouTube goes through its IFrame API: it tells us where you are (to resume later) and when a video ends.
   iOS only lets a video start with sound after a tap *inside* the player, and a player that has played
   once keeps that permission. So the whole feed shares one player, laid over the card you're on:
   tap play in it once, and later videos start with sound on their own. */
let ytApi = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytApi ||= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; s.remove(); reject(new Error('YouTube API unavailable')); };
    document.head.append(s);
  });
  return ytApi;
}
// It lives inside the feed, so it scrolls along and swiping on it still moves between cards.
const ytHost = document.createElement('div');
ytHost.className = 'yt-host';
ytHost.hidden = true;
feed.append(ytHost);
let yt = null;    // { player, ready: Promise<player> }
let ytNow = null; // the card it's showing: { it, media, timer }

function youtubePlayer() {
  if (yt) return yt.ready;
  const slot = document.createElement('div');
  ytHost.append(slot);
  yt = {};
  yt.ready = new Promise((resolve) => {
    yt.player = new window.YT.Player(slot, {
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: { onReady: () => resolve(yt.player), onStateChange: onYouTubeState, onError: (e) => debug(`youtube error ${e.data}`) },
    });
  });
  return yt.ready;
}

// Keep the player exactly over the card's picture, also when the card's text scrolls or the layout changes.
function placeYouTube() {
  if (!ytNow) return;
  const r = ytNow.media.getBoundingClientRect();
  const f = feed.getBoundingClientRect();
  Object.assign(ytHost.style, {
    borderRadius: getComputedStyle(ytNow.media).borderRadius, // edge to edge in big mode, rounded when compact
    width: `${r.width}px`,
    height: `${r.height}px`,
    transform: `translate(${r.left - f.left}px, ${r.top - f.top + feed.scrollTop}px)`,
  });
  // A new size (the phone turned): tell the player, or iOS can leave the video offset in its old frame
  const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
  if (r.width && size !== ytNow.size && yt?.player?.setSize) {
    ytNow.size = size;
    try { yt.player.setSize(Math.round(r.width), Math.round(r.height)); } catch { /* not ready yet */ }
  }
}
let placeQueued = false;
const queuePlace = () => {
  if (placeQueued || !ytNow) return;
  placeQueued = true;
  requestAnimationFrame(() => { placeQueued = false; placeYouTube(); });
};
feed.addEventListener('scroll', queuePlace, { capture: true, passive: true });
addEventListener('resize', queuePlace);
const ytRO = new ResizeObserver(queuePlace);

function playYouTube(media, it, auto, forcedFrom = null) {
  if (!window.YT?.Player) { // API not loaded (offline or blocked): a plain embed still plays
    const from = startOf(it);
    const params = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', modestbranding: '1' });
    if (from.at) params.set('start', String(Math.floor(from.at)));
    media.innerHTML = `<iframe src="https://www.youtube.com/embed/${it.videoId}?${params}" title="${esc(displayTitle(it))}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    loadYouTubeApi().catch(() => {});
    return;
  }
  if (ytNow) stopYouTube(ytNow.media);
  const now = ytNow = { it, media, timer: 0 };
  ytRO.observe(media);
  ytHost.hidden = false;
  placeYouTube();
  showYouTubeControls(media, it);
  youtubePlayer().then((p) => {
    if (ytNow !== now) return;
    const from = forcedFrom != null ? { at: forcedFrom, why: 'highlight' } : startOf(it); // decided now: the highlight may have arrived while the player was loading
    debug(`youtube ${it.videoId} ${auto ? 'auto' : 'tap'} from ${Math.floor(from.at)}s ${from.why}`);
    p.unMute(); // an older version could leave the player muted, and YouTube remembers that
    p.loadVideoById({ videoId: it.videoId, startSeconds: Math.floor(from.at) });
    clearInterval(now.tick);
    now.tick = setInterval(updateYouTubeStrip, 500); // live time and seek bar under the video
    // If it hasn't started after a moment, iOS is waiting for a tap on the player's own play button.
    setTimeout(() => {
      if (ytNow !== now) return;
      const s = p.getPlayerState?.();
      debug(`youtube state after 3s: ${s}`);
      if (s !== window.YT.PlayerState.PLAYING && s !== window.YT.PlayerState.BUFFERING && !ytHint) {
        ytHint = true;
        // It may also just be showing an ad first (the API can't tell), so this stays a gentle hint.
        toast("Video not starting? Tap play on it once. After that, videos start with sound as you scroll");
      }
    }, 3000);
    if (from.why === 'highlight') highlightToast(from.at);
    else if (needsHighlight(it)) {
      // The highlight is still being looked up: jump there when it arrives, if the video has only just begun.
      highlightFor(it).then(() => {
        if (ytNow !== now || !(it.highlight > 0) || !state.prefs.highlights) return;
        if ((p.getCurrentTime?.() || 0) > 15) return;
        // A seek right after loading a video can be overridden by its start, so wait until it's playing.
        if (p.getPlayerState?.() === window.YT.PlayerState.PLAYING) { p.seekTo(it.highlight, true); highlightToast(it.highlight); }
        else now.pendingSeek = it.highlight;
      });
    }
  });
}
let ytHint = false;

function onYouTubeState(e) {
  const now = ytNow;
  debug(`youtube state ${e.data}`);
  if (!now) return;
  const S = window.YT.PlayerState;
  clearInterval(now.timer);
  if (e.data === S.PLAYING) {
    now.timer = setInterval(saveYouTube, 5000);
    if (now.pendingSeek) { // the highlight arrived while the video was loading
      if ((yt.player.getCurrentTime?.() || 0) <= 15) { yt.player.seekTo(now.pendingSeek, true); highlightToast(now.pendingSeek); }
      now.pendingSeek = 0;
    }
    if (yt.player.getPlaybackRate?.() !== rate()) yt.player.setPlaybackRate?.(rate());
  }
  updateYouTubeStrip();
  if (e.data === S.PAUSED) saveYouTube();
  if (e.data === S.ENDED) { now.it.progress = 0; saveItem(now.it); finished(now.it); }
}

function saveYouTube() {
  const now = ytNow;
  const p = yt?.player;
  if (!now || p?.getVideoData?.().video_id !== now.it.videoId) return;
  const t = p.getCurrentTime?.();
  if (!(t > 0)) return;
  now.it.progress = Math.floor(t);
  if (!now.it.duration) now.it.duration = Math.round(p.getDuration?.() || 0);
  saveItem(now.it);
}

// While a video plays, the strip under it gets the same controls as the podcast bar: a seek bar
// (the most replayed part marked), elapsed / remaining time, speed, back 15 s, play/pause, forward 30 s.
const youtubeControlsHTML = (it) => `<input type="range" class="ms-seek" min="0" max="1000" step="1" value="0" aria-label="Position in video">
    <div class="ab-times"><span class="ab-time ms-now">0:00</span>${hlChipHTML(it)}<span class="ab-time ms-left">${it.duration ? `-${fmtTime(it.duration)}` : '--:--'}</span></div>
    <div class="ab-row">
      <button type="button" class="ab-rate" data-act="yt-rate" aria-label="Playback speed">${rate()}×</button>
      <button type="button" class="ab-btn" data-act="yt-back" aria-label="Back 15 seconds">${icon('back15')}</button>
      <button type="button" class="ab-btn ab-play paused" data-act="yt-toggle" aria-label="Play">${icon('pause')}${icon('play')}</button>
      <button type="button" class="ab-btn" data-act="yt-fwd" aria-label="Forward 30 seconds">${icon('fwd30')}</button>
      ${sizeBtnHTML()}
    </div>`;

function showYouTubeControls(media, it) {
  const strip = media.parentElement.querySelector(':scope > .media-strip');
  if (!strip) return;
  strip.classList.add('controls');
  strip.innerHTML = youtubeControlsHTML(it);
}

function updateYouTubeStrip() {
  const now = ytNow;
  const p = yt?.player;
  const strip = now?.media.parentElement.querySelector(':scope > .media-strip.controls');
  if (!strip || !p?.getCurrentTime || p.getVideoData?.().video_id !== now.it.videoId) return;
  const it = now.it;
  const dur = p.getDuration?.() || it.duration || 0;
  const t = now.dragging ? now.dragTo : p.getCurrentTime() || 0;
  const seek = strip.querySelector('.ms-seek');
  seek.disabled = !dur;
  if (!now.dragging) seek.value = String(dur ? Math.round((t / dur) * 1000) : 0);
  seek.style.setProperty('--fill', `${dur ? (t / dur) * 100 : 0}%`);
  if (dur && it.highlight > 0 && state.prefs.highlights) {
    const end = it.highlightEnd > it.highlight ? it.highlightEnd : it.highlight + 45;
    seek.style.setProperty('--hs', `${(it.highlight / dur) * 100}%`);
    seek.style.setProperty('--he', `${Math.min(100, (end / dur) * 100)}%`);
  }
  strip.querySelector('.ms-now').textContent = fmtTime(Math.floor(t));
  strip.querySelector('.ms-left').textContent = dur ? `-${fmtTime(Math.max(0, Math.round(dur - t)))}` : '--:--';
  const s = p.getPlayerState?.();
  const playing = s === window.YT?.PlayerState.PLAYING || s === window.YT?.PlayerState.BUFFERING;
  const btn = strip.querySelector('.ab-play');
  btn.classList.toggle('paused', !playing);
  btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  strip.querySelector('.ab-rate').textContent = `${rate()}×`;
}

function youtubeAction(act) {
  const p = yt?.player;
  if (!ytNow || !p?.getCurrentTime) return;
  const t = p.getCurrentTime() || 0;
  if (act === 'yt-toggle') {
    const s = p.getPlayerState?.();
    if (s === window.YT.PlayerState.PLAYING || s === window.YT.PlayerState.BUFFERING) p.pauseVideo();
    else p.playVideo();
  }
  if (act === 'yt-back') p.seekTo(Math.max(0, t - 15), true);
  if (act === 'yt-fwd') p.seekTo(Math.min(p.getDuration?.() || Infinity, t + 30), true);
  if (act === 'yt-rate') {
    state.prefs.rate = RATES[(RATES.indexOf(rate()) + 1) % RATES.length];
    persistPrefs();
    p.setPlaybackRate?.(state.prefs.rate);
  }
  setTimeout(updateYouTubeStrip, 150);
}

function jumpToHighlight(card, it) {
  if (!(it.highlight > 0)) return;
  const media = card.querySelector('.media');
  if (ytNow?.media === media) {
    yt?.player?.seekTo?.(it.highlight, true);
    highlightToast(it.highlight);
  } else {
    play(card, it, { from: it.highlight });
  }
}

function highlightToast(at) {
  confirmToast(`Starting at the most replayed part (${fmtTime(at)})`, { action: 'From start', onAction: () => yt?.player?.seekTo?.(0, true) });
}

function stopYouTube(media) {
  if (ytNow?.media !== media) return;
  clearInterval(ytNow.timer);
  clearInterval(ytNow.tick);
  try { saveYouTube(); yt?.player?.pauseVideo?.(); } catch { /* player not ready yet */ }
  ytRO.unobserve(media);
  ytHost.hidden = true;
  ytNow = null;
}

/* Debug log, for checking playback on a phone: open the app with ?debug=1 (stays on for that tab). */
const debugOn = (() => {
  try {
    if (new URLSearchParams(location.search).has('debug')) sessionStorage.setItem('lim.debug', '1');
    return sessionStorage.getItem('lim.debug') === '1';
  } catch { return false; }
})();
const debugEl = debugOn ? Object.assign(document.createElement('pre'), { className: 'debug-log' }) : null;
if (debugEl) document.body.append(debugEl);
function debug(msg) {
  if (!debugEl) return;
  const line = `${new Date().toTimeString().slice(0, 8)} ${msg}`;
  debugEl.textContent = [line, ...debugEl.textContent.split('\n')].slice(0, 14).join('\n');
}

/* Autoplay: when scrolling stops on a card, start its video or episode. */
let settleTimer = 0;
function scheduleSettle() { clearTimeout(settleTimer); settleTimer = setTimeout(onSettle, 220); }
feed.addEventListener('scroll', scheduleSettle, { passive: true });
const activeCard = () => { const el = feed.children[currentIndex()]; return el?.classList.contains('card') ? el : null; };

function onSettle() {
  if (layoutShift) return;
  const card = activeCard();
  if (card) { currentId = card.dataset.id; activate(card); }
}

/* YouTube's fullscreen button on iPhone opens iOS's own player, often in landscape, so leaving it
   resizes the page twice. Meanwhile the feed's position slips and cards seem to leave the screen.
   So while the size changes, nothing is stopped or started; afterwards the feed goes back to the
   card you were on and the player back over its picture. */
let layoutShift = 0; // timer while the page is being resized
let currentId = null; // the card on screen, kept up to date as you scroll
let feedSize = '';
function onLayoutShift() {
  const size = `${feed.clientWidth}x${feed.clientHeight}`;
  if (size === feedSize && !layoutShift) return; // nothing really moved
  debug(`resize ${feedSize} → ${size}, page scrolled ${Math.round(scrollY)}, feed at ${(feed.scrollTop / Math.max(1, feed.clientHeight)).toFixed(2)}`);
  feedSize = size;
  clearTimeout(layoutShift);
  layoutShift = setTimeout(() => {
    layoutShift = 0;
    window.scrollTo(0, 0); // iOS can leave the page itself scrolled after fullscreen
    const card = currentId && cardEl(currentId);
    if (card) feed.scrollTop = card.offsetTop;
    placeYouTube();
    debug(`resize done: back on ${card ? displayTitle(findItem(currentId) || {}).slice(0, 24) || 'card' : 'no card'}`);
  }, 400);
}
addEventListener('resize', onLayoutShift);
addEventListener('orientationchange', onLayoutShift);
requestAnimationFrame(() => { feedSize = `${feed.clientWidth}x${feed.clientHeight}`; });

function activate(card) {
  if (layoutShift) return;
  currentId = card.dataset.id;
  prefetchHighlights(card);
  if (!state.prefs.autoplay || state.prefs.view === 'learned' || document.hidden || document.querySelector('dialog[open]')) return;
  const it = findItem(card.dataset.id);
  const media = card.querySelector('.media');
  if (!it || !media || media.dataset.playing || card.dataset.autoTried) return;
  if (it.type !== 'youtube' && !(it.type === 'podcast' && it.audioUrl)) return;
  if (it.type === 'youtube' && !window.YT?.Player) {
    // Wait for the YouTube API instead of falling back to a plain embed: only the shared player
    // keeps iOS's permission to play sound from one video to the next.
    loadYouTubeApi().then(() => { if (activeCard() === card) activate(card); }, () => {});
    return;
  }
  card.dataset.autoTried = '1'; // once per visit, so a video you stopped doesn't restart
  debug(`autoplay ${it.type} ${displayTitle(it).slice(0, 30)}`);
  // No waiting for the highlight: if it isn't known yet, the video jumps there when it arrives.
  play(card, it, { auto: true });
}

/* Highlights: the "Most replayed" part of a YouTube video, looked up once per video. */
const highlightJobs = new Map(); // videoId → Promise
const needsHighlight = (it) => state.prefs.highlights && it.type === 'youtube' && !it.vertical && !it.highlightChecked && !it.start && !(it.progress > 30);
function highlightFor(it) {
  if (!needsHighlight(it) || !navigator.onLine) return Promise.resolve();
  if (!highlightJobs.has(it.videoId)) {
    highlightJobs.set(it.videoId, youtubeHighlight(it.videoId).then(({ start, end, duration }) => {
      it.highlight = start;
      it.highlightEnd = end || 0;
      it.highlightChecked = Date.now();
      if (!it.duration && duration) it.duration = duration;
      saveItem(it);
      const card = cardEl(it.id);
      const media = card?.querySelector('.media');
      if (media && !media.dataset.playing) renderStrip(card, it); // show the ★ chip
      else if (media) { // playing: add the chip without touching the live controls
        const strip = card.querySelector('.stack > .media-strip');
        const anchor = strip?.querySelector('.ms-left') || strip?.querySelector('.ms-row .size-toggle');
        if (anchor && !strip.querySelector('.ms-hl')) anchor.insertAdjacentHTML('beforebegin', hlChipHTML(it));
      }
    }).catch(() => { /* try again another time */ }).finally(() => highlightJobs.delete(it.videoId)));
  }
  return highlightJobs.get(it.videoId);
}
// The card you're on and the two after it, so the next videos can start at their highlight right away.
function prefetchHighlights(card) {
  for (const c of [card, card.nextElementSibling, card.nextElementSibling?.nextElementSibling]) {
    const it = c?.dataset.id && findItem(c.dataset.id);
    if (it) highlightFor(it);
  }
}

function toggleCompact() {
  state.prefs.compact = !state.prefs.compact;
  persistPrefs();
  feed.classList.toggle('compact', state.prefs.compact);
  feed.querySelectorAll('.size-toggle').forEach((b) => b.setAttribute('aria-pressed', String(state.prefs.compact)));
  confirmToast(state.prefs.compact ? 'Small pictures, more room for text' : 'Big pictures');
}

/* ------------------------------------------------------- podcast subtitles */
// The episode playing now with its transcript: { media, audio, it, data: { timed, lines }, offset, idx }.
let cc = null;
const trSheet = $('#transcriptSheet');
const trList = $('#trList');
const DAY = 86400000;
const saveItem = (it) => (byId(it.id) ? persist() : persistDiscover());

async function feedUrlOf(it) {
  if (it.feedUrl) return it.feedUrl;
  const src = state.sources.find((s) => s.id === it.sourceId);
  if (src) return src.feedUrl;
  const card = state.discover.cards.find((c) => c.item === it);
  if (card?.follow?.feedUrl) return card.follow.feedUrl;
  if (it.appleShow) {
    const r = await getJSON(`https://itunes.apple.com/lookup?id=${it.appleShow}&country=${it.appleCountry || 'us'}`);
    return safeUrl(r.results?.[0]?.feedUrl);
  }
  return '';
}

/** The episode's transcript, or null when the show doesn't publish one. Throws on network trouble. */
async function transcriptFor(it) {
  if (!it.transcriptUrl) {
    if (Date.now() - it.transcriptChecked < 3 * DAY) return null; // looked recently; shows sometimes add them later
    const feedUrl = await feedUrlOf(it);
    const found = feedUrl ? await findTranscript({ feedUrl, audioUrl: it.audioUrl, title: it.title }) : null;
    it.transcriptChecked = Date.now();
    if (feedUrl) it.feedUrl = feedUrl;
    if (found) Object.assign(it, { transcriptUrl: found.url, transcriptType: found.kind });
    saveItem(it);
    if (!found) return null;
  }
  const data = await loadTranscript(it.transcriptUrl, it.transcriptType);
  return data.lines.length ? data : null;
}

async function startCaptions(media, it, asked) {
  const btn = media.querySelector('.cc-btn');
  const el = nowPlaying?.media === media ? audio : null;
  if (!btn || !el || btn.classList.contains('busy')) return;
  btn.classList.remove('none');
  btn.classList.add('busy');
  let data = null, failed = false;
  try { data = await transcriptFor(it); } catch { failed = true; }
  if (nowPlaying?.media !== media) return; // stopped meanwhile
  btn.classList.remove('busy');
  if (!data) {
    btn.classList.add('none');
    btn.setAttribute('aria-label', failed ? "Couldn't load subtitles" : 'No subtitles for this episode');
    if (asked) toast(failed ? "Couldn't load the transcript. Try again in a bit." : "This episode doesn't have a public transcript");
    return;
  }
  cc = { media, audio: el, it, data, offset: it.ccOffset || 0, idx: -2 };
  if (data.timed) {
    setCaptions(true);
  } else { // text without timings: no live subtitles, but it can still be read
    btn.textContent = 'Transcript';
    btn.setAttribute('aria-label', 'Read the transcript');
    if (asked) openTranscript();
  }
}

function setCaptions(on) {
  if (!cc) return;
  cc.media.classList.toggle('cc', on);
  cc.media.querySelector('.cc-btn').setAttribute('aria-pressed', String(on));
  cc.media.querySelector('.captions').hidden = !on;
  const line = cc.media.parentElement.querySelector('.caption-line');
  if (line) line.hidden = !on;
  cc.idx = -2;
  tickCaptions();
}

function toggleCaptions(btn, it) {
  const media = btn.closest('.media');
  if (cc?.media === media) {
    if (!cc.data.timed) { openTranscript(); return; }
    state.prefs.captions = !media.classList.contains('cc');
    persistPrefs();
    setCaptions(state.prefs.captions);
    return;
  }
  state.prefs.captions = true;
  persistPrefs();
  startCaptions(media, it, true);
}

// Index of the line being said at time t, or -1 during a pause.
function lineAt(lines, t) {
  let lo = 0, hi = lines.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found >= 0 && t > lines[found].end + 3 ? -1 : found;
}

function tickCaptions() {
  if (!cc?.data.timed) return;
  const i = lineAt(cc.data.lines, cc.audio.currentTime - cc.offset);
  if (i === cc.idx) return;
  cc.idx = i;
  for (const box of [cc.media.querySelector('.captions'), cc.media.parentElement.querySelector('.caption-line')]) {
    if (!box) continue;
    box.textContent = i >= 0 ? cc.data.lines[i].text : '';
    box.classList.toggle('blank', i < 0); // ('empty' is the empty-state block's class)
  }
  if (trSheet.open) highlightLine(i);
}

/* Full transcript sheet: read along, tap a line to jump there, or fix the timing. */
let trSyncing = false;
let trTouched = 0;

function openTranscript() {
  if (!cc) return;
  const { data, it } = cc;
  $('#trSub').textContent = displayTitle(it);
  $('#trSync').hidden = !data.timed;
  setSyncing(false);
  // Group lines into paragraphs: a new one when the speaker changes, after a pause, or when it gets long.
  let html = '', para = [], who = null, len = 0;
  const flush = () => { if (para.length) html += `<p class="tr-para">${para.join(' ')}</p>`; para = []; len = 0; };
  data.lines.forEach((l, i) => {
    const prev = data.lines[i - 1];
    if (l.speaker !== who) {
      flush();
      if (l.speaker) html += `<div class="tr-speaker">${esc(l.speaker)}</div>`;
      who = l.speaker;
    } else if (data.timed ? (prev && l.start - prev.end > 2.5) || (len > 450 && /[.!?…]["”’)]?$/.test(prev.text)) : true) {
      flush();
    }
    if (data.timed && !para.length) para.push(`<span class="tr-time">${fmtTime(Math.floor(l.start))}</span>`);
    para.push(data.timed ? `<span class="tr-line" data-i="${i}" role="button">${esc(l.text)}</span>` : esc(l.text));
    len += l.text.length;
  });
  flush();
  trList.innerHTML = html;
  openSheet(trSheet);
  if (data.timed) highlightLine(cc.idx, true);
}

function highlightLine(i, now = false) {
  trList.querySelector('.tr-line.now')?.classList.remove('now');
  const el = i >= 0 ? trList.querySelector(`.tr-line[data-i="${i}"]`) : null;
  if (!el) return;
  el.classList.add('now');
  if (now || Date.now() - trTouched > 4000) el.scrollIntoView({ block: 'center', behavior: now ? 'auto' : 'smooth' });
}

function setSyncing(on) {
  trSyncing = on;
  $('#trHint').hidden = !on;
  $('#trSync').textContent = on ? 'Cancel' : 'Out of sync?';
  trSheet.classList.toggle('syncing', on);
}

$('#trSync').addEventListener('click', () => setSyncing(!trSyncing));
['touchstart', 'wheel'].forEach((ev) => trSheet.addEventListener(ev, () => { trTouched = Date.now(); }, { passive: true }));
trList.addEventListener('click', (e) => {
  const el = e.target.closest('.tr-line[data-i]');
  if (!el || !cc) return;
  const line = cc.data.lines[+el.dataset.i];
  if (trSyncing) { // the user tapped what they hear now: shift all subtitles by the difference
    cc.offset = cc.it.ccOffset = Math.round((cc.audio.currentTime - line.start) * 10) / 10;
    saveItem(cc.it);
    setSyncing(false);
    cc.idx = -2;
    tickCaptions();
    confirmToast('Subtitles synced');
    return;
  }
  cc.audio.currentTime = Math.max(0, line.start + cc.offset);
  cc.audio.play().catch(() => {});
  trTouched = 0;
});

// Podcast episodes play in one <audio> element with the app's own controls (the iOS ones hide
// the times). It resumes where you left off and offers "Got it" at the end. One element serves
// every episode: iOS only starts sound from a tap, but an element that has played once can
// play again later, so autoplay can start the next episode on its own.
const audio = document.createElement('audio');
audio.preload = 'auto';
let nowPlaying = null; // { it, media, bar, ready, saved, from, dragging }
const RATES = [1, 1.25, 1.5, 2];
const rate = () => (RATES.includes(state.prefs.rate) ? state.prefs.rate : 1);
let audioHint = false;

// Unlock the shared <audio> on the first tap anywhere in the app (playing a moment of silence),
// so episodes can start on their own later, even before you've tapped play on one.
const SILENCE = (() => {
  const n = 800; // 0.1 s of 8 kHz, 8-bit mono silence
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o, s) => [...s].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...b));
})();
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked || nowPlaying) return; // a real episode is starting from this tap anyway
  audioUnlocked = true;
  audio.dataset.src = '';
  audio.src = SILENCE;
  audio.play()
    .then(() => { if (!audio.dataset.src) audio.pause(); debug('audio unlocked'); })
    .catch((err) => { audioUnlocked = false; debug(`audio unlock failed: ${err?.name}`); }); // e.g. the touch was a scroll: try on the next one
}
document.addEventListener('touchend', unlockAudio, { capture: true, passive: true });
document.addEventListener('click', unlockAudio, { capture: true });
audio.addEventListener('loadedmetadata', () => {
  const np = nowPlaying;
  if (!np) return;
  if (!np.it.duration && Number.isFinite(audio.duration)) np.it.duration = Math.round(audio.duration);
  if (np.from > 5 && np.from < audio.duration - 10) audio.currentTime = np.from;
  np.ready = true;
});
audio.addEventListener('timeupdate', () => {
  const np = nowPlaying;
  if (!np) return;
  if (np.ready && !audio.seeking && Math.abs(audio.currentTime - np.saved) >= 5) { np.saved = np.it.progress = Math.floor(audio.currentTime); saveItem(np.it); }
  if (cc?.audio === audio) tickCaptions();
});
audio.addEventListener('seeked', () => { if (cc?.audio === audio) tickCaptions(); });
['timeupdate', 'durationchange', 'loadedmetadata', 'play', 'pause', 'ratechange', 'seeked'].forEach((ev) => audio.addEventListener(ev, renderAudioBar));

const audioBarHTML = () => `<div class="audio-bar">
    <input type="range" class="ab-seek" min="0" max="1000" step="1" value="0" aria-label="Position in episode">
    <div class="ab-times"><span class="ab-time ab-now">0:00</span><span class="ab-time ab-left">--:--</span></div>
    <div class="ab-row">
      <button type="button" class="ab-rate" data-act="audio-rate" aria-label="Playback speed">${rate()}×</button>
      <button type="button" class="ab-btn" data-act="audio-back" aria-label="Back 15 seconds">${icon('back15')}</button>
      <button type="button" class="ab-btn ab-play" data-act="audio-toggle" aria-label="Pause">${icon('pause')}${icon('play')}</button>
      <button type="button" class="ab-btn" data-act="audio-fwd" aria-label="Forward 30 seconds">${icon('fwd30')}</button>
      ${sizeBtnHTML()}
    </div>
  </div>`;

// Times, seek bar and play/pause icon of the episode playing now.
function renderAudioBar() {
  const np = nowPlaying;
  const bar = np?.bar;
  if (!bar) return;
  const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : np.it.duration || 0;
  const now = np.dragging ? np.dragTo : audio.currentTime;
  const seek = bar.querySelector('.ab-seek');
  seek.disabled = !dur;
  if (!np.dragging) seek.value = dur ? String(Math.round((now / dur) * 1000)) : '0';
  seek.style.setProperty('--fill', `${dur ? (now / dur) * 100 : 0}%`);
  bar.querySelector('.ab-now').textContent = fmtTime(Math.floor(now));
  bar.querySelector('.ab-left').textContent = dur ? `-${fmtTime(Math.max(0, Math.round(dur - now)))}` : '--:--';
  const playing = !audio.paused;
  const btn = bar.querySelector('.ab-play');
  btn.classList.toggle('paused', !playing);
  btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  bar.querySelector('.ab-rate').textContent = `${rate()}×`;
}

function audioAction(act) {
  if (!nowPlaying) return;
  if (act === 'audio-toggle') { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
  if (act === 'audio-back') audio.currentTime = Math.max(0, audio.currentTime - 15);
  if (act === 'audio-fwd') audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 30);
  if (act === 'audio-rate') {
    state.prefs.rate = RATES[(RATES.indexOf(rate()) + 1) % RATES.length];
    persistPrefs();
    audio.playbackRate = audio.defaultPlaybackRate = state.prefs.rate;
  }
  renderAudioBar();
}

// Dragging the video's seek bar works the same way.
const ownsVideoSeek = (el) => el.classList?.contains('ms-seek') && ytNow && el.closest('.card') === ytNow.media.closest('.card');
feed.addEventListener('input', (e) => {
  if (!ownsVideoSeek(e.target)) return;
  const dur = yt?.player?.getDuration?.() || ytNow.it.duration || 0;
  ytNow.dragging = true;
  ytNow.dragTo = (e.target.value / 1000) * dur;
  updateYouTubeStrip();
});
feed.addEventListener('change', (e) => {
  if (!ownsVideoSeek(e.target)) return;
  const dur = yt?.player?.getDuration?.() || ytNow.it.duration || 0;
  ytNow.dragging = false;
  if (dur) yt.player.seekTo((e.target.value / 1000) * dur, true);
  updateYouTubeStrip();
});

// Dragging the seek bar: show the time under the thumb, jump on release.
feed.addEventListener('input', (e) => {
  if (!e.target.classList?.contains('ab-seek') || !nowPlaying) return;
  const dur = audio.duration || nowPlaying.it.duration || 0;
  nowPlaying.dragging = true;
  nowPlaying.dragTo = (e.target.value / 1000) * dur;
  renderAudioBar();
});
feed.addEventListener('change', (e) => {
  if (!e.target.classList?.contains('ab-seek') || !nowPlaying) return;
  const dur = audio.duration || nowPlaying.it.duration || 0;
  nowPlaying.dragging = false;
  if (dur) audio.currentTime = (e.target.value / 1000) * dur;
  renderAudioBar();
});
if ('mediaSession' in navigator) {
  // Lock screen and headphone buttons
  const on = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* not supported */ } };
  on('seekbackward', () => audioAction('audio-back'));
  on('seekforward', () => audioAction('audio-fwd'));
}
audio.addEventListener('ended', () => {
  const np = nowPlaying;
  if (!np) return;
  np.it.progress = 0;
  saveItem(np.it);
  finished(np.it);
});

function playAudio(media, it, auto) {
  if (cc && cc.media !== media) cc = null; // subtitles belonged to the previous episode
  media.innerHTML = `${artHTML(it)}
    <button type="button" class="captions" data-act="transcript" aria-label="Subtitle. Tap for the full transcript" hidden></button>
    <button type="button" class="cc-btn" data-act="cc" aria-label="Subtitles" aria-pressed="false">CC</button>`;
  // The player bar goes under the artwork, so it stays full width on compact cards too.
  media.insertAdjacentHTML('afterend', `${audioBarHTML()}
    <button type="button" class="caption-line" data-act="transcript" aria-label="Subtitle. Tap for the full transcript" hidden></button>`);
  const np = nowPlaying = { it, media, bar: media.nextElementSibling, ready: false, saved: it.progress || 0, from: startOf(it).at, dragging: false };
  const strip = media.parentElement.querySelector(':scope > .media-strip');
  if (strip) strip.hidden = true; // the player bar has its own times and the size toggle
  if (audio.dataset.src !== it.audioUrl) {
    audio.dataset.src = it.audioUrl;
    audio.src = it.audioUrl; // seeks to `from` once its length is known
  } else if (audio.readyState >= 1) {
    audio.currentTime = np.from;
    np.ready = true;
  }
  audio.playbackRate = audio.defaultPlaybackRate = rate();
  renderAudioBar();
  audio.play().then(() => { audioUnlocked = true; debug('audio playing'); }).catch((err) => {
    debug(`audio play refused: ${err?.name}`);
    // Only a refusal to start sound needs a tap; a file that fails to load shows its own error in the player.
    if (!auto || nowPlaying !== np || err?.name !== 'NotAllowedError') return;
    stopMedia(media.closest('.card')); // show the play button again
    if (!audioHint) { audioHint = true; toast('Tap play once, then episodes start on their own as you scroll'); }
  });
  if (state.prefs.captions) startCaptions(media, it, false);
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayTitle(it), artist: it.author || '', artwork: it.image ? [{ src: it.image, sizes: '600x600' }] : [],
    });
  }
}

function stopMedia(card) {
  const media = card.querySelector('.media');
  const it = findItem(card.dataset.id);
  if (!media?.dataset.playing || !it) return;
  if (nowPlaying?.media === media) {
    if (!audio.ended && audio.currentTime > 5) it.progress = Math.floor(audio.currentTime);
    audio.pause();
    nowPlaying = null;
    saveItem(it);
  }
  stopYouTube(media);
  if (cc?.media === media) { cc = null; closeSheet(trSheet); }
  card.querySelectorAll('.stack > .audio-bar, .stack > .caption-line').forEach((el) => el.remove());
  delete media.dataset.playing;
  card.classList.remove('playing');
  media.className = mediaClass(it);
  media.innerHTML = mediaHTML(it);
  renderStrip(card, it);
}

/* ----------------------------------------------------------------- actions */
function setLearned(it, learned) {
  const card = cardEl(it.id);
  const prev = { status: it.status, learnedAt: it.learnedAt };
  it.status = learned ? 'learned' : 'new';
  it.learnedAt = learned ? Date.now() : null;
  persist();
  if (card) {
    card.querySelector('.rail-items').innerHTML = actionsHTML(it);
    setTimeout(() => removeCardEl(card), learned ? 220 : 0);
  }
  confirmToast(learned ? `Nice, that's ${learnedToday()} learned today` : 'Moved back to Up next', {
    action: 'Undo',
    onAction: () => { Object.assign(it, prev); persist(); render({ keepScroll: true }); jumpTo(it.id); },
  });
}

function deleteItem(it) {
  const idx = state.items.indexOf(it);
  if (idx < 0) return;
  state.items.splice(idx, 1);
  persist();
  removeCardEl(cardEl(it.id));
  confirmToast('Deleted', {
    action: 'Undo',
    onAction: () => { state.items.splice(idx, 0, it); persist(); render({ keepScroll: true }); jumpTo(it.id); },
  });
}

function setView(view) {
  if (state.prefs.view === view) { feed.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  state.prefs.view = view;
  if (view !== 'discover' && state.prefs.topic && !state.items.some((i) => inView(i) && i.topic === state.prefs.topic)) state.prefs.topic = '';
  persistPrefs();
  render();
  if (view === 'discover') maybeRefreshDiscover();
}

function setTopic(topic) {
  const key = state.prefs.view === 'discover' ? 'dInterest' : 'topic';
  state.prefs[key] = state.prefs[key] === topic ? '' : topic;
  persistPrefs();
  render();
  // An interest that wasn't in the last batch: fetch suggestions for it now.
  if (key === 'dInterest' && state.prefs.dInterest && !state.discover.cards.some((c) => c.interest === state.prefs.dInterest)) {
    buildDiscover({ append: true });
  }
}

feed.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const card = el.closest('.card');
  const it = card ? findItem(card.dataset.id) : null;
  switch (el.dataset.act) {
    case 'd-save': discoverSave(card); return;
    case 'd-skip': discoverSkip(card); return;
    case 'd-follow': { const c = dcardById(card.dataset.id); if (c) followSuggestion(c.follow, c.interest, el); return; }
    case 'follow-src': { const c = dcardById(card.dataset.id); if (c) followSuggestion(c.sources[+el.dataset.idx], c.interest, el); return; }
    case 'd-more': buildDiscover({ append: true, more: true }); render({ keepScroll: true }); return;
    case 'interests': openInterests(); return;
    case 'view-discover': setView('discover'); return;
    case 'play': if (it) play(card, it); break;
    case 'compact': toggleCompact(); break;
    case 'rail': toggleRail(); break;
    case 'to-highlight': if (it) jumpToHighlight(card, it); break;
    case 'cc': if (it) toggleCaptions(el, it); break;
    case 'audio-toggle': case 'audio-back': case 'audio-fwd': case 'audio-rate': audioAction(el.dataset.act); break;
    case 'yt-toggle': case 'yt-back': case 'yt-fwd': case 'yt-rate': youtubeAction(el.dataset.act); break;
    case 'transcript': openTranscript(); break;
    case 'learned': if (it) setLearned(it, it.status !== 'learned'); break;
    case 'note': if (it) openNote(it); break;
    case 'more': if (it) openItemMenu(it); break;
    case 'topic': setTopic(el.dataset.topic || ''); break;
    case 'clear-topic': setTopic(''); break;
    case 'add': openAdd(); break;
    case 'follow': openAdd('', 'follow'); break;
    case 'samples': addSamples(); break;
    case 'install': showInstallHelp(); break;
    case 'sync': syncSources({ force: true, report: true }); break;
    case 'view-learned': setView('learned'); break;
    case 'view-queue': setView('queue'); break;
  }
});

// Long-press a saved card for its menu (edit, copy link, share, delete); right-click on a computer.
let pressTimer = 0;
let pressAt = null;
let pressFired = false;
const cancelPress = () => { clearTimeout(pressTimer); pressAt = null; };
feed.addEventListener('touchstart', (e) => {
  pressFired = false;
  const card = e.target.closest('.card');
  const it = card && byId(card.dataset.id);
  if (!it || e.touches.length > 1 || e.target.closest('button, a, input, textarea, label, .yt-host')) return;
  pressAt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressAt = null;
    pressFired = true;
    setTimeout(() => { pressFired = false; }, 700); // only the click that ends this touch
    navigator.vibrate?.(10);
    openItemMenu(it);
  }, 550);
}, { passive: true });
feed.addEventListener('touchmove', (e) => {
  if (pressAt && Math.hypot(e.touches[0].clientX - pressAt.x, e.touches[0].clientY - pressAt.y) > 10) cancelPress();
}, { passive: true });
feed.addEventListener('touchend', cancelPress, { passive: true });
feed.addEventListener('touchcancel', cancelPress, { passive: true });
feed.addEventListener('scroll', cancelPress, { capture: true, passive: true });
// The tap that ends a long-press must not also press whatever is under the finger in the menu.
document.addEventListener('click', (e) => { if (pressFired) { pressFired = false; e.preventDefault(); e.stopPropagation(); } }, true);
feed.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.card');
  const it = card && byId(card.dataset.id);
  if (!it || e.target.closest('input, textarea')) return;
  e.preventDefault();
  openItemMenu(it);
});

// Image fallbacks (feed and sheets). load/error don't bubble, so listen in the capture phase.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  if (img.dataset.fallback) { const f = img.dataset.fallback; delete img.dataset.fallback; img.src = f; return; }
  if ('fallbackTile' in img.dataset) {
    const it = findItem(img.closest('.card')?.dataset.id);
    if (it) img.closest('.media').innerHTML = tileHTML(it);
    return;
  }
  if ('hideOnError' in img.dataset) img.style.visibility = 'hidden';
}, true);
document.addEventListener('load', (e) => {
  const img = e.target;
  // YouTube serves a 120px grey placeholder (not an error) when maxres doesn't exist.
  if (img.tagName === 'IMG' && img.dataset.fallback && img.naturalWidth <= 120) {
    img.src = img.dataset.fallback;
    delete img.dataset.fallback;
  }
}, true);

topicsEl.addEventListener('click', (e) => {
  if (e.target.closest('[data-top-act="interests"]')) { openInterests(); return; }
  const chip = e.target.closest('[data-topic]');
  if (chip) setTopic(chip.dataset.topic);
});

document.querySelectorAll('.tab[data-view]').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
$('#sourcesTab').addEventListener('click', () => openSources());
$('#discoverRefresh').addEventListener('click', () => buildDiscover());

$('#shuffleBtn').addEventListener('click', () => {
  state.prefs.shuffle = !state.prefs.shuffle;
  state.seed = Math.floor(Math.random() * 1e9);
  persistPrefs();
  render();
  confirmToast(state.prefs.shuffle ? 'Shuffled' : 'Newest first');
});

document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
  const step = (d) => { e.preventDefault(); feed.scrollBy({ top: d * feed.clientHeight, behavior: 'smooth' }); };
  if (e.key === 'ArrowDown' || e.key === 'j') step(1);
  else if (e.key === 'ArrowUp' || e.key === 'k') step(-1);
  else if (e.key === 'n' || e.key === '+') { e.preventDefault(); openAdd(); }
});

/* ------------------------------------------------------------------ toast */
const toastEl = $('#toast');
let toastTimer;
function toast(msg, { action, onAction } = {}) {
  toastEl.querySelector('.toast-msg').textContent = msg;
  const btn = toastEl.querySelector('.toast-action');
  btn.hidden = !action;
  btn.textContent = action || '';
  btn.onclick = action ? () => { hideToast(); onAction(); } : null;
  toastEl.hidden = false;
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth; // restart the entrance animation
  toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5000 : 2600);
}
function hideToast() { toastEl.hidden = true; }
// Confirmations of what you just did ("Saved", "Link copied", Undo…) are off unless
// Menu → Action messages is on. Errors and the one-time sound hints always show.
const confirmToast = (msg, opts) => { if (state.prefs.actionMessages) toast(msg, opts); };

/* ----------------------------------------------------------------- sheets */
function openSheet(d) { d.returnValue = ''; d.showModal(); }
function closeSheet(d) { if (d.open) d.close(); }
document.querySelectorAll('dialog.sheet').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) closeSheet(d); }); // tap on backdrop
});
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet(b.closest('dialog'))));

// Keep sheets above the iOS keyboard.
if (window.visualViewport) {
  const vv = window.visualViewport;
  const sync = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
}

/* --------------------------------------------------------- add / follow sheet */
const addSheet = $('#addSheet');
const addForm = $('#addForm');
const F = addForm.elements;
const detectEl = $('#detect');
const submitBtn = $('#addSubmit');
let editingId = null;
let addMode = 'save'; // 'save' a single link, or 'follow' a source
let busy = false;

function findDuplicate(parsed, exceptId) {
  const key = keyOf(parsed);
  return state.items.find((i) => i.id !== exceptId && keyOf(i) === key);
}

function setDetect(kind, iconName, text, action = '') {
  detectEl.className = 'detect' + (kind ? ' ' + kind : '');
  detectEl.innerHTML = text
    ? `${icon(iconName)}<span>${esc(text)}</span>${action ? `<button type="button" class="linkish small" data-switch-follow>${esc(action)}</button>` : ''}`
    : '';
}

function onUrlInput() {
  const raw = F.url.value.trim();
  if (!raw) {
    return addMode === 'follow'
      ? setDetect('', 'rss', 'YouTube channel or playlist, podcast, Substack, Medium, any blog')
      : setDetect('', '', '');
  }
  if (addMode === 'follow') {
    const hint = sourceHint(raw);
    if (!extractUrl(raw)) return setDetect('err', 'alert', "That doesn't look like a link");
    return setDetect('ok', 'rss', hint ? `Looks like ${hint}` : "We'll look for a feed on this site");
  }
  const p = parseLink(raw);
  if (!p) return setDetect('err', 'alert', "That doesn't look like a link");
  const hint = !editingId && sourceHint(raw);
  if (hint) return setDetect('warn', 'rss', `This is ${hint}.`, 'Follow it instead');
  if (findDuplicate(p, editingId)) return setDetect('warn', 'alert', 'Already in your feed');
  if (p.type === 'youtube') {
    return setDetect('ok', 'play', `${p.vertical ? 'YouTube Short' : 'YouTube video'}${p.start ? ` · starts at ${fmtTime(p.start)}` : ''}`);
  }
  if (p.type === 'spotify' || p.type === 'podcast') return setDetect('ok', 'mic', p.type === 'spotify' ? 'Spotify episode' : 'Podcast episode');
  setDetect('ok', 'globe', `Article · ${domainOf(p.url)}`);
}
F.url.addEventListener('input', onUrlInput);
detectEl.addEventListener('click', (e) => { if (e.target.closest('[data-switch-follow]')) setAddMode('follow'); });

function setAddMode(mode) {
  addMode = mode;
  addSheet.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('#titleField').hidden = mode === 'follow';
  F.url.placeholder = mode === 'follow' ? 'Channel, podcast, newsletter or blog link' : 'YouTube, podcast or article link';
  submitBtn.textContent = editingId ? 'Save changes' : mode === 'follow' ? 'Follow' : 'Save';
  onUrlInput();
}
addSheet.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setAddMode(b.dataset.mode)));

function renderTopicPicks() {
  const topics = [...new Set([...state.items, ...state.sources].map((i) => i.topic).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)).slice(0, 12);
  $('#topicPicks').innerHTML = topics.map((t) => `<button type="button" class="chip" data-pick="${esc(t)}" aria-pressed="${F.topic.value === t}">${esc(t)}</button>`).join('');
}
$('#topicPicks').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  F.topic.value = F.topic.value === b.dataset.pick ? '' : b.dataset.pick;
  renderTopicPicks();
});
F.topic.addEventListener('input', renderTopicPicks);

function openAdd(prefill = '', mode = 'save') {
  editingId = null;
  addForm.reset();
  $('#addModeRow').hidden = false;
  $('#addTitle').hidden = true;
  F.url.value = prefill;
  F.topic.value = state.prefs.topic || '';
  setAddMode(mode);
  renderTopicPicks();
  openSheet(addSheet);
}

function openEdit(it) {
  editingId = it.id;
  addForm.reset();
  $('#addModeRow').hidden = true;
  $('#addTitle').hidden = false;
  F.url.value = it.url;
  F.title.value = it.title;
  F.topic.value = it.topic;
  setAddMode('save');
  renderTopicPicks();
  openSheet(addSheet);
}

$('#pasteBtn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error('empty');
    F.url.value = addMode === 'save' ? parseLink(text)?.url || text.trim() : extractUrl(text)?.href || text.trim();
    onUrlInput();
  } catch {
    F.url.focus();
    setDetect('warn', 'alert', 'Long-press the box above and tap Paste');
  }
});

addForm.addEventListener('submit', (e) => {
  const topic = F.topic.value.trim() ? matchTopic(F.topic.value.trim().slice(0, 40)) : '';
  if (addMode === 'follow' && !editingId) {
    e.preventDefault(); // finding the feed takes a moment; the sheet stays open until it's done
    followSource(F.url.value, topic);
    return;
  }
  const parsed = parseLink(F.url.value);
  if (!parsed) {
    e.preventDefault();
    setDetect('err', 'alert', F.url.value.trim() ? "That doesn't look like a link" : 'Paste a link first');
    return;
  }
  const dup = findDuplicate(parsed, editingId);
  if (dup) {
    e.preventDefault();
    closeSheet(addSheet);
    showExisting(dup);
    return;
  }
  const title = F.title.value.trim();
  if (editingId) saveEdit(byId(editingId), parsed, title, topic);
  else saveNew(parsed, title, topic);
  // method="dialog" closes the sheet after this handler
});

function showExisting(it) {
  if (!inView(it) || state.prefs.view === 'discover' || (state.prefs.topic && it.topic !== state.prefs.topic)) {
    state.prefs.view = it.status === 'learned' ? 'learned' : 'queue';
    state.prefs.topic = '';
    persistPrefs();
    render();
  }
  jumpTo(it.id);
  confirmToast('Already saved, here it is');
}

/**
 * Links shared from other apps. An iOS Shortcut in the Share sheet (or a bookmarklet) opens
 * the app as …/?add=<link> and the link is saved right away, no sheet to fill in.
 */
function takeSharedLink() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('add') ?? params.get('url') ?? params.get('text');
  if (raw === null) return;
  history.replaceState(null, '', location.pathname + location.hash); // so a reload doesn't save it again
  const parsed = parseLink(raw);
  if (!parsed) { toast("That didn't include a link to save"); return; }
  const dup = findDuplicate(parsed);
  if (dup) { showExisting(dup); return; }
  const topic = str(params.get('topic'), 40).trim();
  const it = saveNew(parsed, '', topic ? matchTopic(topic) : '');
  confirmToast('Saved to Up next', { action: 'Add topic', onAction: () => openEdit(it) });
}

function saveNew(parsed, title, topic) {
  const it = normalizeItem({ ...parsed, id: uid(), title, customTitle: !!title, topic, createdAt: Date.now(), metaPending: true });
  state.items.push(it);
  persist();
  state.prefs.view = 'queue';
  if (state.prefs.topic && state.prefs.topic !== topic) state.prefs.topic = '';
  persistPrefs();
  render();
  jumpTo(it.id);
  confirmToast('Saved to Up next');
  enrich(it);
  return it;
}

function saveEdit(it, parsed, title, topic) {
  if (!it) return;
  const linkChanged = keyOf(parsed) !== keyOf(it);
  if (linkChanged) Object.assign(it, parsed, { author: '', description: '', image: '', logo: '', audioUrl: '', duration: 0, progress: 0, metaPending: true, metaTries: 0 });
  it.topic = topic;
  if (title && title !== it.title) { it.title = title; it.customTitle = true; }
  if (!title) { it.title = ''; it.customTitle = false; }
  persist();
  render({ keepScroll: true });
  jumpTo(it.id);
  if (it.metaPending || !it.title) enrich(it);
}

async function followSource(input, topic) {
  if (busy) return;
  const u = extractUrl(input);
  if (!u) return setDetect('err', 'alert', input.trim() ? "That doesn't look like a link" : 'Paste a link first');
  busy = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Finding feed…';
  setDetect('', 'refresh', 'Looking for new posts…');
  detectEl.querySelector('svg')?.classList.add('spin');
  try {
    const found = await discover(u.href);
    const res = addSource(found, topic);
    if (!res) { setDetect('warn', 'alert', `You already follow ${found.title}`); return; }
    const { s, added } = res;
    closeSheet(addSheet);
    state.prefs.view = 'queue';
    if (state.prefs.topic && state.prefs.topic !== topic) state.prefs.topic = '';
    persistPrefs();
    render();
    confirmToast(`Following ${s.title}${added ? ` · ${added} new in Up next` : ''}`);
  } catch (err) {
    setDetect('err', 'alert', err instanceof FeedError ? err.message : "Couldn't follow that. Try again in a moment.");
  } finally {
    busy = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Follow';
  }
}

/* ----------------------------------------------------------------- sources */
/** Start following a discovered source. Returns { s, added } or null if it's already followed. */
function addSource(found, topic) {
  if (state.sources.some((x) => x.feedUrl === found.feedUrl)) return null;
  const s = normalizeSource({ ...found, id: uid(), topic, createdAt: Date.now(), checkedAt: Date.now() });
  state.sources.push(s);
  const added = ingest(s, found.feed.entries);
  persistSources();
  persist();
  renderSourceList();
  updateChrome();
  return { s, added };
}

function entryToItem(e, s, order) {
  const base = {
    id: uid(), sourceId: s.id, topic: s.topic, author: s.title, logo: s.image,
    title: e.title, description: e.description, image: e.image,
    createdAt: Date.now() - order, publishedAt: Math.min(e.published || Date.now(), Date.now()),
  };
  if (e.videoId) return normalizeItem({ ...base, url: `https://www.youtube.com/watch?v=${e.videoId}`, description: '' });
  if (e.audioUrl) {
    return normalizeItem({
      ...base, type: 'podcast', url: e.link || e.audioUrl, audioUrl: e.audioUrl, duration: e.duration, image: e.image || s.image,
      feedUrl: s.feedUrl, transcriptUrl: e.transcriptUrl, transcriptType: e.transcriptType,
    });
  }
  return normalizeItem({ ...base, url: e.link });
}

/** Adds a source's unseen entries to the feed. Returns how many items were added. */
function ingest(s, entries) {
  const seen = new Set(s.seen);
  const cutoff = s.since ? s.since - 3 * 86400000 : 0; // a little slack for back-dated posts
  const fresh = entries.filter((e) => !seen.has(e.key) && !(cutoff && e.published && e.published < cutoff));
  const take = fresh.slice(0, s.seen.length ? MAX_NEW_PER_SYNC : FIRST_FOLLOW_ITEMS);
  const keys = new Set(state.items.map(keyOf));
  let added = 0;
  take.forEach((e, i) => {
    const it = entryToItem(e, s, i);
    if (!it || keys.has(keyOf(it))) return;
    state.items.push(it);
    keys.add(keyOf(it));
    added++;
  });
  s.seen = [...fresh.map((e) => e.key), ...s.seen].slice(0, 400);
  s.since = entries.reduce((max, e) => Math.max(max, e.published || 0), s.since || 0);
  return added;
}

async function runPool(list, size, fn) {
  const queue = [...list];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

let syncing = null;
function syncSources({ force = false, report = false } = {}) {
  if (syncing) return syncing;
  const due = state.sources.filter((s) => force || Date.now() - s.checkedAt > SYNC_EVERY);
  if (!due.length || !navigator.onLine) {
    if (report) toast(navigator.onLine ? 'Nothing to check yet' : "You're offline");
    return Promise.resolve(0);
  }
  syncing = (async () => {
    setSyncUI(true, `Checking ${due.length} source${due.length === 1 ? '' : 's'}…`);
    let added = 0, failed = 0;
    await runPool(due, 2, async (s) => {
      try {
        const f = await loadFeed(s.feedUrl);
        added += ingest(s, f.entries);
        if (!s.image && f.image) s.image = safeUrl(f.image);
        s.error = '';
      } catch {
        s.error = "Couldn't update";
        failed++;
      }
      s.checkedAt = Date.now();
    });
    persistSources();
    if (added) persist();
    const summary = [added ? `${added} new item${added === 1 ? '' : 's'}` : 'No new posts', failed && `${failed} couldn't update`].filter(Boolean).join(' · ');
    setSyncUI(false, summary);
    showNewItems(added, report ? summary : '');
    return added;
  })().finally(() => { syncing = null; });
  return syncing;
}

// New items go to the top of Up next. Only jump there if it won't interrupt what you're watching.
function showNewItems(added, summary) {
  renderSourceList();
  if (!added) { updateChrome(); if (summary) toast(summary); return; }
  const idle = !feed.querySelector('[data-playing]') && currentIndex() === 0 && state.prefs.view === 'queue';
  if (idle || !feed.querySelector('.card')) {
    render();
    confirmToast(`${added} new from your sources`);
  } else {
    updateChrome();
    confirmToast(`${added} new from your sources`, {
      action: 'Show',
      onAction: () => { state.prefs.view = 'queue'; state.prefs.topic = ''; persistPrefs(); render(); },
    });
  }
}

const sourcesSheet = $('#sourcesSheet');
const sourceList = $('#sourceList');

function setSyncUI(on, text) {
  const btn = $('#refreshBtn');
  btn.disabled = on;
  btn.querySelector('svg')?.classList.toggle('spin', on);
  if (text) $('#sourcesStatus').textContent = text;
}

function renderSourceList() {
  if (!state.sources.length) {
    sourceList.innerHTML = `<p class="fineprint">Follow YouTube channels, podcasts and newsletters. Their new posts land in Up next on their own.</p>`;
    return;
  }
  const counts = new Map();
  for (const i of state.items) if (i.sourceId) counts.set(i.sourceId, (counts.get(i.sourceId) || 0) + 1);
  sourceList.innerHTML = [...state.sources].sort((a, b) => a.title.localeCompare(b.title)).map((s) => `
    <div class="source-row" data-sid="${esc(s.id)}">
      <img class="source-img" src="${esc(s.image || faviconOf(s))}" alt="" loading="lazy" data-hide-on-error>
      <div class="source-info">
        <b>${esc(s.title)}</b>
        <small class="${s.error ? 'err' : ''}">${esc([KINDS[s.kind], s.topic && '#' + s.topic, s.error || (s.checkedAt ? `checked ${ago(s.checkedAt)}` : '')].filter(Boolean).join(' · '))}</small>
      </div>
      <button type="button" class="btn ghost small" data-unfollow>Unfollow</button>
    </div>`).join('');
}

sourceList.addEventListener('click', (e) => {
  const b = e.target.closest('[data-unfollow]');
  if (!b) return;
  if (!b.classList.contains('armed')) { // ask for a second tap instead of a dialog
    b.classList.add('armed');
    b.textContent = 'Tap to confirm';
    setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = 'Unfollow'; } }, 3000);
    return;
  }
  const id = b.closest('[data-sid]').dataset.sid;
  const s = state.sources.find((x) => x.id === id);
  state.sources = state.sources.filter((x) => x.id !== id);
  persistSources();
  renderSourceList();
  $('#sourcesStatus').textContent = `Unfollowed ${s?.title || 'source'}. Items already in your feed stay there.`;
});

function openSources() {
  renderSourceList();
  $('#sourcesStatus').textContent = state.sources.length
    ? `${state.sources.length} source${state.sources.length === 1 ? '' : 's'} · new posts are checked when you open the app`
    : '';
  openSheet(sourcesSheet);
}
$('#refreshBtn').addEventListener('click', () => syncSources({ force: true }));
$('#followBtn').addEventListener('click', () => { closeSheet(sourcesSheet); openAdd('', 'follow'); });

/* ---------------------------------------------------------------- discover */
const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n);
const isFollowing = (info) => !!info?.feedUrl && state.sources.some((s) => s.feedUrl === info.feedUrl);
const interleave = (lists) => {
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
};
const shuffled = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function discoverActionsHTML(c) {
  const following = isFollowing(c.follow);
  const follow = following ? `Following ${c.follow?.title || ''}`.trim() : `Follow ${c.follow?.title || 'this source'}`;
  return `<button type="button" class="rail-btn primary" data-act="d-save" aria-label="Save to Up next" title="Save">${icon('plus')}</button>
    <button type="button" class="rail-btn" data-act="d-skip" aria-label="Skip, don't show it again" title="Skip">${icon('x')}</button>
    ${c.follow ? `<button type="button" class="rail-btn${following ? ' following' : ''}" data-act="d-follow" aria-label="${esc(follow)}" title="${esc(follow)}" ${following ? 'disabled' : ''}>${icon(following ? 'check' : 'rss')}</button>` : ''}
    <a class="rail-btn" href="${esc(c.item.url)}" target="_blank" rel="noopener" aria-label="${c.item.type === 'youtube' ? 'Open in YouTube' : 'Open'}" title="Open">${icon(c.item.type === 'youtube' ? 'yt' : 'external')}</a>`;
}

function sourcesCardHTML(c) {
  return `<article class="card sources-card" data-id="${esc(c.id)}" style="--hue:${hash(c.interest) % 360}">
    <div class="card-inner">
      <div class="content"><div class="stack">
        <div class="body">
          <span class="eyebrow">${icon('rss')}Sources to follow</span>
          <h2 class="title">For ${esc(c.interest)}</h2>
          <p class="desc">Follow one and its new posts land in Up next on their own.</p>
        </div>
        <div class="src-list">${c.sources.map((s, i) => {
          const following = isFollowing(s);
          return `<div class="src-item">
            <img src="${esc(s.image || faviconOf({ url: s.link || s.feedUrl || s.site }))}" alt="" loading="lazy" data-hide-on-error>
            <div class="src-text"><b>${esc(s.title)}</b><small>${esc(s.sub || KINDS[s.kind])}</small></div>
            <button type="button" class="btn small ${following ? 'ghost' : 'primary'}" data-act="follow-src" data-idx="${i}" ${following ? 'disabled' : ''}>${following ? 'Following' : 'Follow'}</button>
          </div>`;
        }).join('')}</div>
      </div></div>
      <div class="actions two">
        <button type="button" class="act" data-act="d-skip">${icon('x')}<span>Skip</span></button>
        <button type="button" class="act" data-act="interests">${icon('compass')}<span>Interests</span></button>
      </div>
    </div>
  </article>`;
}

const discoverBlock = (title, text, buttons = '', spin = false) =>
  `<div class="empty"><div class="art${spin ? ' spin-slow' : ''}">${icon('compass')}</div><h2>${title}</h2><p>${text}</p><div class="row">${buttons}</div></div>`;

function discoverHTML() {
  const { interests, dInterest } = state.prefs;
  if (!interests.length) {
    return discoverBlock('Discover things to learn',
      'Pick a few topics. Discover finds videos, podcasts, articles and sources to follow for them, and refreshes on its own.',
      emptyBtn('interests', 'Pick your interests', true));
  }
  const list = state.discover.cards.filter((c) => !dInterest || c.interest === dInterest);
  if (!list.length) {
    return discoverLoading
      ? discoverBlock('Finding things to learn', `Looking for videos, podcasts and articles about ${esc((dInterest ? [dInterest] : interests).slice(0, 3).join(', '))}…`, '', true)
      : discoverBlock('Nothing here yet', navigator.onLine ? 'Load suggestions, or change your interests.' : "You're offline. Suggestions load when you're back online.",
        emptyBtn('d-more', 'Load suggestions', true) + emptyBtn('interests', 'Interests'));
  }
  const end = `<article class="card end-card">${discoverBlock(discoverLoading ? 'Finding more…' : "That's all for now",
    'Load more suggestions, or change what you want to learn about.',
    discoverLoading ? '' : emptyBtn('d-more', 'Load more', true) + emptyBtn('interests', 'Interests'), discoverLoading)}</article>`;
  return list.map((c) => (c.type === 'sources' ? sourcesCardHTML(c) : cardHTML(c.item, c))).join('') + end;
}

/* Turning search results into cards. Each returns { id, type, interest, item, follow } or null. */
function makeCard(raw, interest, follow = null) {
  const item = normalizeItem({ ...raw, id: uid(), topic: matchTopic(interest) });
  return item ? { id: item.id, type: 'item', interest, item, follow } : null;
}
const ytFollow = (v) => (/^UC[\w-]{22}$/.test(v.channelId)
  ? { kind: 'youtube', feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${v.channelId}`, title: v.channel, image: v.channelImage, link: `https://www.youtube.com/channel/${v.channelId}`, sub: 'YouTube channel' }
  : null);

function cardsFor(g) {
  const { interest } = g;
  const yt = g.yt.map((v) => makeCard({
    url: `https://www.youtube.com/watch?v=${v.videoId}`, title: v.title, author: v.channel, logo: v.channelImage,
    duration: v.duration, description: [v.views, v.published].filter(Boolean).join(' · '),
  }, interest, ytFollow(v)));
  const pods = g.eps.map((e) => makeCard({
    type: 'podcast', url: e.link || e.audioUrl, audioUrl: e.audioUrl, title: e.title, author: e.show, image: e.image,
    duration: e.duration, publishedAt: e.published, description: e.description, feedUrl: e.feedUrl,
  }, interest, e.feedUrl ? { kind: 'podcast', feedUrl: e.feedUrl, title: e.show, image: e.image, sub: 'Podcast' } : null));
  const hn = g.hn.map((h) => {
    const site = parseLink(h.url)?.type === 'web' ? new URL(h.url).origin : '';
    return makeCard({ url: h.url, title: h.title, author: domainOf(h.url), publishedAt: h.published, description: `${h.points} points · ${h.comments} comments on Hacker News` },
      interest, site ? { kind: 'blog', site, title: domainOf(h.url), sub: 'Blog' } : null);
  });
  const dev = g.dev.map((d) => makeCard({
    url: d.url, title: d.title, author: d.author ? `${d.author} on DEV` : 'DEV', logo: d.avatar, image: d.image, publishedAt: d.published,
    description: [d.description, d.minutes && `${d.minutes} min read`].filter(Boolean).join(' · '),
  }, interest, d.username ? { kind: 'blog', feedUrl: `https://dev.to/feed/${d.username}`, title: `${d.author} on DEV`, image: d.avatar, sub: 'Blog' } : null));
  const wiki = g.wiki.map((w) => makeCard({ url: w.url, title: w.title, author: 'Wikipedia', image: w.image, description: w.extract }, interest));

  // Sources to follow: channels that showed up most in the videos, plus podcasts and blogs.
  const byChannel = new Map();
  for (const v of g.yt) if (ytFollow(v)) byChannel.set(v.channelId, { n: (byChannel.get(v.channelId)?.n || 0) + 1, v });
  const sources = [
    ...[...byChannel.values()].sort((a, b) => b.n - a.n).slice(0, 2).map(({ v }) => ytFollow(v)),
    ...g.shows.slice(0, 2).map((s) => ({ kind: 'podcast', feedUrl: s.feedUrl, title: s.title, image: s.image, link: s.link, sub: `Podcast${s.count ? ` · ${s.count} episodes` : ''}` })),
    ...g.blogs.slice(0, 2).map((b) => ({ kind: 'blog', feedUrl: b.feedUrl, title: b.title, image: b.image, link: b.link, sub: `Blog${b.subscribers ? ` · ${compact(b.subscribers)} followers` : ''}` })),
  ].filter((x) => x && !isFollowing(x));

  return {
    lanes: [yt, interleave([hn, dev, wiki]), pods].map((l) => l.filter(Boolean)),
    sources: sources.length >= 2 ? { id: uid(), type: 'sources', interest, sources } : null,
  };
}

async function searchInterest(interest, round) {
  const q = interest + QUERY_VARIANTS[round % QUERY_VARIANTS.length];
  const first = round === 0;
  const settle = (p) => p.then((v) => v || [], () => []); // one provider failing never breaks the rest
  const showsAndEpisodes = settle(podcastShows(first ? interest : q)).then(async (shows) => {
    // A couple of recent episodes from each of the top shows (a different slice each round).
    const pick = shows.slice((round % 3) * 3, (round % 3) * 3 + 3);
    const eps = (await Promise.all(pick.map((s) => settle(showEpisodes(s.id, 2))
      .then((list) => list.map((e) => ({ ...e, show: e.show || s.title, feedUrl: e.feedUrl || s.feedUrl })))))).flat();
    return { shows, eps };
  });
  const [yt, { shows, eps }, hn, dev, wiki, blogs] = await Promise.all([
    settle(youtubeVideos(first ? `${interest} explained` : q)),
    showsAndEpisodes,
    settle(hnStories(interest, round)),
    settle(devArticles(interest, round + 1)),
    settle(wikiArticles(interest, round * 6)),
    first ? settle(blogFeeds(interest)) : [],
  ]);
  return { interest, yt, eps, shows: first ? shows : [], hn, dev, wiki, blogs };
}

let building = null;
let discoverLoading = false; // set before the first render of a build, unlike `building`
/** Fetch suggestions. append: add to the current list (Load more, or a new interest chip); otherwise replace it. */
function buildDiscover({ append = false, more = false } = {}) {
  if (building) return building;
  const { interests, dInterest } = state.prefs;
  if (!interests.length || !navigator.onLine) { if (!navigator.onLine) toast("You're offline"); return Promise.resolve(); }
  const focus = dInterest && interests.includes(dInterest) ? [dInterest] : shuffled(interests).slice(0, 3);
  const round = more ? (state.discover.round || 0) + 1 : append ? state.discover.round || 0 : 0;
  building = (async () => {
    setDiscoverBusy(true);
    const groups = [];
    await runPool(focus, 2, async (interest) => groups.push(await searchInterest(interest, round)));

    // Drop anything already saved, skipped or already suggested.
    const taken = new Set([...state.items.map(keyOf), ...state.dseen, ...(append ? state.discover.cards.filter((c) => c.item).map((c) => keyOf(c.item)) : [])]);
    const keep = (c) => { const k = keyOf(c.item); if (taken.has(k)) return false; taken.add(k); return true; };
    const built = groups.map(cardsFor);
    const content = interleave(built.map((b) => interleave(b.lanes.map((l) => l.filter(keep).slice(0, 6)))));
    const sourceCards = built.map((b) => b.sources).filter(Boolean);
    const fresh = [];
    content.forEach((c, i) => { fresh.push(c); if (i % 6 === 4 && sourceCards.length) fresh.push(sourceCards.shift()); });
    if (fresh.length) fresh.push(...sourceCards);

    state.discover = {
      builtAt: Date.now(), round, key: interests.join('|'),
      cards: append ? [...state.discover.cards, ...fresh] : fresh.length ? fresh : state.discover.cards,
    };
    persistDiscover();
    return fresh.length;
  })().catch(() => 0).then((count) => {
    building = null;
    setDiscoverBusy(false);
    afterDiscoverBuilt(count, append);
  });
  return building;
}

function afterDiscoverBuilt(count, append) {
  if (state.prefs.view !== 'discover') return;
  if (!count) { render({ keepScroll: true }); toast(navigator.onLine ? "Couldn't find anything new right now" : "You're offline"); return; }
  const idle = !feed.querySelector('[data-playing]') && (currentIndex() === 0 || !feed.querySelector('.card:not(.end-card)'));
  if (append || idle) render({ keepScroll: append });
  else confirmToast('New suggestions are ready', { action: 'Show', onAction: () => render() });
}

function setDiscoverBusy(on) {
  discoverLoading = on;
  $('#discoverRefresh').disabled = on;
  $('#discoverRefresh svg')?.classList.toggle('spin', on);
  if (on && state.prefs.view === 'discover' && !feed.querySelector('.card:not(.end-card)')) render(); // show the loading state
}

function maybeRefreshDiscover() {
  if (state.prefs.view !== 'discover' || !state.prefs.interests.length) return;
  const d = state.discover;
  if (!d.cards.length || d.key !== state.prefs.interests.join('|') || Date.now() - d.builtAt > DISCOVER_STALE) buildDiscover();
}

function removeSuggestion(c, cardNode) {
  removeCardEl(cardNode); // first, while the card can still find its item to stop the player
  const idx = state.discover.cards.indexOf(c);
  if (idx >= 0) state.discover.cards.splice(idx, 1);
  if (c.item) state.dseen.add(keyOf(c.item));
  persistDiscover();
  return idx;
}

function restoreSuggestion(c, idx) {
  if (c.item) state.dseen.delete(keyOf(c.item));
  state.discover.cards.splice(Math.max(0, idx), 0, c);
  persistDiscover();
  render({ keepScroll: true });
  jumpTo(c.id);
}

function discoverSave(cardNode) {
  const c = dcardById(cardNode.dataset.id);
  if (!c?.item) return;
  const dup = findDuplicate(c.item);
  const it = dup || normalizeItem({ ...c.item, id: uid(), createdAt: Date.now(), status: 'new', progress: 0 });
  if (!dup) { state.items.push(it); persist(); }
  const idx = removeSuggestion(c, cardNode);
  updateChrome();
  confirmToast(dup ? 'Already in your feed' : 'Saved to Up next', dup ? {} : {
    action: 'Undo',
    onAction: () => { state.items = state.items.filter((i) => i !== it); persist(); restoreSuggestion(c, idx); },
  });
}

function discoverSkip(cardNode) {
  const c = dcardById(cardNode.dataset.id);
  if (!c) return;
  const idx = removeSuggestion(c, cardNode);
  confirmToast(c.type === 'sources' ? 'Hidden' : "Skipped. You won't see it again", { action: 'Undo', onAction: () => restoreSuggestion(c, idx) });
}

async function followSuggestion(info, interest, btn) {
  if (!info) return;
  if (isFollowing(info)) { toast(`You already follow ${info.title}`); return; }
  const onRail = btn.classList.contains('rail-btn');
  const label = btn.querySelector('span') || btn;
  const before = onRail ? btn.innerHTML : label.textContent;
  const say = (text, iconName) => {
    if (!onRail) { label.textContent = text; return; }
    btn.setAttribute('aria-label', text);
    btn.title = text;
    if (iconName) btn.innerHTML = icon(iconName);
  };
  btn.disabled = true;
  say('Following…');
  btn.classList.add('busy');
  try {
    const found = info.feedUrl
      ? await fromFeed(info.feedUrl, { kind: info.kind, title: info.title, image: info.image, link: info.link })
      : await discover(info.site);
    const res = addSource(found, matchTopic(interest));
    btn.classList.remove('busy');
    if (!res) { toast(`You already follow ${found.title}`); return; }
    say(`Following ${res.s.title}`, 'check');
    if (!onRail) label.textContent = 'Following';
    btn.classList.add('following');
    if (btn.classList.contains('primary')) btn.classList.replace('primary', 'ghost');
    confirmToast(`Following ${res.s.title}${res.added ? ` · ${res.added} new in Up next` : ''}`);
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove('busy');
    if (onRail) { btn.innerHTML = before; btn.setAttribute('aria-label', 'Follow'); } else label.textContent = before;
    toast(err instanceof FeedError ? err.message : "Couldn't follow that right now");
  }
}

/* Interests sheet */
const interestsSheet = $('#interestsSheet');
const interestsForm = $('#interestsForm');
let draftInterests = [];

function topicsFromData() {
  const counts = new Map();
  for (const x of [...state.items, ...state.sources]) if (x.topic) counts.set(x.topic, (counts.get(x.topic) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 5);
}

function renderInterestChips() {
  const all = [...new Set([...draftInterests, ...topicsFromData(), ...PRESET_INTERESTS])];
  $('#interestChips').innerHTML = all.map((t) =>
    `<button type="button" class="chip" data-interest="${esc(t)}" aria-pressed="${draftInterests.includes(t)}">${esc(t)}</button>`).join('');
  $('#interestsSave').disabled = !draftInterests.length;
  $('#interestsCount').textContent = draftInterests.length ? `${draftInterests.length} selected` : 'Pick at least one';
}

function openInterests() {
  draftInterests = state.prefs.interests.length ? [...state.prefs.interests] : topicsFromData();
  interestsForm.reset();
  renderInterestChips();
  openSheet(interestsSheet);
}

$('#interestChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-interest]');
  if (!b) return;
  const t = b.dataset.interest;
  draftInterests = draftInterests.includes(t) ? draftInterests.filter((x) => x !== t) : [...draftInterests, t].slice(0, 10);
  renderInterestChips();
});

function addCustomInterest() {
  const input = interestsForm.elements.custom;
  const t = input.value.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!t) return;
  const existing = [...draftInterests, ...PRESET_INTERESTS].find((x) => x.toLowerCase() === t.toLowerCase());
  const name = existing || t[0].toUpperCase() + t.slice(1);
  if (!draftInterests.includes(name)) draftInterests = [...draftInterests, name].slice(0, 10);
  input.value = '';
  renderInterestChips();
}
$('#interestAdd').addEventListener('click', addCustomInterest);
interestsForm.elements.custom.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addCustomInterest(); }
});

interestsForm.addEventListener('submit', () => {
  if (!draftInterests.length) return;
  const changed = draftInterests.join('|') !== state.prefs.interests.join('|');
  state.prefs.interests = draftInterests;
  if (!draftInterests.includes(state.prefs.dInterest)) state.prefs.dInterest = '';
  state.prefs.view = 'discover';
  persistPrefs();
  if (changed) { state.discover = { ...state.discover, cards: [], builtAt: 0 }; persistDiscover(); }
  render();
  if (changed || !state.discover.cards.length) buildDiscover();
});

/* -------------------------------------------------------------- note sheet */
const noteSheet = $('#noteSheet');
const noteForm = $('#noteForm');
let noteId = null;

function openNote(it, heading = 'Key takeaway') {
  noteId = it.id;
  $('#noteHeading').textContent = heading;
  noteForm.elements.note.value = it.note || '';
  $('#noteItemTitle').textContent = displayTitle(it);
  $('#noteLearnedBtn').hidden = it.status === 'learned';
  openSheet(noteSheet);
  const ta = noteForm.elements.note;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

noteForm.addEventListener('submit', (e) => {
  const it = byId(noteId);
  if (!it) return;
  it.note = noteForm.elements.note.value.trim().slice(0, 5000);
  persist();
  const card = cardEl(it.id);
  if (card) { // keep a playing video or podcast going
    card.querySelector('.body').innerHTML = bodyHTML(it);
    card.querySelector('.rail-items').innerHTML = actionsHTML(it);
  }
  if (e.submitter?.value === 'learned' && it.status !== 'learned') setLearned(it, true);
  else confirmToast(it.note ? 'Takeaway saved' : 'Note cleared');
});

/* ---------------------------------------------------------- per-item menu */
const itemSheet = $('#itemSheet');
let menuItemId = null;

function openItemMenu(it) {
  menuItemId = it.id;
  $('#itemSheetTitle').textContent = displayTitle(it);
  itemSheet.querySelector('[data-item-act="share"]').hidden = !navigator.share;
  openSheet(itemSheet);
}

itemSheet.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-item-act]');
  if (!b) return;
  const it = byId(menuItemId);
  const act = b.dataset.itemAct;
  if (act === 'share' && it) { // must run inside the tap, before anything async
    navigator.share({ title: displayTitle(it), url: it.url }).catch(() => {});
  }
  closeSheet(itemSheet);
  if (!it) return;
  if (act === 'edit') openEdit(it);
  else if (act === 'delete') deleteItem(it);
  else if (act === 'copy') {
    try { await navigator.clipboard.writeText(it.url); confirmToast('Link copied'); }
    catch { toast("Couldn't copy on this connection"); }
  }
});

/* ------------------------------------------------------------- appearance */
// Menu → Appearance cycles Light → Dark → Auto. Auto follows the phone's setting.
const THEME_COLORS = { light: '#ffffff', dark: '#0e0e0e' };
const THEMES = {
  light: { icon: 'sun', next: 'dark', label: 'Light' },
  dark: { icon: 'moon', next: 'auto', label: 'Dark' },
  auto: { icon: 'auto', next: 'light', label: 'Auto' },
};
const isDark = () => state.prefs.theme === 'dark' || (state.prefs.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
function applyTheme() {
  const t = ['light', 'dark'].includes(state.prefs.theme) ? state.prefs.theme : 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  // Safari tints its bars with theme-color; the two tags cover Auto, a fixed choice sets both.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.content = THEME_COLORS[t] || (m.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light);
  });
  $('#themeIcon').innerHTML = icon(THEMES[t].icon);
  $('#themeValue').textContent = THEMES[t].label;
  $('#themeBtn').setAttribute('aria-label', `Appearance: ${THEMES[t].label}. Tap to switch to ${THEMES[THEMES[t].next].label}`);
}
function cycleTheme() {
  const cur = THEMES[state.prefs.theme] ? state.prefs.theme : 'auto';
  state.prefs.theme = THEMES[cur].next;
  persistPrefs();
  applyTheme();
}

/* --------------------------------------------------------------- app menu */
const menuSheet = $('#menuSheet');
const importInput = $('#importInput');

function renderMenuToggles() {
  $('#autoplayValue').textContent = state.prefs.autoplay ? 'On' : 'Off';
  $('#highlightsValue').textContent = state.prefs.highlights ? 'On' : 'Off';
  $('#actionMessagesValue').textContent = state.prefs.actionMessages ? 'On' : 'Off';
}
menuSheet.addEventListener('close', scheduleSettle); // autoplay may have just been turned on

$('#menuBtn').addEventListener('click', () => {
  renderMenuToggles();
  const learned = state.items.filter((i) => i.status === 'learned').length;
  const today = learnedToday();
  $('#menuStats').textContent = `${state.items.length} saved · ${learned} learned${today ? ` · ${today} today` : ''}`;
  $('#menuInstall').hidden = isStandalone();
  openSheet(menuSheet);
});

menuSheet.addEventListener('click', (e) => {
  const b = e.target.closest('[data-menu-act]');
  if (!b) return;
  const act = b.dataset.menuAct;
  if (act === 'theme') { cycleTheme(); return; } // settings stay open to show the new value
  if (act === 'autoplay' || act === 'highlights' || act === 'actionMessages') {
    state.prefs[act] = !state.prefs[act];
    persistPrefs();
    renderMenuToggles();
    if (act === 'highlights') render({ keepScroll: true }); // badges show ★ only when it's on
    return;
  }
  if (act === 'export') exportData(); // keep inside the tap so iOS allows the share sheet
  closeSheet(menuSheet); // close first: a modal dialog makes the file input inert
  if (act === 'import') importInput.click();
  if (act === 'samples') addSamples();
  if (act === 'install') showInstallHelp();
});

function exportData() {
  const json = JSON.stringify({ app: 'learn-in-motion', version: 2, exportedAt: new Date().toISOString(), items: state.items, sources: state.sources }, null, 2);
  const name = `learn-in-motion-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: 'Learn in Motion backup' }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  confirmToast('Backup downloaded');
}

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    const incoming = (Array.isArray(json) ? json : json.items || []).map(normalizeItem).filter(Boolean);
    const keys = new Set(state.items.map(keyOf));
    let added = 0;
    for (const it of incoming) {
      if (keys.has(keyOf(it))) continue;
      if (state.items.some((i) => i.id === it.id)) it.id = uid();
      state.items.push(it);
      keys.add(keyOf(it));
      added++;
    }
    const feeds = new Set(state.sources.map((s) => s.feedUrl));
    let follows = 0;
    for (const s of (json.sources || []).map(normalizeSource).filter(Boolean)) {
      if (feeds.has(s.feedUrl)) continue;
      state.sources.push(s);
      feeds.add(s.feedUrl);
      follows++;
    }
    persist();
    persistSources();
    render();
    const parts = [added && `${added} item${added === 1 ? '' : 's'}`, follows && `${follows} source${follows === 1 ? '' : 's'}`].filter(Boolean);
    toast(parts.length ? `Imported ${parts.join(' and ')}` : 'Nothing new in that backup');
  } catch {
    toast("That file isn't a Learn in Motion backup");
  }
});

/* ----------------------------------------------------------------- samples */
// Podcast samples are episodes whose feeds publish a transcript, so their subtitles (CC) work.
const SAMPLES = [
  { url: 'https://www.youtube.com/watch?v=5MgBikgcWnY', title: 'The first 20 hours -- how to learn anything | Josh Kaufman | TEDxCSU', author: 'TEDx Talks', topic: 'Learning' },
  { type: 'podcast', url: 'https://darknetdiaries.com/episode/182/', audioUrl: 'https://www.podtrac.com/pts/redirect.mp3/dovetail.prxu.org/7057/c0abbff3-ae98-4e23-a389-5ee0fd824f51/darknet-diaries-ep182-blackshades.mp3', title: '182: Blackshades', author: 'Darknet Diaries', topic: 'Security', image: 'https://f.prxu.org/7057/c0abbff3-ae98-4e23-a389-5ee0fd824f51/images/2a7a8a4b-7f32-4d33-8c82-f624ac181eeb/Ep182_BlackshadesSquare.jpg', duration: 2357, publishedAt: Date.parse('2026-11-03T08:00:00Z'),
    feedUrl: 'https://podcast.darknetdiaries.com/', transcriptUrl: 'https://f.prxu.org/7057/c0abbff3-ae98-4e23-a389-5ee0fd824f51/transcripts/673ef6c8-d8e1-4f97-8c6a-d7ac2ca2401a/darknet-diaries-ep182-blackshades.vtt', transcriptType: 'vtt',
    description: 'What if you got infected by a friend who wanted to spy on you? How BlackShades spread to more than half a million machines, and 97 people got arrested.' },
  { url: 'https://www.youtube.com/watch?v=aircAruvnKk', title: 'But what is a neural network? | Deep learning chapter 1', author: '3Blue1Brown', topic: 'AI' },
  { type: 'podcast', url: 'https://share.transistor.fm/s/bb4dad17', audioUrl: 'https://pscrb.fm/rss/p/dts.podtrac.com/redirect.mp3/media.transistor.fm/bb4dad17/16dab0bd.mp3', title: 'Building Human-Centered AI', author: 'Practical AI', topic: 'AI', image: 'https://img.transistorcdn.com/jIBLnMKZpEyROouteO2NIG4N8vj8lRFFsW_hQpwnmGk/rs:fill:0:0:1/w:1400/h:1400/q:60/mb:500000/aHR0cHM6Ly9pbWct/dXBsb2FkLXByb2R1/Y3Rpb24udHJhbnNp/c3Rvci5mbS8wZDg5/ZmYxZTIzNGM3MWNl/YWQ4MmE2ZDRkMTQ1/YjA5Ny5wbmc.jpg', duration: 2695, publishedAt: Date.parse('2026-11-19T10:00:00Z'),
    feedUrl: 'https://feeds.transistor.fm/practical-ai-machine-learning-data-science-llm', transcriptUrl: 'https://share.transistor.fm/s/bb4dad17/transcription.vtt', transcriptType: 'vtt',
    description: 'How can enterprises adopt AI and agentic systems while keeping people, business value and trust at the center? With Dr. Gautham Pallapa of Scotiabank.' },
  { url: 'https://paulgraham.com/greatwork.html', title: 'How to Do Great Work', author: 'Paul Graham', topic: 'Career', description: 'An essay on choosing what to work on, following curiosity, and the habits that compound into great work.' },
  { url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g', title: '[1hr Talk] Intro to Large Language Models', author: 'Andrej Karpathy', topic: 'AI' },
  { type: 'podcast', url: 'https://omny.fm/shows/stuff-you-should-know-1/protein-yes-but-how-much', audioUrl: 'https://podtrac.com/pts/redirect.mp3/pscrb.fm/rss/p/traffic.omny.fm/d/clips/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/a007c4ee-5dbf-419c-b37e-b500010db27d/audio.mp3?utm_source=Podcast&in_playlist=44710ecc-10bb-48d1-93c7-ae270180c33e', title: 'Protein: Yes, But How Much?', author: 'Stuff You Should Know', topic: 'Health', image: 'https://www.omnycontent.com/d/programs/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/image.jpg?t=1749759419&size=Large', duration: 2736, publishedAt: Date.parse('2026-11-24T10:00:00Z'),
    feedUrl: 'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/44710ecc-10bb-48d1-93c7-ae270180c33e/podcast.rss', transcriptUrl: 'https://api.omny.fm/orgs/e73c998e-6e60-432f-8610-ae210140c5b1/clips/a007c4ee-5dbf-419c-b37e-b500010db27d/transcript?format=WebVTT&t=1794500971', transcriptType: 'vtt',
    description: 'We need protein, that much is clear. But how much do we need, and how much is too much? What this macronutrient does, and why the answers turn out to be a little fuzzy.' },
  { url: 'https://en.wikipedia.org/wiki/Spaced_repetition', title: 'Spaced repetition', author: 'Wikipedia', topic: 'Learning', description: 'An evidence-based technique: review material at growing intervals to take advantage of the spacing effect.' },
  { url: 'https://www.youtube.com/watch?v=IlU-zDU6aQ0', title: 'Marty Lobdell - Study Less Study Smart', author: 'Pierce College District WA', topic: 'Learning' },
  { url: 'https://www.youtube.com/watch?v=fNk_zzaMoSs', title: 'Vectors | Chapter 1, Essence of linear algebra', author: '3Blue1Brown', topic: 'Math' },
  { url: 'https://www.youtube.com/watch?v=eIho2S0ZahI', title: 'How to Speak So That People Want to Listen | Julian Treasure | TED', author: 'TED', topic: 'Communication' },
  { url: 'https://en.wikipedia.org/wiki/Forgetting_curve', title: 'Forgetting curve', author: 'Wikipedia', topic: 'Learning', status: 'learned', description: 'How memory of new information decays over time when there is no attempt to retain it.', note: 'Memory drops fast in the first days after learning. Reviewing at growing intervals (1 day, 3 days, a week…) flattens the curve.' },
];

function addSamples() {
  const keys = new Set(state.items.map(keyOf));
  const now = Date.now();
  let added = 0;
  SAMPLES.forEach((s, n) => {
    const it = normalizeItem({ ...s, id: uid(), createdAt: now - n * 60000, learnedAt: s.status === 'learned' ? now - 3600000 : null, metaPending: !s.url.includes('youtube') && s.type !== 'podcast' });
    if (!it || keys.has(keyOf(it))) return;
    state.items.push(it);
    added++;
  });
  persist();
  state.prefs.view = 'queue';
  state.prefs.topic = '';
  persistPrefs();
  render();
  confirmToast(added ? `Added ${added} samples. The podcasts have subtitles: tap CC while one plays.` : 'Samples are already in your feed');
  retryPendingMeta();
}

/* ----------------------------------------------------------------- install */
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

function showInstallHelp() {
  if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; return; }
  openSheet($('#installSheet'));
}

/* -------------------------------------------------------------------- boot */
applyTheme();
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
$('#shuffleBtn').innerHTML = icon('shuffle');
$('#menuBtn').innerHTML = icon('menu');
$('#discoverRefresh').innerHTML = icon('refresh');
$('#addBtn').innerHTML = icon('plus');
$('#addBtn').addEventListener('click', () => openAdd());

loadYouTubeApi().catch(() => {}); // ready before the first tap, so videos start inside that tap
render();
takeSharedLink();
renderSourceList();
retryPendingMeta();
syncSources();
maybeRefreshDiscover();
addEventListener('online', () => { retryPendingMeta(); syncSources(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { syncSources(); maybeRefreshDiscover(); }
});
navigator.storage?.persist?.().catch(() => {});

const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && secure) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}
