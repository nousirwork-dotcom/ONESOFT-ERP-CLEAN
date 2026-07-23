import { z } from 'zod';
import { and, eq, desc, asc, sql, ilike, or, gte, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { rePurchases, rePurchaseStatements, users, organizations } from '../schema.js';

// ─── التحقق من الصلاحيات ───────────────────────────────────────────────────────────────────────

function assertViewPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const hasPerm = user.extraPermissions?.['hs_re_purchases'] === true;
  if (!isAdmin && !hasPerm) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى البيان التفصيلي للمشتريات' });
  }
}
function assertAddPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return; if (user.extraPermissions?.['hs_re_purchases_add'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية إضافة' });
}
function assertEditPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return; if (user.extraPermissions?.['hs_re_purchases_edit'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية تعديل' });
}
function assertDeletePerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return; if (user.extraPermissions?.['hs_re_purchases_delete'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية حذف' });
}
function assertPrintPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return; if (user.extraPermissions?.['hs_re_purchases_print'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الطباعة' });
}
function assertExportPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return; if (user.extraPermissions?.['hs_re_purchases_export'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية التصدير' });
}
function assertImportPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return; if (user.extraPermissions?.['hs_re_purchases_import'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الاستيراد' });
}

// ─── الحساب التلقائي ────────────────────────────────────────────────────────────────────
// Phase 3c: only "total" is editable; preTax and tax are auto-computed from total + statement taxRate
function calcFromTotal(total: number, taxRate: number) {
  const rate = taxRate / 100;
  const preTax = +(total / (1 + rate)).toFixed(4);
  const tax = +(total - preTax).toFixed(4);
  return { preTax, tax, total };
}

// ─── Schemas ────────────────────────────────────────────────────────────────────────────────
const invoiceInputSchema = z.object({
  supplierName:  z.string().min(1).max(255),
  supplierTaxId: z.string().max(50).nullable().optional(),
  invoiceDate:   z.string().min(1),
  invoiceNumber: z.string().min(1).max(100),
  // Phase 3c: total is the only editable field; preTax/tax/taxRate auto-computed from statement
  totalValue:    z.number().min(0).default(0),
  notes:         z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
}).partial();

const statementInputSchema = z.object({
  name:           z.string().min(1).max(255),
  project:        z.string().max(255).nullable().optional(),
  dateFrom:       z.string().min(1),
  dateTo:         z.string().min(1),
  defaultTaxRate: z.number().min(0).max(100).default(15),
  notes:          z.string().nullable().optional(),
});

// ─── Duplicate detection ───────────────────────────────────────────────────────────────────
async function findDuplicate(supplierTaxId: string | null | undefined, invoiceNumber: string, excludeId?: number) {
  if (!supplierTaxId || !invoiceNumber) return null;
  const conditions = [ eq(rePurchases.supplierTaxId, supplierTaxId), eq(rePurchases.invoiceNumber, invoiceNumber) ];
  if (excludeId !== undefined) conditions.push(sql`${rePurchases.id} <> ${excludeId}`);
  const rows = await db.select({
    id: rePurchases.id, statementId: rePurchases.statementId, supplierName: rePurchases.supplierName,
    invoiceDate: rePurchases.invoiceDate, totalValue: rePurchases.totalValue,
  }).from(rePurchases).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

// ─── Sequence helpers ──────────────────────────────────────────────────────────
async function getNextSequence(statementId: number) {
  const rows = await db.select({ seq: sql<number>`COALESCE(MAX(${rePurchases.sequence}), 0)` })
    .from(rePurchases).where(eq(rePurchases.statementId, statementId));
  return (rows[0]?.seq ?? 0) + 1;
}

async function reorderSequences(statementId: number) {
  const invoices = await db.select({ id: rePurchases.id })
    .from(rePurchases)
    .where(eq(rePurchases.statementId, statementId))
    .orderBy(asc(rePurchases.sequence), asc(rePurchases.id));
  for (let i = 0; i < invoices.length; i++) {
    await db.update(rePurchases).set({ sequence: i + 1 }).where(eq(rePurchases.id, invoices[i].id));
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────────
export const rePurchasesRouter = router({

  // ════════════════════════════════════════════════════════════════════════════
  //  STATEMENTS
  // ════════════════════════════════════════════════════════════════════════════

  listStatements: protectedProcedure
    .input(z.object({
      search: z.string().optional(), project: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(),
      sortBy: z.enum(['name','project','dateFrom','id']).optional(), sortDir: z.enum(['asc','desc']).optional(),
      page: z.number().default(1), limit: z.number().default(200),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const rows = await db.execute(sql`
        SELECT s.id, s.name, s.project, s.date_from, s.date_to, s.default_tax_rate, s.notes, s.created_at, s.updated_at,
          u1.name AS created_by_name,
          COALESCE(COUNT(p.id),0) AS invoice_count,
          COALESCE(SUM(p.pre_tax_value),0) AS pre_tax_total,
          COALESCE(SUM(p.tax_amount),0) AS tax_total,
          COALESCE(SUM(p.total_value),0) AS grand_total
        FROM re_purchase_statements s
        LEFT JOIN re_purchases p ON p.statement_id=s.id
        LEFT JOIN users u1 ON u1.id=s.created_by
        WHERE s.org_id=${orgId}
        GROUP BY s.id, s.name, s.project, s.date_from, s.date_to, s.default_tax_rate, s.notes, s.created_at, s.updated_at, u1.name
        ORDER BY s.created_at DESC, s.id DESC
      `);
      let data = rows.rows as Array<Record<string,any>>;
      const q = input?.search?.trim();
      if (q) { const ql=q.toLowerCase(); data=data.filter(r=>(r.name??'').toLowerCase().includes(ql)||(r.project??'').toLowerCase().includes(ql)); }
      if (input?.project) { const f=input.project.toLowerCase(); data=data.filter(r=>(r.project??'').toLowerCase().includes(f)); }
      if (input?.dateFrom) { const from=new Date(input.dateFrom); from.setHours(0,0,0,0); data=data.filter(r=>new Date(r.date_from)>=from); }
      if (input?.dateTo) { const to=new Date(input.dateTo); to.setHours(23,59,59,999); data=data.filter(r=>new Date(r.date_to)<=to); }
      const sortBy=input?.sortBy??'created_at'; const sortDir=input?.sortDir??'desc'; const dir=sortDir==='asc'?1:-1;
      data.sort((a,b)=>{ const va=a[sortBy]??'', vb=b[sortBy]??''; if(typeof va==='number'&&typeof vb==='number')return(va-vb)*dir; return String(va).localeCompare(String(vb),'ar')*dir; });
      const totals={ preTax:data.reduce((s,r)=>s+Number(r.pre_tax_total??0),0), tax:data.reduce((s,r)=>s+Number(r.tax_total??0),0), total:data.reduce((s,r)=>s+Number(r.grand_total??0),0), count:data.length };
      const limit=input?.limit||200; const page=input?.page||1; const paginated=data.slice((page-1)*limit,page*limit);
      return { rows: paginated, totals };
    }),

  getStatement: protectedProcedure.input(z.object({ id:z.number() })).query(async ({ ctx, input }) => {
    assertViewPerm(ctx.user);
    const [row]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.id),eq(rePurchaseStatements.orgId,ctx.user.orgId)));
    if(!row) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
    return row;
  }),

  createStatement: protectedProcedure.input(z.object({ data:statementInputSchema })).mutation(async ({ ctx, input }) => {
    assertAddPerm(ctx.user);
    const [row]=await db.insert(rePurchaseStatements).values({
      orgId:ctx.user.orgId, name:input.data.name, project:input.data.project??null,
      dateFrom:new Date(input.data.dateFrom), dateTo:new Date(input.data.dateTo),
      defaultTaxRate: String(input.data.defaultTaxRate ?? 15),
      notes:input.data.notes??null, createdBy:ctx.user.id, updatedBy:ctx.user.id,
    }).returning();
    return row;
  }),

  updateStatement: protectedProcedure.input(z.object({ id:z.number(), data:statementInputSchema.partial(), applyToAll:z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    assertEditPerm(ctx.user);
    const [existing]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.id),eq(rePurchaseStatements.orgId,ctx.user.orgId)));
    if(!existing) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
    const updateData: Record<string,any>={ updatedBy:ctx.user.id, updatedAt:new Date() };
    if(input.data.name!==undefined) updateData.name=input.data.name;
    if(input.data.project!==undefined) updateData.project=input.data.project??null;
    if(input.data.dateFrom!==undefined) updateData.dateFrom=new Date(input.data.dateFrom);
    if(input.data.dateTo!==undefined) updateData.dateTo=new Date(input.data.dateTo);
    if(input.data.defaultTaxRate!==undefined) updateData.defaultTaxRate=String(input.data.defaultTaxRate);
    if(input.data.notes!==undefined) updateData.notes=input.data.notes??null;
    const [row]=await db.update(rePurchaseStatements).set(updateData).where(eq(rePurchaseStatements.id,input.id)).returning();
    // Cascade tax rate to all invoices if requested (Phase 3c: recalc from total)
    if(input.applyToAll && input.data.defaultTaxRate!==undefined) {
      const invoices = await db.select().from(rePurchases).where(eq(rePurchases.statementId, input.id));
      for (const inv of invoices) {
        const calc = calcFromTotal(Number(inv.totalValue), input.data.defaultTaxRate!);
        await db.update(rePurchases).set({
          taxRate: String(input.data.defaultTaxRate),
          preTaxValue: String(calc.preTax),
          taxAmount: String(calc.tax),
          updatedBy: ctx.user.id, updatedAt: new Date(),
        }).where(eq(rePurchases.id, inv.id));
      }
    }
    return row;
  }),

  deleteStatement: protectedProcedure.input(z.object({ id:z.number() })).mutation(async ({ ctx, input }) => {
    assertDeletePerm(ctx.user);
    const [existing]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.id),eq(rePurchaseStatements.orgId,ctx.user.orgId)));
    if(!existing) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
    await db.delete(rePurchaseStatements).where(eq(rePurchaseStatements.id,input.id));
    return { success:true };
  }),

  copyStatement: protectedProcedure.input(z.object({ id:z.number() })).mutation(async ({ ctx, input }) => {
    assertAddPerm(ctx.user);
    const orgId=ctx.user.orgId;
    const [src]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.id),eq(rePurchaseStatements.orgId,orgId)));
    if(!src) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
    const [newStmt]=await db.insert(rePurchaseStatements).values({
      orgId, name:`${src.name} (نسخ)`, project:src.project, dateFrom:src.dateFrom, dateTo:src.dateTo,
      defaultTaxRate: src.defaultTaxRate, notes:src.notes, createdBy:ctx.user.id, updatedBy:ctx.user.id,
    }).returning();
    const invoices=await db.select().from(rePurchases).where(and(eq(rePurchases.statementId,src.id),eq(rePurchases.orgId,orgId)));
    let seq=1;
    for(const inv of invoices){
      await db.insert(rePurchases).values({
        orgId, statementId:newStmt.id, sequence:seq++,
        supplierName:inv.supplierName, supplierTaxId:inv.supplierTaxId, invoiceDate:inv.invoiceDate, invoiceNumber:inv.invoiceNumber,
        preTaxValue:inv.preTaxValue, taxRate:inv.taxRate, taxAmount:inv.taxAmount, totalValue:inv.totalValue,
        notes:inv.notes, attachmentUrl:inv.attachmentUrl, createdBy:ctx.user.id, updatedBy:ctx.user.id,
      });
    }
    return newStmt;
  }),

  // ════════════════════════════════════════════════════════════════════════════
  //  INVOICES
  // ════════════════════════════════════════════════════════════════════════════

  listInvoices: protectedProcedure
    .input(z.object({
      statementId:z.number(), search:z.string().optional(), supplierName:z.string().optional(), supplierTaxId:z.string().optional(),
      dateFrom:z.string().optional(), dateTo:z.string().optional(),
      sortBy:z.enum(['sequence','supplierName','supplierTaxId','invoiceDate','invoiceNumber','preTaxValue','taxAmount','totalValue','id']).optional(),
      sortDir:z.enum(['asc','desc']).optional(), page:z.number().default(1), limit:z.number().default(200),
    }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user); const orgId=ctx.user.orgId;
      const [stmt]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.statementId),eq(rePurchaseStatements.orgId,orgId)));
      if(!stmt) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
      const rows=await db.execute(sql`
        SELECT p.id, p.sequence, p.statement_id, p.supplier_name, p.supplier_tax_id, p.invoice_date, p.invoice_number,
          p.pre_tax_value, p.tax_rate, p.tax_amount, p.total_value, p.notes, p.attachment_url, p.created_at, p.updated_at,
          u1.name AS created_by_name, u2.name AS updated_by_name
        FROM re_purchases p
        LEFT JOIN users u1 ON u1.id=p.created_by
        LEFT JOIN users u2 ON u2.id=p.updated_by
        WHERE p.org_id=${orgId} AND p.statement_id=${input.statementId}
        ORDER BY p.sequence ASC, p.id ASC
      `);
      let data = rows.rows as Array<Record<string,any>>;
      const q=input.search?.trim();
      if(q){ const ql=q.toLowerCase(); data=data.filter(r=>(r.supplier_name??'').toLowerCase().includes(ql)||(r.invoice_number??'').toLowerCase().includes(ql)||(r.supplier_tax_id??'').toLowerCase().includes(ql)); }
      if(input.supplierName){ const f=input.supplierName.toLowerCase(); data=data.filter(r=>(r.supplier_name??'').toLowerCase().includes(f)); }
      if(input.supplierTaxId){ data=data.filter(r=>(r.supplier_tax_id??'').includes(input.supplierTaxId)); }
      if(input.dateFrom){ const from=new Date(input.dateFrom); from.setHours(0,0,0,0); data=data.filter(r=>new Date(r.invoice_date)>=from); }
      if(input.dateTo){ const to=new Date(input.dateTo); to.setHours(23,59,59,999); data=data.filter(r=>new Date(r.invoice_date)<=to); }
      const sortBy=input.sortBy??'sequence'; const sortDir=input.sortDir??'asc'; const dir=sortDir==='asc'?1:-1;
      data.sort((a,b)=>{
        const va=a[sortBy]??''; const vb=b[sortBy]??'';
        if((sortBy==='preTaxValue'||sortBy==='taxAmount'||sortBy==='totalValue'||sortBy==='sequence') && typeof va==='number'&&typeof vb==='number') return (va-vb)*dir;
        if(sortBy==='invoiceDate' && va && vb) return (new Date(va).getTime()-new Date(vb).getTime())*dir;
        return String(va).localeCompare(String(vb),'ar')*dir;
      });
      const totals={ preTax:data.reduce((s,r)=>s+Number(r.pre_tax_value??0),0), tax:data.reduce((s,r)=>s+Number(r.tax_amount??0),0), total:data.reduce((s,r)=>s+Number(r.total_value??0),0), count:data.length };
      const limit=input.limit||200; const page=input.page||1; const paginated=data.slice((page-1)*limit,page*limit);
      return { rows:paginated, totals, statement:stmt };
    }),

  getInvoice: protectedProcedure.input(z.object({ id:z.number() })).query(async ({ ctx, input }) => {
    assertViewPerm(ctx.user);
    const [row]=await db.select().from(rePurchases).where(and(eq(rePurchases.id,input.id),eq(rePurchases.orgId,ctx.user.orgId)));
    if(!row) throw new TRPCError({ code:'NOT_FOUND', message:'الفاتورة غير موجودة' });
    return row;
  }),

  checkDuplicate: protectedProcedure.input(z.object({ supplierTaxId:z.string().max(50), invoiceNumber:z.string().max(100), excludeId:z.number().optional() })).query(async ({ ctx, input }) => {
    assertViewPerm(ctx.user);
    const dup=await findDuplicate(input.supplierTaxId,input.invoiceNumber,input.excludeId);
    if(!dup) return null;
    let stmtName:string|null=null; let stmtProject:string|null=null;
    if(dup.statementId){
      const [s]=await db.select({ name:rePurchaseStatements.name, project:rePurchaseStatements.project }).from(rePurchaseStatements).where(eq(rePurchaseStatements.id,dup.statementId));
      stmtName=s?.name??null; stmtProject=s?.project??null;
    }
    return { id:dup.id, statementId:dup.statementId, statementName:stmtName, project:stmtProject, supplierName:dup.supplierName, invoiceDate:dup.invoiceDate, totalValue:dup.totalValue };
  }),

  createInvoice: protectedProcedure.input(z.object({ statementId:z.number(), data:invoiceInputSchema, allowDuplicate:z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    assertAddPerm(ctx.user); const { data, allowDuplicate } = input;
    const d = data as Required<typeof data>;
    const [stmt]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.statementId),eq(rePurchaseStatements.orgId,ctx.user.orgId)));
    if(!stmt) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
    if(d.supplierTaxId && !allowDuplicate){ const dup=await findDuplicate(d.supplierTaxId,d.invoiceNumber); if(dup) throw new TRPCError({ code:'CONFLICT', message:'تنبيه: توجد فاتورة مسجلة سابقاً لنفس المورد بنفس رقم الفاتورة.' }); }
    const taxRate = Number(stmt.defaultTaxRate ?? 15);
    const calc = calcFromTotal(d.totalValue ?? 0, taxRate);
    const seq = await getNextSequence(input.statementId);
    const [row]=await db.insert(rePurchases).values({
      orgId:ctx.user.orgId, statementId:input.statementId, sequence:seq,
      supplierName:d.supplierName!, supplierTaxId:d.supplierTaxId??null, invoiceDate:new Date(d.invoiceDate!), invoiceNumber:d.invoiceNumber!,
      preTaxValue:String(calc.preTax), taxRate:String(taxRate), taxAmount:String(calc.tax), totalValue:String(calc.total),
      notes:d.notes??null, attachmentUrl:d.attachmentUrl??null, createdBy:ctx.user.id, updatedBy:ctx.user.id,
    }).returning();
    return row;
  }),

  bulkCreateInvoices: protectedProcedure.input(z.object({ statementId:z.number(), invoices:z.array(invoiceInputSchema.extend({ allowDuplicate:z.boolean().default(false) })) })).mutation(async ({ ctx, input }) => {
    assertAddPerm(ctx.user);
    const [stmt]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.statementId),eq(rePurchaseStatements.orgId,ctx.user.orgId)));
    if(!stmt) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
    const taxRate = Number(stmt.defaultTaxRate ?? 15);
    const results:any[]=[]; const errors:string[]=[];
    for(const invRaw of input.invoices){
      const inv = invRaw as Required<typeof invRaw>;
      try{
        if(inv.supplierTaxId && !inv.allowDuplicate){ const dup=await findDuplicate(inv.supplierTaxId,inv.invoiceNumber!); if(dup){ errors.push(`فاتورة مكررة: ${inv.invoiceNumber}`); continue; } }
        const calc = calcFromTotal(inv.totalValue ?? 0, taxRate);
        const seq=await getNextSequence(input.statementId);
        const [row]=await db.insert(rePurchases).values({
          orgId:ctx.user.orgId, statementId:input.statementId, sequence:seq,
          supplierName:inv.supplierName!, supplierTaxId:inv.supplierTaxId??null, invoiceDate:new Date(inv.invoiceDate!), invoiceNumber:inv.invoiceNumber!,
          preTaxValue:String(calc.preTax), taxRate:String(taxRate), taxAmount:String(calc.tax), totalValue:String(calc.total),
          notes:inv.notes??null, attachmentUrl:inv.attachmentUrl??null, createdBy:ctx.user.id, updatedBy:ctx.user.id,
        }).returning();
        results.push(row);
      }catch(e:any){ errors.push((inv.invoiceNumber??'')+': '+(e.message??'خطأ')); }
    }
    return { results, errors, successCount:results.length, errorCount:errors.length };
  }),

  updateInvoice: protectedProcedure.input(z.object({ id:z.number(), data:invoiceInputSchema, allowDuplicate:z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    assertEditPerm(ctx.user); const { data, allowDuplicate } = input;
    const d = data as Required<typeof data>;
    const [existing]=await db.select().from(rePurchases).where(and(eq(rePurchases.id,input.id),eq(rePurchases.orgId,ctx.user.orgId)));
    if(!existing) throw new TRPCError({ code:'NOT_FOUND', message:'الفاتورة غير موجودة' });
    if(d.supplierTaxId && !allowDuplicate){ const dup=await findDuplicate(d.supplierTaxId,d.invoiceNumber!,input.id); if(dup) throw new TRPCError({ code:'CONFLICT', message:'تنبيه: توجد فاتورة مسجلة سابقاً.' }); }
    // Phase 3c: tax rate comes from the statement, only total is editable
    const [stmt]=await db.select({ defaultTaxRate: rePurchaseStatements.defaultTaxRate }).from(rePurchaseStatements).where(eq(rePurchaseStatements.id, existing.statementId));
    const taxRate = Number(stmt?.defaultTaxRate ?? 15);
    const calc = calcFromTotal(d.totalValue ?? 0, taxRate);
    const [row]=await db.update(rePurchases).set({
      supplierName:d.supplierName!, supplierTaxId:d.supplierTaxId??null, invoiceDate:new Date(d.invoiceDate!), invoiceNumber:d.invoiceNumber!,
      preTaxValue:String(calc.preTax), taxRate:String(taxRate), taxAmount:String(calc.tax), totalValue:String(calc.total),
      notes:d.notes??null, attachmentUrl:d.attachmentUrl??null, updatedBy:ctx.user.id, updatedAt:new Date(),
    }).where(eq(rePurchases.id,input.id)).returning();
    return row;
  }),

  deleteInvoice: protectedProcedure.input(z.object({ id:z.number() })).mutation(async ({ ctx, input }) => {
    assertDeletePerm(ctx.user);
    const [existing]=await db.select().from(rePurchases).where(and(eq(rePurchases.id,input.id),eq(rePurchases.orgId,ctx.user.orgId)));
    if(!existing) throw new TRPCError({ code:'NOT_FOUND', message:'الفاتورة غير موجودة' });
    const stmtId = existing.statementId;
    await db.delete(rePurchases).where(eq(rePurchases.id,input.id));
    if (stmtId) await reorderSequences(stmtId);
    return { success:true };
  }),

  // ─── Export data endpoint ───────────────────────────────────────────────────────
  exportStatement: protectedProcedure
    .input(z.object({ statementId:z.number() }))
    .query(async ({ ctx, input }) => {
      assertExportPerm(ctx.user); const orgId=ctx.user.orgId;
      const [stmt]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.statementId),eq(rePurchaseStatements.orgId,orgId)));
      if(!stmt) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
      const [org]=await db.select({ name:organizations.name, taxNumber:organizations.taxNumber }).from(organizations).where(eq(organizations.id,orgId));
      const invoices=await db.select().from(rePurchases).where(and(eq(rePurchases.statementId,input.statementId),eq(rePurchases.orgId,orgId))).orderBy(asc(rePurchases.sequence),asc(rePurchases.id));
      const totals={
        preTax: invoices.reduce((s,r)=>s+Number(r.preTaxValue??0),0),
        tax: invoices.reduce((s,r)=>s+Number(r.taxAmount??0),0),
        total: invoices.reduce((s,r)=>s+Number(r.totalValue??0),0),
        count: invoices.length,
      };
      return { org, statement:stmt, invoices, totals };
    }),

  // ─── Excel import: preview rows before saving ──────────────────────────────────────────────────
  previewImport: protectedProcedure
    .input(z.object({
      statementId: z.number(),
      rows: z.array(z.object({
        supplierName: z.string(),
        supplierTaxId: z.string().nullable().optional(),
        invoiceDate: z.string(),
        invoiceNumber: z.string(),
        totalValue: z.number(),
        notes: z.string().nullable().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      assertImportPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const [stmt]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.statementId),eq(rePurchaseStatements.orgId,orgId)));
      if(!stmt) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
      const taxRate = Number(stmt.defaultTaxRate ?? 15);

      // Fetch existing invoices for duplicate detection
      const existing = await db.select({
        supplierTaxId: rePurchases.supplierTaxId, invoiceNumber: rePurchases.invoiceNumber,
        statementName: rePurchaseStatements.name,
      })
        .from(rePurchases)
        .leftJoin(rePurchaseStatements, eq(rePurchaseStatements.id, rePurchases.statementId))
        .where(eq(rePurchases.orgId, orgId));

      const existingKeySet = new Set<string>();
      for (const e of existing) {
        if (e.supplierTaxId && e.invoiceNumber) {
          existingKeySet.add(`${e.supplierTaxId}::${e.invoiceNumber}`);
        }
      }

      // Track duplicates within the import file itself
      const fileKeySet = new Set<string>();

      const preview = input.rows.map((r, i) => {
        const errors: string[] = [];
        if (!r.supplierName.trim()) errors.push('اسم المورد مطلوب');
        if (!r.invoiceNumber.trim()) errors.push('رقم الفاتورة مطلوب');
        if (!r.invoiceDate.trim()) errors.push('تاريخ الفاتورة مطلوب');
        if (isNaN(Date.parse(r.invoiceDate))) errors.push('تاريخ غير صالح');
        if (r.totalValue <= 0) errors.push('إجمالي الفاتورة يجب أن يكون > 0');
        if (r.supplierTaxId && !/^\d+$/.test(r.supplierTaxId.trim())) errors.push('رقم ضريبي غير صالح');

        const key = r.supplierTaxId ? `${r.supplierTaxId.trim()}::${r.invoiceNumber.trim()}` : null;
        let dupInfo: any = null;
        if (key && errors.length === 0) {
          if (fileKeySet.has(key)) {
            errors.push('فاتورة مكررة في الملف');
          } else {
            fileKeySet.add(key);
          }
          if (existingKeySet.has(key)) {
            const existingRow = existing.find(e => e.supplierTaxId === r.supplierTaxId && e.invoiceNumber === r.invoiceNumber);
            dupInfo = { statementName: existingRow?.statementName ?? null };
            errors.push('فاتورة مكررة في النظام');
          }
        }

        const calc = calcFromTotal(r.totalValue, taxRate);
        return {
          index: i,
          supplierName: r.supplierName,
          supplierTaxId: r.supplierTaxId ?? null,
          invoiceDate: r.invoiceDate,
          invoiceNumber: r.invoiceNumber,
          totalValue: r.totalValue,
          preTaxValue: calc.preTax,
          taxAmount: calc.tax,
          taxRate,
          notes: r.notes ?? null,
          errors,
          dupInfo,
          valid: errors.length === 0,
        };
      });

      const totalRows = preview.length;
      const validRows = preview.filter(r => r.valid);
      const errorRows = preview.filter(r => !r.valid);
      const dupRows = preview.filter(r => r.dupInfo);
      const totalImported = validRows.reduce((s, r) => s + r.totalValue, 0);
      const preTaxTotal = validRows.reduce((s, r) => s + r.preTaxValue, 0);
      const taxTotal = validRows.reduce((s, r) => s + r.taxAmount, 0);

      return {
        preview,
        summary: { totalRows, validCount: validRows.length, errorCount: errorRows.length, dupCount: dupRows.length, totalImported, preTaxTotal, taxTotal },
        taxRate,
      };
    }),

  // ─── Execute import after preview confirmation ──────────────────────────────────────────────
  executeImport: protectedProcedure
    .input(z.object({
      statementId: z.number(),
      rows: z.array(z.object({
        supplierName: z.string(),
        supplierTaxId: z.string().nullable().optional(),
        invoiceDate: z.string(),
        invoiceNumber: z.string(),
        totalValue: z.number(),
        notes: z.string().nullable().optional(),
        allowDuplicate: z.boolean().default(false),
      })),
      skipDuplicates: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertImportPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const [stmt]=await db.select().from(rePurchaseStatements).where(and(eq(rePurchaseStatements.id,input.statementId),eq(rePurchaseStatements.orgId,orgId)));
      if(!stmt) throw new TRPCError({ code:'NOT_FOUND', message:'البيان غير موجود' });
      const taxRate = Number(stmt.defaultTaxRate ?? 15);

      const results: any[] = [];
      const skipped: any[] = [];
      const errors: string[] = [];

      for (const row of input.rows) {
        try {
          if (row.supplierTaxId && !row.allowDuplicate && input.skipDuplicates) {
            const dup = await findDuplicate(row.supplierTaxId, row.invoiceNumber);
            if (dup) { skipped.push(row); continue; }
          }
          const calc = calcFromTotal(row.totalValue, taxRate);
          const seq = await getNextSequence(input.statementId);
          const [inv] = await db.insert(rePurchases).values({
            orgId, statementId: input.statementId, sequence: seq,
            supplierName: row.supplierName, supplierTaxId: row.supplierTaxId ?? null,
            invoiceDate: new Date(row.invoiceDate), invoiceNumber: row.invoiceNumber,
            preTaxValue: String(calc.preTax), taxRate: String(taxRate),
            taxAmount: String(calc.tax), totalValue: String(calc.total),
            notes: row.notes ?? null, createdBy: ctx.user.id, updatedBy: ctx.user.id,
          }).returning();
          results.push(inv);
        } catch(e: any) {
          errors.push(`${row.invoiceNumber}: ${e.message ?? 'خطأ'}`);
        }
      }

      return { importedCount: results.length, skippedCount: skipped.length, errorCount: errors.length, errors, results };
    }),
});
