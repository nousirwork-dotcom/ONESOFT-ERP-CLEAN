import { pgTable, serial, varchar, text, integer, boolean, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer']);
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'trial', 'expired']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['sale', 'return', 'quote']);
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
  branchId: integer('branch_id').references(() => branches.id),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  name2: varchar('name2', { length: 255 }),
  fullName1: varchar('full_name1', { length: 255 }),
  fullName2: varchar('full_name2', { length: 255 }),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  invAccountId: integer('inv_account_id').references(() => chartOfAccounts.id),
  cogsAccount1Id: integer('cogs_account1_id').references(() => chartOfAccounts.id),
  cogsAccount2Id: integer('cogs_account2_id').references(() => chartOfAccounts.id),
  cashAccountId: integer('cash_account_id').references(() => chartOfAccounts.id),
  bankAccountId: integer('bank_account_id').references(() => chartOfAccounts.id),
  salesAccount1Id: integer('sales_account1_id').references(() => chartOfAccounts.id),
  allowedUserId: integer('allowed_user_id').references(() => users.id),
  allowedUserGroup: varchar('allowed_user_group', { length: 255 }),
  copyFromWarehouseId: integer('copy_from_warehouse_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Warehouse Account Links ───────────────────────────────────────────────────
export const warehouseAccountLinks = pgTable('warehouse_account_links', {
  id: serial('id').primaryKey(),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  accountId: integer('account_id').references(() => chartOfAccounts.id),
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
  groupId: integer('group_id').references(() => productGroups.id),
  unitId: integer('unit_id').references(() => units.id),
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
  customerId: integer('customer_id').references(() => customers.id),
  customerName: varchar('customer_name', { length: 500 }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  branchId: integer('branch_id').references(() => branches.id),
  userId: integer('user_id').references(() => users.id),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Sales Invoice Items ──────────────────────────────────────────────────────
export const salesInvoiceItems = pgTable('sales_invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').references(() => products.id),
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
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
});

// ─── Purchase Invoices ────────────────────────────────────────────────────────
export const purchaseInvoices = pgTable('purchase_invoices', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  supplierInvoiceNumber: varchar('supplier_invoice_number', { length: 100 }),
  invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  supplierName: varchar('supplier_name', { length: 500 }),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 4 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).default('0'),
  paidAmount: decimal('paid_amount', { precision: 18, scale: 4 }).default('0'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Journal Entry Lines ──────────────────────────────────────────────────────
export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  accountId: integer('account_id').references(() => chartOfAccounts.id),
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
  accountId: integer('account_id').references(() => chartOfAccounts.id),
  accountCode: varchar('account_code', { length: 50 }),
  accountName: varchar('account_name', { length: 500 }),
  partyType: varchar('party_type', { length: 20 }),
  partyId: integer('party_id'),
  partyName: varchar('party_name', { length: 500 }),
  description: text('description'),
  reference: varchar('reference', { length: 100 }),
  status: journalStatusEnum('status').notNull().default('draft'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').notNull().references(() => products.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
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
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  branchId: integer('branch_id').references(() => branches.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  reason: varchar('reason', { length: 500 }),
  notes: text('notes'),
  totalCost: decimal('total_cost', { precision: 18, scale: 4 }).default('0'),
  status: varchar('status', { length: 20 }).notNull().default('confirmed'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stockVoucherItems = pgTable('stock_voucher_items', {
  id: serial('id').primaryKey(),
  voucherId: integer('voucher_id').notNull().references(() => stockVouchers.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').references(() => products.id),
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
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  branchId: integer('branch_id').references(() => branches.id),
  status: inventoryCountStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
});

export const inventoryCountItems = pgTable('inventory_count_items', {
  id: serial('id').primaryKey(),
  countId: integer('count_id').notNull().references(() => inventoryCounts.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => organizations.id),
  productId: integer('product_id').references(() => products.id),
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
  productId: integer('product_id').references(() => products.id),
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
