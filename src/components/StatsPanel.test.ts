import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StatsPanel from "./StatsPanel.vue";
import { loadPlayedLog } from "../services/storage";

vi.mock("../services/storage", () => ({
  loadPlayedLog: vi.fn()
}));

vi.mock("chart.js/auto", () => {
  class ChartMock {
    public destroy = vi.fn();

    constructor() {
      // no-op
    }
  }

  return {
    Chart: ChartMock
  };
});

const loadPlayedLogMock = vi.mocked(loadPlayedLog);

describe("StatsPanel", () => {
  beforeEach(() => {
    loadPlayedLogMock.mockReset();
  });

  it("renders summary from played log", async () => {
    loadPlayedLogMock.mockReturnValue([
      {
        title: "Song A",
        timestamp: "2026-07-25T10:00:00.000Z",
        playedSeconds: 40,
        totalDuration: 200,
        completed: false,
        playPercentage: 20,
        source: "local"
      },
      {
        title: "Song A",
        timestamp: "2026-07-25T11:00:00.000Z",
        playedSeconds: 200,
        totalDuration: 200,
        completed: true,
        playPercentage: 100,
        source: "local"
      }
    ]);

    const wrapper = mount(StatsPanel);
    await Promise.resolve();

    expect(wrapper.text()).toContain("Gesamt gespielte Songs");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("Meistgespielter Song");
    expect(wrapper.text()).toContain("Song A");
    expect(wrapper.text()).toContain("Completion Rate");
    expect(wrapper.text()).toContain("50%");
  });

  it("emits close when close button is clicked", async () => {
    loadPlayedLogMock.mockReturnValue([]);

    const wrapper = mount(StatsPanel);
    await wrapper.find('button[aria-label="Schliessen"]').trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("reloads stats data", async () => {
    loadPlayedLogMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          title: "Song B",
          timestamp: "2026-07-25T12:00:00.000Z",
          playedSeconds: 125,
          totalDuration: 200,
          completed: false,
          playPercentage: 62,
          source: "local"
        }
      ]);

    const wrapper = mount(StatsPanel);
    expect(wrapper.text()).toContain("0m 0s");

    await wrapper.find("button").trigger("click");
    await Promise.resolve();

    expect(wrapper.text()).toContain("2m 5s");
  });
});
