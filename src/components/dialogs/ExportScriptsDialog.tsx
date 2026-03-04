import React, { useCallback, useMemo, useState } from 'react';
import { useRegBuddyStore } from '../../store/regBuddyStore';
import { RegistryChange } from '../../registry/types';
import {
  generateRemediationScript,
  generateDetectionScript,
  suggestProfileName,
} from '../../registry/powershellGenerator';
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
}

export const ExportScriptsDialog: React.FC<ExportScriptsDialogProps> = ({ onBack }) => {
  const changes = useRegBuddyStore((s) => s.changes);

  const [profileName, setProfileName] = useState(() => suggestProfileName(changes));
  const [mode, setMode] = useState<DeploymentMode>('platform');
  const [activeTab, setActiveTab] = useState<ScriptTab>(() => mode === 'remediation' ? 'detection' : 'remediation');
  const [copiedTab, setCopiedTab] = useState<ScriptTab | null>(null);
  const [changesCollapsed, setChangesCollapsed] = useState(false);

  const remediationScript = useMemo(
    () => generateRemediationScript(changes, profileName),
    [changes, profileName],
  );
  const detectionScript = useMemo(
    () => generateDetectionScript(changes, profileName),
    [changes, profileName],
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

  // Group changes by category
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
    for (const c of changes) {
      groups[c.type]?.push(c);
    }
    return groups;
  }, [changes]);

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
      const suffix = tab === 'detection' ? 'detection' : 'remediation';
      const filename = `${profileName || 'RegBuddy'}-${suffix}.ps1`;
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [detectionScript, remediationScript, profileName],
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
          Export Scripts
          <span className="confirmPage-title-sub">{changes.length} change{changes.length !== 1 ? 's' : ''}</span>
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
                  <small>Single script — upload to Intune &gt; Devices &gt; Scripts</small>
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
                  <small>Two scripts — upload to Intune &gt; Proactive Remediations</small>
                </span>
              </label>
            </div>
          </div>

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
            Changes summary ({changes.length})
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
              >
                {copiedTab === activeTab ? <CheckIcon /> : <CopyIcon />}
                {copiedTab === activeTab ? 'Copied!' : 'Copy'}
              </button>
              <button
                className="confirmPage-btn primary"
                onClick={() => handleDownload(activeTab)}
              >
                <DownloadIcon />
                Download .ps1
              </button>
            </div>
          </div>

          {/* Script preview */}
          <div className="confirmPage-scriptWrap">
            <PowerShellHighlight code={currentScript} className="confirmPage-scriptPre" />
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
                Reports &rarr; Endpoint Analytics &rarr; Proactive Remediations &rarr; Create script package.
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
