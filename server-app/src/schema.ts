import { pgTable, serial, varchar, text, integer, boolean, decimal, timestamp, pgEnum, uniqueIndex, jsonb, uuid, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer']);
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'trial', 'expired']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['sale', 'return', 'quote', 'order', 'credit_note', 'debit_note']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'confirmed', 'cancelled', 'paid']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'bank', 'credit', 'check', 'other']);
export const voucherTypeEnum = pgEnum('voucher_type', ['receipt', 'payment']);
export const journalStatusEnum = pgEnum('journal_status', ['draft', 'posted', 'cancelled']);
export const pendingMovementStatusEnum = pgEnum('pending_movement_status', ['unposted', 'linked', 'cancelled']);

// ─── Organizations ────────────────────────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  logo: text('logo'),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  taxNumber: varchar('tax_number', { length: 50 }),
  commercialReg: varchar('commercial_reg', { length: 50 }),
  currency: varchar('currency', { length: 10 }).notNull().default('SAR'),
  status: orgStatusEnum('status').notNull().default('trial'),
  subscriptionExpiry: timestamp('subscription_expiry'),
  maxUsers: integer('max_users').notNull().default(5),
  zatcaConfig: jsonb('zatca_config'),
  themeSettings: jsonb('theme_settings'),
  foundationSnapshotHash: varchar('foundation_snapshot_hash', { length: 64 }),
  foundationAppliedAt: timestamp('foundation_applied_at'),
  foundationStatus: varchar('foundation_status', { length: 30 }).notNull().default('pending'),
  foundationLastError: text('foundation_last_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Document Voucher Types (أنواع السندات المركزية) ──────────────────────────
// تعريف النوع مركزي على مستوى المؤسسة، بينما تبقى روابط الحسابات داخل دفتر
// المستند وتستخدم هذا المعرّف كمفتاح ثابت.
export const documentVoucherTypes = pgTable('document_voucher_types', {
  id:        serial('id').primaryKey(),
  orgId:     integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  nameAr:    varchar('name_ar', { length: 255 }).notNull().default(''),
  nameEn:    varchar('name_en', { length: 255 }).notNull().default(''),
  codeAr:    varchar('code_ar', { length: 100 }).notNull().default(''),
  codeEn:    varchar('code_en', { length: 100 }).notNull().default(''),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }),
  username: varchar('username', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  role: userRoleEnum('role').notNull().default('cashier'),
  extraPermissions: jsonb('extra_permissions').$type<Record<string, boolean>>(),
  categoryId: integer('category_id'),
  isActive: boolean('is_active').notNull().default(true),
  allowLogin: boolean('allow_login').notNull().default(true),
  passwordStatus: varchar('password_status', { length: 20 }).notNull().default('set'),
  lastLoginAt: timestamp('last_login_at'),
  phoneVerifiedAt: timestamp('phone_verified_at'),
  emailVerifiedAt: timestamp('email_verified_at'),
  passwordChangedAt: timestamp('password_changed_at'),
  forcePasswordChange: boolean('force_password_change').notNull().default(false),
  recoveryEnabledPhone: boolean('recovery_enabled_phone').notNull().default(false),
  recoveryEnabledEmail: boolean('recovery_enabled_email').notNull().default(false),
  userGroupId: integer('user_group_id'),
  defaultBranchId: integer('default_branch_id'),
  defaultWarehouseId: integer('default_warehouse_id'),
  defaultLanguage: varchar('default_language', { length: 10 }),
  sessionVersion: integer('session_version').notNull().default(1),
  canBeSalesperson: boolean('can_be_salesperson').notNull().default(false),
  allowEmailLogin: boolean('allow_email_login').notNull().default(false),
  loginMethod: varchar('login_method', { length: 30 }).notNull().default('username'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── User Warehouse Assignments (المخزن = الفرع في مسار المستندات) ──────────────
export const userWarehouseAssignments = pgTable('user_warehouse_assignments', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uwaOrgUserWarehouseUnique: uniqueIndex('uwa_org_user_warehouse_unique').on(t.orgId, t.userId, t.warehouseId),
}));

// ─── User Groups ──────────────────────────────────────────────────────────────
export const userGroups = pgTable('user_groups', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  orgCodeActiveUidx: uniqueIndex('ug_org_code_active_uidx').on(t.orgId, t.code).where(sql`${t.isActive} = true`),
}));

// ─── User Categories ──────────────────────────────────────────────────────────
export const userCategories = pgTable('user_categories', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull(),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  autoNumbering: boolean('auto_numbering').notNull().default(true),
  firstNumber: integer('first_number').notNull().default(1),
  lastNumber: integer('last_number').notNull().default(99999),
  increment: integer('increment').notNull().default(1),
  codeDigits: integer('code_digits').notNull().default(5),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── User Group Members ───────────────────────────────────────────────────────
export const userGroupMembers = pgTable('user_group_members', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').notNull().references(() => userGroups.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull(),
  memberType: varchar('member_type', { length: 10 }).notNull(),
  memberCode: varchar('member_code', { length: 50 }),
  memberName: varchar('member_name', { length: 255 }),
  memberUserId: integer('member_user_id').references(() => users.id, { onDelete: 'cascade' }),
  memberGroupId: integer('member_group_id').references(() => userGroups.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── User Group Migration Log ─────────────────────────────────────────────────
export const userGroupMigrationLog = pgTable('user_group_migration_log', {
  id: serial('id').primaryKey(),
  originalMemberId: integer('original_member_id'),
  groupId: integer('group_id'),
  memberType: varchar('member_type', { length: 10 }),
  memberCode: varchar('member_code', { length: 50 }),
  memberName: varchar('member_name', { length: 255 }),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Branches ─────────────────────────────────────────────────────────────────
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  isActive:             boolean('is_active').notNull().default(true),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
});

// ─── Warehouses ───────────────────────────────────────────────────────────────
export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  name2: varchar('name2', { length: 255 }),
  fullName1: varchar('full_name1', { length: 255 }),
  fullName2: varchar('full_name2', { length: 255 }),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  invAccountId: integer('inv_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  cogsAccount1Id: integer('cogs_account1_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  cogsAccount2Id: integer('cogs_account2_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  cashAccountId: integer('cash_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  bankAccountId: integer('bank_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  salesAccount1Id: integer('sales_account1_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  allowedUserId: integer('allowed_user_id').references(() => users.id, { onDelete: 'set null' }),
  allowedUserGroup: varchar('allowed_user_group', { length: 255 }),
  copyFromWarehouseId:  integer('copy_from_warehouse_id'),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
});

// ─── Warehouse Account Links ───────────────────────────────────────────────────
export const warehouseAccountLinks = pgTable('warehouse_account_links', {
  id: serial('id').primaryKey(),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  accountId: integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ─── Units ────────────────────────────────────────────────────────────────────
export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  symbol:               varchar('symbol', { length: 20 }),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
});

// ─── Product Groups ───────────────────────────────────────────────────────────
export const productGroups = pgTable('product_groups', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  groupCode: varchar('group_code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  name2: varchar('name2', { length: 255 }),
  description: text('description'),
  parentId: integer('parent_id'),
  groupType: varchar('group_type', { length: 20 }).default('root'),
  level: integer('level').default(1),
  autoNumbering: boolean('auto_numbering').default(true),
  firstNumber: integer('first_number').default(1),
  lastNumber: integer('last_number').default(99999),
  increment: integer('increment').default(1),
  codeDigits: integer('code_digits').default(5),
  color:                varchar('color', { length: 30 }),
  isActive:             boolean('is_active').default(true),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
});

// ─── Tax Definitions ──────────────────────────────────────────────────────────
// Tax definitions are reusable master data. Invoice items keep a taxId snapshot
// alongside taxPercent so changing a definition never rewrites old invoices.
export const taxDefinitions = pgTable('tax_definitions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  category: varchar('category', { length: 30 }).notNull().default('tax'),
  applicationScope: varchar('application_scope', { length: 40 }).notNull().default('products_sales'),
  valueType: varchar('value_type', { length: 20 }).notNull().default('percentage'),
  value: decimal('value', { precision: 18, scale: 4 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  notes: text('notes'),
  effectiveFrom: timestamp('effective_from'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  orgCodeUnique: uniqueIndex('tax_definitions_org_code_uidx').on(t.orgId, t.code),
}));

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 100 }),
  barcode: varchar('barcode', { length: 100 }),
  name: varchar('name', { length: 500 }).notNull(),
  nameEn: varchar('name_en', { length: 500 }),
  groupId: integer('group_id').references(() => productGroups.id, { onDelete: 'set null' }),
  unitId: integer('unit_id').references(() => units.id, { onDelete: 'set null' }),
  unit: varchar('unit', { length: 100 }),
  taxId: integer('tax_id').references(() => taxDefinitions.id, { onDelete: 'set null' }),
  salePrice: decimal('sale_price', { precision: 18, scale: 4 }).default('0'),
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 4 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  minStock: decimal('min_stock', { precision: 18, scale: 4 }).default('0'),
  itemType: varchar('item_type', { length: 20 }).notNull().default('stock'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  recordPolicy:              varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:             varchar('foundation_key', { length: 100 }),
  includeInFoundation:       boolean('include_in_foundation').notNull().default(false),
  recordOrigin:              varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion: varchar('foundation_template_version', { length: 20 }),
});

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 500 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  taxNumber: varchar('tax_number', { length: 50 }),
  customerType: varchar('customer_type', { length: 20 }).notNull().default('individual'),
  registrationNumber: varchar('registration_number', { length: 100 }),
  shortAddress: varchar('short_address', { length: 200 }),
  buildingNumber: varchar('building_number', { length: 20 }),
  additionalNumber: varchar('additional_number', { length: 20 }),
  postalCode: varchar('postal_code', { length: 20 }),
  city: varchar('city', { length: 100 }),
  creditLimit: decimal('credit_limit', { precision: 18, scale: 4 }).default('0'),
  balance: decimal('balance', { precision: 18, scale: 4 }).default('0'),
  // ─── التسعير والضوابط ─────────────────────────────────────────────────────
  priceLevel:       integer('price_level').notNull().default(1),
  maxDiscountPct:   decimal('max_discount_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  canSellOnCredit:  boolean('can_sell_on_credit').notNull().default(true),
  dealStartDate:    timestamp('deal_start_date'),
  dealEndDate:      timestamp('deal_end_date'),
  // ─── قنوات الإرسال الإلكتروني ──────────────────────────────────────────────
  whatsappPhone: varchar('whatsapp_phone', { length: 50 }),
  telegramId: varchar('telegram_id', { length: 100 }),
  defaultSendMethod: varchar('default_send_method', { length: 20 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  recordPolicy:              varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:             varchar('foundation_key', { length: 100 }),
  includeInFoundation:       boolean('include_in_foundation').notNull().default(false),
  recordOrigin:              varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion: varchar('foundation_template_version', { length: 20 }),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 500 }).notNull(),
  supplierType: varchar('supplier_type', { length: 20 }).notNull().default('individual'),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  taxNumber: varchar('tax_number', { length: 50 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  balance: decimal('balance', { precision: 18, scale: 4 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  recordPolicy:              varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:             varchar('foundation_key', { length: 100 }),
  includeInFoundation:       boolean('include_in_foundation').notNull().default(false),
  recordOrigin:              varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion: varchar('foundation_template_version', { length: 20 }),
});

// ─── Chart of Accounts ────────────────────────────────────────────────────────
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  nameEn: varchar('name_en', { length: 500 }),
  parentId: integer('parent_id'),
  level: integer('level').notNull().default(1),
  accountType: varchar('account_type', { length: 50 }).notNull(),
  nature: varchar('nature', { length: 10 }).default('debit'),
  isParent: boolean('is_parent').default(false),
  allowPosting: boolean('allow_posting').default(true),
  costCenterType: varchar('cost_center_type', { length: 20 }).default('not_allowed'),
  openingBalance: decimal('opening_balance', { precision: 18, scale: 4 }).default('0'),
  openingBalanceType: varchar('opening_balance_type', { length: 10 }).default('debit'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  balance: decimal('balance', { precision: 18, scale: 4 }).default('0'),
  recordType: varchar('record_type', { length: 30 }).notNull().default('user'),
  systemKey:           varchar('system_key', { length: 100 }),
  includeInFoundation: boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
});

// ─── Sales Invoices ───────────────────────────────────────────────────────────
export const salesInvoices = pgTable('sales_invoices', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceType: invoiceTypeEnum('invoice_type').notNull().default('sale'),
  invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
  dueDate: timestamp('due_date'),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  customerName: varchar('customer_name', { length: 500 }),
  customerType: varchar('customer_type', { length: 20 }).default('individual'),
  customerTaxNumber: varchar('customer_tax_number', { length: 100 }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  currency: varchar('currency', { length: 10 }).default('SAR'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1'),
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).default('0'),
  paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }).default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 18, scale: 4 }).default('0'),
  paymentBreakdown: jsonb('payment_breakdown'),
  paymentMethod: paymentMethodEnum('payment_method').default('cash'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  refInvoiceId: integer('ref_invoice_id'),
  journalId: integer('journal_id'),
  docTypeId: integer('doc_type_id'),
  isPosted: boolean('is_posted').notNull().default(false),
  postedAt: timestamp('posted_at'),
  postedJournalEntryId: integer('posted_journal_entry_id'),
  generatedStockVoucherId: integer('generated_stock_voucher_id'),
  generatedStockJournalEntryId: integer('generated_stock_journal_entry_id'),
  costPosted: boolean('cost_posted').notNull().default(false),
  costPostedJournalEntryId: integer('cost_posted_journal_entry_id'),
  zatcaUuid: varchar('zatca_uuid', { length: 100 }),
  zatcaHash: varchar('zatca_hash', { length: 256 }),
  zatcaQrCode: text('zatca_qr_code'),
  zatcaXml: text('zatca_xml'),
  zatcaStatus: varchar('zatca_status', { length: 30 }).default('not_submitted'),
  // لقطة ثابتة لتصنيف ZATCA (لا تُستنتج من شاشة الإرسال عند إنشاء الإشعار)
  zatcaInvoiceType: varchar('zatca_invoice_type', { length: 20 }).notNull().default('simplified'),
  zatcaClearedAt: timestamp('zatca_cleared_at'),
  zatcaResponse: jsonb('zatca_response'),
  zatcaInvoiceCounter: integer('zatca_invoice_counter'),
  zatcaPih: varchar('zatca_pih', { length: 256 }),
  // Immutable electronic issuance timestamp. The commercial invoiceDate stays
  // editable according to ERP rules; this value is assigned only by the
  // TrustedClock at the first ZATCA issuance.
  zatcaIssueTimestamp: timestamp('zatca_issue_timestamp'),
  zatcaSubmittedAt: timestamp('zatca_submitted_at'),
  zatcaAttemptCount: integer('zatca_attempt_count').notNull().default(0),
  zatcaRejectionReason: text('zatca_rejection_reason'),
  // لقطة هوية المنشأة وقت الإصدار؛ تمنع إعادة طباعة فاتورة قديمة ببيانات حالية.
  sellerLegalName: varchar('seller_legal_name', { length: 255 }),
  sellerTaxNumber: varchar('seller_tax_number', { length: 50 }),
  basedOnType: varchar('based_on_type', { length: 20 }),
  basedOnNumber: varchar('based_on_number', { length: 50 }),
  sourceDocumentId: integer('source_document_id'), // FK للفاتورة المصدر — يُتحقق منه لأمان الفرع
  sellerUserId: integer('seller_user_id').references(() => users.id, { onDelete: 'set null' }),
  // رقم المسودة الأصلي — يُحفظ عند تحويل المسودة إلى فاتورة نهائية للرجوع إليه
  draftNumber: varchar('draft_number', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Central document relations ──────────────────────────────────────────────
// Polymorphic links intentionally use document type + id: generated documents
// can live in different tables (sales invoices, journal entries, vouchers).
export const documentRelations = pgTable('document_relations', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sourceDocumentType: varchar('source_document_type', { length: 50 }).notNull(),
  sourceDocumentId: integer('source_document_id').notNull(),
  generatedDocumentType: varchar('generated_document_type', { length: 50 }).notNull(),
  generatedDocumentId: integer('generated_document_id').notNull(),
  relationType: varchar('relation_type', { length: 30 }).notNull(),
  postingBatchId: varchar('posting_batch_id', { length: 80 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('document_relations_unique_link_uidx').on(
    t.orgId,
    t.sourceDocumentType,
    t.sourceDocumentId,
    t.generatedDocumentType,
    t.generatedDocumentId,
    t.relationType,
  ),
  index('document_relations_source_idx').on(t.orgId, t.sourceDocumentType, t.sourceDocumentId),
  index('document_relations_generated_idx').on(t.orgId, t.generatedDocumentType, t.generatedDocumentId),
]);

export const unpostAudit = pgTable('unpost_audit', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  postingBatchId: varchar('posting_batch_id', { length: 80 }).notNull(),
  sourceDocumentType: varchar('source_document_type', { length: 50 }).notNull(),
  sourceDocumentId: integer('source_document_id').notNull(),
  sourceDocumentNumber: varchar('source_document_number', { length: 100 }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  unpostedAt: timestamp('unposted_at').notNull().defaultNow(),
  reason: text('reason'),
  deletedDocuments: jsonb('deleted_documents').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('unpost_audit_source_idx').on(t.orgId, t.sourceDocumentType, t.sourceDocumentId),
  index('unpost_audit_batch_idx').on(t.orgId, t.postingBatchId),
]);

// ─── Sales Invoice Items ──────────────────────────────────────────────────────
export const salesInvoiceItems = pgTable('sales_invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  taxId: integer('tax_id').references(() => taxDefinitions.id, { onDelete: 'set null' }),
  productCode: varchar('product_code', { length: 100 }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  unit: varchar('unit', { length: 100 }),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).notNull(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Purchase Invoices ────────────────────────────────────────────────────────
export const purchaseInvoices = pgTable('purchase_invoices', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceType: varchar('invoice_type', { length: 20 }).notNull().default('invoice'),
  supplierInvoiceNumber: varchar('supplier_invoice_number', { length: 100 }),
  invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
  dueDate: timestamp('due_date'),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  supplierName: varchar('supplier_name', { length: 500 }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  journalId: integer('journal_id'),
  currency: varchar('currency', { length: 10 }).default('SAR'),
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 6 }).default('1'),
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).default('0'),
  paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }).default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 18, scale: 4 }).default('0'),
  paymentMethod: varchar('payment_method', { length: 20 }).default('cash'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  basedOnType: varchar('based_on_type', { length: 20 }),
  basedOnNumber: varchar('based_on_number', { length: 50 }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  docTypeId: integer('doc_type_id'),
  isPosted: boolean('is_posted').notNull().default(false),
  postedAt: timestamp('posted_at'),
  postedJournalEntryId: integer('posted_journal_entry_id'),
  inventoryPosted: boolean('inventory_posted').notNull().default(false),
  costPostedJournalEntryId: integer('cost_posted_journal_entry_id'),
  generatedStockVoucherId: integer('generated_stock_voucher_id'),
  generatedStockJournalEntryId: integer('generated_stock_journal_entry_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Purchase Invoice Items ───────────────────────────────────────────────────
export const purchaseInvoiceItems = pgTable('purchase_invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => purchaseInvoices.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  taxId: integer('tax_id').references(() => taxDefinitions.id, { onDelete: 'set null' }),
  productCode: varchar('product_code', { length: 100 }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  unit: varchar('unit', { length: 100 }),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: varchar('expiry_date', { length: 20 }),
  sortOrder: integer('sort_order').default(0),
});

// ─── Unposted source-document movements ───────────────────────────────────────
// These are operational effects, not numbered journal entries or stock vouchers.
export const pendingAccountMovements = pgTable('pending_account_movements', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sourceDocType: varchar('source_doc_type', { length: 50 }).notNull(),
  sourceDocId: integer('source_doc_id').notNull(),
  sourceDocNumber: varchar('source_doc_number', { length: 100 }).notNull(),
  movementDate: timestamp('movement_date').notNull(),
  accountId: integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  debit: decimal('debit', { precision: 18, scale: 4 }).notNull().default('0'),
  credit: decimal('credit', { precision: 18, scale: 4 }).notNull().default('0'),
  description: text('description'),
  status: pendingMovementStatusEnum('status').notNull().default('unposted'),
  linkedJournalEntryId: integer('linked_journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  linkedStockVoucherId: integer('linked_stock_voucher_id').references(() => stockVouchers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pending_account_movements_source_account_uidx').on(t.orgId, t.sourceDocType, t.sourceDocId, t.accountId),
]);

export const pendingStockMovements = pgTable('pending_stock_movements', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sourceDocType: varchar('source_doc_type', { length: 50 }).notNull(),
  sourceDocId: integer('source_doc_id').notNull(),
  sourceDocNumber: varchar('source_doc_number', { length: 100 }).notNull(),
  movementDate: timestamp('movement_date').notNull(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 18, scale: 4 }).notNull().default('0'),
  status: pendingMovementStatusEnum('status').notNull().default('unposted'),
  linkedJournalEntryId: integer('linked_journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  linkedStockVoucherId: integer('linked_stock_voucher_id').references(() => stockVouchers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pending_stock_movements_source_product_uidx').on(t.orgId, t.sourceDocType, t.sourceDocId, t.productId, t.warehouseId),
]);

// ─── Journal Entries ──────────────────────────────────────────────────────────
export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entryNumber: varchar('entry_number', { length: 50 }).notNull(),
  entryDate: timestamp('entry_date').notNull().defaultNow(),
  description: text('description'),
  reference: varchar('reference', { length: 100 }),
  totalDebit: decimal('total_debit', { precision: 18, scale: 4 }).default('0'),
  totalCredit: decimal('total_credit', { precision: 18, scale: 4 }).default('0'),
  status: journalStatusEnum('status').notNull().default('draft'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  sourceDocType:   varchar('source_doc_type',   { length: 50 }),
  sourceDocId:     integer('source_doc_id'),
  sourceDocNumber: varchar('source_doc_number', { length: 100 }),
  entryType:       varchar('entry_type',         { length: 20 }).notNull().default('manual'),
  journalId:       integer('journal_id').references(() => documentJournals.id, { onDelete: 'set null' }),
  generatedDocType: varchar('generated_doc_type', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('journal_entries_org_entry_number_uidx').on(t.orgId, t.entryNumber),
]);

// ─── Journal Entry Lines ──────────────────────────────────────────────────────
export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  accountCode: varchar('account_code', { length: 50 }),
  accountName: varchar('account_name', { length: 500 }),
  description: text('description'),
  debit: decimal('debit', { precision: 18, scale: 4 }).default('0'),
  credit: decimal('credit', { precision: 18, scale: 4 }).default('0'),
  costCenter: varchar('cost_center', { length: 100 }),
  sortOrder: integer('sort_order').default(0),
});

// ─── Vouchers ─────────────────────────────────────────────────────────────────
export const vouchers = pgTable('vouchers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherNumber: varchar('voucher_number', { length: 50 }).notNull(),
  voucherType: voucherTypeEnum('voucher_type').notNull(),
  voucherDate: timestamp('voucher_date').notNull().defaultNow(),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').default('cash'),
  accountId: integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  accountCode: varchar('account_code', { length: 50 }),
  accountName: varchar('account_name', { length: 500 }),
  partyType: varchar('party_type', { length: 20 }),
  partyId: integer('party_id'),
  partyName: varchar('party_name', { length: 500 }),
  description: text('description'),
  reference: varchar('reference', { length: 100 }),
  status: journalStatusEnum('status').notNull().default('draft'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Receipt Vouchers (سندات القبض) ──────────────────────────────────────────
export const receiptVouchers = pgTable('receipt_vouchers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherNumber: varchar('voucher_number', { length: 50 }).notNull(),
  voucherDate: timestamp('voucher_date').notNull().defaultNow(),
  receivedFrom: varchar('received_from', { length: 500 }),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').default('cash'),
  bankAccount: varchar('bank_account', { length: 100 }),
  checkNumber: varchar('check_number', { length: 100 }),
  description: text('description'),
  accountId: integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  contraAccountId: integer('contra_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  costCenterId: integer('cost_center_id'),
  notes: text('notes'),
  journalEntryId: integer('journal_entry_id'),
  status: varchar('status', { length: 20 }).notNull().default('posted'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Payment Vouchers (سندات الصرف) ──────────────────────────────────────────
export const paymentVouchers = pgTable('payment_vouchers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherNumber: varchar('voucher_number', { length: 50 }).notNull(),
  voucherDate: timestamp('voucher_date').notNull().defaultNow(),
  paidTo: varchar('paid_to', { length: 500 }),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').default('cash'),
  bankAccount: varchar('bank_account', { length: 100 }),
  checkNumber: varchar('check_number', { length: 100 }),
  description: text('description'),
  accountId: integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  contraAccountId: integer('contra_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  notes: text('notes'),
  journalEntryId: integer('journal_entry_id'),
  status: varchar('status', { length: 20 }).notNull().default('posted'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  avgCost: decimal('avg_cost', { precision: 18, scale: 4 }).default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Stock Vouchers ───────────────────────────────────────────────────────────
export const stockVoucherTypeEnum = pgEnum('stock_voucher_type', ['receipt', 'issue', 'transfer']);

export const stockVouchers = pgTable('stock_vouchers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherNumber: varchar('voucher_number', { length: 50 }).notNull(),
  type: stockVoucherTypeEnum('type').notNull(),
  voucherDate: timestamp('voucher_date').notNull().defaultNow(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  reason: varchar('reason', { length: 500 }),
  notes: text('notes'),
  totalCost: decimal('total_cost', { precision: 18, scale: 4 }).default('0'),
  status: varchar('status', { length: 20 }).notNull().default('confirmed'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  receiverUserId: integer('receiver_user_id').references(() => users.id, { onDelete: 'set null' }),
  sourceDocType: varchar('source_doc_type', { length: 50 }),
  sourceDocId: integer('source_doc_id'),
  sourceDocNumber: varchar('source_doc_number', { length: 100 }),
  sourceJournalId: integer('source_journal_id').references(() => documentJournals.id, { onDelete: 'set null' }),
  generatedJournalEntryId: integer('generated_journal_entry_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stockVoucherItems = pgTable('stock_voucher_items', {
  id: serial('id').primaryKey(),
  voucherId: integer('voucher_id').notNull().references(() => stockVouchers.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 18, scale: 4 }).default('0'),
  totalCost: decimal('total_cost', { precision: 18, scale: 4 }).default('0'),
  productCode: varchar('product_code', { length: 100 }),
  unit: varchar('unit', { length: 100 }),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: varchar('expiry_date', { length: 10 }),
  sortOrder: integer('sort_order').default(0),
});

// ─── Inventory Counts (جرد) ───────────────────────────────────────────────────
export const inventoryCountStatusEnum = pgEnum('inventory_count_status', ['draft', 'confirmed', 'cancelled']);

export const inventoryCounts = pgTable('inventory_counts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  countNumber: varchar('count_number', { length: 50 }).notNull(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  status: inventoryCountStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
});

export const inventoryCountItems = pgTable('inventory_count_items', {
  id: serial('id').primaryKey(),
  countId: integer('count_id').notNull().references(() => inventoryCounts.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  systemQuantity: decimal('system_quantity', { precision: 18, scale: 4 }).default('0'),
  actualQuantity: decimal('actual_quantity', { precision: 18, scale: 4 }).default('0'),
  difference: decimal('difference', { precision: 18, scale: 4 }).default('0'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Free Products (الأصناف المجانية) ─────────────────────────────────────────
export const freeProducts = pgTable('free_products', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productCode: varchar('product_code', { length: 100 }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  unit: varchar('unit', { length: 100 }),
  baseQty: decimal('base_qty', { precision: 18, scale: 4 }).notNull().default('1'),
  freeQty: decimal('free_qty', { precision: 18, scale: 4 }).notNull().default('1'),
  offerStart: timestamp('offer_start'),
  offerEnd: timestamp('offer_end'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Messages (Internal Chat) ─────────────────────────────────────────────────
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  senderId: integer('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: integer('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── ZATCA POS Linking Units (وحدات ربط نقاط البيع الإلكترونية) ───────────────
// هذا كيان ربط إلكتروني فقط؛ لا يمثل شاشة نقطة بيع تشغيلية جديدة.
// المخزن هو مصدر الفرع الوحيد، والدفاتر الحالية هي مصدر صلاحيات الاستخدام.
export const zatcaPosUnits = pgTable('zatca_pos_units', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'restrict' }),
  unitCode:    varchar('unit_code', { length: 50 }).notNull(),
  unitName:    varchar('unit_name', { length: 255 }).notNull(),
  // Immutable technical identity for units created under the POS identity policy.
  // Nullable intentionally: existing units keep their historical identity.
  commonName:       varchar('common_name', { length: 255 }),
  egsSerialNumber:  varchar('egs_serial_number', { length: 255 }),
  // Legacy compatibility projection only. The source of truth for whether a
  // unit is linked is document_journals.zatca_pos_unit_id; lifecycle guards
  // use the journal relationship plus oneSoftStatus/device lifecycle.
  status:      varchar('status', { length: 30 }).notNull().default('unlinked'),
  oneSoftStatus: varchar('onesoft_status', { length: 30 }).notNull().default('active'),
  lifecycleUpdatedAt: timestamp('lifecycle_updated_at'),
  lifecycleUpdatedBy: integer('lifecycle_updated_by').references(() => users.id, { onDelete: 'set null' }),
  lifecycleReason: text('lifecycle_reason'),
  isActive:    boolean('is_active').notNull().default(true),
  isDeleted:   boolean('is_deleted').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  createdBy:   integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  orgCodeActiveUidx: uniqueIndex('zatca_pos_units_org_code_active_uidx')
    .on(t.orgId, t.unitCode)
    .where(sql`${t.isActive} = true AND ${t.isDeleted} = false`),
}));

// ─── Document Journals (دفاتر المستندات) ─────────────────────────────────────
// كل دفتر هو وحدة تشغيلية مستقلة: ترقيم + مخزن + فرع + حسابات + صلاحيات
export const documentJournals = pgTable('document_journals', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  // نوع المستند المرتبط
  docType:       varchar('doc_type', { length: 30 }).notNull(),
  // مثال: 'sales_invoice' | 'purchase_invoice' | 'receipt_voucher' | 'payment_voucher'
  //        | 'stock_transfer' | 'stock_receipt' | 'stock_issue' | 'inventory_count'
  code:          varchar('code', { length: 30 }).notNull(),   // مثال: SLS-BR1
  name:          varchar('name', { length: 255 }).notNull(),  // مبيعات فرع 1
  name2:         varchar('name2', { length: 255 }),           // اسم إنجليزي
  description:   text('description'),
  // ── الترقيم التسلسلي ──────────────────────────────────────────────────────
  numberPrefix:  varchar('number_prefix', { length: 20 }).notNull().default('INV'),
  firstNumber:   integer('first_number').notNull().default(1),
  lastNumber:    integer('last_number').notNull().default(999999),
  increment:     integer('increment').notNull().default(1),
  numDigits:     integer('num_digits').notNull().default(6),
  includeYear:   boolean('include_year').notNull().default(true),
  currentSeq:    integer('current_seq').notNull().default(0), // آخر رقم مستخدم
  // ── ترقيم المسودات ─────────────────────────────────────────────────────────
  draftAutoSerial:   boolean('draft_auto_serial').notNull().default(false),
  draftNumberPrefix: varchar('draft_number_prefix', { length: 20 }).notNull().default('DRAFT'),
  draftFirstNumber:  integer('draft_first_number').notNull().default(1),
  draftLastNumber:   integer('draft_last_number').notNull().default(999999),
  draftNumDigits:    integer('draft_num_digits').notNull().default(6),
  draftCurrentSeq:   integer('draft_current_seq').notNull().default(0),
  // ── الربط بالكيان (المخزن = الفرع في مسار المستندات) ─────────────────────────
  warehouseId:   integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  // ── الربط الإلكتروني فقط — لا ينشئ نقطة بيع تشغيلية موازية ────────────────
  zatcaPosUnitId: integer('zatca_pos_unit_id').references(() => zatcaPosUnits.id, { onDelete: 'set null' }),
  // ── الحسابات الافتراضية ───────────────────────────────────────────────────
  salesAccountId:   integer('sales_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  cashAccountId:    integer('cash_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  creditAccountId:  integer('credit_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  taxAccountId:     integer('tax_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  discountAccountId:integer('discount_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  // حسابات المشتريات
  purchaseAccountId:integer('purchase_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  supplierAccountId:integer('supplier_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  // حسابات المخزون والتكلفة (المرحلة الثانية)
  inventoryAccountId:integer('inventory_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  cogsAccountId:    integer('cogs_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  // ── الإعدادات ─────────────────────────────────────────────────────────────
  defaultCurrency:  varchar('default_currency', { length: 10 }).default('SAR'),
  defaultPayMethod: varchar('default_pay_method', { length: 20 }).default('cash'),
  allowedUserGroup: varchar('allowed_user_group', { length: 255 }),
  allowedUserId:    integer('allowed_user_id').references(() => users.id, { onDelete: 'set null' }),
  printTemplate:    varchar('print_template', { length: 100 }),
  printTemplate2:   varchar('print_template_2', { length: 100 }),
  resetFrequency:   varchar('reset_frequency', { length: 20 }).default('none'),
  autoSerial:       boolean('auto_serial').notNull().default(false),
  printOnSave:      boolean('print_on_save').notNull().default(false),
  customersJournal: varchar('customers_journal', { length: 50 }),
  suppliersJournal: varchar('suppliers_journal', { length: 50 }),
  postingMode:      varchar('posting_mode', { length: 20 }).default('manual'),
  allowUnpost:      boolean('allow_unpost').notNull().default(true),
  allowEditAfterPost: boolean('allow_edit_after_post').notNull().default(false),
  paymentTypesConfig: jsonb('payment_types_config'),
  issuanceConfig:   jsonb('issuance_config'),
  optionsConfig:    jsonb('options_config'),
  notes:                text('notes'),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  isActive:             boolean('is_active').notNull().default(true),
  sortOrder:            integer('sort_order').notNull().default(0),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  zatcaDocTypeActiveUidx: uniqueIndex('document_journals_zatca_unit_doc_type_uidx')
    .on(t.orgId, t.zatcaPosUnitId, t.docType)
    .where(sql`${t.zatcaPosUnitId} IS NOT NULL AND ${t.isActive} = true`),
}));

export type DocumentJournal = typeof documentJournals.$inferSelect;

// ─── Document Types (أنواع المستندات) ────────────────────────────────────────
export const documentTypes = pgTable('document_types', {
  id:                   serial('id').primaryKey(),
  orgId:                integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  typeId:               varchar('type_id', { length: 30 }).notNull(),
  nameAr:               varchar('name_ar', { length: 255 }).notNull(),
  nameEn:               varchar('name_en', { length: 255 }),
  codeEn:               varchar('code_en', { length: 30 }),
  codeAr:               varchar('code_ar', { length: 30 }),
  docType:              varchar('doc_type', { length: 30 }),
  userGroup:            varchar('user_group', { length: 50 }),
  user_:               varchar('user_', { length: 50 }),
  warehouse:            varchar('warehouse', { length: 50 }),
  journal:              varchar('journal', { length: 50 }),
  customersJournal:     varchar('customers_journal', { length: 50 }),
  suppliersJournal:     varchar('suppliers_journal', { length: 50 }),
  systemOnly:           boolean('system_only').notNull().default(false),
  entryType:            varchar('entry_type', { length: 30 }),
  entryJournal:         varchar('entry_journal', { length: 50 }),
  stockDocType:         varchar('stock_doc_type', { length: 30 }),
  stockJournal:         varchar('stock_journal', { length: 50 }),
  printTemplate:        varchar('print_template', { length: 100 }),
  printTemplate2:       varchar('print_template_2', { length: 100 }),
  trackQty:             boolean('track_qty').notNull().default(false),
  noTax:                boolean('no_tax').notNull().default(false),
  sellerStats:          boolean('seller_stats').notNull().default(false),
  itemStats:            boolean('item_stats').notNull().default(false),
  customerStats:        boolean('customer_stats').notNull().default(false),
  noStockDispatch:      boolean('no_stock_dispatch').notNull().default(false),
  requireNote:          boolean('require_note').notNull().default(false),
  preventEditIfLinked:  boolean('prevent_edit_if_linked').notNull().default(false),
  requireCustomerCode:  boolean('require_customer_code').notNull().default(false),
  requireEmployeeCode:  boolean('require_employee_code').notNull().default(false),
  acctDebit:            varchar('acct_debit', { length: 50 }),
  acctCredit:           varchar('acct_credit', { length: 50 }),
  acctDiscount:         varchar('acct_discount', { length: 50 }),
  acctCash:             varchar('acct_cash', { length: 50 }),
  acctTax:              varchar('acct_tax', { length: 50 }),
  acctInventory:        varchar('acct_inventory', { length: 50 }),
  acctCogs:             varchar('acct_cogs', { length: 50 }),
  salesAccountId:       integer('sales_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  cashAccountId:        integer('cash_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  creditAccountId:      integer('credit_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  taxAccountId:         integer('tax_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  discountAccountId:    integer('discount_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  purchaseAccountId:    integer('purchase_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  supplierAccountId:    integer('supplier_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  sortOrder:            integer('sort_order').notNull().default(0),
  isActive:             boolean('is_active').notNull().default(true),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

// ─── ZATCA readiness draft (persistent organization-scoped setup) ────────────
// This is configuration metadata only. It never stores OTPs, CSIDs, secrets,
// certificates, or private keys.
export const zatcaReadinessSettings = pgTable('zatca_readiness_settings', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().unique().references(() => organizations.id, { onDelete: 'cascade' }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  invoiceType: varchar('invoice_type', { length: 20 }).notNull().default('both'),
  zatcaPosUnitId: integer('zatca_pos_unit_id').references(() => zatcaPosUnits.id, { onDelete: 'set null' }),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type DocumentType = typeof documentTypes.$inferSelect;

// ─── Document Templates (نماذج المستندات) ────────────────────────────────────
// كل نموذج يحدد شكل الطباعة لنوع مستند معين
export const documentTemplates = pgTable('document_templates', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code:        varchar('code', { length: 30 }).notNull(),       // رقم النموذج مثال: T001
  nameAr:      varchar('name_ar', { length: 255 }).notNull(),   // اسم النموذج بالعربي
  nameEn:      varchar('name_en', { length: 255 }),             // اسم النموذج بالإنجليزي
  docType:     varchar('doc_type', { length: 30 }).notNull(),   // نوع المستند المرتبط
  paperSize:   varchar('paper_size', { length: 20 }).default('A4'),
  orientation: varchar('orientation', { length: 20 }).default('portrait'),
  isDefault:   boolean('is_default').notNull().default(false),
  layoutJson:  text('layout_json'),
  notes:       text('notes'),
  isActive:             boolean('is_active').notNull().default(true),
  sortOrder:            integer('sort_order').notNull().default(0),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// ─── Cost Centers (مراكز التكلفة) ─────────────────────────────────────────────
export const costCenters = pgTable('cost_centers', {
  id:         serial('id').primaryKey(),
  orgId:      integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code:       varchar('code', { length: 30 }).notNull(),
  name:       varchar('name', { length: 255 }).notNull(),
  name2:      varchar('name2', { length: 255 }),
  centerType: varchar('center_type', { length: 20 }).notNull().default('branch'), // root | general | branch
  parentId:   integer('parent_id'),
  level:      integer('level').notNull().default(1),
  notes:      text('notes'),
  isActive:             boolean('is_active').notNull().default(true),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
});

// ─── QR Settings ──────────────────────────────────────────────────────────────
export const qrSettings = pgTable('qr_settings', {
  id:                    serial('id').primaryKey(),
  orgId:                 integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  isEnabled:             boolean('is_enabled').notNull().default(true),
  countrySystem:         varchar('country_system', { length: 20 }).notNull().default('zatca'),
  customFormat:          text('custom_format'),
  sellerName:            varchar('seller_name', { length: 255 }),
  taxNumber:             varchar('tax_number', { length: 50 }),
  showOnSalesInvoice:    boolean('show_on_sales_invoice').notNull().default(true),
  showOnPurchaseInvoice: boolean('show_on_purchase_invoice').notNull().default(false),
  showOnReceiptVoucher:  boolean('show_on_receipt_voucher').notNull().default(false),
  qrSize:                integer('qr_size').notNull().default(100),
  qrPosition:            varchar('qr_position', { length: 30 }).notNull().default('top-right'),
  notes:                 text('notes'),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
  updatedAt:             timestamp('updated_at').notNull().defaultNow(),
});

// ─── Document Send Logs ───────────────────────────────────────────────────────
export const documentSendLogs = pgTable('document_send_logs', {
  id:               serial('id').primaryKey(),
  orgId:            integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  docType:          varchar('doc_type', { length: 50 }).notNull(),
  docId:            integer('doc_id'),
  docNumber:        varchar('doc_number', { length: 100 }),
  method:           varchar('method', { length: 20 }).notNull(),
  status:           varchar('status', { length: 20 }).notNull().default('pending'),
  recipientName:    varchar('recipient_name', { length: 255 }),
  recipientContact: varchar('recipient_contact', { length: 500 }),
  messageSent:      text('message_sent'),
  errorMessage:     text('error_message'),
  metaMessageId:    varchar('meta_message_id', { length: 100 }),
  sentByUserId:     integer('sent_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  sentAt:           timestamp('sent_at').notNull().defaultNow(),
});

// ─── WABA Message Templates ───────────────────────────────────────────────────
export const wabaMessageTemplates = pgTable('waba_message_templates', {
  id:        serial('id').primaryKey(),
  orgId:     integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key:       varchar('key', { length: 100 }).notNull(),
  label:     varchar('label', { length: 255 }).notNull(),
  docType:   varchar('doc_type', { length: 50 }),
  channel:   varchar('channel', { length: 20 }).notNull().default('whatsapp'),
  content:   text('content').notNull(),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Send Settings ────────────────────────────────────────────────────────────
export const sendSettings = pgTable('send_settings', {
  id:                      serial('id').primaryKey(),
  orgId:                   integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  whatsappEnabled:         boolean('whatsapp_enabled').notNull().default(true),
  telegramEnabled:         boolean('telegram_enabled').notNull().default(false),
  emailEnabled:            boolean('email_enabled').notNull().default(false),
  telegramBotToken:        text('telegram_bot_token'),
  emailProvider:           varchar('email_provider', { length: 20 }).default('resend'),
  emailApiKey:             text('email_api_key'),
  emailFromName:           varchar('email_from_name', { length: 255 }),
  emailFromEmail:          varchar('email_from_email', { length: 255 }),
  whatsappMessageTemplate: text('whatsapp_message_template'),
  telegramMessageTemplate: text('telegram_message_template'),
  emailSubjectTemplate:    varchar('email_subject_template', { length: 500 }),
  emailBodyTemplate:       text('email_body_template'),
  // WhatsApp Business API (WABA)
  wabaEnabled:             boolean('waba_enabled').notNull().default(false),
  wabaApiUrl:              text('waba_api_url'),
  wabaAccessToken:         text('waba_access_token'),
  wabaPhoneNumberId:       varchar('waba_phone_number_id', { length: 100 }),
  wabaSenderName:          varchar('waba_sender_name', { length: 255 }),
  wabaBusinessAccountId:   varchar('waba_business_account_id', { length: 100 }),
  wabaVerifyToken:         varchar('waba_verify_token', { length: 255 }),
  wabaWebhookUrl:          varchar('waba_webhook_url', { length: 500 }),
  createdAt:               timestamp('created_at').notNull().defaultNow(),
  updatedAt:               timestamp('updated_at').notNull().defaultNow(),
});

// ─── App Settings (key-value JSON store) ─────────────────────────────────────
export const appSettings = pgTable('app_settings', {
  id:        serial('id').primaryKey(),
  orgId:     integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key:       varchar('key', { length: 100 }).notNull(),
  value:     text('value'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('app_settings_org_key_uidx').on(t.orgId, t.key),
]);

// ─── Currencies ───────────────────────────────────────────────────────────────
export const currencies = pgTable('currencies', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code:           varchar('code', { length: 10 }).notNull(),
  nameAr:         varchar('name_ar', { length: 100 }).notNull(),
  nameEn:         varchar('name_en', { length: 100 }).notNull(),
  symbol:         varchar('symbol', { length: 10 }).notNull(),
  symbolIntl:     varchar('symbol_intl', { length: 10 }),
  exchangeRate:   decimal('exchange_rate', { precision: 18, scale: 6 }).notNull().default('1'),
  decimalPlaces:  integer('decimal_places').notNull().default(2),
  isBase:         boolean('is_base').notNull().default(false),
  mainUnitAr:     varchar('main_unit_ar', { length: 50 }),
  subUnitAr:      varchar('sub_unit_ar', { length: 50 }),
  mainUnitEn:     varchar('main_unit_en', { length: 50 }),
  subUnitEn:      varchar('sub_unit_en', { length: 50 }),
  isActive:             boolean('is_active').notNull().default(true),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

// ─── Posting Definitions ─────────────────────────────────────────────────────
export const postingDefinitions = pgTable('posting_definitions', {
  id:        serial('id').primaryKey(),
  orgId:     integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  docType:   varchar('doc_type', { length: 30 }).notNull(),
  variant:   varchar('variant', { length: 20 }).notNull().default(''),
  name:      varchar('name', { length: 200 }).notNull(),
  isActive:             boolean('is_active').notNull().default(true),
  sortOrder:            integer('sort_order').notNull().default(0),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

export const postingDefinitionLines = pgTable('posting_definition_lines', {
  id:           serial('id').primaryKey(),
  orgId:        integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  definitionId: integer('definition_id').notNull().references(() => postingDefinitions.id, { onDelete: 'cascade' }),
  description:  varchar('description', { length: 200 }),
  accountId:    integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  direction:    varchar('direction', { length: 10 }).notNull().default('debit'),
  amountSource: varchar('amount_source', { length: 50 }).notNull().default('total'),
  sortOrder:    integer('sort_order').notNull().default(0),
});

// ─── Field Dictionary ────────────────────────────────────────────────────────
export const fieldDictionary = pgTable('field_dictionary', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code:        varchar('code', { length: 50 }).notNull(),
  nameAr:      varchar('name_ar', { length: 150 }).notNull(),
  nameEn:      varchar('name_en', { length: 150 }).notNull(),
  fieldType:   varchar('field_type', { length: 50 }).notNull().default('Text'),
  category:    varchar('category', { length: 80 }).notNull().default('Custom Fields'),
  description: text('description'),
  isSystem:    boolean('is_system').notNull().default(false),
  isActive:    boolean('is_active').notNull().default(true),
  sortOrder:   integer('sort_order').notNull().default(0),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
});

// ─── Payment Methods ──────────────────────────────────────────────────────────
export const paymentMethods = pgTable('payment_methods', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code:        varchar('code', { length: 50 }).notNull(),
  nameAr:      varchar('name_ar', { length: 150 }).notNull(),
  nameEn:      varchar('name_en', { length: 150 }),
  icon:        varchar('icon', { length: 50 }),
  color:       varchar('color', { length: 20 }).default('#406B93'),
  bgColor:     varchar('bg_color', { length: 20 }).default('#EFF6FF'),
  accountId:   integer('account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  isActive:    boolean('is_active').notNull().default(true),
  isVisible:   boolean('is_visible').notNull().default(true),
  isBuiltIn:   boolean('is_built_in').notNull().default(false),
  sortOrder:            integer('sort_order').notNull().default(0),
  recordPolicy:         varchar('record_policy', { length: 20 }).notNull().default('flexible'),
  foundationKey:        varchar('foundation_key', { length: 100 }),
  includeInFoundation:  boolean('include_in_foundation').notNull().default(false),
  recordOrigin:                varchar('record_origin', { length: 20 }).notNull().default('user'),
  foundationTemplateVersion:   varchar('foundation_template_version', { length: 20 }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

// ─── Sales Invoice Payments (حركات السداد المستقلة) ──────────────────────────
export const salesInvoicePayments = pgTable('sales_invoice_payments', {
  id:                  serial('id').primaryKey(),
  orgId:               integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId:           integer('invoice_id').notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  paymentMethodCode:   varchar('payment_method_code', { length: 50 }).notNull(),
  paymentMethodName:   varchar('payment_method_name', { length: 150 }),
  amount:              decimal('amount', { precision: 18, scale: 4 }).notNull().default('0'),
  referenceNo:         varchar('reference_no', { length: 100 }),
  notes:               text('notes'),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
});

// ─── ZATCA Logs ───────────────────────────────────────────────────────────────
export const zatcaLogs = pgTable('zatca_logs', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId:       integer('invoice_id').references(() => salesInvoices.id, { onDelete: 'set null' }),
  invoiceNumber:   varchar('invoice_number', { length: 100 }),
  eventType:       varchar('event_type', { length: 50 }).notNull(),
  status:          varchar('status', { length: 30 }).notNull(),
  environment:     varchar('environment', { length: 20 }).default('sandbox'),
  requestBody:     text('request_body'),
  responseBody:    text('response_body'),
  errorMessage:    text('error_message'),
  userId:          integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName:        varchar('user_name', { length: 200 }),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
});

// ─── ZATCA Trusted Clock state ───────────────────────────────────────────────
// One independent clock/chain state per POS/EGS unit. Existing invoices are
// intentionally not backfilled into this table.
export const zatcaClockStates = pgTable('zatca_clock_states', {
  id:                    serial('id').primaryKey(),
  orgId:                 integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  posUnitId:             integer('pos_unit_id').notNull().references(() => zatcaPosUnits.id, { onDelete: 'cascade' }),
  lastTrustedTime:       timestamp('last_trusted_time'),
  lastTrustedTimeSource: varchar('last_trusted_time_source', { length: 30 }),
  lastTrustedTimeCheckedAt: timestamp('last_trusted_time_checked_at'),
  clockStatus:           varchar('clock_status', { length: 20 }).notNull().default('stale'),
  lastObservedWallTime:  timestamp('last_observed_wall_time'),
  lastIssuedAt:          timestamp('last_issued_at'),
  lastIssueDate:         varchar('last_issue_date', { length: 10 }),
  lastIssueTime:         varchar('last_issue_time', { length: 8 }),
  lastInvoiceCounter:    integer('last_invoice_counter'),
  lastInvoiceHash:       varchar('last_invoice_hash', { length: 256 }),
  lastInvoiceUuid:       varchar('last_invoice_uuid', { length: 100 }),
  lastPih:               varchar('last_pih', { length: 256 }),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
  updatedAt:             timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  orgPosUnitUnique: uniqueIndex('zatca_clock_states_org_pos_unit_uidx').on(t.orgId, t.posUnitId),
}));

export const zatcaClockEvents = pgTable('zatca_clock_events', {
  id:                    serial('id').primaryKey(),
  orgId:                 integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  posUnitId:             integer('pos_unit_id').notNull().references(() => zatcaPosUnits.id, { onDelete: 'cascade' }),
  invoiceId:             integer('invoice_id').references(() => salesInvoices.id, { onDelete: 'set null' }),
  userId:                integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType:             varchar('event_type', { length: 40 }).notNull(),
  clockStatus:           varchar('clock_status', { length: 20 }).notNull(),
  detectedSystemTime:    timestamp('detected_system_time'),
  trustedTime:           timestamp('trusted_time'),
  lastIssuedAt:          timestamp('last_issued_at'),
  reason:                text('reason'),
  metadata:              jsonb('metadata'),
  detectedAt:            timestamp('detected_at').notNull().defaultNow(),
});

export const zatcaClockPolicy = pgTable('zatca_clock_policy', {
  id:          integer('id').primaryKey().default(1),
  activatedAt: timestamp('activated_at').notNull().defaultNow(),
});

// ══════════════════════════════════════════════════════════════════════════════
// ZATCA Database Architecture (0012) — 14 جدولاً
// ══════════════════════════════════════════════════════════════════════════════

// ─── 1. ZATCA Environments ────────────────────────────────────────────────────
export const zatcaEnvironments = pgTable('zatca_environments', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name:           varchar('name', { length: 50 }).notNull(),
  baseApiUrl:     text('base_api_url').notNull(),
  complianceUrl:  text('compliance_url'),
  reportingUrl:   text('reporting_url'),
  clearanceUrl:   text('clearance_url'),
  oauthUrl:       text('oauth_url'),
  portalUrl:      text('portal_url'),
  isDefault:      boolean('is_default').notNull().default(false),
  isActive:       boolean('is_active').notNull().default(true),
  isDeleted:      boolean('is_deleted').notNull().default(false),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
  createdBy:      integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:      integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 2. ZATCA Devices ─────────────────────────────────────────────────────────
export const zatcaDevices = pgTable('zatca_devices', {
  id:                   serial('id').primaryKey(),
  orgId:                integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  posUnitId:            integer('pos_unit_id').references(() => zatcaPosUnits.id, { onDelete: 'set null' }),
  deviceName:           varchar('device_name', { length: 255 }).notNull(),
  deviceUuid:           uuid('device_uuid').notNull().defaultRandom(),
  serialNumber:         varchar('serial_number', { length: 100 }),
  branchId:             integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  environmentId:        integer('environment_id').references(() => zatcaEnvironments.id, { onDelete: 'set null' }),
  userId:               integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  registrationStatus:   varchar('registration_status', { length: 30 }).notNull().default('pending'),
  lifecycleStatus:      varchar('lifecycle_status', { length: 40 }).notNull().default('active'),
  lifecycleUpdatedAt:   timestamp('lifecycle_updated_at'),
  lifecycleUpdatedBy:   integer('lifecycle_updated_by').references(() => users.id, { onDelete: 'set null' }),
  cancellationConfirmedAt: timestamp('cancellation_confirmed_at'),
  cancellationNote:     text('cancellation_note'),
  lastRegistrationDate: timestamp('last_registration_date'),
  lastConnectionDate:   timestamp('last_connection_date'),
  currentCsidId:        integer('current_csid_id'),           // FK دوري — مُعرَّف في SQL فقط
  isActive:             boolean('is_active').notNull().default(true),
  isDeleted:            boolean('is_deleted').notNull().default(false),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
  createdBy:            integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:            integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
   activePosUnitEnvironmentUidx: uniqueIndex('zatca_devices_active_pos_unit_env_uidx')
     .on(t.orgId, t.posUnitId, t.environmentId)
     .where(sql`${t.posUnitId} IS NOT NULL AND ${t.environmentId} IS NOT NULL AND ${t.isActive} = true AND ${t.isDeleted} = false`),
}));

// ─── ZATCA Unit lifecycle audit ───────────────────────────────────────────────
// Records OneSoft pause/resume/archive actions and the user's confirmation that
// an environment was cancelled externally in Fatoora. No secret is stored here.
export const zatcaUnitLifecycleEvents = pgTable('zatca_unit_lifecycle_events', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  posUnitId:      integer('pos_unit_id').notNull().references(() => zatcaPosUnits.id, { onDelete: 'cascade' }),
  deviceId:       integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  environmentId:  integer('environment_id').references(() => zatcaEnvironments.id, { onDelete: 'set null' }),
  action:         varchar('action', { length: 50 }).notNull(),
  previousStatus: varchar('previous_status', { length: 50 }),
  nextStatus:     varchar('next_status', { length: 50 }),
  reason:         text('reason'),
  actorUserId:    integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorUsername:  varchar('actor_username', { length: 100 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});

// ─── 3. ZATCA Certificates ────────────────────────────────────────────────────
export const zatcaCertificates = pgTable('zatca_certificates', {
  id:                   serial('id').primaryKey(),
  orgId:                integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deviceId:             integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  csr:                  text('csr'),
  publicCertificate:    text('public_certificate'),
  privateKeyEncrypted:  text('private_key_encrypted'),        // مشفَّر AES-256-GCM
  secretKeyEncrypted:   text('secret_key_encrypted'),         // السر التشغيلي المشفّر AES-256-GCM
  complianceSecretEncrypted: text('compliance_secret_encrypted'), // سر Compliance المشفّر
  certificateVersion:   varchar('certificate_version', { length: 20 }),
  startDate:            timestamp('start_date'),
  expiryDate:           timestamp('expiry_date'),
  status:               varchar('status', { length: 30 }).notNull().default('pending'),
  isActive:             boolean('is_active').notNull().default(true),
  isDeleted:            boolean('is_deleted').notNull().default(false),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
  createdBy:            integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:            integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 4. ZATCA CSID ────────────────────────────────────────────────────────────
export const zatcaCsid = pgTable('zatca_csid', {
  id:               serial('id').primaryKey(),
  orgId:            integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deviceId:         integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  certificateId:    integer('certificate_id').references(() => zatcaCertificates.id, { onDelete: 'set null' }),
  complianceCsid:   text('compliance_csid'),
  productionCsid:   text('production_csid'),
  issueDate:        timestamp('issue_date'),
  expiryDate:       timestamp('expiry_date'),
  status:           varchar('status', { length: 30 }).notNull().default('active'),
  isActive:         boolean('is_active').notNull().default(true),
  isDeleted:        boolean('is_deleted').notNull().default(false),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  createdBy:        integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:        integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 5. ZATCA Keys ────────────────────────────────────────────────────────────
export const zatcaKeys = pgTable('zatca_keys', {
  id:                   serial('id').primaryKey(),
  orgId:                integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deviceId:             integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  algorithm:            varchar('algorithm', { length: 20 }).notNull().default('EC'),
  curve:                varchar('curve', { length: 20 }).default('secp256k1'),
  publicKey:            text('public_key'),
  privateKeyEncrypted:  text('private_key_encrypted'),        // مشفَّر AES-256-GCM
  fingerprint:          varchar('fingerprint', { length: 128 }),
  status:               varchar('status', { length: 30 }).notNull().default('active'),
  isActive:             boolean('is_active').notNull().default(true),
  isDeleted:            boolean('is_deleted').notNull().default(false),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
  createdBy:            integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:            integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 6. ZATCA CSR Requests ────────────────────────────────────────────────────
export const zatcaCsrRequests = pgTable('zatca_csr_requests', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deviceId:    integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  csrText:     text('csr_text'),
  pem:         text('pem'),
  requestDate: timestamp('request_date').notNull().defaultNow(),
  status:      varchar('status', { length: 30 }).notNull().default('pending'),
  response:    text('response'),
  isActive:    boolean('is_active').notNull().default(true),
  isDeleted:   boolean('is_deleted').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  createdBy:   integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 6b. ZATCA Compliance Matching Tests ─────────────────────────────────────
// Results of official Compliance tests are separate from operational invoice
// transactions and from local XML/transport diagnostics.
export const zatcaComplianceTests = pgTable('zatca_compliance_tests', {
  id:                serial('id').primaryKey(),
  orgId:             integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  posUnitId:         integer('pos_unit_id').notNull().references(() => zatcaPosUnits.id, { onDelete: 'cascade' }),
  deviceId:          integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  invoiceId:         integer('invoice_id').references(() => salesInvoices.id, { onDelete: 'set null' }),
  // Kept as an isolated reference to the fixture table; the SQL migration
  // adds the database FK without creating a module-initialization cycle here.
  fixtureId:         integer('fixture_id'),
  testKey:           varchar('test_key', { length: 60 }).notNull(),
  invoiceType:       varchar('invoice_type', { length: 20 }).notNull(),
  documentType:      varchar('document_type', { length: 30 }).notNull(),
  status:            varchar('status', { length: 30 }).notNull().default('not_started'),
  httpStatus:        integer('http_status'),
  requestId:         varchar('request_id', { length: 160 }),
  invoiceUuid:       varchar('invoice_uuid', { length: 100 }),
  invoiceHash:       varchar('invoice_hash', { length: 256 }),
  xmlBeforeSigning:  text('xml_before_signing'),
  xmlAfterSigning:   text('xml_after_signing'),
  responsePayload:   jsonb('response_payload'),
  warnings:          jsonb('warnings'),
  errors:            jsonb('errors'),
  attemptedAt:       timestamp('attempted_at'),
  completedAt:       timestamp('completed_at'),
  isActive:          boolean('is_active').notNull().default(true),
  isDeleted:         boolean('is_deleted').notNull().default(false),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
  createdBy:         integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:         integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  activeTestKeyUidx: uniqueIndex('zatca_compliance_tests_active_key_uidx')
    .on(t.orgId, t.posUnitId, t.testKey)
    .where(sql`${t.isActive} = true AND ${t.isDeleted} = false`),
}));

// ─── 6c. Isolated ZATCA compliance fixtures ───────────────────────────────────
// These documents exist only for official Simulation compliance tests. They
// never enter sales posting, inventory, numbering journals, or commercial
// invoice lists.
export const zatcaComplianceFixtures = pgTable('zatca_compliance_fixtures', {
  id:                serial('id').primaryKey(),
  orgId:             integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  posUnitId:         integer('pos_unit_id').notNull().references(() => zatcaPosUnits.id, { onDelete: 'cascade' }),
  sourceFixtureId:   integer('source_fixture_id'),
  invoiceType:       varchar('invoice_type', { length: 20 }).notNull(),
  documentType:      varchar('document_type', { length: 30 }).notNull(),
  invoiceNumber:     varchar('invoice_number', { length: 100 }).notNull(),
  invoiceDate:       timestamp('invoice_date').notNull(),
  customerName:      varchar('customer_name', { length: 500 }),
  customerTaxNumber: varchar('customer_tax_number', { length: 100 }),
  customerAddress:   jsonb('customer_address').$type<{
    street: string;
    building: string;
    district: string;
    city: string;
    postalCode: string;
    countryCode: string;
  } | null>(),
  subtotal:          decimal('subtotal', { precision: 18, scale: 4 }).notNull().default('100'),
  discountAmount:    decimal('discount_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  taxAmount:         decimal('tax_amount', { precision: 18, scale: 4 }).notNull().default('15'),
  total:             decimal('total', { precision: 18, scale: 4 }).notNull().default('115'),
  notes:             text('notes'),
  zatcaUuid:         varchar('zatca_uuid', { length: 100 }).notNull(),
  isActive:          boolean('is_active').notNull().default(true),
  isDeleted:         boolean('is_deleted').notNull().default(false),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
  createdBy:         integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:         integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  activeFixtureKeyUidx: uniqueIndex('zatca_compliance_fixtures_active_key_uidx')
    .on(t.orgId, t.posUnitId, t.invoiceType, t.documentType)
    .where(sql`${t.isActive} = true AND ${t.isDeleted} = false`),
}));

export const zatcaComplianceFixtureItems = pgTable('zatca_compliance_fixture_items', {
  id:             serial('id').primaryKey(),
  fixtureId:      integer('fixture_id').notNull().references(() => zatcaComplianceFixtures.id, { onDelete: 'cascade' }),
  productName:    varchar('product_name', { length: 500 }).notNull(),
  quantity:       decimal('quantity', { precision: 18, scale: 4 }).notNull().default('1'),
  unit:           varchar('unit', { length: 100 }).notNull().default('C62'),
  unitPrice:      decimal('unit_price', { precision: 18, scale: 4 }).notNull().default('100'),
  total:          decimal('total', { precision: 18, scale: 4 }).notNull().default('115'),
  taxAmount:      decimal('tax_amount', { precision: 18, scale: 4 }).notNull().default('15'),
  taxPercent:     decimal('tax_percent', { precision: 5, scale: 2 }).notNull().default('15'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  sortOrder:      integer('sort_order').notNull().default(0),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});

// ─── 7. ZATCA Invoice Transactions ───────────────────────────────────────────
export const zatcaInvoiceTransactions = pgTable('zatca_invoice_transactions', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId:       integer('invoice_id').references(() => salesInvoices.id, { onDelete: 'set null' }),
  invoiceNumber:   varchar('invoice_number', { length: 100 }),
  invoiceUuid:     uuid('invoice_uuid'),
  invoiceHash:     varchar('invoice_hash', { length: 256 }),
  qrHash:          text('qr_hash'),
  deviceId:        integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  environmentId:   integer('environment_id').references(() => zatcaEnvironments.id, { onDelete: 'set null' }),
  submissionType:  varchar('submission_type', { length: 30 }).notNull().default('clearance'),
  submissionDate:  timestamp('submission_date').notNull().defaultNow(),
  invoiceStatus:   varchar('invoice_status', { length: 30 }).notNull().default('pending'),
  invoiceCounter:  integer('invoice_counter'),
  issuanceTimestamp: timestamp('issuance_timestamp'),
  correlationId:   varchar('correlation_id', { length: 120 }),
  httpStatus:      integer('http_status'),
  responseCode:    varchar('response_code', { length: 50 }),
  responseMessage: text('response_message'),
  authorityStatus: varchar('authority_status', { length: 80 }),
  warnings:        jsonb('warnings'),
  errors:          jsonb('errors'),
  requestPayload:  jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  responseDate:    timestamp('response_date'),
  lastAttemptAt:   timestamp('last_attempt_at'),
  nextRetryAt:     timestamp('next_retry_at'),
  uncertainAt:     timestamp('uncertain_at'),
  idempotencyKey:  varchar('idempotency_key', { length: 160 }),
  lastError:       text('last_error'),
  attemptCount:    integer('attempt_count').notNull().default(0),
  executionTimeMs: integer('execution_time_ms'),
  isActive:        boolean('is_active').notNull().default(true),
  isDeleted:       boolean('is_deleted').notNull().default(false),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
  createdBy:       integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:       integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
 }, (t) => [
   uniqueIndex('idx_zatca_trx_invoice_active')
     .on(t.orgId, t.invoiceId)
     .where(sql`${t.invoiceId} IS NOT NULL AND ${t.isActive} = true AND ${t.isDeleted} = false`),
 ]);

// ─── 7b. ZATCA Submission Attempts ────────────────────────────────────────────
// سجل مستقل لكل محاولة؛ لا ينشئ معاملة فاتورة جديدة.
export const zatcaSubmissionAttempts = pgTable('zatca_submission_attempts', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transactionId:   integer('transaction_id').notNull().references(() => zatcaInvoiceTransactions.id, { onDelete: 'cascade' }),
  attemptNumber:   integer('attempt_number').notNull(),
  attemptId:       uuid('attempt_id').notNull().defaultRandom(),
  startedAt:       timestamp('started_at').notNull().defaultNow(),
  finishedAt:      timestamp('finished_at'),
  requestId:       varchar('request_id', { length: 120 }),
  httpStatus:      integer('http_status'),
  requestPayload:  jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  result:          varchar('result', { length: 40 }).notNull().default('started'),
  errorMessage:    text('error_message'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('zatca_submission_attempt_transaction_number_uidx')
    .on(t.transactionId, t.attemptNumber),
  uniqueIndex('zatca_submission_attempt_attempt_id_uidx')
    .on(t.attemptId),
]);

// ─── 7c. ZATCA Durable Queue ──────────────────────────────────────────────────
// Durable queue: Mock/Sandbox only until the official Simulation sender owns
// retries; Simulation rows are rejected by the legacy Mock worker.
export const zatcaSubmissionQueue = pgTable('zatca_submission_queue', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transactionId:   integer('transaction_id').notNull().references(() => zatcaInvoiceTransactions.id, { onDelete: 'cascade' }),
  posUnitId:       integer('pos_unit_id').references(() => zatcaPosUnits.id, { onDelete: 'set null' }),
  deviceId:        integer('device_id').references(() => zatcaDevices.id, { onDelete: 'set null' }),
  queueKey:        varchar('queue_key', { length: 160 }).notNull(),
  operation:       varchar('operation', { length: 20 }).notNull(),
  uuid:             uuid('uuid'),
  invoiceCounter:  integer('invoice_counter'),
  idempotencyKey:  varchar('idempotency_key', { length: 160 }),
  mockOutcome:     varchar('mock_outcome', { length: 40 }).notNull().default('accepted'),
  state:            varchar('state', { length: 20 }).notNull().default('queued'),
  availableAt:     timestamp('available_at').notNull().defaultNow(),
  lockedAt:        timestamp('locked_at'),
  lockedBy:        varchar('locked_by', { length: 120 }),
  attemptId:       uuid('attempt_id'),
  lastError:       text('last_error'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('zatca_submission_queue_transaction_uidx')
    .on(t.transactionId),
  index('zatca_submission_queue_due_idx')
    .on(t.state, t.availableAt),
  index('zatca_submission_queue_unit_idx')
    .on(t.queueKey, t.state),
]);

// ─── 8. ZATCA Request Log ─────────────────────────────────────────────────────
export const zatcaRequestLog = pgTable('zatca_request_log', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transactionId: integer('transaction_id').references(() => zatcaInvoiceTransactions.id, { onDelete: 'set null' }),
  url:           text('url'),
  httpMethod:    varchar('http_method', { length: 10 }).notNull().default('POST'),
  headers:       jsonb('headers'),
  requestBody:   text('request_body'),
  requestTime:   timestamp('request_time').notNull().defaultNow(),
  isActive:      boolean('is_active').notNull().default(true),
  isDeleted:     boolean('is_deleted').notNull().default(false),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 9. ZATCA Response Log ────────────────────────────────────────────────────
export const zatcaResponseLog = pgTable('zatca_response_log', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transactionId: integer('transaction_id').references(() => zatcaInvoiceTransactions.id, { onDelete: 'set null' }),
  httpStatus:    integer('http_status'),
  headers:       jsonb('headers'),
  responseBody:  text('response_body'),
  responseTime:  timestamp('response_time').notNull().defaultNow(),
  isActive:      boolean('is_active').notNull().default(true),
  isDeleted:     boolean('is_deleted').notNull().default(false),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 10. ZATCA Error Log ──────────────────────────────────────────────────────
export const zatcaErrorLog = pgTable('zatca_error_log', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transactionId: integer('transaction_id').references(() => zatcaInvoiceTransactions.id, { onDelete: 'set null' }),
  errorCode:     varchar('error_code', { length: 100 }),
  errorType:     varchar('error_type', { length: 100 }),
  errorMessage:  text('error_message'),
  stackTrace:    text('stack_trace'),
  resolution:    text('resolution'),
  retryCount:    integer('retry_count').notNull().default(0),
  isActive:      boolean('is_active').notNull().default(true),
  isDeleted:     boolean('is_deleted').notNull().default(false),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 11. ZATCA XML Documents ──────────────────────────────────────────────────
export const zatcaXmlDocuments = pgTable('zatca_xml_documents', {
  id:                serial('id').primaryKey(),
  orgId:             integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId:         integer('invoice_id').references(() => salesInvoices.id, { onDelete: 'set null' }),
  xmlBeforeSigning:  text('xml_before_signing'),
  xmlAfterSigning:   text('xml_after_signing'),
  xmlVersion:        varchar('xml_version', { length: 20 }).default('2.1'),
  validationResult:  jsonb('validation_result'),
  isActive:          boolean('is_active').notNull().default(true),
  isDeleted:         boolean('is_deleted').notNull().default(false),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
  createdBy:         integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:         integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 12. ZATCA QR Codes ───────────────────────────────────────────────────────
export const zatcaQrCodes = pgTable('zatca_qr_codes', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId:      integer('invoice_id').references(() => salesInvoices.id, { onDelete: 'set null' }),
  tlvData:        text('tlv_data'),
  base64:         text('base64'),
  generationDate: timestamp('generation_date').notNull().defaultNow(),
  isActive:       boolean('is_active').notNull().default(true),
  isDeleted:      boolean('is_deleted').notNull().default(false),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
  createdBy:      integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:      integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 13. ZATCA Settings ───────────────────────────────────────────────────────
export const zatcaSettings = pgTable('zatca_settings', {
  id:                   serial('id').primaryKey(),
  orgId:                integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  defaultEnvironmentId: integer('default_environment_id').references(() => zatcaEnvironments.id, { onDelete: 'set null' }),
  enableZatca:          boolean('enable_zatca').notNull().default(false),
  autoRetry:            boolean('auto_retry').notNull().default(true),
  retryCount:           integer('retry_count').notNull().default(3),
  timeoutSeconds:       integer('timeout_seconds').notNull().default(30),
  proxySettings:        jsonb('proxy_settings'),
  logLevel:             varchar('log_level', { length: 20 }).notNull().default('info'),
  isActive:             boolean('is_active').notNull().default(true),
  isDeleted:            boolean('is_deleted').notNull().default(false),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
  createdBy:            integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:            integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── 14. ZATCA API History ────────────────────────────────────────────────────
export const zatcaApiHistory = pgTable('zatca_api_history', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  apiName:     varchar('api_name', { length: 100 }),
  url:         text('url'),
  method:      varchar('method', { length: 10 }).notNull().default('POST'),
  startTime:   timestamp('start_time').notNull().defaultNow(),
  endTime:     timestamp('end_time'),
  durationMs:  integer('duration_ms'),
  result:      varchar('result', { length: 30 }),
  userId:      integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName:    varchar('user_name', { length: 200 }),
  isActive:    boolean('is_active').notNull().default(true),
  isDeleted:   boolean('is_deleted').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  createdBy:   integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ─── License Center (مركز التراخيص) ──────────────────────────────────────────
export const lcLicenseTypeEnum   = pgEnum('lc_license_type',   ['trial', 'subscription', 'lifetime']);
export const lcLicenseStatusEnum = pgEnum('lc_license_status', ['active', 'suspended', 'expired', 'revoked']);
export const lcDeviceStatusEnum  = pgEnum('lc_device_status',  ['active', 'inactive', 'revoked']);
export const lcOpTypeEnum        = pgEnum('lc_op_type', [
  'create_client', 'create_license', 'activate', 'suspend',
  'resume', 'renew', 'revoke_device', 'generate_key', 'generate_activation_code',
  'update_client', 'update_license', 'export_license', 'generate_web_setup',
]);

export const lcClients = pgTable('lc_clients', {
  id:                  serial('id').primaryKey(),
  name:                varchar('name', { length: 255 }).notNull(),
  orgId:               varchar('org_id', { length: 80 }).notNull().unique(),
  tradeName:           varchar('trade_name', { length: 255 }),
  commercialReg:       varchar('commercial_reg', { length: 80 }),
  taxNumber:           varchar('tax_number', { length: 80 }),
  country:             varchar('country', { length: 80 }),
  city:                varchar('city', { length: 80 }),
  phone:               varchar('phone', { length: 50 }),
  email:               varchar('email', { length: 255 }),
  activityType:        varchar('activity_type', { length: 120 }),
  contactName:         varchar('contact_name', { length: 120 }),
  contactPhone:        varchar('contact_phone', { length: 50 }),
  contactEmail:        varchar('contact_email', { length: 255 }),
  runType:             varchar('run_type', { length: 20 }).notNull().default('desktop'),
  webSetupToken:       varchar('web_setup_token', { length: 120 }),
  webSetupTokenUsed:   boolean('web_setup_token_used').notNull().default(false),
  notes:               text('notes'),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  updatedAt:           timestamp('updated_at').notNull().defaultNow(),
});

export const lcLicenses = pgTable('lc_licenses', {
  id:              serial('id').primaryKey(),
  licenseId:       varchar('license_id', { length: 120 }).notNull().unique(),
  clientId:        integer('client_id').notNull().references(() => lcClients.id, { onDelete: 'cascade' }),
  packageName:     varchar('package_name', { length: 120 }),
  licenseType:     lcLicenseTypeEnum('license_type').notNull().default('subscription'),
  status:          lcLicenseStatusEnum('status').notNull().default('active'),
  maxUsers:        integer('max_users').notNull().default(5),
  maxBranches:     integer('max_branches').notNull().default(1),
  maxPos:          integer('max_pos').notNull().default(1),
  maxDevices:      integer('max_devices').notNull().default(3),
  maxWeb:          integer('max_web').notNull().default(1),
  enabledModules:  jsonb('enabled_modules').$type<string[]>().notNull().default([]),
  webAllowed:      boolean('web_allowed').notNull().default(false),
  desktopAllowed:  boolean('desktop_allowed').notNull().default(true),
  offlineAllowed:  boolean('offline_allowed').notNull().default(false),
  syncAllowed:     boolean('sync_allowed').notNull().default(false),
  startDate:       varchar('start_date', { length: 20 }).notNull(),
  expiryDate:      varchar('expiry_date', { length: 20 }).notNull(),
  licenseKey:      text('license_key'),
  notes:           text('notes'),
  issuedBy:        varchar('issued_by', { length: 120 }).notNull().default('OneSoft ERP'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export const lcDevices = pgTable('lc_devices', {
  id:              serial('id').primaryKey(),
  licenseId:       integer('license_id').notNull().references(() => lcLicenses.id, { onDelete: 'cascade' }),
  deviceName:      varchar('device_name', { length: 120 }).notNull(),
  deviceId:        varchar('device_id', { length: 255 }).notNull(),
  hwFingerprint:   varchar('hw_fingerprint', { length: 255 }),
  status:          lcDeviceStatusEnum('status').notNull().default('active'),
  lastActivatedAt: timestamp('last_activated_at'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
});

export const lcOperationsLog = pgTable('lc_operations_log', {
  id:            serial('id').primaryKey(),
  clientId:      integer('client_id').references(() => lcClients.id, { onDelete: 'set null' }),
  licenseId:     integer('license_id').references(() => lcLicenses.id, { onDelete: 'set null' }),
  operationType: lcOpTypeEnum('operation_type').notNull(),
  description:   varchar('description', { length: 500 }).notNull(),
  performedBy:   varchar('performed_by', { length: 120 }),
  metadata:      jsonb('metadata'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

// ─── Support Tickets — Client Side (0021) ────────────────────────────────────
export const supportTicketsLocal = pgTable('support_tickets_local', {
  id:                serial('id').primaryKey(),
  ticketNumber:      varchar('ticket_number', { length: 30 }).notNull().unique(),
  orgId:             integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId:   integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subject:           varchar('subject', { length: 500 }).notNull(),
  description:       text('description').notNull(),
  category:          varchar('category', { length: 50 }).notNull().default('general'),
  priority:          varchar('priority', { length: 20 }).notNull().default('normal'),
  status:            varchar('status', { length: 30 }).notNull().default('draft'),
  sourceInfo:        jsonb('source_info').$type<Record<string, any>>(),
  isOfflineDraft:    boolean('is_offline_draft').notNull().default(false),
  submittedAt:       timestamp('submitted_at'),
  lcTicketRef:       varchar('lc_ticket_ref', { length: 50 }),
  lastReplyAt:       timestamp('last_reply_at'),
  unreadReplies:     integer('unread_replies').notNull().default(0),
  rating:            integer('rating'),
  ratingComment:     text('rating_comment'),
  ratedAt:           timestamp('rated_at'),
  cancelledAt:       timestamp('cancelled_at'),
  resolvedAt:        timestamp('resolved_at'),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

export const supportTicketMessagesLocal = pgTable('support_ticket_messages_local', {
  id:          serial('id').primaryKey(),
  ticketId:    integer('ticket_id').notNull().references(() => supportTicketsLocal.id, { onDelete: 'cascade' }),
  senderType:  varchar('sender_type', { length: 20 }).notNull().default('user'),
  senderName:  varchar('sender_name', { length: 200 }),
  body:        text('body').notNull(),
  isRead:      boolean('is_read').notNull().default(false),
  sentAt:      timestamp('sent_at').notNull().defaultNow(),
  lcMsgRef:    varchar('lc_msg_ref', { length: 50 }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
});

export const supportTicketAttachmentsLocal = pgTable('support_ticket_attachments_local', {
  id:         serial('id').primaryKey(),
  ticketId:   integer('ticket_id').notNull().references(() => supportTicketsLocal.id, { onDelete: 'cascade' }),
  messageId:  integer('message_id').references(() => supportTicketMessagesLocal.id, { onDelete: 'set null' }),
  filename:   varchar('filename', { length: 300 }).notNull(),
  filePath:   text('file_path').notNull(),
  fileSize:   integer('file_size'),
  mimeType:   varchar('mime_type', { length: 100 }),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
});

// ─── Support Tickets — LC Side (0021) ────────────────────────────────────────
export const lcSupportTickets = pgTable('lc_support_tickets', {
  id:             serial('id').primaryKey(),
  ticketNumber:   varchar('ticket_number', { length: 30 }).notNull().unique(),
  clientId:       integer('client_id').references(() => lcClients.id, { onDelete: 'set null' }),
  orgId:          varchar('org_id', { length: 50 }),
  orgName:        varchar('org_name', { length: 300 }),
  subject:        varchar('subject', { length: 500 }).notNull(),
  description:    text('description').notNull(),
  category:       varchar('category', { length: 50 }).notNull().default('general'),
  priority:       varchar('priority', { length: 20 }).notNull().default('normal'),
  status:         varchar('status', { length: 30 }).notNull().default('open'),
  submitterName:  varchar('submitter_name', { length: 200 }),
  submitterEmail: varchar('submitter_email', { length: 200 }),
  sourceInfo:     jsonb('source_info').$type<Record<string, any>>(),
  assignedTo:     varchar('assigned_to', { length: 200 }),
  resolvedAt:     timestamp('resolved_at'),
  closedAt:       timestamp('closed_at'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
});

export const lcSupportTicketMessages = pgTable('lc_support_ticket_messages', {
  id:                serial('id').primaryKey(),
  ticketId:          integer('ticket_id').notNull().references(() => lcSupportTickets.id, { onDelete: 'cascade' }),
  senderType:        varchar('sender_type', { length: 20 }).notNull().default('client'),
  senderName:        varchar('sender_name', { length: 200 }),
  body:              text('body').notNull(),
  isReadByClient:    boolean('is_read_by_client').notNull().default(false),
  isReadBySupport:   boolean('is_read_by_support').notNull().default(false),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
});

export const lcSupportTicketAttachments = pgTable('lc_support_ticket_attachments', {
  id:         serial('id').primaryKey(),
  ticketId:   integer('ticket_id').notNull().references(() => lcSupportTickets.id, { onDelete: 'cascade' }),
  messageId:  integer('message_id').references(() => lcSupportTicketMessages.id, { onDelete: 'set null' }),
  filename:   varchar('filename', { length: 300 }).notNull(),
  fileUrl:    text('file_url').notNull(),
  fileSize:   integer('file_size'),
  mimeType:   varchar('mime_type', { length: 100 }),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
});

export const lcSupportTicketNotes = pgTable('lc_support_ticket_notes', {
  id:        serial('id').primaryKey(),
  ticketId:  integer('ticket_id').notNull().references(() => lcSupportTickets.id, { onDelete: 'cascade' }),
  author:    varchar('author', { length: 200 }),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Verification Tokens (0017) ───────────────────────────────────────────────
export const verificationTokens = pgTable('verification_tokens', {
  id:            serial('id').primaryKey(),
  userId:        integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType:    varchar('target_type', { length: 10 }).notNull(),
  targetValue:   varchar('target_value', { length: 255 }).notNull(),
  otpHash:       varchar('otp_hash', { length: 255 }).notNull(),
  expiresAt:     timestamp('expires_at').notNull(),
  usedAt:        timestamp('used_at'),
  attemptsCount: integer('attempts_count').notNull().default(0),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

// ─── Password Reset Tokens (0017) ─────────────────────────────────────────────
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id:            serial('id').primaryKey(),
  userId:        integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channel:       varchar('channel', { length: 10 }).notNull(),
  otpHash:       varchar('otp_hash', { length: 255 }).notNull(),
  resetToken:    varchar('reset_token', { length: 100 }).notNull().unique(),
  expiresAt:     timestamp('expires_at').notNull(),
  usedAt:        timestamp('used_at'),
  attemptsCount: integer('attempts_count').notNull().default(0),
  requestIp:     varchar('request_ip', { length: 64 }),
  deviceInfo:    text('device_info'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

// ─── Security Events (0017) ───────────────────────────────────────────────────
export const securityEvents = pgTable('security_events', {
  id:         serial('id').primaryKey(),
  eventType:  varchar('event_type', { length: 80 }).notNull(),
  userId:     integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  username:   varchar('username', { length: 100 }),
  phone:      varchar('phone', { length: 50 }),
  email:      varchar('email', { length: 255 }),
  orgId:      integer('org_id'),
  result:     varchar('result', { length: 20 }).notNull().default('success'),
  reason:     text('reason'),
  ip:         varchar('ip', { length: 64 }),
  deviceInfo: text('device_info'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
});

// ─── AI Assistant (المساعد الذكي) — 0020 ─────────────────────────────────────
// جميع الجداول معزولة بالمؤسسة (org_id) — المرحلة الأولى: قراءة واقتراح فقط.

// إعدادات المساعد الذكي (سجل واحد لكل مؤسسة)
export const aiSettings = pgTable('ai_settings', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  enabled:       boolean('enabled').notNull().default(false),
  provider:      varchar('provider', { length: 50 }).notNull().default('openai'),
  baseUrl:       varchar('base_url', { length: 500 }).notNull().default('https://api.openai.com/v1'),
  model:         varchar('model', { length: 100 }).notNull().default('gpt-4o-mini'),
  // مفتاح API — يُخزَّن مشفراً بنمط ENC: (AES-256-GCM) ولا يُعاد للواجهة أبداً
  apiKeyEnc:     text('api_key_enc'),
  maxTokens:     integer('max_tokens').notNull().default(1024),
  temperature:   decimal('temperature', { precision: 3, scale: 2 }).notNull().default('0.30'),
  allowOrgData:  boolean('allow_org_data').notNull().default(true),
  keepHistory:   boolean('keep_history').notNull().default(true),
  retentionDays: integer('retention_days').notNull().default(90),
  lastError:     text('last_error'),
  lastOkAt:      timestamp('last_ok_at'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('ai_settings_org_uidx').on(t.orgId),
]);

// محادثات المساعد الذكي
export const aiConversations = pgTable('ai_conversations', {
  id:        serial('id').primaryKey(),
  orgId:     integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:     varchar('title', { length: 255 }).notNull().default('محادثة جديدة'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// رسائل المحادثات
export const aiMessages = pgTable('ai_messages', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  conversationId: integer('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:           varchar('role', { length: 20 }).notNull(),          // 'user' | 'assistant'
  content:        text('content').notNull(),
  // المصادر المستخدمة في الإجابة: [{ type, id, label, path }]
  sources:        jsonb('sources').$type<Array<Record<string, any>>>(),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});

// اقتراحات العمليات (مثل: إنشاء مهمة) — لا تُنفَّذ إلا بعد تأكيد صريح
export const aiActionProposals = pgTable('ai_action_proposals', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: integer('conversation_id').references(() => aiConversations.id, { onDelete: 'set null' }),
  actionType:     varchar('action_type', { length: 50 }).notNull(),   // 'create_task' (المرحلة الأولى)
  payload:        jsonb('payload').$type<Record<string, any>>().notNull(),
  status:         varchar('status', { length: 20 }).notNull().default('pending'), // pending | confirmed | cancelled | failed
  resultMessage:  text('result_message'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
});

// سجل تدقيق المساعد الذكي — كل طلب وكل عملية
export const aiAuditLogs = pgTable('ai_audit_logs', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: integer('conversation_id'),
  question:       text('question'),
  operationType:  varchar('operation_type', { length: 50 }).notNull(), // ask | test_connection | confirm_action | ...
  sections:       jsonb('sections').$type<string[]>(),                 // الأقسام المستخدمة كمصادر
  recordsUsed:    jsonb('records_used').$type<Array<Record<string, any>>>(),
  answerSummary:  text('answer_summary'),
  proposed:       boolean('proposed').notNull().default(false),
  confirmed:      boolean('confirmed').notNull().default(false),
  result:         varchar('result', { length: 20 }).notNull().default('ok'), // ok | error | denied
  errorMessage:   text('error_message'),
  provider:       varchar('provider', { length: 50 }),
  model:          varchar('model', { length: 100 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});

// مهام «المساعدة والخدمات» — الوجهة الفعلية للمهام المؤكَّدة من المساعد الذكي
export const hsTasks = pgTable('hs_tasks', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assigneeUserId:  integer('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
  title:           varchar('title', { length: 300 }).notNull(),
  details:         text('details'),
  dueDate:         varchar('due_date', { length: 10 }),   // YYYY-MM-DD
  dueTime:         varchar('due_time', { length: 5 }),    // HH:MM
  priority:        varchar('priority', { length: 10 }).notNull().default('normal'), // low | normal | high
  status:          varchar('status', { length: 20 }).notNull().default('open'),     // open | done | cancelled
  source:          varchar('source', { length: 20 }).notNull().default('manual'),   // manual | ai
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

// ─── متابعة العهد — أداة مساعدة داخلية مستقلة (0022/0023) ───────────────────
// تنبيه: هذه الجداول مستقلة تمامًا عن النظام المحاسبي ولا ترتبط بأي قيد أو سند

// سجل العهدة (الهيدر) — 0023
export const hsCustodyRecords = pgTable('hs_custody_records', {
  id:               serial('id').primaryKey(),
  orgId:            integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId:  integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recordNumber:     integer('record_number').notNull().default(1),
  custodyName:      text('custody_name').notNull().default(''),
  email:            varchar('email', { length: 255 }),
  autoSendEmail:    boolean('auto_send_email').notNull().default(false),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
});

// حركات العهدة — 0022 + إضافة custodyId في 0023
export const hsCustodyEntries = pgTable('hs_custody_entries', {
  id:               serial('id').primaryKey(),
  orgId:            integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId:  integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  custodyId:        integer('custody_id').references(() => hsCustodyRecords.id, { onDelete: 'cascade' }),
  entryDate:        varchar('entry_date', { length: 10 }).notNull(), // YYYY-MM-DD
  description:      text('description').notNull().default(''),
  referenceNumber:  varchar('reference_number', { length: 100 }),
  // المبلغ المحصل (incomeCollected) + المبلغ المسدد (expensePaid) — حقول التتبع الجديدة
  incomeDue:        decimal('income_due',       { precision: 15, scale: 4 }).notNull().default('0'),
  incomeCollected:  decimal('income_collected', { precision: 15, scale: 4 }).notNull().default('0'),
  incomeNote:       text('income_note'),
  expenseDue:       decimal('expense_due',  { precision: 15, scale: 4 }).notNull().default('0'),
  expensePaid:      decimal('expense_paid', { precision: 15, scale: 4 }).notNull().default('0'),
  expenseNote:      text('expense_note'),
  sortOrder:        integer('sort_order').notNull().default(0),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
});

// ─── 0024: الروابط والخدمات ───────────────────────────────────────────────────
export const hsLinkSections = pgTable('hs_link_sections', {
  id:         serial('id').primaryKey(),
  orgId:      integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name:       varchar('name', { length: 200 }).notNull(),
  icon:       varchar('icon', { length: 50 }),
  color:      varchar('color', { length: 20 }),
  sortOrder:  integer('sort_order').notNull().default(0),
  createdBy:  integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
});

export const hsLinks = pgTable('hs_links', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sectionId:   integer('section_id').references(() => hsLinkSections.id, { onDelete: 'set null' }),
  name:        varchar('name', { length: 200 }).notNull(),
  url:         text('url').notNull(),
  description: text('description'),
  icon:        varchar('icon', { length: 50 }),
  cardColor:   varchar('card_color', { length: 20 }),
  openMode:    varchar('open_mode',    { length: 20 }).notNull().default('external'),
  browserType: varchar('browser_type', { length: 20 }).notNull().default('default'),
  browserPath: text('browser_path'),
  isActive:    boolean('is_active').notNull().default(true),
  isFavorite:  boolean('is_favorite').notNull().default(false),
  isPinned:    boolean('is_pinned').notNull().default(false),
  sortOrder:   integer('sort_order').notNull().default(0),
  createdBy:   integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

// ─── 0025: البيان التفصيلي للمشتريات (المطور العقاري) ─────────────────
export const rePurchaseStatements = pgTable('re_purchase_statements', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name:            varchar('name',      { length: 255 }).notNull(),
  project:         varchar('project',   { length: 255 }),
  dateFrom:        timestamp('date_from').notNull(),
  dateTo:          timestamp('date_to').notNull(),
  defaultTaxRate:  decimal('default_tax_rate', { precision: 5, scale: 2 }).notNull().default('15'),
  notes:           text('notes'),
  createdBy:       integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:       integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export const rePurchases = pgTable('re_purchases', {
  id:              serial('id').primaryKey(),
  orgId:           integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  statementId:     integer('statement_id').references(() => rePurchaseStatements.id, { onDelete: 'cascade' }),
  sequence:        integer('sequence'),
  supplierName:    varchar('supplier_name',    { length: 255 }).notNull(),
  supplierTaxId:   varchar('supplier_tax_id',  { length: 50 }),
  invoiceDate:     timestamp('invoice_date').notNull().defaultNow(),
  invoiceNumber:   varchar('invoice_number',   { length: 100 }).notNull(),
  preTaxValue:     decimal('pre_tax_value',    { precision: 18, scale: 4 }).notNull().default('0'),
  taxRate:         decimal('tax_rate',         { precision: 5,  scale: 2 }).notNull().default('15'),
  taxAmount:       decimal('tax_amount',       { precision: 18, scale: 4 }).notNull().default('0'),
  totalValue:      decimal('total_value',      { precision: 18, scale: 4 }).notNull().default('0'),
  notes:           text('notes'),
  attachmentUrl:   text('attachment_url'),
  createdBy:       integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:       integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

// ─── Real Estate: Project Documents ────────────────────────────────────────────
export const reProjects = pgTable('re_projects', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code:          varchar('code',    { length: 50 }).notNull(),
  name:          varchar('name',    { length: 255 }).notNull(),
  location:      varchar('location',{ length: 255 }),
  ownerName:     varchar('owner_name', { length: 255 }),
  plotNumber:    varchar('plot_number',{ length: 50 }),
  planNumber:    varchar('plan_number',{ length: 50 }),
  startDate:     timestamp('start_date'),
  expectedEndDate: timestamp('expected_end_date'),
  status:        varchar('status',{ length: 20 }).notNull().default('active'),
  notes:         text('notes'),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export const reDocumentTypes = pgTable('re_document_types', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name:          varchar('name',{ length: 255 }).notNull(),
  icon:          varchar('icon',{ length: 50 }),
  sortOrder:     integer('sort_order').notNull().default(0),
  isSystem:      boolean('is_system').notNull().default(false),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export const reDocuments = pgTable('re_documents', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId:     integer('project_id').notNull().references(() => reProjects.id, { onDelete: 'cascade' }),
  documentTypeId: integer('document_type_id').notNull().references(() => reDocumentTypes.id, { onDelete: 'restrict' }),
  name:          varchar('name',{ length: 255 }).notNull(),
  documentNumber: varchar('document_number',{ length: 100 }),
  issuer:        varchar('issuer',{ length: 255 }),
  issueDate:     timestamp('issue_date'),
  expiryDate:    timestamp('expiry_date'),
  needsRenewal:  boolean('needs_renewal').notNull().default(false),
  alertDays:     integer('alert_days').default(30),
  notes:         text('notes'),
  filePath:      text('file_path'),
  originalName:  varchar('original_name',{ length: 255 }),
  fileSize:      integer('file_size'),
  mimeType:      varchar('mime_type',{ length: 100 }),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export const reDocumentVersions = pgTable('re_document_versions', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId:    integer('document_id').notNull().references(() => reDocuments.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  filePath:      text('file_path').notNull(),
  originalName:  varchar('original_name',{ length: 255 }),
  fileSize:      integer('file_size'),
  mimeType:      varchar('mime_type',{ length: 100 }),
  notes:         text('notes'),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type Voucher = typeof vouchers.$inferSelect;
export type ReceiptVoucher = typeof receiptVouchers.$inferSelect;
export type PaymentVoucher = typeof paymentVouchers.$inferSelect;

// ZATCA Architecture Types (0012 + 0060)
export type ZatcaPosUnit            = typeof zatcaPosUnits.$inferSelect;
export type ZatcaEnvironment         = typeof zatcaEnvironments.$inferSelect;
export type ZatcaDevice              = typeof zatcaDevices.$inferSelect;
export type ZatcaCertificate         = typeof zatcaCertificates.$inferSelect;
export type ZatcaCsid                = typeof zatcaCsid.$inferSelect;
export type ZatcaKey                 = typeof zatcaKeys.$inferSelect;
export type ZatcaCsrRequest          = typeof zatcaCsrRequests.$inferSelect;
export type ZatcaComplianceTest      = typeof zatcaComplianceTests.$inferSelect;
export type ZatcaInvoiceTransaction  = typeof zatcaInvoiceTransactions.$inferSelect;
export type ZatcaRequestLog          = typeof zatcaRequestLog.$inferSelect;
export type ZatcaResponseLog         = typeof zatcaResponseLog.$inferSelect;
export type ZatcaErrorLog            = typeof zatcaErrorLog.$inferSelect;
export type ZatcaXmlDocument         = typeof zatcaXmlDocuments.$inferSelect;
export type ZatcaQrCode              = typeof zatcaQrCodes.$inferSelect;
export type ZatcaSettings            = typeof zatcaSettings.$inferSelect;
export type ZatcaApiHistory          = typeof zatcaApiHistory.$inferSelect;

// Real Estate Purchases Types
export type RePurchaseStatement      = typeof rePurchaseStatements.$inferSelect;
export type RePurchase               = typeof rePurchases.$inferSelect;

// Real Estate Documents Types
export type ReProject                = typeof reProjects.$inferSelect;
export type ReDocumentType           = typeof reDocumentTypes.$inferSelect;
export type ReDocument               = typeof reDocuments.$inferSelect;
export type ReDocumentVersion        = typeof reDocumentVersions.$inferSelect;

// ─── Real Estate: Simplified Trial Balance ───────────────────────────────────
export const reTrialBalances = pgTable('re_trial_balances', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name:          varchar('name',    { length: 255 }).notNull(),
  periodLabel:   varchar('period_label',{ length: 100 }),
  fromDate:      timestamp('from_date'),
  toDate:        timestamp('to_date'),
  projectId:     integer('project_id').references(() => reProjects.id, { onDelete: 'set null' }),
  scope:         varchar('scope',   { length: 20 }).notNull().default('org'), // 'org' | 'project'
  settlementAccountId: integer('settlement_account_id').references((): AnyPgColumn => reTbAccounts.id, { onDelete: 'set null' }),
  notes:         text('notes'),
  status:        varchar('status',  { length: 20 }).notNull().default('draft'), // 'draft' | 'balanced' | 'unbalanced' | 'reviewed'
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export const reTbAccounts = pgTable('re_tb_accounts', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trialBalanceId: integer('trial_balance_id').notNull().references((): AnyPgColumn => reTrialBalances.id, { onDelete: 'cascade' }),
  parentId:      integer('parent_id').references((): AnyPgColumn => reTbAccounts.id, { onDelete: 'cascade' }),
  code:          varchar('code',    { length: 50 }).notNull(),
  name:          varchar('name',    { length: 255 }).notNull(),
  category:      varchar('category',{ length: 50 }).notNull(), // 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses'
  nature:        varchar('nature',  { length: 10 }).notNull().default('debit'), // 'debit' | 'credit'
  sortOrder:     integer('sort_order').notNull().default(0),
  isSystem:      boolean('is_system').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
  reviewStatus:  varchar('review_status',{ length: 20 }).notNull().default('not_reviewed'), // 'not_reviewed' | 'reviewed' | 'has_diff' | 'needs_doc'
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export const reTbEntries = pgTable('re_tb_entries', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trialBalanceId: integer('trial_balance_id').notNull().references(() => reTrialBalances.id, { onDelete: 'cascade' }),
  accountId:     integer('account_id').notNull().references(() => reTbAccounts.id, { onDelete: 'cascade' }),
  openingDebit:  decimal('opening_debit',  { precision: 18, scale: 2 }).notNull().default('0'),
  openingCredit: decimal('opening_credit', { precision: 18, scale: 2 }).notNull().default('0'),
  movementDebit: decimal('movement_debit', { precision: 18, scale: 2 }).notNull().default('0'),
  movementCredit: decimal('movement_credit',{ precision: 18, scale: 2 }).notNull().default('0'),
  endingDebit:   decimal('ending_debit',   { precision: 18, scale: 2 }).notNull().default('0'),
  endingCredit:  decimal('ending_credit',  { precision: 18, scale: 2 }).notNull().default('0'),
  notes:         text('notes'),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export const reTbTaxReturns = pgTable('re_tb_tax_returns', {
  id:                  serial('id').primaryKey(),
  orgId:               integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trialBalanceId:      integer('trial_balance_id').notNull().references(() => reTrialBalances.id, { onDelete: 'cascade' }),
  periodLabel:         varchar('period_label',{ length: 100 }),
  purchasesPreTax:     decimal('purchases_pre_tax',    { precision: 18, scale: 2 }).notNull().default('0'),
  purchaseReturns:     decimal('purchase_returns',     { precision: 18, scale: 2 }).notNull().default('0'),
  netPurchases:        decimal('net_purchases',        { precision: 18, scale: 2 }).notNull().default('0'),
  deductibleTax:     decimal('deductible_tax',       { precision: 18, scale: 2 }).notNull().default('0'),
  openingTaxBalance: decimal('opening_tax_balance',  { precision: 18, scale: 2 }).notNull().default('0'),
  actualRefund:        decimal('actual_refund',        { precision: 18, scale: 2 }).notNull().default('0'),
  actualOffset:        decimal('actual_offset',        { precision: 18, scale: 2 }).notNull().default('0'),
  refundStatus:        varchar('refund_status',{ length: 30 }).notNull().default('not_submitted'), // 'not_submitted' | 'under_review' | 'approved' | 'refunded' | 'offset'
  notes:               text('notes'),
  createdBy:           integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:           integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  updatedAt:           timestamp('updated_at').notNull().defaultNow(),
});

export const reTbPurchaseLinks = pgTable('re_tb_purchase_links', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trialBalanceId: integer('trial_balance_id').notNull().references(() => reTrialBalances.id, { onDelete: 'cascade' }),
  accountId:     integer('account_id').notNull().references(() => reTbAccounts.id, { onDelete: 'cascade' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

export const reTbAuditLog = pgTable('re_tb_audit_log', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trialBalanceId: integer('trial_balance_id').notNull().references(() => reTrialBalances.id, { onDelete: 'cascade' }),
  accountId:     integer('account_id').references(() => reTbAccounts.id, { onDelete: 'set null' }),
  action:        varchar('action',{ length: 50 }).notNull(), // 'create' | 'update' | 'delete' | 'settlement' | 'reset_accounts'
  fieldName:     varchar('field_name',{ length: 50 }),
  oldValue:      text('old_value'),
  newValue:      text('new_value'),
  userId:        integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName:      varchar('user_name',{ length: 255 }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

export const reTbSettlements = pgTable('re_tb_settlements', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  trialBalanceId: integer('trial_balance_id').notNull().references(() => reTrialBalances.id, { onDelete: 'cascade' }),
  accountId:     integer('account_id').notNull().references(() => reTbAccounts.id, { onDelete: 'cascade' }),
  difference:    decimal('difference',{ precision: 18, scale: 2 }).notNull(),
  direction:     varchar('direction',{ length: 10 }).notNull(), // 'debit' | 'credit'
  previousBalanceDebit:  decimal('prev_balance_debit',  { precision: 18, scale: 2 }).notNull().default('0'),
  previousBalanceCredit: decimal('prev_balance_credit', { precision: 18, scale: 2 }).notNull().default('0'),
  newBalanceDebit:       decimal('new_balance_debit',   { precision: 18, scale: 2 }).notNull().default('0'),
  newBalanceCredit:      decimal('new_balance_credit',  { precision: 18, scale: 2 }).notNull().default('0'),
  userConfirmed: boolean('user_confirmed').notNull().default(false),
  confirmedAt:   timestamp('confirmed_at'),
  notes:         text('notes'),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

// ─── Real Estate: Housing Units (Phase 1) ──────────────────────────────────────
export const reHousingUnits = pgTable('re_housing_units', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId:     integer('project_id').references(() => reProjects.id, { onDelete: 'set null' }),
  unitNo:        varchar('unit_no',    { length: 50 }).notNull(),
  unitType:      varchar('unit_type',  { length: 30 }).notNull().default('apartment'),
  status:        varchar('status',     { length: 20 }).notNull().default('available'),
  area:          decimal('area',       { precision: 12, scale: 2 }),
  price:         decimal('price',      { precision: 18, scale: 4 }),
  floor:         varchar('floor',      { length: 20 }),
  block:         varchar('block',      { length: 30 }),
  building:      varchar('building',   { length: 30 }),
  notes:         text('notes'),
  createdBy:     integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

// ─── User Audit Log (0044) ────────────────────────────────────────────────────
// لا تحتوي على FK cascade إلى users — السجل يبقى حتى بعد حذف المستخدم المستهدف
export const userAuditLogs = pgTable('user_audit_logs', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorUserId:    integer('actor_user_id').notNull(),      // بدون CASCADE — المنفذ قد يُحذف لاحقاً
  actorUsername:  varchar('actor_username', { length: 100 }).notNull(),
  targetUserId:   integer('target_user_id').notNull(),     // بدون CASCADE — المستهدف يُحذف في هذه العملية
  targetCode:     varchar('target_code', { length: 50 }),
  targetName:     varchar('target_name', { length: 255 }).notNull(),
  targetUsername: varchar('target_username', { length: 100 }).notNull(),
  action:         varchar('action', { length: 30 }).notNull(),  // DELETE_USER | DEACTIVATE_USER
  reason:         text('reason'),
  ipAddress:      varchar('ip_address', { length: 100 }),
  deviceInfo:     varchar('device_info', { length: 255 }),
  result:         varchar('result', { length: 20 }).notNull().default('success'), // success | rejected
  resultReason:   text('result_reason'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});
export type UserAuditLog = typeof userAuditLogs.$inferSelect;

// Real Estate Trial Balance Types
export type ReTrialBalance           = typeof reTrialBalances.$inferSelect;
export type ReTbAccount              = typeof reTbAccounts.$inferSelect;
export type ReTbEntry                = typeof reTbEntries.$inferSelect;
export type ReTbTaxReturn            = typeof reTbTaxReturns.$inferSelect;
export type ReTbPurchaseLink         = typeof reTbPurchaseLinks.$inferSelect;
export type ReTbAuditLogEntry        = typeof reTbAuditLog.$inferSelect;
export type ReTbSettlement           = typeof reTbSettlements.$inferSelect;

// ─── Foundation Tombstones ─────────────────────────────────────────────────────
export const foundationTombstones = pgTable('foundation_tombstones', {
  id:             serial('id').primaryKey(),
  orgId:          integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  tableName:      varchar('table_name', { length: 100 }).notNull(),
  foundationKey:  varchar('foundation_key', { length: 255 }).notNull(),
  deletedBy:      integer('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  deletedAt:      timestamp('deleted_at').notNull().defaultNow(),
  reason:         text('reason'),
}, (t) => ({
  unqOrgTableKey: uniqueIndex('tombstone_org_table_key').on(t.orgId, t.tableName, t.foundationKey),
}));

export type FoundationTombstone = typeof foundationTombstones.$inferSelect;

// Real Estate Housing Units Types
export type ReHousingUnit            = typeof reHousingUnits.$inferSelect;
