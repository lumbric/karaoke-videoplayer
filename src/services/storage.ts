import type { PlayEvent, SongSuggestion } from "../types";

const SONG_REQUESTS_KEY = "songRequests";
const PLAYED_LOG_KEY = "playedLog";

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function loadSongSuggestions(): SongSuggestion[] {
  return parseJsonArray<SongSuggestion>(localStorage.getItem(SONG_REQUESTS_KEY));
}

export function loadPlayedLog(): PlayEvent[] {
  return parseJsonArray<PlayEvent>(localStorage.getItem(PLAYED_LOG_KEY));
}

export function appendPlayEvent(entry: PlayEvent): void {
  const current = loadPlayedLog();
  current.push(entry);
  localStorage.setItem(PLAYED_LOG_KEY, JSON.stringify(current));
}

export function saveSongSuggestion(entry: SongSuggestion): { ok: true } | { ok: false; reason: string } {
  const current = loadSongSuggestions();

  const duplicate = current.some((item) => {
    return item.title.trim().toLowerCase() === entry.title.trim().toLowerCase() && item.artist.trim().toLowerCase() === entry.artist.trim().toLowerCase();
  });

  if (duplicate) {
    return { ok: false, reason: "Dieser Wunsch wurde bereits eingetragen." };
  }

  current.push(entry);
  localStorage.setItem(SONG_REQUESTS_KEY, JSON.stringify(current));

  return { ok: true };
}
