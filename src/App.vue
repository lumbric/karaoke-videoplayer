<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import SongRequestForm from "./components/SongRequestForm.vue";
import PlaybackModal from "./components/PlaybackModal.vue";
import StatsPanel from "./components/StatsPanel.vue";
import AiSuggestionModal from "./components/AiSuggestionModal.vue";
import { useConfigStore } from "./stores/configStore";
import { useCatalogStore } from "./stores/catalogStore";
import { usePlaybackStore } from "./stores/playbackStore";
import { useOnlineSearchStore } from "./stores/onlineSearchStore";
import { useAiSuggestionStore } from "./stores/aiSuggestionStore";
import { getThemeCoverFallbackPath, getThemeLogoFallbackPath, getThemeLogoPath } from "./services/config";
import { extractYouTubeVideoId } from "./services/youtubeEmbed";
import type { PlayEventProviderMeta, SongRecord } from "./types";

const configStore = useConfigStore();
const catalogStore = useCatalogStore();
const playbackStore = usePlaybackStore();
const onlineSearchStore = useOnlineSearchStore();
const aiSuggestionStore = useAiSuggestionStore();

const { config, secret } = storeToRefs(configStore);
const { visibleSongs, filteredSongs, availableGenres, loading, error, selectedGenres, query, hasMoreVisible } = storeToRefs(catalogStore);
const { activeSong } = storeToRefs(playbackStore);
const { results: onlineResults, loading: onlineLoading, error: onlineError } = storeToRefs(onlineSearchStore);
const onlineSearchActive = computed(() =>
  onlineSearchStore.onlineFeaturesEnabled && onlineSearchStore.enabled && onlineSearchStore.searchProvidersConfigured
);

const selectedGenre = ref<string>("");
const statsOpen = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const loadSentinel = ref<HTMLDivElement | null>(null);
const failedCoverIds = ref(new Set<string>());
const loadedCoverIds = ref(new Set<string>());
let observer: IntersectionObserver | null = null;

const logoPath = computed(() => (config.value ? getThemeLogoPath(config.value) : ""));
const logoFallbackPath = computed(() => (config.value ? getThemeLogoFallbackPath(config.value) : ""));
const fallbackCover = computed(() => (config.value ? getThemeCoverFallbackPath(config.value) : ""));
const showMetadataSnippet = computed(() => config.value?.search.showMetadataSnippet ?? true);
const hasOfflineResults = computed(() => filteredSongs.value.length > 0);
const hasOnlineResults = computed(() => onlineResults.value.length > 0);
const aiSuggestionsEnabled = computed(() => config.value?.features.aiSuggestions && !!secret.value.openAiApiKey);
const showOnlineResultsSection = computed(() =>
  onlineSearchActive.value &&
  query.value.trim().length > 0 &&
  (hasOnlineResults.value || onlineError.value !== null)
);
const showNoResultsPanel = computed(() =>
  query.value.trim().length > 0 &&
  !loading.value &&
  !hasOfflineResults.value
);
const trimmedQuery = computed(() => query.value.trim());

function onSongClicked(song: SongRecord, source: "local" | "online" = "local"): void {
  const provider = source === "online" ? buildOnlineProviderMeta(song) : undefined;
  playbackStore.openSong(song, source, provider);
}

function buildOnlineProviderMeta(song: SongRecord): PlayEventProviderMeta | undefined {
  const videoId = extractYouTubeVideoId(song.filePath);
  if (!videoId) {
    return undefined;
  }

  return {
    id: videoId,
    url: `https://www.youtube.com/embed/${videoId}`
  };
}

function applyGenreFilter(): void {
  if (!selectedGenre.value) {
    catalogStore.setGenres([]);
    return;
  }

  catalogStore.setGenres([selectedGenre.value]);
}

function triggerOnlineSearch(): void {
  if (!config.value) {
    return;
  }

  onlineSearchStore.search(query.value, config.value, secret.value);
}

function clearAll(): void {
  selectedGenre.value = "";
  onlineSearchStore.clearResults();
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

function closeAiSuggestionModal(): void {
  aiSuggestionStore.closeModal();
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

watch(query, () => {
  onlineSearchStore.clearResults();
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
  if (config.value) {
    const onlineFeaturesEnabled = config.value.features.onlineFeatures && navigator.onLine !== false;
    onlineSearchStore.initialize(config.value, onlineFeaturesEnabled);
  }

  setupObserver();
  nextTick(() => searchInput.value?.focus());
  window.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  observer?.disconnect();
});

function formatPrimaryMeta(song: { artist?: string; filename: string }): string {
  return song.artist?.trim() || song.filename;
}

function formatAdditionalMeta(song: { genres: string[] }): string {
  return song.genres.join(", ");
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

function onLogoError(event: Event): void {
  const target = event.target as HTMLImageElement | null;
  if (target && logoFallbackPath.value && target.src !== logoFallbackPath.value) {
    target.src = logoFallbackPath.value;
  }
}

const resetIcon = "⟳";

const globeIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2" />
  </svg>
`;

const spinnerIcon = `
  <svg class="spinner" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="40 60" />
  </svg>
`;
</script>

<template>
  <main class="page">
    <div class="cosmic-decoration" aria-hidden="true" style="top: 10%; left: 5%;">♪</div>
    <div class="cosmic-decoration" aria-hidden="true" style="top: 20%; right: 8%;">★</div>
    <div class="cosmic-decoration" aria-hidden="true" style="bottom: 15%; left: 10%;">♫</div>
    <div class="cosmic-decoration" aria-hidden="true" style="bottom: 25%; right: 15%;">♬</div>

    <div class="top-fixed">
      <header class="header">
        <div class="brand">
          <img v-if="logoPath" class="logo" :src="logoPath" alt="Logo" @error="onLogoError" />
          <h1 class="title">{{ config?.theme.title }}</h1>
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

        <div class="control-buttons">
          <button class="btn btn-icon" type="button" title="Reset" aria-label="Reset" @click="clearAll">{{ resetIcon }}</button>
          <button
            v-if="onlineSearchActive"
            class="btn btn-icon online-search-icon-button"
            type="button"
            title="Online suchen"
            aria-label="Online suchen"
            :disabled="onlineLoading || trimmedQuery.length === 0"
            @click="triggerOnlineSearch"
          >
            <span v-if="onlineLoading" class="button-spinner" v-html="spinnerIcon"></span>
            <span v-else v-html="globeIcon"></span>
          </button>
          <button
            v-if="aiSuggestionsEnabled"
            class="btn btn-icon"
            type="button"
            title="KI-Vorschlag"
            aria-label="KI-Vorschlag"
            @click="aiSuggestionStore.openModal()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </section>

      <div v-if="onlineSearchStore.onlineFeaturesEnabled && onlineSearchStore.enabled && !onlineSearchStore.searchProvidersConfigured" class="online-search-actions">
        <p class="online-search-hint error">
          Online-Suche ist aktiviert, aber es sind keine Search-Provider konfiguriert.
        </p>
      </div>
    </div>

    <div class="catalog-region">
      <p v-if="error" class="feedback error">{{ error }}</p>
      <p v-else-if="loading" class="feedback">Songs werden geladen...</p>

      <section v-if="visibleSongs.length > 0" class="song-grid" aria-label="Songliste">
        <button
          v-for="song in visibleSongs"
          :key="song.id"
          class="song-card"
          type="button"
          @click="onSongClicked(song, 'local')"
        >
          <div class="song-cover-frame" :class="{ 'is-loaded': isCoverLoaded(song.id) }" aria-hidden="true">
            <img
              class="song-cover"
              :class="{ 'is-visible': isCoverLoaded(song.id) }"
              :src="getCoverSrc(song)"
              :alt="isCoverLoaded(song.id) ? `Cover ${song.displayTitle}` : ''"
              loading="lazy"
              @load="onCoverLoad(song.id)"
              @error="onCoverError(song.id, $event)"
            />
          </div>
          <div class="song-body">
            <h2 class="song-title">{{ song.displayTitle }}</h2>
            <p class="song-meta">{{ formatPrimaryMeta(song) }}</p>
            <p v-if="showMetadataSnippet && formatAdditionalMeta(song)" class="song-meta-extra">{{ formatAdditionalMeta(song) }}</p>
          </div>
        </button>
      </section>

      <section v-if="showOnlineResultsSection" class="online-results" aria-label="Online-Suchergebnisse">
        <h3 v-if="hasOnlineResults" class="online-results-header">Online-Ergebnisse</h3>
        <p v-if="onlineError" class="online-search-feedback error">{{ onlineError }}</p>

        <div v-if="hasOnlineResults" class="song-grid">
          <button
            v-for="song in onlineResults"
            :key="song.id"
            class="song-card song-card-online"
            type="button"
            @click="onSongClicked(song, 'online')"
          >
            <div class="song-cover-frame" :class="{ 'is-loaded': isCoverLoaded(song.id) }" aria-hidden="true">
              <img
                class="song-cover"
                :class="{ 'is-visible': isCoverLoaded(song.id) }"
                :src="getCoverSrc(song)"
                :alt="isCoverLoaded(song.id) ? `Cover ${song.displayTitle}` : ''"
                loading="lazy"
                @load="onCoverLoad(song.id)"
                @error="onCoverError(song.id, $event)"
              />
            </div>
            <div class="song-body">
              <h2 class="song-title">{{ song.displayTitle }}</h2>
              <p class="song-meta">{{ formatPrimaryMeta(song) }}</p>
            </div>
          </button>
        </div>
      </section>

      <section v-if="showNoResultsPanel" class="no-results-panel">
        <p class="no-results-message">
          Keine Songs gefunden f&uuml;r "{{ trimmedQuery }}"
        </p>

        <div class="no-results-actions">
          <button
            v-if="onlineSearchActive"
            class="btn btn-primary online-search-button"
            type="button"
            :disabled="onlineLoading"
            @click="triggerOnlineSearch"
          >
            <span v-if="onlineLoading" class="button-icon" v-html="spinnerIcon"></span>
            <span v-else class="button-icon" v-html="globeIcon"></span>
            <span>Online suchen</span>
          </button>
          <p v-if="onlineError" class="online-search-feedback error">{{ onlineError }}</p>
        </div>

        <div class="song-request-section">
          <p class="song-request-lead">Damit der Song bei der n&auml;chsten Veranstaltung verf&uuml;gbar ist.</p>
          <SongRequestForm :prefill-title="trimmedQuery" />
        </div>
      </section>

      <section v-else-if="!loading && visibleSongs.length === 0 && !showOnlineResultsSection" class="empty">
        <h3>Keine Songs verfuegbar</h3>
        <p>Bitte pruefe die Konfiguration und Songdaten.</p>
      </section>

      <div v-if="hasMoreVisible" ref="loadSentinel" class="load-sentinel" aria-hidden="true"></div>
    </div>

    <PlaybackModal
      v-if="activeSong"
      :song="activeSong"
      :fallback-cover="fallbackCover"
      @close="closePlayer"
    />
    <button class="btn stats-button" type="button" @click="openStats">Statistik</button>
    <StatsPanel v-if="statsOpen" @close="closeStats" />
    <AiSuggestionModal v-if="aiSuggestionStore.modalOpen" @close="closeAiSuggestionModal" />
  </main>
</template>
