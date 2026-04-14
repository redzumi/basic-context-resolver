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
  PlatformBackendOptions,
  DebugLayer,
  FullDebugSnapshot,
} from './context/types';

export {
  isBrowserApp,
  isChatApp,
  isBrowserChatDomain,
  safeDomain,
  collectDebugSnapshot,
} from './context/helpers';

export { inferMode, buildFinalContext } from './context/inferMode';

export { ContextResolver } from './context/resolver';

export { MacOSBackend } from './adapters/macos/backend';
export { WindowsBackend } from './adapters/windows/backend';
export { LinuxBackend } from './adapters/linux/backend';

export { getWindowMetadata, detectPlatform, type GetWindowsOptions } from './adapters/getWindows';
