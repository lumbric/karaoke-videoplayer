<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import SongRequestForm from "./components/SongRequestForm.vue";
import PlaybackModal from "./components/PlaybackModal.vue";
import StatsPanel from "./components/StatsPanel.vue";
import { useConfigStore } from "./stores/configStore";
import { useCatalogStore } from "./stores/catalogStore";
import { usePlaybackStore } from "./stores/playbackStore";
import type { SongRecord } from "./types";

const configStore = useConfigStore();
const catalogStore = useCatalogStore();
const playbackStore = usePlaybackStore();

const { config } = storeToRefs(configStore);
const { visibleSongs, filteredSongs, availableGenres, loading, error, selectedGenres, query, hasMoreVisible } = storeToRefs(catalogStore);
const { activeSong } = storeToRefs(playbackStore);

const selectedGenre = ref<string>("");
const statsOpen = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const loadSentinel = ref<HTMLDivElement | null>(null);
const failedCoverIds = ref(new Set<string>());
const loadedCoverIds = ref(new Set<string>());
let observer: IntersectionObserver | null = null;

const logoPath = computed(() => config.value?.theme.logoPath ?? "");
const fallbackCover = computed(() => config.value?.theme.coverFallbackPath ?? "");
const showMetadataSnippet = computed(() => config.value?.search.showMetadataSnippet ?? true);

function onSongClicked(song: SongRecord): void {
  playbackStore.openSong(song);
}

function applyGenreFilter(): void {
  if (!selectedGenre.value) {
    catalogStore.setGenres([]);
    return;
  }

  catalogStore.setGenres([selectedGenre.value]);
}

function clearAll(): void {
  selectedGenre.value = "";
  catalogStore.clearFilters();
  nextTick(() => {
    searchInput.value?.focus();
  });
}

function closePlayer(): void {
  playbackStore.closePlayback(false);
  nextTick(() => {
    searchInput.value?.focus();
  });
}

function openStats(): void {
  statsOpen.value = true;
}

function closeStats(): void {
  statsOpen.value = false;
  nextTick(() => {
    searchInput.value?.focus();
  });
}

function setupObserver(): void {
  observer?.disconnect();
  if (!loadSentinel.value) {
    return;
  }

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        catalogStore.loadMore();
      }
    }
  }, { rootMargin: "300px" });

  observer.observe(loadSentinel.value);
}

watch(loadSentinel, () => {
  setupObserver();
});

const onKeyDown = (event: KeyboardEvent): void => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "k") {
    event.preventDefault();
    clearAll();
  }

  if (key === "escape") {
    if (playbackStore.activeSong) {
      closePlayer();
      return;
    }

    if (statsOpen.value) {
      closeStats();
      return;
    }

    if (query.value || selectedGenres.value.length > 0) {
      clearAll();
    }
  }
};

onMounted(() => {
  setupObserver();
  nextTick(() => searchInput.value?.focus());
  window.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  observer?.disconnect();
});

function formatMeta(song: { artist?: string; filename: string; genres: string[] }): string {
  const primary = song.artist?.trim() || song.filename;
  const bits = [primary, song.genres.join(", ")].filter(Boolean);
  return bits.join(" - ");
}

function getCoverSrc(song: SongRecord): string {
  if (failedCoverIds.value.has(song.id)) {
    return fallbackCover.value;
  }

  return song.coverPath;
}

function isCoverLoaded(songId: string): boolean {
  return loadedCoverIds.value.has(songId);
}

function onCoverLoad(songId: string): void {
  const next = new Set(loadedCoverIds.value);
  next.add(songId);
  loadedCoverIds.value = next;
}

function onCoverError(songId: string, event: Event): void {
  const loadedNext = new Set(loadedCoverIds.value);
  loadedNext.delete(songId);
  loadedCoverIds.value = loadedNext;

  const next = new Set(failedCoverIds.value);
  next.add(songId);
  failedCoverIds.value = next;

  const target = event.target as HTMLImageElement | null;
  if (target && target.src !== fallbackCover.value) {
    target.src = fallbackCover.value;
  }
}

const resetIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 5a7 7 0 1 1-6.16 3.63" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M5 5v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;
</script>

<template>
  <main class="page">
    <header class="header">
      <div class="brand">
        <img v-if="logoPath" class="logo" :src="logoPath" alt="Logo" />
        <h1 class="title">{{ config?.app.title }}</h1>
      </div>
    </header>

    <section class="controls" aria-label="Suche und Filter">
      <input
        ref="searchInput"
        class="search"
        :value="query"
        type="search"
        placeholder="Songs suchen..."
        @input="catalogStore.setQuery(($event.target as HTMLInputElement).value)"
      />

      <select v-model="selectedGenre" class="genre-select" @change="applyGenreFilter">
        <option value="">Alle Genres</option>
        <option v-for="genre in availableGenres" :key="genre" :value="genre">{{ genre }}</option>
      </select>

      <button class="btn btn-icon" type="button" title="Reset" aria-label="Reset" @click="clearAll" v-html="resetIcon"></button>
      <button class="btn" type="button" @click="openStats">Statistik</button>
    </section>

    <p v-if="error" class="feedback error">{{ error }}</p>
    <p v-else-if="loading" class="feedback">Songs werden geladen...</p>

    <section v-else-if="visibleSongs.length > 0" class="song-grid" aria-label="Songliste">
      <button
        v-for="song in visibleSongs"
        :key="song.id"
        class="song-card"
        type="button"
        @click="onSongClicked(song)"
      >
        <div class="song-cover-frame" :class="{ 'is-loaded': isCoverLoaded(song.id) }" aria-hidden="true">
          <img
            class="song-cover"
            :class="{ 'is-visible': isCoverLoaded(song.id) }"
            :src="getCoverSrc(song)"
            :alt="`Cover ${song.displayTitle}`"
            loading="lazy"
            @load="onCoverLoad(song.id)"
            @error="onCoverError(song.id, $event)"
          />
        </div>
        <div class="song-body">
          <h2 class="song-title">{{ song.displayTitle }}</h2>
          <p class="song-meta" :class="{ 'is-hidden': !showMetadataSnippet }">{{ formatMeta(song) }}</p>
        </div>
      </button>
    </section>

    <SongRequestForm v-else-if="query.trim().length > 0" />
    <section v-else class="empty">
      <h3>Keine Songs verfuegbar</h3>
      <p>Bitte pruefe die Konfiguration und Songdaten.</p>
    </section>

    <div v-if="hasMoreVisible" ref="loadSentinel" class="load-sentinel" aria-hidden="true"></div>
    <PlaybackModal
      v-if="activeSong"
      :song="activeSong"
      :fallback-cover="fallbackCover"
      @close="closePlayer"
    />
    <StatsPanel v-if="statsOpen" @close="closeStats" />
  </main>
</template>
