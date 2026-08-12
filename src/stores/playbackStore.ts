import { defineStore } from "pinia";
import type { PlayEventProviderMeta, SearchMethod, SongRecord, SongSource } from "../types";
import { appendPlayEvent } from "../services/storage";

interface PlaybackState {
  activeSong: SongRecord | null;
  source: SongSource;
  provider?: PlayEventProviderMeta;
  foundVia?: SearchMethod;
  searchTerm?: string;
  isOpen: boolean;
  isPaused: boolean;
  currentTimeSeconds: number;
  totalDurationSeconds: number;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundSeconds(value: number): number {
  return Math.max(0, Math.round(value));
}

export const usePlaybackStore = defineStore("playback", {
  state: (): PlaybackState => ({
    activeSong: null,
    source: "local",
    provider: undefined,
    foundVia: undefined,
    searchTerm: undefined,
    isOpen: false,
    isPaused: false,
    currentTimeSeconds: 0,
    totalDurationSeconds: 0
  }),
  getters: {
    hasActiveSong: (state) => state.activeSong !== null,
    playbackLabel: (state) => (state.activeSong ? state.activeSong.displayTitle : ""),
    playPercentage: (state) => {
      if (state.totalDurationSeconds <= 0) {
        return 0;
      }

      return Math.min(100, Math.round((state.currentTimeSeconds / state.totalDurationSeconds) * 100));
    }
  },
  actions: {
    openSong(song: SongRecord, source: SongSource = "local", provider?: PlayEventProviderMeta, foundVia?: SearchMethod, searchTerm?: string): void {
      this.activeSong = song;
      this.source = source;
      this.provider = provider;
      this.foundVia = foundVia;
      this.searchTerm = searchTerm;
      this.isOpen = true;
      this.isPaused = false;
      this.currentTimeSeconds = 0;
      this.totalDurationSeconds = song.durationSeconds ?? 0;
    },
    setPlaybackProgress(currentTimeSeconds: number, totalDurationSeconds: number): void {
      this.currentTimeSeconds = clampNonNegative(currentTimeSeconds);
      this.totalDurationSeconds = clampNonNegative(totalDurationSeconds);
    },
    setPaused(isPaused: boolean): void {
      this.isPaused = isPaused;
    },
    closePlayback(completed = false): void {
      if (!this.activeSong) {
        return;
      }

      const duration = this.totalDurationSeconds > 0 ? this.totalDurationSeconds : this.activeSong.durationSeconds ?? 0;
      const playedSeconds = clampNonNegative(this.currentTimeSeconds > 0 ? this.currentTimeSeconds : completed ? duration : 0);
      const totalDuration = clampNonNegative(duration);
      const percentage = totalDuration > 0 ? Math.min(100, Math.round((playedSeconds / totalDuration) * 100)) : 0;

      appendPlayEvent({
        title: this.activeSong.displayTitle,
        artist: this.activeSong.artist,
        timestamp: new Date().toISOString(),
        playedSeconds: roundSeconds(playedSeconds),
        totalDuration: roundSeconds(totalDuration),
        completed,
        playPercentage: percentage,
        source: this.source,
        provider: this.provider,
        foundVia: this.foundVia,
        searchTerm: this.searchTerm
      });

      this.activeSong = null;
      this.provider = undefined;
      this.foundVia = undefined;
      this.searchTerm = undefined;
      this.isOpen = false;
      this.isPaused = false;
      this.currentTimeSeconds = 0;
      this.totalDurationSeconds = 0;
      this.source = "local";
    }
  }
});
