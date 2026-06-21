import { RegistryChange, RegistryKey, ROOT_HIVES, findKey } from './types';

const revId = () => crypto.randomUUID();
const isHiveRoot = (path: string) => (ROOT_HIVES as readonly string[]).includes(path);

/** Compute the post-rename path of a rename-key change. */
function renamedPath(c: RegistryChange): string {
  const parent = c.path.substring(0, c.path.lastIndexOf('\\'));
  return parent ? `${parent}\\${c.newName ?? ''}` : (c.newName ?? '');
}

/**
 * Build a restore change-set from an uploaded backup — the .reg snapshot the
 * remediation script captured ON THE DEVICE before applying changes.
 *
 * The backup is the device's REAL prior state, so restoring to it is exact,
 * not a baseline guess. Two parts:
 *
 *   1. Re-apply everything the backup contains. This restores modified and
 *      deleted values, and recreates any key that existed before.
 *   2. Delete anything the change-set ADDED that the backup does not contain
 *      (added keys/values, plus rename targets). Deleting keys is safe here
 *      because the backup proves they weren't present before the change.
 *
 * `changes` is the applied change-set still loaded in the editor; `backup` is
 * the parsed uploaded snapshot.
 */
export function computeBackupRestore(
  changes: RegistryChange[],
  backup: RegistryKey,
): RegistryChange[] {
  const restore: RegistryChange[] = [];

  // 1. Re-apply the backup's contents (its true prior state).
  (function walk(node: RegistryKey) {
    if (node.path !== 'Computer' && !isHiveRoot(node.path)) {
      restore.push({ id: revId(), type: 'add-key', path: node.path, timestamp: Date.now() });
    }
    for (const v of node.values) {
      restore.push({
        id: revId(),
        type: 'add-value',
        path: node.path,
        valueName: v.name,
        valueType: v.type,
        newData: v.data,
        timestamp: Date.now(),
      });
    }
    node.children.forEach(walk);
  })(backup);

  // 2. Delete additions the backup doesn't contain.
  const keysToDelete = new Set<string>();
  for (const c of changes) {
    if (c.type === 'add-key' && !findKey(backup, c.path)) keysToDelete.add(c.path);
    if (c.type === 'rename-key') {
      const np = renamedPath(c);
      if (np && !findKey(backup, np)) keysToDelete.add(np);
    }
  }
  const underDeletedKey = (p: string) =>
    [...keysToDelete].some((k) => p === k || p.startsWith(k + '\\'));

  for (const path of keysToDelete) {
    restore.push({ id: revId(), type: 'delete-key', path, timestamp: Date.now() });
  }

  for (const c of changes) {
    if (underDeletedKey(c.path)) continue; // whole key is being removed already
    const backupKey = findKey(backup, c.path);
    if (c.type === 'add-value' || c.type === 'modify-value') {
      const present = backupKey?.values.some((v) => v.name === (c.valueName ?? ''));
      if (!present) {
        restore.push({ id: revId(), type: 'delete-value', path: c.path, valueName: c.valueName, timestamp: Date.now() });
      }
    } else if (c.type === 'rename-value') {
      const present = backupKey?.values.some((v) => v.name === c.newName);
      if (!present) {
        restore.push({ id: revId(), type: 'delete-value', path: c.path, valueName: c.newName, timestamp: Date.now() });
      }
    }
  }

  return restore;
}
