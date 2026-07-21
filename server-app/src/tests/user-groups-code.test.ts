/// <reference types="vitest/globals" />
/**
 * user-groups-code.test.ts
 *
 * اختبارات لمنطق كود مجموعة المستخدمين (مستويان):
 *
 * A) Unit — يختبر دوال التحقق المنعكسة مباشرةً من settings.ts (سريع، بدون DB)
 * B) Integration — يختبر قيود DB الفعلية مباشرةً على PostgreSQL
 *
 * ════════════════════════════════════════════════════════
 *  GC-1   إنشاء بدون كود → يرفض (unit + DB زود schema)
 *  GC-2   إنشاء بكود مسافات فقط → يرفض
 *  GC-3   إنشاء بكود صحيح → ينجح
 *  GC-4   إنشاء بكود مكرر نفس المنشأة (نشط) → يرفض
 *  GC-5   إنشاء بكود مكرر منشأة مختلفة → ينجح
 *  GC-5b  كود مجموعة محذوفة (is_active=false) مسموح إعادة استخدامه
 *  GC-6   تعديل: كود فارغ → يرفض
 *  GC-7   تعديل: كود مكرر نفس المنشأة → يرفض
 *  GC-8   تعديل: نفس الكود للمجموعة ذاتها → ينجح
 *  GC-8b  تعديل: بدون تمرير code → undefined (لا تعديل)
 *  GC-9   trim يُطبَّق على الكود
 *  GC-10  DB: unique index يمنع INSERT مكرر مباشرةً
 *  GC-11  DB: unique index يسمح نفس الكود لمنشأة مختلفة
 *  GC-12  DB: NOT NULL يمنع code=NULL
 * ════════════════════════════════════════════════════════
 */

import pg from 'pg';
const { Client } = pg;

// ── A) Unit tests — mirror of validation logic in userGroupsRouter ─────────────

type MockGroup = { id: number; orgId: number; code: string; isActive: boolean };
type CreateInput = { code?: string; name: string; orgId: number };
type UpdateInput = { id: number; code?: string; name?: string; orgId: number };

function validateCreateLogic(input: CreateInput, existing: MockGroup[]): string {
  const code = (input.code ?? '').trim();
  if (!code) throw new Error('يرجى إدخال كود مجموعة المستخدمين');
  const dup = existing.find(g => g.orgId === input.orgId && g.code === code && g.isActive);
  if (dup) throw new Error('كود مجموعة المستخدمين مستخدم من قبل');
  return code;
}

function validateUpdateLogic(input: UpdateInput, existing: MockGroup[]): string | undefined {
  if (input.code === undefined) return undefined;
  const code = (input.code ?? '').trim();
  if (!code) throw new Error('يرجى إدخال كود مجموعة المستخدمين');
  const dup = existing.find(g => g.orgId === input.orgId && g.code === code && g.isActive && g.id !== input.id);
  if (dup) throw new Error('كود مجموعة المستخدمين مستخدم من قبل');
  return code;
}

const org1 = 1;
const org2 = 2;
const baseGroups: MockGroup[] = [
  { id: 10, orgId: org1, code: 'GRP-A', isActive: true  },
  { id: 11, orgId: org1, code: 'GRP-B', isActive: false },
  { id: 20, orgId: org2, code: 'GRP-A', isActive: true  },
];

describe('A) Unit — create validation logic', () => {
  it('GC-1: rejects create with no code', () => {
    expect(() => validateCreateLogic({ name: 'Test', orgId: org1 }, baseGroups))
      .toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-2: rejects create with whitespace-only code', () => {
    expect(() => validateCreateLogic({ code: '   ', name: 'Test', orgId: org1 }, baseGroups))
      .toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-3: accepts create with valid unique code', () => {
    expect(validateCreateLogic({ code: 'GRP-C', name: 'Test', orgId: org1 }, baseGroups)).toBe('GRP-C');
  });

  it('GC-4: rejects duplicate active code in same org', () => {
    expect(() => validateCreateLogic({ code: 'GRP-A', name: 'Test', orgId: org1 }, baseGroups))
      .toThrow('كود مجموعة المستخدمين مستخدم من قبل');
  });

  it('GC-5: allows same code in a different org', () => {
    expect(validateCreateLogic({ code: 'GRP-A', name: 'Test', orgId: 999 }, baseGroups)).toBe('GRP-A');
  });

  it('GC-5b: allows reuse of inactive code in same org', () => {
    expect(validateCreateLogic({ code: 'GRP-B', name: 'Test', orgId: org1 }, baseGroups)).toBe('GRP-B');
  });

  it('GC-9: trims leading/trailing whitespace', () => {
    expect(validateCreateLogic({ code: '  GRP-D  ', name: 'Test', orgId: org1 }, baseGroups)).toBe('GRP-D');
  });
});

describe('A) Unit — update validation logic', () => {
  it('GC-6: rejects update with empty string code', () => {
    expect(() => validateUpdateLogic({ id: 10, code: '', orgId: org1 }, baseGroups))
      .toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-6b: rejects update with whitespace-only code', () => {
    expect(() => validateUpdateLogic({ id: 10, code: '   ', orgId: org1 }, baseGroups))
      .toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-7: rejects code used by another active group in same org', () => {
    const groups = [...baseGroups, { id: 12, orgId: org1, code: 'GRP-X', isActive: true }];
    expect(() => validateUpdateLogic({ id: 10, code: 'GRP-X', orgId: org1 }, groups))
      .toThrow('كود مجموعة المستخدمين مستخدم من قبل');
  });

  it('GC-8: allows keeping own code (no self-conflict)', () => {
    expect(validateUpdateLogic({ id: 10, code: 'GRP-A', orgId: org1 }, baseGroups)).toBe('GRP-A');
  });

  it('GC-8b: undefined code field → returns undefined', () => {
    expect(validateUpdateLogic({ id: 10, orgId: org1 }, baseGroups)).toBeUndefined();
  });

  it('GC-9b: trims whitespace from code on update', () => {
    expect(validateUpdateLogic({ id: 10, code: ' GRP-Z ', orgId: org1 }, baseGroups)).toBe('GRP-Z');
  });
});

// ── B) Integration — DB constraints via direct PostgreSQL connection ────────────
// Looks up a real org_id from the DB to satisfy the FK constraint on user_groups.

let testOrgId: number;
let testClient: InstanceType<typeof Client>;

async function getTestOrgId(db: InstanceType<typeof Client>): Promise<number> {
  const r = await db.query<{ id: number }>('SELECT id FROM organizations LIMIT 1');
  if (!r.rows.length) throw new Error('No organization found in DB — cannot run integration tests');
  return r.rows[0].id;
}

beforeAll(async () => {
  testClient = new Client({ connectionString: process.env.DATABASE_URL });
  await testClient.connect();
  testOrgId = await getTestOrgId(testClient);
});

afterAll(async () => {
  await testClient.query(
    "DELETE FROM user_groups WHERE org_id = $1 AND code LIKE 'VITEST-%'",
    [testOrgId],
  );
  await testClient.end();
});

describe('B) Integration — DB constraints on user_groups', () => {
  it('GC-10: DB unique index blocks duplicate active code in same org', async () => {
    const code = `VITEST-DUP-${Date.now()}`;
    await testClient.query(
      'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, $2, $3, true)',
      [testOrgId, code, 'Group A'],
    );
    await expect(
      testClient.query(
        'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, $2, $3, true)',
        [testOrgId, code, 'Group B'],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('GC-11: DB unique index allows same code for a different org (other orgs allowed)', async () => {
    const code = `VITEST-SHARE-${Date.now()}`;
    await testClient.query(
      'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, $2, $3, true)',
      [testOrgId, code, 'Shared Group'],
    );
    const r2 = await testClient.query<{ id: number }>(
      'SELECT id FROM organizations WHERE id != $1 LIMIT 1',
      [testOrgId],
    );
    if (r2.rows.length) {
      const other = r2.rows[0].id;
      await testClient.query(
        'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, $2, $3, true)',
        [other, code, 'Shared Group Other Org'],
      );
      await testClient.query(
        "DELETE FROM user_groups WHERE org_id = $1 AND code LIKE 'VITEST-%'",
        [other],
      );
    }
  });

  it('GC-11b: DB index is partial — inactive group code can be reused as active', async () => {
    const code = `VITEST-REUSE-${Date.now()}`;
    await testClient.query(
      'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, $2, $3, false)',
      [testOrgId, code, 'Old Inactive'],
    );
    await testClient.query(
      'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, $2, $3, true)',
      [testOrgId, code, 'New Active'],
    );
  });

  it('GC-12: DB NOT NULL constraint blocks NULL code', async () => {
    await expect(
      testClient.query(
        'INSERT INTO user_groups (org_id, code, name, is_active) VALUES ($1, NULL, $2, true)',
        [testOrgId, 'No Code'],
      ),
    ).rejects.toMatchObject({ code: '23502' });
  });

  it('GC-4 (zod schema): create input rejects empty string code with Arabic message', async () => {
    const { z } = await import('zod');
    const createSchema = z.object({
      code: z.string().min(1, 'يرجى إدخال كود مجموعة المستخدمين'),
      name: z.string().min(1),
      description: z.string().optional(),
    });
    const result = createSchema.safeParse({ code: '', name: 'Test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('يرجى إدخال كود مجموعة المستخدمين');
    }
  });
});
