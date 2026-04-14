import { execText } from '../../utils/exec';
import type { PlatformBackend, PlatformBackendResult, UiContext } from '../../context/types';

async function extractX11Context(): Promise<{ ui: UiContext; raw: unknown }> {
  const ui: UiContext = {};
  const notes: string[] = [];

  try {
    const activeWindow = await execText('xdotool', ['getactivewindow', 'getwindowname'], { timeout: 3000 });
    if (activeWindow) {
      ui.focusedName = activeWindow;
    }
  } catch {
    notes.push('xdotool not available or failed');
  }

  try {
    const selection = await execText('xclip', ['-selection', 'primary', '-o'], { timeout: 2000 });
    if (selection) {
      ui.selectedText = selection;
    }
  } catch {
    notes.push('xclip not available or no primary selection');
  }

  try {
    const activePid = await execText('xdotool', ['getactivewindow', 'getwindowpid'], { timeout: 3000 });
    if (activePid) {
      const pidNum = parseInt(activePid, 10);
      if (!isNaN(pidNum)) {
        try {
          const procCmdline = await execText('cat', [`/proc/${pidNum}/cmdline`], { timeout: 1000 });
          if (procCmdline) {
            const procName = procCmdline.split('\0')[0]?.split('/').pop();
            if (procName) {
              ui.nearbyText = [`process: ${procName}`];
            }
          }
        } catch {
          notes.push(`/proc/${activePid}/cmdline unreadable`);
        }
      }
    }
  } catch {
    notes.push('xdotool getwindowpid failed');
  }

  const raw = { ...ui, _notes: notes };

  return { ui, raw };
}

export class LinuxBackend implements PlatformBackend {
  readonly name = 'linux-shell-atspi';
  readonly platform = 'linux' as const;

  async collect(): Promise<PlatformBackendResult> {
    const { getWindowMetadata } = await import('../getWindows');
    const { app, raw: windowRaw } = await getWindowMetadata();

    const notes: string[] = [];

    const desktopEnv = process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? 'unknown';
    notes.push(`desktop environment: ${desktopEnv}`);

    const { ui, raw: uiRaw } = await extractX11Context();

    if (Object.keys(ui).length === 0) {
      notes.push('Linux context extraction returned minimal data - AT-SPI/WMI tools may be unavailable');
    }

    return {
      app,
      ui,
      debug: {
        windowRaw,
        uiRaw,
        notes,
      },
    };
  }
}
