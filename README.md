# Learn in Motion

A mobile-first web app (PWA) for learning from the videos, podcasts and articles you save or follow, one card at a time in a vertical feed.
Nothing to build, no backend, no account. It's plain HTML, CSS and JS.

**The loop:** copy a link → tap **+** → **Paste** → scroll the feed → watch or read → write a one-line **takeaway** → tap **Got it**.
Learned items move to the **Learned** tab with their takeaways, so you can scroll back through them to review.

## Features

- Full-screen vertical feed with snap scrolling (one item per swipe)
- Actions sit in a **rail of icon buttons** down the right side: Got it, Note and Open (Save, Skip, Follow and Open in Discover). **⋯** at the bottom folds them away or brings them back. **Long-press a card** for its menu: edit, copy link, share, delete
- Under every picture, a strip shows what it is and how long. While a video plays it gets the same controls as the podcast player: a **seek bar** with the most replayed part marked, elapsed and remaining time, speed, back 15 s, **play/pause** and forward 30 s. The **★ chip** jumps to the most replayed part
- When a card's text doesn't fit, it scrolls inside the card (a fade shows there's more). The ↙↗ button at the right end of that strip switches every card to **compact**: a small thumbnail next to the source, so the title and text get the room. It holds while playing too, so you can listen to an episode (its player bar stays full width under the thumbnail) and read
- **Turn the phone sideways** to watch: a video or an episode fills the screen (16:9 at full height where the phone allows), with back 15 s, play/pause and forward 30 s in a column beside it, and the seek bar and times over the bottom of the picture. Articles show the picture on the left and, on the right, the source with Note and Got it, the title, a few lines and a **Read the article** button. Tabs, topics and the menu come back when you turn the phone upright, on the same card
- At the end of a video or episode, the takeaway sheet opens: write what you'll remember, then **Save & mark learned**
- YouTube videos and Shorts play inline. Timestamps like `&t=90` are kept, a video stops when you scroll past it, and it resumes where you left off
- **Autoplay**: a card's video or episode starts as soon as the card slides into view (Menu → Autoplay).
  iOS only allows sound after a tap, once per player: tap play inside the first video, and play on the first episode (any tap in the app also unlocks episodes).
  The feed shares one YouTube player and one audio player, so after that, the next ones start with sound by themselves.
  To check playback on a phone, open the app with `?debug=1`: a small log of play events appears
- **Start at highlights**: a YouTube video you haven't started begins at its "Most replayed" part, the peak of the heatmap YouTube shows over the progress bar.
  A toast offers **From start**. Videos with few views have no heatmap and start from the beginning (Menu → Start at highlights)
- Podcasts:
  - Apple Podcasts and feed episodes play in the app's own player, under the artwork: a seek bar with elapsed and remaining time, back 15 s, forward 30 s and speed (1× to 2×). It remembers where you stopped, and the lock screen's skip buttons work too
  - Spotify episodes play in Spotify's own player
  - When an episode ends, the app offers to mark it learned
  - **Subtitles** for shows that publish a transcript in their feed (the Podcasting 2.0 `<podcast:transcript>` tag; many indie and tech shows do, most big network shows don't).
    The **CC** button on the player turns them on or off. Tap the subtitle to read the full transcript, and tap a line there to jump to it.
    If the subtitles run early or late (some hosts insert ads into the audio), use **Out of sync?** and tap the line you're hearing
- Articles show title, description and preview image, and open in Safari
- **Follow sources**: tap **+** → **Follow a source** and paste one of the links below. On first follow, the 3 newest posts come in. After that, new posts land in Up next on their own (checked when the app opens, at most every 30 min)
  - YouTube channels (`youtube.com/@name`) and playlists
  - Podcasts (Apple Podcasts or Spotify show link)
  - Substack, Medium, or any blog or RSS/Atom feed
- Manage what you follow in the **Sources** tab
- **Discover**: pick a few interests and it finds things to learn on its own
  - What you get: YouTube videos, podcast episodes from established shows, and articles from Hacker News, dev.to and Wikipedia, mixed into one feed
  - Every few cards there's a "Sources to follow" card with YouTube channels, podcasts and blogs for that topic
  - Each card has **Save** (to Up next), **Skip** (never shown again), **Follow** (its channel, show or blog) and **Open**
  - Suggestions refresh after 6 hours. **Load more** at the end of the feed fetches another batch
- Titles and previews are filled in automatically
- Topics with filter chips, plus a shuffle mode
- Takeaway notes and a Learned tab
- Quiet by default: confirmations like "Saved" or "Link copied" (and their Undo) only show when **Menu → Action messages** is on. Errors always show
- Light and dark mode: **Menu → Appearance** cycles **Light → Dark → Auto** (Auto follows the phone)
- Export and import a JSON backup (opens the iOS share sheet)
- Works offline once installed: the app shell is cached by a service worker

## Run it locally

```bash
python3 -m http.server 5173
# then open http://localhost:5173
```

To try it on your iPhone, connect it to the same Wi-Fi and open `http://<your-mac-ip>:5173` in Safari.
Get the IP with `ipconfig getifaddr en0`.
Over plain `http` the service worker and the **Paste** button don't work: iOS only allows them on HTTPS.
Long-press the field to paste instead.

## Put it on the internet (HTTPS) and install it

Any static host works. Upload the folder as it is:

- **GitHub Pages**: push to a repo, then Settings → Pages → deploy from branch
- **Cloudflare Pages**, **Netlify** or **Vercel**: point them at this folder, with no build command

Then on your iPhone:

1. Open the HTTPS URL in **Safari**
2. Tap **Share**, then **Add to Home Screen**
3. Launch it from the home screen. It runs full screen like a native app

> On iOS the Home Screen app has **its own storage**, separate from Safari.
> Each URL (origin) also has its own data. If you move hosts, use **Menu → Export backup** and then **Import backup**.

## Save from the Share sheet (iOS Shortcut)

Opening the app as `…/learn-in-motion/?add=<link>` saves the link straight away (also `?text=` with a link inside, and an optional `&topic=`).
An iOS Shortcut turns that into a **Save to Learn** button in the Share sheet. Make it once in the **Shortcuts** app:

1. Tap **+** for a new shortcut and name it **Save to Learn**
2. Open its details (ⓘ) and turn on **Show in Share Sheet**. In the "Receive" action at the top, keep only **URLs**, **Safari web pages** and **Text**. Set "If there's no input" to **Get Clipboard**
3. Add **URL Encode**, with **Shortcut Input** as its input
4. Add **Text** and type `https://harrydevforlife.github.io/learn-in-motion/?add=`, then insert the **URL Encoded Text** variable right after it
5. Add **Open URLs**

Then in YouTube, Safari or Podcasts: **Share → Save to Learn**.

> Shortcuts open links in **Safari**, not in the Home Screen app, and the two keep separate data on iOS.
> So links saved this way land in the Safari copy of the app. Use the app from Safari if you rely on this.

## Where your data lives

- Everything is in `localStorage` on the device. There is no server and no sync.
- To fetch titles and previews, the app sends the link you save to:
  - YouTube oEmbed (with noembed.com as a fallback) for videos
  - Spotify oEmbed, and Apple's iTunes API, for podcasts
  - microlink.io for articles. Its free tier is ~50 lookups a day; when that runs out, r.jina.ai is used for the title
- Highlights come from each video's YouTube page, fetched through r.jina.ai once per video (about 1.5 MB each, only for videos you reach).
- Discover searches those same services, plus Hacker News (Algolia), dev.to and Wikipedia, with your interest keywords. YouTube search and Feedly's feed search go through r.jina.ai.
  A YouTube search page is about 1.5 MB, so each Discover refresh downloads a few MB.
- Podcast transcripts are loaded from the podcast's own host (through r.jina.ai when the host blocks browser requests). To find one, the app loads the show's feed once per episode.
- Followed feeds are loaded directly when the site allows it (most podcast feeds do).
  YouTube, Substack, Medium and most blogs block that, so their feeds go through r.jina.ai, with rss2json.com as a backup.
  Both are free services with rate limits, which is fine for personal use.
- Export a backup now and then, especially before clearing Safari data.

## Files

| File | What it is |
|---|---|
| `index.html` | App shell, sheets (add, note, menu) and iOS meta tags |
| `styles.css` | All styles: minimal, light and dark themes, mobile-first, safe-area aware |
| `app.js` | State, link parsing, rendering, players, sources, metadata lookups, backup |
| `feeds.js` | Finds the feed behind a link, loads it, parses RSS / Atom |
| `discover.js` | Discover's search providers (YouTube, iTunes, Hacker News, dev.to, Wikipedia, Feedly) |
| `transcript.js` | Podcast subtitles: finds an episode's transcript, parses WebVTT / SRT / JSON / HTML into timed lines |
| `sw.js` | Service worker: network first, cached shell as fallback |
| `manifest.webmanifest` | PWA manifest (name, icons, standalone display) |
| `icons/` | App icons, generated by `node scripts/make-icons.mjs` |

When you add a new file to the app shell, also add it to `SHELL` in `sw.js` and bump `VERSION`.

## Ideas for later

See [ROADMAP.md](ROADMAP.md) for the list of planned improvements, in order of priority.
