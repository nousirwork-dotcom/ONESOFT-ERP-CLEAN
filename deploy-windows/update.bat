@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title OneSoft ERP — تحديث البرنامج

:: ════════════════════════════════════════════════════════
::  OneSoft ERP — Update Script
::  يُحدّث البرنامج من GitHub ويُعيد بناءه
:: ════════════════════════════════════════════════════════

set "ROOT=%~dp0.."
set "CFG_DIR=%APPDATA%\OneSoftERP"
set "LOG_DIR=%CFG_DIR%\logs"
set "GITHUB_ZIP=https://github.com/nousirwork-dotcom/ONESOFT-ERP/archive/refs/heads/main.zip"
set "TMP_DIR=%TEMP%\onesoft-update"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║      OneSoft ERP — جارٍ التحديث                  ║
echo  ║      OneSoft ERP — Updating...                   ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  ▶ المشروع الحالي: %ROOT%
echo.

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" 2>nul

:: ────────────────────────────────────────────────────────
:: الطريقة 1: التحديث عبر Git (إذا كان Git مثبتاً)
:: ────────────────────────────────────────────────────────
where git >nul 2>&1
if not errorlevel 1 (
    echo  [INFO] Git موجود — تحديث عبر git pull...
    cd /d "%ROOT%"
    git pull origin main >> "%LOG_DIR%\update.log" 2>&1
    if not errorlevel 1 (
        echo  [OK] تم تحديث الكود بنجاح.
        goto BUILD
    ) else (
        echo  [تحذير] git pull فشل. سيتم التحديث عبر ZIP.
    )
)

:: ────────────────────────────────────────────────────────
:: الطريقة 2: تحميل ZIP من GitHub
:: ────────────────────────────────────────────────────────
echo  [INFO] تحميل آخر نسخة من GitHub...
echo  ▶ %GITHUB_ZIP%
echo.

if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

powershell -Command "Invoke-WebRequest -Uri '%GITHUB_ZIP%' -OutFile '%TMP_DIR%\update.zip' -UseBasicParsing" 2>>"%LOG_DIR%\update.log"
if errorlevel 1 (
    echo  [خطأ] فشل تحميل التحديث. تحقق من الاتصال بالإنترنت.
    pause & exit /b 1
)
echo  [OK] تم تحميل التحديث.

echo  ▶ فك ضغط الملفات...
powershell -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%\extracted' -Force" 2>>"%LOG_DIR%\update.log"

:: نسخ الملفات المحدّثة (الكود فقط، بدون الإعدادات)
echo  ▶ تطبيق التحديثات...
set "EXTRACTED=%TMP_DIR%\extracted\ONESOFT-ERP-main"

:: نسخ مجلدات المصدر
xcopy /s /y /q "%EXTRACTED%\client-app\src" "%ROOT%\client-app\src\" >> "%LOG_DIR%\update.log" 2>&1
xcopy /s /y /q "%EXTRACTED%\server-app\src" "%ROOT%\server-app\src\" >> "%LOG_DIR%\update.log" 2>&1
xcopy /s /y /q "%EXTRACTED%\server-app\drizzle" "%ROOT%\server-app\drizzle\" >> "%LOG_DIR%\update.log" 2>&1
xcopy /s /y /q "%EXTRACTED%\deploy-windows" "%ROOT%\deploy-windows\" >> "%LOG_DIR%\update.log" 2>&1
xcopy /s /y /q "%EXTRACTED%\electron" "%ROOT%\electron\" >> "%LOG_DIR%\update.log" 2>&1

:: نسخ ملفات package.json لتحديث المكتبات
copy /y "%EXTRACTED%\client-app\package.json" "%ROOT%\client-app\" >> "%LOG_DIR%\update.log" 2>&1
copy /y "%EXTRACTED%\server-app\package.json" "%ROOT%\server-app\" >> "%LOG_DIR%\update.log" 2>&1
copy /y "%EXTRACTED%\package.json" "%ROOT%\" >> "%LOG_DIR%\update.log" 2>&1

echo  [OK] تم تطبيق ملفات التحديث.

:: تنظيف الملفات المؤقتة
rmdir /s /q "%TMP_DIR%" 2>nul

:BUILD
:: ────────────────────────────────────────────────────────
:: إعادة البناء
:: ────────────────────────────────────────────────────────
echo.
echo  ▶ تثبيت الحزم الجديدة (إن وجدت)...
cd /d "%ROOT%"
call pnpm install 2>>"%LOG_DIR%\update.log"

echo.
echo  ▶ إعادة بناء Backend...
cd /d "%ROOT%\server-app"
call pnpm run build 2>>"%LOG_DIR%\update.log"
if errorlevel 1 (
    echo  [خطأ] فشل بناء Backend.
    pause & exit /b 1
)

echo  ▶ إعادة بناء Frontend...
cd /d "%ROOT%\client-app"
call pnpm run build 2>>"%LOG_DIR%\update.log"
if errorlevel 1 (
    echo  [خطأ] فشل بناء Frontend.
    pause & exit /b 1
)

:: تشغيل Migrations (للجداول الجديدة)
echo  ▶ تحديث قاعدة البيانات (Migrations)...
cd /d "%ROOT%\server-app"
call pnpm exec drizzle-kit push 2>>"%LOG_DIR%\update.log"

cd /d "%ROOT%"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║   ✓ تم التحديث بنجاح!                            ║
echo  ║   ✓ Update Complete!                             ║
echo  ║                                                  ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║                                                  ║
echo  ║  السجل: %APPDATA%\OneSoftERP\logs\update.log     ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

set /p "START_NOW=▶ هل تريد تشغيل البرنامج الآن؟ (y/n): "
if /i "%START_NOW%"=="y" (
    start "" "%~dp0start.bat"
)

pause
endlocal
