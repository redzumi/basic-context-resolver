# Task: Build a unified cross-platform context resolver over platform-specific system adapters

## Goal

Build a **single cross-platform context resolver** for the desktop assistant that extracts as much useful context as possible from the **currently active window** without relying on browser extensions and without writing app-specific modules like `BraveProvider`, `ChromeProvider`, `TelegramProvider`, etc.

The correct architecture is:

- **one unified resolver API**
- **one normalized output schema**
- **platform-specific backends/adapters**
  - macOS: AppleScript + Accessibility (AX)
  - Windows: PowerShell + UI Automation (UIA)
  - Linux: shell/dbus + AT-SPI

This should be implemented as a **native-first, platform-aware system context extractor**.

---

## Core design principle

Do **not** build providers per application.

Bad direction:

- `BraveProvider`
- `ChromeProvider`
- `TelegramProvider`
- `SlackProvider`

Good direction:

- `MacOSContextBackend`
- `WindowsContextBackend`
- `LinuxContextBackend`

Each backend may contain internal heuristics for categories of apps, especially browsers, but the public architecture must remain **platform-oriented**, not app-oriented.

---

## Current known findings

### 1. `get-windows` is useful, but limited

`get-windows` is a **window metadata router**, not a full UI context extractor.

It is useful for:

- active app / process
- window title
- bounds
- process ID
- platform info

It is **not sufficient** for:

- browser URL on Windows/Linux
- current chat peer name in Telegram Desktop
- focused input value in arbitrary apps
- deep UI context

### 2. Browser URL on Windows is not reliably provided by `get-windows`

On Windows, `get-windows` should not be treated as a source of active browser URL.

Instead, Windows browser URL extraction should come from a **Windows UI Automation backend**, likely via PowerShell or a later native bridge.

### 3. Telegram Desktop on macOS does not reliably expose peer name through currently tested AX access

Already tested:

- window metadata
- focused window / focused element AX snapshot
- deeper AX traversal
- `AXUIElementCopyElementAtPosition()` probing in header area

Result:

- still no reliable recipient / peer name from Telegram Desktop

Conclusion:

- native-only extraction likely has a hard limit for Telegram Desktop peer name in current setup
- Telegram Desktop may not expose the needed header info in a useful AX form
- if this remains true after backend improvements, only a **small targeted visual fallback on header area** will solve it

This fallback is **not part of this task**. This task is about the **native unified resolver architecture**.

---

## Target architecture

### Public API

Create one normalized cross-platform API.

Example shape:

```ts
export type UniversalContext = {
  platform: 'darwin' | 'win32' | 'linux';
  timestamp: string;

  app: {
    name?: string;
    pid?: number;
    title?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    processPath?: string;
    bundleId?: string;
  };

  browser?: {
    title?: string;
    url?: string;
    domain?: string;
  };

  ui?: {
    focusedRole?: string;
    focusedName?: string;
    focusedValue?: string;
    selectedText?: string;
    nearbyText?: string[];
  };

  final: {
    mode:
      | 'browser_generic'
      | 'browser_chat'
      | 'desktop_chat'
      | 'email'
      | 'document'
      | 'issue_comment'
      | 'code'
      | 'generic_text';
    appName?: string;
    activeTitle?: string;
    url?: string;
    domain?: string;
    conversationWith?: string;
    conversationType?: 'direct' | 'group' | 'channel' | 'unknown';
    selectedText?: string;
    inputValuePreview?: string;
  };

  debug: {
    windowRaw?: unknown;
    browserRaw?: unknown;
    uiRaw?: unknown;
    notes?: string[];
  };
};
```

---

## Main modules to implement

Suggested structure:

```text
src/
  context/
    types.ts
    resolver.ts
    inferMode.ts
    normalize.ts
    index.ts

  adapters/
    getWindows.ts

    macos/
      appleScript.ts
      ax.ts
      backend.ts

    windows/
      powerShell.ts
      uia.ts
      backend.ts

    linux/
      shell.ts
      atspi.ts
      backend.ts
```

Alternative structure is fine if responsibilities remain clear.

---

## Resolver behavior

### Resolver responsibilities

The resolver must:

1. detect the current platform
2. select the correct backend
3. collect raw signals from platform adapters
4. normalize them into one shared schema
5. expose both:
   - normalized final result
   - raw debug snapshot

### Backend responsibilities

Each backend should:

- use common window metadata as base
- try platform-native methods for richer context
- return best-effort normalized fields
- expose raw data for debugging
- never fake unavailable data

---

## Platform backend requirements

# macOS backend

## Required inputs/sources

- `get-windows`
- AppleScript for scriptable browsers
- macOS Accessibility / AX bridge

## Behavior

### Base layer

Use `get-windows` for:

- app name
- pid
- title
- bounds
- process path / bundle id where available

### Browser layer

If active app looks like a browser:

- Brave
- Chrome
- Edge
- Safari
- possibly Vivaldi / Opera if scriptable and supported

Then attempt AppleScript extraction of:

- front tab title
- front tab URL

This must be done generically as part of the macOS backend, not via separate per-browser public providers.

### UI layer

Use the macOS AX bridge for:

- focused window
- focused element
- value / title / description / role / subrole
- selected text where available
- tree summary / nearby text if available

## Current limitations to preserve honestly

- Telegram Desktop recipient may still be unavailable through AX
- do not fabricate `conversationWith`
- return raw AX snapshot for debugging

---

# Windows backend

## Required inputs/sources

- `get-windows`
- PowerShell
- UI Automation (UIA)

## Behavior

### Base layer

Use `get-windows` for:

- app name
- pid
- title
- bounds
- process path

### Browser layer

If active app looks like a browser:

- Brave
- Chrome
- Edge
- Vivaldi
- Opera
- maybe Firefox if practical later

Then attempt to extract browser URL/title through **Windows UI Automation**, likely by probing the address bar / editable controls.

This should be implemented as **one Windows browser/UIA strategy**, not as app-specific providers.

### UI layer

Use UI Automation for:

- focused element
- control type / role
- name
- value
- selected text if possible
- text pattern if possible

## Expected reality

- results may be best-effort and inconsistent depending on app/UIA exposure
- return raw debug data
- do not pretend URL always exists

---

# Linux backend

## Required inputs/sources

- `get-windows` or WM-level metadata if available
- shell/dbus tools
- AT-SPI

## Behavior

### Base layer

Use window metadata for:

- app name
- title
- bounds
- pid if available

### UI layer

Attempt AT-SPI-based extraction of:

- focused element
- role/name/value
- selected text
- nearby text

## Expected reality

- X11 / Wayland differences matter
- availability may vary heavily across distros and desktop environments
- backend should return explicit notes when unavailable or degraded

---

## Browser handling policy

The system should not have app-specific browser modules.

Instead, browsers are treated as a **class of windows** inside each platform backend.

Example:

- macOS backend:
  - if current app is browser-like, try AppleScript browser extraction
- Windows backend:
  - if current app is browser-like, try UIA address bar extraction
- Linux backend:
  - if current app is browser-like, try title/url heuristics or AT-SPI where possible

This is acceptable and desired.

---

## Final mode inference rules

The current implementation previously misclassified some browser cases and desktop Telegram cases.

Required rules:

### Browser-like apps

If app name looks like browser and no better signal exists:

- `mode = browser_generic`

### Browser chat domains

If domain indicates web chat like:

- `slack.com`
- `discord.com`
- `web.telegram.org`

Then:

- `mode = browser_chat`

### Desktop chat apps

If app name indicates native chat desktop app like:

- Telegram
- Slack
- Discord

Then:

- `mode = desktop_chat`

### Email / docs / issues / code

Keep existing useful inference patterns where they fit, but ensure browser app detection does not collapse into `generic_text` only because URL is unavailable.

---

## Debug mode requirements

This task must include a strong debug mode.

The debug output must include raw data from each layer.

### Required debug content

- `windowRaw`
- `browserRaw`
- `uiRaw`
- backend notes
- timings per stage
- capability flags

Example high-level debug object:

```ts
{
  platform: process.platform,
  timestamp: new Date().toISOString(),
  capabilities: {
    windowMetadata: true,
    browserContext: boolean,
    nativeUiContext: boolean,
  },
  window: {
    provider: string,
    attempted: boolean,
    available: boolean,
    raw: unknown,
    normalized: unknown,
    notes: string[],
  },
  browser: {
    provider: string,
    attempted: boolean,
    available: boolean,
    raw: unknown,
    normalized: unknown,
    notes: string[],
  },
  nativeUi: {
    provider: string,
    attempted: boolean,
    available: boolean,
    raw: unknown,
    normalized: unknown,
    notes: string[],
  },
  final: { ... },
  metrics: { ... },
}
```

### Debug storage

The debug snapshot should be printable to console and also optionally saved to a JSON file.

---

## Non-goals

These are explicitly **not** part of this task:

- browser extensions
- native messaging browser host
- OCR / screenshot / vision layer
- per-app custom modules like `TelegramProvider`
- small visual fallback for Telegram header

Those may be future layers, but this task is strictly about the **native cross-platform resolver over system adapters**.

---

## Required implementation approach

### Step 1

Refactor current code into a single resolver with backend selection by platform.

### Step 2

Keep `get-windows` as a shared metadata adapter.

### Step 3

Implement macOS backend using:

- AppleScript browser extraction
- AX bridge integration

### Step 4

Implement Windows backend using:

- PowerShell + UIA extraction
- browser URL probe via UIA where possible

### Step 5

Implement Linux backend as a best-effort shell/AT-SPI backend with explicit degraded behavior.

### Step 6

Normalize everything into a single schema.

### Step 7

Produce strong debug dumps.

---

## Acceptance criteria

### General

- One public resolver API exists
- Platform backend is selected automatically
- Output shape is unified across platforms
- Raw debug output is preserved
- No app-specific public provider architecture

### macOS

- Active window metadata works
- Browser title/URL extraction works for scriptable browsers when possible
- AX data is integrated into resolver output
- Telegram Desktop may still lack peer name, but raw AX data must be visible in debug

### Windows

- Active window metadata works
- Browser windows are detected as browsers even if URL is missing
- UIA-based browser/context probing exists
- `mode` does not incorrectly fall back to `generic_text` for Chromium browsers

### Linux

- Backend exists
- Clearly reports degraded/unavailable capabilities when AT-SPI/WM access is unavailable
- Still returns normalized structure

### Debugging

- Snapshot includes raw and normalized data per layer
- Timing metrics are included
- Notes explain unavailable capabilities honestly

---

## Important implementation constraints

- Do not fabricate unavailable context
- Do not silently swallow platform limitations
- Do not hardcode app-specific public modules
- Do not make URL availability mandatory for browser classification
- Preserve current useful heuristics, but keep them behind a normalized platform backend

---

## Suggested internal helper functions

Examples of helpers that should exist:

- `isBrowserApp(appName: string): boolean`
- `inferMode(...)`
- `safeDomain(url: string): string`
- `mergePlatformSignals(...)`
- `collectDebugSnapshot(...)`
- `normalizeMacOSContext(...)`
- `normalizeWindowsContext(...)`
- `normalizeLinuxContext(...)`

---

## Deliverables

The agent should produce:

1. refactored TypeScript source code
2. unified resolver entry point
3. platform backends
4. debug snapshot support
5. updated mode inference
6. documentation/comments where needed

---

## Summary

Build a **single cross-platform native context resolver** with:

- one unified TypeScript API
- one normalized output schema
- platform-specific system adapters underneath
  - macOS: AppleScript + AX
  - Windows: PowerShell + UIA
  - Linux: shell/dbus + AT-SPI
- strong raw debug output
- no browser extensions
- no app-specific provider zoo

This is the correct architectural direction.
