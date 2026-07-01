import { useEffect } from 'react';
import { useInstallerStore } from './store/installer.store';
import WizardShell from './components/WizardShell';
import Step01Welcome      from './steps/01-Welcome';
import Step02License      from './steps/02-License';
import Step03Requirements from './steps/03-Requirements';
import Step04InstallType  from './steps/04-InstallType';
import Step05Database     from './steps/05-Database';
import Step06Organization from './steps/06-Organization';
import Step07FirstUser    from './steps/07-FirstUser';
import Step08Services     from './steps/08-Services';
import Step09HealthCheck  from './steps/09-HealthCheck';
import Step10Complete     from './steps/10-Complete';
import UninstallWizard    from './steps/Uninstall';

const STEPS_INSTALL = [
  { id: 1,  label: 'مرحباً'           },
  { id: 2,  label: 'الترخيص'          },
  { id: 3,  label: 'المتطلبات'        },
  { id: 4,  label: 'نوع التثبيت'      },
  { id: 5,  label: 'قاعدة البيانات'   },
  { id: 6,  label: 'المؤسسة'          },
  { id: 7,  label: 'المستخدم الأول'   },
  { id: 8,  label: 'التثبيت'          },
  { id: 9,  label: 'فحص الصحة'        },
  { id: 10, label: 'الانتهاء'         },
];

// كشف وضع التشغيل: uninstall أو install
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

  // وضع إلغاء التثبيت — شاشة مستقلة بدون WizardShell
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
      case 5:  return <Step05Database />;
      case 6:  return <Step06Organization />;
      case 7:  return <Step07FirstUser />;
      case 8:  return <Step08Services />;
      case 9:  return <Step09HealthCheck />;
      case 10: return <Step10Complete />;
      default: return <Step01Welcome />;
    }
  };

  return (
    <WizardShell steps={STEPS_INSTALL} currentStep={currentStep}>
      {renderStep()}
    </WizardShell>
  );
}
