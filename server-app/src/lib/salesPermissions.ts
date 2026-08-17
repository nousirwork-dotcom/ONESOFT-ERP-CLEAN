import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { documentJournals, userGroupMembers, userGroups, warehouses } from '../schema.js';

export type SalesUser = {
  id: number;
  orgId: number;
  role: string;
  userGroupId?: number | null;
  extraPermissions?: Record<string, boolean> | null;
};

type SalesAction = 'save' | 'post' | 'unpost' | 'delete';

const permissionAliases: Record<SalesAction, string[]> = {
  save: ['sales_save', 'sales_create', 'sales_edit'],
  post: ['sales_post'],
  unpost: ['sales_unpost'],
  delete: ['sales_delete'],
};

export async function assertSalesPermission(user: SalesUser, action: SalesAction) {
  if (user.role === 'admin' || user.role === 'superadmin') return;

  const permissions = user.extraPermissions ?? {};
  const aliases = permissionAliases[action];
  const configured = aliases.find((permission) => permission in permissions);
  if (configured && permissions[configured] === true) return;
  if (configured && permissions[configured] === false) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'لا تملك صلاحية تنفيذ هذا الإجراء على مستندات المبيعات' });
  }
  // Existing organizations may not have migrated the new granular keys yet.
  // In that case preserve the current role-based behavior until a key is set.
}

export async function assertJournalAccess(user: SalesUser, journalId: number | null | undefined) {
  if (!journalId || user.role === 'admin' || user.role === 'superadmin') return;
  const journal = await db.query.documentJournals.findFirst({
    where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, user.orgId)),
  });
  if (!journal) throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر المستند غير موجود أو لا ينتمي للمؤسسة' });

  if (journal.allowedUserId && journal.allowedUserId !== user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذا الدفتر مقيّد بمستخدم آخر' });
  }
  if (journal.allowedUserGroup) {
    const group = await db.query.userGroups.findFirst({
      where: and(
        eq(userGroups.orgId, user.orgId),
        eq(userGroups.code, journal.allowedUserGroup),
        eq(userGroups.isActive, true),
      ),
      columns: { id: true },
    });
    const member = group && await db.query.userGroupMembers.findFirst({
      where: and(
        eq(userGroupMembers.orgId, user.orgId),
        eq(userGroupMembers.groupId, group.id),
        eq(userGroupMembers.memberType, 'user'),
        eq(userGroupMembers.memberUserId, user.id),
      ),
      columns: { id: true },
    });
    if (!member) throw new TRPCError({ code: 'FORBIDDEN', message: 'لا تملك صلاحية استخدام مجموعة هذا الدفتر' });
  }
}

export async function assertWarehouseAccess(user: SalesUser, warehouseId: number | null | undefined) {
  if (!warehouseId || user.role === 'admin' || user.role === 'superadmin') return;
  const warehouse = await db.query.warehouses.findFirst({
    where: and(eq(warehouses.id, warehouseId), eq(warehouses.orgId, user.orgId)),
  });
  if (!warehouse) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المخزن غير موجود أو لا ينتمي للمؤسسة' });
  if (warehouse.allowedUserId && warehouse.allowedUserId !== user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذا المخزن مقيّد بمستخدم آخر' });
  }
  if (warehouse.allowedUserGroup) {
    const group = await db.query.userGroups.findFirst({
      where: and(
        eq(userGroups.orgId, user.orgId),
        eq(userGroups.code, warehouse.allowedUserGroup),
        eq(userGroups.isActive, true),
      ),
      columns: { id: true },
    });
    const member = group && await db.query.userGroupMembers.findFirst({
      where: and(
        eq(userGroupMembers.orgId, user.orgId),
        eq(userGroupMembers.groupId, group.id),
        eq(userGroupMembers.memberType, 'user'),
        eq(userGroupMembers.memberUserId, user.id),
      ),
      columns: { id: true },
    });
    if (!member) throw new TRPCError({ code: 'FORBIDDEN', message: 'لا تملك صلاحية استخدام مجموعة هذا المخزن' });
  }
}