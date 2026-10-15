import { App, MarkdownView, setIcon } from "obsidian";
import { IMediaPlayer, TranscriptItem } from "../types";
import { formatSeconds } from "../utils/time";

export class TranscriptPanel {
  private containerEl: HTMLElement;
  private app: App;
  private playerGetter: () => IMediaPlayer | null;
  private items: TranscriptItem[] = [];
  private filteredItems: TranscriptItem[] = [];
  private searchQuery: string = "";
  private autoScroll: boolean = true;
  private activeIndex: number = -1;
  private isLoading: boolean = false;
  private listEl: HTMLElement | null = null;

  constructor(
    parentEl: HTMLElement,
    app: App,
    playerGetter: () => IMediaPlayer | null
  ) {
    this.app = app;
    this.playerGetter = playerGetter;
    this.containerEl = parentEl.createDiv({ cls: "mediascribe-transcript-panel" });
    this.render();
  }

  public setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.renderList();
  }

  public setItems(items: TranscriptItem[]): void {
    this.isLoading = false;
    this.items = items;
    this.applyFilter();
    this.renderList();
  }

  public clear(): void {
    this.items = [];
    this.filteredItems = [];
    this.activeIndex = -1;
    this.isLoading = false;
    this.renderList();
  }

  public setVisible(visible: boolean): void {
    this.containerEl.toggleClass("is-hidden", !visible);
  }

  public updateTime(currentTime: number): void {
    if (this.items.length === 0) return;

    // Find the item corresponding to currentTime
    let newIndex = -1;
    for (let i = 0; i < this.items.length; i++) {
      if (currentTime >= this.items[i].start && currentTime <= this.items[i].end) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== -1 && newIndex !== this.activeIndex) {
      this.activeIndex = newIndex;
      this.highlightActiveItem();
    }
  }

  private render(): void {
    this.containerEl.empty();

    // Toolbar: Search + Auto-scroll toggle + Insert All
    const toolbarEl = this.containerEl.createDiv({ cls: "mediascribe-transcript-toolbar" });

    const searchInput = toolbarEl.createEl("input", {
      type: "text",
      placeholder: "Search transcript...",
      cls: "mediascribe-transcript-search"
    });
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.applyFilter();
      this.renderList();
    });

    const actionsEl = toolbarEl.createDiv({ cls: "mediascribe-transcript-actions" });

    // Auto-scroll toggle
    const autoScrollBtn = actionsEl.createEl("button", {
      cls: `mediascribe-btn-icon ${this.autoScroll ? "is-active" : ""}`,
      attr: { title: "Toggle Auto-Scroll" }
    });
    setIcon(autoScrollBtn, "chevrons-down");
    autoScrollBtn.addEventListener("click", () => {
      this.autoScroll = !this.autoScroll;
      autoScrollBtn.toggleClass("is-active", this.autoScroll);
    });

    // Insert All into Note
    const insertAllBtn = actionsEl.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Insert Full Transcript into Note" }
    });
    setIcon(insertAllBtn, "file-text");
    insertAllBtn.addEventListener("click", () => this.insertFullTranscript());

    // List container
    this.listEl = this.containerEl.createDiv({ cls: "mediascribe-transcript-list" });
    this.renderList();
  }

  private applyFilter(): void {
    if (!this.searchQuery) {
      this.filteredItems = [...this.items];
    } else {
      this.filteredItems = this.items.filter((item) =>
        item.text.toLowerCase().includes(this.searchQuery)
      );
    }
  }

  private renderList(): void {
    if (!this.listEl) return;
    this.listEl.empty();

    if (this.isLoading) {
      const loading = this.listEl.createDiv({ cls: "mediascribe-transcript-empty is-loading" });
      loading.setText("Fetching transcript / captions...");
      return;
    }

    if (this.filteredItems.length === 0) {
      const empty = this.listEl.createDiv({ cls: "mediascribe-transcript-empty" });
      empty.setText(this.items.length === 0 ? "No transcript available for this media." : "No matching dialogue found.");
      return;
    }

    this.filteredItems.forEach((item, index) => {
      const row = this.listEl!.createDiv({
        cls: `mediascribe-transcript-row ${index === this.activeIndex ? "is-active" : ""}`
      });

      // Timestamp Pill
      const timePill = row.createSpan({ cls: "mediascribe-transcript-time" });
      timePill.setText(formatSeconds(item.start));
      timePill.addEventListener("click", () => {
        const player = this.playerGetter();
        if (player) {
          player.seekTo(item.start);
        }
      });

      // Text snippet
      const textSpan = row.createSpan({ cls: "mediascribe-transcript-text" });
      textSpan.setText(item.text);
      textSpan.addEventListener("click", () => {
        const player = this.playerGetter();
        if (player) {
          player.seekTo(item.start);
        }
      });

      // Quote to Note Button
      const quoteBtn = row.createEl("button", {
        cls: "mediascribe-transcript-quote-btn",
        attr: { title: "Quote with timestamp into note" }
      });
      setIcon(quoteBtn, "quote");
      quoteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.quoteToNote(item);
      });
    });
  }

  private highlightActiveItem(): void {
    if (!this.listEl) return;
    const rows = this.listEl.querySelectorAll(".mediascribe-transcript-row");
    rows.forEach((row, i) => {
      row.classList.toggle("is-active", i === this.activeIndex);
    });

    if (this.autoScroll && this.activeIndex >= 0 && rows[this.activeIndex]) {
      const activeEl = rows[this.activeIndex] as HTMLElement;
      this.scrollItemWithOffset(activeEl, this.listEl, 70, 30);
    }
  }

  private scrollItemWithOffset(
    itemEl: HTMLElement,
    containerEl: HTMLElement,
    bottomOffset: number = 70,
    topOffset: number = 30
  ): void {
    const itemRect = itemEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    if (itemRect.bottom > containerRect.bottom - bottomOffset) {
      const diff = itemRect.bottom - (containerRect.bottom - bottomOffset);
      containerEl.scrollBy({ top: diff, behavior: "smooth" });
    } else if (itemRect.top < containerRect.top + topOffset) {
      const diff = itemRect.top - (containerRect.top + topOffset);
      containerEl.scrollBy({ top: diff, behavior: "smooth" });
    }
  }

  private quoteToNote(item: TranscriptItem): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.editor) {
      const timeStr = formatSeconds(item.start);
      const quoteMarkdown = `> [${timeStr}] ${item.text}\n\n`;
      activeView.editor.replaceSelection(quoteMarkdown);
    }
  }

  private insertFullTranscript(): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) return;

    let transcriptMarkdown = `\n### 📜 Video Transcript\n\n`;
    for (const item of this.items) {
      transcriptMarkdown += `- **[${formatSeconds(item.start)}]** ${item.text}\n`;
    }
    transcriptMarkdown += `\n`;

    activeView.editor.replaceSelection(transcriptMarkdown);
  }
}
