import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { RegistryKey, RegistryValue } from '../../registry/types';
import { FolderIcon, FolderAddIcon, ComputerIcon } from '../common/Icons';
import { ContextMenu, ContextMenuItem } from '../common/ContextMenu';

/** Generate "New Key #1", "New Key #2", etc. avoiding conflicts */
function getNextKeyName(parentChildren: RegistryKey[]): string {
  let n = 1;
  while (parentChildren.some((c) => c.name.toLowerCase() === `new key #${n}`)) n++;
  return `New Key #${n}`;
}

/** Generate "New Value #1", "New Value #2", etc. avoiding conflicts */
function getNextValueName(values: RegistryValue[]): string {
  let n = 1;
  while (values.some((v) => v.name.toLowerCase() === `new value #${n}`)) n++;
  return `New Value #${n}`;
}

interface InlineEditProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

const InlineEdit: React.FC<InlineEditProps> = ({ initialValue, onCommit, onCancel }) => {
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

interface TreeNodeProps {
  node: RegistryKey;
  depth: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth }) => {
  const selectedPath = useRegBuddyStore((s) => s.selectedPath);
  const expandedNodes = useRegBuddyStore((s) => s.expandedNodes);
  const selectKey = useRegBuddyStore((s) => s.selectKey);
  const toggleExpand = useRegBuddyStore((s) => s.toggleExpand);
  const isKeyChanged = useRegBuddyStore((s) => s.isKeyChanged);

  const isAncestorDeleted = useRegBuddyStore((s) => s.isAncestorDeleted);

  const isSelected = selectedPath === node.path;
  const isExpanded = expandedNodes.has(node.path);
  const hasChildren = node.children.length > 0;
  const changeType = isKeyChanged(node.path);
  const ancestorDeleted = isAncestorDeleted(node.path);

  const changeClass =
    changeType === 'add-key'
      ? ' change-add'
      : changeType === 'delete-key' || ancestorDeleted
        ? ' change-delete'
        : changeType === 'rename-key'
          ? ' change-modify'
          : '';

  const handleClick = useCallback(() => {
    selectKey(node.path);
  }, [node.path, selectKey]);

  const handleDoubleClick = useCallback(() => {
    toggleExpand(node.path);
  }, [node.path, toggleExpand]);

  const handleArrowClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpand(node.path);
    },
    [node.path, toggleExpand],
  );

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const addKeyChange = useRegBuddyStore((s) => s.addKeyChange);
  const addValueChange = useRegBuddyStore((s) => s.addValueChange);
  const deleteKeyChange = useRegBuddyStore((s) => s.deleteKeyChange);
  const expandTo = useRegBuddyStore((s) => s.expandTo);
  const editingKeyPath = useRegBuddyStore((s) => s.editingKeyPath);
  const setEditingKey = useRegBuddyStore((s) => s.setEditingKey);
  const setEditingValue = useRegBuddyStore((s) => s.setEditingValue);
  const renameNewKey = useRegBuddyStore((s) => s.renameNewKey);
  const isEditing = editingKeyPath === node.path;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      selectKey(node.path);
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [node.path, selectKey],
  );

  const isNotRoot = node.path !== 'Computer';
  const isHiveRoot = !isNotRoot || node.path.split('\\').length === 1;

  const newSubMenu: ContextMenuItem[] = [
    {
      label: 'Key',
      onClick: () => {
        const autoName = getNextKeyName(node.children);
        const newPath = node.path + '\\' + autoName;
        addKeyChange(newPath);
        if (!expandedNodes.has(node.path)) {
          toggleExpand(node.path);
        }
        expandTo(newPath);
        // Enter inline rename mode after creation
        setTimeout(() => setEditingKey(newPath), 0);
      },
    },
    { separator: true },
    {
      label: 'String Value',
      onClick: () => {
        const name = getNextValueName(node.values);
        addValueChange(node.path, name, 'REG_SZ', '');
        setTimeout(() => setEditingValue(name), 0);
      },
    },
    {
      label: 'Binary Value',
      onClick: () => {
        const name = getNextValueName(node.values);
        addValueChange(node.path, name, 'REG_BINARY', '');
        setTimeout(() => setEditingValue(name), 0);
      },
    },
    {
      label: 'DWORD (32-bit) Value',
      onClick: () => {
        const name = getNextValueName(node.values);
        addValueChange(node.path, name, 'REG_DWORD', '00000000');
        setTimeout(() => setEditingValue(name), 0);
      },
    },
    {
      label: 'QWORD (64-bit) Value',
      onClick: () => {
        const name = getNextValueName(node.values);
        addValueChange(node.path, name, 'REG_QWORD', '0000000000000000');
        setTimeout(() => setEditingValue(name), 0);
      },
    },
    {
      label: 'Multi-String Value',
      onClick: () => {
        const name = getNextValueName(node.values);
        addValueChange(node.path, name, 'REG_MULTI_SZ', '');
        setTimeout(() => setEditingValue(name), 0);
      },
    },
    {
      label: 'Expandable String Value',
      onClick: () => {
        const name = getNextValueName(node.values);
        addValueChange(node.path, name, 'REG_EXPAND_SZ', '');
        setTimeout(() => setEditingValue(name), 0);
      },
    },
  ];

  const contextItems: ContextMenuItem[] = isNotRoot
    ? [
        {
          label: isExpanded ? 'Collapse' : 'Expand',
          bold: true,
          disabled: !hasChildren,
          onClick: () => toggleExpand(node.path),
        },
        { separator: true },
        {
          label: 'New',
          children: newSubMenu,
        },
        {
          label: 'Find...',
          disabled: true,
        },
        { separator: true },
        {
          label: 'Delete',
          disabled: isHiveRoot,
          onClick: () => {
            if (window.confirm(`Delete key "${node.name}" and all its subkeys?`)) {
              deleteKeyChange(node.path);
            }
          },
        },
        {
          label: 'Rename',
          disabled: isHiveRoot,
          onClick: () => setEditingKey(node.path),
        },
        { separator: true },
        {
          label: 'Export',
          disabled: true,
        },
        { separator: true },
        {
          label: 'Permissions...',
          disabled: true,
        },
        { separator: true },
        {
          label: 'Copy Key Name',
          onClick: () => {
            navigator.clipboard.writeText(node.path);
          },
        },
      ]
    : [
        // Computer root node
        {
          label: isExpanded ? 'Collapse' : 'Expand',
          bold: true,
          disabled: !hasChildren,
          onClick: () => toggleExpand(node.path),
        },
      ];

  const isRoot = node.path === 'Computer';

  return (
    <>
      <div
        className={`treeNode${isSelected ? ' selected' : ''}${changeClass}`}
        style={{ paddingLeft: depth * 20 + 4 }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <span
          className={`treeNode-arrow${hasChildren ? '' : ' empty'}`}
          onClick={hasChildren ? handleArrowClick : undefined}
        >
          {hasChildren && (
            <svg width="10" height="10" viewBox="0 0 10 10" className={`treeNode-chevron${isExpanded ? ' expanded' : ''}`}>
              <path d="M3 1 L7 5 L3 9" fill="none" stroke="#555" strokeWidth="1.2" />
            </svg>
          )}
        </span>
        <span className="treeNode-icon">
          {isRoot ? (
            <ComputerIcon />
          ) : changeType === 'add-key' ? (
            <FolderAddIcon />
          ) : (
            <FolderIcon open={isExpanded} />
          )}
        </span>
        {isEditing ? (
          <InlineEdit
            initialValue={node.name}
            onCommit={(val) => renameNewKey(node.path, val)}
            onCancel={() => setEditingKey(null)}
          />
        ) : (
          <span className="treeNode-label">{node.name}</span>
        )}
      </div>

      {isExpanded &&
        node.children.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};

export const TreePanel: React.FC = () => {
  const mergedTree = useRegBuddyStore((s) => s.mergedTree);

  return (
    <div className="treePanel">
      <TreeNode node={mergedTree} depth={0} />
    </div>
  );
};
