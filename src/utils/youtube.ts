import { requestUrl } from "obsidian";
import { PlaylistItem } from "../types";

const titleCache = new Map<string, string>();
const metadataCache = new Map<string, YouTubeVideoMetadata>();
const playlistCache = new Map<string, PlaylistItem[]>();

export interface YouTubeVideoMetadata {
  title?: string;
  description?: string;
  author?: string;
  lengthSeconds?: number;
  isShorts?: boolean;
}

/**
 * Manually populates the title cache for a video
 */
export function cacheYouTubeTitle(videoId: string, title: string): void {
  if (videoId && title) {
    titleCache.set(videoId, title);
  }
}

export function getCachedYouTubeTitle(videoId: string): string | null {
  return titleCache.get(videoId) || null;
}

/**
 * Fetches real YouTube video title via YouTube's public oEmbed API (no API key required)
 */
export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  if (titleCache.has(videoId)) {
    return titleCache.get(videoId)!;
  }

  // Check metadata cache first
  if (metadataCache.has(videoId) && metadataCache.get(videoId)?.title) {
    const t = metadataCache.get(videoId)!.title!;
    titleCache.set(videoId, t);
    return t;
  }

  // 1. Primary: Official YouTube oEmbed API
  try {
    const res = await requestUrl({
      url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    });
    if (res.status === 200 && res.json && res.json.title) {
      const title = String(res.json.title).trim();
      if (title) {
        titleCache.set(videoId, title);
        return title;
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Secondary fallback: noembed API
  try {
    const res2 = await requestUrl({
      url: `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    });
    if (res2.status === 200 && res2.json && res2.json.title) {
      const title = String(res2.json.title).trim();
      if (title) {
        titleCache.set(videoId, title);
        return title;
      }
    }
  } catch {
    // Ignore error
  }

  return null;
}

/**
 * Fetches full YouTube video metadata including complete description and creator
 */
export async function fetchYouTubeVideoMetadata(videoId: string): Promise<YouTubeVideoMetadata | null> {
  if (!videoId) return null;
  if (metadataCache.has(videoId)) {
    return metadataCache.get(videoId)!;
  }

  try {
    const res = await requestUrl({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": "CONSENT=YES+1; SOCS=CAESEwgDEgk2MTc4NDQ2NzEaAmVuIAEaBgiA_LyaBg;"
      }
    });

    if (res.status === 200 && res.text) {
      const html = res.text;
      const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
      if (match) {
        const data = JSON.parse(match[1]);
        const details = data?.videoDetails;
        if (details) {
          const isShorts = /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.youtube\.com\/shorts\//i.test(html) ||
            html.includes('"isShorts":true') ||
            html.includes(`/shorts/${videoId}`);

          const meta: YouTubeVideoMetadata = {
            title: details.title || undefined,
            description: details.shortDescription || undefined,
            author: details.author || undefined,
            lengthSeconds: typeof details.lengthSeconds === "string" ? parseInt(details.lengthSeconds, 10) : details.lengthSeconds,
            isShorts
          };
          if (meta.title) {
            titleCache.set(videoId, meta.title);
          }
          metadataCache.set(videoId, meta);
          return meta;
        }
      }
    }
  } catch (err) {
    console.warn(`[MediaScribe] Failed to fetch video description for ${videoId}:`, err);
  }

  return null;
}

/**
 * Fetches all videos in a YouTube playlist including titles, video IDs, and durations
 */
export async function fetchYouTubePlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  if (!playlistId) return [];
  if (playlistCache.has(playlistId)) {
    return playlistCache.get(playlistId)!;
  }

  try {
    const res = await requestUrl({
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": "CONSENT=YES+1; SOCS=CAESEwgDEgk2MTc4NDQ2NzEaAmVuIAEaBgiA_LyaBg;"
      }
    });

    if (res.status === 200 && res.text) {
      const html = res.text;
      const match = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\});<\/script>/) || html.match(/ytInitialData\s*=\s*(\{.+?\});/);
      if (match) {
        const data = JSON.parse(match[1]);
        const items: PlaylistItem[] = [];
        const seenIds = new Set<string>();

        function search(obj: any, depth: number = 0) {
          if (!obj || depth > 12) return;
          if (Array.isArray(obj)) {
            for (const item of obj) search(item, depth + 1);
            return;
          }
          if (typeof obj === "object") {
            if (obj.playlistVideoRenderer) {
              const v = obj.playlistVideoRenderer;
              if (v.videoId && !seenIds.has(v.videoId)) {
                seenIds.add(v.videoId);
                const title = v.title?.runs?.[0]?.text || v.title?.simpleText || "Unknown Video";
                titleCache.set(v.videoId, title);
                const itemIdx = seenIds.size - 1;
                items.push({
                  title,
                  duration: v.lengthText?.simpleText || "",
                  videoId: v.videoId,
                  source: {
                    type: "youtube",
                    url: `https://www.youtube.com/watch?v=${v.videoId}&list=${playlistId}&index=${itemIdx + 1}`,
                    originalInput: `https://www.youtube.com/watch?v=${v.videoId}&list=${playlistId}&index=${itemIdx + 1}`,
                    videoId: v.videoId,
                    playlistId,
                    playlistIndex: itemIdx,
                    isPlaylist: true,
                    isLocal: false,
                    title
                  }
                });
              }
            } else if (obj.lockupViewModel && obj.lockupViewModel.contentId) {
              const v = obj.lockupViewModel;
              const vId = v.contentId;
              if (vId && !seenIds.has(vId)) {
                seenIds.add(vId);
                const title = v.metadata?.lockupMetadataViewModel?.title?.content ||
                  v.rendererContext?.accessibilityContext?.label?.split(/\s+\d+\s+(?:minutes?|seconds?|hours?)/)[0] ||
                  "Unknown Video";
                titleCache.set(vId, title);
                const itemIdx = seenIds.size - 1;
                items.push({
                  title,
                  duration: "",
                  videoId: vId,
                  source: {
                    type: "youtube",
                    url: `https://www.youtube.com/watch?v=${vId}&list=${playlistId}&index=${itemIdx + 1}`,
                    originalInput: `https://www.youtube.com/watch?v=${vId}&list=${playlistId}&index=${itemIdx + 1}`,
                    videoId: vId,
                    playlistId,
                    playlistIndex: itemIdx,
                    isPlaylist: true,
                    isLocal: false,
                    title
                  }
                });
              }
            } else {
              for (const k of Object.keys(obj)) {
                search(obj[k], depth + 1);
              }
            }
          }
        }

        search(data);

        if (items.length > 0) {
          playlistCache.set(playlistId, items);
          return items;
        }
      }
    }
  } catch (err) {
    console.warn(`[MediaScribe] Failed to fetch playlist items for ${playlistId}:`, err);
  }

  return [];
}
