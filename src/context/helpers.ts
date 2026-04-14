const BROWSER_APPS = new Set([
  'brave',
  'chrome',
  'google chrome',
  'edge',
  'microsoft edge',
  'vivaldi',
  'opera',
  'firefox',
  'safari',
  'arc',
]);

const CHAT_APPS = new Set([
  'telegram',
  'slack',
  'discord',
  'signal',
  'whatsapp',
  'teams',
  'zoom',
]);

const BROWSER_CHAT_DOMAINS = new Set([
  'slack.com',
  'discord.com',
  'web.telegram.org',
  'web.whatsapp.com',
  'teams.microsoft.com',
  'meet.google.com',
  'zoom.us',
]);

export function isBrowserApp(appName: string): boolean {
  const name = appName.toLowerCase().trim();
  if (BROWSER_APPS.has(name)) return true;
  return [...BROWSER_APPS].some((b) => name.includes(b) || b.includes(name));
}

export function isChatApp(appName: string): boolean {
  const name = appName.toLowerCase().trim();
  return CHAT_APPS.has(name) || name.includes('telegram') || name.includes('slack') || name.includes('discord');
}

export function isBrowserChatDomain(domain: string): boolean {
  if (!domain) return false;
  const host = domain.toLowerCase();
  return BROWSER_CHAT_DOMAINS.has(host) || [...BROWSER_CHAT_DOMAINS].some((d) => host.endsWith(d));
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function collectDebugSnapshot(
  windowRaw: unknown,
  browserRaw: unknown,
  uiRaw: unknown,
  notes: string[] = [],
): DebugSnapshot {
  return { windowRaw, browserRaw, uiRaw, notes };
}
