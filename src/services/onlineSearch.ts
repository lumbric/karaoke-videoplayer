import type { OnlineSongResult, SongRecord } from "../types";
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

function buildVideoCandidates(videoId: string): string[] {
  // Use proxied video URLs: /api/video/{instance}/latest_version?id=...&itag=...
  return [18, 22].map(
    (itag) =>
      `/api/video/0/latest_version?id=${encodeURIComponent(videoId)}&itag=${itag}&local=true`
  );
}

function resolveThumbnail(item: InvidiousSearchItem): string {
  const preferred = item.videoThumbnails
    ?.find((entry) => typeof entry.url === "string" && entry.url.length > 0)
    ?.url;

  if (preferred && /^https?:\/\//i.test(preferred)) {
    return preferred;
  }

  // Default thumbnail from Invidious
  return `https://img.youtube.com/vi/${encodeURIComponent(item.videoId ?? "")}/hqdefault.jpg`;
}

function toSongRecord(baseUrl: string, item: InvidiousSearchItem): OnlineSongResult | null {
  if (item.type !== "video" || !item.videoId || !item.title) {
    return null;
  }

  const providerUrl = `${normalizeBaseUrl(baseUrl)}/watch?v=${encodeURIComponent(
    item.videoId
  )}`;
  const song: SongRecord = {
    id: `online:${item.videoId}`,
    filename: item.videoId,
    title: item.title,
    artist: item.author,
    genres: ["online"],
    durationSeconds: item.lengthSeconds,
    filePath: buildVideoCandidates(item.videoId)[0],
    videoCandidates: buildVideoCandidates(item.videoId),
    coverPath: resolveThumbnail(item),
    displayTitle: item.title,
    searchIndex: normalizeForSearch(
      [item.title, item.author ?? "", item.videoId].join(" ")
    )
  };

  return {
    song,
    provider: {
      id: item.videoId,
      url: providerUrl
    }
  };
}

export async function searchOnlineSongs(query: string, fetchImpl: typeof fetch = fetch): Promise<OnlineSongResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return [];
  }

  try {
    // Use local proxy which handles fallback across Invidious instances
    const url = `/api/invidious?q=${encodeURIComponent(
      `karaoke ${trimmedQuery}`
    )}&type=video&page=1`;
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as unknown;
    if (!Array.isArray(json)) {
      throw new Error("Invalid response");
    }

    // All results use the same provider (configured in proxy)
    const baseUrl = "https://invidious.example.com"; // Placeholder, actual URL doesn't matter for CORS
    return json
      .map((entry) => toSongRecord(baseUrl, entry as InvidiousSearchItem))
      .filter((entry): entry is OnlineSongResult => entry !== null);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Online search failed");
  }
}