import type { AppConfig, OnlineSongResult, SongRecord } from "../types";
import { normalizeForSearch } from "../utils/normalize";

interface InvidiousSearchItem {
  type?: string;
  title?: string;
  author?: string;
  videoId?: string;
  videoThumbnails?: Array<{ quality?: string; url?: string }>;
  lengthSeconds?: number;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildVideoCandidates(baseUrl: string, videoId: string): string[] {
  const base = normalizeBaseUrl(baseUrl);
  return [18, 22].map((itag) => `${base}/latest_version?id=${encodeURIComponent(videoId)}&itag=${itag}&local=true`);
}

function resolveThumbnail(baseUrl: string, item: InvidiousSearchItem): string {
  const preferred = item.videoThumbnails?.find((entry) => typeof entry.url === "string" && entry.url.length > 0)?.url;
  if (preferred) {
    if (/^https?:\/\//i.test(preferred)) {
      return preferred;
    }

    return `${normalizeBaseUrl(baseUrl)}${preferred.startsWith("/") ? "" : "/"}${preferred}`;
  }

  return `${normalizeBaseUrl(baseUrl)}/vi/${encodeURIComponent(item.videoId ?? "")}/hqdefault.jpg`;
}

function toSongRecord(baseUrl: string, item: InvidiousSearchItem): OnlineSongResult | null {
  if (item.type !== "video" || !item.videoId || !item.title) {
    return null;
  }

  const providerUrl = `${normalizeBaseUrl(baseUrl)}/watch?v=${encodeURIComponent(item.videoId)}`;
  const song: SongRecord = {
    id: `online:${item.videoId}`,
    filename: item.videoId,
    title: item.title,
    artist: item.author,
    genres: ["online"],
    durationSeconds: item.lengthSeconds,
    filePath: buildVideoCandidates(baseUrl, item.videoId)[0],
    videoCandidates: buildVideoCandidates(baseUrl, item.videoId),
    coverPath: resolveThumbnail(baseUrl, item),
    displayTitle: item.title,
    searchIndex: normalizeForSearch([item.title, item.author ?? "", item.videoId].join(" "))
  };

  return {
    song,
    provider: {
      id: item.videoId,
      url: providerUrl
    }
  };
}

async function fetchFromBaseUrl(baseUrl: string, query: string, fetchImpl: typeof fetch): Promise<OnlineSongResult[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/search?q=${encodeURIComponent(`karaoke ${query}`)}&type=video&page=1`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("ungueltige Antwort");
  }

  return json
    .map((entry) => toSongRecord(baseUrl, entry as InvidiousSearchItem))
    .filter((entry): entry is OnlineSongResult => entry !== null);
}

export async function searchOnlineSongs(config: AppConfig, query: string, fetchImpl: typeof fetch = fetch): Promise<OnlineSongResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return [];
  }

  const baseUrls = config.providers.invidious.baseUrls.filter((entry) => entry.trim().length > 0);
  if (baseUrls.length === 0) {
    throw new Error("Keine Invidious-Provider konfiguriert.");
  }

  let lastError: Error | null = null;

  for (const baseUrl of baseUrls) {
    try {
      return await fetchFromBaseUrl(baseUrl, trimmedQuery, fetchImpl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Online-Suche fehlgeschlagen.");
}