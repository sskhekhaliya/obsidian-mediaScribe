import { App, Platform, setIcon } from "obsidian";

/**
 * Formats an Obsidian Hotkey object (e.g. { modifiers: ['Mod'], key: 'k' })
 * into a platform-aware human-readable string (e.g. 'Ctrl+K' or 'Cmd+K').
 */
export function formatHotkey(hotkey: { modifiers?: string[]; key?: string }): string {
  if (!hotkey) return "";

  const isMac = Platform.isMacOS;
  const modMap: Record<string, string> = isMac
    ? { Mod: "Cmd", Meta: "Cmd", Ctrl: "Ctrl", Alt: "Opt", Shift: "Shift" }
    : { Mod: "Ctrl", Meta: "Win", Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift" };

  const parts: string[] = [];
  if (hotkey.modifiers && Array.isArray(hotkey.modifiers)) {
    for (const mod of hotkey.modifiers) {
      parts.push(modMap[mod] || mod);
    }
  }

  if (hotkey.key) {
    let keyStr = hotkey.key;
    if (keyStr.length === 1) {
      keyStr = keyStr.toUpperCase();
    } else if (keyStr === "ArrowUp") keyStr = "Up";
    else if (keyStr === "ArrowDown") keyStr = "Down";
    else if (keyStr === "ArrowLeft") keyStr = "Left";
    else if (keyStr === "ArrowRight") keyStr = "Right";
    else if (keyStr === " " || keyStr.toLowerCase() === "space") keyStr = "Space";
    else if (keyStr === "Escape") keyStr = "Esc";
    parts.push(keyStr);
  }

  return parts.join("+");
}

/**
 * Resolves the active keyboard shortcut string for a MediaScribe command.
 * Dynamically queries Obsidian's hotkey manager (evaluating user custom hotkeys first,
 * then default hotkeys and registered command shortcuts).
 * If the user has intentionally cleared/removed hotkeys for this command, returns empty string.
 */
export function getCommandHotkeyString(app: App, commandSubId: string, fallbackDefault?: string): string {
  try {
    const hotkeyManager = (app as any).hotkeyManager;
    const fullId = commandSubId.includes(":") ? commandSubId : `mediascribe:${commandSubId}`;

    let hotkeys: any[] | undefined;

    // 1. Check customKeys first (user overrides configured via Settings -> Hotkeys)
    if (hotkeyManager?.customKeys) {
      if (fullId in hotkeyManager.customKeys) {
        hotkeys = hotkeyManager.customKeys[fullId];
      } else if (commandSubId in hotkeyManager.customKeys) {
        hotkeys = hotkeyManager.customKeys[commandSubId];
      }
    }

    // 2. If no custom override exists, check defaultKeys and app.commands registry
    if (hotkeys === undefined) {
      if (hotkeyManager?.defaultKeys) {
        if (fullId in hotkeyManager.defaultKeys) {
          hotkeys = hotkeyManager.defaultKeys[fullId];
        } else if (commandSubId in hotkeyManager.defaultKeys) {
          hotkeys = hotkeyManager.defaultKeys[commandSubId];
        }
      }

      if (!hotkeys) {
        const cmd =
          (app as any).commands?.findCommand?.(fullId) ||
          (app as any).commands?.findCommand?.(commandSubId) ||
          (app as any).commands?.commands?.[fullId] ||
          (app as any).commands?.commands?.[commandSubId];

        if (cmd?.hotkeys) {
          hotkeys = cmd.hotkeys;
        }
      }
    }

    // Explicitly empty array means user unmapped/cleared this shortcut
    if (Array.isArray(hotkeys)) {
      if (hotkeys.length === 0) {
        return "";
      }
      return formatHotkey(hotkeys[0]);
    }
  } catch (e) {
    console.debug("MediaScribe: Failed to query hotkey", e);
  }

  return fallbackDefault || "";
}

/**
 * Binds a dynamic tooltip to an element with automatic hotkey integration.
 * Updates on mouseenter and focus so changes made in Obsidian's Hotkeys settings
 * are reflected immediately in real-time when hovering over the button.
 */
export function setDynamicTooltip(
  el: HTMLElement,
  app: App,
  baseTitle: string | (() => string),
  commandSubId?: string,
  fallbackDefault?: string
): void {
  const updateTooltip = () => {
    const text = typeof baseTitle === "function" ? baseTitle() : baseTitle;
    let fullTitle = text;

    if (commandSubId) {
      const hotkeyStr = getCommandHotkeyString(app, commandSubId, fallbackDefault);
      if (hotkeyStr) {
        fullTitle = `${text} (${hotkeyStr})`;
      }
    }

    el.setAttribute("title", fullTitle);
    el.setAttribute("aria-label", fullTitle);
  };

  // Set initial tooltip
  updateTooltip();

  // Dynamically refresh whenever hovered or focused
  el.addEventListener("mouseenter", updateTooltip);
  el.addEventListener("focus", updateTooltip);
}

/**
 * Renders the clean, standard Lucide "X" cross icon inside the given element,
 * matching the second screenshot.
 * Does not rely on setIcon('x') to prevent conflicts with plugins that might override global icon IDs.
 */
export function setLucideXIcon(el: HTMLElement): void {
  el.empty();
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
}

