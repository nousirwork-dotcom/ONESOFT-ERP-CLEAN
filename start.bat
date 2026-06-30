@echo off
title OneSoft ERP
cd /d "%~dp0"

echo ========================================
echo         OneSoft ERP - جاري التشغيل
echo ========================================
echo.

start "OneSoft Backend" cmd /k "cd server-app && pnpm run dev"

timeout /t 3 /nobreak >nul

start "OneSoft Frontend" cmd /k "cd client-app && pnpm run dev"

timeout /t 5 /nobreak >nul

start http://localhost:5000

echo.
echo ✅ تم فتح البرنامج في المتصفح
echo.
echo لإيقاف البرنامج: أغلق النوافذ السوداء
pause
