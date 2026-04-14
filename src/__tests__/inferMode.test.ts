import { describe, it, expect } from 'vitest';
import { inferMode, buildFinalContext } from '../context/inferMode';

describe('inferMode', () => {
  it('returns desktop_chat for chat apps', () => {
    expect(inferMode({ appName: 'Telegram', domain: '', title: '' })).toBe('desktop_chat');
    expect(inferMode({ appName: 'Slack', domain: '', title: '' })).toBe('desktop_chat');
    expect(inferMode({ appName: 'Discord', domain: '', title: '' })).toBe('desktop_chat');
  });

  it('returns browser_chat for chat domains in browser', () => {
    expect(inferMode({ appName: 'Chrome', domain: 'slack.com', title: '' })).toBe('browser_chat');
    expect(inferMode({ appName: 'Chrome', domain: 'discord.com', title: '' })).toBe('browser_chat');
    expect(inferMode({ appName: 'Firefox', domain: 'web.telegram.org', title: '' })).toBe('browser_chat');
  });

  it('returns email for email domains', () => {
    expect(inferMode({ appName: 'Chrome', domain: 'mail.google.com', title: '' })).toBe('email');
    expect(inferMode({ appName: 'Chrome', domain: 'outlook.live.com', title: '' })).toBe('email');
    expect(inferMode({ appName: 'Chrome', domain: 'outlook.office.com', title: '' })).toBe('email');
  });

  it('returns email for compose title', () => {
    expect(inferMode({ appName: 'Chrome', domain: '', title: 'Gmail - Compose' })).toBe('email');
  });

  it('returns document for Notion', () => {
    expect(inferMode({ appName: 'Chrome', domain: 'notion.so/workspace', title: '' })).toBe('document');
    expect(inferMode({ appName: 'Chrome', domain: '', title: 'My Notion Page' })).toBe('document');
  });

  it('returns issue_comment for GitHub/Linear', () => {
    expect(inferMode({ appName: 'Chrome', domain: 'github.com/user/repo', title: '' })).toBe('issue_comment');
    expect(inferMode({ appName: 'Chrome', domain: 'linear.app/project', title: '' })).toBe('issue_comment');
    expect(inferMode({ appName: 'Chrome', domain: 'gitlab.com', title: '' })).toBe('issue_comment');
  });

  it('returns code for code editors', () => {
    expect(inferMode({ appName: 'Code', domain: '', title: '' })).toBe('code');
    expect(inferMode({ appName: 'Cursor', domain: '', title: '' })).toBe('code');
    expect(inferMode({ appName: 'Windsurf', domain: '', title: '' })).toBe('code');
    expect(inferMode({ appName: 'VSCode', domain: '', title: '' })).toBe('code');
  });

  it('returns browser_generic for browsers on non-special domains', () => {
    expect(inferMode({ appName: 'Chrome', domain: 'example.com', title: '' })).toBe('browser_generic');
    expect(inferMode({ appName: 'Safari', domain: 'reddit.com', title: '' })).toBe('browser_generic');
  });

  it('returns generic_text as fallback', () => {
    expect(inferMode({ appName: 'Finder', domain: '', title: '' })).toBe('generic_text');
  });

  it('prioritizes desktop_chat over browser when both could match', () => {
    expect(inferMode({ appName: 'Telegram', domain: 'telegram.org', title: '' })).toBe('desktop_chat');
  });
});

describe('buildFinalContext', () => {
  it('builds full context from params', () => {
    const ctx = buildFinalContext({
      appName: 'Chrome',
      title: 'GitHub',
      url: 'https://github.com',
      domain: 'github.com',
      selectedText: 'hello',
      inputValuePreview: 'search',
    });

    expect(ctx).toEqual({
      mode: 'issue_comment',
      appName: 'Chrome',
      activeTitle: 'GitHub',
      url: 'https://github.com',
      domain: 'github.com',
      selectedText: 'hello',
      inputValuePreview: 'search',
    });
  });

  it('omits undefined optional fields', () => {
    const ctx = buildFinalContext({
      appName: 'Finder',
      title: undefined,
      url: undefined,
      domain: undefined,
      selectedText: undefined,
      inputValuePreview: undefined,
    });

    expect(ctx).toEqual({
      mode: 'generic_text',
      appName: 'Finder',
      activeTitle: undefined,
      url: undefined,
      domain: undefined,
    });
  });
});
