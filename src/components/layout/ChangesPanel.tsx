import React, { useRef, useState, useEffect } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';

interface ChangesPanelProps {
  onGetScripts: () => void;
}

export const ChangesPanel: React.FC<ChangesPanelProps> = ({ onGetScripts }) => {
  const changes = useRegBuddyStore((s) => s.changes);
  const removeChange = useRegBuddyStore((s) => s.removeChange);
  const clearAllChanges = useRegBuddyStore((s) => s.clearAllChanges);
  const expandTo = useRegBuddyStore((s) => s.expandTo);

  const [height, setHeight] = useState(200);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      // Drag up grows the panel (eats into the main area above).
      const next = startHeight.current + (startY.current - e.clientY);
      setHeight(Math.max(80, Math.min(window.innerHeight - 200, next)));
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (changes.length === 0) return null;

  const badgeClass = (type: string) => {
    if (type.includes('add')) return 'badge add';
    if (type.includes('modify')) return 'badge modify';
    if (type.includes('delete')) return 'badge delete';
    if (type.includes('rename')) return 'badge modify';
    return 'badge';
  };

  const badgeLabel = (type: string) => {
    if (type.includes('add')) return 'ADD';
    if (type.includes('modify')) return 'MOD';
    if (type.includes('delete')) return 'DEL';
    if (type.includes('rename')) return 'REN';
    return type.toUpperCase();
  };

  return (
    <div className="changesPanel" style={{ height }}>
      <div className="changesPanel-resize" onMouseDown={handleMouseDown} />
      <div className="changesPanel-header">
        <span>
          Pending Changes ({changes.length})
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={clearAllChanges}>Clear All</button>
          <button className="confirmPage-triggerBtn" onClick={onGetScripts}>Get Scripts</button>
        </div>
      </div>
      <div className="changesPanel-body">
      {changes.map((c) => (
        <div
          key={c.id}
          className="changesPanel-item"
          onClick={() => expandTo(c.path)}
        >
          <span className={badgeClass(c.type)}>{badgeLabel(c.type)}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.path}
            {c.valueName !== undefined ? ` → ${c.valueName || '(Default)'}` : ''}
            {c.newName !== undefined ? ` ➜ ${c.newName}` : ''}
          </span>
          <button
            className="undo-btn"
            onClick={(e) => {
              e.stopPropagation();
              removeChange(c.id);
            }}
            title="Undo this change"
          >
            ✕
          </button>
        </div>
      ))}
      </div>
    </div>
  );
};
