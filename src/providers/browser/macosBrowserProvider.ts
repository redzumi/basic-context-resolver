import { execText } from '../../utils/exec';
import type { ActiveWindowInfo } from '../window/getWindowsProvider';
import { BaseBrowserContextProvider, type BrowserContext } from './browserContextProvider';

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function mapAppName(windowInfo: ActiveWindowInfo | null): string | null {
  const owner = (windowInfo?.ownerName ?? '').toLowerCase();
  const bundle = (windowInfo?.bundleId ?? '').toLowerCase();

  if (owner.includes('brave') || bundle.includes('brave')) return 'Brave Browser';
  if (owner.includes('google chrome') || bundle.includes('chrome')) return 'Google Chrome';
  if (owner.includes('microsoft edge') || bundle.includes('edge')) return 'Microsoft Edge';
  if (owner.includes('safari') || bundle.includes('safari')) return 'Safari';

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

export class MacOSBrowserProvider extends BaseBrowserContextProvider {
  async getContext(windowInfo: ActiveWindowInfo | null): Promise<BrowserContext | null> {
    if (process.platform !== 'darwin') {
      return null;
    }

    const appName = mapAppName(windowInfo);
    if (!appName) {
      return null;
    }

    try {
      const output = await execText('osascript', ['-e', buildAppleScript(appName)]);
      if (!output) {
        return null;
      }

      const lines = output.split('\n');
      const tabTitle = (lines[0] ?? '').trim();
      const url = (lines[1] ?? '').trim();

      return {
        source: 'macos-applescript',
        browserApp: appName,
        tabTitle,
        url,
        domain: safeDomain(url),
      };
    } catch {
      return null;
    }
  }
}
