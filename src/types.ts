export type SongSource = "local" | "online";

export interface PlayEventProviderMeta {
  id?: string;
  url?: string;
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
}

export interface AppConfig {
  app: {
    title: string;
  };
  theme: {
    name: string;
    cssPath: string;
    logoPath: string;
    coverFallbackPath: string;
  };
  features: {
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
    invidious: {
      baseUrls: string[];
    };
  };
  ai: {
    model: string;
    maxSuggestions: number;
    timeoutMs: number;
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
  additionalInfo?: string;
  createdAt: string;
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
}
