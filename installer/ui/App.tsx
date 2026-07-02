import { useEffect } from 'react';
import { useInstallerStore } from './store/installer.store';
import WizardShell from './components/WizardShell';

// ── الخطوات الموجودة ──────────────────────────────────────────────────────────
import Step01Welcome      from './steps/01-Welcome';
import Step02License      from './steps/02-License';
import Step03Requirements from './steps/03-Requirements';
import Step04InstallType  from './steps/04-InstallType';
import Step05AccessModes  from './steps/05-AccessModes';

// ── الخطوات الجديدة (الأبعاد التسعة) ─────────────────────────────────────────
import Step06DatabaseMode from './steps/05-Database';       // 6: وضع قاعدة البيانات
import Step07MachineRole  from './steps/06-MachineRole';    // 7: دور الجهاز
import Step08Connectivity from './steps/07-Connectivity';   // 8: طريقة الاتصال
import Step09Licensing    from './steps/08-Licensing';       // 9: نوع الترخيص
import Step10UpdateChannel from './steps/09-UpdateChannel'; // 10: قناة التحديث
import Step11BackupPolicy  from './steps/10-BackupPolicy';  // 11: سياسة النسخ
import Step12Telemetry     from './steps/11-Telemetry';     // 12: الخصوصية

// ── بيانات التثبيت ────────────────────────────────────────────────────────────
import Step13Organization from './steps/06-Organization';   // 13: المؤسسة
import Step14FirstUser    from './steps/07-FirstUser';      // 14: المستخدم الأول

// ── ملخص + تنفيذ + انتهاء ────────────────────────────────────────────────────
import Step15Summary      from './steps/15-DeploymentSummary'; // 15: ملخص التثبيت
import Step16Services     from './steps/08-Services';          // 16: التثبيت الفعلي
import Step17HealthCheck  from './steps/09-HealthCheck';       // 17: فحص الصحة
import Step18Complete     from './steps/10-Complete';          // 18: الانتهاء

import UninstallWizard    from './steps/Uninstall';

// ── تعريف خطوات المعالج — 18 خطوة ───────────────────────────────────────────
const STEPS_INSTALL = [
  { id: 1,  label: 'مرحباً'           },
  { id: 2,  label: 'الترخيص'          },
  { id: 3,  label: 'المتطلبات'        },
  { id: 4,  label: 'نوع التثبيت'      },
  { id: 5,  label: 'طرق الاستخدام'    },
  { id: 6,  label: 'قاعدة البيانات'   },
  { id: 7,  label: 'دور الجهاز'       },
  { id: 8,  label: 'الاتصال'          },
  { id: 9,  label: 'الترخيص'          },
  { id: 10, label: 'التحديثات'        },
  { id: 11, label: 'نسخ احتياطي'      },
  { id: 12, label: 'الخصوصية'         },
  { id: 13, label: 'المؤسسة'          },
  { id: 14, label: 'المستخدم الأول'   },
  { id: 15, label: 'المراجعة'         },
  { id: 16, label: 'التثبيت'          },
  { id: 17, label: 'فحص الصحة'        },
  { id: 18, label: 'الانتهاء'         },
];

const isUninstall = typeof window !== 'undefined' &&
  (window.location.search.includes('uninstall') ||
   (window as any).__ONESOFT_MODE__ === 'uninstall');

export default function App() {
  const {
    currentStep, nextStep, prevStep, addProgress,
    acceptedLicense, requirementsReport, organization, firstUser,
    installRunning, installDone, healthReport,
  } = useInstallerStore();

  useEffect(() => {
    const off = window.installer?.onProgress?.((e: unknown) => {
      addProgress(e as any);
    });
    return () => { if (typeof off === 'function') off(); };
  }, [addProgress]);

  if (isUninstall) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F5F2EC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: 'rtl',
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 36,
          width: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#1E344F' }}>OneSoft ERP</div>
            <div style={{ fontSize: 13, color: '#B91C1C', fontWeight: 700 }}>إلغاء التثبيت</div>
          </div>
          <UninstallWizard />
        </div>
      </div>
    );
  }

  // ── حساب حالة أزرار التنقل بناءً على الخطوة الحالية ─────────────────────────
  const orgValid  = organization.name.trim() !== '';
  // كلمة المرور اختيارية — الشرط: الاسم الكامل + اسم الدخول فقط
  const userValid = firstUser.fullName.trim().length >= 2 && firstUser.username.length >= 3;

  type NavConfig = {
    canBack: boolean;
    canNext: boolean;
    isLast?: boolean;
    hideNav?: boolean;
    nextLabel?: string;
  };

  const navConfig: NavConfig = (() => {
    switch (currentStep) {
      case 1:  return { canBack: false, canNext: true };
      case 2:  return { canBack: true, canNext: acceptedLicense };
      case 3:  return { canBack: true, canNext: requirementsReport?.canContinue ?? false };
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12: return { canBack: true, canNext: true };
      case 13: return { canBack: true, canNext: orgValid };
      case 14: return { canBack: true, canNext: userValid };
      case 15: return { canBack: true, canNext: true, nextLabel: 'بدء التثبيت 🚀' };
      case 16: return {
        canBack: false,
        canNext: installDone,
        hideNav: installRunning && !installDone,
      };
      case 17: return { canBack: false, canNext: healthReport !== null };
      case 18: return { canBack: false, canNext: true, isLast: true, nextLabel: 'إنهاء' };
      default: return { canBack: true, canNext: true };
    }
  })();

  const handleCancel = () => window.installer?.close?.();
  const handleFinish = () => window.installer?.close?.();

  const renderStep = () => {
    switch (currentStep) {
      case 1:  return <Step01Welcome />;
      case 2:  return <Step02License />;
      case 3:  return <Step03Requirements />;
      case 4:  return <Step04InstallType />;
      case 5:  return <Step05AccessModes />;
      case 6:  return <Step06DatabaseMode />;
      case 7:  return <Step07MachineRole />;
      case 8:  return <Step08Connectivity />;
      case 9:  return <Step09Licensing />;
      case 10: return <Step10UpdateChannel />;
      case 11: return <Step11BackupPolicy />;
      case 12: return <Step12Telemetry />;
      case 13: return <Step13Organization />;
      case 14: return <Step14FirstUser />;
      case 15: return <Step15Summary />;
      case 16: return <Step16Services />;
      case 17: return <Step17HealthCheck />;
      case 18: return <Step18Complete />;
      default: return <Step01Welcome />;
    }
  };

  return (
    <WizardShell
      steps={STEPS_INSTALL}
      currentStep={currentStep}
      canBack={navConfig.canBack}
      canNext={navConfig.canNext}
      isLast={navConfig.isLast}
      hideNav={navConfig.hideNav}
      nextLabel={navConfig.nextLabel}
      onBack={prevStep}
      onNext={navConfig.isLast ? handleFinish : nextStep}
      onCancel={handleCancel}
    >
      {renderStep()}
    </WizardShell>
  );
}
