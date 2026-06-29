@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title OneSoft ERP — المثبّت

:: ════════════════════════════════════════════════════════
::  OneSoft ERP — Install Script
::  يدعم: Windows 10 / 11 (64-bit)
::  شغّل كمسؤول: Right-click → Run as administrator
:: ════════════════════════════════════════════════════════

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║          OneSoft ERP — المثبّت                   ║
echo  ║          OneSoft ERP — Installer                 ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: ── جذر البرنامج (مجلد فوق deploy-windows) ──────────────
set "ROOT=%~dp0.."
cd /d "%ROOT%"

:: ── مجلد الإعدادات ────────────────────────────────────────
set "CFG_DIR=%APPDATA%\OneSoftERP"
set "CFG_FILE=%CFG_DIR%\config.json"
set "LOG_DIR=%CFG_DIR%\logs"
set "DESKTOP=%USERPROFILE%\Desktop"

echo  [1/8] فحص صلاحيات المسؤول ...
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [خطأ] يجب تشغيل هذا الملف كمسؤول.
    echo  [Error] Please right-click and select "Run as administrator".
    echo.
    pause
    exit /b 1
)
echo  [OK] صلاحيات المسؤول متوفرة.
echo.

:: ════════════════════════════════════════════════════════
echo  [2/8] فحص Node.js ...
:: ════════════════════════════════════════════════════════
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [خطأ] Node.js غير مثبت.
    echo  [Error] Node.js is not installed.
    echo.
    echo  ▶ حمّل Node.js LTS من:
    echo    https://nodejs.org/en/download
    echo.
    echo  بعد التثبيت، أعد تشغيل هذا الملف.
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%V in ('node --version 2^>nul') do set "NODE_MAJOR=%%V"
for /f "tokens=2 delims=v." %%V in ('node --version 2^>nul') do set "NODE_MINOR=%%V"
echo  [OK] Node.js موجود: & node --version

if !NODE_MAJOR! LSS 18 (
    echo.
    echo  [خطأ] يلزم Node.js 18 أو أحدث. الإصدار الحالي: !NODE_MAJOR!
    echo  [Error] Node.js 18+ required. Current: !NODE_MAJOR!
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)
echo.

:: ════════════════════════════════════════════════════════
echo  [3/8] فحص PostgreSQL ...
:: ════════════════════════════════════════════════════════
where psql >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [خطأ] PostgreSQL غير مثبت أو غير موجود في PATH.
    echo  [Error] PostgreSQL not found in PATH.
    echo.
    echo  ▶ حمّل PostgreSQL من:
    echo    https://www.postgresql.org/download/windows
    echo.
    echo  بعد التثبيت أضف هذا المسار لـ PATH:
    echo    C:\Program Files\PostgreSQL\16\bin
    echo.
    start https://www.postgresql.org/download/windows
    pause
    exit /b 1
)
echo  [OK] PostgreSQL موجود: & psql --version
echo.

:: ════════════════════════════════════════════════════════
echo  [4/8] فحص pnpm ...
:: ════════════════════════════════════════════════════════
where pnpm >nul 2>&1
if errorlevel 1 (
    echo  [INFO] pnpm غير موجود. جارٍ التثبيت...
    call npm install -g pnpm
    if errorlevel 1 (
        echo  [خطأ] فشل تثبيت pnpm.
        pause
        exit /b 1
    )
)
echo  [OK] pnpm موجود: & pnpm --version
echo.

:: ════════════════════════════════════════════════════════
echo  [5/8] تثبيت حزم البرنامج ...
echo  (قد يستغرق هذا 3-5 دقائق)
:: ════════════════════════════════════════════════════════
echo.
call pnpm install --frozen-lockfile 2>nul
if errorlevel 1 (
    echo  [INFO] محاولة بدون frozen-lockfile...
    call pnpm install
    if errorlevel 1 (
        echo  [خطأ] فشل تثبيت الحزم.
        pause
        exit /b 1
    )
)
echo  [OK] تم تثبيت الحزم.
echo.

:: ════════════════════════════════════════════════════════
echo  [6/8] بناء Backend و Frontend ...
:: ════════════════════════════════════════════════════════
echo.
echo  ▶ بناء Backend...
cd /d "%ROOT%\server-app"
call pnpm run build
if errorlevel 1 (
    echo  [خطأ] فشل بناء Backend.
    pause
    exit /b 1
)
echo  [OK] Backend جاهز.
echo.

echo  ▶ بناء Frontend...
cd /d "%ROOT%\client-app"
call pnpm run build
if errorlevel 1 (
    echo  [خطأ] فشل بناء Frontend.
    pause
    exit /b 1
)
echo  [OK] Frontend جاهز.
echo.
cd /d "%ROOT%"

:: ════════════════════════════════════════════════════════
echo  [7/8] إعداد قاعدة البيانات ...
:: ════════════════════════════════════════════════════════
echo.

:: إنشاء مجلد الإعدادات
if not exist "%CFG_DIR%" mkdir "%CFG_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: طلب بيانات قاعدة البيانات من المستخدم
echo  ═══════════════════════════════════════════════════
echo   إعداد قاعدة البيانات
echo   Database Setup
echo  ═══════════════════════════════════════════════════
echo.
echo  سيتم إنشاء قاعدة بيانات لـ OneSoft ERP.
echo.
set /p "PG_PASS=▶ أدخل كلمة مرور postgres (التي اخترتها عند تثبيت PostgreSQL): "
if "%PG_PASS%"=="" set "PG_PASS=postgres"

set /p "DB_PASS=▶ اختر كلمة مرور لمستخدم OneSoft (أو اضغط Enter للافتراضية): "
if "%DB_PASS%"=="" set "DB_PASS=OneSoft2024!"

set "PGPASSWORD=%PG_PASS%"

echo.
echo  ▶ إنشاء قاعدة البيانات onesoft_erp...
psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='onesoft_erp'" 2>nul | findstr /C:"1 row" >nul
if not errorlevel 1 (
    echo  [INFO] قاعدة البيانات موجودة مسبقاً.
) else (
    psql -U postgres -c "CREATE DATABASE onesoft_erp;" 2>>"%LOG_DIR%\install.log"
    echo  [OK] تم إنشاء قاعدة البيانات.
)

echo  ▶ إنشاء مستخدم onesoft_user...
psql -U postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='onesoft_user') THEN CREATE USER onesoft_user WITH PASSWORD '%DB_PASS%'; END IF; END $$;" 2>>"%LOG_DIR%\install.log"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE onesoft_erp TO onesoft_user;" 2>>"%LOG_DIR%\install.log"
psql -U postgres -c "ALTER DATABASE onesoft_erp OWNER TO onesoft_user;" 2>>"%LOG_DIR%\install.log"
echo  [OK] تم إعداد مستخدم قاعدة البيانات.

:: إنشاء JWT Secret عشوائي
set "JWT_SECRET="
for /f "delims=" %%A in ('powershell -Command "[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"') do set "JWT_SECRET=%%A"

:: كتابة config.json
echo  ▶ كتابة ملف الإعدادات...
(
echo {
echo   "port": 3000,
echo   "clientPort": 5000,
echo   "dbUrl": "postgresql://onesoft_user:%DB_PASS%@localhost:5432/onesoft_erp",
echo   "jwtSecret": "%JWT_SECRET%",
echo   "nodeEnv": "production"
echo }
) > "%CFG_FILE%"
echo  [OK] تم حفظ الإعدادات في: %CFG_FILE%
echo.

:: تشغيل Database Migrations
echo  ▶ إنشاء جداول قاعدة البيانات (Migrations)...
cd /d "%ROOT%\server-app"
set "DATABASE_URL=postgresql://onesoft_user:%DB_PASS%@localhost:5432/onesoft_erp"
call pnpm exec drizzle-kit push 2>>"%LOG_DIR%\install.log"
if errorlevel 1 (
    echo  [تحذير] قد يكون هناك خطأ في Migrations. راجع: %LOG_DIR%\install.log
) else (
    echo  [OK] تم إنشاء جداول قاعدة البيانات.
)
cd /d "%ROOT%"
echo.

:: ════════════════════════════════════════════════════════
echo  [8/8] إنشاء اختصارات سطح المكتب ...
:: ════════════════════════════════════════════════════════
echo.

:: اختصار التشغيل على سطح المكتب
set "START_BAT=%ROOT%\deploy-windows\start.bat"
set "SHORTCUT=%DESKTOP%\OneSoft ERP.lnk"

powershell -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT%'); " ^
  "$s.TargetPath = '%START_BAT%'; " ^
  "$s.WorkingDirectory = '%ROOT%'; " ^
  "$s.Description = 'OneSoft ERP - نظام المحاسبة والمخزون'; " ^
  "$s.Save()" 2>nul

if exist "%SHORTCUT%" (
    echo  [OK] تم إنشاء اختصار سطح المكتب: OneSoft ERP
) else (
    echo  [تحذير] لم يتم إنشاء الاختصار. يمكنك تشغيل: deploy-windows\start.bat
)
echo.

:: ════════════════════════════════════════════════════════
::  ملخص التثبيت
:: ════════════════════════════════════════════════════════
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║   ✓ اكتمل التثبيت بنجاح!                        ║
echo  ║   ✓ Installation Complete!                       ║
echo  ║                                                  ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║                                                  ║
echo  ║  لتشغيل البرنامج:                                ║
echo  ║  ▶ انقر نقراً مزدوجاً على "OneSoft ERP" في سطح   ║
echo  ║    المكتب                                        ║
echo  ║  ▶ أو شغّل: deploy-windows\start.bat             ║
echo  ║                                                  ║
echo  ║  عند أول تشغيل:                                  ║
echo  ║  ▶ سيفتح المتصفح تلقائياً                       ║
echo  ║  ▶ أكمل معالج الإعداد الأول                      ║
echo  ║                                                  ║
echo  ║  الإعدادات محفوظة في:                            ║
echo  ║  %APPDATA%\OneSoftERP\                           ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

set /p "START_NOW=▶ هل تريد تشغيل البرنامج الآن؟ (y/n): "
if /i "%START_NOW%"=="y" (
    start "" "%START_BAT%"
)

echo.
pause
endlocal
