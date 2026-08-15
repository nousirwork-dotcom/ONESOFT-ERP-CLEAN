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

; يجهز لحظة أول تثبيت في ملف مؤقت. لا يصبح الملف المعتمد نهائياً إلا في
; .onInstSuccess، لذلك إلغاء/فشل المثبت لا يستهلك التجربة.
!macro oneSoftEnsureTrialMarker
  ${IfNot} ${FileExists} "$R6\OneSoft\trial-install-marker.json"
    ; LS asks NSIS for the current UTC system time. "G" is not a valid
    ; FileFunc GetTime option and would silently return blank fields.
    ${GetTime} "" "LS" $0 $1 $2 $3 $4 $5 $6
    FileOpen $R4 "$R6\OneSoft\trial-install-marker.pending.json" w
    FileWrite $R4 "{$\r$\n  $\"schema$\": 1,$\r$\n  $\"firstInstallAt$\": $\"$2-$1-$0T$3:$5:$6.000Z$\"$\r$\n}$\r$\n"
    FileClose $R4
  ${EndIf}
!macroend

!macro oneSoftCommitTrialMarker
  ReadEnvStr $R6 "PROGRAMDATA"
  ${If} $R6 == ""
    StrCpy $R6 "C:\ProgramData"
  ${EndIf}
  ${If} ${FileExists} "$R6\OneSoft\trial-install-marker.pending.json"
    ${IfNot} ${FileExists} "$R6\OneSoft\trial-install-marker.json"
      Rename "$R6\OneSoft\trial-install-marker.pending.json" "$R6\OneSoft\trial-install-marker.json"
      ; يمنع المستخدم العادي من الكتابة على العلامة، مع إبقاء قراءتها
      ; متاحة لخدمة OneSoft التي تعمل بحساب SYSTEM.
      nsExec::Exec 'icacls "$R6\OneSoft\trial-install-marker.json" /inheritance:r /grant:r "SYSTEM:(F)" "Administrators:(F)" "Users:(R)"'
    ${Else}
      Delete "$R6\OneSoft\trial-install-marker.pending.json"
    ${EndIf}
  ${EndIf}
!macroend

!macro oneSoftDeletePendingTrialMarker
  ReadEnvStr $R6 "PROGRAMDATA"
  ${If} $R6 == ""
    StrCpy $R6 "C:\ProgramData"
  ${EndIf}
  Delete "$R6\OneSoft\trial-install-marker.pending.json"
!macroend

Function .onInstSuccess
  !insertmacro oneSoftCommitTrialMarker
FunctionEnd

Function .onInstFailed
  !insertmacro oneSoftDeletePendingTrialMarker
FunctionEnd

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
; يجب أن يمر التثبيت السابق عبر Upgrade Core قبل تشغيل Backend:
;   Legacy credential → roles/ownership → preflight → migrations
;   → Foundation/health verification → service start
; هذا هو نفس المسار الذي يستخدمه updater لأن updater يطلق NSIS نفسه.
!macro customInstall
  Sleep 1500
  ReadEnvStr $R6 "PROGRAMDATA"
  ${If} $R6 == ""
    StrCpy $R6 "C:\ProgramData"
  ${EndIf}
  CreateDirectory "$R6\OneSoft"

  ; Fresh installs have no config/version pair yet; the React wizard owns
  ; database setup and service installation in that case. Existing installs
  ; must use the shared headless Upgrade Core before any service can start.
  ; A config file is the authoritative existing-install marker. Legacy
  ; machines may have config.json but no version.json, and must not bypass
  ; migrations by being mistaken for a fresh install.
  ${If} ${FileExists} "$R6\OneSoft\config\onesoft.config.json"
    ; Manual installs get the interactive wizard so a Legacy machine can
    ; receive a one-time PostgreSQL administrator credential. Silent updater
    ; installs remain fail-closed and never prompt. The acceptance marker is
    ; created only by the isolated Windows CI runner and selects the same
    ; headless Upgrade Core used by silent production updates.
    ReadEnvStr $R4 "PROGRAMDATA"
    ${If} ${FileExists} "$R6\OneSoft\acceptance.mode"
      DetailPrint "Running OneSoft Upgrade Core in CI acceptance mode..."
      ExecWait '"$INSTDIR\OneSoft ERP.exe" --run-upgrade-core --silent' $R0
      Goto upgrade_result
    ${EndIf}
    IfSilent silent_upgrade manual_upgrade
    silent_upgrade:
      DetailPrint "Running OneSoft Upgrade Core before starting services..."
      ExecWait '"$INSTDIR\OneSoft ERP.exe" --run-upgrade-core --silent' $R0
      Goto upgrade_result
    manual_upgrade:
      DetailPrint "Opening OneSoft Upgrade Wizard before starting services..."
      ExecWait '"$INSTDIR\OneSoft ERP.exe" --run-upgrade-wizard' $R0
    upgrade_result:
    ${If} $R0 != 0
      DetailPrint "Upgrade Core failed with exit code $R0"
      MessageBox MB_ICONSTOP|MB_OK "OneSoft upgrade failed before services were started. Review the installer log and retry."
      Abort
    ${EndIf}
    DetailPrint "Upgrade Core completed successfully."
  ${EndIf}

  ; Silent updater installs do not run the first-run React wizard. Keep the
  ; machine-level marker in sync only after the Upgrade Core gate succeeds.
  CreateDirectory "$R6\OneSoft"
  FileOpen $R5 "$R6\OneSoft\version.json" w
  FileWrite $R5 "{$\r$\n  $\"version$\": $\"${VERSION}$\",$\r$\n  $\"source$\": $\"nsis-update$\"$\r$\n}$\r$\n"
  FileClose $R5

  ; لا نبدأ التجربة عند أول تسجيل دخول أو إعداد يدوي. هذه النقطة هي آخر
  ; خطوة في customInstall بعد نجاح Upgrade Core وكتابة version.json.
  ; تحديثات 1.0.41 وما بعدها لا تدخل هذا الفرع لأن config موجود.
  ${IfNot} ${FileExists} "$R6\OneSoft\config\onesoft.config.json"
    !insertmacro oneSoftEnsureTrialMarker
  ${EndIf}
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
