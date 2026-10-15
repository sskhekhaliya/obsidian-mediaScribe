import { App, Notice } from "obsidian";
import { IMediaPlayer, MediaScribeSettings } from "../types";

export class TypingScribeService {
  private settings: MediaScribeSettings;
  private player: IMediaPlayer | null = null;
  private isEnabled: boolean = false;
  private wasPlayingBeforeTyping: boolean = false;
  private resumeTimeout: number | null = null;

  constructor(_app: App, settings: MediaScribeSettings) {
    this.settings = settings;
    this.isEnabled = settings.autoPauseOnTyping;
  }

  public updateSettings(settings: MediaScribeSettings): void {
    this.settings = settings;
    this.isEnabled = settings.autoPauseOnTyping;
  }

  public setPlayer(player: IMediaPlayer | null): void {
    this.player = player;
  }

  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    this.settings.autoPauseOnTyping = this.isEnabled;
    new Notice(`MediaScribe: Typing Scribe (Auto-pause) is now ${this.isEnabled ? "ON" : "OFF"}`);
    return this.isEnabled;
  }

  public get active(): boolean {
    return this.isEnabled;
  }

  /**
   * Called when editor content changes
   */
  public handleEditorChange(): void {
    if (!this.isEnabled || !this.player || !this.player.isReady) {
      return;
    }

    // If currently playing, pause and remember state
    if (this.player.isPlaying) {
      this.wasPlayingBeforeTyping = true;
      this.player.pause();
    }

    // Reset resume timer
    if (this.resumeTimeout !== null) {
      window.clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    // Schedule auto-resume if it was playing
    if (this.wasPlayingBeforeTyping) {
      const idleMs = Math.max(500, this.settings.autoPauseIdleResumeSec * 1000);
      this.resumeTimeout = window.setTimeout(async () => {
        if (!this.player || !this.isEnabled) return;

        // Rewind slightly
        if (this.settings.autoResumeRewindSec > 0) {
          const currentTime = await this.player.getCurrentTime();
          this.player.seekTo(Math.max(0, currentTime - this.settings.autoResumeRewindSec));
        }

        await this.player.play();
        this.wasPlayingBeforeTyping = false;
        this.resumeTimeout = null;
      }, idleMs);
    }
  }

  public destroy(): void {
    if (this.resumeTimeout !== null) {
      window.clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }
  }
}
