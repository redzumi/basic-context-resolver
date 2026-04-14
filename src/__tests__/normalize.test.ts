import { describe, it, expect } from 'vitest';
import { normalizePlatformResult, buildFullDebugSnapshot } from '../context/normalize';
import type { PlatformBackendResult } from '../context/types';

const makeResult = (overrides?: Partial<PlatformBackendResult>): PlatformBackendResult => ({
  app: { name: 'Chrome', pid: 123, title: 'GitHub' },
  debug: {},
  ...overrides,
});

describe('normalizePlatformResult', () => {
  it('normalizes a full result', () => {
    const result = makeResult({
      browser: { url: 'https://github.com', domain: 'github.com', title: 'GitHub' },
      ui: { focusedRole: 'AXTextField', selectedText: 'hello' },
      debug: { windowRaw: {}, browserRaw: {}, uiRaw: {}, notes: ['ok'] },
    });

    const ctx = normalizePlatformResult(result, 'darwin', 'macos-applescript-ax', {});

    expect(ctx.platform).toBe('darwin');
    expect(ctx.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ctx.app.name).toBe('Chrome');
    expect(ctx.browser?.url).toBe('https://github.com');
    expect(ctx.ui?.focusedRole).toBe('AXTextField');
    expect(ctx.final.mode).toBe('issue_comment');
    expect(ctx.final.appName).toBe('Chrome');
  });

  it('normalizes minimal result', () => {
    const result = makeResult({ app: { name: 'UnknownApp' }, debug: {} });
    const ctx = normalizePlatformResult(result, 'linux', 'linux-shell-atspi', {});

    expect(ctx.platform).toBe('linux');
    expect(ctx.final.mode).toBe('generic_text');
    expect(ctx.final.appName).toBe('UnknownApp');
  });

  it('includes debug notes', () => {
    const result = makeResult({
      debug: { notes: ['note1', 'note2'] },
    });
    const ctx = normalizePlatformResult(result, 'darwin', 'macos', {});

    expect(ctx.debug.notes).toEqual(['note1', 'note2']);
  });
});

describe('buildFullDebugSnapshot', () => {
  it('builds full debug with capabilities', () => {
    const result = makeResult({
      browser: { url: 'https://github.com', domain: 'github.com' },
      ui: { selectedText: 'hello' },
      debug: { windowRaw: { id: 1 }, browserRaw: { url: 'https://github.com' }, uiRaw: { role: 'input' }, notes: [] },
    });

    const final = { mode: 'issue_comment' as const, appName: 'Chrome' };

    const snapshot = buildFullDebugSnapshot(result, 'darwin', 'macos-applescript-ax', { totalMs: 100 }, final);

    expect(snapshot.platform).toBe('darwin');
    expect(snapshot.capabilities).toEqual({
      windowMetadata: true,
      browserContext: true,
      nativeUiContext: true,
    });
    expect(snapshot.window.provider).toBe('get-windows');
    expect(snapshot.browser.provider).toBe('macos-applescript-ax');
    expect(snapshot.nativeUi.provider).toBe('macos-applescript-ax');
    expect(snapshot.metrics).toEqual({ totalMs: 100 });
    expect(snapshot.backendName).toBe('macos-applescript-ax');
    expect(snapshot.final).toBe(final);
  });

  it('reports false capabilities for missing data', () => {
    const result = makeResult({
      app: {},
      debug: {},
    });

    const final = { mode: 'generic_text' as const };
    const snapshot = buildFullDebugSnapshot(result, 'win32', 'win', {}, final);

    expect(snapshot.capabilities).toEqual({
      windowMetadata: false,
      browserContext: false,
      nativeUiContext: false,
    });
  });

  it('includes all debug layers with raw data', () => {
    const result = makeResult({
      debug: {
        windowRaw: { test: 'win' },
        browserRaw: { test: 'br' },
        uiRaw: { test: 'ui' },
        notes: ['a', 'b'],
      },
    });

    const final = { mode: 'generic_text' as const };
    const snapshot = buildFullDebugSnapshot(result, 'darwin', 'macos', {}, final);

    expect(snapshot.window.raw).toEqual({ test: 'win' });
    expect(snapshot.browser.raw).toEqual({ test: 'br' });
    expect(snapshot.browser.notes).toEqual(['a', 'b']);
    expect(snapshot.nativeUi.raw).toEqual({ test: 'ui' });
  });
});
