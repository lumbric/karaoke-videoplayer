<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import ProblemReportForm from "./ProblemReportForm.vue";
import type { SongRecord } from "../types";

defineProps<{
  song: SongRecord;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeModal();
  }
}

function closeModal(): void {
  emit("close");
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown, true);
});
</script>

<template>
  <section class="problem-report-overlay" role="dialog" aria-modal="true" aria-label="Problem melden" tabindex="-1" @click.self="closeModal">
    <div class="problem-report-shell">
      <header class="ai-header">
        <div class="ai-header-brand">
          <h2 class="ai-title">Problem melden</h2>
        </div>
        <div class="ai-header-actions">
          <button class="btn btn-icon" type="button" title="Schließen" aria-label="Schließen" @click="closeModal">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div class="problem-report-body">
        <ProblemReportForm :song="song" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.problem-report-overlay {
  position: fixed;
  inset: 0;
  z-index: 41;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.problem-report-shell {
  width: min(540px, 100%);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--text);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  color: var(--text);
}

.problem-report-body {
  padding: 16px 14px;
  overflow-y: auto;
}

@media (max-width: 760px) {
  .problem-report-overlay {
    padding: 0;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .problem-report-shell {
    max-height: 100vh;
    width: 100%;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
