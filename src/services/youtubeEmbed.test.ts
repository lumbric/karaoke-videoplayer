import { describe, expect, it } from "vitest";
import { buildYouTubeEmbedUrl, extractYouTubeVideoId, isYouTubeSource } from "./youtubeEmbed";

describe("extractYouTubeVideoId", () => {
  it("extracts id from embed URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/abc123")).toBe("abc123");
  });

  it("extracts id from watch URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("extracts id from short URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/abc123")).toBe("abc123");
  });

  it("extracts raw id", () => {
    expect(extractYouTubeVideoId("abc123")).toBe("abc123");
  });

  it("returns null for non-youtube URLs", () => {
    expect(extractYouTubeVideoId("https://example.com/video")).toBeNull();
  });
});

describe("isYouTubeSource", () => {
  it("returns true for youtube embed URL", () => {
    expect(isYouTubeSource("https://www.youtube.com/embed/abc123")).toBe(true);
  });

  it("returns false for local video path", () => {
    expect(isYouTubeSource("/songs/Track.mp4")).toBe(false);
  });
});

describe("buildYouTubeEmbedUrl", () => {
  it("disables controls, related videos, fullscreen and keyboard shortcuts", () => {
    const url = buildYouTubeEmbedUrl({ videoId: "abc123" });
    expect(url).toContain("controls=0");
    expect(url).toContain("rel=0");
    expect(url).toContain("fs=0");
    expect(url).toContain("disablekb=1");
    expect(url).toContain("iv_load_policy=3");
    expect(url).toContain("modestbranding=1");
    expect(url).toContain("autoplay=1");
    expect(url).toContain("enablejsapi=1");
  });

  it("includes start parameter when provided", () => {
    const url = buildYouTubeEmbedUrl({ videoId: "abc123", startSeconds: 42 });
    expect(url).toContain("start=42");
  });
});
