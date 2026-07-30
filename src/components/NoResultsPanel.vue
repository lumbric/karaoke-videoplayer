<script setup lang="ts">
defineProps<{
  query: string;
  onlineSearchActive: boolean;
  onlineLoading: boolean;
  onlineError: string | null;
  aiSuggestionsEnabled: boolean;
  isOnline: boolean;
}>();

const emit = defineEmits<{
  'online-search': [];
  'open-ai': [];
  'open-song-request': [];
}>();
</script>

<template>
  <section class="no-results-panel">
    <p class="no-results-message">
      Keine Songs gefunden f&uuml;r &bdquo;{{ query }}&ldquo;
    </p>

    <div class="no-results-icon-row">
      <div v-if="onlineSearchActive && isOnline" class="no-results-icon-item">
        <button
          class="no-results-icon-button"
          type="button"
          :disabled="onlineLoading"
          @click="emit('online-search')"
        >
          <span class="no-results-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </span>
        </button>
        <span class="no-results-icon-label">Online suchen</span>
      </div>

      <div v-if="aiSuggestionsEnabled && isOnline" class="no-results-icon-item">
        <button
          class="no-results-icon-button"
          type="button"
          @click="emit('open-ai')"
        >
          <span class="no-results-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor" />
            </svg>
          </span>
        </button>
        <span class="no-results-icon-label">Frag das elektronische Huhn um Rat</span>
      </div>

      <div class="no-results-icon-item">
        <button
          class="no-results-icon-button"
          type="button"
          @click="emit('open-song-request')"
        >
          <span class="no-results-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2" />
              <circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </span>
        </button>
        <span class="no-results-icon-label">Liedwunsch einreichen</span>
      </div>
    </div>

    <p v-if="onlineError" class="online-search-feedback error">{{ onlineError }}</p>
  </section>
</template>
