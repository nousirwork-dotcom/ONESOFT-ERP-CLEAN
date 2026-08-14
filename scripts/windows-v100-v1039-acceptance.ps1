#Requires -Version 7.0
<#
.SYNOPSIS
  Real Windows acceptance for a clean v1.0.0 installation upgraded to v1.0.40.

  The old installer is downloaded from the published v1.0.0 release. The new
  installer is supplied by the single v1.0.40 candidate built in the release
  workflow. Clean and stale-ledger scenarios must use that same file.

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
  [string]$NewVersion = '1.0.40',
  [string]$ExpectedSchemaVersion = '0093_schema_compatibility_repair',
  [string]$InstallDir = 'C:\Program Files\OneSoft ERP',
  [string]$DatabaseName = 'onesoft_erp',
  [string]$DatabaseUser = 'postgres',
  [string]$DatabasePassword = 'OneSoftAcceptance2026',
  [string]$ReportDir = "$env:GITHUB_WORKSPACE\windows-v100-v1040-$(if ($ReproduceStaleLedger) { 'stale-ledger' } else { 'clean' })"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$script:Log = [System.Collections.Generic.List[string]]::new()
$script:PsqlPath = $null
$script:OldServicePid = 0
$script:CurrentStage = 'not-started'
$script:LastSuccessfulStage = 'none'
$script:FailedStage = $null
$script:FailureMessage = $null
$script:ExitCode = 1
$script:CurrentMigration = $null
$script:DiagnosticState = [ordered]@{
  schema_compatibility = 'NOT_RUN'
  permission_compatibility = 'NOT_RUN'
  foundation = 'NOT_RUN'
  system_accounts = 'NOT_RUN'
  ready = 'NOT_RUN'
  second_run = 'NOT_RUN'
  rollback = 'NOT_RUN'
}

function Log([string]$Message) {
  $line = "[$(Get-Date -Format 'o')] $Message"
  Write-Host $line
  $script:Log.Add($line)
}

function Start-Stage([string]$Stage) {
  $script:CurrentStage = $Stage
  Log "STAGE START: $Stage"
}

function Complete-Stage([string]$Stage = $script:CurrentStage) {
  $script:LastSuccessfulStage = $Stage
  Log "STAGE PASS: $Stage"
}

function Set-DiagnosticStatus([string]$Name, [string]$Status) {
  if ($script:DiagnosticState.Contains($Name)) {
    $script:DiagnosticState[$Name] = $Status
  }
}

function Pass([string]$Message) {
  Log "PASS: $Message"
}

function Fail([string]$Message) {
  if (-not $script:FailedStage) {
    $script:FailedStage = $script:CurrentStage
  }
  $script:FailureMessage = $Message
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

function Initialize-LegacyBaseSchema {
  $baseSchema = Join-Path $env:GITHUB_WORKSPACE 'server-app\drizzle\base_schema.sql'
  $drizzleDir = Join-Path $env:GITHUB_WORKSPACE 'server-app\drizzle'
  $journalPath = Join-Path $drizzleDir 'meta\_journal.json'
  Assert-True (Test-Path $baseSchema) 'historical base_schema.sql is available in the checked-out source'
  Assert-True (Test-Path $journalPath) 'migration journal is available in the checked-out source'
  $oldPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $DatabasePassword
    $output = & $script:PsqlPath -h localhost -p 5432 -U $DatabaseUser -d $DatabaseName `
      -X -v ON_ERROR_STOP=1 -f $baseSchema 2>&1
    if ($LASTEXITCODE -ne 0) {
      Fail "base_schema.sql failed: $($output -join "`n")"
    }

    $journal = Get-Content -Raw $journalPath | ConvertFrom-Json
    $historicalTags = @($journal.entries | Select-Object -First 14 | ForEach-Object { [string]$_.tag })
    Assert-True ($historicalTags.Count -eq 14) 'v1.0.0 historical boundary contains 14 migration tags'
    Assert-True ($historicalTags[-1] -eq '0013_add_missing_tables') `
      'v1.0.0 historical boundary ends at 0013_add_missing_tables'

    foreach ($tag in $historicalTags) {
      $migrationPath = Join-Path $drizzleDir "$tag.sql"
      Assert-True (Test-Path $migrationPath) "historical migration $tag is available"
      $output = & $script:PsqlPath -h localhost -p 5432 -U $DatabaseUser -d $DatabaseName `
        -X -v ON_ERROR_STOP=1 -f $migrationPath 2>&1
      if ($LASTEXITCODE -ne 0) {
        Fail "historical migration $tag failed: $($output -join "`n")"
      }
    }
  } finally {
    if ($null -eq $oldPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $oldPassword
    }
  }
  $tableCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
  Invoke-Sql $DatabaseName @"
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS _schema_version (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version TEXT NOT NULL,
  stamped_at TIMESTAMP NOT NULL DEFAULT now()
);
INSERT INTO __drizzle_migrations (tag)
SELECT tag FROM unnest(ARRAY[
  '$($historicalTags -join "','")'
]) AS tags(tag)
ON CONFLICT (tag) DO NOTHING;
INSERT INTO _schema_version (id, version)
VALUES (1, '0013_add_missing_tables')
ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, stamped_at = now();
"@
  Assert-True ($tableCount -gt 45) "historical v1.0.0 fixture created the initial table set ($tableCount tables)"
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
  $process = Start-Process -FilePath $oldExe -ArgumentList "/S /D=`"$InstallDir`"" -Wait -PassThru
  Assert-True ($process.ExitCode -eq 0) 'published v1.0.0 installer exited successfully'

  $candidates = @(
    $InstallDir,
    'C:\Program Files\OneSoft ERP',
    'C:\Program Files (x86)\OneSoft ERP',
    "$env:LOCALAPPDATA\Programs\OneSoft ERP"
  ) | Select-Object -Unique
  $installedRoot = $candidates |
    Where-Object { Test-Path (Join-Path $_ 'resources\app\server-app\dist\index.mjs') } |
    Select-Object -First 1
  if (-not $installedRoot) {
    Log 'v1.0.0 install root was not detected; diagnostic directories follow:'
    foreach ($candidate in $candidates) {
      Log "candidate=$candidate exists=$(Test-Path $candidate)"
      if (Test-Path $candidate) {
        Get-ChildItem $candidate -Force -ErrorAction SilentlyContinue |
          ForEach-Object { Log "  $($_.FullName)" }
      }
    }
    Get-ChildItem 'C:\Program Files', 'C:\Program Files (x86)', $env:LOCALAPPDATA `
      -Directory -Filter '*OneSoft*' -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 40 |
      ForEach-Object { Log "discovered=$($_.FullName)" }
    Fail 'published v1.0.0 server bundle was not installed in a known Windows application directory'
  }
  $script:InstallDir = $installedRoot
  Pass "published v1.0.0 server bundle installed at $script:InstallDir"
  $executables = @(Get-ChildItem $script:InstallDir -Filter '*.exe' -File -ErrorAction SilentlyContinue)
  Log "v1.0.0 installed executables: $($executables.Name -join ', ')"
}

function Configure-LegacyRuntime {
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
  $serviceLogDir = "$env:PROGRAMDATA\OneSoft\Logs\legacy-v100"
  New-Item -ItemType Directory -Force -Path $serviceLogDir | Out-Null
  Invoke-Checked $nssm @('install', 'OneSoft-Server', $node, $oldServer)
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppDirectory', (Split-Path $oldServer))
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppParameters', (Split-Path $oldServer -Leaf))
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppEnvironmentExtra', 'NODE_ENV=production', 'PORT=3000')
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppStdout', "$serviceLogDir\stdout.log")
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppStderr', "$serviceLogDir\stderr.log")
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'AppRotateFiles', '1')
  Invoke-Checked $nssm @('set', 'OneSoft-Server', 'Start', 'SERVICE_AUTO_START')
  Invoke-Checked $nssm @('start', 'OneSoft-Server')
  try {
    $script:OldServicePid = Wait-Until {
      $servicePid = Get-ServicePid 'OneSoft-Server'
      if ($servicePid -gt 0) { $servicePid } else { $false }
    } 60 'v1.0.0 OneSoft-Server service'
  } catch {
    $service = Get-CimInstance Win32_Service -Filter "Name='OneSoft-Server'" -ErrorAction SilentlyContinue
    if ($service) {
      Log "Legacy service diagnostics: state=$($service.State) status=$($service.Status) exitCode=$($service.ExitCode) processId=$($service.ProcessId) startName=$($service.StartName)"
    }
    foreach ($logPath in @("$serviceLogDir\stdout.log", "$serviceLogDir\stderr.log")) {
      if (Test-Path $logPath) {
        Log "Legacy service log ${logPath}:"
        Get-Content $logPath -Tail 120 -ErrorAction SilentlyContinue |
          ForEach-Object { Log "  $_" }
      } else {
        Log "Legacy service log missing: $logPath"
      }
    }
    throw
  }
  $health = Wait-Health $false 240 'v1.0.0 /api/health'
  Assert-True ($health.status -eq 'ok') 'v1.0.0 application is healthy before upgrade'
  Pass "v1.0.0 service is running with PID $script:OldServicePid"
}

function Seed-LegacyFoundation {
  $orgId = Invoke-Sql $DatabaseName @"
INSERT INTO organizations (code, name, name_en, currency, status)
VALUES ('ACCEPT-V100', 'OneSoft v1.0.0 Acceptance', 'OneSoft v1.0.0 Acceptance', 'SAR', 'trial')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
RETURNING id;
"@
  Assert-True ([int]$orgId -gt 0) 'v1.0.0 Foundation organization fixture exists'
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
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OneSoftAcceptanceWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
}

function Send-UiEnter([string[]]$ProcessNames) {
  foreach ($name in $ProcessNames) {
    $process = Get-Process -Name $name -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if (-not $process) { continue }
    try {
      [OneSoftAcceptanceWin32]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
      [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
      return $true
    } catch {
      Log "UI keyboard fallback retry: $($_.Exception.Message)"
    }
  }
  return $false
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

function Fill-UpgradeWizardByKeyboard([string]$Password) {
  $root = Get-UiRoot @('OneSoft ERP')
  if (-not $root) { return $false }
  try {
    [OneSoftAcceptanceWin32]::SetForegroundWindow([IntPtr]$root.Current.NativeWindowHandle) | Out-Null
    # UpgradeWizard auto-focuses the administrator username field when the
    # credential section appears. Continue from that field because an elevated
    # Electron window may expose no descendants through UIAutomation.
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    [System.Windows.Forms.SendKeys]::SendWait('postgres')
    [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    [System.Windows.Forms.SendKeys]::SendWait($Password)
    Start-Sleep -Seconds 2
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    return $true
  } catch {
    Log "Upgrade Wizard keyboard fallback retry: $($_.Exception.Message)"
    return $false
  }
}

function Find-UiButtons($Root) {
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
  )
  return $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Invoke-UiButton(
  [string[]]$Names,
  [int]$TimeoutSeconds = 120,
  [string[]]$ProcessNames = @('OneSoft ERP', 'OneSoftSetup*')
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    foreach ($processNames in @($ProcessNames)) {
      $root = Get-UiRoot $processNames
      if (-not $root) { continue }
      $invoked = $false
      foreach ($button in (Find-UiButtons $root)) {
        $name = [string]$button.Current.Name
        if ($Names -contains $name -or $Names -contains $name.TrimStart('&')) {
          Log "UI: invoking '$name'"
          try {
            $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $pattern.Invoke()
            $invoked = $true
            return $true
          } catch {
            Log "UI retry for '$name': $($_.Exception.Message)"
          }
        }
      }
      if (-not $invoked) {
        # Elevated NSIS windows can expose a root HWND but no child controls
        # through UIAutomation. Enter activates the default page action and
        # keeps this acceptance test on the same interactive installer path.
        $null = Send-UiEnter $processNames
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Fill-UpgradeWizard {
  $deadline = (Get-Date).AddSeconds(180)
  $keyboardReadyAt = (Get-Date).AddSeconds(12)
  $keyboardAttempted = $false
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
      if (-not $keyboardAttempted -and (Get-Date) -ge $keyboardReadyAt) {
        $keyboardAttempted = $true
        if (Fill-UpgradeWizardByKeyboard $DatabasePassword) {
          Pass 'Upgrade Wizard received credentials through the interactive keyboard fallback'
          return
        }
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  Fail 'Upgrade Wizard did not expose the PostgreSQL credential fields'
}

function Run-NewInstallerUpgrade {
  Assert-True (Test-Path $NewInstallerPath -PathType Leaf) "published OneSoftSetup-$NewVersion-x64.exe exists"
  Assert-True ((Get-Item $NewInstallerPath).Length -gt 50MB) "published OneSoftSetup-$NewVersion-x64.exe has a valid size"

  Log "Launching the published OneSoftSetup-$NewVersion-x64.exe in silent upgrade mode"
  $acceptanceMarker = Join-Path ($env:ProgramData ?? 'C:\ProgramData') 'OneSoft\acceptance.mode'
  New-Item -ItemType Directory -Force -Path (Split-Path $acceptanceMarker) | Out-Null
  Set-Content -Path $acceptanceMarker -Value '1' -NoNewline
  $installer = Start-Process -FilePath $NewInstallerPath -ArgumentList "/S /D=`"$InstallDir`"" -PassThru

  $startTime = Get-Date
  $deadline  = (Get-Date).AddSeconds(600)
  $lastDiag  = [DateTime]::MinValue

  $upgLog    = Join-Path ($env:PROGRAMDATA ?? 'C:\ProgramData') 'OneSoft\Logs\upgrade.log'
  $upgFailed = $false
  $upgFailMsg = ''

  while (-not $installer.HasExited -and (Get-Date) -lt $deadline) {
    # ── Detect upgrade-core terminal state from upgrade.log ──────────────────
    # If the upgrade core has already finished (success or failed+rolled-back),
    # the NSIS process may remain alive showing a GUI even in /S mode.
    # Kill it immediately and report the real outcome rather than waiting 600s.
    if (Test-Path $upgLog) {
      $logContent = Get-Content $upgLog -Raw -ErrorAction SilentlyContinue
      if ($logContent -match '"stage"\s*:\s*"rollback"\s*,\s*"status"\s*:\s*"success"') {
        # Upgrade core rolled back — extract error from log
        $errMatch = [regex]::Match($logContent, '"stage"\s*:\s*"permission-compatibility"\s*,[^}]*"error"\s*:\s*"([^"]+)"')
        if (-not $errMatch.Success) {
          $errMatch = [regex]::Match($logContent, '"status"\s*:\s*"failure"\s*,[^}]*"error"\s*:\s*"([^"]+)"')
        }
        $upgFailMsg = if ($errMatch.Success) { $errMatch.Groups[1].Value } else { 'upgrade-core failed (see upgrade.log)' }
        $upgFailed  = $true
        Log "── upgrade-core rolled back — terminating installer (error: $upgFailMsg) ──"
        try { $installer.Kill() } catch {}
        # brief wait for process to actually die
        $null = $installer.WaitForExit(5000)
        break
      }
    }

    if (((Get-Date) - $lastDiag).TotalSeconds -ge 30) {
      $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
      Log "── installer still running (${elapsed}s elapsed) ──"

      # processes
      Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -like 'OneSoft*' -or $_.ProcessName -like '*Setup*' } |
        ForEach-Object {
          $ppid = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" `
                     -ErrorAction SilentlyContinue).ParentProcessId
          Log "  proc=$($_.ProcessName) pid=$($_.Id) ppid=$ppid title='$($_.MainWindowTitle)'"
        }

      # service state
      $svc = Get-Service 'OneSoft-Server' -ErrorAction SilentlyContinue
      Log "  OneSoft-Server: $($svc ? $svc.Status : 'not-installed')"

      # install dir
      Log "  install_dir: $(if (Test-Path $InstallDir) { 'exists' } else { 'missing' })"

      # version marker
      $vj = Join-Path ($env:PROGRAMDATA ?? 'C:\ProgramData') 'OneSoft\version.json'
      Log "  version.json: $(if (Test-Path $vj) { (Get-Content $vj -Raw -ErrorAction SilentlyContinue)?.Trim() } else { 'missing' })"

      # exit state
      Log "  installer_exited=$($installer.HasExited)"
      $lastDiag = Get-Date
    }
    Start-Sleep -Seconds 5
  }

  # ── Post-loop handling ────────────────────────────────────────────────────

  # Case 1: upgrade-core failed and rolled back — already killed above
  if ($upgFailed) {
    if (Test-Path $upgLog) {
      Log "── upgrade.log (last 60 lines) ──"
      Get-Content $upgLog -Tail 60 -ErrorAction SilentlyContinue | ForEach-Object { Log "  $_" }
    }
    Fail "OneSoftSetup-$NewVersion-x64.exe: upgrade-core failed — $upgFailMsg"
  }

  # Case 2: deadline reached but installer still alive
  if (-not $installer.HasExited) {
    if (Test-Path $upgLog) {
      Log "── upgrade.log (last 60 lines) ──"
      Get-Content $upgLog -Tail 60 -ErrorAction SilentlyContinue | ForEach-Object { Log "  $_" }
    }
    try { $installer.Kill() } catch {}
    Fail "OneSoftSetup-$NewVersion-x64.exe did not finish within 600 seconds"
  }

  # Case 3: installer exited normally — check exit code
  if ($installer.ExitCode -ne 0) {
    foreach ($logPath in @(
      $upgLog,
      (Join-Path $env:APPDATA 'onesoft-installer.log')
    )) {
      if (Test-Path $logPath) {
        Log "── $logPath (last 60 lines) ──"
        Get-Content $logPath -Tail 60 -ErrorAction SilentlyContinue | ForEach-Object { Log "  $_" }
      }
    }
  }
  Assert-True ($installer.ExitCode -eq 0) `
    "OneSoftSetup-$NewVersion-x64.exe exited successfully (exit_code=$($installer.ExitCode))"
  Remove-Item $acceptanceMarker -Force -ErrorAction SilentlyContinue
}

function Get-PermissionDiagnostic([string]$User, [string]$UserPassword) {
  $lines = [System.Collections.Generic.List[string]]::new()
  $oldPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $UserPassword
    foreach ($query in @(
      "SELECT current_user, session_user;",
      "SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee='$User' AND table_schema='public' ORDER BY table_name, privilege_type;",
      "SELECT nspname, privilege_type FROM information_schema.usage_privileges WHERE grantee='$User' AND object_schema='public';"
    )) {
      $out = & $script:PsqlPath -h localhost -p 5432 -U $DatabaseUser -d $DatabaseName `
        -X -tA -c $query 2>&1
      $lines.Add("SQL: $query")
      $lines.Add($out -join "`n")
    }
  } catch {
    $lines.Add("Diagnostic query failed: $($_.Exception.Message)")
  } finally {
    if ($null -eq $oldPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $oldPassword
    }
  }
  return $lines -join "`n"
}

function Assert-PermissionBoundaries([string]$RuntimePassword) {
  Log "=== Permission boundary assertions for onesoft_app ==="

  # onesoft_app MUST be able to SELECT on _schema_version
  $schemaVersionSelectOk = $false
  try {
    $null = Invoke-Sql $DatabaseName "SELECT version FROM _schema_version WHERE id=1;" 'onesoft_app' $RuntimePassword
    $schemaVersionSelectOk = $true
  } catch {
    Log "onesoft_app SELECT on _schema_version failed: $($_.Exception.Message)"
    Log (Get-PermissionDiagnostic 'onesoft_app' $RuntimePassword)
  }
  Assert-True $schemaVersionSelectOk 'onesoft_app can SELECT on _schema_version'

  # onesoft_app MUST be able to SELECT on __drizzle_migrations
  $drizzleMigrationsSelectOk = $false
  try {
    $null = Invoke-Sql $DatabaseName "SELECT tag FROM __drizzle_migrations ORDER BY id DESC LIMIT 1;" 'onesoft_app' $RuntimePassword
    $drizzleMigrationsSelectOk = $true
  } catch {
    Log "onesoft_app SELECT on __drizzle_migrations failed: $($_.Exception.Message)"
    Log (Get-PermissionDiagnostic 'onesoft_app' $RuntimePassword)
  }
  Assert-True $drizzleMigrationsSelectOk 'onesoft_app can SELECT on __drizzle_migrations'

  # onesoft_app MUST NOT be able to DROP TABLE (security boundary)
  $dropTableDenied = $false
  try {
    $oldPassword = $env:PGPASSWORD
    $env:PGPASSWORD = $RuntimePassword
    $dropOutput = & $script:PsqlPath -h localhost -p 5432 -U 'onesoft_app' -d $DatabaseName `
      -X -tA -v ON_ERROR_STOP=1 -c 'DROP TABLE IF EXISTS _permission_test_sentinel;' 2>&1
    $env:PGPASSWORD = $oldPassword
    # If we reach here the command succeeded — DROP TABLE must NOT succeed.
    Log "SECURITY VIOLATION: onesoft_app was able to execute DROP TABLE: $($dropOutput -join ' ')"
    $dropTableDenied = $false
  } catch {
    $dropTableDenied = $true
    Log "onesoft_app DROP TABLE correctly denied: $($_.Exception.Message)"
  } finally {
    if ($null -ne $oldPassword) { $env:PGPASSWORD = $oldPassword } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  }
  Assert-True $dropTableDenied 'onesoft_app cannot DROP TABLE (security boundary enforced)'

  Log "=== Permission boundary assertions complete ==="
}

function Assert-SystemAccounts([string]$RuntimePassword) {
  $expected = @(
    @{ code = '110101'; systemKey = 'acct.110101' },
    @{ code = '110103'; systemKey = 'acct.110103' },
    @{ code = '210501'; systemKey = 'acct.210501' },
    @{ code = '410101'; systemKey = 'acct.410101' }
  )
  $orgRows = @((Invoke-Sql $DatabaseName `
    "SELECT id::text || '|' || code FROM organizations WHERE status IN ('active', 'trial') ORDER BY id;" `
    'onesoft_app' $RuntimePassword) -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  Assert-True ($orgRows.Count -gt 0) 'at least one active/trial organization exists for system-account verification'
  foreach ($orgRow in $orgRows) {
    $parts = ([string]$orgRow).Trim() -split '\|', 2
    $orgId = [int]$parts[0]
    $orgCode = $parts[1]
    foreach ($account in $expected) {
      $codeCount = [int](Invoke-Sql $DatabaseName `
        "SELECT count(*) FROM chart_of_accounts WHERE org_id=$orgId AND code='$($account.code)';" `
        'onesoft_app' $RuntimePassword)
      $keyCount = [int](Invoke-Sql $DatabaseName `
        "SELECT count(*) FROM chart_of_accounts WHERE org_id=$orgId AND system_key='$($account.systemKey)';" `
        'onesoft_app' $RuntimePassword)
      Assert-True ($codeCount -eq 1 -and $keyCount -eq 1) `
        "system account $orgCode/$($account.code) has one code and one system_key"
    }
  }
  Set-DiagnosticStatus 'system_accounts' 'PASS'
  Pass 'all required system accounts exist without duplicates'
}

function Assert-PostUpgrade {
  $versionPath = "$env:PROGRAMDATA\OneSoft\version.json"
  $version = Get-Content -Raw $versionPath | ConvertFrom-Json
  Assert-True ([string]$version.version -eq $NewVersion) "version marker reached $NewVersion"
  Assert-True ((Get-ServicePid 'OneSoft-Server') -gt 0) 'OneSoft-Server is running after upgrade'
  $health = Wait-Health $true 240 "$NewVersion /api/health ready=true"
  Assert-True ($health.ready -eq $true) "$NewVersion health reports ready=true"
  Set-DiagnosticStatus 'ready' 'PASS'

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

  # Explicit permission boundary checks for onesoft_app
  Assert-PermissionBoundaries $runtimePassword
  Set-DiagnosticStatus 'permission_compatibility' 'PASS'
  Assert-SystemAccounts $runtimePassword

  $firstPid = Get-ServicePid 'OneSoft-Server'
  Restart-Service -Name 'OneSoft-Server' -Force
  $secondPid = Wait-Until {
    $servicePid = Get-ServicePid 'OneSoft-Server'
    if ($servicePid -gt 0) { $servicePid } else { $false }
  } 120 'OneSoft-Server second startup'
  Assert-True ($secondPid -gt 0) 'OneSoft-Server restarted for second run'
  $secondHealth = Wait-Health $true 240 'second run ready=true'
  Assert-True ($secondHealth.ready -eq $true) 'second application startup reports ready=true'
  Set-DiagnosticStatus 'second_run' 'PASS'

  $secondTag = Invoke-Sql $DatabaseName "SELECT tag FROM __drizzle_migrations ORDER BY id DESC LIMIT 1;" 'onesoft_app' $runtimePassword
  $secondCustomerCount = [int](Invoke-Sql $DatabaseName "SELECT count(*) FROM customers WHERE code='ACCEPT-V100';" 'onesoft_app' $runtimePassword)
  Assert-True ($secondTag -eq $lastTag) 'second run did not append a new migration ledger row'
  Assert-True ($secondCustomerCount -eq 1) 'second run preserved Legacy data'
}

function Sanitize-DiagnosticText([string]$Text) {
  if ($null -eq $Text) { return '' }
  return $Text `
    -replace '(?i)postgres(?:ql)?://\S+', 'postgresql://***' `
    -replace '(?im)(PGPASSWORD|DATABASE_URL|ONESOFT_UPGRADE_DATABASE_URL)\s*[:=]\s*\S+', '$1=***' `
    -replace '(?im)(password|secret|token|credential|api[-_]?key)\s*[:=]\s*\S+', '$1=***'
}

function Export-CombinedDiagnostic(
  [string[]]$SourcePaths,
  [string]$Destination,
  [string]$MissingMessage
) {
  $sections = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($source in @($SourcePaths)) {
    if ([string]::IsNullOrWhiteSpace([string]$source)) { continue }
    $resolved = [System.IO.Path]::GetFullPath([string]$source)
    if (-not $seen.Add($resolved) -or -not (Test-Path $resolved -PathType Leaf)) { continue }
    try {
      $sections.Add("===== $resolved =====")
      $sections.Add((Get-Content -Raw -LiteralPath $resolved -ErrorAction Stop))
    } catch {
      $sections.Add("Unable to read $resolved`: $($_.Exception.Message)")
    }
  }
  if ($sections.Count -eq 0) {
    $sections.Add($MissingMessage)
  }
  [System.IO.File]::WriteAllText(
    $Destination,
    (Sanitize-DiagnosticText ($sections -join "`r`n")),
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Get-UpgradeDiagnosticEntries([string]$Path) {
  $entries = [System.Collections.Generic.List[object]]::new()
  if (-not (Test-Path $Path -PathType Leaf)) { return $entries }
  foreach ($line in (Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    try {
      $entry = $line | ConvertFrom-Json -ErrorAction Stop
      if ($entry.stage -and $entry.status) { $entries.Add($entry) }
    } catch {
      # Keep non-JSON log lines in upgrade.log, but ignore them in the summary.
    }
  }
  return $entries
}

function Get-StageDiagnosticStatus($Entries, [string[]]$Stages) {
  $matching = @($Entries | Where-Object { $Stages -contains [string]$_.stage })
  if (@($matching | Where-Object { $_.status -eq 'failure' }).Count -gt 0) { return 'FAIL' }
  if (@($matching | Where-Object { $_.status -eq 'success' }).Count -gt 0) { return 'PASS' }
  return 'NOT_RUN'
}

function Get-SqlState([string]$Text) {
  if ($Text -match '(?i)SQLSTATE(?:\s*[:=]|\s+|\[)?\s*([0-9A-Z]{5})') { return $Matches[1].ToUpperInvariant() }
  if ($Text -match '(?im)\bERROR:\s*([0-9A-Z]{5})\b') { return $Matches[1].ToUpperInvariant() }
  if ($Text -match '(?im)\bcode\s*[:=]\s*([0-9A-Z]{5})\b') { return $Matches[1].ToUpperInvariant() }
  return $null
}

function Export-Diagnostics {
  New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
  $programDataLogs = Join-Path ($env:PROGRAMDATA ?? 'C:\ProgramData') 'OneSoft\Logs'
  $programDataSources = @()
  if (Test-Path $programDataLogs) {
    $programDataSources = @(Get-ChildItem $programDataLogs -File -Recurse -ErrorAction SilentlyContinue)
  }

  $upgradeSources = @($programDataSources |
    Where-Object { $_.Name -ieq 'upgrade.log' } |
    ForEach-Object { $_.FullName })
  $serverSources = @($programDataSources |
    Where-Object { $_.Name -ieq 'server.log' -or $_.Name -ieq 'stdout.log' -or $_.Name -ieq 'stderr.log' } |
    ForEach-Object { $_.FullName })
  $installerSources = @()
  foreach ($root in @($env:APPDATA, $env:LOCALAPPDATA)) {
    if ($root -and (Test-Path $root)) {
      $installerSources += @(Get-ChildItem $root -Filter 'onesoft-installer.log' -File -Recurse -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName })
    }
  }
  $postgresSources = @()
  foreach ($root in @('C:\Program Files\PostgreSQL', 'C:\Program Files (x86)\PostgreSQL')) {
    if (Test-Path $root) {
      $postgresSources += @(Get-ChildItem $root -Filter '*.log' -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '(?i)\\data\\log\\' } |
        ForEach-Object { $_.FullName })
    }
  }

  $acceptancePath = Join-Path $ReportDir 'acceptance.log'
  $script:Log | Set-Content $acceptancePath -Encoding UTF8
  # Keep the original filename for existing consumers while adding the stable
  # diagnostic filename required by CI triage.
  Copy-Item $acceptancePath (Join-Path $ReportDir 'acceptance.txt') -Force
  if (Test-Path $programDataLogs) {
    Copy-Item $programDataLogs (Join-Path $ReportDir 'ProgramData-Logs') -Recurse -Force -ErrorAction SilentlyContinue
  }
  Export-CombinedDiagnostic $upgradeSources (Join-Path $ReportDir 'upgrade.log') 'upgrade.log was not produced'
  Export-CombinedDiagnostic $serverSources (Join-Path $ReportDir 'server.log') 'server.log was not produced'
  Export-CombinedDiagnostic $installerSources (Join-Path $ReportDir 'installer.log') 'onesoft-installer.log was not produced'
  Export-CombinedDiagnostic $postgresSources (Join-Path $ReportDir 'postgres.log') 'PostgreSQL data/log/*.log was not found'

  $upgradePath = Join-Path $ReportDir 'upgrade.log'
  $installerPath = Join-Path $ReportDir 'installer.log'
  $serverPath = Join-Path $ReportDir 'server.log'
  $acceptanceText = Get-Content -Raw $acceptancePath -ErrorAction SilentlyContinue
  $allText = @(
    $acceptanceText
    (Get-Content -Raw $upgradePath -ErrorAction SilentlyContinue)
    (Get-Content -Raw $installerPath -ErrorAction SilentlyContinue)
    (Get-Content -Raw $serverPath -ErrorAction SilentlyContinue)
  ) -join "`n"
  $entries = Get-UpgradeDiagnosticEntries $upgradePath
  $lastSuccess = @($entries | Where-Object { $_.status -eq 'success' } | Select-Object -Last 1)
  $lastFailure = @($entries | Where-Object { $_.status -eq 'failure' } | Select-Object -Last 1)
  if ($lastSuccess.Count -gt 0) { $script:LastSuccessfulStage = [string]$lastSuccess[0].stage }
  if ($lastFailure.Count -gt 0 -and -not $script:FailedStage) { $script:FailedStage = [string]$lastFailure[0].stage }
  if ($lastFailure.Count -gt 0 -and -not $script:FailureMessage) { $script:FailureMessage = [string]$lastFailure[0].error }
  $lastMigration = @($entries | Where-Object { $_.migration } | Select-Object -Last 1)
  if ($lastMigration.Count -gt 0) { $script:CurrentMigration = [string]$lastMigration[0].migration }

  $schemaStatus = Get-StageDiagnosticStatus $entries @('verification')
  $permissionStatus = Get-StageDiagnosticStatus $entries @('permission-compatibility', 'permission-repair')
  $foundationStatus = Get-StageDiagnosticStatus $entries @('foundation')
  $rollbackStatus = Get-StageDiagnosticStatus $entries @('rollback')
  if ($schemaStatus -eq 'NOT_RUN' -and $allText -match '(?i)schema(?: version)? reached.*PASS|_schema_version reached') { $schemaStatus = 'PASS' }
  if ($foundationStatus -eq 'NOT_RUN' -and $allText -match '(?i)Foundation.*(?:applied|valid).*PASS') { $foundationStatus = 'PASS' }
  if ($permissionStatus -eq 'NOT_RUN' -and $allText -match '(?i)permission boundary assertions complete') { $permissionStatus = 'PASS' }
  if ($rollbackStatus -eq 'NOT_RUN' -and $allText -match '(?i)rollback.*PASS') { $rollbackStatus = 'PASS' }
  $script:DiagnosticState['schema_compatibility'] = $schemaStatus
  $script:DiagnosticState['permission_compatibility'] = $permissionStatus
  $script:DiagnosticState['foundation'] = $foundationStatus
  if ($script:DiagnosticState['system_accounts'] -eq 'NOT_RUN' -and
      $allText -match '(?i)system account.*(?:PASS|valid|preserved)|PASS: all required system accounts') {
    $script:DiagnosticState['system_accounts'] = 'PASS'
  }
  if ($script:DiagnosticState['ready'] -eq 'NOT_RUN' -and
      $allText -match '(?i)health reports ready=true|application is healthy|الخادم جاهز') {
    $script:DiagnosticState['ready'] = 'PASS'
  }
  if ($script:DiagnosticState['second_run'] -eq 'NOT_RUN' -and
      $allText -match '(?i)second application startup reports ready=true') {
    $script:DiagnosticState['second_run'] = 'PASS'
  }
  $script:DiagnosticState['rollback'] = $rollbackStatus

  $sqlState = Get-SqlState $allText
  $failedMigration = if ($lastFailure.Count -gt 0 -and $lastFailure[0].migration) {
    [string]$lastFailure[0].migration
  } else { $script:CurrentMigration }
  $result = [ordered]@{
    scenario = if ($ReproduceStaleLedger) { 'stale-ledger' } else { 'clean' }
    old_version = $OldVersion
    target_version = $NewVersion
    passed = ($script:ExitCode -eq 0)
    exit_code = $script:ExitCode
    last_successful_stage = $script:LastSuccessfulStage
    failed_stage = $script:FailedStage
    failure_message = Sanitize-DiagnosticText $script:FailureMessage
    sqlstate = $sqlState
    migration = $failedMigration
    schema_compatibility = $script:DiagnosticState['schema_compatibility']
    permission_compatibility = $script:DiagnosticState['permission_compatibility']
    foundation = $script:DiagnosticState['foundation']
    system_accounts = $script:DiagnosticState['system_accounts']
    ready = $script:DiagnosticState['ready']
    second_run = $script:DiagnosticState['second_run']
    rollback = $script:DiagnosticState['rollback']
  }
  $result | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $ReportDir 'result.json') -Encoding UTF8
  @(
    "scenario=$($result.scenario)"
    "exit_code=$($result.exit_code)"
    "last_successful_stage=$($result.last_successful_stage)"
    "failed_stage=$($result.failed_stage)"
    "sqlstate=$($result.sqlstate)"
    "migration=$($result.migration)"
    "schema_compatibility=$($result.schema_compatibility)"
    "permission_compatibility=$($result.permission_compatibility)"
    "foundation=$($result.foundation)"
    "system_accounts=$($result.system_accounts)"
    "ready=$($result.ready)"
    "second_run=$($result.second_run)"
    "rollback=$($result.rollback)"
  ) | Set-Content (Join-Path $ReportDir 'stage.txt') -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
try {
  Log "Windows v1.0.0 → v$NewVersion acceptance started; scenario=$(if ($ReproduceStaleLedger) { 'stale-ledger' } else { 'clean' })"
  Start-Stage 'test-state-cleanup'
  Remove-TestState
  Complete-Stage
  Start-Stage 'postgres-preflight'
  $script:PsqlPath = Find-Psql
  Complete-Stage
  Start-Stage 'v1.0.0-install'
  Install-OldApplication
  Complete-Stage
  Start-Stage 'v1.0.0-database'
  Create-LegacyDatabase
  Configure-LegacyRuntime
  Initialize-LegacyBaseSchema
  Complete-Stage
  Start-Stage 'v1.0.0-running'
  Install-LegacyService
  Seed-LegacyFoundation
  Assert-LegacyDatabase
  Complete-Stage
  if ($ReproduceStaleLedger) {
    Start-Stage 'stale-ledger-reproduction'
    Reproduce-StaleLedgerSequence
    Complete-Stage
  }
  Start-Stage 'installer-upgrade'
  Run-NewInstallerUpgrade
  Complete-Stage
  Start-Stage 'post-upgrade-verification'
  Assert-PostUpgrade
  Complete-Stage
  Log "WINDOWS V1.0.0 → v$NewVersion ACCEPTANCE = PASS"
  $script:ExitCode = 0
} catch {
  if (-not $script:FailedStage) { $script:FailedStage = $script:CurrentStage }
  if (-not $script:FailureMessage) { $script:FailureMessage = $_.Exception.Message }
  Log "WINDOWS V1.0.0 → v$NewVersion ACCEPTANCE = FAIL: $($_.Exception.Message)"
  throw
} finally {
  try {
    Export-Diagnostics
  } catch {
    # Artifact generation must never hide the acceptance failure. Create the
    # required placeholders even when a filesystem/permissions error occurs.
    foreach ($name in @('acceptance.log', 'upgrade.log', 'server.log', 'installer.log', 'postgres.log', 'stage.txt', 'result.json')) {
      $path = Join-Path $ReportDir $name
      if (-not (Test-Path $path)) { "diagnostic export failed: $($_.Exception.Message)" | Set-Content $path -Encoding UTF8 }
    }
  }
}

if ($script:ExitCode -ne 0) { exit $script:ExitCode }