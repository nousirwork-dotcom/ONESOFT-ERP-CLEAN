import React, { useState } from 'react';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';
import { useIntegration } from '../integrations/context';
import { providerRegistry } from '../integrations/registry';
import { IntegrationCenterScreen } from '../integrations/IntegrationCenterScreen';
import type { POSMode } from '../types';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="pos-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i />
      <span>{label}</span>
    </label>
  );
}

export function SettingsScreen() {
  const { state, dispatch } = usePOS();
  const {
    journals,
    warehouses,
    customers,
    selectedJournalId,
    selectedWarehouseId,
    onJournalChange,
    onWarehouseChange,
  } = usePOSCatalog();
  const { connections } = useIntegration();
  const [view, setView] = useState<'main' | 'integrations'>('main');

  const changeMode = (mode: POSMode) => dispatch({ type: 'SET_MODE', mode });

  if (view === 'integrations') {
    return <IntegrationCenterScreen onBack={() => setView('main')} />;
  }

  const connectedCount = connections.length;
  const errorCount = connections.filter((c) => c.status === 'error').length;
  const unmappedTotal = connections.reduce((s, c) => s + c.unmappedProductCount, 0);
  const registeredTotal = providerRegistry.list().length;

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>إعدادات نقطة البيع</small>
          <h1>إعدادات OneSoft POS</h1>
          <p>
            وضعان فقط: المطعم والمتجر. تغيير الوضع يغيّر أدوات التشغيل، ولا يغيّر
            فاتورة المبيعات أو المخزون.
          </p>
        </div>
        <button
          type="button"
          className="pos-button pos-button--primary"
          onClick={() =>
            dispatch({ type: 'SET_NOTICE', notice: 'تم حفظ إعدادات النموذج محليًا.' })
          }
        >
          حفظ الإعدادات
        </button>
      </header>

      <article className="pos-card pos-mode-settings">
        <header>
          <h2>وضع نقطة البيع</h2>
          <span>اختيار واحد لكل نقطة بيع</span>
        </header>
        <div className="pos-mode-cards">
          <button
            type="button"
            className={state.mode === 'restaurant' ? 'is-selected' : ''}
            onClick={() => changeMode('restaurant')}
          >
            <span>🍽</span>
            <strong>وضع المطعم</strong>
            <small>الطاولات، الطلبات، المطبخ KDS، الإضافات، والتوصيل الخارجي.</small>
          </button>
          <button
            type="button"
            className={state.mode === 'store' ? 'is-selected' : ''}
            onClick={() => changeMode('store')}
          >
            <span>🛒</span>
            <strong>وضع المتجر</strong>
            <small>الباركود، البيع السريع، الصور أو القائمة، الوحدات والكميات.</small>
          </button>
        </div>
      </article>

      <div className="pos-settings-grid">
        <article className="pos-card">
          <header><h2>الإعدادات العامة</h2></header>
          <div className="pos-form-grid">
            <label>
              <span>اسم نقطة البيع</span>
              <input
                value={state.settings.registerName}
                onChange={(event) =>
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { registerName: event.target.value } })
                }
              />
            </label>
            <label>
              <span>دفتر المبيعات</span>
              <select
                value={selectedJournalId ?? ''}
                onChange={(event) => {
                  const v = Number(event.target.value) || null;
                  if (v) onJournalChange(v);
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { journalId: v } });
                }}
              >
                <option value="">— اختر دفتر المبيعات —</option>
                {journals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>المخزن</span>
              <select
                value={selectedWarehouseId ?? ''}
                onChange={(event) => {
                  const v = Number(event.target.value) || null;
                  if (v) onWarehouseChange(v);
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { warehouseId: v } });
                }}
              >
                <option value="">— اختر مستودع —</option>
                {warehouses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>العميل النقدي</span>
              <select
                value={state.settings.cashCustomerId ?? ''}
                onChange={(event) => {
                  const v = Number(event.target.value) || null;
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { cashCustomerId: v } });
                  if (v) {
                    const found = customers.find((c) => c.id === v);
                    if (found) dispatch({ type: 'SET_CASH_CUSTOMER', customer: found });
                  }
                }}
              >
                <option value="">— اختر العميل النقدي —</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="pos-toggle-list">
            <Toggle
              label="فتح نقطة البيع بملء الشاشة"
              checked={state.settings.openFullscreen}
              onChange={(value) =>
                dispatch({ type: 'UPDATE_SETTINGS', settings: { openFullscreen: value } })
              }
            />
            <Toggle
              label="تفعيل وضع اللمس"
              checked={state.settings.touchMode}
              onChange={(value) =>
                dispatch({ type: 'UPDATE_SETTINGS', settings: { touchMode: value } })
              }
            />
            <Toggle
              label="إظهار صور الأصناف"
              checked={state.settings.showProductImages}
              onChange={(value) =>
                dispatch({ type: 'UPDATE_SETTINGS', settings: { showProductImages: value } })
              }
            />
            <Toggle
              label="إظهار رصيد المخزن"
              checked={state.settings.showStock}
              onChange={(value) =>
                dispatch({ type: 'UPDATE_SETTINGS', settings: { showStock: value } })
              }
            />
          </div>
        </article>

        {state.mode === 'restaurant' ? (
          <article className="pos-card">
            <header><h2>إعدادات المطعم والمطبخ</h2></header>
            <div className="pos-toggle-list">
              <Toggle
                label="تفعيل الصالات والطاولات"
                checked={state.settings.restaurant.enableTables}
                onChange={(value) =>
                  dispatch({ type: 'UPDATE_RESTAURANT_SETTINGS', settings: { enableTables: value } })
                }
              />
              <Toggle
                label="تفعيل النادل"
                checked={state.settings.restaurant.enableWaiter}
                onChange={(value) =>
                  dispatch({ type: 'UPDATE_RESTAURANT_SETTINGS', settings: { enableWaiter: value } })
                }
              />
              <Toggle
                label="إظهار عدد الضيوف"
                checked={state.settings.restaurant.enableGuestCount}
                onChange={(value) =>
                  dispatch({ type: 'UPDATE_RESTAURANT_SETTINGS', settings: { enableGuestCount: value } })
                }
              />
              <Toggle
                label="تفعيل شاشة المطبخ KDS"
                checked={state.settings.restaurant.enableKitchen}
                onChange={(value) =>
                  dispatch({ type: 'UPDATE_RESTAURANT_SETTINGS', settings: { enableKitchen: value } })
                }
              />
              <Toggle
                label="السماح بإضافة أصناف بعد إرسال الطلب"
                checked={state.settings.restaurant.allowAddAfterKitchenSend}
                onChange={(value) =>
                  dispatch({
                    type: 'UPDATE_RESTAURANT_SETTINGS',
                    settings: { allowAddAfterKitchenSend: value },
                  })
                }
              />
              <Toggle
                label="طلب سبب عند تعديل بند مرسل"
                checked={state.settings.restaurant.requireReasonForSentItemChanges}
                onChange={(value) =>
                  dispatch({
                    type: 'UPDATE_RESTAURANT_SETTINGS',
                    settings: { requireReasonForSentItemChanges: value },
                  })
                }
              />
            </div>
            <div className="pos-settings-links">
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: 'SET_NOTICE', notice: 'إدارة الصالات ستكون متاحة في المرحلة القادمة.' })
                }
              >
                إدارة الصالات والطاولات
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: 'SET_NOTICE', notice: 'إدارة محطات التحضير ستكون متاحة في المرحلة القادمة.' })
                }
              >
                إدارة محطات التحضير
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: 'SET_NOTICE', notice: 'إعدادات الطابعات ستكون متاحة في المرحلة القادمة.' })
                }
              >
                الطابعات ومحطات KDS
              </button>
            </div>
          </article>
        ) : (
          <article className="pos-card">
            <header><h2>إعدادات المتجر</h2></header>
            <div className="pos-toggle-list">
              <Toggle
                label="تركيز تلقائي على الباركود"
                checked={state.settings.autoFocusBarcode}
                onChange={(value) =>
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { autoFocusBarcode: value } })
                }
              />
              <Toggle
                label="تكرار الباركود يزيد الكمية"
                checked={state.settings.repeatBarcodeIncreasesQuantity}
                onChange={(value) =>
                  dispatch({
                    type: 'UPDATE_SETTINGS',
                    settings: { repeatBarcodeIncreasesQuantity: value },
                  })
                }
              />
              <Toggle
                label="إظهار الرصيد والوحدة"
                checked={state.settings.showStock}
                onChange={(value) =>
                  dispatch({ type: 'UPDATE_SETTINGS', settings: { showStock: value } })
                }
              />
            </div>
            <div className="pos-form-grid">
              <label>
                <span>طريقة العرض الافتراضية</span>
                <select
                  value={state.settings.defaultView}
                  onChange={(event) =>
                    dispatch({
                      type: 'UPDATE_SETTINGS',
                      settings: { defaultView: event.target.value as 'groups' | 'products' | 'list' },
                    })
                  }
                >
                  <option value="list">القائمة</option>
                  <option value="products">الصور</option>
                  <option value="groups">المجموعات</option>
                </select>
              </label>
            </div>
          </article>
        )}

        {/* ─── Integration Center card ──────────────────────────────────── */}
        <article className="pos-card pos-settings-integration-card">
          <header>
            <div>
              <h2>مركز التكاملات</h2>
              <span>ربط منصات التوصيل والتجارة الإلكترونية</span>
            </div>
            <button
              type="button"
              className="pos-button pos-button--primary"
              onClick={() => setView('integrations')}
            >
              فتح مركز التكاملات ←
            </button>
          </header>

          <div className="pos-integration-summary">
            <div className="pos-integration-summary__stat">
              <strong>{connectedCount}</strong>
              <small>تكامل مفعّل</small>
            </div>
            <div className="pos-integration-summary__stat">
              <strong style={{ color: errorCount > 0 ? 'var(--pos-red)' : 'inherit' }}>
                {errorCount}
              </strong>
              <small>خطأ في الاتصال</small>
            </div>
            <div className="pos-integration-summary__stat">
              <strong style={{ color: unmappedTotal > 0 ? 'var(--pos-gold)' : 'inherit' }}>
                {unmappedTotal}
              </strong>
              <small>أصناف غير مربوطة</small>
            </div>
            <div className="pos-integration-summary__stat">
              <strong>{registeredTotal}</strong>
              <small>مزود جاهز</small>
            </div>
          </div>

          {connectedCount === 0 ? (
            <div className="pos-integration-summary__empty">
              <span>🔌</span>
              لا توجد تكاملات مفعّلة — افتح مركز التكاملات للبدء.
            </div>
          ) : (
            <div className="pos-integration-pills">
              {connections.map((conn) => {
                const meta = providerRegistry.get(conn.providerId)?.meta;
                return (
                  <span
                    key={conn.id}
                    className={`pos-integration-pill ${conn.status === 'connected' ? 'is-connected' : conn.status === 'error' ? 'is-error' : 'is-paused'}`}
                    style={{ borderColor: meta?.accentColor ?? 'var(--pos-border)' }}
                  >
                    <span
                      className="pos-hub-status-dot"
                      style={{
                        background:
                          conn.status === 'connected' ? 'var(--pos-green)' :
                          conn.status === 'error' ? 'var(--pos-red)' : '#aaa',
                      }}
                    />
                    {conn.providerName}
                  </span>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
