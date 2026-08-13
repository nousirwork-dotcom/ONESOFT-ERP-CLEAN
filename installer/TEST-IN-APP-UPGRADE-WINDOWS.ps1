#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP — In-App Legacy Bootstrap acceptance test

.DESCRIPTION
    Executes the real customer-facing first-upgrade scenario on Windows:
      installed 1.0.26 + no migration-credential.bin + no Legacy admin fields
      -> start OneSoft -> start In-App Update manually
      -> interactive one-time PostgreSQL credential prompt
      -> Upgrade Core -> 0092 + Foundation + service health

    This script intentionally keeps the credential entry interactive. It never
    accepts or writes the PostgreSQL password. The operator enters it only in
    the OneSoft Upgrade Wizard, while the script uses a separate read-only
    verification connection after the upgrade.

.USAGE
    PowerShell (Admin):
      .\TEST-IN-APP-UPGRADE-WINDOWS.ps1 `
         -InstallerExe "C:\Build\OneSoftSetup-1.0.28-x64.exe"

    The script does not launch the installer automatically. It first verifies
    the exact precondition, then asks the operator to start the update from
    inside OneSoft and complete the Wizard.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$InstallerExe,

    [string]$InstallDir = "C:\OneSoft-ERP",
    [string]$ExpectedOldVersion = "1.0.26",
    [string]$ExpectedNewVersion = "1.0.28",
    [string]$ReportDir = "$env:USERPROFILE\Desktop\OneSoft-InApp-Upgrade-Report"
)

$ErrorActionPreference = "Stop"
$ProgramDataRoot = Join-Path $env:ProgramData "OneSoft"
$ConfigPath = Join-Path $ProgramDataRoot "config\onesoft.config.json"
$CredentialPath = Join-Path $ProgramDataRoot "Security\migration-credential.bin"
$VersionPath = Join-Path $ProgramDataRoot "version.json"
$BackupRoot = Join-Path $ProgramDataRoot "Backups"
$Log = [System.Collections.Generic.List[string]]::new()
$Pass = 0
$Fail = 0

function Pass($message) {
    $script:Pass++
    $line = "[PASS] $message"
    $script:Log.Add($line)
    Write-Host "  ✅ $message" -ForegroundColor Green
}

function Fail($message) {
    $script:Fail++
    $line = "[FAIL] $message"
    $script:Log.Add($line)
    Write-Host "  ❌ $message" -ForegroundColor Red
}

function Info($message) {
    $line = "[INFO] $message"
    $script:Log.Add($line)
    Write-Host "  ℹ️  $message" -ForegroundColor Gray
}

function Require-Path($path, $label) {
    if (Test-Path $path) { Pass "$label موجود: $path" }
    else { Fail "$label مفقود: $path" }
}

function Read-Json($path) {
    return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
}

function Wait-Health($url, $timeoutSeconds = 120) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    do {
        try {
            $response = Invoke-RestMethod -Uri $url -TimeoutSec 5 -ErrorAction Stop
            if ($response.ready -eq $true) { return $response }
        } catch {}
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    return $null
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Log.Add("OneSoft In-App Legacy Bootstrap acceptance")
$Log.Add("Started: $(Get-Date -Format s)")
$Log.Add("Installer: $InstallerExe")

Write-Host "`n=== Preconditions: installed 1.0.26 without bootstrap credentials ===" -ForegroundColor Cyan
Require-Path $InstallerExe "1.0.28 installer"
Require-Path $ConfigPath "OneSoft config"
Require-Path $VersionPath "version marker"

if (-not (Test-Path $ConfigPath) -or -not (Test-Path $VersionPath)) {
    throw "Required installed state is missing."
}

$config = Read-Json $ConfigPath
$version = Read-Json $VersionPath
if ($version.version -eq $ExpectedOldVersion) { Pass "Installed version is $ExpectedOldVersion" }
else { Fail "Expected installed version $ExpectedOldVersion, found $($version.version)" }

if ($config.database.user -eq "onesoft_app") {
    Pass "Runtime role is onesoft_app"
} else {
    Fail "Expected runtime role onesoft_app, found $($config.database.user)"
}

$adminUserProperty = $config.database.PSObject.Properties["adminUser"]
$adminPasswordProperty = $config.database.PSObject.Properties["adminPassword"]
if ($null -eq $adminUserProperty -and $null -eq $adminPasswordProperty) {
    Pass "No Legacy adminUser/adminPassword fields are present"
} else {
    Fail "Legacy admin credential fields are present; remove them before this scenario"
}

if (Test-Path $CredentialPath) {
    Fail "migration-credential.bin exists; this is not the requested first-bootstrap state"
} else {
    Pass "migration-credential.bin is absent"
}

$existingServer = Get-Service -Name "OneSoft-Server" -ErrorAction SilentlyContinue
if ($null -ne $existingServer) { Pass "OneSoft-Server service is installed" }
else { Fail "OneSoft-Server service is not installed" }

Write-Host "`n=== Operator action: run the real In-App update ===" -ForegroundColor Cyan
Write-Host "1. Start OneSoft ERP from: $InstallDir"
Write-Host "2. Use the in-app update notification/settings to download and install $ExpectedNewVersion."
Write-Host "3. Confirm that the installer opens the interactive Upgrade Wizard."
Write-Host "4. Enter PostgreSQL administrative credentials in the Wizard only once."
Write-Host "5. Wait until the application returns and the service is ready."
Read-Host "Press Enter after the complete In-App upgrade"

Write-Host "`n=== Post-upgrade verification ===" -ForegroundColor Cyan
Require-Path $CredentialPath "DPAPI migration credential"
Require-Path $VersionPath "updated version marker"

$newVersion = Read-Json $VersionPath
if ($newVersion.version -eq $ExpectedNewVersion) {
    Pass "Version marker is $ExpectedNewVersion"
} else {
    Fail "Expected version $ExpectedNewVersion, found $($newVersion.version)"
}

$postConfig = Read-Json $ConfigPath
if ($postConfig.database.user -eq "onesoft_app") {
    Pass "Runtime config remains onesoft_app"
} else {
    Fail "Runtime config was not persisted as onesoft_app"
}

$postAdminUser = $postConfig.database.PSObject.Properties["adminUser"]
$postAdminPassword = $postConfig.database.PSObject.Properties["adminPassword"]
if ($null -eq $postAdminUser -and $null -eq $postAdminPassword) {
    Pass "Post-bootstrap config contains no PostgreSQL admin credential"
} else {
    Fail "Post-bootstrap config still contains PostgreSQL admin credential"
}

$health = Wait-Health "http://127.0.0.1:3000/api/health"
if ($null -ne $health -and $health.ready -eq $true) {
    Pass "Health ready=true"
    if ($health.version -eq $ExpectedNewVersion) { Pass "Health version is $ExpectedNewVersion" }
    else { Fail "Health version is $($health.version), expected $ExpectedNewVersion" }
} else {
    Fail "Health did not reach ready=true within timeout"
}

if ($null -ne $existingServer) {
    $serviceAfter = Get-Service -Name "OneSoft-Server" -ErrorAction SilentlyContinue
    if ($serviceAfter.Status -eq "Running") { Pass "OneSoft-Server is Running" }
    else { Fail "OneSoft-Server status is $($serviceAfter.Status)" }
}

$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if ($null -eq $psql) {
    Info "psql.exe not found; database assertions were not run"
} else {
    $dbHost = $postConfig.database.host
    $dbPort = [string]$postConfig.database.port
    $dbName = $postConfig.database.name
    $env:PGPASSWORD = [string]$postConfig.database.password
    Info "Using the persisted Runtime database credential for read-only verification."
    $schema = & $psql.FullName -h $dbHost -p $dbPort -d $dbName -U "onesoft_app" -tAc "SELECT version FROM _schema_version WHERE id = 1" 2>&1
    if ($schema.Trim() -eq "0093_schema_compatibility_repair") {
        Pass "Schema ledger is 0093_schema_compatibility_repair"
    } else {
        Fail "Schema ledger is '$($schema.Trim())', expected 0093_schema_compatibility_repair"
    }
    $roles = & $psql.FullName -h $dbHost -p $dbPort -d $dbName -U "onesoft_app" -tAc "SELECT COUNT(*) FROM pg_roles WHERE rolname IN ('onesoft_schema_owner','onesoft_migrator')" 2>&1
    if ($roles.Trim() -eq "2") { Pass "onesoft_schema_owner and onesoft_migrator exist" }
    else { Fail "Expected both migration roles; query returned '$($roles.Trim())'" }
    $adminFields = & $psql.FullName -h $dbHost -p $dbPort -d $dbName -U "onesoft_app" -tAc "SELECT COUNT(*) FROM pg_roles WHERE rolname = 'onesoft_app' AND rolsuper = false" 2>&1
    if ($adminFields.Trim() -eq "1") { Pass "onesoft_app is not SUPERUSER" }
    else { Fail "onesoft_app privilege verification failed: '$($adminFields.Trim())'" }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$report = Join-Path $ReportDir ("InApp-Upgrade-{0}.txt" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$Log.Add("Pass: $Pass")
$Log.Add("Fail: $Fail")
$Log.Add("Finished: $(Get-Date -Format s)")
$Log | Out-File -Encoding UTF8 -FilePath $report

Write-Host "`n=== Result ===" -ForegroundColor Cyan
Write-Host "PASS: $Pass   FAIL: $Fail"
Write-Host "Report: $report"
if ($Fail -gt 0) { exit 1 }
exit 0