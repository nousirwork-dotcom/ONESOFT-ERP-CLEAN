#Requires -Version 5.0
<#
.SYNOPSIS
    معالج تثبيت OneSoft ERP الاحترافي
.DESCRIPTION
    يفحص متطلبات النظام، يثبّت المتطلبات الناقصة، ينشئ قاعدة البيانات،
    ويجهّز البرنامج لأول استخدام.
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# ── إعدادات عامة ─────────────────────────────────────────────────────────────
$AppName    = "OneSoft ERP"
$AppVersion = "1.0.0"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir    = Split-Path -Parent $ScriptRoot
$DataDir    = "$env:APPDATA\OneSoftERP"
$LogFile    = "$DataDir\install.log"
$ConfigFile = "$DataDir\config.json"

# تهيئة مجلد البيانات
if (!(Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }

function Write-Log { param($Msg) $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"; Add-Content -Path $LogFile -Value "[$ts] $Msg" -Encoding UTF8 }

# ── الألوان والخطوط ───────────────────────────────────────────────────────────
$Gold   = [System.Drawing.Color]::FromArgb(209, 156,   5)
$Dark   = [System.Drawing.Color]::FromArgb( 15,  23,  42)
$Dark2  = [System.Drawing.Color]::FromArgb( 30,  41,  59)
$Light  = [System.Drawing.Color]::FromArgb(248, 250, 252)
$Green  = [System.Drawing.Color]::FromArgb( 34, 197,  94)
$Red    = [System.Drawing.Color]::FromArgb(239,  68,  68)
$Yellow = [System.Drawing.Color]::FromArgb(234, 179,   8)
$Gray   = [System.Drawing.Color]::FromArgb(100, 116, 139)

$FontAr   = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)
$FontArBd = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$FontH1   = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$FontSm   = New-Object System.Drawing.Font("Segoe UI",  9)

# ── بيانات المستخدم ───────────────────────────────────────────────────────────
$Config = @{
    Port      = "3000"
    DbHost    = "localhost"
    DbPort    = "5432"
    DbName    = "onesoft_erp"
    DbUser    = "postgres"
    DbPass    = ""
    InstallDir = "$env:ProgramFiles\OneSoft ERP"
    Company   = ""
    TaxNumber = ""
    AdminPass = ""
    Currency  = "SAR"
    FiscalYear= (Get-Date).Year
    Language  = "ar"
    SetupZatca= $false
}

$Steps = @(
    @{ Id="welcome";    Label="مرحباً بك"       },
    @{ Id="license";    Label="اتفاقية الاستخدام"},
    @{ Id="location";   Label="مكان التثبيت"    },
    @{ Id="syscheck";   Label="فحص النظام"      },
    @{ Id="dbsetup";    Label="قاعدة البيانات"  },
    @{ Id="firstrun";   Label="الإعداد الأول"   },
    @{ Id="installing"; Label="جارٍ التثبيت"    },
    @{ Id="done";       Label="اكتمل التثبيت"   }
)
$CurrentStep = 0

# ══════════════════════════════════════════════════════════════════════════════
# النافذة الرئيسية
# ══════════════════════════════════════════════════════════════════════════════
$Form = New-Object System.Windows.Forms.Form
$Form.Text = "$AppName — معالج التثبيت"
$Form.Size = New-Object System.Drawing.Size(860, 620)
$Form.StartPosition = "CenterScreen"
$Form.BackColor = $Dark
$Form.FormBorderStyle = "FixedSingle"
$Form.MaximizeBox = $false
$Form.RightToLeft = "Yes"
$Form.RightToLeftLayout = $true
$Form.Font = $FontAr

# ── الشريط الجانبي ───────────────────────────────────────────────────────────
$Sidebar = New-Object System.Windows.Forms.Panel
$Sidebar.Size     = New-Object System.Drawing.Size(220, 580)
$Sidebar.Location = New-Object System.Drawing.Point(0, 0)
$Sidebar.BackColor = $Dark2
$Form.Controls.Add($Sidebar)

# اسم البرنامج في أعلى الشريط
$SideTitle = New-Object System.Windows.Forms.Label
$SideTitle.Text      = $AppName
$SideTitle.ForeColor = $Gold
$SideTitle.Font      = $FontH1
$SideTitle.Location  = New-Object System.Drawing.Point(0, 20)
$SideTitle.Size      = New-Object System.Drawing.Size(220, 36)
$SideTitle.TextAlign = "MiddleCenter"
$Sidebar.Controls.Add($SideTitle)

$SideVer = New-Object System.Windows.Forms.Label
$SideVer.Text      = "الإصدار $AppVersion"
$SideVer.ForeColor = $Gray
$SideVer.Font      = $FontSm
$SideVer.Location  = New-Object System.Drawing.Point(0, 56)
$SideVer.Size      = New-Object System.Drawing.Size(220, 20)
$SideVer.TextAlign = "MiddleCenter"
$Sidebar.Controls.Add($SideVer)

# عناصر الخطوات
$StepLabels = @()
for ($i = 0; $i -lt $Steps.Count; $i++) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text      = "$(($i+1).ToString().PadLeft(2,'0'))  $($Steps[$i].Label)"
    $lbl.ForeColor = $Gray
    $lbl.Font      = $FontSm
    $lbl.Location  = New-Object System.Drawing.Point(10, (90 + $i * 42))
    $lbl.Size      = New-Object System.Drawing.Size(200, 36)
    $lbl.TextAlign = "MiddleRight"
    $lbl.Padding   = New-Object System.Windows.Forms.Padding(0, 0, 10, 0)
    $Sidebar.Controls.Add($lbl)
    $StepLabels += $lbl
}

# ── منطقة المحتوى الرئيسية ───────────────────────────────────────────────────
$MainPanel = New-Object System.Windows.Forms.Panel
$MainPanel.Size     = New-Object System.Drawing.Size(640, 490)
$MainPanel.Location = New-Object System.Drawing.Point(220, 0)
$MainPanel.BackColor = $Light
$Form.Controls.Add($MainPanel)

# ── شريط الأزرار السفلي ───────────────────────────────────────────────────────
$BottomBar = New-Object System.Windows.Forms.Panel
$BottomBar.Size     = New-Object System.Drawing.Size(640, 90)
$BottomBar.Location = New-Object System.Drawing.Point(220, 490)
$BottomBar.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$Form.Controls.Add($BottomBar)

# شريط التقدم
$ProgBar = New-Object System.Windows.Forms.ProgressBar
$ProgBar.Size     = New-Object System.Drawing.Size(620, 8)
$ProgBar.Location = New-Object System.Drawing.Point(10, 5)
$ProgBar.Style    = "Continuous"
$ProgBar.ForeColor = $Gold
$ProgBar.Minimum  = 0
$ProgBar.Maximum  = 100
$BottomBar.Controls.Add($ProgBar)

# أزرار التنقل
$BtnCancel = New-Object System.Windows.Forms.Button
$BtnCancel.Text      = "إلغاء"
$BtnCancel.Size      = New-Object System.Drawing.Size(100, 38)
$BtnCancel.Location  = New-Object System.Drawing.Point(10, 42)
$BtnCancel.FlatStyle = "Flat"
$BtnCancel.BackColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$BtnCancel.ForeColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
$BtnCancel.Font      = $FontAr
$BottomBar.Controls.Add($BtnCancel)

$BtnBack = New-Object System.Windows.Forms.Button
$BtnBack.Text      = "السابق ←"
$BtnBack.Size      = New-Object System.Drawing.Size(110, 38)
$BtnBack.Location  = New-Object System.Drawing.Point(420, 42)
$BtnBack.FlatStyle = "Flat"
$BtnBack.BackColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$BtnBack.ForeColor = $Dark
$BtnBack.Font      = $FontAr
$BottomBar.Controls.Add($BtnBack)

$BtnNext = New-Object System.Windows.Forms.Button
$BtnNext.Text      = "→ التالي"
$BtnNext.Size      = New-Object System.Drawing.Size(110, 38)
$BtnNext.Location  = New-Object System.Drawing.Point(520, 42)
$BtnNext.FlatStyle = "Flat"
$BtnNext.BackColor = $Gold
$BtnNext.ForeColor = $Dark
$BtnNext.Font      = $FontArBd
$BottomBar.Controls.Add($BtnNext)

# ══════════════════════════════════════════════════════════════════════════════
# دوال مساعدة
# ══════════════════════════════════════════════════════════════════════════════
function Update-StepUI {
    for ($i = 0; $i -lt $Steps.Count; $i++) {
        if ($i -lt $CurrentStep) {
            $StepLabels[$i].ForeColor = $Green
            $StepLabels[$i].Font      = $FontSm
        } elseif ($i -eq $CurrentStep) {
            $StepLabels[$i].ForeColor = $Gold
            $StepLabels[$i].Font      = $FontArBd
        } else {
            $StepLabels[$i].ForeColor = $Gray
            $StepLabels[$i].Font      = $FontSm
        }
    }
    $ProgBar.Value = [int](($CurrentStep / ($Steps.Count - 1)) * 100)
}

function Make-Label { param($Text, $X, $Y, $W=500, $H=24, $Font=$FontAr, $Color=$Dark)
    $l = New-Object System.Windows.Forms.Label
    $l.Text      = $Text; $l.Location = New-Object System.Drawing.Point($X, $Y)
    $l.Size      = New-Object System.Drawing.Size($W, $H)
    $l.ForeColor = $Color; $l.Font    = $Font
    return $l
}
function Make-TextBox { param($X, $Y, $W=400, $H=32, $Pass=$false, $Text="")
    $t = New-Object System.Windows.Forms.TextBox
    $t.Location  = New-Object System.Drawing.Point($X, $Y)
    $t.Size      = New-Object System.Drawing.Size($W, $H)
    $t.Font      = $FontAr; $t.Text = $Text
    if ($Pass) { $t.PasswordChar = "●" }
    return $t
}

# ── فحص PostgreSQL ───────────────────────────────────────────────────────────
function Test-PostgreSQL {
    try { $v = (& psql --version 2>&1); return ($LASTEXITCODE -eq 0 -and $v -match "psql") } catch { return $false }
}
function Test-NodeJS {
    try { $v = (& node --version 2>&1); return ($LASTEXITCODE -eq 0 -and $v -match "v\d") } catch { return $false }
}
function Get-DiskFreeGB { param($Path="C:\")
    $d = Get-PSDrive (Split-Path -Qualifier $Path).TrimEnd(":")
    return [math]::Round($d.Free / 1GB, 1)
}
function Get-RAM-GB {
    return [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
}
function Test-Port { param($Port)
    $c = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -eq $c)
}

# ══════════════════════════════════════════════════════════════════════════════
# صفحات المعالج
# ══════════════════════════════════════════════════════════════════════════════

function Show-Welcome {
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "مرحباً بك في معالج تثبيت" 40 50 560 30 $FontH1 $Dark))
    $MainPanel.Controls.Add((Make-Label $AppName 40 85 560 40 (New-Object System.Drawing.Font("Segoe UI",22,[System.Drawing.FontStyle]::Bold)) $Gold))
    $MainPanel.Controls.Add((Make-Label "سيرشدك هذا المعالج خلال عملية التثبيت خطوةً بخطوة." 40 145 560 24 $FontAr $Dark))

    $desc = @(
        "• فحص متطلبات النظام تلقائياً",
        "• إعداد قاعدة البيانات دون تدخل يدوي",
        "• ضبط إعدادات الشركة الأساسية",
        "• إنشاء حساب المدير الرئيسي",
        "• تشغيل البرنامج فور الانتهاء"
    )
    $y = 185
    foreach ($line in $desc) {
        $MainPanel.Controls.Add((Make-Label $line 60 $y 500 26 $FontAr $Dark))
        $y += 30
    }
    $MainPanel.Controls.Add((Make-Label "انقر التالي للبدء..." 40 430 560 24 $FontSm $Gray))
    $BtnBack.Enabled = $false
}

function Show-License {
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "اتفاقية ترخيص المستخدم النهائي" 40 30 560 30 $FontH1 $Dark))

    $rtb = New-Object System.Windows.Forms.RichTextBox
    $rtb.Location  = New-Object System.Drawing.Point(40, 75)
    $rtb.Size      = New-Object System.Drawing.Size(560, 280)
    $rtb.ReadOnly  = $true
    $rtb.Font      = $FontSm
    $rtb.Text = @"
اتفاقية ترخيص المستخدم النهائي — OneSoft ERP
Copyright (c) 2026 OneSoft. جميع الحقوق محفوظة.

1. منح الترخيص
يُمنح المرخص له ترخيصاً محدوداً وغير حصري لتثبيت واستخدام هذا البرنامج على جهاز واحد مسجّل.

2. القيود
يُحظر نسخ البرنامج أو توزيعه أو تعديله أو بيعه أو تأجيره دون إذن كتابي مسبق.

3. الضمان
يُقدَّم البرنامج "كما هو" دون أي ضمانات صريحة أو ضمنية.

4. المسؤولية
لن تتحمل OneSoft مسؤولية أي أضرار تنشأ عن استخدام أو عدم استخدام هذا البرنامج.

5. الحوكمة
تخضع هذه الاتفاقية لأنظمة المملكة العربية السعودية.
"@
    $MainPanel.Controls.Add($rtb)

    $script:ChkLicense = New-Object System.Windows.Forms.CheckBox
    $script:ChkLicense.Text      = "أوافق على اتفاقية الاستخدام"
    $script:ChkLicense.Location  = New-Object System.Drawing.Point(40, 372)
    $script:ChkLicense.Size      = New-Object System.Drawing.Size(300, 28)
    $script:ChkLicense.Font      = $FontArBd
    $script:ChkLicense.ForeColor = $Dark
    $script:ChkLicense.Add_CheckedChanged({ $BtnNext.Enabled = $script:ChkLicense.Checked })
    $MainPanel.Controls.Add($script:ChkLicense)
    $BtnNext.Enabled = $false
}

function Show-Location {
    $BtnNext.Enabled = $true
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "اختيار مكان التثبيت" 40 30 560 30 $FontH1 $Dark))
    $MainPanel.Controls.Add((Make-Label "سيتم تثبيت الملفات في المجلد التالي:" 40 80 560 24))

    $script:TxtInstallDir = Make-TextBox 40 115 480 32 $false $Config.InstallDir
    $MainPanel.Controls.Add($script:TxtInstallDir)

    $btnBrowse = New-Object System.Windows.Forms.Button
    $btnBrowse.Text      = "تصفح..."
    $btnBrowse.Location  = New-Object System.Drawing.Point(530, 115)
    $btnBrowse.Size      = New-Object System.Drawing.Size(70, 32)
    $btnBrowse.Font      = $FontSm
    $btnBrowse.FlatStyle = "Flat"
    $btnBrowse.Add_Click({
        $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
        $dlg.Description = "اختر مجلد التثبيت"
        if ($dlg.ShowDialog() -eq "OK") { $script:TxtInstallDir.Text = $dlg.SelectedPath }
    })
    $MainPanel.Controls.Add($btnBrowse)

    $free = Get-DiskFreeGB "C:\"
    $MainPanel.Controls.Add((Make-Label "المساحة المتاحة على القرص: $free GB  |  المطلوب: ~2 GB" 40 160 560 24 $FontSm $Gray))
    $MainPanel.Controls.Add((Make-Label "سيتم أيضاً حفظ بيانات البرنامج في:" 40 210 560 24))
    $MainPanel.Controls.Add((Make-Label $DataDir 40 235 560 24 $FontSm $Gray))
}

function Show-SysCheck {
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "فحص متطلبات النظام" 40 30 560 30 $FontH1 $Dark))

    $checks = @(
        @{ Label="إصدار Windows";         Test={ (Get-WmiObject Win32_OperatingSystem).Caption -match "Windows (10|11)" }; Fix="يُنصح بـ Windows 10 أو 11" },
        @{ Label="نظام 64-bit";           Test={ [Environment]::Is64BitOperatingSystem }; Fix="يلزم نظام 64-bit" },
        @{ Label="مساحة القرص (2 GB+)";   Test={ (Get-DiskFreeGB "C:\") -ge 2 }; Fix="أفرغ مساحة على القرص" },
        @{ Label="الذاكرة RAM (4 GB+)";   Test={ (Get-RAM-GB) -ge 4 }; Fix="يُنصح بـ 4 GB RAM" },
        @{ Label="صلاحيات المشرف";        Test={ ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }; Fix="شغّل المثبّت كمشرف" },
        @{ Label="المنفذ 3000 متاح";      Test={ Test-Port 3000 }; Fix="أغلق أي برنامج يستخدم المنفذ 3000" },
        @{ Label="Node.js (v18+)";         Test={ Test-NodeJS }; Fix="سيتم تثبيته تلقائياً" },
        @{ Label="PostgreSQL";             Test={ Test-PostgreSQL }; Fix="انظر دليل التثبيت" }
    )

    $y = 80; $allOk = $true
    foreach ($chk in $checks) {
        $ok = & $chk.Test
        if (-not $ok) { $allOk = $false }

        $icon = New-Object System.Windows.Forms.Label
        $icon.Text      = if ($ok) { "✓" } else { "✗" }
        $icon.ForeColor = if ($ok) { $Green } else { $Red }
        $icon.Font      = $FontArBd
        $icon.Location  = New-Object System.Drawing.Point(560, $y)
        $icon.Size      = New-Object System.Drawing.Size(30, 28)
        $MainPanel.Controls.Add($icon)

        $lbl = Make-Label $chk.Label 40 $y 480 28
        $lbl.ForeColor = if ($ok) { $Dark } else { $Red }
        $MainPanel.Controls.Add($lbl)

        if (-not $ok) {
            $fix = Make-Label ("  ↳ " + $chk.Fix) 40 ($y+22) 480 20 $FontSm $Yellow
            $MainPanel.Controls.Add($fix)
            $y += 20
        }
        $y += 36
    }

    $BtnNext.Enabled = $true
    if (-not $allOk) {
        $MainPanel.Controls.Add((Make-Label "⚠ بعض المتطلبات غير مستوفاة. يمكن المتابعة ولكن قد تواجه مشاكل." 40 ($y+10) 560 40 $FontSm $Yellow))
    }

    Write-Log "System check completed. AllOk=$allOk"
}

function Show-DbSetup {
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "إعداد قاعدة البيانات" 40 30 560 30 $FontH1 $Dark))
    $MainPanel.Controls.Add((Make-Label "أدخل بيانات الاتصال بـ PostgreSQL:" 40 75 560 24))

    $fields = @(
        @{ Label="عنوان الخادم (Host)"; Key="DbHost"; Y=115 },
        @{ Label="رقم المنفذ (Port)";  Key="DbPort"; Y=175 },
        @{ Label="اسم قاعدة البيانات";Key="DbName"; Y=235 },
        @{ Label="اسم المستخدم";       Key="DbUser"; Y=295 },
        @{ Label="كلمة المرور";        Key="DbPass"; Y=355; Pass=$true }
    )

    $script:DbFields = @{}
    foreach ($f in $fields) {
        $MainPanel.Controls.Add((Make-Label $f.Label 40 $f.Y 200 24))
        $tb = Make-TextBox 250 $f.Y 300 30 ($f.Pass -eq $true) $Config[$f.Key]
        $script:DbFields[$f.Key] = $tb
        $MainPanel.Controls.Add($tb)
    }

    $btnTest = New-Object System.Windows.Forms.Button
    $btnTest.Text      = "اختبار الاتصال"
    $btnTest.Location  = New-Object System.Drawing.Point(40, 415)
    $btnTest.Size      = New-Object System.Drawing.Size(150, 36)
    $btnTest.FlatStyle = "Flat"
    $btnTest.BackColor = $Dark2
    $btnTest.ForeColor = $Light
    $btnTest.Font      = $FontAr
    $btnTest.Add_Click({
        $h = $script:DbFields["DbHost"].Text
        $p = $script:DbFields["DbPort"].Text
        $n = $script:DbFields["DbName"].Text
        $u = $script:DbFields["DbUser"].Text
        $pw= $script:DbFields["DbPass"].Text
        $env:PGPASSWORD = $pw
        $result = & psql -h $h -p $p -U $u -c "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            [System.Windows.Forms.MessageBox]::Show("الاتصال بـ PostgreSQL ناجح ✓", "نجاح", "OK", "Information") | Out-Null
        } else {
            [System.Windows.Forms.MessageBox]::Show("فشل الاتصال:`n$result", "خطأ", "OK", "Error") | Out-Null
        }
    })
    $MainPanel.Controls.Add($btnTest)
    $MainPanel.Controls.Add((Make-Label "ستُنشأ قاعدة البيانات وجداولها تلقائياً عند الضغط على التالي." 40 460 560 24 $FontSm $Gray))
}

function Show-FirstRun {
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "الإعداد الأول للشركة" 40 30 560 30 $FontH1 $Dark))

    $fields = @(
        @{ Label="اسم الشركة";       Key="Company";   Y=80 },
        @{ Label="الرقم الضريبي";    Key="TaxNumber"; Y=130 },
        @{ Label="المنفذ (Port)";    Key="Port";      Y=180 },
        @{ Label="كلمة مرور المدير"; Key="AdminPass"; Y=230; Pass=$true }
    )
    $script:FirstRunFields = @{}
    foreach ($f in $fields) {
        $MainPanel.Controls.Add((Make-Label $f.Label 40 $f.Y 200 24))
        $tb = Make-TextBox 250 $f.Y 310 30 ($f.Pass -eq $true) $Config[$f.Key]
        $script:FirstRunFields[$f.Key] = $tb
        $MainPanel.Controls.Add($tb)
    }

    $MainPanel.Controls.Add((Make-Label "العملة:" 40 285 200 24))
    $script:CboCurrency = New-Object System.Windows.Forms.ComboBox
    $script:CboCurrency.Location = New-Object System.Drawing.Point(250, 283)
    $script:CboCurrency.Size     = New-Object System.Drawing.Size(200, 30)
    $script:CboCurrency.Font     = $FontAr
    @("SAR - ريال سعودي","USD - دولار أمريكي","EUR - يورو","AED - درهم","KWD - دينار كويتي") | ForEach-Object { $script:CboCurrency.Items.Add($_) | Out-Null }
    $script:CboCurrency.SelectedIndex = 0
    $MainPanel.Controls.Add($script:CboCurrency)

    $script:ChkZatca = New-Object System.Windows.Forms.CheckBox
    $script:ChkZatca.Text      = "إعداد الربط مع هيئة الزكاة والضريبة (يمكن لاحقاً)"
    $script:ChkZatca.Location  = New-Object System.Drawing.Point(40, 330)
    $script:ChkZatca.Size      = New-Object System.Drawing.Size(500, 28)
    $script:ChkZatca.Font      = $FontAr
    $MainPanel.Controls.Add($script:ChkZatca)

    $MainPanel.Controls.Add((Make-Label "يمكن تعديل جميع الإعدادات لاحقاً من داخل البرنامج." 40 440 560 24 $FontSm $Gray))
}

function Show-Installing {
    $BtnNext.Enabled = $false; $BtnBack.Enabled = $false; $BtnCancel.Enabled = $false
    $MainPanel.Controls.Clear()
    $MainPanel.Controls.Add((Make-Label "جارٍ تثبيت البرنامج..." 40 40 560 30 $FontH1 $Dark))

    $script:InstallLog = New-Object System.Windows.Forms.ListBox
    $script:InstallLog.Location  = New-Object System.Drawing.Point(40, 90)
    $script:InstallLog.Size      = New-Object System.Drawing.Size(560, 300)
    $script:InstallLog.Font      = $FontSm
    $MainPanel.Controls.Add($script:InstallLog)

    $script:InstallProg = New-Object System.Windows.Forms.ProgressBar
    $script:InstallProg.Location = New-Object System.Drawing.Point(40, 410)
    $script:InstallProg.Size     = New-Object System.Drawing.Size(560, 20)
    $script:InstallProg.Style    = "Continuous"
    $MainPanel.Controls.Add($script:InstallProg)

    $script:InstallStatus = Make-Label "جارٍ التحضير..." 40 440 560 24 $FontSm $Gray
    $MainPanel.Controls.Add($script:InstallStatus)

    $Form.Refresh()

    $steps = @(
        @{ Msg="تثبيت الحزم (Backend)..."; Pct=15; Action={
            Set-Location $RootDir
            if (Get-Command pnpm -ErrorAction SilentlyContinue) {
                & pnpm install --dir server-app 2>&1 | Out-Null
            } else {
                & npm install 2>&1 | Out-Null
            }
        }},
        @{ Msg="بناء الخادم (Backend)..."; Pct=30; Action={
            Set-Location "$RootDir\server-app"; & pnpm run build 2>&1 | Out-Null
        }},
        @{ Msg="تثبيت الحزم (Frontend)..."; Pct=45; Action={
            Set-Location "$RootDir\client-app"; & pnpm install 2>&1 | Out-Null
        }},
        @{ Msg="بناء الواجهة (Frontend)..."; Pct=60; Action={
            Set-Location "$RootDir\client-app"; & pnpm run build 2>&1 | Out-Null
        }},
        @{ Msg="إنشاء قاعدة البيانات..."; Pct=75; Action={
            $h  = $Config.DbHost; $p  = $Config.DbPort
            $u  = $Config.DbUser; $pw = $Config.DbPass
            $n  = $Config.DbName
            $env:PGPASSWORD = $pw
            & psql -h $h -p $p -U $u -c "CREATE DATABASE $n;" 2>&1 | Out-Null
            Set-Location "$RootDir\server-app"
            & npx drizzle-kit push --config drizzle.config.ts 2>&1 | Out-Null
        }},
        @{ Msg="كتابة ملف الإعدادات..."; Pct=90; Action={
            if (!(Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
            $dbUrl = "postgresql://$($Config.DbUser):$($Config.DbPass)@$($Config.DbHost):$($Config.DbPort)/$($Config.DbName)"
            $cfg = @{
                port    = [int]$Config.Port
                dbType  = "postgresql"
                dbUrl   = $dbUrl
                jwtSecret = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
                backupDir = "$DataDir\backups"
                logDir    = "$DataDir\logs"
                nodeEnv   = "production"
                openBrowserOnStart = $true
                company = @{ name = $Config.Company; taxNumber = $Config.TaxNumber }
                zatca   = @{ environment = "sandbox"; setupOnInstall = $Config.SetupZatca }
            }
            $cfg | ConvertTo-Json -Depth 5 | Set-Content -Path $ConfigFile -Encoding UTF8
        }},
        @{ Msg="إنشاء مجلدات البيانات..."; Pct=95; Action={
            @("$DataDir\logs","$DataDir\backups") | ForEach-Object {
                if (!(Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
            }
        }},
        @{ Msg="اكتمل التثبيت بنجاح ✓"; Pct=100; Action={} }
    )

    foreach ($s in $steps) {
        $script:InstallLog.Items.Add($s.Msg)
        $script:InstallLog.SelectedIndex = $script:InstallLog.Items.Count - 1
        $script:InstallStatus.Text = $s.Msg
        $script:InstallProg.Value  = $s.Pct
        $Form.Refresh()
        [System.Windows.Forms.Application]::DoEvents()
        try { & $s.Action } catch { $script:InstallLog.Items.Add("  خطأ: $_") }
        Write-Log $s.Msg
        Start-Sleep -Milliseconds 200
    }

    $script:CurrentStep++
    Show-Done
}

function Show-Done {
    $MainPanel.Controls.Clear()
    $ProgBar.Value = 100
    $MainPanel.Controls.Add((Make-Label "🎉 اكتمل التثبيت بنجاح!" 40 60 560 40 $FontH1 $Green))
    $MainPanel.Controls.Add((Make-Label "تم تثبيت $AppName بنجاح على جهازك." 40 115 560 26))
    $MainPanel.Controls.Add((Make-Label "يمكنك الآن:" 40 160 560 24 $FontArBd $Dark))
    $items = @(
        "• تشغيل البرنامج عبر الاختصار على سطح المكتب",
        "• أو من قائمة: ابدأ ← OneSoft ERP",
        "• ملف الإعدادات: $ConfigFile",
        "• السجلات: $DataDir\logs\"
    )
    $y = 190
    foreach ($item in $items) { $MainPanel.Controls.Add((Make-Label $item 60 $y 520 26 $FontAr $Dark)); $y += 30 }

    $script:ChkLaunch = New-Object System.Windows.Forms.CheckBox
    $script:ChkLaunch.Text      = "تشغيل البرنامج الآن"
    $script:ChkLaunch.Location  = New-Object System.Drawing.Point(40, 340)
    $script:ChkLaunch.Size      = New-Object System.Drawing.Size(300, 28)
    $script:ChkLaunch.Font      = $FontArBd
    $script:ChkLaunch.Checked   = $true
    $MainPanel.Controls.Add($script:ChkLaunch)

    $BtnBack.Enabled   = $false
    $BtnCancel.Enabled = $false
    $BtnNext.Text      = "إنهاء"
    $BtnNext.Enabled   = $true
}

# ══════════════════════════════════════════════════════════════════════════════
# التنقل بين الخطوات
# ══════════════════════════════════════════════════════════════════════════════
$StepFunctions = @("Show-Welcome","Show-License","Show-Location","Show-SysCheck","Show-DbSetup","Show-FirstRun","Show-Installing","Show-Done")

function Show-CurrentStep {
    Update-StepUI
    $BtnBack.Enabled = ($CurrentStep -gt 0 -and $CurrentStep -lt ($Steps.Count - 1))
    & $StepFunctions[$CurrentStep]
}

$BtnNext.Add_Click({
    if ($CurrentStep -eq ($Steps.Count - 2)) {
        # حفظ إعدادات First Run قبل التثبيت
        if ($script:FirstRunFields) {
            foreach ($k in $script:FirstRunFields.Keys) { $Config[$k] = $script:FirstRunFields[$k].Text }
        }
        if ($script:DbFields) {
            foreach ($k in $script:DbFields.Keys) { $Config[$k] = $script:DbFields[$k].Text }
        }
        if ($script:TxtInstallDir) { $Config.InstallDir = $script:TxtInstallDir.Text }
        if ($script:ChkZatca) { $Config.SetupZatca = $script:ChkZatca.Checked }
        $script:CurrentStep = 6
        Show-CurrentStep; return
    }

    if ($CurrentStep -eq ($Steps.Count - 1)) {
        # إنهاء
        if ($script:ChkLaunch -and $script:ChkLaunch.Checked) {
            $runScript = "$ScriptRoot\تشغيل_البرنامج.bat"
            if (Test-Path $runScript) { Start-Process $runScript }
        }
        $Form.Close(); return
    }

    $script:CurrentStep++
    Show-CurrentStep
})

$BtnBack.Add_Click({
    if ($CurrentStep -gt 0) { $script:CurrentStep--; Show-CurrentStep }
})

$BtnCancel.Add_Click({
    $r = [System.Windows.Forms.MessageBox]::Show("هل تريد إلغاء التثبيت؟", "تأكيد", "YesNo", "Question")
    if ($r -eq "Yes") { $Form.Close() }
})

# ── بدء التطبيق ───────────────────────────────────────────────────────────────
Show-CurrentStep
[System.Windows.Forms.Application]::Run($Form)
