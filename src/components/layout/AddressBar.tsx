import React, { useCallback, useRef, useState } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';

export const AddressBar: React.FC = () => {
  const selectedPath = useRegBuddyStore((s) => s.selectedPath);
  const expandTo = useRegBuddyStore((s) => s.expandTo);
  const selectKey = useRegBuddyStore((s) => s.selectKey);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    setEditValue(selectedPath);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [selectedPath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const path = editValue.trim();
        if (path) {
          expandTo(path);
          selectKey(path);
        }
        setEditing(false);
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [editValue, expandTo, selectKey],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = selectedPath;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [selectedPath]);

  return (
    <div className="addressBar">
      <span className="addressBar-icon" title="Registry path">
        {/* small folder/key icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44L8.062 3.56A.5.5 0 008.415 3.7H13.5A1.5 1.5 0 0115 5.2v7.3a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"
            fill="#dcb67a"
            stroke="#c4a05a"
            strokeWidth=".5"
          />
        </svg>
      </span>

      {editing ? (
        <input
          ref={inputRef}
          className="addressBar-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="addressBar-path" onClick={handleClick} title={selectedPath}>
          {selectedPath}
        </div>
      )}

      <button
        className="addressBar-copy"
        onClick={handleCopy}
        title="Copy path to clipboard"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="#1a7f1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3 11V3a1 1 0 011-1h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
};
