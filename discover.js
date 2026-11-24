// Discover: find things to learn about a topic, using open APIs that work from the browser
// with no backend and no API keys. Every function returns plain objects, or [] on failure.
import { getJSON, viaJina, parseDuration, tidy } from './feeds.js';

const enc = encodeURIComponent;
const text = (x) => x?.simpleText || x?.runs?.map((r) => r.text).join('') || '';
const https = (u) => (u && u.startsWith('//') ? 'https:' + u : u || '');
const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n);
// Cards show up to 600 characters of text (the item limit), with an ellipsis when cut.
const clip = (s, max = 600) => { const t = tidy(s); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };

/** YouTube search (videos only, 3 min or longer), read from the results page's ytInitialData. */
export async function youtubeVideos(query) {
  // sp=EgIQAQ== is YouTube's "type: video" filter; it is double-encoded because the URL goes through Jina.
  const html = await viaJina(`https://www.youtube.com/results?search_query=${enc(query)}&sp=EgIQAQ%253D%253D&hl=en&gl=US`, { 'X-Engine': 'direct' });
  const start = html.indexOf('var ytInitialData = ');
  if (start < 0) return [];
  const end = html.indexOf('</script>', start);
  const data = JSON.parse(html.slice(start + 'var ytInitialData = '.length, end).trim().replace(/;$/, ''));
  const found = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.videoRenderer) { found.push(o.videoRenderer); return; }
    for (const k in o) walk(o[k]);
  })(data);
  return found.map((v) => {
    const owner = v.ownerText?.runs?.[0] || v.longBylineText?.runs?.[0] || {};
    return {
      videoId: v.videoId,
      title: text(v.title),
      channel: owner.text || '',
      channelId: owner.navigationEndpoint?.browseEndpoint?.browseId || '',
      channelImage: https(v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url),
      duration: parseDuration(text(v.lengthText)),
      views: (() => { const n = +text(v.viewCountText).replace(/[^\d]/g, ''); return n ? `${compact(n)} views` : ''; })(),
      published: text(v.publishedTimeText),
    };
  }).filter((v) => /^[\w-]{11}$/.test(v.videoId || '') && v.title && v.duration >= 180);
}

/**
 * The "Most replayed" part of a video, from the heatmap YouTube shows over its progress bar.
 * Returns { start, end, duration } in seconds (start 0 when the video has no heatmap, e.g. few views).
 * The watch page is big (about 1.5 MB), so callers cache the answer.
 */
export async function youtubeHighlight(videoId) {
  const html = await viaJina(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { 'X-Engine': 'direct' });
  const heat = [...html.matchAll(/"startMillis":"(\d+)","durationMillis":"(\d+)","intensityScoreNormalized":([\d.eE-]+)/g)]
    .map((m) => ({ at: +m[1] / 1000, len: +m[2] / 1000, score: +m[3] }));
  // The heatmap covers the whole video, so its end is the video's length.
  const duration = Math.round(Math.max(0, ...heat.map((h) => h.at + h.len)));
  const scoreAt = (t) => heat.find((h) => t >= h.at && t < h.at + h.len)?.score || 0;
  // YouTube labels the peaks "Most replayed"; pick the strongest one.
  const labelled = [...html.matchAll(/"visibleTimeRangeStartMillis":(\d+),"visibleTimeRangeEndMillis":(\d+),"decorationTimeMillis":(\d+),"label":\{"runs":\[\{"text":"Most replayed"\}/g)]
    .map((m) => ({ start: +m[1] / 1000, end: +m[2] / 1000, score: scoreAt(+m[3] / 1000) }));
  // Without labels, use the hottest heatmap slice, ignoring the opening and the ending.
  const fromHeat = heat.filter((h) => h.at > duration * 0.05 && h.at < duration * 0.95)
    .map((h) => ({ start: Math.max(0, h.at - 3), end: h.at + h.len * 4, score: h.score }));
  const best = (labelled.length ? labelled : fromHeat).sort((a, b) => b.score - a.score)[0];
  const start = best && best.start >= 20 ? Math.round(best.start) : 0; // a peak at the very start isn't worth skipping to
  return { start, end: start ? Math.round(best.end) : 0, duration };
}

/**
 * Latest episodes (5 min or longer) of one show, with direct audio URLs.
 * Raw episode search surfaces a lot of low-effort shows; established shows' episodes are better picks.
 */
export async function showEpisodes(showId, limit = 2) {
  const r = await getJSON(`https://itunes.apple.com/lookup?id=${showId}&entity=podcastEpisode&limit=${limit + 3}&country=US`);
  return (r.results || []).filter((e) => e.wrapperType === 'podcastEpisode' && e.episodeUrl && (e.trackTimeMillis || 0) >= 300000).slice(0, limit).map((e) => ({
    title: e.trackName,
    show: e.collectionName,
    audioUrl: e.episodeUrl,
    image: e.artworkUrl600 || e.artworkUrl160 || '',
    duration: Math.round(e.trackTimeMillis / 1000),
    published: Date.parse(e.releaseDate) || 0,
    description: clip(e.description || e.shortDescription),
    link: e.trackViewUrl || '',
    feedUrl: e.feedUrl || '',
  }));
}

/** Podcast shows to follow. */
export async function podcastShows(query) {
  const r = await getJSON(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=8&country=US&lang=en_us&term=${enc(query)}`);
  return (r.results || []).filter((s) => s.feedUrl && (s.trackCount || 0) >= 15).map((s) => ({
    id: s.collectionId, title: s.collectionName, author: s.artistName, feedUrl: s.feedUrl, image: s.artworkUrl600 || '', link: s.collectionViewUrl || '', count: s.trackCount || 0,
  }));
}

/** Well-received stories from Hacker News (100+ points). */
export async function hnStories(query, page = 0) {
  const r = await getJSON(`https://hn.algolia.com/api/v1/search?query=${enc(query)}&tags=story&numericFilters=points%3E100&hitsPerPage=12&page=${page}`);
  return (r.hits || []).filter((h) => h.url && h.title && !/news\.ycombinator\.com/.test(h.url)).map((h) => ({
    title: h.title, url: h.url, points: h.points || 0, comments: h.num_comments || 0, published: (h.created_at_i || 0) * 1000,
  }));
}

/** Top dev.to articles for a tag (only returns something for tech-ish topics). */
export async function devArticles(topic, page = 1) {
  const tag = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!tag) return [];
  const list = await getJSON(`https://dev.to/api/articles?tag=${enc(tag)}&top=365&per_page=8&page=${page}`);
  return (Array.isArray(list) ? list : []).map((a) => ({
    title: a.title, url: a.url, description: a.description || '', image: a.cover_image || a.social_image || '',
    author: a.user?.name || '', username: a.user?.username || '', avatar: a.user?.profile_image_90 || '',
    minutes: a.reading_time_minutes || 0, published: Date.parse(a.published_at) || 0,
  }));
}

/** Wikipedia articles with a short intro and a picture. */
export async function wikiArticles(query, offset = 0) {
  const r = await getJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search' +
    `&gsrsearch=${enc(query)}&gsrlimit=6&gsroffset=${offset}&prop=extracts|pageimages|info&exintro=1&explaintext=1&exsentences=3` +
    '&piprop=thumbnail&pithumbsize=800&inprop=url');
  return Object.values(r.query?.pages || {}).sort((a, b) => a.index - b.index).filter((p) => p.extract).map((p) => ({
    title: p.title, url: p.fullurl, extract: clip(p.extract), image: p.thumbnail?.source || '',
  }));
}

/** Blogs and newsletters to follow, from Feedly's public feed search. */
export async function blogFeeds(query) {
  const raw = await viaJina(`https://cloud.feedly.com/v3/search/feeds?query=${enc(query)}&count=12&locale=en`, { 'X-Return-Format': 'text' });
  const r = JSON.parse(raw);
  // Feedly matches loosely ("AI" finds "Ain't It Cool News"), so the topic must appear as a whole word.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean).map((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu'));
  const relevant = (f) => { const t = `${f.title || ''} ${f.description || ''}`; return words.every((re) => re.test(t)); };
  return (r.results || [])
    .filter((f) => f.feedId?.startsWith('feed/') && !/youtube\.com|news\.google/.test(f.feedId) && (!f.language || f.language.startsWith('en')) && relevant(f))
    .sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0))
    .map((f) => ({
      title: f.title, feedUrl: f.feedId.slice(5), link: f.website || '', description: f.description || '',
      subscribers: f.subscribers || 0, image: f.visualUrl || f.iconUrl || '',
    }));
}
