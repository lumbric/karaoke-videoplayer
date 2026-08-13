import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCatalogStore } from "./catalogStore";
import type { SongRecord } from "../types";

function createSong(id: string, displayTitle: string, filename: string, featured: boolean = false): SongRecord {
  return {
    id,
    filename,
    title: displayTitle,
    artist: "Artist",
    genres: ["pop"],
    durationSeconds: 180,
    filePath: `/songs/${filename}.mp4`,
    videoCandidates: [`/songs/${filename}.mp4`],
    coverPath: `/covers/${filename}.jpg`,
    displayTitle,
    searchIndex: `${displayTitle.toLowerCase()} artist pop`,
    featured
  };
}

describe("catalogStore ordering", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps idle list alphabetical when initialOrder is alphabetical", () => {
    const store = useCatalogStore();
    store.initialOrder = "alphabetical";
    store.allSongs = [
      createSong("2", "Zeta", "zeta"),
      createSong("3", "Mu", "mu"),
      createSong("1", "Alpha", "alpha")
    ];

    expect(store.filteredSongs.map((song) => song.displayTitle)).toEqual(["Alpha", "Mu", "Zeta"]);
  });

  it("reshuffleIdleOrder is no-op for alphabetical mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "alphabetical";
    store.idleShuffleSeed = 77;

    store.reshuffleIdleOrder();

    expect(store.idleShuffleSeed).toBe(77);
  });

  it("clearFilters does not reshuffle in alphabetical mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "alphabetical";
    store.idleShuffleSeed = 123;
    store.query = "abc";
    store.selectedGenres = ["rock"];

    store.clearFilters();

    expect(store.idleShuffleSeed).toBe(123);
    expect(store.query).toBe("");
    expect(store.selectedGenres).toEqual([]);
  });

  it("reshuffleIdleOrder updates seed in random mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.314159265);

    store.reshuffleIdleOrder();

    expect(store.idleShuffleSeed).toBe(314159265);
    randomSpy.mockRestore();
  });

  it("clearing search reshuffles only in random mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.idleShuffleSeed = 10;
    store.query = "karaoke";
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

    store.setQuery("");

    expect(store.idleShuffleSeed).toBe(900000000);
    randomSpy.mockRestore();
  });
});

describe("catalogStore load more", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("hasHitDisplayCap is false when query is active", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.maxDisplayCount = 100;
    store.renderedCount = 100;
    store.query = "test";
    store.allSongs = Array.from({ length: 200 }, (_, i) => createSong(String(i), `Song ${i}`, `song${i}`));

    expect(store.hasHitDisplayCap).toBe(false);
  });

  it("hasHitDisplayCap is false when not in random mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "alphabetical";
    store.maxDisplayCount = 100;
    store.renderedCount = 100;
    store.allSongs = Array.from({ length: 200 }, (_, i) => createSong(String(i), `Song ${i}`, `song${i}`));

    expect(store.hasHitDisplayCap).toBe(false);
  });

  it("hasHitDisplayCap is false when renderedCount is below maxDisplayCount", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.maxDisplayCount = 100;
    store.renderedCount = 50;
    store.allSongs = Array.from({ length: 200 }, (_, i) => createSong(String(i), `Song ${i}`, `song${i}`));

    expect(store.hasHitDisplayCap).toBe(false);
  });

  it("hasHitDisplayCap is false when total songs are below maxDisplayCount", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.maxDisplayCount = 100;
    store.renderedCount = 100;
    store.allSongs = Array.from({ length: 50 }, (_, i) => createSong(String(i), `Song ${i}`, `song${i}`));

    expect(store.hasHitDisplayCap).toBe(false);
  });

  it("hasHitDisplayCap is true when all conditions are met", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.maxDisplayCount = 100;
    store.renderedCount = 100;
    store.allSongs = Array.from({ length: 200 }, (_, i) => createSong(String(i), `Song ${i}`, `song${i}`));

    expect(store.hasHitDisplayCap).toBe(true);
  });

  it("resetRandomView reshuffles and resets renderedCount in random mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.idleShuffleSeed = 10;
    store.renderedCount = 100;
    store.batchSize = 30;
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    store.resetRandomView();

    expect(store.idleShuffleSeed).toBe(500000000);
    expect(store.renderedCount).toBe(30);
    randomSpy.mockRestore();
  });

  it("resetRandomView is no-op in alphabetical mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "alphabetical";
    store.idleShuffleSeed = 42;
    store.renderedCount = 100;

    store.resetRandomView();

    expect(store.idleShuffleSeed).toBe(42);
    expect(store.renderedCount).toBe(100);
  });
});

describe("catalogStore featured songs", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("injects featured song into first n songs in random mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.featuredProbability = 1.0;
    store.featuredWindow = 8;
    store.idleShuffleSeed = 42;
    store.allSongs = Array.from({ length: 20 }, (_, i) =>
      createSong(String(i), `Song ${i}`, `song${i}`, i === 15)
    );

    const filtered = store.filteredSongs;
    const featuredInWindow = filtered.slice(0, 8).some((song) => song.featured);

    expect(featuredInWindow).toBe(true);
  });

  it("does not inject featured songs in alphabetical mode", () => {
    const store = useCatalogStore();
    store.initialOrder = "alphabetical";
    store.featuredProbability = 1.0;
    store.featuredWindow = 8;
    store.allSongs = Array.from({ length: 20 }, (_, i) =>
      createSong(String(i), `Song ${i}`, `song${i}`, i === 15)
    );

    const filtered = store.filteredSongs;
    const featuredInWindow = filtered.slice(0, 8).some((song) => song.featured);

    expect(featuredInWindow).toBe(false);
  });

  it("does not inject featured songs when query is active", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.featuredProbability = 1.0;
    store.featuredWindow = 8;
    store.idleShuffleSeed = 42;
    store.query = "song";
    store.allSongs = Array.from({ length: 20 }, (_, i) =>
      createSong(String(i), `Song ${i}`, `song${i}`, i === 15)
    );

    const filtered = store.filteredSongs;
    const featuredInWindow = filtered.slice(0, 8).some((song) => song.featured);

    expect(featuredInWindow).toBe(false);
  });

  it("does not inject when probability is 0", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.featuredProbability = 0.0;
    store.featuredWindow = 8;
    store.idleShuffleSeed = 42;
    store.allSongs = Array.from({ length: 20 }, (_, i) =>
      createSong(String(i), `Song ${i}`, `song${i}`, i === 15)
    );

    const filtered = store.filteredSongs;
    const featuredInWindow = filtered.slice(0, 8).some((song) => song.featured);

    expect(featuredInWindow).toBe(false);
  });

  it("does not duplicate songs after injection", () => {
    const store = useCatalogStore();
    store.initialOrder = "random";
    store.featuredProbability = 1.0;
    store.featuredWindow = 8;
    store.idleShuffleSeed = 42;
    store.allSongs = Array.from({ length: 20 }, (_, i) =>
      createSong(String(i), `Song ${i}`, `song${i}`, i === 15)
    );

    const filtered = store.filteredSongs;
    const ids = filtered.map((song) => song.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });
});
