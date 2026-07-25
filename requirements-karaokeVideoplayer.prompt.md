# Karaoke Song Player SPA - Complete Requirements Specification

## 1. Purpose
Build a kiosk-friendly karaoke web application from scratch as a frontend-only Single Page Application (SPA).

The app manages a local collection of songs (each song has a karaoke video with lyrics), supports fast search and fullscreen playback, provides local usage statistics, allows song suggestions, and optionally adds internet-based features (online search + AI suggestions) when connectivity exists.

This document is designed so an implementation AI agent can build the app without seeing any legacy code.

## 2. Product Context
- Deployment model: local machine, kiosk usage at festival events.
- Runtime model: static frontend files served by a minimal web server.
- Backend: none.
- Persistence: browser localStorage only.
- Primary language in UI: German.
- Primary user interaction: keyboard-first, low-friction for many different users in sequence.

## 3. Mandatory Technology Stack
- Framework: Vue 3
- Build tool: Vite
- Language: TypeScript preferred (JavaScript allowed if types are clearly documented)
- State management: Pinia (or equivalent reactive store)
- Charts: Chart.js (or equivalent) for statistics views
- Testing:
  - Unit tests: Vitest
  - Component tests: Vue Test Utils + Vitest
  - Functional/E2E tests: Playwright (or Cypress)

## 4. Core Terminology (must be used in code)
- Song: the domain object users browse and search.
- Video: the playback asset associated with a song.

Naming rule:
- Use song-centric naming throughout app architecture and code.
- A compatibility layer may map legacy field names (if needed), but internal names should still be song-first.

## 5. Goals
1. Fast and intuitive song discovery in kiosk mode.
2. Reliable local fullscreen playback.
3. Accurate local statistics with visual dashboards.
4. Customizable branding/themes per event.
5. Optional internet enhancements (online search and AI suggestions) that degrade gracefully offline.

## 6. Non-Goals
- No backend APIs.
- No user authentication.
- No cross-device sync.
- No cloud database.
- No admin panel.

## 7. Functional Requirements

### 7.1 App Initialization and Configuration
FR-001 The app must load runtime configuration from config.json before mounting the main UI.

FR-002 If config.json is missing or invalid, the app must display a fatal error message and remain non-functional until corrected.

FR-003 Configuration must control at least:
- app title
- active theme
- feature flags (online search, AI suggestions)
- search settings (batch size, max rendered results)
- online provider settings (Invidious endpoint(s))
- AI settings (model, timeouts, limits)

FR-004 The selected title must be shown both in page title and visible app header.

### 7.2 Theme System
FR-010 Theme must be configurable via config and include:
- minimal theme CSS override file
- logo image
- cover fallback image
- title styling/branding inputs (if needed)

FR-011 There must be a shared base CSS layer used by all themes to avoid duplication.

FR-012 Theme override CSS should only contain necessary differences (colors, fonts, accents, optional spacing tweaks).

### 7.3 Song Catalog and List Rendering
FR-020 App must load song collection from songs JSON data file (see Data Contracts section).

FR-021 Song list must support endless scrolling with batched rendering.

FR-022 Initial list can be randomized or deterministic by config; behavior must be explicit and testable.

FR-023 Cards must display:
- cover image (or fallback)
- song display title
- optional metadata snippet (artist/genre if configured)

FR-024 The list must perform acceptably with large catalogs (target: 2,000+ songs without UI lockups on typical kiosk hardware).

### 7.4 Search and Filtering
FR-030 Provide a search input always visible in main browse state.

FR-031 Search-as-you-type must update results immediately while typing.

FR-032 Search should match across at least:
- song title
- artist
- filename fallback
- normalized search index fields

FR-033 Genre filter must support:
- list of available genres discovered from song data
- multi-genre songs
- clear/reset filter behavior

FR-034 Search and genre filters must compose (AND behavior).

FR-035 After a song is closed, keyboard typing should naturally continue in search input (refocus behavior).

### 7.5 Fuzzy Search and Text Normalization
FR-040 Search must include normalization and fuzzy tolerance so difficult titles are still discoverable.

FR-041 Must handle punctuation/symbol variance, including patterns like "5/8 in Ehren".

FR-042 Must tolerate missing characters and minor typos (for example via bounded edit distance or token-level fuzzy matching).

FR-043 Must include Greek-to-German transliteration mapping used in both indexing and query processing. Idealy, other languages should be supported as well, but Greek is the minimum requirement.

FR-044 An external library may be used for fuzzy matching, but the implementation must be deterministic and testable.

FR-045 Matching/ranking must be deterministic and stable.

### 7.6 Playback
FR-050 Clicking a song card must open fullscreen playback.

FR-051 Playback view must support ONLY the following controls:
- close
- pause/resume
- restart from beginning

FR-052 Exiting playback must return user to browse/search state quickly.

FR-053 Player controls should be kiosk-friendly (large hit areas, visible enough, minimal accidental actions).

### 7.7 Statistics (Parity with Existing Behavior)
FR-060 Track play events in localStorage.

FR-061 Each log entry must include at least:
- title
- timestamp
- playedSeconds
- totalDuration
- completed
- playPercentage
- source (local or online)
- optional provider metadata (id/url)

FR-062 Statistics page must provide:
- total songs played
- total play time
- most played song
- completion rate
- top songs chart
- completion distribution chart
- play-time distribution chart
- hourly activity chart
- recent activity list
- lists for skipped songs / instant skips / hidden gems / retry patterns

FR-063 Definitions for advanced stats must be explicit and implemented exactly:
- instant skip: play stopped before 30 seconds
- skipped song: repeated attempts with low completion threshold
- hidden gem: low play count + high completion
- retry pattern: repeated restarts/attempts with weak completion

FR-064 Provide export of statistics JSON.

FR-065 Statistics must remain local-only and survive page reload.

### 7.8 Song Suggestions (Local Form)
FR-070 When no song results are found, user must be able to suggest a song.

FR-071 Suggestion form fields:
- song title (required)
- artist (required)
- additional info (optional)

FR-072 Suggestions must persist in localStorage.

FR-073 Duplicate detection should prevent exact duplicate suggestions (case-insensitive title+artist).

FR-074 Show clear confirmation message after submit.

### 7.9 Online Search (Internet Optional)
FR-080 Online search feature must be optional via config flag.

FR-081 If enabled and internet is available, app must query Invidious-compatible endpoints for "karaoke <user query>".

FR-082 Online search should be available in two ways:
- automatic fallback when no offline results
- explicit user action via dedicated online search button

FR-083 Online results must render in same list/grid interaction style as local songs where possible.

FR-084 Selecting online result must play in fullscreen mode and log stats with source="online" and provider metadata.

FR-085 If online provider fails (offline, timeout, invalid response), app must show friendly error and remain usable offline.

### 7.10 AI Suggestions (Internet Optional)
FR-090 AI suggestions feature must be optional via config flag.

FR-091 App accepts local OpenAI API key from local secret config (not committed to repository).

FR-092 User can request karaoke song suggestions from AI.

FR-093 AI output should be normalized into candidate search queries.

FR-094 Suggested queries must feed into existing search flows:
- first offline search
- optional online search fallback

FR-095 AI failures (missing key, network, quota, timeout) must show clear user feedback and not break the app.

FR-096 Apply basic abuse control:
- request cooldown or throttling
- max suggestions per request configurable

### 7.11 Keyboard and Kiosk Behavior
FR-100 Search should be keyboard-first in browse mode.

FR-101 Escape key behavior priority:
1. close active modal/form
2. close active player
3. close stats page
4. clear search / return to default browse state

FR-102 Optional shortcuts:
- Ctrl/Cmd+K clears search and focuses input

FR-103 Interactions must remain robust for rapid multi-user handoff.

## 8. Data Contracts

### 8.1 songs data file (example schema)
Each song record must support at least:
- id: string (optional but recommended)
- filename: string
- title: string (optional)
- artist: string (optional)
- genre: string or string[] (optional)
- duration_seconds: number (optional but recommended)
- file: string (optional absolute/relative path override)
- cover: string (optional absolute/relative path override)
- has_cover: boolean (optional)

Rules:
- If file missing, resolve to default videos path + filename.
- If cover missing, resolve to default covers path + filename and fallback image when absent.
- If title/artist missing, derive display title from filename.

### 8.2 config.json (required fields)
Minimum required top-level structure:
- app
- theme
- features
- search
- providers
- ai
- paths

Suggested shape:
- app.title: string
- theme.name: string
- theme.cssPath: string
- theme.logoPath: string
- theme.coverFallbackPath: string
- features.onlineSearch: boolean
- features.aiSuggestions: boolean
- search.batchSize: number
- search.maxDisplayCount: number
- providers.invidious.baseUrls: string[]
- ai.model: string
- ai.maxSuggestions: number
- ai.timeoutMs: number
- paths.songsJson: string
- paths.videosBase: string
- paths.coversBase: string

### 8.3 localStorage keys
- playedLog: array of play events
- songRequests: array of suggestion entries
- any additional keys must be namespaced and documented

## 9. State Management Requirements
- Keep state modular and typed.
- Separate concerns:
  - catalog/search state
  - playback state
  - stats state
  - ui/modal state
  - config/theme state
  - online/AI feature state
- Avoid uncontrolled globals on window.

## 10. UX and Layout Requirements
- SPA layout with:
  - header/title/logo
  - search + actions row
  - genre filter UI
  - song grid/list
  - fullscreen player layer
  - stats layer/modal/page

- Theme must preserve layout consistency across variants.
- Base UI should be responsive for desktop kiosk and usable on smaller screens.

## 11. Performance Requirements
PR-001 Initial UI interactive within reasonable time on kiosk hardware.

PR-002 Search updates should feel immediate for typical library sizes.

PR-003 Large library handling should avoid full re-render of all cards each keystroke.

PR-004 Online and AI calls must be cancellable or safely ignored if user continues typing.

## 12. Reliability and Error Handling
- Graceful handling for:
  - missing files
  - invalid JSON
  - failed media load
  - network failures
  - provider rate limits
- User-facing messages should be clear and non-technical.
- App must always keep offline core usable even when optional features fail.

## 13. Security and Privacy Requirements
- No secrets committed to repository.
- API keys only read from local ignored config files/environment injection mechanism compatible with local deployment.
- Render untrusted text safely (prevent HTML injection in dynamic content).
- Keep all user data local on device.

## 14. Testing Requirements

### 14.1 Unit Tests (mandatory)
- normalization/transliteration
- fuzzy matching and ranking behavior
- stats aggregation functions
- config parsing + fallback logic
- storage adapters

### 14.2 Component Tests (mandatory)
- search input behavior
- genre filter interactions
- song list batch/infinite rendering
- playback controls
- suggestion form validation and submit flow
- stats widgets/charts wiring
- online/AI action panels

### 14.3 Functional/E2E Tests (mandatory)
- load songs and browse
- search-as-you-type and close-player refocus
- local playback + logging
- stats page values/charts visible
- no-results suggestion submission
- online fallback flow (with mocked provider)
- AI suggestion flow (with mocked provider)

## 15. Acceptance Criteria
Project is accepted only if all below are true:
1. Frontend-only Vue + Vite app works without backend.
2. Theme is selected by runtime config and renders correctly.
3. Offline core features work end-to-end (list, search, genre, fullscreen playback, stats, suggestions).
4. Fuzzy search meets required normalization and transliteration behavior.
5. Online search via Invidious works when enabled/internet available, and degrades gracefully when not.
6. AI suggestions work when enabled/key available, and fail gracefully otherwise.
7. Test suites are present and passing.
8. Code is cleanly modularized with song-centric naming.

## 16. Implementation Deliverables
- Full source code (Vue + Vite project)
- config.example.json
- local secrets example file (non-committed real secrets)
- sample songs fixture JSON
- test suite and scripts
- README with setup and kiosk operation instructions

## 17. Required README Coverage
README must include:
- install/build/run instructions
- config.json reference
- theme creation guide (minimal overrides)
- data file format for songs
- local secret setup for online + AI features
- test commands
- kiosk operation notes and shortcuts

## 18. Optional Input: Screenshots for Layout Fidelity
If screenshots are provided, the implementing AI agent must treat them as visual constraints for:
- spacing and hierarchy
- control placement
- typography mood
- color accents
- chart/page composition

Screenshot handling rules:
- preserve required behavior over exact pixel-match
- document any intentional deviations
- keep accessibility and kiosk usability priorities

## 19. Delivery Phasing Recommendation (for one-week festival timeline)
- Phase A (must ship): offline core + themes + stats + suggestions + tests baseline
- Phase B (next): online search feature
- Phase C (next): AI suggestions feature

If schedule risk appears, Phase A must not be compromised.

## 20. Final Instruction to Implementing Agent
Implement from scratch using this specification only. Do not depend on legacy code assumptions. If any requirement is ambiguous, choose deterministic behavior, document assumptions, and keep compatibility with frontend-only local deployment.

## 21. Conversation Addendum (Binding Clarifications)

This section captures explicit project decisions made during implementation and review.

### 21.1 Runtime Data Paths
- Default songs data source is `/data/songs.json`.
- Default videos base path is `/songs`.
- Default covers base path is `/covers`.
- Theme fallback cover remains configured via `theme.coverFallbackPath`.

### 21.2 Playback UI Behavior
- Playback must be fullscreen.
- Playback controls must auto-hide after short inactivity and reappear on input activity.
- Control set remains restricted to close, pause/resume, restart.
- Close control is an `X` with accessible label `Schließen`.
- Picture-in-Picture must be disabled during playback.
- Page scrolling must be locked while the fullscreen player is open.

### 21.3 Cover Rendering Stability
- Cover fallback behavior must avoid repeated failed-image reload loops during filtering/search.
- Once a cover path fails for a song card, the UI should keep using fallback for that song card session state.
- Song cards must reserve stable cover/title/meta space before image load completes.
- Before a cover is loaded, the card should show a calm static placeholder surface rather than visible fallback text.

### 21.4 Browse Order and Grid Stability
- Default browse order is random rather than alphabetical.
- Returning to idle browse state after clearing search should reshuffle deterministically for that session state.
- Song cards should keep equal outer dimensions in the grid regardless of image load timing or metadata length.

### 21.5 Statistics Clarifications
- Statistics consume local `playedLog` entries only.
- Statistics include export to JSON.
- Advanced stats lists use explicit deterministic thresholds defined in code and tests.

### 21.6 Testing and Docker Workflow
- Containerized test command is `docker compose run --rm --build test` when code changed and image freshness is required.
- Rebuild (`--build`) is mandatory for reliable test results after local source changes.