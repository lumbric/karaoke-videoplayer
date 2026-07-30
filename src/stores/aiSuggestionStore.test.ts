import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAiSuggestionStore } from "./aiSuggestionStore";
import type { SongRecord } from "../types";

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
        searchTokens: ["calvin", "harris", "one", "kiss", "with", "dua", "lipa"]
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
        searchTokens: ["queen", "bohemian", "rhapsody"]
      }
    ];

    it("should match exact title and artist (case-insensitive)", () => {
      const store = useAiSuggestionStore();
      const result = (store as any).matchAgainstCatalog("One Kiss (with Dua Lipa)", "Calvin Harris", mockCatalog);
      expect(result).toBeDefined();
      expect(result?.id).toBe("1");
    });

    it("should match with different casing", () => {
      const store = useAiSuggestionStore();
      const result = (store as any).matchAgainstCatalog("one kiss (with dua lipa)", "calvin harris", mockCatalog);
      expect(result).toBeDefined();
      expect(result?.id).toBe("1");
    });

    it("should not match partial title", () => {
      const store = useAiSuggestionStore();
      const result = (store as any).matchAgainstCatalog("One Kiss", "Calvin Harris", mockCatalog);
      expect(result).toBeUndefined();
    });

    it("should not match different song", () => {
      const store = useAiSuggestionStore();
      const result = (store as any).matchAgainstCatalog("Bohemian Like You", "The Dandy Warhols", mockCatalog);
      expect(result).toBeUndefined();
    });

    it("should handle special characters correctly", () => {
      const store = useAiSuggestionStore();
      const result = (store as any).matchAgainstCatalog("Bohemian Rhapsody", "Queen", mockCatalog);
      expect(result).toBeDefined();
      expect(result?.id).toBe("2");
    });

    it("should return undefined for empty query", () => {
      const store = useAiSuggestionStore();
      const result = (store as any).matchAgainstCatalog("", "", mockCatalog);
      expect(result).toBeUndefined();
    });
  });

  describe("sendMessage input validation", () => {
    it("should reject messages longer than 500 characters", async () => {
      const store = useAiSuggestionStore();
      const longMessage = "a".repeat(501);
      const mockCatalog: SongRecord[] = [];
      const mockConfig = {
        ai: { model: "gpt-4o", maxSuggestions: 5, timeoutMs: 8000 },
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
        ai: { model: "gpt-4o", maxSuggestions: 5, timeoutMs: 8000 },
        features: { onlineSearch: true },
        providers: { searchProviders: [] }
      } as any;
      const mockSecret = { openAiApiKey: "test-key" } as any;

      await store.sendMessage(exactMessage, mockCatalog, mockConfig, mockSecret);
      
      expect(store.error).toBeNull();
      expect(store.messages).toHaveLength(1);
    });
  });
});
