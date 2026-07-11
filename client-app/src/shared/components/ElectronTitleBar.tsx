import { useState, useEffect } from 'react';

const inst = (): NonNullable<typeof window.installer> | null =>
  (window as any).installer ?? null;

export default function ElectronTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [hovered, setHovered] = useState<'min' | 'max' | 'close' | null>(null);

  useEffect(() => {
    const api = inst();
    if (!api) return;
    api.isMaximized().then(setIsMaximized).catch(() => {});
  }, []);

  const api = inst();
  if (!api) return null;

  const handleMinimize = () => api.minimize();
  const handleMaximize = async () => {
    await api.maximize();
    setIsMaximized(await api.isMaximized());
  };
  const handleClose = () => api.close();

  const iconColor = (btn: 'min' | 'max' | 'close') =>
    hovered === 'close' && btn === 'close' ? '#fff' : 'currentColor';

  const btnBg = (btn: 'min' | 'max' | 'close') => {
    if (hovered !== btn) return 'transparent';
    return btn === 'close' ? '#C42B1C' : 'rgba(120,120,120,0.18)';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 32,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        WebkitAppRegion: 'drag',
        background: 'transparent',
        userSelect: 'none',
        pointerEvents: 'auto',
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          onMouseEnter={() => setHovered('min')}
          onMouseLeave={() => setHovered(null)}
          title="تصغير"
          style={{
            width: 46, height: 32, border: 'none', outline: 'none',
            background: btnBg('min'), cursor: 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
            color: 'rgba(80,80,80,0.85)',
          }}
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill={iconColor('min')} />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          onMouseEnter={() => setHovered('max')}
          onMouseLeave={() => setHovered(null)}
          title={isMaximized ? 'استعادة' : 'تكبير'}
          style={{
            width: 46, height: 32, border: 'none', outline: 'none',
            background: btnBg('max'), cursor: 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
            color: 'rgba(80,80,80,0.85)',
          }}
        >
          {isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="3" y="0" width="8" height="8" stroke={iconColor('max')} strokeWidth="1" />
              <rect x="0" y="3" width="8" height="8" fill="var(--background,#fff)" stroke={iconColor('max')} strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke={iconColor('max')} strokeWidth="1" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          onMouseEnter={() => setHovered('close')}
          onMouseLeave={() => setHovered(null)}
          title="إغلاق"
          style={{
            width: 46, height: 32, border: 'none', outline: 'none',
            background: btnBg('close'), cursor: 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
            color: 'rgba(80,80,80,0.85)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <line x1="0" y1="0" x2="10" y2="10" stroke={iconColor('close')} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="10" y1="0" x2="0" y2="10" stroke={iconColor('close')} strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

      </div>
    </div>
  );
}
