@echo off
chcp 65001 >nul
echo ========================================
echo    OneSoft ERP - تفعيل الفترة التجريبية
echo ========================================
echo.
echo جارٍ تفعيل الفترة التجريبية (30 يوم)...
echo.

set PGPASSWORD=123
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U onesoft_app -d onesoft_erp -h localhost -c "UPDATE organizations SET status = 'trial', subscription_expiry = NOW() + INTERVAL '30 days' WHERE code != 'SYSTEM';"

if %ERRORLEVEL% == 0 (
    echo.
    echo ========================================
    echo  تم التفعيل! اغلق البرنامج واعد تشغيله
    echo ========================================
) else (
    echo فشل - جاري تجربة PostgreSQL 15...
    "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U onesoft_app -d onesoft_erp -h localhost -c "UPDATE organizations SET status = 'trial', subscription_expiry = NOW() + INTERVAL '30 days' WHERE code != 'SYSTEM';"
    if %ERRORLEVEL% == 0 (
        echo.
        echo ========================================
        echo  تم التفعيل! اغلق البرنامج واعد تشغيله
        echo ========================================
    ) else (
        echo.
        echo فشلت العملية - تواصل مع الدعم الفني
    )
)

echo.
pause
