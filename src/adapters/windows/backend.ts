import { safeDomain, isBrowserApp } from '../../context/helpers';
import type { PlatformBackend, PlatformBackendResult, BrowserInfo, UiContext } from '../../context/types';
import { getBrowserUrlViaUIA, getUIAContext } from './native-uia';
import { getBrowserUrlViaIAccessible, getIAccessibleContext } from './native-iaccessible';

export interface NativeExtractionResult {
  url: string | null;
  source: 'uia' | 'iaccessible' | null;
  debug?: unknown;
}

const NATIVE_CALL_TIMEOUT_MS = 3000;
const ENABLE_WINDOWS_NATIVE = process.env.BCR_DISABLE_WINDOWS_NATIVE !== '1';
const WINDOWS_UIA_PROVIDER = 'powershell-uia';
const WINDOWS_IA_PROVIDER = 'native-iaccessible';

function normalizeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
    };
  }

  return { message: String(err) };
}

async function withTimeout<T>(label: string, task: Promise<T>, timeoutMs = NATIVE_CALL_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function extractBrowserUrlNative(pid: number | undefined): Promise<NativeExtractionResult> {
  if (!pid) {
    return { url: null, source: null, debug: { error: 'No PID provided' } };
  }

  let uiaFailure: unknown;
  let iaFailure: unknown;

  try {
    const uiaResult = await withTimeout('getBrowserUrlViaUIA', getBrowserUrlViaUIA(pid));
    if (uiaResult.url) {
      return {
        url: uiaResult.url,
        source: 'uia',
        debug: {
          provider: WINDOWS_UIA_PROVIDER,
          candidates: uiaResult.candidates,
          debug: uiaResult.debug,
        },
      };
    }
  } catch (err) {
    uiaFailure = normalizeError(err);
    console.error('Native UIA failed:', err);
  }

  try {
    const iaResult = await withTimeout('getBrowserUrlViaIAccessible', getBrowserUrlViaIAccessible(pid));
    if (iaResult.url) {
      return {
        url: iaResult.url,
        source: 'iaccessible',
        debug: {
          provider: WINDOWS_IA_PROVIDER,
          debug: iaResult.debug,
        },
      };
    }
  } catch (err) {
    iaFailure = normalizeError(err);
    console.error('Native IAccessible failed:', err);
  }

  return {
    url: null,
    source: null,
    debug: {
      error: 'No URL extracted from native methods',
      pid,
      uiaFailure,
      iaFailure,
    },
  };
}

async function extractUIContext(): Promise<{ ui: UiContext; raw: unknown }> {
  const ui: UiContext = {};
  let uiaFailure: unknown;
  let iaFailure: unknown;

  try {
    const uiaContext = await withTimeout('getUIAContext', getUIAContext());
    if (uiaContext.focusedRole) {
      ui.focusedRole = uiaContext.focusedRole;
      ui.focusedName = uiaContext.focusedName ?? undefined;
      ui.focusedValue = uiaContext.focusedValue ?? undefined;
      return { ui, raw: { provider: WINDOWS_UIA_PROVIDER, ...uiaContext } };
    }
  } catch (err) {
    uiaFailure = normalizeError(err);
  }

  try {
    const iaContext = await withTimeout('getIAccessibleContext', getIAccessibleContext());
    if (iaContext.focusedRole) {
      ui.focusedRole = iaContext.focusedRole;
      ui.focusedName = iaContext.focusedName ?? undefined;
      ui.focusedValue = iaContext.focusedValue ?? undefined;
      return { ui, raw: { provider: WINDOWS_IA_PROVIDER, ...iaContext } };
    }
  } catch (err) {
    iaFailure = normalizeError(err);
  }

  return {
    ui,
    raw: {
      provider: 'native',
      error: 'No context extracted',
      uiaFailure,
      iaFailure,
    },
  };
}

export class WindowsBackend implements PlatformBackend {
  readonly name = 'windows-powershell-uia';
  readonly platform = 'win32' as const;

  async collect(options?: import('../../context/types').PlatformBackendOptions): Promise<PlatformBackendResult> {
    const { getWindowMetadata } = await import('../getWindows');
    const { app, raw: windowRaw } = await getWindowMetadata(options?.getWindowsOptions);

    const notes: string[] = [];
    let browser: BrowserInfo | undefined;
    let browserRaw: unknown;

    const appName = app.name ?? '';

    if (!ENABLE_WINDOWS_NATIVE) {
      notes.push('Windows native UIA/IAccessible disabled via BCR_DISABLE_WINDOWS_NATIVE=1');
      browserRaw = { disabled: true, reason: 'windows_native_disabled' };
    } else if (isBrowserApp(appName)) {
      const result = await extractBrowserUrlNative(app.pid);

      if (result.url) {
        browser = {
          title: app.title,
          url: result.url,
          domain: safeDomain(result.url),
        };
        browserRaw = result.debug;
        notes.push(`URL extracted via ${result.source} for ${appName}`);
      } else {
        browserRaw = result.debug;
        notes.push(`No URL extracted for ${appName} (pid=${app.pid})`);
      }
    }

    const { ui, raw: uiRaw } = ENABLE_WINDOWS_NATIVE
      ? await extractUIContext()
      : {
          ui: {},
          raw: { disabled: true, reason: 'windows_native_disabled' },
        };

    return {
      app,
      browser,
      ui,
      debug: {
        windowRaw,
        browserRaw,
        uiRaw,
        notes,
      },
    };
  }
}
