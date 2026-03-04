import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseRegFile } from '../../registry/parser';
import { diffRegTrees, RegDiffEntry, RegDiffType } from '../../registry/compare';
import {
  generateRemediationScript,
  generateDetectionScript,
  suggestProfileName,
} from '../../registry/powershellGenerator';
import { PowerShellHighlight } from './PowerShellHighlight';
import { RegistryKey } from '../../registry/types';

// ── Icons ─────────────────────────────────────────────────────────────────────

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2h7a1 1 0 0 1 1 1v9h-1V3H4V2zM2 5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5zm1 0v9h7V5H3z"/>
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M7.5 1a.5.5 0 0 1 .5.5v8.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L7 10.293V1.5a.5.5 0 0 1 .5-.5zM1 13.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5z"/>
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
  </svg>
);

const FileIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm5.5 1.5v2a1 1 0 0 0 1 1h2L9.5 1.5z"/>
  </svg>
);

// ── Diff helpers ──────────────────────────────────────────────────────────────

function diffBadgeClass(type: RegDiffType): string {
  switch (type) {
    case 'key-added':
    case 'value-added':   return 'badge add';
    case 'key-removed':
    case 'value-removed': return 'badge delete';
    case 'value-modified': return 'badge modify';
  }
}

function diffBadgeLabel(type: RegDiffType): string {
  switch (type) {
    case 'key-added':     return 'ADD KEY';
    case 'key-removed':   return 'DEL KEY';
    case 'value-added':   return 'ADD';
    case 'value-removed': return 'DEL';
    case 'value-modified': return 'MOD';
  }
}

function diffRowClass(type: RegDiffType): string {
  switch (type) {
    case 'key-added':
    case 'value-added':   return 'cmp-diff-row add';
    case 'key-removed':
    case 'value-removed': return 'cmp-diff-row delete';
    case 'value-modified': return 'cmp-diff-row modify';
  }
}



// ── File loader card ──────────────────────────────────────────────────────────

interface FileCardProps {
  role: 'primary' | 'secondary';
  fileName: string | null;
  keyCount: number;
  onLoad: (content: string, name: string) => void;
  onClear: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ role, fileName, keyCount, onLoad, onClear }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      onLoad(text, file.name);
      e.target.value = '';
    },
    [onLoad],
  );

  const label   = role === 'primary' ? 'Primary' : 'Secondary';
  const subtext = role === 'primary'
    ? 'Desired / target state'
    : 'Current state to be restored';

  return (
    <div className={`cmp-file-card${fileName ? ' loaded' : ''}`}>
      <div className="cmp-file-card-header">
        <span className={`cmp-file-role cmp-file-role--${role}`}>{label}</span>
        <span className="cmp-file-card-sub">{subtext}</span>
      </div>
      {fileName ? (
        <div className="cmp-file-loaded">
          <FileIcon />
          <span className="cmp-file-name" title={fileName}>{fileName}</span>
          <span className="cmp-file-count">{keyCount} keys</span>
          <button className="cmp-file-clear" onClick={onClear} title="Remove file">✕</button>
        </div>
      ) : (
        <button className="cmp-file-pick" onClick={() => inputRef.current?.click()}>
          Browse .reg file…
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".reg"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
};

// ── Diff row ──────────────────────────────────────────────────────────────────

const DiffRow: React.FC<{ entry: RegDiffEntry }> = ({ entry: e }) => {
  const parts = e.path.split('\\');
  const leaf  = parts.pop() ?? '';
  const parent = parts.join('\\');
  const isKeyLevel = e.type === 'key-added' || e.type === 'key-removed';

  return (
    <div className={diffRowClass(e.type)}>
      <div className="cmp-diff-row-top">
        <span className={diffBadgeClass(e.type)}>{diffBadgeLabel(e.type)}</span>
        <span className="cmp-diff-path">
          {parent && <span className="cmp-diff-path-parent">{parent}\</span>}
          <span className="cmp-diff-path-leaf">{leaf}</span>
        </span>
        {!isKeyLevel && e.valueName !== undefined && (
          <span className="cmp-diff-valname">{e.valueName || '(Default)'}</span>
        )}
      </div>

      {e.type === 'value-added' && (
        <div className="cmp-diff-data-row add">
          <span className="cmp-diff-data-label">Value</span>
          <span className="cmp-diff-type-pill">{e.primaryType}</span>
          <span className="cmp-diff-data">{e.primaryData ?? ''}</span>
        </div>
      )}

      {e.type === 'value-removed' && (
        <div className="cmp-diff-data-row delete">
          <span className="cmp-diff-data-label">Was</span>
          <span className="cmp-diff-type-pill">{e.secondaryType}</span>
          <span className="cmp-diff-data">{e.secondaryData ?? ''}</span>
        </div>
      )}

      {e.type === 'value-modified' && (
        <>
          <div className="cmp-diff-data-row add">
            <span className="cmp-diff-data-label">Primary</span>
            <span className="cmp-diff-type-pill">{e.primaryType}</span>
            <span className="cmp-diff-data">{e.primaryData ?? ''}</span>
          </div>
          <div className="cmp-diff-data-row delete">
            <span className="cmp-diff-data-label">Secondary</span>
            <span className="cmp-diff-type-pill secondary">{e.secondaryType}</span>
            <span className="cmp-diff-data old">{e.secondaryData ?? ''}</span>
          </div>
        </>
      )}
    </div>
  );
};

// ── Stats bar ─────────────────────────────────────────────────────────────────

interface StatsBarProps {
  keysAdded: number;
  keysRemoved: number;
  valuesAdded: number;
  valuesRemoved: number;
  valuesModified: number;
}

const StatsBar: React.FC<StatsBarProps> = (props) => {
  const items = [
    { label: 'Keys to add',    count: props.keysAdded,      cls: 'add' },
    { label: 'Keys to delete', count: props.keysRemoved,     cls: 'delete' },
    { label: 'Values to add',  count: props.valuesAdded,     cls: 'add' },
    { label: 'Values to del',  count: props.valuesRemoved,   cls: 'delete' },
    { label: 'Values changed', count: props.valuesModified,  cls: 'modify' },
  ].filter((i) => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="cmp-stats-bar">
      {items.map((item) => (
        <div key={item.label} className={`cmp-stat cmp-stat--${item.cls}`}>
          <span className="cmp-stat-count">{item.count}</span>
          <span className="cmp-stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Count keys in tree ────────────────────────────────────────────────────────

function countKeys(node: RegistryKey): number {
  if (node.path === 'Computer') {
    return node.children.reduce((s, c) => s + countKeys(c), 0);
  }
  return 1 + node.children.reduce((s, c) => s + countKeys(c), 0);
}

// ── Main dialog ───────────────────────────────────────────────────────────────

type RightTab = 'diff' | 'script';
type ScriptPane = 'remediation' | 'detection';

interface RegCompareDialogProps {
  onBack: () => void;
}

export const RegCompareDialog: React.FC<RegCompareDialogProps> = ({ onBack }) => {
  const [primaryContent, setPrimaryContent]   = useState<string | null>(null);
  const [primaryName, setPrimaryName]         = useState<string | null>(null);
  const [secondaryContent, setSecondaryContent] = useState<string | null>(null);
  const [secondaryName, setSecondaryName]     = useState<string | null>(null);

  const [rightTab, setRightTab]     = useState<RightTab>('diff');
  const [scriptPane, setScriptPane] = useState<ScriptPane>('remediation');
  const [copied, setCopied]         = useState<ScriptPane | null>(null);
  const [profileName, setProfileName] = useState('RestoreBaseline');

  // Resizable left panel
  const [leftWidth, setLeftWidth] = useState(300);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    e.preventDefault();
  }, [leftWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragStartX.current;
      setLeftWidth(Math.max(220, Math.min(560, dragStartWidth.current + delta)));
    };
    const onMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Parse both trees
  const primaryTree = useMemo(
    () => (primaryContent ? parseRegFile(primaryContent) : null),
    [primaryContent],
  );
  const secondaryTree = useMemo(
    () => (secondaryContent ? parseRegFile(secondaryContent) : null),
    [secondaryContent],
  );

  // Compute diff
  const diffResult = useMemo(() => {
    if (!primaryTree || !secondaryTree) return null;
    return diffRegTrees(primaryTree, secondaryTree);
  }, [primaryTree, secondaryTree]);

  // Generate scripts from restoreChanges
  const remediationScript = useMemo(
    () => (diffResult ? generateRemediationScript(diffResult.restoreChanges, profileName) : ''),
    [diffResult, profileName],
  );
  const detectionScript = useMemo(
    () => (diffResult ? generateDetectionScript(diffResult.restoreChanges, profileName) : ''),
    [diffResult, profileName],
  );

  const currentScript = scriptPane === 'detection' ? detectionScript : remediationScript;

  const handleCopy = useCallback(
    (pane: ScriptPane) => {
      const script = pane === 'detection' ? detectionScript : remediationScript;
      navigator.clipboard.writeText(script).then(() => {
        setCopied(pane);
        setTimeout(() => setCopied(null), 2000);
      });
    },
    [detectionScript, remediationScript],
  );

  const handleDownload = useCallback(
    (pane: ScriptPane) => {
      const script = pane === 'detection' ? detectionScript : remediationScript;
      const suffix = pane === 'detection' ? 'detection' : 'remediation';
      const filename = `${profileName || 'RestoreBaseline'}-${suffix}.ps1`;
      const blob = new Blob([script], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [detectionScript, remediationScript, profileName],
  );

  // Group diff entries by path for display
  const groupedDiff = useMemo(() => {
    if (!diffResult) return [];
    const map = new Map<string, RegDiffEntry[]>();
    for (const entry of diffResult.entries) {
      const list = map.get(entry.path) ?? [];
      list.push(entry);
      map.set(entry.path, list);
    }
    return Array.from(map.entries());
  }, [diffResult]);

  const hasResult   = diffResult !== null;
  const hasDiff     = hasResult && diffResult.stats.total > 0;
  const noChanges   = hasResult && diffResult.stats.total === 0;

  return (
    <div className="confirmPage">
      {/* ── Header ── */}
      <div className="confirmPage-header">
        <button className="confirmPage-back" onClick={onBack} title="Back to editor">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
          </svg>
          Back
        </button>
        <div className="confirmPage-title">
          Compare .reg Files
          {hasDiff && (
            <span className="confirmPage-title-sub">
              {diffResult!.stats.total} difference{diffResult!.stats.total !== 1 ? 's' : ''}
            </span>
          )}
          {noChanges && (
            <span className="confirmPage-title-sub cmp-title-identical">Files are identical</span>
          )}
        </div>
        <div className="confirmPage-header-actions">
          {hasDiff && (
            <button
              className="confirmPage-btn primary"
              onClick={() => setRightTab('script')}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
              </svg>
              Generate Restore Script
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="confirmPage-body">
        {/* ── Left panel: file selectors + config ── */}
        <div className="confirmPage-changes cmp-left" style={{ width: leftWidth, minWidth: leftWidth, maxWidth: leftWidth }}>
          <FileCard
            role="primary"
            fileName={primaryName}
            keyCount={primaryTree ? countKeys(primaryTree) : 0}
            onLoad={(content, name) => { setPrimaryContent(content); setPrimaryName(name); }}
            onClear={() => { setPrimaryContent(null); setPrimaryName(null); }}
          />
          <FileCard
            role="secondary"
            fileName={secondaryName}
            keyCount={secondaryTree ? countKeys(secondaryTree) : 0}
            onLoad={(content, name) => { setSecondaryContent(content); setSecondaryName(name); }}
            onClear={() => { setSecondaryContent(null); setSecondaryName(null); }}
          />

          {hasDiff && (
            <>
              <StatsBar {...diffResult!.stats} />
              <div className="export-config-section" style={{ marginTop: 8 }}>
                <label className="export-config-label">Script profile name</label>
                <input
                  className="export-config-input"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="RestoreBaseline"
                />
              </div>
            </>
          )}

          {!primaryContent && !secondaryContent && (
            <div className="cmp-empty-hint">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" opacity="0.25">
                <path d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8zm15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM9.283 4.002V12H7.971V5.338h-.065L6.072 6.656V5.385l1.899-1.383h1.312z"/>
              </svg>
              <p>Load a Primary and Secondary <code>.reg</code> file to compute a diff and generate a restore script.</p>
            </div>
          )}
        </div>

        {/* ── Splitter ── */}
        <div className="cmp-splitter" onMouseDown={handleSplitterMouseDown} />

        {/* ── Right panel: diff or script ── */}
        <div className="confirmPage-script">
          {!hasResult ? (
            <div className="cmp-placeholder">
              <svg width="40" height="40" viewBox="0 0 16 16" fill="currentColor" opacity="0.18">
                <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1zM4.5 9a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zm0 2a.5.5 0 0 1 0-1h4a.5.5 0 0 1 0 1h-4zm0-4a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7z"/>
              </svg>
              Load both .reg files to see the diff
            </div>
          ) : noChanges ? (
            <div className="cmp-placeholder">
              <svg width="40" height="40" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--change-add-text)', opacity: 0.6 }}>
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
              </svg>
              No differences — the files are identical
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="export-tab-bar">
                <div className="export-tabs">
                  <button
                    className={`export-tab${rightTab === 'diff' ? ' active' : ''}`}
                    onClick={() => setRightTab('diff')}
                  >
                    Diff ({diffResult!.stats.total})
                  </button>
                  <button
                    className={`export-tab${rightTab === 'script' ? ' active' : ''}`}
                    onClick={() => setRightTab('script')}
                  >
                    Restore Script
                  </button>
                </div>

                {rightTab === 'script' && (
                  <div className="export-tab-actions">
                    <div className="export-tabs" style={{ marginRight: 8 }}>
                      <button
                        className={`export-tab${scriptPane === 'remediation' ? ' active' : ''}`}
                        onClick={() => setScriptPane('remediation')}
                      >
                        Remediation
                      </button>
                      <button
                        className={`export-tab${scriptPane === 'detection' ? ' active' : ''}`}
                        onClick={() => setScriptPane('detection')}
                      >
                        Detection
                      </button>
                    </div>
                    <button className="confirmPage-btn" onClick={() => handleCopy(scriptPane)}>
                      {copied === scriptPane ? <CheckIcon /> : <CopyIcon />}
                      {copied === scriptPane ? 'Copied!' : 'Copy'}
                    </button>
                    <button className="confirmPage-btn primary" onClick={() => handleDownload(scriptPane)}>
                      <DownloadIcon />
                      Download .ps1
                    </button>
                  </div>
                )}
              </div>

              {/* Content area */}
              {rightTab === 'diff' ? (
                <div className="cmp-diff-scroll">
                  <div className="cmp-diff-legend">
                    <span className="badge add">ADD / ADD KEY</span> exists in primary, missing from secondary
                    <span className="badge delete" style={{ marginLeft: 12 }}>DEL / DEL KEY</span> exists in secondary, not in primary
                    <span className="badge modify" style={{ marginLeft: 12 }}>MOD</span> value differs between files
                  </div>
                  {groupedDiff.map(([path, entries]) => (
                    <div key={path} className="cmp-diff-group">
                      <div className="cmp-diff-group-path">{path}</div>
                      {entries.map((entry, i) => (
                        <DiffRow key={i} entry={entry} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="confirmPage-scriptWrap">
                  <PowerShellHighlight code={currentScript} className="confirmPage-scriptPre" />
                </div>
              )}

              {/* Intune note when on script tab */}
              {rightTab === 'script' && (
                <div className="confirmPage-intune-note">
                  <strong>Restore script:</strong>{' '}
                  Applies changes to the secondary system to bring it in line with the primary .reg file.
                  Upload as an Intune Platform Script (Devices &rarr; Scripts) or as a Remediation Script pair.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
