import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { RegistryKey, RegistryValue, RegistryValueType } from '../../registry/types';
import { ValueIcon } from '../common/Icons';
import { ContextMenu, ContextMenuItem } from '../common/ContextMenu';
import { EditValueDialog, EditValueData } from '../dialogs/EditValueDialog';

function findKeyInTree(
  node: { path: string; children: typeof node[]; values: RegistryValue[] },
  path: string,
): typeof node | null {
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = findKeyInTree(child, path);
    if (found) return found;
  }
  return null;
}

function formatData(val: RegistryValue): string {
  switch (val.type) {
    case 'REG_SZ':
    case 'REG_EXPAND_SZ':
      return val.data || '(value not set)';
    case 'REG_DWORD':
      return `0x${val.data.padStart(8, '0')} (${parseInt(val.data, 16)})`;
    case 'REG_QWORD':
      return `0x${val.data}`;
    case 'REG_BINARY':
      return val.data || '(zero-length binary value)';
    case 'REG_MULTI_SZ':
      return val.data || '(value not set)';
    default:
      return val.data || '';
  }
}

/** Generate "New Value #1", "New Value #2", etc. avoiding conflicts */
function getNextValueName(values: RegistryValue[]): string {
  let n = 1;
  while (values.some((v) => v.name.toLowerCase() === `new value #${n}`)) n++;
  return `New Value #${n}`;
}

interface InlineValueEditProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

const InlineValueEdit: React.FC<InlineValueEditProps> = ({ initialValue, onCommit, onCancel }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const val = inputRef.current?.value.trim();
      onCommit(val || initialValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    const val = inputRef.current?.value.trim();
    onCommit(val || initialValue);
  };

  return (
    <input
      ref={inputRef}
      className="inline-edit"
      defaultValue={initialValue}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
};

export const ValuePanel: React.FC = () => {
  const selectedPath = useRegBuddyStore((s) => s.selectedPath);
  const mergedTree = useRegBuddyStore((s) => s.mergedTree);
  const getChangeForValue = useRegBuddyStore((s) => s.getChangeForValue);
  const isKeyChanged = useRegBuddyStore((s) => s.isKeyChanged);
  const isAncestorDeleted = useRegBuddyStore((s) => s.isAncestorDeleted);
  const addValueChange = useRegBuddyStore((s) => s.addValueChange);
  const modifyValueChange = useRegBuddyStore((s) => s.modifyValueChange);
  const deleteValueChange = useRegBuddyStore((s) => s.deleteValueChange);
  const editingValueName = useRegBuddyStore((s) => s.editingValueName);
  const setEditingValue = useRegBuddyStore((s) => s.setEditingValue);
  const renameNewValue = useRegBuddyStore((s) => s.renameNewValue);
  const addKeyChange = useRegBuddyStore((s) => s.addKeyChange);
  const expandedNodes = useRegBuddyStore((s) => s.expandedNodes);
  const toggleExpand = useRegBuddyStore((s) => s.toggleExpand);
  const expandTo = useRegBuddyStore((s) => s.expandTo);
  const setEditingKey = useRegBuddyStore((s) => s.setEditingKey);

  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editDialog, setEditDialog] = useState<EditValueData | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'type' | 'data' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Resizable Name / Type columns (Data fills the remainder).
  const [colW, setColW] = useState({ name: 280, type: 170 });
  const resizing = useRef<{ col: 'name' | 'type'; startX: number; startW: number } | null>(null);

  const startResize = (col: 'name' | 'type', e: React.MouseEvent) => {
    resizing.current = { col, startX: e.clientX, startW: colW[col] };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(60, r.startW + (e.clientX - r.startX));
      setColW((prev) => ({ ...prev, [r.col]: w }));
    };
    const up = () => { resizing.current = null; };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, []);

  const key = findKeyInTree(mergedTree, selectedPath);
  const rawValues = key?.values ?? [];

  // Sort values if a sort column is selected
  const values = sortColumn
    ? [...rawValues].sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'name') {
          cmp = (a.name || '(Default)').localeCompare(b.name || '(Default)', undefined, { sensitivity: 'base' });
        } else if (sortColumn === 'type') {
          cmp = a.type.localeCompare(b.type);
        } else {
          cmp = formatData(a).localeCompare(formatData(b));
        }
        return sortAsc ? cmp : -cmp;
      })
    : rawValues;

  const handleSort = (col: 'name' | 'type' | 'data') => {
    if (sortColumn === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
  };

  const sortIndicator = (col: 'name' | 'type' | 'data') => {
    if (sortColumn !== col) return null;
    return <span className="sort-indicator">{sortAsc ? ' ▲' : ' ▼'}</span>;
  };

  /** True when the selected key itself, or one of its ancestors, is marked for deletion */
  const parentIsDeleted =
    isKeyChanged(selectedPath) === 'delete-key' || isAncestorDeleted(selectedPath);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, valueName?: string) => {
      e.preventDefault();
      if (valueName !== undefined) {
        setSelectedValue(valueName);
      } else {
        setSelectedValue(null);
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleDoubleClick = useCallback(
    (val: RegistryValue) => {
      // Find the baseline value (original) if it exists
      setEditDialog({
        name: val.name,
        type: val.type,
        data: val.data,
        isNew: false,
      });
    },
    [],
  );

  const handleEditSave = useCallback(
    (data: EditValueData) => {
      const original = values.find((v) => v.name === data.name);
      modifyValueChange(
        selectedPath,
        data.name,
        data.type,
        data.data,
        original?.data ?? '',
      );
      setEditDialog(null);
    },
    [selectedPath, values, modifyValueChange],
  );

  const createNewValue = useCallback(
    (type: RegistryValueType, defaultData: string) => {
      const name = getNextValueName(values);
      addValueChange(selectedPath, name, type, defaultData);
      setTimeout(() => setEditingValue(name), 0);
    },
    [selectedPath, values, addValueChange, setEditingValue],
  );

  const createNewKey = useCallback(() => {
    const siblings = key?.children ?? [];
    let n = 1;
    const getName = (c: { path: string }) => c.path.split('\\').pop()?.toLowerCase() ?? '';
    while (siblings.some((c) => getName(c) === `new key #${n}`)) n++;
    const autoName = `New Key #${n}`;
    const newPath = selectedPath + '\\' + autoName;
    addKeyChange(newPath);
    if (!expandedNodes.has(selectedPath)) {
      toggleExpand(selectedPath);
    }
    expandTo(newPath);
    setTimeout(() => setEditingKey(newPath), 0);
  }, [selectedPath, key, addKeyChange, expandedNodes, toggleExpand, expandTo, setEditingKey]);

  const newSubMenu: ContextMenuItem[] = [
    {
      label: 'Key',
      onClick: createNewKey,
    },
    { separator: true },
    {
      label: 'String Value',
      onClick: () => createNewValue('REG_SZ', ''),
    },
    {
      label: 'Binary Value',
      onClick: () => createNewValue('REG_BINARY', ''),
    },
    {
      label: 'DWORD (32-bit) Value',
      onClick: () => createNewValue('REG_DWORD', '00000000'),
    },
    {
      label: 'QWORD (64-bit) Value',
      onClick: () => createNewValue('REG_QWORD', '0000000000000000'),
    },
    {
      label: 'Multi-String Value',
      onClick: () => createNewValue('REG_MULTI_SZ', ''),
    },
    {
      label: 'Expandable String Value',
      onClick: () => createNewValue('REG_EXPAND_SZ', ''),
    },
  ];

  const contextItems: ContextMenuItem[] = [
    {
      label: 'Modify...',
      bold: true,
      disabled: selectedValue === null,
      onClick: () => {
        const val = values.find((v) => v.name === selectedValue);
        if (val) handleDoubleClick(val);
      },
    },
    { separator: true },
    {
      label: 'New',
      children: newSubMenu,
    },
    { separator: true },
    {
      label: 'Delete',
      disabled: selectedValue === null,
      onClick: () => {
        if (selectedValue !== null && window.confirm(`Delete value "${selectedValue || '(Default)'}"?`)) {
          deleteValueChange(selectedPath, selectedValue);
        }
      },
    },
    {
      label: 'Rename',
      disabled: selectedValue === null,
      onClick: () => {
        if (selectedValue !== null) setEditingValue(selectedValue);
      },
    },
  ];

  return (
    <div
      className="valuePanel"
      onContextMenu={(e) => handleContextMenu(e)}
      onClick={() => setSelectedValue(null)}
    >
      <table className="valueTable">
        <colgroup>
          <col style={{ width: colW.name }} />
          <col style={{ width: colW.type }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th className="col-name sortable" onClick={() => handleSort('name')}>
              Name{sortIndicator('name')}
              <span
                className="col-resizer"
                onMouseDown={(e) => startResize('name', e)}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="col-type sortable" onClick={() => handleSort('type')}>
              Type{sortIndicator('type')}
              <span
                className="col-resizer"
                onMouseDown={(e) => startResize('type', e)}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="col-data sortable" onClick={() => handleSort('data')}>
              Data{sortIndicator('data')}
            </th>
          </tr>
        </thead>
        <tbody>
          {values.map((val) => {
            const change = getChangeForValue(selectedPath, val.name);
            const changeClass = parentIsDeleted
              ? ' change-delete'
              : change
                ? change.type === 'add-value'
                  ? ' change-add'
                  : change.type === 'modify-value' || change.type === 'rename-value'
                    ? ' change-modify'
                    : change.type === 'delete-value'
                      ? ' change-delete'
                      : ''
                : '';

            return (
              <tr
                key={val.name}
                className={`valueRow${selectedValue === val.name ? ' selected' : ''}${changeClass}`}
                onClick={(e) => { e.stopPropagation(); setSelectedValue(val.name); }}
                onDoubleClick={() => handleDoubleClick(val)}
                onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, val.name); }}
              >
                <td>
                  <ValueIcon type={val.type} className="value-icon" />
                  {editingValueName === val.name ? (
                    <InlineValueEdit
                      initialValue={val.name}
                      onCommit={(newName) => renameNewValue(selectedPath, val.name, newName)}
                      onCancel={() => setEditingValue(null)}
                    />
                  ) : (
                    <span className="value-name">
                      {val.name === '' ? '(Default)' : val.name}
                    </span>
                  )}
                </td>
                <td>{val.type}</td>
                <td>{formatData(val)}</td>
              </tr>
            );
          })}
          {values.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: 'var(--text-disabled)', padding: '8px' }}>
                (No values)
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="valuePanel-spacer" />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {editDialog && (
        <EditValueDialog
          data={editDialog}
          onSave={handleEditSave}
          onCancel={() => setEditDialog(null)}
        />
      )}
    </div>
  );
};
