export type {
  Platform,
  ContextMode,
  ConversationType,
  AppInfo,
  BrowserInfo,
  UiContext,
  FinalContext,
  DebugSnapshot,
  UniversalContext,
  PlatformBackendResult,
  PlatformBackend,
  DebugLayer,
  FullDebugSnapshot,
} from './context/types';

export type { ResolveOptions } from './context/resolver';

export {
  isBrowserApp,
  isChatApp,
  isBrowserChatDomain,
  safeDomain,
  collectDebugSnapshot,
} from './context/helpers';

export { inferMode, buildFinalContext } from './context/inferMode';

export { normalizePlatformResult, buildFullDebugSnapshot } from './context/normalize';

export { ContextResolver } from './context/resolver';

export { MacOSBackend } from './adapters/macos/backend';
export { WindowsBackend } from './adapters/windows/backend';
export { LinuxBackend } from './adapters/linux/backend';

export { getWindowMetadata, detectPlatform } from './adapters/getWindows';

export { Metrics, sleep } from './utils/metrics';
