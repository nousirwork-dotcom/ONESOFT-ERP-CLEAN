#Requires -Version 7.0
#Requires -RunAsAdministrator

<#
.SYNOPSIS
  Collect read-only Windows diagnostics for the OneSoft sales-invoice issue.

.DESCRIPTION
  Run this script on the affected Windows machine after reproducing the
  invoice-save failure. It writes a redacted diagnostic folder and ZIP to the
  current user's Desktop.

  Database access is strictly read-only: every SQL call runs inside
  "BEGIN READ ONLY ... ROLLBACK". This script never runs INSERT, UPDATE,
  DELETE, ALTER, CREATE, DROP, TRUNCATE, migration, pg_dump, or pg_restore.

.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File .\windows-sales-diagnostics.ps1
#>

[CmdletBinding()]
param(
  [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$script:StartedAt = Get-Date
$script:ProgramDataRoot = Join-Path ($env:ProgramData ?? 'C:\ProgramData') 'OneSoft'
$script:InstallCandidates = @(
  'C:\Program Files\OneSoft ERP',
  'C:\Program Files\OneSoft-ERP',
  'C:\OneSoft-ERP',
  (Join-Path $script:ProgramDataRoot 'Install')
) | Select-Object -Unique
$script:PsqlPath = $null
$script:Db = $null
$script:DbStatus = 'not-attempted'
$script:OutputDirectory = $null
$script:ZipPath = $null

function Protect-SensitiveText {
  param([AllowNull()][string]$Text)
  if ($null -eq $Text) { return '' }

  $redacted = $Text
  $redacted = $redacted -replace '(?i)(postgres(?:ql)?://[^/\s]+):[^@\s]+@', '$1:***@'
  $redacted = $redacted -replace '(?i)(\b(?:PGPASSWORD|DATABASE_URL|ONESOFT_UPGRADE_DATABASE_URL|DB_PASSWORD|PASSWORD)\b\s*[:=]\s*)\S+', '$1***'
  $redacted = $redacted -replace '(?i)("(?:password|adminPassword|apiKey|token|secret|privateKey)"\s*:\s*")([^"]*)(")', '$1***$3'
  return $redacted
}

function Write-ReportFile {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [AllowNull()][string]$Content
  )
  $destination = Join-Path $script:OutputDirectory $RelativePath
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Protect-SensitiveText $Content | Set-Content -LiteralPath $destination -Encoding utf8
}

function Write-Status {
  param([string]$Message)
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

function Get-SafeFileName {
  param([string]$Value)
  $safe = ($Value -replace '^[A-Za-z]:', '' -replace '[\\/:*?"<>|]', '_')
  $safe = $safe -replace '\s+', '_'
  if ([string]::IsNullOrWhiteSpace($safe)) { return 'unnamed' }
  return $safe.Trim('_')
}

function Get-DesktopPath {
  $desktop = [Environment]::GetFolderPath('Desktop')
  if ([string]::IsNullOrWhiteSpace($desktop)) {
    $desktop = Join-Path ($env:USERPROFILE ?? $env:PUBLIC ?? 'C:\Users\Public') 'Desktop'
  }
  New-Item -ItemType Directory -Force -Path $desktop | Out-Null
  return $desktop
}

function Resolve-PsqlPath {
  $command = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @(
    (Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue),
    (Get-ChildItem 'C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue)
  ) | Where-Object { $_ } | Sort-Object FullName -Descending

  if ($candidates.Count -gt 0) { return $candidates[0].FullName }
  return $null
}

function Convert-PostgresUri {
  param([string]$ConnectionString)
  if ([string]::IsNullOrWhiteSpace($ConnectionString)) { return $null }

  try {
    $uri = [Uri]$ConnectionString
    if ($uri.Scheme -notin @('postgres', 'postgresql')) { return $null }
    $user = ''
    $password = ''
    if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
      $parts = $uri.UserInfo.Split(':', 2)
      $user = [Uri]::UnescapeDataString($parts[0])
      if ($parts.Count -gt 1) {
        $password = [Uri]::UnescapeDataString($parts[1])
      }
    }
    $database = $uri.AbsolutePath.Trim('/')
    return [pscustomobject]@{
      Host     = if ($uri.Host) { $uri.Host } else { 'localhost' }
      Port     = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
      Database = $database
      User     = $user
      Password = $password
      Source   = 'connection string'
    }
  } catch {
    return $null
  }
}

function Resolve-DatabaseConfig {
  $configPath = Join-Path $script:ProgramDataRoot 'config\onesoft.config.json'
  if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    try {
      $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
      if ($config.database) {
        $db = $config.database
        if ($db.host -and $db.name -and $db.user) {
          return [pscustomobject]@{
            Host     = [string]$db.host
            Port     = [int]($db.port ?? 5432)
            Database = [string]$db.name
            User     = [string]$db.user
            Password = [string]($db.password ?? '')
            Source   = $configPath
          }
        }
      }
    } catch {
      Write-Status "Could not parse $configPath: $($_.Exception.Message)"
    }
  }

  foreach ($name in @('ONESOFT_UPGRADE_DATABASE_URL', 'DATABASE_URL')) {
    $fromUri = Convert-PostgresUri ([Environment]::GetEnvironmentVariable($name))
    if ($fromUri) {
      $fromUri.Source = "$name environment variable"
      return $fromUri
    }
  }

  if ($env:PGHOST -and $env:PGDATABASE -and $env:PGUSER) {
    return [pscustomobject]@{
      Host     = $env:PGHOST
      Port     = [int]($env:PGPORT ?? 5432)
      Database = $env:PGDATABASE
      User     = $env:PGUSER
      Password = $env:PGPASSWORD ?? ''
      Source   = 'PG* environment variables'
    }
  }

  return $null
}

function Invoke-ReadOnlySql {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if (-not $script:PsqlPath -or -not $script:Db) {
    Write-ReportFile "database\$Name.txt" "SKIPPED: PostgreSQL connection settings or psql.exe were not available."
    return $null
  }

  $oldPassword = $env:PGPASSWORD
  $readOnlySql = @"
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20000';
$Sql
ROLLBACK;
"@
  try {
    if (-not [string]::IsNullOrEmpty($script:Db.Password)) {
      $env:PGPASSWORD = $script:Db.Password
    }
    $output = & $script:PsqlPath `
      -h $script:Db.Host `
      -p $script:Db.Port `
      -U $script:Db.User `
      -d $script:Db.Database `
      -w -X -q -A -F "`t" -P footer=off `
      -v ON_ERROR_STOP=1 `
      -c $readOnlySql 2>&1
    $text = ($output -join "`r`n").Trim()
    if ($LASTEXITCODE -ne 0) {
      $script:DbStatus = 'query-failed'
      Write-ReportFile "database\$Name.txt" "READ-ONLY QUERY FAILED`r`n$($text)"
      return $null
    }
    Write-ReportFile "database\$Name.tsv" $text
    return $text
  } catch {
    $script:DbStatus = 'query-failed'
    Write-ReportFile "database\$Name.txt" "READ-ONLY QUERY FAILED`r`n$($_.Exception.Message)"
    return $null
  } finally {
    if ($null -eq $oldPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $oldPassword
    }
  }
}

function Get-TableColumns {
  param([string]$TableName)
  $tableLiteral = $TableName.Replace("'", "''")
  $output = Invoke-ReadOnlySql -Name "columns_$TableName" -Sql @"
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '$tableLiteral'
ORDER BY ordinal_position;
"@
  if (-not $output) { return @() }
  return @($output -split "`r?`n" | Select-Object -Skip 1 | Where-Object {
    $_ -match '^[A-Za-z_][A-Za-z0-9_]*$'
  })
}

function Get-TableExists {
  param([string]$TableName)
  $literal = $TableName.Replace("'", "''")
  $output = Invoke-ReadOnlySql -Name "exists_$TableName" -Sql @"
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '$literal'
);
"@
  return ($output -match '(?m)^t$')
}

function Quote-PgIdentifier {
  param([string]$Identifier)
  if ($Identifier -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "Unexpected database identifier: $Identifier"
  }
  return '"' + $Identifier + '"'
}

function Get-ColumnExpression {
  param(
    [string[]]$Columns,
    [string]$TableAlias,
    [string]$ColumnName,
    [string]$OutputName
  )
  if ($Columns -contains $ColumnName) {
    return "$TableAlias.$(Quote-PgIdentifier $ColumnName) AS $(Quote-PgIdentifier $OutputName)"
  }
  return "NULL::text AS $(Quote-PgIdentifier $OutputName)"
}

function Collect-DatabaseDiagnostics {
  if (-not $script:PsqlPath) {
    Write-ReportFile 'database\connection.txt' 'psql.exe was not found. No database query was attempted.'
    return
  }
  if (-not $script:Db) {
    Write-ReportFile 'database\connection.txt' 'No OneSoft database configuration was found. No database query was attempted.'
    return
  }

  $script:DbStatus = 'connected'
  Write-ReportFile 'database\connection-info.txt' @"
psql: $script:PsqlPath
host: $($script:Db.Host)
port: $($script:Db.Port)
database: $($script:Db.Database)
user: $($script:Db.User)
source: $($script:Db.Source)
password: [redacted]
"@

  Invoke-ReadOnlySql -Name 'probe' -Sql @"
SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();
"@ | Out-Null

  $warehouseColumns = Get-TableColumns 'warehouses'
  if (Get-TableExists 'warehouses') {
    $warehouseExpressions = @(
      'w.id AS "id"',
      (Get-ColumnExpression $warehouseColumns 'w' 'org_id' 'org_id'),
      (Get-ColumnExpression $warehouseColumns 'w' 'code' 'code'),
      (Get-ColumnExpression $warehouseColumns 'w' 'name' 'name'),
      (Get-ColumnExpression $warehouseColumns 'w' 'name2' 'name2'),
      (Get-ColumnExpression $warehouseColumns 'w' 'branch_id' 'branch_id'),
      (Get-ColumnExpression $warehouseColumns 'w' 'foundation_key' 'foundation_key'),
      (Get-ColumnExpression $warehouseColumns 'w' 'record_origin' 'record_origin'),
      (Get-ColumnExpression $warehouseColumns 'w' 'is_active' 'is_active')
    )
    Invoke-ReadOnlySql -Name 'warehouses' -Sql @"
SELECT $($warehouseExpressions -join ",`n       ")
FROM public."warehouses" AS w
ORDER BY w.id;
"@ | Out-Null
  } else {
    Write-ReportFile 'database\warehouses.txt' 'TABLE MISSING: public.warehouses'
  }

  $branchColumns = Get-TableColumns 'branches'
  if (Get-TableExists 'branches') {
    $branchExpressions = @(
      'b.id AS "id"',
      (Get-ColumnExpression $branchColumns 'b' 'org_id' 'org_id'),
      (Get-ColumnExpression $branchColumns 'b' 'code' 'code'),
      (Get-ColumnExpression $branchColumns 'b' 'name' 'name')
    )
    Invoke-ReadOnlySql -Name 'branches' -Sql @"
SELECT $($branchExpressions -join ",`n       ")
FROM public."branches" AS b
ORDER BY b.id;
"@ | Out-Null
  } else {
    Write-ReportFile 'database\branches.txt' 'TABLE MISSING: public.branches'
  }

  if (Get-TableExists 'sales_invoices') {
    Invoke-ReadOnlySql -Name 'sales_invoices_schema' -Sql @"
SELECT ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales_invoices'
ORDER BY ordinal_position;
"@ | Out-Null

    Invoke-ReadOnlySql -Name 'sales_invoices_relevant_columns' -Sql @"
SELECT ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sales_invoices'
  AND column_name IN (
    'id','org_id','invoice_number','invoice_type','invoice_date',
    'warehouse_id','branch_id','user_id','seller_user_id','seller_legal_name',
    'seller_tax_number','journal_id','doc_type_id','status','is_posted',
    'customer_id','total','payment_method','payment_breakdown'
  )
ORDER BY ordinal_position;
"@ | Out-Null

    Invoke-ReadOnlySql -Name 'sales_invoices_constraints' -Sql @"
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS rel ON rel.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public' AND rel.relname = 'sales_invoices'
ORDER BY con.conname;
"@ | Out-Null
  } else {
    Write-ReportFile 'database\sales_invoices.txt' 'TABLE MISSING: public.sales_invoices'
  }

  $warehouseRefOutput = Invoke-ReadOnlySql -Name 'warehouse_reference_tables' -Sql @"
SELECT DISTINCT c.table_name
FROM information_schema.columns AS c
JOIN information_schema.tables AS t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
  AND c.column_name = 'warehouse_id'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name;
"@
  $referenceTables = @()
  if ($warehouseRefOutput) {
    $referenceTables = @($warehouseRefOutput -split "`r?`n" | Select-Object -Skip 1 | Where-Object {
      $_ -match '^[A-Za-z_][A-Za-z0-9_]*$'
    })
  }

  $combined = [System.Collections.Generic.List[string]]::new()
  $combined.Add('table_name`twarehouse_id`treference_count')
  foreach ($table in $referenceTables) {
    $quotedTable = Quote-PgIdentifier $table
    $tableOutput = Invoke-ReadOnlySql -Name "warehouse_refs_$table" -Sql @"
SELECT warehouse_id::text, COUNT(*)::bigint
FROM public.$quotedTable
WHERE warehouse_id IS NOT NULL
GROUP BY warehouse_id
ORDER BY warehouse_id;
"@
    if ($tableOutput) {
      foreach ($line in @($tableOutput -split "`r?`n" | Select-Object -Skip 1 | Where-Object { $_ -match '\S' })) {
        $combined.Add("$table`t$line")
      }
    }
  }
  Write-ReportFile 'database\warehouse_references_all.tsv' ($combined -join "`r`n")

  if (Get-TableExists '__drizzle_migrations') {
    $migrationColumns = Get-TableColumns '__drizzle_migrations'
    $migrationSelect = @(
      if ($migrationColumns -contains 'id') { 'id' } else { 'NULL::text AS id' }
      if ($migrationColumns -contains 'tag') { 'tag' } else { 'NULL::text AS tag' }
      if ($migrationColumns -contains 'applied_at') { 'applied_at' } else { 'NULL::text AS applied_at' }
    )
    Invoke-ReadOnlySql -Name 'drizzle_migrations' -Sql @"
SELECT $($migrationSelect -join ', ')
FROM public."__drizzle_migrations"
ORDER BY id;
"@ | Out-Null

    Invoke-ReadOnlySql -Name 'migration_presence' -Sql @"
SELECT tag, COUNT(*)::int AS count
FROM public."__drizzle_migrations"
WHERE tag IN ('0040_branch_seller', '0093_schema_compatibility_repair', '0095_sales_invoice_schema_compatibility', '0096_warehouse_branch_reconciliation')
GROUP BY tag
ORDER BY tag;
"@ | Out-Null
  } else {
    Write-ReportFile 'database\drizzle_migrations.txt' 'TABLE MISSING: public.__drizzle_migrations'
  }

  if (Get-TableExists '_schema_version') {
    $schemaColumns = Get-TableColumns '_schema_version'
    $schemaSelect = @(
      if ($schemaColumns -contains 'id') { 'id' } else { 'NULL::text AS id' }
      if ($schemaColumns -contains 'version') { 'version' } else { 'NULL::text AS version' }
      if ($schemaColumns -contains 'stamped_at') { 'stamped_at' } else { 'NULL::text AS stamped_at' }
    )
    Invoke-ReadOnlySql -Name 'schema_version' -Sql @"
SELECT $($schemaSelect -join ', ')
FROM public."_schema_version"
ORDER BY id;
"@ | Out-Null
  } else {
    Write-ReportFile 'database\schema_version.txt' 'TABLE MISSING: public._schema_version'
  }
}

function Collect-VersionDiagnostics {
  $versionFiles = @(
    (Join-Path $script:ProgramDataRoot 'version.json')
  ) + @(
    $script:InstallCandidates | ForEach-Object {
      @(
        (Join-Path $_ 'version.json'),
        (Join-Path $_ 'resources\app\version.json'),
        (Join-Path $_ 'resources\app\package.json')
      )
    }
  ) | Where-Object { $_ } | Select-Object -Unique

  $records = [System.Collections.Generic.List[object]]::new()
  foreach ($path in $versionFiles) {
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      $records.Add([pscustomobject]@{
        path = $path
        content = Protect-SensitiveText (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
      })
    }
  }

  $executables = @(
    $script:InstallCandidates | ForEach-Object { Join-Path $_ 'OneSoft ERP.exe' }
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -Unique
  foreach ($path in $executables) {
    $item = Get-Item -LiteralPath $path
    $records.Add([pscustomobject]@{
      path = $path
      file_version = $item.VersionInfo.FileVersion
      product_version = $item.VersionInfo.ProductVersion
      last_write_time = $item.LastWriteTime
      length = $item.Length
    })
  }

  $registryRows = @()
  foreach ($root in @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )) {
    $registryRows += Get-ItemProperty $root -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like '*OneSoft*' } |
      Select-Object DisplayName, DisplayVersion, InstallLocation, Publisher, UninstallString
  }

  Write-ReportFile 'version\installed-version.json' (($records | ConvertTo-Json -Depth 8))
  Write-ReportFile 'version\uninstall-registry.json' (($registryRows | ConvertTo-Json -Depth 5))
  Write-ReportFile 'version\powershell-version.txt' ($PSVersionTable | Out-String)
}

function Collect-ProcessDiagnostics {
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like 'OneSoft*' -or
      $_.Name -like '*Setup*' -or
      $_.Name -like 'postgres*' -or
      $_.Name -like 'nssm*'
    } |
    Select-Object Name, ProcessId, ParentProcessId, ExecutablePath, CommandLine
  $services = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like 'OneSoft*' -or $_.DisplayName -like '*OneSoft*' -or $_.Name -like 'postgres*'
    } |
    Select-Object Name, DisplayName, State, StartMode, ProcessId, PathName
  Write-ReportFile 'system\processes.json' (($processes | ConvertTo-Json -Depth 5))
  Write-ReportFile 'system\services.json' (($services | ConvertTo-Json -Depth 5))
}

function Collect-Logs {
  $logRoots = @(
    (Join-Path $script:ProgramDataRoot 'Logs'),
    $script:ProgramDataRoot,
    (Join-Path ($env:APPDATA ?? '') 'OneSoft'),
    (Join-Path ($env:LOCALAPPDATA ?? '') 'OneSoft')
  ) + @(
    $script:InstallCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
  ) + @(
    Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      @(
        (Join-Path $_.FullName 'AppData\Roaming\OneSoft'),
        (Join-Path $_.FullName 'AppData\Local\OneSoft')
      )
    }
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } | Select-Object -Unique

  $files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
  foreach ($root in $logRoots) {
    try {
      Get-ChildItem -LiteralPath $root -File -Recurse -Depth 5 -ErrorAction SilentlyContinue |
        Where-Object {
          $_.Extension -in @('.log', '.txt', '.json') -or
          $_.Name -match '(?i)(server|sales|upgrade|installer|error|exception|crash)'
        } |
        ForEach-Object {
          if (-not ($files.FullName -contains $_.FullName)) { $files.Add($_) }
        }
    } catch {
      Write-Status "Could not enumerate logs under $root: $($_.Exception.Message)"
    }
  }

  $pattern = '(?i)sales\.create|INSERT\s+ERROR|SQLSTATE|constraint|detail|table|column|sales_invoices|warehouse_id'
  $matches = [System.Collections.Generic.List[string]]::new()
  foreach ($file in $files | Sort-Object LastWriteTime -Descending) {
    try {
      $relative = Join-Path 'logs\files' (Get-SafeFileName $file.FullName)
      if ($file.Length -le 25MB) {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
      } else {
        $content = "[FILE TOO LARGE; LAST 4000 LINES ONLY]`r`n" +
          ((Get-Content -LiteralPath $file.FullName -Tail 4000 -ErrorAction SilentlyContinue) -join "`r`n")
      }
      Write-ReportFile $relative $content

      $lineNumber = 0
      foreach ($line in Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue) {
        $lineNumber++
        if ($line -match $pattern) {
          $matches.Add("$($file.FullName):$lineNumber`t$(Protect-SensitiveText $line)")
        }
      }
    } catch {
      $matches.Add("$($file.FullName)`tREAD FAILED: $($_.Exception.Message)")
    }
  }
  Write-ReportFile 'logs\matching-sales-errors.txt' ($matches -join "`r`n")
  Write-ReportFile 'logs\catalog.txt' (($files | Sort-Object LastWriteTime -Descending |
    Select-Object FullName, Length, LastWriteTime, CreationTime | ConvertTo-Json -Depth 5))
}

function Initialize-Output {
  $desktop = Get-DesktopPath
  if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $script:OutputDirectory = Join-Path $desktop "OneSoft-Sales-Diagnostic-$stamp"
  } else {
    $script:OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
  }
  New-Item -ItemType Directory -Force -Path $script:OutputDirectory | Out-Null
  $script:ZipPath = "$($script:OutputDirectory).zip"
}

try {
  Initialize-Output
  Write-Status "Writing read-only diagnostics to $script:OutputDirectory"

  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { throw 'Run this script from an elevated PowerShell window (as Administrator).' }

  $script:PsqlPath = Resolve-PsqlPath
  $script:Db = Resolve-DatabaseConfig
  Write-ReportFile 'run-info.txt' @"
OneSoft Windows sales diagnostics
started_at: $($script:StartedAt.ToString('o'))
computer: $env:COMPUTERNAME
user: $env:USERDOMAIN\$env:USERNAME
powershell: $($PSVersionTable.PSVersion)
administrator: $isAdmin
psql: $($script:PsqlPath ?? 'not-found')
database_source: $($script:Db.Source ?? 'not-found')
database_host: $($script:Db.Host ?? 'not-found')
database_port: $($script:Db.Port ?? 'not-found')
database_name: $($script:Db.Database ?? 'not-found')
database_user: $($script:Db.User ?? 'not-found')
database_password: [redacted/not-exported]

READ-ONLY GUARANTEE
- Database calls use BEGIN READ ONLY ... ROLLBACK.
- No INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, TRUNCATE, migration, pg_dump, or pg_restore is executed.
- The only writes are diagnostic files and this ZIP on the Desktop.
"@

  Collect-VersionDiagnostics
  Collect-ProcessDiagnostics
  Collect-Logs
  Collect-DatabaseDiagnostics

  Write-ReportFile 'completion.txt' @"
completed_at: $((Get-Date).ToString('o'))
database_status: $script:DbStatus
zip_path: $script:ZipPath
"@
  Compress-Archive -Path (Join-Path $script:OutputDirectory '*') `
    -DestinationPath $script:ZipPath -CompressionLevel Optimal -Force
  Write-Status "DONE: $script:ZipPath"
  Write-Output $script:ZipPath
} catch {
  $message = Protect-SensitiveText $_.Exception.ToString()
  Write-Status "FAILED: $message"
  if ($script:OutputDirectory) {
    Write-ReportFile 'fatal-error.txt' $message
  }
  exit 1
}