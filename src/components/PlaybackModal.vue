<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SongRecord } from "../types";
import { usePlaybackStore } from "../stores/playbackStore";

const props = defineProps<{
  song: SongRecord;
  fallbackCover: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const playbackStore = usePlaybackStore();
const overlayElement = ref<HTMLElement | null>(null);
const videoElement = ref<HTMLVideoElement | null>(null);
const hasMetadata = ref(false);
const candidateIndex = ref(0);
const controlsVisible = ref(true);

let hideTimer: number | null = null;
const hideDelayMs = 2200;

const displayMeta = computed(() => {
  const bits = [props.song.artist ?? "", props.song.genres.join(", ")].filter(Boolean);
  return bits.join(" - ");
});

const activeVideoSource = computed(() => {
  return props.song.videoCandidates[candidateIndex.value] ?? props.song.filePath;
});

const pauseIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
  </svg>
`;

const playIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5l11 7-11 7z" fill="currentColor" />
  </svg>
`;

const restartIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 5a7 7 0 1 1-6.16 3.63" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M5 5v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

const stopIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 7h10v10H7z" fill="currentColor" />
  </svg>
`;

function clearHideTimer(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleHideControls(): void {
  clearHideTimer();
  hideTimer = window.setTimeout(() => {
    controlsVisible.value = false;
  }, hideDelayMs);
}

function revealControls(): void {
  controlsVisible.value = true;
  scheduleHideControls();
}

function syncProgress(): void {
  if (!videoElement.value) {
    return;
  }

  playbackStore.setPlaybackProgress(videoElement.value.currentTime, videoElement.value.duration || props.song.durationSeconds || 0);
}

function handleLoadedMetadata(): void {
  hasMetadata.value = true;
  syncProgress();
}

function handleError(): void {
  const nextIndex = candidateIndex.value + 1;
  if (nextIndex < props.song.videoCandidates.length) {
    candidateIndex.value = nextIndex;
    void nextTick(() => {
      if (videoElement.value) {
        videoElement.value.load();
        void videoElement.value.play();
      }
    });
    return;
  }

  playbackStore.setPaused(true);
}

function handleTimeUpdate(): void {
  syncProgress();
}

function handleEnded(): void {
  syncProgress();
  playbackStore.closePlayback(true);
  emit("close");
}

function closePlayer(): void {
  playbackStore.closePlayback(false);
  emit("close");
}

function togglePause(): void {
  if (!videoElement.value) {
    return;
  }

  if (videoElement.value.paused) {
    void videoElement.value.play();
    playbackStore.setPaused(false);
    return;
  }

  videoElement.value.pause();
  playbackStore.setPaused(true);
}

function restartFromBeginning(): void {
  if (!videoElement.value) {
    return;
  }

  videoElement.value.currentTime = 0;
  playbackStore.setPlaybackProgress(0, videoElement.value.duration || props.song.durationSeconds || 0);
  void videoElement.value.play();
  playbackStore.setPaused(false);
}

function handleActivity(): void {
  revealControls();
}

function onWindowActivity(): void {
  revealControls();
}

watch(
  () => props.song,
  async () => {
    hasMetadata.value = false;
    candidateIndex.value = 0;
    controlsVisible.value = true;
    await nextTick();
    if (videoElement.value) {
      videoElement.value.load();
      void videoElement.value.play();
    }
    scheduleHideControls();
  }
);

onMounted(() => {
  window.addEventListener("pointermove", onWindowActivity);
  window.addEventListener("mousemove", onWindowActivity);
  window.addEventListener("keydown", onWindowActivity);
  window.addEventListener("touchstart", onWindowActivity, { passive: true });
  nextTick(() => {
    overlayElement.value?.focus();
    void videoElement.value?.play();
  });
  scheduleHideControls();
});

onBeforeUnmount(() => {
  clearHideTimer();
  window.removeEventListener("pointermove", onWindowActivity);
  window.removeEventListener("mousemove", onWindowActivity);
  window.removeEventListener("keydown", onWindowActivity);
  window.removeEventListener("touchstart", onWindowActivity);
});
</script>

<template>
  <section
    ref="overlayElement"
    class="player-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="`Wiedergabe von ${song.displayTitle}`"
    tabindex="0"
    @pointermove="handleActivity"
    @mousemove="handleActivity"
    @keydown="handleActivity"
    @touchstart="handleActivity"
    @focusin="handleActivity"
  >
    <video
      ref="videoElement"
      class="player-video"
      :src="activeVideoSource"
      autoplay
      playsinline
      @loadedmetadata="handleLoadedMetadata"
      @timeupdate="handleTimeUpdate"
      @error="handleError"
      @ended="handleEnded"
    />

    <div class="player-glass" :class="{ 'is-hidden': !controlsVisible }">
      <div class="player-shell">
        <img class="player-cover" :src="song.coverPath" :alt="`Cover ${song.displayTitle}`" @error="($event.target as HTMLImageElement).src = fallbackCover" />
        <div class="player-body">
          <div class="player-copy">
            <h2 class="player-title">{{ song.displayTitle }}</h2>
            <p class="player-meta">{{ displayMeta }}</p>
            <p v-if="!hasMetadata" class="player-status">Video wird geladen...</p>
          </div>

          <div class="player-actions">
              <button class="btn btn-primary btn-icon" type="button" :title="playbackStore.isPaused ? 'Play' : 'Pause'" :aria-label="playbackStore.isPaused ? 'Play' : 'Pause'" @click="togglePause">
                <span v-html="playbackStore.isPaused ? playIcon : pauseIcon"></span>
            </button>
              <button class="btn btn-icon" type="button" title="Neu Starten" aria-label="Neu Starten" @click="restartFromBeginning">
                <span v-html="restartIcon"></span>
              </button>
              <button class="btn btn-icon" type="button" title="Stop" aria-label="Stop" @click="closePlayer">
                <span v-html="stopIcon"></span>
              </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
