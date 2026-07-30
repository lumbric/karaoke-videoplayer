import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.vue";
import { useCatalogStore } from "../stores/catalogStore";
import { useConfigStore } from "../stores/configStore";
import { useOnlineSearchStore } from "../stores/onlineSearchStore";

class IntersectionObserverMock {
  observe(): void {
    // no-op
  }

  disconnect(): void {
    // no-op
  }
}

function seedStores(showMetadataSnippet = true, onlineSearchEnabled = false): void {
  const configStore = useConfigStore();
  configStore.setConfig({
    theme: {
      name: "default",
      title: "Karaoke Test"
    },
    features: { onlineFeatures: onlineSearchEnabled, onlineSearch: onlineSearchEnabled, aiSuggestions: false },
    search: {
      batchSize: 20,
      maxDisplayCount: 100,
      initialOrder: "alphabetical",
      randomSeed: 1,
      showMetadataSnippet
    },
    providers: {
      searchProviders: [{ type: "invidious", baseUrls: [] }],
      videoProviders: [{ type: "youtube" }]
    },
    ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true },
    paths: { songsJson: "/data/songs.json", videosBase: "/songs", coversBase: "/covers" }
  });

  const catalogStore = useCatalogStore();
  catalogStore.allSongs = [
    {
      id: "song-1",
      filename: "One",
      title: "One",
      artist: "Alpha",
      genres: ["pop"],
      durationSeconds: 180,
      filePath: "/songs/One.mp4",
      videoCandidates: ["/songs/One.mp4"],
      coverPath: "/covers/One.jpg",
      displayTitle: "One",
      searchIndex: "one alpha pop"
    },
    {
      id: "song-2",
      filename: "Two",
      title: "Two",
      artist: "Beta",
      genres: ["rock"],
      durationSeconds: 200,
      filePath: "/songs/Two.mp4",
      videoCandidates: ["/songs/Two.mp4"],
      coverPath: "/covers/Two.jpg",
      displayTitle: "Two",
      searchIndex: "two beta rock"
    }
  ];
  catalogStore.batchSize = 20;
  catalogStore.maxDisplayCount = 100;
  catalogStore.renderedCount = 20;
  catalogStore.query = "";
  catalogStore.selectedGenres = [];
  catalogStore.loading = false;
  catalogStore.error = null;

  const onlineSearchStore = useOnlineSearchStore();
  onlineSearchStore.initialize(configStore.config!);
}

describe("App interactions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
    seedStores();
  });

  it("resets the scroll position when searching or clearing filters", async () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const wrapper = mount(App);

    await wrapper.get('input[placeholder="Songs suchen..."]').setValue("Two");
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "auto" });

    scrollToSpy.mockClear();

    await wrapper.get('button[aria-label="Reset"]').trigger("click");
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "auto" });

    scrollToSpy.mockRestore();
  });

  it("filters songs by search input and resets via reset button", async () => {
    const wrapper = mount(App);

    expect(wrapper.findAll("button.song-card")).toHaveLength(2);

    const search = wrapper.get('input[placeholder="Songs suchen..."]');
    await search.setValue("Two");

    expect(wrapper.findAll("button.song-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Two");

    await wrapper.get('button[aria-label="Reset"]').trigger("click");

    expect(wrapper.findAll("button.song-card")).toHaveLength(2);
  });

  it("filters songs by selected genre", async () => {
    const wrapper = mount(App);
    const genreSelect = wrapper.get("select.genre-select");

    await genreSelect.setValue("rock");

    expect(wrapper.findAll("button.song-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Two");
  });

  it("always shows artist line even when additional metadata is disabled", () => {
    seedStores(false);
    const wrapper = mount(App);

    const primaryMeta = wrapper.findAll(".song-meta").map((entry) => entry.text());

    expect(primaryMeta).toContain("Alpha");
    expect(primaryMeta).toContain("Beta");
    expect(wrapper.findAll(".song-meta-extra")).toHaveLength(0);
  });

  it("shows additional metadata in smaller row when enabled", () => {
    seedStores(true);
    const wrapper = mount(App);

    const extraMeta = wrapper.findAll(".song-meta-extra").map((entry) => entry.text());

    expect(extraMeta).toContain("pop");
    expect(extraMeta).toContain("rock");
  });

  it("replaces offline hits with online results after clicking the online search button", async () => {
    seedStores(true, true);

    const onlineSearchStore = useOnlineSearchStore();
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.spyOn(onlineSearchStore, "search").mockImplementation(async (query: string) => {
      onlineSearchStore.query = query.trim();
      onlineSearchStore.results = [
        {
          id: "online-1",
          filename: "Online One",
          title: "Online One",
          artist: "Remote",
          genres: ["online"],
          durationSeconds: 180,
          filePath: "https://www.youtube.com/embed/online-1",
          videoCandidates: ["https://www.youtube.com/embed/online-1"],
          coverPath: "/covers/online-1.jpg",
          displayTitle: "Online One",
          searchIndex: "online one remote"
        }
      ];
      onlineSearchStore.loading = false;
      onlineSearchStore.error = null;
    });

    const wrapper = mount(App);

    expect(wrapper.findAll("button.song-card")).toHaveLength(2);

    await wrapper.get('input[placeholder="Songs suchen..."]').setValue("Two");
    await wrapper.get('button[aria-label="Online suchen"]').trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.findAll("button.song-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Online-Ergebnisse");
    expect(wrapper.text()).toContain("Online One");
    expect(wrapper.text()).not.toContain("Alpha");
    expect(wrapper.text()).not.toContain("Beta");
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "auto" });

    scrollToSpy.mockRestore();
  });
});
