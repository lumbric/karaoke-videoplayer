<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Chart, type ChartConfiguration } from "chart.js/auto";
import { loadPlayedLog, loadSearchSessions, loadAiChatLog, loadSongSuggestions } from "../services/storage";
import { aggregatePlayEvents, formatDuration } from "../services/stats";

const emit = defineEmits<{
  close: [];
}>();

const topSongsCanvas = ref<HTMLCanvasElement | null>(null);
const hourlyCanvas = ref<HTMLCanvasElement | null>(null);
const completionCanvas = ref<HTMLCanvasElement | null>(null);
const playTimeCanvas = ref<HTMLCanvasElement | null>(null);
const topSongsChart = ref<Chart | null>(null);
const hourlyChart = ref<Chart | null>(null);
const completionChart = ref<Chart | null>(null);
const playTimeChart = ref<Chart | null>(null);
const playedLog = ref(loadPlayedLog());
const searchSessions = ref(loadSearchSessions());
const aiChatLog = ref(loadAiChatLog());
const songRequests = ref(loadSongSuggestions());

const summary = computed(() => aggregatePlayEvents(playedLog.value));

function closePanel(): void {
  emit("close");
}

function toDataUri(data: string): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(data)}`;
}

function downloadJson(data: unknown, filename: string): void {
  const payload = JSON.stringify(data, null, 2);
  const link = document.createElement("a");
  link.href = toDataUri(payload);
  link.download = filename;
  link.click();
}

function exportStats(): void {
  downloadJson({
    exportedAt: new Date().toISOString(),
    summary: summary.value,
    playedLog: playedLog.value,
    searchSessions: searchSessions.value,
    aiChatLog: aiChatLog.value,
    songRequests: songRequests.value
  }, `karaoke-stats-${new Date().toISOString().slice(0, 10)}.json`);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSongName(title: string, artist?: string): string {
  if (artist?.trim()) {
    return `${artist} - ${title}`;
  }
  return title;
}

function createTopSongsChart(): void {
  if (!topSongsCanvas.value) {
    return;
  }

  topSongsChart.value?.destroy();

  const labels = summary.value.topSongs.map((song) => formatSongName(song.title, song.artist));
  const data = summary.value.topSongs.map((song) => song.count);

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Plays",
        data,
        borderRadius: 8,
        backgroundColor: "rgba(14, 106, 90, 0.78)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  };

  topSongsChart.value = new Chart(topSongsCanvas.value, config);
}

function createHourlyChart(): void {
  if (!hourlyCanvas.value) {
    return;
  }

  hourlyChart.value?.destroy();

  const labels = summary.value.hourlyActivity.map((entry) => `${String(entry.hour).padStart(2, "0")}:00`);
  const data = summary.value.hourlyActivity.map((entry) => entry.count);

  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Aktivität",
        data,
        borderColor: "rgba(245, 173, 0, 1)",
        backgroundColor: "rgba(245, 173, 0, 0.2)",
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  };

  hourlyChart.value = new Chart(hourlyCanvas.value, config);
}

function createCompletionChart(): void {
  if (!completionCanvas.value) {
    return;
  }

  completionChart.value?.destroy();

  const labels = summary.value.completionDistribution.map((entry) => entry.label);
  const data = summary.value.completionDistribution.map((entry) => entry.count);

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Anzahl",
        data,
        borderRadius: 8,
        backgroundColor: "rgba(14, 106, 90, 0.68)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  };

  completionChart.value = new Chart(completionCanvas.value, config);
}

function createPlayTimeChart(): void {
  if (!playTimeCanvas.value) {
    return;
  }

  playTimeChart.value?.destroy();

  const labels = summary.value.playTimeDistribution.map((entry) => entry.label);
  const data = summary.value.playTimeDistribution.map((entry) => entry.count);

  const config: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          "rgba(14, 106, 90, 0.85)",
          "rgba(245, 173, 0, 0.85)",
          "rgba(97, 119, 112, 0.85)",
          "rgba(27, 38, 36, 0.75)"
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  };

  playTimeChart.value = new Chart(playTimeCanvas.value, config);
}

watch(summary, async () => {
  await nextTick();
  createTopSongsChart();
  createHourlyChart();
  createCompletionChart();
  createPlayTimeChart();
});

onMounted(async () => {
  await nextTick();
  createTopSongsChart();
  createHourlyChart();
  createCompletionChart();
  createPlayTimeChart();
});

onBeforeUnmount(() => {
  topSongsChart.value?.destroy();
  hourlyChart.value?.destroy();
  completionChart.value?.destroy();
  playTimeChart.value?.destroy();
});
</script>

<template>
  <section class="stats-overlay" role="dialog" aria-modal="true" aria-label="Statistik">
    <button class="stats-close btn btn-icon" type="button" title="Schließen" aria-label="Schließen" @click="closePanel">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      </svg>
    </button>

    <div class="stats-shell">
      <h2 class="stats-title-centered">Statistik</h2>

      <section class="stats-grid">
        <article class="stats-card">
          <h3>Gesamt gespielte Songs</h3>
          <p>{{ summary.totalSongsPlayed }}</p>
        </article>

        <article class="stats-card">
          <h3>Gesamte Abspielzeit</h3>
          <p>{{ formatDuration(summary.totalPlayTimeSeconds) }}</p>
        </article>

        <article class="stats-card">
          <h3>Meistgespielter Song</h3>
          <p>{{ summary.mostPlayedSong ? formatSongName(summary.mostPlayedSong, summary.topSongs[0]?.artist) : "-" }}</p>
        </article>

        <article class="stats-card">
          <h3>Completion Rate</h3>
          <p>{{ summary.completionRate }}%</p>
        </article>
      </section>

      <article class="stats-card stats-chart-full">
        <h3>Top Songs</h3>
        <div class="stats-chart-wrap">
          <canvas ref="topSongsCanvas" />
        </div>
      </article>

      <article class="stats-card stats-chart-full">
        <h3>Aktivität nach Stunde</h3>
        <div class="stats-chart-wrap">
          <canvas ref="hourlyCanvas" />
        </div>
      </article>

      <section class="stats-chart-grid">
        <article class="stats-card stats-chart-card">
          <h3>Completion Verteilung</h3>
          <div class="stats-chart-wrap">
            <canvas ref="completionCanvas" />
          </div>
        </article>

        <article class="stats-card stats-chart-card">
          <h3>Playtime Verteilung</h3>
          <div class="stats-chart-wrap">
            <canvas ref="playTimeCanvas" />
          </div>
        </article>
      </section>

      <section class="stats-lists-grid">
        <article class="stats-card">
          <h3>Skipped Songs</h3>
          <ul>
            <li v-for="item in summary.skippedSongs" :key="item.title">{{ formatSongName(item.title, item.artist) }} ({{ item.averageCompletion }}%)</li>
            <li v-if="summary.skippedSongs.length === 0">Keine</li>
          </ul>
        </article>

        <article class="stats-card">
          <h3>Instant Skips (&lt;30s)</h3>
          <ul>
            <li v-for="item in summary.instantSkips" :key="item.title">{{ formatSongName(item.title, item.artist) }} ({{ item.count }})</li>
            <li v-if="summary.instantSkips.length === 0">Keine</li>
          </ul>
        </article>
      </section>

      <section class="stats-lists-grid">
        <article class="stats-card">
          <h3>Hidden Gems</h3>
          <ul>
            <li v-for="item in summary.hiddenGems" :key="item.title">{{ formatSongName(item.title, item.artist) }} ({{ item.averageCompletion }}%)</li>
            <li v-if="summary.hiddenGems.length === 0">Keine</li>
          </ul>
        </article>

        <article class="stats-card">
          <h3>Retry Patterns</h3>
          <ul>
            <li v-for="item in summary.retryPatterns" :key="item.title">{{ formatSongName(item.title, item.artist) }} ({{ item.count }}x)</li>
            <li v-if="summary.retryPatterns.length === 0">Keine</li>
          </ul>
        </article>
      </section>

      <article class="stats-card stats-recent-card">
        <h3>Recent Activity</h3>
        <ul class="stats-recent-list">
          <li v-for="event in summary.recentActivity" :key="`${event.timestamp}-${event.title}`">
            <span>{{ formatTimestamp(event.timestamp) }}</span>
            <strong>{{ formatSongName(event.title, event.artist) }}</strong>
            <span>{{ event.playPercentage }}%</span>
          </li>
          <li v-if="summary.recentActivity.length === 0">Keine Aktivität</li>
        </ul>
      </article>

      <div class="stats-export-section">
        <button class="btn btn-primary" type="button" @click="exportStats">📁 Export Data</button>
      </div>
    </div>
  </section>
</template>
