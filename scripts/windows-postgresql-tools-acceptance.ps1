#Requires -Version 7.0
<#
.SYNOPSIS
  Windows acceptance for PostgreSQL tool resolution and the real Legacy Upgrade.

  This is intentionally separate from the published-artifact updater acceptance:
  it tests the checked-in Upgrade Core without building or publishing an installer.
#>
[CmdletBinding()]
param(
  [string]$DatabasePassword = 'OneSoftAcceptance2026',
  [string]$ReportDir = "$env:GITHUB_WORKSPACE\windows-postgresql-tools-acceptance"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$script:Log = [System.Collections.Generic.List[string]]::new()

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

function Invoke-Tool([string]$FilePath, [string[]]$Arguments) {
  Log "EXEC: $FilePath $($Arguments -join ' ')"
  $output = & $FilePath @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail "command failed with exit code ${LASTEXITCODE}: $FilePath`n$($output -join "`n")"
  }
  return ($output -join "`n")
}

function Ensure-Nssm {
  $nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if (-not $nssm) {
    if (-not (Get-Command choco.exe -ErrorAction SilentlyContinue)) {
      Fail 'NSSM is missing and Chocolatey is unavailable'
    }
    Invoke-Tool 'choco.exe' @('install', 'nssm', '--yes', '--no-progress')
    $chocolateyBin = 'C:\ProgramData\chocolatey\bin'
    if (($env:Path -split ';') -notcontains $chocolateyBin) {
      $env:Path = "$chocolateyBin;$env:Path"
    }
    $nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue
  }
  Assert-True ($null -ne $nssm) 'NSSM is available for OneSoft-Server service acceptance'
  Log "NSSM: $($nssm.Source)"
}

function Get-ServiceToolBin {
  $sc = Join-Path ($env:SystemRoot ?? 'C:\Windows') 'System32\sc.exe'
  $services = & $sc query state= all 2>$null
  foreach ($line in $services) {
    if ($line -match 'SERVICE_NAME:\s*(\S+)' -and $Matches[1] -match 'postgres') {
      $config = & $sc qc $Matches[1] 2>$null
      foreach ($configLine in $config) {
        if ($configLine -match 'BINARY_PATH_NAME\s*:\s*(.+)') {
          $image = $Matches[1].Trim()
          if ($image -match '^"([^"]+\.exe)"') { return (Split-Path $Matches[1]) }
          if ($image -match '^(\S+\.exe)') { return (Split-Path $Matches[1]) }
        }
      }
    }
  }
  return $null
}

function Get-PgToolDirectories {
  $serviceBin = Get-ServiceToolBin
  $roots = @(
    $env:ProgramW6432,
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    'C:\Program Files',
    'C:\Program Files (x86)'
  ) | Where-Object { $_ } | Select-Object -Unique

  $directories = @()
  if ($serviceBin) { $directories += @{ Path = $serviceBin; Source = 'service' } }
  foreach ($root in $roots) {
    $pgRoot = Join-Path $root 'PostgreSQL'
    if (Test-Path $pgRoot) {
      Get-ChildItem $pgRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+(\.\d+)?$' } |
        Sort-Object {
          $versionText = $_.Name
          if ($versionText -match '^\d+$') { $versionText = "$versionText.0" }
          [version]$versionText
        } -Descending |
        ForEach-Object { $directories += @{ Path = (Join-Path $_.FullName 'bin'); Source = 'program-files' } }
    }
  }
  foreach ($pathEntry in ($env:Path -split ';' | Where-Object { $_ })) {
    $directories += @{ Path = $pathEntry; Source = 'path' }
  }
  return $directories
}

function Get-PgToolVersion([string]$FilePath) {
  $output = & $FilePath --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    return $null
  }
  $text = ($output -join ' ').Trim()
  $match = [regex]::Match($text, '\b(\d+)\.(\d+)(?:\.\d+)?\b')
  if (-not $match.Success) {
    return $null
  }
  return @{
    Text = $text
    Major = [int]$match.Groups[1].Value
  }
}

function Get-ServerMajorVersion([string]$PsqlPath) {
  $output = & $PsqlPath `
    '-h' 'localhost' `
    '-p' '5432' `
    '-U' 'postgres' `
    '-d' 'postgres' `
    '--no-password' `
    '-X' '-q' '-tA' `
    '-c' 'SHOW server_version_num;' 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail "could not query PostgreSQL server version with $PsqlPath`n$($output -join "`n")"
  }
  $serverVersionNum = [int64](($output -join '').Trim())
  if ($serverVersionNum -lt 10000) {
    Fail "invalid PostgreSQL server_version_num: $serverVersionNum"
  }
  return [int][math]::Floor($serverVersionNum / 10000)
}

function Get-MatchingPgTools([int]$ServerMajor, [object[]]$Directories) {
  foreach ($directory in $Directories) {
    $found = @{}
    $valid = $true
    foreach ($name in @('pg_dump', 'pg_restore', 'psql')) {
      $candidate = Join-Path $directory.Path "$name.exe"
      if (-not (Test-Path $candidate)) {
        $valid = $false
        break
      }
      $version = Get-PgToolVersion $candidate
      if (-not $version -or $version.Major -ne $ServerMajor) {
        $valid = $false
        break
      }
      $found[$name] = @{
        Path = $candidate
        Source = $directory.Source
        Version = $version.Text
        Major = $version.Major
      }
    }
    if ($valid) {
      return $found
    }
  }
  Fail "no single PostgreSQL bin contains pg_dump, pg_restore and psql matching server major $ServerMajor"
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportFile = Join-Path $ReportDir 'postgresql-tools-acceptance.txt'
try {
  Log 'Windows PostgreSQL tools acceptance started'
  Ensure-Nssm
  $pgBinOnPath = ($env:Path -split ';' | Where-Object { $_ -match '\\PostgreSQL\\' })
  Assert-True ($pgBinOnPath.Count -eq 0) 'PostgreSQL bin is absent from PATH'

  $env:PGPASSWORD = $DatabasePassword
  $directories = @(Get-PgToolDirectories)
  $probePsql = $null
  foreach ($directory in $directories) {
    $candidate = Join-Path $directory.Path 'psql.exe'
    if (Test-Path $candidate) {
      $version = Get-PgToolVersion $candidate
      if ($version) {
        $probePsql = $candidate
        break
      }
    }
  }
  if (-not $probePsql) { Fail 'psql.exe was not found for PostgreSQL server version probe' }
  $serverMajor = Get-ServerMajorVersion $probePsql
  Log "Server major version: $serverMajor"

  $tools = Get-MatchingPgTools $serverMajor $directories
  foreach ($name in @('pg_dump', 'pg_restore', 'psql')) {
    Log "DISCOVERED: $name.exe = $($tools[$name].Path) (source=$($tools[$name].Source))"
    Log "$name version: $($tools[$name].Version)"
  }
  Assert-True ($tools['pg_dump'].Source -eq 'service' -or $tools['pg_dump'].Source -eq 'program-files') `
    'pg_dump.exe was discovered without PATH'
  Assert-True ([IO.Path]::IsPathFullyQualified($tools['pg_dump'].Path)) 'pg_dump.exe path is absolute'
  $toolBins = @(
    (Split-Path $tools['pg_dump'].Path),
    (Split-Path $tools['pg_restore'].Path),
    (Split-Path $tools['psql'].Path)
  ) | Select-Object -Unique
  Assert-True ($toolBins.Count -eq 1) 'all PostgreSQL tools come from the same bin directory'
  Assert-True (
    $tools['pg_dump'].Major -eq $serverMajor -and
    $tools['pg_restore'].Major -eq $serverMajor -and
    $tools['psql'].Major -eq $serverMajor
  ) 'PostgreSQL tool majors match the server major version'
  Log "TOOLS: pg_dump.exe=$($tools['pg_dump'].Path)"
  Log "TOOLS: pg_restore.exe=$($tools['pg_restore'].Path)"
  Log "TOOLS: psql.exe=$($tools['psql'].Path)"

  $databaseUrl = "postgresql://postgres:$([uri]::EscapeDataString($DatabasePassword))@localhost:5432/postgres"
  $probe = Invoke-Tool $tools['psql'].Path @(
    '-h', 'localhost', '-p', '5432', '-U', 'postgres', '-d', 'postgres',
    '--no-password', '-X', '-q', '-tA', '-c', 'SELECT 1;'
  )
  Assert-True ($probe.Trim() -eq '1') 'PostgreSQL service is installed and reachable'

  $repo = $env:GITHUB_WORKSPACE
  if (-not $repo) { $repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
  Push-Location $repo
  try {
    $env:DATABASE_URL = $databaseUrl
    Log "Running source Legacy Upgrade acceptance with PATH intentionally excluding PostgreSQL"
    & pnpm --dir installer run test:legacy-upgrade 2>&1 | ForEach-Object { Log "$_" }
    if ($LASTEXITCODE -ne 0) { Fail 'Legacy Upgrade acceptance failed' }
    Log 'PASS: Legacy Upgrade acceptance'
    Log 'PASS: Backup'
    Log 'PASS: Restore'
  } finally {
    Pop-Location
  }

  $script:Log.Add('RESULT: PASS')
  $script:Log | Set-Content $reportFile -Encoding utf8
  Log 'PASS: Windows PostgreSQL tools acceptance completed'
} catch {
  $script:Log.Add('RESULT: FAIL')
  $script:Log | Set-Content $reportFile -Encoding utf8
  throw
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}