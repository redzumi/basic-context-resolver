import { runPowerShellJson, withUiaPrelude } from './powershell-uia';

const OMNIBOX_SCORE = {
  focus: 40,
  automationIdOmnibox: 30,
  automationIdAddressLike: 20,
  automationIdViewPattern: 10,
  classNameAddressLike: 20,
  nameAddressLike: 10,
  directUrlValue: 25,
  legacyUrlValue: 15,
} as const;

function isOmniboxLike(cand: OmniboxCandidate): boolean {
  const aid = cand.automationId?.toLowerCase() ?? '';
  const cn = cand.className?.toLowerCase() ?? '';
  const name = cand.name?.toLowerCase() ?? '';

  if (
    aid.includes('address') ||
    aid.includes('url') ||
    aid.includes('location') ||
    aid.includes('omnibox') ||
    aid.includes('nav') ||
    /view_\d+/.test(aid)
  ) {
    return true;
  }
  if (cn.includes('omnibox') || cn.includes('addressbar') || cn.includes('urlbar')) {
    return true;
  }
  if (name.includes('address') || name.includes('url') || name.includes('search')) {
    return true;
  }
  return false;
}

function scoreCandidate(cand: OmniboxCandidate): number {
  const aid = cand.automationId?.toLowerCase() ?? '';
  const cn = cand.className?.toLowerCase() ?? '';
  const name = cand.name?.toLowerCase() ?? '';

  let score = 0;

  if (cand.hasKeyboardFocus || cand.isKeyboardFocusable) score += OMNIBOX_SCORE.focus;
  if (aid.includes('omnibox')) score += OMNIBOX_SCORE.automationIdOmnibox;
  if (aid.includes('address') || aid.includes('location') || aid.includes('url')) score += OMNIBOX_SCORE.automationIdAddressLike;
  if (/view_\d+/.test(aid)) score += OMNIBOX_SCORE.automationIdViewPattern;
  if (cn.includes('omnibox') || cn.includes('addressbar') || cn.includes('urlbar')) score += OMNIBOX_SCORE.classNameAddressLike;
  if (name.includes('address') || name.includes('search') || name.includes('url')) score += OMNIBOX_SCORE.nameAddressLike;
  if (looksLikeUrl(cand.value)) score += OMNIBOX_SCORE.directUrlValue;
  if (looksLikeUrl(cand.legacyValue)) score += OMNIBOX_SCORE.legacyUrlValue;

  return score;
}

function looksLikeUrl(str: string | null): boolean {
  if (!str) return false;
  return /^https?:\/\//i.test(str) || /^[\w][\w.-]*\.[a-z]{2,}/i.test(str);
}

interface UiAutomationCandidate {
  name: string | null;
  automationId: string | null;
  className: string | null;
  value: string | null;
  legacyValue: string | null;
  textValue: string | null;
  isKeyboardFocusable: boolean;
  hasKeyboardFocus: boolean;
}

interface UiAutomationUrlPayload {
  pid: number;
  editCount: number;
  rawCandidates: UiAutomationCandidate[];
}

function buildBrowserUrlScript(pid: number): string {
  return withUiaPrelude(`
$targetPid = ${pid}
$root = [System.Windows.Automation.AutomationElement]::RootElement
$windowCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
  $targetPid
)
$window = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $windowCond)

if ($null -eq $window) {
  [pscustomobject]@{
    pid = $targetPid
    editCount = 0
    rawCandidates = @()
  } | ConvertTo-Json -Compress -Depth 6
  exit
}

$editCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::Edit
)
$edits = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)
$items = New-Object System.Collections.Generic.List[object]

for ($i = 0; $i -lt $edits.Count; $i++) {
  $edit = $edits.Item($i)
  $name = $null
  $automationId = $null
  $className = $null
  $value = $null
  $legacyValue = $null
  $isKeyboardFocusable = $false
  $hasKeyboardFocus = $false

  try { $name = Get-UiString $edit.Current.Name } catch {}
  try { $automationId = Get-UiString $edit.Current.AutomationId } catch {}
  try { $className = Get-UiString $edit.Current.ClassName } catch {}
  try { $isKeyboardFocusable = [bool]$edit.Current.IsKeyboardFocusable } catch {}
  try { $hasKeyboardFocus = [bool]$edit.Current.HasKeyboardFocus } catch {}
  try {
    $pattern = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($null -ne $pattern) { $value = Get-UiString $pattern.Current.Value }
  } catch {}
  try {
    $legacy = $edit.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
    if ($null -ne $legacy) { $legacyValue = Get-UiString $legacy.Current.Value }
  } catch {}

  $items.Add([pscustomobject]@{
    name = $name
    automationId = $automationId
    className = $className
    value = $value
    legacyValue = $legacyValue
    textValue = $null
    isKeyboardFocusable = $isKeyboardFocusable
    hasKeyboardFocus = $hasKeyboardFocus
  })
}

[pscustomobject]@{
  pid = $targetPid
  editCount = $edits.Count
  rawCandidates = $items
} | ConvertTo-Json -Compress -Depth 6
`);
}

function buildFocusedContextScript(): string {
  return withUiaPrelude(`
function Normalize-ControlType($programmaticName) {
  if ([string]::IsNullOrWhiteSpace($programmaticName)) { return $null }
  if ($programmaticName -match 'ControlType\\.(.+)$') { return $Matches[1] }
  return $programmaticName
}

$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $focused) {
  [pscustomobject]@{
    focusedRole = $null
    focusedName = $null
    focusedValue = $null
  } | ConvertTo-Json -Compress -Depth 4
  exit
}

$focusedName = $null
$focusedRole = $null
$focusedValue = $null

try { $focusedName = Get-UiString $focused.Current.Name } catch {}
try { $focusedRole = Normalize-ControlType ($focused.Current.ControlType.ProgrammaticName) } catch {}
try {
  $pattern = $focused.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  if ($null -ne $pattern) { $focusedValue = Get-UiString $pattern.Current.Value }
} catch {}

[pscustomobject]@{
  focusedRole = $focusedRole
  focusedName = $focusedName
  focusedValue = $focusedValue
} | ConvertTo-Json -Compress -Depth 4
`);
}

interface OmniboxCandidate {
  name: string | null;
  automationId: string | null;
  className: string | null;
  value: string | null;
  legacyValue: string | null;
  textValue: string | null;
  isKeyboardFocusable: boolean;
  hasKeyboardFocus: boolean;
}

export interface NativeUIAResult {
  url: string | null;
  candidates: OmniboxCandidate[];
  debug?: unknown;
}

export async function getBrowserUrlViaUIA(pid: number): Promise<NativeUIAResult> {
  const payload = await runPowerShellJson<UiAutomationUrlPayload>(buildBrowserUrlScript(pid));
  const candidates = (payload.rawCandidates ?? [])
    .filter(isOmniboxLike)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  let url: string | null = null;
  for (const cand of candidates) {
    if (!url && looksLikeUrl(cand.value)) url = cand.value;
    if (!url && looksLikeUrl(cand.legacyValue)) url = cand.legacyValue;
  }

  return {
    url,
    candidates,
    debug: {
      pid,
      editCount: payload.editCount ?? candidates.length,
      rawCandidateCount: payload.rawCandidates?.length ?? candidates.length,
      backend: 'powershell-uia',
    },
  };
}

export async function getUIAContext(): Promise<{
  focusedRole: string | null;
  focusedName: string | null;
  focusedValue: string | null;
}> {
  return runPowerShellJson(buildFocusedContextScript());
}
