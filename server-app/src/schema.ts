import { pgTable, serial, varchar, text, integer, boolean, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer']);
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'trial', 'expired']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['sale', 'return', 'quote', 'order']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'confirmed', 'cancelled', 'paid']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'bank', 'credit', 'check', 'other']);
export const voucherTypeEnum = pgEnum('voucher_type', ['receipt', 'payment']);
export const journalStatusEnum = pgEnum('journal_status', ['draft', 'posted', 'cancelled']);

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 50 }),
  username: varchar('username', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  role: userRoleEnum('role').notNull().default('cashier'),
  categoryId: integer('category_id'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── User Groups ──────────────────────────────────────────────────────────────
export const userGroups = pgTable('user_groups', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Branches ─────────────────────────────────────────────────────────────────
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Warehouses ───────────────────────────────────────────────────────────────
export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  copyFromWarehouseId: integer('copy_from_warehouse_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 100 }).notNull(),
  symbol: varchar('symbol', { length: 20 }),
});

// ─── Product Groups ───────────────────────────────────────────────────────────
export const productGroups = pgTable('product_groups', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  color: varchar('color', { length: 30 }),
  isActive: boolean('is_active').default(true),
});

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 100 }),
  barcode: varchar('barcode', { length: 100 }),
  name: varchar('name', { length: 500 }).notNull(),
  nameEn: varchar('name_en', { length: 500 }),
  groupId: integer('group_id').references(() => productGroups.id, { onDelete: 'set null' }),
  unitId: integer('unit_id').references(() => units.id, { onDelete: 'set null' }),
  unit: varchar('unit', { length: 100 }),
  salePrice: decimal('sale_price', { precision: 18, scale: 4 }).default('0'),
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 4 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  minStock: decimal('min_stock', { precision: 18, scale: 4 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 500 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  taxNumber: varchar('tax_number', { length: 50 }),
  balance: decimal('balance', { precision: 18, scale: 4 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Chart of Accounts ────────────────────────────────────────────────────────
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Sales Invoices ───────────────────────────────────────────────────────────
export const salesInvoices = pgTable('sales_invoices', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceType: invoiceTypeEnum('invoice_type').notNull().default('sale'),
  invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
  dueDate: timestamp('due_date'),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  customerName: varchar('customer_name', { length: 500 }),
  customerType: varchar('customer_type', { length: 20 }).default('individual'),
  customerTaxNumber: varchar('customer_tax_number', { length: 100 }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
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
  paymentMethod: paymentMethodEnum('payment_method').default('cash'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  refInvoiceId: integer('ref_invoice_id'),
  journalId: integer('journal_id'),
  docTypeId: integer('doc_type_id'),
  isPosted: boolean('is_posted').notNull().default(false),
  postedAt: timestamp('posted_at'),
  postedJournalEntryId: integer('posted_journal_entry_id'),
  costPosted: boolean('cost_posted').notNull().default(false),
  costPostedJournalEntryId: integer('cost_posted_journal_entry_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Sales Invoice Items ──────────────────────────────────────────────────────
export const salesInvoiceItems = pgTable('sales_invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  docTypeId: integer('doc_type_id'),
  isPosted: boolean('is_posted').notNull().default(false),
  postedAt: timestamp('posted_at'),
  postedJournalEntryId: integer('posted_journal_entry_id'),
  inventoryPosted: boolean('inventory_posted').notNull().default(false),
  costPostedJournalEntryId: integer('cost_posted_journal_entry_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Purchase Invoice Items ───────────────────────────────────────────────────
export const purchaseInvoiceItems = pgTable('purchase_invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => purchaseInvoices.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
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
  sortOrder: integer('sort_order').default(0),
});

// ─── Journal Entries ──────────────────────────────────────────────────────────
export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Journal Entry Lines ──────────────────────────────────────────────────────
export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').notNull().references(() => products.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  avgCost: decimal('avg_cost', { precision: 18, scale: 4 }).default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Stock Vouchers ───────────────────────────────────────────────────────────
export const stockVoucherTypeEnum = pgEnum('stock_voucher_type', ['receipt', 'issue', 'transfer']);

export const stockVouchers = pgTable('stock_vouchers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stockVoucherItems = pgTable('stock_voucher_items', {
  id: serial('id').primaryKey(),
  voucherId: integer('voucher_id').notNull().references(() => stockVouchers.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 18, scale: 4 }).default('0'),
  totalCost: decimal('total_cost', { precision: 18, scale: 4 }).default('0'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Inventory Counts (جرد) ───────────────────────────────────────────────────
export const inventoryCountStatusEnum = pgEnum('inventory_count_status', ['draft', 'confirmed', 'cancelled']);

export const inventoryCounts = pgTable('inventory_counts', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
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
  orgId: integer('org_id').notNull().references(() => organizations.id),
  senderId: integer('sender_id').notNull().references(() => users.id),
  receiverId: integer('receiver_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Document Journals (دفاتر المستندات) ─────────────────────────────────────
// كل دفتر هو وحدة تشغيلية مستقلة: ترقيم + مخزن + فرع + حسابات + صلاحيات
export const documentJournals = pgTable('document_journals', {
  id:            serial('id').primaryKey(),
  orgId:         integer('org_id').notNull().references(() => organizations.id),
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
  // ── الربط بالكيانات ───────────────────────────────────────────────────────
  warehouseId:   integer('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  branchId:      integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
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
  postingMode:      varchar('posting_mode', { length: 20 }).default('manual'),
  allowUnpost:      boolean('allow_unpost').notNull().default(true),
  allowEditAfterPost: boolean('allow_edit_after_post').notNull().default(false),
  notes:            text('notes'),
  isActive:         boolean('is_active').notNull().default(true),
  sortOrder:        integer('sort_order').notNull().default(0),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
});

export type DocumentJournal = typeof documentJournals.$inferSelect;

// ─── Document Types (أنواع المستندات) ────────────────────────────────────────
export const documentTypes = pgTable('document_types', {
  id:                   serial('id').primaryKey(),
  orgId:                integer('org_id').notNull().references(() => organizations.id),
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
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

export type DocumentType = typeof documentTypes.$inferSelect;

// ─── Document Templates (نماذج المستندات) ────────────────────────────────────
// كل نموذج يحدد شكل الطباعة لنوع مستند معين
export const documentTemplates = pgTable('document_templates', {
  id:          serial('id').primaryKey(),
  orgId:       integer('org_id').notNull().references(() => organizations.id),
  code:        varchar('code', { length: 30 }).notNull(),       // رقم النموذج مثال: T001
  nameAr:      varchar('name_ar', { length: 255 }).notNull(),   // اسم النموذج بالعربي
  nameEn:      varchar('name_en', { length: 255 }),             // اسم النموذج بالإنجليزي
  docType:     varchar('doc_type', { length: 30 }).notNull(),   // نوع المستند المرتبط
  paperSize:   varchar('paper_size', { length: 20 }).default('A4'),
  orientation: varchar('orientation', { length: 20 }).default('portrait'),
  isDefault:   boolean('is_default').notNull().default(false),
  layoutJson:  text('layout_json'),
  notes:       text('notes'),
  isActive:    boolean('is_active').notNull().default(true),
  sortOrder:   integer('sort_order').notNull().default(0),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
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
  isActive:   boolean('is_active').notNull().default(true),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
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
