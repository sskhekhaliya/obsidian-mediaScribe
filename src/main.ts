import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, IMediaPlayer, MediaScribeSettings, MediaSourceInfo } from "./types";
import { MediaScribeSettingTab } from "./settings";
import { MediaDetector } from "./services/mediaDetector";
import { ScreenshotService } from "./services/screenshotService";
import { TimestampService } from "./services/timestampService";
import { TypingScribeService } from "./services/typingScribeService";
import { TranscriptService } from "./services/transcriptService";
import { EmbeddedPlayerManager } from "./services/embeddedPlayerManager";
import { MediaScribeView, VIEW_TYPE_MEDIASCREIBE } from "./ui/MediaScribeView";
import { extractTimestampsFromText, formatSeconds, parseTimestamp } from "./utils/time";

export default class MediaScribePlugin extends Plugin {
  public settings: MediaScribeSettings = DEFAULT_SETTINGS;
  public detector!: MediaDetector;
  public screenshotService!: ScreenshotService;
  public timestampService!: TimestampService;
  public typingScribeService!: TypingScribeService;
  public transcriptService!: TranscriptService;
  public embeddedManager!: EmbeddedPlayerManager;

  public async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize Services
    this.detector = new MediaDetector(this.app);
    this.screenshotService = new ScreenshotService(this.app, this.settings);
    this.typingScribeService = new TypingScribeService(this.app, this.settings);
    this.transcriptService = new TranscriptService(this.app);

    this.timestampService = new TimestampService(
      this.app,
      this.settings,
      () => this.getActivePlayer()
    );

    this.embeddedManager = new EmbeddedPlayerManager(
      this,
      this.app,
      this.settings,
      this.detector,
      this.screenshotService,
      this.timestampService,
      this.typingScribeService,
      this.transcriptService,
      async (newSettings) => {
        this.settings = newSettings;
        await this.saveSettings();
      }
    );

    // Register View
    this.registerView(
      VIEW_TYPE_MEDIASCREIBE,
      (leaf) =>
        new MediaScribeView(
          leaf,
          this,
          this.settings,
          this.screenshotService,
          this.timestampService,
          this.typingScribeService,
          this.transcriptService,
          async (newSettings) => {
            this.settings = newSettings;
            await this.saveSettings();
          }
        )
    );

    // Register Ribbon Icon
    this.addRibbonIcon("play-circle", "MediaScribe: Toggle / Open Player", async () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const activeFile = activeView?.file;
      if (activeFile && this.settings.autoEmbedInNote) {
        const source = this.detector.extractMediaFromNote(activeFile, this.settings.mediaPropertyNames);
        if (source) {
          await this.embeddedManager.toggleActiveView();
          return;
        }
      }
      this.activateView();
    });

    // Register Commands
    this.registerPluginCommands();

    // Register Global Click Handler for Timestamps
    this.registerTimestampClickHandler();

    // Register Markdown Post-Processor to style timestamps
    this.setupMarkdownPostProcessor();

    // Register Typing Scribe Auto-Pause
    this.registerEvent(
      this.app.workspace.on("editor-change", () => {
        this.typingScribeService.handleEditorChange();
      })
    );

    // Auto-embed or update on file-open
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          this.embeddedManager.syncView(view);
        }
        if (file instanceof TFile) {
          this.checkAndSyncActiveNoteMedia(file);
        }
      })
    );

    // Auto-embed on frontmatter change (debounced to avoid re-triggering while typing)
    let metaDebounce: number | null = null;
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (metaDebounce !== null) window.clearTimeout(metaDebounce);
        metaDebounce = window.setTimeout(() => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view && view.file?.path === file.path) {
            this.embeddedManager.syncView(view);
          }
        }, 400);
      })
    );

    // Layout sync
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.embeddedManager.syncActiveView();
      })
    );

    // Initial sync
    this.app.workspace.onLayoutReady(() => {
      this.embeddedManager.syncActiveView();
    });

    // Add Settings Tab
    this.addSettingTab(new MediaScribeSettingTab(this.app, this));
  }

  public async onunload(): Promise<void> {
    this.embeddedManager.destroyAll();
    this.typingScribeService.destroy();
  }

  public async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.screenshotService.updateSettings(this.settings);
    this.timestampService.updateSettings(this.settings);
    this.typingScribeService.updateSettings(this.settings);
    this.embeddedManager.updateSettings(this.settings);
  }

  /**
   * Retrieves whichever player is active (embedded in current note, or in sidebar)
   */
  public getActivePlayer(): IMediaPlayer | null {
    const embedded = this.embeddedManager.getActiveEmbeddedPlayer();
    if (embedded) return embedded;
    return this.getActivePlayerView()?.getActivePlayer() || null;
  }

  /**
   * Finds the active MediaScribeView leaf
   */
  public getActivePlayerView(): MediaScribeView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MEDIASCREIBE);
    for (const leaf of leaves) {
      if (leaf.view instanceof MediaScribeView) {
        return leaf.view;
      }
    }
    return null;
  }

  /**
   * Activates or opens the MediaScribe view in workspace
   */
  public async activateView(mediaSource?: MediaSourceInfo): Promise<MediaScribeView> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_MEDIASCREIBE);

    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      if (this.settings.defaultLayout === "split_horizontal") {
        leaf = workspace.getLeaf("split", "horizontal");
      } else if (this.settings.defaultLayout === "split_vertical") {
        leaf = workspace.getLeaf("split", "vertical");
      } else {
        leaf = workspace.getRightLeaf(false);
      }
      await leaf?.setViewState({ type: VIEW_TYPE_MEDIASCREIBE, active: true });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      const view = leaf.view as MediaScribeView;
      if (mediaSource) {
        await view.loadMedia(mediaSource);
      }
      return view;
    }

    throw new Error("Could not create MediaScribe leaf.");
  }

  /**
   * Activates the MediaScribe player in the right sidebar
   */
  public async activateSidebarView(
    mediaSource?: MediaSourceInfo,
    startTime: number = 0,
    wasPlaying: boolean = false,
    returnPos: "top" | "vertical_right" | "vertical_left" = "top",
    originNotePath?: string
  ): Promise<MediaScribeView> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_MEDIASCREIBE);

    for (const l of existing) {
      if (l.getRoot() === workspace.rightSplit) {
        leaf = l;
        break;
      }
    }

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_MEDIASCREIBE, active: true });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      const view = leaf.view as MediaScribeView;
      if (originNotePath) {
        view.setOriginNotePath(originNotePath);
      }
      if (returnPos) {
        view.setReturnPosition(returnPos);
      }
      if (mediaSource) {
        await view.loadMedia(mediaSource, true);
        const player = view.getActivePlayer();
        if (player) {
          if (startTime > 0) player.seekTo(startTime);
          if (wasPlaying) player.play();
        }
      }
      return view;
    }

    throw new Error("Could not create MediaScribe sidebar leaf.");
  }



  private async checkAndSyncActiveNoteMedia(file: TFile): Promise<void> {
    const playerView = this.getActivePlayerView();
    if (!playerView) return;

    const source = this.detector.extractMediaFromNote(file, this.settings.mediaPropertyNames);
    if (source && (!playerView.getCurrentSource() || playerView.getCurrentSource()?.url !== source.url)) {
      await playerView.loadMedia(source);
    }
  }

  private registerPluginCommands(): void {
    // 0. Toggle / Reopen Media Player for Active Note
    this.addCommand({
      id: "mediascribe-toggle-embedded-player",
      name: "Toggle / Reopen media player for active note",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.file) {
          const source = this.detector.extractMediaFromNote(view.file, this.settings.mediaPropertyNames);
          if (source) {
            if (!checking) {
              this.embeddedManager.toggleActiveView();
            }
            return true;
          }
        }
        return false;
      }
    });

    // 1. Open Media for Active Note (Embed or Sidebar)
    this.addCommand({
      id: "mediascribe-open-active-note-media",
      name: "Open media for active note",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (!checking) {
            const source = this.detector.extractMediaFromNote(file, this.settings.mediaPropertyNames);
            if (source) {
              const view = this.app.workspace.getActiveViewOfType(MarkdownView);
              if (view) {
                this.embeddedManager.reopenView(view);
              } else {
                this.activateView(source);
              }
            } else {
              new Notice("MediaScribe: No media property found in note frontmatter (e.g. media_link).");
            }
          }
          return true;
        }
        return false;
      }
    });

    // 2. Open Media from Custom URL or Vault File
    this.addCommand({
      id: "mediascribe-open-custom-media",
      name: "Open media from URL or Vault file...",
      callback: () => {
        const input = window.prompt("Enter YouTube URL, web media link, or Vault filename:");
        if (input && input.trim()) {
          const source = this.detector.resolveSource(input.trim());
          if (source) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (this.settings.autoEmbedInNote && view) {
              this.embeddedManager.syncView(view);
            } else {
              this.activateView(source);
            }
          } else {
            new Notice("MediaScribe: Invalid or unsupported media source.");
          }
        }
      }
    });

    // 3. Play / Pause
    this.addCommand({
      id: "mediascribe-toggle-play",
      name: "Play / Pause",
      hotkeys: [{ modifiers: ["Mod"], key: "k" }],
      callback: () => {
        const player = this.getActivePlayer();
        player?.togglePlay();
      }
    });

    // 4. Jump Backward
    this.addCommand({
      id: "mediascribe-jump-backward",
      name: `Jump backward ${this.settings.jumpStepSeconds}s`,
      hotkeys: [{ modifiers: ["Mod"], key: "j" }],
      callback: () => {
        const player = this.getActivePlayer();
        player?.jump(-this.settings.jumpStepSeconds);
      }
    });

    // 5. Jump Forward
    this.addCommand({
      id: "mediascribe-jump-forward",
      name: `Jump forward ${this.settings.jumpStepSeconds}s`,
      hotkeys: [{ modifiers: ["Mod"], key: "l" }],
      callback: () => {
        const player = this.getActivePlayer();
        player?.jump(this.settings.jumpStepSeconds);
      }
    });

    // 6. Next Video (Playlist)
    this.addCommand({
      id: "mediascribe-next-video",
      name: "Next video in playlist",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "n" }],
      callback: () => {
        const player = this.getActivePlayer();
        if (player?.nextVideo) {
          player.nextVideo();
        } else {
          new Notice("MediaScribe: Next video control not available.");
        }
      }
    });

    // 7. Previous Video (Playlist)
    this.addCommand({
      id: "mediascribe-previous-video",
      name: "Previous video in playlist",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "p" }],
      callback: () => {
        const player = this.getActivePlayer();
        if (player?.previousVideo) {
          player.previousVideo();
        } else {
          new Notice("MediaScribe: Previous video control not available.");
        }
      }
    });

    // 8. Insert Timestamp at Cursor
    this.addCommand({
      id: "mediascribe-insert-timestamp",
      name: "Insert current timestamp into note",
      hotkeys: [{ modifiers: ["Mod"], key: "i" }],
      editorCallback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        this.timestampService.insertCurrentTimestamp(view);
      }
    });

    // 9. Capture Video Frame Screenshot
    this.addCommand({
      id: "mediascribe-capture-frame",
      name: "Capture video frame screenshot into note",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "s" }],
      callback: () => {
        const embedded = this.embeddedManager.getActiveEmbeddedWidget();
        if (embedded) {
          embedded.captureScreenshot();
          return;
        }
        const view = this.getActivePlayerView();
        view?.captureScreenshot();
      }
    });

    // 10. Toggle Auto-Pause Typing Scribe
    this.addCommand({
      id: "mediascribe-toggle-typing-scribe",
      name: "Toggle Auto-Pause while typing (Typing Scribe)",
      callback: () => {
        this.typingScribeService.toggle();
      }
    });
  }

  private registerTimestampClickHandler(): void {
    this.registerDomEvent(document, "click", (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target) return;

      // 1. Custom MediaScribe timestamp link (e.g. from transcript panel or pill)
      if (target.classList.contains("mediascribe-timestamp-link")) {
        evt.preventDefault();
        evt.stopPropagation();
        const text = target.getAttribute("data-timestamp") || target.innerText;
        this.handleTimestampJump(text);
        return;
      }

      // 2. Reading View / Standard Anchor tag (e.g. <a href="#t=16">00:16</a>)
      const anchor = target.closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        const text = anchor.innerText.trim();

        if (href.startsWith("#t=") || parseTimestamp(href) !== null || parseTimestamp(text) !== null) {
          evt.preventDefault();
          evt.stopPropagation();
          this.handleTimestampJump(href || text);
          return;
        }
      }

      // 3. Live Preview / CodeMirror 6 Editor
      // Check if user clicked on a link span (.cm-link, .cm-url, .cm-hmd-internal-link, .cm-formatting-link)
      const linkEl = target.closest(".cm-link, .cm-url, .cm-hmd-internal-link, .cm-formatting-link");
      if (linkEl) {
        const text = linkEl.textContent?.trim() || "";
        const sec = parseTimestamp(text);
        if (sec !== null) {
          evt.preventDefault();
          evt.stopPropagation();
          this.handleTimestampJump(text);
          return;
        }

        // If clicked on bracket/parenthesis or (#t=...), inspect line context
        const cmLine = target.closest(".cm-line");
        if (cmLine) {
          const lineText = cmLine.textContent || "";
          const timestamps = extractTimestampsFromText(lineText);
          if (timestamps.length > 0) {
            evt.preventDefault();
            evt.stopPropagation();
            this.handleTimestampJump(timestamps[0].displayText);
            return;
          }
        }
      }

      // 4. Fallback for any click directly on a timestamp within editor line
      const cmLine = target.closest(".cm-line");
      if (cmLine) {
        const directText = target.textContent?.trim() || "";
        const sec = parseTimestamp(directText);
        if (sec !== null) {
          evt.preventDefault();
          evt.stopPropagation();
          this.handleTimestampJump(directText);
          return;
        }
      }
    }, true);
  }

  private handleTimestampJump(text: string): boolean {
    const seconds = parseTimestamp(text);
    if (seconds === null) return false;

    // Check if an embedded player or sidebar player is active
    const embedded = this.embeddedManager.getActiveEmbeddedWidget();
    if (embedded) {
      embedded.uncollapse();
    }

    const player = this.getActivePlayer();
    if (player) {
      player.seekTo(seconds);
      player.play();
      new Notice(`MediaScribe: Jumped to ${formatSeconds(seconds)}`);
      return true;
    }

    // If player was closed, reopen it for the active note!
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file) {
      const source = this.detector.extractMediaFromNote(activeView.file, this.settings.mediaPropertyNames);
      if (source) {
        this.embeddedManager.reopenView(activeView, seconds);
        new Notice(`MediaScribe: Reopened player at ${formatSeconds(seconds)}`);
        return true;
      }
    }

    return false;
  }

  private setupMarkdownPostProcessor(): void {
    this.registerMarkdownPostProcessor((el: HTMLElement) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodesToReplace: { node: Text; parent: Node }[] = [];

      let currentNode: Text | null = null;
      while ((currentNode = walker.nextNode() as Text)) {
        if (/\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(currentNode.nodeValue || "")) {
          if (currentNode.parentElement && !currentNode.parentElement.closest(".mediascribe-timestamp-link")) {
            nodesToReplace.push({ node: currentNode, parent: currentNode.parentNode! });
          }
        }
      }

      for (const item of nodesToReplace) {
        const val = item.node.nodeValue || "";
        const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
        let lastIdx = 0;
        let match: RegExpExecArray | null;

        const frag = document.createDocumentFragment();

        while ((match = regex.exec(val)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
          }

          const pill = document.createElement("span");
          pill.className = "mediascribe-timestamp-link";
          pill.setAttribute("data-timestamp", match[1]);
          pill.innerText = `⏱️ ${match[1]}`;
          frag.appendChild(pill);

          lastIdx = regex.lastIndex;
        }

        if (lastIdx < val.length) {
          frag.appendChild(document.createTextNode(val.substring(lastIdx)));
        }

        item.parent.replaceChild(frag, item.node);
      }
    });
  }
}
