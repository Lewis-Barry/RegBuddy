import { RegistryChange, RegistryValueType } from './types';

// ── Hive path mapping ────────────────────────────────────────────────────────

const HIVE_MAP: [string, string][] = [
  ['HKEY_LOCAL_MACHINE', 'HKLM:'],
  ['HKEY_CURRENT_USER',  'HKCU:'],
  ['HKEY_CLASSES_ROOT',  'HKCR:'],
  ['HKEY_USERS',         'HKU:'],
  ['HKEY_CURRENT_CONFIG','HKCC:'],
];

function toPsPath(regPath: string): string {
  for (const [hive, alias] of HIVE_MAP) {
    if (regPath === hive) return alias;
    if (regPath.startsWith(hive + '\\')) {
      return alias + '\\' + regPath.slice(hive.length + 1);
    }
  }
  return regPath;
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
      return `[uint32]0x${(data || '0').padStart(8, '0')}`;

    case 'REG_QWORD':
      return `[uint64]0x${(data || '0').padStart(16, '0')}`;

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

export function generateRemediationScript(changes: RegistryChange[], profileName?: string): string {
  const now = new Date().toISOString();
  const profile = profileName || 'RegBuddy';

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
  line(`  RegBuddy Remediation Script`);
  line(`  Generated: ${now}`);
  line(`  Profile: ${profile}`);
  line(`  Changes: ${changes.length}`);
  line(`#>`);
  blank();
  line(`#Requires -Version 5.1`);
  line(`Set-StrictMode -Version Latest`);
  line(`$ErrorActionPreference = 'Stop'`);
  blank();

  if (addKeys.length > 0) {
    line(`# --- Add/Modify Keys ---`);
    for (const c of addKeys) {
      const psPath = toPsPath(c.path);
      line(`# New key: ${c.path}`);
      line(`if (-not (Test-Path '${q(psPath)}')) {`);
      line(`    New-Item -Path '${q(psPath)}' -Force | Out-Null`);
      line(`}`);
      blank();
    }
  }

  if (setValues.length > 0) {
    line(`# --- Set Values ---`);
    for (const c of setValues) {
      const psPath = toPsPath(c.path);
      const name   = c.valueName ?? '';
      const type   = c.valueType ?? 'REG_SZ';
      const data   = c.newData ?? '';
      line(`# Set value: ${c.path} -> ${name || '(Default)'} (${type}) = ${data.substring(0, 60)}`);
      // Ensure parent key exists
      line(`if (-not (Test-Path '${q(psPath)}')) {`);
      line(`    New-Item -Path '${q(psPath)}' -Force | Out-Null`);
      line(`}`);
      if (name === '') {
        line(`Set-Item -LiteralPath '${q(psPath)}' -Value ${psData(type, data)} -Force`);
      } else {
        line(`Set-ItemProperty -Path '${q(psPath)}' -Name '${q(name)}' -Value ${psData(type, data)} -Type ${psType(type)} -Force`);
      }
      blank();
    }
  }

  if (delValues.length > 0) {
    line(`# --- Delete Values ---`);
    for (const c of delValues) {
      const psPath = toPsPath(c.path);
      const name   = c.valueName ?? '';
      line(`# Delete value: ${c.path} -> ${name || '(Default)'}`);
      line(`Remove-ItemProperty -Path '${q(psPath)}' -Name '${q(name || '(Default)')}' -ErrorAction SilentlyContinue`);
      blank();
    }
  }

  if (delKeys.length > 0) {
    line(`# --- Delete Keys ---`);
    for (const c of delKeys) {
      const psPath = toPsPath(c.path);
      line(`# Delete key: ${c.path}`);
      line(`Remove-Item -Path '${q(psPath)}' -Recurse -Force -ErrorAction SilentlyContinue`);
      blank();
    }
  }

  if (renKeys.length > 0) {
    line(`# --- Rename Keys ---`);
    for (const c of renKeys) {
      const psPath = toPsPath(c.path);
      const newName = c.newName ?? '';
      line(`# Rename key: ${c.path} -> ${newName}`);
      line(`Rename-Item -Path '${q(psPath)}' -NewName '${q(newName)}' -Force`);
      blank();
    }
  }

  if (renValues.length > 0) {
    line(`# --- Rename Values ---`);
    for (const c of renValues) {
      const psPath = toPsPath(c.path);
      const oldName = c.valueName ?? '';
      const newName = c.newName ?? '';
      line(`# Rename value: ${c.path} -> ${oldName || '(Default)'} to ${newName}`);
      line(`Rename-ItemProperty -Path '${q(psPath)}' -Name '${q(oldName)}' -NewName '${q(newName)}' -Force`);
      blank();
    }
  }

  line(`exit 0`);

  return L.join('\n');
}

// ── Detection Script Generator ────────────────────────────────────────────────

export function generateDetectionScript(changes: RegistryChange[], profileName?: string): string {
  const now = new Date().toISOString();
  const profile = profileName || 'RegBuddy';

  const L: string[] = [];
  const line  = (s = '') => L.push(s);
  const blank = () => L.push('');

  line(`<#`);
  line(`  RegBuddy Detection Script`);
  line(`  Generated: ${now}`);
  line(`  Profile: ${profile}`);
  line(`  Verifies registry changes are applied — exit 0 = compliant, exit 1 = run remediation`);
  line(`#>`);
  blank();
  line(`#Requires -Version 5.1`);
  line(`Set-StrictMode -Version Latest`);
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

  // Check that added keys exist
  for (const c of addKeys) {
    const psPath = toPsPath(c.path);
    line(`# Check: key ${c.path} should exist`);
    line(`if (-not (Test-Path '${q(psPath)}')) { $allGood = $false }`);
    blank();
  }

  // Check that values have the correct data
  for (const c of setValues) {
    const psPath = toPsPath(c.path);
    const name   = c.valueName ?? '';
    const type   = c.valueType ?? 'REG_SZ';
    const data   = c.newData ?? '';
    const displayName = name || '(Default)';

    line(`# Check: ${c.path}\\${displayName} = ${data.substring(0, 60)} (${type})`);
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
    const displayName = name || '(Default)';

    line(`# Check: ${c.path}\\${displayName} should NOT exist`);
    line(`$exists = Get-ItemProperty -Path '${q(psPath)}' -Name '${q(name || '(Default)')}' -ErrorAction SilentlyContinue`);
    line(`if ($null -ne $exists) { $allGood = $false }`);
    blank();
  }

  // Check that deleted keys no longer exist
  for (const c of delKeys) {
    const psPath = toPsPath(c.path);
    line(`# Check: key ${c.path} should NOT exist`);
    line(`if (Test-Path '${q(psPath)}') { $allGood = $false }`);
    blank();
  }

  // Check that renamed keys exist with new name
  for (const c of renKeys) {
    const parentPath = c.path.substring(0, c.path.lastIndexOf('\\'));
    const newPath = parentPath ? parentPath + '\\' + (c.newName ?? '') : (c.newName ?? '');
    const psNewPath = toPsPath(newPath);
    const psOldPath = toPsPath(c.path);
    line(`# Check: key ${c.path} should be renamed to ${c.newName}`);
    line(`if (Test-Path '${q(psOldPath)}') { $allGood = $false }`);
    line(`if (-not (Test-Path '${q(psNewPath)}')) { $allGood = $false }`);
    blank();
  }

  // Check that renamed values exist with new name
  for (const c of renValues) {
    const psPath = toPsPath(c.path);
    const oldName = c.valueName ?? '';
    const newName = c.newName ?? '';
    line(`# Check: value ${c.path} -> ${oldName || '(Default)'} should be renamed to ${newName}`);
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

// ── Legacy alias (for backward compatibility with ConfirmPage) ────────────────

export function generatePowerShell(changes: RegistryChange[]): string {
  return generateRemediationScript(changes);
}
