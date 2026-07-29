<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAiSuggestionStore, type ChatSuggestionResult } from "../stores/aiSuggestionStore";
import { useConfigStore } from "../stores/configStore";
import { useCatalogStore } from "../stores/catalogStore";
import { usePlaybackStore } from "../stores/playbackStore";

const emit = defineEmits<{
  close: [];
}>();

const aiStore = useAiSuggestionStore();
const configStore = useConfigStore();
const catalogStore = useCatalogStore();
const playbackStore = usePlaybackStore();

const { messages, loading, error } = storeToRefs(aiStore);
const { config, secret } = storeToRefs(configStore);
const catalog = catalogStore.allSongs;

const inputText = ref("");
const chatArea = ref<HTMLDivElement | null>(null);
const inputElement = ref<HTMLInputElement | null>(null);

function scrollToBottom(): void {
  nextTick(() => {
    if (chatArea.value) {
      chatArea.value.scrollTop = chatArea.value.scrollHeight;
    }
  });
}

watch(() => messages.value.length, () => scrollToBottom());

watch(loading, (isLoading) => {
  if (!isLoading) {
    nextTick(() => inputElement.value?.focus());
  }
});

function focusInput(): void {
  nextTick(() => inputElement.value?.focus());
}

async function sendMessage(): Promise<void> {
  const text = inputText.value.trim();
  if (!text || loading.value || !config.value) return;

  inputText.value = "";
  await aiStore.sendMessage(text, catalog, config.value, secret.value);
  scrollToBottom();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendMessage();
  }
  if (event.key === "Escape") {
    closeModal();
  }
}

function handleSuggestionClick(suggestion: ChatSuggestionResult): void {
  const song = suggestion.song ?? suggestion.onlineSong;
  if (!song) return;

  const source: "online" | "local" = suggestion.status === "online" ? "online" : "local";
  playbackStore.openSong(song, source);
  closeModal();
}

function closeModal(): void {
  aiStore.closeModal();
  emit("close");
}

function clearChat(): void {
  aiStore.clearMessages();
  focusInput();
}

onMounted(() => {
  scrollToBottom();
  focusInput();
});

onBeforeUnmount(() => {
  aiStore.cancelActiveRequest();
});
</script>

<template>
  <section class="ai-overlay" role="dialog" aria-modal="true" :aria-label="configStore.aiTitle" tabindex="-1" @keydown="onKeyDown">
    <div class="ai-shell">
      <header class="ai-header">
        <div class="ai-header-brand">
          <h2 class="ai-title">{{ configStore.aiTitle }}</h2>
        </div>
        <div class="ai-header-actions">
          <button v-if="messages.length > 0" class="btn btn-icon" type="button" title="Reset" aria-label="Reset" @click="clearChat">⟳</button>
          <button class="btn btn-icon" type="button" title="Schliessen" aria-label="Schliessen" @click="closeModal">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div ref="chatArea" class="ai-chat">
        <div class="ai-welcome">
          <img v-if="configStore.aiLogoPath" class="ai-logo" :src="configStore.aiLogoPath" alt="" />
          <div class="ai-welcome-body">
            <p>Beschreibe, wonach dir gerade zum Singen ist – nach Stimmung, Genre, Artist oder einfach einem Gefuehl.</p>
            <p class="ai-welcome-examples">Beispiele: "Ich will was Energisches aus den 80ern" · "Etwas zum Mitsingen fuer die Menge" · "Ruhige Ballade von einer Frau gesungen"</p>
          </div>
        </div>

        <div v-for="msg in messages" :key="msg.id" class="ai-message" :class="msg.role">
          <div class="ai-message-bubble">
            <p class="ai-message-text">{{ msg.text }}</p>
          </div>

          <div v-if="msg.suggestions && msg.suggestions.length > 0" class="ai-suggestions">
            <button
              v-for="(suggestion, sIndex) in msg.suggestions"
              :key="sIndex"
              class="ai-suggestion-card"
              :class="{ 'is-online': suggestion.status === 'online', 'is-not-found': suggestion.status === 'not_found' }"
              type="button"
              :disabled="suggestion.status === 'not_found'"
              @click="handleSuggestionClick(suggestion)"
            >
              <div class="ai-suggestion-info">
                <strong class="ai-suggestion-title">{{ suggestion.title }}</strong>
                <span class="ai-suggestion-artist">{{ suggestion.artist }}</span>
              </div>
              <p class="ai-suggestion-reason">{{ suggestion.reason }}</p>
              <span class="ai-suggestion-badge" :class="suggestion.status">
                {{ suggestion.status === 'local' ? 'Lokal' : suggestion.status === 'online' ? 'YouTube' : 'Nicht verfuegbar' }}
              </span>
            </button>
          </div>
        </div>

        <div v-if="loading" class="ai-message assistant">
          <div class="ai-message-bubble ai-loading">
            <span class="ai-typing-dot"></span>
            <span class="ai-typing-dot"></span>
            <span class="ai-typing-dot"></span>
          </div>
        </div>

        <p v-if="error" class="feedback error ai-error">{{ error }}</p>
      </div>

      <div class="ai-input-area">
        <input
          ref="inputElement"
          v-model="inputText"
          class="ai-input"
          type="text"
          placeholder="Was moechtest du singen?"
          :disabled="loading"
          @keydown="onKeyDown"
        />
        <button class="btn btn-primary" type="button" :disabled="loading || !inputText.trim()" @click="sendMessage">
          <span v-if="loading">...</span>
          <span v-else>Senden</span>
        </button>
      </div>
    </div>
  </section>
</template>
