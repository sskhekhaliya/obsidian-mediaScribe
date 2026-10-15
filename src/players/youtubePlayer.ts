import { setIcon } from "obsidian";
import { BasePlayer } from "./basePlayer";

export class YouTubePlayer extends BasePlayer {
  private videoId: string;
  private playlistId?: string;
  private initialTime: number;
  private hideNativeControls: boolean;
  private hideOverlays: boolean;
  private isShorts: boolean;
  private iframeEl: HTMLIFrameElement | null = null;
  private thumbOverlayEl: HTMLElement | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private pollInterval: number | null = null;

  private currentTime: number = 0;
  private duration: number = 0;
  private playbackRate: number = 1.0;
  private volume: number = 100;

  constructor(
    videoId: string,
    initialTime: number = 0,
    playlistId?: string,
    hideNativeControls: boolean = false,
    hideOverlays: boolean = false,
    _cropZoom: number = 1.0,
    isShorts: boolean = false
  ) {
    super();
    this.videoId = videoId;
    this.initialTime = initialTime;
    this.playlistId = playlistId;
    this.hideNativeControls = hideNativeControls;
    this.hideOverlays = hideOverlays;
    this.isShorts = isShorts;
    this.currentTime = initialTime;
  }

  private playerSizeEl: HTMLElement | null = null;
  private croppingDivEl: HTMLElement | null = null;
  private clickShieldEl: HTMLElement | null = null;

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    container.empty();

    if (this.isShorts) {
      container.addClass("mediascribe-shorts-active");
    } else {
      container.removeClass("mediascribe-shorts-active");
    }

    // CodePen Letterbox Precision Crop Structure
    const playerSize = container.createDiv({ cls: "mediascribe-player-size" });
    const croppingDiv = playerSize.createDiv({ cls: "mediascribe-cropping-div" });
    this.playerSizeEl = playerSize;
    this.croppingDivEl = croppingDiv;
    const divToCrop = croppingDiv.createDiv({ cls: "mediascribe-div-to-crop" });
    const wrapper = divToCrop.createDiv({ cls: "mediascribe-player-wrapper mediascribe-youtube-wrapper" });

    const controlsVal = (this.hideNativeControls || this.hideOverlays || this.isShorts) ? 0 : 1;
    const fsVal = 1;
    const params = `enablejsapi=1&controls=${controlsVal}&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&cc_load_policy=3&cc_lang_pref=off&fs=${fsVal}&autoplay=0`;

    let src = "";
    if (this.playlistId) {
      if (this.videoId) {
        src = `https://www.youtube.com/embed/${this.videoId}?list=${this.playlistId}&${params}&start=${Math.floor(this.initialTime)}`;
      } else {
        src = `https://www.youtube.com/embed/videoseries?list=${this.playlistId}&${params}`;
      }
    } else {
      src = `https://www.youtube.com/embed/${this.videoId}?${params}&start=${Math.floor(this.initialTime)}`;
    }

    this.iframeEl = wrapper.createEl("iframe", {
      cls: "mediascribe-iframe",
      attr: {
        src: src,
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

    // High-res uncropped thumbnail overlay before video playback begins
    if (this.videoId && (this.hideOverlays || this.isShorts)) {
      this.createThumbnailOverlay(croppingDiv);
    }

    this.setupMessageListener();

    // Start checking readiness and subscribe to listening
    this.iframeEl.addEventListener("load", () => {
      this.sendListening();
      // Poll initial state
      let attempts = 0;
      const readyCheck = window.setInterval(() => {
        attempts++;
        this.sendListening();
        if (this._isReady || attempts > 25) {
          window.clearInterval(readyCheck);
          if (!this._isReady) {
            this._isReady = true;
            this.emit("ready");
          }
        }
      }, 250);
    });
  }

  private disableCaptions(): void {
    this.sendPostMessage("unloadModule", ["captions"]);
    this.sendPostMessage("unloadModule", ["cc"]);
    this.sendPostMessage("setOption", ["captions", "track", {}]);
    this.sendPostMessage("setOption", ["cc", "track", {}]);
  }

  private sendListening(): void {
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
      // ignore
    }
  }

  private setupMessageListener(): void {
    this.messageListener = (event: MessageEvent) => {
      // YouTube embeds post JSON strings or objects
      let data: any = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      if (!data || typeof data !== "object") return;

      // Handle YouTube API events
      if (data.event === "onReady" || data.event === "initialDelivery" || data.event === "onApiChange") {
        this.disableCaptions();
        if (!this._isReady) {
          this._isReady = true;
          this.sendListening();
          this.emit("ready");
        }
      }

      // Check player state
      let state: number | null = null;
      if (data.event === "onStateChange") {
        if (typeof data.info === "number") state = data.info;
        else if (typeof data.data === "number") state = data.data;
      } else if (data.event === "infoDelivery" && data.info && typeof data.info.playerState === "number") {
        state = data.info.playerState;
      }

      if (state !== null) {
        if (state === 1) { // Playing
          this.disableCaptions();
          this.hideThumbnail();
          this._isPlaying = true;
          this.emit("play");
        } else if (state === 2) { // Paused
          this._isPlaying = false;
          this.emit("pause");
        } else if (state === 0) { // Ended
          this._isPlaying = false;
          this.emit("ended");
        }
      }

      // Check duration
      let dur: number | null = null;
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

        if (typeof info.playlistIndex === "number") {
          this.emit("playlistindexchange", info.playlistIndex);
        }
      }
    };

    window.addEventListener("message", this.messageListener);
  }

  private createThumbnailOverlay(container: HTMLElement): void {
    if (!this.videoId || this.thumbOverlayEl) return;
    this.thumbOverlayEl = container.createDiv({ cls: "mediascribe-thumb-overlay" });
    this.updateThumbnailImage();

    const playBtn = this.thumbOverlayEl.createDiv({ cls: "mediascribe-thumb-play-btn" });
    setIcon(playBtn, "play");

    this.thumbOverlayEl.addEventListener("click", () => {
      this.hideThumbnail();
      this.play();
    });
  }

  private updateThumbnailImage(): void {
    if (!this.thumbOverlayEl || !this.videoId) return;

    if (this.isShorts) {
      const oar2 = `https://i.ytimg.com/vi/${this.videoId}/oar2.jpg`;
      const maxres = `https://img.youtube.com/vi/${this.videoId}/maxresdefault.jpg`;

      // Try native 9:16 vertical thumbnail first
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
      const maxres = `https://img.youtube.com/vi/${this.videoId}/maxresdefault.jpg`;
      const hq = `https://img.youtube.com/vi/${this.videoId}/hqdefault.jpg`;

      this.thumbOverlayEl.style.backgroundImage = `url('${maxres}')`;

      const imgCheck = new Image();
      imgCheck.onload = () => {
        if (imgCheck.naturalWidth <= 120 && this.thumbOverlayEl) {
          this.thumbOverlayEl.style.backgroundImage = `url('${hq}')`;
        }
      };
      imgCheck.src = maxres;
    }
  }

  private hideThumbnail(): void {
    if (this.thumbOverlayEl) {
      this.thumbOverlayEl.addClass("is-hidden");
    }
  }

  private sendPostMessage(func: string, args: any[] = []): void {
    if (!this.iframeEl || !this.iframeEl.contentWindow) return;
    try {
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: func,
          args: args
        }),
        "*"
      );
    } catch (err) {
      console.warn("[MediaScribe] Failed to send postMessage to YouTube iframe:", err);
    }
  }

  public async play(): Promise<void> {
    this.hideThumbnail();
    this.sendPostMessage("playVideo");
    this.disableCaptions();
    this._isPlaying = true;
    this.emit("play");
  }

  public async pause(): Promise<void> {
    this.sendPostMessage("pauseVideo");
    this._isPlaying = false;
    this.emit("pause");
  }

  public async togglePlay(): Promise<void> {
    if (this._isPlaying) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  public seekTo(seconds: number): void {
    this.currentTime = Math.max(0, seconds);
    this.sendPostMessage("seekTo", [this.currentTime, true]);
    this.emit("timeupdate", this.currentTime);
  }

  public async getCurrentTime(): Promise<number> {
    return this.currentTime;
  }

  public async getDuration(): Promise<number> {
    return this.duration;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.sendPostMessage("setPlaybackRate", [rate]);
  }

  public async getPlaybackRate(): Promise<number> {
    return this.playbackRate;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    this.sendPostMessage("setVolume", [this.volume]);
  }

  public async getVolume(): Promise<number> {
    return this.volume;
  }

  public nextVideo(): void {
    this.sendPostMessage("nextVideo");
  }

  public previousVideo(): void {
    this.sendPostMessage("previousVideo");
  }

  public playVideoAt(index: number): void {
    this.sendPostMessage("playVideoAt", [index]);
  }

  public getIFrameElement(): HTMLIFrameElement | null {
    return this.iframeEl;
  }

  public getVideoElement(): HTMLElement | null {
    if (this.hideOverlays && this.croppingDivEl) {
      return this.croppingDivEl;
    }
    return this.playerSizeEl || this.containerEl;
  }

  public setShortsMode(isShorts: boolean): void {
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

  public destroy(): void {
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
}
