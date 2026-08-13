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
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config.theme.title).toBe("Test");
    expect(config.search.initialOrder).toBe("alphabetical");
    expect(config.providers.searchProviders[0].type).toBe("invidious");
    expect(config.search.featuredProbability).toBe(0.3);
    expect(config.search.featuredWindow).toBe(8);
  });

  it("defaults sendCatalog to true when not provided", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 }
    });

    expect(config.ai.sendCatalog).toBe(true);
  });

  it("parses sendCatalog as false when explicitly set", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: false }
    });

    expect(config.ai.sendCatalog).toBe(false);
  });

  it("normalizes derived theme asset paths from theme name", () => {
    const config = parseConfig({
      theme: { name: "/default/", title: "Demo" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
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
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "desc", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
        providers: baseProviders,
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
      });
    }).toThrow("search.initialOrder");
  });

  it("throws for invalid search provider type", () => {
    expect(() => {
      parseConfig({
        theme: { name: "default", title: "Test" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
        providers: {
          searchProviders: [{ type: "unknown", baseUrls: [] }],
          videoProviders: [{ type: "youtube" }]
        },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
      });
    }).toThrow("searchProviders[0].type");
  });

  it("throws for invalid video provider type", () => {
    expect(() => {
      parseConfig({
        theme: { name: "default", title: "Test" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
        providers: {
          searchProviders: [{ type: "invidious", baseUrls: [] }],
          videoProviders: [{ type: "unknown" }]
        },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
      });
    }).toThrow("videoProviders[0].type");
  });

  it("defaults filterEmbeddableVideos to false when not provided", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config.features.filterEmbeddableVideos).toBe(false);
  });

  it("parses filterEmbeddableVideos when explicitly set to true", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false, filterEmbeddableVideos: true },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config.features.filterEmbeddableVideos).toBe(true);
  });

  it("defaults featuredProbability to 0.3 and featuredWindow to 8 when not provided", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config.search.featuredProbability).toBe(0.3);
    expect(config.search.featuredWindow).toBe(8);
  });

  it("clamps featuredProbability to 0-1 range", () => {
    const config1 = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: -0.5 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config1.search.featuredProbability).toBe(0);

    const config2 = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 1.5 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config2.search.featuredProbability).toBe(1);
  });

  it("clamps featuredWindow to minimum of 1", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredWindow: 0 },
      providers: baseProviders,
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(config.search.featuredWindow).toBe(1);
  });
});

describe("loadRuntimeConfig", () => {
  it("loads and validates fetch payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        theme: { name: "default", title: "Demo" },
        features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "random", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
        providers: {
          searchProviders: [{ type: "invidious", baseUrls: [] }],
          videoProviders: [{ type: "youtube" }]
        },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
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
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: {
        searchProviders: [{ type: "invidious", baseUrls: ["https://example.com"] }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(() => validateProviderSecrets(config, {})).not.toThrow();
  });

  it("throws when youtube search is configured but api key is missing", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: true, onlineSearch: true, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: {
        searchProviders: [{ type: "youtube" }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(() => validateProviderSecrets(config, {})).toThrow("youtubeApiKey");
  });

  it("does not throw when youtube api key is provided", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineFeatures: true, onlineSearch: true, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true, featuredProbability: 0.3, featuredWindow: 8 },
      providers: {
        searchProviders: [{ type: "youtube" }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000, sendCatalog: true }
    });

    expect(() => validateProviderSecrets(config, { youtubeApiKey: "KEY" })).not.toThrow();
  });
});
