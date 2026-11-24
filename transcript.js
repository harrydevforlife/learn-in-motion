// Podcast subtitles. Many shows publish a transcript per episode in their feed (the Podcasting 2.0
// <podcast:transcript> tag). This finds it, loads it and turns it into short timed lines.
import { loadFeed, request, viaJina, transcriptKind } from './feeds.js';

const feeds = new Map();       // feed URL → Promise<feed>, kept for this session
const transcripts = new Map(); // transcript URL → Promise<{ timed, lines }>
const remember = (map, key, make) => {
  if (!map.has(key)) map.set(key, make().catch((err) => { map.delete(key); throw err; })); // retry failures next time
  return map.get(key);
};

const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// The audio file's name identifies an episode, even when tracking prefixes or query strings differ.
const fileOf = (u) => {
  try {
    const name = decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() || '');
    return name.length >= 8 && !/^(audio|episode|default|media|stream|file|podcast)\.\w+$/i.test(name) ? name : '';
  } catch { return ''; }
};

/**
 * Look up an episode's transcript link in its show's feed. Returns { url, kind }, or null if the show
 * doesn't publish one. Throws if the feed can't be loaded.
 */
export async function findTranscript({ feedUrl, audioUrl, title }) {
  const { entries } = await remember(feeds, feedUrl, () => loadFeed(feedUrl));
  const file = fileOf(audioUrl);
  const name = norm(title);
  const e = (file && entries.find((x) => fileOf(x.audioUrl) === file)) || (name && entries.find((x) => norm(x.title) === name));
  return e?.transcriptUrl ? { url: e.transcriptUrl, kind: e.transcriptType } : null;
}

/** Load and parse a transcript: { timed: true, lines: [{ start, end, text, speaker }] } or { timed: false, lines: [{ text, speaker }] }. */
export function loadTranscript(url, kind) {
  return remember(transcripts, url, async () => {
    let raw;
    try { raw = await request(url, { timeout: 12000 }); } catch { raw = await viaJina(url, { 'X-Return-Format': 'text' }); } // CORS-blocked hosts
    return parseTranscript(raw, kind || transcriptKind('', url));
  });
}

/* --------------------------------------------------------------- parsing */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
  const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1);
  return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
});
const seconds = (s) => (s || '').trim().replace(',', '.').split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
// "SPEAKER_00" → "Speaker 1", "Speaker 2" stays, real names stay.
const speakerName = (s) => {
  const m = (s || '').trim().match(/^speaker[ _-]?(\d+)$/i);
  return m ? `Speaker ${/_/.test(s) ? +m[1] + 1 : +m[1]}` : (s || '').trim().slice(0, 40);
};

/** Clean one cue: drop markup, pull out the speaker ("<v Jack>" or "JACK:" / "Speaker 1:" / "Jane Doe:"). */
function cueParts(raw) {
  let speaker = '';
  let text = raw.replace(/<v(?:\.[\w.-]+)?\s+([^>]*)>/i, (_, name) => { speaker = name.replace(/="?"?\s*$/, ''); return ''; });
  text = decode(text.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  const m = text.match(/^([A-Z][A-Z .'’-]{1,30}|speaker[ _-]?\d+|[A-Z][a-z’']+ [A-Z][\w’'-]+):\s+(?=\S)/i);
  // Only name-like prefixes: all caps, "Speaker 2" or two capitalised words (so "Note: …" stays text).
  if (m && (/^[A-Z .'’-]+$/.test(m[1]) || /^speaker/i.test(m[1]) || /^[A-Z][a-z’']+ [A-Z]/.test(m[1]))) {
    speaker = m[1];
    text = text.slice(m[0].length);
  }
  return { text, speaker: speakerName(speaker) };
}

/** WebVTT and SRT: blocks with an "a --> b" timing line followed by text. */
function parseCues(text) {
  const cues = [];
  for (const block of text.replace(/\r/g, '').split(/\n[ \t]*\n/)) {
    const rows = block.split('\n');
    const i = rows.findIndex((r) => r.includes('-->'));
    if (i < 0) continue; // header, NOTE or STYLE block
    const [a, b = ''] = rows[i].split('-->');
    const start = seconds(a);
    const end = seconds(b.trim().split(/\s+/)[0]);
    const { text: t, speaker } = cueParts(rows.slice(i + 1).join(' '));
    if (t && Number.isFinite(start)) cues.push({ start, end: Number.isFinite(end) && end > start ? end : start + 2, text: t, speaker });
  }
  return cues;
}

/** Podcasting 2.0 JSON: { segments: [{ startTime, endTime, body, speaker }] }, often one word per segment. */
function parseJson(text) {
  const segments = JSON.parse(text).segments;
  if (!Array.isArray(segments)) throw new Error('not a transcript');
  return segments.map((s) => {
    const { text: t, speaker } = cueParts(String(s.body ?? ''));
    return { start: +s.startTime, end: +s.endTime, text: t, speaker: speakerName(s.speaker) || speaker };
  }).filter((c) => c.text && Number.isFinite(c.start));
}

const MAX = 90; // characters per subtitle line (about three lines on a phone)
/**
 * Turn cues of any length into subtitle-sized lines. Long cues (some shows use whole paragraphs)
 * are split into words with their time spread by length; short ones (some are single words) are
 * joined. A line ends at a sentence end, a speaker change or a pause.
 */
function toLines(cues) {
  cues.sort((a, b) => a.start - b.start);
  const units = [];
  let who = '';
  for (const c of cues) {
    who = c.speaker || who;
    const end = Math.max(c.end, c.start);
    if (c.text.length <= MAX) { units.push({ start: c.start, end, text: c.text, speaker: who }); continue; }
    const perChar = (end - c.start) / c.text.length;
    let t = c.start;
    for (const w of c.text.split(' ')) {
      const d = (w.length + 1) * perChar;
      units.push({ start: t, end: t + d, text: w, speaker: who });
      t += d;
    }
  }
  const lines = [];
  let cur = null;
  for (const u of units) {
    if (cur && (u.speaker !== cur.speaker || u.start - cur.end > 1.5 || cur.text.length + 1 + u.text.length > MAX)) { lines.push(cur); cur = null; }
    if (cur) { cur.text += ' ' + u.text; cur.end = u.end; } else cur = { ...u };
    const n = cur.text.length;
    if ((n >= MAX * 0.45 && /[.!?…]["”’)]?$/.test(cur.text)) || (n >= MAX * 0.75 && /[,;:]$/.test(cur.text))) { lines.push(cur); cur = null; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Untimed transcripts (HTML or plain text): paragraphs to read. */
function parseText(text) {
  const paras = /<p[\s>]/i.test(text)
    ? [...new DOMParser().parseFromString(text, 'text/html').querySelectorAll('p')].map((p) => p.textContent)
    : text.split(/\n[ \t]*\n/).length > 1 ? text.split(/\n[ \t]*\n/) : text.split('\n');
  const out = [];
  let who = '';
  for (const p of paras) {
    // Pages fetched through the relay come back as Markdown: keep link text, drop images and URLs.
    const line = p.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(^|\s)>\s/g, '$1').replace(/(\*{1,2}|_{2})(\S[^*_]*?)\1/g, '$2').replace(/\s+/g, ' ').trim();
    if (/^[^.!?]{1,40}:$/.test(line)) { who = line.slice(0, -1); continue; } // a speaker label on its own line
    const { text: t, speaker } = cueParts(line);
    if (speaker) who = speaker;
    if (t) out.push({ text: t, speaker: who });
  }
  return out;
}

export function parseTranscript(raw, kind) {
  const text = String(raw || '').replace(/^﻿/, '').trim();
  if (kind === 'json' || text.startsWith('{')) {
    try { return { timed: true, lines: toLines(parseJson(text)) }; } catch { /* not JSON after all */ }
  }
  if (text.slice(0, 5000).includes('-->')) {
    const cues = parseCues(text);
    if (cues.length) return { timed: true, lines: toLines(cues) };
  }
  return { timed: false, lines: parseText(text) };
}
