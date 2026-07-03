import { fmtDate } from "@/shared/utils/dateUtils";
import { useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { toast } from 'sonner';

export default function SuperAdminPage() {
  
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showAddUser, setShowAddUser] = useState<number | null>(null);
  const [newOrg, setNewOrg] = useState({
    code: '', name: '', phone: '', email: '', address: '',
    taxNumber: '', currency: 'SAR', maxUsers: 5,
    subscriptionExpiry: '',
    adminUsername: '', adminPassword: '', adminName: '',
  });

  const orgsQuery = trpc.orgs.list.useQuery();
  const createOrgMutation = trpc.orgs.create.useMutation({
    onSuccess: () => {
      toast.success('تم إنشاء المؤسسة بنجاح');
      setShowAddOrg(false);
      setNewOrg({ code: '', name: '', phone: '', email: '', address: '', taxNumber: '', currency: 'SAR', maxUsers: 5, subscriptionExpiry: '', adminUsername: '', adminPassword: '', adminName: '' });
      orgsQuery.refetch();
    },
    onError: (err) => toast.error('خطأ', { description: err.message }),
  });

  const updateOrgMutation = trpc.orgs.update.useMutation({
    onSuccess: () => { toast.success('تم التحديث'); orgsQuery.refetch(); },
  });

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    createOrgMutation.mutate({ ...newOrg, maxUsers: Number(newOrg.maxUsers) });
  };

  const toggleOrgStatus = (org: any) => {
    const newStatus = org.status === 'active' ? 'suspended' : 'active';
    updateOrgMutation.mutate({ id: org.id, status: newStatus });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white" dir="rtl">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">O</div>
          <div>
            <h1 className="font-bold text-lg">OneSoft ERP</h1>
            <p className="text-xs text-slate-400">لوحة تحكم المدير العام</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.href = '/dev/source-code'}
            title="مستعرض الكود البرمجي"
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '6px 14px', color: '#94a3b8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 14 }}>🗂️</span> مستعرض الكود
          </button>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); window.location.href = '/login'; }}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'إجمالي المؤسسات', value: orgsQuery.data?.filter(o => o.code !== 'SYSTEM').length || 0, color: 'blue' },
            { label: 'مؤسسات نشطة', value: orgsQuery.data?.filter(o => o.status === 'active' && o.code !== 'SYSTEM').length || 0, color: 'green' },
            { label: 'مؤسسات معلقة', value: orgsQuery.data?.filter(o => o.status === 'suspended').length || 0, color: 'red' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* قائمة المؤسسات */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="font-semibold text-lg">المؤسسات المشتركة</h2>
            <button
              onClick={() => setShowAddOrg(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              + إضافة مؤسسة
            </button>
          </div>

          {orgsQuery.isLoading ? (
            <div className="p-8 text-center text-slate-400">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50 text-slate-300">
                  <tr>
                    <th className="text-right px-4 py-3">الكود</th>
                    <th className="text-right px-4 py-3">اسم المؤسسة</th>
                    <th className="text-right px-4 py-3">الهاتف</th>
                    <th className="text-right px-4 py-3">الحالة</th>
                    <th className="text-right px-4 py-3">انتهاء الاشتراك</th>
                    <th className="text-right px-4 py-3">المستخدمون</th>
                    <th className="text-right px-4 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {orgsQuery.data?.filter(o => o.code !== 'SYSTEM').map((org) => (
                    <tr key={org.id} className="hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400">{org.code}</td>
                      <td className="px-4 py-3 font-medium">{org.name}</td>
                      <td className="px-4 py-3 text-slate-400">{org.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          org.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          org.status === 'suspended' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          org.status === 'trial' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {org.status === 'active' ? 'نشط' : org.status === 'suspended' ? 'معلق' : org.status === 'trial' ? 'تجريبي' : 'منتهي'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {org.subscriptionExpiry ? fmtDate(org.subscriptionExpiry) : 'غير محدد'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{org.maxUsers}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleOrgStatus(org)}
                            className={`text-xs px-3 py-1 rounded-lg transition ${
                              org.status === 'active'
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                            }`}
                          >
                            {org.status === 'active' ? 'تعليق' : 'تفعيل'}
                          </button>
                          <button
                            onClick={() => setShowAddUser(org.id)}
                            className="text-xs px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition"
                          >
                            + مستخدم
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal إضافة مؤسسة */}
      {showAddOrg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddOrg(false)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">إضافة مؤسسة جديدة</h3>
              <button onClick={() => setShowAddOrg(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">كود المؤسسة *</label>
                  <input value={newOrg.code} onChange={e => setNewOrg(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="COMP01" required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">اسم المؤسسة *</label>
                  <input value={newOrg.name} onChange={e => setNewOrg(f => ({ ...f, name: e.target.value }))}
                    placeholder="شركة ..." required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">الهاتف</label>
                  <input value={newOrg.phone} onChange={e => setNewOrg(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">البريد الإلكتروني</label>
                  <input type="email" value={newOrg.email} onChange={e => setNewOrg(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">الرقم الضريبي</label>
                  <input value={newOrg.taxNumber} onChange={e => setNewOrg(f => ({ ...f, taxNumber: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">تاريخ انتهاء الاشتراك</label>
                  <input type="date" value={newOrg.subscriptionExpiry} onChange={e => setNewOrg(f => ({ ...f, subscriptionExpiry: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">عدد المستخدمين المسموح</label>
                  <input type="number" value={newOrg.maxUsers} onChange={e => setNewOrg(f => ({ ...f, maxUsers: +e.target.value }))}
                    min={1} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">العملة</label>
                  <select value={newOrg.currency} onChange={e => setNewOrg(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-300 mb-3">بيانات مدير المؤسسة</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">اسم المستخدم *</label>
                    <input value={newOrg.adminUsername} onChange={e => setNewOrg(f => ({ ...f, adminUsername: e.target.value }))}
                      required placeholder="admin" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">كلمة المرور *</label>
                    <input type="password" value={newOrg.adminPassword} onChange={e => setNewOrg(f => ({ ...f, adminPassword: e.target.value }))}
                      required minLength={6} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">الاسم الكامل *</label>
                    <input value={newOrg.adminName} onChange={e => setNewOrg(f => ({ ...f, adminName: e.target.value }))}
                      required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createOrgMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition text-sm">
                  {createOrgMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المؤسسة'}
                </button>
                <button type="button" onClick={() => setShowAddOrg(false)}
                  className="px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
