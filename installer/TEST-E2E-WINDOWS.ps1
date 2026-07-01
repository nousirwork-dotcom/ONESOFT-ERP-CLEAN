#Requires -RunAsAdministrator
<#
.SYNOPSIS
    OneSoft ERP — سكريبت اختبار End-to-End الشامل
    يُجري كامل دورة التثبيت/الترقية/الإزالة ويُنتج تقريراً مفصلاً

.USAGE
    PowerShell (Admin):
    .\TEST-E2E-WINDOWS.ps1 -SetupExe "C:\path\to\OneSoftSetup.exe"

    مع كلمة مرور مخصصة:
    .\TEST-E2E-WINDOWS.ps1 -SetupExe ".\OneSoftSetup.exe" -DbPassword "MyPass123"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$SetupExe,

    [string]$DbPassword    = "OneSoft@2024",
    [string]$OrgCode       = "TEST01",
    [string]$OrgName       = "مؤسسة الاختبار",
    [string]$AdminUser     = "admin",
    [string]$AdminPassword = "Admin@2024",
    [string]$InstallDir    = "C:\OneSoft-ERP",
    [string]$ReportDir     = "$env:USERPROFILE\Desktop\OneSoft-E2E-Report"
)

$ErrorActionPreference = 'Continue'
$Script:PassCount = 0
$Script:FailCount = 0
$Script:WarnCount = 0
$Script:Log       = [System.Collections.Generic.List[string]]::new()
$Script:StartTime = Get-Date

# ──────────────────────────────────────────────────────────────────────────────
# دوال مساعدة
# ──────────────────────────────────────────────────────────────────────────────
function Log-Pass($msg) {
    $line = "[PASS] $msg"
    Write-Host "  ✅ $msg" -ForegroundColor Green
    $Script:Log.Add($line); $Script:PassCount++
}
function Log-Fail($msg) {
    $line = "[FAIL] $msg"
    Write-Host "  ❌ $msg" -ForegroundColor Red
    $Script:Log.Add($line); $Script:FailCount++
}
function Log-Warn($msg) {
    $line = "[WARN] $msg"
    Write-Host "  ⚠️  $msg" -ForegroundColor Yellow
    $Script:Log.Add($line); $Script:WarnCount++
}
function Log-Step($msg) {
    $line = "`n══ $msg ══"
    Write-Host "`n$line" -ForegroundColor Cyan
    $Script:Log.Add($line)
}
function Log-Info($msg) {
    $line = "[INFO] $msg"
    Write-Host "  ℹ️  $msg" -ForegroundColor Gray
    $Script:Log.Add($line)
}

function Screenshot($name) {
    # حفظ لقطة شاشة تلقائية
    $ssDir = "$ReportDir\screenshots"
    New-Item -ItemType Directory -Force -Path $ssDir | Out-Null
    $stamp = (Get-Date).ToString("HH-mm-ss")
    $path  = "$ssDir\$stamp-$name.png"
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp    = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $g      = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bmp.Save($path)
        $g.Dispose(); $bmp.Dispose()
        Log-Info "لقطة شاشة: $path"
    } catch {
        Log-Warn "تعذّر أخذ لقطة شاشة: $_"
    }
}

function Wait-Service($name, $status, $timeoutSec = 30) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $svc = Get-Service -Name $name -ErrorAction Stop
            if ($svc.Status -eq $status) { return $true }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Test-HttpEndpoint($url, $timeoutSec = 60) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($r.StatusCode -lt 400) { return $true }
        } catch {}
        Start-Sleep -Seconds 2
    }
    return $false
}

function Check-PortOpen($port, $host = "localhost") {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.ConnectAsync($host, $port).Wait(2000) | Out-Null
        $open = $tcp.Connected
        $tcp.Close()
        return $open
    } catch { return $false }
}

# ──────────────────────────────────────────────────────────────────────────────
# تحضير مجلد التقرير
# ──────────────────────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║       OneSoft ERP — اختبار End-to-End الشامل                ║" -ForegroundColor Blue
Write-Host "║       تاريخ الاختبار: $(Get-Date -Format 'yyyy-MM-dd HH:mm')              ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

$Script:Log.Add("OneSoft ERP — تقرير اختبار E2E")
$Script:Log.Add("التاريخ: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$Script:Log.Add("Setup.exe: $SetupExe")
$Script:Log.Add("مجلد التثبيت: $InstallDir")
$Script:Log.Add("="*60)

# ════════════════════════════════════════════════════════════════════════════
# T01 — فحص ملف الـ Setup قبل التشغيل
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T01 — فحص ملف Setup.exe"

if (-not (Test-Path $SetupExe)) {
    Log-Fail "ملف Setup.exe غير موجود: $SetupExe"
    exit 1
}

$setupSize = (Get-Item $SetupExe).Length
$setupHash = (Get-FileHash $SetupExe -Algorithm SHA256).Hash
Log-Pass "الملف موجود: $(Split-Path $SetupExe -Leaf)"
Log-Info  "الحجم: $([math]::Round($setupSize/1MB,1)) MB"
Log-Info  "SHA256: $setupHash"
$Script:Log.Add("SHA256: $setupHash")

# ════════════════════════════════════════════════════════════════════════════
# T02 — بيئة نظيفة (قبل التثبيت)
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T02 — التحقق من بيئة نظيفة قبل التثبيت"

$services = @("OneSoft-Server", "OneSoft-Client", "OneSoft-Updater")
foreach ($svc in $services) {
    $existing = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($existing) {
        Log-Warn "خدمة $svc موجودة مسبقاً — قد تؤثر على الاختبار"
    } else {
        Log-Pass "خدمة $svc غير موجودة (بيئة نظيفة)"
    }
}

if (Test-Path $InstallDir) {
    Log-Warn "مجلد التثبيت موجود مسبقاً: $InstallDir"
} else {
    Log-Pass "مجلد التثبيت غير موجود (بيئة نظيفة)"
}

$pgInstalled = $null -ne (Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1)
Log-Info "PostgreSQL مثبتة مسبقاً: $pgInstalled"

# ════════════════════════════════════════════════════════════════════════════
# T03 — تشغيل Setup.exe
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T03 — تشغيل Setup.exe (التثبيت التفاعلي)"
Log-Info "سيُفتح نافذة الـ Installer — أكمل خطوات التثبيت يدوياً ثم عُد هنا"
Log-Info "معلومات التثبيت المُقترحة:"
Log-Info "  • كلمة مرور DB  : $DbPassword"
Log-Info "  • كود المؤسسة   : $OrgCode"
Log-Info "  • اسم المؤسسة   : $OrgName"
Log-Info "  • اسم المستخدم  : $AdminUser"
Log-Info "  • كلمة مرور     : $AdminPassword"
Log-Info "  • مجلد التثبيت : $InstallDir"

Write-Host ""
Write-Host "  ► سيُفتح Installer الآن..." -ForegroundColor Yellow
Screenshot "before-install"
Start-Process $SetupExe
Write-Host ""
Write-Host "  انتظر حتى انتهاء التثبيت، ثم اضغط Enter للمتابعة..."
Read-Host

Screenshot "after-install"

# ════════════════════════════════════════════════════════════════════════════
# T04 — التحقق من نتائج التثبيت
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T04 — التحقق من نتائج التثبيت"

# ملفات رئيسية
$expectedFiles = @(
    "$InstallDir\server-app\dist\index.mjs",
    "$InstallDir\client-app\dist\index.html",
    "$env:ProgramData\OneSoft\config\onesoft.config.json",
    "$env:ProgramData\OneSoft\version.json"
)
foreach ($f in $expectedFiles) {
    if (Test-Path $f) { Log-Pass "موجود: $f" }
    else              { Log-Fail "مفقود: $f" }
}

# version.json
$versionFile = "$env:ProgramData\OneSoft\version.json"
if (Test-Path $versionFile) {
    $vinfo = Get-Content $versionFile | ConvertFrom-Json
    Log-Pass "version.json — الإصدار: $($vinfo.version), حالة: $($vinfo.status)"
}

# Registry (Add/Remove Programs)
$regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OneSoftERP"
if (Test-Path $regPath) {
    $regInfo = Get-ItemProperty $regPath
    Log-Pass "Registry — Add/Remove Programs: $($regInfo.DisplayName)"
} else {
    Log-Warn "Registry — Add/Remove Programs غير موجود"
}

# اختصارات
$desktopLnk  = "$env:USERPROFILE\Desktop\OneSoft ERP.lnk"
$startMenuLnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\OneSoft ERP.lnk"
if (Test-Path $desktopLnk)  { Log-Pass "اختصار سطح المكتب موجود" }
else                         { Log-Fail "اختصار سطح المكتب مفقود" }
if (Test-Path $startMenuLnk) { Log-Pass "اختصار قائمة Start موجود" }
else                          { Log-Warn "اختصار قائمة Start مفقود" }

# ════════════════════════════════════════════════════════════════════════════
# T05 — اختبار خدمات Windows
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T05 — اختبار خدمات Windows"

$svcTests = @(
    @{ Name = "OneSoft-Server"; Required = $true  },
    @{ Name = "OneSoft-Client"; Required = $false }
)
foreach ($t in $svcTests) {
    $svc = Get-Service -Name $t.Name -ErrorAction SilentlyContinue
    if ($null -eq $svc) {
        if ($t.Required) { Log-Fail "خدمة $($t.Name) غير موجودة" }
        else             { Log-Warn "خدمة $($t.Name) غير موجودة (اختياري)" }
        continue
    }
    if ($svc.Status -eq 'Running') {
        Log-Pass "خدمة $($t.Name): تعمل ✓"
    } else {
        Log-Fail "خدمة $($t.Name): $($svc.Status)"
    }
    $startup = (Get-WmiObject Win32_Service -Filter "Name='$($t.Name)'" -ErrorAction SilentlyContinue).StartMode
    Log-Info  "نوع البدء: $startup"
}

# ════════════════════════════════════════════════════════════════════════════
# T06 — اختبار المنافذ والـ API
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T06 — اختبار المنافذ والـ API"

Log-Info "انتظار 10 ثوانٍ لبدء الخدمات..."
Start-Sleep -Seconds 10

# منفذ Backend
if (Check-PortOpen 3000) { Log-Pass "المنفذ 3000 (Backend) مفتوح" }
else                      { Log-Fail "المنفذ 3000 (Backend) مغلق" }

# Health endpoint
$backendHealth = Test-HttpEndpoint "http://localhost:3000/api/health" 30
if ($backendHealth) { Log-Pass "Backend /api/health يستجيب" }
else                { Log-Fail "Backend /api/health لا يستجيب" }

# منفذ Frontend
if (Check-PortOpen 5000) { Log-Pass "المنفذ 5000 (Frontend) مفتوح" }
else                      { Log-Warn "المنفذ 5000 (Frontend) مغلق (طبيعي في وضع Desktop)" }

# PostgreSQL
if (Check-PortOpen 5432) { Log-Pass "المنفذ 5432 (PostgreSQL) مفتوح" }
else                      { Log-Fail "المنفذ 5432 (PostgreSQL) مغلق" }

Screenshot "services-running"

# ════════════════════════════════════════════════════════════════════════════
# T07 — اختبار قاعدة البيانات
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T07 — اختبار قاعدة البيانات"

$psqlPath = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($psqlPath) {
    $env:PGPASSWORD = $DbPassword

    # قاعدة البيانات موجودة؟
    $dbExists = & $psqlPath -h localhost -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='onesoft_erp'" 2>&1
    if ($dbExists -match "1") { Log-Pass "قاعدة البيانات onesoft_erp موجودة" }
    else                       { Log-Fail "قاعدة البيانات onesoft_erp غير موجودة" }

    # عدد الجداول
    $tableCount = & $psqlPath -h localhost -U postgres -d onesoft_erp -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>&1
    Log-Info "عدد الجداول: $($tableCount.Trim())"
    if ([int]$tableCount.Trim() -gt 10) { Log-Pass "عدد الجداول كافٍ: $($tableCount.Trim())" }
    else                                  { Log-Warn "عدد الجداول قليل: $($tableCount.Trim())" }

    # جدول Migrations
    $migrationsExist = & $psqlPath -h localhost -U postgres -d onesoft_erp -tAc "SELECT COUNT(*) FROM __drizzle_migrations" 2>&1
    if ($migrationsExist -match '\d+') {
        Log-Pass "جدول Migrations — عدد السجلات: $($migrationsExist.Trim())"
    } else {
        Log-Warn "جدول __drizzle_migrations غير موجود أو فارغ"
    }

    # جدول Organizations
    $orgCount = & $psqlPath -h localhost -U postgres -d onesoft_erp -tAc "SELECT COUNT(*) FROM organizations" 2>&1
    if ([int]$orgCount.Trim() -gt 0) { Log-Pass "جدول Organizations — سجلات: $($orgCount.Trim())" }
    else                               { Log-Fail "لا توجد مؤسسات في قاعدة البيانات" }

    # جدول Users
    $userCount = & $psqlPath -h localhost -U postgres -d onesoft_erp -tAc "SELECT COUNT(*) FROM users" 2>&1
    if ([int]$userCount.Trim() -gt 0) { Log-Pass "جدول Users — سجلات: $($userCount.Trim())" }
    else                                { Log-Fail "لا يوجد مستخدمون في قاعدة البيانات" }

    # شجرة الحسابات
    $acctCount = & $psqlPath -h localhost -U postgres -d onesoft_erp -tAc "SELECT COUNT(*) FROM chart_of_accounts" 2>&1
    if ([int]$acctCount.Trim() -gt 50) { Log-Pass "شجرة الحسابات — سجلات: $($acctCount.Trim())" }
    else                                 { Log-Warn "شجرة الحسابات قد تكون ناقصة: $($acctCount.Trim())" }

    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
} else {
    Log-Warn "psql.exe غير موجود — تخطي اختبارات قاعدة البيانات"
}

# ════════════════════════════════════════════════════════════════════════════
# T08 — اختبار تسجيل الدخول
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T08 — اختبار تسجيل الدخول عبر API"

try {
    $loginBody = @{
        orgCode  = $OrgCode
        username = $AdminUser
        password = $AdminPassword
    } | ConvertTo-Json

    $loginResp = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    if ($loginResp.user) {
        Log-Pass "تسجيل الدخول — نجح: المستخدم $($loginResp.user.username)"
        Log-Info  "الدور: $($loginResp.user.role)"
    } else {
        Log-Fail "تسجيل الدخول — استجاب لكن بدون user object"
    }
} catch {
    Log-Fail "تسجيل الدخول — فشل: $_"
}

Screenshot "login-test"

# ════════════════════════════════════════════════════════════════════════════
# T09 — فتح المتصفح والتحقق من الواجهة
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T09 — فتح المتصفح والتحقق من الواجهة"

Write-Host "  ► سيُفتح المتصفح على http://localhost:5000 الآن..." -ForegroundColor Yellow
Start-Process "http://localhost:5000"
Start-Sleep -Seconds 5
Screenshot "browser-ui"
Write-Host "  هل تظهر واجهة OneSoft ERP؟ [Y/N]"
$uiOk = Read-Host
if ($uiOk -match '^[Yy]') { Log-Pass "الواجهة تظهر في المتصفح" }
else                        { Log-Fail "الواجهة لا تظهر بشكل صحيح" }

# ════════════════════════════════════════════════════════════════════════════
# T10 — اختبار إعادة التشغيل (Restart Services)
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T10 — اختبار إعادة تشغيل الخدمات"

Write-Host "  ► إعادة تشغيل OneSoft-Server..." -ForegroundColor Yellow
try {
    Restart-Service -Name "OneSoft-Server" -Force -ErrorAction Stop
    $ok = Wait-Service "OneSoft-Server" "Running" 30
    if ($ok) { Log-Pass "OneSoft-Server أُعيد تشغيله بنجاح" }
    else      { Log-Fail "OneSoft-Server لم يبدأ خلال 30 ثانية" }
} catch {
    Log-Fail "فشل إعادة تشغيل OneSoft-Server: $_"
}

Start-Sleep -Seconds 5
$backendAfterRestart = Test-HttpEndpoint "http://localhost:3000/api/health" 20
if ($backendAfterRestart) { Log-Pass "Backend يستجيب بعد إعادة التشغيل" }
else                       { Log-Fail "Backend لا يستجيب بعد إعادة التشغيل" }

# ════════════════════════════════════════════════════════════════════════════
# T11 — اختبار الإزالة (Uninstall)
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T11 — اختبار الإزالة (Uninstall)"
Write-Host ""
Write-Host "  ⚠️  هذا الاختبار سيحذف OneSoft ERP. هل تريد المتابعة؟ [Y/N]" -ForegroundColor Yellow
$doUninstall = Read-Host
if ($doUninstall -match '^[Yy]') {

    # تسجيل حالة ما قبل الحذف
    $dbCountBefore = $null
    if ($psqlPath) {
        $env:PGPASSWORD = $DbPassword
        $dbCountBefore = & $psqlPath -h localhost -U postgres -d onesoft_erp -tAc "SELECT COUNT(*) FROM users" 2>&1
        Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
    }

    Screenshot "before-uninstall"

    # تشغيل Uninstaller
    $uninstaller = Get-ChildItem "$InstallDir" -Filter "Uninstall*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $uninstaller) {
        $uninstaller = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OneSoftERP" -ErrorAction SilentlyContinue
        if ($uninstaller) {
            $uninstExe = $uninstaller.UninstallString
        }
    }

    if ($uninstaller -or $uninstExe) {
        Write-Host "  ► تشغيل Uninstaller..." -ForegroundColor Yellow
        if ($uninstaller.FullName) { Start-Process $uninstaller.FullName }
        elseif ($uninstExe)        { Start-Process $uninstExe }
        Write-Host "  انتظر حتى انتهاء الإزالة، ثم اضغط Enter..."
        Read-Host
    } else {
        Log-Warn "لم يُعثر على Uninstaller — يمكن تشغيله من: $InstallDir\Uninstall OneSoft ERP.exe"
        Write-Host "  شغّل Uninstaller يدوياً، ثم اضغط Enter..."
        Read-Host
    }

    Screenshot "after-uninstall"

    # التحقق من الإزالة
    foreach ($svc in $services) {
        $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($null -eq $s) { Log-Pass "خدمة $svc أُزيلت" }
        else               { Log-Fail "خدمة $svc لا تزال موجودة: $($s.Status)" }
    }

    if (-not (Test-Path "$InstallDir\server-app")) { Log-Pass "ملفات التثبيت أُزيلت" }
    else                                              { Log-Warn "بعض ملفات التثبيت لا تزال موجودة" }

    if (-not (Test-Path $regPath)) { Log-Pass "سجل Registry أُزيل" }
    else                            { Log-Warn "سجل Registry لا يزال موجوداً" }

    Write-Host "  هل سألك Uninstaller عن الاحتفاظ بقاعدة البيانات؟ [Y/N]"
    $dbQuestion = Read-Host
    if ($dbQuestion -match '^[Yy]') { Log-Pass "Uninstaller سأل عن قاعدة البيانات" }
    else                              { Log-Warn "Uninstaller لم يسأل عن قاعدة البيانات" }

} else {
    Log-Warn "تم تخطي اختبار الإزالة"
}

# ════════════════════════════════════════════════════════════════════════════
# T12 — اختبار الترقية (Upgrade) — اختياري
# ════════════════════════════════════════════════════════════════════════════
Log-Step "T12 — اختبار الترقية (Upgrade) [اختياري]"
Write-Host "  هل تريد اختبار الترقية من نسخة قديمة؟ [Y/N]"
$doUpgrade = Read-Host
if ($doUpgrade -match '^[Yy]') {
    Write-Host "  ► ثبّت النسخة القديمة أولاً، ثم شغّل الـ Installer الجديد"
    Write-Host "  الخطوات:"
    Write-Host "    1. ثبّت النسخة القديمة"
    Write-Host "    2. شغّل OneSoft وأضف بيانات تجريبية"
    Write-Host "    3. شغّل Setup.exe للنسخة الجديدة"
    Write-Host "    4. راقب شاشة Upgrade Wizard"
    Write-Host "  اضغط Enter بعد اكتمال الترقية..."
    Read-Host

    Screenshot "after-upgrade"

    Write-Host "  هل ظهرت شاشة Upgrade Wizard؟ [Y/N]"
    $wizardOk = Read-Host
    if ($wizardOk -match '^[Yy]') { Log-Pass "Upgrade Wizard ظهر" }
    else                            { Log-Fail "Upgrade Wizard لم يظهر" }

    Write-Host "  هل أُخذت نسخة احتياطية تلقائياً؟ [Y/N]"
    $backupOk = Read-Host
    if ($backupOk -match '^[Yy]') { Log-Pass "النسخة الاحتياطية أُخذت" }
    else                            { Log-Fail "النسخة الاحتياطية لم تُؤخذ" }

    Write-Host "  هل البيانات التجريبية لا تزال موجودة بعد الترقية؟ [Y/N]"
    $dataOk = Read-Host
    if ($dataOk -match '^[Yy]') { Log-Pass "البيانات محفوظة بعد الترقية" }
    else                          { Log-Fail "فُقدت بيانات بعد الترقية ❗" }
} else {
    Log-Warn "تم تخطي اختبار الترقية"
}

# ════════════════════════════════════════════════════════════════════════════
# تقرير نهائي
# ════════════════════════════════════════════════════════════════════════════
$elapsed = (Get-Date) - $Script:StartTime
$total = $Script:PassCount + $Script:FailCount

Log-Step "النتيجة النهائية"
$Script:Log.Add("")
$Script:Log.Add("═"*60)
$Script:Log.Add("النتيجة النهائية")
$Script:Log.Add("═"*60)
$Script:Log.Add("اجتاز  : $($Script:PassCount) / $total")
$Script:Log.Add("فشل    : $($Script:FailCount) / $total")
$Script:Log.Add("تحذيرات: $($Script:WarnCount)")
$Script:Log.Add("الوقت  : $([math]::Round($elapsed.TotalMinutes,1)) دقيقة")

$verdict = if ($Script:FailCount -eq 0) { "✅ ناجح" } else { "❌ يوجد إخفاقات" }
$Script:Log.Add("الحكم  : $verdict")

Write-Host ""
Write-Host "══════════════════════════════════════" -ForegroundColor $(if ($Script:FailCount -eq 0) { 'Green' } else { 'Red' })
Write-Host "اجتاز  : $($Script:PassCount) / $total" -ForegroundColor Green
Write-Host "فشل    : $($Script:FailCount) / $total" -ForegroundColor $(if ($Script:FailCount -gt 0) { 'Red' } else { 'Green' })
Write-Host "تحذيرات: $($Script:WarnCount)" -ForegroundColor Yellow
Write-Host "الوقت  : $([math]::Round($elapsed.TotalMinutes,1)) دقيقة"
Write-Host "الحكم  : $verdict" -ForegroundColor $(if ($Script:FailCount -eq 0) { 'Green' } else { 'Red' })
Write-Host "══════════════════════════════════════" -ForegroundColor $(if ($Script:FailCount -eq 0) { 'Green' } else { 'Red' })

# حفظ التقرير
$reportFile = "$ReportDir\E2E-Report-$(Get-Date -Format 'yyyyMMdd-HHmm').txt"
$Script:Log | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host ""
Write-Host "  📄 التقرير محفوظ في: $reportFile" -ForegroundColor Cyan
Write-Host "  📸 لقطات الشاشة في : $ReportDir\screenshots\" -ForegroundColor Cyan

# فتح مجلد التقرير
Start-Process "explorer.exe" $ReportDir
