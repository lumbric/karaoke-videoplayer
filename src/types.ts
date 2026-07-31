export type SongSource = "local" | "online";

export type SearchMethod = "local_search" | "online_search" | "ai_suggestion" | "browse";

export interface PlayEventProviderMeta {
  id?: string;
  url?: string;
}

export type SearchProviderType = "invidious" | "youtube";

export interface SearchProviderConfig {
  type: SearchProviderType;
  baseUrls?: string[];
}

export type VideoProviderType = "youtube" | "invidious";

export interface VideoProviderConfig {
  type: VideoProviderType;
  baseUrls?: string[];
}

export interface SongRecordRaw {
  id?: string;
  filename: string;
  title?: string;
  artist?: string;
  genre?: string | string[];
  duration_seconds?: number;
  file?: string;
  cover?: string;
  has_cover?: boolean;
}

export interface SongRecord {
  id: string;
  filename: string;
  title?: string;
  artist?: string;
  genres: string[];
  durationSeconds?: number;
  filePath: string;
  videoCandidates: string[];
  coverPath: string;
  displayTitle: string;
  searchIndex: string;
  searchTokens?: string[];
}

export interface AppConfig {
  theme: {
    name: string;
    title: string;
  };
  features: {
    onlineFeatures: boolean;
    onlineSearch: boolean;
    aiSuggestions: boolean;
  };
  search: {
    batchSize: number;
    maxDisplayCount: number;
    initialOrder: "alphabetical" | "random";
    randomSeed: number;
    showMetadataSnippet: boolean;
  };
  providers: {
    searchProviders: SearchProviderConfig[];
    videoProviders: VideoProviderConfig[];
  };
  ai: {
    model: string;
    maxSuggestions: number;
    timeoutMs: number;
    sendCatalog: boolean;
  };
  paths: {
    songsJson: string;
    videosBase: string;
    coversBase: string;
  };
}

export interface SongSuggestion {
  title: string;
  artist: string;
  requestedBy?: string;
  additionalInfo?: string;
  createdAt: string;
}

export interface OnlineSongResult {
  song: SongRecord;
  provider: PlayEventProviderMeta;
}

export interface PlayEvent {
  title: string;
  timestamp: string;
  playedSeconds: number;
  totalDuration: number;
  completed: boolean;
  playPercentage: number;
  source: SongSource;
  provider?: PlayEventProviderMeta;
  foundVia?: SearchMethod;
  searchTerm?: string;
}

export interface SecretConfig {
  openAiApiKey?: string;
  youtubeApiKey?: string;
}

export interface ThemeConfig {
  ai?: {
    title?: string;
    logoPath?: string;
  };
}

export type SearchSource = "local" | "online" | "ai";

export interface SearchEvent {
  query: string;
  timestamp: string;
  source: SearchSource;
  resultCount: number;
}

export interface AiChatSuggestion {
  title: string;
  artist: string;
  status: "local" | "online" | "not_found";
}

export interface AiChatEvent {
  timestamp: string;
  userMessage: string;
  assistantMessage: string;
  suggestions: AiChatSuggestion[];
}
