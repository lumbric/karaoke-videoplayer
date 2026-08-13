import type { PlayEventProviderMeta, SearchProviderConfig, SongRecord } from "../types";
import { tokenizeNormalized } from "../utils/normalize";

export interface InvidiousSearchResult {
  type?: string;
  title?: string;
  videoId?: string;
  author?: string;
  lengthSeconds?: number;
  videoThumbnails?: Array<{ url?: string; quality?: string; width?: number; height?: number }>;
}

export interface InvidiousSearchOptions {
  query: string;
  provider: SearchProviderConfig;
  maxResults?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function pickThumbnail(thumbnails: InvidiousSearchResult["videoThumbnails"]): string {
  if (!thumbnails || thumbnails.length === 0) {
    return "";
  }

  const preferred = thumbnails.find((thumb) => thumb.quality === "medium" || thumb.width === 320);
  if (preferred?.url) {
    return preferred.url;
  }

  const largest = thumbnails
    .filter((thumb) => thumb.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return largest?.url ?? "";
}

export function mapInvidiousResultToSong(result: InvidiousSearchResult): SongRecord | null {
  if (result.type && result.type !== "video") {
    return null;
  }

  const videoId = result.videoId?.trim();
  const title = result.title?.trim();
  if (!videoId || !title) {
    return null;
  }

  const displayTitle = title;
  const artist = result.author?.trim();
  const durationSeconds = typeof result.lengthSeconds === "number" && Number.isFinite(result.lengthSeconds) && result.lengthSeconds > 0
    ? result.lengthSeconds
    : undefined;
  const coverUrl = pickThumbnail(result.videoThumbnails);
  const videoUrl = `https://www.youtube.com/embed/${videoId}`;

  return {
    id: `invidious:${videoId}`,
    filename: videoId,
    title,
    artist,
    genres: ["Online"],
    durationSeconds,
    filePath: videoUrl,
    videoCandidates: [videoUrl],
    coverPath: coverUrl || "",
    displayTitle,
    searchIndex: artist ? `${artist} ${displayTitle}` : displayTitle,
    searchTokens: tokenizeNormalized(artist ? `${artist} ${displayTitle}` : displayTitle),
    featured: false
  };
}

function buildSearchUrl(baseUrl: string, query: string, maxResults: number): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const encodedQuery = encodeURIComponent(query);
  return `${normalizedBase}/api/v1/search?q=${encodedQuery}&type=video&region=AT&sort_by=relevance`;
}

function isValidResponse(value: unknown): value is InvidiousSearchResult[] {
  return Array.isArray(value);
}

export async function searchInvidious(options: InvidiousSearchOptions): Promise<SongRecord[]> {
  const { query, provider, maxResults = 20, timeoutMs = 8000, abortSignal, fetchImpl = fetch } = options;
  const baseUrls = provider.baseUrls?.filter((url) => url.trim().length > 0) ?? [];

  if (baseUrls.length === 0) {
    throw new Error("Keine Invidious-Base-URLs konfiguriert.");
  }

  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

      if (abortSignal) {
        abortSignal.addEventListener("abort", () => controller.abort());
      }

      const response = await fetchImpl(buildSearchUrl(baseUrl, query, maxResults), {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });

      window.clearTimeout(timeoutId);

      if (!response.ok) {
        errors.push(`${baseUrl}: HTTP ${response.status}`);
        continue;
      }

      const data = (await response.json()) as unknown;
      if (!isValidResponse(data)) {
        errors.push(`${baseUrl}: Ungültige Antwort`);
        continue;
      }

      const mapped = data
        .map((item) => mapInvidiousResultToSong(item))
        .filter((song): song is SongRecord => song !== null)
        .slice(0, maxResults);

      if (mapped.length === 0) {
        return [];
      }

      return mapped;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        errors.push(`${baseUrl}: Zeitüberschreitung`);
      } else {
        errors.push(`${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  throw new Error(`Invidious-Suche fehlgeschlagen: ${errors.join("; ")}`);
}

export function createInvidiousProviderMeta(videoId: string): PlayEventProviderMeta {
  return {
    id: videoId,
    url: `https://www.youtube.com/embed/${videoId}`
  };
}
