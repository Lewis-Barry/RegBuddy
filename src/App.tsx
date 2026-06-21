import React, { useState } from 'react';
import { MenuBar } from './components/layout/MenuBar';
import { AddressBar } from './components/layout/AddressBar';
import { StatusBar } from './components/layout/StatusBar';
import { SplitPane } from './components/layout/SplitPane';
import { ChangesPanel } from './components/layout/ChangesPanel';
import { TreePanel } from './components/tree/TreePanel';
import { ValuePanel } from './components/values/ValuePanel';
import { ExportScriptsDialog } from './components/dialogs/ExportScriptsDialog';
import { RegCompareDialog } from './components/dialogs/RegCompareDialog';
import { WelcomeModal } from './components/dialogs/WelcomeModal';
import { AboutModal } from './components/dialogs/AboutModal';

const WELCOME_KEY = 'regbuddy-welcome-seen';
const PATH_TIP_KEY = 'regbuddy-pathtip-seen';

const App: React.FC = () => {
  const [showExport, setShowExport]   = useState(false);
  const [exportRestore, setExportRestore] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY));
  const [showAbout, setShowAbout]     = useState(false);
  const [showPathTip, setShowPathTip] = useState(() => !localStorage.getItem(PATH_TIP_KEY));

  const dismissPathTip = () => { localStorage.setItem(PATH_TIP_KEY, '1'); setShowPathTip(false); };
  const handleShowWelcome = () => { setShowWelcome(true); setShowPathTip(true); };

  const handleGetScripts  = () => { setShowCompare(false); setExportRestore(false); setShowExport(true); };
  const handleRestore     = () => { setShowCompare(false); setExportRestore(true);  setShowExport(true); };
  const handleCompare     = () => { setShowExport(false);  setShowCompare(true); };
  const handleWelcomeDismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) localStorage.setItem(WELCOME_KEY, '1');
    setShowWelcome(false);
  };

  return (
    <div className="regedit" style={{ position: 'relative' }}>
      <MenuBar onGetScripts={handleGetScripts} onCompare={handleCompare} onRestore={handleRestore} onAbout={() => setShowAbout(true)} onShowWelcome={handleShowWelcome} />
      <AddressBar showTip={showPathTip && !showWelcome} onCloseTip={dismissPathTip} />
      <SplitPane
        left={<TreePanel />}
        right={<ValuePanel />}
        defaultLeftWidth={320}
      />
      <ChangesPanel onGetScripts={handleGetScripts} />
      <StatusBar />
      {showExport  && <ExportScriptsDialog onBack={() => setShowExport(false)} initialRestore={exportRestore} />}
      {showCompare && <RegCompareDialog    onBack={() => setShowCompare(false)} />}
      {showWelcome && <WelcomeModal onDismiss={handleWelcomeDismiss} />}
      {showAbout   && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
};

export default App;
