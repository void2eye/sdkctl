#define AppName "sdkctl"
#define AppVersion "0.1.3"
#define AppPublisher "void2eye"
#define AppExeName "sdkctl.exe"

[Setup]
AppId={{3B3ED984-E694-4CAB-8EAA-EAF05453ED2C}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://github.com/void2eye
AppSupportURL=https://github.com/void2eye/sdkctl/issues
AppUpdatesURL=https://github.com/void2eye/sdkctl/releases
DefaultDirName=D:\Software\sdkctl
DefaultGroupName=sdkctl
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\installer
OutputBaseFilename=sdkctl-setup-{#AppVersion}-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern dynamic
UninstallDisplayIcon={app}\sdkctl-core.exe
ChangesEnvironment=yes
CloseApplications=no
VersionInfoCompany=void2eye
VersionInfoDescription=sdkctl SDK version manager
VersionInfoProductName=sdkctl
VersionInfoProductVersion={#AppVersion}
VersionInfoVersion={#AppVersion}
VersionInfoCopyright=Copyright (C) 2026 void2eye

[Languages]
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\dist\sdkctl.exe"; DestDir: "{app}"; DestName: "sdkctl-core.exe"; Flags: ignoreversion
Source: "sdkctl.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "powershell\*"; DestDir: "{commonpf}\WindowsPowerShell\Modules\sdkctl\{#AppVersion}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "powershell\*"; DestDir: "{commonpf}\PowerShell\Modules\sdkctl\{#AppVersion}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
Type: files; Name: "{app}\sdk.cmd"
Type: files; Name: "{app}\sdkctl.exe"
Type: filesandordirs; Name: "{commonpf}\WindowsPowerShell\Modules\sdkctl\0.1.0"
Type: filesandordirs; Name: "{commonpf}\PowerShell\Modules\sdkctl\0.1.0"
Type: filesandordirs; Name: "{commonpf}\WindowsPowerShell\Modules\sdkctl\0.1.1"
Type: filesandordirs; Name: "{commonpf}\PowerShell\Modules\sdkctl\0.1.1"
Type: filesandordirs; Name: "{commonpf}\WindowsPowerShell\Modules\sdkctl\0.1.2"
Type: filesandordirs; Name: "{commonpf}\PowerShell\Modules\sdkctl\0.1.2"

[Icons]
Name: "{group}\sdkctl PowerShell"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoExit -Command sdk --help"; WorkingDir: "{%USERPROFILE}"
Name: "{group}\sdkctl 使用说明"; Filename: "{app}\README.md"
Name: "{group}\卸载 sdkctl"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\sdkctl-core.exe"; Parameters: "init"; Flags: runhidden waituntilterminated
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoExit -Command sdk --help"; Description: "启动 sdkctl PowerShell"; Flags: postinstall nowait skipifsilent unchecked

[Code]
function NormalizePathEntry(Value: String): String;
begin
  Result := Lowercase(RemoveBackslashUnlessRoot(Trim(Value)));
end;

function PathContains(PathValue, Entry: String): Boolean;
var
  Haystack, Needle: String;
begin
  Haystack := Lowercase(PathValue);
  StringChangeEx(Haystack, '/', '\', True);
  Needle := NormalizePathEntry(Entry);
  Result := Pos(';' + Needle + ';', ';' + Haystack + ';') > 0;
end;

procedure AddToMachinePath;
var
  CurrentPath, AppPath: String;
begin
  AppPath := ExpandConstant('{app}');
  if not RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', CurrentPath) then
    CurrentPath := '';
  if not PathContains(CurrentPath, AppPath) then
  begin
    if CurrentPath = '' then CurrentPath := AppPath
    else CurrentPath := AppPath + ';' + CurrentPath;
    RegWriteExpandStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', CurrentPath);
  end;
end;

procedure RemoveFromMachinePath;
var
  CurrentPath, AppPath: String;
begin
  AppPath := ExpandConstant('{app}');
  if not RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', CurrentPath) then Exit;
  if NormalizePathEntry(CurrentPath) = NormalizePathEntry(AppPath) then CurrentPath := ''
  else
  begin
    StringChangeEx(CurrentPath, AppPath + ';', '', True);
    StringChangeEx(CurrentPath, ';' + AppPath, '', True);
  end;
  RegWriteExpandStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', CurrentPath);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then AddToMachinePath;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then RemoveFromMachinePath;
end;
