<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Chart, type ChartConfiguration } from "chart.js/auto";
import { loadPlayedLog } from "../services/storage";
import { aggregatePlayEvents, formatDuration } from "../services/stats";

const emit = defineEmits<{
  close: [];
}>();

const topSongsCanvas = ref<HTMLCanvasElement | null>(null);
const hourlyCanvas = ref<HTMLCanvasElement | null>(null);
const topSongsChart = ref<Chart | null>(null);
const hourlyChart = ref<Chart | null>(null);
const playedLog = ref(loadPlayedLog());

const summary = computed(() => aggregatePlayEvents(playedLog.value));

function closePanel(): void {
  emit("close");
}

function refreshData(): void {
  playedLog.value = loadPlayedLog();
}

function toDataUri(data: string): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(data)}`;
}

function exportStats(): void {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    summary: summary.value,
    playedLog: playedLog.value
  }, null, 2);

  const link = document.createElement("a");
  link.href = toDataUri(payload);
  link.download = `karaoke-stats-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

function createTopSongsChart(): void {
  if (!topSongsCanvas.value) {
    return;
  }

  topSongsChart.value?.destroy();

  const labels = summary.value.topSongs.map((song) => song.title);
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
        label: "Aktivitaet",
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

watch(summary, async () => {
  await nextTick();
  createTopSongsChart();
  createHourlyChart();
});

onMounted(async () => {
  await nextTick();
  createTopSongsChart();
  createHourlyChart();
});

onBeforeUnmount(() => {
  topSongsChart.value?.destroy();
  hourlyChart.value?.destroy();
});
</script>

<template>
  <section class="stats-overlay" role="dialog" aria-modal="true" aria-label="Statistik">
    <div class="stats-shell">
      <header class="stats-header">
        <h2 class="stats-title">Statistik</h2>
        <div class="stats-actions">
          <button class="btn" type="button" @click="refreshData">Neu laden</button>
          <button class="btn" type="button" @click="exportStats">Export JSON</button>
          <button class="btn btn-icon" type="button" title="Schliessen" aria-label="Schliessen" @click="closePanel">X</button>
        </div>
      </header>

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
          <p>{{ summary.mostPlayedSong ?? "-" }}</p>
        </article>

        <article class="stats-card">
          <h3>Completion Rate</h3>
          <p>{{ summary.completionRate }}%</p>
        </article>
      </section>

      <section class="stats-chart-grid">
        <article class="stats-card stats-chart-card">
          <h3>Top Songs</h3>
          <div class="stats-chart-wrap">
            <canvas ref="topSongsCanvas" />
          </div>
        </article>

        <article class="stats-card stats-chart-card">
          <h3>Aktivitaet nach Stunde</h3>
          <div class="stats-chart-wrap">
            <canvas ref="hourlyCanvas" />
          </div>
        </article>
      </section>

      <section class="stats-lists">
        <article class="stats-card">
          <h3>Instant Skips (&lt;30s)</h3>
          <ul>
            <li v-for="item in summary.instantSkips" :key="item.title">{{ item.title }} ({{ item.count }})</li>
            <li v-if="summary.instantSkips.length === 0">Keine</li>
          </ul>
        </article>

        <article class="stats-card">
          <h3>Skipped Songs</h3>
          <ul>
            <li v-for="item in summary.skippedSongs" :key="item.title">{{ item.title }} ({{ item.averageCompletion }}%)</li>
            <li v-if="summary.skippedSongs.length === 0">Keine</li>
          </ul>
        </article>

        <article class="stats-card">
          <h3>Hidden Gems</h3>
          <ul>
            <li v-for="item in summary.hiddenGems" :key="item.title">{{ item.title }} ({{ item.averageCompletion }}%)</li>
            <li v-if="summary.hiddenGems.length === 0">Keine</li>
          </ul>
        </article>

        <article class="stats-card">
          <h3>Retry Patterns</h3>
          <ul>
            <li v-for="item in summary.retryPatterns" :key="item.title">{{ item.title }} ({{ item.count }}x)</li>
            <li v-if="summary.retryPatterns.length === 0">Keine</li>
          </ul>
        </article>
      </section>
    </div>
  </section>
</template>
