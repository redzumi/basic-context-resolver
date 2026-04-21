export interface NativeIABrowserResult {
  url: string | null;
  debug?: unknown;
}

const IACCESSIBLE_DISABLED_REASON =
  'IAccessible fallback is disabled while Windows native extraction is being stabilized';

export async function getBrowserUrlViaIAccessible(pid: number): Promise<NativeIABrowserResult> {
  return {
    url: null,
    debug: {
      pid,
      error: IACCESSIBLE_DISABLED_REASON,
    },
  };
}

export async function getIAccessibleContext(): Promise<{
  focusedRole: string | null;
  focusedName: string | null;
  focusedValue: string | null;
}> {
  return {
    focusedRole: null,
    focusedName: null,
    focusedValue: null,
  };
}
