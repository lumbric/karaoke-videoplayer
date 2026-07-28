import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlaybackModal from "./PlaybackModal.vue";
import { usePlaybackStore } from "../stores/playbackStore";
import type { SongRecord } from "../types";

const youtubeSong: SongRecord = {
  id: "invidious:youtube-id",
  filename: "youtube-id",
  title: "Online Karaoke Track",
  artist: "Online Artist",
  genres: ["Online"],
  durationSeconds: 200,
  filePath: "https://www.youtube.com/embed/youtube-id",
  videoCandidates: ["https://www.youtube.com/embed/youtube-id"],
  coverPath: "/covers/online.jpg",
  displayTitle: "Online Karaoke Track",
  searchIndex: "online karaoke track"
};

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
        fallbackCover: "/themes/default/cover_fallback.svg"
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
        fallbackCover: "/themes/default/cover_fallback.svg"
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
        fallbackCover: "/themes/default/cover_fallback.svg"
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
        fallbackCover: "/themes/default/cover_fallback.svg"
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
        fallbackCover: "/themes/default/cover_fallback.svg"
      }
    });

    expect(wrapper.find(".player-progress-track").exists()).toBe(true);
    expect(wrapper.find(".player-progress-label").exists()).toBe(false);
  });

  it("renders YouTube container for online YouTube sources", async () => {
    const playbackStore = usePlaybackStore();
    playbackStore.openSong(youtubeSong, "online", { id: "youtube-id", url: "https://www.youtube.com/embed/youtube-id" });

    const mockPlayer = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0),
      getDuration: vi.fn().mockReturnValue(200),
      getPlayerState: vi.fn().mockReturnValue(1),
      destroy: vi.fn()
    };

    (window as unknown as { YT: { Player: unknown; PlayerState: Record<string, number> } }).YT = {
      Player: vi.fn().mockImplementation(() => mockPlayer),
      PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
    };

    const wrapper = mount(PlaybackModal, {
      props: {
        song: youtubeSong,
        fallbackCover: "/themes/default/cover_fallback.svg"
      }
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.find("video").exists()).toBe(false);
    expect(wrapper.find(".youtube-player-container").exists()).toBe(true);
  });
});
