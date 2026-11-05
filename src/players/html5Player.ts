import { setIcon } from "obsidian";
import { BasePlayer } from "./basePlayer";

export class HTML5Player extends BasePlayer {
  private url: string;
  private isAudioOnly: boolean;
  private mediaEl: HTMLVideoElement | HTMLAudioElement | null = null;
  private secondaryAudioEl: HTMLAudioElement | null = null;
  private centerOverlayEl: HTMLElement | null = null;
  private centerPlayBtn: HTMLElement | null = null;
  private initialTime: number;
  private _hasEnded: boolean = false;

  constructor(url: string, isAudioOnly: boolean = false, initialTime: number = 0) {
    super();
    this.url = url;
    this.isAudioOnly = isAudioOnly;
    this.initialTime = initialTime;
  }

  public mount(container: HTMLElement): void {
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

      // Centered play button overlay for video (clean player without native controls)
      this.centerOverlayEl = wrapper.createDiv({ cls: "mediascribe-html5-center-overlay" });
      this.centerPlayBtn = this.centerOverlayEl.createDiv({ cls: "mediascribe-html5-center-play-btn" });
      setIcon(this.centerPlayBtn, "play");

      this.centerOverlayEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePlay();
      });

      video.addEventListener("click", () => {
        this.togglePlay();
      });

      wrapper.addEventListener("dblclick", () => {
        const host = wrapper.closest(".mediascribe-embedded-host") as HTMLElement | null;
        const target = host || wrapper;
        if (!document.fullscreenElement) {
          if (target.requestFullscreen) {
            target.requestFullscreen().catch(() => {});
          } else if ((target as any).webkitRequestFullscreen) {
            (target as any).webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        }
      });
    }

    this.bindEvents();
  }

  private bindEvents(): void {
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
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.play().catch(() => {});
      }
      if (this.centerOverlayEl) {
        this.centerOverlayEl.addClass("is-playing");
      }
      if (this.centerPlayBtn) {
        this.centerPlayBtn.empty();
        setIcon(this.centerPlayBtn, "play");
        this.centerPlayBtn.removeAttribute("title");
      }
      this.emit("play");
    });

    media.addEventListener("pause", () => {
      this._isPlaying = false;
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.pause();
      }
      if (this.centerOverlayEl) {
        this.centerOverlayEl.removeClass("is-playing");
      }
      this.emit("pause");
    });

    media.addEventListener("seeking", () => {
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.currentTime = media.currentTime;
      }
    });

    media.addEventListener("timeupdate", () => {
      if (this.secondaryAudioEl && Math.abs(this.secondaryAudioEl.currentTime - media.currentTime) > 0.25) {
        this.secondaryAudioEl.currentTime = media.currentTime;
      }
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
        setIcon(this.centerPlayBtn, "rotate-ccw");
        this.centerPlayBtn.setAttribute("title", "Replay");
      }
      this.emit("ended");
    });

    media.addEventListener("ratechange", () => {
      this.emit("ratechange", media.playbackRate || 1.0);
    });

    media.addEventListener("error", (e) => {
      console.error("[MediaScribe] HTML5 Media error:", e);
      this.emit("error", e);
    });
  }

  public async play(): Promise<void> {
    if (this.mediaEl) {
      try {
        if (this._hasEnded || this.mediaEl.ended || (this.mediaEl.duration && this.mediaEl.currentTime >= this.mediaEl.duration - 0.5)) {
          this._hasEnded = false;
          this.mediaEl.currentTime = 0;
          if (this.secondaryAudioEl) this.secondaryAudioEl.currentTime = 0;
        }
        await this.mediaEl.play();
        if (this.secondaryAudioEl) {
          await this.secondaryAudioEl.play().catch(() => {});
        }
        this._isPlaying = true;
      } catch (err) {
        console.warn("[MediaScribe] Autoplay or play blocked:", err);
      }
    }
  }

  public async pause(): Promise<void> {
    if (this.mediaEl) {
      this.mediaEl.pause();
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.pause();
      }
      this._isPlaying = false;
    }
  }

  public async togglePlay(): Promise<void> {
    if (!this.mediaEl) return;
    if (this.mediaEl.paused || this._hasEnded) {
      await this.play();
    } else {
      await this.pause();
    }
  }

  public seekTo(seconds: number): void {
    if (this.mediaEl) {
      this._hasEnded = false;
      this.mediaEl.currentTime = Math.max(0, seconds);
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.currentTime = Math.max(0, seconds);
      }
      this.emit("timeupdate", this.mediaEl.currentTime);
    }
  }

  public async getCurrentTime(): Promise<number> {
    return this.mediaEl?.currentTime || 0;
  }

  public async getDuration(): Promise<number> {
    return this.mediaEl?.duration || 0;
  }

  public setPlaybackRate(rate: number): void {
    if (this.mediaEl) {
      this.mediaEl.playbackRate = rate;
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.playbackRate = rate;
      }
    }
  }

  public async getPlaybackRate(): Promise<number> {
    return this.mediaEl?.playbackRate || 1.0;
  }

  public setVolume(volume: number): void {
    if (this.mediaEl) {
      const vol = Math.max(0, Math.min(100, volume)) / 100;
      this.mediaEl.volume = vol;
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.volume = vol;
      }
    }
  }

  public async getVolume(): Promise<number> {
    return (this.mediaEl?.volume || 1) * 100;
  }

  public setSecondaryAudio(url: string | null): void {
    if (!url) {
      if (this.secondaryAudioEl) {
        this.secondaryAudioEl.pause();
        this.secondaryAudioEl.src = "";
        this.secondaryAudioEl.remove();
        this.secondaryAudioEl = null;
      }
      if (this.mediaEl) {
        this.mediaEl.muted = false;
      }
      return;
    }

    if (!this.secondaryAudioEl) {
      this.secondaryAudioEl = document.createElement("audio");
      this.secondaryAudioEl.style.display = "none";
      this.secondaryAudioEl.preload = "auto";
      this.containerEl?.appendChild(this.secondaryAudioEl);
    }

    if (this.mediaEl) {
      this.mediaEl.muted = true;
    }

    const targetTime = this.mediaEl?.currentTime || 0;
    const currentRate = this.mediaEl?.playbackRate || 1.0;
    const currentVol = this.mediaEl?.volume ?? 1.0;

    this.secondaryAudioEl.src = url;
    this.secondaryAudioEl.playbackRate = currentRate;
    this.secondaryAudioEl.volume = currentVol;

    const syncStartTime = () => {
      if (this.secondaryAudioEl && this.mediaEl) {
        const cur = this.mediaEl.currentTime || targetTime;
        this.secondaryAudioEl.currentTime = cur;
        if (this._isPlaying && !this.mediaEl.paused) {
          this.secondaryAudioEl.play().catch(() => {});
        }
      }
    };

    if (this.secondaryAudioEl.readyState >= 1) {
      syncStartTime();
    } else {
      this.secondaryAudioEl.addEventListener("loadedmetadata", syncStartTime, { once: true });
      this.secondaryAudioEl.addEventListener("canplay", syncStartTime, { once: true });
    }
  }

  public async requestPictureInPicture(): Promise<void> {
    if (this.mediaEl instanceof HTMLVideoElement) {
      if (document.pictureInPictureElement === this.mediaEl) {
        await document.exitPictureInPicture();
      } else {
        await this.mediaEl.requestPictureInPicture();
      }
    }
  }

  public isInPictureInPicture(): boolean {
    return this.mediaEl instanceof HTMLVideoElement && document.pictureInPictureElement === this.mediaEl;
  }

  /**
   * Captures high-res video frame via Canvas
   */
  public async captureFrame(format: "png" | "jpeg" = "png", quality: number = 0.9): Promise<ArrayBuffer | null> {
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

      return await new Promise<ArrayBuffer | null>((resolve) => {
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

  public getVideoElement(): HTMLVideoElement | null {
    if (this.mediaEl instanceof HTMLVideoElement) {
      return this.mediaEl;
    }
    return null;
  }

  public destroy(): void {
    if (this.secondaryAudioEl) {
      this.secondaryAudioEl.pause();
      this.secondaryAudioEl.src = "";
      this.secondaryAudioEl.remove();
      this.secondaryAudioEl = null;
    }
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
}
