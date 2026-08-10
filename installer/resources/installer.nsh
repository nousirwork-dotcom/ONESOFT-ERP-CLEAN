; ─────────────────────────────────────────────────────────────────────────────
; OneSoft ERP — تخصيص مُزيل التثبيت (NSIS / electron-builder)
;
; الهدف: عند إلغاء التثبيت الحقيقي من Windows (لوحة التحكم / Settings):
;   1. إيقاف عمليات OneSoft وإيقاف + حذف خدمات Backend (قبل حذف الملفات)
;   2. حذف المهام المجدولة وقواعد جدار الحماية الخاصة بـ OneSoft
;   3. حذف C:\ProgramData\OneSoft\config و version.json
;      (هما ما يجعل المُثبِّت يعتبر الإعداد مكتملاً — حذفهما يُظهر معالج
;       الإعداد عند التثبيت التالي، ويعرض خيار الاتصال بقاعدة موجودة)
;
; ما لا يُمَسّ إطلاقاً:
;   - PostgreSQL وقاعدة بيانات OneSoft ومستخدمو القاعدة وبيانات الشركات
;   - C:\ProgramData\OneSoft\Backups / uploads / Logs / Data / Attachments / Exports
;
; عند التحديث فوق نسخة موجودة (auto-update أو تثبيت نسخة أحدث):
;   electron-builder يستدعي المُزيل القديم بالمعامل --updated
;   → نتخطى كل التنظيف حتى لا يظهر المعالج بعد التحديث المباشر.
; ─────────────────────────────────────────────────────────────────────────────

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; يُنفَّذ عند بدء المثبت الجديد، قبل أن يستدعي electron-builder مزيل
; التثبيت القديم في ترقية --updated. هذا المسار ضروري للترقية من إصدارات
; legacy التي كان customUnInit فيها يتخطى الإيقاف عند وجود --updated.
!macro customInit
  nsExec::Exec 'taskkill /F /T /IM "OneSoft ERP.exe"'
  nsExec::Exec 'taskkill /F /T /IM "OneSoft-Server.exe"'
  nsExec::Exec 'taskkill /F /T /IM "OneSoft-Updater.exe"'
  nsExec::Exec 'sc stop OneSoft-Client'
  nsExec::Exec 'sc stop OneSoft-Updater'
  nsExec::Exec 'sc stop OneSoft-Server'
  Sleep 4000
!macroend

; عند التحديث الصامت لا تمر واجهة المعالج بخطوة تثبيت الخدمات مرة أخرى.
; تشغيل الخدمة الموجودة بعد نسخ الملفات يجعل التحديث قابلاً للتحقق فعلياً،
; بينما تفشل أوامر sc بهدوء في التثبيت الأول قبل إنشاء الخدمة.
!macro customInstall
  Sleep 1500
  nsExec::Exec 'sc start OneSoft-Server'

  ; silent updater installs do not run the first-run React wizard, so keep the
  ; ProgramData installation marker in sync with the files just copied.
  ; The wizard may overwrite this later with its richer marker payload.
  ReadEnvStr $R6 "PROGRAMDATA"
  ${If} $R6 == ""
    StrCpy $R6 "C:\ProgramData"
  ${EndIf}
  CreateDirectory "$R6\OneSoft"
  FileOpen $R5 "$R6\OneSoft\version.json" w
  FileWrite $R5 "{$\r$\n  $\"version$\": $\"${VERSION}$\",$\r$\n  $\"source$\": $\"nsis-update$\"$\r$\n}$\r$\n"
  FileClose $R5
!macroend

; يضبط $R9 = "1" إذا كان إلغاء تثبيت حقيقياً (بدون --updated)، وإلا "0"
!macro oneSoftDetectRealUninstall
  ${GetParameters} $R7
  ClearErrors
  ${GetOptions} $R7 "--updated" $R8
  ${If} ${Errors}
    StrCpy $R9 "1"
  ${Else}
    StrCpy $R9 "0"
  ${EndIf}
!macroend

; يُنفَّذ في un.onInit — قبل حذف ملفات البرنامج
; إيقاف الخدمات هنا ضروري: nssm.exe و node.exe قد يقفلان ملفات داخل مجلد التثبيت.
; ينطبق الإيقاف على التحديث أيضاً (--updated)، لكن حذف الخدمات وبيانات
; المستخدم يبقى محصوراً في إلغاء التثبيت الحقيقي.
!macro customUnInit
  !insertmacro oneSoftDetectRealUninstall
  ; إنهاء عمليات OneSoft (لا نمس عمليات PostgreSQL). هذا مطلوب في التحديث
  ; حتى يستطيع NSIS استبدال الملفات التي كان Electron/Node يقرأها.
  nsExec::Exec 'taskkill /F /T /IM "OneSoft ERP.exe"'
  nsExec::Exec 'taskkill /F /T /IM "OneSoft-Server.exe"'
  nsExec::Exec 'taskkill /F /T /IM "OneSoft-Updater.exe"'
  nsExec::Exec 'taskkill /F /T /IM "OneSoftERP.exe"'

  ; إيقاف الخدمات — في التحديث لا نحذفها، لأن المثبّت الجديد يعيد تشغيل
  ; نفس الخدمة بعد استبدال الملفات.
  nsExec::Exec 'sc stop OneSoft-Client'
  nsExec::Exec 'sc stop OneSoft-Updater'
  nsExec::Exec 'sc stop OneSoft-Server'
  Sleep 4000

  ${If} $R9 == "1"
    ; حذف الخدمات نهائياً عند إلغاء التثبيت الحقيقي فقط
    nsExec::Exec 'sc delete OneSoft-Client'
    nsExec::Exec 'sc delete OneSoft-Updater'
    nsExec::Exec 'sc delete OneSoft-Server'

    ; إنهاء أي nssm.exe معلّق يقفل ملفات مجلد التثبيت
    nsExec::Exec 'taskkill /F /IM nssm.exe'
    Sleep 1000
  ${EndIf}
!macroend

; يُنفَّذ في نهاية قسم إلغاء التثبيت — بعد حذف ملفات البرنامج
!macro customUnInstall
  !insertmacro oneSoftDetectRealUninstall
  ${If} $R9 == "1"
    ; المهام المجدولة الخاصة بـ OneSoft
    nsExec::Exec 'schtasks /Delete /TN "\OneSoft Backup" /F'
    nsExec::Exec 'schtasks /Delete /TN "\OneSoft-Backup" /F'
    nsExec::Exec 'schtasks /Delete /TN "\OneSoft Update" /F'
    nsExec::Exec 'schtasks /Delete /TN "\OneSoft-Updater" /F'

    ; قواعد جدار الحماية الخاصة بـ OneSoft
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft ERP"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft Server"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft Backend"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft Client"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft-Server"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft-Client"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft ERP Backend"'
    nsExec::Exec 'netsh advfirewall firewall delete rule name="OneSoft ERP Server"'

    ; حذف علامات "الإعداد مكتمل" — مسار مطلق مستقل عن مجلد التثبيت
    ; نقرأ PROGRAMDATA من البيئة وقت التشغيل (C:\ProgramData عادةً)
    ReadEnvStr $R6 "PROGRAMDATA"
    ${If} $R6 == ""
      StrCpy $R6 "C:\ProgramData"
    ${EndIf}
    RMDir /r "$R6\OneSoft\config"
    Delete "$R6\OneSoft\version.json"

    ; ملاحظة: لا نحذف مجلد OneSoft نفسه —
    ; Backups / uploads / Logs / Data / Attachments / Exports تبقى كاملة،
    ; وقاعدة PostgreSQL لا تُمَسّ إطلاقاً.
  ${EndIf}
!macroend
