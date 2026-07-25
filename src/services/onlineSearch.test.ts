import { describe, expect, it, vi } from "vitest";
import { searchOnlineSongs } from "./onlineSearch";
import type { AppConfig } from "../types";

const config: AppConfig = {
  app: { title: "Test" },
  theme: {
    name: "default",
    cssPath: "/themes/default.css",
    logoPath: "/logo.png",
    coverFallbackPath: "/themes/default-cover-fallback.svg"
  },
  features: { onlineSearch: true, aiSuggestions: false },
  search: {
    batchSize: 20,
    maxDisplayCount: 100,
    initialOrder: "random",
    randomSeed: 1,
    showMetadataSnippet: true
  },
  providers: { invidious: { baseUrls: ["https://vid.example"] } },
  ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000 },
  paths: { songsJson: "/data/songs.json", videosBase: "/songs", coversBase: "/covers" }
};

describe("searchOnlineSongs", () => {
  it("maps invidious video results into song records with provider metadata", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ([{
        type: "video",
        title: "Karaoke Queen",
        author: "Singer",
        videoId: "abc123",
        lengthSeconds: 215,
        videoThumbnails: [{ url: "/vi/abc123/hqdefault.jpg" }]
      }])
    })) as unknown as typeof fetch;

    const results = await searchOnlineSongs(config, "queen", fetchImpl);

    expect(results).toHaveLength(1);
    expect(results[0].song.id).toBe("online:abc123");
    expect(results[0].song.displayTitle).toBe("Karaoke Queen");
    expect(results[0].provider.id).toBe("abc123");
    expect(results[0].provider.url).toContain("watch?v=abc123");
    expect(results[0].song.videoCandidates[0]).toContain("latest_version?id=abc123");
  });
});