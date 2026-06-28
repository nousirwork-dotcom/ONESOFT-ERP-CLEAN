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

REM ── التحقق من pnpm ──
where pnpm >nul 2>&1 || (
  echo [تثبيت] جارٍ تثبيت pnpm...
  npm install -g pnpm
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
echo  ✓ اكتمل التثبيت بنجاح!
echo  الآن شغّل: تشغيل_البرنامج.bat
echo.
pause
