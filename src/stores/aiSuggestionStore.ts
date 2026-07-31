import { defineStore } from "pinia";
import type { AiChatMessage, AiChatSuggestion, AppConfig, SecretConfig, SongRecord } from "../types";
import { fetchAiSuggestions, type AiSuggestionResponse, type AiSuggestionItem } from "../services/openaiSuggestions";
import { searchOnline } from "../services/onlineSearch";
import { normalizeForSearch } from "../utils/normalize";
import { getSearchScore } from "../utils/fuzzy";
import { saveAiChatSession } from "../services/storage";

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
  displayedText: string;
  suggestions?: ChatSuggestionResult[];
}

interface AiSuggestionState {
  messages: ChatMessage[];
  modalOpen: boolean;
  loading: boolean;
  error: string | null;
  activeAbortController: AbortController | null;
  typingAnimationId: number | null;
  currentSessionId: string | null;
  currentSessionStartedAt: string | null;
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function matchAgainstCatalog(title: string, artist: string, catalog: SongRecord[], sendCatalog: boolean): SongRecord | undefined {
  if (sendCatalog) {
    // Exact matching when catalog was sent to AI
    const aiQuery = normalizeForSearch(`${artist} ${title}`);
    if (!aiQuery) return undefined;
    
    for (const song of catalog) {
      const catalogQuery = normalizeForSearch(song.searchIndex);
      if (aiQuery === catalogQuery) {
        return song;
      }
    }
    
    return undefined;
  } else {
    // Fuzzy matching when catalog was NOT sent to AI
    const query = `${title} ${artist}`;
    let best: { song: SongRecord; score: number } | undefined;

    for (const song of catalog) {
      const score = getSearchScore(query, song.searchIndex, song.searchTokens);
      if (score > 70 && (!best || score > best.score)) {
        best = { song, score };
      }
    }

    return best?.song;
  }
}

export const useAiSuggestionStore = defineStore("aiSuggestion", {
  state: (): AiSuggestionState => ({
    messages: [],
    modalOpen: false,
    loading: false,
    error: null,
    activeAbortController: null,
    typingAnimationId: null,
    currentSessionId: null,
    currentSessionStartedAt: null
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
      this.stopTypingAnimation();
      this.finalizeCurrentSession();
    },
    cancelActiveRequest(): void {
      if (this.activeAbortController) {
        this.activeAbortController.abort();
        this.activeAbortController = null;
      }
    },
    clearMessages(): void {
      this.stopTypingAnimation();
      this.finalizeCurrentSession();
      this.messages = [];
      this.error = null;
    },
    startTypingAnimation(messageId: string): void {
      this.stopTypingAnimation();
      
      const message = this.messages.find((m) => m.id === messageId);
      if (!message) return;
      
      const fullText = message.text;
      let currentIndex = 0;
      const charsPerTick = 2;
      const tickInterval = 30;
      
      const animate = () => {
        if (currentIndex >= fullText.length) {
          message.displayedText = fullText;
          this.typingAnimationId = null;
          return;
        }
        
        currentIndex = Math.min(currentIndex + charsPerTick, fullText.length);
        message.displayedText = fullText.slice(0, currentIndex);
        
        this.typingAnimationId = window.setTimeout(animate, tickInterval);
      };
      
      animate();
    },
    stopTypingAnimation(): void {
      if (this.typingAnimationId !== null) {
        clearTimeout(this.typingAnimationId);
        this.typingAnimationId = null;
      }
    },
    ensureSession(): void {
      if (!this.currentSessionId) {
        this.currentSessionId = generateId();
        this.currentSessionStartedAt = new Date().toISOString();
      }
    },
    buildSessionMessages(): AiChatMessage[] {
      return this.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => {
          const msg: AiChatMessage = { role: m.role, text: m.text };
          if (m.suggestions) {
            msg.suggestions = m.suggestions.map((s): AiChatSuggestion => ({
              title: s.title,
              artist: s.artist,
              status: s.status
            }));
          }
          return msg;
        });
    },
    persistCurrentSession(): void {
      if (!this.currentSessionId || !this.currentSessionStartedAt) return;
      saveAiChatSession({
        id: this.currentSessionId,
        startedAt: this.currentSessionStartedAt,
        messages: this.buildSessionMessages()
      });
    },
    finalizeCurrentSession(): void {
      if (!this.currentSessionId || !this.currentSessionStartedAt) return;
      saveAiChatSession({
        id: this.currentSessionId,
        startedAt: this.currentSessionStartedAt,
        endedAt: new Date().toISOString(),
        messages: this.buildSessionMessages()
      });
      this.currentSessionId = null;
      this.currentSessionStartedAt = null;
    },
    async sendMessage(userText: string, catalog: SongRecord[], config: AppConfig, secret: SecretConfig): Promise<void> {
      const trimmedText = userText.trim();
      if (!trimmedText || this.loading) return;
      
      if (trimmedText.length > 500) {
        this.error = "Nachricht ist zu lang (max. 500 Zeichen).";
        return;
      }

      this.cancelActiveRequest();
      const controller = new AbortController();
      this.activeAbortController = controller;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        text: trimmedText,
        displayedText: trimmedText
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
          displayedText: "",
          suggestions: resolvedSuggestions
        };
        this.messages.push(assistantMessage);
        this.startTypingAnimation(assistantMessage.id);

        this.ensureSession();
        this.persistCurrentSession();
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
        const matched = matchAgainstCatalog(item.title, item.artist, catalog, config.ai.sendCatalog);
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
