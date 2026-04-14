import type { PlatformBackendResult, UniversalContext, FullDebugSnapshot, DebugLayer, Platform } from './types';

function buildDebugLayer(
  provider: string,
  attempted: boolean,
  available: boolean,
  raw: unknown,
  normalized: unknown,
  notes: string[] = [],
): DebugLayer {
  return { provider, attempted, available, raw, normalized, notes };
}

export function normalizePlatformResult(
  result: PlatformBackendResult,
  platform: Platform,
  backendName: string,
  metrics: Record<string, number>,
): UniversalContext {
  const hasWindowMetadata = !!(result.app.name || result.app.title);
  const hasBrowserContext = !!(result.browser?.url || result.browser?.title);
  const hasNativeUiContext = !!(
    result.ui?.focusedRole ||
    result.ui?.focusedName ||
    result.ui?.selectedText
  );

  const final = {
    mode: 'generic_text' as const,
    appName: result.app.name,
    activeTitle: result.app.title,
    url: result.browser?.url,
    domain: result.browser?.domain,
    selectedText: result.ui?.selectedText,
    inputValuePreview: result.ui?.focusedValue,
  };

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

export function buildFullDebugSnapshot(
  result: PlatformBackendResult,
  platform: Platform,
  backendName: string,
  metrics: Record<string, number>,
): FullDebugSnapshot {
  const hasWindowMetadata = !!(result.app.name || result.app.title);
  const hasBrowserContext = !!(result.browser?.url || result.browser?.title);
  const hasNativeUiContext = !!(
    result.ui?.focusedRole ||
    result.ui?.focusedName ||
    result.ui?.selectedText
  );

  return {
    platform,
    timestamp: new Date().toISOString(),
    capabilities: {
      windowMetadata: hasWindowMetadata,
      browserContext: hasBrowserContext,
      nativeUiContext: hasNativeUiContext,
    },
    window: buildDebugLayer(
      'get-windows',
      true,
      hasWindowMetadata,
      result.debug.windowRaw,
      result.app,
    ),
    browser: buildDebugLayer(
      backendName,
      !!result.browser,
      hasBrowserContext,
      result.debug.browserRaw,
      result.browser ?? null,
      result.debug.notes,
    ),
    nativeUi: buildDebugLayer(
      backendName,
      true,
      hasNativeUiContext,
      result.debug.uiRaw,
      result.ui ?? null,
    ),
    final: {
      mode: 'generic_text' as const,
      appName: result.app.name,
      activeTitle: result.app.title,
      url: result.browser?.url,
      domain: result.browser?.domain,
      selectedText: result.ui?.selectedText,
      inputValuePreview: result.ui?.focusedValue,
    },
    metrics,
    backendName,
  };
}
