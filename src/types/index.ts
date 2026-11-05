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

/**
 * Checks if two MediaSourceInfo instances represent the exact same media stream or file.
 */
export function isSameMediaSource(a?: MediaSourceInfo | null, b?: MediaSourceInfo | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  // 1. YouTube videoId
  if (a.videoId && b.videoId && a.videoId === b.videoId) {
    return true;
  }

  // 2. Local vault file
  if (a.localFile && b.localFile && a.localFile.path === b.localFile.path) {
    return true;
  }

  // 3. originalInput (e.g. "[[movie.mkv]]" or "D:\movies\film.mp4" or "https://...")
  if (a.originalInput && b.originalInput && a.originalInput.trim() === b.originalInput.trim()) {
    return true;
  }

  // 4. URL comparison ignoring cachebuster / query params
  if (a.url && b.url) {
    const cleanA = a.url.split("?")[0].trim().toLowerCase();
    const cleanB = b.url.split("?")[0].trim().toLowerCase();
    if (cleanA && cleanA === cleanB) {
      return true;
    }
  }

  return false;
}

export interface AudioTrackInfo {
  index: number;
  audioIndex: number;
  codec: string;
  language: string;
  languageLabel: string;
  title: string;
  isDefault: boolean;
}

export interface SubtitleTrackInfo {
  index: number;
  subIndex: number;
  codec: string;
  language: string;
  languageLabel: string;
  title: string;
  isDefault: boolean;
}

export interface MediaTracksResult {
  filePath: string;
  audioTracks: AudioTrackInfo[];
  subtitleTracks: SubtitleTrackInfo[];
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
  | "bracket"       // [01:23]() - Clean Stamp
  | "full_url_link" // [01:23](https://youtu.be/...#t=83)
  | "markdown_link" // [01:23](#t=83)
  | "wikilink";     // [[#t=83|01:23]]

export type SubtitleQuoteAction = "quote" | "range" | "bullet" | "dialogue_only" | "clipboard";

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
  enableCaptions?: boolean;
  storedAudioTracks?: Record<string, number>;
  storedSubtitleTracks?: Record<string, number | null>;
  defaultQuoteAction?: SubtitleQuoteAction;
  playlistNoteProperty: string;
  playlistNoteFolderLocation: "current_folder" | "specific_folder";
  playlistNoteSpecificFolder: string;
  playlistAutoplay: boolean;
  mobileTopMargin?: number;
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
  enableCaptions: false,
  storedAudioTracks: {},
  storedSubtitleTracks: {},
  defaultQuoteAction: "quote",
  playlistNoteProperty: "video_link",
  playlistNoteFolderLocation: "current_folder",
  playlistNoteSpecificFolder: "",
  playlistAutoplay: true,
  mobileTopMargin: 48
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
  setSecondaryAudio?(url: string | null): void;
  captureFrame?(format?: "png" | "jpeg", quality?: number): Promise<ArrayBuffer | null>;
  getVideoElement?(): HTMLElement | null;
  nextVideo?(): void;
  previousVideo?(): void;
  playVideoAt?(index: number): void;
  on(event: PlayerEventType, listener: PlayerEventListener): void;
  off(event: PlayerEventType, listener: PlayerEventListener): void;
}
