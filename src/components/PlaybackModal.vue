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
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

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
        d="M 168.96484 5.8964844 L 168.96484 39.056641 L 126.46875 39.056641 L 126.43945 39.056641 C 76.906515 39.173428 33.520555 70.303699 18.337891 116.13867 C 3.1552714 161.97361 19.063609 212.60704 57.728516 241.52734 C 96.393423 270.44765 149.46148 271.40091 189.14062 243.88867 C 208.9802 230.13251 223.37445 210.73239 231.0625 189.01953 C 234.90651 178.16307 237.08302 166.71439 237.45508 155.07031 A 22.677165 22.677165 0 0 0 215.51562 131.67578 A 22.677165 22.677165 0 0 0 192.12305 153.62305 C 191.90119 160.56071 190.60304 167.39327 188.30664 173.87891 C 183.7138 186.85021 175.19033 198.3706 163.29688 206.61719 C 139.50993 223.11029 108.07148 222.54425 84.892578 205.20703 C 61.713643 187.86985 52.294777 157.87763 61.396484 130.40039 C 70.498191 102.92319 95.568608 84.483139 126.54883 84.410156 L 168.96484 84.410156 L 168.96484 117.57031 L 265.56445 61.732422 L 256.50781 56.5 L 168.96484 5.8964844 z"
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

function preventPictureInPicture(event: Event): void {
  event.preventDefault();
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
  previousBodyOverflow = document.body.style.overflow;
  previousHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

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
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
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
      disablepictureinpicture
      controlslist="nodownload noplaybackrate noremoteplayback"
      @loadedmetadata="handleLoadedMetadata"
      @timeupdate="handleTimeUpdate"
      @error="handleError"
      @ended="handleEnded"
      @enterpictureinpicture="preventPictureInPicture"
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
