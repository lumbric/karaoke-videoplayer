import { defineStore } from "pinia";
import type { AppConfig, SecretConfig, SongRecord } from "../types";
import { searchOnline } from "../services/onlineSearch";
import { appendSearchEvent } from "../services/storage";

interface OnlineSearchState {
  query: string;
  results: SongRecord[];
  loading: boolean;
  error: string | null;
  onlineFeaturesEnabled: boolean;
  enabled: boolean;
  activeAbortController: AbortController | null;
  searchProvidersConfigured: boolean;
}

export const useOnlineSearchStore = defineStore("onlineSearch", {
  state: (): OnlineSearchState => ({
    query: "",
    results: [],
    loading: false,
    error: null,
    onlineFeaturesEnabled: false,
    enabled: false,
    activeAbortController: null,
    searchProvidersConfigured: false
  }),
  getters: {
    hasResults: (state) => state.results.length > 0,
    isActive: (state) => state.onlineFeaturesEnabled && state.enabled && state.searchProvidersConfigured
  },
  actions: {
    initialize(config: AppConfig, onlineFeaturesEnabled?: boolean): void {
      this.onlineFeaturesEnabled = onlineFeaturesEnabled ?? config.features.onlineFeatures;
      this.enabled = config.features.onlineSearch;
      this.searchProvidersConfigured = config.providers.searchProviders.length > 0;
      console.info("[onlineSearch] initialized", {
        onlineFeaturesEnabled: this.onlineFeaturesEnabled,
        enabled: this.enabled,
        searchProvidersConfigured: this.searchProvidersConfigured,
        searchProviders: config.providers.searchProviders
      });
    },
    clearResults(): void {
      this.results = [];
      this.error = null;
      this.query = "";
      this.loading = false;
      this.cancelActiveSearch();
    },
    cancelActiveSearch(): void {
      if (this.activeAbortController) {
        this.activeAbortController.abort();
        this.activeAbortController = null;
      }
    },
    async search(query: string, config: AppConfig, secret: SecretConfig): Promise<void> {
      const trimmedQuery = query.trim();
      if (!this.onlineFeaturesEnabled || !this.enabled || !this.searchProvidersConfigured || trimmedQuery.length === 0) {
        this.results = [];
        this.error = null;
        return;
      }

      this.cancelActiveSearch();
      const controller = new AbortController();
      this.activeAbortController = controller;
      this.query = trimmedQuery;
      this.loading = true;
      this.error = null;

      try {
        const songs = await searchOnline({
          query: trimmedQuery,
          providers: config.providers.searchProviders,
          secret,
          maxResults: config.search.maxDisplayCount,
          timeoutMs: 10000,
          abortSignal: controller.signal
        });

        if (!controller.signal.aborted) {
          this.results = songs;
          appendSearchEvent({
            query: trimmedQuery,
            timestamp: new Date().toISOString(),
            source: "online",
            resultCount: songs.length
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          this.error = error instanceof Error ? error.message : String(error);
          appendSearchEvent({
            query: trimmedQuery,
            timestamp: new Date().toISOString(),
            source: "online",
            resultCount: 0
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          this.loading = false;
          this.activeAbortController = null;
        }
      }
    }
  }
});
