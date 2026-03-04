import React from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';

export const StatusBar: React.FC = () => {
  const selectedPath = useRegBuddyStore((s) => s.selectedPath);
  const changes = useRegBuddyStore((s) => s.changes);

  return (
    <div className="statusBar">
      <span className="statusBar-path">{selectedPath}</span>
      {changes.length > 0 && (
        <span className="statusBar-changes">
          {changes.length} pending change{changes.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};
