import { describe, expect, it, vi } from "vitest";
import { mapInvidiousResultToSong, searchInvidious } from "./invidiousSearch";
import type { SearchProviderConfig } from "../types";

describe("mapInvidiousResultToSong", () => {
  it("maps a valid video result to a SongRecord", () => {
    const song = mapInvidiousResultToSong({
      type: "video",
      videoId: "abc123",
      title: "Never Gonna Give You Up (Karaoke)",
      author: "Karaoke Channel",
      lengthSeconds: 213,
      videoThumbnails: [
        { url: "https://example.com/maxres.jpg", quality: "maxres", width: 1280, height: 720 },
        { url: "https://example.com/medium.jpg", quality: "medium", width: 320, height: 180 }
      ]
    });

    expect(song).not.toBeNull();
    expect(song!.id).toBe("invidious:abc123");
    expect(song!.displayTitle).toBe("Never Gonna Give You Up (Karaoke)");
    expect(song!.artist).toBe("Karaoke Channel");
    expect(song!.durationSeconds).toBe(213);
    expect(song!.filePath).toBe("https://www.youtube.com/embed/abc123");
    expect(song!.coverPath).toBe("https://example.com/medium.jpg");
  });

  it("returns null when videoId is missing", () => {
    const song = mapInvidiousResultToSong({
      type: "video",
      title: "Some title"
    });

    expect(song).toBeNull();
  });

  it("returns null for non-video types", () => {
    const song = mapInvidiousResultToSong({
      type: "channel",
      videoId: "abc123",
      title: "A channel"
    });

    expect(song).toBeNull();
  });
});

describe("searchInvidious", () => {
  it("queries the configured base URL and returns mapped songs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          type: "video",
          videoId: "v1",
          title: "Song One Karaoke",
          author: "Artist A",
          lengthSeconds: 180,
          videoThumbnails: [{ url: "https://example.com/1.jpg", quality: "medium", width: 320 }]
        },
        {
          type: "video",
          videoId: "v2",
          title: "Song Two Karaoke",
          author: "Artist B",
          lengthSeconds: 200,
          videoThumbnails: [{ url: "https://example.com/2.jpg", quality: "medium", width: 320 }]
        }
      ]
    });

    const provider: SearchProviderConfig = { type: "invidious", baseUrls: ["https://iv.example.com"] };
    const songs = await searchInvidious({
      query: "karaoke test",
      provider,
      maxResults: 10,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(songs).toHaveLength(2);
    expect(songs[0].id).toBe("invidious:v1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://iv.example.com/api/v1/search?q="),
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("falls back to the next base URL when the first fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            type: "video",
            videoId: "v1",
            title: "Fallback Song",
            author: "Artist",
            lengthSeconds: 150,
            videoThumbnails: []
          }
        ]
      });

    const provider: SearchProviderConfig = { type: "invidious", baseUrls: ["https://bad.example.com", "https://good.example.com"] };
    const songs = await searchInvidious({
      query: "karaoke",
      provider,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(songs).toHaveLength(1);
    expect(songs[0].displayTitle).toBe("Fallback Song");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when no base URLs are configured", async () => {
    const provider: SearchProviderConfig = { type: "invidious", baseUrls: [] };

    await expect(searchInvidious({ query: "karaoke", provider })).rejects.toThrow("Keine Invidious-Base-URLs");
  });
});
