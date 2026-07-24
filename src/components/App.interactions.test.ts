import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App.vue";
import { useCatalogStore } from "../stores/catalogStore";
import { useConfigStore } from "../stores/configStore";

class IntersectionObserverMock {
  observe(): void {
    // no-op
  }

  disconnect(): void {
    // no-op
  }
}

function seedStores(): void {
  const configStore = useConfigStore();
  configStore.setConfig({
    app: { title: "Karaoke Test" },
    theme: {
      name: "default",
      cssPath: "/themes/default.css",
      logoPath: "/logo.png",
      coverFallbackPath: "/themes/default-cover-fallback.svg"
    },
    features: { onlineSearch: false, aiSuggestions: false },
    search: {
      batchSize: 20,
      maxDisplayCount: 100,
      initialOrder: "alphabetical",
      randomSeed: 1,
      showMetadataSnippet: true
    },
    providers: { invidious: { baseUrls: [] } },
    ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000 },
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
}

describe("App interactions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
    seedStores();
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
});
