import { describe, expect, it } from "vitest";
import { loadSongSuggestions, saveSongSuggestion, saveSearchSession, loadSearchSessions, saveAiChatSession, loadAiChatLog } from "./storage";

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

describe("search session storage", () => {
  it("stores and loads search sessions", () => {
    saveSearchSession({
      sessionId: "session-1",
      startedAt: "2026-01-01T12:00:00.000Z",
      endedAt: "2026-01-01T12:02:00.000Z",
      queries: ["hello", "hello world"],
      outcome: "abandoned"
    });

    const loaded = loadSearchSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.sessionId).toBe("session-1");
    expect(loaded[0]?.queries).toHaveLength(2);
    expect(loaded[0]?.outcome).toBe("abandoned");
  });

  it("updates existing session by sessionId", () => {
    saveSearchSession({
      sessionId: "session-2",
      startedAt: "2026-01-01T12:00:00.000Z",
      endedAt: "2026-01-01T12:01:00.000Z",
      queries: ["test"],
      outcome: "abandoned"
    });

    saveSearchSession({
      sessionId: "session-2",
      startedAt: "2026-01-01T12:00:00.000Z",
      endedAt: "2026-01-01T12:02:00.000Z",
      queries: ["test", "test query"],
      outcome: "played_song",
      songPlayed: { title: "Test Song", source: "local" }
    });

    const loaded = loadSearchSessions();
    const session = loaded.find((s) => s.sessionId === "session-2");
    expect(session).toBeDefined();
    expect(session?.queries).toHaveLength(2);
    expect(session?.outcome).toBe("played_song");
    expect(session?.songPlayed?.title).toBe("Test Song");
  });
});

describe("ai chat event storage", () => {
  it("stores and loads ai chat events", () => {
    saveAiChatSession({
      id: "test-session-1",
      startedAt: "2026-01-01T12:00:00.000Z",
      endedAt: "2026-01-01T12:05:00.000Z",
      messages: [
        { role: "user", text: "What should I sing?" },
        {
          role: "assistant",
          text: "How about these songs?",
          suggestions: [
            { title: "Song A", artist: "Artist A", status: "local" },
            { title: "Song B", artist: "Artist B", status: "not_found" }
          ]
        }
      ]
    });

    const loaded = loadAiChatLog();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("test-session-1");
    expect(loaded[0]?.messages).toHaveLength(2);
    expect(loaded[0]?.messages[0]?.role).toBe("user");
    expect(loaded[0]?.messages[1]?.suggestions).toHaveLength(2);
    expect(loaded[0]?.messages[1]?.suggestions?.[0]?.status).toBe("local");
  });
});
