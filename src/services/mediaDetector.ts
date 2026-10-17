import { App, TFile, requestUrl } from "obsidian";
import { MediaSourceInfo } from "../types";
import { parseTimestamp } from "../utils/time";

export class MediaDetector {
  private app: App;
  private probeCache: Map<string, { info: MediaSourceInfo | null; timestamp: number }> = new Map();
  private inFlightProbes: Map<string, Promise<MediaSourceInfo | null>> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Fast synchronous check: resolves YouTube, Vimeo, Vault file, or direct media extensions.
   * If a web URL has previously been probed and cached, returns the cached result.
   */
  public resolveSourceSync(input: string, sourcePath: string = ""): MediaSourceInfo | null {
    if (!input || typeof input !== "string") return null;

    let clean = input.trim();

    // Strip wrapping quotes if any
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }

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

    // 4. Check Web Direct Media by file extension (.mp4, .mp3, etc.)
    const webMediaInfo = this.checkWebMedia(clean);
    if (webMediaInfo) return webMediaInfo;

    // 5. Check if already probed and cached
    const cached = this.probeCache.get(clean);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }

    return null;
  }

  /**
   * Resolves a media string (URL, vault link, or path) into structured MediaSourceInfo.
   * Asynchronously verifies remote Content-Type for web URLs if verifyContentType is enabled.
   */
  public async resolveSource(
    input: string,
    sourcePath: string = "",
    verifyContentType: boolean = true
  ): Promise<MediaSourceInfo | null> {
    if (!input || typeof input !== "string") return null;

    let clean = input.trim();

    // Strip wrapping quotes if any
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }

    // Strip wikilink brackets if present: [[file.mp4]] -> file.mp4
    if (clean.startsWith("[[") && clean.endsWith("]]")) {
      clean = clean.slice(2, -2).split("|")[0].trim();
    }

    // Strip markdown link if present: [Title](url) -> url
    const mdLinkMatch = clean.match(/^\[.*?\]\((.+?)\)$/);
    if (mdLinkMatch) {
      clean = mdLinkMatch[1].trim();
    }

    // 1. Fast check (YouTube, Vimeo, Vault file, direct media file extensions, or cached probe)
    const fastInfo = this.resolveSourceSync(clean, sourcePath);
    if (fastInfo) return fastInfo;

    // If cached in probeCache as null (not media), return null immediately
    const cached = this.probeCache.get(clean);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }

    // 2. Remote HTTP/HTTPS URL detection
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      if (verifyContentType) {
        return await this.probeMediaUrl(clean);
      } else {
        // Fallback only if validation is explicitly disabled
        return {
          type: "html5_video",
          url: clean,
          originalInput: input,
          isLocal: false
        };
      }
    }

    // 3. Local file:// URL
    if (clean.startsWith("file://")) {
      const directInfo = this.checkWebMedia(clean);
      if (directInfo) return directInfo;
      if (!verifyContentType) {
        return {
          type: "html5_video",
          url: clean,
          originalInput: input,
          isLocal: true
        };
      }
    }

    return null;
  }

  /**
   * Probe an HTTP/HTTPS URL via HEAD (or range GET) to verify its Content-Type
   */
  public async probeMediaUrl(urlStr: string): Promise<MediaSourceInfo | null> {
    const cached = this.probeCache.get(urlStr);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }

    if (this.inFlightProbes.has(urlStr)) {
      return this.inFlightProbes.get(urlStr)!;
    }

    const probePromise = (async () => {
      let contentType = "";
      try {
        // Fast HEAD request with 2.5s timeout
        const headPromise = requestUrl({
          url: urlStr,
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianMediaScribe/1.0"
          },
          throw: false
        });
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
        const headRes = await Promise.race([headPromise, timeoutPromise]);

        if (headRes && headRes.status >= 200 && headRes.status < 400) {
          contentType = headRes.headers?.["content-type"] || "";
        }

        // If HEAD was rejected (e.g. 405 Method Not Allowed) or gave no content-type, try Range GET
        if (!contentType || (headRes && headRes.status === 405)) {
          const getPromise = requestUrl({
            url: urlStr,
            method: "GET",
            headers: {
              "Range": "bytes=0-0",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianMediaScribe/1.0"
            },
            throw: false
          });
          const getRes = await Promise.race([getPromise, timeoutPromise]);
          if (getRes && getRes.status >= 200 && getRes.status < 400) {
            contentType = getRes.headers?.["content-type"] || "";
          }
        }
      } catch {
        // Network error, invalid URL, or offline
      }

      contentType = contentType.toLowerCase().trim();
      let info: MediaSourceInfo | null = null;

      if (contentType.startsWith("video/")) {
        info = {
          type: "html5_video",
          url: urlStr,
          originalInput: urlStr,
          isLocal: false
        };
      } else if (contentType.startsWith("audio/")) {
        info = {
          type: "html5_audio",
          url: urlStr,
          originalInput: urlStr,
          isLocal: false
        };
      } else if (
        contentType.includes("application/ogg") ||
        contentType.includes("application/vnd.apple.mpegurl") ||
        contentType.includes("application/x-mpegurl") ||
        contentType.includes("application/dash+xml")
      ) {
        info = {
          type: "html5_video",
          url: urlStr,
          originalInput: urlStr,
          isLocal: false
        };
      }

      // Keep cache size bounded
      if (this.probeCache.size > 500) {
        const firstKey = this.probeCache.keys().next().value;
        if (firstKey) this.probeCache.delete(firstKey);
      }

      this.probeCache.set(urlStr, { info, timestamp: Date.now() });
      return info;
    })();

    this.inFlightProbes.set(urlStr, probePromise);
    try {
      return await probePromise;
    } finally {
      this.inFlightProbes.delete(urlStr);
    }
  }

  private checkYouTube(input: string): MediaSourceInfo | null {
    // Check playlist id
    const listMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    const playlistId = listMatch ? listMatch[1] : undefined;

    // Regex covers watch?v=, youtu.be/, embed/, shorts/, live/, and music.youtube.com
    const ytRegex = /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
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
      const videoExts = ["mp4", "webm", "mkv", "mov", "ogv", "m4v", "avi", "ts", "3gp", "wmv", "flv"];
      const audioExts = ["mp3", "m4a", "wav", "ogg", "flac", "aac", "opus", "weba", "oga", "mid", "midi", "wma", "aiff", "caf"];

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
    const videoExts = [
      ".mp4", ".webm", ".mkv", ".mov", ".m4v", ".ogv", ".avi", ".ts", ".3gp", ".wmv", ".asf", ".m3u8", ".mpd"
    ];
    const audioExts = [
      ".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".opus", ".weba", ".oga", ".mid", ".midi", ".wma", ".aiff", ".caf"
    ];

    try {
      let pathname = "";
      let isFileUrl = false;

      if (input.startsWith("file://")) {
        const url = new URL(input);
        pathname = decodeURIComponent(url.pathname).toLowerCase();
        isFileUrl = true;
      } else if (input.startsWith("http://") || input.startsWith("https://")) {
        const url = new URL(input);
        pathname = decodeURIComponent(url.pathname).toLowerCase();
      } else {
        // Direct local file path like C:\video.mp4 or /Users/.../audio.mp3
        const stripped = input.split(/[?#]/)[0].toLowerCase();
        for (const ext of videoExts) {
          if (stripped.endsWith(ext)) {
            return {
              type: "html5_video",
              url: input,
              originalInput: input,
              isLocal: true
            };
          }
        }
        for (const ext of audioExts) {
          if (stripped.endsWith(ext)) {
            return {
              type: "html5_audio",
              url: input,
              originalInput: input,
              isLocal: true
            };
          }
        }
        return null;
      }

      for (const ext of videoExts) {
        if (pathname.endsWith(ext)) {
          return {
            type: "html5_video",
            url: input,
            originalInput: input,
            isLocal: isFileUrl
          };
        }
      }

      for (const ext of audioExts) {
        if (pathname.endsWith(ext)) {
          return {
            type: "html5_audio",
            url: input,
            originalInput: input,
            isLocal: isFileUrl
          };
        }
      }
    } catch {
      // not a standard web URL
    }

    return null;
  }

  /**
   * Scans a note's frontmatter and body to find media links or playlists.
   * Asynchronously verifies remote Content-Type for web URLs if verifyContentType is enabled.
   */
  public async extractMediaFromNote(
    file: TFile,
    mediaPropertyNames: string[],
    additionalProperty?: string,
    verifyContentType: boolean = true
  ): Promise<MediaSourceInfo | null> {
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
              const resolved = await this.resolveSource(rawUrl, file.path, verifyContentType);
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
          const info = await this.resolveSource(val, file.path, verifyContentType);
          if (info) return info;
        }
      }
    }

    // 2. Check embedded links in note (e.g. ![[lecture.mp4]])
    if (cache.embeds) {
      for (const embed of cache.embeds) {
        const info = await this.resolveSource(embed.link, file.path, verifyContentType);
        if (info) return info;
      }
    }

    // 3. Check regular links (e.g. YouTube links)
    if (cache.links) {
      for (const link of cache.links) {
        const info = await this.resolveSource(link.link, file.path, verifyContentType);
        if (info) return info;
      }
    }

    return null;
  }

  /**
   * Fast synchronous check to find media in note without waiting on network probes.
   */
  public extractMediaFromNoteSync(
    file: TFile,
    mediaPropertyNames: string[],
    additionalProperty?: string
  ): MediaSourceInfo | null {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return null;

    const propList = additionalProperty && !mediaPropertyNames.includes(additionalProperty)
      ? [additionalProperty, ...mediaPropertyNames]
      : mediaPropertyNames;

    if (cache.frontmatter) {
      for (const prop of propList) {
        const val = cache.frontmatter[prop];
        if (!val) continue;

        if (Array.isArray(val) && val.length > 0) {
          for (let idx = 0; idx < val.length; idx++) {
            const item = val[idx];
            const rawUrl = typeof item === "string" ? item : (item?.url || item?.link || item?.media || "");
            if (rawUrl) {
              const resolved = this.resolveSourceSync(rawUrl, file.path);
              if (resolved) return resolved;
            }
          }
        }

        if (typeof val === "string") {
          const info = this.resolveSourceSync(val, file.path);
          if (info) return info;
        }
      }
    }

    if (cache.embeds) {
      for (const embed of cache.embeds) {
        const info = this.resolveSourceSync(embed.link, file.path);
        if (info) return info;
      }
    }

    if (cache.links) {
      for (const link of cache.links) {
        const info = this.resolveSourceSync(link.link, file.path);
        if (info) return info;
      }
    }

    return null;
  }

  /**
   * Fast check to determine if a note has candidate media properties or embeds
   */
  public hasMediaCandidate(
    file: TFile,
    mediaPropertyNames: string[],
    additionalProperty?: string
  ): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return false;

    const propList = additionalProperty && !mediaPropertyNames.includes(additionalProperty)
      ? [additionalProperty, ...mediaPropertyNames]
      : mediaPropertyNames;

    if (cache.frontmatter) {
      for (const prop of propList) {
        const val = cache.frontmatter[prop];
        if (val) return true;
      }
    }

    if (cache.embeds && cache.embeds.length > 0) return true;

    return false;
  }
}
