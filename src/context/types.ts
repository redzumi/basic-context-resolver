export type Platform = 'darwin' | 'win32' | 'linux';

export type ContextMode =
  | 'browser_generic'
  | 'browser_chat'
  | 'desktop_chat'
  | 'email'
  | 'document'
  | 'issue_comment'
  | 'code'
  | 'generic_text';

export type ConversationType = 'direct' | 'group' | 'channel' | 'unknown';

export interface AppInfo {
  name?: string;
  pid?: number;
  title?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  processPath?: string;
  bundleId?: string;
}

export interface BrowserInfo {
  title?: string;
  url?: string;
  domain?: string;
}

export interface UiContext {
  focusedRole?: string;
  focusedName?: string;
  focusedValue?: string;
  selectedText?: string;
  nearbyText?: string[];
}

export interface FinalContext {
  mode: ContextMode;
  appName?: string;
  activeTitle?: string;
  url?: string;
  domain?: string;
  conversationWith?: string;
  conversationType?: ConversationType;
  selectedText?: string;
  inputValuePreview?: string;
}

export interface DebugSnapshot {
  windowRaw?: unknown;
  browserRaw?: unknown;
  uiRaw?: unknown;
  notes?: string[];
}

export interface UniversalContext {
  platform: Platform;
  timestamp: string;

  app: AppInfo;

  browser?: BrowserInfo;

  ui?: UiContext;

  final: FinalContext;

  debug: DebugSnapshot;
}

export interface PlatformBackendResult {
  app: AppInfo;
  browser?: BrowserInfo;
  ui?: UiContext;
  debug: DebugSnapshot;
}

export interface PlatformBackend {
  readonly name: string;
  readonly platform: Platform;
  collect(): Promise<PlatformBackendResult>;
}

export interface DebugLayer {
  provider: string;
  attempted: boolean;
  available: boolean;
  raw: unknown;
  normalized: unknown;
  notes: string[];
}

export interface FullDebugSnapshot {
  platform: Platform;
  timestamp: string;
  capabilities: {
    windowMetadata: boolean;
    browserContext: boolean;
    nativeUiContext: boolean;
  };
  window: DebugLayer;
  browser: DebugLayer;
  nativeUi: DebugLayer;
  final: FinalContext;
  metrics: Record<string, number>;
  backendName: string;
}
