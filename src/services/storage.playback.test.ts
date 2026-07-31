import { describe, expect, it } from "vitest";
import { appendPlayEvent, loadPlayedLog } from "./storage";

describe("playback log storage", () => {
  it("stores play events", () => {
    appendPlayEvent({
      title: "Bohemian Rhapsody",
      timestamp: "2026-07-24T12:00:00.000Z",
      playedSeconds: 120,
      totalDuration: 354,
      completed: false,
      playPercentage: 34,
      source: "local"
    });

    const entries = loadPlayedLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("Bohemian Rhapsody");
    expect(entries[0]?.playedSeconds).toBe(120);
  });

  it("stores play events with foundVia and searchTerm", () => {
    appendPlayEvent({
      title: "Song from Search",
      timestamp: "2026-07-24T12:05:00.000Z",
      playedSeconds: 180,
      totalDuration: 200,
      completed: true,
      playPercentage: 90,
      source: "online",
      foundVia: "online_search",
      searchTerm: "test query"
    });

    const entries = loadPlayedLog();
    const lastEntry = entries[entries.length - 1];
    expect(lastEntry?.title).toBe("Song from Search");
    expect(lastEntry?.foundVia).toBe("online_search");
    expect(lastEntry?.searchTerm).toBe("test query");
  });
});
