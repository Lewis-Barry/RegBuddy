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

const WELCOME_KEY = 'regbuddy-welcome-seen';

const App: React.FC = () => {
  const [showExport, setShowExport]   = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY));

  const handleGetScripts  = () => { setShowCompare(false); setShowExport(true); };
  const handleCompare     = () => { setShowExport(false);  setShowCompare(true); };
  const handleWelcomeDismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) localStorage.setItem(WELCOME_KEY, '1');
    setShowWelcome(false);
  };

  return (
    <div className="regedit" style={{ position: 'relative' }}>
      <MenuBar onGetScripts={handleGetScripts} onCompare={handleCompare} />
      <AddressBar />
      <SplitPane
        left={<TreePanel />}
        right={<ValuePanel />}
        defaultLeftWidth={320}
      />
      <ChangesPanel onGetScripts={handleGetScripts} />
      <StatusBar />
      {showExport  && <ExportScriptsDialog onBack={() => setShowExport(false)} />}
      {showCompare && <RegCompareDialog    onBack={() => setShowCompare(false)} />}
      {showWelcome && <WelcomeModal onDismiss={handleWelcomeDismiss} />}
    </div>
  );
};

export default App;
