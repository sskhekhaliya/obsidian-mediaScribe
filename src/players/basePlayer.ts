import { IMediaPlayer, PlayerEventListener, PlayerEventType } from "../types";

export abstract class BasePlayer implements IMediaPlayer {
  protected listeners: Map<PlayerEventType, Set<PlayerEventListener>> = new Map();
  protected _isReady: boolean = false;
  protected _isPlaying: boolean = false;
  protected containerEl: HTMLElement | null = null;

  public get isReady(): boolean {
    return this._isReady;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public on(event: PlayerEventType, listener: PlayerEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: PlayerEventType, listener: PlayerEventListener): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  protected emit(event: PlayerEventType, data?: any): void {
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

  public abstract mount(container: HTMLElement): void;
  public abstract destroy(): void;
  public abstract play(): Promise<void>;
  public abstract pause(): Promise<void>;
  public abstract togglePlay(): Promise<void>;
  public abstract seekTo(seconds: number): void;
  public abstract getCurrentTime(): Promise<number>;
  public abstract getDuration(): Promise<number>;
  public abstract setPlaybackRate(rate: number): void;
  public abstract getPlaybackRate(): Promise<number>;
  public abstract setVolume(volume: number): void;
  public abstract getVolume(): Promise<number>;

  public jump(deltaSeconds: number): void {
    this.getCurrentTime().then((current) => {
      this.seekTo(Math.max(0, current + deltaSeconds));
    });
  }
}
