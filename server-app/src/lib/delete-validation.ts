/**
 * delete-validation.ts — دوال التحقق من الحذف الآمن
 *
 * توفر فحصاً مركزياً لجميع الارتباطات قبل حذف أي سجل تأسيسي.
 */

import { db } from '../db.js';
import { and, eq, sql } from 'drizzle-orm';
import {
  inventory, stockVouchers, stockVoucherItems, inventoryCounts,
  salesInvoices, purchaseInvoices,
  documentJournals, userWarehouseAssignments,
  warehouseAccountLinks,
  foundationTombstones,
  warehouses,
  users,
} from '../schema.js';

// ─── أنواع مخرجات فحص الحذف ──────────────────────────────────────────────────

export interface DeletionCheck {
  allowed: boolean;
  hasMovements: boolean;
  hasLinksOnly: boolean;
  movements:  DeletionCheckItem[];
  links:      DeletionCheckItem[];
  reason?: string;
}

export interface DeletionCheckItem {
  table:  string;
  label:  string;
  count:  number;
  /** true = حركة فعلية تمنع الحذف, false = رابط/مرجع */
  isMovement: boolean;
}

// ─── فئات الارتباطات ─────────────────────────────────────────────────────────

const MOVEMENT_TABLES: Array<{ table: any; orgField: any; idField: any; label: string }> = [
  { table: inventory,         orgField: (inventory as any).orgId,         idField: (inventory as any).warehouseId,         label: 'أرصدة مخزنية' },
  { table: stockVouchers,     orgField: (stockVouchers as any).orgId,     idField: (stockVouchers as any).warehouseId,     label: 'حركات مخزنية' },
  { table: stockVoucherItems, orgField: null,                              idField: (stockVoucherItems as any).warehouseId, label: 'أصناف في حركات المخزون' },
  { table: inventoryCounts,   orgField: (inventoryCounts as any).orgId,   idField: (inventoryCounts as any).warehouseId,   label: 'جرد مخزني' },
  { table: salesInvoices,     orgField: (salesInvoices as any).orgId,     idField: (salesInvoices as any).warehouseId,     label: 'فواتير مبيعات' },
  { table: purchaseInvoices,  orgField: (purchaseInvoices as any).orgId,  idField: (purchaseInvoices as any).warehouseId,   label: 'فواتير مشتريات' },
];

const LINK_TABLES: Array<{ table: any; orgField: any; idField: any; label: string }> = [
  { table: documentJournals,          orgField: (documentJournals as any).orgId,          idField: (documentJournals as any).warehouseId,          label: 'دفاتر مستندات' },
  { table: userWarehouseAssignments,  orgField: (userWarehouseAssignments as any).orgId,  idField: (userWarehouseAssignments as any).warehouseId,  label: 'تخصيصات المستخدمين' },
  { table: warehouseAccountLinks,     orgField: null,                                      idField: (warehouseAccountLinks as any).warehouseId,     label: 'روابط حسابات المخزن' },
];

/**
 * فحص جميع الارتباطات لمخزن معين قبل الحذف.
 * @returns DeletionCheck مفصل
 */
export async function checkWarehouseDeletion(
  warehouseId: number,
  orgId: number,
): Promise<DeletionCheck> {
  const movements: DeletionCheckItem[] = [];
  const links: DeletionCheckItem[] = [];

  // فحص جداول الحركات
  for (const m of MOVEMENT_TABLES) {
    const whereClause: any[] = [eq(m.idField, warehouseId)];
    if (m.orgField) whereClause.push(eq(m.orgField, orgId));
    const rows = await (db.select({ count: sql<number>`count(*)::int` } as any) as any)
      .from(m.table)
      .where(and(...whereClause));
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      movements.push({ table: m.table._.name, label: m.label, count, isMovement: true });
    }
  }

  // فحص جداول الروابط
  for (const l of LINK_TABLES) {
    const whereClause: any[] = [eq(l.idField, warehouseId)];
    if (l.orgField) whereClause.push(eq(l.orgField, orgId));
    const rows = await (db.select({ count: sql<number>`count(*)::int` } as any) as any)
      .from(l.table)
      .where(and(...whereClause));
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      links.push({ table: l.table._.name, label: l.label, count, isMovement: false });
    }
  }

  // فحص المستخدمين (default_warehouse_id)
  const userRows = await db.select({ count: sql<number>`count(*)::int` } as any)
    .from(users)
    .where(and(eq((users as any).defaultWarehouseId, warehouseId), eq((users as any).orgId, orgId)) as any);
  const userCount = Number(userRows[0]?.count ?? 0);
  if (userCount > 0) {
    links.push({ table: 'users', label: 'مستخدمون (المخزن الافتراضي)', count: userCount, isMovement: false });
  }

  const hasMovements = movements.length > 0;
  const hasLinksOnly = !hasMovements && links.length > 0;

  return {
    allowed: !hasMovements,
    hasMovements,
    hasLinksOnly,
    movements,
    links,
    reason: hasMovements
      ? 'لا يمكن حذف المخزن لوجود حركات مرتبطة به'
      : hasLinksOnly
        ? 'يمكن حذف المخزن بعد نقل الارتباطات التالية'
        : undefined,
  };
}

/**
 * يسجّل Tombstone لمخزن تأسيسي تم حذفه لمنع إعادة إنشائه
 */
export async function recordWarehouseTombstone(
  warehouseId: number,
  orgId: number,
  deletedBy: number,
  reason?: string,
): Promise<void> {
  const wh = await db.query.warehouses.findFirst({
    where: and(eq((db as any).warehouses?.id, warehouseId), eq((db as any).warehouses?.orgId, orgId)),
  });

  if (!wh || !wh.foundationKey) return; // فقط سجلات التأسيس ذات المفتاح

  // upsert — لا نكرر
  await db.insert(foundationTombstones).values({
    orgId,
    tableName: 'warehouses',
    foundationKey: wh.foundationKey,
    deletedBy,
    reason: reason ?? 'حذف بواسطة المستخدم',
  }).onConflictDoNothing({
    target: [
      (foundationTombstones as any).orgId,
      (foundationTombstones as any).tableName,
      (foundationTombstones as any).foundationKey,
    ],
  });

  // نفرّغ foundationKey من السجل المحذوف لتمييزه كحذف مستخدم
  await db.update(warehouses as any)
    .set({ foundationKey: null } as any)
    .where(and(
      eq((warehouses as any).id, warehouseId),
      eq((warehouses as any).orgId, orgId),
    ));
}
