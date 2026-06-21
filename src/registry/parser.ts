/**
 * .reg file parser
 *
 * Handles the Windows "REGEDIT4" / "Windows Registry Editor Version 5.00" format:
 *  - Key paths in brackets: [HKEY_LOCAL_MACHINE\SOFTWARE\Foo]
 *  - String values: "Name"="Data"
 *  - Default value: @="Data"
 *  - DWORD: "Name"=dword:00000001
 *  - QWORD: "Name"=hex(b):01,00,00,00,00,00,00,00
 *  - Binary: "Name"=hex:01,02,03
 *  - Expand SZ: "Name"=hex(2):...
 *  - Multi SZ: "Name"=hex(7):...
 *  - Hex continuations with trailing backslash
 *  - Deletion markers (- prefix on key, value deletions)
 */

import { RegistryKey, RegistryValue, RegistryValueType, ROOT_HIVES } from './types';

// ── File reading ──

/**
 * Read a .reg file with the correct text encoding. regedit exports "Version 5.00"
 * files as UTF-16 LE with a BOM; older "REGEDIT4" files are ANSI/UTF-8. Blob.text()
 * always assumes UTF-8, which turns a UTF-16 export into garbage (and downstream
 * throws). Sniff the BOM and decode accordingly.
 */
export async function readRegFile(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xfe) return decode(buf, 'utf-16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return decode(buf, 'utf-16be');
  // No BOM: PowerShell's `Unicode` encoding doesn't always emit one. Sniff for
  // UTF-16 by its null bytes (UTF-8 text never contains 0x00) and infer endianness
  // from which half of each code unit is zero in the ASCII-heavy header.
  const n = Math.min(buf.length, 256);
  let evenNul = 0, oddNul = 0;
  for (let i = 0; i + 1 < n; i += 2) {
    if (buf[i] === 0) evenNul++;
    if (buf[i + 1] === 0) oddNul++;
  }
  if (oddNul > n / 8) return decode(buf, 'utf-16le');
  if (evenNul > n / 8) return decode(buf, 'utf-16be');
  return decode(buf, 'utf-8');
}

function decode(buf: Uint8Array, label: string): string {
  // ignoreBOM:false strips the BOM for us.
  return new TextDecoder(label, { ignoreBOM: false }).decode(buf);
}

// ── Helpers ──

function unescapeRegString(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function hexToString(hexCsv: string): string {
  const bytes = hexCsv
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => parseInt(b, 16));
  // UTF-16LE decoding (used by hex(2) and hex(7)). Pad to an even byte count —
  // Uint16Array throws on an odd-length buffer, and that throw would escape render.
  const even = bytes.length % 2 === 0 ? bytes : [...bytes, 0];
  const u16 = new Uint16Array(new Uint8Array(even).buffer);
  return Array.from(u16)
    .map((c) => (c === 0 ? '' : String.fromCharCode(c)))
    .join('');
}

function parseHexValue(
  typeCode: string,
  hexCsv: string,
): { type: RegistryValueType; data: string } {
  switch (typeCode) {
    case '': // hex: → REG_BINARY
      return { type: 'REG_BINARY', data: hexCsv.replace(/\s/g, '') };
    case '(2)': // hex(2): → REG_EXPAND_SZ
      return { type: 'REG_EXPAND_SZ', data: hexToString(hexCsv) };
    case '(7)': // hex(7): → REG_MULTI_SZ
      return { type: 'REG_MULTI_SZ', data: hexToString(hexCsv) };
    case '(b)': // hex(b): → REG_QWORD
      return { type: 'REG_QWORD', data: hexCsv.replace(/\s/g, '') };
    case '(0)':
      return { type: 'REG_NONE', data: hexCsv.replace(/\s/g, '') };
    default:
      return { type: 'REG_BINARY', data: hexCsv.replace(/\s/g, '') };
  }
}

// ── Tree insertion ──

function ensureKeyPath(root: Map<string, RegistryKey>, fullPath: string): RegistryKey {
  const existing = root.get(fullPath);
  if (existing) return existing;

  const parts = fullPath.split('\\');
  const name = parts[parts.length - 1];
  const node: RegistryKey = { path: fullPath, name, children: [], values: [] };
  root.set(fullPath, node);

  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join('\\');
    const parent = ensureKeyPath(root, parentPath);
    if (!parent.children.find((c) => c.path === fullPath)) {
      parent.children.push(node);
    }
  }

  return node;
}

// ── Main parser ──

export function parseRegFile(content: string): RegistryKey {
  const lines = content.split(/\r?\n/);
  const allKeys = new Map<string, RegistryKey>();

  // Create root "Computer" node
  const computer: RegistryKey = {
    path: 'Computer',
    name: 'Computer',
    children: [],
    values: [],
  };
  allKeys.set('Computer', computer);

  // Pre-create the five root hives
  for (const hive of ROOT_HIVES) {
    const node: RegistryKey = { path: hive, name: hive, children: [], values: [] };
    allKeys.set(hive, node);
    computer.children.push(node);
  }

  let currentKey: RegistryKey | null = null;
  let continuationName: string | null = null;
  let continuationHex = '';
  let continuationTypeCode = '';

  function flushContinuation() {
    if (continuationName !== null && currentKey) {
      const { type, data } = parseHexValue(continuationTypeCode, continuationHex);
      currentKey.values.push({ name: continuationName, type, data });
    }
    continuationName = null;
    continuationHex = '';
    continuationTypeCode = '';
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip header + blank lines
    if (!line || line.startsWith('Windows Registry Editor') || line.startsWith('REGEDIT')) {
      if (!line) flushContinuation();
      continue;
    }

    // Hex continuation line
    if (continuationName !== null && /^\s/.test(rawLine)) {
      const trimmed = line.replace(/\\$/, '');
      continuationHex += trimmed;
      if (!line.endsWith('\\')) {
        flushContinuation();
      }
      continue;
    } else if (continuationName !== null) {
      flushContinuation();
    }

    // Key path: [HKEY_...]
    const keyMatch = line.match(/^\[(-?)(.*)\]$/);
    if (keyMatch) {
      flushContinuation();
      const isDelete = keyMatch[1] === '-';
      const keyPath = keyMatch[2];
      if (!isDelete) {
        currentKey = ensureKeyPath(allKeys, keyPath);
      } else {
        currentKey = null; // skip deleted keys for now
      }
      continue;
    }

    if (!currentKey) continue;

    // Value line: "Name"=... or @=...
    let valueName: string;
    let valueRhs: string;

    if (line.startsWith('@=')) {
      valueName = '';
      valueRhs = line.slice(2);
    } else {
      const valMatch = line.match(/^"((?:[^"\\]|\\.)*)"\s*=\s*(.*)/);
      if (!valMatch) continue;
      valueName = unescapeRegString(valMatch[1]);
      valueRhs = valMatch[2];
    }

    // Determine value type from RHS
    if (valueRhs.startsWith('"')) {
      // REG_SZ
      const str = valueRhs.slice(1, valueRhs.lastIndexOf('"'));
      currentKey.values.push({
        name: valueName,
        type: 'REG_SZ',
        data: unescapeRegString(str),
      });
    } else if (valueRhs.startsWith('dword:')) {
      currentKey.values.push({
        name: valueName,
        type: 'REG_DWORD',
        data: valueRhs.slice(6),
      });
    } else if (valueRhs.startsWith('hex')) {
      const hexMatch = valueRhs.match(/^hex(\([^)]*\))?:(.*)/);
      if (hexMatch) {
        const typeCode = hexMatch[1] || '';
        const hexData = hexMatch[2].replace(/\\$/, '');
        if (valueRhs.endsWith('\\')) {
          // start continuation
          continuationName = valueName;
          continuationTypeCode = typeCode;
          continuationHex = hexData;
        } else {
          const { type, data } = parseHexValue(typeCode, hexData);
          currentKey.values.push({ name: valueName, type, data });
        }
      }
    }
  }

  flushContinuation();

  // Sort children alphabetically at every level
  function sortTree(node: RegistryKey) {
    node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    for (const child of node.children) sortTree(child);
  }
  sortTree(computer);

  return computer;
}
