@echo off
chcp 65001 >nul
title OneSoft ERP
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║          OneSoft ERP — جارٍ التشغيل      ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0.."

REM ── قراءة رقم المنفذ من الإعدادات ──
set PORT=3000
set CONFIG_FILE=%APPDATA%\OneSoftERP\config.json
if not exist "%CONFIG_FILE%" (
  echo [تحذير] ملف الإعدادات غير موجود. استخدام المنفذ الافتراضي: 3000
) else (
  for /f "tokens=2 delims=:, " %%P in ('findstr /C:"\"port\"" "%CONFIG_FILE%"') do set PORT=%%P
)
set SERVER_URL=http://localhost:%PORT%

REM ── التحقق إن كان الخادم يعمل بالفعل ──
curl -s -o nul -w "%%{http_code}" %SERVER_URL%/api/health 2>nul | findstr "200" >nul
if not errorlevel 1 (
  echo.
  echo  البرنامج يعمل بالفعل على %SERVER_URL%
  echo  جارٍ فتح المتصفح...
  goto :open_browser
)

REM ── تطبيق الإعدادات من ملف config.json ──
if exist "%CONFIG_FILE%" (
  for /f "usebackq tokens=2 delims=:, " %%U in (`findstr /C:"\"dbUrl\"" "%CONFIG_FILE%"`) do set DATABASE_URL=%%~U
)

REM ── مجلدات السجلات والنسخ ──
set LOG_DIR=%APPDATA%\OneSoftERP\logs
set BACKUP_DIR=%APPDATA%\OneSoftERP\backups
if not exist "%LOG_DIR%"    mkdir "%LOG_DIR%"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM ── تشغيل الخادم في الخلفية ──
echo جارٍ تشغيل الخادم على المنفذ %PORT%...
set LOG_FILE=%LOG_DIR%\server-%date:~-4,4%%date:~-7,2%%date:~0,2%.log
start "" /B cmd /c "set PORT=%PORT% && set LOG_DIR=%LOG_DIR% && set BACKUP_DIR=%BACKUP_DIR% && node server-app\dist\index.mjs >> "%LOG_FILE%" 2>&1"

REM ── انتظار جاهزية الخادم (حتى 30 ثانية) ──
echo جارٍ الانتظار حتى يصبح الخادم جاهزاً...
set /a TRIES=0
:wait_loop
timeout /t 1 /nobreak >nul
set /a TRIES=%TRIES%+1
curl -s -o nul -w "%%{http_code}" %SERVER_URL%/api/health 2>nul | findstr "200" >nul
if not errorlevel 1 goto :server_ready
if %TRIES% GEQ 30 goto :timeout_error
goto :wait_loop

:server_ready
echo.
echo  الخادم جاهز على %SERVER_URL%

:open_browser
REM ── فتح البرنامج كتطبيق سطح مكتب بدون شريط المتصفح ──
where msedge >nul 2>&1 && (
  start "" "msedge" --app=%SERVER_URL% --new-window
  goto :end
)
where chrome >nul 2>&1 && (
  start "" "chrome" --app=%SERVER_URL% --new-window
  goto :end
)
REM fallback
start "" %SERVER_URL%

:end
echo.
echo  البرنامج يعمل على %SERVER_URL%
echo  السجلات في: %LOG_DIR%
echo  لإيقاف البرنامج: اضغط Ctrl+C او اغلق النافذة
echo.
pause >nul
goto :eof

:timeout_error
echo.
echo  [خطأ] لم يستجب الخادم خلال 30 ثانية.
echo  تحقق من: قاعدة البيانات، المنفذ %PORT%، ملف الإعدادات
echo  السجلات: %LOG_DIR%
echo.
pause
