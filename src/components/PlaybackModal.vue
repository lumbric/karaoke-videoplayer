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
  <svg viewBox="0 0 95 75" aria-hidden="true" focusable="false">
    <g transform="translate(-83.642394,-120.86914)">
      <path
        d="m 117.95117,127.04102 c -14.78481,0.0365 -27.920524,9.56965 -32.566404,23.625 -4.645884,14.05535 0.210559,29.54997 12.046875,38.42187 11.836309,8.8719 28.058029,9.16484 40.205079,0.72461 12.14705,-8.44023 17.55492,-23.75151 13.41601,-37.96484 a 4,4 0 0 0 -4.95898,-2.72266 4,4 0 0 0 -2.72266,4.95898 c 3.1869,10.94408 -0.95708,22.66585 -10.30078,29.15821 -9.3437,6.49236 -21.73464,6.27011 -30.83984,-0.55469 -9.105205,-6.8248 -12.827146,-18.68966 -9.250001,-29.51172 3.577143,-10.82206 13.623741,-18.10666 24.990231,-18.13476 a 4,4 0 0 0 0.20118,-0.041 4,4 0 0 0 0.0977,0.041 h 38 a 4,4 0 0 0 4,-4 4,4 0 0 0 -4,-4 h -38 a 4,4 0 0 0 -0.1582,0.0664 4,4 0 0 0 -0.16016,-0.0664 z m 32.04102,-6.17188 v 20.34375 l 17.59765,-10.17187 c -5.86477,-3.39255 -11.73159,-6.78156 -17.59765,-10.17188 z"
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
