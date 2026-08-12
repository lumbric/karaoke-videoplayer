import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOnlineSearchStore } from "./onlineSearchStore";
import * as onlineSearch from "../services/onlineSearch";
import type { AppConfig, SecretConfig } from "../types";

describe("onlineSearchStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("search", () => {
    it("passes filterEmbeddableVideos to searchOnline when enabled", async () => {
      const spy = vi.spyOn(onlineSearch, "searchOnline").mockResolvedValue([]);

      const store = useOnlineSearchStore();
      const config: AppConfig = {
        theme: { name: "default", title: "Test" },
        features: {
          onlineFeatures: true,
          onlineSearch: true,
          aiSuggestions: false,
          filterEmbeddableVideos: true
        },
        search: {
          batchSize: 20,
          maxDisplayCount: 100,
          initialOrder: "alphabetical",
          randomSeed: 1,
          showMetadataSnippet: true
        },
        providers: {
          searchProviders: [{ type: "youtube" }],
          videoProviders: []
        },
        ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true }
      };
      const secret: SecretConfig = { youtubeApiKey: "TEST_KEY" };

      store.initialize(config);
      await store.search("test query", config, secret);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          requireEmbeddable: true
        })
      );

      spy.mockRestore();
    });

    it("passes filterEmbeddableVideos=false to searchOnline when disabled", async () => {
      const spy = vi.spyOn(onlineSearch, "searchOnline").mockResolvedValue([]);

      const store = useOnlineSearchStore();
      const config: AppConfig = {
        theme: { name: "default", title: "Test" },
        features: {
          onlineFeatures: true,
          onlineSearch: true,
          aiSuggestions: false,
          filterEmbeddableVideos: false
        },
        search: {
          batchSize: 20,
          maxDisplayCount: 100,
          initialOrder: "alphabetical",
          randomSeed: 1,
          showMetadataSnippet: true
        },
        providers: {
          searchProviders: [{ type: "youtube" }],
          videoProviders: []
        },
        ai: { model: "x", maxSuggestions: 5, timeoutMs: 5000, sendCatalog: true }
      };
      const secret: SecretConfig = { youtubeApiKey: "TEST_KEY" };

      store.initialize(config);
      await store.search("test query", config, secret);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          requireEmbeddable: false
        })
      );

      spy.mockRestore();
    });
  });
});
