import React from 'react';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => (
  <div className="welcome-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <img className="about-logo" src="/Windows_11_registry_editor_icon.svg" alt="RegBuddy logo" />
      <h1 className="about-title" id="about-title">RegBuddy</h1>
      <p className="about-desc">
        A lightweight registry editor that turns your changes into Intune-ready
        PowerShell remediation &amp; detection scripts.
      </p>
      <p className="about-credit">
        Prompted by{' '}
        <a className="welcome-link" href="https://conditionalaccess.uk" target="_blank" rel="noopener noreferrer">
          Lewis Barry
        </a>
      </p>
      <button className="welcome-dismiss primary" onClick={onClose}>Close</button>
    </div>
  </div>
);
