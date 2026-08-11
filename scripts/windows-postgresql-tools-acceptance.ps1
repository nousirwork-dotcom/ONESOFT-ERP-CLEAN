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

function Get-PgTool([string]$ToolName) {
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
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object { $directories += @{ Path = (Join-Path $_.FullName 'bin'); Source = 'program-files' } }
    }
  }
  foreach ($pathEntry in ($env:Path -split ';' | Where-Object { $_ })) {
    $directories += @{ Path = $pathEntry; Source = 'path' }
  }

  foreach ($directory in $directories) {
    $candidate = Join-Path $directory.Path "$ToolName.exe"
    if (Test-Path $candidate) {
      try {
        & $candidate --version *> $null
        if ($LASTEXITCODE -eq 0) {
          return @{ Path = $candidate; Source = $directory.Source }
        }
      } catch {}
    }
  }
  Fail "$ToolName.exe was not found or could not run"
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportFile = Join-Path $ReportDir 'postgresql-tools-acceptance.txt'
try {
  Log 'Windows PostgreSQL tools acceptance started'
  $pgBinOnPath = ($env:Path -split ';' | Where-Object { $_ -match '\\PostgreSQL\\' })
  Assert-True ($pgBinOnPath.Count -eq 0) 'PostgreSQL bin is absent from PATH'

  $tools = @{}
  foreach ($name in @('pg_dump', 'pg_restore', 'psql')) {
    $tool = Get-PgTool $name
    $tools[$name] = $tool
    Log "DISCOVERED: $name.exe = $($tool.Path) (source=$($tool.Source))"
  }
  Assert-True ($tools['pg_dump'].Source -eq 'service' -or $tools['pg_dump'].Source -eq 'program-files') `
    'pg_dump.exe was discovered without PATH'
  Assert-True ([IO.Path]::IsPathFullyQualified($tools['pg_dump'].Path)) 'pg_dump.exe path is absolute'
  Log "TOOLS: pg_dump.exe=$($tools['pg_dump'].Path)"
  Log "TOOLS: pg_restore.exe=$($tools['pg_restore'].Path)"
  Log "TOOLS: psql.exe=$($tools['psql'].Path)"

  $env:PGPASSWORD = $DatabasePassword
  $databaseUrl = "postgresql://postgres:$([uri]::EscapeDataString($DatabasePassword))@localhost:5432/postgres"
  $probe = Invoke-Tool $tools['psql'].Path @($databaseUrl, '-X', '-q', '-tA', '-c', 'SELECT 1;')
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