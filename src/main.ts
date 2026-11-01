import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { DEFAULT_SETTINGS, IMediaPlayer, MediaScribeSettings, MediaSourceInfo } from "./types";
import { MediaScribeSettingTab } from "./settings";
import { MediaDetector } from "./services/mediaDetector";
import { ScreenshotService } from "./services/screenshotService";
import { TimestampService } from "./services/timestampService";
import { TypingScribeService } from "./services/typingScribeService";
import { TranscriptService } from "./services/transcriptService";
import { EmbeddedPlayerManager } from "./services/embeddedPlayerManager";
import { extractTimestampsFromText, formatSeconds, parseTimestamp, parseTimestampRange } from "./utils/time";
import { setDynamicTooltip } from "./utils/hotkey";

function isOfficialTimestampLink(a: HTMLAnchorElement): boolean {
  const href = a.getAttribute("href") || "";
  const dataHref = a.getAttribute("data-href") || "";
  const text = a.textContent?.trim() || "";

  // If href is explicitly empty "" or "#" or "()", it's [text]()
  if (href === "" || href === "#" || href === "()" || href.endsWith("#")) return true;

  // If href or dataHref contains explicit #t= or is an external URL, it's [text](url) or [[#t=...|text]]
  if (href.startsWith("#t=") || dataHref.startsWith("#t=") || href.startsWith("http://") || href.startsWith("https://")) return true;

  // If href is non-empty and DIFFERENT from text (e.g. [5:30](utr)), it's [text](url)
  if (href && href !== text && decodeURI(href) !== text && !a.classList.contains("is-unresolved")) return true;

  // Otherwise, if href === text (or dataHref === text, or class is-unresolved), it was written as bare [text]
  return false;
}

function getTimestampFromLinkElement(linkEl: Element, cmLine: Element): { type: "range"; start: number; end: number } | { type: "single"; text: string } | null {
  const text = linkEl.textContent?.trim() || "";

  // 1. Direct match on linkEl text
  const directRange = parseTimestampRange(text);
  if (directRange) return { type: "range", start: directRange.start, end: directRange.end };
  const directSec = parseTimestamp(text);
  if (directSec !== null) return { type: "single", text };

  // 2. Check previous siblings (e.g. clicked on ")", "(", "()", or ".cm-url")
  let prev = linkEl.previousElementSibling;
  let steps = 0;
  while (prev && steps < 5) {
    const pText = prev.textContent?.trim() || "";
    const pRange = parseTimestampRange(pText);
    if (pRange) return { type: "range", start: pRange.start, end: pRange.end };
    const pSec = parseTimestamp(pText);
    if (pSec !== null) return { type: "single", text: pText };
    prev = prev.previousElementSibling;
    steps++;
  }

  // 3. Check next siblings (e.g. clicked on "[" before timestamp)
  let next = linkEl.nextElementSibling;
  steps = 0;
  while (next && steps < 5) {
    const nText = next.textContent?.trim() || "";
    const nRange = parseTimestampRange(nText);
    if (nRange) return { type: "range", start: nRange.start, end: nRange.end };
    const nSec = parseTimestamp(nText);
    if (nSec !== null) return { type: "single", text: nText };
    next = next.nextElementSibling;
    steps++;
  }

  // 4. Fallback for line with timestamps when clicking empty link token
  const lineText = cmLine.textContent || "";
  const timestamps = extractTimestampsFromText(lineText);
  if (timestamps.length === 1 && (text === "" || text === "()" || text === "(" || text === ")" || linkEl.classList.contains("cm-url") || linkEl.classList.contains("cm-formatting-link"))) {
    const ts = timestamps[0];
    if (ts.isRange && ts.endSeconds !== undefined) {
      return { type: "range", start: ts.timeSeconds, end: ts.endSeconds };
    }
    return { type: "single", text: ts.displayText };
  }

  return null;
}

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
    this.cleanExpiredHistory();

    // Initialize Services
    this.detector = new MediaDetector(this.app);
    this.screenshotService = new ScreenshotService(this.app, this.settings);
    this.typingScribeService = new TypingScribeService(this.app, this.settings);
    this.transcriptService = new TranscriptService(this.app);

    this.timestampService = new TimestampService(
      this.app,
      this.settings,
      () => this.getActivePlayer(),
      () => this.embeddedManager?.getActiveSource() || null,
      (start, end) => this.handleSetLoopRange(start, end, true)
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

    // Register Ribbon Icon
    const ribbonIcon = this.addRibbonIcon("play-circle", "MediaScribe: Toggle / Open Player", async () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        await this.embeddedManager.toggleActiveView();
      } else {
        new Notice("MediaScribe: Please open or focus a note to dock the player.");
      }
    });
    setDynamicTooltip(
      ribbonIcon,
      this.app,
      "MediaScribe: Toggle / Open Player",
      "mediascribe-toggle-embedded-player",
      "Ctrl+Shift+M"
    );

    // Register Commands
    this.registerPluginCommands();

    // Register Global Click Handler for Timestamps
    this.registerTimestampClickHandler();

    // Guard openLinkText to prevent creating/opening files named "()" from empty markdown links
    this.setupOpenLinkTextGuard();

    // Register Markdown Post-Processor to style timestamps
    this.setupMarkdownPostProcessor();

    // Register Typing Scribe Auto-Pause & Auto A-B Loop detection
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: any) => {
        this.typingScribeService.handleEditorChange();
        this.handleEditorLoopRangeDetection(editor);
      })
    );

    // Auto-embed or update on file-open
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          this.embeddedManager.syncView(view);
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
   * Cleans up saved panel conditions and playback positions older than autoClearHistoryDays
   */
  public cleanExpiredHistory(): void {
    const days = this.settings.autoClearHistoryDays;
    if (!days || days <= 0) return;

    const maxAgeMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let changed = false;

    // 1. Clean side panel states
    if (this.settings.storedSidePanelStates) {
      for (const key of Object.keys(this.settings.storedSidePanelStates)) {
        const item = this.settings.storedSidePanelStates[key];
        if (item && item.lastAccessed && (now - item.lastAccessed > maxAgeMs)) {
          delete this.settings.storedSidePanelStates[key];
          changed = true;
        }
      }
    }

    // 2. Clean playback positions
    if (this.settings.storedPlaybackLastAccessed && this.settings.storedPlaybackPositions) {
      for (const url of Object.keys(this.settings.storedPlaybackLastAccessed)) {
        const lastAccess = this.settings.storedPlaybackLastAccessed[url];
        if (now - lastAccess > maxAgeMs) {
          delete this.settings.storedPlaybackLastAccessed[url];
          delete this.settings.storedPlaybackPositions[url];
          changed = true;
        }
      }
    }

    if (changed) {
      this.saveSettings();
    }
  }

  /**
   * Retrieves whichever player is active embedded in current note
   */
  public getActivePlayer(): IMediaPlayer | null {
    return this.embeddedManager.getActiveEmbeddedPlayer();
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
          if (this.embeddedManager.hasActiveWidget(view)) {
            if (!checking) {
              this.embeddedManager.toggleActiveView();
            }
            return true;
          }
          const hasCandidate = this.detector.hasMediaCandidate(
            view.file,
            this.settings.mediaPropertyNames,
            this.settings.playlistNoteProperty
          );
          if (hasCandidate) {
            if (!checking) {
              this.embeddedManager.toggleActiveView();
            }
            return true;
          }
        }
        return false;
      }
    });

    // 1. Open Media for Active Note
    this.addCommand({
      id: "mediascribe-open-active-note-media",
      name: "Open media for active note",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (!checking) {
            void (async () => {
              const source = await this.detector.extractMediaFromNote(
                file,
                this.settings.mediaPropertyNames,
                this.settings.playlistNoteProperty,
                this.settings.verifyMediaContentType ?? true
              );
              if (source) {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                  this.embeddedManager.reopenView(view);
                }
              } else {
                new Notice("MediaScribe: No supported video/audio found in note.");
              }
            })();
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
      callback: async () => {
        const input = window.prompt("Enter YouTube URL, web media link, or Vault filename:");
        if (input && input.trim()) {
          const source = await this.detector.resolveSource(
            input.trim(),
            "",
            this.settings.verifyMediaContentType ?? true
          );
          if (source) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
              this.embeddedManager.mountWithPosition(view, this.settings.embeddedPosition || "top", 0, true, source);
            } else {
              new Notice("MediaScribe: Please open or focus a note in the editor to mount media.");
            }
          } else {
            new Notice("MediaScribe: Invalid or unsupported media source. The link is not a playable video or audio source.");
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
        } else {
          new Notice("MediaScribe: No active media player found to capture screenshot.");
        }
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

    // 11. Set A-B Loop from Range
    this.addCommand({
      id: "mediascribe-set-loop-range",
      name: "Set A-B Loop range [starttime - endtime]...",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let defaultVal = "";
        if (activeView && activeView.editor) {
          const selection = activeView.editor.getSelection().trim();
          if (selection && (parseTimestampRange(selection) || parseTimestamp(selection))) {
            defaultVal = selection;
          }
        }
        const input = window.prompt("Enter loop range [starttime - endtime] (e.g. [01:23 - 02:45]):", defaultVal);
        if (input && input.trim()) {
          const range = parseTimestampRange(input.trim(), true);
          if (range) {
            this.handleSetLoopRange(range.start, range.end, true);
          } else {
            new Notice("MediaScribe: Invalid format. Please use [starttime - endtime] (e.g. 01:23 - 02:45)");
          }
        }
      }
    });
  }

  private lastDetectedRangeKey: string = "";

  private handleEditorLoopRangeDetection(editor: any): void {
    if (!editor || typeof editor.getCursor !== "function") return;

    try {
      const cursor = editor.getCursor();
      const currentLine = editor.getLine(cursor.line) || "";
      const textBefore = currentLine.substring(0, cursor.ch);

      // 1. Detect if user just typed closing parenthesis of a link: e.g. "... [01:23 - 02:45]()" or "... [01:23 - 02:45](...)"
      const linkMatch = textBefore.match(
        /(?:\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\([^)]*\)|\[\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\])$/i
      );

      let matchedStart: string | null = null;
      let matchedEnd: string | null = null;
      let rangeKey = "";

      if (linkMatch) {
        matchedStart = linkMatch[1] || linkMatch[3];
        matchedEnd = linkMatch[2] || linkMatch[4];
        rangeKey = `link:${cursor.line}:${matchedStart}-${matchedEnd}`;
      } else if (cursor.line > 0 && cursor.ch === 0) {
        // 2. User just pressed Enter after typing on previous line:
        const prevLine = editor.getLine(cursor.line - 1) || "";
        const prevMatch = prevLine.match(
          /(?:\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\([^)]*\)|\[\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\])/i
        );
        if (prevMatch) {
          matchedStart = prevMatch[1] || prevMatch[3];
          matchedEnd = prevMatch[2] || prevMatch[4];
          rangeKey = `enter:${cursor.line - 1}:${matchedStart}-${matchedEnd}`;
        }
      }

      if (matchedStart && matchedEnd && rangeKey && rangeKey !== this.lastDetectedRangeKey) {
        const startSec = parseTimestamp(matchedStart);
        const endSec = parseTimestamp(matchedEnd);
        if (startSec !== null && endSec !== null) {
          this.lastDetectedRangeKey = rangeKey;
          // Set the loop Set A and Set B on the active player widget automatically
          this.handleSetLoopRange(startSec, endSec, false);
        }
      }
    } catch {
      // Ignore editor read errors gracefully
    }
  }

  public handleSetLoopRange(start: number, end: number, autoSeek: boolean = true): boolean {
    const embedded = this.embeddedManager.getActiveEmbeddedWidget();
    if (embedded) {
      embedded.uncollapse();
      embedded.setLoopRange(start, end, autoSeek);
      return true;
    }

    // If player was closed, reopen it for the active note!
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file) {
      void this.detector
        .extractMediaFromNote(
          activeView.file,
          this.settings.mediaPropertyNames,
          this.settings.playlistNoteProperty,
          this.settings.verifyMediaContentType ?? true
        )
        .then((source) => {
          if (source) {
            this.embeddedManager.reopenView(activeView, start).then(() => {
              const newEmbedded = this.embeddedManager.getActiveEmbeddedWidget();
              newEmbedded?.setLoopRange(start, end, autoSeek);
            });
          }
        });
      return true;
    }

    return false;
  }

  private setupOpenLinkTextGuard(): void {
    const origOpenLinkText = this.app.workspace.openLinkText.bind(this.app.workspace);
    this.app.workspace.openLinkText = async (
      linktext: string,
      sourcePath: string,
      newLeaf?: any,
      openViewState?: any
    ) => {
      const trimmed = (linktext || "").trim();

      // Intercept empty links, "()", "( )", "#", or parens so Obsidian NEVER creates a note named "()"
      if (
        trimmed === "" ||
        trimmed === "()" ||
        trimmed === "( )" ||
        trimmed === "#" ||
        (trimmed.startsWith("(") && trimmed.endsWith(")"))
      ) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.editor) {
          const cursor = activeView.editor.getCursor();
          const line = activeView.editor.getLine(cursor.line) || "";
          const timestamps = extractTimestampsFromText(line);
          if (timestamps.length > 0) {
            let best = timestamps[0];
            let bestDist = 999999;
            for (const ts of timestamps) {
              const dist = Math.abs(cursor.ch - (ts.index + ts.length / 2));
              if (dist < bestDist) {
                bestDist = dist;
                best = ts;
              }
            }
            if (best.isRange && best.endSeconds !== undefined) {
              this.handleSetLoopRange(best.timeSeconds, best.endSeconds, true);
            } else {
              this.handleTimestampJump(best.displayText);
            }
          }
        }
        return;
      }

      // Check if linktext itself is a loop range
      const range = parseTimestampRange(trimmed);
      if (range) {
        this.handleSetLoopRange(range.start, range.end, true);
        return;
      }

      // Check if linktext itself is a single timestamp
      const sec = parseTimestamp(trimmed);
      if (sec !== null) {
        this.handleTimestampJump(trimmed);
        return;
      }

      return origOpenLinkText(linktext, sourcePath, newLeaf, openViewState);
    };

    this.register(() => {
      this.app.workspace.openLinkText = origOpenLinkText;
    });
  }

  private registerTimestampClickHandler(): void {
    let lastActionTime = 0;
    const triggerAction = (action: () => void) => {
      const now = Date.now();
      if (now - lastActionTime > 300) {
        lastActionTime = now;
        action();
      }
    };

    const handlePointer = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target) return;

      // 0. Do NOT treat clicks inside inline code, code blocks, or comments as timestamps!
      if (
        target.closest(
          "code, pre, .cm-inline-code, .HyperMD-codeblock, .cm-formatting-code, .cm-comment"
        )
      ) {
        return;
      }

      // 1. Custom MediaScribe timestamp link (e.g. from transcript panel or pill)
      const mediaPill = target.closest(".mediascribe-timestamp-link") as HTMLElement;
      if (mediaPill) {
        evt.preventDefault();
        evt.stopPropagation();
        evt.stopImmediatePropagation();

        const loopRange = mediaPill.getAttribute("data-loop-range");
        if (loopRange) {
          const parts = loopRange.split("-");
          if (parts.length === 2) {
            triggerAction(() => {
              this.handleSetLoopRange(parseFloat(parts[0]), parseFloat(parts[1]), true);
            });
            return;
          }
        }

        const text = mediaPill.getAttribute("data-timestamp") || mediaPill.innerText;
        const range = parseTimestampRange(text);
        if (range) {
          triggerAction(() => {
            this.handleSetLoopRange(range.start, range.end, true);
          });
          return;
        }

        triggerAction(() => {
          this.handleTimestampJump(text);
        });
        return;
      }

      // 2. Reading View / Standard Anchor tag (e.g. <a href="">00:16</a> or <a href="#t=16">00:16</a>)
      const anchor = target.closest("a");
      if (anchor) {
        if (!isOfficialTimestampLink(anchor)) {
          return;
        }

        const href = anchor.getAttribute("href") || "";
        const text = anchor.innerText.trim();

        const range = parseTimestampRange(text) || parseTimestampRange(href);
        if (range) {
          evt.preventDefault();
          evt.stopPropagation();
          evt.stopImmediatePropagation();
          triggerAction(() => {
            this.handleSetLoopRange(range.start, range.end, true);
          });
          return;
        }

        if (href.startsWith("#t=") || parseTimestamp(href) !== null || parseTimestamp(text) !== null) {
          evt.preventDefault();
          evt.stopPropagation();
          evt.stopImmediatePropagation();
          triggerAction(() => {
            this.handleTimestampJump(href || text);
          });
          return;
        }
      }

      // 3. Live Preview / CodeMirror 6 Editor
      const linkEl = target.closest(".cm-link, .cm-url, .cm-hmd-internal-link, .cm-formatting-link");
      const cmLine = target.closest(".cm-line");
      if (linkEl && cmLine) {
        const lineText = cmLine.textContent || "";
        const timestamps = extractTimestampsFromText(lineText);

        if (timestamps.length > 0) {
          const result = getTimestampFromLinkElement(linkEl, cmLine);
          if (result) {
            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();
            triggerAction(() => {
              if (result.type === "range") {
                this.handleSetLoopRange(result.start, result.end, true);
              } else {
                this.handleTimestampJump(result.text);
              }
            });
            return;
          }
        }
      }
    };

    this.registerDomEvent(document, "mousedown", handlePointer, true);
    this.registerDomEvent(document, "click", handlePointer, true);
    this.registerDomEvent(document, "auxclick", handlePointer, true);
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
      void this.detector
        .extractMediaFromNote(
          activeView.file,
          this.settings.mediaPropertyNames,
          this.settings.playlistNoteProperty,
          this.settings.verifyMediaContentType ?? true
        )
        .then((source) => {
          if (source) {
            this.embeddedManager.reopenView(activeView, seconds);
            new Notice(`MediaScribe: Reopened player at ${formatSeconds(seconds)}`);
          }
        });
      return true;
    }

    return false;
  }

  private setupMarkdownPostProcessor(): void {
    this.registerMarkdownPostProcessor((el: HTMLElement) => {
      // 1. Process <a> tags generated by Obsidian from [time]() or [time](#t=...) or [start - end]()
      const anchorTags = el.querySelectorAll<HTMLAnchorElement>("a");
      anchorTags.forEach((a) => {
        if (a.classList.contains("mediascribe-timestamp-link")) return;
        // Strictly verify this is an official markdown link with () and not a bare bracket [text]
        if (!isOfficialTimestampLink(a)) return;

        const text = a.textContent?.trim() || "";
        const href = a.getAttribute("href") || "";

        // Check if range: [start - end]()
        const range = parseTimestampRange(text) || parseTimestampRange(href);
        if (range) {
          a.classList.add("mediascribe-timestamp-link", "mediascribe-loop-range-link");
          a.setAttribute("data-loop-range", `${range.start}-${range.end}`);
          a.setAttribute("data-loop-start", `${range.start}`);
          a.setAttribute("data-loop-end", `${range.end}`);
          a.title = `Click to set A-B Loop: ${formatSeconds(range.start)} - ${formatSeconds(range.end)}`;
          a.empty();
          const iconSpan = a.createSpan({ cls: "mediascribe-pill-icon" });
          setIcon(iconSpan, "repeat");
          a.createSpan({ cls: "mediascribe-pill-text", text: `${formatSeconds(range.start)} - ${formatSeconds(range.end)}` });
          return;
        }

        // Check if single timestamp: [01:23]() or [01:23](#t=83)
        const sec = parseTimestamp(text) ?? parseTimestamp(href);
        if (sec !== null) {
          a.classList.add("mediascribe-timestamp-link");
          a.setAttribute("data-timestamp", formatSeconds(sec));
          a.title = `Click to jump to ${formatSeconds(sec)}`;
          a.empty();
          const iconSpan = a.createSpan({ cls: "mediascribe-pill-icon" });
          setIcon(iconSpan, "play");
          a.createSpan({ cls: "mediascribe-pill-text", text: `${formatSeconds(sec)}` });
        }
      });

      // 2. Process any raw unparsed [time]() or [start - end]() in text nodes
      // (Strictly requires both [] and () so bare [hh:mm] text is never modified!)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodesToReplace: { node: Text; parent: Node }[] = [];

      let currentNode: Text | null = null;
      while ((currentNode = walker.nextNode() as Text)) {
        const val = currentNode.nodeValue || "";
        if (
          /\[\d{1,2}:\d{2}(?::\d{2})?\s*(?:[-–—~]|\bto\b)\s*\d{1,2}:\d{2}(?::\d{2})?\]\([^)]*\)/.test(val) ||
          /\[\d{1,2}:\d{2}(?::\d{2})?\]\([^)]*\)/.test(val)
        ) {
          if (
            currentNode.parentElement &&
            !currentNode.parentElement.closest(".mediascribe-timestamp-link, a, code, pre")
          ) {
            nodesToReplace.push({ node: currentNode, parent: currentNode.parentNode! });
          }
        }
      }

      for (const item of nodesToReplace) {
        const val = item.node.nodeValue || "";
        const regex = /(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\([^)]*\)|\[(\d{1,2}:\d{2}(?::\d{2})?)\]\([^)]*\))/g;
        let lastIdx = 0;
        let match: RegExpExecArray | null;

        const frag = document.createDocumentFragment();

        while ((match = regex.exec(val)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
          }

          if (match[1] && match[2]) {
            // Range timestamp! [starttime - endtime]()
            const startSec = parseTimestamp(match[1]);
            const endSec = parseTimestamp(match[2]);
            const pill = document.createElement("span");
            pill.className = "mediascribe-timestamp-link mediascribe-loop-range-link";
            if (startSec !== null && endSec !== null) {
              const minSec = Math.min(startSec, endSec);
              const maxSec = Math.max(startSec, endSec);
              pill.setAttribute("data-loop-range", `${minSec}-${maxSec}`);
              pill.setAttribute("data-loop-start", `${minSec}`);
              pill.setAttribute("data-loop-end", `${maxSec}`);
            }
            pill.title = `Click to set A-B Loop: ${match[1]} - ${match[2]}`;
            const iconSpan = document.createElement("span");
            iconSpan.className = "mediascribe-pill-icon";
            setIcon(iconSpan, "repeat");
            pill.appendChild(iconSpan);
            const textSpan = document.createElement("span");
            textSpan.className = "mediascribe-pill-text";
            textSpan.textContent = `${match[1]} - ${match[2]}`;
            pill.appendChild(textSpan);
            frag.appendChild(pill);
          } else if (match[3]) {
            // Single timestamp! [starttime]()
            const pill = document.createElement("span");
            pill.className = "mediascribe-timestamp-link";
            pill.setAttribute("data-timestamp", match[3]);
            pill.title = `Click to jump to ${match[3]}`;
            const iconSpan = document.createElement("span");
            iconSpan.className = "mediascribe-pill-icon";
            setIcon(iconSpan, "play");
            pill.appendChild(iconSpan);
            const textSpan = document.createElement("span");
            textSpan.className = "mediascribe-pill-text";
            textSpan.textContent = `${match[3]}`;
            pill.appendChild(textSpan);
            frag.appendChild(pill);
          }

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
