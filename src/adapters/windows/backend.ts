import { execText } from '../../utils/exec';
import { safeDomain, isBrowserApp } from '../../context/helpers';
import type { PlatformBackend, PlatformBackendResult, BrowserInfo, UiContext } from '../../context/types';

const PS_UTF8_HEADER = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
`;

interface UiaCandidate {
  name?: string;
  automationId?: string;
  className?: string;
  valuePattern?: string;
  legacyIa?: string;
  textPattern?: string;
}

async function extractBrowserViaUIA(processId?: number): Promise<{ browser: BrowserInfo; raw: unknown } | null> {
  try {
    const script = PS_UTF8_HEADER + `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Windows.Forms

$nativeDef = @'
using System;
using System.Runtime.InteropServices;
public class NativeMethods {
    [DllImport("user32.dll")]
    public static extern IntPtr SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
'@
if (-not ("NativeMethods" -as [type])) {
    Add-Type -TypeDefinition $nativeDef
}

function Read-OmniboxPatterns($edit) {
    $cand = @{
        name = "$($edit.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::NameProperty))"
        automationId = "$($edit.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::AutomationIdProperty))"
        className = "$($edit.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ClassNameProperty))"
        valuePattern = ''
        legacyIa = ''
        textPattern = ''
    }

    try {
        $vp = $edit.GetCurrentPattern([System.Windows.Automation.Patterns]::ValuePattern.Pattern)
        if ($vp -ne $null) { $cand.valuePattern = $vp.Current.Value }
    } catch {}

    try {
        $lip = $edit.GetCurrentPattern([System.Windows.Automation.Patterns]::LegacyIAccessiblePattern.Pattern)
        if ($lip -ne $null) { $cand.legacyIa = $lip.Current.Value }
    } catch {}

    try {
        $tp = $edit.GetCurrentPattern([System.Windows.Automation.Patterns]::TextPattern.Pattern)
        if ($tp -ne $null) {
            $range = $tp.DocumentRange
            $cand.textPattern = $range.GetText(-1)
        }
    } catch {}

    return $cand
}

try {
    $root = [System.Windows.Automation.AutomationElement]::RootElement

    $condition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
        ${processId ?? -1}
    )

    $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)

    if ($elements.Count -eq 0) {
        $fg = [System.Windows.Automation.AutomationElement]::FocusedElement
        if ($fg -ne $null) {
            $elements = New-Object System.Collections.ArrayList
            $elements.Add($fg) | Out-Null
        }
    }

    $windowEl = $null
    foreach ($el in $elements) {
        $windowEl = $el
        break
    }

    if ($windowEl -eq $null) {
        Write-Output '{}'
        exit 0
    }

    $title = $windowEl.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::NameProperty)

    # --- Phase 1: passive scan ---
    $candidatesBefore = @()
    $omniboxElements = @()

    $editCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Edit
    )
    $edits = $windowEl.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)

    foreach ($edit in $edits) {
        $aid = "$($edit.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::AutomationIdProperty))"
        $cn = "$($edit.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ClassNameProperty))"

        $isOmnibox = ($aid -match 'address|url|location|omnibox|nav') -or ($cn -match 'Omnibox|AddressBar|URLBar') -or ($aid -match 'view_\d+')

        if (-not $isOmnibox) { continue }

        $cand = Read-OmniboxPatterns $edit
        $candidatesBefore += $cand
        $omniboxElements += $edit
    }

    $urlBefore = $null
    foreach ($c in $candidatesBefore) {
        if ($c.valuePattern -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') { $urlBefore = $c.valuePattern; break }
        if ($c.legacyIa -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') { $urlBefore = $c.legacyIa; break }
        if ($c.textPattern -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') { $urlBefore = $c.textPattern; break }
    }

    # --- Phase 2: focus probe ---
    $probeAttempted = $false
    $focusSucceeded = $false
    $ctrlLSent = $false
    $candidatesAfter = @()
    $urlAfter = $null
    $probeFocusRestored = $false
    $focusedBefore = $null

    if (-not $urlBefore -and $omniboxElements.Count -gt 0) {
        $probeAttempted = $true

        try { $focusedBefore = [System.Windows.Automation.AutomationElement]::FocusedElement } catch {}
        $target = $omniboxElements[0]

        try {
            $target.SetFocus() | Out-Null
            $focusSucceeded = $true
        } catch {}

        try {
            [System.Windows.Forms.SendKeys]::SendWait("^l")
            $ctrlLSent = $true
        } catch {}

        Start-Sleep -Milliseconds 150

        $candidatesAfter = @()
        foreach ($edit in $omniboxElements) {
            $cand = Read-OmniboxPatterns $edit
            $candidatesAfter += $cand
        }

        foreach ($c in $candidatesAfter) {
            if ($c.valuePattern -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') { $urlAfter = $c.valuePattern; break }
            if ($c.legacyIa -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') { $urlAfter = $c.legacyIa; break }
            if ($c.textPattern -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') { $urlAfter = $c.textPattern; break }
        }

        if ($focusedBefore -ne $null) {
            try {
                $focusedBefore.SetFocus() | Out-Null
                $probeFocusRestored = $true
            } catch {}
        }
    }

    $finalUrl = if ($urlAfter) { $urlAfter } elseif ($urlBefore) { $urlBefore } else { $null }

    # --- Phase 3: clipboard fallback ---
    $clipAttempted = $false
    $clipSaved = $false
    $clipRestored = $false
    $clipBefore = ''
    $clipAfter = ''
    $clipShortcutUsed = ''
    $clipUrl = $null

    if (-not $finalUrl -and $omniboxElements.Count -gt 0) {
        $clipAttempted = $true
        $prevHwnd = [IntPtr]::Zero
        $focusRestored = $false

        try { $prevHwnd = [NativeMethods]::GetForegroundWindow() } catch {}

        try {
            Add-Type -AssemblyName System.Windows.Forms
            $clipBefore = [System.Windows.Forms.Clipboard]::GetText()
            $clipSaved = $true
        } catch {}

        try {
            [System.Windows.Forms.Clipboard]::Clear()
        } catch {}

        try {
            $proc = Get-Process -Id ${processId ?? 0} -ErrorAction SilentlyContinue
            if ($proc -ne $null) {
                $hwnd = $proc.MainWindowHandle
                $null = [NativeMethods]::SetForegroundWindow($hwnd)
            }
        } catch {}

        Start-Sleep -Milliseconds 50

        foreach ($shortcut in @("^l", "%d")) {
            try {
                [System.Windows.Forms.SendKeys]::SendWait($shortcut)
                $clipShortcutUsed = $shortcut
            } catch {}
            Start-Sleep -Milliseconds 100

            try {
                [System.Windows.Forms.SendKeys]::SendWait("^c")
            } catch {}
            Start-Sleep -Milliseconds 100

            try {
                $clipAfter = [System.Windows.Forms.Clipboard]::GetText()
            } catch {}

            if ($clipAfter -match '^https?://|^[\w][\w.-]*\.[a-z]{2,}') {
                $clipUrl = $clipAfter.Trim()
                break
            }

            Start-Sleep -Milliseconds 50
        }

        try {
            if ($clipSaved) {
                [System.Windows.Forms.Clipboard]::SetText($clipBefore)
                $clipRestored = $true
            } else {
                [System.Windows.Forms.Clipboard]::Clear()
                $clipRestored = $true
            }
        } catch {}

        try {
            if ($prevHwnd -ne [IntPtr]::Zero) {
                Start-Sleep -Milliseconds 30
                $null = [NativeMethods]::SetForegroundWindow($prevHwnd)
                $focusRestored = $true
            }
        } catch {}
    }

    $finalUrl = if ($finalUrl) { $finalUrl } elseif ($clipUrl) { $clipUrl } else { $null }

    ConvertTo-Json -Compress -Depth 4 @{
        title = "$title"
        candidatesBefore = $candidatesBefore
        candidatesAfter = $candidatesAfter
        probe = @{
            attempted = $probeAttempted
            focusSucceeded = $focusSucceeded
            ctrlLSent = $ctrlLSent
            focusRestored = $probeFocusRestored
        }
        urlBefore = $urlBefore
        urlAfter = $urlAfter
        clipboard = @{
            attempted = $clipAttempted
            saved = $clipSaved
            restored = $clipRestored
            focusRestored = $focusRestored
            before = $clipBefore
            after = $clipAfter
            shortcutUsed = $clipShortcutUsed
            url = $clipUrl
        }
        finalUrl = $finalUrl
    }
    exit 0
} catch {
    Write-Output "{""error"": ""$($_.Exception.Message)""}"
    exit 1
}
`;

    const output = await execText('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], { timeout: 15000 });

    if (!output || output.trim() === '' || output.trim().startsWith('{error')) {
      return null;
    }

    interface ProbeResult {
      title?: string;
      candidatesBefore?: UiaCandidate[];
      candidatesAfter?: UiaCandidate[];
      probe?: { attempted: boolean; focusSucceeded: boolean; ctrlLSent: boolean };
      urlBefore?: string | null;
      urlAfter?: string | null;
      clipboard?: {
        attempted: boolean;
        saved: boolean;
        restored: boolean;
        focusRestored: boolean;
        before: string;
        after: string;
        shortcutUsed: string;
        url: string | null;
      };
      finalUrl?: string | null;
      error?: string;
    }

    let parsed: ProbeResult;
    try {
      parsed = JSON.parse(output);
    } catch {
      return null;
    }

    if (parsed.error || !parsed.candidatesBefore?.length) {
      return null;
    }

    const bestUrl = parsed.finalUrl || null;
    const browser: BrowserInfo = {
      title: parsed.title || undefined,
      url: bestUrl || undefined,
      domain: bestUrl ? safeDomain(bestUrl) : undefined,
    };

    const hitSource = (() => {
      if (!bestUrl) return null;
      if (parsed.clipboard?.url === bestUrl) return 'clipboard';
      const check = (cands: UiaCandidate[] | undefined) => {
        if (!cands) return null;
        for (const c of cands) {
          if (c.valuePattern === bestUrl) return 'valuePattern';
          if (c.legacyIa === bestUrl) return 'legacyIa';
          if (c.textPattern === bestUrl) return 'textPattern';
        }
        return null;
      };
      return parsed.urlAfter ? check(parsed.candidatesAfter) : check(parsed.candidatesBefore);
    })();

    const raw = {
      provider: 'uia-browser',
      title: parsed.title,
      candidatesBefore: parsed.candidatesBefore,
      candidatesAfter: parsed.candidatesAfter,
      probe: parsed.probe,
      urlBefore: parsed.urlBefore ?? null,
      urlAfter: parsed.urlAfter ?? null,
      clipboard: parsed.clipboard ?? null,
      bestUrl: bestUrl,
      hitSource: hitSource ?? (bestUrl ? 'unknown' : null),
    };

    return { browser, raw };
  } catch {
    return null;
  }
}

async function extractUIAContext(): Promise<{ ui: UiContext; raw: unknown }> {
  const ui: UiContext = {};
  let raw: unknown = undefined;

  try {
    const script = PS_UTF8_HEADER + `
Add-Type -AssemblyName UIAutomationClient

try {
    $focused = [System.Windows.Automation.AutomationElement]::FocusedElement

    if ($focused -eq $null) {
        Write-Output '{}'
        exit 0
    }

    $name = $focused.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::NameProperty)
    $ct = $focused.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ControlTypeProperty)
    $ctName = if ($ct) { $ct.ProgrammaticName.Replace('ControlType.', '') } else { '' }
    $aid = $focused.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::AutomationIdProperty)
    $className = $focused.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ClassNameProperty)

    $value = ''
    try {
        $vp = $focused.GetCurrentPattern([System.Windows.Automation.Patterns]::ValuePattern.Pattern)
        if ($vp -ne $null) { $value = $vp.Current.Value }
    } catch {}

    $legacyValue = ''
    try {
        $lip = $focused.GetCurrentPattern([System.Windows.Automation.Patterns]::LegacyIAccessiblePattern.Pattern)
        if ($lip -ne $null) { $legacyValue = $lip.Current.Value }
    } catch {}

    $selectedText = ''
    try {
        $tp = $focused.GetCurrentPattern([System.Windows.Automation.Patterns]::TextPattern.Pattern)
        if ($tp -ne $null) {
            $selection = $tp.GetSelection()
            if ($selection.Count -gt 0) {
                $selectedText = $selection[0].GetText(-1)
            }
        }
    } catch {}

    ConvertTo-Json -Compress @{
        name = "$name"
        controlType = "$ctName"
        automationId = "$aid"
        className = "$className"
        value = "$value"
        legacyValue = "$legacyValue"
        selectedText = "$selectedText"
    }
} catch {
    Write-Output "{""error"": ""$($_.Exception.Message)""}"
}
`;

    const output = await execText('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], { timeout: 8000 });

    if (output && output.trim() !== '{}' && output.trim() !== '') {
      try {
        raw = JSON.parse(output);
        if (typeof raw === 'object' && raw !== null) {
          const r = raw as Record<string, unknown>;
          if (typeof r.controlType === 'string') ui.focusedRole = r.controlType;
          if (typeof r.name === 'string' && r.name) ui.focusedName = r.name;
          if (typeof r.value === 'string' && r.value) ui.focusedValue = r.value;
          else if (typeof r.legacyValue === 'string' && r.legacyValue) ui.focusedValue = r.legacyValue;
          if (typeof r.selectedText === 'string' && r.selectedText) ui.selectedText = r.selectedText;
        }
      } catch {
        raw = output;
      }
    }
  } catch { /* ignore */ }

  return { ui, raw };
}

export class WindowsBackend implements PlatformBackend {
  readonly name = 'windows-powershell-uia';
  readonly platform = 'win32' as const;

  async collect(options?: import('../../context/types').PlatformBackendOptions): Promise<PlatformBackendResult> {
    const { getWindowMetadata } = await import('../getWindows');
    const { app, raw: windowRaw } = await getWindowMetadata(options?.getWindowsOptions);

    const notes: string[] = [];
    let browser: BrowserInfo | undefined;
    let browserRaw: unknown;

    const appName = app.name ?? '';

    if (isBrowserApp(appName)) {
      const result = await extractBrowserViaUIA(app.pid);
      if (result) {
        browser = result.browser;
        browserRaw = result.raw;
        if (result.browser.url) {
          const rawProbe = result.raw as Record<string, unknown>;
          const clip = rawProbe.clipboard as Record<string, unknown> | undefined;
          const probe = rawProbe.probe as Record<string, unknown> | undefined;
          if (clip?.url) {
            notes.push(`URL obtained from clipboard fallback for ${appName} (shortcut=${clip.shortcutUsed ?? '?'})`);
          } else if (probe?.attempted && rawProbe.urlAfter) {
            notes.push(`URL obtained after focus+Ctrl+L probe for ${appName}`);
          }
        } else {
          const rawProbe = result.raw as Record<string, unknown>;
          const clip = rawProbe.clipboard as Record<string, unknown> | undefined;
          const probe = rawProbe.probe as Record<string, unknown> | undefined;
          if (clip?.attempted) {
            notes.push(
              `Clipboard fallback attempted for ${appName} but no URL extracted ` +
              `(saved=${clip.saved}, restored=${clip.restored}, shortcut=${clip.shortcutUsed ?? '?'})`,
            );
          } else if (probe?.attempted) {
            notes.push(
              `Omnibox found but URL unavailable after focus probe for ${appName} ` +
              `(focus=${probe.focusSucceeded}, ctrlL=${probe.ctrlLSent})`,
            );
          } else {
            notes.push(`Found omnibox control(s) but no URL extracted for ${appName}`);
          }
        }
      } else {
        browserRaw = { provider: 'uia-browser', targetPid: app.pid, error: 'no candidates found' };
        notes.push(`UIA browser extraction found no omnibox controls for ${appName} (pid=${app.pid})`);
      }
    }

    const uiaResult = await extractUIAContext();
    const ui = uiaResult.ui;
    const uiRaw = uiaResult.raw;

    return {
      app,
      browser,
      ui,
      debug: {
        windowRaw,
        browserRaw,
        uiRaw,
        notes,
      },
    };
  }
}
