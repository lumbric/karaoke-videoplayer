import type { AiChatEvent, PlayEvent, SearchSession, SongSuggestion } from "../types";

const SONG_REQUESTS_KEY = "songRequests";
const PLAYED_LOG_KEY = "playedLog";
const SEARCH_SESSIONS_KEY = "searchSessions";
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

export function loadSearchSessions(): SearchSession[] {
  return parseJsonArray<SearchSession>(localStorage.getItem(SEARCH_SESSIONS_KEY));
}

export function saveSearchSession(session: SearchSession): void {
  const current = loadSearchSessions();
  const existingIndex = current.findIndex((s) => s.sessionId === session.sessionId);
  if (existingIndex >= 0) {
    current[existingIndex] = session;
  } else {
    current.push(session);
  }
  localStorage.setItem(SEARCH_SESSIONS_KEY, JSON.stringify(current));
}

export function loadAiChatLog(): AiChatEvent[] {
  return parseJsonArray<AiChatEvent>(localStorage.getItem(AI_CHAT_LOG_KEY));
}

export function saveAiChatSession(session: AiChatEvent): void {
  const current = loadAiChatLog();
  const existingIndex = current.findIndex((e) => e.id === session.id);
  if (existingIndex >= 0) {
    current[existingIndex] = session;
  } else {
    current.push(session);
  }
  localStorage.setItem(AI_CHAT_LOG_KEY, JSON.stringify(current));
}
