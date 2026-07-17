import React from 'react';
import type { POSSection } from '../types';
import { usePOS } from '../state';

const nav: Array<{ section: POSSection; label: string; icon: string; restaurantOnly?: boolean }> = [
  { section: 'sale', label: 'شاشة البيع', icon: '▦' },
  { section: 'shifts', label: 'الورديات والصندوق', icon: '◷' },
  { section: 'tables', label: 'الطاولات', icon: '▤', restaurantOnly: true },
  { section: 'kitchen', label: 'المطبخ KDS', icon: '♨', restaurantOnly: true },
  { section: 'external-orders', label: 'الطلبات الخارجية', icon: '⇄', restaurantOnly: true },
  { section: 'reports', label: 'التقارير والرقابة', icon: '▥' },
  { section: 'settings', label: 'الإعدادات', icon: '⚙' },
];

export function Sidebar() {
  const { state, setSection } = usePOS();
  return (
    <aside className="pos-sidebar">
      <div className="pos-brand">
        <div className="pos-brand__mark">O</div>
        <div>
          <strong>OneSoft POS</strong>
          <small>{state.mode === 'restaurant' ? 'وضع المطعم' : 'وضع المتجر'}</small>
        </div>
      </div>
      <nav className="pos-nav" aria-label="أقسام نقطة البيع">
        {nav.map((item) => {
          const disabled = Boolean(item.restaurantOnly && state.mode !== 'restaurant');
          return (
            <button
              type="button"
              key={item.section}
              className={`pos-nav__item ${state.activeSection === item.section ? 'is-active' : ''}`}
              disabled={disabled}
              onClick={() => setSection(item.section)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="pos-sidebar__footer">
        <span className={`pos-connection ${state.currentShift ? 'is-online' : ''}`} />
        <span>{state.currentShift ? 'الوردية مفتوحة' : 'لا توجد وردية'}</span>
      </div>
    </aside>
  );
}
