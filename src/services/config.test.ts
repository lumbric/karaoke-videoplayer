import { describe, expect, it, vi } from "vitest";
import { getThemeCoverFallbackPath, getThemeCssPath, getThemeLogoPath, loadRuntimeConfig, parseConfig } from "./config";

describe("parseConfig", () => {
  it("parses valid config", () => {
    const config = parseConfig({
      theme: { name: "default", title: "Test" },
      features: { onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: { invidious: { baseUrls: [] } },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 },
      paths: { songsJson: "/songs.json", videosBase: "/videos", coversBase: "/covers" }
    });

    expect(config.theme.title).toBe("Test");
    expect(config.search.initialOrder).toBe("alphabetical");
  });

  it("normalizes derived theme asset paths from theme name", () => {
    const config = parseConfig({
      theme: { name: "/default/", title: "Demo" },
      features: { onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: { invidious: { baseUrls: [] } },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 },
      paths: { songsJson: "/songs.json", videosBase: "/videos", coversBase: "/covers" }
    });

    expect(getThemeCssPath(config)).toBe("/themes/default/theme.css");
    expect(getThemeLogoPath(config)).toBe("/themes/default/logo.svg");
    expect(getThemeCoverFallbackPath(config)).toBe("/themes/default/cover_fallback.svg");
  });

  it("throws for invalid initialOrder", () => {
    expect(() => {
      parseConfig({
        theme: { name: "default", title: "Test" },
        features: { onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "desc", randomSeed: 2, showMetadataSnippet: true },
        providers: { invidious: { baseUrls: [] } },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 },
        paths: { songsJson: "/songs.json", videosBase: "/videos", coversBase: "/covers" }
      });
    }).toThrow("search.initialOrder");
  });
});

describe("loadRuntimeConfig", () => {
  it("loads and validates fetch payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        theme: { name: "default", title: "Demo" },
        features: { onlineSearch: false, aiSuggestions: false },
        search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "random", randomSeed: 2, showMetadataSnippet: true },
        providers: { invidious: { baseUrls: [] } },
        ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 },
        paths: { songsJson: "/songs.json", videosBase: "/videos", coversBase: "/covers" }
      })
    });

    const config = await loadRuntimeConfig(fetchMock as unknown as typeof fetch);
    expect(config.search.initialOrder).toBe("random");
    expect(fetchMock).toHaveBeenCalledWith("/config.json", { cache: "no-store" });
  });
});
