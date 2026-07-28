import { buildYouTubeEmbedUrl, extractYouTubeVideoId, isYouTubeSource } from "./youtubeEmbed";

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerOptions {
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number; target: YTPlayer }) => void;
  };
}

interface YTPlayer {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
}

let apiReadyPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API nicht im Browser verfuegbar."));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  apiReadyPromise = new Promise<void>((resolve, reject) => {
    const resetPromise = (): void => {
      apiReadyPromise = null;
    };

    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };

    const existingScript = document.getElementById("youtube-iframe-api") as HTMLScriptElement | null;
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.id = "youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      resetPromise();
      reject(new Error("YouTube IFrame API konnte nicht geladen werden."));
    };
    document.body.appendChild(script);

    // Fallback timeout if the API never calls the ready callback.
    window.setTimeout(() => {
      if (!window.YT?.Player) {
        resetPromise();
        reject(new Error("YouTube IFrame API Timeout."));
      }
    }, 10000);
  });

  return apiReadyPromise;
}

export interface YouTubePlayerCallbacks {
  onReady?: (durationSeconds: number) => void;
  onStateChange?: (state: "playing" | "paused" | "ended" | "buffering") => void;
  onTimeUpdate?: (currentTimeSeconds: number, durationSeconds: number) => void;
  onError?: (errorCode: number) => void;
}

export class YouTubePlayerController {
  private player: YTPlayer | null = null;
  private timeUpdateInterval: number | null = null;
  private destroyed = false;
  private callbacks: YouTubePlayerCallbacks;
  private containerId: string;
  private videoId: string;

  constructor(containerId: string, videoId: string, callbacks: YouTubePlayerCallbacks = {}) {
    this.containerId = containerId;
    this.videoId = videoId;
    this.callbacks = callbacks;
  }

  async initialize(): Promise<void> {
    await loadYouTubeIframeApi();

    if (this.destroyed) {
      return;
    }

    const container = document.getElementById(this.containerId);
    if (!container) {
      throw new Error(`YouTube Player Container ${this.containerId} nicht gefunden.`);
    }

    container.innerHTML = "";

    this.player = new window.YT!.Player(this.containerId, {
      videoId: this.videoId,
      playerVars: {
        controls: 0,
        rel: 0,
        modestbranding: 1,
        showinfo: 0,
        fs: 0,
        disablekb: 1,
        iv_load_policy: 3,
        playsinline: 1,
        autoplay: 1,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => this.handleReady(event.target),
        onStateChange: (event) => this.handleStateChange(event.data),
        onError: (event) => this.handleError(event.data)
      }
    });
  }

  private handleReady(player: YTPlayer): void {
    if (this.destroyed) {
      return;
    }

    const duration = player.getDuration();
    this.callbacks.onReady?.(duration);
    this.startTimeUpdates();
    player.playVideo();
  }

  private handleStateChange(state: number): void {
    if (this.destroyed) {
      return;
    }

    const YT = window.YT;
    if (!YT) {
      return;
    }

    if (state === YT.PlayerState.PLAYING) {
      this.callbacks.onStateChange?.("playing");
    } else if (state === YT.PlayerState.PAUSED) {
      this.callbacks.onStateChange?.("paused");
    } else if (state === YT.PlayerState.ENDED) {
      this.callbacks.onStateChange?.("ended");
    } else if (state === YT.PlayerState.BUFFERING) {
      this.callbacks.onStateChange?.("buffering");
    }
  }

  private handleError(errorCode: number): void {
    this.callbacks.onError?.(errorCode);
  }

  private startTimeUpdates(): void {
    this.stopTimeUpdates();
    this.timeUpdateInterval = window.setInterval(() => {
      if (this.destroyed || !this.player) {
        return;
      }

      const currentTime = this.player.getCurrentTime();
      const duration = this.player.getDuration();
      this.callbacks.onTimeUpdate?.(currentTime, duration);
    }, 500);
  }

  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval !== null) {
      window.clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  restart(): void {
    this.player?.seekTo(0, true);
    this.player?.playVideo();
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }

  getDuration(): number {
    return this.player?.getDuration() ?? 0;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopTimeUpdates();
    try {
      this.player?.destroy();
    } catch {
      // Ignore cleanup errors.
    }
    this.player = null;
  }
}

export { isYouTubeSource, extractYouTubeVideoId, buildYouTubeEmbedUrl };
