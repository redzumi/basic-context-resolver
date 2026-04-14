import { activeWindow } from 'get-windows';
import type { AppInfo, Platform } from '../context/types';

export interface WindowAdapterResult {
  app: AppInfo;
  raw: unknown;
}

export async function getWindowMetadata(): Promise<WindowAdapterResult> {
  try {
    const result = await activeWindow({
      accessibilityPermission: false,
      screenRecordingPermission: true,
    });

    if (!result) {
      return {
        app: {},
        raw: null,
      };
    }

    const app: AppInfo = {
      name: result.owner?.name,
      pid: result.owner?.processId ?? undefined,
      title: result.title ?? undefined,
      bounds: result.bounds
        ? {
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height,
          }
        : undefined,
      processPath: result.owner?.path ?? undefined,
      bundleId: 'bundleId' in (result.owner ?? {}) ? (result.owner as { bundleId?: string }).bundleId ?? undefined : undefined,
    };

    return { app, raw: result };
  } catch (error) {
    return {
      app: {},
      raw: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

export function detectPlatform(): Platform {
  return process.platform as Platform;
}
