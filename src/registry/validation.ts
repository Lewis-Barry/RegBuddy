/**
 * Registry value data validation.
 *
 * Rules derived from the official Microsoft documentation:
 * https://learn.microsoft.com/en-us/windows/win32/sysinfo/registry-value-types
 *
 * ┌─────────────────┬──────────────────────────────────────────────────────────┐
 * │ REG_SZ          │ Null-terminated string. Any text is valid.              │
 * │ REG_EXPAND_SZ   │ String with %ENV_VAR% references. Unpaired % warned.   │
 * │ REG_MULTI_SZ    │ Sequence of strings (one per line). Empty lines are     │
 * │                 │ invalid because a zero-length string terminates the     │
 * │                 │ sequence.                                               │
 * │ REG_DWORD       │ 32-bit unsigned integer (0 – 0xFFFFFFFF).              │
 * │ REG_QWORD       │ 64-bit unsigned integer (0 – 0xFFFFFFFFFFFFFFFF).      │
 * │ REG_BINARY      │ Arbitrary binary data expressed as hex byte pairs.      │
 * │ REG_NONE        │ No defined format — any data accepted.                  │
 * └─────────────────┴──────────────────────────────────────────────────────────┘
 */

import { RegistryValueType } from './types';

// ── Public types ──

export interface ValidationResult {
  /** true when the data can be saved */
  valid: boolean;
  /** Hard error — blocks saving */
  error?: string;
  /** Soft warning — data is technically saveable but likely wrong */
  warning?: string;
}

// ── Helpers ──

const HEX_RE = /^[0-9a-fA-F]*$/;

/** Maximum practical string length (64 KB of UTF-16 chars — the Windows registry
 *  supports up to ~1 MB per value, but very long strings are almost always a mistake). */
const MAX_STRING_LENGTH = 32_767;

/** DWORD max: 0xFFFFFFFF */
const DWORD_MAX = 0xFFFF_FFFF;

/** QWORD max: 0xFFFFFFFFFFFFFFFF (we compare as BigInt) */
const QWORD_MAX = BigInt('0xFFFFFFFFFFFFFFFF');

// ── Per-type validators ──

function validateRegSz(data: string): ValidationResult {
  if (data.length > MAX_STRING_LENGTH) {
    return {
      valid: false,
      error: `String exceeds maximum recommended length (${data.length.toLocaleString()} / ${MAX_STRING_LENGTH.toLocaleString()} chars).`,
    };
  }
  return { valid: true };
}

function validateRegExpandSz(data: string): ValidationResult {
  if (data.length > MAX_STRING_LENGTH) {
    return {
      valid: false,
      error: `String exceeds maximum recommended length (${data.length.toLocaleString()} / ${MAX_STRING_LENGTH.toLocaleString()} chars).`,
    };
  }

  // Check for properly paired % delimiters for environment variable references.
  // Valid patterns: %SYSTEMROOT%, %PATH%, literal text without %
  // A lone % or an odd number of % chars usually indicates a typo.
  const pctCount = (data.match(/%/g) || []).length;
  if (pctCount % 2 !== 0) {
    return {
      valid: true,
      warning: 'Unpaired "%" detected. Environment variable references should use %VAR_NAME% syntax.',
    };
  }

  return { valid: true };
}

function validateRegMultiSz(data: string): ValidationResult {
  if (data.length === 0) {
    // Empty is fine — represents an empty sequence
    return { valid: true };
  }

  const lines = data.split('\n');

  // Per the MS docs: "A REG_MULTI_SZ string ends with a string of length 0.
  // Therefore, it is not possible to include a zero-length string in the sequence."
  const emptyLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' && i < lines.length - 1) {
      // Allow a trailing blank line (common artifact of textarea editing)
      emptyLineIndices.push(i + 1);
    }
  }

  if (emptyLineIndices.length > 0) {
    const plural = emptyLineIndices.length > 1;
    return {
      valid: false,
      error: `Empty string${plural ? 's' : ''} at line${plural ? 's' : ''} ${emptyLineIndices.join(', ')}. A zero-length string terminates a REG_MULTI_SZ sequence and cannot appear in the middle.`,
    };
  }

  // Check total size (each string is null-terminated, plus a final null)
  const totalChars = lines.reduce((sum, l) => sum + l.length + 1, 0) + 1;
  if (totalChars > MAX_STRING_LENGTH) {
    return {
      valid: false,
      error: `Total multi-string data exceeds maximum recommended length (${totalChars.toLocaleString()} / ${MAX_STRING_LENGTH.toLocaleString()} chars).`,
    };
  }

  return { valid: true };
}

function validateRegDword(data: string): ValidationResult {
  const cleaned = data.replace(/^0x/i, '').trim();

  if (cleaned.length === 0) {
    return { valid: false, error: 'Value is required. Enter a hexadecimal number (e.g. 0 – FFFFFFFF).' };
  }

  if (!HEX_RE.test(cleaned)) {
    const badChars = [...new Set(cleaned.replace(/[0-9a-fA-F]/g, '').split(''))];
    return {
      valid: false,
      error: `Invalid hex character${badChars.length > 1 ? 's' : ''}: "${badChars.join('", "')}". Only 0-9 and A-F are allowed.`,
    };
  }

  if (cleaned.length > 8) {
    return {
      valid: false,
      error: `Value exceeds 32 bits (max 8 hex digits / 0xFFFFFFFF). You entered ${cleaned.length} digits.`,
    };
  }

  const num = parseInt(cleaned, 16);
  if (num > DWORD_MAX) {
    return {
      valid: false,
      error: `Value 0x${cleaned.toUpperCase()} exceeds DWORD maximum (0xFFFFFFFF / ${DWORD_MAX.toLocaleString()}).`,
    };
  }

  return { valid: true };
}

function validateRegQword(data: string): ValidationResult {
  const cleaned = data.replace(/^0x/i, '').trim();

  if (cleaned.length === 0) {
    return { valid: false, error: 'Value is required. Enter a hexadecimal number (e.g. 0 – FFFFFFFFFFFFFFFF).' };
  }

  if (!HEX_RE.test(cleaned)) {
    const badChars = [...new Set(cleaned.replace(/[0-9a-fA-F]/g, '').split(''))];
    return {
      valid: false,
      error: `Invalid hex character${badChars.length > 1 ? 's' : ''}: "${badChars.join('", "')}". Only 0-9 and A-F are allowed.`,
    };
  }

  if (cleaned.length > 16) {
    return {
      valid: false,
      error: `Value exceeds 64 bits (max 16 hex digits / 0xFFFFFFFFFFFFFFFF). You entered ${cleaned.length} digits.`,
    };
  }

  try {
    const num = BigInt('0x' + (cleaned || '0'));
    if (num > QWORD_MAX) {
      return {
        valid: false,
        error: `Value exceeds QWORD maximum (0xFFFFFFFFFFFFFFFF).`,
      };
    }
  } catch {
    return { valid: false, error: 'Invalid hexadecimal value.' };
  }

  return { valid: true };
}

function validateRegBinary(data: string): ValidationResult {
  const cleaned = data.replace(/[\s,]/g, '');

  if (cleaned.length === 0) {
    // Zero-length binary is valid
    return { valid: true };
  }

  if (!HEX_RE.test(cleaned)) {
    const badChars = [...new Set(cleaned.replace(/[0-9a-fA-F]/g, '').split(''))];
    return {
      valid: false,
      error: `Invalid hex character${badChars.length > 1 ? 's' : ''}: "${badChars.join('", "')}". Binary data must be entered as hex bytes (0-9, A-F).`,
    };
  }

  if (cleaned.length % 2 !== 0) {
    return {
      valid: true,
      warning: `Odd number of hex digits (${cleaned.length}). Binary data should be entered as complete byte pairs (e.g. "0A FF 3C").`,
    };
  }

  return { valid: true };
}

// ── Main entry point ──

/**
 * Validate registry value data against the rules for the given type.
 *
 * Returns `{ valid: true }` when data is acceptable for saving.
 * Returns `{ valid: false, error }` when data MUST be corrected before saving.
 * May return `{ valid: true, warning }` for data that is technically saveable
 * but looks suspicious.
 */
export function validateRegistryValue(
  type: RegistryValueType,
  data: string,
): ValidationResult {
  switch (type) {
    case 'REG_SZ':
      return validateRegSz(data);
    case 'REG_EXPAND_SZ':
      return validateRegExpandSz(data);
    case 'REG_MULTI_SZ':
      return validateRegMultiSz(data);
    case 'REG_DWORD':
      return validateRegDword(data);
    case 'REG_QWORD':
      return validateRegQword(data);
    case 'REG_BINARY':
      return validateRegBinary(data);
    case 'REG_NONE':
      return { valid: true };
    default:
      return { valid: true };
  }
}

/**
 * Returns a human-readable description of the constraints for a given
 * registry value type. Useful as placeholder/helper text in edit dialogs.
 */
export function getTypeDescription(type: RegistryValueType): string {
  switch (type) {
    case 'REG_SZ':
      return 'A null-terminated string value.';
    case 'REG_EXPAND_SZ':
      return 'A string containing %ENVIRONMENT_VARIABLE% references that are expanded when read.';
    case 'REG_MULTI_SZ':
      return 'A sequence of strings, one per line. Empty lines are not allowed (a zero-length string terminates the sequence).';
    case 'REG_DWORD':
      return 'A 32-bit unsigned integer (0 – FFFFFFFF hex).';
    case 'REG_QWORD':
      return 'A 64-bit unsigned integer (0 – FFFFFFFFFFFFFFFF hex).';
    case 'REG_BINARY':
      return 'Binary data entered as hexadecimal byte pairs (e.g. 0A FF 3C).';
    case 'REG_NONE':
      return 'No defined value type. Any data is accepted.';
    default:
      return '';
  }
}

/**
 * Sanitize / normalize value data for saving, based on type.
 * Called after validation passes to produce the canonical storage format.
 */
export function sanitizeRegistryValue(
  type: RegistryValueType,
  data: string,
): string {
  switch (type) {
    case 'REG_DWORD': {
      const cleaned = data.replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '') || '0';
      return cleaned.padStart(8, '0').slice(-8).toLowerCase();
    }
    case 'REG_QWORD': {
      const cleaned = data.replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '') || '0';
      return cleaned.padStart(16, '0').slice(-16).toLowerCase();
    }
    case 'REG_BINARY': {
      return data.replace(/[\s,]/g, '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    }
    case 'REG_MULTI_SZ': {
      // Trim trailing empty lines (trailing blank line is an editing artifact)
      const lines = data.split('\n');
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }
      return lines.join('\n');
    }
    default:
      return data;
  }
}
