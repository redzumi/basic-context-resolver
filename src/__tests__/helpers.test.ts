import { describe, it, expect } from 'vitest';
import { isBrowserApp, isChatApp, isBrowserChatDomain, safeDomain, collectDebugSnapshot } from '../context/helpers';

describe('isBrowserApp', () => {
  it('detects known browsers by exact name', () => {
    expect(isBrowserApp('Chrome')).toBe(true);
    expect(isBrowserApp('Google Chrome')).toBe(true);
    expect(isBrowserApp('Brave')).toBe(true);
    expect(isBrowserApp('Safari')).toBe(true);
    expect(isBrowserApp('Firefox')).toBe(true);
    expect(isBrowserApp('Edge')).toBe(true);
    expect(isBrowserApp('Arc')).toBe(true);
    expect(isBrowserApp('Vivaldi')).toBe(true);
    expect(isBrowserApp('Opera')).toBe(true);
  });

  it('detects browsers with partial name match', () => {
    expect(isBrowserApp('Brave Browser Nightly')).toBe(true);
    expect(isBrowserApp('Google Chrome Canary')).toBe(true);
  });

  it('returns false for non-browser apps', () => {
    expect(isBrowserApp('Telegram')).toBe(false);
    expect(isBrowserApp('VSCode')).toBe(false);
    expect(isBrowserApp('Finder')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isBrowserApp('chrome')).toBe(true);
    expect(isBrowserApp('GOOGLE CHROME')).toBe(true);
    expect(isBrowserApp('SaFaRi')).toBe(true);
  });
});

describe('isChatApp', () => {
  it('detects known chat apps', () => {
    expect(isChatApp('Telegram')).toBe(true);
    expect(isChatApp('Slack')).toBe(true);
    expect(isChatApp('Discord')).toBe(true);
    expect(isChatApp('Signal')).toBe(true);
    expect(isChatApp('WhatsApp')).toBe(true);
    expect(isChatApp('Teams')).toBe(true);
    expect(isChatApp('Zoom')).toBe(true);
  });

  it('returns false for non-chat apps', () => {
    expect(isChatApp('Chrome')).toBe(false);
    expect(isChatApp('Finder')).toBe(false);
    expect(isChatApp('')).toBe(false);
  });

  it('detects partial matches', () => {
    expect(isChatApp('Telegram Desktop')).toBe(true);
    expect(isChatApp('Slack Helper')).toBe(true);
  });
});

describe('isBrowserChatDomain', () => {
  it('detects known chat domains', () => {
    expect(isBrowserChatDomain('slack.com')).toBe(true);
    expect(isBrowserChatDomain('discord.com')).toBe(true);
    expect(isBrowserChatDomain('web.telegram.org')).toBe(true);
    expect(isBrowserChatDomain('web.whatsapp.com')).toBe(true);
    expect(isBrowserChatDomain('teams.microsoft.com')).toBe(true);
    expect(isBrowserChatDomain('meet.google.com')).toBe(true);
    expect(isBrowserChatDomain('zoom.us')).toBe(true);
  });

  it('detects subdomains of chat domains', () => {
    expect(isBrowserChatDomain('workspace.slack.com')).toBe(true);
    expect(isBrowserChatDomain('www.discord.com')).toBe(true);
  });

  it('returns false for non-chat domains', () => {
    expect(isBrowserChatDomain('github.com')).toBe(false);
    expect(isBrowserChatDomain('google.com')).toBe(false);
    expect(isBrowserChatDomain('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isBrowserChatDomain('Slack.Com')).toBe(true);
  });
});

describe('safeDomain', () => {
  it('extracts hostname from valid URL', () => {
    expect(safeDomain('https://github.com/user/repo')).toBe('github.com');
    expect(safeDomain('https://www.google.com/search?q=test')).toBe('www.google.com');
    expect(safeDomain('http://example.com:8080/path')).toBe('example.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(safeDomain('')).toBe('');
    expect(safeDomain('not-a-url')).toBe('');
    expect(safeDomain('://missing-host')).toBe('');
  });
});

describe('collectDebugSnapshot', () => {
  it('creates snapshot with all fields', () => {
    const snapshot = collectDebugSnapshot({ some: 'data' }, { url: 'test' }, { role: 'input' }, ['note1']);
    expect(snapshot).toEqual({
      windowRaw: { some: 'data' },
      browserRaw: { url: 'test' },
      uiRaw: { role: 'input' },
      notes: ['note1'],
    });
  });

  it('defaults notes to empty array', () => {
    const snapshot = collectDebugSnapshot(null, null, null);
    expect(snapshot.notes).toEqual([]);
  });
});
