/**
 * ReDocumentsFullPage.tsx -- أوراق ومستندات المشروع (Phase 2)
 * Projects → Project Detail → Documents + File Upload + Versions
 */
import { useState, useRef, useMemo } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import {
  FolderOpen, ArrowRight, ArrowLeft, Search, Plus, Pencil, Trash2, Eye,
  Upload, X, Save, FileText, AlertTriangle, CheckCircle2, Download,
  Printer, FileSpreadsheet, ChevronLeft, Calendar, Clock, FileDown,
  History, Copy, Move, HardHat, Layout, Construction, Zap, Cog, Map,
  Mountain, Ruler, FileSignature, Truck, Shield, Award, Home,
  ClipboardCheck, FileBadge, Filter, SortAsc, SortDesc, ChevronDown,
  ChevronUp, Image, FileArchive, Ban, Check, Building2,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen } from "@/shared/lib/hsPermissions";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, HardHat, Layout, Construction, Zap, Cog, Map, Mountain, Ruler,
  FileSignature, Truck, Shield, Award, Home, ClipboardCheck, FileBadge, FolderOpen,
};

const C = { primary: "#406B93", border: "#D0D0D0", bgAlt: "#FAFAFA", header: "#E8EEF4", danger: "#C0392B", warn: "#F59E0B", success: "#16A34A", gray: "#9CA3AF" };

export default function ReDocumentsFullPage() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const utils = trpc.useUtils();
  const [view, setView] = useState<"projects" | "projectDetail" | "projectForm" | "documentForm">("projects");
  const [selProjectId, setSelProjectId] = useState<number|null>(null);
  const [projForm, setProjForm] = useState<any>({ name:'', code:'', location:'', ownerName:'', plotNumber:'', planNumber:'', startDate:'', expectedEndDate:'', status:'active', notes:'' });
  const [projEditId, setProjEditId] = useState<number|null>(null);
  const [search, setSearch] = useState('');
  const [docFilter, setDocFilter] = useState<{typeId?:number, status?:string, issuer?:string}>({});
  const [docSort, setDocSort] = useState<{by:string, dir:'asc'|'desc'}>({by:'name', dir:'asc'});

  // Document form
  const [docForm, setDocForm] = useState<any>({
    name:'', documentNumber:'', issuer:'', issueDate:'', expiryDate:'',
    needsRenewal:false, alertDays:30, notes:'', documentTypeId:null,
  });
  const [docEditId, setDocEditId] = useState<number|null>(null);
  const [fileData, setFileData] = useState<{data:string, name:string, size:number, mime:string}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [showDelProject, setShowDelProject] = useState<number|null>(null);
  const [showDelDoc, setShowDelDoc] = useState<number|null>(null);
  const [showVersions, setShowVersions] = useState<number|null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState({name:'', icon:'FileText'});
  const [typeEditId, setTypeEditId] = useState<number|null>(null);

  // Queries
  const projectsQ = trpc.reDocuments.listProjects.useQuery(undefined, { enabled: view === 'projects' || view === 'projectDetail' });
  const projectQ = trpc.reDocuments.getProject.useQuery(selProjectId ?? 0, { enabled: !!selProjectId });
  const typesQ = trpc.reDocuments.listDocumentTypes.useQuery(undefined, { enabled: true });
  const docsQ = trpc.reDocuments.listDocuments.useQuery(
    { projectId: selProjectId ?? 0, search: docFilter.issuer ? undefined : undefined, documentTypeId: docFilter.typeId, issuer: docFilter.issuer, status: docFilter.status as any, sortBy: docSort.by as any, sortDir: docSort.dir },
    { enabled: !!selProjectId && view === 'projectDetail' }
  );
  const statsQ = trpc.reDocuments.getProjectStats.useQuery(selProjectId ?? 0, { enabled: !!selProjectId });
  const alertsQ = trpc.reDocuments.getAlerts.useQuery(undefined, { enabled: true });

  // Mutations
  const createProject = trpc.reDocuments.createProject.useMutation({ onSuccess: () => { toast.success(ar ? 'تم إضافة المشروع' : 'Project added'); utils.reDocuments.listProjects.invalidate(); setView('projects'); setProjForm({}); setProjEditId(null); } });
  const updateProject = trpc.reDocuments.updateProject.useMutation({ onSuccess: () => { toast.success(ar ? 'تم تحديث المشروع' : 'Project updated'); utils.reDocuments.listProjects.invalidate(); projectQ.refetch(); setView('projectDetail'); setProjEditId(null); } });
  const deleteProject = trpc.reDocuments.deleteProject.useMutation({ onSuccess: () => { toast.success(ar ? 'تم حذف المشروع' : 'Project deleted'); utils.reDocuments.listProjects.invalidate(); setShowDelProject(null); setView('projects'); setSelProjectId(null); } });
  const createDoc = trpc.reDocuments.createDocument.useMutation({ onSuccess: () => { toast.success(ar ? 'تم إضافة المستند' : 'Document added'); utils.reDocuments.listDocuments.invalidate(); statsQ.refetch(); setView('projectDetail'); resetDocForm(); } });
  const updateDoc = trpc.reDocuments.updateDocument.useMutation({ onSuccess: () => { toast.success(ar ? 'تم تحديث المستند' : 'Document updated'); utils.reDocuments.listDocuments.invalidate(); setView('projectDetail'); resetDocForm(); } });
  const deleteDoc = trpc.reDocuments.deleteDocument.useMutation({ onSuccess: () => { toast.success(ar ? 'تم حذف المستند' : 'Document deleted'); utils.reDocuments.listDocuments.invalidate(); statsQ.refetch(); setShowDelDoc(null); } });
  const createType = trpc.reDocuments.createDocumentType.useMutation({ onSuccess: () => { toast.success(ar ? 'تم إضافة النوع' : 'Type added'); utils.reDocuments.listDocumentTypes.invalidate(); setShowTypeForm(false); setTypeForm({name:'',icon:'FileText'}); } });
  const updateType = trpc.reDocuments.updateDocumentType.useMutation({ onSuccess: () => { toast.success(ar ? 'تم تحديث النوع' : 'Type updated'); utils.reDocuments.listDocumentTypes.invalidate(); setShowTypeForm(false); setTypeEditId(null); } });
  const deleteType = trpc.reDocuments.deleteDocumentType.useMutation({ onSuccess: () => { toast.success(ar ? 'تم حذف النوع' : 'Type deleted'); utils.reDocuments.listDocumentTypes.invalidate(); }, onError: (e) => toast.error(e.message) });
  const replaceFile = trpc.reDocuments.replaceFile.useMutation({ onSuccess: () => { toast.success(ar ? 'تم استبدال الملف' : 'File replaced'); utils.reDocuments.listDocuments.invalidate(); setFileData(null); } });
  const exportDocs = trpc.reDocuments.exportDocuments.useQuery(
    { projectId: selProjectId ?? 0, format: 'json' },
    { enabled: false }
  );

  function resetDocForm() {
    setDocForm({ name:'', documentNumber:'', issuer:'', issueDate:'', expiryDate:'', needsRenewal:false, alertDays:30, notes:'', documentTypeId:null });
    setDocEditId(null); setFileData(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const maxSize = 20 * 1024 * 1024;
    if (f.size > maxSize) { toast.error(ar ? 'حجم الملف يتجاوز 20 ميجا' : 'File exceeds 20 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = typeof reader.result === 'string' ? reader.result : '';
      setFileData({ data, name: f.name, size: f.size, mime: f.type });
    };
    reader.readAsDataURL(f);
  }

  function saveDocument(another = false) {
    if (!docForm.name.trim()) { toast.error(ar ? 'اسم المستند مطلوب' : 'Document name required'); return; }
    if (!docForm.documentTypeId) { toast.error(ar ? 'نوع المستند مطلوب' : 'Document type required'); return; }
    if (!selProjectId) return;
    const payload = {
      projectId: selProjectId,
      documentTypeId: docForm.documentTypeId,
      name: docForm.name.trim(),
      documentNumber: docForm.documentNumber || undefined,
      issuer: docForm.issuer || undefined,
      issueDate: docForm.issueDate || undefined,
      expiryDate: docForm.expiryDate || undefined,
      needsRenewal: docForm.needsRenewal,
      alertDays: docForm.alertDays,
      notes: docForm.notes || undefined,
      ...(fileData ? {
        fileData: fileData.data,
        originalName: fileData.name,
        fileSize: fileData.size,
        mimeType: fileData.mime,
      } : {}),
    };
    if (docEditId) {
      updateDoc.mutate({ id: docEditId, ...payload });
    } else {
      createDoc.mutate(payload, { onSuccess: () => {
        if (another) { resetDocForm(); toast.success(ar ? 'تم الحفظ. أضف جديداً' : 'Saved. Add another'); }
      }});
    }
  }

  // ─── Views ────────────────────────────────────────────────────────────────────────────

  // ── Projects List ──────────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!projectsQ.data) return [];
    if (!search.trim()) return projectsQ.data;
    const s = search.toLowerCase();
    return projectsQ.data.filter(p =>
      p.name.toLowerCase().includes(s) ||
      p.code.toLowerCase().includes(s) ||
      (p.location && p.location.toLowerCase().includes(s))
    );
  }, [projectsQ.data, search]);

  if (view === "projects") {
    return (
      <div className="h-full overflow-y-auto bg-background" dir={dir}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openTab('/hs/real-estate', ar ? 'المطور العقاري' : 'Real Estate', Building2)} className="gap-1 text-muted-foreground">
                <BackIcon className="w-4 h-4" />{ar ? 'المطور العقاري' : 'Real Estate'}
              </Button>
            </div>
            <Button size="sm" onClick={() => { setProjForm({ name:'', code:'', location:'', ownerName:'', plotNumber:'', planNumber:'', startDate:'', expectedEndDate:'', status:'active', notes:'' }); setProjEditId(null); setView('projectForm'); }}>
              <Plus className="w-4 h-4 me-1" />{ar ? 'إضافة مشروع جديد' : 'New Project'}
            </Button>
          </div>
          <h1 className="text-lg font-bold mb-3">{ar ? 'ملفات المشروعات' : 'Project Files'}</h1>

          {/* Loading / Error states */}
          {projectsQ.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {projectsQ.isError && (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertTriangle className="w-5 h-5 me-2" />
              <span className="text-sm">{ar ? 'خطأ في تحميل البيانات' : 'Error loading data'}</span>
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? 'بحث باسم المشروع أو الكود أو الموقع...' : 'Search by name, code, or location...'}
                className="w-full h-9 ps-9 pe-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>
          </div>

          {/* Projects Table */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: C.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold" style={{ background: C.header }}>
                  <th className="px-3 py-2 text-center">#</th>
                  <th className="px-3 py-2">{ar ? 'الكود' : 'Code'}</th>
                  <th className="px-3 py-2">{ar ? 'اسم المشروع' : 'Project Name'}</th>
                  <th className="px-3 py-2">{ar ? 'الموقع' : 'Location'}</th>
                  <th className="px-3 py-2 text-center">{ar ? 'المستندات' : 'Docs'}</th>
                  <th className="px-3 py-2 text-center">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-2">{ar ? 'تاريخ الإضافة' : 'Created'}</th>
                  <th className="px-3 py-2 text-center">{ar ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, i) => (
                  <tr key={p.id} className="border-t hover:bg-muted/40" style={{ borderColor: C.border }}>
                    <td className="px-3 py-2 text-center text-muted-foreground">{i+1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.location || '-'}</td>
                    <td className="px-3 py-2 text-center">{statsQ.data?.total ?? '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${p.status==='active'?'bg-green-100 text-green-700':p.status==='paused'?'bg-yellow-100 text-yellow-700':'bg-blue-100 text-blue-700'}`}>
                        {p.status==='active'?(ar?'قائم':'Active'):p.status==='paused'?(ar?'متوقف':'Paused'):(ar?'مكتمل':'Completed')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SA') : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelProjectId(p.id); setView('projectDetail'); }} title={ar ? 'فتح' : 'Open'}>
                          <Eye className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                          setProjForm({ name:p.name, code:p.code, location:p.location||'', ownerName:p.ownerName||'', plotNumber:p.plotNumber||'', planNumber:p.planNumber||'', startDate:p.startDate?new Date(p.startDate).toISOString().split('T')[0]:'', expectedEndDate:p.expectedEndDate?new Date(p.expectedEndDate).toISOString().split('T')[0]:'', status:p.status, notes:p.notes||'' });
                          setProjEditId(p.id); setView('projectForm');
                        }} title={ar ? 'تعديل' : 'Edit'}>
                          <Pencil className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowDelProject(p.id)} title={ar ? 'حذف' : 'Delete'}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">{ar ? 'لا توجد مشروعات' : 'No projects found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Project Dialog */}
        {showDelProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDelProject(null)}>
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg" dir={dir} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <h3 className="text-lg font-bold">{ar ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{ar ? 'سيتم حذف المشروع وجميع مستنداته وملفاته نهائياً. هل أنت متأكد؟' : 'The project and all its documents and files will be permanently deleted. Are you sure?'}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDelProject(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteProject.mutate({ id: showDelProject })}>{ar ? 'حذف' : 'Delete'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Project Detail ──────────────────────────────────────────────────────────────────
  if (view === "projectDetail" && selProjectId) {
    if (projectQ.isLoading) {
      return (
        <div className="h-full flex items-center justify-center" dir={dir}>
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!projectQ.data) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground" dir={dir}>
          <p className="text-sm">{ar ? 'لم يتم العثور على بيانات المشروع' : 'Project data not found'}</p>
        </div>
      );
    }
    const proj = projectQ.data;
    const docs = (docsQ.data ?? []) as any[];
    const types = typesQ.data ?? [];
    return (
      <div className="h-full overflow-y-auto bg-background" dir={dir}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" onClick={() => { setView('projects'); setSelProjectId(null); }} className="gap-1 text-muted-foreground">
              <BackIcon className="w-4 h-4" />{ar ? 'قائمة المشروعات' : 'Projects List'}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                setProjForm({ name:proj.name, code:proj.code, location:proj.location||'', ownerName:proj.ownerName||'', plotNumber:proj.plotNumber||'', planNumber:proj.planNumber||'', startDate:proj.startDate?new Date(proj.startDate).toISOString().split('T')[0]:'', expectedEndDate:proj.expectedEndDate?new Date(proj.expectedEndDate).toISOString().split('T')[0]:'', status:proj.status, notes:proj.notes||'' });
                setProjEditId(proj.id); setView('projectForm');
              }}>
                <Pencil className="w-3.5 h-3.5 me-1" />{ar ? 'تعديل المشروع' : 'Edit Project'}
              </Button>
              <Button size="sm" onClick={() => { resetDocForm(); setView('documentForm'); }}>
                <Plus className="w-4 h-4 me-1" />{ar ? 'إضافة مستند' : 'Add Document'}
              </Button>
            </div>
          </div>

          {/* Project Info Card */}
          <div className="border rounded-lg p-4 mb-4" style={{ borderColor: C.border, background: C.bgAlt }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-[11px] text-muted-foreground">{ar ? 'اسم المشروع' : 'Project Name'}</div><div className="font-bold text-sm">{proj.name}</div></div>
              <div><div className="text-[11px] text-muted-foreground">{ar ? 'الكود' : 'Code'}</div><div className="font-mono text-xs">{proj.code}</div></div>
              <div><div className="text-[11px] text-muted-foreground">{ar ? 'الموقع' : 'Location'}</div><div className="text-sm">{proj.location || '-'}</div></div>
              <div><div className="text-[11px] text-muted-foreground">{ar ? 'الحالة' : 'Status'}</div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${proj.status==='active'?'bg-green-100 text-green-700':proj.status==='paused'?'bg-yellow-100 text-yellow-700':'bg-blue-100 text-blue-700'}`}>
                  {proj.status==='active'?(ar?'قائم':'Active'):proj.status==='paused'?(ar?'متوقف':'Paused'):(ar?'مكتمل':'Completed')}
                </span>
              </div>
            </div>
            {/* Stats */}
            <div className="flex gap-4 mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
              <div className="text-center"><div className="text-lg font-bold">{statsQ.data?.total ?? 0}</div><div className="text-[11px] text-muted-foreground">{ar ? 'المستندات' : 'Documents'}</div></div>
              <div className="text-center"><div className="text-lg font-bold text-green-600">{statsQ.data?.active ?? 0}</div><div className="text-[11px] text-muted-foreground">{ar ? 'سارية' : 'Active'}</div></div>
              <div className="text-center"><div className="text-lg font-bold text-orange-500">{statsQ.data?.expiring ?? 0}</div><div className="text-[11px] text-muted-foreground">{ar ? 'قارب الانتهاء' : 'Expiring'}</div></div>
              <div className="text-center"><div className="text-lg font-bold text-red-500">{statsQ.data?.expired ?? 0}</div><div className="text-[11px] text-muted-foreground">{ar ? 'منتهية' : 'Expired'}</div></div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? 'بحث باسم أو رقم المستند...' : 'Search by name or number...'}
                className="w-full h-8 ps-9 pe-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>
            <select value={docFilter.typeId || ''} onChange={e => setDocFilter({...docFilter, typeId: e.target.value ? Number(e.target.value) : undefined})}
              className="h-8 px-2 text-sm border rounded-md bg-white" style={{ borderColor: C.border }}>
              <option value="">{ar ? 'كل الأنواع' : 'All Types'}</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={docFilter.status || ''} onChange={e => setDocFilter({...docFilter, status: e.target.value || undefined})}
              className="h-8 px-2 text-sm border rounded-md bg-white" style={{ borderColor: C.border }}>
              <option value="">{ar ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="active">{ar ? 'ساري' : 'Active'}</option>
              <option value="expiring">{ar ? 'قارب على الانتهاء' : 'Expiring'}</option>
              <option value="expired">{ar ? 'منتهي' : 'Expired'}</option>
              <option value="no_expiry">{ar ? 'بدون تاريخ' : 'No Expiry'}</option>
            </select>
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => { setSearch(''); setDocFilter({}); }}>
              <Filter className="w-3.5 h-3.5" />{ar ? 'إعادة' : 'Reset'}
            </Button>
          </div>

          {/* Document Types Sidebar + Table */}
          <div className="flex gap-4">
            {/* Types sidebar */}
            <div className="w-48 shrink-0 border rounded-lg overflow-hidden" style={{ borderColor: C.border }}>
              <div className="px-3 py-2 text-xs font-semibold flex items-center justify-between" style={{ background: C.header }}>
                {ar ? 'أنواع المستندات' : 'Document Types'}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setTypeForm({name:'',icon:'FileText'}); setTypeEditId(null); setShowTypeForm(true); }}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className={`px-3 py-2 text-sm cursor-pointer border-b ${!docFilter.typeId ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'}`}
                  style={{ borderColor: C.border }} onClick={() => setDocFilter({...docFilter, typeId: undefined})}>
                  {ar ? 'كل الأنواع' : 'All Types'}
                </div>
                {types.map(t => {
                  const IconComp = ICON_MAP[t.icon || 'FileText'] || FileText;
                  return (
                    <div key={t.id} className={`px-3 py-2 text-sm cursor-pointer border-b flex items-center gap-2 ${docFilter.typeId===t.id ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'}`}
                      style={{ borderColor: C.border }} onClick={() => setDocFilter({...docFilter, typeId: t.id})}>
                      <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{t.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Documents table */}
            <div className="flex-1 border rounded-lg overflow-hidden" style={{ borderColor: C.border }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold" style={{ background: C.header }}>
                    <th className="px-2 py-2 text-center">#</th>
                    <th className="px-2 py-2 cursor-pointer" onClick={() => setDocSort({by:'name', dir: docSort.by==='name' && docSort.dir==='asc' ? 'desc' : 'asc'})}>
                      {ar ? 'المستند' : 'Document'} {docSort.by==='name' && (docSort.dir==='asc'?<SortAsc className="inline w-3 h-3"/>:<SortDesc className="inline w-3 h-3"/>)}
                    </th>
                    <th className="px-2 py-2">{ar ? 'النوع' : 'Type'}</th>
                    <th className="px-2 py-2">{ar ? 'الرقم' : 'Number'}</th>
                    <th className="px-2 py-2">{ar ? 'الجهة' : 'Issuer'}</th>
                    <th className="px-2 py-2">{ar ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                    <th className="px-2 py-2">{ar ? 'تاريخ الانتهاء' : 'Expiry Date'}</th>
                    <th className="px-2 py-2 text-center">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="px-2 py-2 text-center">{ar ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.filter((d:any) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || (d.documentNumber && d.documentNumber.toLowerCase().includes(search.toLowerCase()))).map((d:any, i:number) => (
                    <tr key={d.id} className="border-t hover:bg-muted/40" style={{ borderColor: C.border }}>
                      <td className="px-2 py-2 text-center text-muted-foreground">{i+1}</td>
                      <td className="px-2 py-2 font-medium">{d.name}</td>
                      <td className="px-2 py-2 text-xs">{d.documentTypeName || '-'}</td>
                      <td className="px-2 py-2 text-xs font-mono">{d.documentNumber || '-'}</td>
                      <td className="px-2 py-2 text-xs">{d.issuer || '-'}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{d.issueDate ? new Date(d.issueDate).toLocaleDateString('ar-SA') : '-'}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('ar-SA') : '-'}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          d.statusInfo.color==='green'?'bg-green-100 text-green-700':
                          d.statusInfo.color==='orange'?'bg-orange-100 text-orange-700':
                          d.statusInfo.color==='red'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-600'
                        }`}>
                          {d.statusInfo.color==='green'&&<CheckCircle2 className="w-3 h-3"/>}
                          {d.statusInfo.color==='orange'&&<Clock className="w-3 h-3"/>}
                          {d.statusInfo.color==='red'&&<AlertTriangle className="w-3 h-3"/>}
                          {d.statusInfo.label}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {d.filePath && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`/uploads/${d.filePath.replace(/.*uploads[/\\]/, '').replace(/\\/g, '/')}`, '_blank')} title={ar ? 'عرض' : 'View'}>
                              <Eye className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                            setDocForm({ name:d.name, documentNumber:d.documentNumber||'', issuer:d.issuer||'', issueDate:d.issueDate?new Date(d.issueDate).toISOString().split('T')[0]:'', expiryDate:d.expiryDate?new Date(d.expiryDate).toISOString().split('T')[0]:'', needsRenewal:d.needsRenewal, alertDays:d.alertDays??30, notes:d.notes||'', documentTypeId:d.documentTypeId });
                            setDocEditId(d.id); setView('documentForm');
                          }} title={ar ? 'تعديل' : 'Edit'}>
                            <Pencil className="w-3.5 h-3.5 text-amber-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowVersions(d.id)} title={ar ? 'الإصدارات' : 'Versions'}>
                            <History className="w-3.5 h-3.5 text-purple-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowDelDoc(d.id)} title={ar ? 'حذف' : 'Delete'}>
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {docs.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">{ar ? 'لا توجد مستندات' : 'No documents'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Delete Document Dialog */}
        {showDelDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDelDoc(null)}>
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg" dir={dir} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <h3 className="text-lg font-bold">{ar ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{ar ? 'هل تريد حذف المستند وملفه نهائياً؟' : 'Delete the document and its file permanently?'}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDelDoc(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteDoc.mutate({ id: showDelDoc })}>{ar ? 'حذف' : 'Delete'}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Versions Dialog */}
        {showVersions && <VersionsDialog documentId={showVersions} onClose={() => setShowVersions(null)} />}

        {/* Type Form Dialog */}
        {showTypeForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTypeForm(false)}>
            <div className="bg-white rounded-lg p-5 max-w-sm w-full shadow-lg" dir={dir} onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold mb-3">{typeEditId ? (ar ? 'تعديل النوع' : 'Edit Type') : (ar ? 'إضافة نوع جديد' : 'New Type')}</h3>
              <input value={typeForm.name} onChange={e => setTypeForm({...typeForm, name: e.target.value})} placeholder={ar ? 'اسم النوع' : 'Type name'}
                className="w-full h-9 px-3 text-sm border rounded-md mb-3" style={{ borderColor: C.border }} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTypeForm(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
                <Button size="sm" onClick={() => {
                  if (!typeForm.name.trim()) return;
                  if (typeEditId) updateType.mutate({ id: typeEditId, name: typeForm.name.trim(), icon: typeForm.icon });
                  else createType.mutate({ name: typeForm.name.trim(), icon: typeForm.icon });
                }}>{ar ? 'حفظ' : 'Save'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Project Form ──────────────────────────────────────────────────────────────────
  if (view === "projectForm") {
    return (
      <div className="h-full overflow-y-auto bg-background" dir={dir}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => { setView(projEditId ? 'projectDetail' : 'projects'); setProjEditId(null); }} className="gap-1 mb-3 text-muted-foreground">
            <BackIcon className="w-4 h-4" />{ar ? 'رجوع' : 'Back'}
          </Button>
          <h1 className="text-lg font-bold mb-4">{projEditId ? (ar ? 'تعديل المشروع' : 'Edit Project') : (ar ? 'إضافة مشروع جديد' : 'New Project')}</h1>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'اسم المشروع *' : 'Project Name *'}</label>
              <input value={projForm.name} onChange={e => setProjForm({...projForm, name: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'كود المشروع (تلقائي)' : 'Project Code (auto)'}</label>
              <input value={projForm.code} onChange={e => setProjForm({...projForm, code: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} placeholder={ar ? 'يُنشأ تلقائياً إذا تركته فارغاً' : 'Auto-generated if left empty'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'الموقع' : 'Location'}</label>
                <input value={projForm.location} onChange={e => setProjForm({...projForm, location: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'المالك / المطور' : 'Owner / Developer'}</label>
                <input value={projForm.ownerName} onChange={e => setProjForm({...projForm, ownerName: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'رقم القطعة' : 'Plot Number'}</label>
                <input value={projForm.plotNumber} onChange={e => setProjForm({...projForm, plotNumber: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'رقم المخطط' : 'Plan Number'}</label>
                <input value={projForm.planNumber} onChange={e => setProjForm({...projForm, planNumber: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'تاريخ البداية' : 'Start Date'}</label>
                <input type="date" value={projForm.startDate} onChange={e => setProjForm({...projForm, startDate: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'تاريخ الانتهاء المتوقع' : 'Expected End'}</label>
                <input type="date" value={projForm.expectedEndDate} onChange={e => setProjForm({...projForm, expectedEndDate: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'حالة المشروع' : 'Status'}</label>
              <select value={projForm.status} onChange={e => setProjForm({...projForm, status: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }}>
                <option value="active">{ar ? 'قائم' : 'Active'}</option>
                <option value="paused">{ar ? 'متوقف' : 'Paused'}</option>
                <option value="completed">{ar ? 'مكتمل' : 'Completed'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'ملاحظات' : 'Notes'}</label>
              <textarea value={projForm.notes} onChange={e => setProjForm({...projForm, notes: e.target.value})} rows={3} className="w-full px-3 py-2 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setView(projEditId ? 'projectDetail' : 'projects'); setProjEditId(null); }}>{ar ? 'إلغاء' : 'Cancel'}</Button>
              <Button size="sm" onClick={() => {
                if (!projForm.name.trim()) { toast.error(ar ? 'اسم المشروع مطلوب' : 'Project name required'); return; }
                if (projEditId) updateProject.mutate({ id: projEditId, ...projForm });
                else createProject.mutate(projForm);
              }}>{ar ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Document Form ──────────────────────────────────────────────────────────────────
  if (view === "documentForm") {
    const types = typesQ.data ?? [];
    return (
      <div className="h-full overflow-y-auto bg-background" dir={dir}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => { setView('projectDetail'); resetDocForm(); }} className="gap-1 mb-3 text-muted-foreground">
            <BackIcon className="w-4 h-4" />{ar ? 'رجوع' : 'Back'}
          </Button>
          <h1 className="text-lg font-bold mb-4">{docEditId ? (ar ? 'تعديل المستند' : 'Edit Document') : (ar ? 'إضافة مستند جديد' : 'New Document')}</h1>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'اسم المستند *' : 'Document Name *'}</label>
              <input value={docForm.name} onChange={e => setDocForm({...docForm, name: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'نوع المستند *' : 'Document Type *'}</label>
              <select value={docForm.documentTypeId || ''} onChange={e => setDocForm({...docForm, documentTypeId: e.target.value ? Number(e.target.value) : null})}
                className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }}>
                <option value="">{ar ? 'اختر النوع' : 'Select Type'}</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'رقم المستند' : 'Document Number'}</label>
                <input value={docForm.documentNumber} onChange={e => setDocForm({...docForm, documentNumber: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'الجهة المصدرة' : 'Issuer'}</label>
                <input value={docForm.issuer} onChange={e => setDocForm({...docForm, issuer: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                <input type="date" value={docForm.issueDate} onChange={e => setDocForm({...docForm, issueDate: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'تاريخ الانتهاء (اختياري)' : 'Expiry Date (optional)'}</label>
                <input type="date" value={docForm.expiryDate} onChange={e => setDocForm({...docForm, expiryDate: e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={docForm.needsRenewal} onChange={e => setDocForm({...docForm, needsRenewal: e.target.checked})} className="w-4 h-4" />
                {ar ? 'يحتاج إلى تجديد' : 'Needs Renewal'}
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{ar ? 'تنبيه قبل' : 'Alert before'}</label>
                <input type="number" value={docForm.alertDays} onChange={e => setDocForm({...docForm, alertDays: Number(e.target.value)})} className="w-16 h-8 px-2 text-sm border rounded-md text-center" style={{ borderColor: C.border }} />
                <span className="text-xs text-muted-foreground">{ar ? 'يوم' : 'days'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'ملاحظات' : 'Notes'}</label>
              <textarea value={docForm.notes} onChange={e => setDocForm({...docForm, notes: e.target.value})} rows={2} className="w-full px-3 py-2 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>
            {/* File Upload */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? 'الملف' : 'File'}</label>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip,.rar,.dwg,.dxf" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
                  <Upload className="w-4 h-4" />{ar ? 'اختيار ملف' : 'Choose File'}
                </Button>
                {fileData && <span className="text-xs text-muted-foreground">{fileData.name} ({(fileData.size/1024).toFixed(1)} KB)</span>}
                {fileData && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFileData(null)}><X className="w-3.5 h-3.5" /></Button>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{ar ? 'PDF, JPG, PNG, Word, Excel, ZIP, DWG — حد أقصى 20 ميجا' : 'PDF, JPG, PNG, Word, Excel, ZIP, DWG — max 20 MB'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setView('projectDetail'); resetDocForm(); }}>{ar ? 'إلغاء' : 'Cancel'}</Button>
              <Button size="sm" variant="outline" onClick={() => saveDocument(true)}>{ar ? 'حفظ + جديد' : 'Save + New'}</Button>
              <Button size="sm" onClick={() => saveDocument(false)}>{ar ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback — should never reach here
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground" dir={dir}>
      <p className="text-sm">{ar ? 'الصفحة غير متوفرة' : 'View not available'}</p>
    </div>
  );
}

// ─── Versions Dialog ──────────────────────────────────────────────────────────────────
function VersionsDialog({ documentId, onClose }: { documentId: number; onClose: () => void }) {
  const { lang, dir } = useLang();
  const ar = lang === "ar";
  const versionsQ = trpc.reDocuments.listVersions.useQuery({ documentId });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg p-5 max-w-lg w-full shadow-lg max-h-[80vh] overflow-y-auto" dir={dir} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">{ar ? 'سجل الإصدارات' : 'Version History'}</h3>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        {(versionsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{ar ? 'لا توجد إصدارات سابقة' : 'No previous versions'}</p>
        ) : (
          <div className="space-y-2">
            {(versionsQ.data ?? []).map((v: any) => (
              <div key={v.id} className="border rounded-md p-3 flex items-center justify-between" style={{ borderColor: C.border }}>
                <div>
                  <div className="text-sm font-medium">{ar ? 'إصدار' : 'Version'} {v.versionNumber}</div>
                  <div className="text-xs text-muted-foreground">{v.originalName || v.filePath.split('/').pop()} • {v.fileSize ? `${(v.fileSize/1024).toFixed(1)} KB` : ''} • {new Date(v.createdAt).toLocaleDateString('ar-SA')}</div>
                </div>
                {v.filePath && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => window.open(`/uploads/${v.filePath.replace(/.*uploads[/\\]/, '').replace(/\\/g, '/')}`, '_blank')}>
                    <Download className="w-3.5 h-3.5" />{ar ? 'تنزيل' : 'Download'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
