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
export function parseTimestamp(input: string, allowBareSeconds: boolean = false): number | null {
  if (!input) return null;
  let str = input.trim();

  // Strip wrapping parentheses: "(#t=16)" -> "#t=16"
  if (str.startsWith("(") && str.endsWith(")")) {
    str = str.substring(1, str.length - 1).trim();
  }

  // Handle markdown links: [00:16](#t=16) or [00:16]() or [00:16](...)
  // Strictly requires both [] and () so bare [00:16] text is never treated as a link
  const mdMatch = str.match(/^\[([^\]]+)\]\(([^)]*)\)$/);
  if (mdMatch) {
    if (mdMatch[2]) {
      const fromUrl = parseTimestamp(mdMatch[2], true);
      if (fromUrl !== null) return fromUrl;
    }
    const fromLabel = parseTimestamp(mdMatch[1]);
    if (fromLabel !== null) return fromLabel;
  }

  // Handle wikilinks: [[#t=16|00:16]] or [[00:16]]
  const wikiMatch = str.match(/^\[\[(?:#t=([0-9hms]+)\|)?([^\]]+)\]\]$/i);
  if (wikiMatch) {
    if (wikiMatch[1]) {
      const fromUrl = parseTimestamp(wikiMatch[1], true);
      if (fromUrl !== null) return fromUrl;
    }
    const fromLabel = parseTimestamp(wikiMatch[2]);
    if (fromLabel !== null) return fromLabel;
  }

  // Extract t= parameter from URLs: e.g. https://youtu.be/xxx?t=115 or video.mp4#t=115
  const urlParamMatch = str.match(/[?&#]t=([0-9hms]+)/i);
  if (urlParamMatch && urlParamMatch[1]) {
    const fromParam = parseTimestamp(urlParamMatch[1], true);
    if (fromParam !== null) return fromParam;
  }

  // Strip #t= or t= prefix
  let hasExplicitPrefix = false;
  if (str.toLowerCase().startsWith("#t=")) {
    str = str.substring(3).trim();
    hasExplicitPrefix = true;
  } else if (str.toLowerCase().startsWith("t=")) {
    str = str.substring(2).trim();
    hasExplicitPrefix = true;
  }

  // Match t=1h2m3s or 1h2m3s
  const hmPattern = /^(?:(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?)$/i;
  if (
    str.includes("h") ||
    str.includes("m") ||
    (str.includes("s") && (hasExplicitPrefix || allowBareSeconds || /\d+[mh]/i.test(str)))
  ) {
    const match = str.match(hmPattern);
    if (match && (match[1] || match[2] || match[3])) {
      const h = parseInt(match[1] || "0", 10);
      const m = parseInt(match[2] || "0", 10);
      const s = parseInt(match[3] || "0", 10);
      return h * 3600 + m * 60 + s;
    }
  }

  // Match direct integer seconds: ONLY if explicitly prefixed (t=..., #t=...) or explicitly allowed
  const directSec = str.match(/^(\d+)$/);
  if (directSec) {
    if (hasExplicitPrefix || allowBareSeconds) {
      return parseInt(directSec[1], 10);
    }
    return null;
  }

  // Match HH:MM:SS or MM:SS or H:MM:SS (with optional brackets)
  const colons = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
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

export interface TimestampRange {
  start: number;
  end: number;
  rawStart: string;
  rawEnd: string;
}

/**
 * Parses a range of timestamps into start and end seconds.
 * Supports:
 * - "[01:23 - 02:45]" or "01:23 - 02:45"
 * - "[01:23:00 - 01:25:30]"
 * - "[1:23-2:45]"
 * - "[01:23 – 02:45]" (en-dash)
 * - "[01:23 — 02:45]" (em-dash)
 * - "[01:23 to 02:45]"
 * - "[10s - 45s]"
 * - "[15 - 45]"
 */
export function parseTimestampRange(input: string, allowBareBrackets: boolean = false): TimestampRange | null {
  if (!input) return null;
  let str = input.trim();

  // Strip wrapping markdown links if present: "[01:23 - 02:45](#...)" or "[01:23 - 02:45]()"
  const mdMatch = str.match(/^\[([^\]]+)\]\(([^)]*)\)$/);
  if (mdMatch) {
    str = mdMatch[1].trim();
  } else if (str.startsWith("[[") && str.endsWith("]]")) {
    str = str.substring(2, str.length - 2).trim();
  } else if (str.startsWith("[") && str.endsWith("]")) {
    if (!allowBareBrackets) {
      // Bare [text] without () is strictly rejected as not a markdown link
      return null;
    }
    str = str.substring(1, str.length - 1).trim();
  } else if (str.startsWith("(") && str.endsWith(")")) {
    str = str.substring(1, str.length - 1).trim();
  }

  // Split on separator: -, –, —, ~, or "to"
  const splitMatch = str.match(/^(.+?)\s*(?:[-–—~]|\bto\b)\s*(.+)$/i);
  if (!splitMatch) return null;

  const rawStart = splitMatch[1].trim();
  const rawEnd = splitMatch[2].trim();

  const startSec = parseTimestamp(rawStart, true);
  const endSec = parseTimestamp(rawEnd, true);

  if (startSec === null || endSec === null) {
    return null;
  }

  const min = Math.min(startSec, endSec);
  const max = Math.max(startSec, endSec);

  return {
    start: min,
    end: max,
    rawStart,
    rawEnd
  };
}

/**
 * Regex patterns to detect timestamps in markdown text
 * Matches:
 * 1. [01:23](...) or [01:23]()
 * 2. [[#t=83|01:23]] or [[01:23]]
 */
export const TIMESTAMP_REGEX_PATTERNS = [
  // Markdown link with timestamp in label: [12:34](...) or [12:34]()
  /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\([^)]*\)/g,
  // Wikilink: [[#t=123|12:34]] or [[12:34]]
  /\[\[(?:#t=[^|]+\|)?(\d{1,2}:\d{2}(?::\d{2})?)\]\]/g
];

export interface ExtractedTimestamp {
  timeSeconds: number;
  displayText: string;
  index: number;
  length: number;
  lineContent?: string;
  isRange?: boolean;
  endSeconds?: number;
}

/**
 * Extracts all timestamp occurrences from a markdown text, ignoring code blocks and inline code.
 * Strictly requires markdown link format [timestamp](...) (including empty ()) or wikilink [[...]].
 * Plain text or bare brackets [hh:mm] are deliberately not extracted as timestamps.
 */
export function extractTimestampsFromText(text: string): ExtractedTimestamp[] {
  const results: ExtractedTimestamp[] = [];
  const lines = text.split("\n");
  let charOffset = 0;
  let inCodeBlock = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Check fenced code blocks
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      charOffset += line.length + 1;
      continue;
    }
    if (inCodeBlock) {
      charOffset += line.length + 1;
      continue;
    }

    // Mask out inline code spans (`...`) so timestamps inside inline code are never extracted
    let lineForMatching = line.replace(/`[^`]+`/g, (m) => " ".repeat(m.length));

    // 1. First extract range timestamps that have both [] and ():
    // e.g. [01:23 - 02:45]() or [01:23 - 02:45](url) or [[01:23 - 02:45]]
    const rangeRegex = /(?:\[\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\]|\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\([^)]*\))/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = rangeRegex.exec(lineForMatching)) !== null) {
      const sStr = rMatch[1] || rMatch[3];
      const eStr = rMatch[2] || rMatch[4];
      if (sStr && eStr) {
        const startSec = parseTimestamp(sStr);
        const endSec = parseTimestamp(eStr);
        if (startSec !== null && endSec !== null) {
          results.push({
            timeSeconds: Math.min(startSec, endSec),
            displayText: `${sStr} - ${eStr}`,
            index: charOffset + rMatch.index,
            length: rMatch[0].length,
            lineContent: line.trim(),
            isRange: true,
            endSeconds: Math.max(startSec, endSec)
          });
        }
      }
    }

    // Mask out matched ranges so single timestamp regex doesn't match parts of them
    lineForMatching = lineForMatching.replace(rangeRegex, (m) => " ".repeat(m.length));

    // 2. Find single timestamps that have both [] and () or wikilinks [[]]:
    // e.g. [01:23]() or [01:23](#t=83) or [01:23](https://...) or [[#t=83|01:23]]
    const regex = /(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\([^)]*\)|\[\[(?:#t=[^|]+\|)?(\d{1,2}:\d{2}(?::\d{2})?)\]\])/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineForMatching)) !== null) {
      const timeStr = match[1] || match[2];
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

  // Sort by appearance in text ascending
  return results.sort((a, b) => a.index - b.index);
}

/**
 * Escapes markdown and Obsidian-specific property/link syntax in subtitle or caption text
 * so that it is rendered and treated as literal plain text inside Obsidian notes.
 *
 * Escapes:
 * - Square brackets `[` and `]` (prevents wikilinks `[[page]]` and markdown links `[text]()` or `[music]`)
 * - Hashes `#` (prevents Obsidian tags `#tag` or heading interpretation)
 * - Carets `^` (prevents Obsidian block reference `^id`)
 * - Dataview colons `::` (prevents Dataview inline field syntax `key:: value`)
 */
export function sanitizeSubtitleForMarkdown(text: string): string {
  if (!text) return "";
  // Strip any lingering HTML tags and normalize whitespace
  let clean = text
    .replace(/<[^>]*>/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Escape special syntax without double-escaping already escaped characters
  return clean
    .replace(/(?<!\\)\[/g, "\\[")
    .replace(/(?<!\\)\]/g, "\\]")
    .replace(/(?<!\\)#/g, "\\#")
    .replace(/(?<!\\)\^/g, "\\^")
    .replace(/::/g, "\\::");
}

