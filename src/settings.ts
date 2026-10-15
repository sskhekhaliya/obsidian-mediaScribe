import { App, PluginSettingTab, Setting } from "obsidian";
import MediaScribePlugin from "./main";
import { PlayerLayoutMode, TimestampFormat } from "./types";
import { FolderSuggest } from "./ui/folderSuggest";

export class MediaScribeSettingTab extends PluginSettingTab {
  private plugin: MediaScribePlugin;

  constructor(app: App, plugin: MediaScribePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "MediaScribe Settings" });

    // --- Playback & Layout ---
    containerEl.createEl("h3", { text: "Playback & Viewport" });

    new Setting(containerEl)
      .setName("Auto-Embed in Note (Recommended)")
      .setDesc("Automatically display the player at the top of any note containing media_link or video properties.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoEmbedInNote)
          .onChange(async (val) => {
            this.plugin.settings.autoEmbedInNote = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Embedded Player Position")
      .setDesc("Choose where the player docks when embedded inside a note.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("top", "Top (Horizontal)")
          .addOption("vertical_right", "Vertical Split (Right side)")
          .addOption("vertical_left", "Vertical Split (Left side)")
          .setValue(this.plugin.settings.embeddedPosition || "top")
          .onChange(async (val) => {
            this.plugin.settings.embeddedPosition = val as any;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Vertical Dock Width")
      .setDesc("Width in pixels when docked vertically on the left or right side of a note.")
      .addSlider((slider) => {
        slider
          .setLimits(280, 650, 10)
          .setValue(this.plugin.settings.embeddedDockWidth || 420)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.embeddedDockWidth = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Embedded Player Height (Top Mode)")
      .setDesc("Height in pixels for the player when embedded at the top of notes.")
      .addSlider((slider) => {
        slider
          .setLimits(180, 600, 20)
          .setValue(this.plugin.settings.embeddedPlayerHeight)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.embeddedPlayerHeight = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Hide Native YouTube Controls (Clean Mode)")
      .setDesc("Hides YouTube's built-in progress bar, settings gear, and buttons so you only see MediaScribe's sleek controls.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.hideNativeYouTubeControls)
          .onChange(async (val) => {
            this.plugin.settings.hideNativeYouTubeControls = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Hide Overlays & Watermarks (Cinematic Clean Mode)")
      .setDesc("Crops out YouTube's top channel banner, share button, 'More videos' thumbnail pill, and YouTube logo.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.hideYouTubeOverlays)
          .onChange(async (val) => {
            this.plugin.settings.hideYouTubeOverlays = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Overlay Crop Zoom Level")
      .setDesc("Zoom multiplier used to push YouTube overlays outside the player boundary (1.0 = none, 1.22 = recommended, 1.30 = max).")
      .addSlider((slider) => {
        slider
          .setLimits(1.0, 1.3, 0.02)
          .setValue(this.plugin.settings.youtubeCropZoom)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.youtubeCropZoom = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Ambient Mode (Dynamic Video Glow)")
      .setDesc("Casts a soft, dynamic ambient glow around the video player matching the video's live colors and blending into your Obsidian theme.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableAmbientMode)
          .onChange(async (val) => {
            this.plugin.settings.enableAmbientMode = val;
            await this.plugin.saveSettings();
            this.plugin.embeddedManager.syncActiveView();
          });
      });

    new Setting(containerEl)
      .setName("Manual Open Layout")
      .setDesc("Where the media player opens when explicitly launched via command palette or ribbon.")
      .addDropdown((drop) => {
        drop
          .addOption("right_sidebar", "Right Sidebar")
          .addOption("split_horizontal", "Split View (Top / Bottom)")
          .addOption("split_vertical", "Split View (Side by Side)")
          .setValue(this.plugin.settings.defaultLayout)
          .onChange(async (val) => {
            this.plugin.settings.defaultLayout = val as PlayerLayoutMode;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Jump Step (Seconds)")
      .setDesc("How many seconds to skip forward or backward when using media hotkeys.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 60, 1)
          .setValue(this.plugin.settings.jumpStepSeconds)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.jumpStepSeconds = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Remember Playback Positions")
      .setDesc("Automatically resume videos and audio from where you previously stopped.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.rememberPlaybackPosition)
          .onChange(async (val) => {
            this.plugin.settings.rememberPlaybackPosition = val;
            await this.plugin.saveSettings();
          });
      });

    // --- Timestamps ---
    containerEl.createEl("h3", { text: "Timestamps" });

    new Setting(containerEl)
      .setName("Timestamp Format")
      .setDesc("Syntax used when inserting timestamps into your notes.")
      .addDropdown((drop) => {
        drop
          .addOption("bracket", "[01:23] (Clickable Bracket)")
          .addOption("markdown_link", "[01:23](#t=83) (Markdown Link)")
          .addOption("wikilink", "[[#t=83|01:23]] (Obsidian Wikilink)")
          .addOption("bold", "**01:23** (Bold text)")
          .addOption("plain", "01:23 (Plain text)")
          .setValue(this.plugin.settings.timestampFormat)
          .onChange(async (val) => {
            this.plugin.settings.timestampFormat = val as TimestampFormat;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Always Include Hours")
      .setDesc("Format timestamps as 00:01:23 instead of 01:23 when hours are zero.")
      .addToggle((toggle) => {
        toggle
          .setValue(!this.plugin.settings.includeTimestampLeadingZero)
          .onChange(async (val) => {
            this.plugin.settings.includeTimestampLeadingZero = !val;
            await this.plugin.saveSettings();
          });
      });

    // --- Typing Scribe (Auto-Pause) ---
    containerEl.createEl("h3", { text: "Typing Scribe (Smart Auto-Pause)" });

    new Setting(containerEl)
      .setName("Auto-Pause While Typing")
      .setDesc("Automatically pause media playback whenever you start typing in your note.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoPauseOnTyping)
          .onChange(async (val) => {
            this.plugin.settings.autoPauseOnTyping = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Resume Idle Duration (Seconds)")
      .setDesc("How long to wait after you stop typing before automatically resuming playback.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 5, 0.5)
          .setValue(this.plugin.settings.autoPauseIdleResumeSec)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.autoPauseIdleResumeSec = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Resume Rewind Buffer (Seconds)")
      .setDesc("How many seconds to rewind when playback resumes to preserve context.")
      .addSlider((slider) => {
        slider
          .setLimits(0, 5, 0.5)
          .setValue(this.plugin.settings.autoResumeRewindSec)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.autoResumeRewindSec = val;
            await this.plugin.saveSettings();
          });
      });

    // --- Frame Screenshots ---
    containerEl.createEl("h3", { text: "Frame Screenshots" });

    new Setting(containerEl)
      .setName("Screenshot Folder")
      .setDesc("Vault folder where captured video frames are saved (leave blank to use Obsidian's default attachment folder).")
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder("e.g. Attachments/VideoFrames")
          .setValue(this.plugin.settings.screenshotFolder)
          .onChange(async (val) => {
            this.plugin.settings.screenshotFolder = val.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Image Format")
      .setDesc("Format of saved video frame images.")
      .addDropdown((drop) => {
        drop
          .addOption("png", "PNG (Lossless)")
          .addOption("jpeg", "JPEG (Smaller file size)")
          .setValue(this.plugin.settings.screenshotFormat)
          .onChange(async (val) => {
            this.plugin.settings.screenshotFormat = val as "png" | "jpeg";
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Include Clickable Timestamp with Screenshot")
      .setDesc("Append [HH:MM:SS] timestamp link next to the inserted screenshot.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.screenshotIncludeTimestamp)
          .onChange(async (val) => {
            this.plugin.settings.screenshotIncludeTimestamp = val;
            await this.plugin.saveSettings();
          });
      });

    // --- Frontmatter Detection ---
    containerEl.createEl("h3", { text: "Note Properties Detection" });

    new Setting(containerEl)
      .setName("Media Frontmatter Properties")
      .setDesc("Comma-separated property names in YAML frontmatter to recognize as video/audio links.")
      .addText((text) => {
        text
          .setPlaceholder("media_link, media, video, url, youtube")
          .setValue(this.plugin.settings.mediaPropertyNames.join(", "))
          .onChange(async (val) => {
            this.plugin.settings.mediaPropertyNames = val
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          });
      });

    // --- Reset Playback History ---
    new Setting(containerEl)
      .setName("Clear Saved Playback History")
      .setDesc("Clears all remembered positions for watched videos.")
      .addButton((btn) => {
        btn
          .setButtonText("Clear History")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.storedPlaybackPositions = {};
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // Support & Credits Card
    containerEl.createEl("hr", { attr: { style: "margin: 32px 0 20px 0; border: none; border-top: 1px solid var(--background-modifier-border);" } });

    const supportCard = containerEl.createDiv({ cls: "mediascribe-settings-support-card" });
    supportCard.style.cssText =
      "padding: 18px; border-radius: var(--radius-m); background: var(--background-secondary); border: 1px solid var(--background-modifier-border); text-align: center;";

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
    creditsText.setText("Created with ❤️ by SSKhekhaliya");
  }
}
