import type { PlayEvent } from "../types";

export interface SongAggregate {
  title: string;
  artist?: string;
  count: number;
  averageCompletion: number;
}

export interface StatsSummary {
  totalSongsPlayed: number;
  totalPlayTimeSeconds: number;
  mostPlayedSong: string | null;
  completionRate: number;
  topSongs: SongAggregate[];
  completionDistribution: Array<{ label: string; count: number }>;
  playTimeDistribution: Array<{ label: string; count: number }>;
  hourlyActivity: Array<{ hour: number; count: number }>;
  recentActivity: PlayEvent[];
  instantSkips: SongAggregate[];
  skippedSongs: SongAggregate[];
  hiddenGems: SongAggregate[];
  retryPatterns: SongAggregate[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toSortedRecent(events: PlayEvent[]): PlayEvent[] {
  return [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function buildSongAggregates(events: PlayEvent[]): SongAggregate[] {
  const map = new Map<string, { title: string; artist?: string; count: number; completionTotal: number }>();

  for (const event of events) {
    const key = event.title;
    const previous = map.get(key) ?? { title: event.title, artist: event.artist, count: 0, completionTotal: 0 };
    previous.count += 1;
    previous.completionTotal += clampPercent(event.playPercentage);
    if (!previous.artist && event.artist) {
      previous.artist = event.artist;
    }
    map.set(key, previous);
  }

  return [...map.values()]
    .map((value) => ({
      title: value.title,
      artist: value.artist,
      count: value.count,
      averageCompletion: round(value.completionTotal / value.count)
    }))
    .sort((a, b) => b.count - a.count || b.averageCompletion - a.averageCompletion || a.title.localeCompare(b.title, "de"));
}

function completionBuckets(events: PlayEvent[]): Array<{ label: string; count: number }> {
  const ranges = [
    { label: "0-24%", min: 0, max: 24 },
    { label: "25-49%", min: 25, max: 49 },
    { label: "50-74%", min: 50, max: 74 },
    { label: "75-99%", min: 75, max: 99 },
    { label: "100%", min: 100, max: 100 }
  ];

  return ranges.map((range) => ({
    label: range.label,
    count: events.filter((event) => {
      const value = clampPercent(event.playPercentage);
      return value >= range.min && value <= range.max;
    }).length
  }));
}

function playTimeBuckets(events: PlayEvent[]): Array<{ label: string; count: number }> {
  const ranges = [
    { label: "<30s", min: 0, max: 29 },
    { label: "30-119s", min: 30, max: 119 },
    { label: "120-299s", min: 120, max: 299 },
    { label: "300s+", min: 300, max: Number.POSITIVE_INFINITY }
  ];

  return ranges.map((range) => ({
    label: range.label,
    count: events.filter((event) => {
      const value = Math.max(0, Math.round(event.playedSeconds));
      return value >= range.min && value <= range.max;
    }).length
  }));
}

function hourBuckets(events: PlayEvent[]): Array<{ hour: number; count: number }> {
  const counts = Array.from({ length: 24 }, () => 0);

  for (const event of events) {
    const date = new Date(event.timestamp);
    if (!Number.isNaN(date.valueOf())) {
      counts[date.getHours()] += 1;
    }
  }

  return counts.map((count, hour) => ({ hour, count }));
}

export function aggregatePlayEvents(events: PlayEvent[]): StatsSummary {
  const totalSongsPlayed = events.length;
  const totalPlayTimeSeconds = events.reduce((sum, event) => sum + Math.max(0, event.playedSeconds), 0);
  const completedCount = events.filter((event) => event.completed).length;
  const completionRate = totalSongsPlayed > 0 ? round((completedCount / totalSongsPlayed) * 100) : 0;

  const aggregates = buildSongAggregates(events);
  const topSongs = aggregates.slice(0, 8);
  const mostPlayedSong = topSongs[0]?.title ?? null;

  // Definitions required by spec.
  const instantSkips = aggregates.filter((song) => {
    const songEvents = events.filter((event) => event.title === song.title);
    return songEvents.some((event) => event.playedSeconds < 30);
  }).slice(0, 10);

  const skippedSongs = aggregates.filter((song) => song.count >= 2 && song.averageCompletion < 35).slice(0, 10);
  const hiddenGems = aggregates.filter((song) => song.count <= 2 && song.averageCompletion >= 85).slice(0, 10);
  const retryPatterns = aggregates.filter((song) => song.count >= 3 && song.averageCompletion < 60).slice(0, 10);

  return {
    totalSongsPlayed,
    totalPlayTimeSeconds: round(totalPlayTimeSeconds),
    mostPlayedSong,
    completionRate,
    topSongs,
    completionDistribution: completionBuckets(events),
    playTimeDistribution: playTimeBuckets(events),
    hourlyActivity: hourBuckets(events),
    recentActivity: toSortedRecent(events).slice(0, 20),
    instantSkips,
    skippedSongs,
    hiddenGems,
    retryPatterns
  };
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}
