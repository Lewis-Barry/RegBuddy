import React, { useCallback, useRef, useState } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { RegistryValueType } from '../../registry/types';
import { readRegFile } from '../../registry/parser';

interface MenuBarProps {
  onGetScripts?: () => void;
  onCompare?: () => void;
  onRestore?: () => void;
  onAbout?: () => void;
  onShowWelcome?: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({ onGetScripts, onCompare, onRestore, onAbout, onShowWelcome }) => {
  const loadBaseline = useRegBuddyStore((s) => s.loadBaseline);
  const changes = useRegBuddyStore((s) => s.changes);
  const clearAllChanges = useRegBuddyStore((s) => s.clearAllChanges);
  const addKeyChange = useRegBuddyStore((s) => s.addKeyChange);
  const addValueChange = useRegBuddyStore((s) => s.addValueChange);
  const deleteKeyChange = useRegBuddyStore((s) => s.deleteKeyChange);
  const selectedPath = useRegBuddyStore((s) => s.selectedPath);
  const expandTo = useRegBuddyStore((s) => s.expandTo);
  const mergedTree = useRegBuddyStore((s) => s.mergedTree);
  const setEditingKey = useRegBuddyStore((s) => s.setEditingKey);
  const setEditingValue = useRegBuddyStore((s) => s.setEditingValue);
  const isKeyChanged = useRegBuddyStore((s) => s.isKeyChanged);
  const expandedNodes = useRegBuddyStore((s) => s.expandedNodes);
  const toggleExpand = useRegBuddyStore((s) => s.toggleExpand);
  const importAsChangesRef = useRef<HTMLInputElement>(null);
  const importRegAsChanges = useRegBuddyStore((s) => s.importRegAsChanges);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleImportAsChanges = useCallback(() => {
    importAsChangesRef.current?.click();
  }, []);

  const handleImportAsChangesFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await readRegFile(file);
      importRegAsChanges(text);
      e.target.value = '';
    },
    [importRegAsChanges],
  );

  const handleNewKey = useCallback(() => {
    if (!selectedPath || selectedPath === 'Computer') return;
    // Find existing children to generate unique name
    const findNode = (node: typeof mergedTree, path: string): typeof node | null => {
      if (node.path === path) return node;
      for (const child of node.children) {
        const found = findNode(child, path);
        if (found) return found;
      }
      return null;
    };
    const parentNode = findNode(mergedTree, selectedPath);
    const siblings = parentNode?.children ?? [];
    let n = 1;
    while (siblings.some((c) => c.name.toLowerCase() === `new key #${n}`)) n++;
    const autoName = `New Key #${n}`;
    const newPath = selectedPath + '\\' + autoName;
    addKeyChange(newPath);
    if (!expandedNodes.has(selectedPath)) {
      toggleExpand(selectedPath);
    }
    expandTo(newPath);
    setTimeout(() => setEditingKey(newPath), 0);
  }, [selectedPath, mergedTree, addKeyChange, expandedNodes, toggleExpand, expandTo, setEditingKey]);

  const handleNewValue = useCallback(
    (type: RegistryValueType, defaultData: string) => {
      if (!selectedPath || selectedPath === 'Computer') return;
      const findNode = (node: typeof mergedTree, path: string): typeof node | null => {
        if (node.path === path) return node;
        for (const child of node.children) {
          const found = findNode(child, path);
          if (found) return found;
        }
        return null;
      };
      const keyNode = findNode(mergedTree, selectedPath);
      const values = keyNode?.values ?? [];
      let n = 1;
      while (values.some((v) => v.name.toLowerCase() === `new value #${n}`)) n++;
      const name = `New Value #${n}`;
      addValueChange(selectedPath, name, type, defaultData);
      setTimeout(() => setEditingValue(name), 0);
    },
    [selectedPath, mergedTree, addValueChange, setEditingValue],
  );

  const handleDeleteKey = useCallback(() => {
    if (!selectedPath || selectedPath === 'Computer') return;
    const parts = selectedPath.split('\\');
    if (parts.length <= 1) return; // don't delete hive roots
    if (window.confirm(`Delete key "${parts[parts.length - 1]}" and all its subkeys?`)) {
      deleteKeyChange(selectedPath);
    }
  }, [selectedPath, deleteKeyChange]);

  const isNotComputer = selectedPath !== 'Computer';
  const isNotHive = isNotComputer && selectedPath.split('\\').length > 1;
  const canRename = isNotHive && isKeyChanged(selectedPath) === 'add-key';

  const menus: Record<string, { label: string; disabled?: boolean; separator?: boolean; onClick?: () => void }[]> = {
    File: [
      { label: 'Import .reg as changes...', onClick: handleImportAsChanges },
      { label: 'separator', separator: true },
      { label: 'Get Scripts...', onClick: onGetScripts, disabled: changes.length === 0 },
      { label: 'separator', separator: true },
      { label: 'Compare .reg files…', onClick: onCompare },
      { label: 'separator', separator: true },
      { label: 'Reset baseline', onClick: () => loadBaseline() },
    ],
    Edit: [
      { label: 'New Key', onClick: handleNewKey, disabled: !isNotComputer },
      { label: 'New String Value', onClick: () => handleNewValue('REG_SZ', ''), disabled: !isNotComputer },
      { label: 'New DWORD Value', onClick: () => handleNewValue('REG_DWORD', '00000000'), disabled: !isNotComputer },
      { label: 'New QWORD Value', onClick: () => handleNewValue('REG_QWORD', '0000000000000000'), disabled: !isNotComputer },
      { label: 'New Binary Value', onClick: () => handleNewValue('REG_BINARY', ''), disabled: !isNotComputer },
      { label: 'New Multi-String Value', onClick: () => handleNewValue('REG_MULTI_SZ', ''), disabled: !isNotComputer },
      { label: 'New Expandable String Value', onClick: () => handleNewValue('REG_EXPAND_SZ', ''), disabled: !isNotComputer },
      { label: 'separator', separator: true },
      { label: 'Delete', onClick: handleDeleteKey, disabled: !isNotHive },
      { label: 'Rename', onClick: () => setEditingKey(selectedPath), disabled: !canRename },
      { label: 'separator', separator: true },
      { label: `Clear all changes (${changes.length})`, onClick: clearAllChanges, disabled: changes.length === 0 },
    ],
    View: [
      { label: 'Refresh', onClick: () => {} },
    ],
    Favorites: [
      { label: '(No favorites)', disabled: true },
    ],
    Help: [
      { label: 'Show welcome screen', onClick: onShowWelcome },
      { label: 'separator', separator: true },
      { label: 'About RegBuddy', onClick: onAbout },
    ],
  };

  const menuEntries = Object.entries(menus);
  const openItems = openMenu ? menus[openMenu] : null;
  const activeEl = openMenu ? itemRefs.current[openMenu] : null;

  return (
    <div className="menuBar">
      <input
        ref={importAsChangesRef}
        type="file"
        accept=".reg"
        style={{ display: 'none' }}
        onChange={handleImportAsChangesFile}
      />
      {menuEntries.map(([name]) => (
        <div
          key={name}
          ref={(el) => { itemRefs.current[name] = el; }}
          className={`menuBar-item${openMenu === name ? ' active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === name ? null : name); }}
          onMouseEnter={() => openMenu && openMenu !== name && setOpenMenu(name)}
        >
          {name}
        </div>
      ))}
      <button className="menuBar-restore" onClick={onRestore} title="Restore a device to a RegBuddy backup">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
          <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
        </svg>
        Restore
      </button>
      {openMenu && activeEl && (
        <>
          <div
            className="contextMenu-overlay"
            onClick={() => setOpenMenu(null)}
          />
          <div
            className="contextMenu"
            style={{
              position: 'absolute',
              top: activeEl.offsetTop + activeEl.offsetHeight + 2,
              left: activeEl.offsetLeft,
            }}
          >
            {openItems!.map((item, i) =>
              item.separator ? (
                <div key={i} className="contextMenu-separator" />
              ) : (
                <div
                  key={i}
                  className={`contextMenu-item${item.disabled ? ' disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!item.disabled && item.onClick) {
                      item.onClick();
                    }
                    setOpenMenu(null);
                  }}
                >
                  {item.label}
                </div>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
};
