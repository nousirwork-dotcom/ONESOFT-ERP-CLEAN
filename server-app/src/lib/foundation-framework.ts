/**
 * Foundation Policy + Foundation Template Framework
 *
 * Defines shared types, helpers and key-generation utilities for the
 * "Record Policy + Foundation Template" system used across all core
 * master-data tables.
 *
 * Policy meanings:
 *   protected → no edit, no delete by any non-superadmin user
 *   editable  → edit allowed, delete blocked
 *   flexible  → edit + delete allowed (subject to business rules)
 */

export type RecordPolicy = 'protected' | 'editable' | 'flexible';

export const RECORD_POLICIES: RecordPolicy[] = ['protected', 'editable', 'flexible'];

export const POLICY_LABELS: Record<RecordPolicy, string> = {
  protected: 'محمي',
  editable:  'قابل للتعديل',
  flexible:  'مرن',
};

export const POLICY_DESCRIPTIONS: Record<RecordPolicy, string> = {
  protected: 'لا يمكن تعديل هذا السجل أو حذفه من قِبل المستخدمين',
  editable:  'يمكن تعديل هذا السجل لكن لا يمكن حذفه',
  flexible:  'يمكن تعديل هذا السجل وحذفه وفق القواعد المعتادة',
};

// ─── Enforcement helpers ───────────────────────────────────────────────────────

/**
 * Throws if the policy prevents update.
 * Superadmin always bypasses policy enforcement.
 */
export function assertCanUpdate(
  policy: string | null | undefined,
  recordName: string,
  isSuperadmin = false,
): void {
  if (isSuperadmin) return;
  if (policy === 'protected') {
    throw new Error(`السجل «${recordName}» محمي ولا يمكن تعديله`);
  }
}

/**
 * Throws if the policy prevents delete.
 * Superadmin always bypasses policy enforcement.
 */
export function assertCanDelete(
  policy: string | null | undefined,
  recordName: string,
  isSuperadmin = false,
): void {
  if (isSuperadmin) return;
  if (policy === 'protected') {
    throw new Error(`السجل «${recordName}» محمي ولا يمكن حذفه`);
  }
  if (policy === 'editable') {
    throw new Error(`السجل «${recordName}» مقيّد ولا يمكن حذفه`);
  }
}

// ─── Foundation key generation ────────────────────────────────────────────────

/** Table-name → short prefix for foundation keys */
export const FOUNDATION_KEY_PREFIXES: Record<string, string> = {
  document_journals:   'dj',
  document_types:      'dt',
  branches:            'br',
  warehouses:          'wh',
  units:               'unit',
  product_groups:      'pg',
  payment_methods:     'pm',
  cost_centers:        'cc',
  currencies:          'curr',
  document_templates:  'tmpl',
  posting_definitions: 'pd',
  chart_of_accounts:   'coa',
};

export const SUPPORTED_FOUNDATION_TABLES = Object.keys(FOUNDATION_KEY_PREFIXES) as Array<
  keyof typeof FOUNDATION_KEY_PREFIXES
>;

/**
 * Generate a stable foundation key from a prefix + one or more natural-key parts.
 * Only lowercase ASCII, digits, Arabic letters, underscores, hyphens, and dots are kept.
 *
 * Examples:
 *   generateFoundationKey('dj', 'sales_invoice', 'SLS-01') → 'dj.sales_invoice.sls-01'
 *   generateFoundationKey('br', 'الرئيسي')                 → 'br.الرئيسي'
 */
export function generateFoundationKey(prefix: string, ...parts: (string | number | null | undefined)[]): string {
  const slug = parts
    .map(p => String(p ?? '').trim())
    .filter(Boolean)
    .map(s => s.toLowerCase().replace(/\s+/g, '_'))
    .join('.');
  return `${prefix}.${slug}`;
}

/**
 * Auto-derive the foundation key for a given table + record fields.
 * Returns null if the natural key cannot be determined.
 */
export function deriveFoundationKey(
  tableName: string,
  record: Record<string, unknown>,
): string | null {
  const prefix = FOUNDATION_KEY_PREFIXES[tableName];
  if (!prefix) return null;

  switch (tableName) {
    case 'document_journals':
      return generateFoundationKey(prefix, record.docType as string, record.code as string);
    case 'document_types':
      return generateFoundationKey(prefix, record.typeId as string);
    case 'branches':
      return generateFoundationKey(prefix, record.name as string);
    case 'warehouses':
      return generateFoundationKey(prefix, (record.code as string) || (record.name as string));
    case 'units':
      return generateFoundationKey(prefix, (record.symbol as string) || (record.name as string));
    case 'product_groups':
      return generateFoundationKey(prefix, (record.groupCode as string) || (record.name as string));
    case 'payment_methods':
      return generateFoundationKey(prefix, record.code as string);
    case 'cost_centers':
      return generateFoundationKey(prefix, record.code as string);
    case 'currencies':
      return generateFoundationKey(prefix, record.code as string);
    case 'document_templates':
      return generateFoundationKey(prefix, record.code as string);
    case 'posting_definitions':
      return generateFoundationKey(
        prefix,
        record.docType as string,
        (record.variant as string) || 'default',
      );
    case 'chart_of_accounts':
      return generateFoundationKey(prefix, record.code as string);
    default:
      return null;
  }
}
