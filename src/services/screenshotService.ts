import { App, MarkdownView, Notice, TFile } from "obsidian";
import { IMediaPlayer, MediaScribeSettings, MediaSourceInfo } from "../types";
import { formatSeconds } from "../utils/time";

export class ScreenshotService {
  private app: App;
  private settings: MediaScribeSettings;

  constructor(app: App, settings: MediaScribeSettings) {
    this.app = app;
    this.settings = settings;
  }

  public updateSettings(settings: MediaScribeSettings): void {
    this.settings = settings;
  }

  /**
   * Captures the current frame from the active player, saves to vault, and embeds in the active note.
   */
  public async captureAndInsert(
    player: IMediaPlayer,
    sourceInfo: MediaSourceInfo,
    activeView: MarkdownView | null,
    targetContainerEl?: HTMLElement | null
  ): Promise<boolean> {
    try {
      const currentTime = await player.getCurrentTime();
      let buffer: ArrayBuffer | null = null;

      // 1. Try native canvas capture if player supports it
      if (player.captureFrame) {
        try {
          buffer = await player.captureFrame(this.settings.screenshotFormat, this.settings.screenshotQuality);
        } catch {
          buffer = null;
        }
      }

      // 2. If canvas capture didn't yield a buffer (e.g. YouTube iframe), try desktop Electron capturePage
      if (!buffer) {
        const videoEl = player.getVideoElement ? player.getVideoElement() : null;
        const targetEl = videoEl || targetContainerEl;
        if (targetEl) {
          buffer = await this.captureViaElectron(targetEl);
        }
      }

      // 3. Fallback for YouTube: grab highest resolution thumbnail if nothing else worked
      if (!buffer && sourceInfo.type === "youtube" && sourceInfo.videoId) {
        buffer = await this.fetchYouTubeThumbnail(sourceInfo.videoId, sourceInfo.isShorts);
      }

      if (!buffer || buffer.byteLength === 0) {
        new Notice("MediaScribe: Could not capture frame from this media source.");
        return false;
      }

      // Generate filename: prefix_YYYYMMDD_HHmmss.ext
      const timestampStr = formatSeconds(currentTime).replace(/:/g, "-");
      const dateStr = this.getFormattedDate();
      const ext = this.settings.screenshotFormat;
      const baseFilename = `${this.settings.screenshotNamingPrefix}${dateStr}_${timestampStr}.${ext}`;

      // Determine path
      const activeFile = activeView?.file;
      const filePath = await this.getTargetAttachmentPath(baseFilename, activeFile);

      // Save binary file into vault
      await this.app.vault.createBinary(filePath, buffer);

      // Insert link into active markdown editor
      if (activeView && activeView.editor) {
        const fileObj = this.app.vault.getAbstractFileByPath(filePath);
        let linkText = "";
        if (fileObj instanceof TFile) {
          linkText = this.app.fileManager.generateMarkdownLink(fileObj, activeFile?.path || "");
        } else {
          linkText = `![[${baseFilename}]]`;
        }

        const timeDisplay = formatSeconds(currentTime);
        const secInt = Math.floor(currentTime);
        // Clickable timestamp link on top, image embed below it
        const embedText = this.settings.screenshotIncludeTimestamp
          ? `[${timeDisplay}](#t=${secInt})\n${linkText}\n`
          : `${linkText}\n`;

        activeView.editor.replaceSelection(embedText);
      }

      new Notice(`MediaScribe: Frame captured [${formatSeconds(currentTime)}]`);
      return true;
    } catch (err) {
      console.error("[MediaScribe] Frame capture failed:", err);
      new Notice("MediaScribe: Failed to save frame screenshot.");
      return false;
    }
  }

  /**
   * Attempts to capture bounding box of an element using Electron capturePage if in desktop app
   */
  private async captureViaElectron(el: HTMLElement): Promise<ArrayBuffer | null> {
    try {
      // Obsidian Desktop exposes electron via window.require
      const electron = (window as any).require ? (window as any).require("electron") : null;
      if (!electron) return null;

      const remote = electron.remote;
      const currentWebContents = remote?.getCurrentWebContents 
        ? remote.getCurrentWebContents() 
        : electron.webFrame;

      if (!currentWebContents || !currentWebContents.capturePage) return null;

      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;

      // In Electron webContents.capturePage, coordinates are in DIPs (logical CSS pixels)
      const nativeImage = await currentWebContents.capturePage({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });

      if (!nativeImage || nativeImage.isEmpty()) return null;

      const buffer = this.settings.screenshotFormat === "jpeg" 
        ? nativeImage.toJPEG(Math.round(this.settings.screenshotQuality * 100))
        : nativeImage.toPNG();

      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch {
      return null;
    }
  }

  /**
   * Fetches YouTube maxresdefault / hqdefault / oar2 thumbnail
   */
  private async fetchYouTubeThumbnail(videoId: string, isShorts?: boolean): Promise<ArrayBuffer | null> {
    const urls: string[] = [];
    if (isShorts) {
      urls.push(`https://i.ytimg.com/vi/${videoId}/oar2.jpg`);
    }
    urls.push(
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    );

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 1000) {
            return buf;
          }
        }
      } catch {
        // continue
      }
    }
    return null;
  }

  private async getTargetAttachmentPath(filename: string, activeFile: TFile | null | undefined): Promise<string> {
    const customFolder = this.settings.screenshotFolder.trim();

    if (customFolder) {
      // Ensure custom folder exists
      const folderExists = await this.app.vault.adapter.exists(customFolder);
      if (!folderExists) {
        await this.app.vault.createFolder(customFolder);
      }
      return `${customFolder}/${filename}`;
    }

    // Default to Obsidian's configured attachment folder
    if (activeFile) {
      return await (this.app.fileManager as any).getAvailablePathForAttachment(filename, activeFile.path);
    }

    return filename;
  }

  private getFormattedDate(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
