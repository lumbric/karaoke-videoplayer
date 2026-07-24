import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlaybackModal from "./PlaybackModal.vue";
import { usePlaybackStore } from "../stores/playbackStore";
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
  searchIndex: "track singer pop"
};

describe("PlaybackModal", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mount(PlaybackModal, {
      props: {
        song,
        fallbackCover: "/themes/default-cover-fallback.svg"
      }
    });

    await wrapper.get('button[aria-label="Schließen"]').trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("restarts video from beginning", async () => {
    const playbackStore = usePlaybackStore();
    const progressSpy = vi.spyOn(playbackStore, "setPlaybackProgress");

    const wrapper = mount(PlaybackModal, {
      props: {
        song,
        fallbackCover: "/themes/default-cover-fallback.svg"
      }
    });

    const video = wrapper.get("video").element as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 180, configurable: true });
    video.currentTime = 54;

    await wrapper.get('button[aria-label="Neu Starten"]').trigger("click");

    expect(video.currentTime).toBe(0);
    expect(progressSpy).toHaveBeenCalled();
  });
});
