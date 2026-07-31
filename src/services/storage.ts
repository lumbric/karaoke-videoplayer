import type { AiChatEvent, PlayEvent, SearchEvent, SongSuggestion } from "../types";

const SONG_REQUESTS_KEY = "songRequests";
const PLAYED_LOG_KEY = "playedLog";
const SEARCH_LOG_KEY = "searchLog";
const AI_CHAT_LOG_KEY = "aiChatLog";

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

export function loadSearchLog(): SearchEvent[] {
  return parseJsonArray<SearchEvent>(localStorage.getItem(SEARCH_LOG_KEY));
}

export function appendSearchEvent(entry: SearchEvent): void {
  const current = loadSearchLog();
  current.push(entry);
  localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(current));
}

export function loadAiChatLog(): AiChatEvent[] {
  return parseJsonArray<AiChatEvent>(localStorage.getItem(AI_CHAT_LOG_KEY));
}

export function appendAiChatEvent(entry: AiChatEvent): void {
  const current = loadAiChatLog();
  current.push(entry);
  localStorage.setItem(AI_CHAT_LOG_KEY, JSON.stringify(current));
}
