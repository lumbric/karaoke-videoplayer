import { describe, expect, it, vi } from "vitest";
import { searchOnline } from "./onlineSearch";
import * as invidiousSearch from "./invidiousSearch";
import * as youtubeSearch from "./youtubeSearch";
import type { SearchProviderConfig, SecretConfig } from "../types";

describe("searchOnline", () => {
  it("uses the invidious provider to return songs", async () => {
    const spy = vi.spyOn(invidiousSearch, "searchInvidious").mockResolvedValue([
      {
        id: "invidious:v1",
        filename: "v1",
        displayTitle: "Online Song",
        artist: "Artist",
        genres: ["Online"],
        filePath: "https://www.youtube.com/embed/v1",
        videoCandidates: ["https://www.youtube.com/embed/v1"],
        coverPath: "",
        searchIndex: "online song artist"
      }
    ]);

    const providers: SearchProviderConfig[] = [{ type: "invidious", baseUrls: ["https://iv.example.com"] }];
    const secret: SecretConfig = {};

    const songs = await searchOnline({ query: "karaoke", providers, secret });

    expect(songs).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: "karaoke karaoke" }));

    spy.mockRestore();
  });

  it("uses the youtube provider to return songs", async () => {
    const spy = vi.spyOn(youtubeSearch, "searchYouTube").mockResolvedValue([
      {
        id: "youtube:v1",
        filename: "v1",
        displayTitle: "YouTube Song",
        artist: "Artist",
        genres: ["Online"],
        filePath: "https://www.youtube.com/embed/v1",
        videoCandidates: ["https://www.youtube.com/embed/v1"],
        coverPath: "",
        searchIndex: "youtube song artist"
      }
    ]);

    const providers: SearchProviderConfig[] = [{ type: "youtube" }];
    const secret: SecretConfig = { youtubeApiKey: "TEST_KEY" };

    const songs = await searchOnline({ query: "karaoke", providers, secret });

    expect(songs).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: "karaoke karaoke", apiKey: "TEST_KEY" }));

    spy.mockRestore();
  });

  it("throws when no providers are configured", async () => {
    await expect(searchOnline({ query: "karaoke", providers: [], secret: {} })).rejects.toThrow("Keine Online-Search-Provider");
  });

  it("reports missing youtube key when youtube provider is used", async () => {
    const providers: SearchProviderConfig[] = [{ type: "youtube" }];
    const secret: SecretConfig = {};

    await expect(searchOnline({ query: "karaoke", providers, secret })).rejects.toThrow("API-Key fehlt");
  });
});
