import type { ActiveWindowInfo } from '../window/getWindowsProvider';
import { BaseBrowserContextProvider, type BrowserContext } from './browserContextProvider';

/**
 * Placeholder for a future browser extension + native messaging host.
 * Intended cross-platform shape:
 * - browserName
 * - tabTitle
 * - url
 * - selectedText
 * - nearbyInputContext
 */
export class NativeMessagingBrowserProvider extends BaseBrowserContextProvider {
  async getContext(_windowInfo: ActiveWindowInfo | null): Promise<BrowserContext | null> {
    return null;
  }
}
