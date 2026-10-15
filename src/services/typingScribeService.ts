import { App, Notice } from "obsidian";
import { IMediaPlayer, MediaScribeSettings } from "../types";

export class TypingScribeService {
  private settings: MediaScribeSettings;
  private player: IMediaPlayer | null = null;
  private isEnabled: boolean = false;
  private wasPlayingBeforeTyping: boolean = false;
  private resumeTimeout: number | null = null;
  private pendingKeystrokes: number = 0;
  private charResetTimeout: number | null = null;

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

    const threshold = Math.max(1, this.settings.autoPauseCharThreshold ?? 3);

    // If playback was already paused due to typing, keep refreshing the auto-resume timer
    if (this.wasPlayingBeforeTyping) {
      this.scheduleResume();
      return;
    }

    // Only initiate typing pause if the video is currently playing
    if (!this.player.isPlaying) {
      return;
    }

    // Increment keystrokes in the current typing burst
    this.pendingKeystrokes++;

    // Clear any previous character reset timer
    if (this.charResetTimeout !== null) {
      window.clearTimeout(this.charResetTimeout);
      this.charResetTimeout = null;
    }

    // If threshold reached, pause playback!
    if (this.pendingKeystrokes >= threshold) {
      this.wasPlayingBeforeTyping = true;
      this.player.pause();
      this.pendingKeystrokes = 0;
      this.scheduleResume();
    } else {
      // Threshold not yet reached (e.g. user just typed a single comma).
      // If no further typing occurs within 1.5 seconds, reset pending count without interrupting video.
      this.charResetTimeout = window.setTimeout(() => {
        this.pendingKeystrokes = 0;
        this.charResetTimeout = null;
      }, 1500);
    }
  }

  private scheduleResume(): void {
    if (this.resumeTimeout !== null) {
      window.clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    const idleMs = Math.max(500, this.settings.autoPauseIdleResumeSec * 1000);
    this.resumeTimeout = window.setTimeout(async () => {
      if (!this.player || !this.isEnabled) return;

      if (this.wasPlayingBeforeTyping) {
        // Rewind slightly to preserve context
        if (this.settings.autoResumeRewindSec > 0) {
          const currentTime = await this.player.getCurrentTime();
          this.player.seekTo(Math.max(0, currentTime - this.settings.autoResumeRewindSec));
        }

        await this.player.play();
        this.wasPlayingBeforeTyping = false;
      }

      this.pendingKeystrokes = 0;
      this.resumeTimeout = null;
    }, idleMs);
  }

  public destroy(): void {
    if (this.resumeTimeout !== null) {
      window.clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }
    if (this.charResetTimeout !== null) {
      window.clearTimeout(this.charResetTimeout);
      this.charResetTimeout = null;
    }
  }
}
