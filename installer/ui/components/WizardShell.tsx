import { useState, useEffect, type ReactNode } from 'react';
import logoUrl from '../assets/logo.png';

interface Step { id: number; label: string; }

interface Props {
  steps: Step[];
  currentStep: number;
  children: ReactNode;
  canBack?: boolean;
  canNext?: boolean;
  isLast?: boolean;
  hideNav?: boolean;
  nextLabel?: string;
  onBack?: () => void;
  onNext?: () => void;
  onCancel?: () => void;
}

export default function WizardShell({
  steps, currentStep, children,
  canBack = false, canNext = true, isLast = false, hideNav = false,
  nextLabel, onBack, onNext, onCancel,
}: Props) {
  const [maximized, setMaximized] = useState(false);

  const handleMinimize = () => window.installer?.minimize?.();
  const handleMaximize = async () => {
    await window.installer?.maximize?.();
    const isMax = await window.installer?.isMaximized?.();
    setMaximized(!!isMax);
  };
  const handleClose = () => window.installer?.close?.();

  useEffect(() => {
    const checkMax = async () => {
      const isMax = await window.installer?.isMaximized?.();
      setMaximized(!!isMax);
    };
    const interval = setInterval(checkMax, 500);
    return () => clearInterval(interval);
  }, []);

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
          <img
            src={logoUrl}
            alt="OneSoft"
            style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
            }}
          />
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #406B93, #2d5070)',
            display: 'none', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>O</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
            OneSoft ERP — معالج التثبيت
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
          <button onClick={handleMinimize} title="تصغير" style={titleBtnStyle()}>—</button>
          <button onClick={handleMaximize} title={maximized ? 'استعادة' : 'تكبير'} style={titleBtnStyle()}>
            {maximized ? '❐' : '□'}
          </button>
          <button onClick={handleClose} title="إغلاق" style={{ ...titleBtnStyle(), background: 'rgba(185,28,28,0.6)' }}>✕</button>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 20px', gap: 4,
        background: '#fff', borderBottom: '1px solid #E5E0D8',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {steps.map((step, i) => {
          const done   = step.id < currentStep;
          const active = step.id === currentStep;
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
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

      {/* Content — scrollable, centered */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 820, padding: '24px 32px', boxSizing: 'border-box' }}>
          {children}
        </div>
      </div>

      {/* Fixed Bottom Navigation Bar */}
      {!hideNav && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#fff',
          borderTop: '2px solid #E5E0D8',
          flexShrink: 0,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        }}>
          {/* Back button */}
          <button
            onClick={onBack}
            disabled={!canBack}
            style={{
              ...navBtnSecondary,
              opacity: canBack ? 1 : 0.35,
              cursor: canBack ? 'pointer' : 'not-allowed',
            }}
          >
            ◀ السابق
          </button>

          {/* Cancel button */}
          <button onClick={onCancel} style={navBtnCancel}>
            إلغاء
          </button>

          {/* Next / Finish button */}
          <button
            onClick={onNext}
            disabled={!canNext && !isLast}
            style={{
              ...navBtnPrimary,
              opacity: (canNext || isLast) ? 1 : 0.4,
              cursor: (canNext || isLast) ? 'pointer' : 'not-allowed',
              background: isLast
                ? 'linear-gradient(135deg, #16A34A, #15803D)'
                : 'linear-gradient(135deg, #406B93, #2d5070)',
            }}
          >
            {isLast ? (nextLabel ?? 'إنهاء ✓') : (nextLabel ?? 'التالي ▶')}
          </button>
        </div>
      )}
    </div>
  );
}

function titleBtnStyle(): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', border: 'none',
    color: '#fff', fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

const navBtnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #406B93, #2d5070)',
  color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 32px', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: "'Cairo', Tahoma, sans-serif",
  minWidth: 120,
  transition: 'opacity 0.15s',
};

const navBtnSecondary: React.CSSProperties = {
  background: '#fff', color: '#374151',
  border: '1px solid #D1D5DB', borderRadius: 8,
  padding: '10px 24px', fontSize: 14, cursor: 'pointer',
  fontFamily: "'Cairo', Tahoma, sans-serif",
  minWidth: 100,
};

const navBtnCancel: React.CSSProperties = {
  background: 'transparent', color: '#9CA3AF',
  border: '1px solid #E5E0D8', borderRadius: 8,
  padding: '10px 20px', fontSize: 13, cursor: 'pointer',
  fontFamily: "'Cairo', Tahoma, sans-serif",
};
