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
} from './types';

export { isBrowserApp, isChatApp, isBrowserChatDomain, safeDomain, collectDebugSnapshot } from './helpers';

export { inferMode, buildFinalContext } from './inferMode';

export { normalizePlatformResult, buildFullDebugSnapshot } from './normalize';

export { ContextResolver } from './resolver';

export { MacOSBackend } from '../adapters/macos/backend';
export { WindowsBackend } from '../adapters/windows/backend';
export { LinuxBackend } from '../adapters/linux/backend';

export { getWindowMetadata, detectPlatform } from '../adapters/getWindows';
