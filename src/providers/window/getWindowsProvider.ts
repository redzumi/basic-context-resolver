import { activeWindow } from 'get-windows';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActiveWindowInfo {
  id: number | string | null;
  platform: string;
  title: string;
  url: string;
  bounds: WindowBounds | null;
  ownerName: string;
  processId: number | null;
  bundleId: string;
  processPath: string;
  memoryUsage: number | null;
  error?: string;
}

export interface WindowProvider {
  getActiveWindow(): Promise<ActiveWindowInfo | null>;
}

export class GetWindowsProvider implements WindowProvider {
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    try {
      const result = await activeWindow({
        accessibilityPermission: false,
        screenRecordingPermission: true,
      });

      if (!result) {
        return null;
      }

      return {
        id: result.id ?? null,
        platform: result.platform ?? process.platform,
        title: result.title ?? '',
        url: result.url ?? '',
        bounds: result.bounds
          ? {
              x: result.bounds.x,
              y: result.bounds.y,
              width: result.bounds.width,
              height: result.bounds.height,
            }
          : null,
        ownerName: result.owner?.name ?? '',
        processId: result.owner?.processId ?? null,
        bundleId: result.owner?.bundleId ?? '',
        processPath: result.owner?.path ?? '',
        memoryUsage: result.memoryUsage ?? null,
      };
    } catch (error) {
      return {
        id: null,
        platform: process.platform,
        title: '',
        url: '',
        bounds: null,
        ownerName: '',
        processId: null,
        bundleId: '',
        processPath: '',
        memoryUsage: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
