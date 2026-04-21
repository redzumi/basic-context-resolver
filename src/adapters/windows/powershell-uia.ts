import { execText } from '../../utils/exec';

export const UIA_POWERSHELL_TIMEOUT_MS = 3000;
export const UIA_POWERSHELL_PRELUDE = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-UiString($value) {
  if ($null -eq $value) { return $null }
  return [string]$value
}
`;

export async function runPowerShellJson<T>(script: string, timeout = UIA_POWERSHELL_TIMEOUT_MS): Promise<T> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const stdout = await execText('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    encoded,
  ], { timeout });

  return JSON.parse(stdout) as T;
}

export function withUiaPrelude(body: string): string {
  return `${UIA_POWERSHELL_PRELUDE}\n${body}`;
}
