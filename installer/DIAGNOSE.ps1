#Requires -Version 5.1
<#
.SYNOPSIS
    OneSoft ERP - Build Diagnostic Tool
    Run AFTER .\BUILD-ON-WINDOWS.ps1 to inspect actual asar contents.

.DESCRIPTION
    Answers the following questions from real build output (no guessing):
      Q1. What is inside app.asar?
      Q2. Does app.asar/node_modules exist? Which packages?
      Q3. Does dist-electron/electron/main.js contain 'obuf'?
      Q4. Does the bundle contain all expected pg sub-packages?
      Q5. Are there any external require() calls in the bundle?
      Q6. What is the package.json inside the asar?

.EXAMPLE
    cd C:\ONESOFT-ERP-CLEAN\installer
    .\DIAGNOSE.ps1
#>

$InstallerDir  = $PSScriptRoot
$ProjectRoot   = Split-Path $InstallerDir -Parent
$AsarPath      = "$InstallerDir\release\win-unpacked\resources\app.asar"
$BundlePath    = "$InstallerDir\dist-electron\electron\main.js"
$ExtractDir    = "$InstallerDir\release\_diag_extracted_asar"

function W-Title($t) { Write-Host "" ; Write-Host "=== $t ===" -ForegroundColor Cyan }
function W-Ok($m)    { Write-Host "  [OK]   $m" -ForegroundColor Green }
function W-Warn($m)  { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function W-Fail($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red }
function W-Info($m)  { Write-Host "  [INFO] $m" -ForegroundColor White }

Write-Host ""
Write-Host "##########################################################" -ForegroundColor Magenta
Write-Host "#        OneSoft ERP - DIAGNOSE.ps1                     #" -ForegroundColor Magenta
Write-Host "#   Inspecting ACTUAL build output - no assumptions     #" -ForegroundColor Magenta
Write-Host "##########################################################" -ForegroundColor Magenta

# --- PRE-CHECK ---------------------------------------------------------------
W-Title "PRE-CHECK: build output exists"

if (-not (Test-Path $AsarPath)) {
    W-Fail "app.asar NOT FOUND at: $AsarPath"
    W-Fail "Run .\BUILD-ON-WINDOWS.ps1 first, then re-run this script."
    exit 1
}
W-Ok "app.asar found: $AsarPath"
$asarSize = (Get-Item $AsarPath).Length
W-Info "app.asar size: $([math]::Round($asarSize/1MB,2)) MB"

if (Test-Path $BundlePath) {
    $bundleSize = (Get-Item $BundlePath).Length
    W-Ok "main.js bundle found: $BundlePath"
    W-Info "main.js size: $([math]::Round($bundleSize/1KB,1)) KB"
} else {
    W-Warn "dist-electron\electron\main.js NOT FOUND - esbuild may have failed"
}

# --- SECTION 1: asar LIST ----------------------------------------------------
W-Title "SECTION 1: List ALL files inside app.asar"
W-Info "Running: npx @electron/asar list ..."

$asarList = & npx --yes "@electron/asar" list "$AsarPath" 2>&1
if ($LASTEXITCODE -ne 0) {
    W-Warn "npx @electron/asar failed (exit $LASTEXITCODE). Trying global asar..."
    $asarList = & asar list "$AsarPath" 2>&1
}

$asarLines = $asarList | Where-Object { $_ -and $_.ToString().Trim() -ne '' } |
             ForEach-Object { $_.ToString() }
W-Info "Total entries in asar: $($asarLines.Count)"

$listFile = "$InstallerDir\release\_diag_asar_filelist.txt"
$asarLines | Out-File -FilePath $listFile -Encoding UTF8
W-Ok "Full file list saved to: $listFile"

W-Info "Top-level entries:"
$asarLines | Where-Object { $_ -match '^/[^/]+/?$' } | ForEach-Object { W-Info "  $_" }

# --- SECTION 2: node_modules inside asar -------------------------------------
W-Title "SECTION 2: node_modules inside app.asar"

$nmEntries  = $asarLines | Where-Object { $_ -match '^/node_modules/' }
$nmPackages = $nmEntries  | Where-Object { $_ -match '^/node_modules/[^/]+/?$' } | Sort-Object

if ($nmEntries.Count -eq 0) {
    W-Ok "NO node_modules directory in app.asar <- GOOD (esbuild bundle is sole JS source)"
} else {
    W-Fail "node_modules EXISTS inside app.asar ($($nmEntries.Count) entries)"
    W-Info "Top-level packages found in app.asar/node_modules:"
    $nmPackages | ForEach-Object { W-Info "  $_" }

    $problemPkgs = @('pg','pg-types','pg-protocol','postgres-array','postgres-date',
                     'postgres-bytea','postgres-range','postgres-interval','obuf')
    foreach ($pkg in $problemPkgs) {
        $found = $nmEntries | Where-Object { $_ -match "^/node_modules/$pkg(/|$)" }
        if ($found) {
            W-Fail "  FOUND in asar/node_modules: $pkg  <- should NOT be here"
        } else {
            W-Ok  "  NOT in asar/node_modules: $pkg  <- correct"
        }
    }
}

# --- SECTION 3: Extract asar for deep inspection ----------------------------
W-Title "SECTION 3: Extract asar for deep inspection"

if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }
W-Info "Extracting asar to: $ExtractDir"
& npx --yes "@electron/asar" extract "$AsarPath" "$ExtractDir" 2>&1 | Out-Null

if (Test-Path $ExtractDir) {
    W-Ok "Extraction complete"

    $pkgJsonPath = "$ExtractDir\package.json"
    if (Test-Path $pkgJsonPath) {
        W-Title "SECTION 3a: package.json inside asar"
        $pkgJson = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
        W-Info "  main       : $($pkgJson.main)"
        W-Info "  version    : $($pkgJson.version)"
        $depCount = 0
        if ($pkgJson.dependencies) {
            $depCount = ($pkgJson.dependencies | Get-Member -MemberType NoteProperty).Count
        }
        W-Info "  dependencies (count): $depCount"
        if ($pkgJson.dependencies) {
            ($pkgJson.dependencies | Get-Member -MemberType NoteProperty).Name |
                ForEach-Object { W-Info "    dep: $_  = $($pkgJson.dependencies.$_)" }
        }
        W-Info "  devDependencies present: $(if($pkgJson.devDependencies){'YES'}else{'NO'})"
    } else {
        W-Warn "package.json not found in extracted asar"
    }

    $nmDir = "$ExtractDir\node_modules"
    if (Test-Path $nmDir) {
        W-Title "SECTION 3b: node_modules in extracted asar"
        $pkgDirs = Get-ChildItem $nmDir -Directory | Select-Object -ExpandProperty Name | Sort-Object
        W-Fail "node_modules EXISTS with $($pkgDirs.Count) packages:"
        $pkgDirs | ForEach-Object { W-Info "    $_" }
    } else {
        W-Ok "No node_modules in extracted asar (correct)"
    }

    $mainInAsar = "$ExtractDir\dist-electron\electron\main.js"
    if (Test-Path $mainInAsar) {
        $mainInAsarSize = (Get-Item $mainInAsar).Length
        W-Title "SECTION 3c: main.js INSIDE the asar"
        W-Info "  Size: $([math]::Round($mainInAsarSize/1KB,1)) KB"
        W-Info "  Path: dist-electron\electron\main.js  (inside asar)"

        $content = Get-Content $mainInAsar -Raw
        $checks = @{
            'obuf'            = 'obuf (bytea buffer library)';
            'pg-types'        = 'pg-types';
            'postgres-bytea'  = 'postgres-bytea';
            'pg-protocol'     = 'pg-protocol';
        }
        W-Info "  Searching bundle for key strings:"
        foreach ($kv in $checks.GetEnumerator()) {
            $count = ([regex]::Matches($content, [regex]::Escape($kv.Key))).Count
            if ($count -gt 0) {
                W-Ok  "  [FOUND $count x] '$($kv.Key)'  <- $($kv.Value)"
            } else {
                W-Fail "  [MISS ] '$($kv.Key)'"
            }
        }

        $dynObuf1 = 'require("obuf")'
        $dynObuf2 = "require('obuf')"
        if (($content -match [regex]::Escape($dynObuf1)) -or ($content -match [regex]::Escape($dynObuf2))) {
            W-Fail "  Dynamic require('obuf') found in bundle - runtime lookup will fail"
        } else {
            W-Ok  "  No dynamic require('obuf') call - bundled inline"
        }

        W-Info "  First 3 lines of main.js (verify it is esbuild output):"
        (Get-Content $mainInAsar | Select-Object -First 3) | ForEach-Object { W-Info "    $_" }

    } else {
        W-Fail "dist-electron\electron\main.js NOT FOUND inside extracted asar"
        W-Fail "electron-builder did not pack the esbuild bundle!"
    }
} else {
    W-Warn "Could not extract asar (asar tool missing?)"
}

# --- SECTION 4: Analyse main.js from DIST (pre-packaging) -------------------
W-Title "SECTION 4: main.js in dist-electron (pre-packaging)"
if (Test-Path $BundlePath) {
    $distContent = Get-Content $BundlePath -Raw
    $obufCountDist = ([regex]::Matches($distContent, 'obuf')).Count

    W-Info "  Occurrences of 'obuf'          : $obufCountDist"
    W-Info "  Occurrences of 'pg-types'      : $(([regex]::Matches($distContent,'pg-types')).Count)"
    W-Info "  Occurrences of 'postgres-bytea': $(([regex]::Matches($distContent,'postgres-bytea')).Count)"
    W-Info "  Occurrences of 'pg-protocol'   : $(([regex]::Matches($distContent,'pg-protocol')).Count)"
    W-Info "  Occurrences of 'drizzle-orm'   : $(([regex]::Matches($distContent,'drizzle-orm')).Count)"
    W-Info "  Occurrences of 'node-windows'  : $(([regex]::Matches($distContent,'node-windows')).Count)"

    $extRequires = [regex]::Matches($distContent, 'require\(["\x27]([^"'']+)["\x27]\)')
    $runtimeRequires = $extRequires | Where-Object {
        $m = $_.Groups[1].Value
        $m -notmatch '^(electron|path|fs|os|net|http|https|child_process|crypto|util|events|stream|buffer|url|assert|module|timers|tty|v8|vm|worker_threads|cluster|dgram|dns|domain|readline|repl|string_decoder|zlib|perf_hooks)$'
    }
    if ($runtimeRequires.Count -gt 0) {
        W-Warn "  External require() calls found (packages NOT built-in to Node.js):"
        $runtimeRequires | ForEach-Object {
            W-Warn "    require('$($_.Groups[1].Value)')"
        }
    } else {
        W-Ok "  No external (non-Node built-in) require() calls in bundle"
    }

    if ($obufCountDist -eq 0) {
        W-Fail "  'obuf' NOT FOUND in dist main.js <- esbuild did not bundle it"
        W-Fail "  pg loads obuf from node_modules at runtime - which fails"
    } else {
        W-Ok "  'obuf' IS bundled inline ($obufCountDist occurrences)"
    }
} else {
    W-Warn "  dist-electron\electron\main.js not found"
}

# --- SECTION 5: esbuild availability ----------------------------------------
W-Title "SECTION 5: esbuild availability"
try {
    Push-Location $InstallerDir
    $esbuildVer = (& pnpm exec esbuild --version 2>&1).ToString().Trim()
    W-Ok "esbuild version: $esbuildVer"
    Pop-Location
} catch {
    W-Fail "Cannot run 'pnpm exec esbuild' from installer dir"
    Pop-Location
}

# --- SECTION 6: pnpm production deps ----------------------------------------
W-Title "SECTION 6: pnpm production deps (what electron-builder packs)"
try {
    Push-Location $InstallerDir
    $prodDeps = & pnpm ls --prod --depth 0 2>&1
    W-Info "pnpm production deps (--prod --depth 0):"
    $prodDeps | ForEach-Object { W-Info "  $_" }
    Pop-Location
} catch {
    W-Warn "pnpm ls failed"
    Pop-Location
}

# --- SUMMARY -----------------------------------------------------------------
W-Title "SUMMARY - copy this and send for analysis"
Write-Host ""
Write-Host "  app.asar size           : $([math]::Round($asarSize/1MB,2)) MB"
if (Test-Path $BundlePath) {
    Write-Host "  main.js (dist) size     : $([math]::Round($bundleSize/1KB,1)) KB"
}
Write-Host "  node_modules in asar    : $(if($nmEntries.Count -eq 0){'NONE (correct)'}else{"$($nmEntries.Count) entries (PROBLEM)"})"
if (Test-Path $BundlePath) {
    $obufInDist = (Get-Content $BundlePath -Raw) -match 'obuf'
    Write-Host "  obuf in dist bundle     : $(if($obufInDist){'YES (correct)'}else{'NO (PROBLEM)'})"
}
Write-Host ""
Write-Host "  Full file list: $listFile"
Write-Host "  Extracted asar: $ExtractDir"
Write-Host ""
