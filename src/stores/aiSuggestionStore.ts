import { defineStore } from "pinia";
import type { AppConfig, SecretConfig, SongRecord } from "../types";
import { fetchAiSuggestions, type AiSuggestionResponse, type AiSuggestionItem } from "../services/openaiSuggestions";
import { searchOnline } from "../services/onlineSearch";
import { getSearchScore } from "../utils/fuzzy";

export interface ChatSuggestionResult {
  title: string;
  artist: string;
  reason: string;
  song?: SongRecord;
  onlineSong?: SongRecord;
  status: "local" | "online" | "not_found";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestions?: ChatSuggestionResult[];
}

interface AiSuggestionState {
  messages: ChatMessage[];
  modalOpen: boolean;
  loading: boolean;
  error: string | null;
  activeAbortController: AbortController | null;
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function matchAgainstCatalog(title: string, artist: string, catalog: SongRecord[]): SongRecord | undefined {
  const query = `${title} ${artist}`;
  let best: { song: SongRecord; score: number } | undefined;

  for (const song of catalog) {
    const score = getSearchScore(query, song.searchIndex, song.searchTokens);
    if (score > 0 && (!best || score > best.score)) {
      best = { song, score };
    }
  }

  return best?.song;
}

export const useAiSuggestionStore = defineStore("aiSuggestion", {
  state: (): AiSuggestionState => ({
    messages: [],
    modalOpen: false,
    loading: false,
    error: null,
    activeAbortController: null
  }),
  getters: {
    hasMessages: (state) => state.messages.length > 0
  },
  actions: {
    openModal(): void {
      this.modalOpen = true;
      this.error = null;
    },
    closeModal(): void {
      this.modalOpen = false;
      this.cancelActiveRequest();
    },
    cancelActiveRequest(): void {
      if (this.activeAbortController) {
        this.activeAbortController.abort();
        this.activeAbortController = null;
      }
    },
    clearMessages(): void {
      this.messages = [];
      this.error = null;
    },
    async sendMessage(userText: string, catalog: SongRecord[], config: AppConfig, secret: SecretConfig): Promise<void> {
      const trimmedText = userText.trim();
      if (!trimmedText || this.loading) return;

      this.cancelActiveRequest();
      const controller = new AbortController();
      this.activeAbortController = controller;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        text: trimmedText
      };
      this.messages.push(userMessage);
      this.loading = true;
      this.error = null;

      try {
        const conversationHistory = this.messages
          .filter((m) => m.id !== userMessage.id)
          .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

        const apiKey = secret.openAiApiKey;
        if (!apiKey) {
          throw new Error("OpenAI API-Key nicht konfiguriert. Bitte setze openAiApiKey in secret-config.json.");
        }

        const response: AiSuggestionResponse = await fetchAiSuggestions({
          userMessage: trimmedText,
          catalog,
          config,
          apiKey,
          conversationHistory,
          abortSignal: controller.signal
        });

        if (controller.signal.aborted) return;

        const resolvedSuggestions = await this.resolveSuggestions(response.suggestions, catalog, config, secret, controller.signal);

        if (controller.signal.aborted) return;

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          text: response.message,
          suggestions: resolvedSuggestions
        };
        this.messages.push(assistantMessage);
      } catch (error) {
        if (controller.signal.aborted) return;
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        if (!controller.signal.aborted) {
          this.loading = false;
          this.activeAbortController = null;
        }
      }
    },
    async resolveSuggestions(
      suggestions: AiSuggestionItem[],
      catalog: SongRecord[],
      config: AppConfig,
      secret: SecretConfig,
      signal: AbortSignal
    ): Promise<ChatSuggestionResult[]> {
      const results: ChatSuggestionResult[] = [];
      const unmatchedIndices: number[] = [];
      const unmatchedItems: AiSuggestionItem[] = [];

      suggestions.forEach((item, index) => {
        const matched = matchAgainstCatalog(item.title, item.artist, catalog);
        if (matched) {
          results.push({
            title: item.title,
            artist: item.artist,
            reason: item.reason,
            song: matched,
            status: "local"
          });
        } else {
          unmatchedIndices.push(index);
          unmatchedItems.push(item);
        }
      });

      if (unmatchedItems.length > 0 && config.features.onlineSearch && config.providers.searchProviders.length > 0) {
        const onlineSearchResults = await Promise.allSettled(
          unmatchedItems.map((item) =>
            searchOnline({
              query: `${item.title} ${item.artist}`,
              providers: config.providers.searchProviders,
              secret,
              maxResults: 1,
              timeoutMs: config.ai.timeoutMs,
              abortSignal: signal
            })
          )
        );

        for (let i = 0; i < unmatchedItems.length; i++) {
          const item = unmatchedItems[i];
          const settled = onlineSearchResults[i];
          const songs = settled.status === "fulfilled" ? settled.value : [];
          const onlineSong = songs[0];

          results.splice(unmatchedIndices[i], 0, {
            title: item.title,
            artist: item.artist,
            reason: item.reason,
            onlineSong: onlineSong || undefined,
            status: onlineSong ? "online" : "not_found"
          });
        }
      } else {
        for (let i = 0; i < unmatchedItems.length; i++) {
          const item = unmatchedItems[i];
          results.splice(unmatchedIndices[i], 0, {
            title: item.title,
            artist: item.artist,
            reason: item.reason,
            status: "not_found"
          });
        }
      }

      return results;
    }
  }
});
