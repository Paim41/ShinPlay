<div align="center">

<img width="90" height="90" alt="shinplay-logo" src="https://github.com/user-attachments/assets/6a0dc6da-ef07-43b3-a723-8831ee54ef4b" />

# ShinPlay
**A clean little theater for your YouTube music queue.**

Paste a link, build a queue, save favorites, and keep controls close — on any screen, installable as an app, and fully offline-capable.

[![Live Demo](https://img.shields.io/badge/PLAY%20NOW-Live%20Demo-F34E39?style=for-the-badge&logo=vercel&logoColor=white)](https://shin-play.vercel.app/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-C0C7D5?style=for-the-badge&logoColor=black)](https://shin-play.vercel.app/)
[![Local First](https://img.shields.io/badge/Local--First-Storage-DEE4F1?style=for-the-badge&logoColor=black)](https://shin-play.vercel.app/)
[![Type](https://img.shields.io/badge/Type-Music%20Player-F34E39?style=for-the-badge)](https://shin-play.vercel.app/)

</div>

---

## About

ShinPlay is a **YouTube link-in, music-out** player — paste a URL, and it becomes part of your own local queue.

Everything — queue, favorites, history, playlists — stays on your device. No account, no server-side tracking, no stream ripping. Just a clean player wrapped around the videos you already have links to.

> *"Play more, smile more."*

---

## Experience Flow

```
Paste YouTube URL or Video ID
    ↓
Load / Add to Queue   →  Builds your local session
    ↓
Play                  →  Video, Audio Only, or Theater mode
    ↓
Shape the Sound       →  Speed, EQ, waveform, sleep timer
    ↓
Save & Export         →  Favorites, history, playlists, JSON/M3U/CSV
```

---

## Features

- **Local Queue & Library** — Queue, favorites, and history saved entirely on your device
- **Audio Only & Theater Modes** — Strip the video or go fullscreen-focused
- **Playback Controls** — Adjustable speed (0.5x–2x), waveform view, quick bass/treble tone controls
- **Sleep Timer** — Gentle fade-out at 10/20/30/60 minutes
- **Browse with Your Own API Key** — Optional YouTube Data API key (stored only in-browser) for in-app search with duration/date filters
- **Import & Export** — Save your queue as JSON, M3U, or CSV, or export thumbnails and share links
- **PWA Support** — Installable, works offline via service worker
- **Keyboard Shortcuts** — Full keyboard control without touching the mouse
- **No Ripping** — Never extracts YouTube audio/video streams — links stay official

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Shift` + `→` | Next track |
| `Shift` + `←` | Previous track |
| `?` | Open shortcuts sheet |

---

## Built For

```
Purpose  → Distraction-free, local-first YouTube listening
Type     → Progressive Web App (PWA)
Storage  → On-device only — no accounts, no server sync
Not For  → Downloading or ripping media
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 |
| Interactivity | Vanilla JavaScript |
| Offline Support | Service Worker (`sw.js`), Web App Manifest |
| Hosting | Vercel |

No frameworks. No build step. Just clean, intentional web code.

---

## Project Structure

```
shinplay/
├── index.html          # Player, browse, queue, library UI
├── style.css            # Visual design, layout, theming
├── app.js               # Playback logic, queue, storage, EQ
├── sw.js                # Service worker for offline support
├── manifest.json        # PWA install configuration
└── assets/              # Logo and icons
```

---

## Deploying Your Own Version

1. Fork or clone this repository
2. Adjust branding, colors, and defaults in `style.css` and `app.js`
3. Deploy instantly for free on [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/)
4. Install it as an app straight from the browser

---

## Roadmap / Ideas

- [ ] Cross-device sync via optional account
- [ ] Collaborative shared queues
- [ ] More granular EQ presets
- [ ] Lyrics / now-playing metadata panel
- [ ] Custom themes beyond light/dark

---

<div align="center">

*ShinPlay — play more, smile more.*

[shin-play.vercel.app](https://shin-play.vercel.app/)

</div>
