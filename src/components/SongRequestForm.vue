<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { saveSongSuggestion } from "../services/storage";

const props = defineProps<{
  prefillTitle?: string;
}>();

const form = reactive({
  title: props.prefillTitle?.trim() ?? "",
  artist: "",
  requestedBy: "",
  additionalInfo: ""
});

const feedback = ref("");
const feedbackType = ref<"ok" | "error">("ok");

watch(
  () => props.prefillTitle,
  (newTitle) => {
    if (newTitle?.trim() && !form.title) {
      form.title = newTitle.trim();
    }
  }
);

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
    requestedBy: form.requestedBy.trim() || undefined,
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
  form.requestedBy = "";
  form.additionalInfo = "";
}
</script>

<template>
  <div class="song-request-form">
    <form class="request-form" @submit.prevent="submit">
      <input v-model="form.title" required placeholder="Songtitel" />
      <input v-model="form.artist" required placeholder="Artist" />
      <input v-model="form.requestedBy" placeholder="Dein Name" />
      <textarea v-model="form.additionalInfo" placeholder="Zusatzinfo (optional)" />
      <button class="btn btn-primary" type="submit">Wunsch speichern</button>
    </form>

    <p v-if="feedback" :class="feedbackType === 'error' ? 'feedback error' : 'feedback'">{{ feedback }}</p>
  </div>
</template>
