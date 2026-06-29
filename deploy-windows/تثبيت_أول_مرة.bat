@echo off
chcp 65001 >nul
title OneSoft ERP - التثبيت
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     OneSoft ERP - تثبيت أول مرة          ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0.."

REM ── التحقق من Node.js ──
where node >nul 2>&1 || (
  echo [خطأ] Node.js غير مثبت. نزّله من: https://nodejs.org
  pause & exit /b 1
)
for /f "delims=v." %%a in ('node --version') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
  echo [خطأ] يلزم Node.js 18 او احدث.
  node --version
  pause & exit /b 1
)

REM ── التحقق من pnpm ──
where pnpm >nul 2>&1 || (
  echo [تثبيت] جارٍ تثبيت pnpm...
  npm install -g pnpm
)

REM ── ملف الإعدادات ──
set CONFIG_DIR=%APPDATA%\OneSoftERP
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
if not exist "%CONFIG_DIR%\logs" mkdir "%CONFIG_DIR%\logs"
if not exist "%CONFIG_DIR%\backups" mkdir "%CONFIG_DIR%\backups"
if not exist "%CONFIG_DIR%\config.json" (
  echo [اعداد] نسخ ملف الإعدادات الافتراضي...
  copy "%~dp0config.json" "%CONFIG_DIR%\config.json" >nul
  echo.
  echo  [تنبيه] يرجى تحرير ملف الإعدادات قبل تشغيل البرنامج:
  echo  %CONFIG_DIR%\config.json
  echo  وتحديد: dbUrl (رابط قاعدة البيانات) و port (المنفذ)
  echo.
)

REM ── تثبيت حزم الـ Backend ──
echo [1/4] تثبيت حزم الـ Backend...
cd server-app && pnpm install --prod
cd ..

REM ── تثبيت وبناء الـ Frontend ──
echo [2/4] تثبيت حزم الـ Frontend...
cd client-app && pnpm install
echo [3/4] بناء واجهة المستخدم...
pnpm build
cd ..

REM ── بناء الـ Backend ──
echo [4/4] بناء الـ Backend...
cd server-app && pnpm build
cd ..

REM ── إنشاء جداول قاعدة البيانات ──
echo [DB] إنشاء جداول قاعدة البيانات...
cd server-app && npx drizzle-kit push
cd ..

echo.
echo  تم التثبيت بنجاح!
echo.
echo  الخطوات التالية:
echo  1. حرر الإعدادات: %CONFIG_DIR%\config.json
echo  2. شغّل البرنامج: تشغيل_البرنامج.bat
echo.
pause
