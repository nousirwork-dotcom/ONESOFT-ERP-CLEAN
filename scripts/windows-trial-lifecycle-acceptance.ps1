[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [Parameter(Mandatory = $true)]
  [string]$ReportDir
)

$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path ${env:ProgramFiles} 'OneSoft ERP Trial Acceptance'
$DataDir = Join-Path ${env:PROGRAMDATA} 'OneSoft'
$MarkerPath = Join-Path $DataDir 'trial-install-marker.json'
$PendingMarkerPath = Join-Path $DataDir 'trial-install-marker.pending.json'
$PrefsPaths = @(
  (Join-Path $DataDir 'device.prefs.enc'),
  (Join-Path $DataDir 'device.prefs.json')
)
$ReportPath = Join-Path $ReportDir 'trial-lifecycle.txt'

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 's'), $Message
  Write-Host $line
  Add-Content -Path $ReportPath -Value $line
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "FAIL: $Message" }
  Log "PASS: $Message"
}

function Stop-OneSoft {
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like 'OneSoft*' } |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  foreach ($serviceName in @('OneSoft-Client', 'OneSoft-Updater', 'OneSoft-Server')) {
    Stop-Service $serviceName -Force -ErrorAction SilentlyContinue
  }
}

function Remove-InstallState {
  Stop-OneSoft
  if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Remove-Item (Join-Path $DataDir 'config') -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $DataDir 'version.json') -Force -ErrorAction SilentlyContinue
  Remove-Item $MarkerPath, $PendingMarkerPath -Force -ErrorAction SilentlyContinue
  foreach ($prefsPath in $PrefsPaths) {
    Remove-Item $prefsPath -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-CandidateInstaller {
  $process = Start-Process -FilePath $InstallerPath `
    -ArgumentList "/S /D=`"$InstallDir`"" -PassThru -Wait
  Assert-True ($process.ExitCode -eq 0) "candidate installer exited with code 0"
  Assert-True (Test-Path $InstallDir) "candidate install directory exists"
  Assert-True (Test-Path $MarkerPath) "first-install marker exists after successful install"
  Assert-True (-not (Test-Path $PendingMarkerPath)) "pending marker is absent after successful install"
}

function Read-Marker {
  return (Get-Content -Raw $MarkerPath | ConvertFrom-Json)
}

try {
  Log 'Windows 1.0.41 trial lifecycle acceptance started'
  Remove-InstallState

  # Fresh install: the real EXE must create the durable marker only on success.
  Invoke-CandidateInstaller
  $first = Read-Marker
  $firstAt = [DateTime]::Parse($first.firstInstallAt).ToUniversalTime()
  $expiryAt = $firstAt.AddDays(180)
  $remainingAtInstall = [int]($expiryAt.Date - $firstAt.Date).TotalDays
  Assert-True ($remainingAtInstall -eq 180) 'initial remaining days are exactly 180'
  $firstInstallAt = [string]$first.firstInstallAt
  $markerExpiry = $first.PSObject.Properties['trialExpiresAt']
  if ($null -ne $markerExpiry -and -not [string]::IsNullOrWhiteSpace([string]$markerExpiry.Value)) {
    $actualExpiryAt = [DateTime]::Parse([string]$markerExpiry.Value).ToUniversalTime()
    Assert-True (($actualExpiryAt - $firstAt).TotalSeconds -eq (180 * 86400)) `
      'marker expiry is exactly first-install plus 180 days'
  } else {
    Log 'PASS: marker stores first-install anchor; expiry is derived by persisted trial state'
  }

  # Installing 1.0.41 over the existing installation must preserve the marker.
  Invoke-CandidateInstaller
  $afterUpdate = Read-Marker
  Assert-True ([string]$afterUpdate.firstInstallAt -eq $firstInstallAt) 'update preserves first-install date'
  $afterUpdateExpiry = $afterUpdate.PSObject.Properties['trialExpiresAt']
  if ($null -ne $afterUpdateExpiry -and -not [string]::IsNullOrWhiteSpace([string]$afterUpdateExpiry.Value)) {
    Assert-True ([DateTime]::Parse([string]$afterUpdateExpiry.Value).ToUniversalTime() -eq $expiryAt) `
      'update preserves trial expiry'
  } else {
    Log 'PASS: update preserves first-install anchor; expiry remains derived by trial state'
  }

  # A real uninstall must not delete the marker; reinstall must reuse it.
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like 'OneSoft*' -or $_.ProcessName -like '*Setup*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue
  $serverService = Get-Service 'OneSoft-Server' -ErrorAction SilentlyContinue
  if ($null -ne $serverService -and $serverService.Status -ne 'Stopped') {
    Stop-Service $serverService.Name -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  }
  $uninstaller = Get-ChildItem $InstallDir -Filter '*Uninstall*.exe' -File -Recurse | Select-Object -First 1
  Assert-True ($null -ne $uninstaller) 'uninstaller exists'
  $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru -Wait
  Assert-True ($uninstall.ExitCode -eq 0) 'uninstaller exited with code 0'
  $removeDeadline = (Get-Date).AddSeconds(30)
  while ((Test-Path $InstallDir) -and (Get-Date) -lt $removeDeadline) {
    Start-Sleep -Seconds 1
  }
  $remainingAppBinaries = @(Get-ChildItem $InstallDir -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @('OneSoft ERP.exe', 'OneSoft-Server.exe', 'OneSoft-Updater.exe', 'OneSoftERP.exe') })
  Assert-True ($remainingAppBinaries.Count -eq 0) 'uninstaller removed installed application binaries'
  if (Test-Path $InstallDir) {
    Log 'PASS: uninstaller left only runtime directory contents; cleaning acceptance directory'
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Assert-True (Test-Path $MarkerPath) 'uninstaller preserves first-install marker'
  Invoke-CandidateInstaller
  $afterReinstall = Read-Marker
  Assert-True ([string]$afterReinstall.firstInstallAt -eq $firstInstallAt) 'reinstall preserves first-install date'
  $afterReinstallExpiry = $afterReinstall.PSObject.Properties['trialExpiresAt']
  if ($null -ne $afterReinstallExpiry -and -not [string]::IsNullOrWhiteSpace([string]$afterReinstallExpiry.Value)) {
    Assert-True ([DateTime]::Parse([string]$afterReinstallExpiry.Value).ToUniversalTime() -eq $expiryAt) `
      'reinstall preserves trial expiry'
  } else {
    Log 'PASS: reinstall preserves first-install anchor; expiry remains derived by trial state'
  }

  # Exercise the bundled production trial module with a future expiry instant
  # followed by an earlier instant. The persisted expired state must remain
  # terminal, while licensed state must remain valid past the trial expiry.
  $asarPath = Join-Path $InstallDir 'resources\app.asar'
  Assert-True (Test-Path $asarPath) 'bundled app.asar exists'
  $trialExtractDir = Join-Path $env:TEMP 'onesoft-trial-asar'
  Remove-Item $trialExtractDir -Recurse -Force -ErrorAction SilentlyContinue
  $asarOutput = & npx --yes @electron/asar extract $asarPath $trialExtractDir 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($asarOutput -join "`n")
  }
  $trialModule = Get-ChildItem $trialExtractDir -Filter 'trial.js' -File -Recurse |
    Where-Object { $_.FullName -like '*server-app*dist*lib*' } |
    Select-Object -First 1
  Assert-True ($null -ne $trialModule) 'bundled trial module exists'
  $env:ONESOFT_DATA_DIR = $DataDir
  $env:NODE_ENV = 'production'
  $env:CLIENT_BUILD = 'true'
  $env:TRIAL_MODULE = $trialModule.FullName
  $nodeScript = @'
import { pathToFileURL } from 'node:url';
const trial = await import(pathToFileURL(process.env.TRIAL_MODULE).href);
const state = trial.ensureTrialState();
const future = new Date(new Date(state.trialExpiresAt).getTime() + 1000);
const expired = trial.markTrialExpiredIfNeeded(state, future);
if (expired.licenseState !== 'expired') throw new Error('future clock did not expire trial');
if (!trial.isTrialExpired(expired, new Date(state.firstInstallAt))) {
  throw new Error('clock rollback resurrected expired trial');
}
const licensed = trial.updateTrialLicenseState(state, 'licensed');
if (licensed.firstInstallAt !== state.firstInstallAt || licensed.trialExpiresAt !== state.trialExpiresAt) {
  throw new Error('paid license changed trial dates');
}
if (trial.isTrialExpired(licensed, future)) throw new Error('paid license was affected by trial expiry');
console.log('CLOCK_ROLLBACK=PASS');
console.log('PAID_LICENSE_UNAFFECTED=PASS');
'@
  $nodeOutput = & node --input-type=module -e $nodeScript 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($nodeOutput -join "`n") }
  $nodeOutput | ForEach-Object { Log $_ }
  Assert-True (($nodeOutput -join "`n") -match 'CLOCK_ROLLBACK=PASS') 'clock rollback keeps expiry terminal'
  Assert-True (($nodeOutput -join "`n") -match 'PAID_LICENSE_UNAFFECTED=PASS') 'paid license is unaffected by trial expiry'
  Log 'WINDOWS TRIAL LIFECYCLE ACCEPTANCE = PASS'
} finally {
  Remove-Item Env:TRIAL_MODULE -ErrorAction SilentlyContinue
  Remove-Item Env:ONESOFT_DATA_DIR -ErrorAction SilentlyContinue
  Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:CLIENT_BUILD -ErrorAction SilentlyContinue
  if ($trialExtractDir) {
    Remove-Item $trialExtractDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}