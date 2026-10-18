import { TFile } from "obsidian";

export type MediaSourceType = "youtube" | "html5_video" | "html5_audio" | "vimeo" | "unknown";

export interface PlaylistItem {
  title: string;
  source: MediaSourceInfo;
  duration?: string;
  videoId?: string;
}

export interface MediaSourceInfo {
  type: MediaSourceType;
  url: string;
  originalInput: string;
  title?: string;
  description?: string;
  author?: string;
  videoId?: string;
  playlistId?: string;
  playlistIndex?: number;
  playlistItems?: PlaylistItem[];
  isPlaylist?: boolean;
  initialTime?: number;
  isLocal: boolean;
  isShorts?: boolean;
  localFile?: TFile;
}

export interface TranscriptItem {
  start: number;
  end: number;
  text: string;
}

export interface NoteTimestampMarker {
  timeSeconds: number;
  displayText: string;
  lineContent?: string;
  lineNumber?: number;
}

export type TimestampFormat = 
  | "bracket"       // [01:23]
  | "full_url_link" // [01:23](https://youtu.be/...#t=83)
  | "markdown_link" // [01:23](#t=83)
  | "wikilink"      // [[#t=83|01:23]]
  | "bold"          // **01:23**
  | "plain";        // 01:23

export type PlayerLayoutMode = "embed_in_note" | "right_sidebar" | "split_horizontal" | "split_vertical";
export type EmbeddedPosition = "top" | "vertical_right" | "vertical_left";
export type PlayerPosition = EmbeddedPosition;

export interface MediaScribeSettings {
  autoEmbedInNote: boolean;
  verifyMediaContentType: boolean;
  embeddedPlayerHeight: number;
  embeddedPosition: EmbeddedPosition;
  embeddedDockWidth: number;
  hideNativeYouTubeControls: boolean;
  hideYouTubeOverlays: boolean;
  youtubeCropZoom: number;
  defaultLayout: PlayerLayoutMode;
  jumpStepSeconds: number;
  timestampFormat: TimestampFormat;
  includeTimestampLeadingZero: boolean;
  autoPauseOnTyping: boolean;
  autoPauseCharThreshold: number;
  autoPauseIdleResumeSec: number;
  autoResumeRewindSec: number;
  screenshotFolder: string;
  screenshotFormat: "png" | "jpeg";
  screenshotQuality: number;
  screenshotIncludeTimestamp: boolean;
  screenshotNamingPrefix: string;
  defaultPlaybackRate: number;
  rememberPlaybackPosition: boolean;
  storedPlaybackPositions: Record<string, number>;
  storedPlaybackLastAccessed?: Record<string, number>;
  rememberSidePanelState: boolean;
  storedSidePanelStates: Record<string, StoredSidePanelState>;
  autoClearHistoryDays: number;
  mediaPropertyNames: string[]; // e.g. ["media_link", "media", "video", "url"]
  enableAmbientMode: boolean;
  playlistNoteProperty: string;
  playlistNoteFolderLocation: "current_folder" | "specific_folder";
  playlistNoteSpecificFolder: string;
  playlistAutoplay: boolean;
}

export interface StoredSidePanelState {
  isOpen: boolean;
  activeTab: "playlist" | "transcript" | "description";
  lastAccessed?: number;
}

export const DEFAULT_SETTINGS: MediaScribeSettings = {
  autoEmbedInNote: true,
  verifyMediaContentType: true,
  embeddedPlayerHeight: 340,
  embeddedPosition: "top",
  embeddedDockWidth: 420,
  hideNativeYouTubeControls: false,
  hideYouTubeOverlays: true,
  youtubeCropZoom: 1.0,
  defaultLayout: "embed_in_note",
  jumpStepSeconds: 5,
  timestampFormat: "bracket",
  includeTimestampLeadingZero: true,
  autoPauseOnTyping: false,
  autoPauseCharThreshold: 3,
  autoPauseIdleResumeSec: 2.0,
  autoResumeRewindSec: 1.5,
  screenshotFolder: "",
  screenshotFormat: "png",
  screenshotQuality: 0.9,
  screenshotIncludeTimestamp: true,
  screenshotNamingPrefix: "MediaFrame_",
  defaultPlaybackRate: 1.0,
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
  playlistAutoplay: true
};

export type PlayerEventType = 
  | "ready" 
  | "play" 
  | "pause" 
  | "timeupdate" 
  | "durationchange" 
  | "ratechange" 
  | "ended" 
  | "error"
  | "playlistindexchange";

export type PlayerEventListener = (data?: any) => void;

export interface IMediaPlayer {
  readonly isReady: boolean;
  readonly isPlaying: boolean;
  mount(container: HTMLElement): void;
  destroy(): void;
  play(): Promise<void>;
  pause(): Promise<void>;
  togglePlay(): Promise<void>;
  seekTo(seconds: number): void;
  jump(deltaSeconds: number): void;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): Promise<number>;
  setVolume(volume: number): void; // 0 to 100
  getVolume(): Promise<number>;
  captureFrame?(format?: "png" | "jpeg", quality?: number): Promise<ArrayBuffer | null>;
  getVideoElement?(): HTMLElement | null;
  nextVideo?(): void;
  previousVideo?(): void;
  playVideoAt?(index: number): void;
  on(event: PlayerEventType, listener: PlayerEventListener): void;
  off(event: PlayerEventType, listener: PlayerEventListener): void;
}
