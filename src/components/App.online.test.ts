import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function flushPromises(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("App online search", () => {
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
      features: { onlineSearch: true, aiSuggestions: false },
      search: {
        batchSize: 30,
        maxDisplayCount: 100,
        initialOrder: "random",
        randomSeed: 1,
        showMetadataSnippet: true
      },
      providers: { invidious: { baseUrls: ["https://vid.example"] } },
      ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000 },
      paths: {
        songsJson: "/data/songs.json",
        videosBase: "/songs",
        coversBase: "/covers"
      }
    });

    const catalogStore = useCatalogStore();
    catalogStore.allSongs = [];
    catalogStore.batchSize = 30;
    catalogStore.maxDisplayCount = 100;
    catalogStore.renderedCount = 30;
    catalogStore.loading = false;
    catalogStore.error = null;
  });

  it("loads online results when no local match exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ([{
        type: "video",
        title: "Online Queen",
        author: "Remote Artist",
        videoId: "vid-1",
        videoThumbnails: [{ url: "/thumb.jpg" }]
      }])
    })));

    const wrapper = mount(App);

    await wrapper.get('input[placeholder="Songs suchen..."]').setValue("queen");
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("Online-Ergebnisse fuer");
    expect(wrapper.findAll("button.song-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Online Queen");
  });

  it("shows explicit online search action when feature is enabled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));

    const wrapper = mount(App);

    await wrapper.get('input[placeholder="Songs suchen..."]').setValue("queen");

    expect(wrapper.get(".online-actions .btn").text()).toContain("Online suchen");
  });
});