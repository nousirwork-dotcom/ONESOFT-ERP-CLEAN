/// <reference types="vitest/globals" />
/**
 * foundation-template.test.ts
 *
 * يتحقق من أن foundation-data.json هو مصدر الحقيقة لقالب التأسيس:
 * - العدد لا يقل عن 70 دفتراً (قد يزيد عند إضافة دفاتر نظام جديدة)
 * - وجود دفاتر سند القيد الثمانية (MJ1-MJ4 يدوي + SJ1-SJ4 نظام)
 * - عدم وجود CERT01 أو SLS-3 (سجلات اختبارية)
 * - عدم تكرار (docType, code) داخل القالب
 *
 * ════════════════════════════════════════════════════════
 *  FT-1   العدد لا يقل عن 70
 *  FT-2   سندات القيد MJ1-MJ4 موجودة
 *  FT-3   سندات القيد SJ1-SJ4 موجودة
 *  FT-4   لا يوجد CERT01
 *  FT-5   لا يوجد SLS-3
 *  FT-6   لا تكرار (docType, code)
 *  FT-7   جميع الدفاتر لها foundationKey
 *  FT-8   جميع الدفاتر لها recordPolicy
 *  FT-9   لا توجد علاقات user/group رقمية محلية داخل القالب
 * ════════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';

interface FoundationJournal {
  docType: string;
  code: string;
  name: string;
  foundationKey: string | null;
  recordPolicy: string | null;
  [key: string]: unknown;
}

interface FoundationData {
  documentJournals: FoundationJournal[];
  totalRecords: number;
  exportedAt: string;
  [key: string]: unknown;
}

const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
let foundationData: FoundationData;

beforeAll(() => {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  foundationData = JSON.parse(raw) as FoundationData;
});

// ─── FT-1: العدد لا يقل عن 70 ────────────────────────────────────────────────
describe('FT-1: عدد دفاتر القالب لا يقل عن 70', () => {
  it('يجب أن يحتوي القالب على 70 دفتراً على الأقل', () => {
    expect(foundationData.documentJournals.length).toBeGreaterThanOrEqual(70);
  });
});

// ─── FT-2 / FT-3: سندات القيد ─────────────────────────────────────────────────
describe('FT-2 & FT-3: سندات القيد الثمانية (MJ1-MJ4 يدوي + SJ1-SJ4 نظام)', () => {
  const requiredEntryCodes = ['MJ1', 'MJ2', 'MJ3', 'MJ4'];
  const requiredSystemCodes = ['SJ1', 'SJ2', 'SJ3', 'SJ4'];
  const allRequired = [...requiredEntryCodes, ...requiredSystemCodes];

  for (const code of allRequired) {
    it(`يجب أن يحتوي القالب على دفتر سند قيد بالكود ${code}`, () => {
      const found = foundationData.documentJournals.some(
        j => j.docType === 'journal_entry' && j.code === code
      );
      expect(found).toBe(true);
    });
  }
});

// ─── FT-4: لا يوجد CERT01 ─────────────────────────────────────────────────────
describe('FT-4: عدم وجود سجلات اختبارية CERT01', () => {
  it('يجب ألا يحتوي القالب على CERT01', () => {
    const found = foundationData.documentJournals.some(j => j.code === 'CERT01');
    expect(found).toBe(false);
  });
});

// ─── FT-5: لا يوجد SLS-3 ──────────────────────────────────────────────────────
describe('FT-5: عدم وجود سجلات اختبارية SLS-3', () => {
  it('يجب ألا يحتوي القالب على SLS-3', () => {
    const found = foundationData.documentJournals.some(j => j.code === 'SLS-3');
    expect(found).toBe(false);
  });
});

// ─── FT-6: عدم تكرار (docType, code) ───────────────────────────────────────────
describe('FT-6: عدم تكرار (docType, code) داخل القالب', () => {
  it('يجب ألا يكون هناك سجلان بنفس (docType, code)', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const j of foundationData.documentJournals) {
      const key = `${j.docType}:${j.code}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });
});

// ─── FT-7: جميع الدفاتر لها foundationKey ──────────────────────────────────────
describe('FT-7: جميع دفاتر القالب لها foundationKey', () => {
  it('يجب أن يحتوي كل سجل على foundationKey غير فارغ', () => {
    const missing: string[] = [];
    for (const j of foundationData.documentJournals) {
      if (!j.foundationKey) {
        missing.push(`${j.docType}:${j.code}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// ─── FT-8: جميع الدفاتر لها recordPolicy ───────────────────────────────────────
describe('FT-8: جميع دفاتر القالب لها recordPolicy', () => {
  it('يجب أن يحتوي كل سجل على recordPolicy غير فارغ', () => {
    const missing: string[] = [];
    for (const j of foundationData.documentJournals) {
      if (!j.recordPolicy) {
        missing.push(`${j.docType}:${j.code}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// ─── FT-9: لا تُصدَّر IDs محلية للمستخدمين/المجموعات ─────────────────────────
describe('FT-9: علاقات المستخدمين والمجموعات لا تحمل raw IDs', () => {
  it('يجب أن تكون allowedUserId وallowedUserGroup مستقلة عن IDs المصدر', () => {
    const violations: string[] = [];
    for (const [tableName, records] of Object.entries(foundationData)) {
      if (!Array.isArray(records)) continue;
      for (const record of records as Array<Record<string, unknown>>) {
        const key = String(record.foundationKey ?? record.code ?? '');
        if (typeof record.allowedUserId === 'number') {
          violations.push(`${tableName}[${key}].allowedUserId=${record.allowedUserId}`);
        }
        if (
          typeof record.allowedUserGroup === 'string' &&
          /^\d+$/.test(record.allowedUserGroup.trim())
        ) {
          violations.push(`${tableName}[${key}].allowedUserGroup=${record.allowedUserGroup}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
