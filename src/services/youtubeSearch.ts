import type { PlayEventProviderMeta, SearchProviderConfig, SongRecord } from "../types";

export interface YouTubeSearchResult {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
}

export interface YouTubeSearchOptions {
  query: string;
  apiKey: string;
  maxResults?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function buildSearchUrl(query: string, apiKey: string, maxResults: number): string {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(maxResults),
    key: apiKey,
    safeSearch: "moderate"
  });

  return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
}

export function mapYouTubeResultToSong(result: YouTubeSearchResult): SongRecord | null {
  const videoId = result.id?.videoId?.trim();
  const title = result.snippet?.title?.trim();
  if (!videoId || !title) {
    return null;
  }

  const artist = result.snippet?.channelTitle?.trim();
  const thumbnails = result.snippet?.thumbnails;
  const coverUrl = thumbnails?.medium?.url || thumbnails?.default?.url || thumbnails?.high?.url || "";
  const videoUrl = `https://www.youtube.com/embed/${videoId}`;

  return {
    id: `youtube:${videoId}`,
    filename: videoId,
    title,
    artist,
    genres: ["Online"],
    filePath: videoUrl,
    videoCandidates: [videoUrl],
    coverPath: coverUrl,
    displayTitle: title,
    searchIndex: `${title} ${artist ?? ""} ${videoId}`.toLowerCase()
  };
}

export function createYouTubeProviderMeta(videoId: string): PlayEventProviderMeta {
  return {
    id: videoId,
    url: `https://www.youtube.com/embed/${videoId}`
  };
}

export async function searchYouTube(options: YouTubeSearchOptions): Promise<SongRecord[]> {
  const { query, apiKey, maxResults = 20, timeoutMs = 8000, abortSignal, fetchImpl = fetch } = options;
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetchImpl(buildSearchUrl(trimmedQuery, apiKey, maxResults), {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      if (response.status === 403 && text.includes("quota")) {
        throw new Error("YouTube API Quota erreicht.");
      }

      throw new Error(`YouTube API Fehler: HTTP ${response.status}.`);
    }

    const data = (await response.json()) as { items?: YouTubeSearchResult[] };
    const items = Array.isArray(data.items) ? data.items : [];

    return items
      .map((item) => mapYouTubeResultToSong(item))
      .filter((song): song is SongRecord => song !== null)
      .slice(0, maxResults);
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("YouTube API Zeitueberschreitung.");
    }

    throw error;
  }
}
