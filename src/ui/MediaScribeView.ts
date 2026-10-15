import { ItemView, MarkdownView, Menu, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
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
import { fetchYouTubeVideoMetadata } from "../utils/youtube";

export const VIEW_TYPE_MEDIASCREIBE = "mediascribe-view";

export class MediaScribeView extends ItemView {
  private plugin: any;
  private settings: MediaScribeSettings;
  private onSettingsChange: (settings: MediaScribeSettings) => Promise<void>;

  private player: IMediaPlayer | null = null;
  private currentSource: MediaSourceInfo | null = null;
  private originNotePath?: string;

  // Services
  private screenshotService: ScreenshotService;
  private timestampService: TimestampService;
  private typingScribeService: TypingScribeService;
  private transcriptService: TranscriptService;
  private ambientGlowService: AmbientGlowService = new AmbientGlowService();

  // UI Components
  private headerTitleEl: HTMLElement | null = null;
  private playerContainerEl: HTMLElement | null = null;
  private controlsEl: HTMLElement | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private timeDisplayEl: HTMLElement | null = null;
  private progressSlider: HTMLInputElement | null = null;
  private timelineMarkers: TimelineMarkers | null = null;
  private transcriptPanel: TranscriptPanel | null = null;
  private transcriptBtn: HTMLElement | null = null;
  private descriptionViewEl: HTMLElement | null = null;
  private descriptionBtn: HTMLElement | null = null;
  private loopBarEl: HTMLElement | null = null;
  private speedBtn: HTMLButtonElement | null = null;

  // State
  private currentTime: number = 0;
  private duration: number = 0;
  private isScrubbing: boolean = false;
  private loopA: number | null = null;
  private loopB: number | null = null;
  private isLooping: boolean = false;
  private isTranscriptVisible: boolean = false;
  private isDescriptionVisible: boolean = false;
  private currentDescription: string | null = null;
  private currentAuthor: string | null = null;
  private isLoadingDescription: boolean = false;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: any,
    settings: MediaScribeSettings,
    screenshotService: ScreenshotService,
    timestampService: TimestampService,
    typingScribeService: TypingScribeService,
    transcriptService: TranscriptService,
    onSettingsChange: (settings: MediaScribeSettings) => Promise<void>
  ) {
    super(leaf);
    this.plugin = plugin;
    this.settings = settings;
    this.screenshotService = screenshotService;
    this.timestampService = timestampService;
    this.typingScribeService = typingScribeService;
    this.transcriptService = transcriptService;
    this.onSettingsChange = onSettingsChange;
  }

  private returnPosition: EmbeddedPosition = "top";

  public setOriginNotePath(path?: string): void {
    this.originNotePath = path;
  }

  public setReturnPosition(pos: EmbeddedPosition): void {
    this.returnPosition = pos;
  }

  public getViewType(): string {
    return VIEW_TYPE_MEDIASCREIBE;
  }

  public getDisplayText(): string {
    return this.currentSource?.title || "MediaScribe Player";
  }

  public getIcon(): string {
    return "play-circle";
  }

  public getActivePlayer(): IMediaPlayer | null {
    return this.player;
  }

  public getCurrentSource(): MediaSourceInfo | null {
    return this.currentSource;
  }

  public async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("mediascribe-view-root");

    // 1. Header Toolbar
    this.buildHeader(container);

    // 2. Video Player Host
    this.playerContainerEl = container.createDiv({ cls: "mediascribe-player-container" });

    // 3. Media Controls Bar
    this.buildControls(container);

    // 4. A-B Loop Bar
    this.buildLoopBar(container);

    // 5. Transcript Panel
    this.transcriptPanel = new TranscriptPanel(container, this.app, () => this.player);
    this.transcriptPanel.setVisible(this.isTranscriptVisible);

    // 6. Description Panel
    this.descriptionViewEl = container.createDiv({ cls: "mediascribe-side-view mediascribe-description-view is-hidden" });
    this.renderDescriptionView();
  }

  public async loadMedia(source: MediaSourceInfo, forceReload: boolean = false): Promise<void> {
    if (!forceReload && this.currentSource && this.currentSource.url === source.url && this.player) {
      return; // Already playing this source
    }

    // Save previous playback position
    await this.saveCurrentPosition();

    // Clean up existing player
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    this.currentSource = source;
    if (this.headerTitleEl) {
      this.headerTitleEl.setText(source.title || (source.isLocal ? source.localFile?.name || "Local Media" : "Media Stream"));
    }

    // Retrieve saved position if enabled
    let startPosition = source.initialTime || 0;
    if (this.settings.rememberPlaybackPosition && this.settings.storedPlaybackPositions[source.url]) {
      startPosition = this.settings.storedPlaybackPositions[source.url];
    }

    // Create appropriate player
    if (!this.playerContainerEl) return;

    if (source.type === "youtube" && source.videoId) {
      this.player = new YouTubePlayer(
        source.videoId,
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

    // Load transcript if available
    this.loadTranscript(source);

    // Load description if available
    if (source.type === "youtube" && source.videoId) {
      this.fetchAndSetDescription(source.videoId);
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

      // Handle A-B Looping
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

    this.player.on("ended", () => {
      this.updatePlayState(false);
      this.saveCurrentPosition();
    });
  }

  private buildHeader(parentEl: HTMLElement): void {
    const header = parentEl.createDiv({ cls: "mediascribe-view-header" });

    const infoSection = header.createDiv({ cls: "mediascribe-header-info" });
    const iconSpan = infoSection.createSpan({ cls: "mediascribe-header-icon" });
    setIcon(iconSpan, "video");

    this.headerTitleEl = infoSection.createSpan({ cls: "mediascribe-header-title" });
    this.headerTitleEl.setText("No Media Loaded");

    const actions = header.createDiv({ cls: "mediascribe-header-actions" });

    // Open URL modal button
    const openUrlBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Open Media from URL or Vault File" }
    });
    setIcon(openUrlBtn, "link");
    openUrlBtn.addEventListener("click", () => this.promptForMedia());

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

    // Position / Layout Switcher Button
    const posBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Switch Position (Top, Vertical, Sidebar)" }
    });
    setIcon(posBtn, "layout");
    posBtn.addEventListener("click", (e: MouseEvent) => {
      this.showPositionMenu(e);
    });
  }

  private showPositionMenu(e: MouseEvent): void {
    const menu = new Menu();
    const isSidebar = this.leaf.getRoot() === this.app.workspace.rightSplit;

    menu.addItem((item) => {
      item.setTitle("Dock to Note (Top)")
        .setIcon("rows")
        .onClick(() => this.switchToEmbedded("top"));
    });

    menu.addItem((item) => {
      item.setTitle("Dock to Note (Vertical Right)")
        .setIcon("panel-right")
        .onClick(() => this.switchToEmbedded("vertical_right"));
    });

    menu.addItem((item) => {
      item.setTitle("Dock to Note (Vertical Left)")
        .setIcon("panel-left")
        .onClick(() => this.switchToEmbedded("vertical_left"));
    });

    menu.addItem((item) => {
      item.setTitle("Move to Right Sidebar")
        .setIcon("layout-sidebar-right")
        .setChecked(isSidebar)
        .onClick(async () => {
          if (!isSidebar) {
            const time = await this.player?.getCurrentTime() || 0;
            const wasPlaying = this.player?.isPlaying || false;
            const source = this.currentSource;
            if (source) {
              source.initialTime = time;
            }
            if (source && this.plugin) {
              await this.plugin.activateSidebarView(source, time, wasPlaying, "top");
            }
          }
        });
    });

    menu.showAtMouseEvent(e);
  }

  public async switchToEmbedded(pos?: EmbeddedPosition): Promise<void> {
    const targetPos = pos || this.returnPosition || "top";
    const time = await this.player?.getCurrentTime() || 0;
    const wasPlaying = this.player?.isPlaying || false;
    const source = this.currentSource;

    if (!source) {
      new Notice("MediaScribe: No media currently loaded.");
      return;
    }
    source.initialTime = time;

    // 1. Locate target markdown note in workspace
    let targetView = this.app.workspace.getActiveViewOfType(MarkdownView);

    // If we have a saved originNotePath, look for it or reopen it
    if (!targetView && this.originNotePath) {
      const originFile = this.app.vault.getAbstractFileByPath(this.originNotePath);
      if (originFile instanceof TFile) {
        const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
        for (const l of markdownLeaves) {
          if ((l.view as MarkdownView).file?.path === originFile.path) {
            targetView = l.view as MarkdownView;
            this.app.workspace.setActiveLeaf(l, { focus: true });
            break;
          }
        }
        if (!targetView) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(originFile);
          if (leaf.view instanceof MarkdownView) {
            targetView = leaf.view;
            this.app.workspace.setActiveLeaf(leaf, { focus: true });
          }
        }
      }
    }

    // If still not found, check open markdown leaves for the note with this media
    if (!targetView) {
      const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");

      // Match with local file
      if (source.localFile) {
        for (const l of markdownLeaves) {
          if ((l.view as MarkdownView).file?.path === source.localFile.path) {
            targetView = l.view as MarkdownView;
            this.app.workspace.setActiveLeaf(l, { focus: true });
            break;
          }
        }
      }

      // Match by checking if note frontmatter contains this media URL
      if (!targetView && this.plugin?.detector) {
        for (const l of markdownLeaves) {
          const mv = l.view as MarkdownView;
          if (mv.file) {
            const noteSource = this.plugin.detector.extractMediaFromNote(mv.file, this.settings.mediaPropertyNames);
            if (noteSource && noteSource.url === source.url) {
              targetView = mv;
              this.app.workspace.setActiveLeaf(l, { focus: true });
              break;
            }
          }
        }
      }

      // Fallback: pick the first markdown leaf in the root editor workspace
      if (!targetView && markdownLeaves.length > 0) {
        const rootLeaves = markdownLeaves.filter(l => l.getRoot() === this.app.workspace.rootSplit);
        const chosen = rootLeaves[0] || markdownLeaves[0];
        if (chosen && chosen.view instanceof MarkdownView) {
          targetView = chosen.view;
          this.app.workspace.setActiveLeaf(chosen, { focus: true });
        }
      }
    }

    if (!targetView) {
      new Notice("MediaScribe: Please open or focus a note in the editor to dock the player.");
      return;
    }

    // 2. Mount in embedded note FIRST so there is zero interruption
    if (this.plugin?.embeddedManager) {
      await this.plugin.embeddedManager.mountWithPosition(targetView, targetPos, time, wasPlaying, source);
      new Notice(`MediaScribe: Player docked to note (${targetPos === "top" ? "Top" : targetPos === "vertical_right" ? "Vertical Right" : "Vertical Left"}).`);
    }

    // 3. Detach sidebar leaf
    if (this.leaf.getRoot() === this.app.workspace.rightSplit) {
      this.leaf.detach();
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

    // Timeline Markers Bar
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

    // Insert Timestamp Button
    const timeBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Insert Current Timestamp into Note (Ctrl+I)" }
    });
    setIcon(timeBtn, "clock");
    timeBtn.addEventListener("click", () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      this.timestampService.insertCurrentTimestamp(activeView);
    });

    // Frame Screenshot Button
    const snapBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Capture Video Frame to Note (Ctrl+Shift+S)" }
    });
    setIcon(snapBtn, "camera");
    snapBtn.addEventListener("click", () => this.captureScreenshot());

    // Transcript Toggle (YouTube CC Style)
    this.transcriptBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-cc-btn",
      attr: { title: "Toggle Subtitles / Transcript Panel" }
    });
    setIcon(this.transcriptBtn, "subtitles");
    this.transcriptBtn.addEventListener("click", () => {
      this.toggleTranscript();
    });

    // Description Toggle Button
    this.descriptionBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Toggle Video Description & Notes" }
    });
    setIcon(this.descriptionBtn, "file-text");
    this.descriptionBtn.addEventListener("click", () => {
      this.toggleDescription();
    });

    // A-B Loop Toggle
    const loopBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "Toggle A-B Repeat Loop" }
    });
    setIcon(loopBtn, "repeat");
    loopBtn.addEventListener("click", () => {
      this.isLooping = !this.isLooping;
      loopBtn.toggleClass("is-active", this.isLooping);
      this.loopBarEl?.toggleClass("is-hidden", !this.isLooping);
    });
  }

  private toggleTranscript(): void {
    if (this.isTranscriptVisible) {
      this.isTranscriptVisible = false;
      this.transcriptBtn?.removeClass("is-active");
      this.transcriptPanel?.setVisible(false);
    } else {
      this.isTranscriptVisible = true;
      this.transcriptBtn?.addClass("is-active");
      this.transcriptPanel?.setVisible(true);

      // Mutually exclusive: close description
      if (this.isDescriptionVisible) {
        this.isDescriptionVisible = false;
        this.descriptionBtn?.removeClass("is-active");
        this.descriptionViewEl?.addClass("is-hidden");
      }
    }
  }

  private toggleDescription(): void {
    if (this.isDescriptionVisible) {
      this.isDescriptionVisible = false;
      this.descriptionBtn?.removeClass("is-active");
      this.descriptionViewEl?.addClass("is-hidden");
    } else {
      this.isDescriptionVisible = true;
      this.descriptionBtn?.addClass("is-active");
      this.descriptionViewEl?.removeClass("is-hidden");
      this.renderDescriptionView();

      // Mutually exclusive: close transcript
      if (this.isTranscriptVisible) {
        this.isTranscriptVisible = false;
        this.transcriptBtn?.removeClass("is-active");
        this.transcriptPanel?.setVisible(false);
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

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    await this.screenshotService.captureAndInsert(
      this.player,
      this.currentSource,
      activeView,
      this.playerContainerEl
    );
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

  private async saveCurrentPosition(): Promise<void> {
    if (!this.settings.rememberPlaybackPosition || !this.currentSource || this.currentTime <= 0) return;

    this.settings.storedPlaybackPositions[this.currentSource.url] = Math.floor(this.currentTime);
    await this.onSettingsChange(this.settings);
  }

  private promptForMedia(): void {
    // Quick prompt modal for URL or Vault path
    const prompt = window.prompt("Enter YouTube URL, Web Video/Audio URL, or Vault filename (e.g., lecture.mp4):");
    if (prompt && prompt.trim()) {
      const detector = (this.app as any).plugins.plugins.mediascribe?.detector;
      if (detector) {
        const info = detector.resolveSource(prompt.trim());
        if (info) {
          this.loadMedia(info);
        } else {
          new Notice("MediaScribe: Could not recognize media source.");
        }
      }
    }
  }

  public async onClose(): Promise<void> {
    await this.saveCurrentPosition();
    this.ambientGlowService.destroy();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.typingScribeService.setPlayer(null);
  }

  private async fetchAndSetDescription(videoId: string): Promise<void> {
    if (!videoId) return;
    this.isLoadingDescription = true;
    if (this.descriptionViewEl && this.isDescriptionVisible) {
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
          if (this.headerTitleEl) {
            this.headerTitleEl.setText(meta.title);
          }
        }
      } else {
        this.currentDescription = "Could not load description.";
      }
    } catch {
      this.currentDescription = "Failed to load description.";
    } finally {
      this.isLoadingDescription = false;
      if (this.descriptionViewEl && this.isDescriptionVisible) {
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

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = activeView?.editor;
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
}
