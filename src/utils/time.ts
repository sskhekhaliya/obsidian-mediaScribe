/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export function formatSeconds(totalSeconds: number, forceHours: boolean = false): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    totalSeconds = 0;
  }
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const pad = (num: number) => num.toString().padStart(2, "0");

  if (hours > 0 || forceHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Parses timestamp string into total seconds.
 * Supports:
 * - "01:23:45" -> 5025
 * - "12:34" -> 754
 * - "1:05" -> 65
 * - "t=125" -> 125
 * - "t=1h2m3s" -> 3723
 * - "t=2m30s" -> 150
 * - "125s" -> 125
 */
export function parseTimestamp(input: string): number | null {
  if (!input) return null;
  let str = input.trim();

  // Strip wrapping parentheses: "(#t=16)" -> "#t=16"
  if (str.startsWith("(") && str.endsWith(")")) {
    str = str.substring(1, str.length - 1).trim();
  }

  // Handle markdown links: [00:16](#t=16) or [00:16]() or [00:16](...)
  const mdMatch = str.match(/^\[([^\]]+)\](?:\(([^)]*)\))?$/);
  if (mdMatch) {
    if (mdMatch[2]) {
      const fromUrl = parseTimestamp(mdMatch[2]);
      if (fromUrl !== null) return fromUrl;
    }
    const fromLabel = parseTimestamp(mdMatch[1]);
    if (fromLabel !== null) return fromLabel;
  }

  // Handle wikilinks: [[#t=16|00:16]] or [[00:16]]
  const wikiMatch = str.match(/^\[\[(?:#t=([0-9hms]+)\|)?([^\]]+)\]\]$/i);
  if (wikiMatch) {
    if (wikiMatch[1]) {
      const fromUrl = parseTimestamp(wikiMatch[1]);
      if (fromUrl !== null) return fromUrl;
    }
    const fromLabel = parseTimestamp(wikiMatch[2]);
    if (fromLabel !== null) return fromLabel;
  }

  // Strip #t= or t= prefix
  if (str.toLowerCase().startsWith("#t=")) {
    str = str.substring(3).trim();
  } else if (str.toLowerCase().startsWith("t=")) {
    str = str.substring(2).trim();
  }

  // Match t=1h2m3s or 1h2m3s
  const hmPattern = /^(?:(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?)$/i;
  if (str.includes("h") || str.includes("m") || str.includes("s")) {
    const match = str.match(hmPattern);
    if (match && (match[1] || match[2] || match[3])) {
      const h = parseInt(match[1] || "0", 10);
      const m = parseInt(match[2] || "0", 10);
      const s = parseInt(match[3] || "0", 10);
      return h * 3600 + m * 60 + s;
    }
  }

  // Match direct integer seconds: "123"
  const directSec = str.match(/^(\d+)$/);
  if (directSec) {
    return parseInt(directSec[1], 10);
  }

  // Match HH:MM:SS or MM:SS or H:MM:SS (with optional brackets)
  const colons = str.match(/^(?:\[|\()?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\))?$/);
  if (colons) {
    if (colons[3] !== undefined) {
      // Hours:Minutes:Seconds
      const h = parseInt(colons[1], 10);
      const m = parseInt(colons[2], 10);
      const s = parseInt(colons[3], 10);
      return h * 3600 + m * 60 + s;
    } else {
      // Minutes:Seconds
      const m = parseInt(colons[1], 10);
      const s = parseInt(colons[2], 10);
      return m * 60 + s;
    }
  }

  return null;
}

/**
 * Regex patterns to detect timestamps in markdown text
 * Matches:
 * 1. [01:23] or [01:23:45]
 * 2. [01:23](#t=83) or [01:23]()
 * 3. [[#t=83|01:23]]
 * 4. 01:23 or 01:23:45 preceded by space/boundary
 */
export const TIMESTAMP_REGEX_PATTERNS = [
  // Markdown link with timestamp in label: [12:34](...) or [01:23:45](...)
  /\[(\d{1,2}:\d{2}(?::\d{2})?)\](?:\([^)]*\))?/g,
  // Wikilink: [[#t=123|12:34]]
  /\[\[(?:#t=[^|]+\|)?(\d{1,2}:\d{2}(?::\d{2})?)\]\]/g,
  // Standalone bracket: [12:34]
  /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g
];

export interface ExtractedTimestamp {
  timeSeconds: number;
  displayText: string;
  index: number;
  length: number;
  lineContent?: string;
}

/**
 * Extracts all timestamp occurrences from a markdown text
 */
export function extractTimestampsFromText(text: string): ExtractedTimestamp[] {
  const results: ExtractedTimestamp[] = [];
  const lines = text.split("\n");
  let charOffset = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // Find timestamps in this line
    const regex = /(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\](?:\([^)]*\))?|\[\[(?:#t=[^|]+\|)?(\d{1,2}:\d{2}(?::\d{2})?)\]\]|(?<=\s|^)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$|[.,!?]))/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
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
    charOffset += line.length + 1; // +1 for \n
  }

  // Sort by time ascending
  return results.sort((a, b) => a.timeSeconds - b.timeSeconds);
}
