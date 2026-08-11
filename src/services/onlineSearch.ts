import type { SearchProviderConfig, SecretConfig, SongRecord } from "../types";
import { searchInvidious } from "./invidiousSearch";
import { searchYouTube } from "./youtubeSearch";

export interface OnlineSearchOptions {
  query: string;
  providers: SearchProviderConfig[];
  secret: SecretConfig;
  maxResults?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  fetchImpl?: typeof fetch;
  requireEmbeddable?: boolean;
}

export async function searchOnline(options: OnlineSearchOptions): Promise<SongRecord[]> {
  const { query, providers, secret, maxResults = 20, timeoutMs = 8000, abortSignal, fetchImpl = fetch, requireEmbeddable = false } = options;
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return [];
  }

  const providerQuery = `${trimmedQuery} karaoke`;

  if (providers.length === 0) {
    throw new Error("Keine Online-Search-Provider konfiguriert.");
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      if (provider.type === "invidious") {
        return await searchInvidious({
          query: providerQuery,
          provider,
          maxResults,
          timeoutMs,
          abortSignal,
          fetchImpl
        });
      }

      if (provider.type === "youtube") {
        if (!secret.youtubeApiKey) {
          errors.push("YouTube: API-Key fehlt");
          continue;
        }

        return await searchYouTube({
          query: providerQuery,
          apiKey: secret.youtubeApiKey,
          maxResults,
          timeoutMs,
          abortSignal,
          fetchImpl,
          requireEmbeddable
        });
      }

      errors.push(`Unbekannter Provider: ${provider.type}`);
    } catch (error) {
      errors.push(`${provider.type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Online-Suche fehlgeschlagen: ${errors.join("; ")}`);
}
