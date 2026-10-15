import { App, TFile, requestUrl } from "obsidian";
import { TranscriptItem } from "../types";
import { parseTimestamp } from "../utils/time";
import { cacheYouTubeTitle } from "../utils/youtube";

const INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const INNERTUBE_PLAYER_URL = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`;
const IOS_USER_AGENT = "com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)";

const INNERTUBE_CONTEXT = {
  client: {
    clientName: "IOS",
    clientVersion: "20.10.38",
    hl: "en",
    gl: "US"
  }
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/<[^>]+>/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class TranscriptService {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Tries to find and load local SRT or VTT file for a given video file
   */
  public async loadLocalTranscriptForFile(videoFile: TFile): Promise<TranscriptItem[] | null> {
    const parentPath = videoFile.parent ? videoFile.parent.path : "";
    const baseName = videoFile.basename;

    // Check baseName.srt, baseName.vtt, baseName.en.srt, etc.
    const candidateExtensions = [".srt", ".vtt", ".en.srt", ".en.vtt"];

    for (const ext of candidateExtensions) {
      const fullPath = parentPath ? `${parentPath}/${baseName}${ext}` : `${baseName}${ext}`;
      const abstractFile = this.app.vault.getAbstractFileByPath(fullPath);

      if (abstractFile instanceof TFile) {
        const content = await this.app.vault.read(abstractFile);
        if (ext.includes("vtt")) {
          return this.parseVTT(content);
        } else {
          return this.parseSRT(content);
        }
      }
    }

    return null;
  }

  /**
   * Tries to fetch YouTube captions/subtitles using Innertube Player API with watch-page fallback
   */
  public async fetchYouTubeTranscript(videoId: string): Promise<TranscriptItem[] | null> {
    if (!videoId) return null;

    // Strategy 1: Innertube iOS Player API (Direct, bypasses cloud IP softblocks and consent pages)
    try {
      let playerData: any = null;
      try {
        const res = await requestUrl({
          url: INNERTUBE_PLAYER_URL,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": IOS_USER_AGENT
          },
          body: JSON.stringify({
            context: INNERTUBE_CONTEXT,
            videoId
          })
        });
        playerData = res.json;
      } catch (err) {
        // Fallback to standard fetch if requestUrl fails
        const fetchRes = await fetch(INNERTUBE_PLAYER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": IOS_USER_AGENT
          },
          body: JSON.stringify({
            context: INNERTUBE_CONTEXT,
            videoId
          })
        });
        if (fetchRes.ok) {
          playerData = await fetchRes.json();
        }
      }

      if (playerData) {
        // Cache video title if found
        const videoTitle = playerData.videoDetails?.title;
        if (videoTitle) {
          cacheYouTubeTitle(videoId, videoTitle);
        }

        const captions = playerData.captions?.playerCaptionsTracklistRenderer;
        if (captions && captions.captionTracks && captions.captionTracks.length > 0) {
          // Select preferred track: exact 'en', startsWith 'en', or first available
          let track = captions.captionTracks.find((t: any) => t.languageCode === "en");
          if (!track) {
            track = captions.captionTracks.find((t: any) => t.languageCode && t.languageCode.startsWith("en"));
          }
          if (!track) {
            track = captions.captionTracks[0];
          }

          if (track && track.baseUrl) {
            let timedTextContent = "";
            try {
              const trackRes = await requestUrl({
                url: track.baseUrl,
                method: "GET",
                headers: {
                  "Accept-Language": "en-US,en;q=0.9",
                  "User-Agent": IOS_USER_AGENT
                }
              });
              timedTextContent = trackRes.text;
            } catch {
              const fetchTrack = await fetch(track.baseUrl, {
                headers: {
                  "Accept-Language": "en-US,en;q=0.9",
                  "User-Agent": IOS_USER_AGENT
                }
              });
              if (fetchTrack.ok) {
                timedTextContent = await fetchTrack.text();
              }
            }

            if (timedTextContent) {
              const items = this.parseYouTubeXML(timedTextContent);
              if (items.length > 0) {
                return items;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[MediaScribe] Innertube caption fetch failed, trying watch page fallback:", e);
    }

    // Strategy 2: Web Watch Page extraction with balanced bracket parser
    try {
      let html = "";
      try {
        const res = await requestUrl({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+478"
          }
        });
        html = res.text;
      } catch {
        const fetchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+478"
          }
        });
        if (fetchRes.ok) html = await fetchRes.text();
      }

      if (html) {
        const idx = html.indexOf('"captionTracks"');
        if (idx !== -1) {
          const start = html.indexOf("[", idx);
          if (start !== -1) {
            let depth = 0;
            let end = start;
            for (let i = start; i < html.length; i++) {
              if (html[i] === "[") depth++;
              else if (html[i] === "]") {
                depth--;
                if (depth === 0) {
                  end = i + 1;
                  break;
                }
              }
            }
            const jsonStr = html.slice(start, end);
            const captionTracks = JSON.parse(jsonStr);
            if (Array.isArray(captionTracks) && captionTracks.length > 0) {
              let track = captionTracks.find((t: any) => t.languageCode === "en");
              if (!track) {
                track = captionTracks.find((t: any) => t.languageCode && t.languageCode.startsWith("en"));
              }
              if (!track) {
                track = captionTracks[0];
              }

              if (track && track.baseUrl) {
                // Try JSON3 first
                try {
                  const jRes = await requestUrl({ url: `${track.baseUrl}&fmt=json3` });
                  const json = jRes.json;
                  if (json && json.events && Array.isArray(json.events)) {
                    const items: TranscriptItem[] = [];
                    for (const ev of json.events) {
                      if (ev.segs && ev.tStartMs !== undefined) {
                        const text = decodeHtmlEntities(ev.segs.map((s: any) => s.utf8 || "").join(""));
                        if (text) {
                          const itemStart = ev.tStartMs / 1000;
                          const itemEnd = (ev.tStartMs + (ev.dDurationMs || 2000)) / 1000;
                          items.push({ start: itemStart, end: itemEnd, text });
                        }
                      }
                    }
                    if (items.length > 0) return items;
                  }
                } catch {
                  // Fallback to XML
                }

                // Fallback XML
                const xmlRes = await requestUrl({ url: track.baseUrl });
                if (xmlRes.text) {
                  const items = this.parseYouTubeXML(xmlRes.text);
                  if (items.length > 0) return items;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[MediaScribe] Could not fetch YouTube transcript via fallback:", err);
    }

    return null;
  }

  /**
   * Parses YouTube XML timedtext format:
   * Supports both <text start="12.34" dur="4.56">...</text> and <p t="12340" d="4560">...</p>
   */
  public parseYouTubeXML(xml: string): TranscriptItem[] {
    const items: TranscriptItem[] = [];

    // Format 1: <text start="1.23" dur="4.56">Text</text>
    const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
    let match: RegExpExecArray | null;

    while ((match = textRegex.exec(xml)) !== null) {
      const start = parseFloat(match[1]);
      const dur = match[2] ? parseFloat(match[2]) : 2.5;
      const text = decodeHtmlEntities(match[3]);

      if (text) {
        items.push({
          start,
          end: start + dur,
          text
        });
      }
    }

    // Format 2: <p t="1234" d="4567">Text</p> (millisecond offsets)
    if (items.length === 0) {
      const pRegex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/gi;
      while ((match = pRegex.exec(xml)) !== null) {
        const offsetMs = parseInt(match[1], 10);
        const durationMs = match[2] ? parseInt(match[2], 10) : 2500;
        const text = decodeHtmlEntities(match[3]);

        if (text) {
          items.push({
            start: offsetMs / 1000,
            end: (offsetMs + durationMs) / 1000,
            text
          });
        }
      }
    }

    return items;
  }

  /**
   * Parses SRT format
   */
  public parseSRT(srt: string): TranscriptItem[] {
    const items: TranscriptItem[] = [];
    const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const blocks = normalized.split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split("\n");
      if (lines.length < 2) continue;

      let timeIndex = 0;
      if (/^\d+$/.test(lines[0].trim())) {
        timeIndex = 1;
      }

      const timeLine = lines[timeIndex];
      if (!timeLine || !timeLine.includes("-->")) continue;

      const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
      const start = this.parseTimecode(startStr);
      const end = this.parseTimecode(endStr);

      const text = lines.slice(timeIndex + 1).join(" ").trim();
      if (text && start !== null) {
        items.push({
          start,
          end: end ?? start + 3,
          text
        });
      }
    }

    return items;
  }

  /**
   * Parses WebVTT format
   */
  public parseVTT(vtt: string): TranscriptItem[] {
    const items: TranscriptItem[] = [];
    const normalized = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");

    let currentItem: Partial<TranscriptItem> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("WEBVTT") || line.startsWith("NOTE")) continue;

      if (line.includes("-->")) {
        const [startStr, endStr] = line.split("-->").map((s) => s.trim().split(" ")[0]);
        const start = this.parseTimecode(startStr);
        const end = this.parseTimecode(endStr);

        if (start !== null) {
          currentItem = { start, end: end ?? start + 3, text: "" };
        }
      } else if (currentItem) {
        if (currentItem.text) {
          currentItem.text += " " + line;
        } else {
          currentItem.text = line;
        }

        // Check if next line is empty or end of array
        if (i + 1 >= lines.length || !lines[i + 1].trim()) {
          if (currentItem.text) {
            items.push(currentItem as TranscriptItem);
          }
          currentItem = null;
        }
      }
    }

    return items;
  }

  private parseTimecode(str: string): number | null {
    if (!str) return null;
    const clean = str.replace(",", ".").trim();
    const parts = clean.split(":");

    if (parts.length === 3) {
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      return m * 60 + s;
    }

    return parseTimestamp(str);
  }
}
