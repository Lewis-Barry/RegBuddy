/**
 * Sample baseline registry data (subset) so the UI works out of the box
 * without needing a real .reg export.
 *
 * This is a representative slice — enough to demonstrate the tree + values UI.
 */

export const SAMPLE_REG_FILE = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT]

[HKEY_CLASSES_ROOT\\.txt]
@="txtfile"
"Content Type"="text/plain"
"PerceivedType"="text"

[HKEY_CLASSES_ROOT\\.txt\\OpenWithProgids]
"txtfile"=""

[HKEY_CLASSES_ROOT\\.exe]
@="exefile"
"Content Type"="application/x-msdownload"

[HKEY_CLASSES_ROOT\\.dll]
@="dllfile"
"Content Type"="application/x-msdownload"

[HKEY_CLASSES_ROOT\\.bat]
@="batfile"

[HKEY_CLASSES_ROOT\\.cmd]
@="cmdfile"

[HKEY_CLASSES_ROOT\\.ps1]
@="Microsoft.PowerShellScript.1"
"Content Type"="text/plain"

[HKEY_CLASSES_ROOT\\txtfile]
@="Text Document"
"FriendlyTypeName"="@%SystemRoot%\\\\system32\\\\notepad.exe,-469"

[HKEY_CLASSES_ROOT\\txtfile\\shell]

[HKEY_CLASSES_ROOT\\txtfile\\shell\\open]

[HKEY_CLASSES_ROOT\\txtfile\\shell\\open\\command]
@="%SystemRoot%\\\\system32\\\\NOTEPAD.EXE %1"

[HKEY_CURRENT_USER]

[HKEY_CURRENT_USER\\Software]

[HKEY_CURRENT_USER\\Software\\Microsoft]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer]
"ShellState"=hex:24,00,00,00,33,28,00,00,00,00,00,00,00,00,00,00
"Link"=hex:1b,00,00,00

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced]
"Hidden"=dword:00000002
"HideFileExt"=dword:00000001
"ShowSuperHidden"=dword:00000000
"LaunchTO"=dword:00000001
"TaskbarAl"=dword:00000001
"TaskbarMn"=dword:00000001
"TaskbarDa"=dword:00000001
"TaskbarSi"=dword:00000001
"ShowCopilotButton"=dword:00000001

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize]
"AppsUseLightTheme"=dword:00000001
"SystemUsesLightTheme"=dword:00000001
"EnableTransparency"=dword:00000001

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]
"OneDrive"="C:\\\\Users\\\\User\\\\AppData\\\\Local\\\\Microsoft\\\\OneDrive\\\\OneDrive.exe /background"
"SecurityHealth"="%ProgramFiles%\\\\Windows Defender\\\\MSASCuiL.exe"

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies]

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer]
"NoDriveTypeAutoRun"=dword:000000ff

[HKEY_CURRENT_USER\\Console]
"HistoryBufferSize"=dword:00000032
"NumberOfHistoryBuffers"=dword:00000004
"ScreenBufferSize"=dword:23290078
"WindowSize"=dword:001e0078
"QuickEdit"=dword:00000001
"InsertMode"=dword:00000001
"FaceName"="Cascadia Mono"
"FontSize"=dword:00120000
"FontWeight"=dword:00000190

[HKEY_CURRENT_USER\\Environment]
"TEMP"=hex(2):25,00,55,00,53,00,45,00,52,00,50,00,52,00,4f,00,46,00,49,00,4c,00,45,00,25,00,5c,00,41,00,70,00,70,00,44,00,61,00,74,00,61,00,5c,00,4c,00,6f,00,63,00,61,00,6c,00,5c,00,54,00,65,00,6d,00,70,00,00,00
"TMP"=hex(2):25,00,55,00,53,00,45,00,52,00,50,00,52,00,4f,00,46,00,49,00,4c,00,45,00,25,00,5c,00,41,00,70,00,70,00,44,00,61,00,74,00,61,00,5c,00,4c,00,6f,00,63,00,61,00,6c,00,5c,00,54,00,65,00,6d,00,70,00,00,00
"Path"=hex(2):25,00,55,00,53,00,45,00,52,00,50,00,52,00,4f,00,46,00,49,00,4c,00,45,00,25,00,5c,00,41,00,70,00,70,00,44,00,61,00,74,00,61,00,5c,00,4c,00,6f,00,63,00,61,00,6c,00,5c,00,4d,00,69,00,63,00,72,00,6f,00,73,00,6f,00,66,00,74,00,5c,00,57,00,69,00,6e,00,64,00,6f,00,77,00,73,00,41,00,70,00,70,00,73,00,00,00

[HKEY_CURRENT_USER\\AppEvents]

[HKEY_CURRENT_USER\\AppEvents\\Schemes]
@=".Default"

[HKEY_CURRENT_USER\\AppEvents\\Schemes\\Apps]

[HKEY_LOCAL_MACHINE]

[HKEY_LOCAL_MACHINE\\SOFTWARE]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion]
"ProgramFilesDir"="C:\\\\Program Files"
"CommonFilesDir"="C:\\\\Program Files\\\\Common Files"
"ProgramFilesDir (x86)"="C:\\\\Program Files (x86)"
"ProgramW6432Dir"="C:\\\\Program Files"
"CommonW6432Dir"="C:\\\\Program Files\\\\Common Files"
"DevicePath"=hex(2):25,00,53,00,79,00,73,00,74,00,65,00,6d,00,52,00,6f,00,6f,00,74,00,25,00,5c,00,69,00,6e,00,66,00,00,00
"MediaPathUnexpanded"=hex(2):25,00,53,00,79,00,73,00,74,00,65,00,6d,00,52,00,6f,00,6f,00,74,00,25,00,5c,00,4d,00,65,00,64,00,69,00,61,00,00,00

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run]
"SecurityHealth"="%ProgramFiles%\\\\Windows Defender\\\\MSASCuiL.exe"
"iTunesHelper"="C:\\\\Program Files\\\\iTunes\\\\iTunesHelper.exe"

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System]
"EnableLUA"=dword:00000001
"ConsentPromptBehaviorAdmin"=dword:00000005
"ConsentPromptBehaviorUser"=dword:00000003
"PromptOnSecureDesktop"=dword:00000001
"EnableInstallerDetection"=dword:00000001
"ValidateAdminCodeSignatures"=dword:00000000
"EnableSecureUIAPaths"=dword:00000001
"FilterAdministratorToken"=dword:00000000

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer]
"SmartScreenEnabled"="Warn"

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion]
"ProductName"="Windows 11 Pro"
"DisplayVersion"="23H2"
"CurrentBuildNumber"="22631"
"EditionID"="Professional"
"InstallationType"="Client"
"RegisteredOrganization"=""
"RegisteredOwner"="User"
"CurrentBuild"="22631"
"BuildLab"="22631.ni_release.230913-1631"

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows Defender\\Real-Time Protection]
"DisableRealtimeMonitoring"=dword:00000000

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate]

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU]
"NoAutoUpdate"=dword:00000000
"AUOptions"=dword:00000003

[HKEY_LOCAL_MACHINE\\SYSTEM]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management]
"ClearPageFileAtShutdown"=dword:00000000
"PagingFiles"=hex(7):63,00,3a,00,5c,00,70,00,61,00,67,00,65,00,66,00,69,00,6c,00,65,00,2e,00,73,00,79,00,73,00,00,00,00,00

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server]
"fDenyTSConnections"=dword:00000001
"fSingleSessionPerUser"=dword:00000001

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters]
"SMB1"=dword:00000000
"SMB2"=dword:00000001

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip]

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters]
"Hostname"="DESKTOP-WIN11"
"Domain"=""
"SearchList"=""

[HKEY_LOCAL_MACHINE\\HARDWARE]

[HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION]

[HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System]
"SystemBiosVersion"=hex(7):44,00,45,00,4c,00,4c,00,20,00,2d,00,20,00,31,00,00,00,00,00

[HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor]

[HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0]
"ProcessorNameString"="13th Gen Intel(R) Core(TM) i7-13700K"
"~MHz"=dword:00001450
"VendorIdentifier"="GenuineIntel"
"Identifier"="Intel64 Family 6 Model 183 Stepping 1"

[HKEY_USERS]

[HKEY_USERS\\.DEFAULT]

[HKEY_USERS\\.DEFAULT\\Software]

[HKEY_USERS\\.DEFAULT\\Software\\Microsoft]

[HKEY_USERS\\.DEFAULT\\Software\\Microsoft\\Windows]

[HKEY_USERS\\.DEFAULT\\Software\\Microsoft\\Windows\\CurrentVersion]

[HKEY_USERS\\.DEFAULT\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer]

[HKEY_USERS\\.DEFAULT\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced]
"Hidden"=dword:00000002
"ShowSuperHidden"=dword:00000000

[HKEY_CURRENT_CONFIG]

[HKEY_CURRENT_CONFIG\\Software]

[HKEY_CURRENT_CONFIG\\Software\\Fonts]
"FIXEDFON.FON"="vgafix.fon"
"OEMFONT.FON"="vga850.fon"

[HKEY_CURRENT_CONFIG\\System]

[HKEY_CURRENT_CONFIG\\System\\CurrentControlSet]

[HKEY_CURRENT_CONFIG\\System\\CurrentControlSet\\Control]

[HKEY_CURRENT_CONFIG\\System\\CurrentControlSet\\Control\\Print]

[HKEY_CURRENT_CONFIG\\System\\CurrentControlSet\\Control\\Print\\Printers]
`;
