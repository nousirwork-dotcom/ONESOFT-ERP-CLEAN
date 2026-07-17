import React, { useMemo, useState } from 'react';
import { usePOS } from '../state';

const rows = [
  { source: 'نقطة البيع', orders: 86, sales: 12480, refunds: 220, net: 12260 },
  { source: 'هنقرستيشن', orders: 21, sales: 3240, refunds: 95, net: 3145 },
  { source: 'مرسول', orders: 14, sales: 1980, refunds: 0, net: 1980 },
];

function money(value: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function ReportsScreen() {
  const { state } = usePOS();
  const [filter, setFilter] = useState('all');
  const visible = useMemo(() => rows.filter((row) => filter === 'all' || row.source === filter), [filter]);
  const totals = visible.reduce((acc, row) => ({ orders: acc.orders + row.orders, sales: acc.sales + row.sales, refunds: acc.refunds + row.refunds, net: acc.net + row.net }), { orders: 0, sales: 0, refunds: 0, net: 0 });

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>التقارير والرقابة</small>
          <h1>لوحة تقارير OneSoft POS</h1>
          <p>تقارير موحدة للمبيعات والورديات، مع تقارير مستقلة للمطعم والمطبخ والمنصات الخارجية.</p>
        </div>
        <div className="pos-report-actions"><button type="button">طباعة</button><button type="button">تصدير Excel</button></div>
      </header>
      <div className="pos-kpi-grid">
        <article><small>إجمالي الطلبات</small><strong>{totals.orders}</strong></article>
        <article><small>إجمالي المبيعات</small><strong>{money(totals.sales)} ر.س</strong></article>
        <article><small>المرتجعات</small><strong>{money(totals.refunds)} ر.س</strong></article>
        <article className="is-highlight"><small>صافي المبيعات</small><strong>{money(totals.net)} ر.س</strong></article>
        <article><small>الوضع الحالي</small><strong>{state.mode === 'restaurant' ? 'مطعم' : 'متجر'}</strong></article>
      </div>
      <div className="pos-grid-2 pos-grid-2--reports">
        <article className="pos-card">
          <header><h2>المبيعات حسب المصدر</h2><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">كل المصادر</option>{rows.map((row) => <option key={row.source} value={row.source}>{row.source}</option>)}</select></header>
          <div className="pos-report-bars">
            {rows.map((row) => (
              <div key={row.source}><span>{row.source}</span><div><i style={{ width: `${Math.max(8, row.sales / 150)}%` }} /></div><strong>{money(row.sales)} ر.س</strong></div>
            ))}
          </div>
        </article>
        <article className="pos-card">
          <header><h2>مؤشرات الرقابة</h2></header>
          <div className="pos-audit-list">
            <div><span>خصومات بصلاحية مدير</span><strong>4 عمليات</strong></div>
            <div><span>إلغاءات بعد إرسال المطبخ</span><strong>2 عملية</strong></div>
            <div><span>فتح درج النقد دون بيع</span><strong>1 عملية</strong></div>
            <div><span>طلبات خارجية غير متطابقة</span><strong>1 طلب</strong></div>
          </div>
        </article>
      </div>
      <article className="pos-card">
        <header><h2>تفاصيل المبيعات والمنصات</h2></header>
        <div className="pos-product-table-wrap">
          <table className="pos-product-table">
            <thead><tr><th>المصدر</th><th>عدد الطلبات</th><th>المبيعات</th><th>المرتجعات</th><th>الصافي</th></tr></thead>
            <tbody>{visible.map((row) => <tr key={row.source}><td><strong>{row.source}</strong></td><td>{row.orders}</td><td>{money(row.sales)}</td><td>{money(row.refunds)}</td><td>{money(row.net)}</td></tr>)}</tbody>
          </table>
        </div>
      </article>
      <div className="pos-report-catalog">
        {[
          'تقرير الوردية والصندوق', 'مبيعات الكاشير', 'طرق الدفع', 'الخصومات والإلغاءات', 'مبيعات الطاولات والصالات', 'أداء النادل', 'متوسط وقت التحضير', 'أداء محطات المطبخ', 'تقرير هنقرستيشن', 'تقرير مرسول', 'مقارنة المنصات', 'التسويات والفروقات',
        ].map((report) => <button type="button" key={report}>{report}<span>←</span></button>)}
      </div>
    </section>
  );
}
