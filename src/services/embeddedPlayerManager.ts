import { App, MarkdownView, Notice, Platform } from "obsidian";
import { IMediaPlayer, MediaScribeSettings, MediaSourceInfo } from "../types";
import { MediaDetector } from "./mediaDetector";
import { ScreenshotService } from "./screenshotService";
import { TimestampService } from "./timestampService";
import { TypingScribeService } from "./typingScribeService";
import { TranscriptService } from "./transcriptService";
import { MediaScribeEmbeddedWidget } from "../ui/MediaScribeEmbeddedWidget";

export class EmbeddedPlayerManager {
  private plugin: any;
  private app: App;
  private settings: MediaScribeSettings;
  private detector: MediaDetector;
  private screenshotService: ScreenshotService;
  private timestampService: TimestampService;
  private typingScribeService: TypingScribeService;
  private transcriptService: TranscriptService;
  private onSettingsChange: (settings: MediaScribeSettings) => Promise<void>;

  private activeWidgets: Map<MarkdownView, MediaScribeEmbeddedWidget> = new Map();
  private closedNotes: Set<string> = new Set();

  constructor(
    plugin: any,
    app: App,
    settings: MediaScribeSettings,
    detector: MediaDetector,
    screenshotService: ScreenshotService,
    timestampService: TimestampService,
    typingScribeService: TypingScribeService,
    transcriptService: TranscriptService,
    onSettingsChange: (settings: MediaScribeSettings) => Promise<void>
  ) {
    this.plugin = plugin;
    this.app = app;
    this.settings = settings;
    this.detector = detector;
    this.screenshotService = screenshotService;
    this.timestampService = timestampService;
    this.typingScribeService = typingScribeService;
    this.transcriptService = transcriptService;
    this.onSettingsChange = onSettingsChange;
  }

  public updateSettings(settings: MediaScribeSettings): void {
    this.settings = settings;
    for (const widget of this.activeWidgets.values()) {
      widget.updateSettings(settings);
    }
  }

  /**
   * Returns player from currently active markdown view widget if one exists
   */
  public getActiveEmbeddedPlayer(): IMediaPlayer | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && this.activeWidgets.has(activeView)) {
      return this.activeWidgets.get(activeView)!.getActivePlayer();
    }
    for (const widget of this.activeWidgets.values()) {
      const p = widget.getActivePlayer();
      if (p && p.isPlaying) return p;
    }
    for (const widget of this.activeWidgets.values()) {
      const p = widget.getActivePlayer();
      if (p) return p;
    }
    return null;
  }

  public getActiveEmbeddedWidget(): MediaScribeEmbeddedWidget | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && this.activeWidgets.has(activeView)) {
      return this.activeWidgets.get(activeView)!;
    }
    for (const widget of this.activeWidgets.values()) {
      const p = widget.getActivePlayer();
      if (p && p.isPlaying) return widget;
    }
    for (const widget of this.activeWidgets.values()) {
      return widget;
    }
    return null;
  }

  public getActiveSource(): MediaSourceInfo | null {
    return this.getActiveEmbeddedWidget()?.getCurrentSource() || null;
  }

  public setLoopRange(start: number, end: number, autoSeek: boolean = true): boolean {
    const widget = this.getActiveEmbeddedWidget();
    if (widget) {
      widget.uncollapse();
      widget.setLoopRange(start, end, autoSeek);
      return true;
    }
    return false;
  }

  /**
   * Inspects a MarkdownView and mounts or dismounts the embedded player
   */
  public async syncView(view: MarkdownView, forceOpen: boolean = false): Promise<void> {
    if (!this.settings.autoEmbedInNote && !forceOpen) {
      this.dismountView(view);
      return;
    }

    const file = view.file;
    if (!file) {
      this.dismountView(view);
      return;
    }

    if (this.closedNotes.has(file.path) && !forceOpen) {
      this.dismountView(view);
      return;
    }

    const source = await this.detector.extractMediaFromNote(
      file,
      this.settings.mediaPropertyNames,
      this.settings.playlistNoteProperty,
      this.settings.verifyMediaContentType ?? true
    );

    // If the active file changed while extraction was running, abort so we don't mount on the wrong file!
    if (view.file?.path !== file.path) {
      return;
    }

    if (source) {
      let widget = this.activeWidgets.get(view);
      if (!widget) {
        widget = new MediaScribeEmbeddedWidget(
          this.plugin,
          view,
          this.app,
          this.settings,
          this.screenshotService,
          this.timestampService,
          this.typingScribeService,
          this.transcriptService,
          this.onSettingsChange,
          () => {
            this.activeWidgets.delete(view);
            if (view.file) {
              this.closedNotes.add(view.file.path);
            }
          },
          () => {
            if (widget) {
              this.handlePlayerPlay(widget);
            }
          }
        );
        this.activeWidgets.set(view, widget);
      }
      await widget.loadMedia(source);
    } else {
      this.dismountView(view);
    }
  }

  public dismountView(view: MarkdownView): void {
    const widget = this.activeWidgets.get(view);
    if (widget) {
      this.activeWidgets.delete(view);
      widget.destroy();
    }

    // Safety net: ensure any lingering host element in contentEl is removed
    if (view && view.contentEl) {
      const lingering = view.contentEl.querySelectorAll(".mediascribe-embedded-host");
      lingering.forEach((el) => el.remove());
      view.contentEl.removeClass(
        "mediascribe-dock-vertical",
        "mediascribe-dock-left",
        "mediascribe-dock-right"
      );
    }
  }

  public async reopenView(view: MarkdownView, seekToSeconds?: number): Promise<void> {
    const file = view.file;
    if (file) {
      this.closedNotes.delete(file.path);
    }
    this.dismountView(view);
    await this.syncView(view, true);

    if (typeof seekToSeconds === "number") {
      const widget = this.activeWidgets.get(view);
      const player = widget?.getActivePlayer();
      if (player) {
        player.seekTo(seekToSeconds);
        player.play();
      }
    }
  }

  public async mountWithPosition(
    view: MarkdownView,
    position: "top" | "vertical_right" | "vertical_left",
    seekToSeconds?: number,
    shouldPlay: boolean = false,
    sourceToLoad?: MediaSourceInfo
  ): Promise<void> {
    const file = view.file;
    let effectivePos: "top" | "vertical_right" | "vertical_left" = position;
    if (!Platform.isDesktop) {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        effectivePos = position === "vertical_left" ? "vertical_left" : "vertical_right";
      } else {
        effectivePos = "top";
      }
    } else {
      this.settings.embeddedPosition = effectivePos;
      await this.onSettingsChange(this.settings);
    }

    const source = sourceToLoad || (file ? await this.detector.extractMediaFromNote(
      file,
      this.settings.mediaPropertyNames,
      this.settings.playlistNoteProperty,
      this.settings.verifyMediaContentType ?? true
    ) : null);
    if (!source) {
      new Notice("MediaScribe: No media found to dock into note.");
      return;
    }

    this.dismountView(view);
    if (file) {
      this.closedNotes.delete(file.path);
    }

    const widget: MediaScribeEmbeddedWidget = new MediaScribeEmbeddedWidget(
      this.plugin,
      view,
      this.app,
      this.settings,
      this.screenshotService,
      this.timestampService,
      this.typingScribeService,
      this.transcriptService,
      this.onSettingsChange,
      () => {
        this.activeWidgets.delete(view);
        if (view.file) {
          this.closedNotes.add(view.file.path);
        }
      },
      () => {
        this.handlePlayerPlay(widget);
      }
    );
    this.activeWidgets.set(view, widget);

    await widget.loadMedia(source);
    await widget.setPosition(effectivePos);

    const player = widget.getActivePlayer();
    if (player && typeof seekToSeconds === "number" && seekToSeconds > 0) {
      player.seekTo(seekToSeconds);
    }
    if (player && shouldPlay) {
      player.play();
    }
  }

  public async toggleActiveView(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;

    if (this.activeWidgets.has(view)) {
      this.closedNotes.add(view.file.path);
      this.dismountView(view);
      new Notice("MediaScribe: Player closed.");
    } else {
      this.closedNotes.delete(view.file.path);
      await this.syncView(view, true);
      if (this.activeWidgets.has(view)) {
        new Notice("MediaScribe: Player opened.");
      } else {
        new Notice("MediaScribe: No supported video/audio found in active note.");
      }
    }
  }

  public hasActiveWidget(view: MarkdownView): boolean {
    return this.activeWidgets.has(view);
  }

  public syncActiveView(): void {
    this.cleanupDisconnectedViews();
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      this.syncView(view);
    }
  }

  public syncAllLeaves(): void {
    this.cleanupDisconnectedViews();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        void this.syncView(leaf.view);
      }
    });
  }

  /**
   * Pauses all other active players when one player begins playback.
   * Ensures exclusive playback across all open tabs.
   */
  public handlePlayerPlay(playingWidget: MediaScribeEmbeddedWidget): void {
    const playingPlayer = playingWidget.getActivePlayer();
    if (playingPlayer) {
      this.typingScribeService.setPlayer(playingPlayer);
    }
    for (const widget of this.activeWidgets.values()) {
      if (widget !== playingWidget) {
        const player = widget.getActivePlayer();
        if (player && player.isPlaying) {
          player.pause();
        }
      }
    }
  }

  /**
   * Cleans up widgets whose view DOM element has been disconnected/closed.
   */
  public cleanupDisconnectedViews(): void {
    for (const [view, widget] of Array.from(this.activeWidgets.entries())) {
      if (!view.containerEl || !view.containerEl.isConnected) {
        this.dismountView(view);
      }
    }
  }

  public destroyAll(): void {
    for (const widget of this.activeWidgets.values()) {
      widget.destroy();
    }
    this.activeWidgets.clear();
  }
}
