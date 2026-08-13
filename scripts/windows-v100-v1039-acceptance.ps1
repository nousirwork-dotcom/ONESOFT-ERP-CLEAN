#Requires -Version 7.0
<#
.SYNOPSIS
  Real Windows acceptance for a clean v1.0.0 installation upgraded to v1.0.39.

  The old installer is downloaded from the published v1.0.0 release. The new
  installer is built by the Windows workflow from the checked-out source and is
  passed as OneSoftSetup-1.0.39-x64.exe.

  This test deliberately uses the real old server bundle, PostgreSQL Windows
  service, NSSM OneSoft-Server service, NSIS installer, and Upgrade Wizard.
  The optional stale-ledger mode reproduces the backup/import sequence failure
  without changing or deleting migration ledger rows.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$NewInstallerPath,

  [switch]$ReproduceStaleLedger,

  [string]$OldVersion = '1.0.0',
  [string]$NewVersion = '1.0.39',
  [string]$ExpectedSchemaVersion = '0093_schema_compatibility_repair',
  [string]$InstallDir = 'C:\Program Files\OneSoft ERP',
  [string]$DatabaseName = 'onesoft_erp',
  [string]$DatabaseUser = 'postgres',
  [string]$DatabasePassword = 'OneSoftAcceptance2026',
  [string]$ReportDir = "$env:GITHUB_WORKSPACE\windows-v100-v1039-$(if ($ReproduceStaleLedger) { 'stale-ledger' } else { 'clean' })"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$script:Log = [System.Collections.Generic.List[string]]::new()
$script:PsqlPath = $null
$script:OldServicePid = 0

function Log([string]$Message) {
  $line = "[$(Get-Date -Format 'o')] $Message"
  Write-Host $line
  $script:Log.Add($line)
}

function Pass([string]$Message) {
  Log "PASS: $Message"
}

function Fail([string]$Message) {
  Log "FAIL: $Message"
  throw $Message
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { Fail $Message }
  Pass $Message
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments) {
  Log "EXEC: $FilePath $($Arguments -join ' ')"
  $output = & $FilePath @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail "command failed with exit code ${LASTEXITCODE}: $FilePath`n$($output -join "`n")"
  }
  return ($output -join "`n")
}

function Find-Psql {
  $command = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' `
    -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($candidate) { return $candidate.FullName }
  Fail 'psql.exe was not found'
}

function Invoke-Sql([string]$Database, [string]$Sql, [string]$User = 'postgres', [string]$Password = $DatabasePassword) {
  $oldPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    $output = & $script:PsqlPath -h localhost -p 5432 -U $User -d $Database `
      -X -q -tA -v ON_ERROR_STOP=1 -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
      Fail "SQL failed on $Database`: $($output -join "`n")"
    }
    return ($output -join "`n").Trim()
  } finally {
    if ($null -eq $oldPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $oldPassword
    }
  }
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

function Wait-Health([bool]$RequireReady, [int]$TimeoutSeconds, [string]$Description) {
  return Wait-Until {
    try {
      $health = Invoke-RestMethod 'http://127.0.0.1:3000/api/health' -TimeoutSec 5
      if ($health.status -eq 'ok' -and ((-not $RequireReady) -or $health.ready -eq $true)) {
        return $health
      }
    } catch {}
    return $false
  } $TimeoutSeconds $Description
}

function Stop-OneSoftServices {
  foreach ($serviceName in @('OneSoft-Client', 'OneSoft-Updater', 'OneSoft-Server')) {
    & sc.exe stop $serviceName 2>$null | Out-Null
    & nssm.exe remove $serviceName confirm 2>$null | Out-Null
  }
  Get-Process -Name 'OneSoft ERP' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

function Remove-TestState {
  Stop-OneSoftServices
  Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item "$env:PROGRAMDATA\OneSoft" -Recurse -Force -ErrorAction SilentlyContinue
  Get-ChildItem "$env:APPDATA" -Directory -Filter '*OneSoft*' -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

function Install-OldApplication {
  $oldExe = Join-Path $env:TEMP "OneSoftSetup-$OldVersion.exe"
  $oldUrl = "https://github.com/$env:GITHUB_REPOSITORY/releases/download/v$OldVersion/OneSoftSetup-$OldVersion.exe"
  Log "Downloading historical installer: $oldUrl"
  Invoke-WebRequest -Uri $oldUrl -OutFile $oldExe
  Assert-True ((Get-Item $oldExe).Length -gt 50MB) 'published v1.0.0 installer downloaded'

  Log 'Installing the published v1.0.0 installer silently'
  $process = Start-Process -FilePath $oldExe -ArgumentList @('/S', "/D=$InstallDir") -Wait -PassThru
  Assert-True ($process.ExitCode -eq 0) 'published v1.0.0 installer exited successfully'
  Assert-True (Test-Path "$InstallDir\OneSoft ERP.exe") 'published v1.0.0 application installed'
  Assert-True (Test-Path "$InstallDir\resources\app\server-app\dist\index.mjs") `
    'published v1.0.0 server bundle installed'
  Assert-True ((Get-Item "$InstallDir\OneSoft ERP.exe").VersionInfo.ProductVersion -like "$OldVersion*") `
    'installed application reports v1.0.0'
}

function Configure-LegacyRuntime {
  $configDir = "$env:PROGRAMDATA\OneSoft\config"
  New-Item -ItemType Directory -Force -Path $configDir | Out-Null
  $config = [ordered]@{
    version = $OldVersion
    configVersion = 4
    database = [ordered]@{
      host = 'localhost'; port = 5432; name = $DatabaseName
      user = $DatabaseUser; password = $DatabasePassword
    }
    server = [ordered]@{
      backendPort = 3000; frontendPort = 5000; host = '0.0.0.0'
      allowedOrigins = @('localhost', '127.0.0.1')
    }
  }
  $config | ConvertTo-Json -Depth 8 |
    Set-Content "$configDir\onesoft.config.json" -Encoding UTF8
  @{ version = $OldVersion; installedAt = (Get-Date).ToString('o'); installDir = $InstallDir } |
    ConvertTo-Json | Set-Content "$env:PROGRAMDATA\OneSoft\version.json" -Encoding UTF8
  Pass 'Legacy v1.0.0 runtime configuration prepared'
}

function Create-LegacyDatabase {
  $env:PGPASSWORD = $DatabasePassword
  $roleSql = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DatabaseUser') THEN CREATE ROLE $DatabaseUser LOGIN SUPERUSER PASSWORD '$DatabasePassword'; ELSE ALTER ROLE $DatabaseUser WITH LOGIN SUPERUSER PASSWORD '$DatabasePassword'; END IF; END `$`$;"
  Invoke-Sql 'postgres' $roleSql
  Invoke-Sql 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DatabaseName';"
  Invoke-Sql 'postgres' "DROP DATABASE IF EXISTS `"$DatabaseName`";"
  Invoke-Sql 'postgres' "CREATE DATABASE `"$DatabaseName`" OWNER `"$DatabaseUser`";"
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Pass 'Fresh PostgreSQL database created for v1.0.0'
}

function Install-LegacyService {
  $oldServer = "$InstallDir\resources\app\server-app\dist\index.mjs"
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $nssm = (Get-Command nssm.exe -ErrorAction Stop).Source
  Invoke-Checked $nssm @('install', 'OneSoft-Server', $node, $oldServer)
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppDirectory', (Split-Path $oldServer))
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppParameters', (Split-Path $oldServer -Leaf))
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppEnvironmentExtra', 'NODE_ENV=production', 'PORT=3000')
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'Start', 'SERVICE_AUTO_START')
  Invoke-Checked $nssm @('start', 'OneSoft-Server')
  $script:OldServicePid = Wait-Until {
    $pid = Get-ServicePid 'OneSoft-Server'
    if ($pid -gt 0) { $pid } else { $false }
  } 60 'v1.0.0 OneSoft-Server service'
  $health = Wait-Health $false 240 'v1.0.0 /api/health'
  Assert-True ($health.status -eq 'ok') 'v1.0.0 application is healthy before upgrade'
  Pass "v1.0.0 service is running with PID $script:OldServicePid"
}

function Assert-LegacyDatabase {
  $ledgerCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM __drizzle_migrations;")
  $lastTag = Invoke-Sql $DatabaseName "SELECT tag FROM __drizzle_migrations ORDER BY id DESC LIMIT 1;"
  $schemaVersion = Invoke-Sql $DatabaseName "SELECT version FROM _schema_version WHERE id=1;"
  $orgCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM organizations;")
  $customerCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM customers;")

  Log "Legacy database: ledger=$ledgerCount last_tag=$lastTag schema=$schemaVersion organizations=$orgCount customers=$customerCount"
  Assert-True ($ledgerCount -gt 0) 'v1.0.0 created __drizzle_migrations rows'
  Assert-True ($lastTag -eq '0013_add_missing_tables') `
    'v1.0.0 created the historical migration boundary 0013_add_missing_tables'
  Assert-True ($orgCount -gt 0) 'v1.0.0 created Foundation organization data'

  $orgId = Invoke-Sql $DatabaseName "SELECT id FROM organizations ORDER BY id LIMIT 1;"
  Invoke-Sql $DatabaseName "INSERT INTO customers (org_id, code, name, phone, is_active) VALUES ($orgId, 'ACCEPT-V100', 'v1.0.0 Acceptance Customer', '555-0100', true);"
  Pass 'Legacy customer data inserted before upgrade'
}

function Reproduce-StaleLedgerSequence {
  $sequence = Invoke-Sql $DatabaseName "SELECT pg_get_serial_sequence('public.__drizzle_migrations', 'id');"
  Assert-True (-not [string]::IsNullOrWhiteSpace($sequence)) 'migration ledger has a SERIAL sequence'
  Invoke-Sql $DatabaseName "SELECT setval('$sequence'::regclass, 1, false);"
  $lastValue = Invoke-Sql $DatabaseName "SELECT last_value FROM $sequence;"
  $maxId = Invoke-Sql $DatabaseName 'SELECT MAX(id) FROM __drizzle_migrations;'
  Log "Reproduced stale sequence: sequence=$sequence last_value=$lastValue max_id=$maxId"
  Assert-True ([int]$lastValue -lt [int]$maxId) 'sequence is behind the preserved migration ledger'
}

function Add-TypeForUiAutomation {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OneSoftAcceptanceWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
}

function Get-UiRoot([string[]]$ProcessNames) {
  foreach ($name in $ProcessNames) {
    $process = Get-Process -Name $name -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($process) {
      try {
        [OneSoftAcceptanceWin32]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
        return [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
      } catch {}
    }
  }
  return $null
}

function Find-UiButtons($Root) {
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
  )
  return $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Invoke-UiButton([string[]]$Names, [int]$TimeoutSeconds = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    foreach ($processNames in @(@('OneSoft ERP'), @('OneSoftSetup'))) {
      $root = Get-UiRoot $processNames
      if (-not $root) { continue }
      foreach ($button in (Find-UiButtons $root)) {
        $name = [string]$button.Current.Name
        if ($Names -contains $name) {
          Log "UI: invoking '$name'"
          try {
            $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $pattern.Invoke()
            return $true
          } catch {
            Log "UI retry for '$name': $($_.Exception.Message)"
          }
        }
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Fill-UpgradeWizard {
  $deadline = (Get-Date).AddSeconds(180)
  do {
    $root = Get-UiRoot @('OneSoft ERP')
    if ($root) {
      $editCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Edit
      )
      $edits = @($root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition))
      if ($edits.Count -ge 2) {
        try {
          $userPattern = $edits[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
          $userPattern.SetValue('postgres')
          $passwordPattern = $edits[1].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
          $passwordPattern.SetValue($DatabasePassword)
          Pass 'Upgrade Wizard received the one-time PostgreSQL administrator credential'
          if (Invoke-UiButton @('بدء الترقية ▶', 'بدء الترقية', 'Start upgrade') 30) {
            return
          }
        } catch {
          Log "Upgrade Wizard input retry: $($_.Exception.Message)"
        }
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  Fail 'Upgrade Wizard did not expose the PostgreSQL credential fields'
}

function Run-NewInstallerUpgrade {
  Assert-True (Test-Path $NewInstallerPath -PathType Leaf) 'built OneSoftSetup-1.0.39-x64.exe exists'
  Assert-True ((Get-Item $NewInstallerPath).Length -gt 50MB) 'built OneSoftSetup-1.0.39-x64.exe has a valid size'
  Add-TypeForUiAutomation

  Log 'Launching the current OneSoftSetup-1.0.39-x64.exe in interactive upgrade mode'
  $installer = Start-Process -FilePath $NewInstallerPath -ArgumentList @("/D=$InstallDir") -PassThru

  # electron-builder's non-silent NSIS pages are automated first. Once the
  # customInstall macro opens the Electron Upgrade Wizard, Fill-UpgradeWizard
  # supplies the one-time admin credential and starts the shared Upgrade Core.
  $deadline = (Get-Date).AddSeconds(300)
  $wizardStarted = $false
  do {
    if (-not $wizardStarted) {
      $app = Get-Process -Name 'OneSoft ERP' -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 }
      if ($app) {
        $wizardStarted = $true
        Fill-UpgradeWizard
      }
    }

    if (-not $installer.HasExited) {
      $null = Invoke-UiButton @(
        'Next >', 'Next', 'التالي >', 'التالي',
        'I Agree', 'أوافق',
        'Install', 'تثبيت'
      ) 1
    }
    if ($installer.HasExited) { break }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  if (-not $installer.HasExited) {
    try { $installer.Kill() } catch {}
    Fail 'OneSoftSetup-1.0.39-x64.exe did not finish within 300 seconds'
  }
  Assert-True ($installer.ExitCode -eq 0) 'OneSoftSetup-1.0.39-x64.exe exited successfully'
  Assert-True $wizardStarted 'real Upgrade Wizard was opened by the NSIS installer'
}

function Assert-PostUpgrade {
  $versionPath = "$env:PROGRAMDATA\OneSoft\version.json"
  $version = Get-Content -Raw $versionPath | ConvertFrom-Json
  Assert-True ([string]$version.version -eq $NewVersion) "version marker reached $NewVersion"
  Assert-True ((Get-ServicePid 'OneSoft-Server') -gt 0) 'OneSoft-Server is running after upgrade'
  $health = Wait-Health $true 240 "$NewVersion /api/health ready=true"
  Assert-True ($health.ready -eq $true) "$NewVersion health reports ready=true"

  # The runtime password is intentionally not recoverable from the database.
  # Read-only assertions use the persisted runtime config instead.
  $config = Get-Content -Raw "$env:PROGRAMDATA\OneSoft\config\onesoft.config.json" | ConvertFrom-Json
  $runtimePassword = [string]$config.database.password
  $lastTag = Invoke-Sql $DatabaseName "SELECT tag FROM __drizzle_migrations ORDER BY id DESC LIMIT 1;" 'onesoft_app' $runtimePassword
  $schemaVersion = Invoke-Sql $DatabaseName "SELECT version FROM _schema_version WHERE id=1;" 'onesoft_app' $runtimePassword
  $customerCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM customers WHERE code='ACCEPT-V100';" 'onesoft_app' $runtimePassword)
  $backupCount = @(Get-ChildItem "$env:PROGRAMDATA\OneSoft\Backups" -Recurse -File -ErrorAction SilentlyContinue).Count

  Log "Post-upgrade database: last_tag=$lastTag schema=$schemaVersion customer_count=$customerCount backups=$backupCount"
  Assert-True ($lastTag -eq $ExpectedSchemaVersion) "migrations reached $ExpectedSchemaVersion"
  Assert-True ($schemaVersion -eq $ExpectedSchemaVersion) "_schema_version reached $ExpectedSchemaVersion"
  Assert-True ($customerCount -eq 1) 'Legacy customer data survived the upgrade'
  Assert-True ($backupCount -gt 0) 'database backup was created before upgrade'

  $firstPid = Get-ServicePid 'OneSoft-Server'
  Restart-Service -Name 'OneSoft-Server' -Force
  $secondPid = Wait-Until {
    $pid = Get-ServicePid 'OneSoft-Server'
    if ($pid -gt 0) { $pid } else { $false }
  } 120 'OneSoft-Server second startup'
  Assert-True ($secondPid -gt 0) 'OneSoft-Server restarted for second run'
  $secondHealth = Wait-Health $true 240 'second run ready=true'
  Assert-True ($secondHealth.ready -eq $true) 'second application startup reports ready=true'

  $secondTag = Invoke-Sql $DatabaseName "SELECT tag FROM __drizzle_migrations ORDER BY id DESC LIMIT 1;" 'onesoft_app' $runtimePassword
  $secondCustomerCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM customers WHERE code='ACCEPT-V100';" 'onesoft_app' $runtimePassword)
  Assert-True ($secondTag -eq $lastTag) 'second run did not append a new migration ledger row'
  Assert-True ($secondCustomerCount -eq 1) 'second run preserved Legacy data'
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportFile = Join-Path $ReportDir 'acceptance.txt'
try {
  Log "Windows v1.0.0 → v1.0.39 acceptance started; staleLedger=$ReproduceStaleLedger"
  Remove-TestState
  $script:PsqlPath = Find-Psql
  Install-OldApplication
  Create-LegacyDatabase
  Configure-LegacyRuntime
  Install-LegacyService
  Assert-LegacyDatabase
  if ($ReproduceStaleLedger) {
    Reproduce-StaleLedgerSequence
  }
  Run-NewInstallerUpgrade
  Assert-PostUpgrade
  Log 'WINDOWS V1.0.0 → V1.0.39 ACCEPTANCE = PASS'
} catch {
  Log "WINDOWS V1.0.0 → V1.0.39 ACCEPTANCE = FAIL: $($_.Exception.Message)"
  throw
} finally {
  try {
    $script:Log | Set-Content $reportFile -Encoding UTF8
    $programDataLogs = "$env:PROGRAMDATA\OneSoft\Logs"
    if (Test-Path $programDataLogs) {
      Copy-Item $programDataLogs (Join-Path $ReportDir 'ProgramData-Logs') -Recurse -Force -ErrorAction SilentlyContinue
    }
    $appDataLogs = Get-ChildItem "$env:APPDATA" -Filter 'onesoft-installer.log' -File -Recurse -ErrorAction SilentlyContinue
    foreach ($logFile in $appDataLogs) {
      Copy-Item $logFile.FullName (Join-Path $ReportDir $logFile.Name) -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}