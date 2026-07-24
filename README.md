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

Still out of scope for Phase A (planned next):
- online search (Phase B)
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
- app
- theme
- features
- search
- providers
- ai
- paths

Important fields:
- app.title
- theme.cssPath
- theme.logoPath
- theme.coverFallbackPath
- search.batchSize
- search.maxDisplayCount
- paths.songsJson
- paths.videosBase
- paths.coversBase

If config.json is missing or invalid, app startup intentionally fails with a visible error screen.

## Theme Guide

Theme architecture:
- base styles: public/themes/base.css
- event/theme override: public/themes/default.css

To create a new theme:
1. Create a new CSS override file under public/themes.
2. Change color/font/accent values only where needed.
3. Point theme.cssPath in config.json to your override.
4. Set logoPath and coverFallbackPath in config.json.

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

For future online and AI phases, keep secrets local and uncommitted.

Example file:
- secret-config.example.json

Do not commit real keys.

## Kiosk Notes

Current shortcuts:
- Ctrl/Cmd+K clears filters and focuses search
- Escape clears active search/filter state

Search input is auto-focused in browse mode for keyboard-first use.
