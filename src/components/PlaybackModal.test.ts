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
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
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

  it("disables picture-in-picture and remote playback on the video element", () => {
    const wrapper = mount(PlaybackModal, {
      props: {
        song,
        fallbackCover: "/themes/default-cover-fallback.svg"
      }
    });

    const video = wrapper.get("video");
    expect(video.attributes("disablepictureinpicture")).toBeDefined();
    expect(video.attributes("disableremoteplayback")).toBeDefined();
  });

  it("locks and restores document scroll while playback is mounted", async () => {
    const wrapper = mount(PlaybackModal, {
      props: {
        song,
        fallbackCover: "/themes/default-cover-fallback.svg"
      }
    });

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    wrapper.unmount();
    await wrapper.vm.$nextTick();

    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("renders progress bar without exact time label", () => {
    const wrapper = mount(PlaybackModal, {
      props: {
        song,
        fallbackCover: "/themes/default-cover-fallback.svg"
      }
    });

    expect(wrapper.find(".player-progress-track").exists()).toBe(true);
    expect(wrapper.find(".player-progress-label").exists()).toBe(false);
  });
});
