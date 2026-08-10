import { describe, expect, it, vi } from "vitest";
import { getThemeCoverFallbackPath, getThemeCssPath, getThemeLogoPath, loadRuntimeConfig, parseConfig, resolveThemeConfig, validateProviderSecrets } from "./config";

describe("parseConfig", () => {
  const baseProviders = {
    searchProviders: [{ type: "invidious" as const, baseUrls: [] }],
    videoProviders: [{ type: "youtube" as const }]
  };

  it("parses valid config", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(config.theme.title).toBe("Test");
    expect(config.search.initialOrder).toBe("alphabetical");
    expect(config.providers.searchProviders[0].type).toBe("invidious");
  });

  it("defaults sendCatalog to true when not provided", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(config.ai.sendCatalog).toBe(true);
  });

  it("parses sendCatalog as false when explicitly set", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: false },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(config.ai.sendCatalog).toBe(false);
  });

  it("normalizes derived theme asset paths from theme name", () => {
    const config = parseConfig({
      theme: { name: "/default/", title: "Demo" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(getThemeCssPath(config)).toContain("/themes/default/theme.css");
    expect(getThemeLogoPath(config)).toContain("/themes/default/logo.png");
    expect(getThemeCoverFallbackPath(config)).toContain("/themes/default/cover_fallback.svg");
  });

  it("resolves theme config cover fallback path override", () => {
    const themeConfig = resolveThemeConfig("karaoke-ab-hof2026", {
      coverFallbackPath: "themes/karaoke-ab-hof2026/cover_fallback.png"
    });

    expect(themeConfig.coverFallbackPath).toContain("/themes/karaoke-ab-hof2026/cover_fallback.png");
  });

  it("throws for invalid initialOrder", () => {
    expect(() => {
      parseConfig({
        theme: { name: "default", title: "Test" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "desc", randomSeed: 2, showMetadataSnippet: true },
        providers: baseProviders,
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
        paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
      });
    }).toThrow("search.initialOrder");
  });

  it("throws for invalid search provider type", () => {
    expect(() => {
      parseConfig({
        theme: { name: "default", title: "Test" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
        providers: {
          searchProviders: [{ type: "unknown", baseUrls: [] }],
          videoProviders: [{ type: "youtube" }]
        },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
        paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
      });
    }).toThrow("searchProviders[0].type");
  });

  it("throws for invalid video provider type", () => {
    expect(() => {
      parseConfig({
        theme: { name: "default", title: "Test" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
        providers: {
          searchProviders: [{ type: "invidious", baseUrls: [] }],
          videoProviders: [{ type: "unknown" }]
        },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
        paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
      });
    }).toThrow("videoProviders[0].type");
  });
});

describe("loadRuntimeConfig", () => {
  it("loads and validates fetch payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        theme: { name: "default", title: "Demo" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "random", randomSeed: 2, showMetadataSnippet: true },
        providers: {
          searchProviders: [{ type: "invidious", baseUrls: [] }],
          videoProviders: [{ type: "youtube" }]
        },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
        paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
      })
    });

    const config = await loadRuntimeConfig(fetchMock as unknown as typeof fetch);
    expect(config.search.initialOrder).toBe("random");
    expect(config.providers.searchProviders[0].type).toBe("invidious");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("config.json"), { cache: "no-store" });
  });
});

describe("validateProviderSecrets", () => {
  it("does not throw when only invidious search is configured", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: true, onlineSearch: true, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: {
        searchProviders: [{ type: "invidious", baseUrls: ["https://example.com"] }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(() => validateProviderSecrets(config, {})).not.toThrow();
  });

  it("throws when youtube search is configured but api key is missing", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: true, onlineSearch: true, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: {
        searchProviders: [{ type: "youtube" }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(() => validateProviderSecrets(config, {})).toThrow("youtubeApiKey");
  });

  it("does not throw when youtube api key is provided", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: true, onlineSearch: true, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: {
        searchProviders: [{ type: "youtube" }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true },
      paths: { songsJson: "songs.json", videosBase: "videos", coversBase: "covers" }
    });

    expect(() => validateProviderSecrets(config, { youtubeApiKey: "KEY" })).not.toThrow();
  });
});
