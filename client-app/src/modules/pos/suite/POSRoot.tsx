import React, { useEffect } from 'react';
import { POSProvider, usePOS } from './state';
import { usePOSCatalog } from './catalog-context';
import { Sidebar } from './components/Sidebar';
import { SaleScreen } from './screens/SaleScreen';
import { ShiftsScreen } from './screens/ShiftsScreen';
import { TablesScreen } from './screens/TablesScreen';
import { KitchenScreen } from './screens/KitchenScreen';
import { ExternalOrdersScreen } from './screens/ExternalOrdersScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { IntegrationProvider } from './integrations/context';
import { providerRegistry } from './integrations/registry';
import { HungerStationAdapter } from './integrations/adapters/hungerstation';
import { MrsoolAdapter } from './integrations/adapters/mrsool';
import './theme.css';

providerRegistry.register(new HungerStationAdapter());
providerRegistry.register(new MrsoolAdapter());

function POSWorkspace() {
  const { state, dispatch } = usePOS();
  const { customers, isFullscreen, onToggleFullscreen, cashierName } = usePOSCatalog();

  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => dispatch({ type: 'SET_NOTICE', notice: null }), 3200);
    return () => window.clearTimeout(timer);
  }, [state.notice, dispatch]);

  useEffect(() => {
    if (customers.length > 0 && !state.cashCustomer) {
      const cashCustomer = customers[0] ?? null;
      dispatch({ type: 'SET_CASH_CUSTOMER', customer: cashCustomer });
    }
  }, [customers, state.cashCustomer, dispatch]);

  const screen = (() => {
    switch (state.activeSection) {
      case 'sale': return <SaleScreen />;
      case 'shifts': return <ShiftsScreen />;
      case 'tables': return <TablesScreen />;
      case 'kitchen': return <KitchenScreen />;
      case 'external-orders': return <ExternalOrdersScreen />;
      case 'reports': return <ReportsScreen />;
      case 'settings': return <SettingsScreen />;
      default: return <SaleScreen />;
    }
  })();

  return (
    <div className={`onesoft-pos-suite mode-${state.mode}`} dir="rtl">
      <Sidebar />
      <main className="pos-workspace">
        <div className="pos-workspace__topbar">
          <div>
            <strong>{state.settings.registerName}</strong>
            <span>{state.mode === 'restaurant' ? 'المطعم' : 'المتجر'} • {cashierName}</span>
          </div>
          <div className="pos-workspace__top-actions">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_SECTION', section: 'shifts' })}
            >
              {state.currentShift?.status === 'open' ? 'الوردية مفتوحة' : 'فتح وردية'}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'خروج من ملء الشاشة (F11)' : 'ملء الشاشة (F11)'}
            >
              {isFullscreen ? 'تصغير' : 'ملء الشاشة'}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_SECTION', section: 'settings' })}
            >
              الإعدادات
            </button>
          </div>
        </div>
        <div className="pos-workspace__content">{screen}</div>
      </main>
      {state.notice ? <div className="pos-toast" role="status">{state.notice}</div> : null}
    </div>
  );
}

export function OneSoftPOSSuite() {
  return (
    <POSProvider>
      <IntegrationProvider>
        <POSWorkspace />
      </IntegrationProvider>
    </POSProvider>
  );
}
