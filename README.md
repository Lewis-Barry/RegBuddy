# RegBuddy

> Windows Registry Editor in the browser — generate PowerShell scripts for Intune deployment

RegBuddy is a static single-page web app that replicates the Windows 11 Registry Editor experience in the browser. Browse a baseline registry snapshot, make changes (add/modify/delete keys and values), and export those changes as ready-to-use PowerShell scripts for Microsoft Intune.

**V1 is entirely offline — no authentication, no API calls, no backend.**

## Features

- **Windows 11 Registry Editor UI** — tree view, value table, context menus, edit dialogs — all matching the Win11 `regedit.exe` look and feel
- **Browse a registry baseline** — ships with a sample baseline; import your own `.reg` export
- **Full change tracking** — add, modify, and delete keys and values with visual highlighting (green/amber/red)
- **PowerShell script generation** — export as:
  - **Platform Script** (single remediation script) for Intune Devices > Scripts
  - **Remediation Script** (detection + remediation pair) for Intune Proactive Remediations
- **Syntax-highlighted preview** — VS Code Dark+ color palette for PowerShell scripts
- **Copy & download** — per-tab copy-to-clipboard and `.ps1` file download
- **Import `.reg` as changes** — diff a `.reg` file against the baseline and apply differences as changes

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ with npm

### Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
```

Output goes to `dist/` — deploy to any static hosting (GitHub Pages, Netlify, etc.).

## Usage

1. **Browse** the registry tree in the left panel; values appear in the right panel
2. **Make changes** — right-click for context menus, double-click values to edit
3. **Review changes** — the Changes Panel at the bottom shows all pending modifications
4. **Export scripts** — click **Get Scripts** to open the Export dialog:
   - Enter a **profile name** (used as filename prefix)
   - Choose **Platform Script** or **Remediation Script** mode
   - Copy or download the generated PowerShell `.ps1` files
5. **Deploy to Intune** — upload the scripts manually via the Intune portal

## Intune Deployment

### Platform Scripts

For **Intune > Devices > Scripts (PowerShell)**:

1. Click **Get Scripts** → select **Platform Script** mode
2. Download the **Remediation** script
3. In Intune portal: Devices → Scripts → Add → Windows 10 and later
4. Upload the `.ps1` file, configure run context (System for HKLM, User for HKCU), assign to groups

### Remediation Scripts (Proactive Remediations)

> Requires Intune P2, Intune Suite, or Windows E3/E5 licensing.

1. Click **Get Scripts** → select **Remediation Script** mode
2. Download **both** the Detection and Remediation scripts
3. In Intune portal: Devices → Scripts and Remediations → Remediations → Create
4. Upload detection script and remediation script separately
5. Set run context and schedule, assign to groups

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| State management | Zustand |
| Styling | CSS (Win11 Fluent Design tokens) |
| Hosting | Static files (GitHub Pages compatible) |

## Project Structure

```
src/
├── App.tsx                          # Root component
├── main.tsx                         # Entry point
├── registry/
│   ├── types.ts                     # RegistryKey, RegistryValue, RegistryChange
│   ├── parser.ts                    # .reg file parser
│   ├── powershellGenerator.ts       # Remediation + Detection script generators
│   └── sampleBaseline.ts            # Built-in sample registry data
├── store/
│   └── regBuddyStore.ts            # Zustand store (baseline, changes, merged tree)
├── components/
│   ├── layout/                      # MenuBar, AddressBar, StatusBar, SplitPane, ChangesPanel
│   ├── tree/                        # TreePanel (registry tree view)
│   ├── values/                      # ValuePanel (value table)
│   ├── dialogs/                     # EditValueDialog, NewValueDialog, ExportScriptsDialog
│   └── common/                      # ContextMenu, Icons
└── styles/
    ├── global.css                   # Win11 Fluent Design tokens, reset
    └── regedit.css                  # All component styles
```

## License

MIT
