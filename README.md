# Karaoke Song Player

Frontend-only SPA for kiosk karaoke usage. Built with Vue 3, Vite, TypeScript, Pinia, and localStorage persistence.

## Current Status

Phase A (offline core) is implemented with:
- runtime config loading from config.json before app mount
- fatal startup error for missing/invalid config
- base + override theme loading
- local song catalog loading and mapping
- search-as-you-type with normalization, typo tolerance, and Greek transliteration
- genre filter and reset flow
- batched endless list rendering
- fullscreen playback with close, pause/resume, restart controls
- auto-hide playback controls on inactivity
- local play-event logging
- statistics dashboard, charts, advanced lists, and JSON export
- no-results song request form with localStorage persistence and duplicate prevention
- unit and component test baseline for core modules

Phase B (online search + video) is implemented with:
- configurable search providers (Invidious, YouTube)
- configurable video providers (YouTube, Invidious)
- Invidious search + YouTube iframe playback
- automatic fallback to online search when no local results match
- explicit "Online suchen" button
- same-card rendering for online results
- local stats logging for online plays with `source="online"`
- fatal startup error if YouTube search is configured without a secret API key

Still out of scope:
- AI suggestions (Phase C)

## Install

Requirements:
- Node.js 20+
- npm 10+

Commands:
- npm install
- npm run dev
- npm run build
- npm run preview

## Docker

Minimal container setup is included via Docker Compose.

- Dev server (HTTP):
	- docker compose up app
	- open http://localhost:5173
- Build in container:
	- docker compose run --rm build
- Unit/component tests in container:
	- docker compose run --rm test

Exposed ports:
- 5173 for Vite dev server
- 4173 reserved for Vite preview if you run it manually in the container

Notes:
- Docker context ignores archive data and local secrets via .dockerignore.
- songs.json and extra_metadata.json are excluded from Docker context and should stay uncommitted.

## Tests

- npm test
- npm run test:watch
- npm run test:e2e

## Runtime Config

App startup requires public/config.json.

Start from public/config.example.json and adjust values.

Required top-level sections:
- theme
- features
- search
- providers
- ai
- paths

Important fields:
- theme.name
- theme.title
- search.batchSize
- search.maxDisplayCount
- paths.songsJson
- paths.videosBase
- paths.coversBase

Provider configuration:
- `providers.searchProviders`: array of `{ "type": "invidious" | "youtube", "baseUrls": string[] }`
- `providers.videoProviders`: array of `{ "type": "youtube" | "invidious", "baseUrls": string[] }`
- Set `features.onlineSearch: true` and add at least one search provider to enable online search.
- Video provider `baseUrls` are currently only used by the Invidious video provider (not yet implemented).

If config.json is missing or invalid, app startup intentionally fails with a visible error screen.

If `providers.searchProviders` contains `{ "type": "youtube" }`, the app also requires `youtubeApiKey` in `secret-config.json` and will fail to start without it.

## Theme Guide

Theme architecture:
- base styles: public/themes/base.css
- event/theme override: public/themes/<theme-name>/theme.css

To create a new theme:
1. Create a folder public/themes/<theme-name>/.
2. Add these required files in that folder:
	- theme.css
	- logo.svg
	- cover_fallback.svg
3. Change only the visual overrides you need in theme.css.
4. Set theme.name in config.json to <theme-name>.
5. Set the visible app header/browser title via theme.title.

## Song Data Format

Config field paths.songsJson points to your song file.

Each entry supports:
- filename (required)
- id, title, artist (optional)
- genre as string or string[] (optional)
- duration_seconds (optional)
- file and cover path overrides (optional)
- has_cover (optional)

Rules used by app:
- missing file -> paths.videosBase + filename + .mp4
- missing cover -> paths.coversBase + filename + .jpg
- has_cover=false -> theme cover fallback
- missing title -> derived from filename

Sample fixture: public/data/songs.sample.json

## Local Secrets

Create a `public/secret-config.json` file by copying `secret-config.example.json` from the project root into `public/`.

```bash
cp secret-config.example.json public/secret-config.json
```

Supported secrets:
- `openAiApiKey`: required for Phase C AI suggestions
- `youtubeApiKey`: required when `providers.searchProviders` includes `{ "type": "youtube" }`

Do not commit real keys. `public/secret-config.json` is loaded at runtime and is ignored by git.

## Online Search Notes

Current implementation:
- Search: configurable providers (`invidious` or `youtube`)
- Playback: uses YouTube iframe embed with all optional UI disabled (`controls=0`, `rel=0`, `fs=0`, `disablekb=1`, etc.)
- Manual online search: when no local results match, an "Online suchen" button appears; online search only runs when the user clicks it
- Song request form: when no local results match, a form to request the song is shown; the title is prefilled with the search term

### Global on/off switch
- `features.onlineFeatures` disables **all** online features when set to `false`.
- On startup the app checks `navigator.onLine`. If the device is offline at startup, online features are disabled automatically (no later checks, so short outages do not hide the UI).

### Invidious search
- Public Invidious instances are often blocked by **CORS** in the browser (the server does not send `Access-Control-Allow-Origin`).
- They may also require CAPTCHA or return 5xx errors.
- If you see CORS errors in the console, Invidious search cannot work from a pure frontend without a proxy.

### YouTube Data API search
- Stable and no CORS issues.
- Requires a free `youtubeApiKey` in `public/secret-config.json`.
- Default quota is ~100 searches/day. Request more in Google Cloud if needed.

Example config to use YouTube search:

```json
{
  "features": {
    "onlineFeatures": true,
    "onlineSearch": true,
    "aiSuggestions": false
  },
  "providers": {
    "searchProviders": [{ "type": "youtube" }],
    "videoProviders": [{ "type": "youtube" }]
  }
}
```

Then create `public/secret-config.json`:

```json
{
  "youtubeApiKey": "YOUR_YOUTUBE_DATA_API_KEY"
}
```

## Kiosk Notes

Current shortcuts:
- Ctrl/Cmd+K clears filters and focuses search
- Escape clears active search/filter state

Search input is auto-focused in browse mode for keyboard-first use.
