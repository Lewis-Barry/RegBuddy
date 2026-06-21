import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { RegistryChange } from '../../registry/types';
import { parseRegFile, readRegFile } from '../../registry/parser';
import {
  generateRemediationScript,
  generateDetectionScript,
  suggestProfileName,
} from '../../registry/powershellGenerator';
import { computeBackupRestore } from '../../registry/reversal';
import { PowerShellHighlight } from './PowerShellHighlight';

// ── Helpers ───────────────────────────────────────────────────────────────────

function badgeClass(type: string) {
  if (type.includes('add'))    return 'badge add';
  if (type.includes('modify')) return 'badge modify';
  if (type.includes('delete')) return 'badge delete';
  return 'badge';
}

function typeClass(type: string) {
  if (type.includes('add'))    return 'add';
  if (type.includes('modify')) return 'modify';
  if (type.includes('delete')) return 'delete';
  if (type.includes('rename')) return 'modify';
  return '';
}

function badgeLabel(type: string) {
  if (type.includes('add'))    return 'ADD';
  if (type.includes('modify')) return 'MOD';
  if (type.includes('delete')) return 'DEL';
  if (type.includes('rename')) return 'REN';
  return type.toUpperCase();
}

function typeLabel(type: string) {
  switch (type) {
    case 'add-key':      return 'Create key';
    case 'delete-key':   return 'Delete key';
    case 'rename-key':   return 'Rename key';
    case 'add-value':    return 'Add value';
    case 'modify-value': return 'Modify value';
    case 'delete-value': return 'Delete value';
    case 'rename-value': return 'Rename value';
    default:             return type;
  }
}

// ── Change entry ──────────────────────────────────────────────────────────────

interface ChangeEntryProps {
  change: RegistryChange;
}

const ChangeEntry: React.FC<ChangeEntryProps> = ({ change: c }) => {
  const parts = c.path.split('\\');
  const keyName = parts.pop() ?? c.path;
  const parentPath = parts.join('\\');

  return (
    <div className={`confirmPage-changeItem type-${typeClass(c.type)}`}>
      <div className="confirmPage-changeItem-header">
        <span className={badgeClass(c.type)}>{badgeLabel(c.type)}</span>
        <span className="confirmPage-changeItem-typeLabel">{typeLabel(c.type)}</span>
      </div>
      <div className="confirmPage-changeItem-path">
        {parentPath && <span className="confirmPage-path-parent">{parentPath}\</span>}
        <span className="confirmPage-path-leaf">{keyName}</span>
      </div>
      {c.valueName !== undefined && (
        <div className="confirmPage-changeItem-value">
          <span className="confirmPage-value-label">Value</span>
          <span className="confirmPage-value-name">{c.valueName || '(Default)'}</span>
          {c.valueType && (
            <span className="confirmPage-value-type">{c.valueType}</span>
          )}
        </div>
      )}
      {(c.type === 'add-value' || c.type === 'modify-value') && c.newData !== undefined && (
        <div className="confirmPage-changeItem-data">
          <span className="confirmPage-value-label">Data</span>
          <span className="confirmPage-value-data">{c.newData || '(empty)'}</span>
        </div>
      )}
      {c.type === 'modify-value' && c.originalData !== undefined && (
        <div className="confirmPage-changeItem-data confirmPage-changeItem-data--old">
          <span className="confirmPage-value-label">Was</span>
          <span className="confirmPage-value-data old">{c.originalData || '(empty)'}</span>
        </div>
      )}
      {(c.type === 'rename-key' || c.type === 'rename-value') && c.newName !== undefined && (
        <div className="confirmPage-changeItem-data">
          <span className="confirmPage-value-label">New name</span>
          <span className="confirmPage-value-data">{c.newName}</span>
        </div>
      )}
    </div>
  );
};

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

// ── Types ─────────────────────────────────────────────────────────────────────

type DeploymentMode = 'platform' | 'remediation';
type ScriptTab = 'detection' | 'remediation';

// ── Main component ────────────────────────────────────────────────────────────

interface ExportScriptsDialogProps {
  onBack: () => void;
  /** Open straight into restore mode (from the front-screen Restore button). */
  initialRestore?: boolean;
}

export const ExportScriptsDialog: React.FC<ExportScriptsDialogProps> = ({ onBack, initialRestore = false }) => {
  const changes = useRegBuddyStore((s) => s.changes);

  const [profileName, setProfileName] = useState(() => suggestProfileName(changes));
  const [mode, setMode] = useState<DeploymentMode>('platform');
  const [activeTab, setActiveTab] = useState<ScriptTab>(() => mode === 'remediation' ? 'detection' : 'remediation');
  const [copiedTab, setCopiedTab] = useState<ScriptTab | null>(null);
  const [changesCollapsed, setChangesCollapsed] = useState(false);
  const [restoreMode, setRestoreMode] = useState(initialRestore);
  const [includeBackup, setIncludeBackup] = useState(true);

  // Restore mode returns the device to an uploaded backup snapshot: the .reg
  // the remediation script captured before applying changes. No backup, no script.
  const [backupName, setBackupName] = useState<string | null>(null);
  const [backupContent, setBackupContent] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleBackupFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    // Concatenate all selected .reg files — parseRegFile ignores repeated headers.
    const texts = await Promise.all(files.map((f) => readRegFile(f)));
    setBackupContent(texts.join('\n'));
    setBackupName(files.length === 1 ? files[0].name : `${files.length} files`);
    e.target.value = '';
  }, []);

  const restoreChanges = useMemo(() => {
    if (!restoreMode || !backupContent) return [];
    return computeBackupRestore(changes, parseRegFile(backupContent));
  }, [restoreMode, backupContent, changes]);

  const backupReady = !restoreMode || (backupContent !== null);

  // Active working set — original changes, or the backup-derived restore set.
  const activeChanges = restoreMode ? restoreChanges : changes;

  const remediationScript = useMemo(
    () => generateRemediationScript(activeChanges, profileName, restoreMode, includeBackup),
    [activeChanges, profileName, restoreMode, includeBackup],
  );
  const detectionScript = useMemo(
    () => generateDetectionScript(activeChanges, profileName, restoreMode),
    [activeChanges, profileName, restoreMode],
  );

  // When switching to platform mode, force remediation tab
  const handleModeChange = useCallback(
    (newMode: DeploymentMode) => {
      setMode(newMode);
      if (newMode === 'platform') {
        setActiveTab('remediation');
      } else {
        setActiveTab('detection');
      }
    },
    [],
  );

  const currentScript = activeTab === 'detection' ? detectionScript : remediationScript;

  // Group changes by category (uses the active set — original or reversed)
  const grouped = useMemo(() => {
    const groups: Record<string, RegistryChange[]> = {
      'add-key':       [],
      'rename-key':    [],
      'delete-key':    [],
      'add-value':     [],
      'modify-value':  [],
      'rename-value':  [],
      'delete-value':  [],
    };
    for (const c of activeChanges) {
      groups[c.type]?.push(c);
    }
    return groups;
  }, [activeChanges]);

  const orderedGroups: [string, RegistryChange[]][] = [
    ['add-key',       grouped['add-key']],
    ['rename-key',    grouped['rename-key']],
    ['add-value',     grouped['add-value']],
    ['modify-value',  grouped['modify-value']],
    ['rename-value',  grouped['rename-value']],
    ['delete-value',  grouped['delete-value']],
    ['delete-key',    grouped['delete-key']],
  ].filter(([, items]) => items.length > 0) as [string, RegistryChange[]][];

  const groupLabel: Record<string, string> = {
    'add-key':       'Keys to create',
    'rename-key':    'Keys to rename',
    'delete-key':    'Keys to delete',
    'add-value':     'Values to add',
    'modify-value':  'Values to modify',
    'rename-value':  'Values to rename',
    'delete-value':  'Values to delete',
  };

  const handleCopy = useCallback(
    (tab: ScriptTab) => {
      const script = tab === 'detection' ? detectionScript : remediationScript;
      navigator.clipboard.writeText(script).then(() => {
        setCopiedTab(tab);
        setTimeout(() => setCopiedTab(null), 2000);
      });
    },
    [detectionScript, remediationScript],
  );

  const handleDownload = useCallback(
    (tab: ScriptTab) => {
      const script = tab === 'detection' ? detectionScript : remediationScript;
      const base = restoreMode ? 'restore' : 'remediation';
      const suffix = tab === 'detection' ? `${base === 'restore' ? 'restore-' : ''}detection` : base;
      const filename = `${profileName || 'RegBuddy'}-${suffix}.ps1`;
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [detectionScript, remediationScript, profileName, restoreMode],
  );

  return (
    <div className="confirmPage">
      {/* ── Header bar ── */}
      <div className="confirmPage-header">
        <button className="confirmPage-back" onClick={onBack} title="Back to editor">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
          </svg>
          Back
        </button>
        <div className="confirmPage-title">
          {restoreMode ? 'Restore Script' : 'Export Scripts'}
          <span className="confirmPage-title-sub">
            {restoreMode
              ? backupContent
                ? `${restoreChanges.length} restore op${restoreChanges.length !== 1 ? 's' : ''}`
                : 'backup required'
              : `${changes.length} change${changes.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="confirmPage-header-actions">
          {restoreMode && (
            <span className="reversal-safety-note">
              Restores the device to the uploaded backup
            </span>
          )}
          <button
            className={`confirmPage-reversal-btn${restoreMode ? ' active' : ''}`}
            onClick={() => setRestoreMode((v) => !v)}
            title="Toggle restore mode: returns the device to a backup .reg captured before the changes were applied."
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
            </svg>
            Restore mode
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="confirmPage-body">
        {/* Left – config & changes summary */}
        <div className="confirmPage-changes">
          {/* Configuration name */}
          <div className="export-config-section">
            <label className="export-config-label">Configuration name</label>
            <input
              className="export-config-input"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="RegBuddy"
            />
          </div>

          {/* Deployment mode */}
          <div className="export-config-section">
            <label className="export-config-label">Deployment mode</label>
            <div className="export-mode-selector">
              <label className={`export-mode-option${mode === 'platform' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="deployMode"
                  value="platform"
                  checked={mode === 'platform'}
                  onChange={() => handleModeChange('platform')}
                />
                <span className="export-mode-radio" />
                <span className="export-mode-text">
                  <strong>Platform Script</strong>
                  <small>Single script. Upload to Intune &gt; Devices &gt; Scripts</small>
                </span>
              </label>
              <label className={`export-mode-option${mode === 'remediation' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="deployMode"
                  value="remediation"
                  checked={mode === 'remediation'}
                  onChange={() => handleModeChange('remediation')}
                />
                <span className="export-mode-radio" />
                <span className="export-mode-text">
                  <strong>Remediation Script</strong>
                  <small>Two scripts. Upload to Intune &gt; Scripts and Remediations &gt; Remediations</small>
                </span>
              </label>
            </div>
          </div>

          {/* Backup toggle (applies to both apply and restore scripts) */}
          <div className={`export-safety${includeBackup ? '' : ' off'}`}>
              <label className="export-safety-header">
                <input
                  type="checkbox"
                  checked={includeBackup}
                  onChange={(e) => setIncludeBackup(e.target.checked)}
                />
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.414a1 1 0 0 0-.293-.707l-2.414-2.414A1 1 0 0 0 11.586 1H2zm10 13H4v-4h8v4zM4 2v3h6V2H4z"/>
                </svg>
                Back up affected keys before changes
              </label>
              <p className="export-safety-text">
                {includeBackup ? (
                  <>
                    The script first saves every key it touches to a{' '}
                    <code>backup.reg</code> under{' '}
                    <code>%ProgramData%\RegBuddy\{profileName || 'RegBuddy'}-&lt;timestamp&gt;</code>{' '}
                    (or <code>%TEMP%</code> if that is not writable). That file is your rollback: run{' '}
                    <code>reg import</code> on it to undo. Leave this on unless you take backups another way.
                  </>
                ) : (
                  <>No backup will be taken. The script applies changes with no automatic rollback point. Make sure you have your own backup first.</>
                )}
              </p>
          </div>

          {/* Restore mode: hidden input is always mounted so both the center
              step button and the "change backup" button can trigger it. The
              upload instructions live in the center step, so once a backup is
              loaded we only show a compact status row here. */}
          {restoreMode && (
            <input
              ref={backupInputRef}
              type="file"
              accept=".reg"
              multiple
              style={{ display: 'none' }}
              onChange={handleBackupFiles}
            />
          )}
          {restoreMode && backupContent && (
            <div className="reversal-upload">
              <span className="reversal-upload-file">✓ {backupName} loaded</span>
              <button className="confirmPage-btn" onClick={() => backupInputRef.current?.click()}>
                Change backup…
              </button>
              <button
                className="confirmPage-btn"
                onClick={() => { setBackupContent(null); setBackupName(null); }}
                title="Clear the uploaded backup and start over"
              >
                Clear
              </button>
            </div>
          )}

          {/* Changes summary (collapsible) */}
          <div className="export-changes-toggle" onClick={() => setChangesCollapsed(!changesCollapsed)}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className={`treeNode-chevron${changesCollapsed ? '' : ' expanded'}`}
            >
              <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {restoreMode ? `Restore operations (${restoreChanges.length})` : `Changes summary (${changes.length})`}
          </div>
          {!changesCollapsed && (
            <div className="confirmPage-changesList">
              {orderedGroups.map(([type, items]) => (
                <div key={type} className="confirmPage-changeGroup">
                  <div className={`confirmPage-changeGroup-header type-${typeClass(type)}`}>
                    <span className={badgeClass(type)}>{badgeLabel(type)}</span>
                    {groupLabel[type]} ({items.length})
                  </div>
                  {items.map((c) => (
                    <ChangeEntry key={c.id} change={c} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right – script preview with tabs */}
        <div className="confirmPage-script">
          {/* Tab bar */}
          <div className="export-tab-bar">
            <div className="export-tabs">
              {mode === 'remediation' && (
                <button
                  className={`export-tab${activeTab === 'detection' ? ' active' : ''}`}
                  onClick={() => setActiveTab('detection')}
                >
                  Detection
                </button>
              )}
              <button
                className={`export-tab${activeTab === 'remediation' ? ' active' : ''}`}
                onClick={() => setActiveTab('remediation')}
              >
                {mode === 'platform' ? 'Platform Script' : 'Remediation'}
              </button>
            </div>
            <div className="export-tab-actions">
              <button
                className="confirmPage-btn"
                onClick={() => handleCopy(activeTab)}
                disabled={!backupReady}
              >
                {copiedTab === activeTab ? <CheckIcon /> : <CopyIcon />}
                {copiedTab === activeTab ? 'Copied!' : 'Copy'}
              </button>
              <button
                className="confirmPage-btn primary"
                onClick={() => handleDownload(activeTab)}
                disabled={!backupReady}
              >
                <DownloadIcon />
                Download .ps1
              </button>
            </div>
          </div>

          {/* Script preview */}
          <div className="confirmPage-scriptWrap">
            {backupReady ? (
              <PowerShellHighlight code={currentScript} className="confirmPage-scriptPre" />
            ) : (
              <div className="confirmPage-restore-step">
                <svg width="34" height="34" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
                </svg>
                <h2>Upload the RegBuddy backup to continue</h2>
                <p>
                  Restore needs the backup <code>.reg</code> that RegBuddy saved on the device
                  <strong> before</strong> these changes were applied. Find it on the device at:
                </p>
                <code className="confirmPage-restore-path">%ProgramData%\RegBuddy\{profileName || 'RegBuddy'}-&lt;timestamp&gt;</code>
                <button className="confirmPage-btn primary" onClick={() => backupInputRef.current?.click()}>
                  <DownloadIcon />
                  Upload backup .reg…
                </button>
                <span className="confirmPage-restore-hint">Upload the <code>backup.reg</code> from that folder.</span>
              </div>
            )}
          </div>

          {/* Intune instructions */}
          <div className="confirmPage-intune-note">
            {mode === 'platform' ? (
              <>
                <strong>Intune Platform Scripts:</strong>{' '}
                Devices &rarr; Scripts &rarr; Add &rarr; Windows 10 and later.
                Upload the remediation <code>.ps1</code> file, set run context (System for HKLM, User for HKCU),
                assign to groups.
              </>
            ) : (
              <>
                <strong>Intune Remediation Scripts:</strong>{' '}
                Devices &rarr; Scripts and Remediations &rarr; Remediations &rarr; Create.
                Upload both <code>detection</code> and <code>remediation</code> scripts separately.
                Set run context and schedule, assign to groups.
                <em> (Requires Intune P2 / Intune Suite licensing)</em>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
