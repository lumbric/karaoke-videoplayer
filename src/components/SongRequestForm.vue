<script setup lang="ts">
import { reactive, ref } from "vue";
import { saveSongSuggestion } from "../services/storage";

const form = reactive({
  title: "",
  artist: "",
  additionalInfo: ""
});

const feedback = ref("");
const feedbackType = ref<"ok" | "error">("ok");

function submit(): void {
  const title = form.title.trim();
  const artist = form.artist.trim();

  if (!title || !artist) {
    feedbackType.value = "error";
    feedback.value = "Bitte Titel und Artist ausfuellen.";
    return;
  }

  const result = saveSongSuggestion({
    title,
    artist,
    additionalInfo: form.additionalInfo.trim() || undefined,
    createdAt: new Date().toISOString()
  });

  if (!result.ok) {
    feedbackType.value = "error";
    feedback.value = result.reason;
    return;
  }

  feedbackType.value = "ok";
  feedback.value = "Danke. Der Songwunsch wurde gespeichert.";

  form.title = "";
  form.artist = "";
  form.additionalInfo = "";
}
</script>

<template>
  <div class="empty">
    <h3>Keine Treffer</h3>
    <p>Du kannst stattdessen direkt einen Songwunsch eintragen.</p>

    <form class="request-form" @submit.prevent="submit">
      <input v-model="form.title" required placeholder="Songtitel" />
      <input v-model="form.artist" required placeholder="Artist" />
      <textarea v-model="form.additionalInfo" placeholder="Zusatzinfo (optional)" />
      <button class="btn btn-primary" type="submit">Wunsch speichern</button>
    </form>

    <p v-if="feedback" :class="feedbackType === 'error' ? 'feedback error' : 'feedback'">{{ feedback }}</p>
  </div>
</template>
