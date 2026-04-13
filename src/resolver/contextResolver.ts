import type { BrowserContext, BrowserContextProvider } from '../providers/browser/browserContextProvider';
import type { ActiveWindowInfo, WindowProvider } from '../providers/window/getWindowsProvider';
import { Metrics } from '../utils/metrics';

export interface FinalContext {
  mode: 'email' | 'browser_chat' | 'document' | 'issue_comment' | 'code' | 'generic_text';
  appName: string;
  activeTab: string;
  url: string;
  domain: string;
}

export interface ResolvedContext {
  activeWindow: ActiveWindowInfo | null;
  browserContext: BrowserContext | null;
  final: FinalContext;
}

export interface ContextResolverDeps {
  windowProvider: WindowProvider;
  browserProviders: BrowserContextProvider[];
  metrics: Metrics;
}

export class ContextResolver {
  private readonly windowProvider: WindowProvider;
  private readonly browserProviders: BrowserContextProvider[];
  private readonly metrics: Metrics;

  constructor(deps: ContextResolverDeps) {
    this.windowProvider = deps.windowProvider;
    this.browserProviders = deps.browserProviders;
    this.metrics = deps.metrics;
  }

  async resolve(): Promise<ResolvedContext> {
    this.metrics.mark('window_start');
    const activeWindow = await this.windowProvider.getActiveWindow();
    this.metrics.mark('window_end');
    this.metrics.measure('activeWindowLookupMs', 'window_start', 'window_end');

    let browserContext: BrowserContext | null = null;

    for (const provider of this.browserProviders) {
      if (!provider.isSupportedBrowser(activeWindow)) {
        continue;
      }

      const label = provider.constructor.name;
      this.metrics.mark(`${label}_start`);
      const result = await provider.getContext(activeWindow);
      this.metrics.mark(`${label}_end`);
      this.metrics.measure(`${label}Ms`, `${label}_start`, `${label}_end`);

      if (result) {
        browserContext = result;
        break;
      }
    }

    return {
      activeWindow,
      browserContext,
      final: merge(activeWindow, browserContext),
    };
  }
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function inferMode(appName: string, domain: string, activeTab: string): FinalContext['mode'] {
  const a = appName.toLowerCase();
  const d = domain.toLowerCase();
  const t = activeTab.toLowerCase();

  if (d.includes('mail.google.com') || d.includes('outlook') || t.includes('compose')) {
    return 'email';
  }

  if (
    d.includes('slack.com') ||
    d.includes('discord.com') ||
    d.includes('telegram') ||
    a.includes('slack') ||
    a.includes('telegram')
  ) {
    return 'browser_chat';
  }

  if (d.includes('notion') || t.includes('notion')) {
    return 'document';
  }

  if (d.includes('github.com') || d.includes('linear.app')) {
    return 'issue_comment';
  }

  if (a.includes('code') || a.includes('cursor') || a.includes('windsurf')) {
    return 'code';
  }

  return 'generic_text';
}

function merge(activeWindow: ActiveWindowInfo | null, browserContext: BrowserContext | null): FinalContext {
  const appName = browserContext?.browserApp || activeWindow?.ownerName || '';
  const activeTab = browserContext?.tabTitle || activeWindow?.title || '';
  const url = browserContext?.url || activeWindow?.url || '';
  const domain = browserContext?.domain || safeDomain(url);

  return {
    mode: inferMode(appName, domain, activeTab),
    appName,
    activeTab,
    url,
    domain,
  };
}
