import type { ActiveWindowInfo } from '../window/getWindowsProvider';

export interface BrowserContext {
  source: string;
  browserApp: string;
  tabTitle: string;
  url: string;
  domain: string;
  selectedText?: string;
  nearbyInputContext?: string;
}

export interface BrowserContextProvider {
  isSupportedBrowser(windowInfo: ActiveWindowInfo | null): boolean;
  getContext(windowInfo: ActiveWindowInfo | null): Promise<BrowserContext | null>;
}

export abstract class BaseBrowserContextProvider implements BrowserContextProvider {
  isSupportedBrowser(windowInfo: ActiveWindowInfo | null): boolean {
    const name = `${windowInfo?.ownerName ?? ''} ${windowInfo?.bundleId ?? ''}`.toLowerCase();

    return (
      name.includes('chrome') ||
      name.includes('brave') ||
      name.includes('edge') ||
      name.includes('vivaldi') ||
      name.includes('opera') ||
      name.includes('firefox') ||
      name.includes('safari')
    );
  }

  abstract getContext(windowInfo: ActiveWindowInfo | null): Promise<BrowserContext | null>;
}
