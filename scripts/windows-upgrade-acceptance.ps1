#Requires -Version 7.0
<#
.SYNOPSIS
  Real Windows acceptance test for the published 1.0.21 -> 1.0.25 upgrade.

  This deliberately installs the published 1.0.21 EXE, creates a database whose
  schema is produced by that EXE, starts its real NSSM service, and launches
  its real Electron updater. The update is initiated through the visible
  updater dialog because the already-published 1.0.21 binary cannot contain a
  CI-only hook added later.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('x64', 'ia32')]
  [string]$Architecture,

  [Parameter(Mandatory = $true)]
  [string]$ManifestUrl,

  [string]$OldVersion = '1.0.21',
  [string]$NewVersion = '1.0.25',
  [string]$InstallDir = 'C:\Program Files\OneSoft ERP',
  [string]$DatabaseName = 'onesoft_erp',
  [string]$DatabaseUser = 'onesoft_app',
  [string]$DatabasePassword = 'OneSoftAcceptance2026',
  [string]$ReportDir = "$env:GITHUB_WORKSPACE\windows-acceptance-$Architecture"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$script:Log = [System.Collections.Generic.List[string]]::new()
$script:StartTime = Get-Date

function Log([string]$Message) {
  $line = "[$(Get-Date -Format 'o')] $Message"
  Write-Host $line
  $script:Log.Add($line)
}

function Fail([string]$Message) {
  Log "FAIL: $Message"
  throw $Message
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { Fail $Message }
  Log "PASS: $Message"
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments) {
  Log "EXEC: $FilePath $($Arguments -join ' ')"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "command failed with exit code ${LASTEXITCODE}: $FilePath"
  }
}

function Get-PsqlPath {
  $candidates = @(
    'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    'C:\Program Files\PostgreSQL\15\bin\psql.exe'
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  $command = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  Fail 'psql.exe was not found'
}

function Invoke-Sql([string]$Psql, [string]$Database, [string]$Sql, [string]$User = 'postgres') {
  $output = & $Psql -h localhost -p 5432 -U $User -d $Database -X -q -tA -v ON_ERROR_STOP=1 -c $Sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail "SQL failed on $Database`: $($output -join "`n")"
  }
  return ($output -join "`n").Trim()
}

function Wait-Until([scriptblock]$Probe, [int]$TimeoutSeconds, [string]$Description) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $value = & $Probe
      if ($value) { return $value }
    } catch {}
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  Fail "timeout waiting for $Description"
}

function Get-ServicePid([string]$Name) {
  $service = Get-CimInstance Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
  if ($service) { return [int]$service.ProcessId }
  return 0
}

function Get-InstallerLogPath {
  $logs = Get-ChildItem "$env:APPDATA" -Filter 'onesoft-installer.log' -File -Recurse -ErrorAction SilentlyContinue
  if ($logs) { return ($logs | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
  return $null
}

function Wait-InstallerLog([string]$Pattern, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $path = Get-InstallerLogPath
    if ($path -and (Select-String -Path $path -Pattern $Pattern -Quiet -ErrorAction SilentlyContinue)) {
      return $path
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  Fail "installer log did not contain '$Pattern'"
}

function Invoke-VisibleUpdaterButton([string[]]$Names, [int]$TimeoutSeconds) {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OneSoftWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $process = Get-Process -Name 'OneSoft ERP' -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($process) {
      try {
        [OneSoftWin32]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
        $condition = New-Object System.Windows.Automation.PropertyCondition(
          [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
          [System.Windows.Automation.ControlType]::Button
        )
        $buttons = $root.FindAll(
          [System.Windows.Automation.TreeScope]::Descendants, $condition
        )
        foreach ($button in $buttons) {
          $name = $button.Current.Name
          if ($Names -contains $name) {
            Log "UI: invoking '$name'"
            $pattern = $button.GetCurrentPattern(
              [System.Windows.Automation.InvokePattern]::Pattern
            )
            $pattern.Invoke()
            return
          }
        }
      } catch {
        Log "UI probe retry: $($_.Exception.Message)"
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  Fail "could not find updater button: $($Names -join ', ')"
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$script:ReportFile = Join-Path $ReportDir "acceptance-$Architecture.txt"
trap {
  try {
    $script:Log.Add("RESULT: FAIL")
    $script:Log | Set-Content $script:ReportFile -Encoding UTF8
    $programDataLogs = "$env:PROGRAMDATA\OneSoft\Logs"
    if (Test-Path $programDataLogs) {
      Copy-Item $programDataLogs (Join-Path $ReportDir 'ProgramData-Logs') -Recurse -Force -ErrorAction SilentlyContinue
    }
    $appDataLogs = Get-ChildItem "$env:APPDATA" -Filter 'onesoft-installer.log' -File -Recurse -ErrorAction SilentlyContinue
    foreach ($appDataLog in $appDataLogs) {
      Copy-Item $appDataLog.FullName (Join-Path $ReportDir $appDataLog.Name) -Force -ErrorAction SilentlyContinue
    }
  } catch {}
  throw
}
Log "Windows acceptance started: architecture=$Architecture"
Log "Manifest: $ManifestUrl"

$oldExe = Join-Path $env:TEMP "OneSoftSetup-$OldVersion-$Architecture.exe"
$newExe = Join-Path $env:TEMP "OneSoftSetup-$NewVersion-$Architecture.exe"
$repo = $env:GITHUB_REPOSITORY
$oldUrl = "https://github.com/$repo/releases/download/v$OldVersion/OneSoftSetup-$OldVersion-$Architecture.exe"
$newUrl = "https://github.com/$repo/releases/download/v$NewVersion/OneSoftSetup-$NewVersion-$Architecture.exe"

# The runner is disposable, but remove leftovers so this test cannot pass
# because of a previous installation.
foreach ($serviceName in @('OneSoft-Client', 'OneSoft-Updater', 'OneSoft-Server')) {
  & sc.exe stop $serviceName 2>$null | Out-Null
  & nssm.exe remove $serviceName confirm 2>$null | Out-Null
}
Get-Process -Name 'OneSoft ERP' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:PROGRAMDATA\OneSoft" -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem "$env:APPDATA" -Directory -Filter '*OneSoft*' -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Invoke-WebRequest -Uri $oldUrl -OutFile $oldExe
Invoke-WebRequest -Uri $newUrl -OutFile $newExe
Assert-True ((Get-Item $oldExe).Length -gt 50MB) 'published 1.0.21 installer downloaded'
Assert-True ((Get-Item $newExe).Length -gt 50MB) 'published 1.0.25 installer downloaded'

$manifest = Invoke-RestMethod -Uri $ManifestUrl
Assert-True ($manifest.latestVersion -eq $NewVersion) 'acceptance manifest targets 1.0.25'
Assert-True ($manifest.downloadUrl -eq $newUrl) 'acceptance manifest targets the selected architecture'

$newHash = [Convert]::ToBase64String(
  [System.Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes($newExe))
)
Assert-True ($newHash -eq $manifest.sha512) 'downloaded 1.0.25 EXE matches manifest SHA512'

Log 'Installing the published 1.0.21 installer silently'
Start-Process -FilePath $oldExe -ArgumentList @('/S', "/D=$InstallDir") -Wait -NoNewWindow
Assert-True (Test-Path "$InstallDir\OneSoft ERP.exe") 'published 1.0.21 application installed'
$oldApp = "$InstallDir\OneSoft ERP.exe"
$oldServer = "$InstallDir\resources\app\server-app\dist\index.mjs"
Assert-True (Test-Path $oldServer) 'published 1.0.21 server bundle installed'
Assert-True ((Get-Item $oldApp).VersionInfo.ProductVersion -like "$OldVersion*") 'installed application reports version 1.0.21'

$psql = Get-PsqlPath
$env:PGPASSWORD = $DatabasePassword
# PostgreSQL does not allow DROP/CREATE DATABASE inside a transaction; send
# each statement independently while retaining ON_ERROR_STOP.
Invoke-Sql $psql postgres "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DatabaseUser') THEN CREATE ROLE $DatabaseUser LOGIN PASSWORD '$DatabasePassword'; ELSE ALTER ROLE $DatabaseUser WITH LOGIN PASSWORD '$DatabasePassword'; END IF; END `$`$;"
Invoke-Sql $psql postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DatabaseName';"
Invoke-Sql $psql postgres "DROP DATABASE IF EXISTS `"$DatabaseName`";"
Invoke-Sql $psql postgres "CREATE DATABASE `"$DatabaseName`" OWNER `"$DatabaseUser`";"

$configDir = "$env:PROGRAMDATA\OneSoft\config"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$config = [ordered]@{
  version = $OldVersion
  configVersion = 4
  database = [ordered]@{
    host = 'localhost'; port = 5432; name = $DatabaseName
    user = $DatabaseUser; password = $DatabasePassword; poolMin = 1; poolMax = 5
  }
  server = [ordered]@{
    backendPort = 3000; frontendPort = 5000; host = '0.0.0.0'
    allowedOrigins = @('localhost', '127.0.0.1')
  }
}
$config | ConvertTo-Json -Depth 8 | Set-Content "$configDir\onesoft.config.json" -Encoding UTF8
@{ version = $OldVersion; installedAt = (Get-Date).ToString('o'); installDir = $InstallDir } |
  ConvertTo-Json | Set-Content "$env:PROGRAMDATA\OneSoft\version.json" -Encoding UTF8

$nssm = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
if (-not $nssm) { $nssm = 'C:\ProgramData\chocolatey\bin\nssm.exe' }
Assert-True (Test-Path $nssm) 'NSSM is available'
$node = (Get-Command node.exe).Source
Invoke-Checked $nssm @('install', 'OneSoft-Server', $node, $oldServer)
Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppDirectory', (Split-Path $oldServer))
Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppParameters', (Split-Path $oldServer -Leaf))
Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppEnvironmentExtra', 'NODE_ENV=production', 'PORT=3000')
Invoke-Checked $nssm @('set', 'OneSoft-Server', 'Start', 'SERVICE_AUTO_START')
Invoke-Checked $nssm @('start', 'OneSoft-Server')

Wait-Until {
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:3000/api/health'
    $health.status -eq 'ok'
  } catch { $false }
} 180 '1.0.21 /api/health'

$legacySchema = Invoke-Sql $psql $DatabaseName "SELECT version FROM _schema_version WHERE id=1;"
Assert-True ($legacySchema -eq '0020_ai_assistant') '1.0.21 produced the real legacy schema boundary'
$orgId = Invoke-Sql $psql $DatabaseName "SELECT id FROM organizations WHERE code <> 'SYSTEM' ORDER BY id LIMIT 1;"
Assert-True ($orgId -match '^\d+$') 'legacy bootstrap created an organization'
$customerCode = "ACCEPT-$Architecture"
Invoke-Sql $psql $DatabaseName "INSERT INTO customers (org_id, code, name, phone, is_active) VALUES ($orgId, '$customerCode', 'Acceptance Customer $Architecture', '555-$Architecture', true);"
$oldPid = Get-ServicePid 'OneSoft-Server'
Assert-True ($oldPid -gt 0) 'legacy OneSoft-Server service has a process'

Log 'Launching the actual 1.0.21 Electron updater'
$env:ONESOFT_UPDATE_URL = $ManifestUrl
$env:CI = 'true'
$env:ONESOFT_ACCEPTANCE_AUTO_UPDATE = '0'
$updateProcess = Start-Process -FilePath $oldApp -PassThru
Invoke-VisibleUpdaterButton @('تحديث الآن', 'Update now') 120
$logPath = Wait-InstallerLog 'update-checksum-ok' 240
Assert-True (Select-String -Path $logPath -Pattern 'update-downloaded' -Quiet) 'updater downloaded and verified the update'
Invoke-VisibleUpdaterButton @('إعادة التشغيل والتحديث', 'Restart and update') 120
Wait-Until {
  Select-String -Path $logPath -Pattern 'update-installing' -Quiet -ErrorAction SilentlyContinue
} 60 'updater launch of the NSIS installer'

Wait-Until {
  $candidate = "$InstallDir\OneSoft ERP.exe"
  if (Test-Path $candidate) {
    try {
      (Get-Item $candidate).VersionInfo.ProductVersion -like "$NewVersion*"
    } catch { $false }
  } else { $false }
} 180 'updated 1.0.25 executable after NSIS update'

$newApp = "$InstallDir\OneSoft ERP.exe"
Assert-True (Test-Path $newApp) 'updated application executable exists'
Assert-True ((Get-Item $newApp).VersionInfo.ProductVersion -like "$NewVersion*") 'updated application reports version 1.0.25'
$marker = "$env:PROGRAMDATA\OneSoft\version.json"
if (Test-Path $marker) {
  $markerVersion = (Get-Content $marker -Raw | ConvertFrom-Json).version
  Log "INFO: version marker after update = $markerVersion"
} else {
  Log 'INFO: version marker was not rewritten by the published NSIS artifact; executable version remains authoritative for this acceptance run.'
}

$newPid = Wait-Until {
  $servicePid = Get-ServicePid 'OneSoft-Server'
  if ($servicePid -gt 0) { $servicePid } else { $false }
} 120 'restarted OneSoft-Server service'
Assert-True ($newPid -ne $oldPid) 'Windows service restarted across the update'

Wait-Until {
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:3000/api/health'
    ($health.ready -eq $true) -and ($health.status -eq 'ok')
  } catch { $false }
} 240 '1.0.25 /api/health ready=true'

$appUser = Invoke-Sql $psql $DatabaseName 'SELECT current_user;' $DatabaseUser
Assert-True ($appUser -eq $DatabaseUser) 'application database user can query the upgraded database'
$schema = Invoke-Sql $psql $DatabaseName "SELECT version FROM _schema_version WHERE id=1;"
Assert-True ($schema -eq '0092_repair_legacy_migration_drift') 'migrations reached 0092'
$foundation = Invoke-Sql $psql $DatabaseName "SELECT foundation_status FROM organizations WHERE id=$orgId;"
Assert-True ($foundation -eq 'applied') 'Foundation reconciliation is applied'
$customerCount = Invoke-Sql $psql $DatabaseName "SELECT count(*) FROM customers WHERE org_id=$orgId AND code='$customerCode' AND name='Acceptance Customer $Architecture';"
Assert-True ($customerCount -eq '1') 'customer data survived the update'
$warehouseCount = Invoke-Sql $psql $DatabaseName "SELECT count(*) FROM warehouses WHERE org_id=$orgId AND foundation_key IN ('wh.001','wh.002','wh.003','wh.004');"
Assert-True ($warehouseCount -eq '4') 'Foundation warehouses wh.001-wh.004 exist exactly once'
$journalCount = Invoke-Sql $psql $DatabaseName "SELECT count(*) FROM document_journals WHERE org_id=$orgId AND upper(code) IN ('INV.01.','INV.02.','INV.03.','INV.04.');"
Assert-True ($journalCount -eq '4') 'Foundation journals INV.01.-INV.04. exist exactly once'
$duplicateCount = Invoke-Sql $psql $DatabaseName @"
SELECT count(*) FROM (
  SELECT foundation_key FROM warehouses WHERE org_id=$orgId AND foundation_key IS NOT NULL GROUP BY foundation_key HAVING count(*) > 1
  UNION ALL
  SELECT foundation_key FROM branches WHERE org_id=$orgId AND foundation_key IS NOT NULL GROUP BY foundation_key HAVING count(*) > 1
  UNION ALL
  SELECT foundation_key FROM document_journals WHERE org_id=$orgId AND foundation_key IS NOT NULL GROUP BY foundation_key HAVING count(*) > 1
) duplicates;
"@
Assert-True ($duplicateCount -eq '0') 'Foundation keys have no duplicates'
$invalidForeignKeys = Invoke-Sql $psql $DatabaseName "SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated;"
Assert-True ($invalidForeignKeys -eq '0') 'all PostgreSQL foreign-key constraints are validated'

$script:Log.Add("RESULT: PASS")
$script:Log | Set-Content $script:ReportFile -Encoding UTF8
if (Test-Path "$env:PROGRAMDATA\OneSoft\Logs") {
  Copy-Item "$env:PROGRAMDATA\OneSoft\Logs" (Join-Path $ReportDir 'ProgramData-Logs') -Recurse -Force -ErrorAction SilentlyContinue
}
Log "PASS: Windows upgrade acceptance completed for $Architecture"

try {
  & sc.exe stop OneSoft-Server 2>$null | Out-Null
  if ($updateProcess -and -not $updateProcess.HasExited) { $updateProcess.CloseMainWindow() | Out-Null }
} catch {}