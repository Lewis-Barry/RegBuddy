import { create } from 'zustand';
import {
  RegistryKey,
  RegistryValue,
  RegistryChange,
  ChangeType,
  RegistryValueType,
  findKey,
} from '../registry/types';
import { parseRegFile } from '../registry/parser';
import { SAMPLE_REG_FILE } from '../registry/sampleBaseline';

// ── Helpers ──

const genId = () => crypto.randomUUID();

function cloneTree(node: RegistryKey): RegistryKey {
  return {
    ...node,
    values: node.values.map((v) => ({ ...v })),
    children: node.children.map(cloneTree),
  };
}

/**
 * Walk `parts` from the Computer root, matching existing child keys
 * case-insensitively (registry keys are case-insensitive). Returns the segments
 * using each existing key's canonical casing, and the typed casing for any
 * segment that doesn't exist yet.
 */
function canonicalizeParts(root: RegistryKey, parts: string[]): string[] {
  const out: string[] = [];
  let current: RegistryKey | null = root;
  for (const seg of parts) {
    const match: RegistryKey | undefined = current?.children.find(
      (c) => c.name.toLowerCase() === seg.toLowerCase(),
    );
    if (match) {
      out.push(match.name);
      current = match;
    } else {
      out.push(seg);
      current = null;
    }
  }
  return out;
}

/** Ensure a key exists at path, creating intermediate keys as needed */
function ensureKey(root: RegistryKey, path: string): RegistryKey {
  const existing = findKey(root, path);
  if (existing) return existing;

  const parts = path.split('\\');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    const partial = parts.slice(0, i + 1).join('\\');
    let child = current.children.find((c) => c.path === partial);
    if (!child) {
      child = { path: partial, name: parts[i], children: [], values: [] };
      current.children.push(child);
      current.children.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
    }
    current = child;
  }
  return current;
}

/**
 * Resolve the current (possibly post-rename) path back to the original baseline
 * path by reversing any rename-key changes. This is needed so that lookups like
 * `findKey(baseline, path)` succeed even after a parent key has been renamed.
 */
function resolveBaselinePath(path: string, changes: RegistryChange[]): string {
  let resolved = path;
  for (const c of changes) {
    if (c.type === 'rename-key' && c.newName) {
      const parentPath = c.path.substring(0, c.path.lastIndexOf('\\'));
      const newPath = parentPath ? parentPath + '\\' + c.newName : c.newName;
      if (resolved === newPath) {
        resolved = c.path;
      } else if (resolved.startsWith(newPath + '\\')) {
        resolved = c.path + resolved.substring(newPath.length);
      }
    }
  }
  return resolved;
}

/** Apply all changes to a cloned baseline tree to produce the merged/display tree */
function applyChanges(baseline: RegistryKey, changes: RegistryChange[]): RegistryKey {
  const tree = cloneTree(baseline);

  for (const change of changes) {
    switch (change.type) {
      case 'add-key': {
        ensureKey(tree, change.path);
        break;
      }
      case 'delete-key': {
        // Keep the key in the tree so it renders with strikethrough — 
        // the change tracker will mark it as deleted visually
        break;
      }
      case 'add-value':
      case 'modify-value': {
        const key = ensureKey(tree, change.path);
        const idx = key.values.findIndex((v) => v.name === change.valueName);
        const newVal: RegistryValue = {
          name: change.valueName ?? '',
          type: change.valueType ?? 'REG_SZ',
          data: change.newData ?? '',
        };
        if (idx >= 0) {
          key.values[idx] = newVal;
        } else {
          key.values.push(newVal);
        }
        break;
      }
      case 'delete-value': {
        // Keep the value in the tree so it renders with strikethrough — 
        // the change tracker will mark it as deleted visually
        break;
      }
      case 'rename-key': {
        // Apply rename: find the key and update its name and path (and children recursively)
        const oldPath = change.path;
        const newKeyName = change.newName ?? '';
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('\\'));
        const newPath = parentPath ? parentPath + '\\' + newKeyName : newKeyName;
        const keyToRename = findKey(tree, oldPath);
        if (keyToRename) {
          keyToRename.name = newKeyName;
          keyToRename.path = newPath;
          // Recursively update child paths
          function updateChildPaths(node: RegistryKey, oldPrefix: string, newPrefix: string) {
            for (const child of node.children) {
              child.path = newPrefix + child.path.substring(oldPrefix.length);
              updateChildPaths(child, oldPrefix, newPrefix);
            }
          }
          updateChildPaths(keyToRename, oldPath, newPath);
          // Re-sort siblings
          const parent = findKey(tree, parentPath);
          if (parent) {
            parent.children.sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
            );
          }
        }
        break;
      }
      case 'rename-value': {
        const rvKey = findKey(tree, change.path);
        if (rvKey) {
          const val = rvKey.values.find((v) => v.name === change.valueName);
          if (val) {
            val.name = change.newName ?? '';
          }
        }
        break;
      }
    }
  }

  return tree;
}

// ── Store ──

export interface RegBuddyState {
  baseline: RegistryKey;
  changes: RegistryChange[];
  mergedTree: RegistryKey;
  selectedPath: string;
  expandedNodes: Set<string>;

  /** Path of a newly-created key being inline-renamed (null when idle) */
  editingKeyPath: string | null;
  /** Name of a newly-created value being inline-renamed (null when idle) */
  editingValueName: string | null;

  // Actions
  loadBaseline: () => void;
  selectKey: (path: string) => void;
  toggleExpand: (path: string) => void;
  expandTo: (path: string) => void;
  /** Navigate to path, creating any missing intermediate keys as add-key changes */
  createAndNavigateTo: (path: string) => void;

  // Change actions
  addKeyChange: (path: string) => void;
  deleteKeyChange: (path: string) => void;
  addValueChange: (path: string, name: string, type: RegistryValueType, data: string) => void;
  modifyValueChange: (
    path: string,
    name: string,
    type: RegistryValueType,
    newData: string,
    originalData: string,
  ) => void;
  deleteValueChange: (path: string, name: string) => void;
  removeChange: (changeId: string) => void;
  clearAllChanges: () => void;
  importRegAsChanges: (regContent: string) => void;

  // Inline-rename helpers
  setEditingKey: (path: string | null) => void;
  setEditingValue: (name: string | null) => void;
  renameNewKey: (oldPath: string, newName: string) => void;
  renameNewValue: (path: string, oldName: string, newName: string) => void;
  renameKeyChange: (path: string, newName: string) => void;
  renameValueChange: (path: string, oldName: string, newName: string) => void;

  // Helpers
  getChangeForValue: (path: string, valueName: string) => RegistryChange | undefined;
  isKeyChanged: (path: string) => ChangeType | null;
  /** Returns true if any ancestor key of `path` has a delete-key change */
  isAncestorDeleted: (path: string) => boolean;
}

export const useRegBuddyStore = create<RegBuddyState>((set, get) => {
  const initialBaseline = parseRegFile(SAMPLE_REG_FILE);

  return {
    baseline: initialBaseline,
    changes: [],
    mergedTree: cloneTree(initialBaseline),
    selectedPath: 'Computer',
    expandedNodes: new Set<string>(['Computer']),
    editingKeyPath: null,
    editingValueName: null,

    loadBaseline: () => {
      const baseline = parseRegFile(SAMPLE_REG_FILE);
      set({
        baseline,
        changes: [],
        mergedTree: cloneTree(baseline),
        selectedPath: 'Computer',
        expandedNodes: new Set(['Computer']),
      });
    },

    selectKey: (path) => set({ selectedPath: path }),

    toggleExpand: (path) =>
      set((state) => {
        const next = new Set(state.expandedNodes);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return { expandedNodes: next };
      }),

    expandTo: (path) =>
      set((state) => {
        const next = new Set(state.expandedNodes);
        const parts = path.split('\\');
        for (let i = 1; i <= parts.length; i++) {
          next.add(parts.slice(0, i).join('\\'));
        }
        return { expandedNodes: next, selectedPath: path };
      }),

    createAndNavigateTo: (path) =>
      set((state) => {
        // Reuse the casing of keys that already exist so a pasted "Software"
        // resolves to the existing "SOFTWARE" instead of creating a duplicate.
        const parts = canonicalizeParts(state.mergedTree, path.split('\\'));
        const newChanges: RegistryChange[] = [];
        // Add an add-key change for every segment that doesn't exist yet
        for (let i = 1; i <= parts.length; i++) {
          const segPath = parts.slice(0, i).join('\\');
          const existsInMerged = !!findKey(state.mergedTree, segPath);
          const alreadyPending = state.changes.some(
            (c) => c.type === 'add-key' && c.path === segPath,
          );
          if (!existsInMerged && !alreadyPending) {
            newChanges.push({
              id: genId(),
              type: 'add-key',
              path: segPath,
              timestamp: Date.now(),
            });
          }
        }
        const changes = [...state.changes, ...newChanges];
        const next = new Set(state.expandedNodes);
        for (let i = 1; i <= parts.length; i++) {
          next.add(parts.slice(0, i).join('\\'));
        }
        return {
          changes,
          mergedTree: applyChanges(state.baseline, changes),
          expandedNodes: next,
          selectedPath: parts.join('\\'),
        };
      }),

    addKeyChange: (path) =>
      set((state) => {
        const change: RegistryChange = {
          id: genId(),
          type: 'add-key',
          path,
          timestamp: Date.now(),
        };
        const changes = [...state.changes, change];
        return { changes, mergedTree: applyChanges(state.baseline, changes) };
      }),

    deleteKeyChange: (path) =>
      set((state) => {
        // If this key was added in this session, just remove the add-change
        const isNewKey = state.changes.some(
          (c) => c.type === 'add-key' && c.path === path,
        );
        if (isNewKey) {
          // Remove the add-key change and any value changes under this path
          const changes = state.changes.filter(
            (c) => !(c.path === path || c.path.startsWith(path + '\\')),
          );
          return { changes, mergedTree: applyChanges(state.baseline, changes) };
        }
        const change: RegistryChange = {
          id: genId(),
          type: 'delete-key',
          path,
          timestamp: Date.now(),
        };
        const changes = [...state.changes, change];
        return { changes, mergedTree: applyChanges(state.baseline, changes) };
      }),

    addValueChange: (path, name, type, data) =>
      set((state) => {
        const change: RegistryChange = {
          id: genId(),
          type: 'add-value',
          path,
          valueName: name,
          valueType: type,
          newData: data,
          timestamp: Date.now(),
        };
        // Replace any existing change for this value so adding twice doesn't duplicate
        const filtered = state.changes.filter(
          (c) => !(c.path === path && c.valueName === name),
        );
        const changes = [...filtered, change];
        return { changes, mergedTree: applyChanges(state.baseline, changes) };
      }),

    modifyValueChange: (path, name, type, newData, originalData) =>
      set((state) => {
        // Check if this value was added in this session (not in baseline)
        const existingChange = state.changes.find(
          (c) => c.path === path && c.valueName === name,
        );
        const isNewValue = existingChange?.type === 'add-value';

        // Also check if the key itself is new (add-key) — values on new keys are always "add"
        const isNewKey = state.changes.some(
          (c) => c.type === 'add-key' && c.path === path,
        );

        // Resolve the path back through any renames to find the baseline key
        const baselinePath = resolveBaselinePath(path, state.changes);
        const baselineKey = findKey(state.baseline, baselinePath);

        // Also check if the value was renamed — resolve the original value name
        // rename-value changes store the path at the time of rename (could be either
        // the baseline path or the current/renamed path depending on order of operations)
        const renameChange = state.changes.find(
          (c) => c.type === 'rename-value' &&
            (c.path === baselinePath || c.path === path) &&
            c.newName === name,
        );
        const baselineName = renameChange ? (renameChange.valueName ?? name) : name;
        const baselineValue = baselineKey?.values.find((v) => v.name === baselineName);
        const valueIsNew = isNewValue || isNewKey || !baselineValue;

        // Remove any existing change for this value
        const filtered = state.changes.filter(
          (c) => !(c.path === path && c.valueName === name),
        );

        const change: RegistryChange = {
          id: genId(),
          type: valueIsNew ? 'add-value' : 'modify-value',
          path,
          valueName: name,
          valueType: type,
          newData,
          originalData,
          timestamp: Date.now(),
        };
        const changes = [...filtered, change];
        return { changes, mergedTree: applyChanges(state.baseline, changes) };
      }),

    deleteValueChange: (path, name) =>
      set((state) => {
        // If this value was added in this session, just remove the add-change
        const isNewValue = state.changes.some(
          (c) => c.type === 'add-value' && c.path === path && c.valueName === name,
        );
        const isNewKey = state.changes.some(
          (c) => c.type === 'add-key' && c.path === path,
        );
        // Resolve the path back through any renames to find the baseline key
        const baselinePath = resolveBaselinePath(path, state.changes);
        const baselineKey = findKey(state.baseline, baselinePath);

        // Also check if the value was renamed
        const renameChange = state.changes.find(
          (c) => c.type === 'rename-value' &&
            (c.path === baselinePath || c.path === path) &&
            c.newName === name,
        );
        const baselineName = renameChange ? (renameChange.valueName ?? name) : name;
        const baselineValue = baselineKey?.values.find((v) => v.name === baselineName);
        const valueIsNew = isNewValue || (isNewKey && !baselineValue) || !baselineValue;

        if (valueIsNew) {
          // Just remove the add-value change
          const changes = state.changes.filter(
            (c) => !(c.path === path && c.valueName === name),
          );
          return { changes, mergedTree: applyChanges(state.baseline, changes) };
        }
        const change: RegistryChange = {
          id: genId(),
          type: 'delete-value',
          path,
          valueName: name,
          timestamp: Date.now(),
        };
        const changes = [...state.changes, change];
        return { changes, mergedTree: applyChanges(state.baseline, changes) };
      }),

    removeChange: (changeId) =>
      set((state) => {
        const changes = state.changes.filter((c) => c.id !== changeId);
        return { changes, mergedTree: applyChanges(state.baseline, changes) };
      }),

    clearAllChanges: () =>
      set((state) => ({
        changes: [],
        mergedTree: cloneTree(state.baseline),
      })),

    importRegAsChanges: (regContent: string) =>
      set((state) => {
        const imported = parseRegFile(regContent);
        const newChanges: RegistryChange[] = [...state.changes];

        // Walk the imported tree and diff against baseline
        function walkImported(node: RegistryKey) {
          if (node.path === 'Computer') {
            for (const child of node.children) walkImported(child);
            return;
          }

          const baselineNode = findKey(state.baseline, node.path);
          if (!baselineNode) {
            // Key doesn't exist in baseline — add it
            newChanges.push({
              id: genId(),
              type: 'add-key',
              path: node.path,
              timestamp: Date.now(),
            });
          }

          // Check values
          for (const val of node.values) {
            const baselineVal = baselineNode?.values.find((v) => v.name === val.name);
            if (!baselineVal) {
              // New value
              newChanges.push({
                id: genId(),
                type: 'add-value',
                path: node.path,
                valueName: val.name,
                valueType: val.type,
                newData: val.data,
                timestamp: Date.now(),
              });
            } else if (baselineVal.data !== val.data || baselineVal.type !== val.type) {
              // Modified value
              newChanges.push({
                id: genId(),
                type: 'modify-value',
                path: node.path,
                valueName: val.name,
                valueType: val.type,
                newData: val.data,
                originalData: baselineVal.data,
                timestamp: Date.now(),
              });
            }
          }

          for (const child of node.children) walkImported(child);
        }

        walkImported(imported);
        return { changes: newChanges, mergedTree: applyChanges(state.baseline, newChanges) };
      }),

    setEditingKey: (path) => set({ editingKeyPath: path }),
    setEditingValue: (name) => set({ editingValueName: name }),

    renameNewKey: (oldPath, newName) =>
      set((state) => {
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('\\'));
        const newPath = parentPath ? parentPath + '\\' + newName : newName;

        // Check if the key is a new (add-key) change
        const isNewKey = state.changes.some((c) => c.type === 'add-key' && c.path === oldPath);

        if (isNewKey) {
          // Don't rename if newPath already exists and isn't also a new key
          const existingKey = findKey(state.mergedTree, newPath);
          const isTargetNew = state.changes.some((c) => c.type === 'add-key' && c.path === newPath);
          if (existingKey && !isTargetNew && newPath !== oldPath) return {}; // conflict

          const changes = state.changes.map((c) => {
            if (c.type === 'add-key' && c.path === oldPath) {
              return { ...c, path: newPath };
            }
            // Update any value changes that were under the old path
            if (c.path === oldPath) {
              return { ...c, path: newPath };
            }
            return c;
          });
          return {
            changes,
            mergedTree: applyChanges(state.baseline, changes),
            editingKeyPath: null,
            selectedPath: newPath,
          };
        } else {
          // Baseline key: delegate to renameKeyChange
          get().renameKeyChange(oldPath, newName);
          return { editingKeyPath: null };
        }
      }),

    renameNewValue: (path, oldName, newName) =>
      set((state) => {
        // Check if this is a newly added value
        const isNewValue = state.changes.some(
          (c) => c.type === 'add-value' && c.path === path && c.valueName === oldName,
        );

        if (isNewValue) {
          const changes = state.changes
            // Drop any existing change already at the target name so renaming
            // two new values to the same name doesn't leave duplicates
            .filter((c) => !(c.path === path && c.valueName === newName))
            .map((c) => {
              if (c.type === 'add-value' && c.path === path && c.valueName === oldName) {
                return { ...c, valueName: newName };
              }
              return c;
            });
          return {
            changes,
            mergedTree: applyChanges(state.baseline, changes),
            editingValueName: null,
          };
        } else {
          // Baseline value: delegate to renameValueChange
          get().renameValueChange(path, oldName, newName);
          return { editingValueName: null };
        }
      }),

    renameKeyChange: (path, newName) =>
      set((state) => {
        const parentPath = path.substring(0, path.lastIndexOf('\\'));
        const newPath = parentPath ? parentPath + '\\' + newName : newName;

        if (newPath === path) return {}; // no change

        // Check for conflicts
        const existingKey = findKey(state.baseline, newPath);
        if (existingKey) return {}; // conflict with baseline key

        // Check if there's already a rename change whose computed new path matches
        // (for re-renaming a key that was already renamed)
        const existingRename = state.changes.find(
          (c) => c.type === 'rename-key' && (() => {
            const cp = c.path.substring(0, c.path.lastIndexOf('\\'));
            const computedNew = cp ? cp + '\\' + (c.newName ?? '') : (c.newName ?? '');
            return computedNew === path || c.path === path;
          })(),
        );
        let changes: RegistryChange[];
        if (existingRename) {
          // If the new name matches the original name, just remove the rename change
          const originalName = existingRename.path.split('\\').pop() ?? '';
          if (newName === originalName) {
            changes = state.changes.filter((c) => c.id !== existingRename.id);
          } else {
            changes = state.changes.map((c) =>
              c.id === existingRename.id ? { ...c, newName } : c,
            );
          }
        } else {
          const change: RegistryChange = {
            id: genId(),
            type: 'rename-key',
            path,
            newName,
            timestamp: Date.now(),
          };
          changes = [...state.changes, change];
        }
        return {
          changes,
          mergedTree: applyChanges(state.baseline, changes),
          selectedPath: newPath,
        };
      }),

    renameValueChange: (path, oldName, newName) =>
      set((state) => {
        if (oldName === newName) return {};

        // Check for conflicts — does a value with newName already exist?
        const keyNode = findKey(state.mergedTree, path);
        if (keyNode?.values.some((v) => v.name === newName)) return {};

        // Check if there's already a rename change whose new name matches oldName
        // (for re-renaming a value that was already renamed)
        const existingRename = state.changes.find(
          (c) => c.type === 'rename-value' && c.path === path &&
            (c.newName === oldName || c.valueName === oldName),
        );
        let changes: RegistryChange[];
        if (existingRename) {
          // If the new name matches the original name, just remove the rename change
          if (newName === existingRename.valueName) {
            changes = state.changes.filter((c) => c.id !== existingRename.id);
          } else {
            changes = state.changes.map((c) =>
              c.id === existingRename.id ? { ...c, newName } : c,
            );
          }
        } else {
          const change: RegistryChange = {
            id: genId(),
            type: 'rename-value',
            path,
            valueName: oldName,
            newName,
            timestamp: Date.now(),
          };
          changes = [...state.changes, change];
        }
        return {
          changes,
          mergedTree: applyChanges(state.baseline, changes),
        };
      }),

    getChangeForValue: (path, valueName) => {
      return get().changes.find(
        (c) => c.path === path &&
          ((c.valueName === valueName &&
            (c.type === 'add-value' || c.type === 'modify-value' || c.type === 'delete-value')) ||
           (c.type === 'rename-value' && c.newName === valueName)),
      );
    },

    isKeyChanged: (path) => {
      const ch = get().changes.find(
        (c) => (c.path === path && (c.type === 'add-key' || c.type === 'delete-key')) ||
          (c.type === 'rename-key' && (() => {
            const parentPath = c.path.substring(0, c.path.lastIndexOf('\\'));
            const newPath = parentPath ? parentPath + '\\' + (c.newName ?? '') : (c.newName ?? '');
            return newPath === path;
          })()),
      );
      return ch ? ch.type : null;
    },

    isAncestorDeleted: (path) => {
      const deletedKeys = get().changes
        .filter((c) => c.type === 'delete-key')
        .map((c) => c.path);
      return deletedKeys.some(
        (deletedPath) =>
          path !== deletedPath && path.startsWith(deletedPath + '\\'),
      );
    },
  };
});
