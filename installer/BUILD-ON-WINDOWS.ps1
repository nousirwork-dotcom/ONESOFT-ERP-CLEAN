#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP - Build Professional Installer on Windows
    Produces Setup.exe ready for distribution

.DESCRIPTION
    This script performs:
    1. Requirements check (Node.js, pnpm, Git)
    2. Build server-app and client-app
    3. Build Electron Installer
    4. Produce Setup.exe in release/ folder

.USAGE
    Open PowerShell as Administrator then run:
    .\BUILD-ON-WINDOWS.ps1

    With custom project path:
    .\BUILD-ON-WINDOWS.ps1 -ProjectRoot "F:\OneSoft-ERP"

    Skip app build (if already built):
    .\BUILD-ON-WINDOWS.ps1 -SkipAppBuild

.NOTES
    Requirements: Node.js v20+, pnpm v8+, Windows 10/11 x64
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = $PSScriptRoot,
    [switch]$SkipAppBuild,
    [switch]$SkipInstall,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = "OneSoft ERP - Build Installer"

function Write-Step($msg)    { Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg)    { Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1 }
function Write-Info($msg)    { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

function Write-Banner {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Blue
    Write-Host "       OneSoft ERP - Professional Installer Build           " -ForegroundColor Blue
    Write-Host "                    Version 1.0.0                           " -ForegroundColor Blue
    Write-Host "============================================================" -ForegroundColor Blue
    Write-Host ""
}

# STEP 0: Banner
Write-Banner
$StartTime = Get-Date
Write-Info "Project folder: $ProjectRoot"
Write-Info "Start time: $($StartTime.ToString('HH:mm:ss'))"

# STEP 1: Requirements Check
Write-Step "Checking requirements"

try {
    $nodeVer = node --version 2>&1
    $nodeMaj = [int]($nodeVer -replace 'v(\d+)\..*','$1')
    if ($nodeMaj -lt 20) { Write-Fail "Requires Node.js v20+ - Current: $nodeVer" }
    Write-Ok "Node.js: $nodeVer"
} catch {
    Write-Fail "Node.js not installed - Download from https://nodejs.org"
}

try {
    $pnpmVer = pnpm --version 2>&1
    Write-Ok "pnpm: v$pnpmVer"
} catch {
    Write-Warn "pnpm not found - Installing..."
    npm install -g pnpm
    Write-Ok "pnpm installed"
}

if (-not (Test-Path "$ProjectRoot\server-app")) { Write-Fail "server-app not found in: $ProjectRoot" }
if (-not (Test-Path "$ProjectRoot\client-app")) { Write-Fail "client-app not found in: $ProjectRoot" }
if (-not (Test-Path "$ProjectRoot\installer"))  { Write-Fail "installer not found in: $ProjectRoot" }
Write-Ok "Project folder is valid"

# NSSM
$NssmDest = "$ProjectRoot\installer\resources\bin\nssm.exe"
if (-not (Test-Path $NssmDest)) {
    Write-Warn "nssm.exe not found - Downloading..."
    $NssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $TmpZip  = "$env:TEMP\nssm.zip"
    $TmpDir  = "$env:TEMP\nssm-extract"
    try {
        Invoke-WebRequest -Uri $NssmUrl -OutFile $TmpZip -UseBasicParsing
        Expand-Archive -Path $TmpZip -DestinationPath $TmpDir -Force
        $NssmExe = Get-ChildItem -Path $TmpDir -Filter "nssm.exe" -Recurse |
                   Where-Object { $_.FullName -match "win64" } |
                   Select-Object -First 1
        if (-not $NssmExe) {
            $NssmExe = Get-ChildItem -Path $TmpDir -Filter "nssm.exe" -Recurse |
                       Select-Object -First 1
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $NssmDest) | Out-Null
        Copy-Item $NssmExe.FullName $NssmDest
        Write-Ok "nssm.exe downloaded"
        Remove-Item $TmpZip,$TmpDir -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "Could not auto-download nssm - Download manually from https://nssm.cc/release/nssm-2.24.zip"
        Write-Warn "Place nssm.exe (64-bit) at: $NssmDest"
        Read-Host "Press Enter after placing nssm.exe to continue"
    }
}
Write-Ok "nssm.exe: $NssmDest"

# Icon
$IconPath = "$ProjectRoot\installer\resources\icons\onesoft.ico"
if (-not (Test-Path $IconPath)) {
    Write-Warn "onesoft.ico not found - Will use default Electron icon"
    New-Item -ItemType Directory -Force -Path (Split-Path $IconPath) | Out-Null
    $ElectronIcon = Get-ChildItem -Path "$ProjectRoot\installer\node_modules\electron" `
                    -Filter "*.ico" -Recurse -ErrorAction SilentlyContinue |
                    Select-Object -First 1
    if ($ElectronIcon) {
        Copy-Item $ElectronIcon.FullName $IconPath -ErrorAction SilentlyContinue
        Write-Info "Using default Electron icon temporarily"
    }
}

# STEP 2: Install Dependencies
if (-not $SkipInstall) {
    Write-Step "Installing dependencies"

    Write-Info "installer..."
    Set-Location "$ProjectRoot\installer"
    pnpm install --frozen-lockfile 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }
    Write-Ok "installer deps"

    Write-Info "server-app..."
    Set-Location "$ProjectRoot\server-app"
    pnpm install --frozen-lockfile 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }
    Write-Ok "server-app deps"

    Write-Info "client-app..."
    Set-Location "$ProjectRoot\client-app"
    pnpm install --frozen-lockfile 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }
    Write-Ok "client-app deps"
}

# STEP 3: Build server-app
if (-not $SkipAppBuild) {
    Write-Step "Building server-app (TypeScript -> JavaScript)"
    Set-Location "$ProjectRoot\server-app"

    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
    pnpm run build 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }

    if (-not (Test-Path "dist\index.mjs")) {
        Write-Fail "server-app build failed - dist\index.mjs not found"
    }
    Write-Ok "server-app built (dist\index.mjs)"
}

# STEP 4: Build client-app
if (-not $SkipAppBuild) {
    Write-Step "Building client-app (React -> Static HTML/JS/CSS)"
    Set-Location "$ProjectRoot\client-app"

    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
    pnpm run build 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }

    if (-not (Test-Path "dist\index.html")) {
        Write-Fail "client-app build failed - dist\index.html not found"
    }
    Write-Ok "client-app built (dist\index.html)"
}

# STEP 5: Assemble app files
Write-Step "Assembling application files"

$AppResources = "$ProjectRoot\installer\resources\app"
New-Item -ItemType Directory -Force -Path "$AppResources\server-app" | Out-Null
New-Item -ItemType Directory -Force -Path "$AppResources\client-app" | Out-Null

Write-Info "Copying server-app..."
$ServerItems = @('dist','package.json','drizzle')
foreach ($item in $ServerItems) {
    $src = "$ProjectRoot\server-app\$item"
    if (Test-Path $src) {
        Copy-Item $src "$AppResources\server-app\$item" -Recurse -Force
        Write-Info "  + $item"
    }
}

Write-Info "Installing server-app production node_modules..."
Set-Location "$ProjectRoot\server-app"
pnpm install --prod --frozen-lockfile --ignore-scripts 2>&1 | Out-Null
Copy-Item "node_modules" "$AppResources\server-app\node_modules" -Recurse -Force
Write-Ok "server-app -> app resources"

Write-Info "Copying client-app dist..."
Copy-Item "$ProjectRoot\client-app\dist" "$AppResources\client-app\dist" -Recurse -Force
$ServeClientDest = "$AppResources\client-app\dist-serve"
New-Item -ItemType Directory -Force -Path $ServeClientDest | Out-Null
Copy-Item "$ProjectRoot\installer\resources\serve-client.js" "$ServeClientDest\server.js" -Force
Write-Ok "client-app -> app resources"

$MigDir = "$ProjectRoot\server-app\drizzle"
if (Test-Path $MigDir) {
    Copy-Item $MigDir "$AppResources\server-app\drizzle" -Recurse -Force
    Write-Ok "Migration files copied"
}

# STEP 6: Build Electron (TypeScript)
Write-Step "Building Electron Installer (TypeScript)"
Set-Location "$ProjectRoot\installer"

if (Test-Path "dist-electron") { Remove-Item "dist-electron" -Recurse -Force }
if (Test-Path "dist-ui")       { Remove-Item "dist-ui"       -Recurse -Force }
if (Test-Path "release")       { Remove-Item "release"       -Recurse -Force }

Write-Info "Compiling TypeScript..."
pnpm exec tsc -p tsconfig.electron.json --noEmit false 2>&1 | ForEach-Object { Write-Info $_ }
if (-not (Test-Path "dist-electron\electron\main.js")) {
    Write-Fail "TypeScript compile failed - dist-electron\electron\main.js not found"
}
Write-Ok "TypeScript -> dist-electron"

Write-Info "Building React UI..."
pnpm exec vite build 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }
if (-not (Test-Path "dist-ui\index.html")) {
    Write-Fail "React build failed - dist-ui\index.html not found"
}
Write-Ok "React UI -> dist-ui"

# STEP 7: electron-builder -> Setup.exe
Write-Step "Packaging with electron-builder -> Setup.exe"
Write-Info "This step may take 2-5 minutes..."

$env:GH_TOKEN = ""
pnpm exec electron-builder --win --x64 --config electron-builder.config.ts 2>&1 | ForEach-Object {
    if ($_ -match 'error|Error|failed|Failed') { Write-Host "  $_" -ForegroundColor Red }
    elseif ($_ -match 'built|Built|done|Done|success') { Write-Host "  $_" -ForegroundColor Green }
    else { if ($Verbose) { Write-Info $_ } }
}

# STEP 8: Verify output
Write-Step "Verifying output"

$SetupExe = Get-ChildItem -Path "$ProjectRoot\installer\release" `
            -Filter "*.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1

if (-not $SetupExe) {
    Write-Fail "No Setup.exe produced in release/ folder - Check errors above"
}

$SizeBytes = $SetupExe.Length
$SizeMB    = [math]::Round($SizeBytes / 1MB, 1)
$EndTime   = Get-Date
$Duration  = ($EndTime - $StartTime).TotalSeconds

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "                   BUILD COMPLETE                          " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  File   : $($SetupExe.Name)" -ForegroundColor Green
Write-Host "  Path   : $($SetupExe.FullName)" -ForegroundColor Green
Write-Host "  Size   : $SizeMB MB" -ForegroundColor Green
Write-Host "  Time   : $([math]::Round($Duration/60,1)) minutes" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To run installer: & '$($SetupExe.FullName)'" -ForegroundColor Cyan
Write-Host ""

Start-Process explorer.exe -ArgumentList "$ProjectRoot\installer\release"
