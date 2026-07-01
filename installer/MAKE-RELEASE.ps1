#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP — إنشاء حزمة Release قابلة للتوزيع
    يجمع Setup.exe + CHANGELOG + SHA256 + رقم الإصدار في مجلد واحد

.USAGE
    .\MAKE-RELEASE.ps1
    .\MAKE-RELEASE.ps1 -Version "1.0.1" -OutputDir "D:\Releases"
#>
param(
    [string]$Version   = "1.0.0",
    [string]$OutputDir = "$PSScriptRoot\..\release"
)

$ErrorActionPreference = 'Stop'

function Write-Ok($m)   { Write-Host "  ✅ $m" -ForegroundColor Green }
function Write-Fail($m) { Write-Host "  ❌ $m" -ForegroundColor Red; exit 1 }
function Write-Step($m) { Write-Host "`n[STEP] $m" -ForegroundColor Cyan }

Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║   OneSoft ERP — إنشاء Release v$Version         ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ── STEP 1: إيجاد Setup.exe ──────────────────────────────────────────────────
Write-Step "البحث عن Setup.exe"

$releaseDir  = "$PSScriptRoot\..\release"
$setupSource = Get-ChildItem -Path $releaseDir -Filter "*Setup*.exe" -Recurse -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $setupSource) {
    Write-Fail "لم يُعثر على Setup.exe في مجلد release/`nشغّل BUILD-ON-WINDOWS.ps1 أولاً"
}
Write-Ok "تم إيجاد: $($setupSource.FullName)"
Write-Host "  الحجم: $([math]::Round($setupSource.Length/1MB,1)) MB"

# ── STEP 2: إنشاء مجلد Release ───────────────────────────────────────────────
Write-Step "إنشاء مجلد الـ Release"

$releaseName = "OneSoft-ERP-v$Version-$(Get-Date -Format 'yyyyMMdd')"
$distDir     = "$OutputDir\$releaseName"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Write-Ok "المجلد: $distDir"

# ── STEP 3: نسخ Setup.exe ────────────────────────────────────────────────────
Write-Step "نسخ Setup.exe"
$destExe = "$distDir\OneSoftSetup-v$Version.exe"
Copy-Item $setupSource.FullName $destExe
Write-Ok "تم النسخ: $destExe"

# ── STEP 4: SHA256 Checksum ───────────────────────────────────────────────────
Write-Step "حساب SHA256 Checksum"
$hash = (Get-FileHash $destExe -Algorithm SHA256).Hash
$sha256Content = @"
OneSoft ERP v$Version — SHA256 Checksums
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')

File: OneSoftSetup-v$Version.exe
SHA256: $hash
Size: $([math]::Round($setupSource.Length/1MB,2)) MB

Verify on Windows:
  Get-FileHash "OneSoftSetup-v$Version.exe" -Algorithm SHA256

Verify on Linux/Mac:
  sha256sum OneSoftSetup-v$Version.exe
"@
$sha256Content | Out-File "$distDir\SHA256SUMS.txt" -Encoding UTF8
Write-Ok "SHA256: $hash"

# ── STEP 5: CHANGELOG ────────────────────────────────────────────────────────
Write-Step "نسخ CHANGELOG"
$changelogSrc = "$PSScriptRoot\CHANGELOG.md"
if (Test-Path $changelogSrc) {
    Copy-Item $changelogSrc "$distDir\CHANGELOG.md"
    Write-Ok "CHANGELOG.md"
} else {
    Write-Host "  ⚠️  CHANGELOG.md غير موجود" -ForegroundColor Yellow
}

# ── STEP 6: دليل التثبيت السريع ──────────────────────────────────────────────
Write-Step "إنشاء دليل التثبيت السريع"
$quickGuide = @"
# OneSoft ERP v$Version — دليل التثبيت السريع

## متطلبات النظام
- Windows 10 / 11 (64-bit)
- 4 GB RAM كحد أدنى (8 GB مُوصى به)
- 5 GB مساحة حرة على القرص
- اتصال بالإنترنت (لتنزيل PostgreSQL إذا لم تكن مثبتة)

## خطوات التثبيت
1. شغّل **OneSoftSetup-v$Version.exe** كـ Administrator
2. اتبع خطوات المعالج (Wizard)
3. أدخل كلمة مرور قاعدة البيانات (8 أحرف على الأقل)
4. أدخل بيانات المؤسسة وأول مستخدم
5. انتظر اكتمال التثبيت
6. اضغط "تشغيل البرنامج الآن"

## بعد التثبيت
- **Backend API**: http://localhost:3000
- **واجهة الويب**: http://localhost:5000
- **سجلات النظام**: C:\ProgramData\OneSoft\Logs\

## التحقق من الـ Checksum
``powershell
Get-FileHash "OneSoftSetup-v$Version.exe" -Algorithm SHA256
``
قارن النتيجة مع القيمة في SHA256SUMS.txt

## الإزالة
- من لوحة التحكم → البرامج → OneSoft ERP → إلغاء التثبيت
- أو شغّل: Uninstall OneSoft ERP.exe من مجلد التثبيت

## الدعم الفني
- البريد الإلكتروني: support@onesoft.app
"@
$quickGuide | Out-File "$distDir\INSTALL-GUIDE.md" -Encoding UTF8
Write-Ok "INSTALL-GUIDE.md"

# ── STEP 7: ملف VERSION ───────────────────────────────────────────────────────
Write-Step "إنشاء ملف VERSION"
@"
{
  "version": "$Version",
  "releaseDate": "$(Get-Date -Format 'yyyy-MM-dd')",
  "sha256": "$hash",
  "filename": "OneSoftSetup-v$Version.exe",
  "sizeMB": $([math]::Round($setupSource.Length/1MB,2)),
  "platform": "Windows x64",
  "minimumOS": "Windows 10 1903"
}
"@ | Out-File "$distDir\version.json" -Encoding UTF8
Write-Ok "version.json"

# ── STEP 8: ضغط الحزمة (ZIP) ─────────────────────────────────────────────────
Write-Step "ضغط حزمة الـ Release"
$zipPath = "$OutputDir\$releaseName.zip"
Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath -Force
$zipSize = [math]::Round((Get-Item $zipPath).Length/1MB,1)
Write-Ok "الحزمة المضغوطة: $zipPath ($zipSize MB)"

# ── النتيجة ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ تم إنشاء Release v$Version بنجاح!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  مجلد الـ Release : $distDir"
Write-Host "  الحزمة المضغوطة  : $zipPath"
Write-Host "  SHA256           : $hash"
Write-Host ""
Write-Host "  الملفات الموجودة في الحزمة:"
Get-ChildItem $distDir | ForEach-Object {
    Write-Host "    • $($_.Name) ($([math]::Round($_.Length/1KB,1)) KB)"
}

Start-Process "explorer.exe" $distDir
