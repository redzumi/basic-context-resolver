import { execText } from '../../utils/exec';
import { safeDomain, isBrowserApp } from '../../context/helpers';
import type { PlatformBackend, PlatformBackendResult, BrowserInfo, UiContext } from '../context/types';

function mapAppleScriptAppName(ownerName: string, bundleId: string): string | null {
  const owner = ownerName.toLowerCase();
  const bundle = bundleId.toLowerCase();

  if (owner.includes('brave') || bundle.includes('brave')) return 'Brave Browser';
  if (owner.includes('google chrome') || bundle.includes('chrome')) return 'Google Chrome';
  if (owner.includes('microsoft edge') || bundle.includes('edge')) return 'Microsoft Edge';
  if (owner.includes('safari') || bundle.includes('safari')) return 'Safari';
  if (owner.includes('vivaldi') || bundle.includes('vivaldi')) return 'Vivaldi';
  if (owner.includes('opera') || bundle.includes('opera')) return 'Opera';

  return null;
}

function buildAppleScript(appName: string): string {
  if (appName === 'Safari') {
    return `
      tell application "Safari"
        if not (exists front window) then return ""
        set t to name of current tab of front window
        set u to URL of current tab of front window
        return t & linefeed & u
      end tell
    `;
  }

  return `
    tell application "${appName}"
      if not (exists front window) then return ""
      set t to title of active tab of front window
      set u to URL of active tab of front window
      return t & linefeed & u
    end tell
  `;
}

async function extractBrowserViaAppleScript(appName: string): Promise<BrowserInfo | null> {
  try {
    const output = await execText('osascript', ['-e', buildAppleScript(appName)]);
    if (!output) return null;

    const lines = output.split('\n');
    const title = (lines[0] ?? '').trim();
    const url = (lines[1] ?? '').trim();

    if (!title && !url) return null;

    return {
      title: title || undefined,
      url: url || undefined,
      domain: url ? safeDomain(url) : undefined,
    };
  } catch {
    return null;
  }
}

async function extractAXContext(): Promise<{ ui: UiContext; raw: unknown }> {
  const ui: UiContext = {};
  let raw: unknown = undefined;
  const notes: string[] = [];

  try {
    const script = `
      use framework "AppKit"
      use scripting additions

      set focusedApp to current application's NSWorkspace's sharedWorkspace()'s frontmostApplication()
      set pid to focusedApp's processIdentifier()

      set axApp to current application's AXUIElementCreateApplication(pid)
      set focusedWindow to current application's AXUIElementCopyAttributeValue(axApp, "AXFocusedWindow")

      if focusedWindow is missing value then
        return "{}"
      end if

      set focusedElement to current application's AXUIElementCopyAttributeValue(focusedWindow, "AXFocusedElement")

      if focusedElement is missing value then
        set roleVal to current application's AXUIElementCopyAttributeValue(focusedWindow, "AXRole")
        set titleVal to current application's AXUIElementCopyAttributeValue(focusedWindow, "AXTitle")
        return "{\\"role\\": \\"" & roleVal & "\\", \\"name\\": \\"" & titleVal & "\\"}"
      end if

      set roleVal to current application's AXUIElementCopyAttributeValue(focusedElement, "AXRole")
      set titleVal to current application's AXUIElementCopyAttributeValue(focusedElement, "AXTitle")
      set descVal to current application's AXUIElementCopyAttributeValue(focusedElement, "AXDescription")
      set valueVal to current application's AXUIElementCopyAttributeValue(focusedElement, "AXValue")
      set selectedText to current application's AXUIElementCopyAttributeValue(focusedElement, "AXSelectedText")

      set json to "{"
      set json to json & "\\"role\\": \\"" & roleVal & "\\", "
      set json to json & "\\"title\\": \\"" & titleVal & "\\", "
      set json to json & "\\"description\\": \\"" & descVal & "\\", "

      if valueVal is not missing value then
        set json to json & "\\"value\\": \\"" & valueVal & "\", "
      end if

      if selectedText is not missing value then
        set json to json & "\\"selectedText\\": \\"" & selectedText & "\\", "
      end if

      set json to json & "}"

      return json
    `;

    const output = await execText('osascript', ['-l', 'JavaScript', '-e', script]);

    if (output) {
      try {
        raw = JSON.parse(output);

        if (typeof raw === 'object' && raw !== null) {
          const r = raw as Record<string, unknown>;
          if (typeof r.role === 'string') ui.focusedRole = r.role;
          if (typeof r.title === 'string' && r.title) ui.focusedName = r.title;
          if (typeof r.value === 'string') ui.focusedValue = r.value;
          if (typeof r.selectedText === 'string') ui.selectedText = r.selectedText;
        }
      } catch {
        notes.push('AX JSON parse failed');
        raw = output;
      }
    }
  } catch (error) {
    notes.push(`AX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { ui, raw };
}

export class MacOSBackend implements PlatformBackend {
  readonly name = 'macos-applescript-ax';
  readonly platform = 'darwin' as const;

  async collect(): Promise<PlatformBackendResult> {
    const { getWindowMetadata } = await import('../getWindows');
    const { app, raw: windowRaw } = await getWindowMetadata();

    const notes: string[] = [];
    let browser: BrowserInfo | undefined;
    let ui: UiContext | undefined;
    let browserRaw: unknown;
    let uiRaw: unknown;

    const appName = app.name ?? '';

    if (isBrowserApp(appName)) {
      const scriptName = mapAppleScriptAppName(appName, app.bundleId ?? '');
      if (scriptName) {
        browserRaw = { provider: 'applescript', targetApp: scriptName };
        const result = await extractBrowserViaAppleScript(scriptName);
        if (result) {
          browser = result;
          (browserRaw as Record<string, unknown>).result = result;
        } else {
          notes.push(`AppleScript extraction returned no data for ${scriptName}`);
        }
      } else {
        notes.push(`No AppleScript mapping for browser app: ${appName}`);
        browserRaw = { provider: 'applescript', skipped: true, reason: `no mapping for ${appName}` };
      }
    }

    const axResult = await extractAXContext();
    ui = axResult.ui;
    uiRaw = axResult.raw;

    if (Object.keys(ui).length === 0) {
      notes.push('AX context extraction returned empty');
    }

    return {
      app,
      browser,
      ui,
      debug: {
        windowRaw,
        browserRaw,
        uiRaw,
        notes,
      },
    };
  }
}
