import { App } from "obsidian";
import { AudioTrackInfo, MediaTracksResult, SubtitleTrackInfo } from "../types";

const LANGUAGE_NAMES: Record<string, string> = {
  hin: "Hindi",
  eng: "English",
  spa: "Spanish",
  fre: "French",
  fra: "French",
  ger: "German",
  deu: "German",
  ita: "Italian",
  jpn: "Japanese",
  kor: "Korean",
  chi: "Chinese",
  zho: "Chinese",
  ara: "Arabic",
  por: "Portuguese",
  rus: "Russian",
  tam: "Tamil",
  tel: "Telugu",
  mal: "Malayalam",
  kan: "Kannada",
  tur: "Turkish",
  pol: "Polish",
  dut: "Dutch",
  nld: "Dutch",
  swe: "Swedish",
  dan: "Danish",
  fin: "Finnish",
  nob: "Norwegian",
  nor: "Norwegian",
  cze: "Czech",
  ces: "Czech",
  hun: "Hungarian",
  rum: "Romanian",
  ron: "Romanian",
  ind: "Indonesian",
  tha: "Thai",
  ben: "Bengali",
  guj: "Gujarati",
  mar: "Marathi",
  pan: "Punjabi",
  urd: "Urdu",
  ukr: "Ukrainian",
  vie: "Vietnamese",
  heb: "Hebrew",
  glg: "Galician",
  gre: "Greek",
  ell: "Greek"
};

export class MediaTrackService {
  private app: App;
  private isFFmpegAvailable: boolean | null = null;
  private tracksCache: Map<string, MediaTracksResult> = new Map();
  private vttCache: Map<string, string> = new Map();
  private audioCache: Map<string, string> = new Map();
  private createdTempFiles: Set<string> = new Set();

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Checks if ffprobe / ffmpeg are accessible on the host system.
   */
  public async checkAvailability(): Promise<boolean> {
    if (this.isFFmpegAvailable !== null) {
      return this.isFFmpegAvailable;
    }

    try {
      const childProcess = this.getChildProcess();
      if (!childProcess) {
        this.isFFmpegAvailable = false;
        return false;
      }

      const available = await new Promise<boolean>((resolve) => {
        childProcess.execFile("ffprobe", ["-version"], { timeout: 3000 }, (err: any) => {
          resolve(!err);
        });
      });

      this.isFFmpegAvailable = available;
      return available;
    } catch {
      this.isFFmpegAvailable = false;
      return false;
    }
  }

  /**
   * Inspects a video container to list all embedded audio and subtitle streams.
   */
  public async probeTracks(filePath: string): Promise<MediaTracksResult | null> {
    const cleanPath = this.normalizeFsPath(filePath);
    if (!cleanPath) return null;

    if (this.tracksCache.has(cleanPath)) {
      return this.tracksCache.get(cleanPath)!;
    }

    const isAvailable = await this.checkAvailability();
    if (!isAvailable) return null;

    const childProcess = this.getChildProcess();
    if (!childProcess) return null;

    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        childProcess.execFile(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "stream=index,codec_type,codec_name:stream_tags=language,title",
            "-of",
            "json",
            cleanPath
          ],
          { maxBuffer: 10 * 1024 * 1024, timeout: 8000 },
          (err: any, out: string) => {
            if (err) reject(err);
            else resolve(out);
          }
        );
      });

      const parsed = JSON.parse(stdout);
      if (!parsed || !Array.isArray(parsed.streams)) {
        return null;
      }

      const audioTracks: AudioTrackInfo[] = [];
      const subtitleTracks: SubtitleTrackInfo[] = [];

      let audioCount = 0;
      let subCount = 0;

      for (const s of parsed.streams) {
        const index = s.index;
        const codec = s.codec_name || "";
        const langCode = (s.tags?.language || "").toLowerCase().trim();
        const customTitle = s.tags?.title || "";
        const friendlyLang = LANGUAGE_NAMES[langCode] || (langCode ? langCode.toUpperCase() : "");

        if (s.codec_type === "audio") {
          const isDefault = audioCount === 0;
          const label = friendlyLang
            ? `${friendlyLang}${customTitle && customTitle !== friendlyLang ? ` (${customTitle})` : ""}`
            : (customTitle || `Track ${audioCount + 1}`);

          audioTracks.push({
            index,
            audioIndex: audioCount,
            codec,
            language: langCode || "und",
            languageLabel: label,
            title: customTitle,
            isDefault
          });
          audioCount++;
        } else if (s.codec_type === "subtitle") {
          const isDefault = subCount === 0;
          const label = friendlyLang
            ? `${friendlyLang}${customTitle && customTitle !== friendlyLang ? ` (${customTitle})` : ""}`
            : (customTitle || `Sub ${subCount + 1}`);

          subtitleTracks.push({
            index,
            subIndex: subCount,
            codec,
            language: langCode || "und",
            languageLabel: label,
            title: customTitle,
            isDefault
          });
          subCount++;
        }
      }

      const result: MediaTracksResult = {
        filePath: cleanPath,
        audioTracks,
        subtitleTracks
      };

      this.tracksCache.set(cleanPath, result);
      return result;
    } catch (err) {
      console.warn("[MediaScribe] ffprobe track inspection failed:", err);
      return null;
    }
  }

  /**
   * Extracts a single embedded subtitle track directly into WebVTT format string.
   */
  public async extractSubtitleVTT(filePath: string, streamIndex: number): Promise<string | null> {
    const cleanPath = this.normalizeFsPath(filePath);
    if (!cleanPath) return null;

    const cacheKey = `${cleanPath}_sub_${streamIndex}`;
    if (this.vttCache.has(cacheKey)) {
      return this.vttCache.get(cacheKey)!;
    }

    const childProcess = this.getChildProcess();
    if (!childProcess) return null;

    try {
      const vttContent = await new Promise<string>((resolve, reject) => {
        childProcess.execFile(
          "ffmpeg",
          ["-v", "error", "-i", cleanPath, "-map", `0:${streamIndex}`, "-f", "webvtt", "-"],
          { maxBuffer: 15 * 1024 * 1024, timeout: 15000 },
          (err: any, stdout: string) => {
            if (err) reject(err);
            else resolve(stdout);
          }
        );
      });

      if (vttContent && vttContent.includes("WEBVTT")) {
        this.vttCache.set(cacheKey, vttContent);
        return vttContent;
      }
      return null;
    } catch (err) {
      console.warn(`[MediaScribe] Failed to extract subtitle stream ${streamIndex}:`, err);
      return null;
    }
  }

  /**
   * Extracts an embedded audio track into a lossless temporary audio file (.m4a)
   * and returns an Obsidian app:// local resource URL.
   */
  public async extractAudioTrack(filePath: string, streamIndex: number): Promise<string | null> {
    const cleanPath = this.normalizeFsPath(filePath);
    if (!cleanPath) return null;

    const cacheKey = `${cleanPath}_audio_${streamIndex}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    const childProcess = this.getChildProcess();
    const os = this.getOsModule();
    const path = this.getPathModule();
    const fs = this.getFsModule();

    if (!childProcess || !os || !path || !fs) return null;

    try {
      const hash = this.simpleHash(cleanPath);
      const tempPath = path.join(os.tmpdir(), `mediascribe_audio_${hash}_s${streamIndex}.m4a`);

      // Check if already extracted on disk
      if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
        await new Promise<void>((resolve, reject) => {
          childProcess.execFile(
            "ffmpeg",
            ["-v", "error", "-y", "-i", cleanPath, "-map", `0:${streamIndex}`, "-c:a", "copy", tempPath],
            { timeout: 20000 },
            (err: any) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      this.createdTempFiles.add(tempPath);

      // Convert tempPath to Obsidian local resource URL
      let resourceUrl = "";
      try {
        const adapter = this.app.vault.adapter as any;
        if (adapter && typeof adapter.getResourcePath === "function") {
          resourceUrl = adapter.getResourcePath("file:" + tempPath);
        }
      } catch {}

      if (!resourceUrl) {
        const normalized = tempPath.replace(/\\/g, "/");
        resourceUrl = `app://local/${encodeURI(normalized.startsWith("/") ? normalized.slice(1) : normalized)}`;
      }

      this.audioCache.set(cacheKey, resourceUrl);
      return resourceUrl;
    } catch (err) {
      console.warn(`[MediaScribe] Failed to extract audio stream ${streamIndex}:`, err);
      return null;
    }
  }

  /**
   * Cleans up temporary audio files generated during playback
   */
  public cleanupTempFiles(): void {
    const fs = this.getFsModule();
    if (!fs) return;

    for (const tempPath of this.createdTempFiles) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {}
    }
    this.createdTempFiles.clear();
    this.audioCache.clear();
  }

  private normalizeFsPath(filePath: string): string {
    let clean = filePath.trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }
    if (clean.toLowerCase().startsWith("file:///")) {
      clean = decodeURIComponent(clean.slice(8));
      if (!/^[a-zA-Z]:/.test(clean) && !clean.startsWith("/")) clean = "/" + clean;
    }
    clean = clean.replace(/\\\\/g, "\\");
    return clean.split(/[?#]/)[0];
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  private getChildProcess(): any {
    try {
      return (window as any).require ? (window as any).require("child_process") : null;
    } catch {
      return null;
    }
  }

  private getOsModule(): any {
    try {
      return (window as any).require ? (window as any).require("os") : null;
    } catch {
      return null;
    }
  }

  private getPathModule(): any {
    try {
      return (window as any).require ? (window as any).require("path") : null;
    } catch {
      return null;
    }
  }

  private getFsModule(): any {
    try {
      return (window as any).require ? (window as any).require("fs") : null;
    } catch {
      return null;
    }
  }
}

