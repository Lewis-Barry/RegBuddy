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
 * Driven by the CHANGE-SET, not the backup: we only undo what was actually
 * changed. The backup is `reg export` of each touched key, so it contains that
 * key's entire subtree (thousands of untouched keys) — walking all of it would
 * produce a giant script that recreates things we never modified. So for each
 * change we look up its prior state in the backup and emit the inverse.
 *
 * `changes` is the applied change-set still loaded in the editor; `backup` is
 * the parsed uploaded snapshot.
 */
export function computeBackupRestore(
  changes: RegistryChange[],
  backup: RegistryKey,
): RegistryChange[] {
  const restore: RegistryChange[] = [];
  const now = Date.now();

  const backupValue = (path: string, name?: string) =>
    findKey(backup, path)?.values.find((v) => v.name === (name ?? ''));

  // Recreate a key and its whole subtree from the backup (for deleted keys).
  const recreateSubtree = (node: RegistryKey) => {
    if (node.path !== 'Computer' && !isHiveRoot(node.path)) {
      restore.push({ id: revId(), type: 'add-key', path: node.path, timestamp: now });
    }
    for (const v of node.values) {
      restore.push({ id: revId(), type: 'add-value', path: node.path, valueName: v.name, valueType: v.type, newData: v.data, timestamp: now });
    }
    node.children.forEach(recreateSubtree);
  };

  const restorePriorValue = (path: string, name?: string) => {
    const bv = backupValue(path, name);
    if (bv) {
      restore.push({ id: revId(), type: 'add-value', path, valueName: bv.name, valueType: bv.type, newData: bv.data, timestamp: now });
    } else {
      // Wasn't present before → undo by removing it.
      restore.push({ id: revId(), type: 'delete-value', path, valueName: name, timestamp: now });
    }
  };

  for (const c of changes) {
    switch (c.type) {
      case 'add-key':
        // We created it. If it pre-existed in the backup, leave it; else remove.
        if (!findKey(backup, c.path)) {
          restore.push({ id: revId(), type: 'delete-key', path: c.path, timestamp: now });
        }
        break;

      case 'delete-key': {
        // We removed it. Recreate exactly what the backup captured.
        const bk = findKey(backup, c.path);
        if (bk) recreateSubtree(bk);
        break;
      }

      case 'add-value':
      case 'modify-value':
        restorePriorValue(c.path, c.valueName);
        break;

      case 'delete-value': {
        // We removed a value. Re-add it if the backup has it.
        const bv = backupValue(c.path, c.valueName);
        if (bv) restore.push({ id: revId(), type: 'add-value', path: c.path, valueName: bv.name, valueType: bv.type, newData: bv.data, timestamp: now });
        break;
      }

      case 'rename-key': {
        // Remove the renamed-to key, recreate the original from backup.
        const np = renamedPath(c);
        if (np && !findKey(backup, np)) {
          restore.push({ id: revId(), type: 'delete-key', path: np, timestamp: now });
        }
        const bk = findKey(backup, c.path);
        if (bk) recreateSubtree(bk);
        break;
      }

      case 'rename-value':
        // Remove the renamed-to value, restore the original from backup.
        if (c.newName) restore.push({ id: revId(), type: 'delete-value', path: c.path, valueName: c.newName, timestamp: now });
        restorePriorValue(c.path, c.valueName);
        break;
    }
  }

  return restore;
}
