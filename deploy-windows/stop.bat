@echo off
chcp 65001 >nul 2>&1
title OneSoft ERP — إيقاف التشغيل

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║       OneSoft ERP — إيقاف البرنامج               ║
echo  ╚══════════════════════════════════════════════════╝
echo.

set "SERVER_PORT=3000"
set "CLIENT_PORT=5000"
set "CFG_FILE=%APPDATA%\OneSoftERP\config.json"

if exist "%CFG_FILE%" (
    for /f "tokens=2 delims=:, " %%P in ('findstr /C:"\"port\"" "%CFG_FILE%"') do (
        set "SERVER_PORT=%%P"
        set "SERVER_PORT=!SERVER_PORT: =!"
    )
)

echo  ▶ إيقاف Backend (المنفذ %SERVER_PORT%)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%SERVER_PORT% " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
    echo  [OK] أُوقف العملية: %%P
)

echo  ▶ إيقاف Frontend (المنفذ %CLIENT_PORT%)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%CLIENT_PORT% " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
    echo  [OK] أُوقف العملية: %%P
)

echo  ▶ إغلاق نوافذ OneSoft...
taskkill /FI "WINDOWTITLE eq OneSoft*" /F >nul 2>&1

echo.
echo  [OK] تم إيقاف البرنامج.
echo.
timeout /t 2 /nobreak >nul
