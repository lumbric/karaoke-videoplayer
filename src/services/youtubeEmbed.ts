export interface YouTubeEmbedParams {
  videoId: string;
  autoplay?: boolean;
  startSeconds?: number;
  mute?: boolean;
}

export function buildYouTubeEmbedUrl(params: YouTubeEmbedParams): string {
  const { videoId, autoplay = true, startSeconds = 0, mute = false } = params;
  const searchParams = new URLSearchParams();

  // Kiosk-friendly: disable as much YouTube UI as possible.
  searchParams.set("controls", "0");
  searchParams.set("rel", "0");
  searchParams.set("modestbranding", "1");
  searchParams.set("showinfo", "0");
  searchParams.set("fs", "0");
  searchParams.set("disablekb", "1");
  searchParams.set("iv_load_policy", "3");
  searchParams.set("playsinline", "1");
  searchParams.set("autoplay", autoplay ? "1" : "0");
  searchParams.set("enablejsapi", "1");
  searchParams.set("origin", window.location.origin);

  if (startSeconds > 0) {
    searchParams.set("start", String(Math.floor(startSeconds)));
  }

  if (mute) {
    searchParams.set("mute", "1");
  }

  return `https://www.youtube.com/embed/${videoId}?${searchParams.toString()}`;
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) {
    return null;
  }

  const fromUrl = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?[^#]*&v=))([a-zA-Z0-9_-]+)/);
  if (fromUrl?.[1]) {
    return fromUrl[1];
  }

  if (/^[a-zA-Z0-9_-]+$/.test(url)) {
    return url;
  }

  return null;
}

export function isYouTubeSource(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}
