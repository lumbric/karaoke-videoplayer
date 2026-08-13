import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
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

describe("App cover handling", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

    const configStore = useConfigStore();
    configStore.setConfig({
      theme: {
        name: "default",
        title: "Test"
      },
      features: { onlineFeatures: false, onlineSearch: false, aiSuggestions: false, filterEmbeddableVideos: false },
      search: {
        batchSize: 30,
        maxDisplayCount: 100,
        initialOrder: "alphabetical",
        randomSeed: 1,
        showMetadataSnippet: true,
        featuredProbability: 0.3,
        featuredWindow: 8
      },
      providers: {
        searchProviders: [{ type: "invidious", baseUrls: [] }],
        videoProviders: [{ type: "youtube" }]
      },
      ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true }
    });

    const catalogStore = useCatalogStore();
    catalogStore.allSongs = [{
      id: "song-1",
      filename: "Song One",
      title: "Song One",
      artist: "Artist",
      genres: ["pop"],
      durationSeconds: 180,
      filePath: "/data/videos/Song%20One.mp4",
      videoCandidates: ["/data/videos/Song%20One.mp4"],
      coverPath: "/data/covers/missing.jpg",
      displayTitle: "Song One",
      searchIndex: "song one artist",
      featured: false
    }];
    catalogStore.batchSize = 30;
    catalogStore.maxDisplayCount = 100;
    catalogStore.renderedCount = 30;
    catalogStore.loading = false;
    catalogStore.error = null;

    const onlineSearchStore = useOnlineSearchStore();
    onlineSearchStore.initialize(configStore.config!);
  });

  it("keeps fallback cover after first image error across rerenders", async () => {
    const wrapper = mount(App);

    const image = wrapper.get("img.song-cover");
    await image.trigger("error");

    expect(image.attributes("src")).toContain("/themes/default/cover_fallback.svg");

    await wrapper.get('input[placeholder="Songs suchen..."]').setValue("song");

    const imageAfter = wrapper.get("img.song-cover");
    expect(imageAfter.attributes("src")).toContain("/themes/default/cover_fallback.svg");
  });

  it("shows a placeholder frame until the cover has loaded", async () => {
    const wrapper = mount(App);

    const frame = wrapper.get(".song-cover-frame");
    const image = wrapper.get("img.song-cover");

    expect(frame.classes()).not.toContain("is-loaded");
    expect(image.classes()).not.toContain("is-visible");

    await image.trigger("load");

    expect(frame.classes()).toContain("is-loaded");
    expect(image.classes()).toContain("is-visible");
  });
});
