import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface BrandingSettings {
  primary_color:              string;
  secondary_color:            string;
  accent_color:               string;
  background_color:           string;
  card_background_color:      string;
  text_color:                 string;
  button_color:               string;
  button_text_color:          string;
  logo_url:                   string | null;
  login_background_type:      'gradient' | 'solid' | 'image';
  login_background_value:     string;
  border_radius:              number;
  font_size:                  number;
  sidebar_color:              string;
  sidebar_text_color:         string;
  sidebar_active_color:       string;
  opening_transition:         'none' | 'fade' | 'slide' | 'zoom' | 'split_center';
  view_mode:                  'normal' | 'compact' | 'wide';
  fullscreen_on_start:        boolean;
  remember_window_size:       boolean;
  remember_last_opened_tabs:  boolean;
  startup_page:               'dashboard' | 'sales' | 'pos' | 'accounting' | 'last_opened';
}

export const DEFAULT_BRANDING: BrandingSettings = {
  primary_color:              '#406B93',
  secondary_color:            '#E4DFDA',
  accent_color:               '#EEF3F7',
  background_color:           '#ECE7DD',
  card_background_color:      '#FFFFFF',
  text_color:                 '#2F2F2F',
  button_color:               '#406B93',
  button_text_color:          '#FFFFFF',
  logo_url:                   null,
  login_background_type:      'gradient',
  login_background_value:     'linear-gradient(145deg, #E8E0D4 0%, #D4CCC0 40%, #C8C0B4 100%)',
  border_radius:              8,
  font_size:                  13,
  sidebar_color:              '#132238',
  sidebar_text_color:         '#E5E7EB',
  sidebar_active_color:       '#406B93',
  opening_transition:         'none',
  view_mode:                  'normal',
  fullscreen_on_start:        false,
  remember_window_size:       true,
  remember_last_opened_tabs:  false,
  startup_page:               'dashboard',
};

interface BrandingContextType {
  settings:     BrandingSettings;
  loading:      boolean;
  reload:       () => void;
  applyPreview: (overrides: Partial<BrandingSettings>) => void;
  resetPreview: () => void;
}

const BrandingContext = createContext<BrandingContextType>({
  settings:     DEFAULT_BRANDING,
  loading:      false,
  reload:       () => {},
  applyPreview: () => {},
  resetPreview: () => {},
});

// ─── CSS Variables ─────────────────────────────────────────────────────────────

function buildLoginBg(s: BrandingSettings): string {
  if (s.login_background_type === 'solid') return s.login_background_value;
  if (s.login_background_type === 'image') return `url(${s.login_background_value}) center/cover no-repeat`;
  return s.login_background_value;
}

function hexToRgb(hex: string): string {
  try {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '64 107 147';
    return `${r} ${g} ${b}`;
  } catch {
    return '64 107 147';
  }
}

function adjustHex(hex: string, amount: number): string {
  try {
    const clean = hex.replace('#', '');
    const r = Math.min(255, parseInt(clean.slice(0, 2), 16) + amount);
    const g = Math.min(255, parseInt(clean.slice(2, 4), 16) + amount);
    const b = Math.min(255, parseInt(clean.slice(4, 6), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return hex;
  }
}

export function applyCssVariables(s: BrandingSettings): void {
  try {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root) return;
    const set = (v: string, val: string) => {
      try { root.style.setProperty(v, val); } catch { /* ignore */ }
    };

    set('--primary',                     s.primary_color);
    set('--ring',                        s.primary_color);
    set('--secondary',                   s.secondary_color);
    set('--secondary-foreground',        s.text_color);
    set('--accent',                      s.accent_color);
    set('--accent-foreground',           s.primary_color);
    set('--background',                  s.background_color);
    set('--muted',                       s.background_color);
    set('--card',                        s.card_background_color);
    set('--card-foreground',             s.text_color);
    set('--popover',                     s.card_background_color);
    set('--popover-foreground',          s.text_color);
    set('--foreground',                  s.text_color);
    set('--primary-foreground',          s.button_text_color);
    set('--sidebar',                     s.sidebar_color);
    set('--sidebar-foreground',          s.sidebar_text_color);
    set('--sidebar-accent-foreground',   s.sidebar_text_color);
    set('--sidebar-primary',             s.sidebar_active_color);
    set('--sidebar-primary-foreground',  s.button_text_color);
    set('--sidebar-accent',              adjustHex(s.sidebar_color, 20));
    set('--sidebar-ring',                s.sidebar_active_color);

    const radius = `${(s.border_radius / 8).toFixed(3)}rem`;
    set('--radius',              radius);
    set('--brand-login-bg',      buildLoginBg(s));
    set('--brand-primary-rgb',   hexToRgb(s.primary_color));
    set('--brand-border-radius', `${s.border_radius}px`);
    set('--brand-font-size',     `${s.font_size}px`);

    // view_mode class on <html>
    try {
      root.classList.remove('view-normal', 'view-compact', 'view-wide');
      root.classList.add(`view-${s.view_mode ?? 'normal'}`);
    } catch { /* ignore */ }

    // sync remember_last_opened_tabs flag to localStorage so TabManagerContext
    // (which lives outside BrandingProvider) can read it without a direct import
    try {
      localStorage.setItem(
        'onesoft_cfg_remember_tabs',
        String(s.remember_last_opened_tabs ?? false)
      );
    } catch { /* ignore */ }
  } catch {
    // never crash the app because of a CSS variable error
  }
}

// ─── Apply DEFAULT_BRANDING IMMEDIATELY at module load ─────────────────────────
applyCssVariables(DEFAULT_BRANDING);

// ─── getStartupPath ────────────────────────────────────────────────────────────
export function getStartupPath(page: BrandingSettings['startup_page']): string {
  switch (page) {
    case 'sales':       return '/sales-module';
    case 'pos':         return '/pos';
    case 'accounting':  return '/accounting';
    case 'last_opened': {
      try {
        return localStorage.getItem('onesoft_last_page') || '/';
      } catch {
        return '/';
      }
    }
    default: return '/';
  }
}

// ─── BrandingErrorBoundary ─────────────────────────────────────────────────────

interface BrandingErrorBoundaryState { hasError: boolean }

export class BrandingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BrandingErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BrandingErrorBoundaryState {
    applyCssVariables(DEFAULT_BRANDING);
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[BrandingErrorBoundary] caught error:', error, info);
  }

  render() { return this.props.children; }
}

// ─── BrandingProvider ──────────────────────────────────────────────────────────

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [settings,      setSettings]      = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading,       setLoading]       = useState(true);
  const [savedSettings, setSavedSettings] = useState<BrandingSettings>(DEFAULT_BRANDING);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await fetch('/api/public/branding', { credentials: 'include' });
      if (res.ok) {
        const data   = await res.json() as Partial<BrandingSettings>;
        const merged = { ...DEFAULT_BRANDING, ...data };
        setSettings(merged);
        setSavedSettings(merged);
        applyCssVariables(merged);
      } else {
        applyCssVariables(DEFAULT_BRANDING);
      }
    } catch {
      applyCssVariables(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  const applyPreview = useCallback((overrides: Partial<BrandingSettings>) => {
    const preview = { ...savedSettings, ...overrides };
    setSettings(preview);
    applyCssVariables(preview);
  }, [savedSettings]);

  const resetPreview = useCallback(() => {
    setSettings(savedSettings);
    applyCssVariables(savedSettings);
  }, [savedSettings]);

  return (
    <BrandingContext.Provider value={{ settings, loading, reload: fetchBranding, applyPreview, resetPreview }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
