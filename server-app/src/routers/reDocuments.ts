/**
 * reDocuments.ts -- أوراق ومستندات المشروع (Phase 2)
 * Projects + Document Types + Documents + Versions + File Upload
 */
import { z } from 'zod';
import { and, eq, desc, asc, sql, ilike, or, gte, lte, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { reProjects, reDocumentTypes, reDocuments, reDocumentVersions, users } from '../schema.js';
import fs from 'fs';
import path from 'path';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTS = new Set(['pdf','jpg','jpeg','png','doc','docx','xls','xlsx','zip','rar','dwg','dxf']);
const DANGEROUS_EXTS = new Set(['exe','bat','cmd','sh','msi','dll','scr','vbs','js','html','htm']);

function getUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? process.env.UPLOADS_DIR
    : process.platform === 'win32'
      ? path.join(process.env['PROGRAMDATA'] || 'C:\\ProgramData', 'OneSoft', 'uploads')
      : path.join(process.cwd(), 'uploads');
}

function safeFileName(original: string): string {
  const base = original.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_{2,}/g, '_');
  const ext  = path.extname(base).toLowerCase();
  const name = path.basename(base, ext);
  const stamp = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  return `${name}_${stamp}${ext}`;
}

function assertExt(original: string): void {
  const ext = path.extname(original).replace('.','').toLowerCase();
  if (DANGEROUS_EXTS.has(ext)) throw new TRPCError({ code:'BAD_REQUEST', message:`نوع الملف ${ext} ممنوع لأسباب أمنية` });
  if (!ALLOWED_EXTS.has(ext)) throw new TRPCError({ code:'BAD_REQUEST', message:`نوع الملف ${ext} غير مسموح. المسموح: ${[...ALLOWED_EXTS].join(', ')}` });
}

function assertSize(size: number): void {
  if (size > MAX_FILE_SIZE) throw new TRPCError({ code:'BAD_REQUEST', message:`حجم الملف يتجاوز ${MAX_FILE_SIZE/1024/1024} ميجا` });
}

function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

// ─── Permissions ──────────────────────────────────────────────────────────────
function assertViewPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  const isAdmin = ['admin','superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_documents'] !== true && user.extraPermissions?.['help_services'] !== true) {
    throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية الوصول' });
  }
}
function assertAddPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_documents_add'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية إضافة' });
}
function assertEditPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_documents_edit'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية تعديل' });
}
function assertDeletePerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_documents_delete'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية حذف' });
}
function assertExportPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_documents_export'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية التصدير' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function docStatus(doc: { expiryDate: Date|null; needsRenewal: boolean|null; alertDays: number|null }) {
  if (!doc.expiryDate) return { status: 'no_expiry', label: 'بدون تاريخ انتهاء', color: 'gray' } as const;
  const now = new Date();
  const exp = new Date(doc.expiryDate);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000*60*60*24));
  const alert = doc.alertDays ?? 30;
  if (days < 0) return { status: 'expired', label: 'منتهي', color: 'red', daysRemaining: days } as const;
  if (days <= alert) return { status: 'expiring', label: 'قارب على الانتهاء', color: 'orange', daysRemaining: days } as const;
  return { status: 'active', label: 'ساري', color: 'green', daysRemaining: days } as const;
}

function genProjectCode(orgId: number): string {
  const prefix = 'PRJ-';
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}${orgId}-${stamp}`;
}

// ─── System document types (preseed) ──────────────────────────────────────────
const SYSTEM_DOC_TYPES = [
  { name:'صك الأرض', icon:'FileText' },
  { name:'رخصة البناء', icon:'HardHat' },
  { name:'المخططات المعمارية', icon:'Layout' },
  { name:'المخططات الإنشائية', icon:'Construction' },
  { name:'المخططات الكهربائية', icon:'Zap' },
  { name:'المخططات الميكانيكية', icon:'Cog' },
  { name:'المخططات التنفيذية', icon:'Map' },
  { name:'تقارير التربة', icon:'Mountain' },
  { name:'الرفع المساحي', icon:'Ruler' },
  { name:'عقود المقاولين', icon:'FileSignature' },
  { name:'عقود الموردين', icon:'Truck' },
  { name:'وثائق التأمين', icon:'Shield' },
  { name:'شهادات الإنجاز', icon:'Award' },
  { name:'شهادة إتمام البناء', icon:'Home' },
  { name:'محاضر الاستلام', icon:'ClipboardCheck' },
  { name:'تراخيص وإقرارات أخرى', icon:'FileBadge' },
  { name:'مستندات متنوعة', icon:'FolderOpen' },
];

// ─── Router ───────────────────────────────────────────────────────────────────
export const reDocumentsRouter = router({

  // ── Projects ──────────────────────────────────────────────────────────────
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    assertViewPerm(ctx.user);
    const rows = await db.select().from(reProjects)
      .where(eq(reProjects.orgId, ctx.user.orgId))
      .orderBy(desc(reProjects.createdAt));
    return rows;
  }),

  createProject: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      code: z.string().optional(),
      location: z.string().optional(),
      ownerName: z.string().optional(),
      plotNumber: z.string().optional(),
      planNumber: z.string().optional(),
      startDate: z.string().optional(),
      expectedEndDate: z.string().optional(),
      status: z.enum(['active','paused','completed']).default('active'),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const code = input.code?.trim() || genProjectCode(ctx.user.orgId);
      // check code uniqueness
      const existing = await db.select({id:reProjects.id}).from(reProjects)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.code, code))).limit(1);
      if (existing.length > 0) throw new TRPCError({ code:'CONFLICT', message:'كود المشروع موجود مسبقاً' });

      const [proj] = await db.insert(reProjects).values({
        orgId: ctx.user.orgId, code, name: input.name.trim(),
        location: input.location || null, ownerName: input.ownerName || null,
        plotNumber: input.plotNumber || null, planNumber: input.planNumber || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        expectedEndDate: input.expectedEndDate ? new Date(input.expectedEndDate) : null,
        status: input.status, notes: input.notes || null,
        createdBy: ctx.user.id, updatedBy: ctx.user.id,
      }).returning();

      // Preseed document types if none exist for this org
      const existingTypes = await db.select({id:reDocumentTypes.id}).from(reDocumentTypes)
        .where(eq(reDocumentTypes.orgId, ctx.user.orgId)).limit(1);
      if (existingTypes.length === 0) {
        await db.insert(reDocumentTypes).values(
          SYSTEM_DOC_TYPES.map((t, i) => ({
            orgId: ctx.user.orgId, name: t.name, icon: t.icon,
            sortOrder: i, isSystem: true,
          }))
        );
      }
      return proj;
    }),

  updateProject: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
      location: z.string().optional(),
      ownerName: z.string().optional(),
      plotNumber: z.string().optional(),
      planNumber: z.string().optional(),
      startDate: z.string().optional(),
      expectedEndDate: z.string().optional(),
      status: z.enum(['active','paused','completed']).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const { id, ...data } = input;
      const existing = await db.select().from(reProjects)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, id))).limit(1);
      if (existing.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المشروع غير موجود' });

      const updates: any = { updatedBy: ctx.user.id, updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.code !== undefined) updates.code = data.code.trim();
      if (data.location !== undefined) updates.location = data.location || null;
      if (data.ownerName !== undefined) updates.ownerName = data.ownerName || null;
      if (data.plotNumber !== undefined) updates.plotNumber = data.plotNumber || null;
      if (data.planNumber !== undefined) updates.planNumber = data.planNumber || null;
      if (data.startDate !== undefined) updates.startDate = data.startDate ? new Date(data.startDate) : null;
      if (data.expectedEndDate !== undefined) updates.expectedEndDate = data.expectedEndDate ? new Date(data.expectedEndDate) : null;
      if (data.status !== undefined) updates.status = data.status;
      if (data.notes !== undefined) updates.notes = data.notes || null;

      const [proj] = await db.update(reProjects).set(updates)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, id)))
        .returning();
      return proj;
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertDeletePerm(ctx.user);
      const proj = await db.select().from(reProjects)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, input.id))).limit(1);
      if (proj.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المشروع غير موجود' });

      // Delete all documents and their files
      const docs = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.projectId, input.id)));
      for (const d of docs) {
        if (d.filePath) { try { fs.unlinkSync(d.filePath); } catch {} }
        const versions = await db.select().from(reDocumentVersions)
          .where(eq(reDocumentVersions.documentId, d.id));
        for (const v of versions) { if (v.filePath) { try { fs.unlinkSync(v.filePath); } catch {} } }
        await db.delete(reDocumentVersions).where(eq(reDocumentVersions.documentId, d.id));
      }
      await db.delete(reDocuments).where(eq(reDocuments.projectId, input.id));
      await db.delete(reProjects).where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, input.id)));
      return { success: true };
    }),

  getProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const proj = await db.select().from(reProjects)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, input.id))).limit(1);
      if (proj.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المشروع غير موجود' });
      return proj[0];
    }),

  // ── Document Types ──────────────────────────────────────────────────────────
  listDocumentTypes: protectedProcedure.query(async ({ ctx }) => {
    assertViewPerm(ctx.user);
    const rows = await db.select().from(reDocumentTypes)
      .where(eq(reDocumentTypes.orgId, ctx.user.orgId))
      .orderBy(asc(reDocumentTypes.sortOrder), asc(reDocumentTypes.id));
    return rows;
  }),

  createDocumentType: protectedProcedure
    .input(z.object({ name: z.string().min(1), icon: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const maxOrder = await db.select({ max: sql<number>`COALESCE(MAX(sort_order),0)` }).from(reDocumentTypes)
        .where(eq(reDocumentTypes.orgId, ctx.user.orgId));
      const [dt] = await db.insert(reDocumentTypes).values({
        orgId: ctx.user.orgId, name: input.name.trim(),
        icon: input.icon || 'FileText', sortOrder: (maxOrder[0]?.max ?? 0) + 1,
        isSystem: false,
      }).returning();
      return dt;
    }),

  updateDocumentType: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), icon: z.string().optional(), sortOrder: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const { id, ...data } = input;
      const existing = await db.select().from(reDocumentTypes)
        .where(and(eq(reDocumentTypes.orgId, ctx.user.orgId), eq(reDocumentTypes.id, id))).limit(1);
      if (existing.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'نوع المستند غير موجود' });
      const [dt] = await db.update(reDocumentTypes).set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        updatedAt: new Date(),
      }).where(and(eq(reDocumentTypes.orgId, ctx.user.orgId), eq(reDocumentTypes.id, id))).returning();
      return dt;
    }),

  deleteDocumentType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertDeletePerm(ctx.user);
      // Check if any document uses this type
      const docs = await db.select({id:reDocuments.id}).from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.documentTypeId, input.id))).limit(1);
      if (docs.length > 0) throw new TRPCError({ code:'CONFLICT', message:'لا يمكن حذف نوع مرتبط بمستندات. انقل المستندات أولاً.' });
      await db.delete(reDocumentTypes).where(and(eq(reDocumentTypes.orgId, ctx.user.orgId), eq(reDocumentTypes.id, input.id)));
      return { success: true };
    }),

  reorderDocumentTypes: protectedProcedure
    .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      for (const item of input) {
        await db.update(reDocumentTypes).set({ sortOrder: item.sortOrder })
          .where(and(eq(reDocumentTypes.orgId, ctx.user.orgId), eq(reDocumentTypes.id, item.id)));
      }
      return { success: true };
    }),

  // ── Documents ───────────────────────────────────────────────────────────────
  listDocuments: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      search: z.string().optional(),
      documentTypeId: z.number().optional(),
      issuer: z.string().optional(),
      status: z.enum(['active','expiring','expired','no_expiry']).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      sortBy: z.enum(['name','documentTypeId','issueDate','expiryDate','createdAt']).optional(),
      sortDir: z.enum(['asc','desc']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const { projectId, search, documentTypeId, issuer, status, dateFrom, dateTo, sortBy, sortDir } = input;
      let conds = [eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.projectId, projectId)];
      if (search) conds.push(or(ilike(reDocuments.name, `%${search}%`), ilike(reDocuments.documentNumber, `%${search}%`)));
      if (documentTypeId) conds.push(eq(reDocuments.documentTypeId, documentTypeId));
      if (issuer) conds.push(ilike(reDocuments.issuer, `%${issuer}%`));
      if (dateFrom) conds.push(gte(reDocuments.issueDate, new Date(dateFrom)));
      if (dateTo) conds.push(lte(reDocuments.issueDate, new Date(dateTo)));

      const orderCol = sortBy === 'documentTypeId' ? reDocuments.documentTypeId
        : sortBy === 'issueDate' ? reDocuments.issueDate
        : sortBy === 'expiryDate' ? reDocuments.expiryDate
        : sortBy === 'createdAt' ? reDocuments.createdAt
        : reDocuments.name;
      const orderFn = sortDir === 'desc' ? desc(orderCol) : asc(orderCol);

      const rows = await db.select().from(reDocuments)
        .where(and(...conds)).orderBy(orderFn);

      const typeMap = new Map<number, string>();
      const allTypes = await db.select().from(reDocumentTypes).where(eq(reDocumentTypes.orgId, ctx.user.orgId));
      for (const t of allTypes) typeMap.set(t.id, t.name);

      const userMap = new Map<number, string>();
      const allUsers = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, ctx.user.orgId));
      for (const u of allUsers) userMap.set(u.id, u.name);

      return rows.map(r => {
        const st = docStatus(r);
        if (status && st.status !== status) return null;
        return {
          ...r,
          documentTypeName: typeMap.get(r.documentTypeId) || '',
          createdByName: r.createdBy ? (userMap.get(r.createdBy) || '') : '',
          statusInfo: st,
        };
      }).filter(Boolean);
    }),

  getDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, input.id))).limit(1);
      if (rows.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المستند غير موجود' });
      const doc = rows[0];
      const st = docStatus(doc);
      const typeRows = await db.select().from(reDocumentTypes)
        .where(and(eq(reDocumentTypes.orgId, ctx.user.orgId), eq(reDocumentTypes.id, doc.documentTypeId))).limit(1);
      const userRows = await db.select({ name: users.name }).from(users).where(eq(users.id, doc.createdBy!)).limit(1);
      return { ...doc, documentTypeName: typeRows[0]?.name || '', createdByName: userRows[0]?.name || '', statusInfo: st };
    }),

  createDocument: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      documentTypeId: z.number(),
      name: z.string().min(1),
      documentNumber: z.string().optional(),
      issuer: z.string().optional(),
      issueDate: z.string().optional(),
      expiryDate: z.string().optional(),
      needsRenewal: z.boolean().default(false),
      alertDays: z.number().default(30),
      notes: z.string().optional(),
      fileData: z.string().optional(), // base64
      originalName: z.string().optional(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      // Verify project belongs to org
      const projCheck = await db.select({id:reProjects.id}).from(reProjects)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, input.projectId))).limit(1);
      if (projCheck.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المشروع غير موجود' });

      let filePath: string|null = null;
      if (input.fileData && input.originalName) {
        assertExt(input.originalName); assertSize(input.fileSize || 0);
        const dir = path.join(getUploadsDir(), 're-documents', String(ctx.user.orgId), String(input.projectId));
        ensureDir(dir);
        const safeName = safeFileName(input.originalName);
        filePath = path.join(dir, safeName);
        const base64 = input.fileData.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      }

      const [doc] = await db.insert(reDocuments).values({
        orgId: ctx.user.orgId, projectId: input.projectId,
        documentTypeId: input.documentTypeId, name: input.name.trim(),
        documentNumber: input.documentNumber || null, issuer: input.issuer || null,
        issueDate: input.issueDate ? new Date(input.issueDate) : null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        needsRenewal: input.needsRenewal, alertDays: input.alertDays,
        notes: input.notes || null, filePath, originalName: input.originalName || null,
        fileSize: input.fileSize || null, mimeType: input.mimeType || null,
        createdBy: ctx.user.id, updatedBy: ctx.user.id,
      }).returning();
      return doc;
    }),

  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      documentTypeId: z.number().optional(),
      name: z.string().min(1).optional(),
      documentNumber: z.string().optional(),
      issuer: z.string().optional(),
      issueDate: z.string().optional(),
      expiryDate: z.string().optional(),
      needsRenewal: z.boolean().optional(),
      alertDays: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const { id, ...data } = input;
      const existing = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, id))).limit(1);
      if (existing.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المستند غير موجود' });

      const updates: any = { updatedBy: ctx.user.id, updatedAt: new Date() };
      if (data.documentTypeId !== undefined) updates.documentTypeId = data.documentTypeId;
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.documentNumber !== undefined) updates.documentNumber = data.documentNumber || null;
      if (data.issuer !== undefined) updates.issuer = data.issuer || null;
      if (data.issueDate !== undefined) updates.issueDate = data.issueDate ? new Date(data.issueDate) : null;
      if (data.expiryDate !== undefined) updates.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
      if (data.needsRenewal !== undefined) updates.needsRenewal = data.needsRenewal;
      if (data.alertDays !== undefined) updates.alertDays = data.alertDays;
      if (data.notes !== undefined) updates.notes = data.notes || null;

      const [doc] = await db.update(reDocuments).set(updates)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, id))).returning();
      return doc;
    }),

  replaceFile: protectedProcedure
    .input(z.object({
      id: z.number(),
      fileData: z.string(), // base64
      originalName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
      versionNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const existing = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, input.id))).limit(1);
      if (existing.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المستند غير موجود' });
      const old = existing[0];

      assertExt(input.originalName); assertSize(input.fileSize);
      const dir = path.join(getUploadsDir(), 're-documents', String(ctx.user.orgId), String(old.projectId));
      ensureDir(dir);
      const safeName = safeFileName(input.originalName);
      const filePath = path.join(dir, safeName);
      const base64 = input.fileData.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

      // Save version record if old file existed
      if (old.filePath && fs.existsSync(old.filePath)) {
        const maxVer = await db.select({ max: sql<number>`COALESCE(MAX(version_number),0)` }).from(reDocumentVersions)
          .where(eq(reDocumentVersions.documentId, old.id));
        const nextVer = (maxVer[0]?.max ?? 0) + 1;
        await db.insert(reDocumentVersions).values({
          orgId: ctx.user.orgId, documentId: old.id, versionNumber: nextVer,
          filePath: old.filePath, originalName: old.originalName,
          fileSize: old.fileSize, mimeType: old.mimeType,
          notes: input.versionNotes || null, createdBy: ctx.user.id,
        });
      }

      const [doc] = await db.update(reDocuments).set({
        filePath, originalName: input.originalName, fileSize: input.fileSize,
        mimeType: input.mimeType, updatedBy: ctx.user.id, updatedAt: new Date(),
      }).where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, input.id))).returning();
      return doc;
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertDeletePerm(ctx.user);
      const rows = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, input.id))).limit(1);
      if (rows.length === 0) throw new TRPCError({ code:'NOT_FOUND', message:'المستند غير موجود' });
      const doc = rows[0];

      // Delete file and versions
      if (doc.filePath) { try { fs.unlinkSync(doc.filePath); } catch {} }
      const versions = await db.select().from(reDocumentVersions)
        .where(eq(reDocumentVersions.documentId, doc.id));
      for (const v of versions) { if (v.filePath) { try { fs.unlinkSync(v.filePath); } catch {} } }

      await db.delete(reDocumentVersions).where(eq(reDocumentVersions.documentId, doc.id));
      await db.delete(reDocuments).where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.id, input.id)));
      return { success: true };
    }),

  // ── Document Versions ───────────────────────────────────────────────────────
  listVersions: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reDocumentVersions)
        .where(eq(reDocumentVersions.documentId, input.documentId))
        .orderBy(desc(reDocumentVersions.versionNumber));
      return rows;
    }),

  // ── Project Stats ────────────────────────────────────────────────────────────
  getProjectStats: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const docs = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.projectId, input.projectId)));
      let total = 0, active = 0, expired = 0, expiring = 0, noExpiry = 0;
      for (const d of docs) {
        total++;
        const st = docStatus(d);
        if (st.status === 'active') active++;
        else if (st.status === 'expired') expired++;
        else if (st.status === 'expiring') expiring++;
        else noExpiry++;
      }
      return { total, active, expired, expiring, noExpiry };
    }),

  // ── Alerts ────────────────────────────────────────────────────────────────────
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    assertViewPerm(ctx.user);
    const now = new Date();
    const docs = await db.select().from(reDocuments)
      .where(and(eq(reDocuments.orgId, ctx.user.orgId), sql`${reDocuments.expiryDate} IS NOT NULL`));
    const alerts = [];
    for (const d of docs) {
      const st = docStatus(d);
      if (st.status === 'expired' || st.status === 'expiring') {
        const proj = await db.select({ name: reProjects.name }).from(reProjects)
          .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, d.projectId))).limit(1);
        alerts.push({
          documentId: d.id, documentName: d.name,
          projectName: proj[0]?.name || '',
          daysRemaining: (st as any).daysRemaining,
          status: st.status, label: st.label,
        });
      }
    }
    return alerts.sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
  }),

  // ── Export (JSON data for frontend to build Excel/PDF) ──────────────────────
  exportDocuments: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      format: z.enum(['json']).default('json'),
    }))
    .query(async ({ ctx, input }) => {
      assertExportPerm(ctx.user);
      const rows = await db.select().from(reDocuments)
        .where(and(eq(reDocuments.orgId, ctx.user.orgId), eq(reDocuments.projectId, input.projectId)))
        .orderBy(asc(reDocuments.name));
      const typeMap = new Map<number, string>();
      const allTypes = await db.select().from(reDocumentTypes).where(eq(reDocumentTypes.orgId, ctx.user.orgId));
      for (const t of allTypes) typeMap.set(t.id, t.name);
      const userMap = new Map<number, string>();
      const allUsers = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, ctx.user.orgId));
      for (const u of allUsers) userMap.set(u.id, u.name);
      const proj = await db.select().from(reProjects)
        .where(and(eq(reProjects.orgId, ctx.user.orgId), eq(reProjects.id, input.projectId))).limit(1);

      return {
        project: proj[0] || null,
        documents: rows.map(r => ({
          ...r,
          documentTypeName: typeMap.get(r.documentTypeId) || '',
          createdByName: r.createdBy ? (userMap.get(r.createdBy) || '') : '',
          statusInfo: docStatus(r),
        })),
        generatedAt: new Date().toISOString(),
      };
    }),
});
