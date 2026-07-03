#Requires -RunAsAdministrator
<#
.SYNOPSIS
    إعادة بناء وتثبيت OneSoft ERP من الصفر على Windows
    يجب تشغيله كـ Administrator من مجلد ONESOFT-ERP-CLEAN

.USAGE
    cd C:\ONESOFT-ERP-CLEAN
    powershell -ExecutionPolicy Bypass -File windows-rebuild.ps1
#>

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot  # نفس مجلد السكريبت = جذر المشروع

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  OneSoft ERP — إعادة بناء شاملة من الصفر"         -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── الخطوة 0: إيقاف الخدمات الحية ────────────────────────────────────────────
Write-Host "[0/5] إيقاف خدمات OneSoft (إن كانت تعمل)..." -ForegroundColor Yellow

foreach ($svc in @('OneSoft-Server', 'OneSoft-Client')) {
    try {
        $status = & nssm status $svc 2>$null
        if ($status -match 'SERVICE_RUNNING') {
            Write-Host "      → إيقاف $svc ..." -NoNewline
            & nssm stop $svc | Out-Null
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host "      → $svc : $status (لا حاجة للإيقاف)"
        }
    } catch {
        Write-Host "      → $svc : غير مثبّت — تخطّي"
    }
}

Start-Sleep -Seconds 2

# ── الخطوة 1: إزالة التثبيت القديم بالكامل ───────────────────────────────────
Write-Host ""
Write-Host "[1/5] إزالة مجلد التثبيت القديم..." -ForegroundColor Yellow

$installDir = "C:\Program Files\OneSoft ERP"
if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    if (Test-Path $installDir) {
        Write-Host "      ⚠️  تعذّر الحذف الكامل — قد تكون بعض العمليات لا تزال تعمل" -ForegroundColor Red
        Write-Host "      افتح Task Manager وأنهِ أي عملية node.exe أو OneSoft، ثم أعد تشغيل السكريبت."
        exit 1
    }
    Write-Host "      ✅ تم الحذف: $installDir" -ForegroundColor Green
} else {
    Write-Host "      ℹ️  غير موجود — تخطّي"
}

# ── الخطوة 2: تعديل env.ts (السبب الجذري) ────────────────────────────────────
Write-Host ""
Write-Host "[2/5] التحقق من إصلاح env.ts (|| بدلاً من ??)..." -ForegroundColor Yellow

$envFile = Join-Path $ROOT "server-app\src\env.ts"
if (-not (Test-Path $envFile)) {
    Write-Host "      ❌ ملف env.ts غير موجود في: $envFile" -ForegroundColor Red
    exit 1
}

$content = Get-Content $envFile -Raw

# تحقق: هل الإصلاح موجود بالفعل؟
if ($content -match "process\.env\['DATABASE_URL'\] \|\| undefined") {
    Write-Host "      ✅ الإصلاح موجود بالفعل — لا حاجة لتعديل" -ForegroundColor Green
} elseif ($content -match "process\.env\['DATABASE_URL'\];") {
    # تطبيق الإصلاح تلقائياً
    $fixed = $content -replace `
        "const urlFromEnv = process\.env\['DATABASE_URL'\];", `
        "const urlFromEnv = process.env['DATABASE_URL'] || undefined;  // fix: '' treated as missing"
    Set-Content $envFile $fixed -NoNewline
    Write-Host "      ✅ تم تطبيق الإصلاح على env.ts" -ForegroundColor Green
} else {
    Write-Host "      ⚠️  لم يُعثر على النمط المتوقع في env.ts — تفقّد الملف يدوياً" -ForegroundColor Red
    Write-Host "      المطلوب: تغيير السطر الذي يحتوي على DATABASE_URL إلى:"
    Write-Host "        const urlFromEnv = process.env['DATABASE_URL'] || undefined;"
    exit 1
}

# ── الخطوة 3: البناء الشامل (build-all.mjs) ───────────────────────────────────
Write-Host ""
Write-Host "[3/5] تشغيل build-all.mjs (بناء شامل من الصفر)..." -ForegroundColor Yellow
Write-Host "      هذا يأخذ 3-7 دقائق — انتظر حتى تظهر رسالة الإكمال"
Write-Host ""

$installerDir = Join-Path $ROOT "installer"
Set-Location $installerDir
& pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ فشل البناء — راجع الأخطاء أعلاه" -ForegroundColor Red
    exit 1
}

# ── الخطوة 4: تحقق من تاريخ الملف المُنتَج ──────────────────────────────────
Write-Host ""
Write-Host "[4/5] التحقق من المثبّت الجديد..." -ForegroundColor Yellow

$setupExe = Join-Path $installerDir "release\OneSoftSetup.exe"
if (-not (Test-Path $setupExe)) {
    Write-Host "      ❌ OneSoftSetup.exe غير موجود — راجع مخرجات البناء" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $setupExe
$age = (Get-Date) - $fileInfo.LastWriteTime
if ($age.TotalMinutes -gt 15) {
    Write-Host "      ⚠️  تحذير: الملف قديم ($([int]$age.TotalMinutes) دقيقة) — قد لا يكون هذا الناتج الجديد" -ForegroundColor Yellow
} else {
    Write-Host "      ✅ OneSoftSetup.exe حديث ($([int]$age.TotalMinutes) دقيقة مضت)" -ForegroundColor Green
}
Write-Host "      📁 $setupExe"
Write-Host "      🕐 $($fileInfo.LastWriteTime)"

# ── الخطوة 5: تشغيل المثبّت الجديد ───────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] تشغيل المثبّت الجديد..." -ForegroundColor Yellow
Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  معيار النجاح في logs التثبيت:"                   -ForegroundColor Cyan
Write-Host "  [1/6] 🚀 OneSoft Backend Startup           ← البناء الجديد وصل"
Write-Host "  Database User : onesoft_app                ← الإصلاح نجح"
Write-Host "  [4/6] ✅ PostgreSQL connected              ← الاتصال يعمل"
Write-Host "  [6/6] ✅ Listening on http://localhost:3000 ← الخادم يعمل"
Write-Host ""
Write-Host "  إذا لم يظهر [1/6]: التثبيت القديم لم يُزَل بالكامل"
Write-Host "  إذا ظهر 'postgres' في Database User: راجع env.ts"
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Start-Process $setupExe
Write-Host "✅ تم تشغيل المثبّت. راقب logs التثبيت بعناية." -ForegroundColor Green
