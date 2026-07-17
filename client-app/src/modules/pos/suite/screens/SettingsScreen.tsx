import React, { useState } from 'react';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';
import { Modal } from '../components/Modal';
import type { ExternalProvider, POSMode } from '../types';

const providerNames: Record<ExternalProvider, string> = {
  hungerstation: 'هنقرستيشن',
  mrsool: 'مرسول',
};

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
      {/* eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role */}
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
  const [integration, setIntegration] = useState<ExternalProvider | null>(null);
  const [connected, setConnected] = useState<Record<ExternalProvider, boolean>>({
    hungerstation: false,
    mrsool: false,
  });
  const [step, setStep] = useState(1);

  const changeMode = (mode: POSMode) => dispatch({ type: 'SET_MODE', mode });
  const closeIntegration = () => { setIntegration(null); setStep(1); };

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

        <article className="pos-card">
          <header>
            <h2>التكاملات الخارجية</h2>
            <span>طلبات هنقرستيشن ومرسول</span>
          </header>
          <div className="pos-integration-cards">
            {(['hungerstation', 'mrsool'] as ExternalProvider[]).map((provider) => (
              <div key={provider} className={`pos-integration-card ${connected[provider] ? 'is-connected' : ''}`}>
                <div />
                <div>
                  <strong>{providerNames[provider]}</strong>
                  <span>{connected[provider] ? 'متصل' : 'غير متصل'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setIntegration(provider); setStep(1); }}
                >
                  {connected[provider] ? 'إعدادات الاتصال' : 'ربط المنصة'}
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>

      {integration ? (
        <Modal
          open
          title={`ربط ${providerNames[integration]}`}
          onClose={closeIntegration}
          width={520}
        >
          <div style={{ padding: '8px 0' }}>
            {step === 1 ? (
              <>
                <p style={{ marginBottom: 16, color: 'var(--pos-muted)' }}>
                  هذه الميزة ستتيح استقبال طلبات {providerNames[integration]} مباشرة داخل OneSoft POS
                  وربطها بفاتورة المبيعات وإرسالها للمطبخ تلقائيًا.
                </p>
                <div className="pos-form-grid">
                  <label><span>مفتاح API</span><input type="password" placeholder="أدخل المفتاح" /></label>
                  <label><span>معرّف الفرع</span><input placeholder="أدخل معرّف الفرع" /></label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button type="button" className="pos-button" onClick={closeIntegration}>إلغاء</button>
                  <button
                    type="button"
                    className="pos-button pos-button--primary"
                    onClick={() => setStep(2)}
                  >
                    اختبار الاتصال
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--pos-green)', fontWeight: 700, marginBottom: 16 }}>
                  ✓ تم الاتصال بنجاح (نموذج تجريبي)
                </p>
                <button
                  type="button"
                  className="pos-button pos-button--primary"
                  onClick={() => {
                    setConnected((prev) => ({ ...prev, [integration!]: true }));
                    closeIntegration();
                    dispatch({
                      type: 'SET_NOTICE',
                      notice: `تم ربط ${providerNames[integration!]} في نموذج الواجهة.`,
                    });
                  }}
                >
                  حفظ التكامل
                </button>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
