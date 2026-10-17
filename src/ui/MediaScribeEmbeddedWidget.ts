import { App, MarkdownView, Menu, Notice, normalizePath, setIcon } from "obsidian";
import { EmbeddedPosition, IMediaPlayer, MediaScribeSettings, MediaSourceInfo, PlaylistItem, StoredSidePanelState } from "../types";
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
import { fetchYouTubeTitle, fetchYouTubeVideoMetadata, fetchYouTubePlaylistItems, getCachedYouTubeTitle } from "../utils/youtube";

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
  private onPlay?: () => void;

  // Description & Creator Info
  private currentDescription: string | null = null;
  private currentAuthor: string | null = null;
  private isLoadingDescription: boolean = false;

  // Side Panel Elements
  private playerAreaEl: HTMLElement | null = null;
  private resizeHandleEl: HTMLElement | null = null;
  private sidePanelEl: HTMLElement | null = null;
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
    onClose?: () => void,
    onPlay?: () => void
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
    this.onPlay = onPlay;

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

    this.updateSidePanelPosition();
  }

  private updateSidePanelPosition(): void {
    if (!this.sidePanelEl) return;
    const pos = this.settings.embeddedPosition || "top";
    if (pos === "top") {
      if (this.playerAreaEl && this.sidePanelEl.parentElement !== this.playerAreaEl) {
        this.playerAreaEl.appendChild(this.sidePanelEl);
      }
    } else {
      // In vertical note mode (vertical_left / vertical_right):
      // Place side panel below all controls (before resize handle)
      if (this.resizeHandleEl && this.sidePanelEl.nextSibling !== this.resizeHandleEl) {
        this.hostEl.insertBefore(this.sidePanelEl, this.resizeHandleEl);
      } else if (!this.resizeHandleEl && this.sidePanelEl.parentElement !== this.hostEl) {
        this.hostEl.appendChild(this.sidePanelEl);
      }
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

  public async loadMedia(source: MediaSourceInfo, autoPlay: boolean = false): Promise<void> {
    if (this.currentSource && this.currentSource.url === source.url && this.currentSource.videoId === source.videoId && this.player) {
      return;
    }

    await this.saveCurrentPosition();

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    if (source.isPlaylist && source.playlistItems && source.videoId) {
      const idx = source.playlistItems.findIndex((it) => it.videoId === source.videoId);
      if (idx !== -1) {
        source.playlistIndex = idx;
      }
    }

    this.currentSource = source;
    this.playlistIndex = typeof source.playlistIndex === "number" && source.playlistIndex >= 0 ? source.playlistIndex : 0;

    if (!source.title && source.videoId) {
      const cachedTitle = getCachedYouTubeTitle(source.videoId);
      if (cachedTitle) {
        source.title = cachedTitle;
      }
    }

    this.updateHeaderInfo();

    let startPosition = source.initialTime || 0;
    if (this.settings.rememberPlaybackPosition) {
      if (source.videoId && this.settings.storedPlaybackPositions[source.videoId]) {
        startPosition = this.settings.storedPlaybackPositions[source.videoId];
      } else if (source.url && this.settings.storedPlaybackPositions[source.url]) {
        startPosition = this.settings.storedPlaybackPositions[source.url];
      }
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
        Boolean(source.isShorts),
        autoPlay
      );
    } else {
      const isAudio = source.type === "html5_audio";
      this.player = new HTML5Player(source.url, isAudio, startPosition);
      if (autoPlay) {
        this.player.play();
      }
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
    this.restoreSidePanelState(source);
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

            // Prioritize matching playlist item by videoId if present
            if (source.videoId) {
              const matchedIdx = items.findIndex((it) => it.videoId === source.videoId);
              if (matchedIdx !== -1) {
                this.playlistIndex = matchedIdx;
                source.playlistIndex = matchedIdx;
              }
            } else if (typeof source.playlistIndex === "number" && items[source.playlistIndex]?.videoId) {
              this.playlistIndex = source.playlistIndex;
              source.videoId = items[this.playlistIndex].videoId;
              if (this.player && "setVideoId" in this.player) {
                (this.player as any).setVideoId(source.videoId);
              }
            } else if (items[0]?.videoId) {
              this.playlistIndex = 0;
              source.videoId = items[0].videoId;
              if (this.player && "setVideoId" in this.player) {
                (this.player as any).setVideoId(source.videoId);
              }
            }

            if (items[this.playlistIndex]?.title) {
              source.title = items[this.playlistIndex].title;
            }
            this.updateHeaderInfo();
            this.updatePlaylistUI();
          }
        });
      } else if (source.playlistItems && source.playlistItems.length > 0) {
        if (source.videoId) {
          const matchedIdx = source.playlistItems.findIndex((it) => it.videoId === source.videoId);
          if (matchedIdx !== -1) {
            this.playlistIndex = matchedIdx;
            source.playlistIndex = matchedIdx;
            if (source.playlistItems[matchedIdx]?.title) {
              source.title = source.playlistItems[matchedIdx].title;
            }
            this.updateHeaderInfo();
            this.updatePlaylistUI();
          }
        }
        this.resolveYouTubeTitles(source);
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
    this.playerAreaEl = playerArea;
    this.playerContainerEl = playerArea.createDiv({ cls: "mediascribe-player-container" });
    this.buildSidePanel(playerArea);

    // 3. Media Controls
    this.buildControls(this.hostEl);

    // 4. A-B Loop Bar
    this.buildLoopBar(this.hostEl);

    // 5. Draggable Resize Handle
    this.buildResizeHandle(this.hostEl);

    // Ensure side panel is properly positioned (in playerArea for top, or below controls for vertical)
    this.updateSidePanelPosition();
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

    menu.showAtMouseEvent(e);
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

    // Content container taking full space without any header or tab bar
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
  }

  public openSideTab(tab: "playlist" | "transcript" | "description", skipSave: boolean = false): void {
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

    this.playlistToggleBtn?.toggleClass("is-active", tab === "playlist");
    this.transcriptBtn?.toggleClass("is-active", tab === "transcript");
    this.descriptionBtn?.toggleClass("is-active", tab === "description");
    this.descriptionCtrlBtn?.toggleClass("is-active", tab === "description");

    if (tab === "transcript") {
      this.transcriptPanel?.setVisible(true);
    } else if (tab === "description") {
      this.renderDescriptionView();
    }

    if (!skipSave) {
      this.saveSidePanelState();
    }
  }

  public closeSidePanel(skipSave: boolean = false): void {
    this.isSidePanelOpen = false;
    this.sidePanelEl?.addClass("is-hidden");
    if (this.sidePanelEl) {
      this.sidePanelEl.style.display = "none";
    }
    this.playlistToggleBtn?.removeClass("is-active");
    this.transcriptBtn?.removeClass("is-active");
    this.descriptionBtn?.removeClass("is-active");
    this.descriptionCtrlBtn?.removeClass("is-active");

    if (!skipSave) {
      this.saveSidePanelState();
    }
  }

  public toggleSideTab(tab: "playlist" | "transcript" | "description"): void {
    if (this.isSidePanelOpen && this.activeSideTab === tab) {
      this.closeSidePanel();
    } else {
      this.openSideTab(tab);
    }
  }

  private async saveSidePanelState(): Promise<void> {
    if (!this.settings.rememberSidePanelState || !this.currentSource) return;
    if (!this.settings.storedSidePanelStates) {
      this.settings.storedSidePanelStates = {};
    }

    const state: StoredSidePanelState = {
      isOpen: this.isSidePanelOpen,
      activeTab: this.activeSideTab,
      lastAccessed: Date.now()
    };

    if (this.currentSource.url) {
      this.settings.storedSidePanelStates[this.currentSource.url] = state;
    }
    if (this.currentSource.videoId) {
      this.settings.storedSidePanelStates[this.currentSource.videoId] = state;
    }
    if (this.currentSource.playlistId) {
      this.settings.storedSidePanelStates[`playlist:${this.currentSource.playlistId}`] = state;
    }

    await this.onSettingsChange(this.settings);
  }

  private restoreSidePanelState(source: MediaSourceInfo): void {
    if (!this.settings.rememberSidePanelState || !this.settings.storedSidePanelStates) {
      this.closeSidePanel(true);
      return;
    }

    const saved =
      (source.videoId && this.settings.storedSidePanelStates[source.videoId]) ||
      (source.url && this.settings.storedSidePanelStates[source.url]) ||
      (source.playlistId && this.settings.storedSidePanelStates[`playlist:${source.playlistId}`]);

    if (saved && saved.isOpen) {
      saved.lastAccessed = Date.now();
      let targetTab = saved.activeTab || "playlist";
      if (targetTab === "playlist" && !source.isPlaylist && !source.playlistId) {
        targetTab = "transcript";
      }
      this.openSideTab(targetTab, true);
    } else if (this.isSidePanelOpen) {
      this.openSideTab(this.activeSideTab, true);
    } else {
      if (saved) {
        saved.lastAccessed = Date.now();
      }
      this.closeSidePanel(true);
    }
  }

  private updateSidePanelTabs(): void {
    // Tabs removed to maximize reading space; toggled directly from controls
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

        row.setAttribute("title", `${item.title}\n(Right-click for options)`);

        row.addEventListener("click", () => {
          this.switchPlaylistItem(idx);
        });

        row.addEventListener("contextmenu", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          const menu = new Menu();

          menu.addItem((menuItem) => {
            menuItem
              .setTitle("Create Note for Video")
              .setIcon("file-plus")
              .onClick(() => {
                this.createNoteForPlaylistItem(item);
              });
          });

          menu.addItem((menuItem) => {
            menuItem
              .setTitle("Play Video")
              .setIcon("play")
              .onClick(() => {
                this.switchPlaylistItem(idx);
              });
          });

          menu.addItem((menuItem) => {
            menuItem
              .setTitle("Copy Video URL")
              .setIcon("copy")
              .onClick(async () => {
                await navigator.clipboard.writeText(item.source.url);
                new Notice("MediaScribe: Video URL copied to clipboard.");
              });
          });

          menu.showAtMouseEvent(e);
        });
      });

      window.requestAnimationFrame(() => {
        const activeRow = listEl.querySelector(".mediascribe-playlist-row.is-active") as HTMLElement;
        if (activeRow) {
          const itemRect = activeRow.getBoundingClientRect();
          const containerRect = listEl.getBoundingClientRect();
          if (itemRect.bottom > containerRect.bottom - 70) {
            const diff = itemRect.bottom - (containerRect.bottom - 70);
            listEl.scrollBy({ top: diff, behavior: "smooth" });
          } else if (itemRect.top < containerRect.top + 30) {
            const diff = itemRect.top - (containerRect.top + 30);
            listEl.scrollBy({ top: diff, behavior: "smooth" });
          }
        }
      });
    } else if (this.currentSource?.type === "youtube" && this.currentSource.playlistId) {
      const info = listEl.createDiv({ cls: "mediascribe-playlist-info" });
      info.setText("YouTube Playlist Active. Use Previous (⏮️) and Next (⏭️) buttons to navigate between videos.");
    }
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[*"\\/<>:|?#^[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async createNoteForPlaylistItem(item: PlaylistItem): Promise<void> {
    try {
      // 1. Determine target directory
      let targetFolder = "";
      if (this.settings.playlistNoteFolderLocation === "specific_folder" && this.settings.playlistNoteSpecificFolder?.trim()) {
        targetFolder = normalizePath(this.settings.playlistNoteSpecificFolder.trim());
      } else {
        targetFolder = this.markdownView.file?.parent?.path || "";
      }

      if (targetFolder && targetFolder !== "/" && targetFolder !== ".") {
        const folderExists = this.app.vault.getAbstractFileByPath(targetFolder);
        if (!folderExists) {
          await this.app.vault.createFolder(targetFolder);
        }
      } else {
        targetFolder = "";
      }

      // 2. Generate clean filename
      const cleanTitle = this.sanitizeFileName(item.title) || (item.source.videoId ? `Video ${item.source.videoId}` : "Playlist Video");
      let filePath = targetFolder ? `${targetFolder}/${cleanTitle}.md` : `${cleanTitle}.md`;
      filePath = normalizePath(filePath);

      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(filePath)) {
        filePath = targetFolder
          ? normalizePath(`${targetFolder}/${cleanTitle} (${counter}).md`)
          : normalizePath(`${cleanTitle} (${counter}).md`);
        counter++;
      }

      // 3. Format frontmatter
      const propertyKey = this.settings.playlistNoteProperty?.trim() || "video_link";
      const fileContent = `---\n${propertyKey}: "${item.source.url}"\n---\n`;

      // 4. Create the file
      const newFile = await this.app.vault.create(filePath, fileContent);
      new Notice(`MediaScribe: Created note "${newFile.basename}"`);

      // 5. Open the newly created note in a workspace leaf
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(newFile);
    } catch (err: any) {
      console.error("[MediaScribe] Failed to create note for playlist item:", err);
      new Notice(`MediaScribe: Failed to create note: ${err?.message || err}`);
    }
  }

  private updatePlaylistUI(): void {
    const isPlaylist = Boolean(this.currentSource?.isPlaylist);
    this.prevVideoBtn?.toggleClass("is-hidden", !isPlaylist);
    this.nextVideoBtn?.toggleClass("is-hidden", !isPlaylist);
    this.renderPlaylistItems();
    this.updateSidePanelTabs();
  }

  private async switchPlaylistItem(idx: number): Promise<void> {
    if (!this.currentSource?.playlistItems || !this.currentSource.playlistItems[idx]) return;

    // 1. Save current video position before navigating away
    await this.saveCurrentPosition();

    const selectedItem = this.currentSource.playlistItems[idx];
    if (!selectedItem) return;

    const targetVideoId = selectedItem.videoId || selectedItem.source?.videoId;
    const targetUrl = selectedItem.source?.url;

    // 2. Look up saved position for target video
    let resumeTime = 0;
    if (this.settings.rememberPlaybackPosition) {
      if (targetVideoId && typeof this.settings.storedPlaybackPositions?.[targetVideoId] === "number") {
        resumeTime = this.settings.storedPlaybackPositions[targetVideoId];
      } else if (targetUrl && typeof this.settings.storedPlaybackPositions?.[targetUrl] === "number") {
        resumeTime = this.settings.storedPlaybackPositions[targetUrl];
      }
    }

    // 3. Construct new source with target saved position
    const newSource: MediaSourceInfo = {
      ...(selectedItem.source || {}),
      type: "youtube",
      url: targetUrl || (targetVideoId ? `https://www.youtube.com/watch?v=${targetVideoId}` : this.currentSource.url),
      originalInput: targetUrl || this.currentSource.originalInput,
      videoId: targetVideoId,
      title: selectedItem.title || selectedItem.source?.title,
      initialTime: resumeTime,
      isPlaylist: true,
      playlistIndex: idx,
      playlistItems: this.currentSource.playlistItems,
      playlistId: this.currentSource.playlistId,
      isLocal: false
    };

    // 4. Reload player cleanly starting at the saved position (identical to closing and reopening note)
    await this.loadMedia(newSource, true);
  }

  private async handleNextVideo(): Promise<void> {
    if (!this.currentSource) return;
    if (!this.currentSource.playlistItems && this.currentSource.playlistId) {
      const items = await fetchYouTubePlaylistItems(this.currentSource.playlistId);
      if (items && items.length > 0) {
        this.currentSource.playlistItems = items;
      }
    }
    if (this.currentSource.playlistItems && this.currentSource.playlistItems.length > 0) {
      if (this.playlistIndex < this.currentSource.playlistItems.length - 1) {
        await this.switchPlaylistItem(this.playlistIndex + 1);
      }
    }
  }

  private async handlePreviousVideo(): Promise<void> {
    if (!this.currentSource) return;
    if (!this.currentSource.playlistItems && this.currentSource.playlistId) {
      const items = await fetchYouTubePlaylistItems(this.currentSource.playlistId);
      if (items && items.length > 0) {
        this.currentSource.playlistItems = items;
      }
    }
    if (this.currentSource.playlistItems && this.currentSource.playlistItems.length > 0) {
      if (this.playlistIndex > 0) {
        await this.switchPlaylistItem(this.playlistIndex - 1);
      }
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
      this.onPlay?.();
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
      if (idx < 0) return;
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
    if (!this.settings.rememberPlaybackPosition || !this.currentSource) return;

    if (this.player) {
      try {
        const pTime = await this.player.getCurrentTime();
        if (typeof pTime === "number" && pTime > 0) {
          this.currentTime = pTime;
        }
      } catch {}
    }

    if (this.currentTime <= 0) return;
    const time = Math.floor(this.currentTime);

    if (!this.settings.storedPlaybackPositions) {
      this.settings.storedPlaybackPositions = {};
    }
    if (this.currentSource.url) {
      this.settings.storedPlaybackPositions[this.currentSource.url] = time;
    }
    if (this.currentSource.videoId) {
      this.settings.storedPlaybackPositions[this.currentSource.videoId] = time;
    }
    if (!this.settings.storedPlaybackLastAccessed) {
      this.settings.storedPlaybackLastAccessed = {};
    }
    const now = Date.now();
    if (this.currentSource.url) {
      this.settings.storedPlaybackLastAccessed[this.currentSource.url] = now;
    }
    if (this.currentSource.videoId) {
      this.settings.storedPlaybackLastAccessed[this.currentSource.videoId] = now;
    }
    await this.onSettingsChange(this.settings);
  }

  private buildResizeHandle(parentEl: HTMLElement): void {
    const handle = parentEl.createDiv({ cls: "mediascribe-resize-handle" });
    this.resizeHandleEl = handle;

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
