import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProblemReportForm from "./ProblemReportForm.vue";
import type { SongRecord } from "../types";

const song: SongRecord = {
  id: "song-1",
  filename: "Track",
  title: "Track",
  artist: "Singer",
  genres: ["pop"],
  durationSeconds: 180,
  filePath: "/songs/Track.mp4",
  videoCandidates: ["/songs/Track.mp4"],
  coverPath: "/covers/Track.jpg",
  displayTitle: "Track",
  searchIndex: "track singer pop",
  featured: false
};

describe("ProblemReportForm", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("renders song info", () => {
    const wrapper = mount(ProblemReportForm, {
      props: { song }
    });

    expect(wrapper.text()).toContain("Track");
    expect(wrapper.text()).toContain("Singer");
  });

  it("shows error when description is empty", async () => {
    const wrapper = mount(ProblemReportForm, {
      props: { song }
    });

    await wrapper.get("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Bitte beschreibe das Problem");
  });

  it("submits form with valid data", async () => {
    const wrapper = mount(ProblemReportForm, {
      props: { song }
    });

    const textarea = wrapper.get("textarea");
    await textarea.setValue("Video spielt nicht");

    await wrapper.get("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Danke");
    expect(wrapper.text()).toContain("Problembericht wurde gespeichert");
  });

  it("includes reportedBy if provided", async () => {
    const wrapper = mount(ProblemReportForm, {
      props: { song }
    });

    await wrapper.get("textarea").setValue("Audio-Problem");
    await wrapper.get('input[placeholder="Dein Name (optional)"]').setValue("Max");

    await wrapper.get("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Danke");
  });
});
