# RegBuddy — Plan

> Windows Registry Editor in the browser — generate PowerShell scripts for Intune deployment  
> *MVP-first approach — ship core browse/edit/script-export, iterate from there*

---

## Version History

| Version | Scope |
|---------|-------|
| **V1 (current)** | No Intune API integration. Browse registry baseline, make changes, generate and copy/download PowerShell scripts for manual deployment via Intune Platform Scripts or Remediation Scripts. |
| **V2 (planned)** | Direct Intune Graph API integration — auto-upload scripts, manage deployments from within the app. |

---

## 1. Overview

RegBuddy is a static single-page web app (hostable on GitHub Pages) that replicates the Windows 11 Registry Editor experience in the browser. Users browse a baseline registry snapshot, make changes (add/modify/delete keys and values), and export those changes as ready-to-use PowerShell scripts.

**V1 is entirely offline — no authentication, no API calls, no backend.** The generated scripts can be manually deployed via:

- **Intune Platform Scripts** — upload the single remediation script as a PowerShell platform script
- **Intune Remediation Scripts** — upload both a detection script and a remediation script for proactive remediations (requires appropriate Intune licensing)

Users copy the script(s) from the in-app preview or download them as `.ps1` files.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (React SPA)                │
│                                                     │
│  ┌──────────────────┐     ┌────────────────────┐   │
│  │  Registry         │     │  Script Generator  │   │
│  │  Tree UI          │────▶│  (PowerShell)      │   │
│  │  (browse/edit)    │     └────────┬───────────┘   │
│  └──────────────────┘              │                │
│                                    ▼                │
│  ┌──────────────────┐     ┌────────────────────┐   │
│  │  .reg Parser     │     │  Script Export UI  │   │
│  │  (in-browser)    │     │  (copy / download) │   │
│  └──────────────────┘     └────────────────────┘   │
│                                                     │
│  No auth. No API calls. Fully offline.              │
└─────────────────────────────────────────────────────┘
```

**Key design decision:** No backend server. Everything runs client-side:
- No authentication required in V1
- `.reg` file parsing happens in-browser
- PowerShell script generation happens in-browser
- Scripts are exported via copy-to-clipboard or `.ps1` file download
- The user manually uploads the generated script(s) to Intune

**Hosting:** Local dev via Vite dev server → production deploy to GitHub Pages (static files only)

---

## 3. Tech Stack

| Layer            | Technology                                    | V1? |
|------------------|-----------------------------------------------|-----|
| Framework        | React 18 + TypeScript                         | ✅  |
| Build tool       | Vite                                          | ✅  |
| Styling          | CSS Modules (Win11 Fluent-style theming)      | ✅  |
| State mgmt       | Zustand (lightweight, good for tree state)    | ✅  |
| Tree view        | Custom component (match Win11 regedit exactly)| ✅  |
| Script export    | Copy-to-clipboard API + Blob download         | ✅  |
| Auth             | MSAL.js v2 (`@azure/msal-browser`)            | ❌ V2 |
| API              | Microsoft Graph JS SDK                        | ❌ V2 |
| .intunewin build | Custom JS (in-browser ZIP + encryption)       | ❌ V2 |
| Hosting          | GitHub Pages (static SPA)                     | ✅  |
| Local dev        | Vite dev server                               | ✅  |

---

## 4. Auth — V1 (None Required)

V1 requires **no authentication**. The app operates entirely in the browser with no API calls to Microsoft services.

The user generates scripts locally, then manually deploys them through the Intune portal or via their own tooling.

> **V2 note:** Entra ID auth (MSAL.js SPA flow) will be added in V2 to enable direct Graph API integration. Required permissions will be `DeviceManagementApps.ReadWrite.All`, `DeviceManagementConfiguration.ReadWrite.All` (for remediation scripts), `Group.Read.All`, and `User.Read`.

---

## 5. Registry Baseline

### 5.1 Source Data

- **Default:** Ship a pre-exported `.reg` file from a clean Windows 11 machine (all 5 hives)
- **Override:** User can upload their own `.reg` export to replace the baseline
- Hives supported: `HKEY_LOCAL_MACHINE`, `HKEY_CURRENT_USER`, `HKEY_CLASSES_ROOT`, `HKEY_USERS`, `HKEY_CURRENT_CONFIG`

### 5.2 .reg File Parser

Build an in-browser parser that handles the Windows `.reg` format:
- Header: `Windows Registry Editor Version 5.00`
- Key paths: `[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows]`
- Value types: `REG_SZ`, `REG_DWORD`, `REG_QWORD`, `REG_BINARY`, `REG_EXPAND_SZ`, `REG_MULTI_SZ`
- Default values: `@="value"`
- Deletion markers: `-` prefix on keys, value deletion syntax
- Hex continuation lines (backslash line continuations)

**Output:** Parsed into an in-memory tree structure:

```typescript
interface RegistryKey {
  path: string;           // Full path e.g. "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft"
  name: string;           // Leaf name e.g. "Microsoft"
  children: RegistryKey[];
  values: RegistryValue[];
}

interface RegistryValue {
  name: string;           // Value name ("" for default)
  type: RegistryValueType;
  data: string | number | Buffer;
}

type RegistryValueType = 
  | 'REG_SZ' 
  | 'REG_DWORD' 
  | 'REG_QWORD' 
  | 'REG_BINARY' 
  | 'REG_EXPAND_SZ' 
  | 'REG_MULTI_SZ' 
  | 'REG_NONE';
```

### 5.3 Baseline Storage

- Default `.reg` file is bundled in the app's `public/` directory (compressed with gzip)
- On first load, parse and cache in IndexedDB for fast subsequent loads
- User-uploaded `.reg` files also cached in IndexedDB

---

## 6. UI — Windows 11 Registry Editor Clone

### 6.1 Layout

Match the Win11 `regedit.exe` layout exactly:

```
┌──────────────────────────────────────────────────────────────┐
│  File   Edit   View   Favorites   Help                       │
├────────────────────┬─────────────────────────────────────────┤
│                    │ Name          │ Type      │ Data         │
│  ▶ Computer        │──────────────┼───────────┼─────────────│
│    ▶ HKEY_CLASSES…│ (Default)     │ REG_SZ    │ (value not… │
│    ▼ HKEY_CURREN…  │ SomeValue     │ REG_DWORD │ 0x00000001  │
│      ▶ AppEvents   │ AnotherVal    │ REG_SZ    │ Hello        │
│      ▶ Console     │               │           │              │
│      ▶ Control P…  │               │           │              │
│      ▶ Environment │               │           │              │
│    ▶ HKEY_LOCAL…  │               │           │              │
│    ▶ HKEY_USERS    │               │           │              │
│    ▶ HKEY_CURREN…│               │           │              │
│                    │               │           │              │
├────────────────────┴───────────────┴───────────┴─────────────┤
│  Computer\HKEY_CURRENT_USER\Console                          │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Visual Components

| Component             | Description                                                    |
|-----------------------|----------------------------------------------------------------|
| **Tree Panel (left)** | Hierarchical tree with expand/collapse. Folder icons. Matches Win11 style. |
| **Value Panel (right)**| Table with columns: Name, Type, Data. Sortable.              |
| **Address Bar (bottom)**| Shows current key path (like regedit status bar)            |
| **Menu Bar**          | File (Import .reg, Export, Connect to Intune), Edit (New Key, New Value, Delete, Rename, Modify), View, Favorites |
| **Context Menus**     | Right-click on tree nodes and values — same options as regedit |
| **Edit Dialogs**      | Modal dialogs for editing values (String, DWORD, Binary, Multi-String) — match Win11 styling |

### 6.3 Change Highlighting

Changes are visually distinguished from baseline:

| Change Type     | Visual Indicator                                     |
|-----------------|------------------------------------------------------|
| **New key**     | Key name in **green** text, green folder icon         |
| **New value**   | Row highlighted with green-tinted background          |
| **Modified value** | Row highlighted with yellow/amber-tinted background|
| **Deleted key** | ~~Strikethrough~~ with red-tinted text, dimmed        |
| **Deleted value**| ~~Strikethrough~~ row with red-tinted background     |

A **Changes Summary panel** (toggleable sidebar or bottom panel) lists all pending changes in a flat list for quick review before deploying.

### 6.4 Theming

- Match Windows 11 Fluent Design: Mica-like background, rounded corners on menus, Segoe UI Variable font
- Light mode default (dark mode stretch goal)

---

## 7. Change Tracking & State Management

### 7.1 Change Model

```typescript
interface RegistryChange {
  id: string;
  type: 'add-key' | 'delete-key' | 'add-value' | 'modify-value' | 'delete-value';
  path: string;             // Full registry path
  valueName?: string;       // For value operations
  valueType?: RegistryValueType;
  newData?: string | number | Buffer;
  originalData?: string | number | Buffer; // For modify — what it was before
  timestamp: number;
}
```

### 7.2 State Store (Zustand)

```typescript
interface RegBuddyStore {
  // Baseline tree (immutable after load)
  baseline: RegistryKey;
  
  // Pending changes (the diff)
  changes: RegistryChange[];
  
  // Computed merged tree (baseline + changes applied) — used by UI
  mergedTree: RegistryKey;
  
  // Currently selected key path
  selectedPath: string;
  
  // UI state
  expandedNodes: Set<string>;
  
  // Actions
  addChange: (change: RegistryChange) => void;
  removeChange: (changeId: string) => void;
  clearAllChanges: () => void;
  importChangesFromManifest: (manifest: ChangeManifest) => void;
}
```

---

## 8. PowerShell Script Generation

RegBuddy generates two distinct PowerShell scripts from the change list, supporting both Intune deployment methods:

### 8.1 Remediation Script (Install / Apply)

Applies all registry changes. Used as:
- The **sole script** when deploying via Intune **Platform Scripts** (PowerShell)
- The **remediation** half when deploying via Intune **Remediation Scripts**

```powershell
<#
  RegBuddy Remediation Script
  Generated: 2026-03-04T12:00:00Z
  Profile: <profile-name>
  Changes: <count>
#>

# --- Add/Modify Keys ---
# New key: HKLM\SOFTWARE\MyCompany
if (-not (Test-Path "HKLM:\SOFTWARE\MyCompany")) {
    New-Item -Path "HKLM:\SOFTWARE\MyCompany" -Force | Out-Null
}

# Set value: HKLM\SOFTWARE\MyCompany -> Setting1 (REG_DWORD) = 1
Set-ItemProperty -Path "HKLM:\SOFTWARE\MyCompany" -Name "Setting1" -Value 1 -Type DWord -Force

# Delete value: HKLM\SOFTWARE\OldApp -> LegacyKey
Remove-ItemProperty -Path "HKLM:\SOFTWARE\OldApp" -Name "LegacyKey" -ErrorAction SilentlyContinue

# Delete key: HKLM\SOFTWARE\Deprecated
Remove-Item -Path "HKLM:\SOFTWARE\Deprecated" -Recurse -Force -ErrorAction SilentlyContinue

exit 0
```

### 8.2 Detection Script

Verifies all changes are already in the desired state. Used **only** when deploying via Intune **Remediation Scripts** — it tells Intune whether the remediation script needs to run.

```powershell
<#
  RegBuddy Detection Script
  Generated: 2026-03-04T12:00:00Z
  Profile: <profile-name>
  Verifies registry changes are applied — exit 0 = compliant, exit 1 = run remediation
#>

$allGood = $true

# Check: HKLM\SOFTWARE\MyCompany\Setting1 = 1 (DWORD)
try {
    $val = Get-ItemPropertyValue -Path "HKLM:\SOFTWARE\MyCompany" -Name "Setting1" -ErrorAction Stop
    if ($val -ne 1) { $allGood = $false }
} catch { $allGood = $false }

# Check: HKLM\SOFTWARE\OldApp\LegacyKey should NOT exist
$exists = Get-ItemProperty -Path "HKLM:\SOFTWARE\OldApp" -Name "LegacyKey" -ErrorAction SilentlyContinue
if ($null -ne $exists) { $allGood = $false }

if ($allGood) {
    Write-Output "Compliant"
    exit 0
} else {
    Write-Output "Not compliant"
    exit 1
}
```

### 8.3 Script Export UI

The **Get Scripts** dialog (triggered via menu or the Changes panel) presents the generated scripts with a tabbed UI:

```
┌─────────────────────────────────────────────────────────────────┐
│  Export Scripts                                                  │
│                                                                  │
│  Deployment mode:  ○ Platform Script   ● Remediation Script     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Detection  │  Remediation  │                            │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  <syntax-highlighted PowerShell>                         │  │  
│  │                                                          │  │
│  │  ...                                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│           [Copy to Clipboard]   [Download .ps1]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Deployment mode behaviour:**

| Mode | Tabs shown | Description |
|------|-----------|-------------|
| **Platform Script** | Remediation only | Single script — upload to Intune > Devices > Scripts |
| **Remediation Script** | Detection + Remediation | Two scripts — upload to Intune > Reports > Endpoint Analytics > Proactive Remediations |

Both tabs include individual **Copy** and **Download** buttons. The download filename is auto-named: `<profile-name>-detection.ps1` / `<profile-name>-remediation.ps1`.

---

## 9. Intune Deployment (Manual — V1)

In V1, RegBuddy does not connect to the Intune API. The user manually takes the generated scripts and uploads them through the Intune portal.

### 9.1 Platform Scripts Deployment

For **Intune > Devices > Scripts (PowerShell)**:

1. Click **Get Scripts** in RegBuddy → select **Platform Script** mode
2. Copy or download the **Remediation** script
3. In Intune portal: Devices → Scripts → Add → Windows 10 and later
4. Upload the `.ps1` file, configure run context (System/User), assign to groups

### 9.2 Remediation Scripts Deployment

For **Intune > Reports > Endpoint Analytics > Proactive Remediations** (requires Intune P2 / Intune Suite licensing):

1. Click **Get Scripts** in RegBuddy → select **Remediation Script** mode
2. Copy or download **both** the Detection script and the Remediation script
3. In Intune portal: Reports → Endpoint Analytics → Proactive Remediations → Create script package
4. Upload detection script and remediation script separately, assign to groups

### 9.3 V2 Roadmap: Direct Graph API Integration

In V2, RegBuddy will auto-upload scripts directly to Intune via Graph API:
- Auth via MSAL.js (Entra ID SPA flow)
- `POST /deviceManagement/deviceManagementScripts` — platform script upload
- `POST /deviceManagement/deviceHealthScripts` — remediation script upload (detection + remediation)
- Group picker for assignment targets
- Deployment history — rediscover previously created scripts by parsing their descriptions for an embedded RegBuddy change manifest

---

## 10. Script Export UI

### 10.1 Workflow

1. User makes changes in the registry editor (add/modify/delete keys and values)
2. The **Changes panel** shows a live count of pending changes
3. User clicks **Get Scripts** (in menu bar or Changes panel)
4. The **Export Scripts** dialog opens:
   - **Profile name** — auto-suggested from most-changed paths, editable; used as script filename prefix
   - **Changes summary** — collapsible list of all pending changes
   - **Deployment mode selector:**
     - `Platform Script` — single Remediation tab
     - `Remediation Script` — Detection tab + Remediation tab
   - **Script tabs** with syntax highlighting
   - Per-tab **Copy** button and **Download .ps1** button
5. User copies or downloads the required script(s), then manually uploads to Intune

### 10.2 Changes Panel

A collapsible sidebar panel (right side or bottom) lists all pending changes:

| Column | Description |
|--------|-------------|
| Type | Icon + badge: `+ key`, `+ value`, `✎ value`, `✕ key`, `✕ value` |
| Path | Registry path (truncated with tooltip) |
| Detail | Value name → old data → new data (for modify) |

Actions available:
- **Revert individual change** — undo a single item
- **Clear all** — discard all pending changes
- **Get Scripts** — open Export Scripts dialog

---

## 11. Project Structure (V1)

```
RegBuddy/
├── public/
│   ├── baseline/
│   │   └── win11-default.reg.gz     # Compressed baseline registry export
│   └── favicon.ico
├── src/
│   ├── main.tsx                      # App entry
│   ├── App.tsx                       # Root component
│   ├── registry/
│   │   ├── parser.ts                 # .reg file parser
│   │   ├── types.ts                  # RegistryKey, RegistryValue, etc.
│   │   ├── tree.ts                   # Tree data structure utilities
│   │   └── baseline.ts               # Load/cache baseline from file or IndexedDB
│   ├── changes/
│   │   ├── types.ts                  # RegistryChange types
│   │   ├── store.ts                  # Zustand store
│   │   └── diff.ts                   # Compute merged tree from baseline + changes
│   ├── scripts/
│   │   ├── remediation.ts            # PowerShell remediation script generator
│   │   └── detection.ts              # PowerShell detection script generator
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MenuBar.tsx           # File, Edit, View, Favorites, Help
│   │   │   ├── StatusBar.tsx         # Bottom path bar
│   │   │   ├── SplitPane.tsx         # Resizable left/right split
│   │   │   ├── ChangesPanel.tsx      # Collapsible changes summary sidebar
│   │   │   └── AddressBar.tsx        # Current key path display
│   │   ├── tree/
│   │   │   ├── TreePanel.tsx         # Left panel — registry tree
│   │   │   ├── TreeNode.tsx          # Single expandable tree node
│   │   │   └── TreeNode.module.css
│   │   ├── values/
│   │   │   ├── ValuePanel.tsx        # Right panel — value table
│   │   │   ├── ValueRow.tsx          # Single value row
│   │   │   └── ValuePanel.module.css
│   │   ├── dialogs/
│   │   │   ├── EditStringDialog.tsx  # Edit REG_SZ / REG_EXPAND_SZ
│   │   │   ├── EditDwordDialog.tsx   # Edit REG_DWORD / REG_QWORD
│   │   │   ├── EditBinaryDialog.tsx  # Edit REG_BINARY
│   │   │   ├── EditMultiStringDialog.tsx
│   │   │   ├── NewKeyDialog.tsx
│   │   │   ├── NewValueDialog.tsx
│   │   │   ├── ExportScriptsDialog.tsx  # Get Scripts dialog with tabs
│   │   │   └── ImportRegDialog.tsx      # Upload custom .reg baseline
│   │   └── common/
│   │       ├── ContextMenu.tsx
│   │       ├── Dialog.tsx
│   │       ├── ScriptViewer.tsx      # Syntax-highlighted PS1 with copy/download
│   │       └── Icon.tsx              # Win11-style icons
│   ├── hooks/
│   │   └── useRegistryTree.ts
│   ├── utils/
│   │   └── regFormat.ts              # Format values for display (hex, decimal, etc.)
│   └── styles/
│       ├── global.css                # Win11 Fluent design tokens
│       ├── regedit.css               # Registry editor specific styles
│       └── variables.css             # CSS custom properties
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

> **V2 additions:** `src/auth/` (MSAL config + provider), `src/api/` (Graph client, Intune scripts API, groups API), `src/hooks/useAuth.ts`, `src/hooks/useIntuneScripts.ts`, `.env.example`

---

## 12. V1 Milestones

### Phase 1: Foundation (Week 1-2)
- [ ] Project scaffold (Vite + React + TypeScript)
- [ ] `.reg` file parser — handles all value types and edge cases
- [ ] Baseline loading — ship default `.reg`, parse into tree, cache in IndexedDB

### Phase 2: Registry UI (Week 2-4)
- [ ] Tree panel with expand/collapse, Win11 styling
- [ ] Value panel (table) with proper type display
- [ ] Status bar / address bar showing current path
- [ ] Context menus (right-click) for tree + values
- [ ] Edit dialogs for all value types (String, DWORD, QWORD, Binary, Multi-String)
- [ ] New key / New value creation
- [ ] Delete key / Delete value
- [ ] Rename (key + value)
- [ ] Change highlighting (green/yellow/red)

### Phase 3: Script Generation & Export (Week 4-5)
- [ ] PowerShell remediation script generator from change list
- [ ] PowerShell detection script generator
- [ ] Export Scripts dialog with Platform Script / Remediation Script mode selector
- [ ] Detection and Remediation tabs with syntax highlighting
- [ ] Copy-to-clipboard and download `.ps1` per tab
- [ ] Profile name input → used as script filename prefix

### Phase 4: Polish (Week 5-6)
- [ ] Changes panel — list all pending changes with revert per item
- [ ] Upload custom `.reg` baseline
- [ ] Import `.reg` file to apply as changes on top of baseline
- [ ] Error handling and edge cases
- [ ] README with Intune deployment instructions for both modes

---

## 13. Future Iterations

### V2 — Direct Intune Integration
- **Entra ID auth** — MSAL.js SPA flow (no backend needed)
- **Platform Script upload** — `POST /deviceManagement/deviceManagementScripts` with raw `.ps1`
- **Remediation Script upload** — `POST /deviceManagement/deviceHealthScripts` with detection + remediation `.ps1`
- **Group picker** — search Entra ID groups for assignment targets
- **Deployment history** — rediscover previously uploaded RegBuddy scripts; embed change manifest in script description field for round-trip editing
- **Update existing scripts** — detect and PATCH existing scripts instead of creating duplicates

### V3 and Beyond
- **Dark mode** — Win11 dark theme
- **Undo/Redo** — change history stack
- **Search** — find keys/values by name (Ctrl+F like regedit)
- **Favorites** — bookmark frequently edited paths
- **Export as .reg** — export pending changes as a `.reg` file
- **Diff view** — side-by-side baseline vs modified
- **Deployment status** — check if Intune script ran successfully on target devices
- **Rollback scripts** — generate scripts to undo changes
- **Multiple baselines** — manage different Windows versions (Win10, Win11 22H2, 23H2, etc.)
- **Conflict detection** — warn if two profiles modify the same key
- **Template library** — pre-built profiles for common scenarios (disable Cortana, kiosk mode, etc.)

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large `.reg` files slow down browser | Poor UX on baseline load | Lazy-load tree nodes; only parse expanded paths; use Web Workers for parsing |
| Baseline drift from real machines | User confusion about missing keys | Allow custom `.reg` upload; clearly label baseline as "reference" |
| PowerShell syntax errors in generated scripts | Failed deployment | Unit-test generator against all change types; include error handling (`-ErrorAction`) in all cmdlets |
| Detection script false negatives | Remediation runs unnecessarily | Verify exit codes match Intune expectations (0 = compliant, 1 = not compliant, non-zero = error) |
| User uploads wrong scripts (detection in remediation slot) | Silent deployment failure | Clearly label scripts in the UI; README includes step-by-step portal instructions |

---

## 15. Intune Deployment Quick Reference

This replaces the Entra ID setup section for V1 — no app registration needed.

### Platform Scripts (PowerShell)

1. Intune portal → **Devices** → **Scripts** → **Add** → **Windows 10 and later**
2. Name the script, upload the `.ps1` file from RegBuddy (**Remediation** script)
3. Run script in the context of **System** (for HKLM) or **User** (for HKCU)
4. Assign to a device or user group → **Save**

### Remediation Scripts (Proactive Remediations)

> Requires Intune P2, Intune Suite, or Windows E3/E5 licensing.

1. Intune portal → **Reports** → **Endpoint Analytics** → **Proactive Remediations** → **Create script package**
2. Name the package
3. Upload **Detection script** (from RegBuddy Detection tab)
4. Upload **Remediation script** (from RegBuddy Remediation tab)
5. Run in the correct context (System/User), set schedule, assign to groups → **Create**

> **V2:** These steps will be automated directly from within RegBuddy once Intune Graph API integration is added.
