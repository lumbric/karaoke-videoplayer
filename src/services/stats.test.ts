import { describe, expect, it } from "vitest";
import { aggregatePlayEvents, formatDuration } from "./stats";
import type { PlayEvent } from "../types";

const sample: PlayEvent[] = [
  {
    title: "Song A",
    timestamp: "2026-07-25T10:00:00.000Z",
    playedSeconds: 15,
    totalDuration: 180,
    completed: false,
    playPercentage: 8,
    source: "local"
  },
  {
    title: "Song A",
    timestamp: "2026-07-25T10:05:00.000Z",
    playedSeconds: 170,
    totalDuration: 180,
    completed: true,
    playPercentage: 94,
    source: "local"
  },
  {
    title: "Song B",
    timestamp: "2026-07-25T11:00:00.000Z",
    playedSeconds: 110,
    totalDuration: 200,
    completed: false,
    playPercentage: 55,
    source: "local"
  }
];

describe("aggregatePlayEvents", () => {
  it("computes core counters", () => {
    const summary = aggregatePlayEvents(sample);

    expect(summary.totalSongsPlayed).toBe(3);
    expect(summary.totalPlayTimeSeconds).toBe(295);
    expect(summary.completionRate).toBeCloseTo(33.33, 1);
    expect(summary.mostPlayedSong).toBe("Song A");
  });

  it("computes advanced lists", () => {
    const summary = aggregatePlayEvents(sample);

    expect(summary.instantSkips.some((song) => song.title === "Song A")).toBe(true);
    expect(summary.hiddenGems.some((song) => song.title === "Song A")).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats duration values", () => {
    expect(formatDuration(59)).toBe("0m 59s");
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });
});
