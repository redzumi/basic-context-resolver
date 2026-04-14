import type { UniversalContext, FullDebugSnapshot, PlatformBackend, Platform, FinalContext } from './types';
import { detectPlatform } from '../adapters/getWindows';
import { MacOSBackend } from '../adapters/macos/backend';
import { WindowsBackend } from '../adapters/windows/backend';
import { LinuxBackend } from '../adapters/linux/backend';
import { normalizePlatformResult, buildFullDebugSnapshot } from './normalize';
import { inferMode, buildFinalContext } from './inferMode';
import { Metrics } from '../utils/metrics';

const BACKENDS: Record<string, () => PlatformBackend> = {
  darwin: () => new MacOSBackend(),
  win32: () => new WindowsBackend(),
  linux: () => new LinuxBackend(),
};

export class ContextResolver {
  private readonly metrics: Metrics;

  constructor() {
    this.metrics = new Metrics();
  }

  async resolve(): Promise<UniversalContext> {
    this.metrics.mark('resolve_start');

    const platform = detectPlatform();
    const BackendFactory = BACKENDS[platform];

    if (!BackendFactory) {
      return this.emptyResult(platform, `Unsupported platform: ${platform}`);
    }

    const backend = BackendFactory();

    this.metrics.mark('backend_start');
    const result = await backend.collect();
    this.metrics.mark('backend_end');
    this.metrics.measure('backendCollectMs', 'backend_start', 'backend_end');

    const final = buildFinalContext({
      appName: result.app.name,
      title: result.app.title,
      url: result.browser?.url,
      domain: result.browser?.domain,
      selectedText: result.ui?.selectedText,
      inputValuePreview: result.ui?.focusedValue,
    });

    this.metrics.mark('resolve_end');
    this.metrics.measure('totalResolveMs', 'resolve_start', 'resolve_end');

    return {
      platform,
      timestamp: new Date().toISOString(),
      app: result.app,
      browser: result.browser,
      ui: result.ui,
      final,
      debug: result.debug,
    };
  }

  async resolveWithDebug(): Promise<{ context: UniversalContext; debug: FullDebugSnapshot }> {
    this.metrics.mark('resolve_start');

    const platform = detectPlatform();
    const BackendFactory = BACKENDS[platform];

    if (!BackendFactory) {
      const ctx = this.emptyResult(platform, `Unsupported platform: ${platform}`);
      return {
        context: ctx,
        debug: buildFullDebugSnapshot({ app: {}, debug: {} }, platform, 'none', {}, ctx.final),
      };
    }

    const backend = BackendFactory();

    this.metrics.mark('backend_start');
    const result = await backend.collect();
    this.metrics.mark('backend_end');
    this.metrics.measure('backendCollectMs', 'backend_start', 'backend_end');

    const final = buildFinalContext({
      appName: result.app.name,
      title: result.app.title,
      url: result.browser?.url,
      domain: result.browser?.domain,
      selectedText: result.ui?.selectedText,
      inputValuePreview: result.ui?.focusedValue,
    });

    const context: UniversalContext = {
      platform,
      timestamp: new Date().toISOString(),
      app: result.app,
      browser: result.browser,
      ui: result.ui,
      final,
      debug: result.debug,
    };

    this.metrics.mark('resolve_end');
    this.metrics.measure('totalResolveMs', 'resolve_start', 'resolve_end');

    const fullDebug = buildFullDebugSnapshot(result, platform, backend.name, this.metrics.toJSON().steps, final);

    return { context, debug: fullDebug };
  }

  private emptyResult(platform: Platform, note: string): UniversalContext {
    return {
      platform,
      timestamp: new Date().toISOString(),
      app: {},
      final: {
        mode: 'generic_text',
      },
      debug: {
        notes: [note],
      },
    };
  }
}
