# 🎬 MediaScribe for Obsidian

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7c3aed?style=for-the-badge&logo=obsidian)](https://obsidian.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<p align="center">
  <a href="https://buymeacoffee.com/sskhekhaliya">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee">
  </a>
</p>

**MediaScribe** is a next-generation video and audio note-taking plugin for Obsidian. Engineered for students, researchers, developers, and lifelong learners who want a distraction-free, high-speed flow state while learning from video lectures, podcasts, tutorials, YouTube Shorts, and local recordings.

---

## ✨ Why MediaScribe?

| Feature | MediaScribe | Traditional Media Note Plugins |
| :--- | :---: | :---: |
| **⚡ Instant In-Note Docking** | ✅ **Top Horizontal & Vertical Splits (Left/Right)** | Limited / Static |
| **📱 YouTube Shorts (9:16)** | ✅ **Native Vertical Ratio + Clean Centered Fit** | ❌ Black Bars / Cropped |
| **📑 YouTube & Local Playlists** | ✅ **YouTube `list=...` & YAML Multi-Part Courses** | ❌ Single Video Only |
| **🌈 Ambient Glow (Ambilight)** | ✅ **Real-Time Dynamic Video Backlighting** | ❌ No |
| **📸 One-Key Frame Snapshots** | ✅ **Native High-Res Canvas Snap (`Ctrl+Shift+S`)** | ❌ No |
| **✍️ Typing Scribe (Auto-Pause)** | ✅ **Auto-pauses on typing, rewinds & resumes on idle** | ❌ Manual Only |
| **📜 Live Interactive Transcripts** | ✅ **Searchable, Click-to-Seek, Quote-to-Note** | ❌ No |
| **📝 Video Description & Chapters** | ✅ **One-Click Fetch with Clickable Timestamps** | ❌ No |
| **📍 Visual Scrubber Markers** | ✅ **Interactive Pins directly on timeline scrubber** | ❌ No |
| **🔁 A-B Repeat Looping** | ✅ **Continuous Segment Practice for Code & Audio** | ❌ No |
| **📁 Local Video & Audio Support** | ✅ **`.mp4`, `.webm`, `.mkv`, `.mp3`, `.m4a`, `.wav`** | ❌ YouTube Only |
| **💾 Playback Position Memory** | ✅ **Automatically resumes exactly where you stopped** | Limited |

---

## 🚀 Key Features

### 1. ⚡ Flexible Docking & Instant In-Note Auto-Embedding
- **Zero-Friction Loading:** Add `media_link: <url>` to your note frontmatter. The player mounts instantly as you open your note.
- **Three In-Note Docking Layouts:**
  - **Top Horizontal:** Sits above your notes with a drag-to-resize height handle and a **Mini-Player Collapse Toggle (`▲` / `▼`)** that folds the video into a 34px sticky control bar.
  - **Vertical Split Right:** Video docks side-by-side to the right of your editor with adjustable column width.
  - **Vertical Split Left:** Video docks to the left of your editor for comfortable left-to-right reading workflows.
- **Right Sidebar Dock:** Move the player seamlessly to Obsidian's Right Sidebar (or back into your note) with zero interruption in playback or playback position.

### 2. 📱 Native YouTube Shorts & 9:16 Vertical Video Support
- First-class support for YouTube Shorts and vertical mobile recordings.
- Maintains true **9:16 aspect ratio** with high-resolution uncropped poster thumbnails (`oar2.jpg`).
- Eliminates distracting YouTube overlay clutter, avatar watermarks, and "More videos" grids for an uncluttered study experience.

### 3. 🌈 Dynamic Ambient Glow (Ambilight)
- Projects a smooth, real-time diffused backlighting glow around the player that harmonizes with the video's colors.
- Provides a cinema-like aesthetic that reduces eye strain in Obsidian dark themes.
- Can be toggled on or off anytime with one click in the player toolbar or plugin settings.

### 4. 📑 Course & YouTube Playlist Support
- **YouTube Playlists:** Paste any playlist link (`https://www.youtube.com/playlist?list=...` or video with `&list=...`). MediaScribe displays previous/next controls, title info, and a playlist badge (`Part 3/45`).
- **Seamless Position Memory:** Navigating with Next/Previous buttons or picking any item in the playlist drawer remembers each individual video's playback point and resumes right where you left off.
- **Create Note for Video:** Right-click any video in the playlist drawer to instantly create a dedicated note configured with your preferred frontmatter property and target folder.
- **Multi-Part Local Courses:** Define structured series right inside your note frontmatter:
  ```yaml
  ---
  media_link:
    - "[[01 - Introduction.mp4]]"
    - "[[02 - Core Concepts.mp4]]"
    - "[[03 - Advanced Architecture.mp4]]"
  ---
  ```
- **Playlist Drawer (`📑`):** Expand the built-in drawer to preview all parts with durations, active highlight, auto-scroll, and switch videos instantly.

### 5. 📸 One-Key Frame Screenshots
- Press `Ctrl+Shift+S` (or `Cmd+Shift+S`) at any point during playback.
- MediaScribe grabs the current video frame at native resolution, saves the image to your vault attachment folder, and pastes `![[MediaFrame_...png]] [04:12]` straight at your cursor!

### 6. ✍️ Typing Scribe (Smart Auto-Pause & Resume)
- Take comprehensive notes without touching pause buttons.
- Media playback automatically pauses as soon as you type in your note.
- **Pause Trigger Threshold:** Configurable character threshold (e.g. 3 characters) so minor edits like commas or punctuation don't trigger unwanted pauses.
- Once you stop typing for a couple seconds, it gently rewinds (e.g. 1.5s) to preserve your train of thought and resumes playback automatically.

### 7. 📜 Interactive Transcripts & Subtitles
- Automatically pulls YouTube timed captions or detects local `.srt` / `.vtt` subtitles alongside your media files.
- **Instant Search:** Filter spoken dialogue in real time.
- **Click to Seek:** Click any transcript sentence to jump the player to that exact millisecond.
- **Quote to Note (`”`):** Insert selected spoken quotes directly into your active note as timestamped markdown blockquotes.

### 8. 📝 YouTube Description & Chapter Importer
- View the full YouTube video description and author details in a dedicated side panel.
- Converts all timestamps inside the description into clickable Obsidian timestamp links.
- Click **Insert Description** to paste chapter breakdowns and reference links directly into your note.

### 9. 📍 Visual Timeline Pins (Note Scrubber Markers)
- Timestamps recorded in your note are automatically rendered as colored chapter pins on the video progress bar.
- Hover over any pin to preview the note line, or click to jump straight to that moment.

### 10. 🔁 A-B Repeat Looping
- Set Point A and Point B to loop a complex coding demo, language pronunciation snippet, or musical lick continuously.

---

## ⌨️ Default Hotkeys

| Hotkey | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Play / Pause media |
| `Ctrl + J` / `Cmd + J` | Jump backward (default 5s) |
| `Ctrl + L` / `Cmd + L` | Jump forward (default 5s) |
| `Ctrl + I` / `Cmd + I` | Insert current timestamp link into note |
| `Ctrl + Shift + S` / `Cmd + Shift + S` | Capture frame screenshot into note |
| `Ctrl + Alt + N` / `Cmd + Alt + N` | Next video in playlist |
| `Ctrl + Alt + P` / `Cmd + Alt + P` | Previous video in playlist |

*(All keyboard shortcuts and jump step seconds can be customized in Obsidian Settings).*

---

## 🛠️ How to Use

### Single Video / Audio Note
Add a `media_link` property to your note frontmatter:

```yaml
---
media_link: https://www.youtube.com/watch?v=dQw4w9WgXcQ
---
```
*Or with local files:*
```yaml
---
media_link: "[[Machine Learning Lecture 01.mp4]]"
---
```

### Multi-Part Course Playlist
```yaml
---
media_link:
  - "[[Course - Part 1.mp4]]"
  - "[[Course - Part 2.mp4]]"
  - "[[Course - Part 3.mp4]]"
---
```

### Supported Media Formats
- **YouTube:** Standard videos, YouTube Shorts (`/shorts/`), and Playlists (`list=...`).
- **Local / Vault Video:** `.mp4`, `.webm`, `.mkv`, `.mov`, `.ogv`.
- **Local / Vault Audio:** `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`, `.aac`.

---

## ⚙️ Configuration & Settings

- **Default Layout:** Top Horizontal, Vertical Split Left, Vertical Split Right, or Right Sidebar.
- **Playlist Note Creation:** Customize the frontmatter property key (default: `video_link`) and target folder (current note folder or specific folder with auto-suggest).
- **Auto-Clear Inactive History:** Automatically purge stored playback positions and panel states older than X days.
- **Typing Scribe Buffers:** Configure character trigger threshold (e.g. 3 chars), idle resume delay (1–10s), and auto-rewind seconds (0–5s).
- **Timestamp Format:** 
  - Bracket Link: `[01:23](#t=83)` *(interactive seeking)*
  - Wikilink: `[[#t=83|01:23]]`
  - Bold: `**01:23**`
  - Plain: `01:23`
- **Jump Step Seconds:** Set your preferred forward and backward jump intervals (1–60s).
- **Screenshot Settings:** Choose PNG or JPEG, custom subfolder paths, or vault default attachment folders.
- **Custom Frontmatter Keys:** Customize recognized YAML property keys (default: `media_link`, `media`, `video`, `audio`, `podcast`).

---

## ☕ Support & Feedback

If you find MediaScribe useful for your video notes, research, and learning workflows, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)

---

## 📄 License & Credits

- **Author**: [SSKhekhaliya](https://www.sskhekhaliya.in/)
- **Support**: [buymeacoffee.com/sskhekhaliya](https://buymeacoffee.com/sskhekhaliya)
- **License**: MIT License © [SSKhekhaliya](https://www.sskhekhaliya.in/)
- Built with ❤️ for the [Obsidian](https://obsidian.md) community.
