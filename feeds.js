// Sources: find the feed behind a link, load it, and parse RSS / Atom into plain entries.
// There is no backend, so feeds that block browser requests (CORS) are fetched through
// r.jina.ai (returns the raw file), and rss2json.com as a last resort.

const JINA = 'https://r.jina.ai/';
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
// Hosts known to block direct browser requests: skip straight to the relay.
const NO_CORS = /(^|\.)(youtube\.com|substack\.com|medium\.com|spotify\.com)$/i;

/** An error whose message is safe to show to the user. */
export class FeedError extends Error {}

export async function request(url, { headers, timeout = 15000, json = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json ? await res.json() : await res.text();
  } finally {
    clearTimeout(timer);
  }
}
export const getJSON = (url, opts) => request(url, { ...opts, json: true });
/** Fetch any URL through Jina Reader (works around CORS). Returns the raw body by default. */
export const viaJina = (url, headers = {}) => request(JINA + url, { headers: { 'X-Return-Format': 'html', ...headers }, timeout: 30000 });

/** Fetch a URL as text: directly if the site allows it, otherwise through Jina Reader. */
async function fetchText(url, { page = false } = {}) {
  if (!NO_CORS.test(new URL(url).hostname)) {
    try { return await request(url, { timeout: 8000 }); } catch { /* blocked: use the relay */ }
  }
  const headers = { 'X-Return-Format': 'html' };
  if (page) headers['X-Remove-Selector'] = 'script, style'; // we only need <head> tags
  return request(JINA + url, { headers, timeout: 25000 });
}

/* ------------------------------------------------------------- parsing */
const htmlDoc = (html) => new DOMParser().parseFromString(html, 'text/html');
// Text from HTML, keeping a space where paragraphs and line breaks were.
const plain = (html) => (html ? htmlDoc(html.replace(/<(br|\/p|\/div|\/li|\/h\d|\/blockquote)\b[^>]*>/gi, ' $&')).body.textContent.replace(/\s+/g, ' ').trim() : '');
// Podcast hosts append the same ad and privacy notices to every episode.
const BOILERPLATE = /\s*(Learn more about your ad choices\.? Visit \S+|See \S+ for privacy information\.?|Hosted on Acast\. See acast\.com\/privacy for more information\.?)/gi;
/** Collapse whitespace and drop podcast ad boilerplate. */
export const tidy = (s) => (s || '').replace(BOILERPLATE, ' ').replace(/\s+/g, ' ').trim();
const summarize = (html, max = 600) => { const t = tidy(plain(html)); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
const firstImg = (html) => (html || '').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
const child = (el, ...names) => {
  if (!el) return null;
  for (const n of names) { const c = [...el.children].find((x) => x.tagName === n); if (c) return c; }
  return null;
};
const txt = (el, ...names) => child(el, ...names)?.textContent.trim() || '';
const attr = (el, name, a) => child(el, name)?.getAttribute(a) || '';
const toDate = (s) => Date.parse(s) || 0;

export function parseDuration(t) {
  if (!t) return 0;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(+t);
  const p = t.split(':').map(Number);
  if (p.some(isNaN)) return 0;
  return p.reduce((acc, n) => acc * 60 + n, 0);
}

/** What a transcript link holds: timed cues (vtt, srt, json) or plain text (html, text). '' if unknown. */
export function transcriptKind(type, url) {
  const t = (type || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const path = u.split('?')[0];
  if (t.includes('vtt') || path.endsWith('.vtt')) return 'vtt';
  if (/srt|subrip/.test(t) || path.endsWith('.srt') || u.includes('format=subrip')) return 'srt';
  if (t.includes('json') || path.endsWith('.json')) return 'json';
  if (t.includes('html') || path.endsWith('.html')) return 'html';
  if (t.startsWith('text/') || path.endsWith('.txt')) return 'text';
  return '';
}
const TRANSCRIPT_RANK = { vtt: 0, srt: 1, json: 2, html: 3, text: 4 };
/** An episode can list several transcript formats; timed ones come first. */
function bestTranscript(item) {
  return [...item.children]
    .filter((c) => c.tagName === 'podcast:transcript' && /^https?:/i.test(c.getAttribute('url') || ''))
    .map((c) => ({ url: c.getAttribute('url'), kind: transcriptKind(c.getAttribute('type'), c.getAttribute('url')) }))
    .filter((x) => x.kind)
    .sort((a, b) => TRANSCRIPT_RANK[a.kind] - TRANSCRIPT_RANK[b.kind])[0];
}

const isAudio = (type, url) => /^audio\//i.test(type || '') || /\.(mp3|m4a|aac|ogg|opus|wav)(\?|$)/i.test(url || '');

function rssEntry(item) {
  const enc = child(item, 'enclosure');
  const encUrl = enc?.getAttribute('url') || '';
  const encType = enc?.getAttribute('type') || '';
  const html = txt(item, 'content:encoded') || txt(item, 'description') || txt(item, 'itunes:summary');
  const mc = child(item, 'media:content');
  const mcImage = mc && (/^image\//.test(mc.getAttribute('type') || '') || mc.getAttribute('medium') === 'image') ? mc.getAttribute('url') : '';
  const guid = child(item, 'guid');
  const link = txt(item, 'link') || (guid && guid.getAttribute('isPermaLink') !== 'false' ? guid.textContent.trim() : '');
  const audio = isAudio(encType, encUrl) ? encUrl : '';
  const transcript = audio ? bestTranscript(item) : null;
  return {
    key: guid?.textContent.trim() || link || encUrl,
    title: plain(txt(item, 'title')),
    link,
    videoId: '',
    audioUrl: audio,
    duration: parseDuration(txt(item, 'itunes:duration')),
    image: attr(item, 'itunes:image', 'href') || attr(item, 'media:thumbnail', 'url') || mcImage ||
      (/^image\//i.test(encType) ? encUrl : ''),
    contentImage: firstImg(html),
    description: summarize(txt(item, 'itunes:subtitle') || html),
    author: txt(item, 'dc:creator', 'itunes:author', 'author'),
    published: toDate(txt(item, 'pubDate', 'dc:date')),
    transcriptUrl: transcript?.url || '',
    transcriptType: transcript?.kind || '',
  };
}

function atomEntry(entry) {
  const links = [...entry.children].filter((c) => c.tagName === 'link');
  const alt = links.find((l) => (l.getAttribute('rel') || 'alternate') === 'alternate') || links[0];
  const encl = links.find((l) => l.getAttribute('rel') === 'enclosure');
  const group = child(entry, 'media:group');
  const videoId = txt(entry, 'yt:videoId');
  const html = txt(entry, 'content', 'summary');
  const audio = encl && isAudio(encl.getAttribute('type'), encl.getAttribute('href')) ? encl.getAttribute('href') : '';
  return {
    key: videoId ? 'yt:' + videoId : txt(entry, 'id') || alt?.getAttribute('href') || '',
    title: plain(txt(entry, 'title')),
    link: alt?.getAttribute('href') || '',
    videoId,
    audioUrl: audio,
    duration: 0,
    image: attr(group, 'media:thumbnail', 'url') || attr(entry, 'media:thumbnail', 'url'),
    contentImage: firstImg(html),
    description: videoId ? '' : summarize(html),
    author: txt(child(entry, 'author'), 'name'),
    published: toDate(txt(entry, 'published', 'updated')),
  };
}

function finish(meta, entries) {
  entries = entries
    .filter((e) => e.key && (e.link || e.audioUrl || e.videoId))
    // Episodes without their own art use the show's cover; posts fall back to the first image in the text.
    .map(({ contentImage, ...e }) => ({ ...e, image: e.image || (e.audioUrl ? meta.image : contentImage) || contentImage || '' }))
    .sort((a, b) => b.published - a.published);
  const audio = entries.filter((e) => e.audioUrl).length;
  const kind = entries.some((e) => e.videoId) ? 'youtube' : entries.length && audio >= entries.length / 2 ? 'podcast' : 'blog';
  return { title: plain(meta.title || ''), link: meta.link || '', image: meta.image || '', kind, entries };
}

/** Parse RSS 2.0, RSS 1.0 (RDF) or Atom text. Returns null if it isn't a feed. */
export function parseFeed(text) {
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 5000))) return null;
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  const root = doc.documentElement;
  if (root.tagName === 'feed') {
    const alt = [...root.children].find((c) => c.tagName === 'link' && (c.getAttribute('rel') || 'alternate') === 'alternate');
    return finish(
      { title: txt(root, 'title') || txt(child(root, 'author'), 'name'), link: alt?.getAttribute('href'), image: txt(root, 'logo', 'icon') },
      [...root.children].filter((c) => c.tagName === 'entry').map(atomEntry),
    );
  }
  const channel = child(root, 'channel');
  if (!channel) return null;
  const items = root.tagName === 'rss' ? [...channel.children] : [...root.children];
  return finish(
    { title: txt(channel, 'title'), link: txt(channel, 'link'), image: attr(channel, 'itunes:image', 'href') || txt(child(channel, 'image'), 'url') },
    items.filter((c) => c.tagName === 'item').map(rssEntry),
  );
}

function fromRss2Json(j) {
  if (j.status !== 'ok') throw new Error(j.message || 'rss2json failed');
  const entries = (j.items || []).map((it) => {
    const videoId = (it.link || '').match(/[?&]v=([\w-]{11})/)?.[1] || '';
    const enc = it.enclosure || {};
    return {
      key: videoId ? 'yt:' + videoId : it.guid || it.link,
      title: plain(it.title),
      link: it.link || '',
      videoId,
      audioUrl: isAudio(enc.type, enc.link) ? enc.link : '',
      duration: parseDuration(String(enc.duration || '')),
      image: it.thumbnail || (/^image\//.test(enc.type || '') ? enc.link : ''),
      contentImage: firstImg(it.description),
      description: videoId ? '' : summarize(it.description),
      author: it.author || '',
      published: toDate((it.pubDate || '').replace(' ', 'T') + 'Z'),
    };
  });
  return finish({ title: j.feed?.title, link: j.feed?.link, image: j.feed?.image }, entries);
}

/** Load and parse a feed URL, trying direct → Jina → rss2json. */
export async function loadFeed(feedUrl) {
  try {
    const feed = parseFeed(await fetchText(feedUrl));
    if (feed) return feed;
  } catch { /* try the next route */ }
  try {
    return fromRss2Json(await getJSON(RSS2JSON + encodeURIComponent(feedUrl)));
  } catch {
    throw new FeedError("Couldn't load that feed right now.");
  }
}

/* ------------------------------------------------------------ discovery */
function pageMeta(html, base) {
  const doc = htmlDoc(html);
  const meta = (p) => doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute('content') || '';
  const feeds = [...doc.querySelectorAll('link[rel~="alternate"]')]
    .filter((l) => /(rss|atom)\+xml/i.test(l.getAttribute('type') || ''))
    .map((l) => { try { return new URL(l.getAttribute('href'), base).href; } catch { return ''; } })
    .filter(Boolean);
  return { feeds, siteName: meta('og:site_name'), title: meta('og:title') || doc.title?.trim() || '', image: meta('og:image') };
}

/** Load a known feed URL and describe it as a source (used by Discover's Follow buttons too). */
export async function fromFeed(feedUrl, hints = {}) {
  const feed = await loadFeed(feedUrl);
  if (!feed.entries.length) throw new FeedError('Found the feed, but it has no posts yet.');
  return {
    feedUrl,
    kind: hints.kind || feed.kind,
    title: hints.title || feed.title || hints.pageTitle || new URL(feedUrl).hostname,
    image: hints.image || feed.image || '',
    link: hints.link || feed.link || feedUrl,
    feed,
  };
}

// Spotify's oEmbed gives the latest episode's title, but its small embed page names the show.
async function spotifyShowName(showId) {
  const page = await fetchText(`https://open.spotify.com/embed/show/${showId}`);
  const m = page.match(/"subtitle":"((?:[^"\\]|\\.)*)"/);
  if (m) { try { return JSON.parse(`"${m[1]}"`); } catch { /* fall through */ } }
  return plain(page.match(/<title>.*? - (.+?) \| Spotify<\/title>/)?.[1] || '');
}

const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Turn any link into a followable source: { feedUrl, kind, title, image, link, feed }.
 * Throws FeedError with a readable message when nothing can be found.
 */
export async function discover(input) {
  let u;
  try { u = new URL(input); } catch { throw new FeedError("That doesn't look like a link."); }
  const host = u.hostname.replace(/^(www|m)\./, '');

  try {
    if (host === 'youtube.com' || host === 'youtu.be') {
      const list = u.searchParams.get('list');
      if (list) {
        if (/^(WL|LL)$/.test(list)) throw new FeedError('Watch Later and Liked videos are private, so they can’t be followed. Make a normal playlist instead.');
        return await fromFeed(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(list)}`, { kind: 'youtube', link: `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}` });
      }
      const seg = u.pathname.split('/').filter(Boolean);
      if (!seg.length || !/^(@|channel$|c$|user$)/.test(seg[0])) throw new FeedError('Paste a channel link (like youtube.com/@name) or a playlist link.');
      const home = 'https://www.youtube.com/' + seg.slice(0, seg[0].startsWith('@') ? 1 : 2).join('/');
      let feedUrl = /^UC[\w-]{22}$/.test(seg[1] || '') && seg[0] === 'channel' ? `https://www.youtube.com/feeds/videos.xml?channel_id=${seg[1]}` : '';
      let meta = { feeds: [] };
      try { meta = pageMeta(await fetchText(home, { page: true }), home); } catch { /* use what we have */ }
      feedUrl ||= meta.feeds.find((f) => f.includes('channel_id='));
      if (!feedUrl) throw new FeedError("Couldn't find that YouTube channel.");
      return await fromFeed(feedUrl, { kind: 'youtube', title: meta.title, image: meta.image, link: home });
    }

    if (host === 'podcasts.apple.com') {
      const id = u.pathname.match(/\/id(\d+)/)?.[1];
      const cc = u.pathname.match(/^\/([a-z]{2})\//)?.[1] || 'us';
      if (!id) throw new FeedError('Paste the link of a podcast show from Apple Podcasts.');
      const show = (await getJSON(`https://itunes.apple.com/lookup?id=${id}&country=${cc}`)).results?.[0];
      if (!show?.feedUrl) throw new FeedError("This podcast doesn't share a public feed.");
      return await fromFeed(show.feedUrl, { kind: 'podcast', title: show.collectionName, image: show.artworkUrl600, link: show.collectionViewUrl });
    }

    if (host === 'open.spotify.com') {
      // Spotify has no public feeds, so find the same show on Apple Podcasts by name.
      const showId = u.pathname.match(/\/show\/([A-Za-z0-9]{22})/)?.[1];
      if (!showId) throw new FeedError('To follow a podcast, paste the Spotify link of the show, not an episode.');
      const title = await spotifyShowName(showId);
      if (!title) throw new FeedError("Couldn't read that Spotify show.");
      const results = (await getJSON(`https://itunes.apple.com/search?media=podcast&limit=10&term=${encodeURIComponent(title)}`)).results || [];
      const hit = results.find((r) => norm(r.collectionName) === norm(title)) ||
        results.find((r) => norm(r.collectionName).includes(norm(title)) || norm(title).includes(norm(r.collectionName)));
      if (!hit?.feedUrl) throw new FeedError(`Couldn't find "${title}" outside Spotify, so it can't be followed.`);
      return await fromFeed(hit.feedUrl, { kind: 'podcast', title: hit.collectionName, image: hit.artworkUrl600, link: u.href });
    }

    if (host === 'medium.com') {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (seg) return await fromFeed(`https://medium.com/feed/${seg}`, { kind: 'blog' });
    }
    if (host.endsWith('.medium.com') || host.endsWith('.substack.com')) {
      return await fromFeed(`https://${host}/feed`, { kind: 'blog' });
    }

    // Anything else: either the link is a feed, or a page that points to its feed.
    const text = await fetchText(u.href);
    if (parseFeed(text)) return await fromFeed(u.href);
    const meta = pageMeta(text, u.href);
    const hints = { pageTitle: meta.siteName || meta.title, image: meta.image }; // the feed's own title is usually cleaner
    for (const f of meta.feeds.slice(0, 3)) {
      try { return await fromFeed(f, hints); } catch { /* try the next one */ }
    }
    for (const path of ['/feed', '/rss.xml', '/atom.xml']) {
      try {
        const guess = new URL(path, u.origin).href;
        const feed = parseFeed(await fetchText(guess));
        if (feed?.entries.length) return { feedUrl: guess, kind: feed.kind, title: feed.title || hints.pageTitle, image: hints.image || feed.image, link: u.origin, feed };
      } catch { /* not there */ }
    }
    throw new FeedError("Couldn't find a feed on that site.");
  } catch (err) {
    if (err instanceof FeedError) throw err;
    throw new FeedError("Couldn't reach that site. Check the link and try again.");
  }
}

/** Look up an Apple Podcasts episode (audio file, artwork, duration) by show and episode id. */
export async function appleEpisode(showId, episodeId, country = 'us') {
  const r = await getJSON(`https://itunes.apple.com/lookup?id=${showId}&country=${country}&entity=podcastEpisode&limit=200`);
  const results = r.results || [];
  return {
    show: results.find((x) => x.kind === 'podcast') || results[0],
    episode: episodeId ? results.find((x) => String(x.trackId) === String(episodeId)) : null,
  };
}
