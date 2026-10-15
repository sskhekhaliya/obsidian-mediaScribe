import { App, MarkdownView } from "obsidian";
import { IMediaPlayer } from "../types";
import { extractTimestampsFromText, formatSeconds } from "../utils/time";

export class TimelineMarkers {
  private containerEl: HTMLElement;
  private app: App;
  private playerGetter: () => IMediaPlayer | null;
  private duration: number = 0;

  constructor(
    parentEl: HTMLElement,
    app: App,
    playerGetter: () => IMediaPlayer | null
  ) {
    this.app = app;
    this.playerGetter = playerGetter;
    this.containerEl = parentEl.createDiv({ cls: "mediascribe-timeline-markers" });
  }

  public setDuration(duration: number): void {
    this.duration = duration;
    this.refresh();
  }

  public refresh(): void {
    this.containerEl.empty();
    if (this.duration <= 0) return;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) return;

    const noteText = activeView.editor.getValue();
    const timestamps = extractTimestampsFromText(noteText);

    for (const ts of timestamps) {
      if (ts.timeSeconds > this.duration) continue;

      const percent = (ts.timeSeconds / this.duration) * 100;
      const marker = this.containerEl.createDiv({
        cls: "mediascribe-marker-pin",
        attr: {
          style: `left: ${percent}%;`
        }
      });

      // Tooltip preview
      const previewText = ts.lineContent ? `[${formatSeconds(ts.timeSeconds)}] ${ts.lineContent}` : formatSeconds(ts.timeSeconds);
      marker.setAttribute("aria-label", previewText);

      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        const player = this.playerGetter();
        if (player) {
          player.seekTo(ts.timeSeconds);
        }
      });
    }
  }
}
