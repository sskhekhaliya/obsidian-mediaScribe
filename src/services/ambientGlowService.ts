import { IMediaPlayer, MediaSourceInfo } from "../types";
import { HTML5Player } from "../players/html5Player";

/**
 * AmbientGlowService
 * Casts a soft, dynamic ambient glow behind the video player matching
 * the live video colors (Ambilight effect) and blending into Obsidian's theme.
 */
export class AmbientGlowService {
  private ambientLayerEl: HTMLElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private youtubeBackdropEl: HTMLElement | null = null;
  private isEnabled: boolean = true;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastDrawTime: number = 0;
  private player: IMediaPlayer | null = null;
  private videoEl: HTMLVideoElement | null = null;

  // Bound event handlers for cleanup
  private onPlay = () => this.handlePlay();
  private onPause = () => this.handlePause();
  private onTimeUpdate = () => this.handleTimeUpdate();

  public attach(
    containerEl: HTMLElement,
    source: MediaSourceInfo,
    player: IMediaPlayer,
    enabled: boolean
  ): void {
    this.destroy();

    this.player = player;
    this.isEnabled = enabled;

    // Create the ambient container layer prepended behind the player
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

  private setupHTML5Ambient(): void {
    if (!this.ambientLayerEl || !this.player) return;

    if (this.player instanceof HTML5Player) {
      this.videoEl = this.player.getVideoElement();
    }

    // High performance low-res canvas (64x36 = 16:9 aspect ratio, < 0.1ms render)
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

    // Listen to player events
    this.player.on("play", this.onPlay);
    this.player.on("pause", this.onPause);
    this.player.on("ended", this.onPause);
    this.player.on("timeupdate", this.onTimeUpdate);

    // Initial paint if ready
    this.drawFrame();

    // If already playing
    this.player.getCurrentTime().then(() => {
      this.drawFrame();
    });
  }

  private setupYouTubeAmbient(videoId: string): void {
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

  private handlePlay(): void {
    if (!this.isEnabled) return;
    this.ambientLayerEl?.addClass("is-playing");
    if (!this.videoEl) return;
    this.isRunning = true;
    this.startLoop();
  }

  private handlePause(): void {
    this.ambientLayerEl?.removeClass("is-playing");
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    // Render paused frame
    this.drawFrame();
  }

  private handleTimeUpdate(): void {
    if (!this.isRunning) {
      this.drawFrame();
    }
  }

  private startLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    // Throttle rendering to ~10-12 fps (every 85ms) - perfectly smooth with blur, virtually 0% CPU
    if (now - this.lastDrawTime >= 85) {
      this.drawFrame();
      this.lastDrawTime = now;
    }

    this.animFrameId = requestAnimationFrame(() => this.startLoop());
  }

  private drawFrame(): void {
    if (!this.ctx || !this.canvasEl || !this.videoEl) return;
    if (this.videoEl.readyState < 2) return;

    try {
      this.ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
    } catch {
      // Catch tainted canvas if external remote source without CORS headers
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (this.ambientLayerEl) {
      this.ambientLayerEl.toggleClass("is-hidden", !enabled);
    }

    if (enabled) {
      this.drawFrame();
      if (this.player) {
        // If player is already playing, start loop
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

  public destroy(): void {
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
}
