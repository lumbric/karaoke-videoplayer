import { describe, expect, it } from "vitest";
import { injectFeaturedSongs, mapSongRaw } from "./songCatalog";
import type { AppConfig, SongRecord, SongRecordRaw } from "../types";

const config: AppConfig = {
  theme: { name: "default", title: "Test" },
  features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false, filterEmbeddableVideos: false },
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
    searchProviders: [],
    videoProviders: []
  },
  ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true }
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

  it("uses theme fallback path when cover is explicitly missing", () => {
    const raw: SongRecordRaw = {
      filename: "missing-cover",
      has_cover: false
    };

    const theme2026Config: AppConfig = {
      ...config,
      theme: {
        name: "karaoke-ab-hof2026",
        title: "Karaoke ab Hof"
      }
    };

    const song = mapSongRaw(raw, theme2026Config);

    expect(song.coverPath).toContain("/themes/karaoke-ab-hof2026/cover_fallback.svg");
  });

  it("maps featured field from raw song data", () => {
    const raw: SongRecordRaw = {
      filename: "featured-song",
      title: "Featured Song",
      artist: "Artist",
      featured: true
    };

    const song = mapSongRaw(raw, config);

    expect(song.featured).toBe(true);
  });

  it("defaults featured to false when not provided in raw data", () => {
    const raw: SongRecordRaw = {
      filename: "normal-song",
      title: "Normal Song",
      artist: "Artist"
    };

    const song = mapSongRaw(raw, config);

    expect(song.featured).toBe(false);
  });
});

function createTestSong(id: string, featured: boolean = false): SongRecord {
  return {
    id,
    filename: id,
    title: id,
    artist: "Artist",
    genres: ["pop"],
    durationSeconds: 180,
    filePath: `/songs/${id}.mp4`,
    videoCandidates: [`/songs/${id}.mp4`],
    coverPath: `/covers/${id}.jpg`,
    displayTitle: id,
    searchIndex: id.toLowerCase(),
    featured
  };
}

describe("injectFeaturedSongs", () => {
  it("returns items unchanged when probability is 0", () => {
    const items = [
      createTestSong("song1"),
      createTestSong("song2", true),
      createTestSong("song3")
    ];

    const result = injectFeaturedSongs(items, 0, 8, 42);

    expect(result).toEqual(items);
  });

  it("returns items unchanged when window is 0", () => {
    const items = [
      createTestSong("song1"),
      createTestSong("song2", true),
      createTestSong("song3")
    ];

    const result = injectFeaturedSongs(items, 0.3, 0, 42);

    expect(result).toEqual(items);
  });

  it("returns items unchanged when items array is empty", () => {
    const result = injectFeaturedSongs([], 0.3, 8, 42);

    expect(result).toEqual([]);
  });

  it("returns items unchanged when no featured songs exist", () => {
    const items = [
      createTestSong("song1"),
      createTestSong("song2"),
      createTestSong("song3")
    ];

    const result = injectFeaturedSongs(items, 0.3, 8, 42);

    expect(result).toEqual(items);
  });

  it("returns items unchanged when featured song already in window", () => {
    const items = [
      createTestSong("song1", true),
      createTestSong("song2"),
      createTestSong("song3"),
      createTestSong("song4"),
      createTestSong("song5"),
      createTestSong("song6"),
      createTestSong("song7"),
      createTestSong("song8")
    ];

    const result = injectFeaturedSongs(items, 1.0, 8, 42);

    expect(result).toEqual(items);
  });

  it("swaps featured song into window when probability roll succeeds", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      createTestSong(`song${i}`, i === 15)
    );

    const result = injectFeaturedSongs(items, 1.0, 8, 42);

    const featuredInWindow = result.slice(0, 8).some((song) => song.featured);
    expect(featuredInWindow).toBe(true);
    expect(result.length).toBe(items.length);
  });

  it("does not swap when probability roll fails", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      createTestSong(`song${i}`, i === 15)
    );

    const result = injectFeaturedSongs(items, 0.0, 8, 42);

    expect(result).toEqual(items);
  });

  it("maintains array length and uniqueness after swap", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      createTestSong(`song${i}`, i === 15)
    );

    const result = injectFeaturedSongs(items, 1.0, 8, 42);

    expect(result.length).toBe(items.length);
    const ids = result.map((song) => song.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
