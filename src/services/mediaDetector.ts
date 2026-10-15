import { App, TFile } from "obsidian";
import { MediaSourceInfo } from "../types";
import { parseTimestamp } from "../utils/time";

export class MediaDetector {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Resolves a media string (URL, vault link, or path) into structured MediaSourceInfo
   */
  public resolveSource(input: string, sourcePath: string = ""): MediaSourceInfo | null {
    if (!input || typeof input !== "string") return null;

    let clean = input.trim();

    // Strip wikilink brackets if present: [[file.mp4]] -> file.mp4
    if (clean.startsWith("[[") && clean.endsWith("]]")) {
      clean = clean.slice(2, -2).split("|")[0].trim();
    }

    // Strip markdown link if present: [Title](url) -> url
    const mdLinkMatch = clean.match(/^\[.*?\]\((.+?)\)$/);
    if (mdLinkMatch) {
      clean = mdLinkMatch[1].trim();
    }

    // 1. Check YouTube
    const ytInfo = this.checkYouTube(clean);
    if (ytInfo) return ytInfo;

    // 2. Check Vimeo
    const vimeoInfo = this.checkVimeo(clean);
    if (vimeoInfo) return vimeoInfo;

    // 3. Check Obsidian Vault file
    const vaultFileInfo = this.checkVaultFile(clean, sourcePath);
    if (vaultFileInfo) return vaultFileInfo;

    // 4. Check Web Direct Media
    const webMediaInfo = this.checkWebMedia(clean);
    if (webMediaInfo) return webMediaInfo;

    // If it's a URL, treat as generic web media
    if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("file://")) {
      return {
        type: "html5_video",
        url: clean,
        originalInput: input,
        isLocal: clean.startsWith("file://")
      };
    }

    return null;
  }

  private checkYouTube(input: string): MediaSourceInfo | null {
    // Check playlist id
    const listMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    const playlistId = listMatch ? listMatch[1] : undefined;

    // Regex covers watch?v=, youtu.be/, embed/, shorts/, live/
    const ytRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
    const match = input.match(ytRegex);

    if (match && match[1]) {
      const videoId = match[1];

      // Extract initial timestamp if present: t=120 or t=2m15s
      let initialTime: number | undefined;
      const tMatch = input.match(/[?&#](?:t|start)=([^&#]+)/i);
      if (tMatch && tMatch[1]) {
        const parsed = parseTimestamp(tMatch[1]);
        if (parsed !== null) initialTime = parsed;
      }

      // Extract playlist index if present: index=3 (1-based -> 0-based)
      let playlistIndex: number | undefined;
      const indexMatch = input.match(/[?&]index=(\d+)/i);
      if (indexMatch && indexMatch[1]) {
        playlistIndex = Math.max(0, parseInt(indexMatch[1], 10) - 1);
      }

      const isShorts = /\/shorts\//i.test(input);
      return {
        type: "youtube",
        url: playlistId 
          ? `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}${typeof playlistIndex === "number" ? `&index=${playlistIndex + 1}` : ""}`
          : (isShorts ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`),
        originalInput: input,
        videoId,
        playlistId,
        playlistIndex,
        isPlaylist: Boolean(playlistId),
        isShorts,
        initialTime,
        isLocal: false
      };
    } else if (playlistId) {
      // Pure playlist URL without single video id
      let playlistIndex: number | undefined;
      const indexMatch = input.match(/[?&]index=(\d+)/i);
      if (indexMatch && indexMatch[1]) {
        playlistIndex = Math.max(0, parseInt(indexMatch[1], 10) - 1);
      }

      return {
        type: "youtube",
        url: `https://www.youtube.com/playlist?list=${playlistId}${typeof playlistIndex === "number" ? `&index=${playlistIndex + 1}` : ""}`,
        originalInput: input,
        playlistId,
        playlistIndex,
        isPlaylist: true,
        isLocal: false
      };
    }

    return null;
  }

  private checkVimeo(input: string): MediaSourceInfo | null {
    const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i;
    const match = input.match(vimeoRegex);

    if (match && match[1]) {
      const videoId = match[1];
      let initialTime: number | undefined;
      const tMatch = input.match(/#t=([^&#]+)/i);
      if (tMatch && tMatch[1]) {
        const parsed = parseTimestamp(tMatch[1]);
        if (parsed !== null) initialTime = parsed;
      }

      return {
        type: "vimeo",
        url: `https://player.vimeo.com/video/${videoId}`,
        originalInput: input,
        videoId,
        initialTime,
        isLocal: false
      };
    }

    return null;
  }

  private checkVaultFile(input: string, sourcePath: string): MediaSourceInfo | null {
    // Attempt to locate file in vault
    const file = this.app.metadataCache.getFirstLinkpathDest(input, sourcePath);
    if (file instanceof TFile) {
      const ext = file.extension.toLowerCase();
      const videoExts = ["mp4", "webm", "mkv", "mov", "ogv", "m4v"];
      const audioExts = ["mp3", "m4a", "wav", "ogg", "flac", "aac", "opus"];

      if (videoExts.includes(ext) || audioExts.includes(ext)) {
        const resourceUrl = this.app.vault.getResourcePath(file);
        return {
          type: videoExts.includes(ext) ? "html5_video" : "html5_audio",
          url: resourceUrl,
          originalInput: input,
          title: file.basename,
          isLocal: true,
          localFile: file
        };
      }
    }

    return null;
  }

  private checkWebMedia(input: string): MediaSourceInfo | null {
    const videoExts = [".mp4", ".webm", ".mkv", ".mov", ".m4v", ".ogv"];
    const audioExts = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"];

    try {
      const url = new URL(input);
      const pathname = url.pathname.toLowerCase();

      for (const ext of videoExts) {
        if (pathname.endsWith(ext)) {
          return {
            type: "html5_video",
            url: input,
            originalInput: input,
            isLocal: false
          };
        }
      }

      for (const ext of audioExts) {
        if (pathname.endsWith(ext)) {
          return {
            type: "html5_audio",
            url: input,
            originalInput: input,
            isLocal: false
          };
        }
      }
    } catch {
      // not a standard web URL
    }

    return null;
  }

  /**
   * Scans a note's frontmatter and body to find media links or playlists
   */
  public extractMediaFromNote(file: TFile, mediaPropertyNames: string[], additionalProperty?: string): MediaSourceInfo | null {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return null;

    const propList = additionalProperty && !mediaPropertyNames.includes(additionalProperty)
      ? [additionalProperty, ...mediaPropertyNames]
      : mediaPropertyNames;

    // 1. Check frontmatter
    if (cache.frontmatter) {
      for (const prop of propList) {
        const val = cache.frontmatter[prop];
        if (!val) continue;

        // Check if value is a YAML list of videos (Local/Mixed Playlist)
        if (Array.isArray(val) && val.length > 0) {
          const items: { title: string; source: MediaSourceInfo }[] = [];
          for (let idx = 0; idx < val.length; idx++) {
            const item = val[idx];
            let rawUrl = "";
            let customTitle = "";
            if (typeof item === "string") {
              rawUrl = item;
            } else if (item && typeof item === "object") {
              rawUrl = item.url || item.link || item.media || "";
              customTitle = item.title || "";
            }

            if (rawUrl) {
              const resolved = this.resolveSource(rawUrl, file.path);
              if (resolved) {
                const itemTitle = customTitle || resolved.title || (resolved.videoId ? `YouTube (${resolved.videoId})` : `Part ${idx + 1}`);
                resolved.title = itemTitle;
                items.push({
                  title: itemTitle,
                  source: resolved
                });
              }
            }
          }
          if (items.length > 0) {
            const first = items[0].source;
            return {
              ...first,
              isPlaylist: true,
              playlistIndex: 0,
              playlistItems: items
            };
          }
        }

        // Single string property
        if (typeof val === "string") {
          const info = this.resolveSource(val, file.path);
          if (info) return info;
        }
      }
    }

    // 2. Check embedded links in note (e.g. ![[lecture.mp4]])
    if (cache.embeds) {
      for (const embed of cache.embeds) {
        const info = this.resolveSource(embed.link, file.path);
        if (info) return info;
      }
    }

    // 3. Check regular links (e.g. YouTube links)
    if (cache.links) {
      for (const link of cache.links) {
        const info = this.resolveSource(link.link, file.path);
        if (info) return info;
      }
    }

    return null;
  }
}
