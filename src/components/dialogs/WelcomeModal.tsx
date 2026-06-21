import React, { useState } from 'react';

interface WelcomeModalProps {
  onDismiss: (dontShowAgain: boolean) => void;
}

const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1zM4.5 9a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zm0 2a.5.5 0 0 1 0-1h4a.5.5 0 0 1 0 1h-4zm0-4a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7z"/>
      </svg>
    ),
    title: 'Import & Browse .reg Files',
    desc: 'Load any exported .reg file and navigate its keys and values in a familiar regedit-style tree.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6 1h6v3h-1V2H7v12h4v-1h1v2H6V1zm3 4h6v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-6v-1h1v-1h-1v-1h1v-1h-1V9h1V8H9V7h1V6H9V5zm1 1v1h1V6h-1zm0 2v1h1V8h-1zm0 2v1h1v-1h-1zm0 2v1h1v-1h-1z"/>
      </svg>
    ),
    title: 'Compare Two .reg Files',
    desc: 'Diff a primary (desired state) against a secondary (current state) and instantly see added, removed, and modified values.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/>
      </svg>
    ),
    title: 'Generate PowerShell Scripts',
    desc: 'Export your tracked changes or a compare diff as Intune-ready Remediation & Detection script pairs (.ps1).',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5v-9zM1.5 3a.5.5 0 0 0-.5.5V7h14V3.5a.5.5 0 0 0-.5-.5h-13zM15 8H1v4.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V8zM3 10.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm0-3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
      </svg>
    ),
    title: 'GUI to Script Editing',
    desc: 'Edit the registry in the familiar way, export to PowerShell when done.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
      </svg>
    ),
    title: 'Safe Restore',
    desc: 'Every remediation script first backs up the keys it touches on the device. If a change goes wrong, Restore mode turns that backup into an exact rollback script that returns the device to its real prior state, not a guess.',
  },
];

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onDismiss }) => {
  const [dontShow, setDontShow] = useState(true);

  const handleDismiss = () => onDismiss(dontShow);

  return (
    <div className="welcome-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}>
      <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">

        {/* Header */}
        <div className="welcome-header">
          <div>
            <h1 className="welcome-title" id="welcome-title">Welcome to RegBuddy</h1>
            <p className="welcome-subtitle">A lightweight .reg file editor &amp; script generator</p>
          </div>
        </div>

        {/* Features */}
        <div className="welcome-features">
          {features.map((f) => (
            <div key={f.title} className="welcome-feature">
              <div className="welcome-feature-icon">{f.icon}</div>
              <div>
                <div className="welcome-feature-title">{f.title}</div>
                <div className="welcome-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="welcome-warning">
          <div className="welcome-warning-header">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            <span className="welcome-warning-label">Registry Safety Warning</span>
          </div>
          <p className="welcome-warning-text">
            Making changes to the Windows registry can result in unforeseen consequences and should be your
            <strong> last resort</strong>. Incorrect edits can cause applications to malfunction or prevent
            Windows from booting.
          </p>
          <ul className="welcome-warning-list">
            <li>
              <strong>Managed by Intune?</strong> Check{' '}
              <strong>Settings Catalog</strong> first (Devices &rarr; Configuration &rarr; +Create &rarr; Settings Catalog).
            </li>
            <li>
              <strong>Managed by Active Directory?</strong> Look for an equivalent{' '}
              <strong>Group Policy</strong> setting before touching the registry.
            </li>
          </ul>
          <div className="welcome-warning-tools">
            <span className="welcome-warning-tools-label">Other useful tools:</span>
            <a
              href="https://intunesettings.app"
              target="_blank"
              rel="noopener noreferrer"
              className="welcome-link"
            >
              intunesettings.app
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style={{ marginLeft: 3 }}>
                <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="welcome-footer">
          <label className="welcome-dont-show">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            Don't show again
          </label>
          <button className="welcome-dismiss primary" onClick={handleDismiss}>
            Got it, let's go
          </button>
        </div>

      </div>
    </div>
  );
};
