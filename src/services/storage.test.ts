import { describe, expect, it } from "vitest";
import { loadSongSuggestions, saveSongSuggestion, appendSearchEvent, loadSearchLog, appendAiChatEvent, loadAiChatLog } from "./storage";

describe("song suggestion storage", () => {
  it("stores and loads suggestions", () => {
    const result = saveSongSuggestion({
      title: "Halo",
      artist: "Beyonce",
      createdAt: "2026-01-01T12:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    const loaded = loadSongSuggestions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe("Halo");
  });

  it("prevents duplicate title and artist", () => {
    saveSongSuggestion({
      title: "Halo",
      artist: "Beyonce",
      createdAt: "2026-01-01T12:00:00.000Z"
    });

    const duplicate = saveSongSuggestion({
      title: "halo",
      artist: "beyonce",
      createdAt: "2026-01-01T12:01:00.000Z"
    });

    expect(duplicate.ok).toBe(false);
  });
});

describe("search event storage", () => {
  it("stores and loads search events", () => {
    appendSearchEvent({
      query: "test search",
      timestamp: "2026-01-01T12:00:00.000Z",
      source: "local",
      resultCount: 5
    });

    const loaded = loadSearchLog();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.query).toBe("test search");
    expect(loaded[0]?.source).toBe("local");
    expect(loaded[0]?.resultCount).toBe(5);
  });

  it("stores multiple search events", () => {
    appendSearchEvent({
      query: "first",
      timestamp: "2026-01-01T12:00:00.000Z",
      source: "local",
      resultCount: 3
    });

    appendSearchEvent({
      query: "second",
      timestamp: "2026-01-01T12:01:00.000Z",
      source: "online",
      resultCount: 0
    });

    const loaded = loadSearchLog();
    expect(loaded).toHaveLength(2);
    expect(loaded[1]?.query).toBe("second");
    expect(loaded[1]?.resultCount).toBe(0);
  });
});

describe("ai chat event storage", () => {
  it("stores and loads ai chat events", () => {
    appendAiChatEvent({
      timestamp: "2026-01-01T12:00:00.000Z",
      userMessage: "What should I sing?",
      assistantMessage: "How about these songs?",
      suggestions: [
        { title: "Song A", artist: "Artist A", status: "local" },
        { title: "Song B", artist: "Artist B", status: "not_found" }
      ]
    });

    const loaded = loadAiChatLog();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.userMessage).toBe("What should I sing?");
    expect(loaded[0]?.suggestions).toHaveLength(2);
    expect(loaded[0]?.suggestions[0]?.status).toBe("local");
  });
});
