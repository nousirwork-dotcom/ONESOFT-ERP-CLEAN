#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP — بناء المثبّت الاحترافي على Windows
    يُنتج ملف Setup.exe جاهز للتوزيع

.DESCRIPTION
    هذا السكريبت يقوم بـ:
    1. فحص المتطلبات (Node.js, pnpm, Git)
    2. بناء server-app و client-app
    3. بناء Electron Installer
    4. إنتاج Setup.exe في مجلد release/

.USAGE
    افتح PowerShell كـ Administrator ثم نفّذ:
    .\BUILD-ON-WINDOWS.ps1

    لتحديد مسار مخصص:
    .\BUILD-ON-WINDOWS.ps1 -ProjectRoot "F:\OneSoft-ERP"

    لتخطي بناء التطبيق (إذا كان مبنياً مسبقاً):
    .\BUILD-ON-WINDOWS.ps1 -SkipAppBuild

.NOTES
    المتطلبات: Node.js v20+, pnpm v8+, Windows 10/11 x64
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = $PSScriptRoot,
    [switch]$SkipAppBuild,
    [switch]$SkipInstall,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = "OneSoft ERP — Build Installer"

# ──────────────────────────────────────────────────────────────────────────────
# الألوان والدوال المساعدة
# ──────────────────────────────────────────────────────────────────────────────
function Write-Step($msg)    { Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Fail($msg)    { Write-Host "  ❌ $msg" -ForegroundColor Red; exit 1 }
function Write-Info($msg)    { Write-Host "  ℹ️  $msg" -ForegroundColor Gray }
function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║          OneSoft ERP — Professional Installer Build       ║" -ForegroundColor Blue
    Write-Host "║                   Version 1.0.0                          ║" -ForegroundColor Blue
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
}

# ──────────────────────────────────────────────────────────────────────────────
# STEP 0: Banner ومعلومات البناء
# ──────────────────────────────────────────────────────────────────────────────
Write-Banner
$StartTime = Get-Date
Write-Info "مجلد المشروع: $ProjectRoot"
Write-Info "وقت البدء: $($StartTime.ToString('HH:mm:ss'))"

# ──────────────────────────────────────────────────────────────────────────────
# STEP 1: فحص المتطلبات
# ──────────────────────────────────────────────────────────────────────────────
Write-Step "فحص المتطلبات"

# Node.js
try {
    $nodeVer = node --version 2>&1
    $nodeMaj = [int]($nodeVer -replace 'v(\d+)\..*','$1')
    if ($nodeMaj -lt 20) { Write-Fail "يتطلب Node.js v20+ — الإصدار الحالي: $nodeVer" }
    Write-Ok "Node.js: $nodeVer"
} catch { Write-Fail "Node.js غير مثبت — حمّله من https://nodejs.org" }

# pnpm
try {
    $pnpmVer = pnpm --version 2>&1
    Write-Ok "pnpm: v$pnpmVer"
} catch {
    Write-Warn "pnpm غير موجود — جارٍ تثبيته..."
    npm install -g pnpm
    Write-Ok "تم تثبيت pnpm"
}

# مجلد المشروع
if (-not (Test-Path "$ProjectRoot\server-app")) { Write-Fail "لم يُعثر على server-app في: $ProjectRoot" }
if (-not (Test-Path "$ProjectRoot\client-app")) { Write-Fail "لم يُعثر على client-app في: $ProjectRoot" }
if (-not (Test-Path "$ProjectRoot\installer"))  { Write-Fail "لم يُعثر على installer في: $ProjectRoot" }
Write-Ok "مجلد المشروع صحيح"

# NSSM
$NssmDest = "$ProjectRoot\installer\resources\bin\nssm.exe"
if (-not (Test-Path $NssmDest)) {
    Write-Warn "nssm.exe غير موجود — جارٍ التنزيل..."
    $NssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $TmpZip = "$env:TEMP\nssm.zip"
    $TmpDir = "$env:TEMP\nssm-extract"
    try {
        Invoke-WebRequest -Uri $NssmUrl -OutFile $TmpZip -UseBasicParsing
        Expand-Archive -Path $TmpZip -DestinationPath $TmpDir -Force
        $NssmExe = Get-ChildItem -Path $TmpDir -Filter "nssm.exe" -Recurse | Where-Object { $_.FullName -match "win64" } | Select-Object -First 1
        if (-not $NssmExe) {
            $NssmExe = Get-ChildItem -Path $TmpDir -Filter "nssm.exe" -Recurse | Select-Object -First 1
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $NssmDest) | Out-Null
        Copy-Item $NssmExe.FullName $NssmDest
        Write-Ok "تم تنزيل nssm.exe"
        Remove-Item $TmpZip, $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "تعذّر تنزيل nssm تلقائياً — حمّله يدوياً من https://nssm.cc/release/nssm-2.24.zip"
        Write-Warn "ضع nssm.exe (64-bit) في: $NssmDest"
        Read-Host "اضغط Enter بعد وضع nssm.exe ثم المتابعة"
    }
}
Write-Ok "nssm.exe: $NssmDest"

# الأيقونة
$IconPath = "$ProjectRoot\installer\resources\icons\onesoft.ico"
if (-not (Test-Path $IconPath)) {
    Write-Warn "onesoft.ico غير موجود — سيُستخدم أيقونة Electron الافتراضية"
    Write-Warn "لاستخدام أيقونتك: ضعها في $IconPath"
    # إنشاء placeholder لمنع فشل البناء
    New-Item -ItemType Directory -Force -Path (Split-Path $IconPath) | Out-Null
    # نسخ أيقونة Electron الافتراضية
    $ElectronIcon = (Get-ChildItem -Path "$ProjectRoot\installer\node_modules\electron" -Filter "*.ico" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($ElectronIcon) {
        Copy-Item $ElectronIcon.FullName $IconPath -ErrorAction SilentlyContinue
        Write-Info "تم نسخ أيقونة Electron مؤقتاً"
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# STEP 2: تثبيت Dependencies
# ──────────────────────────────────────────────────────────────────────────────
if (-not $SkipInstall) {
    Write-Step "تثبيت Dependencies"

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

# ──────────────────────────────────────────────────────────────────────────────
# STEP 3: بناء server-app
# ──────────────────────────────────────────────────────────────────────────────
if (-not $SkipAppBuild) {
    Write-Step "بناء server-app (TypeScript → JavaScript)"
    Set-Location "$ProjectRoot\server-app"

    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
    pnpm run build 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }

    # ✅ server-app يبني إلى dist/index.mjs (esbuild ESM outfile)
    if (-not (Test-Path "dist\index.mjs")) {
        Write-Fail "فشل بناء server-app — لم يُنتج dist\index.mjs"
    }
    Write-Ok "server-app مبني ✓ (dist\index.mjs)"
}

# ──────────────────────────────────────────────────────────────────────────────
# STEP 4: بناء client-app
# ──────────────────────────────────────────────────────────────────────────────
if (-not $SkipAppBuild) {
    Write-Step "بناء client-app (React → Static HTML/JS/CSS)"
    Set-Location "$ProjectRoot\client-app"

    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
    pnpm run build 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }

    if (-not (Test-Path "dist\index.html")) {
        Write-Fail "فشل بناء client-app — لم يُنتج dist\index.html"
    }
    Write-Ok "client-app مبني ✓ (dist\index.html)"
}

# ──────────────────────────────────────────────────────────────────────────────
# STEP 5: نسخ ملفات التطبيق إلى مجلد installer
# ──────────────────────────────────────────────────────────────────────────────
Write-Step "تجميع ملفات التطبيق"

$AppResources = "$ProjectRoot\installer\resources\app"
New-Item -ItemType Directory -Force -Path "$AppResources\server-app" | Out-Null
New-Item -ItemType Directory -Force -Path "$AppResources\client-app" | Out-Null

# نسخ server-app
Write-Info "نسخ server-app..."
$ServerItems = @('dist', 'package.json', 'drizzle')
foreach ($item in $ServerItems) {
    $src = "$ProjectRoot\server-app\$item"
    if (Test-Path $src) {
        Copy-Item $src "$AppResources\server-app\$item" -Recurse -Force
        Write-Info "  ✓ $item"
    }
}
# نسخ node_modules للـ production فقط
Write-Info "نسخ server-app node_modules (production)..."
Set-Location "$ProjectRoot\server-app"
pnpm install --prod --frozen-lockfile --ignore-scripts 2>&1 | Out-Null
Copy-Item "node_modules" "$AppResources\server-app\node_modules" -Recurse -Force
Write-Ok "server-app → app resources"

# نسخ client-app dist
Write-Info "نسخ client-app dist..."
Copy-Item "$ProjectRoot\client-app\dist" "$AppResources\client-app\dist" -Recurse -Force
# نسخ serve-client.js
Copy-Item "$ProjectRoot\installer\resources\serve-client.js" "$AppResources\client-app\dist-serve\server.js" -Force
Write-Ok "client-app → app resources"

# migration files
$MigDir = "$ProjectRoot\server-app\drizzle"
if (Test-Path $MigDir) {
    Copy-Item $MigDir "$AppResources\server-app\drizzle" -Recurse -Force
    Write-Ok "migration files"
}

# ──────────────────────────────────────────────────────────────────────────────
# STEP 6: بناء Electron Installer
# ──────────────────────────────────────────────────────────────────────────────
Write-Step "بناء Electron Installer (TypeScript)"
Set-Location "$ProjectRoot\installer"

# تنظيف
if (Test-Path "dist-electron") { Remove-Item "dist-electron" -Recurse -Force }
if (Test-Path "dist-ui")       { Remove-Item "dist-ui"       -Recurse -Force }
if (Test-Path "release")       { Remove-Item "release"       -Recurse -Force }

# بناء TypeScript (Electron)
Write-Info "تجميع TypeScript..."
pnpm exec tsc -p tsconfig.electron.json --noEmit false 2>&1 | ForEach-Object { Write-Info $_ }
if (-not (Test-Path "dist-electron\main.js")) {
    Write-Fail "فشل تجميع TypeScript — لم يُنتج dist-electron\main.js"
}
Write-Ok "TypeScript → dist-electron"

# بناء React UI
Write-Info "بناء React UI..."
pnpm exec vite build 2>&1 | ForEach-Object { if ($Verbose) { Write-Info $_ } }
if (-not (Test-Path "dist-ui\index.html")) {
    Write-Fail "فشل بناء React — لم يُنتج dist-ui\index.html"
}
Write-Ok "React UI → dist-ui"

# ──────────────────────────────────────────────────────────────────────────────
# STEP 7: electron-builder → Setup.exe
# ──────────────────────────────────────────────────────────────────────────────
Write-Step "تغليف electron-builder → Setup.exe"
Write-Info "هذه الخطوة قد تستغرق 2-5 دقائق..."

$env:GH_TOKEN = ""  # لا نستخدم GitHub publishing
pnpm exec electron-builder --win --x64 --config electron-builder.config.ts 2>&1 | ForEach-Object {
    if ($_ -match 'error|Error|failed|Failed') { Write-Host "  $_" -ForegroundColor Red }
    elseif ($_ -match 'built|Built|done|Done|success') { Write-Host "  $_" -ForegroundColor Green }
    else { if ($Verbose) { Write-Info $_ } }
}

# ──────────────────────────────────────────────────────────────────────────────
# STEP 8: التحقق من الناتج
# ──────────────────────────────────────────────────────────────────────────────
Write-Step "التحقق من الناتج"

$SetupExe = Get-ChildItem -Path "$ProjectRoot\installer\release" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $SetupExe) {
    Write-Fail "لم يُنتج ملف Setup.exe في مجلد release/ — راجع الأخطاء أعلاه"
}

$SizeBytes = $SetupExe.Length
$SizeMB    = [math]::Round($SizeBytes / 1MB, 1)

$EndTime  = Get-Date
$Duration = ($EndTime - $StartTime).TotalSeconds

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                   ✅ البناء مكتمل بنجاح                     ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  الملف   : $($SetupExe.Name)" -ForegroundColor Green
Write-Host "║  المسار  : $($SetupExe.FullName)" -ForegroundColor Green
Write-Host "║  الحجم   : $SizeMB MB" -ForegroundColor Green
Write-Host "║  الزمن   : $([math]::Round($Duration/60,1)) دقيقة" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  لتشغيل المثبّت: " -NoNewline
Write-Host "& '$($SetupExe.FullName)'" -ForegroundColor Cyan
Write-Host ""

# فتح مجلد release تلقائياً
Start-Process explorer.exe -ArgumentList "$ProjectRoot\installer\release"
