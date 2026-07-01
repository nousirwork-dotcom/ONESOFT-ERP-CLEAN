import { useEffect } from 'react';
import { useInstallerStore } from './store/installer.store';
import WizardShell from './components/WizardShell';
import Step01Welcome      from './steps/01-Welcome';
import Step02License      from './steps/02-License';
import Step03Requirements from './steps/03-Requirements';
import Step04InstallType  from './steps/04-InstallType';
import Step05AccessModes  from './steps/05-AccessModes';
import Step06DatabaseMode from './steps/05-Database';      // وضع + إعداد قاعدة البيانات
import Step07MachineRole  from './steps/06-MachineRole';   // دور الجهاز
import Step08Connectivity from './steps/07-Connectivity';  // طريقة الاتصال
import Step09Organization from './steps/06-Organization';  // المؤسسة
import Step10FirstUser    from './steps/07-FirstUser';     // المستخدم الأول
import Step11Services     from './steps/08-Services';      // تثبيت الخدمات
import Step12HealthCheck  from './steps/09-HealthCheck';   // فحص الصحة
import Step13Complete     from './steps/10-Complete';      // الانتهاء
import UninstallWizard    from './steps/Uninstall';

// ── خطوات المعالج — 13 خطوة ──────────────────────────────────────────────────
const STEPS_INSTALL = [
  { id: 1,  label: 'مرحباً'           },
  { id: 2,  label: 'الترخيص'          },
  { id: 3,  label: 'المتطلبات'        },
  { id: 4,  label: 'نوع التثبيت'      },
  { id: 5,  label: 'طرق الاستخدام'    },
  { id: 6,  label: 'قاعدة البيانات'   },  // ← DatabaseMode (جديد — شامل)
  { id: 7,  label: 'دور الجهاز'       },  // ← MachineRole (جديد)
  { id: 8,  label: 'الاتصال بالشبكة'  },  // ← Connectivity (جديد)
  { id: 9,  label: 'المؤسسة'          },
  { id: 10, label: 'المستخدم الأول'   },
  { id: 11, label: 'التثبيت'          },
  { id: 12, label: 'فحص الصحة'        },
  { id: 13, label: 'الانتهاء'         },
];

const isUninstall = typeof window !== 'undefined' &&
  (window.location.search.includes('uninstall') ||
   (window as any).__ONESOFT_MODE__ === 'uninstall');

export default function App() {
  const { currentStep, addProgress } = useInstallerStore();

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
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
        direction: 'rtl',
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:  return <Step01Welcome />;
      case 2:  return <Step02License />;
      case 3:  return <Step03Requirements />;
      case 4:  return <Step04InstallType />;
      case 5:  return <Step05AccessModes />;
      case 6:  return <Step06DatabaseMode />;   // وضع + إعداد قاعدة البيانات
      case 7:  return <Step07MachineRole />;    // دور الجهاز
      case 8:  return <Step08Connectivity />;   // طريقة الاتصال
      case 9:  return <Step09Organization />;
      case 10: return <Step10FirstUser />;
      case 11: return <Step11Services />;
      case 12: return <Step12HealthCheck />;
      case 13: return <Step13Complete />;
      default: return <Step01Welcome />;
    }
  };

  return (
    <WizardShell steps={STEPS_INSTALL} currentStep={currentStep}>
      {renderStep()}
    </WizardShell>
  );
}
