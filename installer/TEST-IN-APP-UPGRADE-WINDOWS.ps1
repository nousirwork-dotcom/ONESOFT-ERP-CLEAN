#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP — real Windows Legacy upgrade acceptance test

.DESCRIPTION
    Runs the customer-facing upgrade through the installed OneSoft application.
    The operator only starts the in-app update and enters PostgreSQL
    administrative credentials in the OneSoft Upgrade Wizard. This script never
    writes SQL, creates accounts, or changes the database manually.

    After the real upgrade reaches the requested version, the script performs
    read-only PostgreSQL assertions for:
      - migration 0093_schema_compatibility_repair
      - the complete 0093 schema compatibility contract
      - Foundation status and 77 Foundation records per active organization
      - the four required system accounts and duplicate detection
      - ready=true

    It then restarts OneSoft-Server, which exercises the second application
    startup against the same database, and repeats the ledger/Foundation/
    account/ready checks for idempotency.

.USAGE
    PowerShell (Admin):
      .\TEST-IN-APP-UPGRADE-WINDOWS.ps1 `
        -InstallerExe "C:\Build\OneSoftSetup-1.0.39-x64.exe"

    InstallerExe is optional. When omitted, the script automatically locates
    OneSoftSetup-1.0.39-x64.exe next to this script, in Downloads, or on the
    Desktop.

    ExpectedOldVersion is optional. When supplied, it is checked against the
    installed version. When omitted, any installed Legacy version is accepted
    and recorded in upgrade.log.
#>

[CmdletBinding()]
param(
    [string]$InstallerExe = "",

    [string]$InstallDir = "C:\OneSoft-ERP",
    [string]$ExpectedOldVersion = "",
    [string]$ExpectedNewVersion = "1.0.39",
    [string]$ReportDir = "$env:USERPROFILE\Desktop\OneSoft-InApp-Upgrade-Report",
    [int]$UpgradeTimeoutSeconds = 1800,
    [int]$HealthTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$ProgramDataRoot = Join-Path $env:ProgramData "OneSoft"
$ConfigPath = Join-Path $ProgramDataRoot "config\onesoft.config.json"
$CredentialPath = Join-Path $ProgramDataRoot "Security\migration-credential.bin"
$VersionPath = Join-Path $ProgramDataRoot "version.json"
$ReportPath = Join-Path $ReportDir "upgrade.log"
$Log = [System.Collections.Generic.List[string]]::new()
$Pass = 0
$Fail = 0
$ExitCode = 1
$PsqlPath = $null
$DbHost = $null
$DbPort = $null
$DbName = $null
$DbUser = $null
$DbPassword = $null
$ScriptDirectory = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    $PSScriptRoot
} else {
    Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$ExpectedAccounts = @(
    [pscustomobject]@{ Code = "110101"; Name = "نقدية بالصندوق فرع 1"; SystemKey = "acct.110101" },
    [pscustomobject]@{ Code = "110103"; Name = "نقدية بالصندوق فرع 3"; SystemKey = "acct.110103" },
    [pscustomobject]@{ Code = "210501"; Name = "ضريبة مخرجات"; SystemKey = "acct.210501" },
    [pscustomobject]@{ Code = "410101"; Name = "مبيعات فرع 1"; SystemKey = "acct.410101" }
)

function Add-Log([string]$Level, [string]$Message) {
    $line = "[$Level] $Message"
    $script:Log.Add($line)
    if ($Level -eq "PASS") {
        Write-Host "  $line" -ForegroundColor Green
    } elseif ($Level -eq "FAIL") {
        Write-Host "  $line" -ForegroundColor Red
    } else {
        Write-Host "  $line" -ForegroundColor Gray
    }
}

function Pass([string]$Message) {
    $script:Pass++
    Add-Log "PASS" $Message
}

function Fail([string]$Message) {
    $script:Fail++
    Add-Log "FAIL" $Message
}

function Info([string]$Message) {
    Add-Log "INFO" $Message
}

function Read-Json([string]$Path) {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function Find-Psql {
    $command = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }
    $candidate = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" `
        -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1
    if ($null -ne $candidate) {
        return $candidate.FullName
    }
    return $null
}

function Resolve-Installer {
    if (-not [string]::IsNullOrWhiteSpace($InstallerExe)) {
        return $InstallerExe
    }

    $searchDirectories = @(
        $ScriptDirectory,
        (Join-Path $env:USERPROFILE "Downloads"),
        (Join-Path $env:USERPROFILE "Desktop")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique

    foreach ($directory in $searchDirectories) {
        $candidate = Join-Path $directory "OneSoftSetup-1.0.39-x64.exe"
        if (Test-Path $candidate -PathType Leaf) {
            return $candidate
        }
    }
    return $null
}

function Invoke-ReadOnlySql([string]$Sql) {
    if ([string]::IsNullOrWhiteSpace($script:PsqlPath)) {
        throw "psql.exe was not found"
    }
    if ([string]::IsNullOrWhiteSpace([string]$script:DbPassword)) {
        throw "Runtime database password is missing from the persisted application config"
    }

    $oldPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = [string]$script:DbPassword
        $raw = & $script:PsqlPath `
            -X `
            -v "ON_ERROR_STOP=1" `
            -h ([string]$script:DbHost) `
            -p ([string]$script:DbPort) `
            -U ([string]$script:DbUser) `
            -d ([string]$script:DbName) `
            -At `
            -F "|" `
            -c $Sql 2>&1
        $exit = $LASTEXITCODE
        $text = (($raw | ForEach-Object { [string]$_ }) -join "`n").Trim()
        if ($exit -ne 0) {
            throw "Read-only PostgreSQL query failed: $text"
        }
        if ([string]::IsNullOrWhiteSpace($text)) {
            return @()
        }
        return @($text -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    } finally {
        if ($null -eq $oldPassword) {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        } else {
            $env:PGPASSWORD = $oldPassword
        }
    }
}

function Wait-Ready([int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastStatus = ""
    do {
        try {
            $response = Invoke-RestMethod `
                -Uri "http://127.0.0.1:3000/api/health" `
                -TimeoutSec 5 `
                -ErrorAction Stop
            if ($response.ready -eq $true) {
                return $response
            }
            $lastStatus = "status=$($response.status), ready=$($response.ready)"
        } catch {
            $lastStatus = $_.Exception.Message
        }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    Info "Health wait timed out: $lastStatus"
    return $null
}

function Wait-UpgradeCompleted {
    $deadline = (Get-Date).AddSeconds($UpgradeTimeoutSeconds)
    $lastVersion = ""
    Write-Host "`n=== Operator action: start the real in-app upgrade ===" -ForegroundColor Cyan
    Write-Host "Start OneSoft ERP from: $InstallDir"
    Write-Host "Use the in-app update flow to install $ExpectedNewVersion."
    Write-Host "Enter PostgreSQL administrative credentials in the OneSoft Upgrade Wizard only."
    Write-Host "This script will continue automatically when the version marker changes."

    do {
        try {
            if (Test-Path $VersionPath) {
                $version = Read-Json $VersionPath
                $lastVersion = [string]$version.version
                if ($lastVersion -eq $ExpectedNewVersion) {
                    return $true
                }
            }
        } catch {
            $lastVersion = "unreadable"
        }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)

    Fail "Upgrade did not reach version $ExpectedNewVersion within $UpgradeTimeoutSeconds seconds; last version: $lastVersion"
    return $false
}

function Get-LedgerSignature {
    $schema = Invoke-ReadOnlySql @"
SELECT COALESCE(version, '')
FROM _schema_version
WHERE id = 1
"@
    $migrations = Invoke-ReadOnlySql @"
SELECT COUNT(*)::text || '|' ||
       COALESCE(string_agg(tag, ',' ORDER BY id), '')
FROM __drizzle_migrations
"@
    return [pscustomobject]@{
        SchemaVersion = $schema.Trim()
        MigrationLedger = $migrations.Trim()
    }
}

function Assert-0093AndCompatibility {
    $ledger = Get-LedgerSignature
    if ($ledger.SchemaVersion -eq "0093_schema_compatibility_repair") {
        Pass "0093_schema_compatibility_repair = PASS"
    } else {
        Fail "Expected schema ledger 0093_schema_compatibility_repair, found '$($ledger.SchemaVersion)'"
    }

    $checksSql = @"
WITH checks(check_name, ok) AS (
    SELECT 'document_journals.customers_journal', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_journals'
          AND column_name = 'customers_journal'
    )
    UNION ALL SELECT 'document_journals.suppliers_journal', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_journals'
          AND column_name = 'suppliers_journal'
    )
    UNION ALL SELECT 'document_journals.payment_types_config', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_journals'
          AND column_name = 'payment_types_config'
    )
    UNION ALL SELECT 'document_journals.issuance_config', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_journals'
          AND column_name = 'issuance_config'
    )
    UNION ALL SELECT 'document_journals.options_config', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_journals'
          AND column_name = 'options_config'
    )
    UNION ALL SELECT 'purchase_invoices.zatca_invoice_type', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'purchase_invoices'
          AND column_name = 'zatca_invoice_type'
          AND is_nullable = 'NO'
          AND COALESCE(column_default, '') ILIKE '%simplified%'
    )
    UNION ALL SELECT 'tax_definitions.value_default', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tax_definitions'
          AND column_name = 'value'
          AND COALESCE(column_default, '') LIKE '%0%'
    )
    UNION ALL SELECT 'products.canonical_tax_fk', EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.products'::regclass
          AND conname = 'products_tax_id_tax_definitions_id_fk'
          AND confdeltype = 'n'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.products'::regclass AND conname = 'products_tax_id_fkey'
    )
    UNION ALL SELECT 'sales_invoice_items.canonical_tax_fk', EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.sales_invoice_items'::regclass
          AND conname = 'sales_invoice_items_tax_id_tax_definitions_id_fk'
          AND confdeltype = 'n'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.sales_invoice_items'::regclass
          AND conname = 'sales_invoice_items_tax_id_fkey'
    )
    UNION ALL SELECT 'stock_vouchers.canonical_receiver_fk', EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.stock_vouchers'::regclass
          AND conname = 'stock_vouchers_receiver_user_id_users_id_fk'
          AND pg_get_constraintdef(oid, true) =
              'FOREIGN KEY (receiver_user_id) REFERENCES users(id)'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.stock_vouchers'::regclass
          AND conname = 'stock_vouchers_receiver_user_id_fkey'
    )
    UNION ALL SELECT 'tax_definitions.canonical_org_fk', EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.tax_definitions'::regclass
          AND conname = 'tax_definitions_org_id_organizations_id_fk'
          AND confdeltype = 'c'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.tax_definitions'::regclass
          AND conname = 'tax_definitions_org_id_fkey'
    )
)
SELECT check_name || '|' || CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END
FROM checks
ORDER BY check_name
"@

    $rows = @(Invoke-ReadOnlySql $checksSql) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $compatibilityFailed = $false
    foreach ($row in $rows) {
        $parts = ([string]$row).Trim() -split "\|", 2
        if ($parts.Count -eq 2 -and $parts[1] -eq "PASS") {
            Info "Schema compatibility check: $($parts[0]) = PASS"
        } else {
            $compatibilityFailed = $true
            if ($parts.Count -eq 2) {
                Fail "Schema compatibility check: $($parts[0]) = $($parts[1])"
            } else {
                Fail "Malformed schema compatibility result: $row"
            }
        }
    }
    if (-not $compatibilityFailed -and $rows.Count -eq 11) {
        Pass "Schema Compatibility = PASS"
    } else {
        Fail "Schema Compatibility = FAIL"
    }
    return $ledger
}

function Get-AccountSnapshot {
    $codes = "'110101','110103','210501','410101'"
    $sql = @"
SELECT org.id::text || '|' ||
       org.code || '|' ||
       coa.code || '|' ||
       coa.id::text || '|' ||
       replace(coa.name, '|', '/') || '|' ||
       COALESCE(coa.system_key, '') || '|' ||
       COUNT(*) OVER (PARTITION BY coa.org_id, coa.code)::text || '|' ||
       COUNT(*) OVER (PARTITION BY coa.org_id, coa.system_key)::text
FROM organizations AS org
JOIN chart_of_accounts AS coa ON coa.org_id = org.id
WHERE org.status IN ('active', 'trial')
  AND coa.code IN ($codes)
ORDER BY org.id, coa.code, coa.id
"@
    $rawRows = @(Invoke-ReadOnlySql $sql) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $snapshots = @()
    foreach ($raw in $rawRows) {
        $parts = ([string]$raw).Trim() -split "\|", 8
        if ($parts.Count -ne 8) {
            throw "Malformed system account result: $raw"
        }
        $snapshots += [pscustomobject]@{
            OrgId = [int]$parts[0]
            OrgCode = $parts[1]
            Code = $parts[2]
            Id = [int]$parts[3]
            Name = $parts[4]
            SystemKey = $parts[5]
            CodeCount = [int]$parts[6]
            SystemKeyCount = [int]$parts[7]
        }
    }
    return $snapshots
}

function Assert-SystemAccounts([string]$Phase) {
    $accounts = @(Get-AccountSnapshot)
    $orgRows = @(Invoke-ReadOnlySql "SELECT id::text || '|' || code FROM organizations WHERE status IN ('active', 'trial')") |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($orgRows.Count -eq 0) {
        Fail "$Phase: no active/trial organization found"
        return @()
    }

    foreach ($orgRow in $orgRows) {
        $orgParts = ([string]$orgRow).Trim() -split "\|", 2
        $orgId = [int]$orgParts[0]
        $orgCode = $orgParts[1]
        foreach ($expected in $ExpectedAccounts) {
            $matches = @($accounts | Where-Object { $_.OrgId -eq $orgId -and $_.Code -eq $expected.Code })
            if ($matches.Count -eq 1 -and
                $matches[0].Name -eq $expected.Name -and
                $matches[0].SystemKey -eq $expected.SystemKey) {
                Pass "$Phase: $orgCode/$($expected.Code) exists with system_key $($expected.SystemKey)"
            } else {
                Fail "$Phase: $orgCode/$($expected.Code) missing or invalid (rows=$($matches.Count))"
            }
            if ($matches.Count -eq 1 -and $matches[0].CodeCount -eq 1 -and $matches[0].SystemKeyCount -eq 1) {
                Pass "$Phase: no duplicate for $orgCode/$($expected.Code)"
            } else {
                Fail "$Phase: duplicate detected for $orgCode/$($expected.Code)"
            }
        }
    }
    return $accounts
}

function Get-FoundationSnapshot {
    $sql = @"
SELECT org.id::text || '|' ||
       org.code || '|' ||
       org.foundation_status || '|' ||
       (
         (SELECT COUNT(*) FROM branches b
          WHERE b.org_id = org.id AND b.foundation_key IS NOT NULL) +
         (SELECT COUNT(*) FROM warehouses w
          WHERE w.org_id = org.id AND w.foundation_key IS NOT NULL) +
         (SELECT COUNT(*) FROM document_types d
          WHERE d.org_id = org.id AND d.foundation_key IS NOT NULL) +
         (SELECT COUNT(*) FROM document_journals j
          WHERE j.org_id = org.id AND j.foundation_key IS NOT NULL)
       )::text || '|' ||
       (
         (SELECT COUNT(*) FROM document_journals j
          LEFT JOIN users u ON u.id = j.allowed_user_id
          WHERE j.org_id = org.id AND j.foundation_key IS NOT NULL
            AND j.allowed_user_id IS NOT NULL AND u.id IS NULL) +
         (SELECT COUNT(*) FROM warehouses w
          LEFT JOIN users u ON u.id = w.allowed_user_id
          WHERE w.org_id = org.id AND w.foundation_key IS NOT NULL
            AND w.allowed_user_id IS NOT NULL AND u.id IS NULL)
       )::text
FROM organizations AS org
WHERE org.status IN ('active', 'trial')
ORDER BY org.id
"@
    $rawRows = @(Invoke-ReadOnlySql $sql) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $snapshots = @()
    foreach ($raw in $rawRows) {
        $parts = ([string]$raw).Trim() -split "\|", 5
        if ($parts.Count -ne 5) {
            throw "Malformed Foundation result: $raw"
        }
        $snapshots += [pscustomobject]@{
            OrgId = [int]$parts[0]
            OrgCode = $parts[1]
            Status = $parts[2]
            RecordCount = [int]$parts[3]
            BrokenUserFks = [int]$parts[4]
        }
    }
    return $snapshots
}

function Assert-Foundation([string]$Phase) {
    $foundation = @(Get-FoundationSnapshot)
    if ($foundation.Count -eq 0) {
        Fail "$Phase: no active/trial organization found"
        return @()
    }
    foreach ($org in $foundation) {
        if ($org.Status -eq "applied" -and
            $org.RecordCount -eq 77 -and
            $org.BrokenUserFks -eq 0) {
            Pass "$Phase: Foundation applied, 77 records, no broken user FKs for $($org.OrgCode)"
        } else {
            Fail "$Phase: Foundation invalid for $($org.OrgCode) (status=$($org.Status), records=$($org.RecordCount), broken_user_fks=$($org.BrokenUserFks))"
        }
    }

    $detailSql = @"
SELECT org.id::text || '|' ||
  (SELECT COUNT(*) FROM warehouses WHERE org_id = org.id AND foundation_key = 'wh.001')::text || '|' ||
  (SELECT COUNT(*) FROM warehouses WHERE org_id = org.id AND foundation_key = 'wh.002')::text || '|' ||
  (SELECT COUNT(*) FROM warehouses WHERE org_id = org.id AND foundation_key = 'wh.003')::text || '|' ||
  (SELECT COUNT(*) FROM warehouses WHERE org_id = org.id AND foundation_key = 'wh.004')::text || '|' ||
  (SELECT COUNT(*) FROM document_journals WHERE org_id = org.id AND UPPER(code) = 'INV.01.')::text || '|' ||
  (SELECT COUNT(*) FROM document_journals WHERE org_id = org.id AND UPPER(code) = 'INV.02.')::text || '|' ||
  (SELECT COUNT(*) FROM document_journals WHERE org_id = org.id AND UPPER(code) = 'INV.03.')::text || '|' ||
  (SELECT COUNT(*) FROM document_journals WHERE org_id = org.id AND UPPER(code) = 'INV.04.')::text
FROM organizations AS org
WHERE org.status IN ('active', 'trial')
ORDER BY org.id
"@
    $detailRows = @(Invoke-ReadOnlySql $detailSql) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    foreach ($row in $detailRows) {
        $parts = ([string]$row).Trim() -split "\|", 9
        $counts = @($parts[1..8] | ForEach-Object { [int]$_ })
        if ($counts.Count -eq 8 -and (@($counts | Where-Object { $_ -ne 1 }).Count -eq 0)) {
            Pass "$Phase: Foundation warehouse and journal keys are unique for organization $($parts[0])"
        } else {
            Fail "$Phase: Foundation warehouse/journal key missing or duplicated for organization $($parts[0])"
        }
    }
    return $foundation
}

function Assert-Ready([string]$Phase) {
    $health = Wait-Ready $HealthTimeoutSeconds
    if ($null -ne $health -and $health.ready -eq $true) {
        if ([string]$health.version -eq $ExpectedNewVersion) {
            Pass "$Phase: ready=true and version=$ExpectedNewVersion"
        } else {
            Fail "$Phase: ready=true but health version is $($health.version)"
        }
    } else {
        Fail "$Phase: ready=true"
    }
    return $health
}

function Get-AccountSignature($Accounts) {
    return (($Accounts | Sort-Object OrgId, Code, Id |
        ForEach-Object { "$($_.OrgId)|$($_.Code)|$($_.Id)|$($_.Name)|$($_.SystemKey)" }) -join ";")
}

function Get-FoundationSignature($Foundation) {
    return (($Foundation | Sort-Object OrgId |
        ForEach-Object { "$($_.OrgId)|$($_.Status)|$($_.RecordCount)|$($_.BrokenUserFks)" }) -join ";")
}

function Compare-SecondRun($BeforeLedger, $BeforeAccounts, $BeforeFoundation) {
    Write-Host "`n=== Second application startup / idempotency ===" -ForegroundColor Cyan
    $service = Get-Service -Name "OneSoft-Server" -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        Fail "OneSoft-Server service is missing for second run"
        return
    }
    try {
        if ($service.Status -eq "Running") {
            Restart-Service -Name "OneSoft-Server" -Force -ErrorAction Stop
        } else {
            Start-Service -Name "OneSoft-Server" -ErrorAction Stop
        }
        Info "OneSoft-Server restarted for the second database startup"
    } catch {
        Fail "Could not restart OneSoft-Server: $($_.Exception.Message)"
        return
    }

    Assert-Ready "Second run"
    $afterLedger = Get-LedgerSignature
    if ($afterLedger.SchemaVersion -eq $BeforeLedger.SchemaVersion) {
        Pass "Second run schema version unchanged at 0093_schema_compatibility_repair"
    } else {
        Fail "Second run changed schema version: $($BeforeLedger.SchemaVersion) -> $($afterLedger.SchemaVersion)"
    }
    if ($afterLedger.MigrationLedger -eq $BeforeLedger.MigrationLedger) {
        Pass "Second run migrations = PASS (no new migration ledger entries)"
    } else {
        Fail "Second run added or changed migration ledger entries"
    }

    $afterFoundation = @(Assert-Foundation "Second run")
    $afterAccounts = @(Assert-SystemAccounts "Second run")
    if ((Get-FoundationSignature $afterFoundation) -eq (Get-FoundationSignature $BeforeFoundation)) {
        Pass "Foundation idempotency = PASS"
    } else {
        Fail "Foundation idempotency = FAIL (Foundation snapshot changed)"
    }
    if ((Get-AccountSignature $afterAccounts) -eq (Get-AccountSignature $BeforeAccounts)) {
        Pass "Second run preserved the same system account IDs and codes"
    } else {
        Fail "Second run changed system account IDs, codes, or system keys"
    }
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Log.Add("OneSoft Windows Legacy Upgrade Test")
$Log.Add("Started: $(Get-Date -Format s)")
$Log.Add("Installer: $InstallerExe")
$Log.Add("Expected new version: $ExpectedNewVersion")

try {
    Write-Host "`n=== Preconditions ===" -ForegroundColor Cyan
    $InstallerExe = Resolve-Installer
    if (-not [string]::IsNullOrWhiteSpace($InstallerExe) -and (Test-Path $InstallerExe -PathType Leaf)) {
        Pass "Installer exists: $InstallerExe"
    } else {
        Fail "OneSoftSetup-1.0.39-x64.exe was not found next to the script, in Downloads, or on the Desktop"
    }
    if (Test-Path $ConfigPath) {
        Pass "OneSoft config exists"
    } else {
        Fail "OneSoft config is missing: $ConfigPath"
    }
    if (Test-Path $VersionPath) {
        Pass "Version marker exists"
    } else {
        Fail "Version marker is missing: $VersionPath"
    }
    if ($Fail -gt 0) {
        throw "Required Windows precondition is missing"
    }

    $oldConfig = Read-Json $ConfigPath
    $oldVersion = Read-Json $VersionPath
    $installedVersion = [string]$oldVersion.version
    if ([string]::IsNullOrWhiteSpace($ExpectedOldVersion)) {
        Info "Any ExpectedOldVersion accepted; installed Legacy version is $installedVersion"
    } elseif ($installedVersion -eq $ExpectedOldVersion) {
        Pass "Installed version is $ExpectedOldVersion"
    } else {
        Fail "Expected old version $ExpectedOldVersion, found $installedVersion"
        throw "Installed version does not match ExpectedOldVersion"
    }
    $Log.Add("Installed old version: $installedVersion")

    $serviceBefore = Get-Service -Name "OneSoft-Server" -ErrorAction SilentlyContinue
    if ($null -ne $serviceBefore) {
        Pass "OneSoft-Server service is installed"
    } else {
        Fail "OneSoft-Server service is not installed"
        throw "OneSoft-Server service is required for the real Windows test"
    }
    if ($null -ne $oldConfig.database -and $oldConfig.database.user) {
        Info "Pre-upgrade runtime role: $($oldConfig.database.user)"
    }

    if (-not (Wait-UpgradeCompleted)) {
        throw "The real in-app upgrade did not complete"
    }

    Write-Host "`n=== Post-upgrade verification ===" -ForegroundColor Cyan
    if (Test-Path $CredentialPath) {
        Pass "DPAPI migration credential exists after upgrade"
    } else {
        Info "DPAPI migration credential is absent; continuing with database/health verification"
    }
    $newVersion = Read-Json $VersionPath
    if ([string]$newVersion.version -eq $ExpectedNewVersion) {
        Pass "Version marker is $ExpectedNewVersion"
    } else {
        Fail "Expected version marker $ExpectedNewVersion, found $($newVersion.version)"
        throw "Version marker did not reach ExpectedNewVersion"
    }

    $postConfig = Read-Json $ConfigPath
    if ([string]$postConfig.database.user -eq "onesoft_app") {
        Pass "Runtime config uses onesoft_app"
    } else {
        Fail "Runtime config does not use onesoft_app"
        throw "Runtime database role is not onesoft_app"
    }
    $adminUserProperty = $postConfig.database.PSObject.Properties["adminUser"]
    $adminPasswordProperty = $postConfig.database.PSObject.Properties["adminPassword"]
    if ($null -eq $adminUserProperty -and $null -eq $adminPasswordProperty) {
        Pass "Post-upgrade config contains no PostgreSQL administrative credentials"
    } else {
        Fail "Post-upgrade config still contains PostgreSQL administrative credentials"
    }

    $PsqlPath = Find-Psql
    if ([string]::IsNullOrWhiteSpace($PsqlPath)) {
        Fail "psql.exe was not found; database assertions cannot run"
        throw "psql.exe is required for the requested database verification"
    }
    Info "Read-only verification tool: $PsqlPath"
    $DbHost = [string]$postConfig.database.host
    $DbPort = [string]$postConfig.database.port
    $DbName = [string]$postConfig.database.name
    $DbUser = [string]$postConfig.database.user
    $DbPassword = [string]$postConfig.database.password
    if ([string]::IsNullOrWhiteSpace($DbHost) -or
        [string]::IsNullOrWhiteSpace($DbPort) -or
        [string]::IsNullOrWhiteSpace($DbName) -or
        [string]::IsNullOrWhiteSpace($DbPassword)) {
        throw "Persisted runtime database connection is incomplete"
    }

    $null = Assert-0093AndCompatibility
    $accountSnapshot = @(Assert-SystemAccounts "First run")
    $foundationSnapshot = @(Assert-Foundation "First run")
    $null = Assert-Ready "First run"
    $ledgerBeforeSecond = Get-LedgerSignature
    Compare-SecondRun $ledgerBeforeSecond $accountSnapshot $foundationSnapshot

    $ExitCode = if ($Fail -eq 0) { 0 } else { 1 }
} catch {
    if ($_.Exception.Message) {
        Fail "Test aborted: $($_.Exception.Message)"
    } else {
        Fail "Test aborted"
    }
    $ExitCode = 1
} finally {
    $result = if ($Fail -eq 0) { "PASS" } else { "FAIL" }
    $Log.Add("Pass count: $Pass")
    $Log.Add("Fail count: $Fail")
    $Log.Add("Finished: $(Get-Date -Format s)")
    $Log.Add("WINDOWS LEGACY UPGRADE TEST = $result")
    $Log | Out-File -Encoding UTF8 -FilePath $ReportPath
    Write-Host "`n=== Result ===" -ForegroundColor Cyan
    Write-Host "PASS: $Pass   FAIL: $Fail"
    Write-Host "Report: $ReportPath"
    Write-Host "WINDOWS LEGACY UPGRADE TEST = $result"
}

exit $ExitCode