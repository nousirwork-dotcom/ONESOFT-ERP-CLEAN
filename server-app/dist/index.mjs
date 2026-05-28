var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/env.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
var __dirname, ENV;
var init_env = __esm({
  "src/env.ts"() {
    __dirname = path.dirname(fileURLToPath(import.meta.url));
    dotenv.config({ path: path.join(__dirname, "..", ".env") });
    ENV = {
      port: parseInt(process.env.PORT || "3737"),
      nodeEnv: process.env.NODE_ENV || "development",
      dbUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/onesoft_erp",
      jwtSecret: process.env.JWT_SECRET || "onesoft-erp-secret-2024",
      cookieName: "onesoft_session",
      sessionExpiry: 30 * 24 * 60 * 60 * 1e3
      // 30 يوم
    };
  }
});

// src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  branches: () => branches,
  chartOfAccounts: () => chartOfAccounts,
  customers: () => customers,
  documentJournals: () => documentJournals,
  documentTemplates: () => documentTemplates,
  documentTypes: () => documentTypes,
  freeProducts: () => freeProducts,
  inventory: () => inventory,
  inventoryCountItems: () => inventoryCountItems,
  inventoryCountStatusEnum: () => inventoryCountStatusEnum,
  inventoryCounts: () => inventoryCounts,
  invoiceStatusEnum: () => invoiceStatusEnum,
  invoiceTypeEnum: () => invoiceTypeEnum,
  journalEntries: () => journalEntries,
  journalEntryLines: () => journalEntryLines,
  journalStatusEnum: () => journalStatusEnum,
  messages: () => messages,
  orgStatusEnum: () => orgStatusEnum,
  organizations: () => organizations,
  paymentMethodEnum: () => paymentMethodEnum,
  paymentVouchers: () => paymentVouchers,
  productGroups: () => productGroups,
  products: () => products,
  purchaseInvoiceItems: () => purchaseInvoiceItems,
  purchaseInvoices: () => purchaseInvoices,
  receiptVouchers: () => receiptVouchers,
  salesInvoiceItems: () => salesInvoiceItems,
  salesInvoices: () => salesInvoices,
  stockVoucherItems: () => stockVoucherItems,
  stockVoucherTypeEnum: () => stockVoucherTypeEnum,
  stockVouchers: () => stockVouchers,
  suppliers: () => suppliers,
  units: () => units,
  userCategories: () => userCategories,
  userGroupMembers: () => userGroupMembers,
  userGroups: () => userGroups,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  voucherTypeEnum: () => voucherTypeEnum,
  vouchers: () => vouchers,
  warehouseAccountLinks: () => warehouseAccountLinks,
  warehouses: () => warehouses
});
import { pgTable, serial, varchar, text, integer, boolean, decimal, timestamp, pgEnum } from "drizzle-orm/pg-core";
var userRoleEnum, orgStatusEnum, invoiceTypeEnum, invoiceStatusEnum, paymentMethodEnum, voucherTypeEnum, journalStatusEnum, organizations, users, userGroups, userCategories, userGroupMembers, branches, warehouses, warehouseAccountLinks, units, productGroups, products, customers, suppliers, chartOfAccounts, salesInvoices, salesInvoiceItems, purchaseInvoices, purchaseInvoiceItems, journalEntries, journalEntryLines, vouchers, receiptVouchers, paymentVouchers, inventory, stockVoucherTypeEnum, stockVouchers, stockVoucherItems, inventoryCountStatusEnum, inventoryCounts, inventoryCountItems, freeProducts, messages, documentJournals, documentTypes, documentTemplates;
var init_schema = __esm({
  "src/schema.ts"() {
    userRoleEnum = pgEnum("user_role", ["superadmin", "admin", "cashier", "accountant", "warehouse_manager", "viewer"]);
    orgStatusEnum = pgEnum("org_status", ["active", "suspended", "trial", "expired"]);
    invoiceTypeEnum = pgEnum("invoice_type", ["sale", "return", "quote", "order"]);
    invoiceStatusEnum = pgEnum("invoice_status", ["draft", "confirmed", "cancelled", "paid"]);
    paymentMethodEnum = pgEnum("payment_method", ["cash", "bank", "credit", "check", "other"]);
    voucherTypeEnum = pgEnum("voucher_type", ["receipt", "payment"]);
    journalStatusEnum = pgEnum("journal_status", ["draft", "posted", "cancelled"]);
    organizations = pgTable("organizations", {
      id: serial("id").primaryKey(),
      code: varchar("code", { length: 20 }).notNull().unique(),
      name: varchar("name", { length: 255 }).notNull(),
      nameEn: varchar("name_en", { length: 255 }),
      logo: text("logo"),
      phone: varchar("phone", { length: 50 }),
      email: varchar("email", { length: 255 }),
      address: text("address"),
      taxNumber: varchar("tax_number", { length: 50 }),
      commercialReg: varchar("commercial_reg", { length: 50 }),
      currency: varchar("currency", { length: 10 }).notNull().default("SAR"),
      status: orgStatusEnum("status").notNull().default("trial"),
      subscriptionExpiry: timestamp("subscription_expiry"),
      maxUsers: integer("max_users").notNull().default(5),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 50 }),
      username: varchar("username", { length: 100 }).notNull(),
      passwordHash: varchar("password_hash", { length: 255 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      email: varchar("email", { length: 255 }),
      phone: varchar("phone", { length: 50 }),
      role: userRoleEnum("role").notNull().default("cashier"),
      categoryId: integer("category_id"),
      isActive: boolean("is_active").notNull().default(true),
      lastLoginAt: timestamp("last_login_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    userGroups = pgTable("user_groups", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    userCategories = pgTable("user_categories", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull(),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 255 }).notNull(),
      isActive: boolean("is_active").notNull().default(true),
      autoNumbering: boolean("auto_numbering").notNull().default(true),
      firstNumber: integer("first_number").notNull().default(1),
      lastNumber: integer("last_number").notNull().default(99999),
      increment: integer("increment").notNull().default(1),
      codeDigits: integer("code_digits").notNull().default(5),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    userGroupMembers = pgTable("user_group_members", {
      id: serial("id").primaryKey(),
      groupId: integer("group_id").notNull().references(() => userGroups.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull(),
      memberType: varchar("member_type", { length: 10 }).notNull(),
      memberCode: varchar("member_code", { length: 50 }),
      memberName: varchar("member_name", { length: 255 }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    branches = pgTable("branches", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      name: varchar("name", { length: 255 }).notNull(),
      address: text("address"),
      phone: varchar("phone", { length: 50 }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    warehouses = pgTable("warehouses", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      branchId: integer("branch_id").references(() => branches.id),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 255 }).notNull(),
      name2: varchar("name2", { length: 255 }),
      fullName1: varchar("full_name1", { length: 255 }),
      fullName2: varchar("full_name2", { length: 255 }),
      address: text("address"),
      isActive: boolean("is_active").notNull().default(true),
      invAccountId: integer("inv_account_id").references(() => chartOfAccounts.id),
      cogsAccount1Id: integer("cogs_account1_id").references(() => chartOfAccounts.id),
      cogsAccount2Id: integer("cogs_account2_id").references(() => chartOfAccounts.id),
      cashAccountId: integer("cash_account_id").references(() => chartOfAccounts.id),
      bankAccountId: integer("bank_account_id").references(() => chartOfAccounts.id),
      salesAccount1Id: integer("sales_account1_id").references(() => chartOfAccounts.id),
      allowedUserId: integer("allowed_user_id").references(() => users.id),
      allowedUserGroup: varchar("allowed_user_group", { length: 255 }),
      copyFromWarehouseId: integer("copy_from_warehouse_id"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    warehouseAccountLinks = pgTable("warehouse_account_links", {
      id: serial("id").primaryKey(),
      warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
      label: varchar("label", { length: 255 }).notNull(),
      accountId: integer("account_id").references(() => chartOfAccounts.id),
      sortOrder: integer("sort_order").notNull().default(0)
    });
    units = pgTable("units", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      name: varchar("name", { length: 100 }).notNull(),
      symbol: varchar("symbol", { length: 20 })
    });
    productGroups = pgTable("product_groups", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      groupCode: varchar("group_code", { length: 50 }),
      name: varchar("name", { length: 255 }).notNull(),
      name2: varchar("name2", { length: 255 }),
      description: text("description"),
      parentId: integer("parent_id"),
      groupType: varchar("group_type", { length: 20 }).default("root"),
      level: integer("level").default(1),
      autoNumbering: boolean("auto_numbering").default(true),
      firstNumber: integer("first_number").default(1),
      lastNumber: integer("last_number").default(99999),
      increment: integer("increment").default(1),
      codeDigits: integer("code_digits").default(5),
      color: varchar("color", { length: 30 }),
      isActive: boolean("is_active").default(true)
    });
    products = pgTable("products", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 100 }),
      barcode: varchar("barcode", { length: 100 }),
      name: varchar("name", { length: 500 }).notNull(),
      nameEn: varchar("name_en", { length: 500 }),
      groupId: integer("group_id").references(() => productGroups.id),
      unitId: integer("unit_id").references(() => units.id),
      unit: varchar("unit", { length: 100 }),
      salePrice: decimal("sale_price", { precision: 18, scale: 4 }).default("0"),
      purchasePrice: decimal("purchase_price", { precision: 18, scale: 4 }).default("0"),
      taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
      minStock: decimal("min_stock", { precision: 18, scale: 4 }).default("0"),
      isActive: boolean("is_active").notNull().default(true),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    customers = pgTable("customers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 500 }).notNull(),
      phone: varchar("phone", { length: 50 }),
      email: varchar("email", { length: 255 }),
      address: text("address"),
      taxNumber: varchar("tax_number", { length: 50 }),
      creditLimit: decimal("credit_limit", { precision: 18, scale: 4 }).default("0"),
      balance: decimal("balance", { precision: 18, scale: 4 }).default("0"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    suppliers = pgTable("suppliers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 500 }).notNull(),
      phone: varchar("phone", { length: 50 }),
      email: varchar("email", { length: 255 }),
      address: text("address"),
      taxNumber: varchar("tax_number", { length: 50 }),
      balance: decimal("balance", { precision: 18, scale: 4 }).default("0"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    chartOfAccounts = pgTable("chart_of_accounts", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 50 }).notNull(),
      name: varchar("name", { length: 500 }).notNull(),
      nameEn: varchar("name_en", { length: 500 }),
      parentId: integer("parent_id"),
      level: integer("level").notNull().default(1),
      accountType: varchar("account_type", { length: 50 }).notNull(),
      nature: varchar("nature", { length: 10 }).default("debit"),
      isParent: boolean("is_parent").default(false),
      allowPosting: boolean("allow_posting").default(true),
      costCenterType: varchar("cost_center_type", { length: 20 }).default("not_allowed"),
      openingBalance: decimal("opening_balance", { precision: 18, scale: 4 }).default("0"),
      openingBalanceType: varchar("opening_balance_type", { length: 10 }).default("debit"),
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      balance: decimal("balance", { precision: 18, scale: 4 }).default("0"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    salesInvoices = pgTable("sales_invoices", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
      invoiceType: invoiceTypeEnum("invoice_type").notNull().default("sale"),
      invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
      dueDate: timestamp("due_date"),
      customerId: integer("customer_id").references(() => customers.id),
      customerName: varchar("customer_name", { length: 500 }),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id),
      userId: integer("user_id").references(() => users.id),
      currency: varchar("currency", { length: 10 }).default("SAR"),
      exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).default("1"),
      subtotal: decimal("subtotal", { precision: 18, scale: 4 }).default("0"),
      discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
      discountAmount: decimal("discount_amount", { precision: 18, scale: 4 }).default("0"),
      taxAmount: decimal("tax_amount", { precision: 18, scale: 4 }).default("0"),
      total: decimal("total", { precision: 18, scale: 4 }).default("0"),
      paidAmount: decimal("paid_amount", { precision: 18, scale: 4 }).default("0"),
      remainingAmount: decimal("remaining_amount", { precision: 18, scale: 4 }).default("0"),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      status: invoiceStatusEnum("status").notNull().default("draft"),
      notes: text("notes"),
      refInvoiceId: integer("ref_invoice_id"),
      journalId: integer("journal_id"),
      isPosted: boolean("is_posted").notNull().default(false),
      postedAt: timestamp("posted_at"),
      postedJournalEntryId: integer("posted_journal_entry_id"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    salesInvoiceItems = pgTable("sales_invoice_items", {
      id: serial("id").primaryKey(),
      invoiceId: integer("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      productId: integer("product_id").references(() => products.id),
      productCode: varchar("product_code", { length: 100 }),
      productName: varchar("product_name", { length: 500 }).notNull(),
      unit: varchar("unit", { length: 100 }),
      quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
      unitPrice: decimal("unit_price", { precision: 18, scale: 4 }).notNull(),
      discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
      discountAmount: decimal("discount_amount", { precision: 18, scale: 4 }).default("0"),
      taxPercent: decimal("tax_percent", { precision: 5, scale: 2 }).default("0"),
      taxAmount: decimal("tax_amount", { precision: 18, scale: 4 }).default("0"),
      total: decimal("total", { precision: 18, scale: 4 }).notNull(),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      notes: text("notes"),
      sortOrder: integer("sort_order").default(0)
    });
    purchaseInvoices = pgTable("purchase_invoices", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
      invoiceType: varchar("invoice_type", { length: 20 }).notNull().default("invoice"),
      supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }),
      invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
      dueDate: timestamp("due_date"),
      supplierId: integer("supplier_id").references(() => suppliers.id),
      supplierName: varchar("supplier_name", { length: 500 }),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      journalId: integer("journal_id"),
      currency: varchar("currency", { length: 10 }).default("SAR"),
      exchangeRate: decimal("exchange_rate", { precision: 18, scale: 6 }).default("1"),
      subtotal: decimal("subtotal", { precision: 18, scale: 4 }).default("0"),
      discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
      discountAmount: decimal("discount_amount", { precision: 18, scale: 4 }).default("0"),
      taxAmount: decimal("tax_amount", { precision: 18, scale: 4 }).default("0"),
      total: decimal("total", { precision: 18, scale: 4 }).default("0"),
      paidAmount: decimal("paid_amount", { precision: 18, scale: 4 }).default("0"),
      remainingAmount: decimal("remaining_amount", { precision: 18, scale: 4 }).default("0"),
      paymentMethod: varchar("payment_method", { length: 20 }).default("cash"),
      status: invoiceStatusEnum("status").notNull().default("draft"),
      notes: text("notes"),
      userId: integer("user_id").references(() => users.id),
      isPosted: boolean("is_posted").notNull().default(false),
      postedAt: timestamp("posted_at"),
      postedJournalEntryId: integer("posted_journal_entry_id"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    purchaseInvoiceItems = pgTable("purchase_invoice_items", {
      id: serial("id").primaryKey(),
      invoiceId: integer("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      productId: integer("product_id").references(() => products.id),
      productCode: varchar("product_code", { length: 100 }),
      productName: varchar("product_name", { length: 500 }).notNull(),
      unit: varchar("unit", { length: 100 }),
      quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
      unitPrice: decimal("unit_price", { precision: 18, scale: 4 }).notNull(),
      discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
      discountAmount: decimal("discount_amount", { precision: 18, scale: 4 }).default("0"),
      taxPercent: decimal("tax_percent", { precision: 5, scale: 2 }).default("0"),
      taxAmount: decimal("tax_amount", { precision: 18, scale: 4 }).default("0"),
      total: decimal("total", { precision: 18, scale: 4 }).notNull(),
      sortOrder: integer("sort_order").default(0)
    });
    journalEntries = pgTable("journal_entries", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      entryNumber: varchar("entry_number", { length: 50 }).notNull(),
      entryDate: timestamp("entry_date").notNull().defaultNow(),
      description: text("description"),
      reference: varchar("reference", { length: 100 }),
      totalDebit: decimal("total_debit", { precision: 18, scale: 4 }).default("0"),
      totalCredit: decimal("total_credit", { precision: 18, scale: 4 }).default("0"),
      status: journalStatusEnum("status").notNull().default("draft"),
      userId: integer("user_id").references(() => users.id),
      sourceDocType: varchar("source_doc_type", { length: 50 }),
      sourceDocId: integer("source_doc_id"),
      sourceDocNumber: varchar("source_doc_number", { length: 100 }),
      entryType: varchar("entry_type", { length: 20 }).notNull().default("manual"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    journalEntryLines = pgTable("journal_entry_lines", {
      id: serial("id").primaryKey(),
      entryId: integer("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      accountId: integer("account_id").references(() => chartOfAccounts.id),
      accountCode: varchar("account_code", { length: 50 }),
      accountName: varchar("account_name", { length: 500 }),
      description: text("description"),
      debit: decimal("debit", { precision: 18, scale: 4 }).default("0"),
      credit: decimal("credit", { precision: 18, scale: 4 }).default("0"),
      costCenter: varchar("cost_center", { length: 100 }),
      sortOrder: integer("sort_order").default(0)
    });
    vouchers = pgTable("vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      voucherType: voucherTypeEnum("voucher_type").notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      accountId: integer("account_id").references(() => chartOfAccounts.id),
      accountCode: varchar("account_code", { length: 50 }),
      accountName: varchar("account_name", { length: 500 }),
      partyType: varchar("party_type", { length: 20 }),
      partyId: integer("party_id"),
      partyName: varchar("party_name", { length: 500 }),
      description: text("description"),
      reference: varchar("reference", { length: 100 }),
      status: journalStatusEnum("status").notNull().default("draft"),
      userId: integer("user_id").references(() => users.id),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    receiptVouchers = pgTable("receipt_vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      receivedFrom: varchar("received_from", { length: 500 }),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      bankAccount: varchar("bank_account", { length: 100 }),
      checkNumber: varchar("check_number", { length: 100 }),
      description: text("description"),
      accountId: integer("account_id").references(() => chartOfAccounts.id),
      contraAccountId: integer("contra_account_id").references(() => chartOfAccounts.id),
      costCenterId: integer("cost_center_id"),
      notes: text("notes"),
      journalEntryId: integer("journal_entry_id"),
      status: varchar("status", { length: 20 }).notNull().default("posted"),
      userId: integer("user_id").references(() => users.id),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    paymentVouchers = pgTable("payment_vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      paidTo: varchar("paid_to", { length: 500 }),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      bankAccount: varchar("bank_account", { length: 100 }),
      checkNumber: varchar("check_number", { length: 100 }),
      description: text("description"),
      accountId: integer("account_id").references(() => chartOfAccounts.id),
      contraAccountId: integer("contra_account_id").references(() => chartOfAccounts.id),
      notes: text("notes"),
      journalEntryId: integer("journal_entry_id"),
      status: varchar("status", { length: 20 }).notNull().default("posted"),
      userId: integer("user_id").references(() => users.id),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    inventory = pgTable("inventory", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      productId: integer("product_id").notNull().references(() => products.id),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull().default("0"),
      avgCost: decimal("avg_cost", { precision: 18, scale: 4 }).default("0"),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    stockVoucherTypeEnum = pgEnum("stock_voucher_type", ["receipt", "issue", "transfer"]);
    stockVouchers = pgTable("stock_vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      type: stockVoucherTypeEnum("type").notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id),
      supplierId: integer("supplier_id").references(() => suppliers.id),
      reason: varchar("reason", { length: 500 }),
      notes: text("notes"),
      totalCost: decimal("total_cost", { precision: 18, scale: 4 }).default("0"),
      status: varchar("status", { length: 20 }).notNull().default("confirmed"),
      userId: integer("user_id").references(() => users.id),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    stockVoucherItems = pgTable("stock_voucher_items", {
      id: serial("id").primaryKey(),
      voucherId: integer("voucher_id").notNull().references(() => stockVouchers.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      productId: integer("product_id").references(() => products.id),
      productName: varchar("product_name", { length: 500 }).notNull(),
      quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
      unitCost: decimal("unit_cost", { precision: 18, scale: 4 }).default("0"),
      totalCost: decimal("total_cost", { precision: 18, scale: 4 }).default("0"),
      sortOrder: integer("sort_order").default(0)
    });
    inventoryCountStatusEnum = pgEnum("inventory_count_status", ["draft", "confirmed", "cancelled"]);
    inventoryCounts = pgTable("inventory_counts", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      countNumber: varchar("count_number", { length: 50 }).notNull(),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id),
      status: inventoryCountStatusEnum("status").notNull().default("draft"),
      notes: text("notes"),
      userId: integer("user_id").references(() => users.id),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      confirmedAt: timestamp("confirmed_at")
    });
    inventoryCountItems = pgTable("inventory_count_items", {
      id: serial("id").primaryKey(),
      countId: integer("count_id").notNull().references(() => inventoryCounts.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      productId: integer("product_id").references(() => products.id),
      productName: varchar("product_name", { length: 500 }).notNull(),
      systemQuantity: decimal("system_quantity", { precision: 18, scale: 4 }).default("0"),
      actualQuantity: decimal("actual_quantity", { precision: 18, scale: 4 }).default("0"),
      difference: decimal("difference", { precision: 18, scale: 4 }).default("0"),
      sortOrder: integer("sort_order").default(0)
    });
    freeProducts = pgTable("free_products", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      productId: integer("product_id").references(() => products.id),
      productCode: varchar("product_code", { length: 100 }),
      productName: varchar("product_name", { length: 500 }).notNull(),
      unit: varchar("unit", { length: 100 }),
      baseQty: decimal("base_qty", { precision: 18, scale: 4 }).notNull().default("1"),
      freeQty: decimal("free_qty", { precision: 18, scale: 4 }).notNull().default("1"),
      offerStart: timestamp("offer_start"),
      offerEnd: timestamp("offer_end"),
      isActive: boolean("is_active").notNull().default(true),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    messages = pgTable("messages", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      senderId: integer("sender_id").notNull().references(() => users.id),
      receiverId: integer("receiver_id").notNull().references(() => users.id),
      content: text("content").notNull(),
      isRead: boolean("is_read").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    documentJournals = pgTable("document_journals", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      // نوع المستند المرتبط
      docType: varchar("doc_type", { length: 30 }).notNull(),
      // مثال: 'sales_invoice' | 'purchase_invoice' | 'receipt_voucher' | 'payment_voucher'
      //        | 'stock_transfer' | 'stock_receipt' | 'stock_issue' | 'inventory_count'
      code: varchar("code", { length: 30 }).notNull(),
      // مثال: SLS-BR1
      name: varchar("name", { length: 255 }).notNull(),
      // مبيعات فرع 1
      name2: varchar("name2", { length: 255 }),
      // اسم إنجليزي
      description: text("description"),
      // ── الترقيم التسلسلي ──────────────────────────────────────────────────────
      numberPrefix: varchar("number_prefix", { length: 20 }).notNull().default("INV"),
      firstNumber: integer("first_number").notNull().default(1),
      lastNumber: integer("last_number").notNull().default(999999),
      increment: integer("increment").notNull().default(1),
      numDigits: integer("num_digits").notNull().default(6),
      includeYear: boolean("include_year").notNull().default(true),
      currentSeq: integer("current_seq").notNull().default(0),
      // آخر رقم مستخدم
      // ── الربط بالكيانات ───────────────────────────────────────────────────────
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id),
      // ── الحسابات الافتراضية ───────────────────────────────────────────────────
      salesAccountId: integer("sales_account_id").references(() => chartOfAccounts.id),
      cashAccountId: integer("cash_account_id").references(() => chartOfAccounts.id),
      creditAccountId: integer("credit_account_id").references(() => chartOfAccounts.id),
      taxAccountId: integer("tax_account_id").references(() => chartOfAccounts.id),
      discountAccountId: integer("discount_account_id").references(() => chartOfAccounts.id),
      // ── الإعدادات ─────────────────────────────────────────────────────────────
      defaultCurrency: varchar("default_currency", { length: 10 }).default("SAR"),
      defaultPayMethod: varchar("default_pay_method", { length: 20 }).default("cash"),
      allowedUserGroup: varchar("allowed_user_group", { length: 255 }),
      allowedUserId: integer("allowed_user_id").references(() => users.id),
      printTemplate: varchar("print_template", { length: 100 }),
      printTemplate2: varchar("print_template_2", { length: 100 }),
      resetFrequency: varchar("reset_frequency", { length: 20 }).default("none"),
      autoSerial: boolean("auto_serial").notNull().default(false),
      printOnSave: boolean("print_on_save").notNull().default(false),
      postingMode: varchar("posting_mode", { length: 20 }).default("manual"),
      allowUnpost: boolean("allow_unpost").notNull().default(true),
      allowEditAfterPost: boolean("allow_edit_after_post").notNull().default(false),
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    documentTypes = pgTable("document_types", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      typeId: varchar("type_id", { length: 30 }).notNull(),
      nameAr: varchar("name_ar", { length: 255 }).notNull(),
      nameEn: varchar("name_en", { length: 255 }),
      codeEn: varchar("code_en", { length: 30 }),
      codeAr: varchar("code_ar", { length: 30 }),
      docType: varchar("doc_type", { length: 30 }),
      userGroup: varchar("user_group", { length: 50 }),
      user_: varchar("user_", { length: 50 }),
      warehouse: varchar("warehouse", { length: 50 }),
      journal: varchar("journal", { length: 50 }),
      systemOnly: boolean("system_only").notNull().default(false),
      entryType: varchar("entry_type", { length: 30 }),
      entryJournal: varchar("entry_journal", { length: 50 }),
      stockDocType: varchar("stock_doc_type", { length: 30 }),
      stockJournal: varchar("stock_journal", { length: 50 }),
      printTemplate: varchar("print_template", { length: 100 }),
      printTemplate2: varchar("print_template_2", { length: 100 }),
      trackQty: boolean("track_qty").notNull().default(false),
      noTax: boolean("no_tax").notNull().default(false),
      sellerStats: boolean("seller_stats").notNull().default(false),
      itemStats: boolean("item_stats").notNull().default(false),
      customerStats: boolean("customer_stats").notNull().default(false),
      noStockDispatch: boolean("no_stock_dispatch").notNull().default(false),
      requireNote: boolean("require_note").notNull().default(false),
      preventEditIfLinked: boolean("prevent_edit_if_linked").notNull().default(false),
      requireCustomerCode: boolean("require_customer_code").notNull().default(false),
      requireEmployeeCode: boolean("require_employee_code").notNull().default(false),
      acctDebit: varchar("acct_debit", { length: 50 }),
      acctCredit: varchar("acct_credit", { length: 50 }),
      acctDiscount: varchar("acct_discount", { length: 50 }),
      acctCash: varchar("acct_cash", { length: 50 }),
      acctTax: varchar("acct_tax", { length: 50 }),
      sortOrder: integer("sort_order").notNull().default(0),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    documentTemplates = pgTable("document_templates", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id),
      code: varchar("code", { length: 30 }).notNull(),
      // رقم النموذج مثال: T001
      nameAr: varchar("name_ar", { length: 255 }).notNull(),
      // اسم النموذج بالعربي
      nameEn: varchar("name_en", { length: 255 }),
      // اسم النموذج بالإنجليزي
      docType: varchar("doc_type", { length: 30 }).notNull(),
      // نوع المستند المرتبط
      paperSize: varchar("paper_size", { length: 20 }).default("A4"),
      orientation: varchar("orientation", { length: 20 }).default("portrait"),
      isDefault: boolean("is_default").notNull().default(false),
      layoutJson: text("layout_json"),
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
  }
});

// src/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var Pool, pool, db;
var init_db = __esm({
  "src/db.ts"() {
    init_env();
    init_schema();
    ({ Pool } = pg);
    pool = new Pool({
      connectionString: ENV.dbUrl,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
    pool.on("error", (err) => {
      console.error("[DB] Unexpected error on idle client", err);
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// src/auth.ts
var auth_exports = {};
__export(auth_exports, {
  createToken: () => createToken,
  getUserFromRequest: () => getUserFromRequest,
  hashPassword: () => hashPassword,
  loginHandler: () => loginHandler,
  logoutHandler: () => logoutHandler,
  meHandler: () => meHandler,
  verifyPassword: () => verifyPassword,
  verifyToken: () => verifyToken
});
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
async function createToken(payload) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").setIssuedAt().sign(SECRET);
}
async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function getUserFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const token = cookies[ENV.cookieName];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, payload.userId), eq(users.isActive, true))
  });
  return user || null;
}
async function loginHandler(req, res) {
  const { username, password, orgCode } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  try {
    let orgId = null;
    if (orgCode) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.code, orgCode.toUpperCase())
      });
      if (!org) return res.status(401).json({ error: "\u0643\u0648\u062F \u0627\u0644\u0645\u0624\u0633\u0633\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      if (org.status === "suspended") return res.status(403).json({ error: "\u062A\u0645 \u062A\u0639\u0644\u064A\u0642 \u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0645\u0624\u0633\u0633\u0629" });
      if (org.status === "expired") return res.status(403).json({ error: "\u0627\u0646\u062A\u0647\u0649 \u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0645\u0624\u0633\u0633\u0629" });
      orgId = org.id;
    }
    const conditions = orgId ? and(eq(users.username, username), eq(users.orgId, orgId), eq(users.isActive, true)) : and(eq(users.username, username), eq(users.isActive, true));
    const user = await db.query.users.findFirst({ where: conditions });
    if (!user) return res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    await db.update(users).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where(eq(users.id, user.id));
    const token = await createToken({
      userId: user.id,
      orgId: user.orgId,
      username: user.username,
      role: user.role
    });
    res.cookie(ENV.cookieName, token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: ENV.sessionExpiry
    });
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        orgId: user.orgId
      }
    });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
}
function logoutHandler(_req, res) {
  res.clearCookie(ENV.cookieName);
  return res.json({ success: true });
}
async function meHandler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
  return res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    orgId: user.orgId
  });
}
var SECRET;
var init_auth = __esm({
  "src/auth.ts"() {
    init_db();
    init_schema();
    init_env();
    SECRET = new TextEncoder().encode(ENV.jwtSecret);
  }
});

// src/index.ts
init_env();
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/trpc.ts
init_auth();
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
async function createContext({ req, res }) {
  const user = await getUserFromRequest(req);
  return { req, res, user };
}
var t = initTRPC.context().create({ transformer: superjson });
var router = t.router;
var publicProcedure = t.procedure;
var requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var requireAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  if (!["superadmin", "admin"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var requireSuperAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  if (ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "\u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629 \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0641\u0642\u0637" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var protectedProcedure = t.procedure.use(requireAuth);
var adminProcedure = t.procedure.use(requireAdmin);
var superAdminProcedure = t.procedure.use(requireSuperAdmin);

// src/routers/index.ts
import { z as z10 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// src/routers/orgs.ts
import { z } from "zod";
import { eq as eq2 } from "drizzle-orm";
init_db();
init_schema();
init_auth();
var orgsRouter = router({
  // بيانات المؤسسة الحالية للمستخدم
  currentOrg: protectedProcedure.query(async ({ ctx }) => {
    const [org] = await db.select({ id: organizations.id, name: organizations.name, code: organizations.code }).from(organizations).where(eq2(organizations.id, ctx.user.orgId));
    return org ?? null;
  }),
  // قائمة المؤسسات (للمدير العام فقط)
  list: superAdminProcedure.query(async () => {
    return db.query.organizations.findMany({
      orderBy: (o, { asc: asc5 }) => [asc5(o.name)]
    });
  }),
  // إضافة مؤسسة جديدة
  create: superAdminProcedure.input(z.object({
    code: z.string().min(2).max(20),
    name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    taxNumber: z.string().optional(),
    currency: z.string().default("SAR"),
    maxUsers: z.number().default(5),
    subscriptionExpiry: z.string().optional(),
    // بيانات المدير الأول
    adminUsername: z.string().min(3),
    adminPassword: z.string().min(6),
    adminName: z.string().min(2)
  })).mutation(async ({ input }) => {
    const code = input.code.toUpperCase();
    const existing = await db.query.organizations.findFirst({
      where: eq2(organizations.code, code)
    });
    if (existing) throw new Error("\u0643\u0648\u062F \u0627\u0644\u0645\u0624\u0633\u0633\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644");
    const [org] = await db.insert(organizations).values({
      code,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      taxNumber: input.taxNumber,
      currency: input.currency,
      maxUsers: input.maxUsers,
      status: "active",
      subscriptionExpiry: input.subscriptionExpiry ? new Date(input.subscriptionExpiry) : null
    }).returning();
    const passwordHash = await hashPassword(input.adminPassword);
    await db.insert(users).values({
      orgId: org.id,
      username: input.adminUsername,
      passwordHash,
      name: input.adminName,
      role: "admin",
      isActive: true
    });
    return org;
  }),
  // تعديل مؤسسة
  update: superAdminProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    status: z.enum(["active", "suspended", "trial", "expired"]).optional(),
    maxUsers: z.number().optional(),
    subscriptionExpiry: z.string().optional()
  })).mutation(async ({ input }) => {
    const { id, subscriptionExpiry, ...rest } = input;
    await db.update(organizations).set({
      ...rest,
      ...subscriptionExpiry ? { subscriptionExpiry: new Date(subscriptionExpiry) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(organizations.id, id));
    return { success: true };
  }),
  // معلومات مؤسستي
  myOrg: protectedProcedure.query(async ({ ctx }) => {
    return db.query.organizations.findFirst({
      where: eq2(organizations.id, ctx.user.orgId)
    });
  })
});

// src/routers/users.ts
import { z as z2 } from "zod";
import { eq as eq3, and as and3, sql } from "drizzle-orm";
init_db();
init_schema();
init_auth();
import { TRPCError as TRPCError2 } from "@trpc/server";
var usersRouter = router({
  // قائمة مبسّطة (id + name) لقوائم الاختيار — متاحة لجميع المستخدمين
  listBasic: protectedProcedure.query(async ({ ctx }) => {
    return db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(and3(eq3(users.orgId, ctx.user.orgId), eq3(users.isActive, true)));
  }),
  // قائمة مستخدمي المؤسسة (للمديرين فقط)
  list: adminProcedure.query(async ({ ctx }) => {
    return db.query.users.findMany({
      where: and3(eq3(users.orgId, ctx.user.orgId), eq3(users.isActive, true)),
      columns: { passwordHash: false },
      orderBy: (u, { asc: asc5 }) => [asc5(u.name)]
    });
  }),
  // إضافة مستخدم جديد
  create: adminProcedure.input(z2.object({
    code: z2.string().optional(),
    username: z2.string().min(3),
    password: z2.string().min(6),
    name: z2.string().min(2),
    email: z2.string().email().optional(),
    phone: z2.string().optional(),
    role: z2.enum(["admin", "cashier", "accountant", "warehouse_manager", "viewer"]),
    categoryId: z2.number().int().positive().optional()
  })).mutation(async ({ input, ctx }) => {
    const existing = await db.query.users.findFirst({
      where: and3(eq3(users.username, input.username), eq3(users.orgId, ctx.user.orgId))
    });
    if (existing) throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644");
    let finalCode = input.code;
    if (!finalCode && input.categoryId) {
      const cats = await db.select().from(userCategories).where(and3(eq3(userCategories.id, input.categoryId), eq3(userCategories.orgId, ctx.user.orgId))).limit(1);
      if (cats.length && cats[0].autoNumbering) {
        const c = cats[0];
        const prefix = c.code ?? "";
        const numDigits = Math.max(c.codeDigits - prefix.length, 1);
        const catUsers = await db.select({ code: users.code }).from(users).where(and3(eq3(users.orgId, ctx.user.orgId), eq3(users.categoryId, input.categoryId), eq3(users.isActive, true)));
        let maxNum = c.firstNumber - c.increment;
        for (const u of catUsers) {
          if (!u.code) continue;
          const numPart = prefix && u.code.startsWith(prefix) ? u.code.slice(prefix.length) : u.code;
          const n = parseInt(numPart, 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
        const nextNum = maxNum < c.firstNumber ? c.firstNumber : maxNum + c.increment;
        if (nextNum <= c.lastNumber) {
          finalCode = prefix + String(nextNum).padStart(numDigits, "0");
        }
      }
    }
    const passwordHash = await hashPassword(input.password);
    const [user] = await db.insert(users).values({
      orgId: ctx.user.orgId,
      code: finalCode,
      username: input.username,
      passwordHash,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      categoryId: input.categoryId,
      isActive: true
    }).returning({ id: users.id, code: users.code, name: users.name, username: users.username, role: users.role });
    return user;
  }),
  // تعديل مستخدم
  update: adminProcedure.input(z2.object({
    id: z2.number(),
    name: z2.string().optional(),
    email: z2.string().optional(),
    phone: z2.string().optional(),
    role: z2.enum(["admin", "cashier", "accountant", "warehouse_manager", "viewer"]).optional(),
    isActive: z2.boolean().optional(),
    newPassword: z2.string().min(6).optional()
  })).mutation(async ({ input, ctx }) => {
    const { id, newPassword, ...rest } = input;
    const user = await db.query.users.findFirst({
      where: and3(eq3(users.id, id), eq3(users.orgId, ctx.user.orgId))
    });
    if (!user) throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    await db.update(users).set({
      ...rest,
      ...newPassword ? { passwordHash: await hashPassword(newPassword) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(users.id, id));
    return { success: true };
  }),
  // تحديث دور المستخدم
  updateRole: adminProcedure.input(z2.object({
    userId: z2.number(),
    role: z2.enum(["admin", "cashier", "accountant", "warehouse_manager", "viewer"]),
    branchId: z2.number().optional()
  })).mutation(async ({ input, ctx }) => {
    const user = await db.query.users.findFirst({
      where: and3(eq3(users.id, input.userId), eq3(users.orgId, ctx.user.orgId))
    });
    if (!user) throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    await db.update(users).set({
      role: input.role,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and3(eq3(users.id, input.userId), eq3(users.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  // حذف مستخدم (تعطيل)
  delete: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
    if (input.id === ctx.user.id) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u062E\u0627\u0635" });
    }
    const user = await db.query.users.findFirst({
      where: and3(eq3(users.id, input.id), eq3(users.orgId, ctx.user.orgId))
    });
    if (!user) throw new TRPCError2({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    const hasDraftInvoices = await db.select({ id: salesInvoices.id }).from(salesInvoices).where(
      and3(
        eq3(salesInvoices.userId, input.id),
        eq3(salesInvoices.orgId, ctx.user.orgId),
        sql`${salesInvoices.status} = 'draft'`
      )
    ).limit(1);
    if (hasDraftInvoices.length > 0) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A \u0645\u0641\u062A\u0648\u062D\u0629" });
    }
    const hasDraftVouchers = await db.select({ id: vouchers.id }).from(vouchers).where(
      and3(
        eq3(vouchers.userId, input.id),
        eq3(vouchers.orgId, ctx.user.orgId),
        sql`${vouchers.status} = 'draft'`
      )
    ).limit(1);
    if (hasDraftVouchers.length > 0) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0633\u0646\u062F\u0627\u062A \u0645\u0627\u0644\u064A\u0629 \u0645\u0641\u062A\u0648\u062D\u0629" });
    }
    const hasDraftStockVouchers = await db.select({ id: stockVouchers.id }).from(stockVouchers).where(
      and3(
        eq3(stockVouchers.userId, input.id),
        eq3(stockVouchers.orgId, ctx.user.orgId),
        sql`${stockVouchers.status} = 'draft'`
      )
    ).limit(1);
    if (hasDraftStockVouchers.length > 0) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0631\u0643\u0627\u062A \u0645\u062E\u0632\u0646\u064A\u0629 \u0645\u0641\u062A\u0648\u062D\u0629" });
    }
    await db.update(users).set({ isActive: false }).where(
      and3(eq3(users.id, input.id), eq3(users.orgId, ctx.user.orgId))
    );
    return { success: true };
  }),
  // تغيير كلمة المرور الخاصة
  changeMyPassword: protectedProcedure.input(z2.object({
    currentPassword: z2.string(),
    newPassword: z2.string().min(6)
  })).mutation(async ({ input, ctx }) => {
    const user = await db.query.users.findFirst({ where: eq3(users.id, ctx.user.id) });
    if (!user) throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const { verifyPassword: verifyPassword2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const valid = await verifyPassword2(input.currentPassword, user.passwordHash);
    if (!valid) throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    await db.update(users).set({
      passwordHash: await hashPassword(input.newPassword),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(users.id, ctx.user.id));
    return { success: true };
  })
});

// src/routers/sales.ts
import { z as z4 } from "zod";
import { eq as eq5, and as and5, desc as desc2, like, or } from "drizzle-orm";
init_db();
init_schema();

// src/routers/posting.ts
import { z as z3 } from "zod";
import { eq as eq4, and as and4, desc } from "drizzle-orm";
init_db();
init_schema();
async function buildSalesInvoiceLines(invoice, journal, orgId) {
  const accIds = [
    journal?.cashAccountId,
    journal?.creditAccountId,
    journal?.salesAccountId,
    journal?.taxAccountId,
    journal?.discountAccountId
  ].filter(Boolean);
  const accs = accIds.length ? await db.query.chartOfAccounts.findMany({
    where: (a, { inArray }) => inArray(a.id, accIds)
  }) : [];
  const accMap = new Map(accs.map((a) => [a.id, a]));
  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);
  const isCash = invoice.paymentMethod === "cash";
  const lines = [];
  const warnings = [];
  const debitAccId = isCash ? journal?.cashAccountId : journal?.creditAccountId;
  const debitAcc = debitAccId ? accMap.get(debitAccId) : null;
  if (!debitAccId) warnings.push(isCash ? "\u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631" : "\u062D\u0633\u0627\u0628 \u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
  lines.push({
    accountId: debitAccId ?? null,
    accountCode: debitAcc?.code ?? "---",
    accountName: debitAcc?.name ?? (isCash ? "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 / \u0627\u0644\u0646\u0642\u062F" : "\u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621"),
    debit: total.toFixed(4),
    credit: "0.0000",
    description: `\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A ${invoice.invoiceNumber}`
  });
  const salesAccId = journal?.salesAccountId;
  const salesAcc = salesAccId ? accMap.get(salesAccId) : null;
  if (!salesAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
  lines.push({
    accountId: salesAccId ?? null,
    accountCode: salesAcc?.code ?? "---",
    accountName: salesAcc?.name ?? "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
    debit: "0.0000",
    credit: subtotal.toFixed(4),
    description: `\u0645\u0628\u064A\u0639\u0627\u062A - ${invoice.invoiceNumber}`
  });
  if (discountAmount > 0) {
    const discAccId = journal?.discountAccountId;
    const discAcc = discAccId ? accMap.get(discAccId) : null;
    if (!discAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u062E\u0635\u0645 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
    lines.push({
      accountId: discAccId ?? null,
      accountCode: discAcc?.code ?? "---",
      accountName: discAcc?.name ?? "\u062E\u0635\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
      debit: discountAmount.toFixed(4),
      credit: "0.0000",
      description: `\u062E\u0635\u0645 - ${invoice.invoiceNumber}`
    });
  }
  if (taxAmount > 0) {
    const taxAccId = journal?.taxAccountId;
    const taxAcc = taxAccId ? accMap.get(taxAccId) : null;
    if (!taxAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
    lines.push({
      accountId: taxAccId ?? null,
      accountCode: taxAcc?.code ?? "---",
      accountName: taxAcc?.name ?? "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629",
      debit: "0.0000",
      credit: taxAmount.toFixed(4),
      description: `\u0636\u0631\u064A\u0628\u0629 - ${invoice.invoiceNumber}`
    });
  }
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1e-3;
  return { lines, warnings, totalDebit: totalDebit.toFixed(4), totalCredit: totalCredit.toFixed(4), isBalanced };
}
var postingRouter = router({
  // ── معاينة القيد قبل الترحيل ─────────────────────────────────────────────
  previewSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.salesInvoices.findFirst({
      where: and4(eq4(salesInvoices.id, input.invoiceId), eq4(salesInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and4(eq4(documentJournals.id, invoice.journalId), eq4(documentJournals.orgId, orgId))
    }) : null;
    const { lines, warnings, totalDebit, totalCredit, isBalanced } = await buildSalesInvoiceLines(invoice, journal ?? null, orgId);
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: invoice.customerName,
      total: invoice.total,
      paymentMethod: invoice.paymentMethod,
      journalName: journal?.name ?? null,
      lines,
      warnings,
      totalDebit,
      totalCredit,
      isBalanced,
      canPost: !invoice.isPosted,
      isPosted: invoice.isPosted
    };
  }),
  // ── ترحيل فاتورة مبيعات ─────────────────────────────────────────────────
  postSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.salesInvoices.findFirst({
      where: and4(eq4(salesInvoices.id, input.invoiceId), eq4(salesInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (invoice.isPosted) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062D\u064E\u0651\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and4(eq4(documentJournals.id, invoice.journalId), eq4(documentJournals.orgId, orgId))
    }) : null;
    if (journal?.postingMode === "disabled") {
      throw new Error("\u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0645\u0639\u0637\u064E\u0651\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0641\u062A\u0631");
    }
    const { lines, isBalanced } = await buildSalesInvoiceLines(invoice, journal ?? null, orgId);
    const lastEntry = await db.query.journalEntries.findFirst({
      where: eq4(journalEntries.orgId, orgId),
      orderBy: [desc(journalEntries.id)]
    });
    const nextNum = lastEntry ? parseInt(lastEntry.entryNumber.replace(/\D/g, "") || "0") + 1 : 1;
    const entryNumber = `JE-${String(nextNum).padStart(4, "0")}`;
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    const [entry] = await db.insert(journalEntries).values({
      orgId,
      entryNumber,
      entryDate: invoice.invoiceDate,
      description: `\u062A\u0631\u062D\u064A\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
      status: "posted",
      userId: ctx.user.id,
      sourceDocType: "sales_invoice",
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      entryType: "auto"
    }).returning();
    if (lines.length > 0) {
      await db.insert(journalEntryLines).values(
        lines.map((l, i) => ({
          entryId: entry.id,
          orgId,
          accountId: l.accountId ?? void 0,
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          sortOrder: i
        }))
      );
    }
    await db.update(salesInvoices).set({
      isPosted: true,
      postedAt: /* @__PURE__ */ new Date(),
      postedJournalEntryId: entry.id,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and4(eq4(salesInvoices.id, input.invoiceId), eq4(salesInvoices.orgId, orgId)));
    return { success: true, journalEntryId: entry.id, entryNumber };
  }),
  // ── إلغاء ترحيل فاتورة مبيعات ────────────────────────────────────────────
  unpostSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.salesInvoices.findFirst({
      where: and4(eq4(salesInvoices.id, input.invoiceId), eq4(salesInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (!invoice.isPosted) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u064A\u0633\u062A \u0645\u0631\u062D\u064E\u0651\u0644\u0629");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and4(eq4(documentJournals.id, invoice.journalId), eq4(documentJournals.orgId, orgId))
    }) : null;
    if (journal && !journal.allowUnpost) {
      throw new Error("\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D \u0628\u0647 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062F\u0641\u062A\u0631");
    }
    if (invoice.postedJournalEntryId) {
      await db.delete(journalEntryLines).where(eq4(journalEntryLines.entryId, invoice.postedJournalEntryId));
      await db.delete(journalEntries).where(and4(
        eq4(journalEntries.id, invoice.postedJournalEntryId),
        eq4(journalEntries.orgId, orgId)
      ));
    }
    await db.update(salesInvoices).set({ isPosted: false, postedAt: null, postedJournalEntryId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(salesInvoices.id, input.invoiceId), eq4(salesInvoices.orgId, orgId)));
    return { success: true };
  }),
  // ── جلب إعدادات الترحيل لجميع الدفاتر ──────────────────────────────────
  listJournalSettings: protectedProcedure.query(async ({ ctx }) => {
    const journals = await db.query.documentJournals.findMany({
      where: eq4(documentJournals.orgId, ctx.user.orgId),
      orderBy: [documentJournals.docType, documentJournals.sortOrder]
    });
    return journals.map((j) => ({
      id: j.id,
      name: j.name,
      code: j.code,
      docType: j.docType,
      postingMode: j.postingMode ?? "manual",
      allowUnpost: j.allowUnpost ?? true,
      allowEditAfterPost: j.allowEditAfterPost ?? false
    }));
  }),
  // ── تحديث إعدادات الترحيل لدفتر ─────────────────────────────────────────
  updateJournalSettings: protectedProcedure.input(z3.object({
    journalId: z3.number(),
    postingMode: z3.enum(["auto", "manual", "disabled"]),
    allowUnpost: z3.boolean(),
    allowEditAfterPost: z3.boolean()
  })).mutation(async ({ ctx, input }) => {
    await db.update(documentJournals).set({
      postingMode: input.postingMode,
      allowUnpost: input.allowUnpost,
      allowEditAfterPost: input.allowEditAfterPost,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and4(
      eq4(documentJournals.id, input.journalId),
      eq4(documentJournals.orgId, ctx.user.orgId)
    ));
    return { success: true };
  }),
  // ── جلب فاتورة بالـ ID (للقراءة بعد الحفظ) ──────────────────────────────
  getSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).query(async ({ ctx, input }) => {
    return db.query.salesInvoices.findFirst({
      where: and4(eq4(salesInvoices.id, input.invoiceId), eq4(salesInvoices.orgId, ctx.user.orgId))
    });
  })
});

// src/routers/sales.ts
var salesRouter = router({
  // قائمة الفواتير/عروض الأسعار
  list: protectedProcedure.input(z4.object({
    page: z4.number().default(1),
    limit: z4.number().default(200),
    search: z4.string().optional(),
    status: z4.string().optional(),
    invoiceType: z4.enum(["sale", "return", "quote"]).optional(),
    dateFrom: z4.string().optional(),
    // YYYY-MM-DD
    dateTo: z4.string().optional(),
    // YYYY-MM-DD
    warehouseId: z4.number().optional(),
    // فلتر المخزن
    customerSearch: z4.string().optional(),
    // بحث باسم/كود العميل
    excludeReturns: z4.boolean().optional(),
    // استثناء المردودات
    numberPrefix: z4.string().optional()
    // فلتر دفتر المستند (بادئة الرقم)
  }).optional()).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const allRecords = await db.query.salesInvoices.findMany({
      where: eq5(salesInvoices.orgId, orgId),
      orderBy: [desc2(salesInvoices.invoiceDate)]
    });
    let filtered = allRecords;
    if (input?.invoiceType) {
      filtered = filtered.filter((r) => r.invoiceType === input.invoiceType);
    }
    if (input?.excludeReturns) {
      filtered = filtered.filter((r) => r.invoiceType !== "return");
    }
    if (input?.status) {
      filtered = filtered.filter((r) => r.status === input.status);
    }
    if (input?.warehouseId) {
      filtered = filtered.filter((r) => r.warehouseId === input.warehouseId);
    }
    if (input?.search) {
      const q = input.search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.invoiceNumber?.toLowerCase().includes(q) || r.customerName?.toLowerCase().includes(q)
      );
    }
    if (input?.customerSearch) {
      const q = input.customerSearch.toLowerCase();
      filtered = filtered.filter(
        (r) => r.customerName?.toLowerCase().includes(q)
      );
    }
    if (input?.dateFrom) {
      const from = new Date(input.dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r) => new Date(r.invoiceDate) >= from);
    }
    if (input?.dateTo) {
      const to = new Date(input.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.invoiceDate) <= to);
    }
    if (input?.numberPrefix) {
      const pfx = input.numberPrefix.toLowerCase();
      filtered = filtered.filter((r) => r.invoiceNumber?.toLowerCase().startsWith(pfx));
    }
    const limit = input?.limit || 200;
    const page = input?.page || 1;
    return filtered.slice((page - 1) * limit, page * limit);
  }),
  // رقم المستند التالي — تنسيق: INV-YYYY-XXXXXX
  nextNumber: protectedProcedure.input(z4.object({ prefix: z4.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const prefix = input?.prefix || "INV";
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const yearPrefix = `${prefix}-${year}-`;
    const last = await db.query.salesInvoices.findFirst({
      where: eq5(salesInvoices.orgId, ctx.user.orgId),
      orderBy: [desc2(salesInvoices.id)]
    });
    if (!last) return `${yearPrefix}000001`;
    const match = last.invoiceNumber.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`));
    if (match && parseInt(match[1]) === year) {
      const num = parseInt(match[2]) + 1;
      return `${yearPrefix}${String(num).padStart(6, "0")}`;
    }
    return `${yearPrefix}000001`;
  }),
  // تفاصيل مستند
  get: protectedProcedure.input(z4.object({ id: z4.number() })).query(async ({ ctx, input }) => {
    const invoice = await db.query.salesInvoices.findFirst({
      where: and5(eq5(salesInvoices.id, input.id), eq5(salesInvoices.orgId, ctx.user.orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const items = await db.query.salesInvoiceItems.findMany({
      where: eq5(salesInvoiceItems.invoiceId, input.id),
      orderBy: (i, { asc: asc5 }) => [asc5(i.sortOrder)]
    });
    return { ...invoice, items };
  }),
  // إنشاء فاتورة/عرض سعر
  create: protectedProcedure.input(z4.object({
    invoiceNumber: z4.string(),
    invoiceType: z4.enum(["sale", "return", "quote", "order"]).default("sale"),
    invoiceDate: z4.string(),
    dueDate: z4.string().optional(),
    customerId: z4.number().optional(),
    customerName: z4.string().optional(),
    warehouseId: z4.number().optional(),
    journalId: z4.number().optional(),
    currency: z4.string().default("SAR"),
    exchangeRate: z4.string().default("1"),
    subtotal: z4.string().default("0"),
    discountPercent: z4.string().default("0"),
    discountAmount: z4.string().default("0"),
    taxAmount: z4.string().default("0"),
    total: z4.string().default("0"),
    paidAmount: z4.string().default("0"),
    remainingAmount: z4.string().default("0"),
    paymentMethod: z4.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
    status: z4.enum(["draft", "confirmed", "cancelled", "paid"]).default("confirmed"),
    notes: z4.string().optional(),
    items: z4.array(z4.object({
      productId: z4.number().optional(),
      productCode: z4.string().optional(),
      productName: z4.string(),
      unit: z4.string().optional(),
      quantity: z4.string(),
      unitPrice: z4.string(),
      discountPercent: z4.string().default("0"),
      discountAmount: z4.string().default("0"),
      taxPercent: z4.string().default("0"),
      taxAmount: z4.string().default("0"),
      total: z4.string(),
      sortOrder: z4.number().optional()
    }))
  })).mutation(async ({ ctx, input }) => {
    const { items, dueDate, ...invoiceData } = input;
    const orgId = ctx.user.orgId;
    const [invoice] = await db.insert(salesInvoices).values({
      ...invoiceData,
      orgId,
      userId: ctx.user.id,
      invoiceDate: new Date(invoiceData.invoiceDate),
      ...dueDate ? { dueDate: new Date(dueDate) } : {}
    }).returning();
    if (items.length > 0) {
      await db.insert(salesInvoiceItems).values(
        items.map((item, idx) => ({
          ...item,
          invoiceId: invoice.id,
          orgId,
          sortOrder: item.sortOrder ?? idx
        }))
      );
    }
    if (input.paymentMethod === "cash" && input.journalId && invoice.invoiceType === "sale") {
      const journal = await db.query.documentJournals.findFirst({
        where: and5(eq5(documentJournals.id, input.journalId), eq5(documentJournals.orgId, orgId))
      });
      if (journal && journal.postingMode !== "disabled") {
        const { lines } = await buildSalesInvoiceLines(invoice, journal, orgId);
        if (lines.length > 0 && lines.some((l) => l.accountId !== null)) {
          const lastEntry = await db.query.journalEntries.findFirst({
            where: eq5(journalEntries.orgId, orgId),
            orderBy: [desc2(journalEntries.id)]
          });
          const nextNum = lastEntry ? parseInt(lastEntry.entryNumber.replace(/\D/g, "") || "0") + 1 : 1;
          const entryNumber = `JE-${String(nextNum).padStart(4, "0")}`;
          const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
          const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
          const [entry] = await db.insert(journalEntries).values({
            orgId,
            entryNumber,
            entryDate: invoice.invoiceDate,
            description: `\u062A\u0631\u062D\u064A\u0644 \u062A\u0644\u0642\u0627\u0626\u064A - \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A ${invoice.invoiceNumber}`,
            reference: invoice.invoiceNumber,
            totalDebit: totalDebit.toFixed(4),
            totalCredit: totalCredit.toFixed(4),
            status: "posted",
            userId: ctx.user.id,
            sourceDocType: "sales_invoice",
            sourceDocId: invoice.id,
            sourceDocNumber: invoice.invoiceNumber,
            entryType: "auto"
          }).returning();
          await db.insert(journalEntryLines).values(
            lines.map((l, i) => ({
              entryId: entry.id,
              orgId,
              accountId: l.accountId ?? void 0,
              accountCode: l.accountCode,
              accountName: l.accountName,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              sortOrder: i
            }))
          );
          const [updated] = await db.update(salesInvoices).set({ isPosted: true, postedAt: /* @__PURE__ */ new Date(), postedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(salesInvoices.id, invoice.id), eq5(salesInvoices.orgId, orgId))).returning();
          return { ...updated, autoPostedEntryNumber: entryNumber };
        }
      }
    }
    return invoice;
  }),
  // تعديل مستند
  update: protectedProcedure.input(z4.object({
    id: z4.number(),
    invoiceDate: z4.string().optional(),
    customerId: z4.number().optional(),
    customerName: z4.string().optional(),
    subtotal: z4.string().optional(),
    discountAmount: z4.string().optional(),
    taxAmount: z4.string().optional(),
    total: z4.string().optional(),
    paidAmount: z4.string().optional(),
    remainingAmount: z4.string().optional(),
    status: z4.enum(["draft", "confirmed", "cancelled", "paid"]).optional(),
    notes: z4.string().optional(),
    items: z4.array(z4.object({
      productId: z4.number().optional(),
      productCode: z4.string().optional(),
      productName: z4.string(),
      unit: z4.string().optional(),
      quantity: z4.string(),
      unitPrice: z4.string(),
      discountPercent: z4.string().default("0"),
      discountAmount: z4.string().default("0"),
      taxPercent: z4.string().default("0"),
      taxAmount: z4.string().default("0"),
      total: z4.string(),
      sortOrder: z4.number().optional()
    })).optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, items, invoiceDate, ...rest } = input;
    await db.update(salesInvoices).set({
      ...rest,
      ...invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and5(eq5(salesInvoices.id, id), eq5(salesInvoices.orgId, ctx.user.orgId)));
    if (items) {
      await db.delete(salesInvoiceItems).where(eq5(salesInvoiceItems.invoiceId, id));
      if (items.length > 0) {
        await db.insert(salesInvoiceItems).values(
          items.map((item, idx) => ({
            ...item,
            invoiceId: id,
            orgId: ctx.user.orgId,
            sortOrder: item.sortOrder ?? idx
          }))
        );
      }
    }
    return { success: true };
  }),
  // بحث عن مستند مصدر (بناءً على)
  getByNumber: protectedProcedure.input(z4.object({
    type: z4.enum(["sale", "quote", "order", "transfer"]),
    number: z4.string().min(1)
  })).query(async ({ ctx, input }) => {
    if (input.type === "transfer") {
      const voucher = await db.query.stockVouchers.findFirst({
        where: and5(
          eq5(stockVouchers.orgId, ctx.user.orgId),
          eq5(stockVouchers.voucherNumber, input.number),
          eq5(stockVouchers.type, "transfer")
        )
      });
      if (!voucher) return null;
      const items2 = await db.query.stockVoucherItems.findMany({
        where: eq5(stockVoucherItems.voucherId, voucher.id),
        orderBy: (i, { asc: asc5 }) => [asc5(i.sortOrder)]
      });
      return {
        sourceType: "transfer",
        number: voucher.voucherNumber,
        customerId: null,
        customerName: null,
        warehouseId: voucher.warehouseId,
        currency: "SAR",
        notes: voucher.notes,
        items: items2.map((i) => ({
          productId: i.productId,
          productCode: "",
          productName: i.productName,
          unit: "",
          quantity: i.quantity,
          unitPrice: i.unitCost ?? "0",
          discountPct: "0",
          discountAmt: "0",
          taxPct: "0",
          taxAmt: "0",
          total: i.totalCost ?? "0"
        }))
      };
    }
    const invoice = await db.query.salesInvoices.findFirst({
      where: and5(
        eq5(salesInvoices.orgId, ctx.user.orgId),
        eq5(salesInvoices.invoiceNumber, input.number)
      )
    });
    if (!invoice) return null;
    const items = await db.query.salesInvoiceItems.findMany({
      where: eq5(salesInvoiceItems.invoiceId, invoice.id),
      orderBy: (i, { asc: asc5 }) => [asc5(i.sortOrder)]
    });
    return {
      sourceType: input.type,
      number: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      warehouseId: invoice.warehouseId,
      currency: invoice.currency ?? "SAR",
      notes: invoice.notes,
      items: items.map((i) => ({
        productId: i.productId,
        productCode: i.productCode ?? "",
        productName: i.productName,
        unit: i.unit ?? "",
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPct: i.discountPercent ?? "0",
        discountAmt: i.discountAmount ?? "0",
        taxPct: i.taxPercent ?? "0",
        taxAmt: i.taxAmount ?? "0",
        total: i.total
      }))
    };
  }),
  // حذف مستند
  delete: protectedProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ ctx, input }) => {
    await db.delete(salesInvoiceItems).where(eq5(salesInvoiceItems.invoiceId, input.id));
    await db.delete(salesInvoices).where(
      and5(eq5(salesInvoices.id, input.id), eq5(salesInvoices.orgId, ctx.user.orgId))
    );
    return { success: true };
  }),
  // بحث عن عملاء
  searchCustomers: protectedProcedure.input(z4.object({ q: z4.string() })).query(async ({ ctx, input }) => {
    return db.query.customers.findMany({
      where: and5(
        eq5(customers.orgId, ctx.user.orgId),
        eq5(customers.isActive, true),
        or(
          like(customers.name, `%${input.q}%`),
          like(customers.code, `%${input.q}%`)
        )
      ),
      limit: 10
    });
  }),
  // بحث عن أصناف
  searchProducts: protectedProcedure.input(z4.object({ q: z4.string() })).query(async ({ ctx, input }) => {
    return db.query.products.findMany({
      where: and5(
        eq5(products.orgId, ctx.user.orgId),
        eq5(products.isActive, true),
        or(
          like(products.name, `%${input.q}%`),
          like(products.code, `%${input.q}%`)
        )
      ),
      limit: 20
    });
  })
});

// src/routers/purchases.ts
import { z as z5 } from "zod";
import { eq as eq6, and as and6, desc as desc3 } from "drizzle-orm";
init_db();
init_schema();
var purchasesRouter = router({
  // قائمة فواتير المشتريات
  list: protectedProcedure.input(z5.object({
    page: z5.number().default(1),
    limit: z5.number().default(200),
    search: z5.string().optional(),
    invoiceType: z5.string().optional(),
    dateFrom: z5.string().optional(),
    dateTo: z5.string().optional(),
    warehouseId: z5.number().optional(),
    numberPrefix: z5.string().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const allRecords = await db.query.purchaseInvoices.findMany({
      where: eq6(purchaseInvoices.orgId, orgId),
      orderBy: [desc3(purchaseInvoices.invoiceDate)]
    });
    let filtered = allRecords;
    if (input?.invoiceType) filtered = filtered.filter((r) => r.invoiceType === input.invoiceType);
    if (input?.warehouseId) filtered = filtered.filter((r) => r.warehouseId === input.warehouseId);
    if (input?.search) {
      const q = input.search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.invoiceNumber?.toLowerCase().includes(q) || r.supplierName?.toLowerCase().includes(q)
      );
    }
    if (input?.dateFrom) {
      const from = new Date(input.dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r) => new Date(r.invoiceDate) >= from);
    }
    if (input?.dateTo) {
      const to = new Date(input.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.invoiceDate) <= to);
    }
    if (input?.numberPrefix) {
      const pfx = input.numberPrefix.toLowerCase();
      filtered = filtered.filter((r) => r.invoiceNumber?.toLowerCase().startsWith(pfx));
    }
    const limit = input?.limit || 200;
    const page = input?.page || 1;
    return filtered.slice((page - 1) * limit, page * limit);
  }),
  // الرقم التالي للمستند
  nextNumber: protectedProcedure.input(z5.object({ prefix: z5.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const prefix = input?.prefix || "PUR";
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const yearPrefix = `${prefix}-${year}-`;
    const last = await db.query.purchaseInvoices.findFirst({
      where: eq6(purchaseInvoices.orgId, ctx.user.orgId),
      orderBy: [desc3(purchaseInvoices.id)]
    });
    if (!last) return `${yearPrefix}000001`;
    const match = last.invoiceNumber.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`));
    if (match && parseInt(match[1]) === year) {
      const num = parseInt(match[2]) + 1;
      return `${yearPrefix}${String(num).padStart(6, "0")}`;
    }
    return `${yearPrefix}000001`;
  }),
  // تفاصيل مستند
  get: protectedProcedure.input(z5.object({ id: z5.number() })).query(async ({ ctx, input }) => {
    const invoice = await db.query.purchaseInvoices.findFirst({
      where: and6(eq6(purchaseInvoices.id, input.id), eq6(purchaseInvoices.orgId, ctx.user.orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const items = await db.query.purchaseInvoiceItems.findMany({
      where: eq6(purchaseInvoiceItems.invoiceId, input.id),
      orderBy: (i, { asc: asc5 }) => [asc5(i.sortOrder)]
    });
    return { ...invoice, items };
  }),
  // إنشاء مستند مشتريات
  create: protectedProcedure.input(z5.object({
    invoiceNumber: z5.string(),
    invoiceType: z5.string().default("invoice"),
    invoiceDate: z5.string(),
    dueDate: z5.string().optional(),
    supplierId: z5.number().optional(),
    supplierName: z5.string().optional(),
    supplierInvoiceNumber: z5.string().optional(),
    warehouseId: z5.number().optional(),
    journalId: z5.number().optional(),
    currency: z5.string().default("SAR"),
    exchangeRate: z5.string().default("1"),
    subtotal: z5.string().default("0"),
    discountPercent: z5.string().default("0"),
    discountAmount: z5.string().default("0"),
    taxAmount: z5.string().default("0"),
    total: z5.string().default("0"),
    paidAmount: z5.string().default("0"),
    remainingAmount: z5.string().default("0"),
    paymentMethod: z5.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
    status: z5.enum(["draft", "confirmed", "cancelled", "paid"]).default("confirmed"),
    notes: z5.string().optional(),
    items: z5.array(z5.object({
      productId: z5.number().optional(),
      productCode: z5.string().optional(),
      productName: z5.string(),
      unit: z5.string().optional(),
      quantity: z5.string(),
      unitPrice: z5.string(),
      discountPercent: z5.string().default("0"),
      discountAmount: z5.string().default("0"),
      taxPercent: z5.string().default("0"),
      taxAmount: z5.string().default("0"),
      total: z5.string(),
      sortOrder: z5.number().optional()
    }))
  })).mutation(async ({ ctx, input }) => {
    const { items, dueDate, ...invoiceData } = input;
    const orgId = ctx.user.orgId;
    const [invoice] = await db.insert(purchaseInvoices).values({
      ...invoiceData,
      orgId,
      userId: ctx.user.id,
      invoiceDate: new Date(invoiceData.invoiceDate),
      ...dueDate ? { dueDate: new Date(dueDate) } : {}
    }).returning();
    if (items.length > 0) {
      await db.insert(purchaseInvoiceItems).values(
        items.map((item, idx) => ({
          ...item,
          invoiceId: invoice.id,
          orgId,
          sortOrder: item.sortOrder ?? idx
        }))
      );
    }
    return invoice;
  }),
  // تعديل مستند
  update: protectedProcedure.input(z5.object({
    id: z5.number(),
    invoiceDate: z5.string().optional(),
    supplierId: z5.number().optional(),
    supplierName: z5.string().optional(),
    subtotal: z5.string().optional(),
    discountAmount: z5.string().optional(),
    taxAmount: z5.string().optional(),
    total: z5.string().optional(),
    paidAmount: z5.string().optional(),
    remainingAmount: z5.string().optional(),
    status: z5.enum(["draft", "confirmed", "cancelled", "paid"]).optional(),
    notes: z5.string().optional(),
    items: z5.array(z5.object({
      productId: z5.number().optional(),
      productCode: z5.string().optional(),
      productName: z5.string(),
      unit: z5.string().optional(),
      quantity: z5.string(),
      unitPrice: z5.string(),
      discountPercent: z5.string().default("0"),
      discountAmount: z5.string().default("0"),
      taxPercent: z5.string().default("0"),
      taxAmount: z5.string().default("0"),
      total: z5.string(),
      sortOrder: z5.number().optional()
    })).optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, items, invoiceDate, ...rest } = input;
    await db.update(purchaseInvoices).set({
      ...rest,
      ...invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and6(eq6(purchaseInvoices.id, id), eq6(purchaseInvoices.orgId, ctx.user.orgId)));
    if (items) {
      await db.delete(purchaseInvoiceItems).where(eq6(purchaseInvoiceItems.invoiceId, id));
      if (items.length > 0) {
        await db.insert(purchaseInvoiceItems).values(
          items.map((item, idx) => ({
            ...item,
            invoiceId: id,
            orgId: ctx.user.orgId,
            sortOrder: item.sortOrder ?? idx
          }))
        );
      }
    }
    return { success: true };
  }),
  // حذف مستند
  delete: protectedProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
    await db.delete(purchaseInvoices).where(
      and6(eq6(purchaseInvoices.id, input.id), eq6(purchaseInvoices.orgId, ctx.user.orgId))
    );
    return { success: true };
  })
});

// src/routers/chat.ts
import { z as z6 } from "zod";
import { eq as eq7, and as and7, or as or2, desc as desc4, sql as sql2 } from "drizzle-orm";
init_db();
init_schema();
var chatRouter = router({
  // قائمة المستخدمين للمحادثة
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    return db.query.users.findMany({
      where: and7(
        eq7(users.orgId, ctx.user.orgId),
        eq7(users.isActive, true)
      ),
      columns: { passwordHash: false, orgId: false },
      orderBy: (u, { asc: asc5 }) => [asc5(u.name)]
    });
  }),
  // رسائل المحادثة بين مستخدمين
  getConversation: protectedProcedure.input(z6.object({ withUserId: z6.number(), limit: z6.number().default(50) })).query(async ({ ctx, input }) => {
    const msgs = await db.query.messages.findMany({
      where: and7(
        eq7(messages.orgId, ctx.user.orgId),
        or2(
          and7(eq7(messages.senderId, ctx.user.id), eq7(messages.receiverId, input.withUserId)),
          and7(eq7(messages.senderId, input.withUserId), eq7(messages.receiverId, ctx.user.id))
        )
      ),
      orderBy: [desc4(messages.createdAt)],
      limit: input.limit
    });
    return msgs.reverse();
  }),
  // إرسال رسالة
  send: protectedProcedure.input(z6.object({
    receiverId: z6.number(),
    content: z6.string().min(1).max(2e3)
  })).mutation(async ({ ctx, input }) => {
    const [msg] = await db.insert(messages).values({
      orgId: ctx.user.orgId,
      senderId: ctx.user.id,
      receiverId: input.receiverId,
      content: input.content
    }).returning();
    return msg;
  }),
  // تحديد الرسائل كمقروءة
  markRead: protectedProcedure.input(z6.object({ fromUserId: z6.number() })).mutation(async ({ ctx, input }) => {
    await db.update(messages).set({ isRead: true }).where(and7(
      eq7(messages.orgId, ctx.user.orgId),
      eq7(messages.receiverId, ctx.user.id),
      eq7(messages.senderId, input.fromUserId),
      eq7(messages.isRead, false)
    ));
    return { success: true };
  }),
  // عدد الرسائل غير المقروءة
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await db.select({
      senderId: messages.senderId,
      count: sql2`count(*)::int`
    }).from(messages).where(and7(
      eq7(messages.orgId, ctx.user.orgId),
      eq7(messages.receiverId, ctx.user.id),
      eq7(messages.isRead, false)
    )).groupBy(messages.senderId);
    return result;
  }),
  // آخر الرسائل (للقائمة الجانبية)
  recentConversations: protectedProcedure.query(async ({ ctx }) => {
    const result = await db.execute(sql2`
      SELECT DISTINCT ON (other_user)
        CASE WHEN sender_id = ${ctx.user.id} THEN receiver_id ELSE sender_id END as other_user,
        id, content, sender_id, receiver_id, is_read, created_at
      FROM messages
      WHERE org_id = ${ctx.user.orgId}
        AND (sender_id = ${ctx.user.id} OR receiver_id = ${ctx.user.id})
      ORDER BY other_user, created_at DESC
    `);
    return result.rows;
  })
});

// src/routers/documentJournals.ts
import { z as z7 } from "zod";
import { eq as eq8, and as and8, asc } from "drizzle-orm";
init_db();
init_schema();
var journalInputShape = {
  docType: z7.string(),
  code: z7.string().min(1),
  name: z7.string().min(1),
  name2: z7.string().optional(),
  description: z7.string().optional(),
  numberPrefix: z7.string().default("INV"),
  firstNumber: z7.number().default(1),
  lastNumber: z7.number().default(999999),
  increment: z7.number().default(1),
  numDigits: z7.number().default(6),
  includeYear: z7.boolean().default(false),
  warehouseId: z7.number().nullable().optional(),
  branchId: z7.number().nullable().optional(),
  salesAccountId: z7.number().nullable().optional(),
  cashAccountId: z7.number().nullable().optional(),
  creditAccountId: z7.number().nullable().optional(),
  taxAccountId: z7.number().nullable().optional(),
  discountAccountId: z7.number().nullable().optional(),
  defaultCurrency: z7.string().default("SAR"),
  defaultPayMethod: z7.string().default("cash"),
  allowedUserGroup: z7.string().nullable().optional(),
  allowedUserId: z7.number().nullable().optional(),
  printTemplate: z7.string().nullable().optional(),
  printTemplate2: z7.string().nullable().optional(),
  resetFrequency: z7.string().default("none"),
  autoSerial: z7.boolean().default(false),
  printOnSave: z7.boolean().default(false),
  notes: z7.string().optional(),
  sortOrder: z7.number().default(0)
};
var documentJournalsRouter = router({
  list: protectedProcedure.input(z7.object({ docType: z7.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const rows = await db.query.documentJournals.findMany({
      where: input?.docType ? and8(eq8(documentJournals.orgId, ctx.user.orgId), eq8(documentJournals.docType, input.docType), eq8(documentJournals.isActive, true)) : and8(eq8(documentJournals.orgId, ctx.user.orgId), eq8(documentJournals.isActive, true)),
      orderBy: [asc(documentJournals.sortOrder), asc(documentJournals.id)]
    });
    return rows;
  }),
  get: protectedProcedure.input(z7.object({ id: z7.number() })).query(async ({ ctx, input }) => {
    const row = await db.query.documentJournals.findFirst({
      where: and8(eq8(documentJournals.id, input.id), eq8(documentJournals.orgId, ctx.user.orgId))
    });
    if (!row) throw new Error("\u0627\u0644\u062F\u0641\u062A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    return row;
  }),
  create: protectedProcedure.input(z7.object(journalInputShape)).mutation(async ({ ctx, input }) => {
    const [row] = await db.insert(documentJournals).values({
      ...input,
      orgId: ctx.user.orgId,
      currentSeq: 0,
      isActive: true
    }).returning();
    return row;
  }),
  update: protectedProcedure.input(z7.object({ id: z7.number(), ...Object.fromEntries(Object.entries(journalInputShape).map(([k, v]) => [k, v.optional()])) })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [row] = await db.update(documentJournals).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and8(eq8(documentJournals.id, id), eq8(documentJournals.orgId, ctx.user.orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ ctx, input }) => {
    await db.update(documentJournals).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and8(eq8(documentJournals.id, input.id), eq8(documentJournals.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  // إعادة ضبط الترقيم
  resetNumbering: protectedProcedure.input(z7.object({ journalId: z7.number() })).mutation(async ({ ctx, input }) => {
    const journal = await db.query.documentJournals.findFirst({
      where: and8(eq8(documentJournals.id, input.journalId), eq8(documentJournals.orgId, ctx.user.orgId))
    });
    if (!journal) throw new Error("\u0627\u0644\u062F\u0641\u062A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    await db.update(documentJournals).set({ currentSeq: (journal.firstNumber ?? 1) - 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(documentJournals.id, journal.id));
    return { success: true, resetTo: (journal.firstNumber ?? 1) - 1 };
  }),
  // الرقم التالي — transaction-safe
  nextNumber: protectedProcedure.input(z7.object({ journalId: z7.number() })).mutation(async ({ ctx, input }) => {
    const journal = await db.query.documentJournals.findFirst({
      where: and8(eq8(documentJournals.id, input.journalId), eq8(documentJournals.orgId, ctx.user.orgId))
    });
    if (!journal) throw new Error("\u0627\u0644\u062F\u0641\u062A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const currentSeq = journal.currentSeq ?? 0;
    const firstNumber = journal.firstNumber ?? 1;
    const increment = journal.increment ?? 1;
    const nextSeq = currentSeq === 0 ? firstNumber : Math.max(currentSeq + increment, firstNumber);
    const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);
    await db.update(documentJournals).set({ currentSeq: clamped, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(documentJournals.id, journal.id));
    const prefix = journal.numberPrefix ?? "INV";
    const digits = journal.numDigits ?? 6;
    const numPart = String(clamped).padStart(digits, "0");
    if (journal.includeYear) {
      return `${prefix}${(/* @__PURE__ */ new Date()).getFullYear()}-${numPart}`;
    }
    return `${prefix}${numPart}`;
  }),
  previewNextNumber: protectedProcedure.input(z7.object({ journalId: z7.number() })).query(async ({ ctx, input }) => {
    const journal = await db.query.documentJournals.findFirst({
      where: and8(eq8(documentJournals.id, input.journalId), eq8(documentJournals.orgId, ctx.user.orgId))
    });
    if (!journal) return null;
    const currentSeq = journal.currentSeq ?? 0;
    const firstNumber = journal.firstNumber ?? 1;
    const increment = journal.increment ?? 1;
    const nextSeq = currentSeq === 0 ? firstNumber : Math.max(currentSeq + increment, firstNumber);
    const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);
    const prefix = journal.numberPrefix ?? "INV";
    const digits = journal.numDigits ?? 6;
    const numPart = String(clamped).padStart(digits, "0");
    if (journal.includeYear) return `${prefix}${(/* @__PURE__ */ new Date()).getFullYear()}-${numPart}`;
    return `${prefix}${numPart}`;
  })
});

// src/routers/documentTemplates.ts
import { z as z8 } from "zod";
import { eq as eq9, and as and9, asc as asc2 } from "drizzle-orm";
init_db();
init_schema();
var documentTemplatesRouter = router({
  list: protectedProcedure.input(z8.object({ docType: z8.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const where = input?.docType ? and9(eq9(documentTemplates.orgId, ctx.user.orgId), eq9(documentTemplates.docType, input.docType), eq9(documentTemplates.isActive, true)) : and9(eq9(documentTemplates.orgId, ctx.user.orgId), eq9(documentTemplates.isActive, true));
    return db.query.documentTemplates.findMany({
      where,
      orderBy: [asc2(documentTemplates.sortOrder), asc2(documentTemplates.id)]
    });
  }),
  create: protectedProcedure.input(z8.object({
    code: z8.string().min(1),
    nameAr: z8.string().min(1),
    nameEn: z8.string().optional(),
    docType: z8.string().min(1),
    paperSize: z8.string().default("A4"),
    orientation: z8.string().default("portrait"),
    isDefault: z8.boolean().default(false),
    layoutJson: z8.string().nullable().optional(),
    notes: z8.string().optional(),
    sortOrder: z8.number().default(0)
  })).mutation(async ({ ctx, input }) => {
    if (input.isDefault) {
      await db.update(documentTemplates).set({ isDefault: false, updatedAt: /* @__PURE__ */ new Date() }).where(and9(eq9(documentTemplates.orgId, ctx.user.orgId), eq9(documentTemplates.docType, input.docType)));
    }
    const [row] = await db.insert(documentTemplates).values({
      ...input,
      orgId: ctx.user.orgId,
      isActive: true
    }).returning();
    return row;
  }),
  update: protectedProcedure.input(z8.object({
    id: z8.number(),
    code: z8.string().optional(),
    nameAr: z8.string().optional(),
    nameEn: z8.string().optional(),
    docType: z8.string().optional(),
    paperSize: z8.string().optional(),
    orientation: z8.string().optional(),
    isDefault: z8.boolean().optional(),
    layoutJson: z8.string().nullable().optional(),
    notes: z8.string().optional(),
    sortOrder: z8.number().optional(),
    isActive: z8.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    if (data.isDefault && data.docType) {
      await db.update(documentTemplates).set({ isDefault: false, updatedAt: /* @__PURE__ */ new Date() }).where(and9(eq9(documentTemplates.orgId, ctx.user.orgId), eq9(documentTemplates.docType, data.docType)));
    }
    const [row] = await db.update(documentTemplates).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and9(eq9(documentTemplates.id, id), eq9(documentTemplates.orgId, ctx.user.orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ ctx, input }) => {
    await db.update(documentTemplates).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and9(eq9(documentTemplates.id, input.id), eq9(documentTemplates.orgId, ctx.user.orgId)));
    return { success: true };
  })
});

// src/routers/documentTypes.ts
import { z as z9 } from "zod";
import { eq as eq10, and as and10, asc as asc3 } from "drizzle-orm";
init_db();
init_schema();
var inputShape = {
  typeId: z9.string(),
  nameAr: z9.string().min(1),
  nameEn: z9.string().optional(),
  codeEn: z9.string().optional(),
  codeAr: z9.string().optional(),
  docType: z9.string().optional(),
  userGroup: z9.string().optional(),
  user_: z9.string().optional(),
  warehouse: z9.string().optional(),
  journal: z9.string().optional(),
  systemOnly: z9.boolean().default(false),
  entryType: z9.string().optional(),
  entryJournal: z9.string().optional(),
  stockDocType: z9.string().optional(),
  stockJournal: z9.string().optional(),
  printTemplate: z9.string().optional(),
  printTemplate2: z9.string().optional(),
  trackQty: z9.boolean().default(false),
  noTax: z9.boolean().default(false),
  sellerStats: z9.boolean().default(false),
  itemStats: z9.boolean().default(false),
  customerStats: z9.boolean().default(false),
  noStockDispatch: z9.boolean().default(false),
  requireNote: z9.boolean().default(false),
  preventEditIfLinked: z9.boolean().default(false),
  requireCustomerCode: z9.boolean().default(false),
  requireEmployeeCode: z9.boolean().default(false),
  acctDebit: z9.string().optional(),
  acctCredit: z9.string().optional(),
  acctDiscount: z9.string().optional(),
  acctCash: z9.string().optional(),
  acctTax: z9.string().optional(),
  sortOrder: z9.number().default(0)
};
var documentTypesRouter = router({
  list: protectedProcedure.input(z9.object({ typeId: z9.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const rows = await db.select().from(documentTypes).where(
      input?.typeId ? and10(eq10(documentTypes.orgId, ctx.user.orgId), eq10(documentTypes.typeId, input.typeId), eq10(documentTypes.isActive, true)) : and10(eq10(documentTypes.orgId, ctx.user.orgId), eq10(documentTypes.isActive, true))
    ).orderBy(asc3(documentTypes.sortOrder), asc3(documentTypes.id));
    return rows;
  }),
  create: protectedProcedure.input(z9.object(inputShape)).mutation(async ({ ctx, input }) => {
    const [row] = await db.insert(documentTypes).values({
      ...input,
      orgId: ctx.user.orgId,
      isActive: true
    }).returning();
    return row;
  }),
  update: protectedProcedure.input(z9.object({ id: z9.number(), ...Object.fromEntries(Object.entries(inputShape).map(([k, v]) => [k, v.optional()])) })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [row] = await db.update(documentTypes).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTypes.id, id), eq10(documentTypes.orgId, ctx.user.orgId))).returning();
    if (!row) throw new Error("\u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    return row;
  }),
  delete: protectedProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ ctx, input }) => {
    await db.update(documentTypes).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTypes.id, input.id), eq10(documentTypes.orgId, ctx.user.orgId)));
    return { ok: true };
  })
});

// src/routers/index.ts
init_db();
init_schema();
import { eq as eq11, and as and11, desc as desc5, like as like2, or as or3, sql as sql3, isNotNull, isNull, asc as asc4, gte, lte } from "drizzle-orm";
var appRouter = router({
  // ─── Auth ────────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      return ctx.user ? {
        id: ctx.user.id,
        name: ctx.user.name,
        username: ctx.user.username,
        role: ctx.user.role,
        orgId: ctx.user.orgId
      } : null;
    })
  }),
  // ─── Organizations ────────────────────────────────────────────────────────────
  orgs: orgsRouter,
  // ─── Users ───────────────────────────────────────────────────────────────────
  users: usersRouter,
  // ─── User Groups ─────────────────────────────────────────────────────────────
  userGroups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.select().from(userGroups).where(and11(eq11(userGroups.orgId, ctx.user.orgId), eq11(userGroups.isActive, true))).orderBy(userGroups.name);
    }),
    create: protectedProcedure.input(z10.object({ code: z10.string().optional(), name: z10.string().min(1), description: z10.string().optional() })).mutation(async ({ input, ctx }) => {
      const [g] = await db.insert(userGroups).values({
        orgId: ctx.user.orgId,
        code: input.code,
        name: input.name,
        description: input.description
      }).returning();
      return g;
    }),
    update: protectedProcedure.input(z10.object({ id: z10.number(), code: z10.string().optional(), name: z10.string().optional(), description: z10.string().optional() })).mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      await db.update(userGroups).set(rest).where(and11(eq11(userGroups.id, id), eq11(userGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input, ctx }) => {
      await db.update(userGroups).set({ isActive: false }).where(and11(eq11(userGroups.id, input.id), eq11(userGroups.orgId, ctx.user.orgId)));
      return { success: true };
    })
  }),
  // ─── User Categories ─────────────────────────────────────────────────────────
  userCategories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.select().from(userCategories).where(and11(eq11(userCategories.orgId, ctx.user.orgId), eq11(userCategories.isActive, true))).orderBy(userCategories.name);
    }),
    create: protectedProcedure.input(z10.object({
      code: z10.string().optional(),
      name: z10.string().min(1),
      autoNumbering: z10.boolean().optional(),
      firstNumber: z10.number().optional(),
      lastNumber: z10.number().optional(),
      increment: z10.number().optional(),
      codeDigits: z10.number().optional()
    })).mutation(async ({ input, ctx }) => {
      if (input.code) {
        const dup = await db.select({ id: userCategories.id }).from(userCategories).where(and11(eq11(userCategories.orgId, ctx.user.orgId), eq11(userCategories.code, input.code), eq11(userCategories.isActive, true))).limit(1);
        if (dup.length) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0648\u062F \u0645\u0643\u0631\u0631 \u2014 \u064A\u0648\u062C\u062F \u0641\u0626\u0629 \u0628\u0646\u0641\u0633 \u0627\u0644\u0643\u0648\u062F" });
      }
      const [c] = await db.insert(userCategories).values({
        orgId: ctx.user.orgId,
        code: input.code,
        name: input.name,
        autoNumbering: input.autoNumbering ?? true,
        firstNumber: input.firstNumber ?? 1,
        lastNumber: input.lastNumber ?? 99999,
        increment: input.increment ?? 1,
        codeDigits: input.codeDigits ?? 5
      }).returning();
      return c;
    }),
    update: protectedProcedure.input(z10.object({
      id: z10.number(),
      code: z10.string().optional(),
      name: z10.string().optional(),
      autoNumbering: z10.boolean().optional(),
      firstNumber: z10.number().optional(),
      lastNumber: z10.number().optional(),
      increment: z10.number().optional(),
      codeDigits: z10.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      if (rest.code) {
        const dup = await db.select({ id: userCategories.id }).from(userCategories).where(and11(eq11(userCategories.orgId, ctx.user.orgId), eq11(userCategories.code, rest.code), eq11(userCategories.isActive, true))).limit(1);
        if (dup.length && dup[0].id !== id) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0648\u062F \u0645\u0643\u0631\u0631 \u2014 \u064A\u0648\u062C\u062F \u0641\u0626\u0629 \u0628\u0646\u0641\u0633 \u0627\u0644\u0643\u0648\u062F" });
      }
      await db.update(userCategories).set(rest).where(and11(eq11(userCategories.id, id), eq11(userCategories.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input, ctx }) => {
      await db.update(userCategories).set({ isActive: false }).where(and11(eq11(userCategories.id, input.id), eq11(userCategories.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    nextCode: protectedProcedure.input(z10.object({ categoryId: z10.number() })).query(async ({ input, ctx }) => {
      const cat = await db.select().from(userCategories).where(and11(eq11(userCategories.id, input.categoryId), eq11(userCategories.orgId, ctx.user.orgId))).limit(1);
      if (!cat.length || !cat[0].autoNumbering) return null;
      const c = cat[0];
      const prefix = c.code ?? "";
      const numDigits = Math.max(c.codeDigits - prefix.length, 1);
      const catUsers = await db.select({ code: users.code }).from(users).where(and11(eq11(users.orgId, ctx.user.orgId), eq11(users.categoryId, input.categoryId), eq11(users.isActive, true)));
      let maxNum = c.firstNumber - c.increment;
      for (const u of catUsers) {
        if (!u.code) continue;
        const numPart = prefix && u.code.startsWith(prefix) ? u.code.slice(prefix.length) : u.code;
        const n = parseInt(numPart, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
      const nextNum = maxNum < c.firstNumber ? c.firstNumber : maxNum + c.increment;
      if (nextNum > c.lastNumber) return null;
      const nextCode = prefix + String(nextNum).padStart(numDigits, "0");
      return { code: nextCode, category: c };
    })
  }),
  // ─── User Group Members ───────────────────────────────────────────────────────
  groupMembers: router({
    list: protectedProcedure.input(z10.object({ groupId: z10.number() })).query(async ({ input, ctx }) => {
      return db.select().from(userGroupMembers).where(and11(eq11(userGroupMembers.groupId, input.groupId), eq11(userGroupMembers.orgId, ctx.user.orgId))).orderBy(userGroupMembers.createdAt);
    }),
    add: protectedProcedure.input(z10.object({
      groupId: z10.number(),
      memberType: z10.enum(["user", "group"]),
      memberCode: z10.string().min(1),
      memberName: z10.string().optional()
    })).mutation(async ({ input, ctx }) => {
      let resolvedName = input.memberName;
      if (input.memberType === "user") {
        const found = await db.select({ id: users.id, name: users.name }).from(users).where(and11(eq11(users.orgId, ctx.user.orgId), eq11(users.code, input.memberCode))).limit(1);
        if (!found.length) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 "${input.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
        resolvedName = found[0].name;
      } else {
        const found = await db.select({ id: userGroups.id, name: userGroups.name }).from(userGroups).where(and11(eq11(userGroups.orgId, ctx.user.orgId), eq11(userGroups.code, input.memberCode), eq11(userGroups.isActive, true))).limit(1);
        if (!found.length) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 "${input.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
        resolvedName = found[0].name;
      }
      const existing = await db.select({ id: userGroupMembers.id }).from(userGroupMembers).where(and11(
        eq11(userGroupMembers.groupId, input.groupId),
        eq11(userGroupMembers.orgId, ctx.user.orgId),
        eq11(userGroupMembers.memberType, input.memberType),
        eq11(userGroupMembers.memberCode, input.memberCode)
      )).limit(1);
      if (existing.length) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0627\u0644\u0639\u0636\u0648 \u062A\u0645 \u062A\u0643\u0631\u0627\u0631 \u0628\u0627\u0644\u062C\u062F\u0648\u0644` });
      const [m] = await db.insert(userGroupMembers).values({
        groupId: input.groupId,
        orgId: ctx.user.orgId,
        memberType: input.memberType,
        memberCode: input.memberCode,
        memberName: resolvedName
      }).returning();
      return m;
    }),
    remove: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input, ctx }) => {
      await db.delete(userGroupMembers).where(and11(eq11(userGroupMembers.id, input.id), eq11(userGroupMembers.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    addBulk: protectedProcedure.input(z10.object({
      groupId: z10.number(),
      members: z10.array(z10.object({
        memberType: z10.enum(["user", "group"]),
        memberCode: z10.string().min(1),
        memberName: z10.string().optional()
      }))
    })).mutation(async ({ input, ctx }) => {
      if (!input.members.length) return { count: 0 };
      const seen = /* @__PURE__ */ new Set();
      const unique = input.members.filter((m) => {
        const key = `${m.memberType}:${m.memberCode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const existingMembers = await db.select({ memberType: userGroupMembers.memberType, memberCode: userGroupMembers.memberCode }).from(userGroupMembers).where(and11(eq11(userGroupMembers.groupId, input.groupId), eq11(userGroupMembers.orgId, ctx.user.orgId)));
      const existingSet = new Set(existingMembers.map((m) => `${m.memberType}:${m.memberCode}`));
      const toInsert = unique.filter((m) => !existingSet.has(`${m.memberType}:${m.memberCode}`));
      if (!toInsert.length) return { count: 0 };
      const resolved = await Promise.all(toInsert.map(async (m) => {
        let name = m.memberName;
        if (m.memberType === "user") {
          const found = await db.select({ name: users.name }).from(users).where(and11(eq11(users.orgId, ctx.user.orgId), eq11(users.code, m.memberCode))).limit(1);
          if (!found.length) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 "${m.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
          name = found[0].name;
        } else {
          const found = await db.select({ name: userGroups.name }).from(userGroups).where(and11(eq11(userGroups.orgId, ctx.user.orgId), eq11(userGroups.code, m.memberCode), eq11(userGroups.isActive, true))).limit(1);
          if (!found.length) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 "${m.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
          name = found[0].name;
        }
        return { groupId: input.groupId, orgId: ctx.user.orgId, memberType: m.memberType, memberCode: m.memberCode, memberName: name };
      }));
      await db.insert(userGroupMembers).values(resolved);
      return { count: resolved.length };
    })
  }),
  // ─── Sales ───────────────────────────────────────────────────────────────────
  sales: salesRouter,
  salesInvoices: salesRouter,
  purchases: purchasesRouter,
  // ─── Chat ────────────────────────────────────────────────────────────────────
  chat: chatRouter,
  documentJournals: documentJournalsRouter,
  documentTemplates: documentTemplatesRouter,
  documentTypes: documentTypesRouter,
  posting: postingRouter,
  // ─── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user.orgId;
      const now = /* @__PURE__ */ new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [todayRows, monthRows, productCountRow, pendingTransferRow] = await Promise.all([
        db.select({
          total: sql3`coalesce(sum(${salesInvoices.total}), 0)`,
          count: sql3`count(*)`
        }).from(salesInvoices).where(
          and11(
            eq11(salesInvoices.orgId, orgId),
            sql3`${salesInvoices.invoiceDate} >= ${todayStart}`,
            sql3`${salesInvoices.invoiceType} = 'sale'`,
            sql3`${salesInvoices.status} != 'cancelled'`
          )
        ),
        db.select({
          total: sql3`coalesce(sum(${salesInvoices.total}), 0)`,
          count: sql3`count(*)`
        }).from(salesInvoices).where(
          and11(
            eq11(salesInvoices.orgId, orgId),
            sql3`${salesInvoices.invoiceDate} >= ${monthStart}`,
            sql3`${salesInvoices.invoiceType} = 'sale'`,
            sql3`${salesInvoices.status} != 'cancelled'`
          )
        ),
        db.select({ count: sql3`count(*)` }).from(products).where(
          and11(eq11(products.orgId, orgId), eq11(products.isActive, true))
        ),
        db.select({ count: sql3`count(*)` }).from(stockVouchers).where(
          and11(eq11(stockVouchers.orgId, orgId), sql3`${stockVouchers.type}::text = 'transfer'`, eq11(stockVouchers.status, "draft"))
        )
      ]);
      return {
        todaySales: Number(todayRows[0]?.total ?? 0),
        todayInvoices: Number(todayRows[0]?.count ?? 0),
        monthSales: Number(monthRows[0]?.total ?? 0),
        monthInvoices: Number(monthRows[0]?.count ?? 0),
        productCount: Number(productCountRow[0]?.count ?? 0),
        pendingTransfers: Number(pendingTransferRow[0]?.count ?? 0)
      };
    }),
    salesChart: protectedProcedure.input(z10.object({ days: z10.number().default(7) })).query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const since = /* @__PURE__ */ new Date();
      since.setDate(since.getDate() - input.days);
      const rows = await db.select({
        date: sql3`date_trunc('day', ${salesInvoices.invoiceDate})::date`,
        total: sql3`coalesce(sum(${salesInvoices.total}), 0)`,
        count: sql3`count(*)`
      }).from(salesInvoices).where(
        and11(
          eq11(salesInvoices.orgId, orgId),
          sql3`${salesInvoices.invoiceDate} >= ${since}`,
          sql3`${salesInvoices.invoiceType} = 'sale'`,
          sql3`${salesInvoices.status} != 'cancelled'`
        )
      ).groupBy(sql3`date_trunc('day', ${salesInvoices.invoiceDate})::date`).orderBy(sql3`date_trunc('day', ${salesInvoices.invoiceDate})::date`);
      return rows.map((r) => ({ date: r.date, total: Number(r.total), count: Number(r.count) }));
    }),
    topProducts: protectedProcedure.input(z10.object({ limit: z10.number().default(5) })).query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const monthStart = /* @__PURE__ */ new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const rows = await db.select({
        productId: salesInvoiceItems.productId,
        productName: salesInvoiceItems.productName,
        totalQty: sql3`sum(${salesInvoiceItems.quantity})`,
        totalRevenue: sql3`sum(${salesInvoiceItems.total})`
      }).from(salesInvoiceItems).innerJoin(salesInvoices, eq11(salesInvoiceItems.invoiceId, salesInvoices.id)).where(
        and11(
          eq11(salesInvoices.orgId, orgId),
          sql3`${salesInvoices.invoiceDate} >= ${monthStart}`,
          sql3`${salesInvoices.invoiceType} = 'sale'`,
          sql3`${salesInvoices.status} != 'cancelled'`
        )
      ).groupBy(salesInvoiceItems.productId, salesInvoiceItems.productName).orderBy(desc5(sql3`sum(${salesInvoiceItems.total})`)).limit(input.limit);
      return rows.map((r) => ({
        productId: r.productId,
        productName: r.productName,
        totalQty: Number(r.totalQty),
        totalRevenue: Number(r.totalRevenue)
      }));
    })
  }),
  // ─── Products ────────────────────────────────────────────────────────────────
  products: router({
    list: protectedProcedure.input(z10.object({
      search: z10.string().optional(),
      categoryId: z10.number().optional()
    }).optional()).query(async ({ ctx, input }) => {
      const conditions = [eq11(products.orgId, ctx.user.orgId), eq11(products.isActive, true)];
      if (input?.search) {
        conditions.push(or3(
          like2(products.name, `%${input.search}%`),
          like2(products.code, `%${input.search}%`),
          like2(products.barcode, `%${input.search}%`)
        ));
      }
      if (input?.categoryId) {
        conditions.push(eq11(products.groupId, input.categoryId));
      }
      return db.query.products.findMany({
        where: and11(...conditions),
        orderBy: (p, { asc: asc5 }) => [asc5(p.name)]
      });
    }),
    search: protectedProcedure.input(z10.object({ q: z10.string() })).query(async ({ ctx, input }) => {
      return db.query.products.findMany({
        where: and11(
          eq11(products.orgId, ctx.user.orgId),
          eq11(products.isActive, true),
          or3(like2(products.name, `%${input.q}%`), like2(products.code, `%${input.q}%`))
        ),
        limit: 20
      });
    }),
    create: protectedProcedure.input(z10.object({
      name: z10.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628"),
      name2: z10.string().optional(),
      nameEn: z10.string().optional(),
      sku: z10.string().optional(),
      barcode: z10.string().optional(),
      barcode2: z10.string().optional(),
      barcode3: z10.string().optional(),
      groupId: z10.number().int().positive().optional(),
      categoryId: z10.number().int().positive().optional(),
      unit: z10.string().optional(),
      unit2: z10.string().optional(),
      unit3: z10.string().optional(),
      unitsJson: z10.string().optional(),
      catsJson: z10.string().optional(),
      salePrice: z10.string().optional(),
      salePrice2: z10.string().optional(),
      salePrice3: z10.string().optional(),
      salePrice4: z10.string().optional(),
      salePrice5: z10.string().optional(),
      wholesalePrice: z10.string().optional(),
      purchasePrice: z10.string().optional(),
      costPrice: z10.string().optional(),
      vatRate: z10.string().optional(),
      taxRate: z10.string().optional(),
      taxable: z10.boolean().optional(),
      taxType: z10.string().optional(),
      minStock: z10.number().optional(),
      maxStock: z10.number().optional(),
      reorderPoint: z10.number().optional(),
      itemType: z10.string().optional(),
      brand: z10.string().optional(),
      model: z10.string().optional(),
      description: z10.string().optional(),
      notes: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const {
        name,
        name2,
        nameEn,
        sku,
        barcode,
        barcode2,
        barcode3,
        groupId,
        categoryId,
        unit,
        unit2,
        unit3,
        unitsJson,
        catsJson,
        salePrice,
        salePrice2,
        salePrice3,
        salePrice4,
        salePrice5,
        wholesalePrice,
        purchasePrice,
        costPrice,
        vatRate,
        taxRate,
        taxable,
        taxType,
        minStock,
        maxStock,
        reorderPoint,
        itemType,
        brand,
        model,
        description,
        notes
      } = input;
      if (!name || !name.trim()) {
        throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628");
      }
      const resolvedGroupId = groupId ?? categoryId ?? void 0;
      const extraData = {};
      if (name2) extraData.name2 = name2;
      if (barcode2) extraData.barcode2 = barcode2;
      if (barcode3) extraData.barcode3 = barcode3;
      if (unit2) extraData.unit2 = unit2;
      if (unit3) extraData.unit3 = unit3;
      if (unitsJson) extraData.unitsJson = unitsJson;
      if (catsJson) extraData.catsJson = catsJson;
      if (salePrice2) extraData.salePrice2 = salePrice2;
      if (salePrice3) extraData.salePrice3 = salePrice3;
      if (salePrice4) extraData.salePrice4 = salePrice4;
      if (salePrice5) extraData.salePrice5 = salePrice5;
      if (wholesalePrice) extraData.wholesalePrice = wholesalePrice;
      if (maxStock != null) extraData.maxStock = maxStock;
      if (reorderPoint != null) extraData.reorderPoint = reorderPoint;
      if (taxable != null) extraData.taxable = taxable;
      if (taxType) extraData.taxType = taxType;
      if (itemType) extraData.itemType = itemType;
      if (brand) extraData.brand = brand;
      if (model) extraData.model = model;
      const notesStr = description ? Object.keys(extraData).length ? `${description}
---
${JSON.stringify(extraData)}` : description : Object.keys(extraData).length ? JSON.stringify(extraData) : notes ?? void 0;
      console.log("[products.create] inserting:", {
        name: name.trim(),
        code: sku || void 0,
        groupId: resolvedGroupId,
        unit: unit || "\u0642\u0637\u0639\u0629",
        salePrice: salePrice || "0"
      });
      try {
        const [p] = await db.insert(products).values({
          name: name.trim(),
          nameEn: nameEn?.trim() || name2?.trim() || void 0,
          code: sku?.trim() || void 0,
          barcode: barcode?.trim() || void 0,
          groupId: resolvedGroupId,
          unit: unit?.trim() || "\u0642\u0637\u0639\u0629",
          salePrice: salePrice || "0",
          purchasePrice: costPrice || purchasePrice || "0",
          taxRate: vatRate || taxRate || "0",
          minStock: minStock != null ? String(minStock) : "0",
          isActive: true,
          notes: notesStr,
          orgId: ctx.user.orgId
        }).returning();
        return p;
      } catch (err) {
        console.error("[products.create] DB error:", err?.message ?? err);
        throw new Error("\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0635\u0646\u0641 \u2014 \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062F\u062E\u0644\u0629");
      }
    }),
    bulkImport: protectedProcedure.input(z10.object({
      rows: z10.array(z10.object({
        name: z10.string().min(1),
        nameEn: z10.string().optional(),
        sku: z10.string().optional(),
        barcode: z10.string().optional(),
        unit: z10.string().optional(),
        salePrice: z10.string().optional(),
        purchasePrice: z10.string().optional(),
        taxRate: z10.string().optional(),
        minStock: z10.string().optional(),
        notes: z10.string().optional()
      })).min(1).max(2e3)
    })).mutation(async ({ ctx, input }) => {
      const values = input.rows.map((r) => ({
        name: r.name.trim(),
        nameEn: r.nameEn?.trim() || void 0,
        code: r.sku?.trim() || void 0,
        barcode: r.barcode?.trim() || void 0,
        unit: r.unit?.trim() || "\u0642\u0637\u0639\u0629",
        salePrice: r.salePrice || "0",
        purchasePrice: r.purchasePrice || "0",
        taxRate: r.taxRate || "0",
        minStock: r.minStock || "0",
        notes: r.notes?.trim() || void 0,
        isActive: true,
        orgId: ctx.user.orgId
      }));
      const inserted = await db.insert(products).values(values).returning({ id: products.id });
      return { count: inserted.length };
    }),
    update: protectedProcedure.input(z10.object({
      id: z10.number(),
      name: z10.string().min(1).optional(),
      name2: z10.string().optional(),
      nameEn: z10.string().optional(),
      sku: z10.string().optional(),
      barcode: z10.string().optional(),
      barcode2: z10.string().optional(),
      barcode3: z10.string().optional(),
      groupId: z10.number().optional(),
      categoryId: z10.number().optional(),
      unit: z10.string().optional(),
      unit2: z10.string().optional(),
      unit3: z10.string().optional(),
      unitsJson: z10.string().optional(),
      catsJson: z10.string().optional(),
      salePrice: z10.string().optional(),
      salePrice2: z10.string().optional(),
      salePrice3: z10.string().optional(),
      salePrice4: z10.string().optional(),
      salePrice5: z10.string().optional(),
      wholesalePrice: z10.string().optional(),
      purchasePrice: z10.string().optional(),
      costPrice: z10.string().optional(),
      vatRate: z10.string().optional(),
      taxRate: z10.string().optional(),
      taxable: z10.boolean().optional(),
      taxType: z10.string().optional(),
      minStock: z10.number().optional(),
      maxStock: z10.number().optional(),
      reorderPoint: z10.number().optional(),
      itemType: z10.string().optional(),
      brand: z10.string().optional(),
      model: z10.string().optional(),
      description: z10.string().optional(),
      isActive: z10.boolean().optional(),
      notes: z10.string().optional()
    }).passthrough()).mutation(async ({ ctx, input }) => {
      const {
        id,
        sku,
        name2,
        nameEn,
        categoryId,
        costPrice,
        vatRate,
        taxable,
        taxType,
        barcode2,
        barcode3,
        unit2,
        unit3,
        unitsJson,
        catsJson,
        salePrice2,
        salePrice3,
        salePrice4,
        salePrice5,
        wholesalePrice,
        maxStock,
        reorderPoint,
        itemType,
        brand,
        model,
        description,
        ...rest
      } = input;
      const extraData = {};
      if (name2 !== void 0) extraData.name2 = name2;
      if (barcode2 !== void 0) extraData.barcode2 = barcode2;
      if (barcode3 !== void 0) extraData.barcode3 = barcode3;
      if (unit2 !== void 0) extraData.unit2 = unit2;
      if (unit3 !== void 0) extraData.unit3 = unit3;
      if (unitsJson !== void 0) extraData.unitsJson = unitsJson;
      if (catsJson !== void 0) extraData.catsJson = catsJson;
      if (salePrice2 !== void 0) extraData.salePrice2 = salePrice2;
      if (salePrice3 !== void 0) extraData.salePrice3 = salePrice3;
      if (salePrice4 !== void 0) extraData.salePrice4 = salePrice4;
      if (salePrice5 !== void 0) extraData.salePrice5 = salePrice5;
      if (wholesalePrice !== void 0) extraData.wholesalePrice = wholesalePrice;
      if (maxStock !== void 0) extraData.maxStock = maxStock;
      if (reorderPoint !== void 0) extraData.reorderPoint = reorderPoint;
      if (taxable !== void 0) extraData.taxable = taxable;
      if (taxType !== void 0) extraData.taxType = taxType;
      if (itemType !== void 0) extraData.itemType = itemType;
      if (brand !== void 0) extraData.brand = brand;
      if (model !== void 0) extraData.model = model;
      const notesStr = description ? Object.keys(extraData).length ? `${description}
---
${JSON.stringify(extraData)}` : description : Object.keys(extraData).length ? JSON.stringify(extraData) : rest.notes;
      const updateData = {};
      if (rest.name !== void 0) updateData.name = rest.name;
      if (nameEn !== void 0 || name2 !== void 0) updateData.nameEn = nameEn || name2;
      if (sku !== void 0 || rest.code !== void 0) updateData.code = sku || rest.code;
      if (rest.barcode !== void 0) updateData.barcode = rest.barcode;
      if (rest.groupId !== void 0 || categoryId !== void 0) updateData.groupId = rest.groupId || categoryId;
      if (rest.unit !== void 0) updateData.unit = rest.unit;
      if (rest.salePrice !== void 0) updateData.salePrice = rest.salePrice;
      if (costPrice !== void 0 || rest.purchasePrice !== void 0) updateData.purchasePrice = costPrice || rest.purchasePrice;
      if (vatRate !== void 0 || rest.taxRate !== void 0) updateData.taxRate = vatRate || rest.taxRate;
      if (rest.minStock !== void 0) updateData.minStock = String(rest.minStock);
      if (rest.isActive !== void 0) updateData.isActive = rest.isActive;
      if (notesStr !== void 0) updateData.notes = notesStr;
      await db.update(products).set(updateData).where(and11(eq11(products.id, id), eq11(products.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      await db.update(products).set({ isActive: false }).where(and11(eq11(products.id, input.id), eq11(products.orgId, ctx.user.orgId)));
      return { success: true };
    })
  }),
  // ─── Categories (Product Groups used as categories) ───────────────────────────
  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.query.productGroups.findMany({
        where: eq11(productGroups.orgId, ctx.user.orgId),
        orderBy: (g, { asc: asc5 }) => [asc5(g.name)]
      });
      return rows.map((r) => ({ ...r, uuid: String(r.id), isActive: r.isActive ?? true }));
    }),
    tree: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.query.productGroups.findMany({
        where: eq11(productGroups.orgId, ctx.user.orgId),
        orderBy: (g, { asc: asc5 }) => [asc5(g.name)]
      });
      return rows.map((r) => ({ ...r, uuid: String(r.id), isActive: r.isActive ?? true }));
    }),
    create: protectedProcedure.input(z10.object({
      name: z10.string().min(1),
      parentId: z10.number().optional(),
      description: z10.string().optional(),
      color: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const [g] = await db.insert(productGroups).values({
        orgId: ctx.user.orgId,
        name: input.name,
        parentId: input.parentId,
        description: input.description,
        color: input.color
      }).returning();
      return { ...g, uuid: String(g.id), isActive: g.isActive ?? true };
    }),
    update: protectedProcedure.input(z10.object({
      id: z10.number(),
      name: z10.string().min(1).optional(),
      description: z10.string().optional(),
      color: z10.string().optional(),
      isActive: z10.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.update(productGroups).set(data).where(and11(eq11(productGroups.id, id), eq11(productGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      await db.delete(productGroups).where(and11(eq11(productGroups.id, input.id), eq11(productGroups.orgId, ctx.user.orgId)));
      return { success: true };
    })
  }),
  // ─── Product Groups ───────────────────────────────────────────────────────────
  productGroups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.productGroups.findMany({
        where: eq11(productGroups.orgId, ctx.user.orgId),
        orderBy: (g, { asc: asc5 }) => [asc5(g.groupCode), asc5(g.name)]
      });
    }),
    create: protectedProcedure.input(z10.object({
      name: z10.string().min(1),
      name2: z10.string().optional(),
      groupCode: z10.string().optional(),
      description: z10.string().optional(),
      parentId: z10.number().optional(),
      groupType: z10.string().optional(),
      level: z10.number().optional(),
      autoNumbering: z10.boolean().optional(),
      firstNumber: z10.number().optional(),
      lastNumber: z10.number().optional(),
      increment: z10.number().optional(),
      codeDigits: z10.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const [g] = await db.insert(productGroups).values({ ...input, orgId: ctx.user.orgId }).returning();
      return g;
    }),
    update: protectedProcedure.input(z10.object({
      id: z10.number(),
      name: z10.string().min(1).optional(),
      name2: z10.string().optional(),
      groupCode: z10.string().optional(),
      description: z10.string().optional(),
      parentId: z10.number().optional(),
      groupType: z10.string().optional(),
      level: z10.number().optional(),
      autoNumbering: z10.boolean().optional(),
      firstNumber: z10.number().optional(),
      lastNumber: z10.number().optional(),
      increment: z10.number().optional(),
      codeDigits: z10.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.update(productGroups).set(data).where(and11(eq11(productGroups.id, id), eq11(productGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      await db.delete(productGroups).where(and11(eq11(productGroups.id, input.id), eq11(productGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    nextCode: protectedProcedure.input(z10.object({ groupId: z10.number() })).query(async ({ ctx, input }) => {
      const group = await db.query.productGroups.findFirst({
        where: and11(eq11(productGroups.id, input.groupId), eq11(productGroups.orgId, ctx.user.orgId))
      });
      if (!group) return null;
      const prefix = group.groupCode ?? "";
      const totalDigits = group.codeDigits ?? 5;
      const seqLen = Math.max(1, totalDigits - prefix.length);
      const firstNum = group.firstNumber ?? 1;
      const incr = group.increment ?? 1;
      const lastNum = group.lastNumber ?? 99999;
      const existing = await db.select({ code: products.code }).from(products).where(
        and11(
          eq11(products.orgId, ctx.user.orgId),
          prefix ? like2(products.code, prefix + "%") : isNotNull(products.code)
        )
      ).orderBy(desc5(products.code));
      let nextNum = firstNum;
      if (existing.length > 0) {
        const nums = existing.map((p) => {
          const seq = (p.code ?? "").substring(prefix.length);
          const n = parseInt(seq, 10);
          return isNaN(n) ? -1 : n;
        }).filter((n) => n >= 0);
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + incr;
        }
      }
      if (nextNum > lastNum) return null;
      const seqPart = String(nextNum).padStart(seqLen, "0");
      return prefix + seqPart;
    })
  }),
  // ─── Customers ───────────────────────────────────────────────────────────────
  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.customers.findMany({
        where: and11(eq11(customers.orgId, ctx.user.orgId), eq11(customers.isActive, true)),
        orderBy: (c, { asc: asc5 }) => [asc5(c.name)]
      });
    }),
    create: protectedProcedure.input(z10.object({
      code: z10.string().optional(),
      name: z10.string().min(1),
      phone: z10.string().optional(),
      email: z10.string().optional(),
      address: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const [c] = await db.insert(customers).values({
        ...input,
        orgId: ctx.user.orgId,
        isActive: true
      }).returning();
      return c;
    })
  }),
  // ─── Suppliers ───────────────────────────────────────────────────────────────
  suppliers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.suppliers.findMany({
        where: and11(eq11(suppliers.orgId, ctx.user.orgId), eq11(suppliers.isActive, true)),
        orderBy: (s, { asc: asc5 }) => [asc5(s.name)]
      });
    })
  }),
  // ─── Chart of Accounts ───────────────────────────────────────────────────────
  accounts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.chartOfAccounts.findMany({
        where: and11(eq11(chartOfAccounts.orgId, ctx.user.orgId), eq11(chartOfAccounts.isActive, true)),
        orderBy: (a, { asc: asc5 }) => [asc5(a.code)]
      });
    }),
    children: protectedProcedure.input(z10.object({ parentId: z10.number().int().nullable() })).query(async ({ ctx, input }) => {
      const parentCond = input.parentId === null ? isNull(chartOfAccounts.parentId) : eq11(chartOfAccounts.parentId, input.parentId);
      return db.select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        accountType: chartOfAccounts.accountType,
        nature: chartOfAccounts.nature,
        level: chartOfAccounts.level,
        isParent: chartOfAccounts.isParent,
        allowPosting: chartOfAccounts.allowPosting,
        parentId: chartOfAccounts.parentId
      }).from(chartOfAccounts).where(and11(
        eq11(chartOfAccounts.orgId, ctx.user.orgId),
        eq11(chartOfAccounts.isActive, true),
        parentCond
      )).orderBy(asc4(chartOfAccounts.code));
    }),
    create: protectedProcedure.input(z10.object({
      code: z10.string().min(1),
      name: z10.string().min(1),
      nameEn: z10.string().optional(),
      accountType: z10.string().default("assets"),
      nature: z10.string().default("debit"),
      level: z10.number().int().min(1).max(10).default(1),
      parentId: z10.number().int().optional(),
      isParent: z10.boolean().default(false),
      allowPosting: z10.boolean().default(true),
      costCenterType: z10.enum(["not_allowed", "optional", "mandatory"]).default("not_allowed"),
      isActive: z10.boolean().default(true),
      notes: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const exists = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and11(eq11(chartOfAccounts.orgId, ctx.user.orgId), eq11(chartOfAccounts.code, input.code), eq11(chartOfAccounts.isActive, true))).limit(1);
      if (exists.length > 0) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u062D\u0633\u0627\u0628 "${input.code}" \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644` });
      if (input.parentId) {
        const parent = await db.select({ id: chartOfAccounts.id, isParent: chartOfAccounts.isParent }).from(chartOfAccounts).where(and11(eq11(chartOfAccounts.id, input.parentId), eq11(chartOfAccounts.orgId, ctx.user.orgId))).limit(1);
        if (!parent.length) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0623\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        if (!parent[0].isParent) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0636\u0627\u0641\u0629 \u062D\u0633\u0627\u0628 \u062A\u062D\u062A \u062D\u0633\u0627\u0628 \u0641\u0631\u0639\u064A \u2014 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0641\u0631\u0639\u064A \u0644\u0627 \u064A\u0642\u0628\u0644 \u062D\u0633\u0627\u0628\u0627\u062A \u062A\u062D\u062A\u0647" });
      }
      const insertData = {
        orgId: ctx.user.orgId,
        code: input.code,
        name: input.name,
        accountType: input.accountType,
        nature: input.nature,
        level: input.level,
        isParent: input.isParent,
        allowPosting: input.allowPosting,
        costCenterType: input.costCenterType,
        isActive: input.isActive
      };
      if (input.nameEn) insertData.nameEn = input.nameEn;
      if (input.parentId) insertData.parentId = input.parentId;
      if (input.notes) insertData.notes = input.notes;
      const [account] = await db.insert(chartOfAccounts).values(insertData).returning();
      if (input.parentId) {
        await db.update(chartOfAccounts).set({ isParent: true }).where(and11(eq11(chartOfAccounts.id, input.parentId), eq11(chartOfAccounts.orgId, ctx.user.orgId)));
      }
      return account;
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      const children = await db.select({ id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name }).from(chartOfAccounts).where(and11(
        eq11(chartOfAccounts.parentId, input.id),
        eq11(chartOfAccounts.orgId, ctx.user.orgId),
        eq11(chartOfAccounts.isActive, true)
      )).limit(1);
      if (children.length > 0) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: `\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0623\u0646\u0647 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062D\u0633\u0627\u0628\u0627\u062A \u0641\u0631\u0639\u064A\u0629 \u2014 \u064A\u062C\u0628 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0641\u0631\u0639\u064A\u0629 \u0623\u0648\u0644\u0627\u064B`
        });
      }
      await db.update(chartOfAccounts).set({ isActive: false }).where(and11(eq11(chartOfAccounts.id, input.id), eq11(chartOfAccounts.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    import: protectedProcedure.input(z10.object({
      accounts: z10.array(z10.object({
        code: z10.string().min(1),
        name: z10.string().min(1),
        nameEn: z10.string().optional(),
        accountType: z10.string().default("assets"),
        nature: z10.string().default("debit"),
        level: z10.number().int().min(1).max(10).default(1),
        isParent: z10.boolean().default(false),
        allowPosting: z10.boolean().default(true),
        openingBalance: z10.string().optional(),
        openingBalanceType: z10.string().default("debit")
      })),
      skipDuplicates: z10.boolean().default(true)
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.select({ code: chartOfAccounts.code }).from(chartOfAccounts).where(and11(eq11(chartOfAccounts.orgId, ctx.user.orgId), eq11(chartOfAccounts.isActive, true)));
      const existingCodes = new Set(existing.map((r) => r.code));
      const toInsert = input.accounts.filter((a) => !existingCodes.has(a.code) || !input.skipDuplicates);
      if (toInsert.length === 0) return { inserted: 0, skipped: input.accounts.length };
      await db.insert(chartOfAccounts).values(toInsert.map((a) => ({ ...a, orgId: ctx.user.orgId })));
      return { inserted: toInsert.length, skipped: input.accounts.length - toInsert.length };
    })
  }),
  // ─── Journal Entries ─────────────────────────────────────────────────────────
  journal: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.journalEntries.findMany({
        where: eq11(journalEntries.orgId, ctx.user.orgId),
        orderBy: [desc5(journalEntries.createdAt)],
        limit: 100
      });
    }),
    get: protectedProcedure.input(z10.object({ id: z10.number() })).query(async ({ ctx, input }) => {
      const entry = await db.query.journalEntries.findFirst({
        where: and11(eq11(journalEntries.id, input.id), eq11(journalEntries.orgId, ctx.user.orgId))
      });
      if (!entry) throw new Error("\u0627\u0644\u0642\u064A\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const lines = await db.query.journalEntryLines.findMany({
        where: eq11(journalEntryLines.entryId, input.id),
        orderBy: (l, { asc: asc5 }) => [asc5(l.sortOrder)]
      });
      return { ...entry, lines };
    }),
    nextNumber: protectedProcedure.query(async ({ ctx }) => {
      const last = await db.query.journalEntries.findFirst({
        where: eq11(journalEntries.orgId, ctx.user.orgId),
        orderBy: [desc5(journalEntries.id)]
      });
      const num = last ? parseInt(last.entryNumber.replace(/\D/g, "") || "0") + 1 : 1;
      return `JE-${String(num).padStart(4, "0")}`;
    }),
    create: protectedProcedure.input(z10.object({
      entryNumber: z10.string(),
      entryDate: z10.string(),
      description: z10.string().optional(),
      reference: z10.string().optional(),
      totalDebit: z10.string(),
      totalCredit: z10.string(),
      sourceDocType: z10.string().optional(),
      sourceDocId: z10.number().optional(),
      sourceDocNumber: z10.string().optional(),
      entryType: z10.enum(["manual", "auto"]).optional(),
      lines: z10.array(z10.object({
        accountId: z10.number().optional(),
        accountCode: z10.string().optional(),
        accountName: z10.string().optional(),
        description: z10.string().optional(),
        debit: z10.string().default("0"),
        credit: z10.string().default("0"),
        sortOrder: z10.number().optional()
      }))
    })).mutation(async ({ ctx, input }) => {
      const { lines, entryDate, ...rest } = input;
      const [entry] = await db.insert(journalEntries).values({
        ...rest,
        entryType: rest.entryType ?? "manual",
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        entryDate: new Date(entryDate),
        status: "posted"
      }).returning();
      if (lines.length > 0) {
        await db.insert(journalEntryLines).values(
          lines.map((l, i) => ({ ...l, entryId: entry.id, orgId: ctx.user.orgId, sortOrder: l.sortOrder ?? i }))
        );
      }
      return entry;
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      await db.update(journalEntries).set({ status: "cancelled" }).where(and11(eq11(journalEntries.id, input.id), eq11(journalEntries.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    getByNumber: protectedProcedure.input(z10.object({ entryNumber: z10.string() })).query(async ({ ctx, input }) => {
      const entry = await db.query.journalEntries.findFirst({
        where: and11(eq11(journalEntries.entryNumber, input.entryNumber), eq11(journalEntries.orgId, ctx.user.orgId))
      });
      if (!entry) return null;
      const lines = await db.query.journalEntryLines.findMany({
        where: eq11(journalEntryLines.entryId, entry.id),
        orderBy: (l, { asc: asc5 }) => [asc5(l.sortOrder)]
      });
      return { ...entry, lines };
    })
  }),
  // ─── Vouchers ────────────────────────────────────────────────────────────────
  vouchers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.vouchers.findMany({
        where: eq11(vouchers.orgId, ctx.user.orgId),
        orderBy: [desc5(vouchers.createdAt)],
        limit: 100
      });
    }),
    nextNumber: protectedProcedure.input(z10.object({ type: z10.enum(["receipt", "payment"]) })).query(async ({ ctx, input }) => {
      const last = await db.query.vouchers.findFirst({
        where: and11(eq11(vouchers.orgId, ctx.user.orgId), eq11(vouchers.voucherType, input.type)),
        orderBy: [desc5(vouchers.id)]
      });
      const prefix = input.type === "receipt" ? "RV" : "PV";
      const num = last ? parseInt(last.voucherNumber.replace(/\D/g, "") || "0") + 1 : 1;
      return `${prefix}-${String(num).padStart(4, "0")}`;
    }),
    create: protectedProcedure.input(z10.object({
      voucherNumber: z10.string(),
      voucherType: z10.enum(["receipt", "payment"]),
      voucherDate: z10.string(),
      amount: z10.string(),
      paymentMethod: z10.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
      accountCode: z10.string().optional(),
      accountName: z10.string().optional(),
      partyType: z10.string().optional(),
      partyName: z10.string().optional(),
      description: z10.string().optional(),
      reference: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const [v] = await db.insert(vouchers).values({
        ...input,
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        voucherDate: new Date(input.voucherDate),
        status: "posted"
      }).returning();
      return v;
    })
  }),
  // ─── Receipt Vouchers ────────────────────────────────────────────────────────
  receiptVouchers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.select().from(receiptVouchers).where(eq11(receiptVouchers.orgId, ctx.user.orgId)).orderBy(desc5(receiptVouchers.createdAt)).limit(200);
    }),
    create: protectedProcedure.input(z10.object({
      voucherNumber: z10.string(),
      voucherDate: z10.date(),
      receivedFrom: z10.string().optional(),
      amount: z10.string(),
      paymentMethod: z10.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
      bankAccount: z10.string().optional(),
      checkNumber: z10.string().optional(),
      description: z10.string().optional(),
      accountId: z10.number().optional(),
      contraAccountId: z10.number().optional(),
      costCenterId: z10.number().optional(),
      notes: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      let journalEntryId;
      let journalEntryNumber;
      if (input.accountId && input.contraAccountId) {
        const last = await db.query.journalEntries.findFirst({
          where: eq11(journalEntries.orgId, ctx.user.orgId),
          orderBy: [desc5(journalEntries.id)]
        });
        const num = last ? parseInt(last.entryNumber.replace(/\D/g, "") || "0") + 1 : 1;
        journalEntryNumber = `JE-${String(num).padStart(4, "0")}`;
        const accDebitName = await db.query.chartOfAccounts.findFirst({ where: eq11(chartOfAccounts.id, input.accountId) });
        const accCreditName = await db.query.chartOfAccounts.findFirst({ where: eq11(chartOfAccounts.id, input.contraAccountId) });
        const [je] = await db.insert(journalEntries).values({
          orgId: ctx.user.orgId,
          userId: ctx.user.id,
          entryNumber: journalEntryNumber,
          entryDate: input.voucherDate,
          description: `\u0633\u0646\u062F \u0642\u0628\u0636 \u0631\u0642\u0645 ${input.voucherNumber}${input.receivedFrom ? ` - ${input.receivedFrom}` : ""}`,
          reference: input.voucherNumber,
          totalDebit: input.amount,
          totalCredit: input.amount,
          sourceDocType: "receipt_voucher",
          sourceDocNumber: input.voucherNumber,
          entryType: "auto",
          status: "posted"
        }).returning();
        journalEntryId = je.id;
        await db.insert(journalEntryLines).values([
          { entryId: je.id, orgId: ctx.user.orgId, accountId: input.accountId, accountName: accDebitName?.name ?? "", debit: input.amount, credit: "0", sortOrder: 1, description: input.description },
          { entryId: je.id, orgId: ctx.user.orgId, accountId: input.contraAccountId, accountName: accCreditName?.name ?? "", debit: "0", credit: input.amount, sortOrder: 2, description: input.description }
        ]);
      }
      const [v] = await db.insert(receiptVouchers).values({
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        voucherNumber: input.voucherNumber,
        voucherDate: input.voucherDate,
        receivedFrom: input.receivedFrom,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        bankAccount: input.bankAccount,
        checkNumber: input.checkNumber,
        description: input.description,
        accountId: input.accountId,
        contraAccountId: input.contraAccountId,
        costCenterId: input.costCenterId,
        notes: input.notes,
        journalEntryId,
        status: "posted"
      }).returning();
      return { ...v, journalEntryNumber };
    })
  }),
  // ─── Payment Vouchers ────────────────────────────────────────────────────────
  paymentVouchers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.select().from(paymentVouchers).where(eq11(paymentVouchers.orgId, ctx.user.orgId)).orderBy(desc5(paymentVouchers.createdAt)).limit(200);
    }),
    create: protectedProcedure.input(z10.object({
      voucherNumber: z10.string(),
      voucherDate: z10.date(),
      paidTo: z10.string().optional(),
      amount: z10.string(),
      paymentMethod: z10.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
      bankAccount: z10.string().optional(),
      checkNumber: z10.string().optional(),
      description: z10.string().optional(),
      accountId: z10.number().optional(),
      contraAccountId: z10.number().optional(),
      notes: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      let journalEntryId;
      let journalEntryNumber;
      if (input.accountId && input.contraAccountId) {
        const last = await db.query.journalEntries.findFirst({
          where: eq11(journalEntries.orgId, ctx.user.orgId),
          orderBy: [desc5(journalEntries.id)]
        });
        const num = last ? parseInt(last.entryNumber.replace(/\D/g, "") || "0") + 1 : 1;
        journalEntryNumber = `JE-${String(num).padStart(4, "0")}`;
        const accDebitName = await db.query.chartOfAccounts.findFirst({ where: eq11(chartOfAccounts.id, input.contraAccountId) });
        const accCreditName = await db.query.chartOfAccounts.findFirst({ where: eq11(chartOfAccounts.id, input.accountId) });
        const [je] = await db.insert(journalEntries).values({
          orgId: ctx.user.orgId,
          userId: ctx.user.id,
          entryNumber: journalEntryNumber,
          entryDate: input.voucherDate,
          description: `\u0633\u0646\u062F \u0635\u0631\u0641 \u0631\u0642\u0645 ${input.voucherNumber}${input.paidTo ? ` - ${input.paidTo}` : ""}`,
          reference: input.voucherNumber,
          totalDebit: input.amount,
          totalCredit: input.amount,
          sourceDocType: "payment_voucher",
          sourceDocNumber: input.voucherNumber,
          entryType: "auto",
          status: "posted"
        }).returning();
        journalEntryId = je.id;
        await db.insert(journalEntryLines).values([
          { entryId: je.id, orgId: ctx.user.orgId, accountId: input.contraAccountId, accountName: accDebitName?.name ?? "", debit: input.amount, credit: "0", sortOrder: 1, description: input.description },
          { entryId: je.id, orgId: ctx.user.orgId, accountId: input.accountId, accountName: accCreditName?.name ?? "", debit: "0", credit: input.amount, sortOrder: 2, description: input.description }
        ]);
      }
      const [v] = await db.insert(paymentVouchers).values({
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        voucherNumber: input.voucherNumber,
        voucherDate: input.voucherDate,
        paidTo: input.paidTo,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        bankAccount: input.bankAccount,
        checkNumber: input.checkNumber,
        description: input.description,
        accountId: input.accountId,
        contraAccountId: input.contraAccountId,
        notes: input.notes,
        journalEntryId,
        status: "posted"
      }).returning();
      return { ...v, journalEntryNumber };
    })
  }),
  // ─── Branches ────────────────────────────────────────────────────────────────
  branches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.branches.findMany({
        where: and11(eq11(branches.orgId, ctx.user.orgId), eq11(branches.isActive, true)),
        orderBy: (b, { asc: asc5 }) => [asc5(b.name)]
      });
    }),
    create: protectedProcedure.input(z10.object({ name: z10.string().min(1), address: z10.string().optional(), phone: z10.string().optional() })).mutation(async ({ ctx, input }) => {
      const [b] = await db.insert(branches).values({ ...input, orgId: ctx.user.orgId, isActive: true }).returning();
      return b;
    }),
    update: protectedProcedure.input(z10.object({ id: z10.number(), name: z10.string().min(1).optional(), address: z10.string().optional(), phone: z10.string().optional() })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.update(branches).set(data).where(and11(eq11(branches.id, id), eq11(branches.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      const hasWarehouses = await db.select({ id: warehouses.id }).from(warehouses).where(and11(eq11(warehouses.branchId, input.id), eq11(warehouses.orgId, ctx.user.orgId), eq11(warehouses.isActive, true))).limit(1);
      if (hasWarehouses.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0641\u0631\u0639 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0645\u062E\u0627\u0632\u0646" });
      }
      const hasInvoices = await db.select({ id: salesInvoices.id }).from(salesInvoices).where(and11(eq11(salesInvoices.branchId, input.id), eq11(salesInvoices.orgId, ctx.user.orgId))).limit(1);
      if (hasInvoices.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0641\u0631\u0639 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A" });
      }
      const hasInventoryCounts = await db.select({ id: inventoryCounts.id }).from(inventoryCounts).where(and11(eq11(inventoryCounts.branchId, input.id), eq11(inventoryCounts.orgId, ctx.user.orgId))).limit(1);
      if (hasInventoryCounts.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0641\u0631\u0639 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0639\u0645\u0644\u064A\u0627\u062A \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A" });
      }
      await db.update(branches).set({ isActive: false }).where(and11(eq11(branches.id, input.id), eq11(branches.orgId, ctx.user.orgId)));
      return { success: true };
    })
  }),
  // ─── Warehouses ──────────────────────────────────────────────────────────────
  warehouses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.warehouses.findMany({
        where: and11(eq11(warehouses.orgId, ctx.user.orgId), eq11(warehouses.isActive, true)),
        orderBy: (w, { asc: asc5 }) => [asc5(w.name)]
      });
    }),
    create: protectedProcedure.input(z10.object({
      name: z10.string().min(1),
      code: z10.string().optional(),
      branchId: z10.number().optional(),
      name2: z10.string().optional(),
      fullName1: z10.string().optional(),
      fullName2: z10.string().optional(),
      description: z10.string().optional(),
      invAccountId: z10.number().optional(),
      cogsAccount1Id: z10.number().optional(),
      cogsAccount2Id: z10.number().optional(),
      cashAccountId: z10.number().optional(),
      bankAccountId: z10.number().optional(),
      salesAccount1Id: z10.number().optional(),
      allowedUserId: z10.number().optional(),
      allowedUserGroup: z10.string().optional(),
      copyFromWarehouseId: z10.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { description, ...rest } = input;
      const [w] = await db.insert(warehouses).values({ ...rest, address: description, orgId: ctx.user.orgId, isActive: true }).returning();
      return w;
    }),
    update: protectedProcedure.input(z10.object({
      id: z10.number(),
      name: z10.string().optional(),
      code: z10.string().optional(),
      branchId: z10.number().optional(),
      name2: z10.string().optional(),
      fullName1: z10.string().optional(),
      fullName2: z10.string().optional(),
      description: z10.string().optional(),
      invAccountId: z10.number().optional(),
      cogsAccount1Id: z10.number().optional(),
      cogsAccount2Id: z10.number().optional(),
      cashAccountId: z10.number().optional(),
      bankAccountId: z10.number().optional(),
      salesAccount1Id: z10.number().optional(),
      allowedUserId: z10.number().optional(),
      allowedUserGroup: z10.string().optional(),
      copyFromWarehouseId: z10.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, description, ...rest } = input;
      await db.update(warehouses).set({ ...rest, address: description }).where(and11(eq11(warehouses.id, id), eq11(warehouses.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      const hasInventory = await db.select({ id: inventory.id }).from(inventory).where(and11(eq11(inventory.warehouseId, input.id), eq11(inventory.orgId, ctx.user.orgId))).limit(1);
      if (hasInventory.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0645\u0646\u062A\u062C\u0627\u062A \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646" });
      }
      const hasVouchers = await db.select({ id: stockVouchers.id }).from(stockVouchers).where(and11(eq11(stockVouchers.warehouseId, input.id), eq11(stockVouchers.orgId, ctx.user.orgId))).limit(1);
      if (hasVouchers.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0631\u0643\u0627\u062A \u0645\u062E\u0632\u0646\u064A\u0629" });
      }
      const hasInventoryCounts = await db.select({ id: inventoryCounts.id }).from(inventoryCounts).where(and11(eq11(inventoryCounts.warehouseId, input.id), eq11(inventoryCounts.orgId, ctx.user.orgId))).limit(1);
      if (hasInventoryCounts.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0639\u0645\u0644\u064A\u0627\u062A \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A" });
      }
      const hasSalesInvoices = await db.select({ id: salesInvoices.id }).from(salesInvoices).where(and11(eq11(salesInvoices.warehouseId, input.id), eq11(salesInvoices.orgId, ctx.user.orgId))).limit(1);
      if (hasSalesInvoices.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A" });
      }
      await db.update(warehouses).set({ isActive: false }).where(and11(eq11(warehouses.id, input.id), eq11(warehouses.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    accountLinks: router({
      list: protectedProcedure.input(z10.object({ warehouseId: z10.number() })).query(async ({ input }) => {
        return db.select().from(warehouseAccountLinks).where(eq11(warehouseAccountLinks.warehouseId, input.warehouseId)).orderBy(warehouseAccountLinks.sortOrder);
      }),
      listAll: protectedProcedure.query(async ({ ctx }) => {
        const rows = await db.select({
          id: warehouseAccountLinks.id,
          warehouseId: warehouseAccountLinks.warehouseId,
          label: warehouseAccountLinks.label,
          accountId: warehouseAccountLinks.accountId,
          sortOrder: warehouseAccountLinks.sortOrder,
          accountCode: chartOfAccounts.code,
          accountName: chartOfAccounts.name,
          warehouseName: warehouses.name
        }).from(warehouseAccountLinks).innerJoin(warehouses, and11(
          eq11(warehouses.id, warehouseAccountLinks.warehouseId),
          eq11(warehouses.orgId, ctx.user.orgId)
        )).leftJoin(chartOfAccounts, eq11(chartOfAccounts.id, warehouseAccountLinks.accountId)).orderBy(warehouses.name, warehouseAccountLinks.sortOrder);
        return rows;
      }),
      save: protectedProcedure.input(z10.object({
        warehouseId: z10.number(),
        links: z10.array(z10.object({
          id: z10.number().optional(),
          label: z10.string().min(1),
          accountId: z10.number().nullable().optional(),
          sortOrder: z10.number().default(0)
        }))
      })).mutation(async ({ input }) => {
        await db.delete(warehouseAccountLinks).where(eq11(warehouseAccountLinks.warehouseId, input.warehouseId));
        if (input.links.length > 0) {
          await db.insert(warehouseAccountLinks).values(
            input.links.map((l, i) => ({
              warehouseId: input.warehouseId,
              label: l.label,
              accountId: l.accountId ?? null,
              sortOrder: i
            }))
          );
        }
        return { success: true };
      })
    })
  }),
  // ─── Units ───────────────────────────────────────────────────────────────────
  units: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.units.findMany({ where: eq11(units.orgId, ctx.user.orgId), orderBy: (u, { asc: asc5 }) => [asc5(u.name)] });
    }),
    create: protectedProcedure.input(z10.object({ name: z10.string().min(1), symbol: z10.string().optional() })).mutation(async ({ ctx, input }) => {
      const [u] = await db.insert(units).values({ ...input, orgId: ctx.user.orgId }).returning();
      return u;
    }),
    update: protectedProcedure.input(z10.object({ id: z10.number(), name: z10.string().min(1).optional(), symbol: z10.string().optional() })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.update(units).set(data).where(and11(eq11(units.id, id), eq11(units.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      await db.delete(units).where(and11(eq11(units.id, input.id), eq11(units.orgId, ctx.user.orgId)));
      return { success: true };
    })
  }),
  // ─── Stock Vouchers (سندات المخزن) ───────────────────────────────────────────
  stockVouchers: router({
    list: protectedProcedure.input(z10.object({ type: z10.enum(["receipt", "issue", "transfer"]).optional() }).optional()).query(async ({ ctx, input }) => {
      const conds = [eq11(stockVouchers.orgId, ctx.user.orgId)];
      if (input?.type) conds.push(eq11(stockVouchers.type, input.type));
      return db.query.stockVouchers.findMany({
        where: and11(...conds),
        orderBy: [desc5(stockVouchers.createdAt)],
        limit: 200
      });
    }),
    get: protectedProcedure.input(z10.object({ id: z10.number() })).query(async ({ ctx, input }) => {
      const v = await db.query.stockVouchers.findFirst({
        where: and11(eq11(stockVouchers.id, input.id), eq11(stockVouchers.orgId, ctx.user.orgId))
      });
      if (!v) throw new Error("\u0627\u0644\u0633\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const items = await db.query.stockVoucherItems.findMany({ where: eq11(stockVoucherItems.voucherId, input.id) });
      return { ...v, items };
    }),
    create: protectedProcedure.input(z10.object({
      type: z10.enum(["receipt", "issue", "transfer"]),
      warehouseId: z10.number(),
      branchId: z10.number(),
      supplierId: z10.number().optional(),
      reason: z10.string().optional(),
      notes: z10.string().optional(),
      items: z10.array(z10.object({
        productId: z10.number(),
        productName: z10.string(),
        quantity: z10.string(),
        unitCost: z10.string(),
        totalCost: z10.string()
      }))
    })).mutation(async ({ ctx, input }) => {
      const { items, ...rest } = input;
      const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0).toFixed(4);
      const last = await db.query.stockVouchers.findFirst({
        where: eq11(stockVouchers.orgId, ctx.user.orgId),
        orderBy: [desc5(stockVouchers.id)]
      });
      const num = last ? parseInt(last.voucherNumber.replace(/\D/g, "") || "0") + 1 : 1;
      const prefix = rest.type === "receipt" ? "SV-IN" : rest.type === "issue" ? "SV-OUT" : "SV-TR";
      const voucherNumber = `${prefix}-${String(num).padStart(4, "0")}`;
      const [v] = await db.insert(stockVouchers).values({
        ...rest,
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        voucherNumber,
        totalCost,
        status: "confirmed"
      }).returning();
      if (items.length > 0) {
        await db.insert(stockVoucherItems).values(
          items.map((item, i) => ({ ...item, voucherId: v.id, orgId: ctx.user.orgId, sortOrder: i }))
        );
      }
      for (const item of items) {
        const existing = await db.query.inventory.findFirst({
          where: and11(eq11(inventory.orgId, ctx.user.orgId), eq11(inventory.productId, item.productId), eq11(inventory.warehouseId, rest.warehouseId))
        });
        const qty = Number(item.quantity);
        const diff = rest.type === "receipt" ? qty : -qty;
        if (existing) {
          await db.update(inventory).set({ quantity: String(Number(existing.quantity) + diff), updatedAt: /* @__PURE__ */ new Date() }).where(eq11(inventory.id, existing.id));
        } else {
          await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: rest.warehouseId, quantity: String(Math.max(0, diff)), avgCost: item.unitCost });
        }
      }
      return v;
    })
  }),
  // ─── Inventory Count (جرد المخزون) ────────────────────────────────────────────
  inventoryCount: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.inventoryCounts.findMany({
        where: eq11(inventoryCounts.orgId, ctx.user.orgId),
        orderBy: [desc5(inventoryCounts.createdAt)],
        limit: 100
      });
    }),
    get: protectedProcedure.input(z10.object({ id: z10.number() })).query(async ({ ctx, input }) => {
      const count = await db.query.inventoryCounts.findFirst({
        where: and11(eq11(inventoryCounts.id, input.id), eq11(inventoryCounts.orgId, ctx.user.orgId))
      });
      if (!count) throw new Error("\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      const items = await db.query.inventoryCountItems.findMany({
        where: eq11(inventoryCountItems.countId, input.id),
        orderBy: (i, { asc: asc5 }) => [asc5(i.sortOrder)]
      });
      return { ...count, items };
    }),
    create: protectedProcedure.input(z10.object({ warehouseId: z10.number(), branchId: z10.number().optional(), notes: z10.string().optional() })).mutation(async ({ ctx, input }) => {
      const last = await db.query.inventoryCounts.findFirst({
        where: eq11(inventoryCounts.orgId, ctx.user.orgId),
        orderBy: [desc5(inventoryCounts.id)]
      });
      const num = last ? parseInt(last.countNumber.replace(/\D/g, "") || "0") + 1 : 1;
      const countNumber = `CNT-${String(num).padStart(4, "0")}`;
      const [count] = await db.insert(inventoryCounts).values({
        ...input,
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        countNumber,
        status: "draft"
      }).returning();
      const invItems = await db.query.inventory.findMany({
        where: and11(eq11(inventory.orgId, ctx.user.orgId), eq11(inventory.warehouseId, input.warehouseId))
      });
      if (invItems.length > 0) {
        const productIds = invItems.map((i) => i.productId);
        const prods = await db.query.products.findMany({
          where: and11(eq11(products.orgId, ctx.user.orgId))
        });
        const prodMap = new Map(prods.map((p) => [p.id, p]));
        await db.insert(inventoryCountItems).values(
          invItems.map((inv, i) => ({
            countId: count.id,
            orgId: ctx.user.orgId,
            productId: inv.productId,
            productName: prodMap.get(inv.productId)?.name ?? `#${inv.productId}`,
            systemQuantity: inv.quantity,
            actualQuantity: inv.quantity,
            difference: "0",
            sortOrder: i
          }))
        );
      }
      return count.id;
    }),
    updateItem: protectedProcedure.input(z10.object({ id: z10.number(), actualQuantity: z10.string() })).mutation(async ({ ctx, input }) => {
      const item = await db.query.inventoryCountItems.findFirst({ where: eq11(inventoryCountItems.id, input.id) });
      if (!item) throw new Error("\u0627\u0644\u0639\u0646\u0635\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const diff = (Number(input.actualQuantity) - Number(item.systemQuantity)).toFixed(4);
      await db.update(inventoryCountItems).set({ actualQuantity: input.actualQuantity, difference: diff }).where(eq11(inventoryCountItems.id, input.id));
      return { success: true };
    }),
    confirm: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      const count = await db.query.inventoryCounts.findFirst({
        where: and11(eq11(inventoryCounts.id, input.id), eq11(inventoryCounts.orgId, ctx.user.orgId))
      });
      if (!count) throw new Error("\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      if (count.status !== "draft") throw new Error("\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062C\u0631\u062F \u0645\u0633\u0628\u0642\u0627\u064B");
      const items = await db.query.inventoryCountItems.findMany({ where: eq11(inventoryCountItems.countId, input.id) });
      for (const item of items) {
        if (!item.productId || !count.warehouseId) continue;
        const existing = await db.query.inventory.findFirst({
          where: and11(eq11(inventory.orgId, ctx.user.orgId), eq11(inventory.productId, item.productId), eq11(inventory.warehouseId, count.warehouseId))
        });
        if (existing) {
          await db.update(inventory).set({ quantity: item.actualQuantity, updatedAt: /* @__PURE__ */ new Date() }).where(eq11(inventory.id, existing.id));
        } else {
          await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: count.warehouseId, quantity: item.actualQuantity });
        }
      }
      await db.update(inventoryCounts).set({ status: "confirmed", confirmedAt: /* @__PURE__ */ new Date() }).where(eq11(inventoryCounts.id, input.id));
      return { success: true };
    })
  }),
  // ─── Reports ──────────────────────────────────────────────────────────────────
  reports: router({
    stockByWarehouse: protectedProcedure.input(z10.object({ warehouseId: z10.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const conds = [eq11(inventory.orgId, ctx.user.orgId)];
      if (input?.warehouseId) conds.push(eq11(inventory.warehouseId, input.warehouseId));
      const invRows = await db.query.inventory.findMany({ where: and11(...conds) });
      const prods = await db.query.products.findMany({ where: eq11(products.orgId, ctx.user.orgId) });
      const warehouseList = await db.query.warehouses.findMany({ where: eq11(warehouses.orgId, ctx.user.orgId) });
      const prodMap = new Map(prods.map((p) => [p.id, p]));
      const whMap = new Map(warehouseList.map((w) => [w.id, w]));
      return invRows.map((r) => {
        const p = prodMap.get(r.productId);
        const costPrice = r.avgCost ?? p?.purchasePrice ?? "0";
        const totalValue = Number(r.quantity) * Number(costPrice);
        return {
          productId: r.productId,
          productName: p?.name ?? `#${r.productId}`,
          warehouseId: r.warehouseId,
          warehouseName: whMap.get(r.warehouseId ?? 0)?.name ?? `#${r.warehouseId}`,
          totalQuantity: r.quantity,
          costPrice,
          totalValue: totalValue.toFixed(4),
          minStock: p?.minStock ?? "0",
          isLow: Number(r.quantity) < Number(p?.minStock ?? 0)
        };
      });
    }),
    voucherSummary: protectedProcedure.query(async ({ ctx }) => {
      const all = await db.query.stockVouchers.findMany({
        where: eq11(stockVouchers.orgId, ctx.user.orgId)
      });
      const grouped = {};
      for (const v of all) {
        if (!grouped[v.type]) grouped[v.type] = { type: v.type, count: 0, totalCost: 0 };
        grouped[v.type].count++;
        grouped[v.type].totalCost += Number(v.totalCost ?? 0);
      }
      return Object.values(grouped).map((g) => ({ ...g, totalCost: g.totalCost.toFixed(4) }));
    }),
    lowStockAlert: protectedProcedure.query(async ({ ctx }) => {
      const invRows = await db.query.inventory.findMany({ where: eq11(inventory.orgId, ctx.user.orgId) });
      const prods = await db.query.products.findMany({ where: and11(eq11(products.orgId, ctx.user.orgId), eq11(products.isActive, true)) });
      const warehouseList = await db.query.warehouses.findMany({ where: eq11(warehouses.orgId, ctx.user.orgId) });
      const prodMap = new Map(prods.map((p) => [p.id, p]));
      const whMap = new Map(warehouseList.map((w) => [w.id, w]));
      return invRows.filter((r) => {
        const p = prodMap.get(r.productId);
        return p && Number(r.quantity) < Number(p.minStock ?? 0);
      }).map((r) => {
        const p = prodMap.get(r.productId);
        return {
          productId: r.productId,
          productName: p.name,
          warehouseName: whMap.get(r.warehouseId ?? 0)?.name ?? `#${r.warehouseId}`,
          quantity: r.quantity,
          minQuantity: p.minStock
        };
      });
    })
  }),
  // ─── الأصناف المجانية (Free Products / Offers) ──────────────────────────────
  freeProducts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.freeProducts.findMany({
        where: and11(eq11(freeProducts.orgId, ctx.user.orgId), eq11(freeProducts.isActive, true)),
        orderBy: [desc5(freeProducts.createdAt)]
      });
    }),
    create: protectedProcedure.input(z10.object({
      productId: z10.number().optional(),
      productCode: z10.string().optional(),
      productName: z10.string().min(1),
      unit: z10.string().optional(),
      baseQty: z10.string().default("1"),
      freeQty: z10.string().default("1"),
      offerStart: z10.string().optional(),
      offerEnd: z10.string().optional(),
      notes: z10.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(freeProducts).values({
        orgId: ctx.user.orgId,
        productId: input.productId,
        productCode: input.productCode,
        productName: input.productName,
        unit: input.unit,
        baseQty: input.baseQty,
        freeQty: input.freeQty,
        offerStart: input.offerStart ? new Date(input.offerStart) : void 0,
        offerEnd: input.offerEnd ? new Date(input.offerEnd) : void 0,
        notes: input.notes
      }).returning();
      return row;
    }),
    update: protectedProcedure.input(z10.object({
      id: z10.number(),
      productCode: z10.string().optional(),
      productName: z10.string().optional(),
      unit: z10.string().optional(),
      baseQty: z10.string().optional(),
      freeQty: z10.string().optional(),
      offerStart: z10.string().optional(),
      offerEnd: z10.string().optional(),
      notes: z10.string().optional(),
      isActive: z10.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, offerStart, offerEnd, ...rest } = input;
      await db.update(freeProducts).set({
        ...rest,
        offerStart: offerStart ? new Date(offerStart) : void 0,
        offerEnd: offerEnd ? new Date(offerEnd) : void 0
      }).where(and11(eq11(freeProducts.id, id), eq11(freeProducts.orgId, ctx.user.orgId)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
      await db.update(freeProducts).set({ isActive: false }).where(and11(eq11(freeProducts.id, input.id), eq11(freeProducts.orgId, ctx.user.orgId)));
      return { success: true };
    })
  }),
  // ─── Accounting Reports ───────────────────────────────────────────────────
  accounting: router({
    trialBalance: protectedProcedure.input(z10.object({
      fromDate: z10.date().optional(),
      toDate: z10.date().optional(),
      costCenterId: z10.number().optional()
    })).query(async ({ ctx, input }) => {
      const { fromDate, toDate } = input;
      const accounts = await db.select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        nature: chartOfAccounts.nature,
        isParent: chartOfAccounts.isParent,
        level: chartOfAccounts.level,
        openingBalance: chartOfAccounts.openingBalance,
        openingBalanceType: chartOfAccounts.openingBalanceType
      }).from(chartOfAccounts).where(and11(eq11(chartOfAccounts.orgId, ctx.user.orgId), eq11(chartOfAccounts.isActive, true))).orderBy(asc4(chartOfAccounts.code));
      const allLines = await db.select({
        accountId: journalEntryLines.accountId,
        debit: journalEntryLines.debit,
        credit: journalEntryLines.credit,
        entryDate: journalEntries.entryDate
      }).from(journalEntryLines).innerJoin(journalEntries, and11(
        eq11(journalEntries.id, journalEntryLines.entryId),
        eq11(journalEntries.status, "posted"),
        eq11(journalEntries.orgId, ctx.user.orgId)
      )).where(eq11(journalEntryLines.orgId, ctx.user.orgId));
      const agg = /* @__PURE__ */ new Map();
      const endOfDay = (d) => new Date(d.getTime() + 86399999);
      for (const ln of allLines) {
        if (!ln.accountId) continue;
        const d = parseFloat(ln.debit ?? "0");
        const cr = parseFloat(ln.credit ?? "0");
        const dt = ln.entryDate;
        const isPrior = fromDate ? dt < fromDate : false;
        const isInPeriod = fromDate ? dt >= fromDate && (!toDate || dt <= endOfDay(toDate)) : !toDate || dt <= endOfDay(toDate);
        if (!agg.has(ln.accountId)) agg.set(ln.accountId, { priorD: 0, priorC: 0, moveD: 0, moveC: 0 });
        const a = agg.get(ln.accountId);
        if (isPrior) {
          a.priorD += d;
          a.priorC += cr;
        } else if (isInPeriod) {
          a.moveD += d;
          a.moveC += cr;
        }
      }
      const rows = [];
      for (const acc of accounts) {
        const a = agg.get(acc.id);
        const schemaOpen = parseFloat(acc.openingBalance ?? "0");
        let openD = acc.openingBalanceType === "debit" ? schemaOpen : 0;
        let openC = acc.openingBalanceType === "credit" ? schemaOpen : 0;
        if (a) {
          openD += a.priorD;
          openC += a.priorC;
        }
        const moveD = a?.moveD ?? 0;
        const moveC = a?.moveC ?? 0;
        const netOpen = openD - openC;
        const netClose = netOpen + moveD - moveC;
        if (netOpen === 0 && moveD === 0 && moveC === 0) continue;
        rows.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          nature: acc.nature ?? "debit",
          isParent: acc.isParent ?? false,
          openingBalance: Math.abs(netOpen),
          openingBalanceType: netOpen >= 0 ? "debit" : "credit",
          movementDebit: moveD,
          movementCredit: moveC,
          closingBalance: Math.abs(netClose),
          closingBalanceType: netClose >= 0 ? "debit" : "credit"
        });
      }
      return rows;
    }),
    accountStatement: protectedProcedure.input(z10.object({
      accountId: z10.number(),
      fromDate: z10.date().optional(),
      toDate: z10.date().optional()
    })).query(async ({ ctx, input }) => {
      const { accountId, fromDate, toDate } = input;
      const endOfDay = (d) => new Date(d.getTime() + 86399999);
      const conds = [
        eq11(journalEntryLines.accountId, accountId),
        eq11(journalEntryLines.orgId, ctx.user.orgId),
        eq11(journalEntries.status, "posted")
      ];
      if (fromDate) conds.push(gte(journalEntries.entryDate, fromDate));
      if (toDate) conds.push(lte(journalEntries.entryDate, endOfDay(toDate)));
      const lines = await db.select({
        entryId: journalEntryLines.entryId,
        entryDate: journalEntries.entryDate,
        entryNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        lineDesc: journalEntryLines.description,
        voucherType: sql3`'قيد'`,
        debit: journalEntryLines.debit,
        credit: journalEntryLines.credit
      }).from(journalEntryLines).innerJoin(journalEntries, and11(
        eq11(journalEntries.id, journalEntryLines.entryId),
        eq11(journalEntries.orgId, ctx.user.orgId)
      )).where(and11(...conds)).orderBy(asc4(journalEntries.entryDate), asc4(journalEntries.id));
      return lines.map((l) => ({
        entryId: l.entryId,
        entryDate: l.entryDate,
        entryNumber: l.entryNumber,
        voucherType: l.voucherType,
        description: l.lineDesc ?? l.description,
        debit: l.debit,
        credit: l.credit
      }));
    })
  })
});

// src/index.ts
init_auth();
import { existsSync } from "fs";
var __dirname2 = path2.dirname(fileURLToPath2(import.meta.url));
var app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.post("/api/auth/login", loginHandler);
app.post("/api/auth/logout", logoutHandler);
app.get("/api/auth/me", meHandler);
app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "1.0.0" }));
app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => createContext({ req, res })
}));
var clientBuildPath = path2.join(__dirname2, "..", "..", "client-app", "dist");
if (existsSync(path2.join(clientBuildPath, "index.html"))) {
  app.use(express.static(clientBuildPath));
  app.get("*", (_req, res) => {
    res.sendFile(path2.join(clientBuildPath, "index.html"));
  });
} else {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  app.get("*", (req, res) => {
    if (devDomain) {
      res.redirect(`https://${devDomain}:5000${req.path}`);
    } else {
      res.redirect(`http://localhost:5000${req.path}`);
    }
  });
}
app.listen(ENV.port, () => {
  console.log(`Server running on http://localhost:${ENV.port}`);
});
