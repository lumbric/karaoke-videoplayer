<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import SongRequestForm from "./SongRequestForm.vue";

defineProps<{
  prefillTitle: string;
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
  <section class="song-request-overlay" role="dialog" aria-modal="true" aria-label="Liedwunsch einreichen" tabindex="-1" @click.self="closeModal">
    <div class="song-request-shell">
      <header class="ai-header">
        <div class="ai-header-brand">
          <h2 class="ai-title">Liedwunsch einreichen</h2>
        </div>
        <div class="ai-header-actions">
          <button class="btn btn-icon" type="button" title="Schließen" aria-label="Schließen" @click="closeModal">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div class="song-request-body">
        <SongRequestForm :prefill-title="prefillTitle" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.song-request-overlay {
  position: fixed;
  inset: 0;
  z-index: 39;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.song-request-shell {
  width: min(540px, 100%);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--text);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  color: var(--text);
}

.song-request-body {
  padding: 16px 14px;
  overflow-y: auto;
}

@media (max-width: 760px) {
  .song-request-overlay {
    padding: 0;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .song-request-shell {
    max-height: 100vh;
    width: 100%;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
