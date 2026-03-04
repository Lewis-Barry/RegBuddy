import { RegistryKey, RegistryChange, RegistryValueType } from './types';

// ── Diff entry types ──────────────────────────────────────────────────────────

export type RegDiffType =
  | 'key-added'     // exists in primary, missing from secondary   → secondary must add it
  | 'key-removed'   // exists in secondary, missing from primary   → secondary must delete it
  | 'value-added'   // exists in primary, missing from secondary   → secondary must add it
  | 'value-removed' // exists in secondary, missing from primary   → secondary must delete it
  | 'value-modified'; // exists in both, data/type differs         → secondary must change to primary

export interface RegDiffEntry {
  type: RegDiffType;
  /** Registry key path */
  path: string;
  /** Set for value-* types */
  valueName?: string;
  /** Primary (desired/target) value info */
  primaryType?: RegistryValueType;
  primaryData?: string;
  /** Secondary (current/source) value info */
  secondaryType?: RegistryValueType;
  secondaryData?: string;
}

export interface RegDiffStats {
  keysAdded: number;
  keysRemoved: number;
  valuesAdded: number;
  valuesRemoved: number;
  valuesModified: number;
  total: number;
}

export interface RegDiffResult {
  /** Structured diff entries, for display */
  entries: RegDiffEntry[];
  /**
   * RegistryChange[] that, when applied to the secondary tree, produces the
   * primary tree — i.e. the "restore to primary" script payload.
   */
  restoreChanges: RegistryChange[];
  stats: RegDiffStats;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _cmpId = 1;
function cmpId(): string {
  return `cmp-${_cmpId++}`;
}

function findKey(root: RegistryKey, path: string): RegistryKey | null {
  if (root.path === path) return root;
  for (const child of root.children) {
    const found = findKey(child, path);
    if (found) return found;
  }
  return null;
}

/** Collect every non-Computer / non-hive-root key path in a tree */
function allKeyPaths(node: RegistryKey, out: Set<string>) {
  if (node.path !== 'Computer') {
    out.add(node.path);
  }
  for (const child of node.children) {
    allKeyPaths(child, out);
  }
}

// ── Main diff function ────────────────────────────────────────────────────────

/**
 * Diff two registry trees.
 *
 * primary   = desired / target state (the reg file the user calls "primary")
 * secondary = current / source state (the reg file the user wants to restore)
 *
 * Returns the list of differences AND the RegistryChange[] needed to transform
 * secondary → primary (the "restore" script payload).
 *
 * NOTE: Only keys/values actually present in the loaded .reg files are
 * compared.  Keys present in neither file are ignored.
 */
export function diffRegTrees(primary: RegistryKey, secondary: RegistryKey): RegDiffResult {
  const entries: RegDiffEntry[] = [];
  const restoreChanges: RegistryChange[] = [];
  const now = Date.now();

  // Collect all key paths from both trees (excluding Computer root)
  const primaryPaths = new Set<string>();
  const secondaryPaths = new Set<string>();
  allKeyPaths(primary, primaryPaths);
  allKeyPaths(secondary, secondaryPaths);

  // Keys only in primary → secondary needs to add them
  for (const path of primaryPaths) {
    if (!secondaryPaths.has(path)) {
      entries.push({ type: 'key-added', path });
      restoreChanges.push({ id: cmpId(), type: 'add-key', path, timestamp: now });
      // Restore all values from primary
      const pk = findKey(primary, path);
      if (pk) {
        for (const val of pk.values) {
          entries.push({
            type: 'value-added',
            path,
            valueName: val.name,
            primaryType: val.type,
            primaryData: val.data,
          });
          restoreChanges.push({
            id: cmpId(),
            type: 'add-value',
            path,
            valueName: val.name,
            valueType: val.type,
            newData: val.data,
            timestamp: now,
          });
        }
      }
    }
  }

  // Keys only in secondary — shown in diff for info, but NEVER deleted by the restore script
  for (const path of secondaryPaths) {
    if (!primaryPaths.has(path)) {
      entries.push({ type: 'key-removed', path });
      // Intentional: no delete-key added to restoreChanges — removing keys could break critical systems.
    }
  }

  // Keys present in both — diff their values
  for (const path of primaryPaths) {
    if (!secondaryPaths.has(path)) continue; // already handled above

    const pk = findKey(primary, path)!;
    const sk = findKey(secondary, path)!;

    const primaryValMap = new Map(pk.values.map((v) => [v.name, v]));
    const secondaryValMap = new Map(sk.values.map((v) => [v.name, v]));

    // Values only in primary → secondary needs to add them
    for (const [name, pv] of primaryValMap) {
      if (!secondaryValMap.has(name)) {
        entries.push({
          type: 'value-added',
          path,
          valueName: name,
          primaryType: pv.type,
          primaryData: pv.data,
        });
        restoreChanges.push({
          id: cmpId(),
          type: 'add-value',
          path,
          valueName: name,
          valueType: pv.type,
          newData: pv.data,
          timestamp: now,
        });
      }
    }

    // Values only in secondary → secondary needs to delete them
    for (const [name, sv] of secondaryValMap) {
      if (!primaryValMap.has(name)) {
        entries.push({
          type: 'value-removed',
          path,
          valueName: name,
          secondaryType: sv.type,
          secondaryData: sv.data,
        });
        restoreChanges.push({
          id: cmpId(),
          type: 'delete-value',
          path,
          valueName: name,
          timestamp: now,
        });
      }
    }

    // Values in both — check for data or type mismatch
    for (const [name, pv] of primaryValMap) {
      const sv = secondaryValMap.get(name);
      if (!sv) continue; // handled above
      if (pv.data !== sv.data || pv.type !== sv.type) {
        entries.push({
          type: 'value-modified',
          path,
          valueName: name,
          primaryType: pv.type,
          primaryData: pv.data,
          secondaryType: sv.type,
          secondaryData: sv.data,
        });
        restoreChanges.push({
          id: cmpId(),
          type: 'modify-value',
          path,
          valueName: name,
          valueType: pv.type,
          newData: pv.data,
          originalData: sv.data,
          timestamp: now,
        });
      }
    }
  }

  // Sort entries: by path → by type → by valueName
  const typeOrder: Record<RegDiffType, number> = {
    'key-added': 0,
    'key-removed': 1,
    'value-added': 2,
    'value-removed': 3,
    'value-modified': 4,
  };
  entries.sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path, undefined, { sensitivity: 'base' });
    if (pathCmp !== 0) return pathCmp;
    const typeCmp = typeOrder[a.type] - typeOrder[b.type];
    if (typeCmp !== 0) return typeCmp;
    return (a.valueName ?? '').localeCompare(b.valueName ?? '', undefined, { sensitivity: 'base' });
  });

  const stats: RegDiffStats = {
    keysAdded:      entries.filter((e) => e.type === 'key-added').length,
    keysRemoved:    entries.filter((e) => e.type === 'key-removed').length,
    valuesAdded:    entries.filter((e) => e.type === 'value-added').length,
    valuesRemoved:  entries.filter((e) => e.type === 'value-removed').length,
    valuesModified: entries.filter((e) => e.type === 'value-modified').length,
    total: entries.length,
  };

  return { entries, restoreChanges, stats };
}
