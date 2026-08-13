import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAiSuggestionStore, matchAgainstCatalog } from "./aiSuggestionStore";
import type { SongRecord, AppConfig, SecretConfig } from "../types";
import * as onlineSearch from "../services/onlineSearch";

describe("aiSuggestionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("matchAgainstCatalog", () => {
    const mockCatalog: SongRecord[] = [
      {
        id: "1",
        filename: "Calvin Harris, Dua Lipa - One Kiss",
        title: "One Kiss (with Dua Lipa)",
        artist: "Calvin Harris",
        genres: ["edm"],
        durationSeconds: 220,
        filePath: "/songs/one-kiss.mp4",
        videoCandidates: ["/songs/one-kiss.mp4"],
        coverPath: "/covers/one-kiss.jpg",
        displayTitle: "One Kiss (with Dua Lipa)",
        searchIndex: "Calvin Harris One Kiss (with Dua Lipa)",
        searchTokens: ["calvin", "harris", "one", "kiss", "with", "dua", "lipa"],
        featured: false
      },
      {
        id: "2",
        filename: "Queen - Bohemian Rhapsody",
        title: "Bohemian Rhapsody",
        artist: "Queen",
        genres: ["rock"],
        durationSeconds: 355,
        filePath: "/songs/bohemian-rhapsody.mp4",
        videoCandidates: ["/songs/bohemian-rhapsody.mp4"],
        coverPath: "/covers/bohemian-rhapsody.jpg",
        displayTitle: "Bohemian Rhapsody",
        searchIndex: "Queen Bohemian Rhapsody",
        searchTokens: ["queen", "bohemian", "rhapsody"],
        featured: false
      }
    ];

    describe("with sendCatalog=true (exact matching)", () => {
      it("should match exact title and artist (case-insensitive)", () => {
        const result = matchAgainstCatalog("One Kiss (with Dua Lipa)", "Calvin Harris", mockCatalog, true);
        expect(result).toBeDefined();
        expect(result?.id).toBe("1");
      });

      it("should match with different casing", () => {
        const result = matchAgainstCatalog("one kiss (with dua lipa)", "calvin harris", mockCatalog, true);
        expect(result).toBeDefined();
        expect(result?.id).toBe("1");
      });

      it("should not match partial title", () => {
        const result = matchAgainstCatalog("One Kiss", "Calvin Harris", mockCatalog, true);
        expect(result).toBeUndefined();
      });

      it("should not match different song", () => {
        const result = matchAgainstCatalog("Bohemian Like You", "The Dandy Warhols", mockCatalog, true);
        expect(result).toBeUndefined();
      });

      it("should handle special characters correctly", () => {
        const result = matchAgainstCatalog("Bohemian Rhapsody", "Queen", mockCatalog, true);
        expect(result).toBeDefined();
        expect(result?.id).toBe("2");
      });

      it("should return undefined for empty query", () => {
        const result = matchAgainstCatalog("", "", mockCatalog, true);
        expect(result).toBeUndefined();
      });
    });

    describe("with sendCatalog=false (fuzzy matching)", () => {
      it("should match exact title and artist", () => {
        const result = matchAgainstCatalog("One Kiss (with Dua Lipa)", "Calvin Harris", mockCatalog, false);
        expect(result).toBeDefined();
        expect(result?.id).toBe("1");
      });

      it("should match with different casing", () => {
        const result = matchAgainstCatalog("one kiss with dua lipa", "calvin harris", mockCatalog, false);
        expect(result).toBeDefined();
        expect(result?.id).toBe("1");
      });

      it("should match partial title with high score", () => {
        // "One Kiss" should match "One Kiss (with Dua Lipa)" with score > 70
        const result = matchAgainstCatalog("One Kiss", "Calvin Harris", mockCatalog, false);
        expect(result).toBeDefined();
        expect(result?.id).toBe("1");
      });

      it("should not match completely different song", () => {
        const result = matchAgainstCatalog("Bohemian Like You", "The Dandy Warhols", mockCatalog, false);
        expect(result).toBeUndefined();
      });

      it("should match with typos (fuzzy)", () => {
        // "Bohemian Rapsody" (typo) should still match "Bohemian Rhapsody"
        const result = matchAgainstCatalog("Bohemian Rapsody", "Queen", mockCatalog, false);
        expect(result).toBeDefined();
        expect(result?.id).toBe("2");
      });

      it("should return undefined for empty query", () => {
        const result = matchAgainstCatalog("", "", mockCatalog, false);
        expect(result).toBeUndefined();
      });
    });
  });

  describe("sendMessage input validation", () => {
    it("should reject messages longer than 500 characters", async () => {
      const store = useAiSuggestionStore();
      const longMessage = "a".repeat(501);
      const mockCatalog: SongRecord[] = [];
      const mockConfig = {
        ai: { model: "gpt-4o", maxSuggestions: 5, timeoutMs: 8000, sendCatalog: true },
        features: { onlineSearch: true },
        providers: { searchProviders: [] }
      } as any;
      const mockSecret = { openAiApiKey: "test-key" } as any;

      await store.sendMessage(longMessage, mockCatalog, mockConfig, mockSecret);
      
      expect(store.error).toBe("Nachricht ist zu lang (max. 500 Zeichen).");
      expect(store.messages).toHaveLength(0);
    });

    it("should accept messages with exactly 500 characters", async () => {
      const store = useAiSuggestionStore();
      const exactMessage = "a".repeat(500);
      const mockCatalog: SongRecord[] = [];
      const mockConfig = {
        ai: { model: "gpt-4o", maxSuggestions: 5, timeoutMs: 8000, sendCatalog: true },
        features: { onlineSearch: true },
        providers: { searchProviders: [] }
      } as any;
      const mockSecret = { openAiApiKey: "test-key" } as any;

      // Mock fetch to return a successful response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                message: "Test response",
                suggestions: []
              })
            }
          }]
        })
      });

      // We need to pass the mock fetch somehow, but sendMessage doesn't accept it
      // Instead, let's just verify the message was added before the API call
      // by checking the messages array immediately after calling sendMessage
      const promise = store.sendMessage(exactMessage, mockCatalog, mockConfig, mockSecret);
      
      // The user message should be added synchronously before the API call
      expect(store.messages).toHaveLength(1);
      expect(store.messages[0].text).toBe(exactMessage);
      expect(store.messages[0].role).toBe("user");
      
      // Wait for the promise to complete (it will fail due to fake API key, but that's ok)
      await promise;
    });
  });

  describe("resolveSuggestions", () => {
    it("passes filterEmbeddableVideos to searchOnline when enabled", async () => {
      const spy = vi.spyOn(onlineSearch, "searchOnline").mockResolvedValue([]);

      const store = useAiSuggestionStore();
      const catalog: SongRecord[] = [];
      const config: AppConfig = {
        theme: { name: "default", title: "Test" },
        features: {
          onlineFeatures: true,
          onlineSearch: true,
          aiSuggestions: true,
          filterEmbeddableVideos: true
        },
        search: {
          batchSize: 20,
          maxDisplayCount: 100,
          initialOrder: "alphabetical",
          randomSeed: 1,
          showMetadataSnippet: true,
          featuredProbability: 0.3,
          featuredWindow: 8
        },
        providers: {
          searchProviders: [{ type: "youtube" }],
          videoProviders: []
        },
        ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true }
      };
      const secret: SecretConfig = { youtubeApiKey: "TEST_KEY" };
      const signal = new AbortController().signal;

      const suggestions = [
        { title: "Test Song", artist: "Test Artist", reason: "test" }
      ];

      await store.resolveSuggestions(suggestions, catalog, config, secret, signal);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          requireEmbeddable: true
        })
      );

      spy.mockRestore();
    });

    it("passes filterEmbeddableVideos=false to searchOnline when disabled", async () => {
      const spy = vi.spyOn(onlineSearch, "searchOnline").mockResolvedValue([]);

      const store = useAiSuggestionStore();
      const catalog: SongRecord[] = [];
      const config: AppConfig = {
        theme: { name: "default", title: "Test" },
        features: {
          onlineFeatures: true,
          onlineSearch: true,
          aiSuggestions: true,
          filterEmbeddableVideos: false
        },
        search: {
          batchSize: 20,
          maxDisplayCount: 100,
          initialOrder: "alphabetical",
          randomSeed: 1,
          showMetadataSnippet: true,
          featuredProbability: 0.3,
          featuredWindow: 8
        },
        providers: {
          searchProviders: [{ type: "youtube" }],
          videoProviders: []
        },
        ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true }
      };
      const secret: SecretConfig = { youtubeApiKey: "TEST_KEY" };
      const signal = new AbortController().signal;

      const suggestions = [
        { title: "Test Song", artist: "Test Artist", reason: "test" }
      ];

      await store.resolveSuggestions(suggestions, catalog, config, secret, signal);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          requireEmbeddable: false
        })
      );

      spy.mockRestore();
    });
  });
});
