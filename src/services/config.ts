import type { AppConfig, SecretConfig, SearchProviderConfig, VideoProviderConfig } from "../types";

function normalizeThemeName(name: string): string {
  return name.trim().replace(/^\/+|\/+$/g, "");
}

export function getThemeCssPath(config: AppConfig): string {
  return `/themes/${normalizeThemeName(config.theme.name)}/theme.css`;
}

export function getThemeLogoPath(config: AppConfig): string {
  return `/themes/${normalizeThemeName(config.theme.name)}/logo.png`;
}

export function getThemeLogoFallbackPath(config: AppConfig): string {
  return `/themes/${normalizeThemeName(config.theme.name)}/logo.svg`;
}

export function getThemeCoverFallbackPath(config: AppConfig): string {
  return `/themes/${normalizeThemeName(config.theme.name)}/cover_fallback.svg`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function ensureString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Ungueltige Konfiguration: ${path} muss ein nicht-leerer String sein.`);
  }

  return value;
}

function ensureBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Ungueltige Konfiguration: ${path} muss true oder false sein.`);
  }

  return value;
}

function ensureNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Ungueltige Konfiguration: ${path} muss eine Zahl sein.`);
  }

  return value;
}

function ensureStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Ungueltige Konfiguration: ${path} muss ein String-Array sein.`);
  }

  return value;
}

function ensureSearchProvider(value: unknown, path: string): SearchProviderConfig {
  if (!isObject(value)) {
    throw new Error(`Ungueltige Konfiguration: ${path} muss ein Objekt sein.`);
  }

  const type = ensureString(value.type, `${path}.type`);
  if (type !== "invidious" && type !== "youtube") {
    throw new Error(`Ungueltige Konfiguration: ${path}.type muss "invidious" oder "youtube" sein.`);
  }

  const baseUrls = value.baseUrls !== undefined ? ensureStringArray(value.baseUrls, `${path}.baseUrls`) : undefined;

  return { type, baseUrls };
}

function ensureVideoProvider(value: unknown, path: string): VideoProviderConfig {
  if (!isObject(value)) {
    throw new Error(`Ungueltige Konfiguration: ${path} muss ein Objekt sein.`);
  }

  const type = ensureString(value.type, `${path}.type`);
  if (type !== "youtube" && type !== "invidious") {
    throw new Error(`Ungueltige Konfiguration: ${path}.type muss "youtube" oder "invidious" sein.`);
  }

  const baseUrls = value.baseUrls !== undefined ? ensureStringArray(value.baseUrls, `${path}.baseUrls`) : undefined;

  return { type, baseUrls };
}

function ensureProviderArray<T>(value: unknown, path: string, ensureItem: (item: unknown, itemPath: string) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Ungueltige Konfiguration: ${path} muss ein Array sein.`);
  }

  return value.map((item, index) => ensureItem(item, `${path}[${index}]`));
}

export function parseConfig(raw: unknown): AppConfig {
  if (!isObject(raw)) {
    throw new Error("Ungueltige Konfiguration: Wurzelobjekt fehlt.");
  }

  const { theme, features, search, providers, ai, paths } = raw;

  if (!isObject(theme) || !isObject(features) || !isObject(search) || !isObject(providers) || !isObject(ai) || !isObject(paths)) {
    throw new Error("Ungueltige Konfiguration: Ein oder mehrere Top-Level Abschnitte fehlen.");
  }

  const searchProviders = ensureProviderArray(providers.searchProviders, "providers.searchProviders", ensureSearchProvider);
  const videoProviders = ensureProviderArray(providers.videoProviders, "providers.videoProviders", ensureVideoProvider);

  const initialOrder = ensureString(search.initialOrder, "search.initialOrder");
  if (initialOrder !== "alphabetical" && initialOrder !== "random") {
    throw new Error("Ungueltige Konfiguration: search.initialOrder muss alphabetical oder random sein.");
  }

  return {
    theme: {
      name: ensureString(theme.name, "theme.name"),
      title: ensureString(theme.title, "theme.title")
    },
    features: {
      onlineFeatures: ensureBoolean(features.onlineFeatures, "features.onlineFeatures"),
      onlineSearch: ensureBoolean(features.onlineSearch, "features.onlineSearch"),
      aiSuggestions: ensureBoolean(features.aiSuggestions, "features.aiSuggestions")
    },
    search: {
      batchSize: Math.max(1, Math.floor(ensureNumber(search.batchSize, "search.batchSize"))),
      maxDisplayCount: Math.max(1, Math.floor(ensureNumber(search.maxDisplayCount, "search.maxDisplayCount"))),
      initialOrder,
      randomSeed: Math.floor(ensureNumber(search.randomSeed, "search.randomSeed")),
      showMetadataSnippet: ensureBoolean(search.showMetadataSnippet, "search.showMetadataSnippet")
    },
    providers: {
      searchProviders,
      videoProviders
    },
    ai: {
      model: ensureString(ai.model, "ai.model"),
      maxSuggestions: Math.max(1, Math.floor(ensureNumber(ai.maxSuggestions, "ai.maxSuggestions"))),
      timeoutMs: Math.max(250, Math.floor(ensureNumber(ai.timeoutMs, "ai.timeoutMs")))
    },
    paths: {
      songsJson: ensureString(paths.songsJson, "paths.songsJson"),
      videosBase: ensureString(paths.videosBase, "paths.videosBase"),
      coversBase: ensureString(paths.coversBase, "paths.coversBase")
    }
  };
}

export async function loadRuntimeConfig(fetchImpl: typeof fetch = fetch): Promise<AppConfig> {
  let response: Response;
  try {
    response = await fetchImpl("/config.json", { cache: "no-store" });
  } catch (error) {
    throw new Error(`Konfiguration konnte nicht geladen werden: ${String(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Konfiguration konnte nicht geladen werden: HTTP ${response.status}.`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("Konfiguration ist kein gueltiges JSON.");
  }

  return parseConfig(json);
}

export function validateProviderSecrets(config: AppConfig, secret: SecretConfig): void {
  const needsYoutubeApiKey = config.providers.searchProviders.some((provider) => provider.type === "youtube");
  if (needsYoutubeApiKey && !secret.youtubeApiKey) {
    throw new Error("Ungueltige Konfiguration: YouTube als Search-Provider konfiguriert, aber youtubeApiKey in secret-config.json fehlt.");
  }
}
