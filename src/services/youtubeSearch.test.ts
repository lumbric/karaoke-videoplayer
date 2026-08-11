import { describe, expect, it, vi } from "vitest";
import { mapYouTubeResultToSong, searchYouTube } from "./youtubeSearch";

describe("mapYouTubeResultToSong", () => {
  it("maps a valid YouTube search result to a SongRecord", () => {
    const song = mapYouTubeResultToSong({
      id: { videoId: "abc123" },
      snippet: {
        title: "Never Gonna Give You Up (Karaoke)",
        channelTitle: "Karaoke Channel",
        thumbnails: {
          medium: { url: "https://example.com/medium.jpg" },
          default: { url: "https://example.com/default.jpg" }
        }
      }
    });

    expect(song).not.toBeNull();
    expect(song!.id).toBe("youtube:abc123");
    expect(song!.displayTitle).toBe("Never Gonna Give You Up (Karaoke)");
    expect(song!.artist).toBe("Karaoke Channel");
    expect(song!.filePath).toBe("https://www.youtube.com/embed/abc123");
    expect(song!.coverPath).toBe("https://example.com/medium.jpg");
  });

  it("returns null when videoId is missing", () => {
    const song = mapYouTubeResultToSong({
      snippet: { title: "Some title" }
    });

    expect(song).toBeNull();
  });
});

describe("searchYouTube", () => {
  it("queries the YouTube Data API and returns mapped songs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: "v1" },
            snippet: {
              title: "Song One Karaoke",
              channelTitle: "Artist A",
              thumbnails: { medium: { url: "https://example.com/1.jpg" } }
            }
          },
          {
            id: { videoId: "v2" },
            snippet: {
              title: "Song Two Karaoke",
              channelTitle: "Artist B",
              thumbnails: { default: { url: "https://example.com/2.jpg" } }
            }
          }
        ]
      })
    });

    const songs = await searchYouTube({
      query: "karaoke test",
      apiKey: "KEY",
      maxResults: 10,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(songs).toHaveLength(2);
    expect(songs[0].id).toBe("youtube:v1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://www.googleapis.com/youtube/v3/search?"),
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("key=KEY");
    expect(url).toContain("q=karaoke+test");
    expect(url).toContain("type=video");
    expect(url).not.toContain("videoEmbeddable");
  });

  it("adds videoEmbeddable=true when requireEmbeddable is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    });

    await searchYouTube({
      query: "karaoke test",
      apiKey: "KEY",
      maxResults: 10,
      requireEmbeddable: true,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("videoEmbeddable=true");
  });

  it("throws a quota error on HTTP 403 with quota message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "quotaExceeded"
    });

    await expect(searchYouTube({
      query: "karaoke",
      apiKey: "KEY",
      fetchImpl: fetchMock as unknown as typeof fetch
    })).rejects.toThrow("Quota erreicht");
  });
});
