# basic-context-resolver

Cross-platform desktop context resolver. Detects the active application, browser URL, and UI state on macOS, Windows, and Linux.

## Install

```bash
npm install basic-context-resolver
```

## Usage

```ts
import { ContextResolver } from 'basic-context-resolver';

const resolver = new ContextResolver();

const context = await resolver.resolve();
console.log(context);
// {
//   platform: 'darwin',
//   timestamp: '2026-04-14T18:30:00.000Z',
//   app: { name: 'Google Chrome', title: 'GitHub', pid: 1234, ... },
//   browser: { url: 'https://github.com', domain: 'github.com', ... },
//   ui: { focusedRole: 'AXTextField', selectedText: '...', ... },
//   final: { mode: 'code', appName: 'Google Chrome', url: '...', ... },
//   debug: { ... }
// }
```

### With debug info

```ts
const { context, debug } = await resolver.resolveWithDebug();
```

### Platform-specific backends

```ts
import { MacOSBackend } from 'basic-context-resolver';

const backend = new MacOSBackend();
const result = await backend.collect();
```

Available backends: `MacOSBackend`, `WindowsBackend`, `LinuxBackend`.

### Utilities

```ts
import { detectPlatform, getWindowMetadata, inferMode, safeDomain } from 'basic-context-resolver';

detectPlatform();       // 'darwin' | 'win32' | 'linux'
const { app, raw } = await getWindowMetadata();
safeDomain('https://example.com/path');  // 'example.com'
```

## Context modes

The `final.mode` field indicates the type of detected context:

| Mode | Description |
|---|---|
| `browser_generic` | Any browser |
| `browser_chat` | Browser on a chat domain (Slack, Discord, Telegram, etc.) |
| `desktop_chat` | Desktop chat app (Telegram, Slack, Discord, etc.) |
| `email` | Email client (Gmail, Outlook) |
| `document` | Document editor (Notion) |
| `issue_comment` | Issue tracker (GitHub, Linear, GitLab) |
| `code` | Code editor (VS Code, Cursor, Windsurf) |
| `generic_text` | Fallback |

## Development

```bash
npm run dev     # watch + auto-run
npm run start   # build + run once
```

## Platform requirements

- **macOS**: Screen Recording and Accessibility permissions
- **Windows**: No additional permissions required
- **Linux**: `xdotool` and `xclip` recommended

## License

MIT
