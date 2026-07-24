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
  <svg viewBox="95 120 76 74" aria-hidden="true" focusable="false">
    <g id="path2534">
      <path
        d="M 154.72656 -0.001953125 L 154.72656 38.6875 L 117.58789 38.6875 L 117.55078 38.6875 C 66.471827 38.807689 21.566343 70.986825 5.8769531 118.35156 C -9.8124251 165.71634 6.6324979 218.07148 46.587891 247.95703 C 86.543317 277.84259 141.41256 278.83094 182.41602 250.40039 C 202.91776 236.18513 217.80208 216.12492 225.74805 193.68359 C 229.72101 182.46289 231.96891 170.63398 232.35352 158.59766 A 26.456693 26.456693 0 0 0 206.76172 131.30664 A 26.456693 26.456693 0 0 0 179.4707 156.9082 C 179.2617 163.4537 178.03463 169.90595 175.86719 176.02734 C 171.53226 188.27018 163.49105 199.1247 152.25977 206.91211 C 129.79716 222.48698 100.16771 221.95595 78.279297 205.58398 C 56.390881 189.21205 47.508568 160.93764 56.103516 134.99023 C 64.698501 109.04283 88.241614 91.668964 117.67578 91.599609 L 154.72656 91.599609 L 154.72656 130.28125 L 267.42578 65.144531 C 229.86113 43.426383 192.29329 21.712604 154.72656 -0.001953125 z"
        transform="matrix(0.26458333,0,0,0.26458333,97.144092,125.89492)"
        fill="currentColor"
      />
    </g>
  </svg>
`;

const stopIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
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
      <button class="player-close btn btn-icon" type="button" title="Schließen" aria-label="Schließen" @click="closePlayer">
        <span v-html="stopIcon"></span>
      </button>

      <div class="player-shell">
        <img class="player-cover" :src="song.coverPath" :alt="`Cover ${song.displayTitle}`" @error="($event.target as HTMLImageElement).src = fallbackCover" />
        <div class="player-body">
          <div class="player-copy">
            <h2 class="player-title">{{ song.displayTitle }}</h2>
            <p class="player-meta">{{ displayMeta }}</p>
            <p v-if="!hasMetadata" class="player-status">Video wird geladen...</p>
          </div>
        </div>

        <div class="player-actions" aria-label="Wiedergabe-Steuerung">
          <button class="btn btn-primary btn-icon player-action-button" type="button" :title="playbackStore.isPaused ? 'Play' : 'Pause'" :aria-label="playbackStore.isPaused ? 'Play' : 'Pause'" @click="togglePause">
            <span v-html="playbackStore.isPaused ? playIcon : pauseIcon"></span>
          </button>
          <button class="btn btn-icon player-action-button" type="button" title="Neu Starten" aria-label="Neu Starten" @click="restartFromBeginning">
            <span v-html="restartIcon"></span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
