import { describe, expect, it, vi } from "vitest";
import { searchOnlineSongs } from "./onlineSearch";

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
        videoThumbnails: [{ url: "https://img.example.com/hqdefault.jpg" }]
      }])
    })) as unknown as typeof fetch;

    const results = await searchOnlineSongs("queen", fetchImpl);

    expect(results).toHaveLength(1);
    expect(results[0].song.id).toBe("online:abc123");
    expect(results[0].song.displayTitle).toBe("Karaoke Queen");
    expect(results[0].provider.id).toBe("abc123");
    expect(results[0].provider.url).toContain("watch?v=abc123");
    expect(results[0].song.videoCandidates[0]).toContain("/api/video/0/latest_version?id=abc123");
  });
});