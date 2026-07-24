import { describe, expect, it, vi } from "vitest";
import { loadRuntimeConfig, parseConfig } from "./config";

describe("parseConfig", () => {
  it("parses valid config", () => {
    const config = parseConfig({
      app: { title: "Test" },
      theme: { name: "default", cssPath: "/themes/default.css", logoPath: "/logo.png", coverFallbackPath: "/fallback.svg" },
      features: { onlineSearch: false, aiSuggestions: false },
      search: { batchSize: 20, maxDisplayCount: 100, initialOrder: "alphabetical", randomSeed: 2, showMetadataSnippet: true },
      providers: { invidious: { baseUrls: [] } },
      ai: { model: "x", maxSuggestions: 3, timeoutMs: 2000 },
      paths: { songsJson: "/songs.json", videosBase: "/videos", coversBase: "/covers" }
    });

    expect(config.app.title).toBe("Test");
    expect(config.search.initialOrder).toBe("alphabetical");
  });

  it("throws for invalid initialOrder", () => {
    expect(() => {
      parseConfig({
        app: { title: "Test" },
        theme: { name: "default", cssPath: "/themes/default.css", logoPath: "/logo.png", coverFallbackPath: "/fallback.svg" },
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
        app: { title: "Demo" },
        theme: { name: "default", cssPath: "/themes/default.css", logoPath: "/logo.png", coverFallbackPath: "/fallback.svg" },
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
