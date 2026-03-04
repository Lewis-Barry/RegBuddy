import React, { useCallback, useRef, useState } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { ROOT_HIVES } from '../../registry/types';

/** Expand common hive abbreviations and normalise separators. */
function normalizePath(raw: string): string {
  let p = raw.replace(/\//g, '\\').trim();
  // Strip leading "Computer\" if pasted from the address bar display
  if (/^computer\\/i.test(p)) p = p.slice('Computer\\'.length);
  const abbr: Record<string, string> = {
    HKLM: 'HKEY_LOCAL_MACHINE',
    HKCU: 'HKEY_CURRENT_USER',
    HKCR: 'HKEY_CLASSES_ROOT',
    HKU: 'HKEY_USERS',
    HKCC: 'HKEY_CURRENT_CONFIG',
  };
  for (const [short, full] of Object.entries(abbr)) {
    if (p.toUpperCase().startsWith(short + '\\') || p.toUpperCase() === short) {
      p = full + p.slice(short.length);
      break;
    }
  }
  // Uppercase the hive root segment to match the tree's casing
  const slash = p.indexOf('\\');
  const hive = slash === -1 ? p.toUpperCase() : p.slice(0, slash).toUpperCase();
  const rest = slash === -1 ? '' : p.slice(slash);
  return hive + rest;
}

function isValidHive(path: string): boolean {
  const hive = path.split('\\')[0].toUpperCase();
  return (ROOT_HIVES as readonly string[]).includes(hive);
}

export const AddressBar: React.FC = () => {
  const selectedPath = useRegBuddyStore((s) => s.selectedPath);
  const mergedTree   = useRegBuddyStore((s) => s.mergedTree);
  const expandTo     = useRegBuddyStore((s) => s.expandTo);
  const selectKey    = useRegBuddyStore((s) => s.selectKey);
  const createAndNavigateTo = useRegBuddyStore((s) => s.createAndNavigateTo);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [notFound, setNotFound]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Walk the merged tree to check if a path node exists */
  const pathExists = useCallback(
    (path: string) => {
      // 'Computer' is always the virtual root
      if (path === 'Computer') return true;
      let node = mergedTree;
      for (const seg of path.split('\\')) {
        const child = node.children.find((c) => c.name.toLowerCase() === seg.toLowerCase());
        if (!child) return false;
        node = child;
      }
      return true;
    },
    [mergedTree],
  );

  const handleClick = useCallback(() => {
    setEditValue(selectedPath);
    setNotFound(false);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [selectedPath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const raw = editValue.trim();
        if (!raw) { setEditing(false); return; }
        const path = normalizePath(raw);

        if (notFound) {
          // Second Enter — confirmed, create the path
          createAndNavigateTo(path);
          setEditing(false);
          setNotFound(false);
          return;
        }

        if (pathExists(path)) {
          expandTo(path);
          selectKey(path);
          setEditing(false);
        } else if (!isValidHive(path)) {
          // Not a valid hive at all — just close
          setEditing(false);
        } else {
          // First Enter on an unknown path — prompt to create
          setEditValue(path); // show normalised form
          setNotFound(true);
          setTimeout(() => inputRef.current?.select(), 0);
        }
      } else if (e.key === 'Escape') {
        if (notFound) {
          setNotFound(false);
        } else {
          setEditing(false);
        }
      } else {
        // Any other keystroke clears the not-found state so the hint updates
        setNotFound(false);
      }
    },
    [editValue, notFound, pathExists, expandTo, selectKey, createAndNavigateTo],
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
          className={`addressBar-input${notFound ? ' addressBar-input--notfound' : ''}`}
          value={editValue}
          onChange={(e) => { setEditValue(e.target.value); setNotFound(false); }}
          onKeyDown={handleKeyDown}
          onBlur={() => { setEditing(false); setNotFound(false); }}
        />
      ) : (
        <div className="addressBar-path" onClick={handleClick} title={selectedPath}>
          {selectedPath}
        </div>
      )}

      {notFound && (
        <div className="addressBar-hint">
          <span>Path not found.</span>
          <button
            className="addressBar-hint-create"
            onMouseDown={(e) => {
              // Prevent the input from losing focus before we handle the click
              e.preventDefault();
              createAndNavigateTo(normalizePath(editValue.trim()));
              setEditing(false);
              setNotFound(false);
            }}
          >
            Create
          </button>
          <span className="addressBar-hint-shortcut">or press Enter</span>
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
