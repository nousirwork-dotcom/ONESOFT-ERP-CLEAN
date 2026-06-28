@echo off
chcp 65001 >nul
title OneSoft ERP
echo.
echo  ╔══════════════════════════════════╗
echo  ║       OneSoft ERP - يبدأ التشغيل ║
echo  ╚══════════════════════════════════╝
echo.

REM ── تشغيل الخادم في الخلفية ──
cd /d "%~dp0.."
start "" /B node server-app\dist\index.mjs > "%~dp0server.log" 2>&1

REM ── انتظار 3 ثواني حتى يستعد الخادم ──
echo جارٍ تشغيل البرنامج...
timeout /t 3 /nobreak >nul

REM ── فتح البرنامج كتطبيق سطح مكتب (PWA) ──
REM يستخدم Edge أو Chrome بوضع App (بدون شريط المتصفح)
where msedge >nul 2>&1 && (
  start "" "msedge" --app=http://localhost:3000 --new-window
  goto :end
)
where chrome >nul 2>&1 && (
  start "" "chrome" --app=http://localhost:3000 --new-window
  goto :end
)
REM fallback: فتح المتصفح العادي
start "" http://localhost:3000

:end
echo.
echo  ✓ البرنامج يعمل على http://localhost:3000
echo  لإيقاف البرنامج: أغلق هذه النافذة
echo.
