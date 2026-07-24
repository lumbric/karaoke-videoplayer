import { describe, expect, it } from "vitest";
import { loadSongSuggestions, saveSongSuggestion } from "./storage";

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
