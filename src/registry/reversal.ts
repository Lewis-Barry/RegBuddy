import { RegistryChange, RegistryKey } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _revId = 1;
function revId(): string {
  return `rev-${_revId++}`;
}

function findKey(root: RegistryKey, path: string): RegistryKey | null {
  if (root.path === path) return root;
  for (const child of root.children) {
    const found = findKey(child, path);
    if (found) return found;
  }
  return null;
}

// ── Computation ───────────────────────────────────────────────────────────────

export interface ReversalResult {
  /** Change set to feed into the script generators */
  reversed: RegistryChange[];
  /**
   * Human-readable warnings for changes that could not be fully reversed
   * because the original value is unknown (no originalData and not in baseline).
   */
  warnings: string[];
}

/**
 * Takes the current set of changes and the baseline registry tree, and
 * computes the "reversal" set of changes — i.e. what you'd need to apply
 * to undo every change recorded in `changes`.
 *
 * Rules:
 *   add-key      → SKIPPED — keys are never deleted in reversal mode (safety constraint)
 *   delete-key   → add-key + restore values from baseline
 *   add-value    → delete-value
 *   delete-value → add-value with original data from baseline (warn if unknown)
 *   modify-value → modify-value with swapped data (restore original; warn if unknown)
 *   rename-key   → rename-key back to original name
 *   rename-value → rename-value back to original name
 *
 * NOTE: Keys are intentionally never deleted during reversal to avoid breaking
 * critical system or application registry structures.
 */
export function computeReversalChanges(
  changes: RegistryChange[],
  baseline: RegistryKey,
): ReversalResult {
  const reversed: RegistryChange[] = [];
  const warnings: string[] = [];
  const now = Date.now();

  for (const c of changes) {
    switch (c.type) {
      // ── add-key → SKIP silently (keys are never deleted in reversal mode) ──
      case 'add-key': {
        // Intentional no-op: reversal never deletes keys (only values).
        break;
      }

      // ── delete-key → re-add the key (and all its baseline values) ────────
      case 'delete-key': {
        reversed.push({
          id: revId(),
          type: 'add-key',
          path: c.path,
          timestamp: now,
        });
        // Restore all values that existed in baseline
        const baselineKey = findKey(baseline, c.path);
        if (baselineKey) {
          for (const val of baselineKey.values) {
            reversed.push({
              id: revId(),
              type: 'add-value',
              path: c.path,
              valueName: val.name,
              valueType: val.type,
              newData: val.data,
              timestamp: now,
            });
          }
        } else {
          warnings.push(
            `Key "${c.path}" was not found in baseline — values cannot be restored (key structure only).`,
          );
        }
        break;
      }

      // ── add-value → delete the value that was added ──────────────────────
      case 'add-value': {
        reversed.push({
          id: revId(),
          type: 'delete-value',
          path: c.path,
          valueName: c.valueName,
          timestamp: now,
        });
        break;
      }

      // ── delete-value → restore from baseline (or warn) ───────────────────
      case 'delete-value': {
        const baselineKey = findKey(baseline, c.path);
        const baselineVal = baselineKey?.values.find((v) => v.name === (c.valueName ?? ''));
        if (baselineVal) {
          reversed.push({
            id: revId(),
            type: 'add-value',
            path: c.path,
            valueName: c.valueName,
            valueType: baselineVal.type,
            newData: baselineVal.data,
            timestamp: now,
          });
        } else {
          warnings.push(
            `Value "${c.valueName || '(Default)'}" at "${c.path}" was deleted but its original data is not in the loaded baseline — this change was skipped.`,
          );
        }
        break;
      }

      // ── modify-value → restore original data ─────────────────────────────
      case 'modify-value': {
        // Prefer the originalData recorded in the change; fall back to baseline
        const baselineKey = findKey(baseline, c.path);
        const baselineVal = baselineKey?.values.find((v) => v.name === (c.valueName ?? ''));
        const originalData = c.originalData ?? baselineVal?.data;
        const originalType = baselineVal?.type ?? c.valueType;

        if (originalData !== undefined && originalType !== undefined) {
          reversed.push({
            id: revId(),
            type: 'modify-value',
            path: c.path,
            valueName: c.valueName,
            valueType: originalType,
            newData: originalData,
            originalData: c.newData,
            timestamp: now,
          });
        } else {
          warnings.push(
            `Value "${c.valueName || '(Default)'}" at "${c.path}" was modified but the original data is unknown — this change was skipped.`,
          );
        }
        break;
      }

      // ── rename-key → rename back to original name ─────────────────────────
      case 'rename-key': {
        if (c.newName) {
          const parentPath = c.path.substring(0, c.path.lastIndexOf('\\'));
          const renamedPath = parentPath ? `${parentPath}\\${c.newName}` : c.newName;
          const originalLeaf = c.path.split('\\').pop() ?? c.path;
          reversed.push({
            id: revId(),
            type: 'rename-key',
            path: renamedPath,
            newName: originalLeaf,
            timestamp: now,
          });
        }
        break;
      }

      // ── rename-value → rename back to original name ───────────────────────
      case 'rename-value': {
        if (c.valueName !== undefined && c.newName !== undefined) {
          reversed.push({
            id: revId(),
            type: 'rename-value',
            path: c.path,
            valueName: c.newName,      // current name (was renamed to this)
            newName: c.valueName,       // original name
            timestamp: now,
          });
        }
        break;
      }
    }
  }

  return { reversed, warnings };
}
