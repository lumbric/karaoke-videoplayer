import { defineStore } from "pinia";
import type { AppConfig, SearchOutcome, SearchSession, SongRecord } from "../types";
import { loadSongCatalog } from "../services/songCatalog";
import { getSearchScore } from "../utils/fuzzy";
import { saveSearchSession } from "../services/storage";

interface CatalogState {
  allSongs: SongRecord[];
  query: string;
  selectedGenres: string[];
  initialOrder: AppConfig["search"]["initialOrder"];
  idleShuffleSeed: number;
  renderedCount: number;
  maxDisplayCount: number;
  batchSize: number;
  loading: boolean;
  error: string | null;
  currentSearchSession: {
    sessionId: string;
    startedAt: string;
    queries: string[];
  } | null;
}

function compareSongsStable(a: SongRecord, b: SongRecord): number {
  return a.displayTitle.localeCompare(b.displayTitle, "de") || a.filename.localeCompare(b.filename, "de");
}

function seededRandom(value: number): number {
  const x = Math.sin(value) * 10000;
  return x - Math.floor(x);
}

function songHash(song: SongRecord): number {
  const key = `${song.id}:${song.displayTitle}:${song.filename}`;
  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

function generateSessionId(): string {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useCatalogStore = defineStore("catalog", {
  state: (): CatalogState => ({
    allSongs: [],
    query: "",
    selectedGenres: [],
    initialOrder: "alphabetical",
    idleShuffleSeed: Date.now(),
    renderedCount: 0,
    maxDisplayCount: 200,
    batchSize: 30,
    loading: false,
    error: null,
    currentSearchSession: null
  }),
  getters: {
    availableGenres: (state): string[] => {
      const unique = new Set<string>();
      for (const song of state.allSongs) {
        for (const genre of song.genres) {
          unique.add(genre);
        }
      }

      return [...unique].sort((a, b) => a.localeCompare(b, "de"));
    },
    filteredSongs(state): SongRecord[] {
      const hasQuery = state.query.trim().length > 0;
      const requiredGenres = new Set(state.selectedGenres);

      const ranked = state.allSongs
        .map((song, index) => {
          const genresMatch = requiredGenres.size === 0 || song.genres.some((genre) => requiredGenres.has(genre));
          if (!genresMatch) {
            return null;
          }

          if (!hasQuery) {
            return { song, score: 0, index };
          }

          const score = getSearchScore(state.query, song.searchIndex, song.searchTokens);
          if (score < 0) {
            return null;
          }

          return { song, score, index };
        })
        .filter((entry): entry is { song: SongRecord; score: number; index: number } => entry !== null);

      if (hasQuery) {
        ranked.sort((a, b) => b.score - a.score || a.index - b.index || compareSongsStable(a.song, b.song));
      } else {
        if (state.initialOrder === "alphabetical") {
          ranked.sort((a, b) => compareSongsStable(a.song, b.song));
        } else {
          ranked.sort((a, b) => {
            const aRandom = seededRandom(songHash(a.song) + state.idleShuffleSeed + a.index * 17);
            const bRandom = seededRandom(songHash(b.song) + state.idleShuffleSeed + b.index * 17);
            return aRandom - bRandom || a.index - b.index || compareSongsStable(a.song, b.song);
          });
        }
      }

      return ranked.map((entry) => entry.song);
    },
    visibleSongs(state): SongRecord[] {
      return this.filteredSongs.slice(0, Math.min(state.renderedCount, state.maxDisplayCount));
    },
    hasMoreVisible(state): boolean {
      return this.filteredSongs.length > Math.min(state.renderedCount, state.maxDisplayCount);
    },
    hasHitDisplayCap(state): boolean {
      return state.query.trim().length === 0
        && state.initialOrder === "random"
        && state.renderedCount >= state.maxDisplayCount
        && this.filteredSongs.length > state.maxDisplayCount;
    }
  },
  actions: {
    reshuffleIdleOrder(): void {
      if (this.initialOrder !== "random") {
        return;
      }

      this.idleShuffleSeed = Math.floor(Math.random() * 1_000_000_000);
    },
    async initialize(config: AppConfig): Promise<void> {
      this.loading = true;
      this.error = null;
      this.initialOrder = config.search.initialOrder;

      this.batchSize = config.search.batchSize;
      this.maxDisplayCount = config.search.maxDisplayCount;

      try {
        this.allSongs = await loadSongCatalog(config);
        this.reshuffleIdleOrder();
        this.renderedCount = this.batchSize;
      } catch (error) {
        this.error = `Songliste konnte nicht geladen werden: ${String(error)}`;
      } finally {
        this.loading = false;
      }
    },
    setQuery(query: string): void {
      const hadQuery = this.query.trim().length > 0;
      const hasQuery = query.trim().length > 0;
      const oldQuery = this.query.trim();
      const newQuery = query.trim();

      this.query = query;
      if (this.initialOrder === "random" && hadQuery && !hasQuery) {
        this.reshuffleIdleOrder();
      }
      this.renderedCount = this.batchSize;

      if (hasQuery) {
        const isExtension = oldQuery.length > 0 && newQuery.startsWith(oldQuery);

        if (!isExtension || !this.currentSearchSession) {
          if (!this.currentSearchSession) {
            this.currentSearchSession = {
              sessionId: generateSessionId(),
              startedAt: new Date().toISOString(),
              queries: []
            };
          }
          this.currentSearchSession.queries.push(newQuery);
        }
      }
    },
    endSearchSession(outcome: SearchOutcome, songPlayed?: { title: string; source: "local" | "online" }): void {
      if (!this.currentSearchSession) return;

      const session: SearchSession = {
        sessionId: this.currentSearchSession.sessionId,
        startedAt: this.currentSearchSession.startedAt,
        endedAt: new Date().toISOString(),
        queries: [...this.currentSearchSession.queries],
        outcome,
        songPlayed
      };

      saveSearchSession(session);
      this.currentSearchSession = null;
    },
    addQueryToCurrentSession(query: string): void {
      if (!this.currentSearchSession) {
        this.currentSearchSession = {
          sessionId: generateSessionId(),
          startedAt: new Date().toISOString(),
          queries: []
        };
      }
      this.currentSearchSession.queries.push(query);
    },
    setGenres(genres: string[]): void {
      this.selectedGenres = genres;
      this.renderedCount = this.batchSize;
    },
    clearFilters(): void {
      this.endSearchSession("abandoned");

      this.query = "";
      this.selectedGenres = [];
      if (this.initialOrder === "random") {
        this.reshuffleIdleOrder();
      }
      this.renderedCount = this.batchSize;
    },
    loadMore(): void {
      this.renderedCount = Math.min(this.renderedCount + this.batchSize, this.maxDisplayCount);
    },
    resetRandomView(): void {
      if (this.initialOrder !== "random") {
        return;
      }

      this.reshuffleIdleOrder();
      this.renderedCount = this.batchSize;
    }
  }
});
