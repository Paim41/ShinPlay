<div align="center">

# ShinPlay
**A premium YouTube audio & video player — built to keep playing, everywhere.**

Paste a link, browse YouTube, build a queue, and let it play in the background —
even with your phone screen off. Installable as a home-screen app.

</div>

---

## About

ShinPlay is a **YouTube link-in, music-out** web player, redesigned from the ground up
with a neatly organized card layout, a Browse tab for searching YouTube, a Library for
favorites & history, and background/lock-screen playback support for mobile.

> *"Paste a YouTube URL to begin."*

---

## Features

- **Player** — paste a URL or video ID, full glass-styled player with waveform, live indicator, theater mode
- **Queue** — build a full playback queue, shuffle, repeat (off / all / one), drag-free reorder via play-on-tap
- **Browse** — search YouTube directly inside the app using the official YouTube Data API (bring your own free API key)
- **Library** — save favorites and automatically track recently played history, both as neat card grids
- **Background & lock-screen playback** — Wake Lock + silent-audio-session keep-alive, plus full Media Session integration so lock-screen/notification controls (play, pause, next, previous, seek) work
- **Install to Home Screen** — full PWA manifest + service worker; installs like a native app on Android/desktop, with manual "Add to Home Screen" guidance on iOS
- **Audio Only Mode** — strip the video and keep just the sound
- **Playback speed control** — 0.5x–2x
- **Sleep timer** — auto-pause after 10/20/30/60 minutes
- **Mini Player & Picture-in-Picture**
- **Dark / Light theme**
- **Export** — download your queue, favorites and history as a `.json` file
- **Keyboard shortcuts** — `Space` play/pause, `Shift + →/←` next/previous
- **No account needed**

---

## A note on downloading videos

ShinPlay does **not** rip or download YouTube videos directly. Extracting video/audio
files from YouTube requires bypassing YouTube's own systems, which breaks YouTube's
Terms of Service and creators' copyright — so that isn't something this app does.
Instead, ShinPlay lets you jump straight to the video on YouTube, or export your
queue/library as a file. For legitimate offline viewing, YouTube's own app offers
official downloads (e.g. with YouTube Premium) for content you have rights to.

---

## Background playback — what actually works

- **Android Chrome/Edge**: reliably keeps audio playing with the screen off, using a
  screen Wake Lock plus a Media Session so your lock screen shows play/pause/skip controls.
- **iOS Safari**: Apple restricts background execution of embedded video more heavily.
  ShinPlay uses a silent-audio-session trick to extend playback time, but iOS may still
  suspend the page after the screen locks. This is a platform limitation, not a setting
  you can toggle inside the app.
- **Desktop browsers**: playback continues normally when the tab is backgrounded or minimized.

---

## Browsing YouTube in-app

The Browse tab uses the official **YouTube Data API v3** search endpoint. Add your own
free API key in **Settings** (enable "YouTube Data API v3" in the
[Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
and create an API key) — it's stored only in your browser's local storage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup / Styling | Plain HTML5 + CSS3 (custom glass design system) |
| Interactivity | Vanilla JavaScript, YouTube IFrame Player API |
| Search | YouTube Data API v3 (client-supplied key) |
| Installability | Web App Manifest + Service Worker |
| Background playback | Wake Lock API, Media Session API, silent AudioContext loop |

---

## Project Structure

```
shinplay/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── sw.js
├── icon-192.png
├── icon-512.png
├── icon-512-maskable.png
├── apple-touch-icon.png
├── celestial-desktop.mp4
└── celestial-mobile.mp4
```

---

## Running it

Any static file server works, e.g.:

```
npx serve .
```

Then open the shown local URL. To test installability, serve over HTTPS (or `localhost`,
which browsers treat as a secure context).

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Shift + →` | Next in queue |
| `Shift + ←` | Previous in queue |

---

<div align="center">

*ShinPlay — paste a link, and let it play — everywhere.*

</div>
