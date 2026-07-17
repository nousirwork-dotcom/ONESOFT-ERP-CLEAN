import React from 'react';
import { usePOS } from '../state';

function money(value: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const reportLinks = [
  'تقرير الوردية والصندوق',
  'مبيعات الكاشير',
  'طرق الدفع',
  'الخصومات والإلغاءات',
  'مبيعات الطاولات والصالات',
  'أداء النادل',
  'متوسط وقت التحضير',
  'أداء محطات المطبخ',
  'تقرير هنقرستيشن',
  'تقرير مرسول',
  'مقارنة المنصات',
  'التسويات والفروقات',
];

export function ReportsScreen() {
  const { state, dispatch } = usePOS();

  const handleReportClick = (report: string) => {
    dispatch({ type: 'SET_NOTICE', notice: `تقرير "${report}" سيكون متاحاً بعد ربط خدمة الحفظ.` });
  };

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>التقارير والرقابة</small>
          <h1>لوحة تقارير OneSoft POS</h1>
          <p>
            تقارير موحدة للمبيعات والورديات، مع تقارير مستقلة للمطعم والمطبخ والمنصات الخارجية.
            {' '}البيانات ستُحدَّث فور ربط خدمة حفظ الفاتورة.
          </p>
        </div>
        <div className="pos-report-actions">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'الطباعة ستكون متاحة بعد ربط خدمة الحفظ.' })}
          >
            طباعة
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'تصدير Excel سيكون متاحاً بعد ربط خدمة الحفظ.' })}
          >
            تصدير Excel
          </button>
        </div>
      </header>

      <div className="pos-kpi-grid">
        <article><small>إجمالي الطلبات</small><strong>0</strong></article>
        <article><small>إجمالي المبيعات</small><strong>{money(0)} ر.س</strong></article>
        <article><small>المرتجعات</small><strong>{money(0)} ر.س</strong></article>
        <article className="is-highlight"><small>صافي المبيعات</small><strong>{money(0)} ر.س</strong></article>
        <article><small>الوضع الحالي</small><strong>{state.mode === 'restaurant' ? 'مطعم' : 'متجر'}</strong></article>
      </div>

      <div className="pos-grid-2">
        <article className="pos-card">
          <header><h2>المبيعات حسب المصدر</h2></header>
          <div className="pos-empty-state" style={{ minHeight: 120 }}>
            <strong>لا توجد بيانات مبيعات بعد</strong>
            <span>ستظهر هنا بيانات المبيعات الفعلية بعد ربط خدمة حفظ الفاتورة.</span>
          </div>
        </article>

        <article className="pos-card">
          <header><h2>مؤشرات الرقابة</h2></header>
          <div className="pos-empty-state" style={{ minHeight: 120 }}>
            <strong>لا توجد أحداث رقابية</strong>
            <span>ستظهر هنا الخصومات والإلغاءات وحركات الصندوق الاستثنائية.</span>
          </div>
        </article>
      </div>

      <article className="pos-card">
        <header><h2>تفاصيل المبيعات والمنصات</h2></header>
        <div className="pos-empty-state" style={{ minHeight: 120 }}>
          <strong>لا توجد فواتير مسجّلة في هذه الجلسة</strong>
          <span>ستظهر هنا بيانات الفواتير التفصيلية فور ربط خدمة الحفظ.</span>
        </div>
      </article>

      <div className="pos-report-catalog">
        {reportLinks.map((report) => (
          <button
            type="button"
            key={report}
            onClick={() => handleReportClick(report)}
          >
            {report}
            <span>←</span>
          </button>
        ))}
      </div>
    </section>
  );
}
