import { defineStore } from "pinia";
import type { OnlineSongResult } from "../types";
import { searchOnlineSongs } from "../services/onlineSearch";

type SearchMode = "idle" | "fallback" | "explicit";

interface OnlineSearchState {
  activeQuery: string;
  loading: boolean;
  error: string | null;
  mode: SearchMode;
  requestId: number;
  results: OnlineSongResult[];
}

export const useOnlineSearchStore = defineStore("onlineSearch", {
  state: (): OnlineSearchState => ({
    activeQuery: "",
    loading: false,
    error: null,
    mode: "idle",
    requestId: 0,
    results: []
  }),
  getters: {
    hasResults: (state) => state.results.length > 0
  },
  actions: {
    clear(): void {
      this.activeQuery = "";
      this.loading = false;
      this.error = null;
      this.mode = "idle";
      this.results = [];
    },
    async search(query: string, mode: SearchMode): Promise<void> {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        this.clear();
        return;
      }

      const requestId = this.requestId + 1;
      this.requestId = requestId;
      this.activeQuery = trimmedQuery;
      this.loading = true;
      this.error = null;
      this.mode = mode;

      try {
        const results = await searchOnlineSongs(trimmedQuery);
        if (this.requestId !== requestId) {
          return;
        }

        this.results = results;
      } catch (error) {
        if (this.requestId !== requestId) {
          return;
        }

        this.results = [];
        this.error = `Online-Suche derzeit nicht verfuegbar: ${String(error)}`;
      } finally {
        if (this.requestId === requestId) {
          this.loading = false;
        }
      }
    }
  }
});