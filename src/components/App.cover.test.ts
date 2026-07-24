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

describe("App cover handling", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

    const configStore = useConfigStore();
    configStore.setConfig({
      app: { title: "Test" },
      theme: {
        name: "default",
        cssPath: "/themes/default.css",
        logoPath: "/logo.png",
        coverFallbackPath: "/themes/default-cover-fallback.svg"
      },
      features: { onlineSearch: false, aiSuggestions: false },
      search: {
        batchSize: 30,
        maxDisplayCount: 100,
        initialOrder: "alphabetical",
        randomSeed: 1,
        showMetadataSnippet: true
      },
      providers: { invidious: { baseUrls: [] } },
      ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000 },
      paths: {
        songsJson: "/data/songs.json",
        videosBase: "/songs",
        coversBase: "/covers"
      }
    });

    const catalogStore = useCatalogStore();
    catalogStore.allSongs = [{
      id: "song-1",
      filename: "Song One",
      title: "Song One",
      artist: "Artist",
      genres: ["pop"],
      durationSeconds: 180,
      filePath: "/songs/Song One.mp4",
      videoCandidates: ["/songs/Song%20One.mp4"],
      coverPath: "/covers/missing.jpg",
      displayTitle: "Song One",
      searchIndex: "song one artist"
    }];
    catalogStore.batchSize = 30;
    catalogStore.maxDisplayCount = 100;
    catalogStore.renderedCount = 30;
    catalogStore.loading = false;
    catalogStore.error = null;
  });

  it("keeps fallback cover after first image error across rerenders", async () => {
    const wrapper = mount(App);

    const image = wrapper.get("img.song-cover");
    await image.trigger("error");

    expect(image.attributes("src")).toContain("/themes/default-cover-fallback.svg");

    await wrapper.get('input[placeholder="Songs suchen..."]').setValue("song");

    const imageAfter = wrapper.get("img.song-cover");
    expect(imageAfter.attributes("src")).toContain("/themes/default-cover-fallback.svg");
  });
});
