<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SongRecord } from "../types";
import { usePlaybackStore } from "../stores/playbackStore";
import { YouTubePlayerController } from "../services/youtubePlayer";
import { extractYouTubeVideoId, isYouTubeSource } from "../services/youtubeEmbed";

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
const isLoading = ref(true);
const showLoadingIndicator = ref(false);
const candidateIndex = ref(0);
const controlsVisible = ref(true);
const youtubeContainerId = ref(`youtube-player-${Math.random().toString(36).slice(2)}`);
const youtubeController = ref<YouTubePlayerController | null>(null);
let previousBodyOverflow = "";
let previousDocumentOverflow = "";

let hideTimer: number | null = null;
const hideDelayMs = 2200;
let loadingIndicatorTimer: number | null = null;
const loadingIndicatorDelayMs = 450;

const displayMeta = computed(() => {
  const bits = [props.song.artist ?? "", props.song.genres.join(", ")].filter(Boolean);
  return bits.join(" - ");
});

const activeVideoSource = computed(() => {
  return props.song.videoCandidates[candidateIndex.value] ?? props.song.filePath;
});

const isYouTubePlayback = computed(() => {
  return playbackStore.source === "online" && isYouTubeSource(activeVideoSource.value);
});

const progressPercent = computed(() => {
  const total = playbackStore.totalDurationSeconds || props.song.durationSeconds || 0;

  if (!total || total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (playbackStore.currentTimeSeconds / total) * 100));
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

function clearLoadingIndicatorTimer(): void {
  if (loadingIndicatorTimer !== null) {
    window.clearTimeout(loadingIndicatorTimer);
    loadingIndicatorTimer = null;
  }
}

function startLoadingState(): void {
  isLoading.value = true;
  showLoadingIndicator.value = false;
  clearLoadingIndicatorTimer();
  loadingIndicatorTimer = window.setTimeout(() => {
    if (isLoading.value) {
      showLoadingIndicator.value = true;
    }
  }, loadingIndicatorDelayMs);
}

function stopLoadingState(): void {
  isLoading.value = false;
  showLoadingIndicator.value = false;
  clearLoadingIndicatorTimer();
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

function syncProgress(currentTime: number, duration: number): void {
  playbackStore.setPlaybackProgress(currentTime, duration || props.song.durationSeconds || 0);
}

function handleLoadedMetadata(): void {
  stopLoadingState();
  playbackStore.setPaused(false);
  if (videoElement.value) {
    syncProgress(videoElement.value.currentTime, videoElement.value.duration);
  }
}

function handleCanPlay(): void {
  stopLoadingState();
}

function handleWaiting(): void {
  startLoadingState();
}

function handleError(): void {
  const nextIndex = candidateIndex.value + 1;
  if (nextIndex < props.song.videoCandidates.length) {
    startLoadingState();
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
  if (videoElement.value) {
    syncProgress(videoElement.value.currentTime, videoElement.value.duration);
  }
}

function handleEnded(): void {
  if (videoElement.value) {
    syncProgress(videoElement.value.currentTime, videoElement.value.duration);
  }
  playbackStore.closePlayback(true);
  emit("close");
}

function closePlayer(): void {
  playbackStore.closePlayback(false);
  emit("close");
}

function togglePause(): void {
  if (isYouTubePlayback.value) {
    if (!youtubeController.value) {
      return;
    }

    if (playbackStore.isPaused) {
      youtubeController.value.play();
      playbackStore.setPaused(false);
    } else {
      youtubeController.value.pause();
      playbackStore.setPaused(true);
    }
    return;
  }

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
  if (isYouTubePlayback.value) {
    youtubeController.value?.restart();
    playbackStore.setPaused(false);
    return;
  }

  if (!videoElement.value) {
    return;
  }

  videoElement.value.currentTime = 0;
  syncProgress(0, videoElement.value.duration || props.song.durationSeconds || 0);
  void videoElement.value.play();
  playbackStore.setPaused(false);
}

function handleActivity(): void {
  revealControls();
}

function onWindowActivity(): void {
  revealControls();
}

function lockDocumentScroll(): void {
  previousBodyOverflow = document.body.style.overflow;
  previousDocumentOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function unlockDocumentScroll(): void {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousDocumentOverflow;
}

async function initializeYouTubePlayer(): Promise<void> {
  const videoId = extractYouTubeVideoId(activeVideoSource.value);
  if (!videoId) {
    stopLoadingState();
    return;
  }

  startLoadingState();
  youtubeController.value?.destroy();
  youtubeController.value = null;

  await nextTick();

  const controller = new YouTubePlayerController(youtubeContainerId.value, videoId, {
    onReady: (duration) => {
      stopLoadingState();
      playbackStore.setPaused(false);
      syncProgress(0, duration);
    },
    onStateChange: (state) => {
      if (state === "playing") {
        playbackStore.setPaused(false);
      } else if (state === "paused") {
        playbackStore.setPaused(true);
      } else if (state === "ended") {
        const currentTime = youtubeController.value?.getCurrentTime() ?? 0;
        const duration = youtubeController.value?.getDuration() ?? 0;
        syncProgress(currentTime, duration);
        playbackStore.closePlayback(true);
        emit("close");
      }
    },
    onTimeUpdate: (currentTime, duration) => {
      syncProgress(currentTime, duration);
    },
    onError: () => {
      playbackStore.setPaused(true);
    }
  });

  youtubeController.value = controller;
  await controller.initialize();
}

function destroyYouTubePlayer(): void {
  youtubeController.value?.destroy();
  youtubeController.value = null;
}

watch(
  () => props.song,
  async () => {
    startLoadingState();
    candidateIndex.value = 0;
    controlsVisible.value = true;

    if (isYouTubePlayback.value) {
      await initializeYouTubePlayer();
    } else {
      destroyYouTubePlayer();
      await nextTick();
      if (videoElement.value) {
        videoElement.value.load();
        void videoElement.value.play();
      }
    }

    scheduleHideControls();
  }
);

onMounted(() => {
  startLoadingState();
  lockDocumentScroll();
  window.addEventListener("pointermove", onWindowActivity);
  window.addEventListener("mousemove", onWindowActivity);
  window.addEventListener("keydown", onWindowActivity);
  window.addEventListener("touchstart", onWindowActivity, { passive: true });
  nextTick(() => {
    overlayElement.value?.focus();
    if (isYouTubePlayback.value) {
      void initializeYouTubePlayer();
    } else {
      void videoElement.value?.play();
    }
  });
  scheduleHideControls();
});

onBeforeUnmount(() => {
  clearHideTimer();
  clearLoadingIndicatorTimer();
  unlockDocumentScroll();
  destroyYouTubePlayer();
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
      v-if="!isYouTubePlayback"
      ref="videoElement"
      class="player-video"
      :src="activeVideoSource"
      autoplay
      playsinline
      disablepictureinpicture
      disableremoteplayback
      @loadedmetadata="handleLoadedMetadata"
      @canplay="handleCanPlay"
      @waiting="handleWaiting"
      @timeupdate="handleTimeUpdate"
      @error="handleError"
      @ended="handleEnded"
    />

    <div
      v-if="isYouTubePlayback"
      :id="youtubeContainerId"
      class="player-video youtube-player-container"
      aria-label="YouTube Video"
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
          </div>
        </div>
      </div>

      <div class="player-controls-dock player-actions" aria-label="Wiedergabe-Steuerung">
        <button class="btn btn-primary btn-icon player-action-button" type="button" :title="playbackStore.isPaused ? 'Play' : 'Pause'" :aria-label="playbackStore.isPaused ? 'Play' : 'Pause'" @click="togglePause">
          <span v-html="playbackStore.isPaused ? playIcon : pauseIcon"></span>
        </button>
        <button class="btn btn-icon player-action-button" type="button" title="Neu Starten" aria-label="Neu Starten" @click="restartFromBeginning">
          <span v-html="restartIcon"></span>
        </button>
      </div>
    </div>

    <div v-if="showLoadingIndicator" class="player-loading-layer" aria-hidden="true">
      <span class="player-loader"></span>
    </div>

    <div class="player-progress" aria-hidden="true">
      <div class="player-progress-track">
        <div class="player-progress-fill" :style="{ width: `${progressPercent.toFixed(2)}%` }"></div>
      </div>
    </div>
  </section>
</template>
