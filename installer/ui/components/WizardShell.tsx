import type { ReactNode } from 'react';

interface Step { id: number; label: string; }

interface Props {
  steps: Step[];
  currentStep: number;
  children: ReactNode;
}

export default function WizardShell({ steps, currentStep, children }: Props) {
  const handleMinimize = () => window.installer?.minimize?.();
  const handleClose    = () => window.installer?.close?.();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#F4F1EC',
      fontFamily: "'Cairo', Tahoma, sans-serif",
      userSelect: 'none', overflow: 'hidden',
    }} dir="rtl">

      {/* Title Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(135deg, #1E344F 0%, #2d5070 100%)',
        WebkitAppRegion: 'drag' as any,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #406B93, #2d5070)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>O</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
            OneSoft ERP — معالج التثبيت
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
          <button onClick={handleMinimize} style={btnStyle('#6B7280')}>—</button>
          <button onClick={handleClose}    style={btnStyle('#B91C1C')}>✕</button>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '14px 20px', gap: 4,
        background: '#fff', borderBottom: '1px solid #E5E0D8',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {steps.map((step, i) => {
          const done   = step.id < currentStep;
          const active = step.id === currentStep;
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: done ? '#16A34A' : active ? '#406B93' : '#E5E0D8',
                  color: done || active ? '#fff' : '#9CA3AF',
                  transition: 'all 0.2s',
                }}>
                  {done ? '✓' : step.id}
                </div>
                {active && (
                  <span style={{ fontSize: 9, color: '#406B93', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {step.label}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: 20, height: 2, borderRadius: 1,
                  background: done ? '#16A34A' : '#E5E0D8',
                  transition: 'background 0.2s',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {children}
      </div>
    </div>
  );
}

function btnStyle(hoverBg: string): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', border: 'none',
    color: '#fff', fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
