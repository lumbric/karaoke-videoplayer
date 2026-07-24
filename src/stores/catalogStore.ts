import { defineStore } from "pinia";
import type { AppConfig, SongRecord } from "../types";
import { loadSongCatalog } from "../services/songCatalog";
import { getSearchScore } from "../utils/fuzzy";

interface CatalogState {
  allSongs: SongRecord[];
  query: string;
  selectedGenres: string[];
  renderedCount: number;
  maxDisplayCount: number;
  batchSize: number;
  loading: boolean;
  error: string | null;
}

function compareSongsStable(a: SongRecord, b: SongRecord): number {
  return a.displayTitle.localeCompare(b.displayTitle, "de") || a.filename.localeCompare(b.filename, "de");
}

export const useCatalogStore = defineStore("catalog", {
  state: (): CatalogState => ({
    allSongs: [],
    query: "",
    selectedGenres: [],
    renderedCount: 0,
    maxDisplayCount: 200,
    batchSize: 30,
    loading: false,
    error: null
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

          const score = getSearchScore(state.query, song.searchIndex);
          if (score < 0) {
            return null;
          }

          return { song, score, index };
        })
        .filter((entry): entry is { song: SongRecord; score: number; index: number } => entry !== null);

      if (hasQuery) {
        ranked.sort((a, b) => b.score - a.score || a.index - b.index || compareSongsStable(a.song, b.song));
      }

      return ranked.map((entry) => entry.song);
    },
    visibleSongs(state): SongRecord[] {
      return this.filteredSongs.slice(0, Math.min(state.renderedCount, state.maxDisplayCount));
    },
    hasMoreVisible(state): boolean {
      return this.filteredSongs.length > Math.min(state.renderedCount, state.maxDisplayCount);
    }
  },
  actions: {
    async initialize(config: AppConfig): Promise<void> {
      this.loading = true;
      this.error = null;

      this.batchSize = config.search.batchSize;
      this.maxDisplayCount = config.search.maxDisplayCount;

      try {
        this.allSongs = await loadSongCatalog(config);
        this.renderedCount = this.batchSize;
      } catch (error) {
        this.error = `Songliste konnte nicht geladen werden: ${String(error)}`;
      } finally {
        this.loading = false;
      }
    },
    setQuery(query: string): void {
      this.query = query;
      this.renderedCount = this.batchSize;
    },
    setGenres(genres: string[]): void {
      this.selectedGenres = genres;
      this.renderedCount = this.batchSize;
    },
    clearFilters(): void {
      this.query = "";
      this.selectedGenres = [];
      this.renderedCount = this.batchSize;
    },
    loadMore(): void {
      this.renderedCount = Math.min(this.renderedCount + this.batchSize, this.maxDisplayCount);
    }
  }
});
