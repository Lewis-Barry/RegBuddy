// ── Registry data types ──

export type RegistryValueType =
  | 'REG_SZ'
  | 'REG_DWORD'
  | 'REG_QWORD'
  | 'REG_BINARY'
  | 'REG_EXPAND_SZ'
  | 'REG_MULTI_SZ'
  | 'REG_NONE';

export interface RegistryValue {
  /** Value name. Empty string "" means the (Default) value. */
  name: string;
  type: RegistryValueType;
  data: string;
}

export interface RegistryKey {
  /** Full path, e.g. "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft" */
  path: string;
  /** Leaf name, e.g. "Microsoft" */
  name: string;
  children: RegistryKey[];
  values: RegistryValue[];
}

// ── Change tracking types ──

export type ChangeType =
  | 'add-key'
  | 'delete-key'
  | 'rename-key'
  | 'add-value'
  | 'modify-value'
  | 'delete-value'
  | 'rename-value';

export interface RegistryChange {
  id: string;
  type: ChangeType;
  /** Full registry path the change applies to */
  path: string;
  valueName?: string;
  valueType?: RegistryValueType;
  newData?: string;
  originalData?: string;
  /** New name for rename-key / rename-value changes */
  newName?: string;
  timestamp: number;
}

export interface ChangeManifest {
  _regbuddy: true;
  version: number;
  generatedAt: string;
  changes: Omit<RegistryChange, 'id' | 'timestamp'>[];
}

/** The five root hives */
export const ROOT_HIVES = [
  'HKEY_CLASSES_ROOT',
  'HKEY_CURRENT_USER',
  'HKEY_LOCAL_MACHINE',
  'HKEY_USERS',
  'HKEY_CURRENT_CONFIG',
] as const;
