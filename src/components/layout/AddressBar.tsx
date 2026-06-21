import React, { useCallback, useRef, useState } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { ROOT_HIVES } from '../../registry/types';

/** Expand common hive abbreviations and normalise separators. */
function normalizePath(raw: string): string {
  let p = raw.replace(/\//g, '\\').trim();
  // Collapse repeated separators and drop any trailing separator so the path
  // splits into clean segments (no empty names).
  p = p.replace(/\\{2,}/g, '\\').replace(/\\+$/, '');
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

interface AddressBarProps {
  showTip?: boolean;
  onCloseTip?: () => void;
}

export const AddressBar: React.FC<AddressBarProps> = ({ showTip, onCloseTip }) => {
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

  /**
   * Resolve a path against the merged tree case-insensitively. Returns the path
   * with each existing key's canonical casing, or null if it doesn't fully exist.
   */
  const resolvePath = useCallback(
    (path: string): string | null => {
      if (path === 'Computer') return 'Computer';
      let node = mergedTree;
      const canon: string[] = [];
      for (const seg of path.split('\\')) {
        const child = node.children.find((c) => c.name.toLowerCase() === seg.toLowerCase());
        if (!child) return null;
        canon.push(child.name);
        node = child;
      }
      return canon.join('\\');
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

        const canonical = resolvePath(path);
        if (canonical) {
          expandTo(canonical);
          selectKey(canonical);
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
    [editValue, notFound, resolvePath, expandTo, selectKey, createAndNavigateTo],
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

      {showTip && (
        <div className="path-tip" role="status">
          <svg className="path-tip-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13a.5.5 0 0 1 0 1 .5.5 0 0 1 0 1l-.224.447a1 1 0 0 1-.894.553H6.618a1 1 0 0 1-.894-.553L5.5 15a.5.5 0 0 1 0-1 .5.5 0 0 1 0-1 .5.5 0 0 1-.46-.302l-.761-1.77a1.964 1.964 0 0 0-.453-.618A5.984 5.984 0 0 1 2 6zm6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1z"/>
          </svg>
          <span>Paste a new path here to create it</span>
          <button className="path-tip-close" onClick={onCloseTip} aria-label="Dismiss tip">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
