import { App, MarkdownView, Notice } from "obsidian";
import { IMediaPlayer, MediaScribeSettings } from "../types";
import { formatSeconds, parseTimestamp } from "../utils/time";

export class TimestampService {
  private settings: MediaScribeSettings;
  private playerGetter: () => IMediaPlayer | null;

  constructor(_app: App, settings: MediaScribeSettings, playerGetter: () => IMediaPlayer | null) {
    this.settings = settings;
    this.playerGetter = playerGetter;
  }

  public updateSettings(settings: MediaScribeSettings): void {
    this.settings = settings;
  }

  /**
   * Formats seconds into string according to user's setting
   */
  public formatTimestamp(seconds: number): string {
    const formattedTime = formatSeconds(seconds, !this.settings.includeTimestampLeadingZero);
    const secInt = Math.floor(seconds);

    switch (this.settings.timestampFormat) {
      case "markdown_link":
        return `[${formattedTime}](#t=${secInt})`;
      case "wikilink":
        return `[[#t=${secInt}|${formattedTime}]]`;
      case "bold":
        return `**${formattedTime}**`;
      case "plain":
        return formattedTime;
      case "bracket":
      default:
        return `[${formattedTime}](#t=${secInt})`;
    }
  }

  /**
   * Inserts the current player timestamp into active markdown editor
   */
  public async insertCurrentTimestamp(activeView: MarkdownView | null): Promise<void> {
    const player = this.playerGetter();
    if (!player) {
      new Notice("MediaScribe: No active media player.");
      return;
    }

    const currentTime = await player.getCurrentTime();
    const formatted = this.formatTimestamp(currentTime);

    if (activeView && activeView.editor) {
      const editor = activeView.editor;
      const cursor = editor.getCursor();
      editor.replaceRange(`${formatted} `, cursor);
      editor.setCursor({
        line: cursor.line,
        ch: cursor.ch + formatted.length + 1
      });
    } else {
      new Notice(`MediaScribe: Current time ${formatted}`);
    }
  }

  /**
   * Seeks the player if a timestamp string is clicked
   */
  public handleTimestampClick(text: string): boolean {
    const seconds = parseTimestamp(text);
    if (seconds !== null) {
      const player = this.playerGetter();
      if (player) {
        player.seekTo(seconds);
        new Notice(`MediaScribe: Jumped to ${formatSeconds(seconds)}`);
        return true;
      }
    }
    return false;
  }
}
