#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP - Official Build Script (Windows)
    Produces OneSoftSetup-<version>.exe ready for distribution.

.DESCRIPTION
    Fully automated build pipeline - works on a fresh git clone:
      1. Verify requirements  (Node.js 20+, pnpm 8+)
      2. Install dependencies (installer / server-app / client-app)
      3. Build server-app     (TypeScript -> dist/index.mjs)
      4. Build client-app     (React -> dist/index.html)
      5. Assemble app bundle  (server + client into installer/resources/app)
      6. Build Electron shell (TypeScript + Vite React UI)
      7. Package with electron-builder -> OneSoftSetup-<ver>.exe

.PARAMETER ProjectRoot
    Repository root. Defaults to the PARENT of the folder that contains
    this script (correct when script is inside installer/).

.PARAMETER SkipAppBuild
    Skip building server-app and client-app (reuse existing dist/).

.PARAMETER SkipInstall
    Skip all pnpm install steps (reuse existing node_modules/).

.EXAMPLE
    # Standard build from a fresh clone:
    git clone <url> C:\ONESOFT-ERP-CLEAN
    cd C:\ONESOFT-ERP-CLEAN\installer
    .\BUILD-ON-WINDOWS.ps1

.EXAMPLE
    # Re-package only (apps already built):
    .\BUILD-ON-WINDOWS.ps1 -SkipAppBuild -SkipInstall

.NOTES
    Tested: Node.js 20/22, pnpm 9/10, PowerShell 5.1, Windows 10/11 x64
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot  = (Split-Path $PSScriptRoot -Parent),
    [switch]$SkipAppBuild,
    [switch]$SkipInstall
)

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'   # We check $LASTEXITCODE manually
$Script:StageLabel     = 'Init'
$Script:StartTime      = Get-Date

# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------
function Write-Banner {
    $line = '=' * 62
    Write-Host ''
    Write-Host $line                                                  -ForegroundColor Blue
    Write-Host '       OneSoft ERP  -  Professional Installer Build  ' -ForegroundColor Blue
    Write-Host '                      Version 1.0.25                 ' -ForegroundColor Blue
    Write-Host $line                                                  -ForegroundColor Blue
    Write-Host ''
}

function Write-Stage($n, $msg) {
    $Script:StageLabel = "Step $n - $msg"
    Write-Host ''
    Write-Host "[STEP $n] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg)   { Write-Host "   [OK] $msg"   -ForegroundColor Green  }
function Write-Warn($msg) { Write-Host " [WARN] $msg"   -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host " [INFO] $msg"   -ForegroundColor Gray   }

function Write-Fail($Stage, $Command, $Reason, $Fix) {
    $sep = '-' * 58
    Write-Host ''
    Write-Host "  [FAIL] $sep"    -ForegroundColor Red
    Write-Host "  Stage   : $Stage"   -ForegroundColor Red
    Write-Host "  Command : $Command" -ForegroundColor Red
    Write-Host "  Reason  : $Reason"  -ForegroundColor Red
    Write-Host "  Fix     : $Fix"     -ForegroundColor Yellow
    Write-Host "  [FAIL] $sep"    -ForegroundColor Red
    Write-Host ''
    exit 1
}

# ---------------------------------------------------------------------------
# Command runner
# Captures stdout+stderr, always shows error-looking lines, exits on failure.
# ---------------------------------------------------------------------------
function Invoke-Cmd {
    param(
        [string]   $Exe,
        [string[]] $ArgList,
        [string]   $WorkDir  = '',
        [string]   $OnFail   = '',
        [string]   $Fix      = 'Check the output above for details.'
    )

    $saved = $PWD.Path
    if ($WorkDir -ne '' -and $WorkDir -ne $saved) { Set-Location $WorkDir }

    $cmdStr = "$Exe $($ArgList -join ' ')"

    $lines = & $Exe @ArgList 2>&1
    $ec    = $LASTEXITCODE

    foreach ($ln in $lines) {
        $text = $ln.ToString()
        if ($text -match '(?i)(^error|^ERR!|ENOENT|Cannot find|not found|failed|exception)') {
            Write-Host "    $text" -ForegroundColor Red
        } elseif ($text -match '(?i)(warn|deprecated|ignored build)') {
            Write-Host "    $text" -ForegroundColor Yellow
        } else {
            Write-Host "    $text" -ForegroundColor Gray
        }
    }

    if ($WorkDir -ne '' -and $WorkDir -ne $saved) { Set-Location $saved }

    if ($ec -ne 0) {
        $reason = if ($OnFail -ne '') { $OnFail } else { "'$cmdStr' exited with code $ec" }
        Write-Fail -Stage $Script:StageLabel -Command $cmdStr `
                   -Reason $reason -Fix $Fix
    }
}

# ---------------------------------------------------------------------------
# pnpm convenience wrapper (splits args safely, no --frozen-lockfile issues)
# ---------------------------------------------------------------------------
function Invoke-Pnpm {
    param(
        [string[]] $ArgList,
        [string]   $WorkDir = '',
        [string]   $OnFail  = '',
        [string]   $Fix     = 'Run the command manually in that folder to see the full output.'
    )
    Invoke-Cmd -Exe 'pnpm' -ArgList $ArgList -WorkDir $WorkDir -OnFail $OnFail -Fix $Fix
}

function Invoke-Node {
    param(
        [string[]] $ArgList,
        [string]   $WorkDir = '',
        [string]   $OnFail  = '',
        [string]   $Fix     = 'Run the Node command manually to see the full output.'
    )
    Invoke-Cmd -Exe 'node' -ArgList $ArgList -WorkDir $WorkDir -OnFail $OnFail -Fix $Fix
}

# ---------------------------------------------------------------------------
# Helper: Stop any process that may hold locks on build output directories.
# Called automatically before STEP 0 so Remove-Item never hits "access denied".
# ---------------------------------------------------------------------------
function Stop-BuildBlockingProcesses {
    # Names without .exe suffix (Get-Process does not use the extension)
    $names = @('OneSoft ERP', 'electron', 'OneSoftSetup', 'crashpad_handler')
    $stopped = @()

    foreach ($name in $names) {
        $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
        if ($procs) {
            foreach ($p in $procs) {
                Write-Warn "Stopping locked process: $($p.Name)  PID $($p.Id)"
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                $stopped += $p
            }
        }
    }

    if ($stopped.Count -gt 0) {
        Write-Info "Waiting for $($stopped.Count) process(es) to fully exit..."
        foreach ($p in $stopped) {
            try { $p.WaitForExit(8000) | Out-Null } catch {}
        }
        # Extra pause so OS releases file handles
        Start-Sleep -Milliseconds 1500
        Write-Ok "All blocking processes stopped"
    } else {
        Write-Info "No blocking app processes detected"
    }
}

# ---------------------------------------------------------------------------
# Helper: Delete a build directory with lock detection.
# If Remove-Item fails, tries handle.exe (Sysinternals) to name the culprit.
# Exits the script with a clear message if the folder stays locked.
# ---------------------------------------------------------------------------
function Remove-BuildDir {
    param(
        [string]$DirPath,
        [string]$Label
    )

    if (-not (Test-Path $DirPath)) {
        Write-Info "$Label not found - skipped"
        return
    }

    try {
        Remove-Item $DirPath -Recurse -Force -ErrorAction Stop
        Write-Ok "$Label removed"
        return
    } catch {
        Write-Warn "$Label delete failed: $($_.Exception.Message)"
    }

    # --- Identify the locking process ----------------------------------------
    $handleCmd = Get-Command 'handle.exe' -ErrorAction SilentlyContinue
    if ($handleCmd) {
        Write-Warn "Processes still locking '$Label':"
        & handle.exe -accepteula -nobanner $DirPath 2>&1 |
            ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    } else {
        Write-Warn "handle.exe not found - cannot identify the locking process."
        Write-Warn "Tip: download Sysinternals Handle from"
        Write-Warn "     https://learn.microsoft.com/en-us/sysinternals/downloads/handle"
        Write-Warn "     and place handle.exe on PATH to get the process name here."
    }

    Write-Fail `
        -Stage   $Script:StageLabel `
        -Command "Remove-Item $DirPath" `
        -Reason  "The directory is locked by another process (access denied)." `
        -Fix     "Close all running OneSoft ERP windows, then re-run this script."
}

# ===========================================================================
# START
# ===========================================================================
Write-Banner
Write-Info "Project root : $ProjectRoot"
Write-Info "Installer dir: $PSScriptRoot"
Write-Info "Started at   : $($Script:StartTime.ToString('HH:mm:ss'))"
Write-Info "SkipAppBuild : $SkipAppBuild   SkipInstall: $SkipInstall"

# ---------------------------------------------------------------------------
# STEP 0 - Stop running app instances, then clean previous build artifacts
# ---------------------------------------------------------------------------
Write-Stage 0 'Stopping app processes and cleaning previous build artifacts'

Stop-BuildBlockingProcesses

$CleanTargets = @(
    @{ Path = "$ProjectRoot\installer\release";        Label = 'installer/release'        },
    @{ Path = "$ProjectRoot\installer\dist-electron";  Label = 'installer/dist-electron'  },
    @{ Path = "$ProjectRoot\installer\dist-ui";        Label = 'installer/dist-ui'        },
    @{ Path = "$ProjectRoot\installer\resources\app";  Label = 'installer/resources/app'  },
    @{ Path = "$ProjectRoot\client-app\dist";          Label = 'client-app/dist'          },
    @{ Path = "$ProjectRoot\server-app\dist";          Label = 'server-app/dist'          }
)

foreach ($target in $CleanTargets) {
    Remove-BuildDir -DirPath $target.Path -Label $target.Label
}

Write-Ok 'Clean complete - starting fresh build'

# ---------------------------------------------------------------------------
# STEP 1 - Verify requirements
# ---------------------------------------------------------------------------
Write-Stage 1 'Verifying requirements'

# -- Node.js ----------------------------------------------------------------
try {
    $nodeVer = (node --version 2>&1).ToString().Trim()
    $nodeMaj = [int]($nodeVer -replace '^v(\d+)\..*','$1')
    if ($nodeMaj -lt 20) {
        Write-Fail -Stage $Script:StageLabel -Command 'node --version' `
            -Reason "Node.js $nodeVer found; v20 or higher required." `
            -Fix    'Download Node.js v20 LTS from https://nodejs.org and re-run.'
    }
    Write-Ok "Node.js $nodeVer"
} catch {
    Write-Fail -Stage $Script:StageLabel -Command 'node --version' `
        -Reason 'Node.js is not installed or not on PATH.' `
        -Fix    'Install Node.js v20+ from https://nodejs.org, restart PowerShell, then re-run.'
}

# -- pnpm -------------------------------------------------------------------
try {
    $pnpmVer = (pnpm --version 2>&1).ToString().Trim()
    $pnpmMaj = [int]($pnpmVer -split '\.')[0]
    if ($pnpmMaj -lt 8) {
        Write-Fail -Stage $Script:StageLabel -Command 'pnpm --version' `
            -Reason "pnpm v$pnpmVer found; v8 or higher required." `
            -Fix    'Run: npm install -g pnpm@latest'
    }
    Write-Ok "pnpm v$pnpmVer"
} catch {
    Write-Warn 'pnpm not found - installing latest version...'
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Fail -Stage $Script:StageLabel -Command 'npm install -g pnpm' `
            -Reason 'Could not install pnpm automatically.' `
            -Fix    'Run manually: npm install -g pnpm@latest  then re-run this script.'
    }
    Write-Ok 'pnpm installed'
}

# -- Git (optional, not fatal) ----------------------------------------------
try {
    $gitVer = (git --version 2>&1).ToString().Trim()
    Write-Ok "Git: $gitVer"
} catch {
    Write-Warn 'git not found - not required for build, but needed for updates.'
}

# ---------------------------------------------------------------------------
# STEP 2 - Validate project structure
# ---------------------------------------------------------------------------
Write-Stage 2 'Validating project structure'

foreach ($dir in @('server-app','client-app','installer')) {
    if (-not (Test-Path "$ProjectRoot\$dir")) {
        Write-Fail -Stage $Script:StageLabel -Command "Test-Path $ProjectRoot\$dir" `
            -Reason "Required folder '$dir' not found under: $ProjectRoot" `
            -Fix    "Make sure you ran: git clone <url> and that this script is in the installer/ sub-folder."
    }
    Write-Ok "$dir found"
}

# -- nssm.exe ---------------------------------------------------------------
$NssmDest = "$ProjectRoot\installer\resources\bin\nssm.exe"
if (-not (Test-Path $NssmDest)) {
    Write-Warn 'nssm.exe not found - downloading automatically...'
    $NssmUrl = 'https://nssm.cc/release/nssm-2.24.zip'
    $TmpZip  = "$env:TEMP\nssm.zip"
    $TmpDir  = "$env:TEMP\nssm-extract"
    try {
        Invoke-WebRequest -Uri $NssmUrl -OutFile $TmpZip -UseBasicParsing
        Expand-Archive   -Path $TmpZip -DestinationPath $TmpDir -Force
        $NssmExe = Get-ChildItem -Path $TmpDir -Filter 'nssm.exe' -Recurse |
                   Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1
        if (-not $NssmExe) {
            $NssmExe = Get-ChildItem -Path $TmpDir -Filter 'nssm.exe' -Recurse | Select-Object -First 1
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $NssmDest) | Out-Null
        Copy-Item $NssmExe.FullName $NssmDest -Force
        Remove-Item $TmpZip,$TmpDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok 'nssm.exe downloaded successfully'
    } catch {
        Write-Warn "Auto-download failed: $_"
        Write-Warn "Download nssm-2.24.zip from https://nssm.cc/release/nssm-2.24.zip"
        Write-Warn "Extract nssm.exe (win64) to: $NssmDest"
        $ans = Read-Host 'Press Enter after placing nssm.exe to continue (or Ctrl+C to abort)'
        if (-not (Test-Path $NssmDest)) {
            Write-Fail -Stage $Script:StageLabel -Command 'Download nssm.exe' `
                -Reason 'nssm.exe is required to run the server as a Windows Service.' `
                -Fix    "Place nssm.exe (64-bit) at: $NssmDest"
        }
    }
}
Write-Ok "nssm.exe: $NssmDest"

# -- icon.ico ---------------------------------------------------------------
$IconPath = "$ProjectRoot\installer\resources\icon.ico"
if (-not (Test-Path $IconPath)) {
    Write-Warn "icon.ico not found at: $IconPath"
    Write-Warn 'Using built-in Electron icon as placeholder.'
    $FallbackIco = Get-ChildItem -Path "$ProjectRoot\installer\node_modules\electron" `
                   -Filter '*.ico' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($FallbackIco) {
        New-Item -ItemType Directory -Force -Path (Split-Path $IconPath) | Out-Null
        Copy-Item $FallbackIco.FullName $IconPath -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# STEP 3 - Install dependencies
# ---------------------------------------------------------------------------
# pnpm 10 enforces an allowlist for lifecycle scripts (onlyBuiltDependencies).
# Rather than maintain a platform-specific allowlist, we install with
# --ignore-scripts (no ERR_PNPM_IGNORED_BUILDS) then explicitly rebuild the
# one package that needs a native binary at build time: esbuild.
# The electron binary is downloaded by electron-builder itself (Step 8) and
# does NOT need to be present in node_modules at build time.
# ---------------------------------------------------------------------------
if (-not $SkipInstall) {
    Write-Stage 3 'Installing dependencies (pnpm 10 compatible)'

    # ---- installer -------------------------------------------------------
    Write-Info 'installer: installing packages...'
    Invoke-Pnpm -ArgList @('install', '--no-frozen-lockfile', '--ignore-scripts') `
                -WorkDir "$ProjectRoot\installer" `
                -OnFail  'pnpm install failed for installer.' `
                -Fix     "Run: cd $ProjectRoot\installer && pnpm install --ignore-scripts"

    Write-Info 'installer: rebuilding esbuild native binary...'
    Invoke-Pnpm -ArgList @('rebuild', 'esbuild') `
                -WorkDir "$ProjectRoot\installer" `
                -OnFail  'pnpm rebuild esbuild failed for installer.' `
                -Fix     "Run: cd $ProjectRoot\installer && pnpm rebuild esbuild"

    Write-Info 'installer: downloading app-builder binary (used by electron-builder)...'
    Invoke-Pnpm -ArgList @('rebuild', 'app-builder-bin') `
                -WorkDir "$ProjectRoot\installer" `
                -OnFail  'app-builder-bin download failed.' `
                -Fix     @"
app-builder.exe could not be downloaded from GitHub.
Common causes:
  1. Firewall / Windows Defender blocking GitHub downloads
     -> Add rule: allow outbound HTTPS to github.com / objects.githubusercontent.com
  2. Corporate proxy  -> set HTTPS_PROXY env var before running this script
  3. Try manually:   cd $ProjectRoot\installer && pnpm rebuild app-builder-bin
"@
    Write-Ok 'installer deps ready'

    # ---- server-app ------------------------------------------------------
    Write-Info 'server-app: installing packages...'
    Invoke-Pnpm -ArgList @('install', '--no-frozen-lockfile', '--ignore-scripts') `
                -WorkDir "$ProjectRoot\server-app" `
                -OnFail  'pnpm install failed for server-app.' `
                -Fix     "Run: cd $ProjectRoot\server-app && pnpm install --ignore-scripts"

    Write-Info 'server-app: rebuilding esbuild native binary...'
    Invoke-Pnpm -ArgList @('rebuild', 'esbuild') `
                -WorkDir "$ProjectRoot\server-app" `
                -OnFail  'pnpm rebuild esbuild failed for server-app.' `
                -Fix     "Run: cd $ProjectRoot\server-app && pnpm rebuild esbuild"
    Write-Ok 'server-app deps ready'

    # ---- client-app ------------------------------------------------------
    Write-Info 'client-app: installing packages...'
    Invoke-Pnpm -ArgList @('install', '--no-frozen-lockfile', '--ignore-scripts') `
                -WorkDir "$ProjectRoot\client-app" `
                -OnFail  'pnpm install failed for client-app.' `
                -Fix     "Run: cd $ProjectRoot\client-app && pnpm install --ignore-scripts"

    Write-Info 'client-app: rebuilding esbuild native binary...'
    Invoke-Pnpm -ArgList @('rebuild', 'esbuild') `
                -WorkDir "$ProjectRoot\client-app" `
                -OnFail  'pnpm rebuild esbuild failed for client-app.' `
                -Fix     "Run: cd $ProjectRoot\client-app && pnpm rebuild esbuild"
    Write-Ok 'client-app deps ready'

} else {
    Write-Stage 3 'Skipping dependency installation (--SkipInstall)'
}

# ---------------------------------------------------------------------------
# STEP 4 - Build server-app
# ---------------------------------------------------------------------------
if (-not $SkipAppBuild) {
    Write-Stage 4 'Building server-app (TypeScript -> JavaScript)'

    $serverDist = "$ProjectRoot\server-app\dist"
    if (Test-Path $serverDist) { Remove-Item $serverDist -Recurse -Force }

    Invoke-Pnpm -ArgList @('run', 'build') `
                -WorkDir "$ProjectRoot\server-app" `
                -OnFail  'server-app build failed.' `
                -Fix     "Run manually: cd $ProjectRoot\server-app && pnpm run build  (check TypeScript errors)"

    if (-not (Test-Path "$ProjectRoot\server-app\dist\index.mjs")) {
        Write-Fail -Stage $Script:StageLabel -Command 'pnpm run build (server-app)' `
            -Reason 'dist\index.mjs was not produced after build.' `
            -Fix    "Run: cd $ProjectRoot\server-app && pnpm run build  and check for esbuild errors."
    }
    Write-Ok 'server-app built -> dist\index.mjs'

} else {
    Write-Stage 4 'Skipping server-app build (--SkipAppBuild)'
    if (-not (Test-Path "$ProjectRoot\server-app\dist\index.mjs")) {
        Write-Warn 'server-app\dist\index.mjs not found - installer bundle may be incomplete.'
    }
}

# ---------------------------------------------------------------------------
# STEP 5 - Build client-app
# ---------------------------------------------------------------------------
if (-not $SkipAppBuild) {
    Write-Stage 5 'Building client-app (React -> HTML/JS/CSS)'

    $clientDist = "$ProjectRoot\client-app\dist"
    if (Test-Path $clientDist) { Remove-Item $clientDist -Recurse -Force }

    Invoke-Pnpm -ArgList @('run', 'build') `
                -WorkDir "$ProjectRoot\client-app" `
                -OnFail  'client-app build failed.' `
                -Fix     "Run manually: cd $ProjectRoot\client-app && pnpm run build  (check Vite/TypeScript errors)"

    if (-not (Test-Path "$ProjectRoot\client-app\dist\index.html")) {
        Write-Fail -Stage $Script:StageLabel -Command 'pnpm run build (client-app)' `
            -Reason 'dist\index.html was not produced after build.' `
            -Fix    "Run: cd $ProjectRoot\client-app && pnpm run build  and check for Vite errors."
    }
    Write-Ok 'client-app built -> dist\index.html'

} else {
    Write-Stage 5 'Skipping client-app build (--SkipAppBuild)'
    if (-not (Test-Path "$ProjectRoot\client-app\dist\index.html")) {
        Write-Warn 'client-app\dist\index.html not found - installer bundle may be incomplete.'
    }
}

# ---------------------------------------------------------------------------
# STEP 6 - Assemble application bundle
# ---------------------------------------------------------------------------
Write-Stage 6 'Assembling application bundle'

$AppRes = "$ProjectRoot\installer\resources\app"
foreach ($sub in @('server-app','client-app')) {
    New-Item -ItemType Directory -Force -Path "$AppRes\$sub" | Out-Null
}

# -- server-app artifacts ---------------------------------------------------
Write-Info 'Copying server-app artifacts...'
foreach ($item in @('dist','package.json','drizzle')) {
    $src = "$ProjectRoot\server-app\$item"
    if (Test-Path $src) {
        Copy-Item $src "$AppRes\server-app\$item" -Recurse -Force
        Write-Info "  + $item"
    }
}
$FoundationSource = "$ProjectRoot\server-app\src\foundation-data.json"
$FoundationDestination = "$AppRes\server-app\src\foundation-data.json"
New-Item -ItemType Directory -Force -Path (Split-Path $FoundationDestination) | Out-Null
Copy-Item $FoundationSource $FoundationDestination -Force
Write-Ok 'foundation-data.json included'

Write-Info 'Installing server-app production node_modules...'
Invoke-Pnpm -ArgList @('install','--prod','--no-frozen-lockfile','--ignore-scripts') `
            -WorkDir "$ProjectRoot\server-app" `
            -OnFail  'Production pnpm install failed for server-app.' `
            -Fix     "Run: cd $ProjectRoot\server-app && pnpm install --prod"
Copy-Item "$ProjectRoot\server-app\node_modules" "$AppRes\server-app\node_modules" -Recurse -Force
Write-Ok 'server-app -> resources\app\server-app'

# -- client-app dist --------------------------------------------------------
Write-Info 'Copying client-app dist...'
Copy-Item "$ProjectRoot\client-app\dist" "$AppRes\client-app\dist" -Recurse -Force

$ServeClientSrc = "$ProjectRoot\installer\resources\serve-client.js"
if (Test-Path $ServeClientSrc) {
    $ServeClientDest = "$AppRes\client-app\dist-serve"
    New-Item -ItemType Directory -Force -Path $ServeClientDest | Out-Null
    Copy-Item $ServeClientSrc "$ServeClientDest\server.js" -Force
}
Write-Ok 'client-app -> resources\app\client-app'

# -- drizzle migrations -----------------------------------------------------
$MigDir = "$ProjectRoot\server-app\drizzle"
if (Test-Path $MigDir) {
    Copy-Item $MigDir "$AppRes\server-app\drizzle" -Recurse -Force
    Write-Ok 'drizzle migrations included'
}

# ---------------------------------------------------------------------------
# STEP 7 - Build Electron (TypeScript compile + Vite React UI)
# ---------------------------------------------------------------------------
Write-Stage 7 'Building Electron installer shell'

$InstallerDir = "$ProjectRoot\installer"

foreach ($d in @('dist-electron','dist-ui','release')) {
    if (Test-Path "$InstallerDir\$d") { Remove-Item "$InstallerDir\$d" -Recurse -Force }
}

# -- esbuild: bundle Electron main (all JS deps inlined, no node_modules at runtime) ---
Write-Info 'Bundling Electron main process with esbuild...'
Write-Info '  (pg, drizzle-orm, archiver, fs-extra, etc. all bundled inline)'
Invoke-Pnpm -ArgList @(
    'exec','esbuild','electron/main.ts',
    '--bundle','--platform=node','--target=node20','--format=cjs',
    '--external:electron','--external:pg-native','--external:node-windows',
    '--tsconfig=tsconfig.electron.json',
    '--outfile=dist-electron/electron/main.js',
    '--log-level=warning'
) `
            -WorkDir $InstallerDir `
            -OnFail  'esbuild bundling failed for Electron main process.' `
            -Fix     "Run: cd $InstallerDir && pnpm exec esbuild --version  (verify esbuild is available)"

Write-Info 'Bundling Electron preload script with esbuild...'
Invoke-Pnpm -ArgList @(
    'exec','esbuild','electron/preload.ts',
    '--bundle','--platform=node','--target=node20','--format=cjs',
    '--external:electron',
    '--tsconfig=tsconfig.electron.json',
    '--outfile=dist-electron/electron/preload.js',
    '--log-level=warning'
) `
            -WorkDir $InstallerDir `
            -OnFail  'esbuild bundling failed for Electron preload.' `
            -Fix     "Run: cd $InstallerDir && pnpm exec esbuild electron/preload.ts --bundle --external:electron --outfile=dist-electron/electron/preload.js"

if (-not (Test-Path "$InstallerDir\dist-electron\electron\main.js")) {
    Write-Fail -Stage $Script:StageLabel -Command 'esbuild (electron/main.ts)' `
        -Reason 'dist-electron\electron\main.js not found after esbuild bundle.' `
        -Fix    "Confirm electron/main.ts exists and that esbuild is available: pnpm exec esbuild --version"
}
Write-Ok 'esbuild -> dist-electron (all deps bundled inline)'

# -- Vite: React installer UI -----------------------------------------------
Write-Info 'Building React installer UI (Vite)...'
Invoke-Pnpm -ArgList @('exec','vite','build') `
            -WorkDir $InstallerDir `
            -OnFail  'Vite build failed for the installer React UI.' `
            -Fix     "Run: cd $InstallerDir && pnpm exec vite build  and check for errors."

if (-not (Test-Path "$InstallerDir\dist-ui\index.html")) {
    Write-Fail -Stage $Script:StageLabel -Command 'vite build' `
        -Reason 'dist-ui\index.html not found after Vite build.' `
        -Fix    "Check vite.config.ts outDir setting and that installer/ui/index.html exists."
}
Write-Ok 'React UI -> dist-ui'

# ---------------------------------------------------------------------------
# STEP 7.5 - Generate the atomic unified build manifest
# ---------------------------------------------------------------------------
Write-Info 'Generating unified build manifest...'
Invoke-Node -ArgList @("$ProjectRoot\scripts\generate-unified-manifest.mjs") `
            -WorkDir $ProjectRoot `
            -OnFail  'Unified build manifest generation failed.' `
            -Fix     "Check version.json, package versions, electron-builder.yml, and build outputs."
Write-Ok 'Unified build manifest generated and copied to all outputs'

$CriticalBundleFiles = @(
    "$AppRes\server-app\dist\index.mjs",
    "$AppRes\server-app\dist\build-manifest.json",
    "$AppRes\server-app\src\foundation-data.json",
    "$AppRes\server-app\drizzle\0092_repair_legacy_migration_drift.sql",
    "$InstallerDir\dist-ui\build-manifest.json",
    "$ProjectRoot\client-app\dist\build-manifest.json"
)
foreach ($CriticalFile in $CriticalBundleFiles) {
    if (-not (Test-Path $CriticalFile)) {
        Write-Fail -Stage $Script:StageLabel -Command 'package-content-check' `
            -Reason "Critical package file missing: $CriticalFile" `
            -Fix 'Rebuild server-app/client-app and assemble the application bundle again.'
    }
}
Write-Ok "Critical package content verified ($($CriticalBundleFiles.Count) files)"

# ---------------------------------------------------------------------------
# STEP 8 - electron-builder -> Setup.exe
# ---------------------------------------------------------------------------
Write-Stage 8 'Packaging with electron-builder -> OneSoftSetup-<ver>.exe'
Write-Info 'This step downloads Electron binaries on first run (300 MB+, be patient)...'
Write-Info 'Subsequent runs use the local cache and are much faster.'

$env:GH_TOKEN   = ''
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'   # fallback mirror

Invoke-Pnpm -ArgList @('exec','electron-builder','--win','--x64','--ia32','--config','electron-builder.yml') `
            -WorkDir $InstallerDir `
            -OnFail  'electron-builder failed to produce the installer.' `
            -Fix     @"
Common causes:
  1. Electron binary download failed  -> check internet / try again
  2. icon.ico missing or corrupt      -> ensure installer\resources\icon.ico exists (multi-size ICO)
  3. NSIS not found                   -> electron-builder downloads NSIS automatically; check internet
  4. Run with -Verbose for full output: .\BUILD-ON-WINDOWS.ps1 -Verbose
"@

# ---------------------------------------------------------------------------
# STEP 9 - Verify and summarise
# ---------------------------------------------------------------------------
Write-Stage 9 'Verifying output'

$SetupExe = Get-ChildItem -Path "$InstallerDir\release" -Filter '*.exe' -ErrorAction SilentlyContinue |
            Select-Object -First 1

if (-not $SetupExe) {
    Write-Fail -Stage $Script:StageLabel -Command 'electron-builder' `
        -Reason "No .exe file found in: $InstallerDir\release" `
        -Fix    'Re-run with -Verbose to see the full electron-builder output.'
}

$SizeMB   = [math]::Round($SetupExe.Length / 1MB, 1)
$Duration = [math]::Round(((Get-Date) - $Script:StartTime).TotalSeconds / 60, 1)

$sep = '=' * 62
Write-Host ''
Write-Host $sep                                          -ForegroundColor Green
Write-Host '                  BUILD COMPLETE                       '  -ForegroundColor Green
Write-Host $sep                                          -ForegroundColor Green
Write-Host "  File    : $($SetupExe.Name)"               -ForegroundColor Green
Write-Host "  Path    : $($SetupExe.FullName)"           -ForegroundColor Green
Write-Host "  Size    : $SizeMB MB"                      -ForegroundColor Green
Write-Host "  Time    : $Duration minutes"               -ForegroundColor Green
Write-Host $sep                                          -ForegroundColor Green
Write-Host ''
Write-Host '  Run installer: '                           -ForegroundColor Cyan -NoNewline
Write-Host "& `"$($SetupExe.FullName)`""                 -ForegroundColor White
Write-Host ''

Start-Process explorer.exe -ArgumentList "$InstallerDir\release"
