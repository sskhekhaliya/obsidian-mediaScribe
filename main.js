"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MediaScribePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian16 = require("obsidian");

// src/types/index.ts
var DEFAULT_SETTINGS = {
  autoEmbedInNote: true,
  verifyMediaContentType: true,
  embeddedPlayerHeight: 340,
  embeddedPosition: "top",
  embeddedDockWidth: 420,
  hideNativeYouTubeControls: false,
  hideYouTubeOverlays: true,
  youtubeCropZoom: 1,
  defaultLayout: "embed_in_note",
  jumpStepSeconds: 5,
  timestampFormat: "bracket",
  includeTimestampLeadingZero: true,
  autoPauseOnTyping: false,
  autoPauseCharThreshold: 3,
  autoPauseIdleResumeSec: 2,
  autoResumeRewindSec: 1.5,
  screenshotFolder: "",
  screenshotFormat: "png",
  screenshotQuality: 0.9,
  screenshotIncludeTimestamp: true,
  screenshotNamingPrefix: "MediaFrame_",
  defaultPlaybackRate: 1,
  rememberPlaybackPosition: true,
  storedPlaybackPositions: {},
  storedPlaybackLastAccessed: {},
  rememberSidePanelState: true,
  storedSidePanelStates: {},
  autoClearHistoryDays: 30,
  mediaPropertyNames: ["media_link", "video_link", "media", "video", "url", "youtube"],
  enableAmbientMode: true,
  playlistNoteProperty: "video_link",
  playlistNoteFolderLocation: "current_folder",
  playlistNoteSpecificFolder: "",
  playlistAutoplay: true,
  mobileTopMargin: 48
};

// src/settings.ts
var import_obsidian2 = require("obsidian");

// src/ui/folderSuggest.ts
var import_obsidian = require("obsidian");
var FolderSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, textInputEl) {
    super(app, textInputEl);
    this.inputEl = textInputEl;
  }
  getSuggestions(query) {
    const lowerQuery = query.toLowerCase().trim();
    const folders = [];
    const files = this.app.vault.getAllLoadedFiles();
    for (const file of files) {
      if (file instanceof import_obsidian.TFolder) {
        const displayPath = file.path === "/" ? "" : file.path;
        if (!lowerQuery || displayPath.toLowerCase().includes(lowerQuery)) {
          folders.push(file);
        }
      }
    }
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }
  renderSuggestion(folder, el) {
    const displayPath = folder.path === "/" ? "(Vault Root)" : folder.path;
    el.setText(displayPath);
  }
  selectSuggestion(folder) {
    const selectedPath = folder.path === "/" ? "" : folder.path;
    this.setValue(selectedPath);
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
};

// src/settings.ts
var MediaScribeSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MediaScribe Settings" });
    containerEl.createEl("h3", { text: "Playback & Viewport" });
    new import_obsidian2.Setting(containerEl).setName("Auto-Embed in Note (Recommended)").setDesc("Automatically display the player at the top of any note containing media_link or video properties.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoEmbedInNote).onChange(async (val) => {
        this.plugin.settings.autoEmbedInNote = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName(
      import_obsidian2.Platform.isDesktop ? "Embedded Player Position" : "Embedded Player Position (Landscape)"
    ).setDesc(
      import_obsidian2.Platform.isDesktop ? "Choose where the player docks when embedded inside a note." : "On mobile and tablet, portrait mode docks at the top. In landscape mode, choose whether the player appears on the right or left (top option is disabled in landscape)."
    ).addDropdown((dropdown) => {
      if (import_obsidian2.Platform.isDesktop) {
        dropdown.addOption("top", "Top (Horizontal)").addOption("vertical_right", "Vertical Split (Right side)").addOption("vertical_left", "Vertical Split (Left side)").setValue(this.plugin.settings.embeddedPosition || "top");
      } else {
        dropdown.addOption("vertical_right", "Vertical Split (Right side)").addOption("vertical_left", "Vertical Split (Left side)").setValue(this.plugin.settings.embeddedPosition === "vertical_left" ? "vertical_left" : "vertical_right");
      }
      dropdown.onChange(async (val) => {
        this.plugin.settings.embeddedPosition = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    if (import_obsidian2.Platform.isDesktop) {
      new import_obsidian2.Setting(containerEl).setName("Vertical Dock Width").setDesc("Width in pixels when docked vertically on the left or right side of a note.").addSlider((slider) => {
        slider.setLimits(280, 650, 10).setValue(this.plugin.settings.embeddedDockWidth || 420).setDynamicTooltip().onChange(async (val) => {
          this.plugin.settings.embeddedDockWidth = val;
          await this.plugin.saveSettings();
          this.plugin.embeddedManager.syncActiveView();
        });
      });
    }
    new import_obsidian2.Setting(containerEl).setName("Mobile Top Margin").setDesc("Extra margin spacing (in pixels) added at the top of the embedded player on mobile devices so it stays clear of the phone notification/status bar and Obsidian top navigation UI.").addSlider((slider) => {
      slider.setLimits(0, 120, 2).setValue(this.plugin.settings.mobileTopMargin ?? 48).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.mobileTopMargin = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Embedded Player Height (Top Mode)").setDesc("Height in pixels for the player when embedded at the top of notes.").addSlider((slider) => {
      slider.setLimits(180, 600, 20).setValue(this.plugin.settings.embeddedPlayerHeight).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.embeddedPlayerHeight = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Hide Native YouTube Controls (Clean Mode)").setDesc("Hides YouTube's built-in progress bar, settings gear, and buttons so you only see MediaScribe's sleek controls.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.hideNativeYouTubeControls).onChange(async (val) => {
        this.plugin.settings.hideNativeYouTubeControls = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Hide Overlays & Watermarks (Cinematic Clean Mode)").setDesc("Crops out YouTube's top channel banner, share button, 'More videos' thumbnail pill, and YouTube logo.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.hideYouTubeOverlays).onChange(async (val) => {
        this.plugin.settings.hideYouTubeOverlays = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Overlay Crop Zoom Level").setDesc("Zoom multiplier used to push YouTube overlays outside the player boundary (1.0 = none, 1.22 = recommended, 1.30 = max).").addSlider((slider) => {
      slider.setLimits(1, 1.3, 0.02).setValue(this.plugin.settings.youtubeCropZoom).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.youtubeCropZoom = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Ambient Mode (Dynamic Video Glow)").setDesc("Casts a soft, dynamic ambient glow around the video player matching the video's live colors and blending into your Obsidian theme.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableAmbientMode).onChange(async (val) => {
        this.plugin.settings.enableAmbientMode = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Jump Step (Seconds)").setDesc("How many seconds to skip forward or backward when using media hotkeys.").addSlider((slider) => {
      slider.setLimits(1, 60, 1).setValue(this.plugin.settings.jumpStepSeconds).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.jumpStepSeconds = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Remember Playback Positions").setDesc("Automatically resume videos and audio from where you previously stopped.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.rememberPlaybackPosition).onChange(async (val) => {
        this.plugin.settings.rememberPlaybackPosition = val;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Timestamps" });
    new import_obsidian2.Setting(containerEl).setName("Timestamp Format").setDesc("Syntax used when inserting timestamps into your notes.").addDropdown((drop) => {
      drop.addOption("full_url_link", "[01:23](https://youtu.be/...?t=83) (Direct Video Link - Portable)").addOption("markdown_link", "[01:23](#t=83) (Internal Anchor Link)").addOption("bracket", "[01:23] (Clean Bracket)").addOption("wikilink", "[[#t=83|01:23]] (Obsidian Wikilink)").addOption("bold", "**01:23** (Bold text)").addOption("plain", "01:23 (Plain text)").setValue(this.plugin.settings.timestampFormat).onChange(async (val) => {
        this.plugin.settings.timestampFormat = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Always Include Hours").setDesc("Format timestamps as 00:01:23 instead of 01:23 when hours are zero.").addToggle((toggle) => {
      toggle.setValue(!this.plugin.settings.includeTimestampLeadingZero).onChange(async (val) => {
        this.plugin.settings.includeTimestampLeadingZero = !val;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Typing Scribe (Smart Auto-Pause)" });
    new import_obsidian2.Setting(containerEl).setName("Auto-Pause While Typing").setDesc("Automatically pause media playback whenever you start typing in your note.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoPauseOnTyping).onChange(async (val) => {
        this.plugin.settings.autoPauseOnTyping = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Pause Trigger Threshold (Characters)").setDesc("How many characters must be typed continuously before playback pauses. Set to 1 for instant pause, or 3\u20135 to ignore small edits like commas or punctuation.").addSlider((slider) => {
      slider.setLimits(1, 10, 1).setValue(this.plugin.settings.autoPauseCharThreshold ?? 3).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.autoPauseCharThreshold = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Resume Idle Duration (Seconds)").setDesc("How long to wait after you stop typing before automatically resuming playback.").addSlider((slider) => {
      slider.setLimits(1, 5, 0.5).setValue(this.plugin.settings.autoPauseIdleResumeSec).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.autoPauseIdleResumeSec = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Resume Rewind Buffer (Seconds)").setDesc("How many seconds to rewind when playback resumes to preserve context.").addSlider((slider) => {
      slider.setLimits(0, 5, 0.5).setValue(this.plugin.settings.autoResumeRewindSec).setDynamicTooltip().onChange(async (val) => {
        this.plugin.settings.autoResumeRewindSec = val;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Frame Screenshots" });
    new import_obsidian2.Setting(containerEl).setName("Screenshot Folder").setDesc("Vault folder where captured video frames are saved (leave blank to use Obsidian's default attachment folder).").addText((text) => {
      new FolderSuggest(this.app, text.inputEl);
      text.setPlaceholder("e.g. Attachments/VideoFrames").setValue(this.plugin.settings.screenshotFolder).onChange(async (val) => {
        this.plugin.settings.screenshotFolder = val.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Image Format").setDesc("Format of saved video frame images.").addDropdown((drop) => {
      drop.addOption("png", "PNG (Lossless)").addOption("jpeg", "JPEG (Smaller file size)").setValue(this.plugin.settings.screenshotFormat).onChange(async (val) => {
        this.plugin.settings.screenshotFormat = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Include Clickable Timestamp with Screenshot").setDesc("Append [HH:MM:SS] timestamp link next to the inserted screenshot.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.screenshotIncludeTimestamp).onChange(async (val) => {
        this.plugin.settings.screenshotIncludeTimestamp = val;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Note Properties Detection" });
    new import_obsidian2.Setting(containerEl).setName("Validate Media Content Type").setDesc("Automatically verify that web links in properties are playable video/audio content (or YouTube/Vimeo) before opening the player. Prevents opening empty players for web articles, Wikipedia, GitHub, and general links.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.verifyMediaContentType ?? true).onChange(async (val) => {
        this.plugin.settings.verifyMediaContentType = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Media Frontmatter Properties").setDesc("Comma-separated property names in YAML frontmatter to recognize as video/audio links.").addText((text) => {
      text.setPlaceholder("media_link, media, video, url, youtube").setValue(this.plugin.settings.mediaPropertyNames.join(", ")).onChange(async (val) => {
        this.plugin.settings.mediaPropertyNames = val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Playlists & Autoplay" });
    new import_obsidian2.Setting(containerEl).setName("Playlist Autoplay").setDesc("Automatically play the next video in a playlist when the current video finishes. When disabled, playback stops at the end and displays a replay button.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.playlistAutoplay ?? true).onChange(async (val) => {
        this.plugin.settings.playlistAutoplay = val;
        await this.plugin.saveSettings();
        this.plugin.embeddedManager.syncActiveView();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Video Link Property Name").setDesc("The frontmatter property name used when generating notes from playlist videos.").addText((text) => {
      text.setPlaceholder("video_link").setValue(this.plugin.settings.playlistNoteProperty).onChange(async (val) => {
        this.plugin.settings.playlistNoteProperty = val.trim() || "video_link";
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Save Location for Playlist Notes").setDesc("Choose whether new playlist notes are created in the current note's folder or a specific folder.").addDropdown((drop) => {
      drop.addOption("current_folder", "Same folder as current note").addOption("specific_folder", "In a specific folder").setValue(this.plugin.settings.playlistNoteFolderLocation).onChange(async (val) => {
        this.plugin.settings.playlistNoteFolderLocation = val;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    if (this.plugin.settings.playlistNoteFolderLocation === "specific_folder") {
      new import_obsidian2.Setting(containerEl).setName("Specific Folder").setDesc("Choose vault folder where new playlist notes will be stored.").addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text.setPlaceholder("e.g. Media/Notes").setValue(this.plugin.settings.playlistNoteSpecificFolder).onChange(async (val) => {
          this.plugin.settings.playlistNoteSpecificFolder = val.trim();
          await this.plugin.saveSettings();
        });
      });
    }
    new import_obsidian2.Setting(containerEl).setName("Remember Side Panel State").setDesc("Automatically reopen the playlist, captions, or description panel if it was left open for a video or playlist.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.rememberSidePanelState).onChange(async (val) => {
        this.plugin.settings.rememberSidePanelState = val;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Auto-Clear Inactive History (Days)").setDesc("Automatically clears saved panel states and playback positions for videos or playlists that have not been opened after this many days (0 to keep data forever).").addText((text) => {
      text.setPlaceholder("30").setValue(String(this.plugin.settings.autoClearHistoryDays ?? 30)).onChange(async (val) => {
        const parsed = parseInt(val.trim(), 10);
        this.plugin.settings.autoClearHistoryDays = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        await this.plugin.saveSettings();
        this.plugin.cleanExpiredHistory();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Clear Saved Playback History").setDesc("Clears all remembered playback positions and saved panel states for watched videos.").addButton((btn) => {
      btn.setButtonText("Clear History").setWarning().onClick(async () => {
        this.plugin.settings.storedPlaybackPositions = {};
        this.plugin.settings.storedPlaybackLastAccessed = {};
        this.plugin.settings.storedSidePanelStates = {};
        await this.plugin.saveSettings();
        new import_obsidian2.Notice("MediaScribe: Playback positions and panel states cleared.");
        this.display();
      });
    });
    containerEl.createEl("hr", { attr: { style: "margin: 32px 0 20px 0; border: none; border-top: 1px solid var(--background-modifier-border);" } });
    const supportCard = containerEl.createDiv({ cls: "mediascribe-settings-support-card" });
    supportCard.style.cssText = "padding: 18px; border-radius: var(--radius-m); background: var(--background-secondary); border: 1px solid var(--background-modifier-border); text-align: center;";
    const supportTitle = supportCard.createEl("h4", { text: "Enjoying MediaScribe?" });
    supportTitle.style.cssText = "margin: 0 0 6px 0; color: var(--text-normal); font-size: 14px; font-weight: 600;";
    const supportDesc = supportCard.createEl("p", {
      text: "If MediaScribe speeds up your learning, research, and note-taking flow, consider supporting its development!"
    });
    supportDesc.style.cssText = "margin: 0 0 14px 0; color: var(--text-muted); font-size: 12px; line-height: 1.4;";
    const coffeeLink = supportCard.createEl("a", {
      href: "https://buymeacoffee.com/sskhekhaliya",
      attr: { target: "_blank", rel: "noopener" }
    });
    coffeeLink.createEl("img", {
      attr: {
        src: "https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black",
        alt: "Buy Me a Coffee",
        style: "height: 36px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.12);"
      }
    });
    const creditsText = supportCard.createEl("div");
    creditsText.style.cssText = "margin-top: 10px; font-size: 11px; color: var(--text-muted);";
    creditsText.setText("Created with \u2764\uFE0F by SSKhekhaliya");
  }
};

// src/services/mediaDetector.ts
var import_obsidian3 = require("obsidian");

// src/utils/time.ts
function formatSeconds(totalSeconds, forceHours = false) {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    totalSeconds = 0;
  }
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor(rounded % 3600 / 60);
  const seconds = rounded % 60;
  const pad = (num) => num.toString().padStart(2, "0");
  if (hours > 0 || forceHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
function parseTimestamp(input, allowBareSeconds = false) {
  if (!input) return null;
  let str = input.trim();
  if (str.startsWith("(") && str.endsWith(")")) {
    str = str.substring(1, str.length - 1).trim();
  }
  const mdMatch = str.match(/^\[([^\]]+)\](?:\(([^)]*)\))?$/);
  if (mdMatch) {
    if (mdMatch[2]) {
      const fromUrl = parseTimestamp(mdMatch[2], true);
      if (fromUrl !== null) return fromUrl;
    }
    const fromLabel = parseTimestamp(mdMatch[1]);
    if (fromLabel !== null) return fromLabel;
  }
  const wikiMatch = str.match(/^\[\[(?:#t=([0-9hms]+)\|)?([^\]]+)\]\]$/i);
  if (wikiMatch) {
    if (wikiMatch[1]) {
      const fromUrl = parseTimestamp(wikiMatch[1], true);
      if (fromUrl !== null) return fromUrl;
    }
    const fromLabel = parseTimestamp(wikiMatch[2]);
    if (fromLabel !== null) return fromLabel;
  }
  const urlParamMatch = str.match(/[?&#]t=([0-9hms]+)/i);
  if (urlParamMatch && urlParamMatch[1]) {
    const fromParam = parseTimestamp(urlParamMatch[1], true);
    if (fromParam !== null) return fromParam;
  }
  let hasExplicitPrefix = false;
  if (str.toLowerCase().startsWith("#t=")) {
    str = str.substring(3).trim();
    hasExplicitPrefix = true;
  } else if (str.toLowerCase().startsWith("t=")) {
    str = str.substring(2).trim();
    hasExplicitPrefix = true;
  }
  const hmPattern = /^(?:(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?)$/i;
  if (str.includes("h") || str.includes("m") || str.includes("s") && (hasExplicitPrefix || allowBareSeconds || /\d+[mh]/i.test(str))) {
    const match = str.match(hmPattern);
    if (match && (match[1] || match[2] || match[3])) {
      const h = parseInt(match[1] || "0", 10);
      const m = parseInt(match[2] || "0", 10);
      const s = parseInt(match[3] || "0", 10);
      return h * 3600 + m * 60 + s;
    }
  }
  const directSec = str.match(/^(\d+)$/);
  if (directSec) {
    if (hasExplicitPrefix || allowBareSeconds) {
      return parseInt(directSec[1], 10);
    }
    return null;
  }
  const colons = str.match(/^(?:\[|\()?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\))?$/);
  if (colons) {
    if (colons[3] !== void 0) {
      const h = parseInt(colons[1], 10);
      const m = parseInt(colons[2], 10);
      const s = parseInt(colons[3], 10);
      return h * 3600 + m * 60 + s;
    } else {
      const m = parseInt(colons[1], 10);
      const s = parseInt(colons[2], 10);
      return m * 60 + s;
    }
  }
  return null;
}
function extractTimestampsFromText(text) {
  const results = [];
  const lines = text.split("\n");
  let charOffset = 0;
  let inCodeBlock = false;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      charOffset += line.length + 1;
      continue;
    }
    if (inCodeBlock) {
      charOffset += line.length + 1;
      continue;
    }
    const lineForMatching = line.replace(/`[^`]+`/g, (m) => " ".repeat(m.length));
    const regex = /(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\](?:\([^)]*\))?|\[\[(?:#t=[^|]+\|)?(\d{1,2}:\d{2}(?::\d{2})?)\]\]|(?<=\s|^)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$|[.,!?]))/g;
    let match;
    while ((match = regex.exec(lineForMatching)) !== null) {
      const timeStr = match[1] || match[2] || match[3];
      if (timeStr) {
        const seconds = parseTimestamp(timeStr);
        if (seconds !== null) {
          results.push({
            timeSeconds: seconds,
            displayText: timeStr,
            index: charOffset + match.index,
            length: match[0].length,
            lineContent: line.trim()
          });
        }
      }
    }
    charOffset += line.length + 1;
  }
  return results.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

// src/services/mediaDetector.ts
var MediaDetector = class {
  // 1 hour cache
  constructor(app) {
    this.probeCache = /* @__PURE__ */ new Map();
    this.inFlightProbes = /* @__PURE__ */ new Map();
    this.CACHE_TTL_MS = 60 * 60 * 1e3;
    this.app = app;
  }
  /**
   * Fast synchronous check: resolves YouTube, Vimeo, Vault file, or direct media extensions.
   * If a web URL has previously been probed and cached, returns the cached result.
   */
  resolveSourceSync(input, sourcePath = "") {
    if (!input || typeof input !== "string") return null;
    let clean = input.trim();
    if (clean.startsWith('"') && clean.endsWith('"') || clean.startsWith("'") && clean.endsWith("'")) {
      clean = clean.slice(1, -1).trim();
    }
    if (clean.startsWith("!") && (clean.startsWith("![[") || clean.startsWith("!["))) {
      clean = clean.slice(1).trim();
    }
    if (clean.startsWith("[[") && clean.endsWith("]]")) {
      clean = clean.slice(2, -2).split("|")[0].trim();
    }
    const mdLinkMatch = clean.match(/^\[.*?\]\((.+?)\)$/);
    if (mdLinkMatch) {
      clean = mdLinkMatch[1].trim();
    }
    const ytInfo = this.checkYouTube(clean);
    if (ytInfo) return ytInfo;
    const vimeoInfo = this.checkVimeo(clean);
    if (vimeoInfo) return vimeoInfo;
    const vaultFileInfo = this.checkVaultFile(clean, sourcePath);
    if (vaultFileInfo) return vaultFileInfo;
    const webMediaInfo = this.checkWebMedia(clean);
    if (webMediaInfo) return webMediaInfo;
    const cached = this.probeCache.get(clean);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }
    return null;
  }
  /**
   * Resolves a media string (URL, vault link, or path) into structured MediaSourceInfo.
   * Asynchronously verifies remote Content-Type for web URLs if verifyContentType is enabled.
   */
  async resolveSource(input, sourcePath = "", verifyContentType = true) {
    if (!input || typeof input !== "string") return null;
    let clean = input.trim();
    if (clean.startsWith('"') && clean.endsWith('"') || clean.startsWith("'") && clean.endsWith("'")) {
      clean = clean.slice(1, -1).trim();
    }
    if (clean.startsWith("!") && (clean.startsWith("![[") || clean.startsWith("!["))) {
      clean = clean.slice(1).trim();
    }
    if (clean.startsWith("[[") && clean.endsWith("]]")) {
      clean = clean.slice(2, -2).split("|")[0].trim();
    }
    const mdLinkMatch = clean.match(/^\[.*?\]\((.+?)\)$/);
    if (mdLinkMatch) {
      clean = mdLinkMatch[1].trim();
    }
    const fastInfo = this.resolveSourceSync(clean, sourcePath);
    if (fastInfo) return fastInfo;
    const cached = this.probeCache.get(clean);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      if (verifyContentType) {
        return await this.probeMediaUrl(clean);
      } else {
        return {
          type: "html5_video",
          url: clean,
          originalInput: input,
          isLocal: false
        };
      }
    }
    if (clean.startsWith("file://")) {
      const directInfo = this.checkWebMedia(clean);
      if (directInfo) return directInfo;
      if (!verifyContentType) {
        return {
          type: "html5_video",
          url: clean,
          originalInput: input,
          isLocal: true
        };
      }
    }
    return null;
  }
  /**
   * Probe an HTTP/HTTPS URL via HEAD (or range GET) to verify its Content-Type
   */
  async probeMediaUrl(urlStr) {
    const cached = this.probeCache.get(urlStr);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }
    if (this.inFlightProbes.has(urlStr)) {
      return this.inFlightProbes.get(urlStr);
    }
    const probePromise = (async () => {
      let contentType = "";
      try {
        const headPromise = (0, import_obsidian3.requestUrl)({
          url: urlStr,
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianMediaScribe/1.0"
          },
          throw: false
        });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
        const headRes = await Promise.race([headPromise, timeoutPromise]);
        if (headRes && headRes.status >= 200 && headRes.status < 400) {
          contentType = headRes.headers?.["content-type"] || "";
        }
        if (!contentType || headRes && headRes.status === 405) {
          const getPromise = (0, import_obsidian3.requestUrl)({
            url: urlStr,
            method: "GET",
            headers: {
              "Range": "bytes=0-0",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianMediaScribe/1.0"
            },
            throw: false
          });
          const getRes = await Promise.race([getPromise, timeoutPromise]);
          if (getRes && getRes.status >= 200 && getRes.status < 400) {
            contentType = getRes.headers?.["content-type"] || "";
          }
        }
      } catch {
      }
      contentType = contentType.toLowerCase().trim();
      let info = null;
      if (contentType.startsWith("video/")) {
        info = {
          type: "html5_video",
          url: urlStr,
          originalInput: urlStr,
          isLocal: false
        };
      } else if (contentType.startsWith("audio/")) {
        info = {
          type: "html5_audio",
          url: urlStr,
          originalInput: urlStr,
          isLocal: false
        };
      } else if (contentType.includes("application/ogg") || contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("application/x-mpegurl") || contentType.includes("application/dash+xml")) {
        info = {
          type: "html5_video",
          url: urlStr,
          originalInput: urlStr,
          isLocal: false
        };
      }
      if (this.probeCache.size > 500) {
        const firstKey = this.probeCache.keys().next().value;
        if (firstKey) this.probeCache.delete(firstKey);
      }
      this.probeCache.set(urlStr, { info, timestamp: Date.now() });
      return info;
    })();
    this.inFlightProbes.set(urlStr, probePromise);
    try {
      return await probePromise;
    } finally {
      this.inFlightProbes.delete(urlStr);
    }
  }
  checkYouTube(input) {
    const listMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    const playlistId = listMatch ? listMatch[1] : void 0;
    const ytRegex = /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
    const match = input.match(ytRegex);
    if (match && match[1]) {
      const videoId = match[1];
      let initialTime;
      const tMatch = input.match(/[?&#](?:t|start)=([^&#]+)/i);
      if (tMatch && tMatch[1]) {
        const parsed = parseTimestamp(tMatch[1], true);
        if (parsed !== null) initialTime = parsed;
      }
      let playlistIndex;
      const indexMatch = input.match(/[?&]index=(\d+)/i);
      if (indexMatch && indexMatch[1]) {
        playlistIndex = Math.max(0, parseInt(indexMatch[1], 10) - 1);
      }
      const isShorts = /\/shorts\//i.test(input);
      return {
        type: "youtube",
        url: playlistId ? `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}${typeof playlistIndex === "number" ? `&index=${playlistIndex + 1}` : ""}` : isShorts ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
        originalInput: input,
        videoId,
        playlistId,
        playlistIndex,
        isPlaylist: Boolean(playlistId),
        isShorts,
        initialTime,
        isLocal: false
      };
    } else if (playlistId) {
      let playlistIndex;
      const indexMatch = input.match(/[?&]index=(\d+)/i);
      if (indexMatch && indexMatch[1]) {
        playlistIndex = Math.max(0, parseInt(indexMatch[1], 10) - 1);
      }
      return {
        type: "youtube",
        url: `https://www.youtube.com/playlist?list=${playlistId}${typeof playlistIndex === "number" ? `&index=${playlistIndex + 1}` : ""}`,
        originalInput: input,
        playlistId,
        playlistIndex,
        isPlaylist: true,
        isLocal: false
      };
    }
    return null;
  }
  checkVimeo(input) {
    const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i;
    const match = input.match(vimeoRegex);
    if (match && match[1]) {
      const videoId = match[1];
      let initialTime;
      const tMatch = input.match(/#t=([^&#]+)/i);
      if (tMatch && tMatch[1]) {
        const parsed = parseTimestamp(tMatch[1], true);
        if (parsed !== null) initialTime = parsed;
      }
      return {
        type: "vimeo",
        url: `https://player.vimeo.com/video/${videoId}`,
        originalInput: input,
        videoId,
        initialTime,
        isLocal: false
      };
    }
    return null;
  }
  checkVaultFile(input, sourcePath) {
    const file = this.app.metadataCache.getFirstLinkpathDest(input, sourcePath);
    if (file instanceof import_obsidian3.TFile) {
      const ext = file.extension.toLowerCase();
      const videoExts = ["mp4", "webm", "mkv", "mov", "ogv", "m4v", "avi", "ts", "3gp", "wmv", "flv"];
      const audioExts = ["mp3", "m4a", "wav", "ogg", "flac", "aac", "opus", "weba", "oga", "mid", "midi", "wma", "aiff", "caf"];
      if (videoExts.includes(ext) || audioExts.includes(ext)) {
        const resourceUrl = this.app.vault.getResourcePath(file);
        return {
          type: videoExts.includes(ext) ? "html5_video" : "html5_audio",
          url: resourceUrl,
          originalInput: input,
          title: file.basename,
          isLocal: true,
          localFile: file
        };
      }
    }
    return null;
  }
  checkWebMedia(input) {
    const videoExts = [
      ".mp4",
      ".webm",
      ".mkv",
      ".mov",
      ".m4v",
      ".ogv",
      ".avi",
      ".ts",
      ".3gp",
      ".wmv",
      ".asf",
      ".m3u8",
      ".mpd"
    ];
    const audioExts = [
      ".mp3",
      ".m4a",
      ".wav",
      ".ogg",
      ".flac",
      ".aac",
      ".opus",
      ".weba",
      ".oga",
      ".mid",
      ".midi",
      ".wma",
      ".aiff",
      ".caf"
    ];
    try {
      let pathname = "";
      let isFileUrl = false;
      if (input.startsWith("file://")) {
        const url = new URL(input);
        pathname = decodeURIComponent(url.pathname).toLowerCase();
        isFileUrl = true;
      } else if (input.startsWith("http://") || input.startsWith("https://")) {
        const url = new URL(input);
        pathname = decodeURIComponent(url.pathname).toLowerCase();
      } else {
        const stripped = input.split(/[?#]/)[0].toLowerCase();
        for (const ext of videoExts) {
          if (stripped.endsWith(ext)) {
            return {
              type: "html5_video",
              url: input,
              originalInput: input,
              isLocal: true
            };
          }
        }
        for (const ext of audioExts) {
          if (stripped.endsWith(ext)) {
            return {
              type: "html5_audio",
              url: input,
              originalInput: input,
              isLocal: true
            };
          }
        }
        return null;
      }
      for (const ext of videoExts) {
        if (pathname.endsWith(ext)) {
          return {
            type: "html5_video",
            url: input,
            originalInput: input,
            isLocal: isFileUrl
          };
        }
      }
      for (const ext of audioExts) {
        if (pathname.endsWith(ext)) {
          return {
            type: "html5_audio",
            url: input,
            originalInput: input,
            isLocal: isFileUrl
          };
        }
      }
    } catch {
    }
    return null;
  }
  /**
   * Scans a note's frontmatter properties to find media links or playlists.
   * Only looks at frontmatter properties (never scans the note body).
   * Asynchronously verifies remote Content-Type for web URLs if verifyContentType is enabled.
   */
  async extractMediaFromNote(file, mediaPropertyNames, additionalProperty, verifyContentType = true) {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) return null;
    const propList = additionalProperty && !mediaPropertyNames.includes(additionalProperty) ? [additionalProperty, ...mediaPropertyNames] : mediaPropertyNames;
    for (const prop of propList) {
      const val = cache.frontmatter[prop];
      if (!val) continue;
      if (Array.isArray(val) && val.length > 0) {
        const items = [];
        for (let idx = 0; idx < val.length; idx++) {
          const item = val[idx];
          let rawUrl = "";
          let customTitle = "";
          if (typeof item === "string") {
            rawUrl = item;
          } else if (item && typeof item === "object") {
            rawUrl = item.url || item.link || item.media || "";
            customTitle = item.title || "";
          }
          if (rawUrl) {
            const resolved = await this.resolveSource(rawUrl, file.path, verifyContentType);
            if (resolved) {
              const itemTitle = customTitle || resolved.title || (resolved.videoId ? `YouTube (${resolved.videoId})` : `Part ${idx + 1}`);
              resolved.title = itemTitle;
              items.push({
                title: itemTitle,
                source: resolved
              });
            }
          }
        }
        if (items.length > 0) {
          const first = items[0].source;
          return {
            ...first,
            isPlaylist: true,
            playlistIndex: 0,
            playlistItems: items
          };
        }
      }
      if (typeof val === "string" || typeof val === "number") {
        const info = await this.resolveSource(String(val), file.path, verifyContentType);
        if (info) return info;
      }
    }
    return null;
  }
  /**
   * Fast synchronous check to find media in note frontmatter properties without waiting on network probes.
   * Only looks at frontmatter properties (never scans the note body).
   */
  extractMediaFromNoteSync(file, mediaPropertyNames, additionalProperty) {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) return null;
    const propList = additionalProperty && !mediaPropertyNames.includes(additionalProperty) ? [additionalProperty, ...mediaPropertyNames] : mediaPropertyNames;
    for (const prop of propList) {
      const val = cache.frontmatter[prop];
      if (!val) continue;
      if (Array.isArray(val) && val.length > 0) {
        for (let idx = 0; idx < val.length; idx++) {
          const item = val[idx];
          const rawUrl = typeof item === "string" ? item : item?.url || item?.link || item?.media || "";
          if (rawUrl) {
            const resolved = this.resolveSourceSync(rawUrl, file.path);
            if (resolved) return resolved;
          }
        }
      }
      if (typeof val === "string" || typeof val === "number") {
        const info = this.resolveSourceSync(String(val), file.path);
        if (info) return info;
      }
    }
    return null;
  }
  /**
   * Fast check to determine if a note has candidate media properties in frontmatter.
   * Only returns true if a recognized property in frontmatter has a value.
   */
  hasMediaCandidate(file, mediaPropertyNames, additionalProperty) {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) return false;
    const propList = additionalProperty && !mediaPropertyNames.includes(additionalProperty) ? [additionalProperty, ...mediaPropertyNames] : mediaPropertyNames;
    for (const prop of propList) {
      const val = cache.frontmatter[prop];
      if (val) return true;
    }
    return false;
  }
};

// src/services/screenshotService.ts
var import_obsidian4 = require("obsidian");
var ScreenshotService = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  /**
   * Captures the current frame from the active player, saves to vault, and embeds in the active note.
   */
  async captureAndInsert(player, sourceInfo, activeView, targetContainerEl) {
    try {
      const currentTime = await player.getCurrentTime();
      let buffer = null;
      if (player.captureFrame) {
        try {
          buffer = await player.captureFrame(this.settings.screenshotFormat, this.settings.screenshotQuality);
        } catch {
          buffer = null;
        }
      }
      if (!buffer) {
        const videoEl = player.getVideoElement ? player.getVideoElement() : null;
        const targetEl = videoEl || targetContainerEl;
        if (targetEl) {
          buffer = await this.captureViaElectron(targetEl);
        }
      }
      if (!buffer && sourceInfo.type === "youtube" && sourceInfo.videoId) {
        buffer = await this.fetchYouTubeThumbnail(sourceInfo.videoId, sourceInfo.isShorts);
      }
      if (!buffer || buffer.byteLength === 0) {
        new import_obsidian4.Notice("MediaScribe: Could not capture frame from this media source.");
        return false;
      }
      const timestampStr = formatSeconds(currentTime).replace(/:/g, "-");
      const dateStr = this.getFormattedDate();
      const ext = this.settings.screenshotFormat;
      const baseFilename = `${this.settings.screenshotNamingPrefix}${dateStr}_${timestampStr}.${ext}`;
      const activeFile = activeView?.file;
      const filePath = await this.getTargetAttachmentPath(baseFilename, activeFile);
      await this.app.vault.createBinary(filePath, buffer);
      if (activeView && activeView.editor) {
        const fileObj = this.app.vault.getAbstractFileByPath(filePath);
        let linkText = "";
        if (fileObj instanceof import_obsidian4.TFile) {
          linkText = this.app.fileManager.generateMarkdownLink(fileObj, activeFile?.path || "");
        } else {
          linkText = `![[${baseFilename}]]`;
        }
        const timeDisplay = formatSeconds(currentTime);
        const secInt = Math.floor(currentTime);
        const embedText = this.settings.screenshotIncludeTimestamp ? `[${timeDisplay}](#t=${secInt})
${linkText}
` : `${linkText}
`;
        activeView.editor.replaceSelection(embedText);
      }
      new import_obsidian4.Notice(`MediaScribe: Frame captured [${formatSeconds(currentTime)}]`);
      return true;
    } catch (err) {
      console.error("[MediaScribe] Frame capture failed:", err);
      new import_obsidian4.Notice("MediaScribe: Failed to save frame screenshot.");
      return false;
    }
  }
  /**
   * Attempts to capture bounding box of an element using Electron capturePage if in desktop app
   */
  async captureViaElectron(el) {
    try {
      const electron = window.require ? window.require("electron") : null;
      if (!electron) return null;
      const remote = electron.remote;
      const currentWebContents = remote?.getCurrentWebContents ? remote.getCurrentWebContents() : electron.webFrame;
      if (!currentWebContents || !currentWebContents.capturePage) return null;
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const nativeImage = await currentWebContents.capturePage({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
      if (!nativeImage || nativeImage.isEmpty()) return null;
      const buffer = this.settings.screenshotFormat === "jpeg" ? nativeImage.toJPEG(Math.round(this.settings.screenshotQuality * 100)) : nativeImage.toPNG();
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch {
      return null;
    }
  }
  /**
   * Fetches YouTube maxresdefault / hqdefault / oar2 thumbnail
   */
  async fetchYouTubeThumbnail(videoId, isShorts) {
    const urls = [];
    if (isShorts) {
      urls.push(`https://i.ytimg.com/vi/${videoId}/oar2.jpg`);
    }
    urls.push(
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    );
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 1e3) {
            return buf;
          }
        }
      } catch {
      }
    }
    return null;
  }
  async getTargetAttachmentPath(filename, activeFile) {
    const customFolder = this.settings.screenshotFolder.trim();
    if (customFolder) {
      const folderExists = await this.app.vault.adapter.exists(customFolder);
      if (!folderExists) {
        await this.app.vault.createFolder(customFolder);
      }
      return `${customFolder}/${filename}`;
    }
    if (activeFile) {
      return await this.app.fileManager.getAvailablePathForAttachment(filename, activeFile.path);
    }
    return filename;
  }
  getFormattedDate() {
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
};

// src/services/timestampService.ts
var import_obsidian5 = require("obsidian");
var TimestampService = class {
  constructor(_app, settings, playerGetter, sourceGetter) {
    this.settings = settings;
    this.playerGetter = playerGetter;
    this.sourceGetter = sourceGetter;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  /**
   * Formats seconds into string according to user's setting
   */
  formatTimestamp(seconds) {
    const formattedTime = formatSeconds(seconds, !this.settings.includeTimestampLeadingZero);
    const secInt = Math.floor(seconds);
    switch (this.settings.timestampFormat) {
      case "full_url_link": {
        const source = this.sourceGetter ? this.sourceGetter() : null;
        if (source) {
          if (source.type === "youtube" && source.videoId) {
            return `[${formattedTime}](https://youtu.be/${source.videoId}?t=${secInt})`;
          }
          if (source.isLocal && source.localFile) {
            return `[${formattedTime}](${encodeURI(source.localFile.name)}#t=${secInt})`;
          }
          if (source.url && (source.url.startsWith("http://") || source.url.startsWith("https://"))) {
            const separator = source.url.includes("?") ? "&" : "?";
            return `[${formattedTime}](${source.url}${separator}t=${secInt})`;
          }
        }
        return `[${formattedTime}](#t=${secInt})`;
      }
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
        return `[${formattedTime}]`;
    }
  }
  /**
   * Inserts the current player timestamp into active markdown editor
   */
  async insertCurrentTimestamp(activeView) {
    const player = this.playerGetter();
    if (!player) {
      new import_obsidian5.Notice("MediaScribe: No active media player.");
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
      new import_obsidian5.Notice(`MediaScribe: Current time ${formatted}`);
    }
  }
  /**
   * Seeks the player if a timestamp string is clicked
   */
  handleTimestampClick(text) {
    const seconds = parseTimestamp(text);
    if (seconds !== null) {
      const player = this.playerGetter();
      if (player) {
        player.seekTo(seconds);
        new import_obsidian5.Notice(`MediaScribe: Jumped to ${formatSeconds(seconds)}`);
        return true;
      }
    }
    return false;
  }
};

// src/services/typingScribeService.ts
var import_obsidian6 = require("obsidian");
var TypingScribeService = class {
  constructor(_app, settings) {
    this.player = null;
    this.isEnabled = false;
    this.wasPlayingBeforeTyping = false;
    this.resumeTimeout = null;
    this.pendingKeystrokes = 0;
    this.charResetTimeout = null;
    this.settings = settings;
    this.isEnabled = settings.autoPauseOnTyping;
  }
  updateSettings(settings) {
    this.settings = settings;
    this.isEnabled = settings.autoPauseOnTyping;
  }
  setPlayer(player) {
    this.player = player;
  }
  toggle() {
    this.isEnabled = !this.isEnabled;
    this.settings.autoPauseOnTyping = this.isEnabled;
    new import_obsidian6.Notice(`MediaScribe: Typing Scribe (Auto-pause) is now ${this.isEnabled ? "ON" : "OFF"}`);
    return this.isEnabled;
  }
  get active() {
    return this.isEnabled;
  }
  /**
   * Called when editor content changes
   */
  handleEditorChange() {
    if (!this.isEnabled || !this.player || !this.player.isReady) {
      return;
    }
    const threshold = Math.max(1, this.settings.autoPauseCharThreshold ?? 3);
    if (this.wasPlayingBeforeTyping) {
      this.scheduleResume();
      return;
    }
    if (!this.player.isPlaying) {
      return;
    }
    this.pendingKeystrokes++;
    if (this.charResetTimeout !== null) {
      window.clearTimeout(this.charResetTimeout);
      this.charResetTimeout = null;
    }
    if (this.pendingKeystrokes >= threshold) {
      this.wasPlayingBeforeTyping = true;
      this.player.pause();
      this.pendingKeystrokes = 0;
      this.scheduleResume();
    } else {
      this.charResetTimeout = window.setTimeout(() => {
        this.pendingKeystrokes = 0;
        this.charResetTimeout = null;
      }, 1500);
    }
  }
  scheduleResume() {
    if (this.resumeTimeout !== null) {
      window.clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }
    const idleMs = Math.max(500, this.settings.autoPauseIdleResumeSec * 1e3);
    this.resumeTimeout = window.setTimeout(async () => {
      if (!this.player || !this.isEnabled) return;
      if (this.wasPlayingBeforeTyping) {
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
  destroy() {
    if (this.resumeTimeout !== null) {
      window.clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }
    if (this.charResetTimeout !== null) {
      window.clearTimeout(this.charResetTimeout);
      this.charResetTimeout = null;
    }
  }
};

// src/services/transcriptService.ts
var import_obsidian8 = require("obsidian");

// src/utils/youtube.ts
var import_obsidian7 = require("obsidian");
var titleCache = /* @__PURE__ */ new Map();
var metadataCache = /* @__PURE__ */ new Map();
var playlistCache = /* @__PURE__ */ new Map();
function cacheYouTubeTitle(videoId, title) {
  if (videoId && title) {
    titleCache.set(videoId, title);
  }
}
function getCachedYouTubeTitle(videoId) {
  return titleCache.get(videoId) || null;
}
async function fetchYouTubeTitle(videoId) {
  if (!videoId) return null;
  if (titleCache.has(videoId)) {
    return titleCache.get(videoId);
  }
  if (metadataCache.has(videoId) && metadataCache.get(videoId)?.title) {
    const t = metadataCache.get(videoId).title;
    titleCache.set(videoId, t);
    return t;
  }
  try {
    const res = await (0, import_obsidian7.requestUrl)({
      url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    });
    if (res.status === 200 && res.json && res.json.title) {
      const title = String(res.json.title).trim();
      if (title) {
        titleCache.set(videoId, title);
        return title;
      }
    }
  } catch {
  }
  try {
    const res2 = await (0, import_obsidian7.requestUrl)({
      url: `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    });
    if (res2.status === 200 && res2.json && res2.json.title) {
      const title = String(res2.json.title).trim();
      if (title) {
        titleCache.set(videoId, title);
        return title;
      }
    }
  } catch {
  }
  return null;
}
async function fetchYouTubeVideoMetadata(videoId) {
  if (!videoId) return null;
  if (metadataCache.has(videoId)) {
    return metadataCache.get(videoId);
  }
  try {
    const res = await (0, import_obsidian7.requestUrl)({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": "CONSENT=YES+1; SOCS=CAESEwgDEgk2MTc4NDQ2NzEaAmVuIAEaBgiA_LyaBg;"
      }
    });
    if (res.status === 200 && res.text) {
      const html = res.text;
      const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
      if (match) {
        const data = JSON.parse(match[1]);
        const details = data?.videoDetails;
        if (details) {
          const isShorts = /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.youtube\.com\/shorts\//i.test(html) || html.includes('"isShorts":true') || html.includes(`/shorts/${videoId}`);
          const meta = {
            title: details.title || void 0,
            description: details.shortDescription || void 0,
            author: details.author || void 0,
            lengthSeconds: typeof details.lengthSeconds === "string" ? parseInt(details.lengthSeconds, 10) : details.lengthSeconds,
            isShorts
          };
          if (meta.title) {
            titleCache.set(videoId, meta.title);
          }
          metadataCache.set(videoId, meta);
          return meta;
        }
      }
    }
  } catch (err) {
    console.warn(`[MediaScribe] Failed to fetch video description for ${videoId}:`, err);
  }
  return null;
}
async function fetchYouTubePlaylistItems(playlistId) {
  if (!playlistId) return [];
  if (playlistCache.has(playlistId)) {
    return playlistCache.get(playlistId);
  }
  try {
    const res = await (0, import_obsidian7.requestUrl)({
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": "CONSENT=YES+1; SOCS=CAESEwgDEgk2MTc4NDQ2NzEaAmVuIAEaBgiA_LyaBg;"
      }
    });
    if (res.status === 200 && res.text) {
      const html = res.text;
      const match = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\});<\/script>/) || html.match(/ytInitialData\s*=\s*(\{.+?\});/);
      if (match) {
        let search2 = function(obj, depth = 0) {
          if (!obj || depth > 12) return;
          if (Array.isArray(obj)) {
            for (const item of obj) search2(item, depth + 1);
            return;
          }
          if (typeof obj === "object") {
            if (obj.playlistVideoRenderer) {
              const v = obj.playlistVideoRenderer;
              if (v.videoId && !seenIds.has(v.videoId)) {
                seenIds.add(v.videoId);
                const title = v.title?.runs?.[0]?.text || v.title?.simpleText || "Unknown Video";
                titleCache.set(v.videoId, title);
                const itemIdx = seenIds.size - 1;
                items.push({
                  title,
                  duration: v.lengthText?.simpleText || "",
                  videoId: v.videoId,
                  source: {
                    type: "youtube",
                    url: `https://www.youtube.com/watch?v=${v.videoId}&list=${playlistId}&index=${itemIdx + 1}`,
                    originalInput: `https://www.youtube.com/watch?v=${v.videoId}&list=${playlistId}&index=${itemIdx + 1}`,
                    videoId: v.videoId,
                    playlistId,
                    playlistIndex: itemIdx,
                    isPlaylist: true,
                    isLocal: false,
                    title
                  }
                });
              }
            } else if (obj.lockupViewModel && obj.lockupViewModel.contentId) {
              const v = obj.lockupViewModel;
              const vId = v.contentId;
              if (vId && !seenIds.has(vId)) {
                seenIds.add(vId);
                const title = v.metadata?.lockupMetadataViewModel?.title?.content || v.rendererContext?.accessibilityContext?.label?.split(/\s+\d+\s+(?:minutes?|seconds?|hours?)/)[0] || "Unknown Video";
                titleCache.set(vId, title);
                const itemIdx = seenIds.size - 1;
                items.push({
                  title,
                  duration: "",
                  videoId: vId,
                  source: {
                    type: "youtube",
                    url: `https://www.youtube.com/watch?v=${vId}&list=${playlistId}&index=${itemIdx + 1}`,
                    originalInput: `https://www.youtube.com/watch?v=${vId}&list=${playlistId}&index=${itemIdx + 1}`,
                    videoId: vId,
                    playlistId,
                    playlistIndex: itemIdx,
                    isPlaylist: true,
                    isLocal: false,
                    title
                  }
                });
              }
            } else {
              for (const k of Object.keys(obj)) {
                search2(obj[k], depth + 1);
              }
            }
          }
        };
        var search = search2;
        const data = JSON.parse(match[1]);
        const items = [];
        const seenIds = /* @__PURE__ */ new Set();
        search2(data);
        if (items.length > 0) {
          playlistCache.set(playlistId, items);
          return items;
        }
      }
    }
  } catch (err) {
    console.warn(`[MediaScribe] Failed to fetch playlist items for ${playlistId}:`, err);
  }
  return [];
}

// src/services/transcriptService.ts
var INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
var INNERTUBE_PLAYER_URL = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`;
var IOS_USER_AGENT = "com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)";
var INNERTUBE_CONTEXT = {
  client: {
    clientName: "IOS",
    clientVersion: "20.10.38",
    hl: "en",
    gl: "US"
  }
};
function decodeHtmlEntities(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10))).replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16))).replace(/<[^>]+>/g, "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}
var TranscriptService = class {
  constructor(app) {
    this.app = app;
  }
  /**
   * Tries to find and load local SRT or VTT file for a given video file
   */
  async loadLocalTranscriptForFile(videoFile) {
    const parentPath = videoFile.parent ? videoFile.parent.path : "";
    const baseName = videoFile.basename;
    const candidateExtensions = [".srt", ".vtt", ".en.srt", ".en.vtt"];
    for (const ext of candidateExtensions) {
      const fullPath = parentPath ? `${parentPath}/${baseName}${ext}` : `${baseName}${ext}`;
      const abstractFile = this.app.vault.getAbstractFileByPath(fullPath);
      if (abstractFile instanceof import_obsidian8.TFile) {
        const content = await this.app.vault.read(abstractFile);
        if (ext.includes("vtt")) {
          return this.parseVTT(content);
        } else {
          return this.parseSRT(content);
        }
      }
    }
    return null;
  }
  /**
   * Tries to fetch YouTube captions/subtitles using Innertube Player API with watch-page fallback
   */
  async fetchYouTubeTranscript(videoId) {
    if (!videoId) return null;
    try {
      let playerData = null;
      try {
        const res = await (0, import_obsidian8.requestUrl)({
          url: INNERTUBE_PLAYER_URL,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": IOS_USER_AGENT
          },
          body: JSON.stringify({
            context: INNERTUBE_CONTEXT,
            videoId
          })
        });
        playerData = res.json;
      } catch (err) {
        const fetchRes = await fetch(INNERTUBE_PLAYER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": IOS_USER_AGENT
          },
          body: JSON.stringify({
            context: INNERTUBE_CONTEXT,
            videoId
          })
        });
        if (fetchRes.ok) {
          playerData = await fetchRes.json();
        }
      }
      if (playerData) {
        const videoTitle = playerData.videoDetails?.title;
        if (videoTitle) {
          cacheYouTubeTitle(videoId, videoTitle);
        }
        const captions = playerData.captions?.playerCaptionsTracklistRenderer;
        if (captions && captions.captionTracks && captions.captionTracks.length > 0) {
          let track = captions.captionTracks.find((t) => t.languageCode === "en");
          if (!track) {
            track = captions.captionTracks.find((t) => t.languageCode && t.languageCode.startsWith("en"));
          }
          if (!track) {
            track = captions.captionTracks[0];
          }
          if (track && track.baseUrl) {
            let timedTextContent = "";
            try {
              const trackRes = await (0, import_obsidian8.requestUrl)({
                url: track.baseUrl,
                method: "GET",
                headers: {
                  "Accept-Language": "en-US,en;q=0.9",
                  "User-Agent": IOS_USER_AGENT
                }
              });
              timedTextContent = trackRes.text;
            } catch {
              const fetchTrack = await fetch(track.baseUrl, {
                headers: {
                  "Accept-Language": "en-US,en;q=0.9",
                  "User-Agent": IOS_USER_AGENT
                }
              });
              if (fetchTrack.ok) {
                timedTextContent = await fetchTrack.text();
              }
            }
            if (timedTextContent) {
              const items = this.parseYouTubeXML(timedTextContent);
              if (items.length > 0) {
                return items;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[MediaScribe] Innertube caption fetch failed, trying watch page fallback:", e);
    }
    try {
      let html = "";
      try {
        const res = await (0, import_obsidian8.requestUrl)({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+478"
          }
        });
        html = res.text;
      } catch {
        const fetchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+478"
          }
        });
        if (fetchRes.ok) html = await fetchRes.text();
      }
      if (html) {
        const idx = html.indexOf('"captionTracks"');
        if (idx !== -1) {
          const start = html.indexOf("[", idx);
          if (start !== -1) {
            let depth = 0;
            let end = start;
            for (let i = start; i < html.length; i++) {
              if (html[i] === "[") depth++;
              else if (html[i] === "]") {
                depth--;
                if (depth === 0) {
                  end = i + 1;
                  break;
                }
              }
            }
            const jsonStr = html.slice(start, end);
            const captionTracks = JSON.parse(jsonStr);
            if (Array.isArray(captionTracks) && captionTracks.length > 0) {
              let track = captionTracks.find((t) => t.languageCode === "en");
              if (!track) {
                track = captionTracks.find((t) => t.languageCode && t.languageCode.startsWith("en"));
              }
              if (!track) {
                track = captionTracks[0];
              }
              if (track && track.baseUrl) {
                try {
                  const jRes = await (0, import_obsidian8.requestUrl)({ url: `${track.baseUrl}&fmt=json3` });
                  const json = jRes.json;
                  if (json && json.events && Array.isArray(json.events)) {
                    const items = [];
                    for (const ev of json.events) {
                      if (ev.segs && ev.tStartMs !== void 0) {
                        const text = decodeHtmlEntities(ev.segs.map((s) => s.utf8 || "").join(""));
                        if (text) {
                          const itemStart = ev.tStartMs / 1e3;
                          const itemEnd = (ev.tStartMs + (ev.dDurationMs || 2e3)) / 1e3;
                          items.push({ start: itemStart, end: itemEnd, text });
                        }
                      }
                    }
                    if (items.length > 0) return items;
                  }
                } catch {
                }
                const xmlRes = await (0, import_obsidian8.requestUrl)({ url: track.baseUrl });
                if (xmlRes.text) {
                  const items = this.parseYouTubeXML(xmlRes.text);
                  if (items.length > 0) return items;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[MediaScribe] Could not fetch YouTube transcript via fallback:", err);
    }
    return null;
  }
  /**
   * Parses YouTube XML timedtext format:
   * Supports both <text start="12.34" dur="4.56">...</text> and <p t="12340" d="4560">...</p>
   */
  parseYouTubeXML(xml) {
    const items = [];
    const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
    let match;
    while ((match = textRegex.exec(xml)) !== null) {
      const start = parseFloat(match[1]);
      const dur = match[2] ? parseFloat(match[2]) : 2.5;
      const text = decodeHtmlEntities(match[3]);
      if (text) {
        items.push({
          start,
          end: start + dur,
          text
        });
      }
    }
    if (items.length === 0) {
      const pRegex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/gi;
      while ((match = pRegex.exec(xml)) !== null) {
        const offsetMs = parseInt(match[1], 10);
        const durationMs = match[2] ? parseInt(match[2], 10) : 2500;
        const text = decodeHtmlEntities(match[3]);
        if (text) {
          items.push({
            start: offsetMs / 1e3,
            end: (offsetMs + durationMs) / 1e3,
            text
          });
        }
      }
    }
    return items;
  }
  /**
   * Parses SRT format
   */
  parseSRT(srt) {
    const items = [];
    const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const blocks = normalized.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split("\n");
      if (lines.length < 2) continue;
      let timeIndex = 0;
      if (/^\d+$/.test(lines[0].trim())) {
        timeIndex = 1;
      }
      const timeLine = lines[timeIndex];
      if (!timeLine || !timeLine.includes("-->")) continue;
      const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
      const start = this.parseTimecode(startStr);
      const end = this.parseTimecode(endStr);
      const text = lines.slice(timeIndex + 1).join(" ").trim();
      if (text && start !== null) {
        items.push({
          start,
          end: end ?? start + 3,
          text
        });
      }
    }
    return items;
  }
  /**
   * Parses WebVTT format
   */
  parseVTT(vtt) {
    const items = [];
    const normalized = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    let currentItem = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("WEBVTT") || line.startsWith("NOTE")) continue;
      if (line.includes("-->")) {
        const [startStr, endStr] = line.split("-->").map((s) => s.trim().split(" ")[0]);
        const start = this.parseTimecode(startStr);
        const end = this.parseTimecode(endStr);
        if (start !== null) {
          currentItem = { start, end: end ?? start + 3, text: "" };
        }
      } else if (currentItem) {
        if (currentItem.text) {
          currentItem.text += " " + line;
        } else {
          currentItem.text = line;
        }
        if (i + 1 >= lines.length || !lines[i + 1].trim()) {
          if (currentItem.text) {
            items.push(currentItem);
          }
          currentItem = null;
        }
      }
    }
    return items;
  }
  parseTimecode(str) {
    if (!str) return null;
    const clean = str.replace(",", ".").trim();
    const parts = clean.split(":");
    if (parts.length === 3) {
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      return m * 60 + s;
    }
    return parseTimestamp(str);
  }
};

// src/services/embeddedPlayerManager.ts
var import_obsidian15 = require("obsidian");

// src/ui/MediaScribeEmbeddedWidget.ts
var import_obsidian14 = require("obsidian");

// src/players/youtubePlayer.ts
var import_obsidian9 = require("obsidian");

// src/players/basePlayer.ts
var BasePlayer = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
    this._isReady = false;
    this._isPlaying = false;
    this.containerEl = null;
  }
  get isReady() {
    return this._isReady;
  }
  get isPlaying() {
    return this._isPlaying;
  }
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(listener);
  }
  off(event, listener) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }
  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(data);
        } catch (err) {
          console.error(`[MediaScribe] Error in player event listener for '${event}':`, err);
        }
      }
    }
  }
  jump(deltaSeconds) {
    this.getCurrentTime().then((current) => {
      this.seekTo(Math.max(0, current + deltaSeconds));
    });
  }
};

// src/players/youtubePlayer.ts
var YouTubePlayer = class extends BasePlayer {
  constructor(videoId, initialTime = 0, playlistId, hideNativeControls = false, hideOverlays = false, _cropZoom = 1, isShorts = false, autoPlay = false) {
    super();
    this.iframeEl = null;
    this.thumbOverlayEl = null;
    this.messageListener = null;
    this.pollInterval = null;
    this.currentTime = 0;
    this.duration = 0;
    this.playbackRate = 1;
    this.volume = 100;
    this.autoPlay = false;
    this.playerSizeEl = null;
    this.croppingDivEl = null;
    this.clickShieldEl = null;
    this.thumbPlayBtnEl = null;
    this._hasEnded = false;
    this.pendingSeekTime = null;
    this.videoId = videoId;
    this.initialTime = initialTime;
    this.playlistId = playlistId;
    this.hideNativeControls = hideNativeControls;
    this.hideOverlays = hideOverlays;
    this.isShorts = isShorts;
    this.autoPlay = autoPlay;
    this.currentTime = initialTime;
    this.pendingSeekTime = initialTime > 0 ? initialTime : null;
  }
  mount(container) {
    this.containerEl = container;
    container.empty();
    if (this.isShorts) {
      container.addClass("mediascribe-shorts-active");
    } else {
      container.removeClass("mediascribe-shorts-active");
    }
    const playerSize = container.createDiv({ cls: "mediascribe-player-size" });
    const croppingDiv = playerSize.createDiv({ cls: "mediascribe-cropping-div" });
    this.playerSizeEl = playerSize;
    this.croppingDivEl = croppingDiv;
    const divToCrop = croppingDiv.createDiv({ cls: "mediascribe-div-to-crop" });
    const wrapper = divToCrop.createDiv({ cls: "mediascribe-player-wrapper mediascribe-youtube-wrapper" });
    const controlsVal = this.hideNativeControls || this.hideOverlays || this.isShorts ? 0 : 1;
    const fsVal = 1;
    const autoPlayVal = this.autoPlay ? 1 : 0;
    const params = `enablejsapi=1&controls=${controlsVal}&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&cc_load_policy=3&cc_lang_pref=off&fs=${fsVal}&autoplay=${autoPlayVal}`;
    let src = "";
    if (this.playlistId && !this.videoId) {
      src = `https://www.youtube.com/embed/videoseries?list=${this.playlistId}&${params}`;
    } else {
      src = `https://www.youtube.com/embed/${this.videoId}?${params}&start=${Math.floor(this.initialTime)}`;
    }
    this.iframeEl = wrapper.createEl("iframe", {
      cls: "mediascribe-iframe",
      attr: {
        src,
        frameborder: "0",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        allowfullscreen: "true"
      }
    });
    this.clickShieldEl = wrapper.createDiv({ cls: "mediascribe-shorts-click-shield" });
    this.clickShieldEl.addEventListener("click", () => {
      this.togglePlay();
    });
    if (this.isShorts) {
      playerSize.addClass("mediascribe-shorts-mode");
    } else if (this.hideOverlays) {
      playerSize.addClass("mediascribe-clean-crop-active");
    }
    if (!this.autoPlay && (this.hideOverlays || this.isShorts)) {
      this.createThumbnailOverlay(croppingDiv);
    }
    this.setupMessageListener();
    this.iframeEl.addEventListener("load", () => {
      this.sendListening();
      let attempts = 0;
      if (this.pollInterval !== null) {
        window.clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      this.pollInterval = window.setInterval(() => {
        attempts++;
        this.sendListening();
        if (this._isReady || attempts > 25) {
          if (this.pollInterval !== null) {
            window.clearInterval(this.pollInterval);
            this.pollInterval = null;
          }
          if (!this._isReady) {
            this._isReady = true;
            this.emit("ready");
          }
        }
      }, 250);
    });
  }
  disableCaptions() {
    this.sendPostMessage("unloadModule", ["captions"]);
    this.sendPostMessage("unloadModule", ["cc"]);
    this.sendPostMessage("setOption", ["captions", "track", {}]);
    this.sendPostMessage("setOption", ["cc", "track", {}]);
  }
  sendListening() {
    if (!this.iframeEl || !this.iframeEl.contentWindow) return;
    try {
      this.iframeEl.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }),
        "*"
      );
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "getDuration", args: [] }),
        "*"
      );
      this.disableCaptions();
    } catch {
    }
  }
  setupMessageListener() {
    this.messageListener = (event) => {
      if (!this.iframeEl || !this.iframeEl.contentWindow || event.source !== this.iframeEl.contentWindow) {
        return;
      }
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      if (data.event === "onReady" || data.event === "initialDelivery" || data.event === "onApiChange") {
        this.disableCaptions();
        if (!this._isReady) {
          this._isReady = true;
          this.sendListening();
          this.emit("ready");
        }
      }
      let state = null;
      if (data.event === "onStateChange") {
        if (typeof data.info === "number") state = data.info;
        else if (typeof data.data === "number") state = data.data;
      } else if (data.event === "infoDelivery" && data.info && typeof data.info.playerState === "number") {
        state = data.info.playerState;
      }
      if (state !== null) {
        if (state === 1) {
          this._hasEnded = false;
          this.disableCaptions();
          this.hideThumbnail();
          this._isPlaying = true;
          if (this.pendingSeekTime !== null && this.pendingSeekTime > 0) {
            const seek = this.pendingSeekTime;
            this.pendingSeekTime = null;
            this.seekTo(seek);
          }
          this.emit("play");
        } else if (state === 2) {
          this._isPlaying = false;
          this.emit("pause");
        } else if (state === 0) {
          this._isPlaying = false;
          this.pendingSeekTime = null;
          this.showEndedOverlay();
          this.emit("ended");
        }
      }
      let dur = null;
      if (data.event === "infoDelivery" && data.info && typeof data.info.duration === "number" && data.info.duration > 0) {
        dur = data.info.duration;
      } else if (typeof data.result === "number" && data.result > 0) {
        dur = data.result;
      } else if (data.info && typeof data.info.duration === "number" && data.info.duration > 0) {
        dur = data.info.duration;
      }
      if (dur !== null && dur > 0 && this.duration !== dur) {
        this.duration = dur;
        this.emit("durationchange", this.duration);
      }
      if (data.event === "infoDelivery" && data.info) {
        const info = data.info;
        if (typeof info.currentTime === "number") {
          if (this.pendingSeekTime !== null && this.pendingSeekTime > 0 && Math.abs(info.currentTime - this.pendingSeekTime) > 2) {
            const seek = this.pendingSeekTime;
            this.pendingSeekTime = null;
            this.seekTo(seek);
          }
          this.currentTime = info.currentTime;
          this.emit("timeupdate", this.currentTime);
          if (this.duration <= 0) {
            this.sendPostMessage("getDuration");
          }
        }
        if (typeof info.playbackRate === "number") {
          this.playbackRate = info.playbackRate;
          this.emit("ratechange", this.playbackRate);
        }
        if (typeof info.volume === "number") {
          this.volume = info.volume;
        }
        if (typeof info.playlistIndex === "number" && info.playlistIndex >= 0 && Boolean(this.playlistId && !this.videoId)) {
          this.emit("playlistindexchange", info.playlistIndex);
        }
        if (info.videoData && info.videoData.video_id) {
          this.setVideoId(info.videoData.video_id);
        }
      }
    };
    window.addEventListener("message", this.messageListener);
  }
  setVideoId(videoId) {
    if (!videoId || this.videoId === videoId) return;
    this.videoId = videoId;
    if (!this._isPlaying) {
      if (this.thumbOverlayEl) {
        this.thumbOverlayEl.removeClass("is-hidden");
        this.updateThumbnailImage();
      } else if (this.croppingDivEl) {
        this.createThumbnailOverlay(this.croppingDivEl);
      }
    }
  }
  createThumbnailOverlay(container) {
    if (this.thumbOverlayEl) return;
    this.thumbOverlayEl = container.createDiv({ cls: "mediascribe-thumb-overlay" });
    if (this.videoId) {
      this.updateThumbnailImage();
    }
    this.thumbPlayBtnEl = this.thumbOverlayEl.createDiv({ cls: "mediascribe-thumb-play-btn is-play-state" });
    (0, import_obsidian9.setIcon)(this.thumbPlayBtnEl, "play");
    this.thumbOverlayEl.addEventListener("click", () => {
      this.play();
    });
  }
  showEndedOverlay() {
    this._hasEnded = true;
    if (!this.thumbOverlayEl && this.croppingDivEl) {
      this.createThumbnailOverlay(this.croppingDivEl);
    }
    if (this.thumbOverlayEl) {
      this.updateThumbnailImage();
      if (this.thumbPlayBtnEl) {
        this.thumbPlayBtnEl.empty();
        this.thumbPlayBtnEl.removeClass("is-play-state");
        this.thumbPlayBtnEl.addClass("is-replay-state");
        (0, import_obsidian9.setIcon)(this.thumbPlayBtnEl, "rotate-ccw");
        this.thumbPlayBtnEl.setAttribute("title", "Replay");
      }
      this.thumbOverlayEl.removeClass("is-hidden");
    }
  }
  updateThumbnailImage() {
    if (!this.thumbOverlayEl || !this.videoId) return;
    if (this.isShorts) {
      const oar2 = `https://i.ytimg.com/vi/${this.videoId}/oar2.jpg`;
      const maxres = `https://img.youtube.com/vi/${this.videoId}/maxresdefault.jpg`;
      const imgCheck = new Image();
      imgCheck.onload = () => {
        if (imgCheck.naturalWidth > 120 && this.thumbOverlayEl) {
          this.thumbOverlayEl.style.backgroundImage = `url('${oar2}')`;
        } else if (this.thumbOverlayEl) {
          this.thumbOverlayEl.style.backgroundImage = `url('${maxres}')`;
        }
      };
      imgCheck.onerror = () => {
        if (this.thumbOverlayEl) {
          this.thumbOverlayEl.style.backgroundImage = `url('${maxres}')`;
        }
      };
      imgCheck.src = oar2;
      this.thumbOverlayEl.style.backgroundImage = `url('${oar2}')`;
    } else {
      const hq720 = `https://i.ytimg.com/vi/${this.videoId}/hq720.jpg`;
      const maxres = `https://img.youtube.com/vi/${this.videoId}/maxresdefault.jpg`;
      const mq = `https://img.youtube.com/vi/${this.videoId}/mqdefault.jpg`;
      this.thumbOverlayEl.style.backgroundImage = `url('${hq720}')`;
      const imgCheck = new Image();
      imgCheck.onload = () => {
        if (imgCheck.naturalWidth > 120 && this.thumbOverlayEl) {
          this.thumbOverlayEl.style.backgroundImage = `url('${hq720}')`;
        } else if (this.thumbOverlayEl) {
          const maxCheck = new Image();
          maxCheck.onload = () => {
            if (maxCheck.naturalWidth > 120 && this.thumbOverlayEl) {
              this.thumbOverlayEl.style.backgroundImage = `url('${maxres}')`;
            } else if (this.thumbOverlayEl) {
              this.thumbOverlayEl.style.backgroundImage = `url('${mq}')`;
            }
          };
          maxCheck.onerror = () => {
            if (this.thumbOverlayEl) {
              this.thumbOverlayEl.style.backgroundImage = `url('${mq}')`;
            }
          };
          maxCheck.src = maxres;
        }
      };
      imgCheck.onerror = () => {
        if (this.thumbOverlayEl) {
          this.thumbOverlayEl.style.backgroundImage = `url('${mq}')`;
        }
      };
      imgCheck.src = hq720;
    }
  }
  hideThumbnail() {
    if (this.thumbOverlayEl) {
      this.thumbOverlayEl.addClass("is-hidden");
    }
    if (this.thumbPlayBtnEl) {
      this.thumbPlayBtnEl.empty();
      this.thumbPlayBtnEl.removeClass("is-replay-state");
      this.thumbPlayBtnEl.addClass("is-play-state");
      (0, import_obsidian9.setIcon)(this.thumbPlayBtnEl, "play");
      this.thumbPlayBtnEl.removeAttribute("title");
    }
  }
  sendPostMessage(func, args = []) {
    if (!this.iframeEl || !this.iframeEl.contentWindow) return;
    try {
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func,
          args
        }),
        "*"
      );
    } catch (err) {
      console.warn("[MediaScribe] Failed to send postMessage to YouTube iframe:", err);
    }
  }
  async play() {
    if (this._hasEnded) {
      this._hasEnded = false;
      this.seekTo(0);
    }
    this.hideThumbnail();
    this.sendPostMessage("playVideo");
    this.disableCaptions();
    this._isPlaying = true;
    this.emit("play");
  }
  async pause() {
    this.sendPostMessage("pauseVideo");
    this._isPlaying = false;
    this.emit("pause");
  }
  async togglePlay() {
    if (this._isPlaying) {
      await this.pause();
    } else {
      await this.play();
    }
  }
  seekTo(seconds) {
    this._hasEnded = false;
    this.currentTime = Math.max(0, seconds);
    this.sendPostMessage("seekTo", [this.currentTime, true]);
    this.emit("timeupdate", this.currentTime);
  }
  async getCurrentTime() {
    return this.currentTime;
  }
  async getDuration() {
    return this.duration;
  }
  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.sendPostMessage("setPlaybackRate", [rate]);
  }
  async getPlaybackRate() {
    return this.playbackRate;
  }
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(100, volume));
    this.sendPostMessage("setVolume", [this.volume]);
  }
  async getVolume() {
    return this.volume;
  }
  nextVideo() {
    this.sendPostMessage("nextVideo");
  }
  previousVideo() {
    this.sendPostMessage("previousVideo");
  }
  playVideoAt(index, startSeconds = 0) {
    this.pendingSeekTime = startSeconds > 0 ? startSeconds : null;
    this.sendPostMessage("playVideoAt", [index]);
  }
  getIFrameElement() {
    return this.iframeEl;
  }
  getVideoElement() {
    if (this.hideOverlays && this.croppingDivEl) {
      return this.croppingDivEl;
    }
    return this.playerSizeEl || this.containerEl;
  }
  setShortsMode(isShorts) {
    this.isShorts = isShorts;
    if (this.containerEl) {
      this.containerEl.toggleClass("mediascribe-shorts-active", isShorts);
    }
    if (this.playerSizeEl) {
      this.playerSizeEl.toggleClass("mediascribe-shorts-mode", isShorts);
      if (isShorts) {
        this.playerSizeEl.removeClass("mediascribe-clean-crop-active");
        if (!this._isPlaying) {
          if (this.thumbOverlayEl) {
            this.thumbOverlayEl.removeClass("is-hidden");
            this.updateThumbnailImage();
          } else if (this.croppingDivEl) {
            this.createThumbnailOverlay(this.croppingDivEl);
          }
        }
      } else if (this.hideOverlays) {
        this.playerSizeEl.addClass("mediascribe-clean-crop-active");
        if (this.thumbOverlayEl && !this._isPlaying) {
          this.thumbOverlayEl.removeClass("is-hidden");
          this.updateThumbnailImage();
        }
      }
    }
  }
  destroy() {
    this.containerEl?.removeClass("mediascribe-shorts-active");
    if (this.clickShieldEl) {
      this.clickShieldEl.remove();
      this.clickShieldEl = null;
    }
    if (this.thumbOverlayEl) {
      this.thumbOverlayEl.remove();
      this.thumbOverlayEl = null;
    }
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }
    if (this.pollInterval !== null) {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.iframeEl) {
      this.iframeEl.remove();
      this.iframeEl = null;
    }
    this.listeners.clear();
    this._isReady = false;
    this._isPlaying = false;
  }
};

// src/players/html5Player.ts
var import_obsidian10 = require("obsidian");
var HTML5Player = class extends BasePlayer {
  constructor(url, isAudioOnly = false, initialTime = 0) {
    super();
    this.mediaEl = null;
    this.centerOverlayEl = null;
    this.centerPlayBtn = null;
    this._hasEnded = false;
    this.url = url;
    this.isAudioOnly = isAudioOnly;
    this.initialTime = initialTime;
  }
  mount(container) {
    this.containerEl = container;
    container.empty();
    const wrapper = container.createDiv({
      cls: `mediascribe-player-wrapper ${this.isAudioOnly ? "mediascribe-audio-wrapper" : "mediascribe-video-wrapper"}`
    });
    if (this.isAudioOnly) {
      const audio = wrapper.createEl("audio", {
        cls: "mediascribe-media-element",
        attr: {
          controls: "true",
          preload: "metadata"
        }
      });
      audio.src = this.url;
      this.mediaEl = audio;
    } else {
      const video = wrapper.createEl("video", {
        cls: "mediascribe-media-element",
        attr: {
          preload: "metadata",
          playsinline: "true",
          crossorigin: "anonymous"
        }
      });
      video.crossOrigin = "anonymous";
      video.src = this.url;
      this.mediaEl = video;
      video.addEventListener("loadedmetadata", () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          wrapper.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        }
      });
      this.centerOverlayEl = wrapper.createDiv({ cls: "mediascribe-html5-center-overlay" });
      this.centerPlayBtn = this.centerOverlayEl.createDiv({ cls: "mediascribe-html5-center-play-btn" });
      (0, import_obsidian10.setIcon)(this.centerPlayBtn, "play");
      this.centerOverlayEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
      video.addEventListener("click", () => {
        this.togglePlay();
      });
      wrapper.addEventListener("dblclick", () => {
        if (!document.fullscreenElement) {
          wrapper.requestFullscreen?.().catch(() => {
          });
        } else {
          document.exitFullscreen?.().catch(() => {
          });
        }
      });
    }
    this.bindEvents();
  }
  bindEvents() {
    if (!this.mediaEl) return;
    const media = this.mediaEl;
    const notifyDuration = () => {
      const dur = media.duration;
      if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
        this.emit("durationchange", dur);
      }
    };
    media.addEventListener("loadedmetadata", () => {
      this._isReady = true;
      if (this.initialTime > 0) {
        this.seekTo(this.initialTime);
      }
      this.emit("ready");
      notifyDuration();
    });
    media.addEventListener("durationchange", notifyDuration);
    media.addEventListener("canplay", notifyDuration);
    if (media.readyState >= 1) {
      this._isReady = true;
      this.emit("ready");
      notifyDuration();
    }
    media.addEventListener("play", () => {
      this._isPlaying = true;
      this._hasEnded = false;
      if (this.centerOverlayEl) {
        this.centerOverlayEl.addClass("is-playing");
      }
      if (this.centerPlayBtn) {
        this.centerPlayBtn.empty();
        (0, import_obsidian10.setIcon)(this.centerPlayBtn, "play");
        this.centerPlayBtn.removeAttribute("title");
      }
      this.emit("play");
    });
    media.addEventListener("pause", () => {
      this._isPlaying = false;
      if (this.centerOverlayEl) {
        this.centerOverlayEl.removeClass("is-playing");
      }
      this.emit("pause");
    });
    media.addEventListener("timeupdate", () => {
      this.emit("timeupdate", media.currentTime || 0);
      notifyDuration();
    });
    media.addEventListener("ended", () => {
      this._isPlaying = false;
      this._hasEnded = true;
      if (this.centerOverlayEl) {
        this.centerOverlayEl.removeClass("is-playing");
      }
      if (this.centerPlayBtn) {
        this.centerPlayBtn.empty();
        (0, import_obsidian10.setIcon)(this.centerPlayBtn, "rotate-ccw");
        this.centerPlayBtn.setAttribute("title", "Replay");
      }
      this.emit("ended");
    });
    media.addEventListener("ratechange", () => {
      this.emit("ratechange", media.playbackRate || 1);
    });
    media.addEventListener("error", (e) => {
      console.error("[MediaScribe] HTML5 Media error:", e);
      this.emit("error", e);
    });
  }
  async play() {
    if (this.mediaEl) {
      try {
        if (this._hasEnded || this.mediaEl.ended || this.mediaEl.duration && this.mediaEl.currentTime >= this.mediaEl.duration - 0.5) {
          this._hasEnded = false;
          this.mediaEl.currentTime = 0;
        }
        await this.mediaEl.play();
        this._isPlaying = true;
      } catch (err) {
        console.warn("[MediaScribe] Autoplay or play blocked:", err);
      }
    }
  }
  async pause() {
    if (this.mediaEl) {
      this.mediaEl.pause();
      this._isPlaying = false;
    }
  }
  async togglePlay() {
    if (!this.mediaEl) return;
    if (this.mediaEl.paused || this._hasEnded) {
      await this.play();
    } else {
      await this.pause();
    }
  }
  seekTo(seconds) {
    if (this.mediaEl) {
      this._hasEnded = false;
      this.mediaEl.currentTime = Math.max(0, seconds);
      this.emit("timeupdate", this.mediaEl.currentTime);
    }
  }
  async getCurrentTime() {
    return this.mediaEl?.currentTime || 0;
  }
  async getDuration() {
    return this.mediaEl?.duration || 0;
  }
  setPlaybackRate(rate) {
    if (this.mediaEl) {
      this.mediaEl.playbackRate = rate;
    }
  }
  async getPlaybackRate() {
    return this.mediaEl?.playbackRate || 1;
  }
  setVolume(volume) {
    if (this.mediaEl) {
      this.mediaEl.volume = Math.max(0, Math.min(100, volume)) / 100;
    }
  }
  async getVolume() {
    return (this.mediaEl?.volume || 1) * 100;
  }
  async requestPictureInPicture() {
    if (this.mediaEl instanceof HTMLVideoElement) {
      if (document.pictureInPictureElement === this.mediaEl) {
        await document.exitPictureInPicture();
      } else {
        await this.mediaEl.requestPictureInPicture();
      }
    }
  }
  isInPictureInPicture() {
    return this.mediaEl instanceof HTMLVideoElement && document.pictureInPictureElement === this.mediaEl;
  }
  /**
   * Captures high-res video frame via Canvas
   */
  async captureFrame(format = "png", quality = 0.9) {
    try {
      if (this.isAudioOnly || !this.mediaEl || !(this.mediaEl instanceof HTMLVideoElement)) {
        return null;
      }
      const video = this.mediaEl;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve) => {
        try {
          const mime = format === "jpeg" ? "image/jpeg" : "image/png";
          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                resolve(null);
                return;
              }
              try {
                const buffer = await blob.arrayBuffer();
                resolve(buffer);
              } catch {
                resolve(null);
              }
            },
            mime,
            quality
          );
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  }
  getVideoElement() {
    if (this.mediaEl instanceof HTMLVideoElement) {
      return this.mediaEl;
    }
    return null;
  }
  destroy() {
    if (this.centerOverlayEl) {
      this.centerOverlayEl.remove();
      this.centerOverlayEl = null;
      this.centerPlayBtn = null;
    }
    if (this.mediaEl) {
      this.mediaEl.pause();
      this.mediaEl.src = "";
      this.mediaEl.load();
      this.mediaEl.remove();
      this.mediaEl = null;
    }
    this.listeners.clear();
    this._isReady = false;
    this._isPlaying = false;
  }
};

// src/services/ambientGlowService.ts
var AmbientGlowService = class {
  constructor() {
    this.ambientLayerEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this.youtubeBackdropEl = null;
    this.isEnabled = true;
    this.isRunning = false;
    this.animFrameId = null;
    this.lastDrawTime = 0;
    this.player = null;
    this.videoEl = null;
    // Bound event handlers for cleanup
    this.onPlay = () => this.handlePlay();
    this.onPause = () => this.handlePause();
    this.onTimeUpdate = () => this.handleTimeUpdate();
  }
  attach(containerEl, source, player, enabled) {
    this.destroy();
    this.player = player;
    this.isEnabled = enabled;
    this.ambientLayerEl = createDiv({ cls: "mediascribe-ambient-layer" });
    containerEl.prepend(this.ambientLayerEl);
    if (!this.isEnabled) {
      this.ambientLayerEl.addClass("is-hidden");
    }
    if (source.type === "youtube" && source.videoId) {
      this.setupYouTubeAmbient(source.videoId);
    } else if (source.type === "html5_video") {
      this.setupHTML5Ambient();
    }
  }
  setupHTML5Ambient() {
    if (!this.ambientLayerEl || !this.player) return;
    if (this.player instanceof HTML5Player) {
      this.videoEl = this.player.getVideoElement();
    }
    this.canvasEl = this.ambientLayerEl.createEl("canvas", {
      cls: "mediascribe-ambient-canvas",
      attr: { width: "64", height: "36" }
    });
    this.ctx = this.canvasEl.getContext("2d", { willReadFrequently: false });
    if (this.videoEl) {
      this.videoEl.addEventListener("loadeddata", () => this.drawFrame());
      this.videoEl.addEventListener("canplay", () => this.drawFrame());
      this.videoEl.addEventListener("seeked", () => this.drawFrame());
    }
    this.player.on("play", this.onPlay);
    this.player.on("pause", this.onPause);
    this.player.on("ended", this.onPause);
    this.player.on("timeupdate", this.onTimeUpdate);
    this.drawFrame();
    this.player.getCurrentTime().then(() => {
      this.drawFrame();
    });
  }
  setupYouTubeAmbient(videoId) {
    if (!this.ambientLayerEl) return;
    this.youtubeBackdropEl = this.ambientLayerEl.createDiv({
      cls: "mediascribe-ambient-youtube-backdrop"
    });
    const hqThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const maxresThumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    this.youtubeBackdropEl.style.backgroundImage = `url('${maxresThumb}')`;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 120 && this.youtubeBackdropEl) {
        this.youtubeBackdropEl.style.backgroundImage = `url('${hqThumb}')`;
      }
    };
    img.src = maxresThumb;
    this.player?.on("play", this.onPlay);
    this.player?.on("pause", this.onPause);
    this.player?.on("ended", this.onPause);
  }
  handlePlay() {
    if (!this.isEnabled) return;
    this.ambientLayerEl?.addClass("is-playing");
    if (!this.videoEl) return;
    this.isRunning = true;
    this.startLoop();
  }
  handlePause() {
    this.ambientLayerEl?.removeClass("is-playing");
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.drawFrame();
  }
  handleTimeUpdate() {
    if (!this.isRunning) {
      this.drawFrame();
    }
  }
  startLoop() {
    if (!this.isRunning) return;
    const now = performance.now();
    if (now - this.lastDrawTime >= 85) {
      this.drawFrame();
      this.lastDrawTime = now;
    }
    this.animFrameId = requestAnimationFrame(() => this.startLoop());
  }
  drawFrame() {
    if (!this.ctx || !this.canvasEl || !this.videoEl) return;
    if (this.videoEl.readyState < 2) return;
    try {
      this.ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
    } catch {
    }
  }
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (this.ambientLayerEl) {
      this.ambientLayerEl.toggleClass("is-hidden", !enabled);
    }
    if (enabled) {
      this.drawFrame();
      if (this.player) {
        this.handlePlay();
      }
    } else {
      this.isRunning = false;
      if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
  }
  destroy() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.player) {
      this.player.off("play", this.onPlay);
      this.player.off("pause", this.onPause);
      this.player.off("ended", this.onPause);
      this.player.off("timeupdate", this.onTimeUpdate);
      this.player = null;
    }
    this.videoEl = null;
    this.ctx = null;
    this.canvasEl = null;
    if (this.youtubeBackdropEl) {
      this.youtubeBackdropEl.remove();
      this.youtubeBackdropEl = null;
    }
    if (this.ambientLayerEl) {
      this.ambientLayerEl.remove();
      this.ambientLayerEl = null;
    }
  }
};

// src/ui/TranscriptPanel.ts
var import_obsidian11 = require("obsidian");
var TranscriptPanel = class {
  constructor(parentEl, app, playerGetter) {
    this.items = [];
    this.filteredItems = [];
    this.searchQuery = "";
    this.autoScroll = true;
    this.activeIndex = -1;
    this.isLoading = false;
    this.listEl = null;
    this.app = app;
    this.playerGetter = playerGetter;
    this.containerEl = parentEl.createDiv({ cls: "mediascribe-transcript-panel" });
    this.render();
  }
  setLoading(loading) {
    this.isLoading = loading;
    this.renderList();
  }
  setItems(items) {
    this.isLoading = false;
    this.items = items;
    this.applyFilter();
    this.renderList();
  }
  clear() {
    this.items = [];
    this.filteredItems = [];
    this.activeIndex = -1;
    this.isLoading = false;
    this.renderList();
  }
  setVisible(visible) {
    this.containerEl.toggleClass("is-hidden", !visible);
  }
  updateTime(currentTime) {
    if (this.items.length === 0) return;
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
  render() {
    this.containerEl.empty();
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
    const autoScrollBtn = actionsEl.createEl("button", {
      cls: `mediascribe-btn-icon ${this.autoScroll ? "is-active" : ""}`,
      attr: { title: "Toggle Auto-Scroll" }
    });
    (0, import_obsidian11.setIcon)(autoScrollBtn, "chevrons-down");
    autoScrollBtn.addEventListener("click", () => {
      this.autoScroll = !this.autoScroll;
      autoScrollBtn.toggleClass("is-active", this.autoScroll);
    });
    const insertAllBtn = actionsEl.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Insert Full Transcript into Note" }
    });
    (0, import_obsidian11.setIcon)(insertAllBtn, "file-text");
    insertAllBtn.addEventListener("click", () => this.insertFullTranscript());
    this.listEl = this.containerEl.createDiv({ cls: "mediascribe-transcript-list" });
    this.renderList();
  }
  applyFilter() {
    if (!this.searchQuery) {
      this.filteredItems = [...this.items];
    } else {
      this.filteredItems = this.items.filter(
        (item) => item.text.toLowerCase().includes(this.searchQuery)
      );
    }
  }
  renderList() {
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
      const row = this.listEl.createDiv({
        cls: `mediascribe-transcript-row ${index === this.activeIndex ? "is-active" : ""}`
      });
      const timePill = row.createSpan({ cls: "mediascribe-transcript-time" });
      timePill.setText(formatSeconds(item.start));
      timePill.addEventListener("click", () => {
        const player = this.playerGetter();
        if (player) {
          player.seekTo(item.start);
        }
      });
      const textSpan = row.createSpan({ cls: "mediascribe-transcript-text" });
      textSpan.setText(item.text);
      textSpan.addEventListener("click", () => {
        const player = this.playerGetter();
        if (player) {
          player.seekTo(item.start);
        }
      });
      const quoteBtn = row.createEl("button", {
        cls: "mediascribe-transcript-quote-btn",
        attr: { title: "Quote with timestamp into note" }
      });
      (0, import_obsidian11.setIcon)(quoteBtn, "quote");
      quoteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.quoteToNote(item);
      });
    });
  }
  highlightActiveItem() {
    if (!this.listEl) return;
    const rows = this.listEl.querySelectorAll(".mediascribe-transcript-row");
    rows.forEach((row, i) => {
      row.classList.toggle("is-active", i === this.activeIndex);
    });
    if (this.autoScroll && this.activeIndex >= 0 && rows[this.activeIndex]) {
      const activeEl = rows[this.activeIndex];
      this.scrollItemWithOffset(activeEl, this.listEl, 70, 30);
    }
  }
  scrollItemWithOffset(itemEl, containerEl, bottomOffset = 70, topOffset = 30) {
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
  quoteToNote(item) {
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian11.MarkdownView);
    if (activeView && activeView.editor) {
      const timeStr = formatSeconds(item.start);
      const quoteMarkdown = `> [${timeStr}] ${item.text}

`;
      activeView.editor.replaceSelection(quoteMarkdown);
    }
  }
  insertFullTranscript() {
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian11.MarkdownView);
    if (!activeView || !activeView.editor) return;
    let transcriptMarkdown = `
### \u{1F4DC} Video Transcript

`;
    for (const item of this.items) {
      transcriptMarkdown += `- **[${formatSeconds(item.start)}]** ${item.text}
`;
    }
    transcriptMarkdown += `
`;
    activeView.editor.replaceSelection(transcriptMarkdown);
  }
};

// src/ui/TimelineMarkers.ts
var import_obsidian12 = require("obsidian");
var TimelineMarkers = class {
  constructor(parentEl, app, playerGetter) {
    this.duration = 0;
    this.app = app;
    this.playerGetter = playerGetter;
    this.containerEl = parentEl.createDiv({ cls: "mediascribe-timeline-markers" });
  }
  setDuration(duration) {
    this.duration = duration;
    this.refresh();
  }
  refresh() {
    this.containerEl.empty();
    if (this.duration <= 0) return;
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian12.MarkdownView);
    if (!activeView || !activeView.editor) return;
    const noteText = activeView.editor.getValue();
    const timestamps = extractTimestampsFromText(noteText);
    for (const ts of timestamps) {
      if (ts.timeSeconds > this.duration) continue;
      const percent = ts.timeSeconds / this.duration * 100;
      const marker = this.containerEl.createDiv({
        cls: "mediascribe-marker-pin",
        attr: {
          style: `left: ${percent}%;`
        }
      });
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
};

// src/utils/hotkey.ts
var import_obsidian13 = require("obsidian");
function formatHotkey(hotkey) {
  if (!hotkey) return "";
  const isMac = import_obsidian13.Platform.isMacOS;
  const modMap = isMac ? { Mod: "Cmd", Meta: "Cmd", Ctrl: "Ctrl", Alt: "Opt", Shift: "Shift" } : { Mod: "Ctrl", Meta: "Win", Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift" };
  const parts = [];
  if (hotkey.modifiers && Array.isArray(hotkey.modifiers)) {
    for (const mod of hotkey.modifiers) {
      parts.push(modMap[mod] || mod);
    }
  }
  if (hotkey.key) {
    let keyStr = hotkey.key;
    if (keyStr.length === 1) {
      keyStr = keyStr.toUpperCase();
    } else if (keyStr === "ArrowUp") keyStr = "Up";
    else if (keyStr === "ArrowDown") keyStr = "Down";
    else if (keyStr === "ArrowLeft") keyStr = "Left";
    else if (keyStr === "ArrowRight") keyStr = "Right";
    else if (keyStr === " " || keyStr.toLowerCase() === "space") keyStr = "Space";
    else if (keyStr === "Escape") keyStr = "Esc";
    parts.push(keyStr);
  }
  return parts.join("+");
}
function getCommandHotkeyString(app, commandSubId, fallbackDefault) {
  try {
    const hotkeyManager = app.hotkeyManager;
    const fullId = commandSubId.includes(":") ? commandSubId : `mediascribe:${commandSubId}`;
    let hotkeys;
    if (hotkeyManager?.customKeys) {
      if (fullId in hotkeyManager.customKeys) {
        hotkeys = hotkeyManager.customKeys[fullId];
      } else if (commandSubId in hotkeyManager.customKeys) {
        hotkeys = hotkeyManager.customKeys[commandSubId];
      }
    }
    if (hotkeys === void 0) {
      if (hotkeyManager?.defaultKeys) {
        if (fullId in hotkeyManager.defaultKeys) {
          hotkeys = hotkeyManager.defaultKeys[fullId];
        } else if (commandSubId in hotkeyManager.defaultKeys) {
          hotkeys = hotkeyManager.defaultKeys[commandSubId];
        }
      }
      if (!hotkeys) {
        const cmd = app.commands?.findCommand?.(fullId) || app.commands?.findCommand?.(commandSubId) || app.commands?.commands?.[fullId] || app.commands?.commands?.[commandSubId];
        if (cmd?.hotkeys) {
          hotkeys = cmd.hotkeys;
        }
      }
    }
    if (Array.isArray(hotkeys)) {
      if (hotkeys.length === 0) {
        return "";
      }
      return formatHotkey(hotkeys[0]);
    }
  } catch (e) {
    console.debug("MediaScribe: Failed to query hotkey", e);
  }
  return fallbackDefault || "";
}
function setDynamicTooltip(el, app, baseTitle, commandSubId, fallbackDefault) {
  const updateTooltip = () => {
    const text = typeof baseTitle === "function" ? baseTitle() : baseTitle;
    let fullTitle = text;
    if (commandSubId) {
      const hotkeyStr = getCommandHotkeyString(app, commandSubId, fallbackDefault);
      if (hotkeyStr) {
        fullTitle = `${text} (${hotkeyStr})`;
      }
    }
    el.setAttribute("title", fullTitle);
    el.setAttribute("aria-label", fullTitle);
  };
  updateTooltip();
  el.addEventListener("mouseenter", updateTooltip);
  el.addEventListener("focus", updateTooltip);
}
function setLucideXIcon(el) {
  el.empty();
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
}

// src/ui/MediaScribeEmbeddedWidget.ts
var MediaScribeEmbeddedWidget = class {
  constructor(plugin, markdownView, app, settings, screenshotService, timestampService, typingScribeService, transcriptService, onSettingsChange, onClose, onPlay) {
    this.player = null;
    this.currentSource = null;
    this.playlistIndex = 0;
    this.ambientGlowService = new AmbientGlowService();
    this.headerTitleEl = null;
    this.playlistBadgeEl = null;
    this.playerContainerEl = null;
    this.controlsEl = null;
    this.playBtn = null;
    this.timeDisplayEl = null;
    this.progressSlider = null;
    this.timelineMarkers = null;
    this.transcriptPanel = null;
    this.loopBarEl = null;
    this.playlistDrawerEl = null;
    this.playlistToggleBtn = null;
    this.prevVideoBtn = null;
    this.nextVideoBtn = null;
    this.playlistDrawerAutoplaySwitch = null;
    this.speedBtn = null;
    // State
    this.currentTime = 0;
    this.duration = 0;
    this.isScrubbing = false;
    this.hasEnded = false;
    this.completedVideoIds = /* @__PURE__ */ new Set();
    this.loopA = null;
    this.loopB = null;
    this.isLooping = false;
    this.isSidePanelOpen = false;
    this.activeSideTab = "playlist";
    this.isCollapsed = false;
    // Description & Creator Info
    this.currentDescription = null;
    this.currentAuthor = null;
    this.isLoadingDescription = false;
    // Side Panel Elements
    this.playerAreaEl = null;
    this.resizeHandleEl = null;
    this.sidePanelEl = null;
    this.playlistViewEl = null;
    this.transcriptViewEl = null;
    this.descriptionViewEl = null;
    this.transcriptBtn = null;
    this.descriptionBtn = null;
    this.posBtn = null;
    this.lastAppliedPosition = "top";
    this.onResizeHandler = () => {
      if (!import_obsidian14.Platform.isDesktop) {
        const currentEffective = this.getEffectivePosition();
        if (this.lastAppliedPosition !== currentEffective) {
          this.applyPositionStyles();
        }
      }
    };
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
    this.hostEl = document.createElement("div");
    this.hostEl.className = "mediascribe-embedded-host";
    const contentEl = this.markdownView.contentEl;
    contentEl.prepend(this.hostEl);
    window.addEventListener("resize", this.onResizeHandler);
    window.addEventListener("orientationchange", this.onResizeHandler);
    this.applyPositionStyles();
    this.render();
  }
  isMobileLandscape() {
    if (!import_obsidian14.Platform.isMobile && !import_obsidian14.Platform.isPhone) {
      return false;
    }
    return window.innerWidth > window.innerHeight;
  }
  getEffectivePosition() {
    if (import_obsidian14.Platform.isDesktop) {
      return this.settings.embeddedPosition || "top";
    }
    if (this.isMobileLandscape()) {
      if (this.settings.embeddedPosition === "vertical_left") {
        return "vertical_left";
      }
      return "vertical_right";
    }
    return "top";
  }
  applyPositionStyles() {
    const pos = this.getEffectivePosition();
    this.lastAppliedPosition = pos;
    const contentEl = this.markdownView.contentEl;
    if (import_obsidian14.Platform.isMobile || import_obsidian14.Platform.isPhone) {
      const topMargin = typeof this.settings.mobileTopMargin === "number" ? this.settings.mobileTopMargin : 48;
      this.hostEl.style.setProperty("--mediascribe-mobile-top-margin", `${topMargin}px`);
    } else {
      this.hostEl.style.removeProperty("--mediascribe-mobile-top-margin");
    }
    contentEl.removeClass("mediascribe-dock-vertical", "mediascribe-dock-left", "mediascribe-dock-right");
    this.hostEl.removeClass("mediascribe-vertical-mode", "mediascribe-top-mode");
    const isMobile = import_obsidian14.Platform.isMobile || import_obsidian14.Platform.isPhone;
    const maxDockW = Math.floor(window.innerWidth * 0.8);
    const minDockW = Math.min(180, Math.floor(window.innerWidth * 0.25));
    const dockWidth = isMobile ? Math.max(minDockW, Math.min(this.settings.embeddedDockWidth || 380, maxDockW)) : this.settings.embeddedDockWidth || 420;
    if (pos === "vertical_left") {
      contentEl.addClass("mediascribe-dock-vertical", "mediascribe-dock-left");
      this.hostEl.addClass("mediascribe-vertical-mode");
      this.hostEl.style.removeProperty("--mediascribe-embed-height");
      this.hostEl.style.setProperty("--mediascribe-dock-width", `${dockWidth}px`);
      contentEl.style.setProperty("--mediascribe-dock-width", `${dockWidth}px`);
    } else if (pos === "vertical_right") {
      contentEl.addClass("mediascribe-dock-vertical", "mediascribe-dock-right");
      this.hostEl.addClass("mediascribe-vertical-mode");
      this.hostEl.style.removeProperty("--mediascribe-embed-height");
      this.hostEl.style.setProperty("--mediascribe-dock-width", `${dockWidth}px`);
      contentEl.style.setProperty("--mediascribe-dock-width", `${dockWidth}px`);
    } else {
      this.hostEl.addClass("mediascribe-top-mode");
      this.hostEl.style.removeProperty("--mediascribe-dock-width");
      contentEl.style.removeProperty("--mediascribe-dock-width");
      this.hostEl.style.setProperty("--mediascribe-embed-height", `${this.settings.embeddedPlayerHeight || 340}px`);
    }
    this.updatePositionButtonVisibility();
    this.updateSidePanelPosition();
  }
  updatePositionButtonVisibility() {
    if (!this.posBtn) return;
    if (import_obsidian14.Platform.isDesktop) {
      this.posBtn.style.display = "";
    } else if (this.isMobileLandscape()) {
      this.posBtn.style.display = "";
    } else {
      this.posBtn.style.display = "none";
    }
  }
  updateSidePanelPosition() {
    if (!this.sidePanelEl) return;
    const pos = this.getEffectivePosition();
    if (pos === "top") {
      if (this.playerAreaEl && this.sidePanelEl.parentElement !== this.playerAreaEl) {
        this.playerAreaEl.appendChild(this.sidePanelEl);
      }
    } else {
      if (this.resizeHandleEl && this.sidePanelEl.nextSibling !== this.resizeHandleEl) {
        this.hostEl.insertBefore(this.sidePanelEl, this.resizeHandleEl);
      } else if (!this.resizeHandleEl && this.sidePanelEl.parentElement !== this.hostEl) {
        this.hostEl.appendChild(this.sidePanelEl);
      }
    }
  }
  async setPosition(pos) {
    if (!import_obsidian14.Platform.isDesktop) {
      if (this.isMobileLandscape()) {
        if (pos === "top") {
          new import_obsidian14.Notice("MediaScribe: In mobile landscape, player must dock at left or right.");
          return;
        }
      } else {
        if (pos !== "top") {
          new import_obsidian14.Notice("MediaScribe: In portrait, player docks at the top.");
          return;
        }
      }
    }
    this.settings.embeddedPosition = pos;
    await this.onSettingsChange(this.settings);
    this.applyPositionStyles();
    this.timelineMarkers?.refresh();
  }
  getActivePlayer() {
    return this.player;
  }
  getCurrentSource() {
    return this.currentSource;
  }
  async loadMedia(source, autoPlay = false) {
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
    this.hasEnded = false;
    let startPosition = 0;
    if (typeof source.initialTime === "number") {
      startPosition = source.initialTime;
    } else if (this.settings.rememberPlaybackPosition) {
      if (source.videoId && typeof this.settings.storedPlaybackPositions?.[source.videoId] === "number") {
        startPosition = this.settings.storedPlaybackPositions[source.videoId];
      } else if (source.url && typeof this.settings.storedPlaybackPositions?.[source.url] === "number") {
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
  async resolveYouTubeInfo(source) {
    if (source.type === "youtube") {
      if (source.videoId) {
        this.fetchAndSetDescription(source.videoId);
      }
      if (source.playlistId && (!source.playlistItems || source.playlistItems.length <= 1)) {
        fetchYouTubePlaylistItems(source.playlistId).then((items) => {
          if (items && items.length > 0 && this.currentSource === source) {
            source.playlistItems = items;
            source.isPlaylist = true;
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
                this.player.setVideoId(source.videoId);
              }
            } else if (items[0]?.videoId) {
              this.playlistIndex = 0;
              source.videoId = items[0].videoId;
              if (this.player && "setVideoId" in this.player) {
                this.player.setVideoId(source.videoId);
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
  async resolveYouTubeTitles(source) {
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
  updateHeaderInfo() {
    if (!this.headerTitleEl || !this.currentSource) return;
    let title = this.currentSource.title;
    if (!title) {
      title = this.currentSource.isLocal ? this.currentSource.localFile?.basename || "Local Media" : this.currentSource.isPlaylist ? "YouTube Playlist" : "Media Stream";
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
    const hasPlaylist = Boolean(this.currentSource.isPlaylist && (this.currentSource.playlistItems?.length ?? 0) > 0);
    if (this.playlistToggleBtn) {
      this.playlistToggleBtn.style.display = hasPlaylist ? "" : "none";
      this.playlistToggleBtn.toggleClass("is-hidden", !hasPlaylist);
    }
    if (!hasPlaylist && this.isSidePanelOpen && this.activeSideTab === "playlist") {
      this.closeSidePanel();
    }
  }
  render() {
    this.hostEl.empty();
    this.buildHeader(this.hostEl);
    const playerArea = this.hostEl.createDiv({ cls: "mediascribe-player-area" });
    this.playerAreaEl = playerArea;
    this.playerContainerEl = playerArea.createDiv({ cls: "mediascribe-player-container" });
    this.buildSidePanel(playerArea);
    this.buildControls(this.hostEl);
    this.buildLoopBar(this.hostEl);
    this.buildResizeHandle(this.hostEl);
    this.updateSidePanelPosition();
  }
  buildHeader(parentEl) {
    const header = parentEl.createDiv({ cls: "mediascribe-view-header mediascribe-embedded-header" });
    const infoSection = header.createDiv({ cls: "mediascribe-header-info" });
    const iconSpan = infoSection.createSpan({ cls: "mediascribe-header-icon" });
    (0, import_obsidian14.setIcon)(iconSpan, "play-circle");
    this.headerTitleEl = infoSection.createSpan({ cls: "mediascribe-header-title" });
    this.headerTitleEl.setText("Loading Media...");
    this.playlistBadgeEl = infoSection.createSpan({ cls: "mediascribe-playlist-badge is-hidden" });
    this.playlistBadgeEl.setText("Playlist");
    const actions = header.createDiv({ cls: "mediascribe-header-actions" });
    this.playlistToggleBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Toggle Playlist" }
    });
    (0, import_obsidian14.setIcon)(this.playlistToggleBtn, "list");
    this.playlistToggleBtn.addEventListener("click", () => {
      this.toggleSideTab("playlist");
    });
    const hasPlaylist = Boolean(this.currentSource?.isPlaylist && (this.currentSource?.playlistItems?.length ?? 0) > 0);
    this.playlistToggleBtn.style.display = hasPlaylist ? "" : "none";
    this.playlistToggleBtn.toggleClass("is-hidden", !hasPlaylist);
    this.descriptionBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Toggle Video Description & Creator Info" }
    });
    (0, import_obsidian14.setIcon)(this.descriptionBtn, "info");
    this.descriptionBtn.addEventListener("click", () => {
      this.toggleSideTab("description");
    });
    const refreshPinsBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Refresh Note Timeline Markers" }
    });
    (0, import_obsidian14.setIcon)(refreshPinsBtn, "bookmark");
    refreshPinsBtn.addEventListener("click", () => {
      this.timelineMarkers?.refresh();
      new import_obsidian14.Notice("MediaScribe: Timeline markers refreshed.");
    });
    const ambientBtn = actions.createEl("button", {
      cls: `mediascribe-btn-icon ${this.settings.enableAmbientMode ? "is-active" : ""}`,
      attr: { title: "Toggle Ambient Mode (Glow Effect)" }
    });
    (0, import_obsidian14.setIcon)(ambientBtn, "sparkles");
    ambientBtn.addEventListener("click", async () => {
      this.settings.enableAmbientMode = !this.settings.enableAmbientMode;
      ambientBtn.toggleClass("is-active", this.settings.enableAmbientMode);
      this.ambientGlowService.setEnabled(this.settings.enableAmbientMode);
      await this.onSettingsChange(this.settings);
    });
    this.posBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Switch Position (Top, Vertical, Sidebar)" }
    });
    (0, import_obsidian14.setIcon)(this.posBtn, "layout");
    this.posBtn.addEventListener("click", (e) => {
      this.showPositionMenu(e);
    });
    this.updatePositionButtonVisibility();
    const collapseBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Minimize Player (Audio / Compact Mode)" }
    });
    (0, import_obsidian14.setIcon)(collapseBtn, "chevron-up");
    collapseBtn.addEventListener("click", () => {
      this.isCollapsed = !this.isCollapsed;
      this.hostEl.toggleClass("is-collapsed", this.isCollapsed);
      collapseBtn.empty();
      (0, import_obsidian14.setIcon)(collapseBtn, this.isCollapsed ? "chevron-down" : "chevron-up");
    });
    const closeBtn = actions.createEl("button", {
      cls: "mediascribe-btn-icon",
      attr: { title: "Close Media Player" }
    });
    setLucideXIcon(closeBtn);
    closeBtn.addEventListener("click", () => {
      this.destroy();
      new import_obsidian14.Notice("MediaScribe: Player closed. Click ribbon icon, timestamp, or run 'Toggle media player' to reopen.");
    });
  }
  showPositionMenu(e) {
    const menu = new import_obsidian14.Menu();
    const currentPos = this.getEffectivePosition();
    if (import_obsidian14.Platform.isDesktop) {
      menu.addItem((item) => {
        item.setTitle("Top (Horizontal)").setIcon("rows").setChecked(currentPos === "top").onClick(() => this.setPosition("top"));
      });
      menu.addItem((item) => {
        item.setTitle("Vertical Split (Right side)").setIcon("panel-right").setChecked(currentPos === "vertical_right").onClick(() => this.setPosition("vertical_right"));
      });
      menu.addItem((item) => {
        item.setTitle("Vertical Split (Left side)").setIcon("panel-left").setChecked(currentPos === "vertical_left").onClick(() => this.setPosition("vertical_left"));
      });
    } else if (this.isMobileLandscape()) {
      menu.addItem((item) => {
        item.setTitle("Vertical Split (Right side)").setIcon("panel-right").setChecked(currentPos === "vertical_right").onClick(() => this.setPosition("vertical_right"));
      });
      menu.addItem((item) => {
        item.setTitle("Vertical Split (Left side)").setIcon("panel-left").setChecked(currentPos === "vertical_left").onClick(() => this.setPosition("vertical_left"));
      });
    } else {
      menu.addItem((item) => {
        item.setTitle("Top (Horizontal)").setIcon("rows").setChecked(currentPos === "top").onClick(() => this.setPosition("top"));
      });
    }
    menu.showAtMouseEvent(e);
  }
  buildControls(parentEl) {
    this.controlsEl = parentEl.createDiv({ cls: "mediascribe-controls-card" });
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
        const percent = this.duration > 0 ? this.currentTime / this.duration * 100 : 0;
        this.progressSlider.style.setProperty("--progress-percent", `${percent.toFixed(2)}%`);
        this.updateTimeDisplay();
      }
    });
    this.timelineMarkers = new TimelineMarkers(scrubberContainer, this.app, () => this.player);
    const buttonsRow = this.controlsEl.createDiv({ cls: "mediascribe-buttons-row" });
    const leftControls = buttonsRow.createDiv({ cls: "mediascribe-ctrl-group mediascribe-ctrl-left" });
    this.playBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-play-btn"
    });
    setDynamicTooltip(this.playBtn, this.app, "Play / Pause", "mediascribe-toggle-play", "Ctrl+K");
    (0, import_obsidian14.setIcon)(this.playBtn, "play");
    this.playBtn.addEventListener("click", async () => {
      if (!this.player) return;
      if (this.hasEnded) {
        this.hasEnded = false;
        this.player.seekTo(0);
        await this.player.play();
        this.updatePlayState(true);
      } else {
        await this.player.togglePlay();
        this.updatePlayState(this.player.isPlaying);
      }
    });
    this.prevVideoBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn is-hidden"
    });
    setDynamicTooltip(this.prevVideoBtn, this.app, "Previous Video", "mediascribe-previous-video", "Ctrl+Alt+P");
    (0, import_obsidian14.setIcon)(this.prevVideoBtn, "skip-back");
    this.prevVideoBtn.addEventListener("click", () => this.handlePreviousVideo());
    this.nextVideoBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn is-hidden"
    });
    setDynamicTooltip(this.nextVideoBtn, this.app, "Next Video", "mediascribe-next-video", "Ctrl+Alt+N");
    (0, import_obsidian14.setIcon)(this.nextVideoBtn, "skip-forward");
    this.nextVideoBtn.addEventListener("click", () => this.handleNextVideo());
    const rewBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn"
    });
    setDynamicTooltip(rewBtn, this.app, () => `Rewind ${this.settings.jumpStepSeconds}s`, "mediascribe-jump-backward", "Ctrl+J");
    (0, import_obsidian14.setIcon)(rewBtn, "rotate-ccw");
    rewBtn.addEventListener("click", () => this.player?.jump(-this.settings.jumpStepSeconds));
    const fwdBtn = leftControls.createEl("button", {
      cls: "mediascribe-ctrl-btn"
    });
    setDynamicTooltip(fwdBtn, this.app, () => `Forward ${this.settings.jumpStepSeconds}s`, "mediascribe-jump-forward", "Ctrl+L");
    (0, import_obsidian14.setIcon)(fwdBtn, "rotate-cw");
    fwdBtn.addEventListener("click", () => this.player?.jump(this.settings.jumpStepSeconds));
    const volumeGroup = leftControls.createDiv({ cls: "mediascribe-volume-group" });
    const volumeBtn = volumeGroup.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-volume-btn",
      attr: { title: "Mute / Unmute" }
    });
    (0, import_obsidian14.setIcon)(volumeBtn, "volume-2");
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
        (0, import_obsidian14.setIcon)(volumeBtn, "volume-x");
      } else {
        const restore = prevVolume || 100;
        volumeSlider.value = restore.toString();
        volumeSlider.style.setProperty("--volume-percent", `${restore}%`);
        this.player.setVolume(restore);
        volumeBtn.empty();
        (0, import_obsidian14.setIcon)(volumeBtn, "volume-2");
      }
    });
    volumeSlider.addEventListener("input", () => {
      const val = parseFloat(volumeSlider.value);
      volumeSlider.style.setProperty("--volume-percent", `${val}%`);
      this.player?.setVolume(val);
      volumeBtn.empty();
      (0, import_obsidian14.setIcon)(volumeBtn, val === 0 ? "volume-x" : val < 50 ? "volume-1" : "volume-2");
    });
    const rightControls = buttonsRow.createDiv({ cls: "mediascribe-ctrl-group mediascribe-ctrl-right" });
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.5, 0.75];
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
    const scribeBtn = rightControls.createEl("button", {
      cls: `mediascribe-ctrl-btn ${this.typingScribeService.active ? "is-active" : ""}`
    });
    setDynamicTooltip(scribeBtn, this.app, "Toggle Auto-Pause While Typing", "mediascribe-toggle-typing-scribe");
    (0, import_obsidian14.setIcon)(scribeBtn, "pen-tool");
    scribeBtn.addEventListener("click", () => {
      const active = this.typingScribeService.toggle();
      scribeBtn.toggleClass("is-active", active);
    });
    const timeBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn"
    });
    setDynamicTooltip(timeBtn, this.app, "Insert Timestamp", "mediascribe-insert-timestamp", "Ctrl+I");
    (0, import_obsidian14.setIcon)(timeBtn, "clock");
    timeBtn.addEventListener("click", () => {
      this.timestampService.insertCurrentTimestamp(this.markdownView);
    });
    const snapBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn"
    });
    setDynamicTooltip(snapBtn, this.app, "Take Screenshot", "mediascribe-capture-frame", "Ctrl+Shift+S");
    (0, import_obsidian14.setIcon)(snapBtn, "camera");
    snapBtn.addEventListener("click", () => this.captureScreenshot());
    this.transcriptBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn mediascribe-cc-btn",
      attr: { title: "Subtitles / Transcript Panel" }
    });
    (0, import_obsidian14.setIcon)(this.transcriptBtn, "subtitles");
    this.transcriptBtn.addEventListener("click", () => {
      this.toggleSideTab("transcript");
    });
    const loopBtn = rightControls.createEl("button", {
      cls: "mediascribe-ctrl-btn",
      attr: { title: "A-B Repeat Loop" }
    });
    (0, import_obsidian14.setIcon)(loopBtn, "repeat");
    loopBtn.addEventListener("click", () => {
      this.isLooping = !this.isLooping;
      loopBtn.toggleClass("is-active", this.isLooping);
      this.loopBarEl?.toggleClass("is-hidden", !this.isLooping);
    });
  }
  buildSidePanel(parentEl) {
    this.sidePanelEl = parentEl.createDiv({ cls: "mediascribe-side-panel is-hidden" });
    const contentEl = this.sidePanelEl.createDiv({ cls: "mediascribe-side-panel-content" });
    this.playlistViewEl = contentEl.createDiv({ cls: "mediascribe-side-view mediascribe-playlist-view" });
    this.buildPlaylistDrawer(this.playlistViewEl);
    this.transcriptViewEl = contentEl.createDiv({ cls: "mediascribe-side-view mediascribe-transcript-view is-hidden" });
    this.transcriptViewEl.style.display = "none";
    this.transcriptPanel = new TranscriptPanel(this.transcriptViewEl, this.app, () => this.player);
    this.descriptionViewEl = contentEl.createDiv({ cls: "mediascribe-side-view mediascribe-description-view is-hidden" });
    this.descriptionViewEl.style.display = "none";
    this.renderDescriptionView();
  }
  openSideTab(tab, skipSave = false) {
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
    if (tab === "transcript") {
      this.transcriptPanel?.setVisible(true);
    } else if (tab === "description") {
      this.renderDescriptionView();
    }
    if (!skipSave) {
      this.saveSidePanelState();
    }
  }
  closeSidePanel(skipSave = false) {
    this.isSidePanelOpen = false;
    this.sidePanelEl?.addClass("is-hidden");
    if (this.sidePanelEl) {
      this.sidePanelEl.style.display = "none";
    }
    this.playlistToggleBtn?.removeClass("is-active");
    this.transcriptBtn?.removeClass("is-active");
    this.descriptionBtn?.removeClass("is-active");
    if (!skipSave) {
      this.saveSidePanelState();
    }
  }
  toggleSideTab(tab) {
    if (this.isSidePanelOpen && this.activeSideTab === tab) {
      this.closeSidePanel();
    } else {
      this.openSideTab(tab);
    }
  }
  async saveSidePanelState() {
    if (!this.settings.rememberSidePanelState || !this.currentSource) return;
    if (!this.settings.storedSidePanelStates) {
      this.settings.storedSidePanelStates = {};
    }
    const state = {
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
  restoreSidePanelState(source) {
    if (!this.settings.rememberSidePanelState || !this.settings.storedSidePanelStates) {
      this.closeSidePanel(true);
      return;
    }
    const saved = source.videoId && this.settings.storedSidePanelStates[source.videoId] || source.url && this.settings.storedSidePanelStates[source.url] || source.playlistId && this.settings.storedSidePanelStates[`playlist:${source.playlistId}`];
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
  updateSidePanelTabs() {
  }
  async fetchAndSetDescription(videoId) {
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
            this.player.setShortsMode(true);
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
  renderDescriptionView() {
    if (!this.descriptionViewEl) return;
    this.descriptionViewEl.empty();
    const container = this.descriptionViewEl.createDiv({ cls: "mediascribe-description-container" });
    const actionsBar = container.createDiv({ cls: "mediascribe-desc-actions" });
    if (this.currentAuthor) {
      const authorBadge = actionsBar.createDiv({ cls: "mediascribe-desc-author" });
      (0, import_obsidian14.setIcon)(authorBadge.createSpan(), "user");
      authorBadge.createSpan({ text: ` ${this.currentAuthor}` });
    }
    const spacer = actionsBar.createDiv({ cls: "mediascribe-desc-spacer" });
    spacer.style.flex = "1 1 auto";
    const copyBtn = actionsBar.createEl("button", {
      cls: "mediascribe-desc-action-btn",
      attr: { title: "Copy Description" }
    });
    (0, import_obsidian14.setIcon)(copyBtn, "copy");
    copyBtn.createSpan({ text: " Copy" });
    copyBtn.addEventListener("click", () => {
      if (this.currentDescription) {
        navigator.clipboard.writeText(this.currentDescription);
        new import_obsidian14.Notice("MediaScribe: Description copied to clipboard.");
      }
    });
    const insertBtn = actionsBar.createEl("button", {
      cls: "mediascribe-desc-action-btn",
      attr: { title: "Insert Description into Active Note" }
    });
    (0, import_obsidian14.setIcon)(insertBtn, "file-plus");
    insertBtn.createSpan({ text: " Insert to Note" });
    insertBtn.addEventListener("click", () => {
      this.insertDescriptionIntoNote();
    });
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
  renderFormattedDescription(parentEl, text) {
    const lines = text.split("\n");
    for (const line of lines) {
      const lineEl = parentEl.createDiv({ cls: "mediascribe-desc-line" });
      if (!line.trim()) {
        lineEl.createSpan({ text: "\xA0" });
        continue;
      }
      const timestampRegex = /(?:^|(?<=[\s(\[]))((?:\d{1,2}:)?\d{1,2}:\d{2})(?=$|[\s)\]])/g;
      let lastIndex = 0;
      let match;
      while ((match = timestampRegex.exec(line)) !== null) {
        const matchStart = match.index;
        const matchStr = match[1];
        const matchLen = matchStr.length;
        if (matchStart > lastIndex) {
          this.renderTextWithLinks(lineEl, line.slice(lastIndex, matchStart));
        }
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
  renderTextWithLinks(parentEl, text) {
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
  insertDescriptionIntoNote() {
    if (!this.currentDescription) {
      new import_obsidian14.Notice("MediaScribe: No description to insert.");
      return;
    }
    const editor = this.markdownView?.editor;
    if (!editor) {
      new import_obsidian14.Notice("MediaScribe: No active note editor found.");
      return;
    }
    const title = this.currentSource?.title || "Video";
    let formattedText = `
### Description - ${title}
`;
    if (this.currentAuthor) {
      formattedText += `**Creator:** ${this.currentAuthor}

`;
    }
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
    new import_obsidian14.Notice("MediaScribe: Inserted description into note.");
  }
  buildPlaylistDrawer(parentEl) {
    this.playlistDrawerEl = parentEl.createDiv({ cls: "mediascribe-playlist-drawer" });
    this.renderPlaylistItems();
  }
  renderPlaylistItems() {
    if (!this.playlistDrawerEl) return;
    this.playlistDrawerEl.empty();
    const isPlaylist = Boolean(this.currentSource?.playlistItems && this.currentSource.playlistItems.length > 0);
    if (isPlaylist) {
      const headerEl = this.playlistDrawerEl.createDiv({ cls: "mediascribe-playlist-drawer-header" });
      const titleEl = headerEl.createDiv({ cls: "mediascribe-playlist-drawer-title" });
      const total = this.currentSource?.playlistItems?.length || 0;
      titleEl.setText(`Playlist (${this.playlistIndex + 1}/${total})`);
      const autoplayToggle = headerEl.createDiv({
        cls: `mediascribe-playlist-drawer-autoplay ${this.settings.playlistAutoplay ? "is-active" : ""}`,
        attr: {
          title: this.settings.playlistAutoplay ? "Autoplay is ON (Click to turn off)" : "Autoplay is OFF (Click to turn on)"
        }
      });
      const autoplayLabel = autoplayToggle.createSpan({ cls: "mediascribe-autoplay-label" });
      autoplayLabel.setText("Autoplay");
      const drawerSwitch = autoplayToggle.createDiv({
        cls: `mediascribe-autoplay-switch ${this.settings.playlistAutoplay ? "is-active" : ""}`
      });
      const drawerKnob = drawerSwitch.createDiv({ cls: "mediascribe-autoplay-knob" });
      drawerKnob.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
      this.playlistDrawerAutoplaySwitch = drawerSwitch;
      autoplayToggle.addEventListener("click", async (e) => {
        e.stopPropagation();
        this.settings.playlistAutoplay = !this.settings.playlistAutoplay;
        this.updateAutoplayUI();
        await this.onSettingsChange(this.settings);
        new import_obsidian14.Notice(`MediaScribe: Playlist Autoplay ${this.settings.playlistAutoplay ? "ON" : "OFF"}`);
      });
    }
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
        row.setAttribute("title", `${item.title}
(Right-click for options)`);
        row.addEventListener("click", () => {
          this.switchPlaylistItem(idx);
        });
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const menu = new import_obsidian14.Menu();
          menu.addItem((menuItem) => {
            menuItem.setTitle("Create Note for Video").setIcon("file-plus").onClick(() => {
              this.createNoteForPlaylistItem(item);
            });
          });
          menu.addItem((menuItem) => {
            menuItem.setTitle("Play Video").setIcon("play").onClick(() => {
              this.switchPlaylistItem(idx);
            });
          });
          menu.addItem((menuItem) => {
            menuItem.setTitle("Copy Video URL").setIcon("copy").onClick(async () => {
              await navigator.clipboard.writeText(item.source.url);
              new import_obsidian14.Notice("MediaScribe: Video URL copied to clipboard.");
            });
          });
          menu.showAtMouseEvent(e);
        });
      });
      window.requestAnimationFrame(() => {
        const activeRow = listEl.querySelector(".mediascribe-playlist-row.is-active");
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
      info.setText("YouTube Playlist Active. Use Previous (\u23EE\uFE0F) and Next (\u23ED\uFE0F) buttons to navigate between videos.");
    }
  }
  sanitizeFileName(name) {
    return name.replace(/[*"\\/<>:|?#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  }
  async createNoteForPlaylistItem(item) {
    try {
      let targetFolder = "";
      if (this.settings.playlistNoteFolderLocation === "specific_folder" && this.settings.playlistNoteSpecificFolder?.trim()) {
        targetFolder = (0, import_obsidian14.normalizePath)(this.settings.playlistNoteSpecificFolder.trim());
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
      const cleanTitle = this.sanitizeFileName(item.title) || (item.source.videoId ? `Video ${item.source.videoId}` : "Playlist Video");
      let filePath = targetFolder ? `${targetFolder}/${cleanTitle}.md` : `${cleanTitle}.md`;
      filePath = (0, import_obsidian14.normalizePath)(filePath);
      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(filePath)) {
        filePath = targetFolder ? (0, import_obsidian14.normalizePath)(`${targetFolder}/${cleanTitle} (${counter}).md`) : (0, import_obsidian14.normalizePath)(`${cleanTitle} (${counter}).md`);
        counter++;
      }
      const propertyKey = this.settings.playlistNoteProperty?.trim() || "video_link";
      const fileContent = `---
${propertyKey}: "${item.source.url}"
---
`;
      const newFile = await this.app.vault.create(filePath, fileContent);
      new import_obsidian14.Notice(`MediaScribe: Created note "${newFile.basename}"`);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(newFile);
    } catch (err) {
      console.error("[MediaScribe] Failed to create note for playlist item:", err);
      new import_obsidian14.Notice(`MediaScribe: Failed to create note: ${err?.message || err}`);
    }
  }
  updateAutoplayUI() {
    const isAutoplay = Boolean(this.settings.playlistAutoplay);
    const title = isAutoplay ? "Autoplay is ON (Click to turn off)" : "Autoplay is OFF (Click to turn on)";
    if (this.playlistDrawerAutoplaySwitch) {
      this.playlistDrawerAutoplaySwitch.toggleClass("is-active", isAutoplay);
      const parent = this.playlistDrawerAutoplaySwitch.closest(".mediascribe-playlist-drawer-autoplay");
      if (parent) {
        parent.toggleClass("is-active", isAutoplay);
        parent.setAttribute("title", title);
      }
    }
  }
  updatePlaylistUI() {
    const isPlaylist = Boolean(this.currentSource?.isPlaylist && (this.currentSource?.playlistItems?.length ?? 0) > 0);
    this.prevVideoBtn?.toggleClass("is-hidden", !isPlaylist);
    this.nextVideoBtn?.toggleClass("is-hidden", !isPlaylist);
    if (this.playlistToggleBtn) {
      this.playlistToggleBtn.toggleClass("is-hidden", !isPlaylist);
      this.playlistToggleBtn.style.display = isPlaylist ? "" : "none";
    }
    this.updateAutoplayUI();
    this.renderPlaylistItems();
    this.updateSidePanelTabs();
  }
  async switchPlaylistItem(idx, forceFromStart = false) {
    if (!this.currentSource?.playlistItems || !this.currentSource.playlistItems[idx]) return;
    await this.saveCurrentPosition();
    const selectedItem = this.currentSource.playlistItems[idx];
    if (!selectedItem) return;
    const targetVideoId = selectedItem.videoId || selectedItem.source?.videoId;
    const targetUrl = selectedItem.source?.url;
    const isTargetCompleted = Boolean(
      targetVideoId && this.completedVideoIds.has(targetVideoId) || targetUrl && this.completedVideoIds.has(targetUrl)
    );
    let resumeTime = 0;
    if (!forceFromStart && !isTargetCompleted && this.settings.rememberPlaybackPosition) {
      if (targetVideoId && typeof this.settings.storedPlaybackPositions?.[targetVideoId] === "number") {
        resumeTime = this.settings.storedPlaybackPositions[targetVideoId];
      } else if (targetUrl && typeof this.settings.storedPlaybackPositions?.[targetUrl] === "number") {
        resumeTime = this.settings.storedPlaybackPositions[targetUrl];
      }
    }
    if (selectedItem.duration) {
      const parsedDur = parseTimestamp(selectedItem.duration);
      if (parsedDur && parsedDur > 0 && resumeTime >= parsedDur - 3) {
        resumeTime = 0;
      }
    }
    if (forceFromStart || isTargetCompleted) {
      resumeTime = 0;
      if (targetVideoId && this.settings.storedPlaybackPositions) {
        this.settings.storedPlaybackPositions[targetVideoId] = 0;
      }
      if (targetUrl && this.settings.storedPlaybackPositions) {
        this.settings.storedPlaybackPositions[targetUrl] = 0;
      }
    }
    this.hasEnded = false;
    const newSource = {
      ...selectedItem.source || {},
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
    await this.loadMedia(newSource, true);
  }
  async handleNextVideo() {
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
  async handlePreviousVideo() {
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
      } else {
        if (this.player) {
          this.hasEnded = false;
          this.player.seekTo(0);
          await this.player.play();
          this.updatePlayState(true);
        }
      }
    }
  }
  buildLoopBar(parentEl) {
    this.loopBarEl = parentEl.createDiv({ cls: "mediascribe-loop-bar is-hidden" });
    const title = this.loopBarEl.createSpan({ cls: "mediascribe-loop-title" });
    title.setText("A-B Loop:");
    const btnA = this.loopBarEl.createEl("button", { cls: "mediascribe-btn-sm", text: "Set A" });
    const spanA = this.loopBarEl.createSpan({ cls: "mediascribe-loop-val", text: "--:--" });
    btnA.addEventListener("click", async () => {
      if (this.player) {
        this.loopA = await this.player.getCurrentTime();
        spanA.setText(formatSeconds(this.loopA));
        new import_obsidian14.Notice(`MediaScribe: Point A set to ${formatSeconds(this.loopA)}`);
      }
    });
    const btnB = this.loopBarEl.createEl("button", { cls: "mediascribe-btn-sm", text: "Set B" });
    const spanB = this.loopBarEl.createSpan({ cls: "mediascribe-loop-val", text: "--:--" });
    btnB.addEventListener("click", async () => {
      if (this.player) {
        this.loopB = await this.player.getCurrentTime();
        spanB.setText(formatSeconds(this.loopB));
        new import_obsidian14.Notice(`MediaScribe: Point B set to ${formatSeconds(this.loopB)}`);
      }
    });
    const clearBtn = this.loopBarEl.createEl("button", { cls: "mediascribe-btn-sm", text: "Clear" });
    clearBtn.addEventListener("click", () => {
      this.loopA = null;
      this.loopB = null;
      spanA.setText("--:--");
      spanB.setText("--:--");
      new import_obsidian14.Notice("MediaScribe: A-B loop cleared.");
    });
  }
  async captureScreenshot() {
    if (!this.player || !this.currentSource) {
      new import_obsidian14.Notice("MediaScribe: No media player active to capture.");
      return;
    }
    await this.screenshotService.captureAndInsert(
      this.player,
      this.currentSource,
      this.markdownView,
      this.playerContainerEl
    );
  }
  bindPlayerEvents() {
    if (!this.player) return;
    this.player.on("ready", () => {
      this.updatePlayState(false);
    });
    this.player.on("play", () => {
      this.hasEnded = false;
      this.updatePlayState(true);
      this.onPlay?.();
    });
    this.player.on("pause", () => {
      this.updatePlayState(false);
      this.saveCurrentPosition();
    });
    this.player.on("timeupdate", async (time) => {
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
    this.player.on("durationchange", (dur) => {
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
    this.player.on("ratechange", (rate) => {
      if (this.speedBtn) {
        this.speedBtn.setText(`${rate}x`);
        this.speedBtn.setAttribute("title", `Playback Speed: ${rate}x (Click to cycle)`);
      }
    });
    this.player.on("playlistindexchange", (idx) => {
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
      this.hasEnded = true;
      if (this.currentSource?.videoId) this.completedVideoIds.add(this.currentSource.videoId);
      if (this.currentSource?.url) this.completedVideoIds.add(this.currentSource.url);
      this.updatePlayState(false, true);
      this.saveCurrentPosition(true);
      const hasNext = Boolean(
        this.currentSource?.playlistItems && this.playlistIndex < this.currentSource.playlistItems.length - 1
      );
      if (this.settings.playlistAutoplay && hasNext) {
        this.handleNextVideo();
      }
    });
  }
  updatePlayState(isPlaying, isEnded = false) {
    if (this.playBtn) {
      this.playBtn.empty();
      if (isEnded) {
        (0, import_obsidian14.setIcon)(this.playBtn, "rotate-ccw");
        this.playBtn.setAttribute("title", "Replay (Ctrl+K)");
      } else {
        (0, import_obsidian14.setIcon)(this.playBtn, isPlaying ? "pause" : "play");
        this.playBtn.setAttribute("title", isPlaying ? "Pause (Ctrl+K)" : "Play (Ctrl+K)");
      }
    }
  }
  updateTimeDisplay() {
    if (this.timeDisplayEl) {
      this.timeDisplayEl.setText(`${formatSeconds(this.currentTime)} / ${formatSeconds(this.duration)}`);
    }
    if (this.progressSlider && !this.isScrubbing) {
      this.progressSlider.value = this.currentTime.toString();
      const percent = this.duration > 0 ? this.currentTime / this.duration * 100 : 0;
      this.progressSlider.style.setProperty("--progress-percent", `${percent.toFixed(2)}%`);
    }
  }
  async loadTranscript(source) {
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
  async saveCurrentPosition(isEnded = false) {
    if (!this.settings.rememberPlaybackPosition || !this.currentSource) return;
    let time = 0;
    if (isEnded || this.hasEnded) {
      time = 0;
      this.currentTime = 0;
      if (this.currentSource.videoId) this.completedVideoIds.add(this.currentSource.videoId);
      if (this.currentSource.url) this.completedVideoIds.add(this.currentSource.url);
    } else {
      if (this.player) {
        try {
          const pTime = await this.player.getCurrentTime();
          if (typeof pTime === "number" && pTime > 0) {
            this.currentTime = pTime;
          }
        } catch {
        }
      }
      if (this.duration > 0 && this.currentTime >= this.duration - 3) {
        time = 0;
        this.currentTime = 0;
        if (this.currentSource.videoId) this.completedVideoIds.add(this.currentSource.videoId);
        if (this.currentSource.url) this.completedVideoIds.add(this.currentSource.url);
      } else {
        time = Math.max(0, Math.floor(this.currentTime));
        if (time > 0) {
          if (this.currentSource.videoId) this.completedVideoIds.delete(this.currentSource.videoId);
          if (this.currentSource.url) this.completedVideoIds.delete(this.currentSource.url);
        }
      }
    }
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
  buildResizeHandle(parentEl) {
    const handle = parentEl.createDiv({ cls: "mediascribe-resize-handle" });
    this.resizeHandleEl = handle;
    let isDragging = false;
    let startY = 0;
    let startX = 0;
    let lastY = 0;
    let lastX = 0;
    let startH = this.settings.embeddedPlayerHeight || 340;
    let startW = this.settings.embeddedDockWidth || 420;
    const applyResize = (clientX, clientY) => {
      const pos = this.getEffectivePosition();
      if (pos === "top") {
        const delta = clientY - startY;
        const maxH = Math.min(750, Math.floor(window.innerHeight * 0.85));
        const minH = 140;
        const newHeight = Math.max(minH, Math.min(maxH, startH + delta));
        this.hostEl.style.setProperty("--mediascribe-embed-height", `${newHeight}px`);
      } else {
        let delta = 0;
        if (pos === "vertical_left") {
          delta = clientX - startX;
        } else {
          delta = startX - clientX;
        }
        const maxW = Math.floor(window.innerWidth * 0.8);
        const minW = Math.min(180, Math.floor(window.innerWidth * 0.25));
        const newWidth = Math.max(minW, Math.min(maxW, startW + delta));
        this.hostEl.style.setProperty("--mediascribe-dock-width", `${newWidth}px`);
        this.markdownView.contentEl.style.setProperty("--mediascribe-dock-width", `${newWidth}px`);
      }
    };
    const commitResize = async (clientX, clientY) => {
      const pos = this.getEffectivePosition();
      if (pos === "top") {
        const delta = clientY - startY;
        const maxH = Math.min(750, Math.floor(window.innerHeight * 0.85));
        const minH = 140;
        const finalHeight = Math.max(minH, Math.min(maxH, startH + delta));
        this.settings.embeddedPlayerHeight = Math.round(finalHeight);
      } else {
        let delta = 0;
        if (pos === "vertical_left") {
          delta = clientX - startX;
        } else {
          delta = startX - clientX;
        }
        const maxW = Math.floor(window.innerWidth * 0.8);
        const minW = Math.min(180, Math.floor(window.innerWidth * 0.25));
        const finalWidth = Math.max(minW, Math.min(maxW, startW + delta));
        this.settings.embeddedDockWidth = Math.round(finalWidth);
      }
      await this.onSettingsChange(this.settings);
    };
    const startDrag = (clientX, clientY) => {
      isDragging = true;
      startY = clientY;
      startX = clientX;
      lastY = clientY;
      lastX = clientX;
      startH = parseInt(this.hostEl.style.getPropertyValue("--mediascribe-embed-height") || "", 10) || this.settings.embeddedPlayerHeight || 340;
      startW = parseInt(this.hostEl.style.getPropertyValue("--mediascribe-dock-width") || "", 10) || this.settings.embeddedDockWidth || 420;
      handle.addClass("is-dragging");
      document.body.addClass("mediascribe-is-resizing");
    };
    const endDrag = async (clientX, clientY) => {
      if (!isDragging) return;
      isDragging = false;
      handle.removeClass("is-dragging");
      document.body.removeClass("mediascribe-is-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      await commitResize(clientX, clientY);
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      lastX = e.clientX;
      lastY = e.clientY;
      applyResize(e.clientX, e.clientY);
    };
    const onPointerUp = async (e) => {
      try {
        if (handle.hasPointerCapture(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }
      } catch {
      }
      await endDrag(e.clientX || lastX, e.clientY || lastY);
    };
    const onTouchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      lastX = touch.clientX;
      lastY = touch.clientY;
      applyResize(touch.clientX, touch.clientY);
    };
    const onTouchEnd = async (e) => {
      const touch = e.changedTouches?.[0];
      const cx = touch ? touch.clientX : lastX;
      const cy = touch ? touch.clientY : lastY;
      await endDrag(cx, cy);
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      lastX = e.clientX;
      lastY = e.clientY;
      applyResize(e.clientX, e.clientY);
    };
    const onMouseUp = async (e) => {
      await endDrag(e.clientX || lastX, e.clientY || lastY);
    };
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX, e.clientY);
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
      }
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });
    handle.addEventListener("touchstart", (e) => {
      if (isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      e.stopPropagation();
      startDrag(touch.clientX, touch.clientY);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);
    }, { passive: false });
    handle.addEventListener("mousedown", (e) => {
      if (isDragging || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX, e.clientY);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
  updateSettings(settings) {
    this.settings = settings;
    this.applyPositionStyles();
    this.ambientGlowService.setEnabled(settings.enableAmbientMode);
    this.updateAutoplayUI();
  }
  getHostEl() {
    return this.hostEl;
  }
  uncollapse() {
    if (this.isCollapsed) {
      this.isCollapsed = false;
      this.hostEl.removeClass("is-collapsed");
    }
  }
  destroy() {
    window.removeEventListener("resize", this.onResizeHandler);
    window.removeEventListener("orientationchange", this.onResizeHandler);
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
};

// src/services/embeddedPlayerManager.ts
var EmbeddedPlayerManager = class {
  constructor(plugin, app, settings, detector, screenshotService, timestampService, typingScribeService, transcriptService, onSettingsChange) {
    this.activeWidgets = /* @__PURE__ */ new Map();
    this.closedNotes = /* @__PURE__ */ new Set();
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
  updateSettings(settings) {
    this.settings = settings;
    for (const widget of this.activeWidgets.values()) {
      widget.updateSettings(settings);
    }
  }
  /**
   * Returns player from currently active markdown view widget if one exists
   */
  getActiveEmbeddedPlayer() {
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian15.MarkdownView);
    if (activeView && this.activeWidgets.has(activeView)) {
      return this.activeWidgets.get(activeView).getActivePlayer();
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
  getActiveEmbeddedWidget() {
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian15.MarkdownView);
    if (activeView && this.activeWidgets.has(activeView)) {
      return this.activeWidgets.get(activeView);
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
  getActiveSource() {
    return this.getActiveEmbeddedWidget()?.getCurrentSource() || null;
  }
  /**
   * Inspects a MarkdownView and mounts or dismounts the embedded player
   */
  async syncView(view, forceOpen = false) {
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
      return;
    }
    const source = await this.detector.extractMediaFromNote(
      file,
      this.settings.mediaPropertyNames,
      this.settings.playlistNoteProperty,
      this.settings.verifyMediaContentType ?? true
    );
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
  dismountView(view) {
    const widget = this.activeWidgets.get(view);
    if (widget) {
      this.activeWidgets.delete(view);
      widget.destroy();
    }
  }
  async reopenView(view, seekToSeconds) {
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
  async mountWithPosition(view, position, seekToSeconds, shouldPlay = false, sourceToLoad) {
    const file = view.file;
    let effectivePos = position;
    if (!import_obsidian15.Platform.isDesktop) {
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
      new import_obsidian15.Notice("MediaScribe: No media found to dock into note.");
      return;
    }
    this.dismountView(view);
    if (file) {
      this.closedNotes.delete(file.path);
    }
    const widget = new MediaScribeEmbeddedWidget(
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
  async toggleActiveView() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian15.MarkdownView);
    if (!view || !view.file) return;
    if (this.activeWidgets.has(view)) {
      this.closedNotes.add(view.file.path);
      this.dismountView(view);
      new import_obsidian15.Notice("MediaScribe: Player closed.");
    } else {
      this.closedNotes.delete(view.file.path);
      await this.syncView(view, true);
      if (this.activeWidgets.has(view)) {
        new import_obsidian15.Notice("MediaScribe: Player opened.");
      } else {
        new import_obsidian15.Notice("MediaScribe: No supported video/audio found in active note.");
      }
    }
  }
  hasActiveWidget(view) {
    return this.activeWidgets.has(view);
  }
  syncActiveView() {
    this.cleanupDisconnectedViews();
    const view = this.app.workspace.getActiveViewOfType(import_obsidian15.MarkdownView);
    if (view) {
      this.syncView(view);
    }
  }
  /**
   * Pauses all other active players when one player begins playback.
   * Ensures exclusive playback across all open tabs.
   */
  handlePlayerPlay(playingWidget) {
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
  cleanupDisconnectedViews() {
    for (const [view, widget] of Array.from(this.activeWidgets.entries())) {
      if (!view.containerEl || !view.containerEl.isConnected) {
        this.dismountView(view);
      }
    }
  }
  destroyAll() {
    for (const widget of this.activeWidgets.values()) {
      widget.destroy();
    }
    this.activeWidgets.clear();
  }
};

// src/main.ts
var MediaScribePlugin = class extends import_obsidian16.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.cleanExpiredHistory();
    this.detector = new MediaDetector(this.app);
    this.screenshotService = new ScreenshotService(this.app, this.settings);
    this.typingScribeService = new TypingScribeService(this.app, this.settings);
    this.transcriptService = new TranscriptService(this.app);
    this.timestampService = new TimestampService(
      this.app,
      this.settings,
      () => this.getActivePlayer(),
      () => this.embeddedManager?.getActiveSource() || null
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
    const ribbonIcon = this.addRibbonIcon("play-circle", "MediaScribe: Toggle / Open Player", async () => {
      const activeView = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
      if (activeView) {
        await this.embeddedManager.toggleActiveView();
      } else {
        new import_obsidian16.Notice("MediaScribe: Please open or focus a note to dock the player.");
      }
    });
    setDynamicTooltip(
      ribbonIcon,
      this.app,
      "MediaScribe: Toggle / Open Player",
      "mediascribe-toggle-embedded-player",
      "Ctrl+Shift+M"
    );
    this.registerPluginCommands();
    this.registerTimestampClickHandler();
    this.setupMarkdownPostProcessor();
    this.registerEvent(
      this.app.workspace.on("editor-change", () => {
        this.typingScribeService.handleEditorChange();
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
        if (view) {
          this.embeddedManager.syncView(view);
        }
      })
    );
    let metaDebounce = null;
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (metaDebounce !== null) window.clearTimeout(metaDebounce);
        metaDebounce = window.setTimeout(() => {
          const view = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
          if (view && view.file?.path === file.path) {
            this.embeddedManager.syncView(view);
          }
        }, 400);
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.embeddedManager.syncActiveView();
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.embeddedManager.syncActiveView();
    });
    this.addSettingTab(new MediaScribeSettingTab(this.app, this));
  }
  async onunload() {
    this.embeddedManager.destroyAll();
    this.typingScribeService.destroy();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.screenshotService.updateSettings(this.settings);
    this.timestampService.updateSettings(this.settings);
    this.typingScribeService.updateSettings(this.settings);
    this.embeddedManager.updateSettings(this.settings);
  }
  /**
   * Cleans up saved panel conditions and playback positions older than autoClearHistoryDays
   */
  cleanExpiredHistory() {
    const days = this.settings.autoClearHistoryDays;
    if (!days || days <= 0) return;
    const maxAgeMs = days * 24 * 60 * 60 * 1e3;
    const now = Date.now();
    let changed = false;
    if (this.settings.storedSidePanelStates) {
      for (const key of Object.keys(this.settings.storedSidePanelStates)) {
        const item = this.settings.storedSidePanelStates[key];
        if (item && item.lastAccessed && now - item.lastAccessed > maxAgeMs) {
          delete this.settings.storedSidePanelStates[key];
          changed = true;
        }
      }
    }
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
  getActivePlayer() {
    return this.embeddedManager.getActiveEmbeddedPlayer();
  }
  registerPluginCommands() {
    this.addCommand({
      id: "mediascribe-toggle-embedded-player",
      name: "Toggle / Reopen media player for active note",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
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
    this.addCommand({
      id: "mediascribe-open-active-note-media",
      name: "Open media for active note",
      checkCallback: (checking) => {
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
                const view = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
                if (view) {
                  this.embeddedManager.reopenView(view);
                }
              } else {
                new import_obsidian16.Notice("MediaScribe: No supported video/audio found in note.");
              }
            })();
          }
          return true;
        }
        return false;
      }
    });
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
            const view = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
            if (view) {
              this.embeddedManager.mountWithPosition(view, this.settings.embeddedPosition || "top", 0, true, source);
            } else {
              new import_obsidian16.Notice("MediaScribe: Please open or focus a note in the editor to mount media.");
            }
          } else {
            new import_obsidian16.Notice("MediaScribe: Invalid or unsupported media source. The link is not a playable video or audio source.");
          }
        }
      }
    });
    this.addCommand({
      id: "mediascribe-toggle-play",
      name: "Play / Pause",
      hotkeys: [{ modifiers: ["Mod"], key: "k" }],
      callback: () => {
        const player = this.getActivePlayer();
        player?.togglePlay();
      }
    });
    this.addCommand({
      id: "mediascribe-jump-backward",
      name: `Jump backward ${this.settings.jumpStepSeconds}s`,
      hotkeys: [{ modifiers: ["Mod"], key: "j" }],
      callback: () => {
        const player = this.getActivePlayer();
        player?.jump(-this.settings.jumpStepSeconds);
      }
    });
    this.addCommand({
      id: "mediascribe-jump-forward",
      name: `Jump forward ${this.settings.jumpStepSeconds}s`,
      hotkeys: [{ modifiers: ["Mod"], key: "l" }],
      callback: () => {
        const player = this.getActivePlayer();
        player?.jump(this.settings.jumpStepSeconds);
      }
    });
    this.addCommand({
      id: "mediascribe-next-video",
      name: "Next video in playlist",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "n" }],
      callback: () => {
        const player = this.getActivePlayer();
        if (player?.nextVideo) {
          player.nextVideo();
        } else {
          new import_obsidian16.Notice("MediaScribe: Next video control not available.");
        }
      }
    });
    this.addCommand({
      id: "mediascribe-previous-video",
      name: "Previous video in playlist",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "p" }],
      callback: () => {
        const player = this.getActivePlayer();
        if (player?.previousVideo) {
          player.previousVideo();
        } else {
          new import_obsidian16.Notice("MediaScribe: Previous video control not available.");
        }
      }
    });
    this.addCommand({
      id: "mediascribe-insert-timestamp",
      name: "Insert current timestamp into note",
      hotkeys: [{ modifiers: ["Mod"], key: "i" }],
      editorCallback: () => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
        this.timestampService.insertCurrentTimestamp(view);
      }
    });
    this.addCommand({
      id: "mediascribe-capture-frame",
      name: "Capture video frame screenshot into note",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "s" }],
      callback: () => {
        const embedded = this.embeddedManager.getActiveEmbeddedWidget();
        if (embedded) {
          embedded.captureScreenshot();
        } else {
          new import_obsidian16.Notice("MediaScribe: No active media player found to capture screenshot.");
        }
      }
    });
    this.addCommand({
      id: "mediascribe-toggle-typing-scribe",
      name: "Toggle Auto-Pause while typing (Typing Scribe)",
      callback: () => {
        this.typingScribeService.toggle();
      }
    });
  }
  registerTimestampClickHandler() {
    this.registerDomEvent(document, "click", (evt) => {
      const target = evt.target;
      if (!target) return;
      if (target.closest(
        "code, pre, .cm-inline-code, .HyperMD-codeblock, .cm-formatting-code, .cm-comment"
      )) {
        return;
      }
      if (target.classList.contains("mediascribe-timestamp-link")) {
        evt.preventDefault();
        evt.stopPropagation();
        const text = target.getAttribute("data-timestamp") || target.innerText;
        this.handleTimestampJump(text);
        return;
      }
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
        const cmLine2 = target.closest(".cm-line");
        if (cmLine2) {
          const lineText = cmLine2.textContent || "";
          const timestamps = extractTimestampsFromText(lineText);
          const match = timestamps.find((ts) => ts.displayText === text || text.includes(ts.displayText));
          if (match) {
            evt.preventDefault();
            evt.stopPropagation();
            this.handleTimestampJump(match.displayText);
            return;
          }
        }
      }
      const cmLine = target.closest(".cm-line");
      if (cmLine) {
        const directText = target.textContent?.trim() || "";
        if (/^(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?$/.test(directText)) {
          const sec = parseTimestamp(directText);
          if (sec !== null) {
            evt.preventDefault();
            evt.stopPropagation();
            this.handleTimestampJump(directText);
            return;
          }
        }
      }
    }, true);
  }
  handleTimestampJump(text) {
    const seconds = parseTimestamp(text);
    if (seconds === null) return false;
    const embedded = this.embeddedManager.getActiveEmbeddedWidget();
    if (embedded) {
      embedded.uncollapse();
    }
    const player = this.getActivePlayer();
    if (player) {
      player.seekTo(seconds);
      player.play();
      new import_obsidian16.Notice(`MediaScribe: Jumped to ${formatSeconds(seconds)}`);
      return true;
    }
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian16.MarkdownView);
    if (activeView && activeView.file) {
      void this.detector.extractMediaFromNote(
        activeView.file,
        this.settings.mediaPropertyNames,
        this.settings.playlistNoteProperty,
        this.settings.verifyMediaContentType ?? true
      ).then((source) => {
        if (source) {
          this.embeddedManager.reopenView(activeView, seconds);
          new import_obsidian16.Notice(`MediaScribe: Reopened player at ${formatSeconds(seconds)}`);
        }
      });
      return true;
    }
    return false;
  }
  setupMarkdownPostProcessor() {
    this.registerMarkdownPostProcessor((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodesToReplace = [];
      let currentNode = null;
      while (currentNode = walker.nextNode()) {
        if (/\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(currentNode.nodeValue || "")) {
          if (currentNode.parentElement && !currentNode.parentElement.closest(".mediascribe-timestamp-link, code, pre")) {
            nodesToReplace.push({ node: currentNode, parent: currentNode.parentNode });
          }
        }
      }
      for (const item of nodesToReplace) {
        const val = item.node.nodeValue || "";
        const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
        let lastIdx = 0;
        let match;
        const frag = document.createDocumentFragment();
        while ((match = regex.exec(val)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
          }
          const pill = document.createElement("span");
          pill.className = "mediascribe-timestamp-link";
          pill.setAttribute("data-timestamp", match[1]);
          pill.innerText = `\u23F1\uFE0F ${match[1]}`;
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
};
