import { RegistryChange, RegistryValueType } from './types';

// ── Hive path mapping ────────────────────────────────────────────────────────

const HIVE_MAP: [string, string][] = [
  ['HKEY_LOCAL_MACHINE', 'HKLM:'],
  ['HKEY_CURRENT_USER',  'HKCU:'],
  ['HKEY_CLASSES_ROOT',  'HKCR:'],
  ['HKEY_USERS',         'HKU:'],
  ['HKEY_CURRENT_CONFIG','HKCC:'],
];

/** Collapse repeated separators and strip any trailing separator. */
function cleanPath(p: string): string {
  return p.replace(/\\{2,}/g, '\\').replace(/\\+$/, '');
}

function toPsPath(regPath: string): string {
  const path = cleanPath(regPath);
  for (const [hive, alias] of HIVE_MAP) {
    if (path === hive) return alias;
    if (path.startsWith(hive + '\\')) {
      return alias + '\\' + path.slice(hive.length + 1);
    }
  }
  return path;
}

function psType(type: RegistryValueType): string {
  switch (type) {
    case 'REG_SZ':        return 'String';
    case 'REG_EXPAND_SZ': return 'ExpandString';
    case 'REG_DWORD':     return 'DWord';
    case 'REG_QWORD':     return 'QWord';
    case 'REG_BINARY':    return 'Binary';
    case 'REG_MULTI_SZ':  return 'MultiString';
    default:              return 'String';
  }
}

function psData(type: RegistryValueType, data: string): string {
  switch (type) {
    case 'REG_SZ':
    case 'REG_EXPAND_SZ':
      return `'${data.replace(/'/g, "''")}'`;

    case 'REG_DWORD':
      return `([uint32]0x${(data || '0').padStart(8, '0')})`;

    case 'REG_QWORD':
      return `([uint64]0x${(data || '0').padStart(16, '0')})`;

    case 'REG_BINARY': {
      if (!data) return '@()';
      const bytes = data.match(/.{1,2}/g) ?? [];
      return `([byte[]]@(${bytes.map((b) => `0x${b.toUpperCase()}`).join(', ')}))`;
    }

    case 'REG_MULTI_SZ': {
      if (!data) return '@()';
      const lines = data.split(/\n|\x00/).filter(Boolean);
      return `@(${lines.map((l) => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
    }

    default:
      return `'${data.replace(/'/g, "''")}'`;
  }
}

function q(s: string) {
  return s.replace(/'/g, "''");
}

/**
 * Reduce a list of key paths to the minimal set worth creating: strip trailing
 * separators, dedupe, and drop any path that is an ancestor of another —
 * `New-Item -Force` creates intermediate keys, so the deepest path covers them.
 */
function minimalKeyPaths(paths: string[]): string[] {
  const set = new Set(paths.map(cleanPath).filter(Boolean));
  return [...set]
    .filter((p) => ![...set].some((o) => o !== p && o.startsWith(p + '\\')))
    .sort();
}

/**
 * The opposite of minimalKeyPaths: keep the ancestor-most touched keys and drop
 * descendants. Used for backup — `reg export` of a key captures its whole
 * subtree, so exporting the top key covers everything beneath it.
 */
function topLevelKeyPaths(paths: string[]): string[] {
  const set = new Set(paths.map(cleanPath).filter(Boolean));
  return [...set]
    .filter((p) => ![...set].some((o) => o !== p && p.startsWith(o + '\\')))
    .sort();
}

/** Suggest a profile name from the most-changed registry paths */
export function suggestProfileName(changes: RegistryChange[]): string {
  if (changes.length === 0) return 'RegBuddy';
  // Find the most common second-level path segment
  const segments: Record<string, number> = {};
  for (const c of changes) {
    const parts = c.path.split('\\');
    // Use the 2nd or 3rd segment as meaningful identifier
    const seg = parts[2] || parts[1] || parts[0];
    if (seg) segments[seg] = (segments[seg] || 0) + 1;
  }
  const top = Object.entries(segments).sort((a, b) => b[1] - a[1])[0];
  const name = top ? top[0] : 'RegBuddy';
  // Sanitize for filename
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

// ── Remediation Script Generator ──────────────────────────────────────────────

export function generateRemediationScript(
  changes: RegistryChange[],
  profileName?: string,
  reversal = false,
): string {
  const now = new Date().toISOString();
  const profile = profileName || 'RegBuddy';
  const safeProfile = profile.replace(/[^\w.-]/g, '_') || 'RegBuddy';

  const addKeys   = changes.filter((c) => c.type === 'add-key');
  const setValues = changes.filter((c) => c.type === 'add-value' || c.type === 'modify-value');
  const delValues = changes.filter((c) => c.type === 'delete-value');
  const renKeys   = changes.filter((c) => c.type === 'rename-key');
  const renValues = changes.filter((c) => c.type === 'rename-value');
  const delKeys   = [...changes.filter((c) => c.type === 'delete-key')]
    .sort((a, b) => b.path.split('\\').length - a.path.split('\\').length);

  const L: string[] = [];
  const line  = (s = '') => L.push(s);
  const blank = () => L.push('');

  line(`<#`);
  line(`  RegBuddy ${reversal ? 'Restore' : 'Remediation'} Script`);
  line(`  Generated: ${now}`);
  line(`  Profile: ${profile}`);
  line(`  Changes: ${changes.length}`);
  if (reversal) line(`  Note: restores the affected keys to the uploaded backup snapshot and removes what was added.`);
  line(`  Backup: every affected key is exported (BEFORE any change) to %ProgramData%\\RegBuddy\\${safeProfile}-<timestamp>,`);
  line(`          or %TEMP% if that isn't writable. The exact path is printed at runtime. Roll back with  reg import <file>.`);
  line(`#>`);
  blank();
  line(`#Requires -Version 5.1`);
  line(`$ErrorActionPreference = 'Stop'`);
  blank();

  // --- Snapshot the live state of every touched key before writing anything.
  // This is the reliable rollback: it captures the device's real prior state,
  // including data RegBuddy never modelled. Keys that don't exist yet simply
  // produce no backup (reg export is best-effort here).
  const backupKeys = topLevelKeyPaths(changes.map((c) => c.path));
  if (backupKeys.length > 0) {
    line(`# --- Backup affected keys (rollback safety net) ---`);
    line(`$ts = Get-Date -Format 'yyyyMMdd-HHmmss'`);
    line(`# Prefer ProgramData (machine-wide, admin-retrievable). A standard-user run`);
    line(`# may be denied there if the folder is SYSTEM-owned — fall back to TEMP.`);
    line(`$backupDir = Join-Path $env:ProgramData "RegBuddy\\${safeProfile}-$ts"`);
    line(`try {`);
    line(`    New-Item -Path $backupDir -ItemType Directory -Force -ErrorAction Stop | Out-Null`);
    line(`} catch {`);
    line(`    $backupDir = Join-Path $env:TEMP "RegBuddy\\${safeProfile}-$ts"`);
    line(`    New-Item -Path $backupDir -ItemType Directory -Force | Out-Null`);
    line(`}`);
    backupKeys.forEach((k, i) => {
      line(`reg export "${k}" "$backupDir\\${String(i + 1).padStart(2, '0')}.reg" /y *> $null`);
    });
    line(`Write-Output "Backup saved to $backupDir"`);
    blank();
  }

  // Keys that must exist before setting values. New-Item -Force is idempotent
  // and creates parents, so one line per deepest key covers everything.
  const keysToCreate = minimalKeyPaths([
    ...addKeys.map((c) => c.path),
    ...setValues.map((c) => c.path),
  ]);

  if (keysToCreate.length > 0) {
    line(`# --- Create Keys ---`);
    for (const path of keysToCreate) {
      line(`New-Item -Path '${q(toPsPath(path))}' -Force | Out-Null`);
    }
    blank();
  }

  if (setValues.length > 0) {
    line(`# --- Set Values ---`);
    for (const c of setValues) {
      const psPath = toPsPath(c.path);
      const name   = c.valueName ?? '';
      const type   = c.valueType ?? 'REG_SZ';
      const data   = c.newData ?? '';
      if (name === '') {
        line(`Set-Item -LiteralPath '${q(psPath)}' -Value ${psData(type, data)} -Force`);
      } else {
        line(`Set-ItemProperty -Path '${q(psPath)}' -Name '${q(name)}' -Value ${psData(type, data)} -Type ${psType(type)} -Force`);
      }
    }
    blank();
  }

  if (delValues.length > 0) {
    line(`# --- Delete Values ---`);
    for (const c of delValues) {
      const name = c.valueName ?? '';
      line(`Remove-ItemProperty -Path '${q(toPsPath(c.path))}' -Name '${q(name || '(Default)')}' -ErrorAction SilentlyContinue`);
    }
    blank();
  }

  if (delKeys.length > 0) {
    line(`# --- Delete Keys ---`);
    for (const c of delKeys) {
      line(`Remove-Item -Path '${q(toPsPath(c.path))}' -Recurse -Force -ErrorAction SilentlyContinue`);
    }
    blank();
  }

  if (renKeys.length > 0) {
    line(`# --- Rename Keys ---`);
    for (const c of renKeys) {
      line(`Rename-Item -Path '${q(toPsPath(c.path))}' -NewName '${q(c.newName ?? '')}' -Force`);
    }
    blank();
  }

  if (renValues.length > 0) {
    line(`# --- Rename Values ---`);
    for (const c of renValues) {
      line(`Rename-ItemProperty -Path '${q(toPsPath(c.path))}' -Name '${q(c.valueName ?? '')}' -NewName '${q(c.newName ?? '')}' -Force`);
    }
    blank();
  }

  line(`exit 0`);

  return L.join('\n');
}

// ── Detection Script Generator ────────────────────────────────────────────────

export function generateDetectionScript(
  changes: RegistryChange[],
  profileName?: string,
  reversal = false,
): string {
  const now = new Date().toISOString();
  const profile = profileName || 'RegBuddy';

  const L: string[] = [];
  const line  = (s = '') => L.push(s);
  const blank = () => L.push('');

  line(`<#`);
  line(`  RegBuddy ${reversal ? 'Restore ' : ''}Detection Script`);
  line(`  Generated: ${now}`);
  line(`  Profile: ${profile}`);
  line(`  Verifies the ${reversal ? 'restore is' : 'changes are'} applied — exit 0 = compliant, exit 1 = run ${reversal ? 'restore' : 'remediation'}`);
  line(`#>`);
  blank();
  line(`#Requires -Version 5.1`);
  line(`$ErrorActionPreference = 'Stop'`);
  blank();
  line(`$allGood = $true`);
  blank();

  const addKeys   = changes.filter((c) => c.type === 'add-key');
  const setValues = changes.filter((c) => c.type === 'add-value' || c.type === 'modify-value');
  const delValues = changes.filter((c) => c.type === 'delete-value');
  const delKeys   = changes.filter((c) => c.type === 'delete-key');
  const renKeys   = changes.filter((c) => c.type === 'rename-key');
  const renValues = changes.filter((c) => c.type === 'rename-value');

  // Check that added keys exist (deepest key implies its parents)
  for (const path of minimalKeyPaths(addKeys.map((c) => c.path))) {
    line(`if (-not (Test-Path '${q(toPsPath(path))}')) { $allGood = $false }`);
  }
  if (addKeys.length > 0) blank();

  // Check that values have the correct data
  for (const c of setValues) {
    const psPath = toPsPath(c.path);
    const name   = c.valueName ?? '';
    const type   = c.valueType ?? 'REG_SZ';
    const data   = c.newData ?? '';

    line(`try {`);

    if (name === '') {
      // Default value check
      line(`    $val = (Get-Item -LiteralPath '${q(psPath)}' -ErrorAction Stop).GetValue('')`);
    } else {
      line(`    $val = Get-ItemPropertyValue -Path '${q(psPath)}' -Name '${q(name)}' -ErrorAction Stop`);
    }

    // Comparison depends on type
    switch (type) {
      case 'REG_DWORD':
        line(`    if ($val -ne ${psData(type, data)}) { $allGood = $false }`);
        break;
      case 'REG_QWORD':
        line(`    if ($val -ne ${psData(type, data)}) { $allGood = $false }`);
        break;
      case 'REG_BINARY': {
        const expected = psData(type, data);
        line(`    $expected = ${expected}`);
        line(`    if ($null -eq $val -or (Compare-Object $val $expected)) { $allGood = $false }`);
        break;
      }
      case 'REG_MULTI_SZ': {
        const expected = psData(type, data);
        line(`    $expected = ${expected}`);
        line(`    if ($null -eq $val -or (Compare-Object $val $expected)) { $allGood = $false }`);
        break;
      }
      default:
        // String comparison for REG_SZ, REG_EXPAND_SZ
        line(`    if ($val -ne ${psData(type, data)}) { $allGood = $false }`);
        break;
    }

    line(`} catch { $allGood = $false }`);
    blank();
  }

  // Check that deleted values no longer exist
  for (const c of delValues) {
    const psPath = toPsPath(c.path);
    const name   = c.valueName ?? '';
    line(`$exists = Get-ItemProperty -Path '${q(psPath)}' -Name '${q(name || '(Default)')}' -ErrorAction SilentlyContinue`);
    line(`if ($null -ne $exists) { $allGood = $false }`);
    blank();
  }

  // Check that deleted keys no longer exist
  for (const c of delKeys) {
    line(`if (Test-Path '${q(toPsPath(c.path))}') { $allGood = $false }`);
  }
  if (delKeys.length > 0) blank();

  // Check that renamed keys exist with new name
  for (const c of renKeys) {
    const parentPath = c.path.substring(0, c.path.lastIndexOf('\\'));
    const newPath = parentPath ? parentPath + '\\' + (c.newName ?? '') : (c.newName ?? '');
    line(`if (Test-Path '${q(toPsPath(c.path))}') { $allGood = $false }`);
    line(`if (-not (Test-Path '${q(toPsPath(newPath))}')) { $allGood = $false }`);
    blank();
  }

  // Check that renamed values exist with new name
  for (const c of renValues) {
    const psPath = toPsPath(c.path);
    const oldName = c.valueName ?? '';
    const newName = c.newName ?? '';
    line(`$old = Get-ItemProperty -Path '${q(psPath)}' -Name '${q(oldName)}' -ErrorAction SilentlyContinue`);
    line(`if ($null -ne $old) { $allGood = $false }`);
    line(`try {`);
    line(`    $null = Get-ItemPropertyValue -Path '${q(psPath)}' -Name '${q(newName)}' -ErrorAction Stop`);
    line(`} catch { $allGood = $false }`);
    blank();
  }

  line(`if ($allGood) {`);
  line(`    Write-Output "Compliant"`);
  line(`    exit 0`);
  line(`} else {`);
  line(`    Write-Output "Not compliant"`);
  line(`    exit 1`);
  line(`}`);

  return L.join('\n');
}
