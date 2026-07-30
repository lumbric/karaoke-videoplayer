import { describe, expect, it } from "vitest";
import { mapSongRaw } from "./songCatalog";
import type { AppConfig, SongRecordRaw } from "../types";

const config: AppConfig = {
  theme: { name: "default", title: "Test" },
  features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
  search: {
    batchSize: 20,
    maxDisplayCount: 100,
    initialOrder: "alphabetical",
    randomSeed: 1,
    showMetadataSnippet: true
  },
  providers: {
    searchProviders: [],
    videoProviders: []
  },
  ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true },
  paths: { songsJson: "/data/songs.json", videosBase: "/songs", coversBase: "/covers" }
};

describe("mapSongRaw", () => {
  it("indexes artist and title but not genres", () => {
    const raw: SongRecordRaw = {
      filename: "hello-world",
      title: "Hello World",
      artist: "The Band",
      genre: "pop"
    };

    const song = mapSongRaw(raw, config);

    expect(song.searchIndex).toBe("The Band Hello World");
    expect(song.searchTokens).toEqual(["the", "band", "hello", "world"]);
    expect(song.searchIndex.toLowerCase()).not.toContain("pop");
  });

  it("falls back to filename when artist and title are missing", () => {
    const raw: SongRecordRaw = {
      filename: "My_Favorite-Track",
      genre: "pop"
    };

    const song = mapSongRaw(raw, config);

    expect(song.searchIndex).toBe("My_Favorite-Track");
    expect(song.searchTokens).toEqual(["my", "favorite", "track"]);
  });
});