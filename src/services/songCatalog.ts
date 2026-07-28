import type { AppConfig, SongRecord, SongRecordRaw } from "../types";
import { getThemeCoverFallbackPath } from "./config";
import { normalizeForSearch } from "../utils/normalize";

function normalizeGenres(genre: string | string[] | undefined): string[] {
  if (!genre) {
    return [];
  }

  if (Array.isArray(genre)) {
    return genre.map((item) => item.trim()).filter(Boolean);
  }

  return [genre.trim()].filter(Boolean);
}

function deriveDisplayTitle(raw: SongRecordRaw): string {
  if (raw.title?.trim()) {
    return raw.title.trim();
  }

  const fromFilename = raw.filename.replace(/[_-]+/g, " ").trim();
  return fromFilename.length > 0 ? fromFilename : "Unbenannter Song";
}

function encodeMediaPath(path: string): string {
  return encodeURI(path);
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter((entry) => entry.trim().length > 0))];
}

function buildVideoCandidates(raw: SongRecordRaw, config: AppConfig): string[] {
  if (raw.file?.trim()) {
    return [encodeMediaPath(raw.file.trim())];
  }

  const filename = raw.filename.trim();
  const hasExtension = /\.[a-z0-9]+$/i.test(filename);
  const bases = uniquePaths([config.paths.videosBase, "/songs", "/videos"]);
  const names = hasExtension ? [filename] : [`${filename}.mp4`, `${filename}.webm`, `${filename}.m4v`];

  return uniquePaths(
    bases.flatMap((base) => names.map((name) => encodeMediaPath(`${base}/${name}`)))
  );
}

function resolveFilePath(raw: SongRecordRaw, config: AppConfig): string {
  return buildVideoCandidates(raw, config)[0] ?? "";
}

function resolveCoverPath(raw: SongRecordRaw, config: AppConfig): string {
  if (raw.cover?.trim()) {
    return raw.cover;
  }

  if (raw.has_cover === false) {
    return getThemeCoverFallbackPath(config);
  }

  return `${config.paths.coversBase}/${raw.filename}.jpg`;
}

function buildSearchIndex(raw: SongRecordRaw, displayTitle: string, genres: string[]): string {
  const components = [
    displayTitle,
    raw.artist ?? "",
    raw.filename,
    genres.join(" ")
  ];

  return normalizeForSearch(components.join(" "));
}

function seededRandom(value: number): number {
  const x = Math.sin(value) * 10000;
  return x - Math.floor(x);
}

export function applyInitialOrder(items: SongRecord[], order: AppConfig["search"]["initialOrder"], randomSeed: number): SongRecord[] {
  if (order === "alphabetical") {
    return [...items].sort((a, b) => a.displayTitle.localeCompare(b.displayTitle, "de"));
  }

  return [...items]
    .map((song, index) => {
      const stable = seededRandom(index + randomSeed * 17 + song.displayTitle.length * 13 + song.filename.length);
      return { song, stable };
    })
    .sort((a, b) => a.stable - b.stable || a.song.displayTitle.localeCompare(b.song.displayTitle, "de"))
    .map((entry) => entry.song);
}

export function mapSongRaw(raw: SongRecordRaw, config: AppConfig): SongRecord {
  const genres = normalizeGenres(raw.genre);
  const displayTitle = deriveDisplayTitle(raw);

  return {
    id: raw.id ?? raw.filename,
    filename: raw.filename,
    title: raw.title,
    artist: raw.artist,
    genres,
    durationSeconds: raw.duration_seconds,
    filePath: resolveFilePath(raw, config),
    videoCandidates: buildVideoCandidates(raw, config),
    coverPath: resolveCoverPath(raw, config),
    displayTitle,
    searchIndex: buildSearchIndex(raw, displayTitle, genres)
  };
}

export async function loadSongCatalog(config: AppConfig, fetchImpl: typeof fetch = fetch): Promise<SongRecord[]> {
  const response = await fetchImpl(config.paths.songsJson, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Songdatei konnte nicht geladen werden: HTTP ${response.status}.`);
  }

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("Songdatei ist kein Array.");
  }

  const rows = json as SongRecordRaw[];
  const mapped = rows
    .filter((row) => typeof row.filename === "string" && row.filename.trim().length > 0)
    .map((row) => mapSongRaw(row, config));

  return applyInitialOrder(mapped, config.search.initialOrder, config.search.randomSeed);
}
