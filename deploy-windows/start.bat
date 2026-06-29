@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title OneSoft ERP

:: ════════════════════════════════════════════════════════
::  OneSoft ERP — Start Script
::  يشغّل Backend + يفتح المتصفح تلقائياً
:: ════════════════════════════════════════════════════════

set "ROOT=%~dp0.."
set "CFG_DIR=%APPDATA%\OneSoftERP"
set "CFG_FILE=%CFG_DIR%\config.json"
set "LOG_DIR=%CFG_DIR%\logs"
set "SERVER_PORT=3000"
set "CLIENT_PORT=5000"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║          OneSoft ERP — جارٍ التشغيل              ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" 2>nul

:: ── قراءة المنفذ من config.json ──────────────────────────
if exist "%CFG_FILE%" (
    for /f "tokens=2 delims=:, " %%P in ('findstr /C:"\"port\"" "%CFG_FILE%"') do (
        set "SERVER_PORT=%%P"
        set "SERVER_PORT=!SERVER_PORT: =!"
    )
)

:: ── التحقق من Node.js ─────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo  [خطأ] Node.js غير موجود. شغّل install.bat أولاً.
    pause
    exit /b 1
)

:: ── التحقق من وجود ملف البرنامج ──────────────────────────
if not exist "%ROOT%\server-app\dist\index.mjs" (
    echo  [خطأ] البرنامج لم يُبنَ بعد.
    echo  [Error] Application not built yet.
    echo.
    echo  ▶ شغّل install.bat أولاً لإكمال التثبيت.
    echo  ▶ Run install.bat first to complete setup.
    echo.
    pause
    exit /b 1
)

:: ── التحقق من config.json ────────────────────────────────
if not exist "%CFG_FILE%" (
    echo  [تحذير] ملف الإعدادات غير موجود: %CFG_FILE%
    echo  [Warning] Config file not found. Using defaults.
    echo.
    if not exist "%CFG_DIR%" mkdir "%CFG_DIR%"
    (
    echo {
    echo   "port": 3000,
    echo   "clientPort": 5000,
    echo   "dbUrl": "postgresql://postgres:postgres@localhost:5432/onesoft_erp",
    echo   "jwtSecret": "default-change-me-in-production",
    echo   "nodeEnv": "production"
    echo }
    ) > "%CFG_FILE%"
    echo  [INFO] تم إنشاء ملف إعدادات افتراضي. عدّله قبل الاستخدام الفعلي.
)

echo  ▶ الإعدادات: %CFG_FILE%
echo  ▶ المنفذ: %SERVER_PORT%
echo.

:: ── التحقق من أن المنفذ غير مشغول ───────────────────────
netstat -ano | findstr ":%SERVER_PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [تحذير] المنفذ %SERVER_PORT% مشغول بالفعل.
    echo  [Warning] Port %SERVER_PORT% already in use.
    echo  ربما البرنامج يعمل مسبقاً. افتح المتصفح على:
    echo  http://localhost:%CLIENT_PORT%
    echo.
    set /p "OPEN_BROWSER=▶ فتح المتصفح؟ (y/n): "
    if /i "!OPEN_BROWSER!"=="y" start http://localhost:%CLIENT_PORT%
    pause
    exit /b 0
)

:: ════════════════════════════════════════════════════════
::  تشغيل Backend في الخلفية
:: ════════════════════════════════════════════════════════
echo  ▶ تشغيل Backend Server...
cd /d "%ROOT%\server-app"

set "ONESOFT_CONFIG=%CFG_FILE%"
start "OneSoft Backend" /min cmd /c "node dist/index.mjs >> "%LOG_DIR%\server.log" 2>&1"

:: انتظر حتى يبدأ الـ server
echo  ▶ انتظار بدء الخادم...
set "WAITED=0"
:WAIT_SERVER
timeout /t 2 /nobreak >nul
set /a WAITED+=2
netstat -ano | findstr ":%SERVER_PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto SERVER_READY
if !WAITED! GEQ 30 (
    echo.
    echo  [خطأ] لم يبدأ الخادم خلال 30 ثانية.
    echo  [Error] Server did not start within 30 seconds.
    echo  راجع ملف السجل: %LOG_DIR%\server.log
    echo.
    type "%LOG_DIR%\server.log" 2>nul | findstr /i "error\|خطأ"
    pause
    exit /b 1
)
echo  . انتظر... (!WAITED! ثانية)
goto WAIT_SERVER

:SERVER_READY
echo  [OK] الخادم يعمل على المنفذ %SERVER_PORT%
echo.

:: ════════════════════════════════════════════════════════
::  تشغيل Frontend
:: ════════════════════════════════════════════════════════
cd /d "%ROOT%\client-app"

echo  ▶ تشغيل Frontend...
start "OneSoft Frontend" /min cmd /c "pnpm run preview --port %CLIENT_PORT% >> "%LOG_DIR%\client.log" 2>&1"

timeout /t 3 /nobreak >nul

:: ════════════════════════════════════════════════════════
::  فتح المتصفح
:: ════════════════════════════════════════════════════════
echo  ▶ فتح المتصفح...
start http://localhost:%CLIENT_PORT%

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║   ✓ OneSoft ERP يعمل الآن                        ║
echo  ║                                                  ║
echo  ║   الرابط: http://localhost:%CLIENT_PORT%              ║
echo  ║                                                  ║
echo  ║   لإيقاف البرنامج: اضغط Ctrl+C                  ║
echo  ║   أو أغلق هذه النافذة                           ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  السجلات محفوظة في: %LOG_DIR%
echo.

:: إبقاء النافذة مفتوحة وعرض السجل المباشر
cd /d "%ROOT%"
:KEEP_ALIVE
timeout /t 5 /nobreak >nul
netstat -ano | findstr ":%SERVER_PORT% " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [تحذير] توقف الخادم. راجع: %LOG_DIR%\server.log
    pause
    exit /b 1
)
goto KEEP_ALIVE

endlocal
