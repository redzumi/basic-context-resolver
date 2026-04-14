import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextResolver, BACKENDS } from '../context/resolver';
import type { PlatformBackend, PlatformBackendResult, PlatformBackendOptions } from '../context/types';

const mockResult: PlatformBackendResult = {
  app: { name: 'Chrome', pid: 123, title: 'Test Page' },
  browser: { url: 'https://example.com', domain: 'example.com', title: 'Test Page' },
  ui: { focusedRole: 'AXTextField', selectedText: 'hello' },
  debug: { windowRaw: {}, browserRaw: {}, uiRaw: {} },
};

class MockBackend implements PlatformBackend {
  readonly name = 'mock-backend';
  readonly platform = 'darwin' as const;
  collectedOptions?: PlatformBackendOptions;

  async collect(options?: PlatformBackendOptions): Promise<PlatformBackendResult> {
    this.collectedOptions = options;
    return mockResult;
  }
}

const mockBackend = new MockBackend();

describe('ContextResolver', () => {
  beforeEach(() => {
    mockBackend.collectedOptions = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupResolver(platform: string) {
    const originalDetect = vi.spyOn(await import('../adapters/getWindows'), 'detectPlatform').mockReturnValue(platform as 'darwin');

    const originalBackend = BACKENDS['darwin'];
    BACKENDS['darwin'] = () => mockBackend;

    const resolver = new ContextResolver();

    return {
      resolver,
      cleanup: () => {
        BACKENDS['darwin'] = originalBackend;
        originalDetect.mockRestore();
      },
    };
  }

  describe('resolve', () => {
    it('returns context with platform, app, browser, ui, and final', async () => {
      const { resolver, cleanup } = await setupResolver('darwin');

      const ctx = await resolver.resolve();
      cleanup();

      expect(ctx.platform).toBe('darwin');
      expect(ctx.app.name).toBe('Chrome');
      expect(ctx.app.pid).toBe(123);
      expect(ctx.app.title).toBe('Test Page');
      expect(ctx.browser?.url).toBe('https://example.com');
      expect(ctx.ui?.selectedText).toBe('hello');
      expect(ctx.final.mode).toBe('browser_generic');
      expect(ctx.final.appName).toBe('Chrome');
      expect(ctx.final.url).toBe('https://example.com');
      expect(ctx.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes debug info', async () => {
      const { resolver, cleanup } = await setupResolver('darwin');

      const ctx = await resolver.resolve();
      cleanup();

      expect(ctx.debug).toBeDefined();
      expect(ctx.debug.windowRaw).toBeDefined();
      expect(ctx.debug.browserRaw).toBeDefined();
      expect(ctx.debug.uiRaw).toBeDefined();
    });
  });

  describe('resolveWithDebug', () => {
    it('returns context and full debug snapshot', async () => {
      const { resolver, cleanup } = await setupResolver('darwin');

      const { context, debug } = await resolver.resolveWithDebug();
      cleanup();

      expect(context.platform).toBe('darwin');
      expect(context.app.name).toBe('Chrome');

      expect(debug.platform).toBe('darwin');
      expect(debug.capabilities.windowMetadata).toBe(true);
      expect(debug.capabilities.browserContext).toBe(true);
      expect(debug.capabilities.nativeUiContext).toBe(true);
      expect(debug.metrics).toBeDefined();
      expect(debug.backendName).toBe('mock-backend');
      expect(debug.window.provider).toBe('get-windows');
      expect(debug.browser.provider).toBe('mock-backend');
    });

    it('context and debug share the same final', async () => {
      const { resolver, cleanup } = await setupResolver('darwin');

      const { context, debug } = await resolver.resolveWithDebug();
      cleanup();

      expect(context.final).toBe(debug.final);
    });
  });

  describe('unsupported platform', () => {
    it('returns empty result with generic_text mode via resolve', async () => {
      const { resolver, cleanup } = await setupResolver('darwin');
      const originalBackend = BACKENDS['darwin'];
      delete BACKENDS['darwin'];

      const ctx = await resolver.resolve();

      BACKENDS['darwin'] = originalBackend;
      cleanup();

      expect(ctx.final.mode).toBe('generic_text');
      expect(ctx.debug.notes?.length).toBeGreaterThan(0);
    });

    it('returns empty result with debug via resolveWithDebug', async () => {
      const { resolver, cleanup } = await setupResolver('darwin');
      const originalBackend = BACKENDS['darwin'];
      delete BACKENDS['darwin'];

      const { context, debug } = await resolver.resolveWithDebug();

      BACKENDS['darwin'] = originalBackend;
      cleanup();

      expect(context.final.mode).toBe('generic_text');
      expect(debug.backendName).toBe('none');
    });
  });

  describe('with options', () => {
    it('passes options to backend collect', async () => {
      const { cleanup } = await setupResolver('darwin');
      const resolverWithOptions = new ContextResolver({
        getWindowsOptions: {
          accessibilityPermission: true,
          screenRecordingPermission: false,
        },
      });

      await resolverWithOptions.resolve();
      cleanup();

      expect(mockBackend.collectedOptions).toBeDefined();
      expect(mockBackend.collectedOptions?.getWindowsOptions).toEqual({
        accessibilityPermission: true,
        screenRecordingPermission: false,
      });
    });
  });
});
