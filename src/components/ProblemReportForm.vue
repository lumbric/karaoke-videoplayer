<script setup lang="ts">
import { reactive, ref } from "vue";
import { saveProblemReport } from "../services/storage";
import type { SongRecord } from "../types";

const props = defineProps<{
  song: SongRecord;
}>();

const form = reactive({
  issueType: "video",
  description: "",
  reportedBy: ""
});

const feedback = ref("");
const feedbackType = ref<"ok" | "error">("ok");

function submit(): void {
  const description = form.description.trim();

  if (!description) {
    feedbackType.value = "error";
    feedback.value = "Bitte beschreibe das Problem.";
    return;
  }

  const result = saveProblemReport({
    songId: props.song.id,
    songTitle: props.song.displayTitle,
    songArtist: props.song.artist,
    issueType: form.issueType,
    description,
    reportedBy: form.reportedBy.trim() || undefined,
    createdAt: new Date().toISOString()
  });

  if (!result.ok) {
    feedbackType.value = "error";
    feedback.value = result.reason;
    return;
  }

  feedbackType.value = "ok";
  feedback.value = "Danke. Der Problembericht wurde gespeichert.";

  form.description = "";
  form.reportedBy = "";
  form.issueType = "video";
}
</script>

<template>
  <div class="problem-report-form">
    <p class="song-info">Problem mit: <strong>{{ song.displayTitle }}</strong><span v-if="song.artist"> - {{ song.artist }}</span></p>

    <form class="report-form" @submit.prevent="submit">
      <select v-model="form.issueType" required>
        <option value="video">Video spielt nicht / Fehler</option>
        <option value="audio">Audio-Problem</option>
        <option value="wrong">Falscher Song / Inhalt</option>
        <option value="quality">Schlechte Qualität</option>
        <option value="other">Sonstiges</option>
      </select>
      <textarea v-model="form.description" placeholder="Beschreibe das Problem" required rows="4" />
      <input v-model="form.reportedBy" placeholder="Dein Name (optional)" />
      <button class="btn btn-primary" type="submit">Problem melden</button>
    </form>

    <p v-if="feedback" :class="feedbackType === 'error' ? 'feedback error' : 'feedback'">{{ feedback }}</p>
  </div>
</template>

<style scoped>
.problem-report-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.song-info {
  margin: 0;
  padding: 8px 12px;
  background: var(--surface-alt, rgba(128, 128, 128, 0.1));
  border-radius: var(--radius);
  font-size: 0.9em;
}

.report-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-form select,
.report-form textarea,
.report-form input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border, #ccc);
  border-radius: var(--radius);
  background: var(--surface, #fff);
  color: var(--text, #000);
  font-family: inherit;
  font-size: 1em;
}

.report-form textarea {
  resize: vertical;
  min-height: 80px;
}

.report-form select:focus,
.report-form textarea:focus,
.report-form input:focus {
  outline: none;
  border-color: var(--primary, #007bff);
}

.feedback {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: rgba(0, 128, 0, 0.1);
  color: #2d7a2d;
}

.feedback.error {
  background: rgba(255, 0, 0, 0.1);
  color: #c00;
}
</style>
