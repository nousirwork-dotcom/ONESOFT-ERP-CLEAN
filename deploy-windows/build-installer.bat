@echo off
chcp 65001 >nul
title OneSoft ERP — بناء المثبّت

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║         OneSoft ERP — بناء نسخة Windows                  ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0.."

REM ── التحقق من المتطلبات ──────────────────────────────────────────
where node >nul 2>&1 || (echo [خطأ] Node.js غير مثبت & pause & exit /b 1)
where pnpm >nul 2>&1 || npm install -g pnpm
where git  >nul 2>&1 || echo [تحذير] git غير مثبت

echo [1/6] تثبيت حزم Backend...
cd server-app && pnpm install
cd ..

echo [2/6] بناء Backend...
cd server-app && pnpm build
cd ..

echo [3/6] تثبيت حزم Frontend...
cd client-app && pnpm install

echo [4/6] بناء Frontend...
pnpm build
cd ..

echo [5/6] تثبيت حزم Electron...
cd electron && npm install
cd ..

echo [6/6] بناء المثبّت (Setup.exe)...
cd electron && npm run build:win
cd ..

echo.
echo  ✓ اكتمل البناء!
echo  المثبّت موجود في: dist-installer\
echo.
dir /b dist-installer\*.exe 2>nul || dir /b dist-installer\*.msi 2>nul
echo.
pause
