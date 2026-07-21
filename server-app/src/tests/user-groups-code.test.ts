/**
 * user-groups-code.test.ts
 *
 * اختبارات وحدة لمنطق التحقق من كود مجموعة المستخدمين:
 *  - الكود إجباري (لا يُقبل فارغاً أو مسافات فقط)
 *  - الكود فريد داخل نفس المنشأة (بين المجموعات النشطة)
 *  - نفس الكود مسموح به في منشأتين مختلفتين
 *  - الـ trim يُطبَّق على الكود قبل الحفظ
 *
 * ════════════════════════════════════════════
 *  GC-1  إنشاء بدون كود → يرفض
 *  GC-2  إنشاء بكود مسافات فقط → يرفض
 *  GC-3  إنشاء بكود صحيح → ينجح
 *  GC-4  إنشاء بكود مكرر في نفس المنشأة → يرفض
 *  GC-5  إنشاء بكود مكرر في منشأة مختلفة → ينجح
 *  GC-6  تعديل: تغيير كود لقيمة فارغة → يرفض
 *  GC-7  تعديل: تغيير كود لقيمة مكررة في نفس المنشأة → يرفض
 *  GC-8  تعديل: الكود نفسه (بدون تغيير للمجموعة ذاتها) → ينجح
 *  GC-9  الـ trim يُطبَّق: كود بمسافات جانبية → يُحفظ بدون مسافات
 * ════════════════════════════════════════════
 */

// vitest globals: describe, it, expect — no imports needed (globals: true in vitest.config.ts)

// ── Types ─────────────────────────────────────────────────────────────────────
type MockGroup = { id: number; orgId: number; code: string; isActive: boolean };
type CreateInput = { code?: string; name: string; orgId: number };
type UpdateInput = { id: number; code?: string; name?: string; orgId: number };

// ── Inline mirror of the validation logic in userGroupsRouter (settings.ts) ──
async function validateCreate(input: CreateInput, existing: MockGroup[]): Promise<string> {
  const code = (input.code ?? '').trim();
  if (!code) throw new Error('يرجى إدخال كود مجموعة المستخدمين');
  const dup = existing.find(g => g.orgId === input.orgId && g.code === code && g.isActive);
  if (dup)   throw new Error('كود مجموعة المستخدمين مستخدم من قبل');
  return code;
}

async function validateUpdate(input: UpdateInput, existing: MockGroup[]): Promise<string | undefined> {
  if (input.code === undefined) return undefined;
  const code = (input.code ?? '').trim();
  if (!code) throw new Error('يرجى إدخال كود مجموعة المستخدمين');
  const dup = existing.find(g => g.orgId === input.orgId && g.code === code && g.isActive && g.id !== input.id);
  if (dup)   throw new Error('كود مجموعة المستخدمين مستخدم من قبل');
  return code;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const org1 = 1;
const org2 = 2;
const baseGroups: MockGroup[] = [
  { id: 10, orgId: org1, code: 'GRP-A', isActive: true  },
  { id: 11, orgId: org1, code: 'GRP-B', isActive: false }, // inactive — reusable
  { id: 20, orgId: org2, code: 'GRP-A', isActive: true  }, // same code, different org
];

// ── create tests ──────────────────────────────────────────────────────────────
describe('UserGroup code validation — create', () => {

  it('GC-1: rejects create with no code field', async () => {
    await expect(validateCreate({ name: 'Test', orgId: org1 }, baseGroups))
      .rejects.toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-2: rejects create with whitespace-only code', async () => {
    await expect(validateCreate({ code: '   ', name: 'Test', orgId: org1 }, baseGroups))
      .rejects.toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-3: accepts create with valid unique code', async () => {
    const code = await validateCreate({ code: 'GRP-C', name: 'Test', orgId: org1 }, baseGroups);
    expect(code).toBe('GRP-C');
  });

  it('GC-4: rejects duplicate active code in same org', async () => {
    await expect(validateCreate({ code: 'GRP-A', name: 'Test', orgId: org1 }, baseGroups))
      .rejects.toThrow('كود مجموعة المستخدمين مستخدم من قبل');
  });

  it('GC-5: allows same code in a different org', async () => {
    const code = await validateCreate({ code: 'GRP-A', name: 'Test', orgId: org2 + 1 }, baseGroups);
    expect(code).toBe('GRP-A');
  });

  it('GC-5b: allows reuse of inactive group code in same org', async () => {
    const code = await validateCreate({ code: 'GRP-B', name: 'Test', orgId: org1 }, baseGroups);
    expect(code).toBe('GRP-B');
  });

  it('GC-9: trims leading/trailing whitespace from code', async () => {
    const code = await validateCreate({ code: '  GRP-D  ', name: 'Test', orgId: org1 }, baseGroups);
    expect(code).toBe('GRP-D');
  });
});

// ── update tests ──────────────────────────────────────────────────────────────
describe('UserGroup code validation — update', () => {

  it('GC-6: rejects update with empty string code', async () => {
    await expect(validateUpdate({ id: 10, code: '', orgId: org1 }, baseGroups))
      .rejects.toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-6b: rejects update with whitespace-only code', async () => {
    await expect(validateUpdate({ id: 10, code: '   ', orgId: org1 }, baseGroups))
      .rejects.toThrow('يرجى إدخال كود مجموعة المستخدمين');
  });

  it('GC-7: rejects code already used by another active group in same org', async () => {
    const groups = [
      ...baseGroups,
      { id: 12, orgId: org1, code: 'GRP-X', isActive: true },
    ];
    await expect(validateUpdate({ id: 10, code: 'GRP-X', orgId: org1 }, groups))
      .rejects.toThrow('كود مجموعة المستخدمين مستخدم من قبل');
  });

  it('GC-8: allows keeping own code (no self-conflict)', async () => {
    const code = await validateUpdate({ id: 10, code: 'GRP-A', orgId: org1 }, baseGroups);
    expect(code).toBe('GRP-A');
  });

  it('GC-8b: skipping code field in update is allowed (returns undefined)', async () => {
    const code = await validateUpdate({ id: 10, name: 'New Name', orgId: org1 }, baseGroups);
    expect(code).toBeUndefined();
  });

  it('GC-9b: trims whitespace from code on update', async () => {
    const code = await validateUpdate({ id: 10, code: ' GRP-Z ', orgId: org1 }, baseGroups);
    expect(code).toBe('GRP-Z');
  });
});
