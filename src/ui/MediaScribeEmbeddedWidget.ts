import { App, MarkdownView, Menu, Notice, setIcon } from "obsidian";
import { EmbeddedPosition, IMediaPlayer, MediaScribeSettings, MediaSourceInfo } from "../types";
import { YouTubePlayer } from "../players/youtubePlayer";
import { HTML5Player } from "../players/html5Player";
import { ScreenshotService } from "../services/screenshotService";
import { TimestampService } from "../services/timestampService";
import { TypingScribeService } from "../services/typingScribeService";
import { TranscriptService } from "../services/transcriptService";
import { AmbientGlowService } from "../services/ambientGlowService";
import { TranscriptPanel } from "./TranscriptPanel";
import { TimelineMarkers } from "./TimelineMarkers";
import { formatSeconds, parseTimestamp } from "../utils/time";
import { fetchYouTubeTitle, fetchYouTubeVideoMetadata, fetchYouTubePlaylistItems } from "../utils/youtube";

export class MediaScribeEmbeddedWidget {
  private plugin: any;
  private app: App;
  private markdownView: MarkdownView;
  private settings: MediaScribeSettings;
  private onSettingsChange: (settings: MediaScribeSettings) => Promise<void>;

  private player: IMediaPlayer | null = null;
  private currentSource: MediaSourceInfo | null = null;
  private playlistIndex: number = 0;

  // Services
  private screenshotService: ScreenshotService;
  private timestampService: TimestampService;
  private ambientGlowService: AmbientGlowService = new AmbientGlowService();
  private typingScribeService: TypingScribeService;
  private transcriptService: TranscriptService;

  // DOM Elements
  private hostEl: HTMLElement;
  private headerTitleEl: HTMLElement | null = null;
  private playlistBadgeEl: HTMLElement | null = null;
  private playerContainerEl: HTMLElement | null = null;
  private controlsEl: HTMLElement | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private timeDisplayEl: HTMLElement | null = null;
  private progressSlider: HTMLInputElement | null = null;
  private timelineMarkers: TimelineMarkers | null = null;
  private transcriptPanel: TranscriptPanel | null = null;
  private loopBarEl: HTMLElement | null = null;
  private playlistDrawerEl: HTMLElement | null = null;
  private playlistToggleBtn: HTMLButtonElement | null = null;
  private prevVideoBtn: HTMLButtonElement | null = null;
  private nextVideoBtn: HTMLButtonElement | null = null;
  private speedBtn: HTMLButtonElement | null = null;

  // State
  private currentTime: number = 0;
  private duration: number = 0;
  private isScrubbing: boolean = false;
  private loopA: number | null = null;
  private loopB: number | null = null;
  private isLooping: boolean = false;
  private isSidePanelOpen: boolean = false;
  private activeSideTab: "playlist" | "transcript" | "description" = "playlist";
  private isCollapsed: boolean = false;
  private onClose?: () => void;

  // Description & Creator Info
  private currentDescription: string | null = null;
  private currentAuthor: string | null = null;
  private isLoadingDescription: boolean = false;

  // Side Panel Elements
  private sidePanelEl: HTMLElement | null = null;
  private sidePanelTabsEl: HTMLElement | null = null;
  private playlistTabBtn: HTMLElement | null = null;
  private transcriptTabBtn: HTMLElement | null = null;
  private descriptionTabBtn: HTMLElement | null = null;
  private playlistViewEl: HTMLElement | null = null;
  private transcriptViewEl: HTMLElement | null = null;
  private descriptionViewEl: HTMLElement | null = null;
  private transcriptBtn: HTMLElement | null = null;
  private descriptionBtn: HTMLElement | null = null;
  private descriptionCtrlBtn: HTMLElement | null = null;

  constructor(
    plugin: any,
    markdownView: MarkdownView,
    app: App,
    settings: MediaScribeSettings,
    screenshotService: ScreenshotService,
    timestampService: TimestampService,
    typingScribeService: TypingScribeService,
    transcriptService: TranscriptService,
    onSettingsChange: (settings: MediaScribeSettings) => Promise<void>,
    onClose?: () => void
  ) {
    this.plugin = plugin;
    this.markdownView = markdownView;
    this.app = app;
    this.settings = settings;
    this.screenshotService = screenshotService;
    this.timestampService = timestampService;
    this.typingScribeService = typingScribeService;
    this.transcriptService = transcriptService;
    this.onSettingsChange = onSettingsChange;
    this.onClose = onClose;

    // Create host element and prepend to markdown view's content container
    this.hostEl = document.createElement("div");
    this.hostEl.className = "mediascribe-embedded-host";

    const contentEl = this.markdownView.contentEl;
    contentEl.prepend(this.hostEl);

    this.applyPositionStyles();
    this.render();
  }

  public applyPositionStyles(): void {
    const pos = this.settings.embeddedPosition || "top";
    const contentEl = this.markdownView.contentEl;

    // Reset old classes
    contentEl.removeClass("mediascribe-dock-vertical", "mediascribe-dock-left", "mediascribe-dock-right");
    this.hostEl.removeClass("mediascribe-vertical-mode", "mediascribe-top-mode");

    if (pos === "vertical_left") {
      contentEl.addClass("mediascribe-dock-vertical", "mediascribe-dock-left");
      this.hostEl.addClass("mediascribe-vertical-mode");
      this.hostEl.style.removeProperty("--mediascribe-embed-height");
      this.hostEl.style.setProperty("--mediascribe-dock-width", `${this.settings.embeddedDockWidth || 420}px`);
      contentEl.style.setProperty("--mediascribe-dock-width", `${this.settings.embeddedDockWidth || 420}px`);
    } else if (pos === "vertical_right") {
      contentEl.addClass("mediascribe-dock-vertical", "mediascribe-dock-right");
      this.hostEl.addClass("mediascribe-vertical-mode");
      this.hostEl.style.removeProperty("--mediascribe-embed-height");
      this.hostEl.style.setProperty("--mediascribe-dock-width", `${this.settings.embeddedDockWidth || 420}px`);
      contentEl.style.setProperty("--mediascribe-dock-width", `${this.settings.embeddedDockWidth || 420}px`);
    } else {
      // Default: top horizontal
      this.hostEl.addClass("mediascribe-top-mode");
      this.hostEl.style.removeProperty("--mediascribe-dock-width");
      contentEl.style.removeProperty("--mediascribe-dock-width");
      this.hostEl.style.setProperty("--mediascribe-embed-height", `${this.settings.embeddedPlayerHeight || 340}px`);
    }
  }

  public async setPosition(pos: EmbeddedPosition): Promise<void> {
    this.settings.embeddedPosition = pos;
    await this.onSettingsChange(this.settings);
    this.applyPositionStyles();
    this.timelineMarkers?.refresh();
  }

  public getActivePlayer(): IMediaPlayer | null {
    return this.player;
  }

  public getCurrentSource(): MediaSourceInfo | null {
    return this.currentSource;
  }

  public async loadMedia(source: MediaSourceInfo): Promise<void> {
    if (this.currentSource && this.currentSource.url === source.url && this.player) {
      return;
    }

    await this.saveCurrentPosition();

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    this.currentSource = source;
    this.playlistIndex = source.playlistIndex || 0;

    this.updateHeaderInfo();

    let startPosition = source.initialTime || 0;
    if (this.settings.rememberPlaybackPosition && this.settings.storedPlaybackPositions[source.url]) {
      startPosition = this.settings.storedPlaybackPositions[source.url];
    }

    if (!this.playerContainerEl) return;

    if (source.type === "youtube") {
      this.player = new YouTubePlayer(
        source.videoId || "",
        startPosition,
        source.playlistId,
        this.settings.hideNativeYouTubeControls,
        this.settings.hideYouTubeOverlays,
        this.settings.youtubeCropZoom,
        Boolean(source.isShorts)
      );
    } else {
      const isAudio = source.type === "html5_audio";
      this.player = new HTML5Player(source.url, isAudio, startPosition);
    }

    this.typingScribeService.setPlayer(this.player);
    this.player.mount(this.playerContainerEl);
    this.ambientGlowService.attach(
      this.playerContainerEl,
      source,
      this.player,
      this.settings.enableAmbientMode
    );
    this.bindPlayerEvents();

    this.updatePlaylistUI();
    this.loadTranscript(source);
    this.resolveYouTubeInfo(source);
  }

  private async resolveYouTubeInfo(source: MediaSourceInfo): Promise<void> {
    if (source.type === "youtube") {
      // 1. Fetch description and metadata for current video
      if (source.videoId) {
        this.fetchAndSetDescription(source.videoId);
      }

      // 2. Fetch full playlist items with titles and durations if this is a playlist
      if (source.playlistId && (!source.playlistItems || source.playlistItems.length <= 1)) {
        fetchYouTubePlaylistItems(source.playlistId).then((items) => {
          if (items && items.length > 0 && this.currentSource === source) {
            source.playlistItems = items;
            source.isPlaylist = true;
            if (items[this.playlistIndex]?.title) {
              source.title = items[this.playlistIndex].title;
              this.updateHeaderInfo();
            }
            this.updatePlaylistUI();
          }
        });
      } else {
        this.resolveYouTubeTitles(source);
      }
    }
  }

  private async resolveYouTubeTitles(source: MediaSourceInfo): Promise<void> {
    if (source.type === "youtube" && source.videoId) {
      if (!source.title || source.title === "Media Stream" || source.title.startsWith("Part ") || source.title.startsWith("YouTube (")) {
        const title = await fetchYouTubeTitle(source.videoId);
        if (title && this.currentSource?.url === source.url) {
          source.title = title;
          this.updateHeaderInfo();
        }
      }
    }

    if (source.isPlaylist && source.playlistItems) {
      for (let i = 0; i < source.playlistItems.length; i++) {
        const item = source.playlistItems[i];
        if (item.source.type === "youtube" && item.source.videoId) {
          if (!item.title || item.title.startsWith("Part ") || item.title.startsWith("YouTube (")) {
            fetchYouTubeTitle(item.source.videoId).then((title) => {
              if (title) {
                item.title = title;
                item.source.title = title;
                if (i === this.playlistIndex && this.currentSource === source) {
                  this.updateHeaderInfo();
                }
                this.renderPlaylistItems();
              }
            });
          }
        }
      }
    }
  }

  private updateHeaderInfo(): void {
    if (!this.headerTitleEl || !this.currentSource) return;

    let title = this.currentSource.title;
    if (!title) {
      title = this.currentSource.isLocal
        ? this.currentSource.localFile?.basename || "Local Media"
        : (this.currentSource.isPlaylist ? "YouTube Playlist" : "Media Stream");
    }

    this.headerTitleEl.setText(title);

    if (this.playlistBadgeEl) {
      if (this.currentSource.isPlaylist) {
        this.playlistBadgeEl.removeClass("is-hidden");
        const count = this.currentSource.playlistItems?.length;
        this.playlistBadgeEl.setText(count ? `Part ${this.playlistIndex + 1}/${count}` : "Playlist");
      } else {
        this.playlistBadgeEl.addClass("is-hidden");
      }
    }
  }

  private render(): void {
    this.hostEl.empty();

    // 1. Header Toolbar
    this.buildHeader(this.hostEl);

    // 2. Player Viewport Area (Player Container + Side-by-Side Panel for Playlist & Captions)
    const playerArea = this.hostEl.createDiv({ cls: "mediascribe-player-area" });
    this.playerContainerEl = playerArea.createDiv({ cls: "mediascribe-player-container" });
    this.buildSidePanel(playerArea);

    // 3. Media Controls
    this.buildControls(this.hostEl);

    // 4. A-B Loop Bar
    this.buildLoopBar(this.hostEl);

    // 5. Draggable Resize Handle
    this.buildResizeHandle(this.hostEl);
  }

  private buildHeader(parentEl: HTMLElement): void {
    const header = parentEl.createDiv({ cls: "mediascribe-view-header mediascribe-embedded-header" });

    const infoSection = header.createDiv({ cls: "mediascribe-header-info" });
    const iconSpan = infoSection.createSpan({ cls: "mediascribe-header-icon" });
    setIcon(iconSpan, "play-circle");

    this.headerTitleEl = infoSection.createSpan({ cls: "mediascribe-header-title" });
    this.headerTitleEl.setText("Loading Media...");

    this.playlistBadgeEl = infoSection.createSpan({ cls: "mediascribe-playlist-badge is-hidden" });
    this.playlistBadgeEl.setText("Playlist");

    const actions = header.createDiv({ cls: "mediascribe-header-actions" });

    // Playlist Drawer Toggle
    this.playlistToggleBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Toggle Playlist" }
    });
    setIcon(this.playlistToggleBtn, "list");
    this.playlistToggleBtn.addEventListener("click", () => {
      this.toggleSideTab("playlist");
    });

    // Description Drawer Toggle
    this.descriptionBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Toggle Video Description & Creator Info" }
    });
    setIcon(this.descriptionBtn, "info");
    this.descriptionBtn.addEventListener("click", () => {
      this.toggleSideTab("description");
    });

    // Refresh Timeline pins
    const refreshPinsBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Refresh Note Timeline Markers" }
    });
    setIcon(refreshPinsBtn, "bookmark");
    refreshPinsBtn.addEventListener("click", () => {
      this.timelineMarkers?.refresh();
      new Notice("MediaScribe: Timeline markers refreshed.");
    });

    // Ambient Mode Glow Toggle
    const ambientBtn = actions.createEl("button", {
      cls: `mediascribe-btn-icon ${this.settings.enableAmbientMode ? "is-active" : ""}`,
      attr: { title: "Toggle Ambient Mode (Glow Effect)" }
    });
    setIcon(ambientBtn, "sparkles");
    ambientBtn.addEventListener("click", async () => {
      this.settings.enableAmbientMode = !this.settings.enableAmbientMode;
      ambientBtn.toggleClass("is-active", this.settings.enableAmbientMode);
      this.ambientGlowService.setEnabled(this.settings.enableAmbientMode);
      await this.onSettingsChange(this.settings);
    });

    // Position / Layout Switcher Button
    const posBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Switch Position (Top, Vertical, Sidebar)" }
    });
    setIcon(posBtn, "layout");
    posBtn.addEventListener("click", (e: MouseEvent) => {
      this.showPositionMenu(e);
    });

    // Collapse / Expand Video Player Toggle
    const collapseBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Minimize Player (Audio / Compact Mode)" }
    });
    setIcon(collapseBtn, "chevron-up");
    collapseBtn.addEventListener("click", () => {
      this.isCollapsed = !this.isCollapsed;
      this.hostEl.toggleClass("is-collapsed", this.isCollapsed);
      collapseBtn.empty();
      setIcon(collapseBtn, this.isCollapsed ? "chevron-down" : "chevron-up");
    });

    // Close / Detach Player
    const closeBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Close Media Player" }
    });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => {
      this.destroy();
      new Notice("MediaScribe: Player closed. Click ribbon icon, timestamp, or run 'Toggle media player' to reopen.");
    });
  }

  private showPositionMenu(e: MouseEvent): void {
    const menu = new Menu();
    const currentPos = this.settings.embeddedPosition || "top";

    menu.addItem((item) => {
      item.setTitle("Top (Horizontal)")
        .setIcon("rows")
        .setChecked(currentPos === "top")
        .onClick(() => this.setPosition("top"));
    });

    menu.addItem((item) => {
      item.setTitle("Vertical Split (Right side)")
        .setIcon("panel-right")
        .setChecked(currentPos === "vertical_right")
        .onClick(() => this.setPosition("vertical_right"));
    });

    menu.addItem((item) => {
      item.setTitle("Vertical Split (Left side)")
        .setIcon("panel-left")
        .setChecked(currentPos === "vertical_left")
        .onClick(() => this.setPosition("vertical_left"));
    });

    menu.addItem((item) => {
      item.setTitle("Move to Right Sidebar")
        .setIcon("layout-sidebar-right")
        .onClick(() => this.switchToSidebar());
    });

    menu.showAtMouseEvent(e);
  }

  public async switchToSidebar(): Promise<void> {
    const time = await this.player?.getCurrentTime() || 0;
    const isPlaying = this.player?.isPlaying || false;
    const source = this.currentSource;
    if (source) {
      source.initialTime = time;
    }
    const returnPos = this.settings.embeddedPosition || "top";
    const notePath = this.markdownView.file?.path;

    this.destroy();

    if (source && this.plugin) {
      await this.plugin.activateSidebarView(source, time, isPlaying, returnPos, notePath);
      new Notice("MediaScribe: Moved player to sidebar.");
    }
  }

  private buildControls(parentEl: HTMLElement): void {
    // Controls card: Row 1 (Time | Timeline Scrubber) -> Row 2 (Play Menu Left | Other Menu Right)
    this.controlsEl = parentEl.createDiv({ cls: "mediascribe-controls-card" });

    // Row 1: Time Display | Timeline Scrubber
    const timelineRow = this.controlsEl.createDiv({ cls: "mediascribe-timeline-row" });
    this.timeDisplayEl = timelineRow.createSpan({ cls: "mediascribe-time-display" });
    this.timeDisplayEl.setText("00:00 / 00:00");

    const scrubberContainer = timelineRow.createDiv({ cls: "mediascribe-scrubber-container mediascribe-ctrl-mid" });
    scrubberContainer.style.flex = "1 1 auto";
    scrubberContainer.style.minWidth = "60px";
    scrubberContainer.style.width = "100%";

    this.progressSlider = scrubberContainer.createEl("input", {
      type: "range",
      cls: "mediascribe-progress-slider",
      attr: { min: "0", max: "100", value: "0", step: "0.1" }
    });
    this.progressSlider.style.width = "100%";
    this.progressSlider.style.minWidth = "100%";
    this.progressSlider.style.maxWidth = "100%";
    this.progressSlider.style.flex = "1 1 100%";

    this.progressSlider.addEventListener("mousedown", () => {
      this.isScrubbing = true;
    });
    this.progressSlider.addEventListener("mouseup", () => {
      if (this.player && this.progressSlider) {
        const target = parseFloat(this.progressSlider.value);
        this.player.seekTo(target);
      }
      this.isScrubbing = false;
    });
    this.progressSlider.addEventListener("input", () => {
      if (this.progressSlider) {
        this.currentTime = parseFloat(this.progressSlider.value);
        const percent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        this.progressSlider.style.setProperty("--progress-percent", `${percent.toFixed(2)}%`);
        this.updateTimeDisplay();
      }
    });

    this.timelineMarkers = new TimelineMarkers(scrubberContainer, this.app, () => this.player);

    // Row 2: Buttons Row (Play Menu on Left, Other Menu on Right)
    const buttonsRow = this.controlsEl.createDiv({ cls: "mediascribe-buttons-row" });

    // 1. LEFT CONTROLS GROUP (Play Menu)
    const leftControls = buttonsRow.createDiv({ cls: "mediascribe-ctrl-group mediascribe-ctrl-left" });

    // Play / Pause (YouTube Style)
    this.playBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-play-btn",
      attr: { title: "Play / Pause (Ctrl+K)" }
    });
    setIcon(this.playBtn, "play");
    this.playBtn.addEventListener("click", async () => {
      if (!this.player) return;
      await this.player.togglePlay();
      this.updatePlayState(this.player.isPlaying);
    });

    // Previous Video in Playlist
    this.prevVideoBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn is-hidden",
      attr: { title: "Previous Video (Ctrl+Alt+P)" }
    });
    setIcon(this.prevVideoBtn, "skip-back");
    this.prevVideoBtn.addEventListener("click", () => this.handlePreviousVideo());

    // Next Video in Playlist
    this.nextVideoBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn is-hidden",
      attr: { title: "Next Video (Ctrl+Alt+N)" }
    });
    setIcon(this.nextVideoBtn, "skip-forward");
    this.nextVideoBtn.addEventListener("click", () => this.handleNextVideo());

    // Rewind 5s
    const rewBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: `Rewind ${this.settings.jumpStepSeconds}s (Ctrl+J)` }
    });
    setIcon(rewBtn, "rotate-ccw");
    rewBtn.addEventListener("click", () => this.player?.jump(-this.settings.jumpStepSeconds));

    // Forward 5s
    const fwdBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: `Forward ${this.settings.jumpStepSeconds}s (Ctrl+L)` }
    });
    setIcon(fwdBtn, "rotate-cw");
    fwdBtn.addEventListener("click", () => this.player?.jump(this.settings.jumpStepSeconds));

    // Volume Group (YouTube Hover-Expand Slider)
    const volumeGroup = leftControls.createDiv({ cls: "mediascribe-volume-group" });
    const volumeBtn = volumeGroup.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-volume-btn",
      attr: { title: "Mute / Unmute" }
    });
    setIcon(volumeBtn, "volume-2");

    const volumeSlider = volumeGroup.createEl("input", {
      type: "range",
      cls: "mediascribe-volume-slider",
      attr: { min: "0", max: "100", value: "100", step: "1", title: "Volume" }
    });
    volumeSlider.style.width = "0px";
    volumeSlider.style.minWidth = "0px";
    volumeSlider.style.maxWidth = "0px";
    volumeSlider.style.padding = "0px";
    volumeSlider.style.setProperty("--volume-percent", "100%");

    volumeGroup.addEventListener("mouseenter", () => {
      volumeSlider.style.width = "52px";
      volumeSlider.style.minWidth = "52px";
      volumeSlider.style.maxWidth = "52px";
      volumeSlider.style.marginLeft = "4px";
      volumeSlider.style.opacity = "1";
      volumeSlider.style.pointerEvents = "auto";
    });
    volumeGroup.addEventListener("mouseleave", () => {
      volumeSlider.style.width = "0px";
      volumeSlider.style.minWidth = "0px";
      volumeSlider.style.maxWidth = "0px";
      volumeSlider.style.marginLeft = "0px";
      volumeSlider.style.opacity = "0";
      volumeSlider.style.pointerEvents = "none";
    });

    let prevVolume = 100;
    volumeBtn.addEventListener("click", () => {
      if (!this.player) return;
      const current = parseFloat(volumeSlider.value);
      if (current > 0) {
        prevVolume = current;
        volumeSlider.value = "0";
        volumeSlider.style.setProperty("--volume-percent", "0%");
        this.player.setVolume(0);
        volumeBtn.empty();
        setIcon(volumeBtn, "volume-x");
      } else {
        const restore = prevVolume || 100;
        volumeSlider.value = restore.toString();
        volumeSlider.style.setProperty("--volume-percent", `${restore}%`);
        this.player.setVolume(restore);
        volumeBtn.empty();
        setIcon(volumeBtn, "volume-2");
      }
    });

    volumeSlider.addEventListener("input", () => {
      const val = parseFloat(volumeSlider.value);
      volumeSlider.style.setProperty("--volume-percent", `${val}%`);
      this.player?.setVolume(val);
      volumeBtn.empty();
      setIcon(volumeBtn, val === 0 ? "volume-x" : (val < 50 ? "volume-1" : "volume-2"));
    });

    // 2. RIGHT CONTROLS GROUP (Other Menu)
    const rightControls = buttonsRow.createDiv({ cls: "mediascribe-ctrl-group mediascribe-ctrl-right" });

    // Speed Cycle Button (Circular button matching other icon buttons)
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.5, 0.75];
    let currentSpeedIndex = 0;
    this.speedBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-speed-btn",
      attr: { title: "Playback Speed: 1x (Click to cycle)" }
    });
    this.speedBtn.setText("1x");
    this.speedBtn.addEventListener("click", () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      const speed = speeds[currentSpeedIndex];
      this.player?.setPlaybackRate(speed);
      if (this.speedBtn) {
        this.speedBtn.setText(`${speed}x`);
        this.speedBtn.setAttribute("title", `Playback Speed: ${speed}x (Click to cycle)`);
      }
    });

    // Auto-Pause Typing Scribe Toggle
    const scribeBtn = rightControls.createEl("button", {
      cls: `mediascribe-ctrl-btn ${this.typingScribeService.active ? "is-active" : ""}`,
      attr: { title: "Toggle Auto-Pause While Typing" }
    });
    setIcon(scribeBtn, "pen-tool");
    scribeBtn.addEventListener("click", () => {
      const active = this.typingScribeService.toggle();
      scribeBtn.toggleClass("is-active", active);
    });

    // Insert Timestamp
    const timeBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Insert Timestamp (Ctrl+I)" }
    });
    setIcon(timeBtn, "clock");
    timeBtn.addEventListener("click", () => {
      this.timestampService.insertCurrentTimestamp(this.markdownView);
    });

    // Frame Screenshot
    const snapBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Capture Video Frame (Ctrl+Shift+S)" }
    });
    setIcon(snapBtn, "camera");
    snapBtn.addEventListener("click", () => this.captureScreenshot());

    // Transcript / Subtitles Toggle
    this.transcriptBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-cc-btn",
      attr: { title: "Subtitles / Transcript Panel" }
    });
    setIcon(this.transcriptBtn, "subtitles");
    this.transcriptBtn.addEventListener("click", () => {
      this.toggleSideTab("transcript");
    });

    // Description button in controls
    this.descriptionCtrlBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Video Description & Notes" }
    });
    setIcon(this.descriptionCtrlBtn, "file-text");
    this.descriptionCtrlBtn.addEventListener("click", () => {
      this.toggleSideTab("description");
    });

    // A-B Loop Toggle
    const loopBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "A-B Repeat Loop" }
    });
    setIcon(loopBtn, "repeat");
    loopBtn.addEventListener("click", () => {
      this.isLooping = !this.isLooping;
      loopBtn.toggleClass("is-active", this.isLooping);
      this.loopBarEl?.toggleClass("is-hidden", !this.isLooping);
    });
  }

  private buildSidePanel(parentEl: HTMLElement): void {
    this.sidePanelEl = parentEl.createDiv({ cls: "mediascribe-side-panel is-hidden" });

    // Header: Tabs (Playlist vs Captions) + Close Button
    const headerEl = this.sidePanelEl.createDiv({ cls: "mediascribe-side-panel-header" });
    this.sidePanelTabsEl = headerEl.createDiv({ cls: "mediascribe-side-panel-tabs" });

    const closeBtn = headerEl.createEl("button", {
      cls: "mediascribe-side-panel-close-btn",
      attr: { title: "Close Side Panel" }
    });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => {
      this.closeSidePanel();
    });

    // Content container
    const contentEl = this.sidePanelEl.createDiv({ cls: "mediascribe-side-panel-content" });

    // 1. Playlist View
    this.playlistViewEl = contentEl.createDiv({ cls: "mediascribe-side-view mediascribe-playlist-view" });
    this.buildPlaylistDrawer(this.playlistViewEl);

    // 2. Transcript View
    this.transcriptViewEl = contentEl.createDiv({ cls: "mediascribe-side-view mediascribe-transcript-view is-hidden" });
    this.transcriptViewEl.style.display = "none";
    this.transcriptPanel = new TranscriptPanel(this.transcriptViewEl, this.app, () => this.player);

    // 3. Description View
    this.descriptionViewEl = contentEl.createDiv({ cls: "mediascribe-side-view mediascribe-description-view is-hidden" });
    this.descriptionViewEl.style.display = "none";
    this.renderDescriptionView();

    this.updateSidePanelTabs();
  }

  public openSideTab(tab: "playlist" | "transcript" | "description"): void {
    this.activeSideTab = tab;
    this.isSidePanelOpen = true;
    this.sidePanelEl?.removeClass("is-hidden");
    if (this.sidePanelEl) {
      this.sidePanelEl.style.display = "flex";
    }

    this.playlistViewEl?.toggleClass("is-hidden", tab !== "playlist");
    this.transcriptViewEl?.toggleClass("is-hidden", tab !== "transcript");
    this.descriptionViewEl?.toggleClass("is-hidden", tab !== "description");

    if (this.playlistViewEl) this.playlistViewEl.style.display = tab === "playlist" ? "flex" : "none";
    if (this.transcriptViewEl) this.transcriptViewEl.style.display = tab === "transcript" ? "flex" : "none";
    if (this.descriptionViewEl) this.descriptionViewEl.style.display = tab === "description" ? "flex" : "none";

    this.updateSidePanelTabs();

    this.playlistToggleBtn?.toggleClass("is-active", tab === "playlist");
    this.transcriptBtn?.toggleClass("is-active", tab === "transcript");
    this.descriptionBtn?.toggleClass("is-active", tab === "description");
    this.descriptionCtrlBtn?.toggleClass("is-active", tab === "description");

    if (tab === "transcript") {
      this.transcriptPanel?.setVisible(true);
    } else if (tab === "description") {
      this.renderDescriptionView();
    }
  }

  public closeSidePanel(): void {
    this.isSidePanelOpen = false;
    this.sidePanelEl?.addClass("is-hidden");
    if (this.sidePanelEl) {
      this.sidePanelEl.style.display = "none";
    }
    this.playlistToggleBtn?.removeClass("is-active");
    this.transcriptBtn?.removeClass("is-active");
    this.descriptionBtn?.removeClass("is-active");
    this.descriptionCtrlBtn?.removeClass("is-active");
  }

  public toggleSideTab(tab: "playlist" | "transcript" | "description"): void {
    if (this.isSidePanelOpen && this.activeSideTab === tab) {
      this.closeSidePanel();
    } else {
      this.openSideTab(tab);
    }
  }

  private updateSidePanelTabs(): void {
    if (!this.sidePanelTabsEl) return;
    this.sidePanelTabsEl.empty();

    const count = this.currentSource?.playlistItems?.length || 0;
    const hasPlaylist = count > 1 || (this.currentSource?.playlistItems && this.currentSource.playlistItems.length > 0);

    if (hasPlaylist) {
      this.playlistTabBtn = this.sidePanelTabsEl.createEl("button", {
        cls: `mediascribe-side-tab-btn ${this.activeSideTab === "playlist" ? "is-active" : ""}`,
        text: `Playlist (${this.playlistIndex + 1}/${count})`
      });
      this.playlistTabBtn.addEventListener("click", () => this.openSideTab("playlist"));
    }

    this.transcriptTabBtn = this.sidePanelTabsEl.createEl("button", {
      cls: `mediascribe-side-tab-btn ${this.activeSideTab === "transcript" ? "is-active" : ""}`,
      text: "Captions"
    });
    this.transcriptTabBtn.addEventListener("click", () => this.openSideTab("transcript"));

    this.descriptionTabBtn = this.sidePanelTabsEl.createEl("button", {
      cls: `mediascribe-side-tab-btn ${this.activeSideTab === "description" ? "is-active" : ""}`,
      text: "Description"
    });
    this.descriptionTabBtn.addEventListener("click", () => this.openSideTab("description"));
  }

  private async fetchAndSetDescription(videoId: string): Promise<void> {
    if (!videoId) return;
    this.isLoadingDescription = true;
    if (this.descriptionViewEl && this.activeSideTab === "description") {
      this.renderDescriptionView();
    }

    try {
      const meta = await fetchYouTubeVideoMetadata(videoId);
      if (meta) {
        if (meta.isShorts && this.currentSource) {
          this.currentSource.isShorts = true;
          if (this.player && "setShortsMode" in this.player) {
            (this.player as any).setShortsMode(true);
          }
        }
        this.currentDescription = meta.description || "No description provided for this video.";
        this.currentAuthor = meta.author || "";
        if (meta.title && this.currentSource && (!this.currentSource.title || this.currentSource.title === "Media Stream" || this.currentSource.title.startsWith("Part ") || this.currentSource.title.startsWith("YouTube ("))) {
          this.currentSource.title = meta.title;
          this.updateHeaderInfo();
        }
      } else {
        this.currentDescription = "Could not load description.";
      }
    } catch {
      this.currentDescription = "Failed to load description.";
    } finally {
      this.isLoadingDescription = false;
      if (this.descriptionViewEl && this.activeSideTab === "description") {
        this.renderDescriptionView();
      }
    }
  }

  private renderDescriptionView(): void {
    if (!this.descriptionViewEl) return;
    this.descriptionViewEl.empty();

    const container = this.descriptionViewEl.createDiv({ cls: "mediascribe-description-container" });

    // Actions bar (Author, Copy, Insert to Note)
    const actionsBar = container.createDiv({ cls: "mediascribe-desc-actions" });

    if (this.currentAuthor) {
      const authorBadge = actionsBar.createDiv({ cls: "mediascribe-desc-author" });
      setIcon(authorBadge.createSpan(), "user");
      authorBadge.createSpan({ text: ` ${this.currentAuthor}` });
    }

    const spacer = actionsBar.createDiv({ cls: "mediascribe-desc-spacer" });
    spacer.style.flex = "1 1 auto";

    const copyBtn = actionsBar.createEl("button", {
      cls: "mediascribe-desc-action-btn",
      attr: { title: "Copy Description" }
    });
    setIcon(copyBtn, "copy");
    copyBtn.createSpan({ text: " Copy" });
    copyBtn.addEventListener("click", () => {
      if (this.currentDescription) {
        navigator.clipboard.writeText(this.currentDescription);
        new Notice("MediaScribe: Description copied to clipboard.");
      }
    });

    const insertBtn = actionsBar.createEl("button", {
      cls: "mediascribe-desc-action-btn",
      attr: { title: "Insert Description into Active Note" }
    });
    setIcon(insertBtn, "file-plus");
    insertBtn.createSpan({ text: " Insert to Note" });
    insertBtn.addEventListener("click", () => {
      this.insertDescriptionIntoNote();
    });

    // Content body
    const bodyEl = container.createDiv({ cls: "mediascribe-desc-body" });

    if (this.isLoadingDescription) {
      const loading = bodyEl.createDiv({ cls: "mediascribe-desc-loading" });
      loading.setText("Loading video description...");
      return;
    }

    if (!this.currentDescription) {
      const empty = bodyEl.createDiv({ cls: "mediascribe-desc-empty" });
      empty.setText("No description available for this media.");
      return;
    }

    this.renderFormattedDescription(bodyEl, this.currentDescription);
  }

  private renderFormattedDescription(parentEl: HTMLElement, text: string): void {
    const lines = text.split("\n");
    for (const line of lines) {
      const lineEl = parentEl.createDiv({ cls: "mediascribe-desc-line" });
      if (!line.trim()) {
        lineEl.createSpan({ text: "\u00A0" });
        continue;
      }

      // Regex matching timestamps
      const timestampRegex = /(?:^|(?<=[\s(\[]))((?:\d{1,2}:)?\d{1,2}:\d{2})(?=$|[\s)\]])/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = timestampRegex.exec(line)) !== null) {
        const matchStart = match.index;
        const matchStr = match[1];
        const matchLen = matchStr.length;

        // Text before the timestamp
        if (matchStart > lastIndex) {
          this.renderTextWithLinks(lineEl, line.slice(lastIndex, matchStart));
        }

        // Timestamp pill
        const pill = lineEl.createSpan({ cls: "mediascribe-timestamp-pill", text: matchStr });
        pill.setAttribute("title", `Seek to ${matchStr}`);
        const parsedSec = parseTimestamp(matchStr);
        if (parsedSec !== null) {
          pill.addEventListener("click", () => {
            this.player?.seekTo(parsedSec);
          });
        }

        lastIndex = matchStart + matchLen;
      }

      if (lastIndex < line.length) {
        this.renderTextWithLinks(lineEl, line.slice(lastIndex));
      }
    }
  }

  private renderTextWithLinks(parentEl: HTMLElement, text: string): void {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    for (const part of parts) {
      if (/^https?:\/\//i.test(part)) {
        const a = parentEl.createEl("a", {
          cls: "mediascribe-desc-link",
          text: part,
          href: part
        });
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      } else {
        parentEl.createSpan({ text: part });
      }
    }
  }

  private insertDescriptionIntoNote(): void {
    if (!this.currentDescription) {
      new Notice("MediaScribe: No description to insert.");
      return;
    }

    const editor = this.markdownView?.editor;
    if (!editor) {
      new Notice("MediaScribe: No active note editor found.");
      return;
    }

    const title = this.currentSource?.title || "Video";
    let formattedText = `\n### Description - ${title}\n`;
    if (this.currentAuthor) {
      formattedText += `**Creator:** ${this.currentAuthor}\n\n`;
    }

    // Convert timestamps in description into clickable obsidian timestamp format [MM:SS](#t=seconds)
    const lines = this.currentDescription.split("\n");
    const convertedLines = lines.map((line) => {
      return line.replace(/(?:^|(?<=[\s(\[]))(\d{1,2}:)?(\d{1,2}:\d{2})(?=$|[\s)\]])/g, (match) => {
        const sec = parseTimestamp(match);
        if (sec !== null && sec >= 0) {
          return `[${match}](#t=${sec})`;
        }
        return match;
      });
    });

    formattedText += convertedLines.join("\n") + "\n\n";

    const cursor = editor.getCursor();
    editor.replaceRange(formattedText, cursor);
    new Notice("MediaScribe: Inserted description into note.");
  }

  private buildPlaylistDrawer(parentEl: HTMLElement): void {
    this.playlistDrawerEl = parentEl.createDiv({ cls: "mediascribe-playlist-drawer" });
    this.renderPlaylistItems();
  }

  private renderPlaylistItems(): void {
    if (!this.playlistDrawerEl) return;
    this.playlistDrawerEl.empty();

    const listEl = this.playlistDrawerEl.createDiv({ cls: "mediascribe-playlist-list" });

    if (this.currentSource?.playlistItems && this.currentSource.playlistItems.length > 0) {
      this.currentSource.playlistItems.forEach((item, idx) => {
        const row = listEl.createDiv({
          cls: `mediascribe-playlist-row ${idx === this.playlistIndex ? "is-active" : ""}`
        });

        const num = row.createSpan({ cls: "mediascribe-playlist-num" });
        num.setText(`${idx + 1}.`);

        const title = row.createSpan({ cls: "mediascribe-playlist-title" });
        title.setText(item.title);
        title.setAttribute("title", item.title);

        if (item.duration) {
          const dur = row.createSpan({ cls: "mediascribe-playlist-dur" });
          dur.setText(item.duration);
        }

        row.addEventListener("click", () => {
          this.switchPlaylistItem(idx);
        });
      });
    } else if (this.currentSource?.type === "youtube" && this.currentSource.playlistId) {
      const info = listEl.createDiv({ cls: "mediascribe-playlist-info" });
      info.setText("YouTube Playlist Active. Use Previous (⏮️) and Next (⏭️) buttons to navigate between videos.");
    }
  }

  private updatePlaylistUI(): void {
    const isPlaylist = Boolean(this.currentSource?.isPlaylist);
    this.prevVideoBtn?.toggleClass("is-hidden", !isPlaylist);
    this.nextVideoBtn?.toggleClass("is-hidden", !isPlaylist);
    this.renderPlaylistItems();
    this.updateSidePanelTabs();
  }

  private switchPlaylistItem(idx: number): void {
    if (!this.currentSource?.playlistItems || !this.currentSource.playlistItems[idx]) return;

    this.playlistIndex = idx;
    const selectedItem = this.currentSource.playlistItems[idx];

    // If active player is YouTubePlayer with playlist support
    if (this.currentSource.type === "youtube" && this.player && "playVideoAt" in this.player) {
      (this.player as any).playVideoAt(idx);
      if (selectedItem.title) {
        this.currentSource.title = selectedItem.title;
        this.updateHeaderInfo();
      }
      if (selectedItem.source?.videoId) {
        this.currentSource.videoId = selectedItem.source.videoId;
        this.fetchAndSetDescription(selectedItem.source.videoId);
        this.loadTranscript(selectedItem.source);
      }
      this.renderPlaylistItems();
      this.updateSidePanelTabs();
      return;
    }

    const newSource = {
      ...selectedItem.source,
      isPlaylist: true,
      playlistIndex: idx,
      playlistItems: this.currentSource.playlistItems
    };

    this.loadMedia(newSource);
  }

  private handleNextVideo(): void {
    if (this.currentSource?.playlistItems) {
      if (this.playlistIndex < this.currentSource.playlistItems.length - 1) {
        this.switchPlaylistItem(this.playlistIndex + 1);
      }
    } else if (this.player && this.player.nextVideo) {
      this.player.nextVideo();
    }
  }

  private handlePreviousVideo(): void {
    if (this.currentSource?.playlistItems) {
      if (this.playlistIndex > 0) {
        this.switchPlaylistItem(this.playlistIndex - 1);
      }
    } else if (this.player && this.player.previousVideo) {
      this.player.previousVideo();
    }
  }

  private buildLoopBar(parentEl: HTMLElement): void {
    this.loopBarEl = parentEl.createDiv({ cls: "mediascribe-loop-bar is-hidden" });

    const title = this.loopBarEl.createSpan({ cls: "mediascribe-loop-title" });
    title.setText("A-B Loop:");

    const btnA = this.loopBarEl.createEl("button", { cls: "mediascribe-btn-sm", text: "Set A" });
    const spanA = this.loopBarEl.createSpan({ cls: "mediascribe-loop-val", text: "--:--" });

    btnA.addEventListener("click", async () => {
      if (this.player) {
        this.loopA = await this.player.getCurrentTime();
        spanA.setText(formatSeconds(this.loopA));
        new Notice(`MediaScribe: Point A set to ${formatSeconds(this.loopA)}`);
      }
    });

    const btnB = this.loopBarEl.createEl("button", { cls: "mediascribe-btn-sm", text: "Set B" });
    const spanB = this.loopBarEl.createSpan({ cls: "mediascribe-loop-val", text: "--:--" });

    btnB.addEventListener("click", async () => {
      if (this.player) {
        this.loopB = await this.player.getCurrentTime();
        spanB.setText(formatSeconds(this.loopB));
        new Notice(`MediaScribe: Point B set to ${formatSeconds(this.loopB)}`);
      }
    });

    const clearBtn = this.loopBarEl.createEl("button", { cls: "mediascribe-btn-sm", text: "Clear" });
    clearBtn.addEventListener("click", () => {
      this.loopA = null;
      this.loopB = null;
      spanA.setText("--:--");
      spanB.setText("--:--");
      new Notice("MediaScribe: A-B loop cleared.");
    });
  }

  public async captureScreenshot(): Promise<void> {
    if (!this.player || !this.currentSource) {
      new Notice("MediaScribe: No media player active to capture.");
      return;
    }

    await this.screenshotService.captureAndInsert(
      this.player,
      this.currentSource,
      this.markdownView,
      this.playerContainerEl
    );
  }

  private bindPlayerEvents(): void {
    if (!this.player) return;

    this.player.on("ready", () => {
      this.updatePlayState(false);
    });

    this.player.on("play", () => {
      this.updatePlayState(true);
    });

    this.player.on("pause", () => {
      this.updatePlayState(false);
      this.saveCurrentPosition();
    });

    this.player.on("timeupdate", async (time: number) => {
      this.currentTime = time;
      if (this.duration <= 0 && this.player) {
        const dur = await this.player.getDuration();
        if (dur > 0) {
          this.duration = dur;
          if (this.progressSlider) {
            this.progressSlider.max = dur.toString();
          }
          if (this.timelineMarkers) {
            this.timelineMarkers.setDuration(dur);
          }
        }
      }
      this.updateTimeDisplay();

      if (this.isLooping && this.loopA !== null && this.loopB !== null) {
        if (time >= this.loopB) {
          this.player?.seekTo(this.loopA);
        }
      }

      if (this.transcriptPanel) {
        this.transcriptPanel.updateTime(time);
      }
    });

    this.player.on("durationchange", (dur: number) => {
      if (dur > 0) {
        this.duration = dur;
        if (this.progressSlider) {
          this.progressSlider.max = dur.toString();
        }
        if (this.timelineMarkers) {
          this.timelineMarkers.setDuration(dur);
        }
        this.updateTimeDisplay();
      }
    });

    this.player.on("ratechange", (rate: number) => {
      if (this.speedBtn) {
        this.speedBtn.setText(`${rate}x`);
        this.speedBtn.setAttribute("title", `Playback Speed: ${rate}x (Click to cycle)`);
      }
    });



    this.player.on("playlistindexchange", (idx: number) => {
      if (this.playlistIndex !== idx) {
        this.playlistIndex = idx;
        if (this.currentSource) {
          this.currentSource.playlistIndex = idx;
          const item = this.currentSource.playlistItems?.[idx];
          if (item) {
            if (item.title) {
              this.currentSource.title = item.title;
              this.updateHeaderInfo();
            }
            if (item.source?.videoId) {
              this.currentSource.videoId = item.source.videoId;
              this.fetchAndSetDescription(item.source.videoId);
              this.loadTranscript(item.source);
            }
          }
          this.renderPlaylistItems();
          this.updateSidePanelTabs();
        }
      }
    });

    this.player.on("ended", () => {
      this.updatePlayState(false);
      this.saveCurrentPosition();

      // Autoplay next item in playlist if available
      if (this.currentSource?.playlistItems && this.playlistIndex < this.currentSource.playlistItems.length - 1) {
        this.handleNextVideo();
      }
    });
  }

  private updatePlayState(isPlaying: boolean): void {
    if (this.playBtn) {
      this.playBtn.empty();
      setIcon(this.playBtn, isPlaying ? "pause" : "play");
      this.playBtn.setAttribute("title", isPlaying ? "Pause (Ctrl+K)" : "Play (Ctrl+K)");
    }
  }

  private updateTimeDisplay(): void {
    if (this.timeDisplayEl) {
      this.timeDisplayEl.setText(`${formatSeconds(this.currentTime)} / ${formatSeconds(this.duration)}`);
    }
    if (this.progressSlider && !this.isScrubbing) {
      this.progressSlider.value = this.currentTime.toString();
      const percent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
      this.progressSlider.style.setProperty("--progress-percent", `${percent.toFixed(2)}%`);
    }
  }

  private async loadTranscript(source: MediaSourceInfo): Promise<void> {
    if (!this.transcriptPanel) return;
    this.transcriptPanel.clear();
    this.transcriptPanel.setLoading(true);

    try {
      if (source.isLocal && source.localFile) {
        const items = await this.transcriptService.loadLocalTranscriptForFile(source.localFile);
        if (items && items.length > 0) {
          this.transcriptPanel.setItems(items);
          return;
        }
      }

      if (source.type === "youtube" && source.videoId) {
        const items = await this.transcriptService.fetchYouTubeTranscript(source.videoId);
        if (items && items.length > 0) {
          this.transcriptPanel.setItems(items);
          return;
        }
      }

      this.transcriptPanel.setItems([]);
    } catch {
      this.transcriptPanel.setItems([]);
    }
  }

  private async saveCurrentPosition(): Promise<void> {
    if (!this.settings.rememberPlaybackPosition || !this.currentSource || this.currentTime <= 0) return;
    this.settings.storedPlaybackPositions[this.currentSource.url] = Math.floor(this.currentTime);
    await this.onSettingsChange(this.settings);
  }

  private buildResizeHandle(parentEl: HTMLElement): void {
    const handle = parentEl.createDiv({ cls: "mediascribe-resize-handle" });

    let isDragging = false;
    let startY = 0;
    let startX = 0;
    let startH = this.settings.embeddedPlayerHeight || 340;
    let startW = this.settings.embeddedDockWidth || 420;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const pos = this.settings.embeddedPosition || "top";

      if (pos === "top") {
        const delta = e.clientY - startY;
        const containerW = this.playerContainerEl?.clientWidth || window.innerWidth;
        const maxAllowedByWidth = Math.floor(containerW * 9 / 16);
        const maxH = Math.min(650, Math.floor(window.innerHeight * 0.85), Math.max(200, maxAllowedByWidth));
        const newHeight = Math.max(160, Math.min(maxH, startH + delta));
        this.hostEl.style.setProperty("--mediascribe-embed-height", `${newHeight}px`);
      } else {
        // Horizontal width drag for vertical dock
        let delta = 0;
        if (pos === "vertical_left") {
          delta = e.clientX - startX;
        } else {
          delta = startX - e.clientX;
        }
        const maxW = Math.floor(window.innerWidth * 0.65);
        const newWidth = Math.max(280, Math.min(maxW, startW + delta));
        this.hostEl.style.setProperty("--mediascribe-dock-width", `${newWidth}px`);
        this.markdownView.contentEl.style.setProperty("--mediascribe-dock-width", `${newWidth}px`);
      }
    };

    const onMouseUp = async (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      handle.removeClass("is-dragging");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      const pos = this.settings.embeddedPosition || "top";
      if (pos === "top") {
        const delta = e.clientY - startY;
        const containerW = this.playerContainerEl?.clientWidth || window.innerWidth;
        const maxAllowedByWidth = Math.floor(containerW * 9 / 16);
        const maxH = Math.min(650, Math.floor(window.innerHeight * 0.85), Math.max(200, maxAllowedByWidth));
        const finalHeight = Math.max(160, Math.min(maxH, startH + delta));
        this.settings.embeddedPlayerHeight = Math.round(finalHeight);
      } else {
        let delta = 0;
        if (pos === "vertical_left") {
          delta = e.clientX - startX;
        } else {
          delta = startX - e.clientX;
        }
        const maxW = Math.floor(window.innerWidth * 0.65);
        const finalWidth = Math.max(280, Math.min(maxW, startW + delta));
        this.settings.embeddedDockWidth = Math.round(finalWidth);
      }
      await this.onSettingsChange(this.settings);
    };

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      startX = e.clientX;
      startH = parseInt(this.hostEl.style.getPropertyValue("--mediascribe-embed-height") || "", 10) || this.settings.embeddedPlayerHeight || 340;
      startW = parseInt(this.hostEl.style.getPropertyValue("--mediascribe-dock-width") || "", 10) || this.settings.embeddedDockWidth || 420;
      handle.addClass("is-dragging");
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  public updateSettings(settings: MediaScribeSettings): void {
    this.settings = settings;
    this.applyPositionStyles();
    this.ambientGlowService.setEnabled(settings.enableAmbientMode);
  }

  public getHostEl(): HTMLElement {
    return this.hostEl;
  }

  public uncollapse(): void {
    if (this.isCollapsed) {
      this.isCollapsed = false;
      this.hostEl.removeClass("is-collapsed");
    }
  }

  public destroy(): void {
    this.saveCurrentPosition();
    this.ambientGlowService.destroy();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.typingScribeService.setPlayer(null);
    this.markdownView.contentEl.removeClass(
      "mediascribe-dock-vertical",
      "mediascribe-dock-left",
      "mediascribe-dock-right"
    );
    this.hostEl.remove();
    this.onClose?.();
  }
}
