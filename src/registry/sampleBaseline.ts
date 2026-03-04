/**
 * Skeleton baseline registry data.
 *
 * Purpose: give the tree enough structure so users can navigate to common
 * destinations without typing full paths — particularly the paths cited in
 * KB articles, security advisories, and vendor "apply this reg fix" docs.
 *
 * Deliberately excludes:
 *   - HKCR  (file associations — not a target for Intune-deployed reg fixes)
 *   - \Policies\* and \PolicyManager  (GPO / MDM CSP output paths — not inputs)
 *   - HARDWARE\DESCRIPTION  (read-only machine identity, never written via Intune)
 *   - HKU\.DEFAULT  (rarely targeted; users can add the path manually)
 *
 * Values shown are Windows 11 defaults where known, or absent where the key
 * is typically only populated after a deliberate change.
 */

export const SAMPLE_REG_FILE = `Windows Registry Editor Version 5.00

; ─────────────────────────────────────────────────────────────────────────────
; HKEY_LOCAL_MACHINE
; ─────────────────────────────────────────────────────────────────────────────

[HKEY_LOCAL_MACHINE]

[HKEY_LOCAL_MACHINE\\SOFTWARE]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft]

; ── OS identity (reference only — these ship with Windows, you don't set them) ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion]
"ProductName"="Windows 11 Pro"
"DisplayVersion"="24H2"
"CurrentBuildNumber"="26100"
"EditionID"="Professional"
"InstallationType"="Client"
"RegisteredOrganization"=""
"RegisteredOwner"=""

; ── Shell / Explorer behaviour ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer]
"SmartScreenEnabled"="Warn"

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall]

; ── Authentication / credential providers ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\Credential Providers]

; ── Windows Update ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update]

; ── Defender / security ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Real-Time Protection]
"DisableRealtimeMonitoring"=dword:00000000
"DisableBehaviorMonitoring"=dword:00000000
"DisableOnAccessProtection"=dword:00000000
"DisableScanOnRealtimeEnable"=dword:00000000

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Features]
"TamperProtection"=dword:00000005

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Exclusions]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Exclusions\\Paths]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Exclusions\\Extensions]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Exclusions\\Processes]

; ── Edge ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Edge]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\EdgeUpdate]

; ── .NET / CLR ──

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\.NETFramework]

; ── SYSTEM hive ──

[HKEY_LOCAL_MACHINE\\SYSTEM]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control]

; ── LSA / credential security
; Common targets: Pass-the-Hash mitigations, RunAsPPL, NTLM restrictions ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa]
"RunAsPPL"=dword:00000002
"LimitBlankPasswordUse"=dword:00000001
"NoLMHash"=dword:00000001
"LmCompatibilityLevel"=dword:00000003
"RestrictAnonymous"=dword:00000001
"RestrictAnonymousSAM"=dword:00000001
"DisableDomainCreds"=dword:00000000
"EveryoneIncludesAnonymous"=dword:00000000

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\MSV1_0]
"NTLMMinClientSec"=dword:20080030
"NTLMMinServerSec"=dword:20080030

; ── WDigest — disable plaintext credential caching in memory ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest]
"UseLogonCredential"=dword:00000000

; ── Virtualization-Based Security / Credential Guard / HVCI ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard]
"EnableVirtualizationBasedSecurity"=dword:00000001
"RequirePlatformSecurityFeatures"=dword:00000001

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity]
"Enabled"=dword:00000001
"WasEnabledBy"=dword:00000002

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\CredentialGuard]
"Enabled"=dword:00000001
"WasEnabledBy"=dword:00000002

; ── UAC (configured directly, not via Policies path) ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel]
"DisableExceptionChainValidation"=dword:00000000

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management]
"ClearPageFileAtShutdown"=dword:00000000
"FeatureSettingsOverride"=dword:00000000
"FeatureSettingsOverrideMask"=dword:00000000

; ── Terminal Server / RDP ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server]
"fDenyTSConnections"=dword:00000001
"fSingleSessionPerUser"=dword:00000001

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp]
"UserAuthentication"=dword:00000001
"MinEncryptionLevel"=dword:00000003

; ── Power ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Power]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes]

; ── Services ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services]

; SMB server (LanmanServer) — common: disable SMBv1, enforce signing ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters]
"SMB1"=dword:00000000
"SMB2"=dword:00000001
"RequireSecuritySignature"=dword:00000000
"EnableSecuritySignature"=dword:00000001

; SMB client (LanmanWorkstation) ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters]
"RequireSecuritySignature"=dword:00000000
"EnableSecuritySignature"=dword:00000001

; WinRM ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WinRM]

; TCP/IP ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters]
"DisableIPSourceRouting"=dword:00000002
"EnableICMPRedirect"=dword:00000000
"TcpMaxDataRetransmissions"=dword:00000003
"PerformRouterDiscovery"=dword:00000000

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters]
"DisableIPSourceRouting"=dword:00000002

; ── Event Log ──

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\EventLog]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\EventLog\\Security]
"MaxSize"=dword:00400000

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\EventLog\\System]
"MaxSize"=dword:00400000

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\EventLog\\Application]
"MaxSize"=dword:00400000

; ─────────────────────────────────────────────────────────────────────────────
; HKEY_CURRENT_USER  (per-user context — scripts targeting this hive
;  should run as the user or use HKU\%SID% in SYSTEM context)
; ─────────────────────────────────────────────────────────────────────────────

[HKEY_CURRENT_USER]

[HKEY_CURRENT_USER\\Software]

[HKEY_CURRENT_USER\\Software\\Microsoft]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion]

; ── Explorer / shell ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced]
"Hidden"=dword:00000002
"HideFileExt"=dword:00000001
"ShowSuperHidden"=dword:00000000
"LaunchTO"=dword:00000001
"TaskbarAl"=dword:00000001
"TaskbarDa"=dword:00000001
"ShowCopilotButton"=dword:00000001

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\AutoplayHandlers]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\AutoplayHandlers\\UserChosenExecuteHandlers]

; ── Personalisation / themes ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize]
"AppsUseLightTheme"=dword:00000001
"SystemUsesLightTheme"=dword:00000001
"EnableTransparency"=dword:00000001

; ── Startup ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce]

; ── Internet Settings (proxy, zones, TLS) — frequently cited in fixes ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings]
"ProxyEnable"=dword:00000000

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\\Zones]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\\ZoneMap]

; ── Search / Recall / Copilot feature toggles ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Search]

; ── Office ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Office]

; ── Edge (user-level) ──

[HKEY_CURRENT_USER\\Software\\Microsoft\\Edge]

; ── Console / Terminal ──

[HKEY_CURRENT_USER\\Console]
"HistoryBufferSize"=dword:00000032
"QuickEdit"=dword:00000001
"InsertMode"=dword:00000001
"FaceName"="Cascadia Mono"

; ── Environment ──

[HKEY_CURRENT_USER\\Environment]

; ─────────────────────────────────────────────────────────────────────────────
; HKEY_USERS  (used when targeting per-user keys from SYSTEM context)
; ─────────────────────────────────────────────────────────────────────────────

[HKEY_USERS]

; ─────────────────────────────────────────────────────────────────────────────
; HKEY_CLASSES_ROOT  (structural stub only)
; ─────────────────────────────────────────────────────────────────────────────

[HKEY_CLASSES_ROOT]

; ─────────────────────────────────────────────────────────────────────────────
; HKEY_CURRENT_CONFIG  (structural stub only)
; ─────────────────────────────────────────────────────────────────────────────

[HKEY_CURRENT_CONFIG]
`;
