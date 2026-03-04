import React, { useState } from 'react';
import { MenuBar } from './components/layout/MenuBar';
import { AddressBar } from './components/layout/AddressBar';
import { StatusBar } from './components/layout/StatusBar';
import { SplitPane } from './components/layout/SplitPane';
import { ChangesPanel } from './components/layout/ChangesPanel';
import { TreePanel } from './components/tree/TreePanel';
import { ValuePanel } from './components/values/ValuePanel';
import { ExportScriptsDialog } from './components/dialogs/ExportScriptsDialog';

const App: React.FC = () => {
  const [showExport, setShowExport] = useState(false);

  const handleGetScripts = () => setShowExport(true);

  return (
    <div className="regedit" style={{ position: 'relative' }}>
      <MenuBar onGetScripts={handleGetScripts} />
      <AddressBar />
      <SplitPane
        left={<TreePanel />}
        right={<ValuePanel />}
        defaultLeftWidth={320}
      />
      <ChangesPanel onGetScripts={handleGetScripts} />
      <StatusBar />
      {showExport && <ExportScriptsDialog onBack={() => setShowExport(false)} />}
    </div>
  );
};

export default App;
