import { useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { toast } from 'sonner';

const TABLE_LABELS: Record<string, string> = {
  documentJournals:   'دفاتر اليومية',
  documentTypes:      'أنواع المستندات',
  branches:           'الفروع',
  warehouses:         'المخازن',
  units:              'وحدات القياس',
  productGroups:      'مجموعات الأصناف',
  paymentMethods:     'طرق الدفع',
  costCenters:        'مراكز التكلفة',
  currencies:         'العملات',
  documentTemplates:  'نماذج الطباعة',
  postingDefinitions: 'تعريفات الترحيل',
};

const POLICY_BADGE: Record<string, string> = {
  protected: 'bg-red-500/20 text-red-300 border-red-500/30',
  editable:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  flexible:  'bg-green-500/20 text-green-300 border-green-500/30',
};

const POLICY_LABEL: Record<string, string> = {
  protected: 'محمي',
  editable:  'قابل للتعديل',
  flexible:  'مرن',
};

export default function FoundationAdminTab() {
  const [showPreview, setShowPreview]       = useState(false);
  const [expandedTable, setExpandedTable]   = useState<string | null>(null);
  const [sourceOrgInput, setSourceOrgInput] = useState('');
  const [exportFkErrors, setExportFkErrors] = useState<string[]>([]);

  const templateInfoQ = trpc.foundationAdmin.getTemplateInfo.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const sourceOrgQ = trpc.foundationAdmin.getSourceOrg.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const previewQ = trpc.foundationAdmin.previewExport.useQuery(undefined, {
    enabled: showPreview,
    refetchOnWindowFocus: false,
  });

  const setSourceOrgMut = trpc.foundationAdmin.setSourceOrg.useMutation({
    onSuccess: (d) => {
      toast.success(`✅ تم تعيين مؤسسة قالب التأسيس: ${d.orgName}`);
      setSourceOrgInput('');
      sourceOrgQ.refetch();
    },
    onError: (e) => toast.error('فشل تعيين المؤسسة', { description: e.message }),
  });

  const exportMut = trpc.foundationAdmin.exportTemplate.useMutation({
    onSuccess: (d) => {
      setExportFkErrors([]);
      toast.success(`✅ تم تصدير ${d.totalRecords} سجل من المؤسسة ${d.sourceOrgId}`, {
        description: 'ملف القالب: foundation-data.json',
        duration: 6000,
      });
      templateInfoQ.refetch();
    },
    onError: (e) => {
      const lines = e.message.split('\n');
      const isPrecondition = e.message.includes('علاقة غير محلولة') || lines.length > 1;
      if (isPrecondition && lines.length > 1) {
        setExportFkErrors(lines.slice(1).filter(Boolean));
      } else {
        setExportFkErrors([]);
      }
      toast.error('فشل التصدير', { description: lines[0] });
    },
  });

  const applyMut = trpc.foundationAdmin.applyTemplate.useMutation({
    onSuccess: (d) => {
      toast.success(`✅ تم تطبيق القالب`, {
        description: `مُدرَج: ${d.inserted} | موجود مسبقاً: ${d.skipped} | أخطاء: ${d.errors.length}`,
        duration: 6000,
      });
    },
    onError: (e) => toast.error('فشل التطبيق', { description: e.message }),
  });

  const info       = templateInfoQ.data;
  const sourceOrg  = sourceOrgQ.data;
  const hasSourceOrg = !!sourceOrg?.sourceOrgId;

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── مؤسسة قالب التأسيس ─────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xl">🏢</div>
          <div>
            <h3 className="font-semibold text-lg">مؤسسة قالب التأسيس</h3>
            <p className="text-xs text-slate-400">التصدير يقرأ السجلات من هذه المؤسسة فقط</p>
          </div>
        </div>

        {sourceOrgQ.isLoading ? (
          <div className="text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
        ) : hasSourceOrg ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-lg">✅</span>
              <div>
                <p className="text-sm font-medium">
                  {sourceOrg.orgName ?? `مؤسسة #${sourceOrg.sourceOrgId}`}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  id={sourceOrg.sourceOrgId}
                  {sourceOrg.orgCode ? ` · ${sourceOrg.orgCode}` : ''}
                </p>
              </div>
            </div>
            {sourceOrgInput === '' && (
              <button
                onClick={() => setSourceOrgInput(String(sourceOrg.sourceOrgId ?? ''))}
                className="text-xs text-slate-400 hover:text-slate-200 underline transition"
              >
                تغيير
              </button>
            )}
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-300 text-sm mb-3">
            ⚠️ لم يتم تعيين مؤسسة مصدر — التصدير والمعاينة معطّلان حتى يتم التعيين.
          </div>
        )}

        {(!hasSourceOrg || sourceOrgInput !== '') && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number"
              min={1}
              value={sourceOrgInput}
              onChange={(e) => setSourceOrgInput(e.target.value)}
              placeholder="رقم المؤسسة (org id)"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              dir="ltr"
            />
            <button
              onClick={() => {
                const id = parseInt(sourceOrgInput, 10);
                if (!id || id < 1) { toast.error('أدخل رقماً صحيحاً أكبر من صفر'); return; }
                setSourceOrgMut.mutate({ sourceOrgId: id });
              }}
              disabled={setSourceOrgMut.isPending || !sourceOrgInput}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              {setSourceOrgMut.isPending ? '⏳' : 'حفظ'}
            </button>
            {sourceOrgInput !== '' && hasSourceOrg && (
              <button
                onClick={() => setSourceOrgInput('')}
                className="text-slate-400 hover:text-slate-200 text-sm px-2 py-2 transition"
              >
                إلغاء
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── إصدار القالب ───────────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl">📦</div>
            <div>
              <h3 className="font-semibold text-lg">قالب التأسيس الرسمي</h3>
              <p className="text-xs text-slate-400">السجلات المُضمَّنة في foundation-data.json</p>
            </div>
          </div>
          {info?.exists && (
            <span className="text-xs bg-violet-600/20 text-violet-300 border border-violet-500/30 px-3 py-1 rounded-full font-mono">
              v{info.version}
            </span>
          )}
        </div>

        {templateInfoQ.isLoading ? (
          <div className="text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
        ) : info?.exists ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">إجمالي السجلات</p>
                <p className="text-2xl font-bold text-violet-400">{info.totalRecords}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">تاريخ آخر تصدير</p>
                <p className="text-sm font-medium">
                  {new Date(info.exportedAt ?? '').toLocaleString('ar-SA')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(info.counts ?? {}).map(([k, v]) => (
                v > 0 ? (
                  <div key={k} className="bg-slate-700/30 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{TABLE_LABELS[k] ?? k}</span>
                    <span className="text-sm font-bold text-white">{v}</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-amber-300 text-sm">
            ⚠️ لم يتم تصدير أي قالب بعد. انقر على «تصدير القالب» أدناه لإنشاء القالب الأولي.
          </div>
        )}
      </div>

      {/* ── إجراءات ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* معاينة */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>🔍</span> معاينة ما سيُصدَّر
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            عرض سجلات المؤسسة المصدر المُحدَّدة للإدراج، مع تحذيرات العلاقات المفقودة.
          </p>
          <button
            onClick={() => setShowPreview(v => !v)}
            disabled={!hasSourceOrg}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm px-4 py-2.5 rounded-lg transition"
          >
            {showPreview ? 'إخفاء المعاينة' : 'عرض المعاينة'}
          </button>
          {!hasSourceOrg && (
            <p className="text-xs text-amber-400 mt-2">يجب تعيين المؤسسة المصدر أولاً</p>
          )}
        </div>

        {/* تصدير */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>📤</span> تصدير قالب التأسيس
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            يُصدِّر سجلات المؤسسة المصدر. يتوقف التصدير تلقائياً إذا وُجدت علاقات (FK) غير محلولة.
          </p>
          <button
            onClick={() => {
              if (confirm('هل تريد تصدير القالب الآن؟ سيُستبدل الملف الموجود.')) {
                setExportFkErrors([]);
                exportMut.mutate();
              }
            }}
            disabled={exportMut.isPending || !hasSourceOrg}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg transition"
          >
            {exportMut.isPending ? '⏳ جاري التصدير...' : '📤 تصدير القالب'}
          </button>
          {!hasSourceOrg && (
            <p className="text-xs text-amber-400 mt-2">يجب تعيين المؤسسة المصدر أولاً</p>
          )}
        </div>

        {/* تطبيق على هذه المنظمة */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 col-span-2">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>📥</span> تطبيق القالب على هذه المنظمة
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            يُضيف السجلات التأسيسية الجديدة فقط التي لا توجد foundationKey مطابقة. لا يُعدّل أو يحذف أي سجل موجود.
            يحل علاقات الفرع والمخزن والحسابات تلقائياً عبر foundationKey.
          </p>
          <button
            onClick={() => {
              if (confirm('تطبيق القالب على هذه المنظمة؟ السجلات الموجودة لن تتأثر.')) {
                applyMut.mutate();
              }
            }}
            disabled={applyMut.isPending || !info?.exists}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-6 py-2.5 rounded-lg transition"
          >
            {applyMut.isPending ? '⏳ جاري التطبيق...' : '📥 تطبيق القالب'}
          </button>
          {!info?.exists && (
            <p className="text-xs text-amber-400 mt-2">يجب تصدير القالب أولاً</p>
          )}
          {applyMut.isSuccess && (
            <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
              <p className="text-green-300">
                مُدرَج: {applyMut.data?.inserted} | موجود مسبقاً: {applyMut.data?.skipped}
              </p>
              {(applyMut.data?.errors ?? []).length > 0 && (
                <div className="mt-2 text-red-300 text-xs space-y-1">
                  {applyMut.data?.errors?.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── أخطاء FK من التصدير (حاسمة) ──────────────────────────────── */}
      {exportFkErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-400 text-lg">🚫</span>
            <h4 className="font-semibold text-red-300">التصدير متوقف — علاقات غير محلولة</h4>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            السجلات التالية تُشير إلى سجلات بلا foundationKey. فعّل «إدراج في قالب التأسيس» على هذه السجلات أولاً:
          </p>
          <div className="space-y-1.5">
            {exportFkErrors.map((err, i) => (
              <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-300">
                {err}
              </div>
            ))}
          </div>
          <button
            onClick={() => setExportFkErrors([])}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* ── معاينة السجلات ─────────────────────────────────────── */}
      {showPreview && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h4 className="font-semibold mb-4">
            📋 معاينة السجلات المُرشَّحة للتصدير
            {previewQ.data?.sourceOrgId && (
              <span className="text-sm text-slate-400 font-normal mr-2">
                (من المؤسسة #{previewQ.data.sourceOrgId})
              </span>
            )}
          </h4>

          {(previewQ.data?.warnings ?? []).length > 0 && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-300 text-sm font-medium mb-2">⚠️ تحذيرات العلاقات — ستمنع التصدير:</p>
              {previewQ.data?.warnings?.map((w, i) => (
                <p key={i} className="text-amber-400 text-xs">{w}</p>
              ))}
            </div>
          )}

          {previewQ.isLoading ? (
            <div className="text-slate-400 text-sm animate-pulse">جاري المعاينة...</div>
          ) : previewQ.isError ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-300 text-sm">
              {previewQ.error?.message}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(previewQ.data?.preview ?? {}).map(([tableName, records]) => {
                if (!records.length) return null;
                const isExpanded = expandedTable === tableName;
                return (
                  <div key={tableName} className="border border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedTable(isExpanded ? null : tableName)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700 transition text-right"
                    >
                      <span className="font-medium text-sm">
                        {TABLE_LABELS[tableName] ?? tableName}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="bg-violet-600/30 text-violet-300 text-xs px-2 py-0.5 rounded-full">
                          {records.length} سجل
                        </span>
                        <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="divide-y divide-slate-700/50">
                        {records.map((r, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{r.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{r.foundationKey}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${POLICY_BADGE[r.policy] ?? POLICY_BADGE.flexible}`}>
                              {POLICY_LABEL[r.policy] ?? r.policy}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!previewQ.data?.totalRecords && (
                <p className="text-slate-400 text-sm text-center py-4">
                  لا توجد سجلات مُحدَّدة للتصدير — فعّل «إدراج ضمن قالب التأسيس» على السجلات المطلوبة.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
