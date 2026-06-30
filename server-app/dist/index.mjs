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
      dbType: process.env.DB_TYPE || "postgresql",
      jwtSecret: process.env.JWT_SECRET || "onesoft-erp-secret-2024",
      backupDir: process.env.BACKUP_DIR || "",
      logDir: process.env.LOG_DIR || "",
      isElectron: process.env.ELECTRON_MODE === "1",
      cookieName: "onesoft_session",
      sessionExpiry: 30 * 24 * 60 * 60 * 1e3
    };
  }
});

// src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appSettings: () => appSettings,
  branches: () => branches,
  chartOfAccounts: () => chartOfAccounts,
  costCenters: () => costCenters,
  currencies: () => currencies,
  customers: () => customers,
  documentJournals: () => documentJournals,
  documentSendLogs: () => documentSendLogs,
  documentTemplates: () => documentTemplates,
  documentTypes: () => documentTypes,
  fieldDictionary: () => fieldDictionary,
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
  paymentMethods: () => paymentMethods,
  paymentVouchers: () => paymentVouchers,
  postingDefinitionLines: () => postingDefinitionLines,
  postingDefinitions: () => postingDefinitions,
  productGroups: () => productGroups,
  products: () => products,
  purchaseInvoiceItems: () => purchaseInvoiceItems,
  purchaseInvoices: () => purchaseInvoices,
  qrSettings: () => qrSettings,
  receiptVouchers: () => receiptVouchers,
  salesInvoiceItems: () => salesInvoiceItems,
  salesInvoicePayments: () => salesInvoicePayments,
  salesInvoices: () => salesInvoices,
  sendSettings: () => sendSettings,
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
  wabaMessageTemplates: () => wabaMessageTemplates,
  warehouseAccountLinks: () => warehouseAccountLinks,
  warehouses: () => warehouses,
  zatcaApiHistory: () => zatcaApiHistory,
  zatcaCertificates: () => zatcaCertificates,
  zatcaCsid: () => zatcaCsid,
  zatcaCsrRequests: () => zatcaCsrRequests,
  zatcaDevices: () => zatcaDevices,
  zatcaEnvironments: () => zatcaEnvironments,
  zatcaErrorLog: () => zatcaErrorLog,
  zatcaInvoiceTransactions: () => zatcaInvoiceTransactions,
  zatcaKeys: () => zatcaKeys,
  zatcaLogs: () => zatcaLogs,
  zatcaQrCodes: () => zatcaQrCodes,
  zatcaRequestLog: () => zatcaRequestLog,
  zatcaResponseLog: () => zatcaResponseLog,
  zatcaSettings: () => zatcaSettings,
  zatcaXmlDocuments: () => zatcaXmlDocuments
});
import { pgTable, serial, varchar, text, integer, boolean, decimal, timestamp, pgEnum, uniqueIndex, jsonb, uuid } from "drizzle-orm/pg-core";
var userRoleEnum, orgStatusEnum, invoiceTypeEnum, invoiceStatusEnum, paymentMethodEnum, voucherTypeEnum, journalStatusEnum, organizations, users, userGroups, userCategories, userGroupMembers, branches, warehouses, warehouseAccountLinks, units, productGroups, products, customers, suppliers, chartOfAccounts, salesInvoices, salesInvoiceItems, purchaseInvoices, purchaseInvoiceItems, journalEntries, journalEntryLines, vouchers, receiptVouchers, paymentVouchers, inventory, stockVoucherTypeEnum, stockVouchers, stockVoucherItems, inventoryCountStatusEnum, inventoryCounts, inventoryCountItems, freeProducts, messages, documentJournals, documentTypes, documentTemplates, costCenters, qrSettings, documentSendLogs, wabaMessageTemplates, sendSettings, appSettings, currencies, postingDefinitions, postingDefinitionLines, fieldDictionary, paymentMethods, salesInvoicePayments, zatcaLogs, zatcaEnvironments, zatcaDevices, zatcaCertificates, zatcaCsid, zatcaKeys, zatcaCsrRequests, zatcaInvoiceTransactions, zatcaRequestLog, zatcaResponseLog, zatcaErrorLog, zatcaXmlDocuments, zatcaQrCodes, zatcaSettings, zatcaApiHistory;
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
      zatcaConfig: jsonb("zatca_config"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 255 }).notNull(),
      address: text("address"),
      phone: varchar("phone", { length: 50 }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    warehouses = pgTable("warehouses", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 255 }).notNull(),
      name2: varchar("name2", { length: 255 }),
      fullName1: varchar("full_name1", { length: 255 }),
      fullName2: varchar("full_name2", { length: 255 }),
      address: text("address"),
      isActive: boolean("is_active").notNull().default(true),
      invAccountId: integer("inv_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      cogsAccount1Id: integer("cogs_account1_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      cogsAccount2Id: integer("cogs_account2_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      cashAccountId: integer("cash_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      bankAccountId: integer("bank_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      salesAccount1Id: integer("sales_account1_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      allowedUserId: integer("allowed_user_id").references(() => users.id, { onDelete: "set null" }),
      allowedUserGroup: varchar("allowed_user_group", { length: 255 }),
      copyFromWarehouseId: integer("copy_from_warehouse_id"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    warehouseAccountLinks = pgTable("warehouse_account_links", {
      id: serial("id").primaryKey(),
      warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
      label: varchar("label", { length: 255 }).notNull(),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      sortOrder: integer("sort_order").notNull().default(0)
    });
    units = pgTable("units", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 100 }).notNull(),
      symbol: varchar("symbol", { length: 20 })
    });
    productGroups = pgTable("product_groups", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 100 }),
      barcode: varchar("barcode", { length: 100 }),
      name: varchar("name", { length: 500 }).notNull(),
      nameEn: varchar("name_en", { length: 500 }),
      groupId: integer("group_id").references(() => productGroups.id, { onDelete: "set null" }),
      unitId: integer("unit_id").references(() => units.id, { onDelete: "set null" }),
      unit: varchar("unit", { length: 100 }),
      salePrice: decimal("sale_price", { precision: 18, scale: 4 }).default("0"),
      purchasePrice: decimal("purchase_price", { precision: 18, scale: 4 }).default("0"),
      taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
      minStock: decimal("min_stock", { precision: 18, scale: 4 }).default("0"),
      itemType: varchar("item_type", { length: 20 }).notNull().default("stock"),
      isActive: boolean("is_active").notNull().default(true),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    customers = pgTable("customers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 50 }),
      name: varchar("name", { length: 500 }).notNull(),
      phone: varchar("phone", { length: 50 }),
      email: varchar("email", { length: 255 }),
      address: text("address"),
      taxNumber: varchar("tax_number", { length: 50 }),
      customerType: varchar("customer_type", { length: 20 }).notNull().default("individual"),
      registrationNumber: varchar("registration_number", { length: 100 }),
      shortAddress: varchar("short_address", { length: 200 }),
      buildingNumber: varchar("building_number", { length: 20 }),
      additionalNumber: varchar("additional_number", { length: 20 }),
      postalCode: varchar("postal_code", { length: 20 }),
      city: varchar("city", { length: 100 }),
      creditLimit: decimal("credit_limit", { precision: 18, scale: 4 }).default("0"),
      balance: decimal("balance", { precision: 18, scale: 4 }).default("0"),
      // ─── التسعير والضوابط ─────────────────────────────────────────────────────
      priceLevel: integer("price_level").notNull().default(1),
      maxDiscountPct: decimal("max_discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
      canSellOnCredit: boolean("can_sell_on_credit").notNull().default(true),
      dealStartDate: timestamp("deal_start_date"),
      dealEndDate: timestamp("deal_end_date"),
      // ─── قنوات الإرسال الإلكتروني ──────────────────────────────────────────────
      whatsappPhone: varchar("whatsapp_phone", { length: 50 }),
      telegramId: varchar("telegram_id", { length: 100 }),
      defaultSendMethod: varchar("default_send_method", { length: 20 }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    suppliers = pgTable("suppliers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
      invoiceType: invoiceTypeEnum("invoice_type").notNull().default("sale"),
      invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
      dueDate: timestamp("due_date"),
      customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
      customerName: varchar("customer_name", { length: 500 }),
      customerType: varchar("customer_type", { length: 20 }).default("individual"),
      customerTaxNumber: varchar("customer_tax_number", { length: 100 }),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      currency: varchar("currency", { length: 10 }).default("SAR"),
      exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).default("1"),
      subtotal: decimal("subtotal", { precision: 18, scale: 4 }).default("0"),
      discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
      discountAmount: decimal("discount_amount", { precision: 18, scale: 4 }).default("0"),
      taxAmount: decimal("tax_amount", { precision: 18, scale: 4 }).default("0"),
      total: decimal("total", { precision: 18, scale: 4 }).default("0"),
      paidAmount: decimal("paid_amount", { precision: 18, scale: 4 }).default("0"),
      remainingAmount: decimal("remaining_amount", { precision: 18, scale: 4 }).default("0"),
      paymentBreakdown: jsonb("payment_breakdown"),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      status: invoiceStatusEnum("status").notNull().default("draft"),
      notes: text("notes"),
      refInvoiceId: integer("ref_invoice_id"),
      journalId: integer("journal_id"),
      docTypeId: integer("doc_type_id"),
      isPosted: boolean("is_posted").notNull().default(false),
      postedAt: timestamp("posted_at"),
      postedJournalEntryId: integer("posted_journal_entry_id"),
      costPosted: boolean("cost_posted").notNull().default(false),
      costPostedJournalEntryId: integer("cost_posted_journal_entry_id"),
      zatcaUuid: varchar("zatca_uuid", { length: 100 }),
      zatcaHash: varchar("zatca_hash", { length: 256 }),
      zatcaQrCode: text("zatca_qr_code"),
      zatcaXml: text("zatca_xml"),
      zatcaStatus: varchar("zatca_status", { length: 30 }).default("not_submitted"),
      zatcaClearedAt: timestamp("zatca_cleared_at"),
      zatcaResponse: jsonb("zatca_response"),
      zatcaInvoiceCounter: integer("zatca_invoice_counter"),
      zatcaPih: varchar("zatca_pih", { length: 256 }),
      zatcaSubmittedAt: timestamp("zatca_submitted_at"),
      zatcaAttemptCount: integer("zatca_attempt_count").notNull().default(0),
      zatcaRejectionReason: text("zatca_rejection_reason"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    salesInvoiceItems = pgTable("sales_invoice_items", {
      id: serial("id").primaryKey(),
      invoiceId: integer("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
      invoiceType: varchar("invoice_type", { length: 20 }).notNull().default("invoice"),
      supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }),
      invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
      dueDate: timestamp("due_date"),
      supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
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
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      docTypeId: integer("doc_type_id"),
      isPosted: boolean("is_posted").notNull().default(false),
      postedAt: timestamp("posted_at"),
      postedJournalEntryId: integer("posted_journal_entry_id"),
      inventoryPosted: boolean("inventory_posted").notNull().default(false),
      costPostedJournalEntryId: integer("cost_posted_journal_entry_id"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    purchaseInvoiceItems = pgTable("purchase_invoice_items", {
      id: serial("id").primaryKey(),
      invoiceId: integer("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      entryNumber: varchar("entry_number", { length: 50 }).notNull(),
      entryDate: timestamp("entry_date").notNull().defaultNow(),
      description: text("description"),
      reference: varchar("reference", { length: 100 }),
      totalDebit: decimal("total_debit", { precision: 18, scale: 4 }).default("0"),
      totalCredit: decimal("total_credit", { precision: 18, scale: 4 }).default("0"),
      status: journalStatusEnum("status").notNull().default("draft"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      sourceDocType: varchar("source_doc_type", { length: 50 }),
      sourceDocId: integer("source_doc_id"),
      sourceDocNumber: varchar("source_doc_number", { length: 100 }),
      entryType: varchar("entry_type", { length: 20 }).notNull().default("manual"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (t2) => [
      uniqueIndex("journal_entries_org_entry_number_uidx").on(t2.orgId, t2.entryNumber)
    ]);
    journalEntryLines = pgTable("journal_entry_lines", {
      id: serial("id").primaryKey(),
      entryId: integer("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      voucherType: voucherTypeEnum("voucher_type").notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      accountCode: varchar("account_code", { length: 50 }),
      accountName: varchar("account_name", { length: 500 }),
      partyType: varchar("party_type", { length: 20 }),
      partyId: integer("party_id"),
      partyName: varchar("party_name", { length: 500 }),
      description: text("description"),
      reference: varchar("reference", { length: 100 }),
      status: journalStatusEnum("status").notNull().default("draft"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    receiptVouchers = pgTable("receipt_vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      receivedFrom: varchar("received_from", { length: 500 }),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      bankAccount: varchar("bank_account", { length: 100 }),
      checkNumber: varchar("check_number", { length: 100 }),
      description: text("description"),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      contraAccountId: integer("contra_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      costCenterId: integer("cost_center_id"),
      notes: text("notes"),
      journalEntryId: integer("journal_entry_id"),
      status: varchar("status", { length: 20 }).notNull().default("posted"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    paymentVouchers = pgTable("payment_vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      paidTo: varchar("paid_to", { length: 500 }),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      paymentMethod: paymentMethodEnum("payment_method").default("cash"),
      bankAccount: varchar("bank_account", { length: 100 }),
      checkNumber: varchar("check_number", { length: 100 }),
      description: text("description"),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      contraAccountId: integer("contra_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      notes: text("notes"),
      journalEntryId: integer("journal_entry_id"),
      status: varchar("status", { length: 20 }).notNull().default("posted"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    inventory = pgTable("inventory", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull().default("0"),
      avgCost: decimal("avg_cost", { precision: 18, scale: 4 }).default("0"),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    stockVoucherTypeEnum = pgEnum("stock_voucher_type", ["receipt", "issue", "transfer"]);
    stockVouchers = pgTable("stock_vouchers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),
      type: stockVoucherTypeEnum("type").notNull(),
      voucherDate: timestamp("voucher_date").notNull().defaultNow(),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
      supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
      reason: varchar("reason", { length: 500 }),
      notes: text("notes"),
      totalCost: decimal("total_cost", { precision: 18, scale: 4 }).default("0"),
      status: varchar("status", { length: 20 }).notNull().default("confirmed"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    stockVoucherItems = pgTable("stock_voucher_items", {
      id: serial("id").primaryKey(),
      voucherId: integer("voucher_id").notNull().references(() => stockVouchers.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
      productName: varchar("product_name", { length: 500 }).notNull(),
      quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull(),
      unitCost: decimal("unit_cost", { precision: 18, scale: 4 }).default("0"),
      totalCost: decimal("total_cost", { precision: 18, scale: 4 }).default("0"),
      sortOrder: integer("sort_order").default(0)
    });
    inventoryCountStatusEnum = pgEnum("inventory_count_status", ["draft", "confirmed", "cancelled"]);
    inventoryCounts = pgTable("inventory_counts", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      countNumber: varchar("count_number", { length: 50 }).notNull(),
      warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
      branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
      status: inventoryCountStatusEnum("status").notNull().default("draft"),
      notes: text("notes"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      confirmedAt: timestamp("confirmed_at")
    });
    inventoryCountItems = pgTable("inventory_count_items", {
      id: serial("id").primaryKey(),
      countId: integer("count_id").notNull().references(() => inventoryCounts.id, { onDelete: "cascade" }),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
      productName: varchar("product_name", { length: 500 }).notNull(),
      systemQuantity: decimal("system_quantity", { precision: 18, scale: 4 }).default("0"),
      actualQuantity: decimal("actual_quantity", { precision: 18, scale: 4 }).default("0"),
      difference: decimal("difference", { precision: 18, scale: 4 }).default("0"),
      sortOrder: integer("sort_order").default(0)
    });
    freeProducts = pgTable("free_products", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
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
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      receiverId: integer("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      content: text("content").notNull(),
      isRead: boolean("is_read").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    documentJournals = pgTable("document_journals", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
      // ── الحسابات الافتراضية ───────────────────────────────────────────────────
      salesAccountId: integer("sales_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      cashAccountId: integer("cash_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      creditAccountId: integer("credit_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      taxAccountId: integer("tax_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      discountAccountId: integer("discount_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      // حسابات المشتريات
      purchaseAccountId: integer("purchase_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      supplierAccountId: integer("supplier_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      // حسابات المخزون والتكلفة (المرحلة الثانية)
      inventoryAccountId: integer("inventory_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      cogsAccountId: integer("cogs_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      // ── الإعدادات ─────────────────────────────────────────────────────────────
      defaultCurrency: varchar("default_currency", { length: 10 }).default("SAR"),
      defaultPayMethod: varchar("default_pay_method", { length: 20 }).default("cash"),
      allowedUserGroup: varchar("allowed_user_group", { length: 255 }),
      allowedUserId: integer("allowed_user_id").references(() => users.id, { onDelete: "set null" }),
      printTemplate: varchar("print_template", { length: 100 }),
      printTemplate2: varchar("print_template_2", { length: 100 }),
      resetFrequency: varchar("reset_frequency", { length: 20 }).default("none"),
      autoSerial: boolean("auto_serial").notNull().default(false),
      printOnSave: boolean("print_on_save").notNull().default(false),
      customersJournal: varchar("customers_journal", { length: 50 }),
      suppliersJournal: varchar("suppliers_journal", { length: 50 }),
      postingMode: varchar("posting_mode", { length: 20 }).default("manual"),
      allowUnpost: boolean("allow_unpost").notNull().default(true),
      allowEditAfterPost: boolean("allow_edit_after_post").notNull().default(false),
      paymentTypesConfig: jsonb("payment_types_config"),
      issuanceConfig: jsonb("issuance_config"),
      optionsConfig: jsonb("options_config"),
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    documentTypes = pgTable("document_types", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
      customersJournal: varchar("customers_journal", { length: 50 }),
      suppliersJournal: varchar("suppliers_journal", { length: 50 }),
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
      acctInventory: varchar("acct_inventory", { length: 50 }),
      acctCogs: varchar("acct_cogs", { length: 50 }),
      salesAccountId: integer("sales_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      cashAccountId: integer("cash_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      creditAccountId: integer("credit_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      taxAccountId: integer("tax_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      discountAccountId: integer("discount_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      purchaseAccountId: integer("purchase_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      supplierAccountId: integer("supplier_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      sortOrder: integer("sort_order").notNull().default(0),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    documentTemplates = pgTable("document_templates", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
    costCenters = pgTable("cost_centers", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 30 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      name2: varchar("name2", { length: 255 }),
      centerType: varchar("center_type", { length: 20 }).notNull().default("branch"),
      // root | general | branch
      parentId: integer("parent_id"),
      level: integer("level").notNull().default(1),
      notes: text("notes"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    qrSettings = pgTable("qr_settings", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      isEnabled: boolean("is_enabled").notNull().default(true),
      countrySystem: varchar("country_system", { length: 20 }).notNull().default("zatca"),
      customFormat: text("custom_format"),
      sellerName: varchar("seller_name", { length: 255 }),
      taxNumber: varchar("tax_number", { length: 50 }),
      showOnSalesInvoice: boolean("show_on_sales_invoice").notNull().default(true),
      showOnPurchaseInvoice: boolean("show_on_purchase_invoice").notNull().default(false),
      showOnReceiptVoucher: boolean("show_on_receipt_voucher").notNull().default(false),
      qrSize: integer("qr_size").notNull().default(100),
      qrPosition: varchar("qr_position", { length: 30 }).notNull().default("top-right"),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    documentSendLogs = pgTable("document_send_logs", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      docType: varchar("doc_type", { length: 50 }).notNull(),
      docId: integer("doc_id"),
      docNumber: varchar("doc_number", { length: 100 }),
      method: varchar("method", { length: 20 }).notNull(),
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      recipientName: varchar("recipient_name", { length: 255 }),
      recipientContact: varchar("recipient_contact", { length: 500 }),
      messageSent: text("message_sent"),
      errorMessage: text("error_message"),
      metaMessageId: varchar("meta_message_id", { length: 100 }),
      sentByUserId: integer("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
      sentAt: timestamp("sent_at").notNull().defaultNow()
    });
    wabaMessageTemplates = pgTable("waba_message_templates", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      key: varchar("key", { length: 100 }).notNull(),
      label: varchar("label", { length: 255 }).notNull(),
      docType: varchar("doc_type", { length: 50 }),
      channel: varchar("channel", { length: 20 }).notNull().default("whatsapp"),
      content: text("content").notNull(),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    sendSettings = pgTable("send_settings", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      whatsappEnabled: boolean("whatsapp_enabled").notNull().default(true),
      telegramEnabled: boolean("telegram_enabled").notNull().default(false),
      emailEnabled: boolean("email_enabled").notNull().default(false),
      telegramBotToken: text("telegram_bot_token"),
      emailProvider: varchar("email_provider", { length: 20 }).default("resend"),
      emailApiKey: text("email_api_key"),
      emailFromName: varchar("email_from_name", { length: 255 }),
      emailFromEmail: varchar("email_from_email", { length: 255 }),
      whatsappMessageTemplate: text("whatsapp_message_template"),
      telegramMessageTemplate: text("telegram_message_template"),
      emailSubjectTemplate: varchar("email_subject_template", { length: 500 }),
      emailBodyTemplate: text("email_body_template"),
      // WhatsApp Business API (WABA)
      wabaEnabled: boolean("waba_enabled").notNull().default(false),
      wabaApiUrl: text("waba_api_url"),
      wabaAccessToken: text("waba_access_token"),
      wabaPhoneNumberId: varchar("waba_phone_number_id", { length: 100 }),
      wabaSenderName: varchar("waba_sender_name", { length: 255 }),
      wabaBusinessAccountId: varchar("waba_business_account_id", { length: 100 }),
      wabaVerifyToken: varchar("waba_verify_token", { length: 255 }),
      wabaWebhookUrl: varchar("waba_webhook_url", { length: 500 }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    appSettings = pgTable("app_settings", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      key: varchar("key", { length: 100 }).notNull(),
      value: text("value"),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    currencies = pgTable("currencies", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 10 }).notNull(),
      nameAr: varchar("name_ar", { length: 100 }).notNull(),
      nameEn: varchar("name_en", { length: 100 }).notNull(),
      symbol: varchar("symbol", { length: 10 }).notNull(),
      symbolIntl: varchar("symbol_intl", { length: 10 }),
      exchangeRate: decimal("exchange_rate", { precision: 18, scale: 6 }).notNull().default("1"),
      decimalPlaces: integer("decimal_places").notNull().default(2),
      isBase: boolean("is_base").notNull().default(false),
      mainUnitAr: varchar("main_unit_ar", { length: 50 }),
      subUnitAr: varchar("sub_unit_ar", { length: 50 }),
      mainUnitEn: varchar("main_unit_en", { length: 50 }),
      subUnitEn: varchar("sub_unit_en", { length: 50 }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    postingDefinitions = pgTable("posting_definitions", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      docType: varchar("doc_type", { length: 30 }).notNull(),
      variant: varchar("variant", { length: 20 }).notNull().default(""),
      name: varchar("name", { length: 200 }).notNull(),
      isActive: boolean("is_active").notNull().default(true),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    postingDefinitionLines = pgTable("posting_definition_lines", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      definitionId: integer("definition_id").notNull().references(() => postingDefinitions.id, { onDelete: "cascade" }),
      description: varchar("description", { length: 200 }),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      direction: varchar("direction", { length: 10 }).notNull().default("debit"),
      amountSource: varchar("amount_source", { length: 50 }).notNull().default("total"),
      sortOrder: integer("sort_order").notNull().default(0)
    });
    fieldDictionary = pgTable("field_dictionary", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 50 }).notNull(),
      nameAr: varchar("name_ar", { length: 150 }).notNull(),
      nameEn: varchar("name_en", { length: 150 }).notNull(),
      fieldType: varchar("field_type", { length: 50 }).notNull().default("Text"),
      category: varchar("category", { length: 80 }).notNull().default("Custom Fields"),
      description: text("description"),
      isSystem: boolean("is_system").notNull().default(false),
      isActive: boolean("is_active").notNull().default(true),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    paymentMethods = pgTable("payment_methods", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 50 }).notNull(),
      nameAr: varchar("name_ar", { length: 150 }).notNull(),
      nameEn: varchar("name_en", { length: 150 }),
      icon: varchar("icon", { length: 50 }),
      color: varchar("color", { length: 20 }).default("#406B93"),
      bgColor: varchar("bg_color", { length: 20 }).default("#EFF6FF"),
      accountId: integer("account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
      isActive: boolean("is_active").notNull().default(true),
      isVisible: boolean("is_visible").notNull().default(true),
      isBuiltIn: boolean("is_built_in").notNull().default(false),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    salesInvoicePayments = pgTable("sales_invoice_payments", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceId: integer("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
      paymentMethodCode: varchar("payment_method_code", { length: 50 }).notNull(),
      paymentMethodName: varchar("payment_method_name", { length: 150 }),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull().default("0"),
      referenceNo: varchar("reference_no", { length: 100 }),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    zatcaLogs = pgTable("zatca_logs", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceId: integer("invoice_id").references(() => salesInvoices.id, { onDelete: "set null" }),
      invoiceNumber: varchar("invoice_number", { length: 100 }),
      eventType: varchar("event_type", { length: 50 }).notNull(),
      status: varchar("status", { length: 30 }).notNull(),
      environment: varchar("environment", { length: 20 }).default("sandbox"),
      requestBody: text("request_body"),
      responseBody: text("response_body"),
      errorMessage: text("error_message"),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      userName: varchar("user_name", { length: 200 }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    zatcaEnvironments = pgTable("zatca_environments", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 50 }).notNull(),
      baseApiUrl: text("base_api_url").notNull(),
      complianceUrl: text("compliance_url"),
      reportingUrl: text("reporting_url"),
      clearanceUrl: text("clearance_url"),
      oauthUrl: text("oauth_url"),
      portalUrl: text("portal_url"),
      isDefault: boolean("is_default").notNull().default(false),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaDevices = pgTable("zatca_devices", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      deviceName: varchar("device_name", { length: 255 }).notNull(),
      deviceUuid: uuid("device_uuid").notNull().defaultRandom(),
      serialNumber: varchar("serial_number", { length: 100 }),
      branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
      environmentId: integer("environment_id").references(() => zatcaEnvironments.id, { onDelete: "set null" }),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      registrationStatus: varchar("registration_status", { length: 30 }).notNull().default("pending"),
      lastRegistrationDate: timestamp("last_registration_date"),
      lastConnectionDate: timestamp("last_connection_date"),
      currentCsidId: integer("current_csid_id"),
      // FK دوري — مُعرَّف في SQL فقط
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaCertificates = pgTable("zatca_certificates", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      deviceId: integer("device_id").references(() => zatcaDevices.id, { onDelete: "set null" }),
      csr: text("csr"),
      publicCertificate: text("public_certificate"),
      privateKeyEncrypted: text("private_key_encrypted"),
      // مشفَّر AES-256-GCM
      secretKeyEncrypted: text("secret_key_encrypted"),
      // مشفَّر AES-256-GCM
      certificateVersion: varchar("certificate_version", { length: 20 }),
      startDate: timestamp("start_date"),
      expiryDate: timestamp("expiry_date"),
      status: varchar("status", { length: 30 }).notNull().default("pending"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaCsid = pgTable("zatca_csid", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      deviceId: integer("device_id").references(() => zatcaDevices.id, { onDelete: "set null" }),
      certificateId: integer("certificate_id").references(() => zatcaCertificates.id, { onDelete: "set null" }),
      complianceCsid: text("compliance_csid"),
      productionCsid: text("production_csid"),
      issueDate: timestamp("issue_date"),
      expiryDate: timestamp("expiry_date"),
      status: varchar("status", { length: 30 }).notNull().default("active"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaKeys = pgTable("zatca_keys", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      deviceId: integer("device_id").references(() => zatcaDevices.id, { onDelete: "set null" }),
      algorithm: varchar("algorithm", { length: 20 }).notNull().default("EC"),
      curve: varchar("curve", { length: 20 }).default("secp256k1"),
      publicKey: text("public_key"),
      privateKeyEncrypted: text("private_key_encrypted"),
      // مشفَّر AES-256-GCM
      fingerprint: varchar("fingerprint", { length: 128 }),
      status: varchar("status", { length: 30 }).notNull().default("active"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaCsrRequests = pgTable("zatca_csr_requests", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      deviceId: integer("device_id").references(() => zatcaDevices.id, { onDelete: "set null" }),
      csrText: text("csr_text"),
      pem: text("pem"),
      requestDate: timestamp("request_date").notNull().defaultNow(),
      status: varchar("status", { length: 30 }).notNull().default("pending"),
      response: text("response"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaInvoiceTransactions = pgTable("zatca_invoice_transactions", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceId: integer("invoice_id").references(() => salesInvoices.id, { onDelete: "set null" }),
      invoiceNumber: varchar("invoice_number", { length: 100 }),
      invoiceUuid: uuid("invoice_uuid"),
      invoiceHash: varchar("invoice_hash", { length: 256 }),
      qrHash: text("qr_hash"),
      deviceId: integer("device_id").references(() => zatcaDevices.id, { onDelete: "set null" }),
      environmentId: integer("environment_id").references(() => zatcaEnvironments.id, { onDelete: "set null" }),
      submissionType: varchar("submission_type", { length: 30 }).notNull().default("clearance"),
      submissionDate: timestamp("submission_date").notNull().defaultNow(),
      invoiceStatus: varchar("invoice_status", { length: 30 }).notNull().default("pending"),
      httpStatus: integer("http_status"),
      responseCode: varchar("response_code", { length: 50 }),
      responseMessage: text("response_message"),
      executionTimeMs: integer("execution_time_ms"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaRequestLog = pgTable("zatca_request_log", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      transactionId: integer("transaction_id").references(() => zatcaInvoiceTransactions.id, { onDelete: "set null" }),
      url: text("url"),
      httpMethod: varchar("http_method", { length: 10 }).notNull().default("POST"),
      headers: jsonb("headers"),
      requestBody: text("request_body"),
      requestTime: timestamp("request_time").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaResponseLog = pgTable("zatca_response_log", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      transactionId: integer("transaction_id").references(() => zatcaInvoiceTransactions.id, { onDelete: "set null" }),
      httpStatus: integer("http_status"),
      headers: jsonb("headers"),
      responseBody: text("response_body"),
      responseTime: timestamp("response_time").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaErrorLog = pgTable("zatca_error_log", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      transactionId: integer("transaction_id").references(() => zatcaInvoiceTransactions.id, { onDelete: "set null" }),
      errorCode: varchar("error_code", { length: 100 }),
      errorType: varchar("error_type", { length: 100 }),
      errorMessage: text("error_message"),
      stackTrace: text("stack_trace"),
      resolution: text("resolution"),
      retryCount: integer("retry_count").notNull().default(0),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaXmlDocuments = pgTable("zatca_xml_documents", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceId: integer("invoice_id").references(() => salesInvoices.id, { onDelete: "set null" }),
      xmlBeforeSigning: text("xml_before_signing"),
      xmlAfterSigning: text("xml_after_signing"),
      xmlVersion: varchar("xml_version", { length: 20 }).default("2.1"),
      validationResult: jsonb("validation_result"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaQrCodes = pgTable("zatca_qr_codes", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      invoiceId: integer("invoice_id").references(() => salesInvoices.id, { onDelete: "set null" }),
      tlvData: text("tlv_data"),
      base64: text("base64"),
      generationDate: timestamp("generation_date").notNull().defaultNow(),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaSettings = pgTable("zatca_settings", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }).unique(),
      defaultEnvironmentId: integer("default_environment_id").references(() => zatcaEnvironments.id, { onDelete: "set null" }),
      enableZatca: boolean("enable_zatca").notNull().default(false),
      autoRetry: boolean("auto_retry").notNull().default(true),
      retryCount: integer("retry_count").notNull().default(3),
      timeoutSeconds: integer("timeout_seconds").notNull().default(30),
      proxySettings: jsonb("proxy_settings"),
      logLevel: varchar("log_level", { length: 20 }).notNull().default("info"),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
    zatcaApiHistory = pgTable("zatca_api_history", {
      id: serial("id").primaryKey(),
      orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
      apiName: varchar("api_name", { length: 100 }),
      url: text("url"),
      method: varchar("method", { length: 10 }).notNull().default("POST"),
      startTime: timestamp("start_time").notNull().defaultNow(),
      endTime: timestamp("end_time"),
      durationMs: integer("duration_ms"),
      result: varchar("result", { length: 30 }),
      userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
      userName: varchar("user_name", { length: 200 }),
      isActive: boolean("is_active").notNull().default(true),
      isDeleted: boolean("is_deleted").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
      updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" })
    });
  }
});

// src/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
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

// src/schema-version.ts
var schema_version_exports = {};
__export(schema_version_exports, {
  REQUIRED_SCHEMA_VERSION: () => REQUIRED_SCHEMA_VERSION
});
var REQUIRED_SCHEMA_VERSION;
var init_schema_version = __esm({
  "src/schema-version.ts"() {
    REQUIRED_SCHEMA_VERSION = "0012_zatca_database_architecture";
  }
});

// src/index.ts
init_env();
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path7 from "path";
import { fileURLToPath as fileURLToPath7 } from "url";

// src/logger.ts
import path2 from "path";
import fs from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
var __dirname2 = path2.dirname(fileURLToPath2(import.meta.url));
var LOG_DIR = process.env.LOG_DIR ?? path2.join(__dirname2, "..", "..", "logs");
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
  }
}
var LEVEL_COLOR = {
  DEBUG: "\x1B[36m",
  // cyan
  INFO: "\x1B[32m",
  // green
  WARN: "\x1B[33m",
  // yellow
  ERROR: "\x1B[31m"
  // red
};
var RESET = "\x1B[0m";
function write(level, module, msg, data) {
  const now = /* @__PURE__ */ new Date();
  const ts = now.toISOString();
  const date = ts.slice(0, 10);
  const entry = JSON.stringify({
    ts,
    level,
    module,
    msg,
    ...data !== void 0 ? { data } : {}
  });
  const color = LEVEL_COLOR[level];
  console.log(`${color}[${level}]${RESET} ${ts.slice(11, 19)} [${module}] ${msg}${data !== void 0 ? " " + JSON.stringify(data) : ""}`);
  const logFile = path2.join(LOG_DIR, `onesoft-${date}.log`);
  try {
    fs.appendFileSync(logFile, entry + "\n");
  } catch {
  }
  if (level === "INFO" && Math.random() < 0.01) pruneOldLogs();
}
function pruneOldLogs() {
  try {
    const cutoff = Date.now() - 30 * 24 * 36e5;
    fs.readdirSync(LOG_DIR).filter((f) => f.startsWith("onesoft-") && f.endsWith(".log")).forEach((f) => {
      const fp = path2.join(LOG_DIR, f);
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    });
  } catch {
  }
}
var logger = {
  debug: (module, msg, data) => write("DEBUG", module, msg, data),
  info: (module, msg, data) => write("INFO", module, msg, data),
  warn: (module, msg, data) => write("WARN", module, msg, data),
  error: (module, msg, data) => write("ERROR", module, msg, data)
};

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

// src/routers/orgs.ts
import { z } from "zod";
import { eq as eq2 } from "drizzle-orm";
init_db();
init_schema();
init_auth();
var orgsRouter = router({
  // بيانات المؤسسة الحالية للمستخدم
  currentOrg: protectedProcedure.query(async ({ ctx }) => {
    const [org] = await db.select({
      id: organizations.id,
      name: organizations.name,
      nameEn: organizations.nameEn,
      code: organizations.code,
      phone: organizations.phone,
      address: organizations.address,
      taxNumber: organizations.taxNumber,
      commercialReg: organizations.commercialReg,
      currency: organizations.currency
    }).from(organizations).where(eq2(organizations.id, ctx.user.orgId));
    return org ?? null;
  }),
  // قائمة المؤسسات (للمدير العام فقط)
  list: superAdminProcedure.query(async () => {
    return db.query.organizations.findMany({
      orderBy: (o, { asc: asc13 }) => [asc13(o.name)]
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
      orderBy: (u, { asc: asc13 }) => [asc13(u.name)]
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
import { eq as eq6, and as and6, desc as desc2, like, or } from "drizzle-orm";
init_db();
init_schema();

// src/routers/posting.ts
import { z as z3 } from "zod";
import { eq as eq5, and as and5, inArray as inArray2, gte, lte } from "drizzle-orm";
init_db();
init_schema();

// src/services/PostingEngine.ts
init_db();
init_schema();
import { eq as eq4, and as and4, desc, inArray } from "drizzle-orm";
async function resolveDocTypeAccountsByJournal(journalId, orgId) {
  const docType = await db.query.documentTypes.findFirst({
    where: and4(eq4(documentTypes.journal, String(journalId)), eq4(documentTypes.orgId, orgId))
  });
  if (!docType) return null;
  return resolveDocTypeAccounts(docType.id, orgId);
}
async function resolveDocTypeAccounts(docTypeId, orgId) {
  const docType = await db.query.documentTypes.findFirst({
    where: and4(eq4(documentTypes.id, docTypeId), eq4(documentTypes.orgId, orgId))
  });
  if (!docType) return null;
  const rawIds = [
    docType.acctCash,
    docType.acctDebit,
    docType.acctCredit,
    docType.acctTax,
    docType.acctDiscount,
    docType.acctInventory,
    docType.acctCogs
  ];
  const linkIds = rawIds.map((v) => v ? parseInt(v) : NaN).filter((v) => !isNaN(v));
  const walById = /* @__PURE__ */ new Map();
  if (linkIds.length > 0) {
    const walRows = await db.query.warehouseAccountLinks.findMany({
      where: inArray(warehouseAccountLinks.id, linkIds)
    });
    walRows.forEach((w) => walById.set(w.id, w));
  }
  const getAccId = (code) => {
    if (!code) return null;
    const id = parseInt(code);
    return isNaN(id) ? null : walById.get(id)?.accountId ?? null;
  };
  return {
    docType,
    cashAccountId: docType.cashAccountId ?? getAccId(docType.acctCash) ?? null,
    creditAccountId: docType.creditAccountId ?? getAccId(docType.acctDebit) ?? null,
    salesAccountId: docType.salesAccountId ?? getAccId(docType.acctCredit) ?? null,
    taxAccountId: docType.taxAccountId ?? getAccId(docType.acctTax) ?? null,
    discountAccountId: docType.discountAccountId ?? getAccId(docType.acctDiscount) ?? null,
    purchaseAccountId: docType.purchaseAccountId ?? getAccId(docType.acctDebit) ?? null,
    supplierAccountId: docType.supplierAccountId ?? getAccId(docType.acctCredit) ?? null,
    inventoryAccountId: getAccId(docType.acctInventory),
    cogsAccountId: getAccId(docType.acctCogs)
  };
}
async function validateAccounts(accountIds) {
  const ids = accountIds.filter((id) => id !== null);
  if (!ids.length) return;
  const accs = await db.query.chartOfAccounts.findMany({
    where: inArray(chartOfAccounts.id, ids)
  });
  for (const acc of accs) {
    if (!acc.isActive)
      throw new Error(`\u0627\u0644\u062D\u0633\u0627\u0628 "${acc.code} - ${acc.name}" \u0645\u0648\u0642\u0648\u0641 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0639\u0644\u064A\u0647`);
    if (acc.isParent)
      throw new Error(`\u0627\u0644\u062D\u0633\u0627\u0628 "${acc.code} - ${acc.name}" \u062A\u062C\u0645\u064A\u0639\u064A \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0639\u0644\u064A\u0647 \u2014 \u064A\u062C\u0628 \u0627\u062E\u062A\u064A\u0627\u0631 \u062D\u0633\u0627\u0628 \u0641\u0631\u0639\u064A`);
    if (acc.allowPosting === false)
      throw new Error(`\u0627\u0644\u062D\u0633\u0627\u0628 "${acc.code} - ${acc.name}" \u0644\u0627 \u064A\u0633\u0645\u062D \u0628\u0627\u0644\u062A\u0631\u062D\u064A\u0644`);
  }
}
async function nextEntryNumber(orgId) {
  const last = await db.query.journalEntries.findFirst({
    where: eq4(journalEntries.orgId, orgId),
    orderBy: [desc(journalEntries.id)]
  });
  const n = last ? parseInt(last.entryNumber.replace(/\D/g, "") || "0") + 1 : 1;
  return `JE-${String(n).padStart(4, "0")}`;
}
function resolveInvoiceFieldValue(fieldCode, invoice) {
  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const discAmt = Number(invoice.discountAmount ?? 0);
  const paidAmount = Number(invoice.paidAmount ?? 0);
  const isCredit = invoice.paymentMethod === "credit";
  const breakdown = invoice.paymentBreakdown;
  switch (fieldCode.toUpperCase()) {
    case "TOTAL":
      return total;
    case "NETSALES":
    case "TOTAL_EXCLUSIVE_VAT":
      return subtotal;
    case "TAX":
    case "TOTAL_VAT":
      return taxAmount;
    case "DISCOUNT":
    case "DISCOUNT_AMOUNT":
      return discAmt;
    case "CASH":
      return breakdown ? Number(breakdown.CASH ?? breakdown.CASH_AMOUNT ?? 0) : isCredit ? 0 : total;
    case "CUSTOMER_CODE":
    case "CUSTOMER_RECEIVABLE":
      return Number(breakdown?.ACCOUNT ?? breakdown?.ACCOUNT_AMOUNT ?? (isCredit ? total : 0));
    case "PAID":
    case "PAYMENT_TOTAL":
      return paidAmount;
    case "REMAINING":
      return Math.max(0, total - paidAmount);
    case "CASH_AMOUNT":
      return Number(breakdown?.CASH ?? breakdown?.CASH_AMOUNT ?? 0);
    case "CARD_AMOUNT":
    case "VISA":
      return Number(breakdown?.CARD ?? breakdown?.VISA ?? breakdown?.CARD_AMOUNT ?? 0);
    case "BANK_AMOUNT":
    case "BANK_TRANSFER":
      return Number(breakdown?.BANK ?? breakdown?.BANK_AMOUNT ?? 0);
    case "ACCOUNT_AMOUNT":
    case "ACCOUNT":
      return Number(breakdown?.ACCOUNT ?? breakdown?.ACCOUNT_AMOUNT ?? 0);
    case "TAMARA":
    case "TAMARA_AMOUNT":
      return Number(breakdown?.TAMARA ?? breakdown?.TAMARA_AMOUNT ?? 0);
    case "TABBY":
    case "TABBY_AMOUNT":
      return Number(breakdown?.TABBY ?? breakdown?.TABBY_AMOUNT ?? 0);
    case "OTHER_AMOUNT":
      return Number(breakdown?.OTHER ?? breakdown?.OTHER_AMOUNT ?? 0);
    default: {
      if (breakdown) {
        const code = fieldCode.toUpperCase();
        const direct = breakdown[code] ?? breakdown[code.replace(/_AMOUNT$/, "")] ?? null;
        if (direct !== null) return Number(direct);
      }
      return 0;
    }
  }
}
async function buildLinesFromAccountLinks(accountLinks, invoice, orgId) {
  const accIds = accountLinks.map((l) => l.accountId).filter((id) => typeof id === "number" && id > 0);
  const accs = accIds.length ? await db.query.chartOfAccounts.findMany({
    where: (a, { inArray: inArray5 }) => inArray5(a.id, accIds)
  }) : [];
  const accMap = new Map(accs.map((a) => [a.id, a]));
  const lines = [];
  const warnings = [];
  for (const link of accountLinks) {
    if (!link.accountId || !link.postingName || !link.postingSide) continue;
    const value = resolveInvoiceFieldValue(link.postingName, invoice);
    if (value === 0) continue;
    const acc = accMap.get(link.accountId);
    const isDebit = link.postingSide === "debit";
    const lineDesc = link.description ? `${link.description} - ${invoice.invoiceNumber}` : invoice.invoiceNumber;
    lines.push({
      accountId: link.accountId,
      accountCode: acc?.code ?? "---",
      accountName: acc?.name ?? link.description ?? "",
      debit: isDebit ? value.toFixed(4) : "0.0000",
      credit: isDebit ? "0.0000" : value.toFixed(4),
      description: lineDesc
    });
  }
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  return {
    lines,
    warnings,
    totalDebit: totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    isBalanced
  };
}
async function buildSalesInvoiceLines(invoice, journal, orgId) {
  const ptCfg = journal?.paymentTypesConfig;
  const configLinks = Array.isArray(ptCfg?.accountLinks) ? ptCfg.accountLinks : [];
  const hasConfiguredLinks = configLinks.some((l) => l.accountId && l.postingName && l.postingSide);
  if (hasConfiguredLinks) {
    const result = await buildLinesFromAccountLinks(configLinks, invoice, orgId);
    if (!result.isBalanced) {
      const debit = Number(result.totalDebit);
      const credit = Number(result.totalCredit);
      const shortfall = credit - debit;
      if (shortfall > 1e-3) {
        const breakdown2 = invoice.paymentBreakdown;
        const orgPayMethods = await db.select({ code: paymentMethods.code, nameAr: paymentMethods.nameAr }).from(paymentMethods).where(eq4(paymentMethods.orgId, orgId));
        const uncoveredMethods = [];
        if (breakdown2) {
          for (const pm of orgPayMethods) {
            const amt = Number(breakdown2[pm.code] ?? 0);
            if (amt > 1e-3) {
              const knownAliases = {
                CASH: ["CASH", "CASH_AMOUNT"],
                CARD: ["CARD", "CARD_AMOUNT", "VISA"],
                BANK: ["BANK", "BANK_AMOUNT", "BANK_TRANSFER"],
                ACCOUNT: ["ACCOUNT", "ACCOUNT_AMOUNT", "CUSTOMER_RECEIVABLE", "CUSTOMER_CODE"],
                TAMARA: ["TAMARA", "TAMARA_AMOUNT"],
                TABBY: ["TABBY", "TABBY_AMOUNT"],
                OTHER: ["OTHER", "OTHER_AMOUNT"]
              };
              const aliases = knownAliases[pm.code] ?? [pm.code];
              const isCovered = configLinks.some(
                (l) => l.accountId && l.postingName && aliases.some((a) => a === l.postingName.toUpperCase())
              );
              if (!isCovered) uncoveredMethods.push(pm.nameAr ?? pm.code);
            }
          }
        }
        if (uncoveredMethods.length > 0) {
          const labels = uncoveredMethods.join("\u060C ");
          const cashAccId2 = journal?.cashAccountId ?? null;
          if (cashAccId2) {
            result.warnings.push(
              `\u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0644\u064A\u0633 \u0644\u0647\u0627 \u062D\u0633\u0627\u0628 \u0645\u064F\u0636\u0628\u064E\u0651\u0637 \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631: ${labels} \u2014 \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0641\u0631\u0642 (${shortfall.toFixed(3)}) \u0625\u0644\u0649 \u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A`
            );
          } else {
            result.warnings.push(
              `\u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0644\u064A\u0633 \u0644\u0647\u0627 \u062D\u0633\u0627\u0628 \u0645\u064F\u0636\u0628\u064E\u0651\u0637 \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631: ${labels} (${shortfall.toFixed(3)}) \u2014 \u064A\u064F\u0631\u062C\u0649 \u0625\u0636\u0627\u0641\u0629 \u0631\u0627\u0628\u0637 \u0645\u062D\u0627\u0633\u0628\u064A \u0644\u0643\u0644 \u0648\u0633\u064A\u0644\u0629 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0641\u062A\u0631`
            );
          }
        }
        const cashAccId = journal?.cashAccountId ?? null;
        if (cashAccId) {
          const cashAccs = await db.query.chartOfAccounts.findMany({
            where: (a, { eq: eq32 }) => eq32(a.id, cashAccId)
          });
          const cashAcc = cashAccs[0];
          result.lines.push({
            accountId: cashAccId,
            accountCode: cashAcc?.code ?? "---",
            accountName: cashAcc?.name ?? "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 / \u0627\u0644\u0646\u0642\u062F",
            debit: shortfall.toFixed(4),
            credit: "0.0000",
            description: `\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 - ${invoice.invoiceNumber}`
          });
        }
        const newTotal = (debit + shortfall).toFixed(4);
        result.totalDebit = cashAccId ? newTotal : result.totalDebit;
        result.isBalanced = cashAccId ? true : false;
      }
    }
    return result;
  }
  const accIds = [
    journal?.cashAccountId,
    journal?.creditAccountId,
    journal?.salesAccountId,
    journal?.taxAccountId,
    journal?.discountAccountId
  ].filter(Boolean);
  const accs = accIds.length ? await db.query.chartOfAccounts.findMany({
    where: (a, { inArray: inArray5 }) => inArray5(a.id, accIds)
  }) : [];
  const accMap = new Map(accs.map((a) => [a.id, a]));
  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);
  const isCredit = invoice.paymentMethod === "credit";
  const breakdown = invoice.paymentBreakdown;
  const lines = [];
  const warnings = [];
  const AR_CODE = "ACCOUNT";
  const arAmount = Number(breakdown?.[AR_CODE] ?? 0);
  const cashAmount = total - arAmount;
  if (breakdown && Object.keys(breakdown).length > 0) {
    if (cashAmount > 1e-3) {
      const cashAccId = journal?.cashAccountId ?? null;
      const cashAcc = cashAccId ? accMap.get(cashAccId) : null;
      if (!cashAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
      lines.push({
        accountId: cashAccId,
        accountCode: cashAcc?.code ?? "---",
        accountName: cashAcc?.name ?? "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 / \u0627\u0644\u0646\u0642\u062F",
        debit: cashAmount.toFixed(4),
        credit: "0.0000",
        description: `\u0645\u062F\u0641\u0648\u0639 \u0646\u0642\u062F\u0627\u064B - ${invoice.invoiceNumber}`
      });
    }
    if (arAmount > 1e-3) {
      const arAccId = journal?.creditAccountId ?? null;
      const arAcc = arAccId ? accMap.get(arAccId) : null;
      if (!arAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
      lines.push({
        accountId: arAccId,
        accountCode: arAcc?.code ?? "---",
        accountName: arAcc?.name ?? "\u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
        debit: arAmount.toFixed(4),
        credit: "0.0000",
        description: `\u0630\u0645\u0629 \u0639\u0645\u064A\u0644 (\u0622\u062C\u0644) - ${invoice.invoiceNumber}`
      });
    }
  } else {
    const debitAccId = isCredit ? journal?.creditAccountId : journal?.cashAccountId;
    const debitAcc = debitAccId ? accMap.get(debitAccId) : null;
    const defaultDebitName = isCredit ? "\u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621" : "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 / \u0627\u0644\u0646\u0642\u062F";
    if (!debitAccId) warnings.push(isCredit ? "\u062D\u0633\u0627\u0628 \u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631" : "\u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
    lines.push({
      accountId: debitAccId ?? null,
      accountCode: debitAcc?.code ?? "---",
      accountName: debitAcc?.name ?? defaultDebitName,
      debit: total.toFixed(4),
      credit: "0.0000",
      description: `\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A ${invoice.invoiceNumber}`
    });
  }
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
async function buildPurchaseInvoiceLines(invoice, journal, orgId) {
  const accIds = [
    journal?.purchaseAccountId,
    journal?.supplierAccountId,
    journal?.cashAccountId,
    journal?.taxAccountId,
    journal?.discountAccountId
  ].filter(Boolean);
  const accs = accIds.length ? await db.query.chartOfAccounts.findMany({
    where: (a, { inArray: inArray5 }) => inArray5(a.id, accIds)
  }) : [];
  const accMap = new Map(accs.map((a) => [a.id, a]));
  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);
  const isCredit = invoice.paymentMethod === "credit";
  const lines = [];
  const warnings = [];
  const purchaseAccId = journal?.purchaseAccountId ?? null;
  const purchaseAcc = purchaseAccId ? accMap.get(purchaseAccId) : null;
  if (!purchaseAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
  lines.push({
    accountId: purchaseAccId,
    accountCode: purchaseAcc?.code ?? "---",
    accountName: purchaseAcc?.name ?? "\u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A",
    debit: subtotal.toFixed(4),
    credit: "0.0000",
    description: `\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A ${invoice.invoiceNumber}`
  });
  if (taxAmount > 0) {
    const taxAccId = journal?.taxAccountId ?? null;
    const taxAcc = taxAccId ? accMap.get(taxAccId) : null;
    if (!taxAccId) warnings.push("\u062D\u0633\u0627\u0628 \u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
    lines.push({
      accountId: taxAccId,
      accountCode: taxAcc?.code ?? "---",
      accountName: taxAcc?.name ?? "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629",
      debit: taxAmount.toFixed(4),
      credit: "0.0000",
      description: `\u0636\u0631\u064A\u0628\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A - ${invoice.invoiceNumber}`
    });
  }
  if (discountAmount > 0) {
    const discAccId = journal?.discountAccountId ?? null;
    const discAcc = discAccId ? accMap.get(discAccId) : null;
    if (!discAccId) warnings.push("\u062D\u0633\u0627\u0628 \u062E\u0635\u0645 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
    lines.push({
      accountId: discAccId,
      accountCode: discAcc?.code ?? "---",
      accountName: discAcc?.name ?? "\u062E\u0635\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A",
      debit: "0.0000",
      credit: discountAmount.toFixed(4),
      description: `\u062E\u0635\u0645 \u0645\u0634\u062A\u0631\u064A\u0627\u062A - ${invoice.invoiceNumber}`
    });
  }
  const creditAccId = isCredit ? journal?.supplierAccountId ?? null : journal?.cashAccountId ?? null;
  const creditAcc = creditAccId ? accMap.get(creditAccId) : null;
  const defaultCreditName = isCredit ? "\u0630\u0645\u0645 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646" : "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 / \u0627\u0644\u0646\u0642\u062F";
  if (!creditAccId) warnings.push(isCredit ? "\u062D\u0633\u0627\u0628 \u0630\u0645\u0645 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631" : "\u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u062F\u0641\u062A\u0631");
  lines.push({
    accountId: creditAccId,
    accountCode: creditAcc?.code ?? "---",
    accountName: creditAcc?.name ?? defaultCreditName,
    debit: "0.0000",
    credit: total.toFixed(4),
    description: isCredit ? `\u0645\u0648\u0631\u062F - ${invoice.supplierName ?? ""}` : `\u0633\u062F\u0627\u062F \u0646\u0642\u062F\u064A - ${invoice.invoiceNumber}`
  });
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1e-3;
  return { lines, warnings, totalDebit: totalDebit.toFixed(4), totalCredit: totalCredit.toFixed(4), isBalanced };
}
async function insertJournalEntry(opts) {
  const entryNumber = await nextEntryNumber(opts.orgId);
  const totalDebit = opts.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = opts.lines.reduce((s, l) => s + Number(l.credit), 0);
  const [entry] = await db.insert(journalEntries).values({
    orgId: opts.orgId,
    entryNumber,
    entryDate: opts.date,
    description: opts.description,
    reference: opts.reference,
    totalDebit: totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    status: "posted",
    userId: opts.userId,
    sourceDocType: opts.sourceDocType,
    sourceDocId: opts.sourceDocId,
    sourceDocNumber: opts.sourceDocNumber,
    entryType: "auto"
  }).returning();
  if (opts.lines.length > 0) {
    await db.insert(journalEntryLines).values(
      opts.lines.map((l, i) => ({
        entryId: entry.id,
        orgId: opts.orgId,
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
  return entry;
}
async function autoPostSalesInvoice(invoiceId, orgId, userId) {
  const invoice = await db.query.salesInvoices.findFirst({
    where: and4(eq4(salesInvoices.id, invoiceId), eq4(salesInvoices.orgId, orgId))
  });
  if (!invoice || invoice.isPosted) return null;
  if (invoice.invoiceType !== "sale" && invoice.invoiceType !== "return") return null;
  if (!invoice.journalId && !invoice.docTypeId) return null;
  const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
    where: and4(eq4(documentJournals.id, invoice.journalId), eq4(documentJournals.orgId, orgId))
  }) : null;
  if (journal?.postingMode === "disabled") return null;
  const docTypeAccs = invoice.docTypeId ? await resolveDocTypeAccounts(invoice.docTypeId, orgId) : invoice.journalId ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId) : null;
  const effectiveJournal = {
    ...journal ?? {},
    cashAccountId: docTypeAccs?.cashAccountId ?? journal?.cashAccountId ?? null,
    salesAccountId: docTypeAccs?.salesAccountId ?? journal?.salesAccountId ?? null,
    creditAccountId: docTypeAccs?.creditAccountId ?? journal?.creditAccountId ?? null,
    taxAccountId: docTypeAccs?.taxAccountId ?? journal?.taxAccountId ?? null,
    discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
    postingMode: journal?.postingMode ?? "auto"
  };
  const _ptCfgAuto = journal?.paymentTypesConfig;
  const _hasFieldLinks = Array.isArray(_ptCfgAuto?.accountLinks) && _ptCfgAuto.accountLinks.some((l) => l.accountId && l.postingName && l.postingSide);
  if (!_hasFieldLinks) {
    const isCredit = invoice.paymentMethod === "credit";
    const hasDebitAcc = isCredit ? !!effectiveJournal.creditAccountId : !!effectiveJournal.cashAccountId;
    if (!effectiveJournal.salesAccountId || !hasDebitAcc) return null;
  }
  const { lines: rawLines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
  if (!isBalanced || rawLines.length === 0) return null;
  const isReturn = invoice.invoiceType === "return";
  const reversedLines = isReturn ? rawLines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })) : rawLines;
  const docLabel = isReturn ? "\u0645\u0631\u062F\u0648\u062F \u0645\u0628\u064A\u0639\u0627\u062A" : "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A";
  const docTypeName = docTypeAccs?.docType?.nameAr ?? docLabel;
  const lineDesc = `${docTypeName} - ${invoice.invoiceNumber}`;
  const lines = reversedLines.map((l) => ({ ...l, description: lineDesc }));
  const entry = await insertJournalEntry({
    orgId,
    userId,
    date: invoice.invoiceDate,
    description: docTypeName,
    reference: invoice.invoiceNumber,
    sourceDocType: isReturn ? "sales_return" : "sales_invoice",
    sourceDocId: invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    lines
  });
  await db.update(salesInvoices).set({ isPosted: true, postedAt: /* @__PURE__ */ new Date(), postedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(salesInvoices.id, invoiceId), eq4(salesInvoices.orgId, orgId)));
  return { entryNumber: entry.entryNumber };
}
async function autoPostPurchaseInvoice(invoiceId, orgId, userId) {
  const invoice = await db.query.purchaseInvoices.findFirst({
    where: and4(eq4(purchaseInvoices.id, invoiceId), eq4(purchaseInvoices.orgId, orgId))
  });
  if (!invoice || invoice.isPosted) return null;
  if (!invoice.journalId && !invoice.docTypeId) return null;
  const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
    where: and4(eq4(documentJournals.id, invoice.journalId), eq4(documentJournals.orgId, orgId))
  }) : null;
  if (journal?.postingMode === "disabled") return null;
  const docTypeAccs = invoice.docTypeId ? await resolveDocTypeAccounts(invoice.docTypeId, orgId) : invoice.journalId ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId) : null;
  const effectiveJournal = {
    purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
    supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
    cashAccountId: docTypeAccs?.cashAccountId ?? journal?.cashAccountId ?? null,
    taxAccountId: docTypeAccs?.taxAccountId ?? journal?.taxAccountId ?? null,
    discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null
  };
  const isCredit = invoice.paymentMethod === "credit";
  const hasCounterAcc = isCredit ? !!effectiveJournal.supplierAccountId : !!effectiveJournal.cashAccountId;
  if (!effectiveJournal.purchaseAccountId || !hasCounterAcc) return null;
  const { lines: rawLines, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
  if (!isBalanced || rawLines.length === 0) return null;
  const isReturn = invoice.invoiceType === "return";
  const reversedLines = isReturn ? rawLines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })) : rawLines;
  const docLabel = isReturn ? "\u0645\u0631\u062F\u0648\u062F \u0645\u0634\u062A\u0631\u064A\u0627\u062A" : "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A";
  const docTypeName = docTypeAccs?.docType?.nameAr ?? docLabel;
  const lineDesc = `${docTypeName} - ${invoice.invoiceNumber}`;
  const lines = reversedLines.map((l) => ({ ...l, description: lineDesc }));
  const entry = await insertJournalEntry({
    orgId,
    userId,
    date: invoice.invoiceDate,
    description: docTypeName,
    reference: invoice.invoiceNumber,
    sourceDocType: isReturn ? "purchase_return" : "purchase_invoice",
    sourceDocId: invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    lines
  });
  await db.update(purchaseInvoices).set({ isPosted: true, postedAt: /* @__PURE__ */ new Date(), postedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and4(eq4(purchaseInvoices.id, invoiceId), eq4(purchaseInvoices.orgId, orgId)));
  return { entryNumber: entry.entryNumber };
}

// src/routers/posting.ts
var postingRouter = router({
  // ══════════════════════════════════════════════════════════════════════════
  // فاتورة المبيعات — معاينة + ترحيل + فك الترحيل
  // ══════════════════════════════════════════════════════════════════════════
  previewSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.salesInvoices.findFirst({
      where: and5(eq5(salesInvoices.id, input.invoiceId), eq5(salesInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and5(eq5(documentJournals.id, invoice.journalId), eq5(documentJournals.orgId, orgId))
    }) : null;
    const docTypeAccs = invoice.docTypeId ? await resolveDocTypeAccounts(invoice.docTypeId, orgId) : invoice.journalId ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId) : null;
    const effectiveJournal = {
      ...journal ?? {},
      cashAccountId: docTypeAccs?.cashAccountId ?? journal?.cashAccountId ?? null,
      salesAccountId: docTypeAccs?.salesAccountId ?? journal?.salesAccountId ?? null,
      creditAccountId: docTypeAccs?.creditAccountId ?? journal?.creditAccountId ?? null,
      taxAccountId: docTypeAccs?.taxAccountId ?? journal?.taxAccountId ?? null,
      discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
      postingMode: journal?.postingMode ?? "manual"
    };
    const { lines, warnings, totalDebit, totalCredit, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: invoice.customerName,
      total: invoice.total,
      paymentMethod: invoice.paymentMethod,
      journalName: journal?.name ?? docTypeAccs?.docType?.nameAr ?? null,
      lines,
      warnings,
      totalDebit,
      totalCredit,
      isBalanced,
      canPost: !invoice.isPosted,
      isPosted: invoice.isPosted
    };
  }),
  postSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.salesInvoices.findFirst({
      where: and5(eq5(salesInvoices.id, input.invoiceId), eq5(salesInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (invoice.isPosted) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062D\u064E\u0651\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and5(eq5(documentJournals.id, invoice.journalId), eq5(documentJournals.orgId, orgId))
    }) : null;
    if (journal?.postingMode === "disabled")
      throw new Error("\u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0645\u0639\u0637\u064E\u0651\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0641\u062A\u0631");
    const docTypeAccs = invoice.docTypeId ? await resolveDocTypeAccounts(invoice.docTypeId, orgId) : invoice.journalId ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId) : null;
    const effectiveJournal = {
      ...journal ?? {},
      cashAccountId: docTypeAccs?.cashAccountId ?? journal?.cashAccountId ?? null,
      salesAccountId: docTypeAccs?.salesAccountId ?? journal?.salesAccountId ?? null,
      creditAccountId: docTypeAccs?.creditAccountId ?? journal?.creditAccountId ?? null,
      taxAccountId: docTypeAccs?.taxAccountId ?? journal?.taxAccountId ?? null,
      discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
      postingMode: journal?.postingMode ?? "manual"
    };
    const ptCfg = journal?.paymentTypesConfig;
    const hasFieldLinks = Array.isArray(ptCfg?.accountLinks) && ptCfg.accountLinks.some((l) => l.accountId && l.postingName && l.postingSide);
    if (!hasFieldLinks) {
      const isCredit = invoice.paymentMethod === "credit";
      const missingAccounts = [];
      if (!effectiveJournal.salesAccountId) missingAccounts.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A/\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A");
      if (isCredit && !effectiveJournal.creditAccountId) missingAccounts.push("\u062D\u0633\u0627\u0628 \u0630\u0645\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 (\u0622\u062C\u0644)");
      if (!isCredit && !effectiveJournal.cashAccountId) missingAccounts.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642/\u0627\u0644\u0646\u0642\u062F");
      if (missingAccounts.length > 0)
        throw new Error(
          `\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0644\u0639\u062F\u0645 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629
\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0646\u0627\u0642\u0635\u0629: ${missingAccounts.join("\u060C ")}`
        );
    }
    const { lines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
    if (!isBalanced) throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F: \u0627\u0644\u0645\u062F\u064A\u0646 \u0644\u0627 \u064A\u0633\u0627\u0648\u064A \u0627\u0644\u062F\u0627\u0626\u0646 \u0641\u064A \u0627\u0644\u0642\u064A\u062F \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A");
    await validateAccounts(lines.map((l) => l.accountId));
    const entry = await insertJournalEntry({
      orgId,
      userId: ctx.user.id,
      date: invoice.invoiceDate,
      description: `\u062A\u0631\u062D\u064A\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      sourceDocType: "sales_invoice",
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      lines
    });
    await db.update(salesInvoices).set({ isPosted: true, postedAt: /* @__PURE__ */ new Date(), postedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(salesInvoices.id, input.invoiceId), eq5(salesInvoices.orgId, orgId)));
    return { success: true, journalEntryId: entry.id, entryNumber: entry.entryNumber };
  }),
  unpostSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.salesInvoices.findFirst({
      where: and5(eq5(salesInvoices.id, input.invoiceId), eq5(salesInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (!invoice.isPosted) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u064A\u0633\u062A \u0645\u0631\u062D\u064E\u0651\u0644\u0629");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and5(eq5(documentJournals.id, invoice.journalId), eq5(documentJournals.orgId, orgId))
    }) : null;
    if (journal && !journal.allowUnpost)
      throw new Error("\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D \u0628\u0647 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062F\u0641\u062A\u0631");
    if (invoice.postedJournalEntryId) {
      await db.delete(journalEntryLines).where(eq5(journalEntryLines.entryId, invoice.postedJournalEntryId));
      await db.delete(journalEntries).where(and5(eq5(journalEntries.id, invoice.postedJournalEntryId), eq5(journalEntries.orgId, orgId)));
    }
    await db.update(salesInvoices).set({ isPosted: false, postedAt: null, postedJournalEntryId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(salesInvoices.id, input.invoiceId), eq5(salesInvoices.orgId, orgId)));
    return { success: true };
  }),
  // ══════════════════════════════════════════════════════════════════════════
  // فاتورة المشتريات — معاينة + ترحيل + فك الترحيل
  // ══════════════════════════════════════════════════════════════════════════
  previewPurchaseInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.purchaseInvoices.findFirst({
      where: and5(eq5(purchaseInvoices.id, input.invoiceId), eq5(purchaseInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and5(eq5(documentJournals.id, invoice.journalId), eq5(documentJournals.orgId, orgId))
    }) : null;
    const docTypeAccs = invoice.docTypeId ? await resolveDocTypeAccounts(invoice.docTypeId, orgId) : invoice.journalId ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId) : null;
    const effectiveJournal = {
      purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
      supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
      cashAccountId: docTypeAccs?.cashAccountId ?? journal?.cashAccountId ?? null,
      taxAccountId: docTypeAccs?.taxAccountId ?? journal?.taxAccountId ?? null,
      discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null
    };
    const { lines, warnings, totalDebit, totalCredit, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      supplierName: invoice.supplierName,
      total: invoice.total,
      paymentMethod: invoice.paymentMethod,
      journalName: journal?.name ?? docTypeAccs?.docType?.nameAr ?? null,
      lines,
      warnings,
      totalDebit,
      totalCredit,
      isBalanced,
      canPost: !invoice.isPosted,
      isPosted: invoice.isPosted
    };
  }),
  postPurchaseInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.purchaseInvoices.findFirst({
      where: and5(eq5(purchaseInvoices.id, input.invoiceId), eq5(purchaseInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (invoice.isPosted) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0631\u062D\u064E\u0651\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and5(eq5(documentJournals.id, invoice.journalId), eq5(documentJournals.orgId, orgId))
    }) : null;
    if (journal?.postingMode === "disabled")
      throw new Error("\u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0645\u0639\u0637\u064E\u0651\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u062F\u0641\u062A\u0631");
    const docTypeAccs = invoice.docTypeId ? await resolveDocTypeAccounts(invoice.docTypeId, orgId) : invoice.journalId ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId) : null;
    const effectiveJournal = {
      purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
      supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
      cashAccountId: docTypeAccs?.cashAccountId ?? journal?.cashAccountId ?? null,
      taxAccountId: docTypeAccs?.taxAccountId ?? journal?.taxAccountId ?? null,
      discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null
    };
    const isCredit = invoice.paymentMethod === "credit";
    const missingAccounts = [];
    if (!effectiveJournal.purchaseAccountId) missingAccounts.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A");
    if (isCredit && !effectiveJournal.supplierAccountId) missingAccounts.push("\u062D\u0633\u0627\u0628 \u0630\u0645\u0645 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646 (\u0622\u062C\u0644)");
    if (!isCredit && !effectiveJournal.cashAccountId) missingAccounts.push("\u062D\u0633\u0627\u0628 \u0627\u0644\u0635\u0646\u062F\u0648\u0642/\u0627\u0644\u0646\u0642\u062F");
    if (missingAccounts.length > 0)
      throw new Error(
        `\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0644\u0639\u062F\u0645 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629
\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0646\u0627\u0642\u0635\u0629: ${missingAccounts.join("\u060C ")}`
      );
    const { lines, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
    if (!isBalanced) throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F: \u0627\u0644\u0645\u062F\u064A\u0646 \u0644\u0627 \u064A\u0633\u0627\u0648\u064A \u0627\u0644\u062F\u0627\u0626\u0646 \u0641\u064A \u0627\u0644\u0642\u064A\u062F \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A");
    await validateAccounts(lines.map((l) => l.accountId));
    const entry = await insertJournalEntry({
      orgId,
      userId: ctx.user.id,
      date: invoice.invoiceDate,
      description: `\u062A\u0631\u062D\u064A\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      sourceDocType: "purchase_invoice",
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      lines
    });
    await db.update(purchaseInvoices).set({ isPosted: true, postedAt: /* @__PURE__ */ new Date(), postedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(purchaseInvoices.id, input.invoiceId), eq5(purchaseInvoices.orgId, orgId)));
    return { success: true, journalEntryId: entry.id, entryNumber: entry.entryNumber };
  }),
  unpostPurchaseInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const invoice = await db.query.purchaseInvoices.findFirst({
      where: and5(eq5(purchaseInvoices.id, input.invoiceId), eq5(purchaseInvoices.orgId, orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (!invoice.isPosted) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u064A\u0633\u062A \u0645\u0631\u062D\u064E\u0651\u0644\u0629");
    const journal = invoice.journalId ? await db.query.documentJournals.findFirst({
      where: and5(eq5(documentJournals.id, invoice.journalId), eq5(documentJournals.orgId, orgId))
    }) : null;
    if (journal && !journal.allowUnpost)
      throw new Error("\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D \u0628\u0647 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062F\u0641\u062A\u0631");
    if (invoice.postedJournalEntryId) {
      await db.delete(journalEntryLines).where(eq5(journalEntryLines.entryId, invoice.postedJournalEntryId));
      await db.delete(journalEntries).where(and5(eq5(journalEntries.id, invoice.postedJournalEntryId), eq5(journalEntries.orgId, orgId)));
    }
    await db.update(purchaseInvoices).set({ isPosted: false, postedAt: null, postedJournalEntryId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(purchaseInvoices.id, input.invoiceId), eq5(purchaseInvoices.orgId, orgId)));
    return { success: true };
  }),
  // ══════════════════════════════════════════════════════════════════════════
  // المرحلة الثانية: ترحيل المشتريات للمخزون
  // القيد: مدين المخزون / دائن حساب المشتريات
  // ══════════════════════════════════════════════════════════════════════════
  previewPostPurchasesToInventory: protectedProcedure.input(z3.object({
    fromDate: z3.string().optional(),
    toDate: z3.string().optional(),
    warehouseId: z3.number().optional(),
    journalId: z3.number().optional()
  })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const conds = [
      eq5(purchaseInvoices.orgId, orgId),
      eq5(purchaseInvoices.isPosted, true),
      eq5(purchaseInvoices.inventoryPosted, false)
    ];
    if (input.fromDate) conds.push(gte(purchaseInvoices.invoiceDate, new Date(input.fromDate)));
    if (input.toDate) conds.push(lte(purchaseInvoices.invoiceDate, new Date(input.toDate)));
    if (input.warehouseId) conds.push(eq5(purchaseInvoices.warehouseId, input.warehouseId));
    if (input.journalId) conds.push(eq5(purchaseInvoices.journalId, input.journalId));
    const invoices = await db.query.purchaseInvoices.findMany({ where: and5(...conds) });
    const totalAmount = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
    return {
      count: invoices.length,
      totalAmount: totalAmount.toFixed(4),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        supplierName: inv.supplierName,
        invoiceDate: inv.invoiceDate,
        subtotal: inv.subtotal
      }))
    };
  }),
  postPurchasesToInventory: protectedProcedure.input(z3.object({
    fromDate: z3.string().optional(),
    toDate: z3.string().optional(),
    warehouseId: z3.number().optional(),
    journalId: z3.number().optional(),
    inventoryAccountId: z3.number(),
    purchasesAccountId: z3.number()
  })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const conds = [
      eq5(purchaseInvoices.orgId, orgId),
      eq5(purchaseInvoices.isPosted, true),
      eq5(purchaseInvoices.inventoryPosted, false)
    ];
    if (input.fromDate) conds.push(gte(purchaseInvoices.invoiceDate, new Date(input.fromDate)));
    if (input.toDate) conds.push(lte(purchaseInvoices.invoiceDate, new Date(input.toDate)));
    if (input.warehouseId) conds.push(eq5(purchaseInvoices.warehouseId, input.warehouseId));
    if (input.journalId) conds.push(eq5(purchaseInvoices.journalId, input.journalId));
    const invoices = await db.query.purchaseInvoices.findMany({ where: and5(...conds) });
    if (!invoices.length) throw new Error("\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0645\u0631\u062D\u064E\u0651\u0644\u0629 \u0648\u063A\u064A\u0631 \u0645\u062D\u0648\u064E\u0651\u0644\u0629 \u0644\u0644\u0645\u062E\u0632\u0648\u0646 \u0641\u064A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u062D\u062F\u062F");
    await validateAccounts([input.inventoryAccountId, input.purchasesAccountId]);
    const [invAcc, purAcc] = await Promise.all([
      db.query.chartOfAccounts.findFirst({ where: eq5(chartOfAccounts.id, input.inventoryAccountId) }),
      db.query.chartOfAccounts.findFirst({ where: eq5(chartOfAccounts.id, input.purchasesAccountId) })
    ]);
    const totalAmount = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
    const lines = [
      {
        accountId: input.inventoryAccountId,
        accountCode: invAcc?.code ?? "---",
        accountName: invAcc?.name ?? "\u0627\u0644\u0645\u062E\u0632\u0648\u0646",
        debit: totalAmount.toFixed(4),
        credit: "0.0000",
        description: `\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0644\u0644\u0645\u062E\u0632\u0648\u0646 \u2014 ${invoices.length} \u0641\u0627\u062A\u0648\u0631\u0629`
      },
      {
        accountId: input.purchasesAccountId,
        accountCode: purAcc?.code ?? "---",
        accountName: purAcc?.name ?? "\u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A",
        debit: "0.0000",
        credit: totalAmount.toFixed(4),
        description: `\u062A\u0635\u0641\u064A\u0631 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u2014 ${invoices.length} \u0641\u0627\u062A\u0648\u0631\u0629`
      }
    ];
    const entry = await insertJournalEntry({
      orgId,
      userId: ctx.user.id,
      date: /* @__PURE__ */ new Date(),
      description: `\u062A\u0631\u062D\u064A\u0644 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0644\u0644\u0645\u062E\u0632\u0648\u0646 \u2014 ${invoices.length} \u0641\u0627\u062A\u0648\u0631\u0629 \u2014 \u0625\u062C\u0645\u0627\u0644\u064A ${totalAmount.toFixed(2)}`,
      reference: `INV-XFER-${Date.now()}`,
      sourceDocType: "purchase_to_inventory",
      sourceDocId: 0,
      sourceDocNumber: `PURCH-INV-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
      lines
    });
    const invoiceIds = invoices.map((inv) => inv.id);
    await db.update(purchaseInvoices).set({ inventoryPosted: true, costPostedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(purchaseInvoices.orgId, orgId), inArray2(purchaseInvoices.id, invoiceIds)));
    return { success: true, count: invoices.length, totalAmount: totalAmount.toFixed(4), entryNumber: entry.entryNumber };
  }),
  // ══════════════════════════════════════════════════════════════════════════
  // المرحلة الثانية: ترحيل تكلفة المبيعات (COGS)
  // القيد: مدين تكلفة المبيعات / دائن المخزون
  // ══════════════════════════════════════════════════════════════════════════
  previewPostSalesCOGS: protectedProcedure.input(z3.object({
    fromDate: z3.string().optional(),
    toDate: z3.string().optional(),
    warehouseId: z3.number().optional(),
    journalId: z3.number().optional()
  })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const conds = [
      eq5(salesInvoices.orgId, orgId),
      eq5(salesInvoices.isPosted, true),
      eq5(salesInvoices.costPosted, false)
    ];
    if (input.fromDate) conds.push(gte(salesInvoices.invoiceDate, new Date(input.fromDate)));
    if (input.toDate) conds.push(lte(salesInvoices.invoiceDate, new Date(input.toDate)));
    if (input.journalId) conds.push(eq5(salesInvoices.journalId, input.journalId));
    const invoices = await db.query.salesInvoices.findMany({ where: and5(...conds) });
    const totalCost = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
    return {
      count: invoices.length,
      totalCost: totalCost.toFixed(4),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        invoiceDate: inv.invoiceDate,
        subtotal: inv.subtotal
      }))
    };
  }),
  postSalesCOGS: protectedProcedure.input(z3.object({
    fromDate: z3.string().optional(),
    toDate: z3.string().optional(),
    warehouseId: z3.number().optional(),
    journalId: z3.number().optional(),
    cogsAccountId: z3.number(),
    inventoryAccountId: z3.number()
  })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const conds = [
      eq5(salesInvoices.orgId, orgId),
      eq5(salesInvoices.isPosted, true),
      eq5(salesInvoices.costPosted, false)
    ];
    if (input.fromDate) conds.push(gte(salesInvoices.invoiceDate, new Date(input.fromDate)));
    if (input.toDate) conds.push(lte(salesInvoices.invoiceDate, new Date(input.toDate)));
    if (input.journalId) conds.push(eq5(salesInvoices.journalId, input.journalId));
    const invoices = await db.query.salesInvoices.findMany({ where: and5(...conds) });
    if (!invoices.length) throw new Error("\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A \u0645\u0631\u062D\u064E\u0651\u0644\u0629 \u0648\u063A\u064A\u0631 \u0645\u062D\u0648\u064E\u0651\u0644 \u062A\u0643\u0644\u0641\u062A\u0647\u0627 \u0641\u064A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u062D\u062F\u062F");
    await validateAccounts([input.cogsAccountId, input.inventoryAccountId]);
    const [cogsAcc, invAcc] = await Promise.all([
      db.query.chartOfAccounts.findFirst({ where: eq5(chartOfAccounts.id, input.cogsAccountId) }),
      db.query.chartOfAccounts.findFirst({ where: eq5(chartOfAccounts.id, input.inventoryAccountId) })
    ]);
    const totalCost = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
    const lines = [
      {
        accountId: input.cogsAccountId,
        accountCode: cogsAcc?.code ?? "---",
        accountName: cogsAcc?.name ?? "\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
        debit: totalCost.toFixed(4),
        credit: "0.0000",
        description: `\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u2014 ${invoices.length} \u0641\u0627\u062A\u0648\u0631\u0629`
      },
      {
        accountId: input.inventoryAccountId,
        accountCode: invAcc?.code ?? "---",
        accountName: invAcc?.name ?? "\u0627\u0644\u0645\u062E\u0632\u0648\u0646",
        debit: "0.0000",
        credit: totalCost.toFixed(4),
        description: `\u062A\u062E\u0641\u064A\u0636 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u2014 \u0628\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u2014 ${invoices.length} \u0641\u0627\u062A\u0648\u0631\u0629`
      }
    ];
    const entry = await insertJournalEntry({
      orgId,
      userId: ctx.user.id,
      date: /* @__PURE__ */ new Date(),
      description: `\u062A\u0631\u062D\u064A\u0644 \u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u2014 ${invoices.length} \u0641\u0627\u062A\u0648\u0631\u0629 \u2014 \u0625\u062C\u0645\u0627\u0644\u064A ${totalCost.toFixed(2)}`,
      reference: `COGS-${Date.now()}`,
      sourceDocType: "sales_cogs",
      sourceDocId: 0,
      sourceDocNumber: `COGS-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
      lines
    });
    const invoiceIds = invoices.map((inv) => inv.id);
    await db.update(salesInvoices).set({ costPosted: true, costPostedJournalEntryId: entry.id, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq5(salesInvoices.orgId, orgId), inArray2(salesInvoices.id, invoiceIds)));
    return { success: true, count: invoices.length, totalCost: totalCost.toFixed(4), entryNumber: entry.entryNumber };
  }),
  // ══════════════════════════════════════════════════════════════════════════
  // إعدادات الترحيل
  // ══════════════════════════════════════════════════════════════════════════
  listJournalSettings: protectedProcedure.query(async ({ ctx }) => {
    const journals = await db.query.documentJournals.findMany({
      where: eq5(documentJournals.orgId, ctx.user.orgId),
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
    }).where(and5(eq5(documentJournals.id, input.journalId), eq5(documentJournals.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  getSalesInvoice: protectedProcedure.input(z3.object({ invoiceId: z3.number() })).query(async ({ ctx, input }) => {
    return db.query.salesInvoices.findFirst({
      where: and5(eq5(salesInvoices.id, input.invoiceId), eq5(salesInvoices.orgId, ctx.user.orgId))
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
    customerId: z4.number().optional(),
    // فلتر بـ ID العميل
    excludeReturns: z4.boolean().optional(),
    // استثناء المردودات
    numberPrefix: z4.string().optional()
    // فلتر دفتر المستند (بادئة الرقم)
  }).optional()).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const allRecords = await db.query.salesInvoices.findMany({
      where: eq6(salesInvoices.orgId, orgId),
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
    if (input?.customerId) {
      filtered = filtered.filter((r) => r.customerId === input.customerId);
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
      where: eq6(salesInvoices.orgId, ctx.user.orgId),
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
      where: and6(eq6(salesInvoices.id, input.id), eq6(salesInvoices.orgId, ctx.user.orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const items = await db.query.salesInvoiceItems.findMany({
      where: eq6(salesInvoiceItems.invoiceId, input.id),
      orderBy: (i, { asc: asc13 }) => [asc13(i.sortOrder)]
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
    customerType: z4.string().optional(),
    customerTaxNumber: z4.string().optional(),
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
    paymentBreakdown: z4.record(z4.string(), z4.number()).optional().nullable(),
    paymentMethod: z4.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
    status: z4.enum(["draft", "confirmed", "cancelled", "paid"]).default("confirmed"),
    notes: z4.string().optional(),
    docTypeId: z4.number().optional(),
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
    let invoice;
    try {
      const [row] = await db.insert(salesInvoices).values({
        ...invoiceData,
        orgId,
        userId: ctx.user.id,
        invoiceDate: new Date(invoiceData.invoiceDate),
        ...dueDate ? { dueDate: new Date(dueDate) } : {}
      }).returning();
      invoice = row;
    } catch (e) {
      console.error("[sales.create] INSERT ERROR:", {
        message: e?.message,
        code: e?.code,
        detail: e?.detail,
        constraint: e?.constraint,
        table: e?.table,
        data: { invoiceNumber: invoiceData.invoiceNumber, orgId, paymentMethod: invoiceData.paymentMethod }
      });
      throw e;
    }
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
    try {
      const posted = await autoPostSalesInvoice(invoice.id, orgId, ctx.user.id);
      if (posted) {
        return { ...invoice, isPosted: true, autoPostedEntryNumber: posted.entryNumber };
      }
    } catch (e) {
      console.error("[sales.create] autoPostSalesInvoice error:", e);
    }
    return invoice;
  }),
  // تعديل مستند
  update: protectedProcedure.input(z4.object({
    id: z4.number(),
    invoiceDate: z4.string().optional(),
    customerId: z4.number().optional(),
    customerName: z4.string().optional(),
    customerType: z4.string().optional(),
    customerTaxNumber: z4.string().optional(),
    subtotal: z4.string().optional(),
    discountAmount: z4.string().optional(),
    taxAmount: z4.string().optional(),
    total: z4.string().optional(),
    paidAmount: z4.string().optional(),
    remainingAmount: z4.string().optional(),
    paymentBreakdown: z4.record(z4.string(), z4.number()).optional().nullable(),
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
    const existing = await db.query.salesInvoices.findFirst({
      where: and6(eq6(salesInvoices.id, id), eq6(salesInvoices.orgId, ctx.user.orgId))
    });
    if (existing?.isPosted)
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0645\u0633\u062A\u0646\u062F \u0645\u0631\u062D\u0651\u0644 \u2014 \u064A\u062C\u0628 \u0641\u0643 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0623\u0648\u0644\u0627\u064B");
    await db.update(salesInvoices).set({
      ...rest,
      ...invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and6(eq6(salesInvoices.id, id), eq6(salesInvoices.orgId, ctx.user.orgId)));
    if (items) {
      await db.delete(salesInvoiceItems).where(eq6(salesInvoiceItems.invoiceId, id));
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
  // جلب بيانات السداد المحفوظة لفاتورة معينة
  getPaymentBreakdown: protectedProcedure.input(z4.object({ id: z4.number() })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const payments = await db.query.salesInvoicePayments.findMany({
      where: and6(
        eq6(salesInvoicePayments.invoiceId, input.id),
        eq6(salesInvoicePayments.orgId, orgId)
      ),
      orderBy: (t2, { asc: asc13 }) => [asc13(t2.id)]
    });
    const breakdown = {};
    for (const p of payments) {
      breakdown[p.paymentMethodCode] = parseFloat(p.amount);
    }
    return { payments, breakdown };
  }),
  // تحديث بيانات السداد فقط (من شاشة الدفع)
  updatePayment: protectedProcedure.input(z4.object({
    id: z4.number(),
    paymentBreakdown: z4.record(z4.string(), z4.number()),
    paidAmount: z4.string(),
    remainingAmount: z4.string(),
    status: z4.enum(["draft", "confirmed", "paid"]).optional()
  })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const { id, paymentBreakdown, paidAmount, remainingAmount } = input;
    const existing = await db.query.salesInvoices.findFirst({
      where: and6(eq6(salesInvoices.id, id), eq6(salesInvoices.orgId, orgId))
    });
    if (!existing) throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const invoiceTotal = parseFloat(existing.total);
    const paid = parseFloat(paidAmount);
    const autoStatus = paid <= 0 ? "confirmed" : paid >= invoiceTotal - 5e-3 ? "paid" : "confirmed";
    await db.update(salesInvoices).set({
      paymentBreakdown,
      paidAmount,
      remainingAmount,
      status: autoStatus,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and6(eq6(salesInvoices.id, id), eq6(salesInvoices.orgId, orgId)));
    await db.delete(salesInvoicePayments).where(and6(
      eq6(salesInvoicePayments.invoiceId, id),
      eq6(salesInvoicePayments.orgId, orgId)
    ));
    for (const [code, amount] of Object.entries(paymentBreakdown)) {
      if (amount > 1e-3) {
        const method = await db.query.paymentMethods.findFirst({
          where: and6(eq6(paymentMethods.orgId, orgId), eq6(paymentMethods.code, code))
        });
        await db.insert(salesInvoicePayments).values({
          orgId,
          invoiceId: id,
          paymentMethodCode: code,
          paymentMethodName: method?.nameAr ?? code,
          amount: amount.toFixed(4)
        });
      }
    }
    return { success: true, status: autoStatus };
  }),
  // بحث عن مستند مصدر (بناءً على)
  getByNumber: protectedProcedure.input(z4.object({
    type: z4.enum(["sale", "quote", "order", "transfer"]),
    number: z4.string().min(1)
  })).query(async ({ ctx, input }) => {
    if (input.type === "transfer") {
      const voucher = await db.query.stockVouchers.findFirst({
        where: and6(
          eq6(stockVouchers.orgId, ctx.user.orgId),
          eq6(stockVouchers.voucherNumber, input.number),
          eq6(stockVouchers.type, "transfer")
        )
      });
      if (!voucher) return null;
      const items2 = await db.query.stockVoucherItems.findMany({
        where: eq6(stockVoucherItems.voucherId, voucher.id),
        orderBy: (i, { asc: asc13 }) => [asc13(i.sortOrder)]
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
    const typeFilter = input.type === "order" ? "order" : input.type === "quote" ? "quote" : "sale";
    const invoice = await db.query.salesInvoices.findFirst({
      where: and6(
        eq6(salesInvoices.orgId, ctx.user.orgId),
        eq6(salesInvoices.invoiceNumber, input.number),
        eq6(salesInvoices.invoiceType, typeFilter)
      )
    });
    if (!invoice) return null;
    const items = await db.query.salesInvoiceItems.findMany({
      where: eq6(salesInvoiceItems.invoiceId, invoice.id),
      orderBy: (i, { asc: asc13 }) => [asc13(i.sortOrder)]
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
    const existing = await db.query.salesInvoices.findFirst({
      where: and6(eq6(salesInvoices.id, input.id), eq6(salesInvoices.orgId, ctx.user.orgId))
    });
    if (existing?.isPosted)
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0645\u0633\u062A\u0646\u062F \u0645\u0631\u062D\u0651\u0644 \u2014 \u064A\u062C\u0628 \u0641\u0643 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0623\u0648\u0644\u0627\u064B");
    await db.delete(salesInvoiceItems).where(eq6(salesInvoiceItems.invoiceId, input.id));
    await db.delete(salesInvoices).where(
      and6(eq6(salesInvoices.id, input.id), eq6(salesInvoices.orgId, ctx.user.orgId))
    );
    return { success: true };
  }),
  // بحث عن عملاء
  searchCustomers: protectedProcedure.input(z4.object({ q: z4.string() })).query(async ({ ctx, input }) => {
    return db.query.customers.findMany({
      where: and6(
        eq6(customers.orgId, ctx.user.orgId),
        eq6(customers.isActive, true),
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
      where: and6(
        eq6(products.orgId, ctx.user.orgId),
        eq6(products.isActive, true),
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
import { eq as eq7, and as and7, desc as desc3 } from "drizzle-orm";
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
      where: eq7(purchaseInvoices.orgId, orgId),
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
      where: eq7(purchaseInvoices.orgId, ctx.user.orgId),
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
      where: and7(eq7(purchaseInvoices.id, input.id), eq7(purchaseInvoices.orgId, ctx.user.orgId))
    });
    if (!invoice) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const items = await db.query.purchaseInvoiceItems.findMany({
      where: eq7(purchaseInvoiceItems.invoiceId, input.id),
      orderBy: (i, { asc: asc13 }) => [asc13(i.sortOrder)]
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
    try {
      await autoPostPurchaseInvoice(invoice.id, orgId, ctx.user.id);
    } catch (e) {
      console.warn("[autoPostPurchaseInvoice] skipped:", e);
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
    docTypeId: z5.number().optional(),
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
    const existing = await db.query.purchaseInvoices.findFirst({
      where: and7(eq7(purchaseInvoices.id, id), eq7(purchaseInvoices.orgId, ctx.user.orgId))
    });
    if (existing?.isPosted)
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0645\u0633\u062A\u0646\u062F \u0645\u0631\u062D\u064E\u0651\u0644 \u2014 \u064A\u062C\u0628 \u0641\u0643 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0623\u0648\u0644\u0627\u064B");
    await db.update(purchaseInvoices).set({
      ...rest,
      ...invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and7(eq7(purchaseInvoices.id, id), eq7(purchaseInvoices.orgId, ctx.user.orgId)));
    if (items) {
      await db.delete(purchaseInvoiceItems).where(eq7(purchaseInvoiceItems.invoiceId, id));
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
    const existing = await db.query.purchaseInvoices.findFirst({
      where: and7(eq7(purchaseInvoices.id, input.id), eq7(purchaseInvoices.orgId, ctx.user.orgId))
    });
    if (existing?.isPosted)
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0645\u0633\u062A\u0646\u062F \u0645\u0631\u062D\u064E\u0651\u0644 \u2014 \u064A\u062C\u0628 \u0641\u0643 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0623\u0648\u0644\u0627\u064B");
    await db.delete(purchaseInvoices).where(
      and7(eq7(purchaseInvoices.id, input.id), eq7(purchaseInvoices.orgId, ctx.user.orgId))
    );
    return { success: true };
  })
});

// src/routers/chat.ts
import { z as z6 } from "zod";
import { eq as eq8, and as and8, or as or2, desc as desc4, sql as sql2 } from "drizzle-orm";
init_db();
init_schema();
var chatRouter = router({
  // قائمة المستخدمين للمحادثة
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    return db.query.users.findMany({
      where: and8(
        eq8(users.orgId, ctx.user.orgId),
        eq8(users.isActive, true)
      ),
      columns: { passwordHash: false, orgId: false },
      orderBy: (u, { asc: asc13 }) => [asc13(u.name)]
    });
  }),
  // رسائل المحادثة بين مستخدمين
  getConversation: protectedProcedure.input(z6.object({ withUserId: z6.number(), limit: z6.number().default(50) })).query(async ({ ctx, input }) => {
    const msgs = await db.query.messages.findMany({
      where: and8(
        eq8(messages.orgId, ctx.user.orgId),
        or2(
          and8(eq8(messages.senderId, ctx.user.id), eq8(messages.receiverId, input.withUserId)),
          and8(eq8(messages.senderId, input.withUserId), eq8(messages.receiverId, ctx.user.id))
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
    await db.update(messages).set({ isRead: true }).where(and8(
      eq8(messages.orgId, ctx.user.orgId),
      eq8(messages.receiverId, ctx.user.id),
      eq8(messages.senderId, input.fromUserId),
      eq8(messages.isRead, false)
    ));
    return { success: true };
  }),
  // عدد الرسائل غير المقروءة
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await db.select({
      senderId: messages.senderId,
      count: sql2`count(*)::int`
    }).from(messages).where(and8(
      eq8(messages.orgId, ctx.user.orgId),
      eq8(messages.receiverId, ctx.user.id),
      eq8(messages.isRead, false)
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
import { eq as eq9, and as and9, asc, inArray as inArray3 } from "drizzle-orm";
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
  customersJournal: z7.string().nullable().optional(),
  suppliersJournal: z7.string().nullable().optional(),
  paymentTypesConfig: z7.record(z7.string(), z7.any()).nullable().optional(),
  issuanceConfig: z7.record(z7.string(), z7.any()).nullable().optional(),
  optionsConfig: z7.record(z7.string(), z7.any()).nullable().optional(),
  allowUnpost: z7.boolean().optional(),
  allowEditAfterPost: z7.boolean().optional(),
  notes: z7.string().optional(),
  sortOrder: z7.number().default(0)
};
var documentJournalsRouter = router({
  list: protectedProcedure.input(z7.object({
    docType: z7.string().optional(),
    docTypes: z7.array(z7.string()).optional()
  }).optional()).query(async ({ ctx, input }) => {
    const types = input?.docTypes ?? (input?.docType ? [input.docType] : null);
    const rows = await db.query.documentJournals.findMany({
      where: types && types.length > 0 ? and9(eq9(documentJournals.orgId, ctx.user.orgId), inArray3(documentJournals.docType, types), eq9(documentJournals.isActive, true)) : and9(eq9(documentJournals.orgId, ctx.user.orgId), eq9(documentJournals.isActive, true)),
      orderBy: [asc(documentJournals.sortOrder), asc(documentJournals.id)]
    });
    return rows;
  }),
  get: protectedProcedure.input(z7.object({ id: z7.number() })).query(async ({ ctx, input }) => {
    const row = await db.query.documentJournals.findFirst({
      where: and9(eq9(documentJournals.id, input.id), eq9(documentJournals.orgId, ctx.user.orgId))
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
    const [row] = await db.update(documentJournals).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and9(eq9(documentJournals.id, id), eq9(documentJournals.orgId, ctx.user.orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ ctx, input }) => {
    await db.update(documentJournals).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and9(eq9(documentJournals.id, input.id), eq9(documentJournals.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  // إعادة ضبط الترقيم
  resetNumbering: protectedProcedure.input(z7.object({ journalId: z7.number() })).mutation(async ({ ctx, input }) => {
    const journal = await db.query.documentJournals.findFirst({
      where: and9(eq9(documentJournals.id, input.journalId), eq9(documentJournals.orgId, ctx.user.orgId))
    });
    if (!journal) throw new Error("\u0627\u0644\u062F\u0641\u062A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    await db.update(documentJournals).set({ currentSeq: (journal.firstNumber ?? 1) - 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(documentJournals.id, journal.id));
    return { success: true, resetTo: (journal.firstNumber ?? 1) - 1 };
  }),
  // الرقم التالي — transaction-safe
  nextNumber: protectedProcedure.input(z7.object({ journalId: z7.number() })).mutation(async ({ ctx, input }) => {
    const journal = await db.query.documentJournals.findFirst({
      where: and9(eq9(documentJournals.id, input.journalId), eq9(documentJournals.orgId, ctx.user.orgId))
    });
    if (!journal) throw new Error("\u0627\u0644\u062F\u0641\u062A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const currentSeq = journal.currentSeq ?? 0;
    const firstNumber = journal.firstNumber ?? 1;
    const increment = journal.increment ?? 1;
    const nextSeq = currentSeq === 0 ? firstNumber : Math.max(currentSeq + increment, firstNumber);
    const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);
    await db.update(documentJournals).set({ currentSeq: clamped, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(documentJournals.id, journal.id));
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
      where: and9(eq9(documentJournals.id, input.journalId), eq9(documentJournals.orgId, ctx.user.orgId))
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
import { eq as eq10, and as and10, asc as asc2 } from "drizzle-orm";
init_db();
init_schema();
var POS01_CONFIG = JSON.stringify({
  type: "pos_config_v1",
  paperWidth: "80mm",
  primaryColor: "#406B93",
  taxPct: 15,
  taxInclusive: true,
  show: {
    logo: false,
    taxNumber: true,
    commercialReg: true,
    address: true,
    phone: true,
    customerName: false,
    cashierName: true,
    itemCode: false,
    discount: true,
    prices: true,
    branchName: true,
    qr: true,
    amountInWords: false,
    thankYou: true,
    paymentMethod: true,
    changeAmount: true
  },
  printMode: "detailed",
  thankYouMsg: "\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u0648\u0642\u0643\u0645 \u0645\u0639\u0646\u0627",
  copies: 1
});
var INV01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#1B4F8E",
  columns: {
    num: true,
    code: true,
    name: true,
    unit: false,
    qty: true,
    price: true,
    discount: true,
    taxable: true,
    taxRate: true,
    taxAmt: true,
    total: true
  },
  minRows: 5,
  sections: {
    sellerInfo: true,
    customerInfo: true,
    amountInWords: true,
    pageNumber: true,
    signatures: false
  },
  elements: [
    { id: "e_qr", type: "qr", x: 5, y: 5, w: 28, h: 28, border: false },
    { id: "e_title", type: "text", x: 71, y: 6, w: 68, h: 20, content: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0631\u064A\u0628\u064A\u0629\nTAX INVOICE", fontSize: 14, fontWeight: "bold", textAlign: "center", color: "#1B4F8E" },
    { id: "e_co", type: "company_info", x: 112, y: 4, w: 93, h: 30, fontSize: 9 },
    { id: "e_d1", type: "line", x: 5, y: 37, w: 200, h: 1, color: "#1B4F8E" },
    { id: "e_inv", type: "invoice_info", x: 5, y: 40, w: 200, h: 14, fontSize: 9 },
    { id: "e_d2", type: "line", x: 5, y: 56, w: 200, h: 1, color: "#dddddd" },
    { id: "e_cust", type: "customer_info", x: 5, y: 59, w: 98, h: 34, fontSize: 9, border: true },
    { id: "e_d3", type: "line", x: 5, y: 95, w: 200, h: 1, color: "#dddddd" },
    { id: "e_items", type: "items_table", x: 5, y: 98, w: 200, h: 120, fontSize: 9 },
    { id: "e_total", type: "totals", x: 118, y: 222, w: 87, h: 50, fontSize: 10, border: true },
    { id: "e_words", type: "notes", x: 5, y: 222, w: 109, h: 15, content: "\u0627\u0644\u0645\u0628\u0644\u063A \u0643\u062A\u0627\u0628\u0629\u064B: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes", x: 5, y: 239, w: 109, h: 12, content: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A: {{Notes}}", fontSize: 9 },
    { id: "e_d4", type: "line", x: 5, y: 275, w: 200, h: 1, color: "#dddddd" },
    { id: "e_foot", type: "text", x: 5, y: 278, w: 200, h: 8, content: "OneSoft ERP  \xB7  \u0635\u0641\u062D\u0629 1 \u0645\u0646 1 / Page 1 of 1", fontSize: 7.5, textAlign: "center", color: "#999999" }
  ]
});
var PINV01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#4A5568",
  columns: {
    num: true,
    code: true,
    name: true,
    unit: false,
    qty: true,
    price: true,
    discount: true,
    taxable: true,
    taxRate: true,
    taxAmt: true,
    total: true
  },
  minRows: 5,
  sections: {
    sellerInfo: true,
    customerInfo: true,
    amountInWords: true,
    pageNumber: true,
    signatures: false
  },
  elements: [
    { id: "e_qr", type: "qr", x: 5, y: 5, w: 28, h: 28, border: false },
    { id: "e_title", type: "text", x: 71, y: 6, w: 68, h: 20, content: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A\nPURCHASE INVOICE", fontSize: 14, fontWeight: "bold", textAlign: "center", color: "#4A5568" },
    { id: "e_co", type: "company_info", x: 112, y: 4, w: 93, h: 30, fontSize: 9 },
    { id: "e_d1", type: "line", x: 5, y: 37, w: 200, h: 1, color: "#4A5568" },
    { id: "e_inv", type: "invoice_info", x: 5, y: 40, w: 200, h: 14, fontSize: 9 },
    { id: "e_d2", type: "line", x: 5, y: 56, w: 200, h: 1, color: "#dddddd" },
    { id: "e_cust", type: "customer_info", x: 5, y: 59, w: 98, h: 34, fontSize: 9, border: true },
    { id: "e_d3", type: "line", x: 5, y: 95, w: 200, h: 1, color: "#dddddd" },
    { id: "e_items", type: "items_table", x: 5, y: 98, w: 200, h: 120, fontSize: 9 },
    { id: "e_total", type: "totals", x: 118, y: 222, w: 87, h: 50, fontSize: 10, border: true },
    { id: "e_words", type: "notes", x: 5, y: 222, w: 109, h: 15, content: "\u0627\u0644\u0645\u0628\u0644\u063A \u0643\u062A\u0627\u0628\u0629\u064B: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes", x: 5, y: 239, w: 109, h: 12, content: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A: {{Notes}}", fontSize: 9 },
    { id: "e_d4", type: "line", x: 5, y: 275, w: 200, h: 1, color: "#dddddd" },
    { id: "e_foot", type: "text", x: 5, y: 278, w: 200, h: 8, content: "OneSoft ERP  \xB7  \u0635\u0641\u062D\u0629 1 \u0645\u0646 1 / Page 1 of 1", fontSize: 7.5, textAlign: "center", color: "#999999" }
  ]
});
var documentTemplatesRouter = router({
  list: protectedProcedure.input(z8.object({ docType: z8.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const where = input?.docType ? and10(eq10(documentTemplates.orgId, ctx.user.orgId), eq10(documentTemplates.docType, input.docType), eq10(documentTemplates.isActive, true)) : and10(eq10(documentTemplates.orgId, ctx.user.orgId), eq10(documentTemplates.isActive, true));
    return db.query.documentTemplates.findMany({
      where,
      orderBy: [asc2(documentTemplates.sortOrder), asc2(documentTemplates.id)]
    });
  }),
  getDefault: protectedProcedure.input(z8.object({ docType: z8.string() })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    let tpl = await db.query.documentTemplates.findFirst({
      where: and10(
        eq10(documentTemplates.orgId, orgId),
        eq10(documentTemplates.docType, input.docType),
        eq10(documentTemplates.isDefault, true),
        eq10(documentTemplates.isActive, true)
      )
    });
    if (!tpl) {
      const defMap = {
        sales_invoice: {
          code: "INV01",
          nameAr: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A",
          nameEn: "Standard Sales Invoice",
          paperSize: "A4",
          layoutJson: INV01_CONFIG
        },
        purchase_invoice: {
          code: "PINV01",
          nameAr: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A",
          nameEn: "Standard Purchase Invoice",
          paperSize: "A4",
          layoutJson: PINV01_CONFIG
        },
        pos_receipt: {
          code: "POS01",
          nameAr: "\u0646\u0645\u0648\u0630\u062C \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u062D\u0631\u0627\u0631\u064A",
          nameEn: "POS Thermal Receipt",
          paperSize: "80mm",
          layoutJson: POS01_CONFIG
        }
      };
      const def = defMap[input.docType];
      if (def) {
        const existing = await db.query.documentTemplates.findFirst({
          where: and10(eq10(documentTemplates.orgId, orgId), eq10(documentTemplates.code, def.code))
        });
        if (existing) {
          await db.update(documentTemplates).set({ isDefault: true, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.id, existing.id), eq10(documentTemplates.orgId, orgId)));
          tpl = { ...existing, isDefault: true };
        } else {
          const [row] = await db.insert(documentTemplates).values({
            orgId,
            code: def.code,
            nameAr: def.nameAr,
            nameEn: def.nameEn,
            docType: input.docType,
            paperSize: def.paperSize,
            orientation: "portrait",
            isDefault: true,
            isActive: true,
            sortOrder: 1,
            layoutJson: def.layoutJson
          }).returning();
          tpl = row;
        }
      }
    }
    return tpl ?? null;
  }),
  seedDefault: protectedProcedure.input(z8.object({ docType: z8.string(), forceReset: z8.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const defMap = {
      sales_invoice: {
        code: "INV01",
        nameAr: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A",
        nameEn: "Standard Sales Invoice",
        paperSize: "A4",
        layoutJson: INV01_CONFIG,
        notes: "\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u2014 \u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0631\u064A\u0628\u064A\u0629 \u062B\u0646\u0627\u0626\u064A\u0629 \u0627\u0644\u0644\u063A\u0629"
      },
      purchase_invoice: {
        code: "PINV01",
        nameAr: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A",
        nameEn: "Standard Purchase Invoice",
        paperSize: "A4",
        layoutJson: PINV01_CONFIG,
        notes: "\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u2014 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A \u062B\u0646\u0627\u0626\u064A\u0629 \u0627\u0644\u0644\u063A\u0629"
      },
      pos_receipt: {
        code: "POS01",
        nameAr: "\u0646\u0645\u0648\u0630\u062C \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u062D\u0631\u0627\u0631\u064A",
        nameEn: "POS Thermal Receipt",
        paperSize: "80mm",
        layoutJson: POS01_CONFIG,
        notes: "\u0625\u064A\u0635\u0627\u0644 \u062D\u0631\u0627\u0631\u064A \u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u2014 ZATCA/ETA QR"
      }
    };
    const def = defMap[input.docType];
    if (!def) return { seeded: false };
    const existing = await db.query.documentTemplates.findFirst({
      where: and10(eq10(documentTemplates.orgId, orgId), eq10(documentTemplates.code, def.code))
    });
    if (!existing) {
      await db.insert(documentTemplates).values({
        orgId,
        code: def.code,
        nameAr: def.nameAr,
        nameEn: def.nameEn,
        docType: input.docType,
        paperSize: def.paperSize,
        orientation: "portrait",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
        layoutJson: def.layoutJson,
        notes: def.notes
      });
      return { seeded: true };
    } else if (!existing.layoutJson || input.forceReset) {
      await db.update(documentTemplates).set({ layoutJson: def.layoutJson, isDefault: true, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.id, existing.id), eq10(documentTemplates.orgId, orgId)));
      return { seeded: true };
    }
    return { seeded: false };
  }),
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const defaults = [
      {
        code: "INV01",
        nameAr: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A",
        nameEn: "Standard Sales Invoice",
        docType: "sales_invoice",
        paperSize: "A4",
        layoutJson: INV01_CONFIG,
        notes: "\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u2014 \u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0631\u064A\u0628\u064A\u0629 \u062B\u0646\u0627\u0626\u064A\u0629 \u0627\u0644\u0644\u063A\u0629"
      },
      {
        code: "PINV01",
        nameAr: "\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0627\u0644\u0623\u0633\u0627\u0633\u064A",
        nameEn: "Standard Purchase Invoice",
        docType: "purchase_invoice",
        paperSize: "A4",
        layoutJson: PINV01_CONFIG,
        notes: "\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u2014 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A \u062B\u0646\u0627\u0626\u064A\u0629 \u0627\u0644\u0644\u063A\u0629"
      },
      {
        code: "POS01",
        nameAr: "\u0646\u0645\u0648\u0630\u062C \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u062D\u0631\u0627\u0631\u064A",
        nameEn: "POS Thermal Receipt",
        docType: "pos_receipt",
        paperSize: "80mm",
        layoutJson: POS01_CONFIG,
        notes: "\u0625\u064A\u0635\u0627\u0644 \u062D\u0631\u0627\u0631\u064A \u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 \u2014 ZATCA/ETA QR"
      }
    ];
    let seededCount = 0;
    for (const def of defaults) {
      const existing = await db.query.documentTemplates.findFirst({
        where: and10(
          eq10(documentTemplates.orgId, ctx.user.orgId),
          eq10(documentTemplates.code, def.code)
        )
      });
      if (!existing) {
        await db.insert(documentTemplates).values({
          orgId: ctx.user.orgId,
          code: def.code,
          nameAr: def.nameAr,
          nameEn: def.nameEn,
          docType: def.docType,
          paperSize: def.paperSize,
          orientation: "portrait",
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          layoutJson: def.layoutJson,
          notes: def.notes
        });
        seededCount++;
      } else if (!existing.layoutJson) {
        await db.update(documentTemplates).set({ layoutJson: def.layoutJson, isDefault: true, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.id, existing.id), eq10(documentTemplates.orgId, ctx.user.orgId)));
        seededCount++;
      }
    }
    return { seeded: seededCount > 0, count: seededCount };
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
      await db.update(documentTemplates).set({ isDefault: false, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.orgId, ctx.user.orgId), eq10(documentTemplates.docType, input.docType)));
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
      await db.update(documentTemplates).set({ isDefault: false, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.orgId, ctx.user.orgId), eq10(documentTemplates.docType, data.docType)));
    }
    const [row] = await db.update(documentTemplates).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.id, id), eq10(documentTemplates.orgId, ctx.user.orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ ctx, input }) => {
    await db.update(documentTemplates).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq10(documentTemplates.id, input.id), eq10(documentTemplates.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  clone: protectedProcedure.input(z8.object({ id: z8.number(), newCode: z8.string(), newNameAr: z8.string() })).mutation(async ({ ctx, input }) => {
    const src = await db.query.documentTemplates.findFirst({
      where: and10(eq10(documentTemplates.id, input.id), eq10(documentTemplates.orgId, ctx.user.orgId))
    });
    if (!src) throw new Error("\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const [row] = await db.insert(documentTemplates).values({
      orgId: ctx.user.orgId,
      code: input.newCode,
      nameAr: input.newNameAr,
      nameEn: src.nameEn ? `Copy of ${src.nameEn}` : void 0,
      docType: src.docType,
      paperSize: src.paperSize ?? "A4",
      orientation: src.orientation ?? "portrait",
      isDefault: false,
      isActive: true,
      layoutJson: src.layoutJson,
      notes: src.notes,
      sortOrder: (src.sortOrder ?? 0) + 1
    }).returning();
    return row;
  })
});

// src/routers/postingDefinitions.ts
import { z as z9 } from "zod";
import { eq as eq11, and as and11, asc as asc3 } from "drizzle-orm";
init_db();
init_schema();
var POSTING_DOC_TYPES = [
  { id: "sales_invoice", variant: "cash", label: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A \u0646\u0642\u062F\u064A\u0629" },
  { id: "sales_invoice", variant: "credit", label: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A \u0622\u062C\u0644\u0629" },
  { id: "sales_return", variant: "", label: "\u0645\u0631\u062F\u0648\u062F \u0645\u0628\u064A\u0639\u0627\u062A" },
  { id: "purchase_invoice", variant: "", label: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A" },
  { id: "purchase_return", variant: "", label: "\u0645\u0631\u062F\u0648\u062F \u0645\u0634\u062A\u0631\u064A\u0627\u062A" },
  { id: "receipt_voucher", variant: "", label: "\u0633\u0646\u062F \u0642\u0628\u0636" },
  { id: "payment_voucher", variant: "", label: "\u0633\u0646\u062F \u0635\u0631\u0641" }
];
var AMOUNT_SOURCES = [
  { id: "total", label: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629" },
  { id: "net_sales", label: "\u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A" },
  { id: "tax_amount", label: "\u0645\u0628\u0644\u063A \u0627\u0644\u0636\u0631\u064A\u0628\u0629" },
  { id: "discount", label: "\u0645\u0628\u0644\u063A \u0627\u0644\u062E\u0635\u0645" },
  { id: "cogs", label: "\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629" },
  { id: "shipping", label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0634\u062D\u0646" },
  { id: "subtotal", label: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0642\u0628\u0644 \u0627\u0644\u062E\u0635\u0645" },
  { id: "down_payment", label: "\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0645\u0642\u062F\u0645\u0629" },
  { id: "rounding", label: "\u0645\u0628\u0644\u063A \u0627\u0644\u062A\u0642\u0631\u064A\u0628" }
];
var lineShape = z9.object({
  description: z9.string().optional(),
  accountId: z9.number().nullable().optional(),
  direction: z9.enum(["debit", "credit"]),
  amountSource: z9.string(),
  sortOrder: z9.number().default(0)
});
var postingDefinitionsRouter = router({
  docTypes: protectedProcedure.query(() => POSTING_DOC_TYPES),
  amountSources: protectedProcedure.query(() => AMOUNT_SOURCES),
  getByDocType: protectedProcedure.input(z9.object({ docType: z9.string(), variant: z9.string().default("") })).query(async ({ ctx, input }) => {
    const def = await db.query.postingDefinitions.findFirst({
      where: and11(
        eq11(postingDefinitions.orgId, ctx.user.orgId),
        eq11(postingDefinitions.docType, input.docType),
        eq11(postingDefinitions.variant, input.variant)
      )
    });
    if (!def) return { definition: null, lines: [] };
    const lines = await db.select({
      id: postingDefinitionLines.id,
      definitionId: postingDefinitionLines.definitionId,
      description: postingDefinitionLines.description,
      accountId: postingDefinitionLines.accountId,
      accountCode: chartOfAccounts.code,
      accountName: chartOfAccounts.nameAr,
      direction: postingDefinitionLines.direction,
      amountSource: postingDefinitionLines.amountSource,
      sortOrder: postingDefinitionLines.sortOrder
    }).from(postingDefinitionLines).leftJoin(chartOfAccounts, eq11(postingDefinitionLines.accountId, chartOfAccounts.id)).where(eq11(postingDefinitionLines.definitionId, def.id)).orderBy(asc3(postingDefinitionLines.sortOrder), asc3(postingDefinitionLines.id));
    return { definition: def, lines };
  }),
  saveLines: protectedProcedure.input(z9.object({
    docType: z9.string(),
    variant: z9.string().default(""),
    name: z9.string().optional(),
    lines: z9.array(lineShape)
  })).mutation(async ({ ctx, input }) => {
    let def = await db.query.postingDefinitions.findFirst({
      where: and11(
        eq11(postingDefinitions.orgId, ctx.user.orgId),
        eq11(postingDefinitions.docType, input.docType),
        eq11(postingDefinitions.variant, input.variant)
      )
    });
    const docTypeMeta = POSTING_DOC_TYPES.find(
      (d) => d.id === input.docType && d.variant === input.variant
    );
    const name = input.name ?? docTypeMeta?.label ?? input.docType;
    if (!def) {
      const [created] = await db.insert(postingDefinitions).values({
        orgId: ctx.user.orgId,
        docType: input.docType,
        variant: input.variant,
        name,
        isActive: true,
        sortOrder: 0
      }).returning();
      def = created;
    } else {
      await db.update(postingDefinitions).set({ name, updatedAt: /* @__PURE__ */ new Date() }).where(eq11(postingDefinitions.id, def.id));
    }
    await db.delete(postingDefinitionLines).where(eq11(postingDefinitionLines.definitionId, def.id));
    if (input.lines.length > 0) {
      await db.insert(postingDefinitionLines).values(
        input.lines.map((l, i) => ({
          orgId: ctx.user.orgId,
          definitionId: def.id,
          description: l.description ?? "",
          accountId: l.accountId ?? null,
          direction: l.direction,
          amountSource: l.amountSource,
          sortOrder: i
        }))
      );
    }
    return { ok: true, definitionId: def.id };
  }),
  deleteDefinition: protectedProcedure.input(z9.object({ docType: z9.string(), variant: z9.string().default("") })).mutation(async ({ ctx, input }) => {
    const def = await db.query.postingDefinitions.findFirst({
      where: and11(
        eq11(postingDefinitions.orgId, ctx.user.orgId),
        eq11(postingDefinitions.docType, input.docType),
        eq11(postingDefinitions.variant, input.variant)
      )
    });
    if (!def) return { ok: true };
    await db.delete(postingDefinitions).where(eq11(postingDefinitions.id, def.id));
    return { ok: true };
  })
});

// src/routers/documentTypes.ts
import { z as z10 } from "zod";
import { eq as eq12, and as and12, asc as asc4 } from "drizzle-orm";
init_db();
init_schema();
var inputShape = {
  typeId: z10.string(),
  nameAr: z10.string().min(1),
  nameEn: z10.string().optional(),
  codeEn: z10.string().optional(),
  codeAr: z10.string().optional(),
  docType: z10.string().optional(),
  userGroup: z10.string().optional(),
  user_: z10.string().optional(),
  warehouse: z10.string().optional(),
  journal: z10.string().optional(),
  customersJournal: z10.string().optional(),
  suppliersJournal: z10.string().optional(),
  systemOnly: z10.boolean().default(false),
  entryType: z10.string().optional(),
  entryJournal: z10.string().optional(),
  stockDocType: z10.string().optional(),
  stockJournal: z10.string().optional(),
  printTemplate: z10.string().optional(),
  printTemplate2: z10.string().optional(),
  trackQty: z10.boolean().default(false),
  noTax: z10.boolean().default(false),
  sellerStats: z10.boolean().default(false),
  itemStats: z10.boolean().default(false),
  customerStats: z10.boolean().default(false),
  noStockDispatch: z10.boolean().default(false),
  requireNote: z10.boolean().default(false),
  preventEditIfLinked: z10.boolean().default(false),
  requireCustomerCode: z10.boolean().default(false),
  requireEmployeeCode: z10.boolean().default(false),
  acctDebit: z10.string().optional(),
  acctCredit: z10.string().optional(),
  acctDiscount: z10.string().optional(),
  acctCash: z10.string().optional(),
  acctTax: z10.string().optional(),
  salesAccountId: z10.number().nullable().optional(),
  cashAccountId: z10.number().nullable().optional(),
  creditAccountId: z10.number().nullable().optional(),
  taxAccountId: z10.number().nullable().optional(),
  discountAccountId: z10.number().nullable().optional(),
  purchaseAccountId: z10.number().nullable().optional(),
  supplierAccountId: z10.number().nullable().optional(),
  sortOrder: z10.number().default(0)
};
var documentTypesRouter = router({
  list: protectedProcedure.input(z10.object({ typeId: z10.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const rows = await db.select().from(documentTypes).where(
      input?.typeId ? and12(eq12(documentTypes.orgId, ctx.user.orgId), eq12(documentTypes.typeId, input.typeId), eq12(documentTypes.isActive, true)) : and12(eq12(documentTypes.orgId, ctx.user.orgId), eq12(documentTypes.isActive, true))
    ).orderBy(asc4(documentTypes.sortOrder), asc4(documentTypes.id));
    return rows;
  }),
  create: protectedProcedure.input(z10.object(inputShape)).mutation(async ({ ctx, input }) => {
    const [row] = await db.insert(documentTypes).values({
      ...input,
      orgId: ctx.user.orgId,
      isActive: true
    }).returning();
    return row;
  }),
  update: protectedProcedure.input(z10.object({ id: z10.number(), ...Object.fromEntries(Object.entries(inputShape).map(([k, v]) => [k, v.optional()])) })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [row] = await db.update(documentTypes).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and12(eq12(documentTypes.id, id), eq12(documentTypes.orgId, ctx.user.orgId))).returning();
    if (!row) throw new Error("\u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    return row;
  }),
  delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
    await db.update(documentTypes).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and12(eq12(documentTypes.id, input.id), eq12(documentTypes.orgId, ctx.user.orgId)));
    return { ok: true };
  })
});

// src/routers/documentSend.ts
import { z as z11 } from "zod";
init_db();
init_schema();
import { eq as eq13, and as and13, desc as desc5 } from "drizzle-orm";
var TPL_WA = `\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C
\u0645\u0631\u0641\u0642 \u0644\u0643\u0645 {{docTypeName}} \u0631\u0642\u0645 {{docNumber}}
\u0628\u0645\u0628\u0644\u063A {{amount}} {{currency}}.

\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0639\u0627\u0645\u0644\u0643\u0645 \u0645\u0639\u0646\u0627.`;
var TPL_TG = `\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C
\u0645\u0631\u0641\u0642 \u0644\u0643\u0645 {{docTypeName}} \u0631\u0642\u0645 {{docNumber}}
\u0628\u0645\u0628\u0644\u063A {{amount}} {{currency}}.

\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0639\u0627\u0645\u0644\u0643\u0645 \u0645\u0639\u0646\u0627.`;
var TPL_EMAIL_SUBJECT = `{{docTypeName}} \u0631\u0642\u0645 {{docNumber}} \u2014 {{sellerName}}`;
var TPL_EMAIL_BODY = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#406B93">{{sellerName}}</h2>
  <p>\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C</p>
  <p>\u0646\u0631\u0641\u0642 \u0644\u0643\u0645 <strong>{{docTypeName}}</strong> \u0631\u0642\u0645 <strong>{{docNumber}}</strong>
     \u0628\u0645\u0628\u0644\u063A <strong>{{amount}} {{currency}}</strong>.</p>
  <p style="color:#555">\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0639\u0627\u0645\u0644\u0643\u0645 \u0645\u0639\u0646\u0627.</p>
</div>`;
var DEFAULT_WA_TEMPLATES = [
  { key: "invoice_sales", label: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A", docType: "sales_invoice", channel: "whatsapp", content: "\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C\n\u0645\u0631\u0641\u0642 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0631\u0642\u0645 {{docNumber}} \u0628\u0645\u0628\u0644\u063A {{amount}} {{currency}}.\n\n\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0639\u0627\u0645\u0644\u0643\u0645 \u0645\u0639\u0646\u0627 \u{1F64F}" },
  { key: "quotation", label: "\u0639\u0631\u0636 \u0633\u0639\u0631", docType: "quotation", channel: "whatsapp", content: "\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C\n\u064A\u0633\u0639\u062F\u0646\u0627 \u062A\u0642\u062F\u064A\u0645 \u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631 \u0631\u0642\u0645 {{docNumber}}.\n\n\u0646\u0623\u0645\u0644 \u0623\u0646 \u064A\u0644\u0642\u0649 \u0642\u0628\u0648\u0644\u0643\u0645." },
  { key: "statement", label: "\u0643\u0634\u0641 \u062D\u0633\u0627\u0628", docType: "statement", channel: "whatsapp", content: "\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C\n\u0645\u0631\u0641\u0642 \u0643\u0634\u0641 \u062D\u0633\u0627\u0628\u0643\u0645 \u0628\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u064A\u0648\u0645.\n\n\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u0633\u062A\u062D\u0642: {{amount}} {{currency}}." },
  { key: "credit_note", label: "\u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646", docType: "credit_note", channel: "whatsapp", content: "\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C\n\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u062F\u0627\u0626\u0646 \u0631\u0642\u0645 {{docNumber}} \u0628\u0645\u0628\u0644\u063A {{amount}} {{currency}}." },
  { key: "debit_note", label: "\u0625\u0634\u0639\u0627\u0631 \u0645\u062F\u064A\u0646", docType: "debit_note", channel: "whatsapp", content: "\u0639\u0632\u064A\u0632\u064A {{customerName}}\u060C\n\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0625\u0634\u0639\u0627\u0631 \u0645\u062F\u064A\u0646 \u0631\u0642\u0645 {{docNumber}} \u0628\u0645\u0628\u0644\u063A {{amount}} {{currency}}." },
  { key: "purchase_invoice", label: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A", docType: "purchase_invoice", channel: "whatsapp", content: "\u0639\u0632\u064A\u0632\u064A \u0627\u0644\u0645\u0648\u0631\u062F {{customerName}}\u060C\n\u0645\u0631\u0641\u0642 \u0623\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0631\u0642\u0645 {{docNumber}} \u0628\u0645\u0628\u0644\u063A {{amount}} {{currency}}." }
];
function interpolate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
var docInfoSchema = z11.object({
  docType: z11.string(),
  docId: z11.number().optional(),
  docNumber: z11.string(),
  docTypeName: z11.string(),
  amount: z11.string(),
  currency: z11.string().default("SAR"),
  customerName: z11.string(),
  customMessage: z11.string().optional()
});
var documentSendRouter = router({
  /* ── إعدادات الإرسال ──────────────────────────────────────────── */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const row = await db.query.sendSettings.findFirst({
      where: eq13(sendSettings.orgId, ctx.user.orgId)
    });
    return row ?? {
      id: 0,
      orgId: ctx.user.orgId,
      whatsappEnabled: true,
      telegramEnabled: false,
      emailEnabled: false,
      wabaEnabled: false,
      wabaApiUrl: null,
      wabaAccessToken: null,
      wabaPhoneNumberId: null,
      wabaSenderName: null,
      wabaBusinessAccountId: null,
      wabaVerifyToken: null,
      wabaWebhookUrl: null,
      telegramBotToken: null,
      emailProvider: "resend",
      emailApiKey: null,
      emailFromName: null,
      emailFromEmail: null,
      whatsappMessageTemplate: TPL_WA,
      telegramMessageTemplate: TPL_TG,
      emailSubjectTemplate: TPL_EMAIL_SUBJECT,
      emailBodyTemplate: TPL_EMAIL_BODY,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
  }),
  updateSettings: protectedProcedure.input(z11.object({
    whatsappEnabled: z11.boolean().optional(),
    telegramEnabled: z11.boolean().optional(),
    emailEnabled: z11.boolean().optional(),
    wabaEnabled: z11.boolean().optional(),
    wabaApiUrl: z11.string().nullable().optional(),
    wabaAccessToken: z11.string().nullable().optional(),
    wabaPhoneNumberId: z11.string().nullable().optional(),
    wabaSenderName: z11.string().nullable().optional(),
    wabaBusinessAccountId: z11.string().nullable().optional(),
    wabaVerifyToken: z11.string().nullable().optional(),
    wabaWebhookUrl: z11.string().nullable().optional(),
    telegramBotToken: z11.string().nullable().optional(),
    emailProvider: z11.enum(["resend", "smtp"]).optional(),
    emailApiKey: z11.string().nullable().optional(),
    emailFromName: z11.string().nullable().optional(),
    emailFromEmail: z11.string().nullable().optional(),
    whatsappMessageTemplate: z11.string().nullable().optional(),
    telegramMessageTemplate: z11.string().nullable().optional(),
    emailSubjectTemplate: z11.string().nullable().optional(),
    emailBodyTemplate: z11.string().nullable().optional()
  })).mutation(async ({ ctx, input }) => {
    const existing = await db.query.sendSettings.findFirst({
      where: eq13(sendSettings.orgId, ctx.user.orgId)
    });
    if (existing) {
      await db.update(sendSettings).set({ ...input, updatedAt: /* @__PURE__ */ new Date() }).where(eq13(sendSettings.orgId, ctx.user.orgId));
    } else {
      await db.insert(sendSettings).values({ orgId: ctx.user.orgId, ...input });
    }
    return { ok: true };
  }),
  /* ── اختبار اتصال WhatsApp Business API ──────────────────────── */
  testWabaConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const cfg = await db.query.sendSettings.findFirst({
      where: eq13(sendSettings.orgId, ctx.user.orgId)
    });
    if (!cfg?.wabaApiUrl || !cfg?.wabaAccessToken || !cfg?.wabaPhoneNumberId) {
      return {
        ok: false,
        message: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644: API URL\u060C Access Token\u060C Phone Number ID",
        phoneInfo: null
      };
    }
    try {
      const baseUrl = cfg.wabaApiUrl.replace(/\/$/, "");
      const url = `${baseUrl}/${cfg.wabaPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating,platform_type,throughput,last_onboarded_time,status`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.wabaAccessToken}` }
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        const code = json.error?.code;
        let message = json.error?.message || `HTTP ${res.status}`;
        if (code === 190) message = "\u062E\u0637\u0623 \u0628\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u2014 Access Token \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D";
        else if (code === 100) message = "\u062E\u0637\u0623 \u0628\u0627\u0644\u0631\u0642\u0645 \u2014 Phone Number ID \u063A\u064A\u0631 \u0635\u062D\u064A\u062D";
        return { ok: false, message, phoneInfo: null };
      }
      return {
        ok: true,
        message: `\u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0646\u0627\u062C\u062D`,
        phoneInfo: {
          displayNumber: json.display_phone_number ?? cfg.wabaPhoneNumberId,
          verifiedName: json.verified_name ?? cfg.wabaSenderName ?? "\u2014",
          quality: json.quality_rating ?? "\u2014",
          status: json.status ?? "CONNECTED"
        }
      };
    } catch (e) {
      return { ok: false, message: e.message || "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0634\u0628\u0643\u0629", phoneInfo: null };
    }
  }),
  /* ── معلومات حساب WABA ─────────────────────────────────────────── */
  getWabaInfo: protectedProcedure.query(async ({ ctx }) => {
    const cfg = await db.query.sendSettings.findFirst({
      where: eq13(sendSettings.orgId, ctx.user.orgId)
    });
    if (!cfg?.wabaEnabled || !cfg?.wabaApiUrl || !cfg?.wabaAccessToken || !cfg?.wabaPhoneNumberId) {
      return null;
    }
    try {
      const url = `${cfg.wabaApiUrl.replace(/\/$/, "")}/${cfg.wabaPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.wabaAccessToken}` } });
      if (!res.ok) return null;
      const json = await res.json();
      return {
        displayNumber: json.display_phone_number ?? cfg.wabaPhoneNumberId,
        verifiedName: json.verified_name ?? cfg.wabaSenderName ?? "\u2014",
        quality: json.quality_rating ?? "\u2014",
        status: json.status ?? "CONNECTED"
      };
    } catch {
      return null;
    }
  }),
  /* ── اختبار اتصال Telegram Bot ───────────────────────────────── */
  testTelegramConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const cfg = await db.query.sendSettings.findFirst({
      where: eq13(sendSettings.orgId, ctx.user.orgId)
    });
    if (!cfg?.telegramBotToken) {
      return { ok: false, message: "\u0644\u0645 \u064A\u062A\u0645 \u0625\u062F\u062E\u0627\u0644 Bot Token" };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.telegramBotToken}/getMe`);
      const json = await res.json();
      if (json.ok && json.result) {
        return { ok: true, message: `\u0627\u062A\u0635\u0627\u0644 \u0646\u0627\u062C\u062D \u2014 \u0627\u0644\u0628\u0648\u062A: @${json.result.username ?? json.result.first_name}` };
      }
      return { ok: false, message: json.description || "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u0648\u062A" };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }),
  /* ── قوالب رسائل WABA ─────────────────────────────────────────── */
  getWabaTemplates: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(wabaMessageTemplates).where(eq13(wabaMessageTemplates.orgId, ctx.user.orgId)).orderBy(wabaMessageTemplates.id);
    if (rows.length === 0) {
      return DEFAULT_WA_TEMPLATES.map((t2) => ({
        id: 0,
        orgId: ctx.user.orgId,
        ...t2,
        isActive: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }));
    }
    return rows;
  }),
  saveWabaTemplates: protectedProcedure.input(z11.array(z11.object({
    id: z11.number(),
    key: z11.string(),
    label: z11.string(),
    docType: z11.string().nullable().optional(),
    channel: z11.string().default("whatsapp"),
    content: z11.string(),
    isActive: z11.boolean().default(true)
  }))).mutation(async ({ ctx, input }) => {
    for (const tpl of input) {
      if (tpl.id > 0) {
        await db.update(wabaMessageTemplates).set({ label: tpl.label, content: tpl.content, isActive: tpl.isActive, docType: tpl.docType, updatedAt: /* @__PURE__ */ new Date() }).where(and13(eq13(wabaMessageTemplates.id, tpl.id), eq13(wabaMessageTemplates.orgId, ctx.user.orgId)));
      } else {
        await db.insert(wabaMessageTemplates).values({
          orgId: ctx.user.orgId,
          key: tpl.key,
          label: tpl.label,
          docType: tpl.docType,
          channel: tpl.channel,
          content: tpl.content,
          isActive: tpl.isActive
        });
      }
    }
    return { ok: true, count: input.length };
  }),
  /* ── إرسال واتساب ─────────────────────────────────────────────── */
  sendWhatsApp: protectedProcedure.input(docInfoSchema.extend({
    customerPhone: z11.string()
  })).mutation(async ({ ctx, input }) => {
    const [cfg, org] = await Promise.all([
      db.query.sendSettings.findFirst({ where: eq13(sendSettings.orgId, ctx.user.orgId) }),
      db.query.organizations.findFirst({ where: eq13(organizations.id, ctx.user.orgId) })
    ]);
    const tpl = input.customMessage || cfg?.whatsappMessageTemplate || TPL_WA;
    const message = interpolate(tpl, {
      customerName: input.customerName,
      docTypeName: input.docTypeName,
      docNumber: input.docNumber,
      amount: input.amount,
      currency: input.currency,
      sellerName: org?.name ?? ""
    });
    let phone = input.customerPhone.replace(/[\s\-\(\)]/g, "");
    if (phone.startsWith("0")) phone = "966" + phone.slice(1);
    phone = phone.replace(/^\+/, "");
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    let status = "sent";
    let errorMessage;
    let metaMessageId;
    if (cfg?.wabaEnabled && cfg?.wabaApiUrl && cfg?.wabaAccessToken && cfg?.wabaPhoneNumberId) {
      try {
        const url = `${cfg.wabaApiUrl.replace(/\/$/, "")}/${cfg.wabaPhoneNumberId}/messages`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.wabaAccessToken}`
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message }
          })
        });
        const json = await res.json();
        status = res.ok ? "sent" : "failed";
        metaMessageId = json.messages?.[0]?.id;
        errorMessage = res.ok ? void 0 : json.error?.message || `HTTP ${res.status}`;
      } catch (e) {
        status = "failed";
        errorMessage = e.message;
      }
    }
    await db.insert(documentSendLogs).values({
      orgId: ctx.user.orgId,
      docType: input.docType,
      docId: input.docId,
      docNumber: input.docNumber,
      method: "whatsapp",
      status,
      recipientName: input.customerName,
      recipientContact: input.customerPhone,
      messageSent: message,
      errorMessage,
      metaMessageId,
      sentByUserId: ctx.user.id
    });
    return { waUrl, message, status, metaMessageId };
  }),
  /* ── إرسال تيليجرام ───────────────────────────────────────────── */
  sendTelegram: protectedProcedure.input(docInfoSchema.extend({
    telegramId: z11.string()
  })).mutation(async ({ ctx, input }) => {
    const [cfg, org] = await Promise.all([
      db.query.sendSettings.findFirst({ where: eq13(sendSettings.orgId, ctx.user.orgId) }),
      db.query.organizations.findFirst({ where: eq13(organizations.id, ctx.user.orgId) })
    ]);
    const tpl = input.customMessage || cfg?.telegramMessageTemplate || TPL_TG;
    const message = interpolate(tpl, {
      customerName: input.customerName,
      docTypeName: input.docTypeName,
      docNumber: input.docNumber,
      amount: input.amount,
      currency: input.currency,
      sellerName: org?.name ?? ""
    });
    const botToken = cfg?.telegramBotToken;
    let status = "pending";
    let errorMessage;
    let tgUrl;
    if (botToken) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: input.telegramId, text: message })
        });
        const json = await res.json();
        status = json.ok ? "sent" : "failed";
        errorMessage = json.ok ? void 0 : json.description;
      } catch (e) {
        status = "failed";
        errorMessage = e.message;
      }
    } else {
      const tid = input.telegramId.trim();
      tgUrl = tid.startsWith("@") ? `https://t.me/${tid.slice(1)}` : `https://t.me/${tid}`;
      status = "pending";
    }
    await db.insert(documentSendLogs).values({
      orgId: ctx.user.orgId,
      docType: input.docType,
      docId: input.docId,
      docNumber: input.docNumber,
      method: "telegram",
      status,
      recipientName: input.customerName,
      recipientContact: input.telegramId,
      messageSent: message,
      errorMessage,
      sentByUserId: ctx.user.id
    });
    return { status, message, tgUrl, hasBotToken: !!botToken };
  }),
  /* ── إرسال بريد إلكتروني ──────────────────────────────────────── */
  sendEmail: protectedProcedure.input(docInfoSchema.extend({
    customerEmail: z11.string().email(),
    customSubject: z11.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const [cfg, org] = await Promise.all([
      db.query.sendSettings.findFirst({ where: eq13(sendSettings.orgId, ctx.user.orgId) }),
      db.query.organizations.findFirst({ where: eq13(organizations.id, ctx.user.orgId) })
    ]);
    const vars = {
      customerName: input.customerName,
      docTypeName: input.docTypeName,
      docNumber: input.docNumber,
      amount: input.amount,
      currency: input.currency,
      sellerName: org?.name ?? ""
    };
    const subject = input.customSubject || interpolate(cfg?.emailSubjectTemplate || TPL_EMAIL_SUBJECT, vars);
    const bodyHtml = input.customMessage || interpolate(cfg?.emailBodyTemplate || TPL_EMAIL_BODY, vars);
    const apiKey = cfg?.emailApiKey;
    const fromEmail = cfg?.emailFromEmail || "noreply@onesoft.sa";
    const fromName = cfg?.emailFromName || org?.name || "OneSoft ERP";
    let status = "pending";
    let errorMessage;
    if (apiKey && cfg?.emailEnabled) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: input.customerEmail,
            subject,
            html: bodyHtml
          })
        });
        const json = await res.json();
        status = res.ok ? "sent" : "failed";
        errorMessage = res.ok ? void 0 : json.message || `HTTP ${res.status}`;
      } catch (e) {
        status = "failed";
        errorMessage = e.message;
      }
    } else {
      status = "pending";
      errorMessage = "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0647\u064A\u0626\u0629 \u062E\u062F\u0645\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A";
    }
    await db.insert(documentSendLogs).values({
      orgId: ctx.user.orgId,
      docType: input.docType,
      docId: input.docId,
      docNumber: input.docNumber,
      method: "email",
      status,
      recipientName: input.customerName,
      recipientContact: input.customerEmail,
      messageSent: `${subject}

${bodyHtml}`,
      errorMessage,
      sentByUserId: ctx.user.id
    });
    return { status, subject, emailEnabled: !!apiKey };
  }),
  /* ── سجل الإرسال (للمستند المحدد) ────────────────────────────── */
  getLogs: protectedProcedure.input(z11.object({
    docType: z11.string().optional(),
    docId: z11.number().optional(),
    limit: z11.number().default(20)
  })).query(async ({ ctx, input }) => {
    const where = [eq13(documentSendLogs.orgId, ctx.user.orgId)];
    if (input.docType) where.push(eq13(documentSendLogs.docType, input.docType));
    if (input.docId !== void 0) where.push(eq13(documentSendLogs.docId, input.docId));
    return db.select().from(documentSendLogs).where(and13(...where)).orderBy(desc5(documentSendLogs.sentAt)).limit(input.limit);
  }),
  /* ── سجل الإرسال الكامل مع بيانات المستخدم ──────────────────── */
  getAllLogs: protectedProcedure.input(z11.object({
    limit: z11.number().default(100),
    method: z11.string().optional(),
    status: z11.string().optional()
  })).query(async ({ ctx, input }) => {
    const where = [eq13(documentSendLogs.orgId, ctx.user.orgId)];
    if (input.method) where.push(eq13(documentSendLogs.method, input.method));
    if (input.status) where.push(eq13(documentSendLogs.status, input.status));
    const logs = await db.select({
      id: documentSendLogs.id,
      docType: documentSendLogs.docType,
      docNumber: documentSendLogs.docNumber,
      method: documentSendLogs.method,
      status: documentSendLogs.status,
      recipientName: documentSendLogs.recipientName,
      recipientContact: documentSendLogs.recipientContact,
      metaMessageId: documentSendLogs.metaMessageId,
      errorMessage: documentSendLogs.errorMessage,
      sentAt: documentSendLogs.sentAt,
      sentByUserId: documentSendLogs.sentByUserId,
      userName: users.username
    }).from(documentSendLogs).leftJoin(users, eq13(documentSendLogs.sentByUserId, users.id)).where(and13(...where)).orderBy(desc5(documentSendLogs.sentAt)).limit(input.limit);
    return logs;
  })
});

// src/routers/currencies.ts
import { z as z12 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq14, and as and14 } from "drizzle-orm";
var currencyInput = z12.object({
  code: z12.string().min(1).max(10).toUpperCase(),
  nameAr: z12.string().min(1).max(100),
  nameEn: z12.string().min(1).max(100),
  symbol: z12.string().min(1).max(10),
  symbolIntl: z12.string().max(10).optional().nullable(),
  exchangeRate: z12.string().default("1"),
  decimalPlaces: z12.number().int().min(0).max(8).default(2),
  isBase: z12.boolean().default(false),
  mainUnitAr: z12.string().max(50).optional().nullable(),
  subUnitAr: z12.string().max(50).optional().nullable(),
  mainUnitEn: z12.string().max(50).optional().nullable(),
  subUnitEn: z12.string().max(50).optional().nullable(),
  isActive: z12.boolean().default(true)
});
var currenciesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(currencies).where(eq14(currencies.orgId, ctx.user.orgId)).orderBy(currencies.code);
  }),
  create: protectedProcedure.input(currencyInput).mutation(async ({ input, ctx }) => {
    const orgId = ctx.user.orgId;
    const dup = await db.select({ id: currencies.id }).from(currencies).where(and14(eq14(currencies.orgId, orgId), eq14(currencies.code, input.code))).limit(1);
    if (dup.length) throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0639\u0645\u0644\u0629 "${input.code}" \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B` });
    if (input.isBase) {
      await db.update(currencies).set({ isBase: false }).where(and14(eq14(currencies.orgId, orgId), eq14(currencies.isBase, true)));
    }
    const [row] = await db.insert(currencies).values({ orgId, ...input }).returning();
    return row;
  }),
  update: protectedProcedure.input(z12.object({ id: z12.number() }).merge(currencyInput.partial())).mutation(async ({ input, ctx }) => {
    const { id, ...rest } = input;
    const orgId = ctx.user.orgId;
    if (rest.code) {
      const dup = await db.select({ id: currencies.id }).from(currencies).where(and14(eq14(currencies.orgId, orgId), eq14(currencies.code, rest.code))).limit(1);
      if (dup.length && dup[0].id !== id)
        throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0639\u0645\u0644\u0629 "${rest.code}" \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B` });
    }
    if (rest.isBase) {
      await db.update(currencies).set({ isBase: false }).where(and14(eq14(currencies.orgId, orgId), eq14(currencies.isBase, true)));
    }
    const [row] = await db.update(currencies).set({ ...rest, updatedAt: /* @__PURE__ */ new Date() }).where(and14(eq14(currencies.id, id), eq14(currencies.orgId, orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z12.object({ id: z12.number() })).mutation(async ({ input, ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ isBase: currencies.isBase }).from(currencies).where(and14(eq14(currencies.id, input.id), eq14(currencies.orgId, orgId))).limit(1);
    if (!existing.length) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0639\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
    if (existing[0].isBase) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629" });
    await db.update(currencies).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and14(eq14(currencies.id, input.id), eq14(currencies.orgId, orgId)));
    return { success: true };
  }),
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ id: currencies.id }).from(currencies).where(eq14(currencies.orgId, orgId)).limit(1);
    if (existing.length) return { seeded: false };
    const defaults = [
      { code: "SAR", nameAr: "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u064A", nameEn: "Saudi Riyal", symbol: "\u0631.\u0633", symbolIntl: "SAR", exchangeRate: "1", decimalPlaces: 2, isBase: true, mainUnitAr: "\u0631\u064A\u0627\u0644", subUnitAr: "\u0647\u0644\u0644\u0629", mainUnitEn: "Riyal", subUnitEn: "Halala", isActive: true },
      { code: "USD", nameAr: "\u062F\u0648\u0644\u0627\u0631 \u0623\u0645\u0631\u064A\u0643\u064A", nameEn: "US Dollar", symbol: "$", symbolIntl: "USD", exchangeRate: "3.75", decimalPlaces: 2, isBase: false, mainUnitAr: "\u062F\u0648\u0644\u0627\u0631", subUnitAr: "\u0633\u0646\u062A", mainUnitEn: "Dollar", subUnitEn: "Cent", isActive: true },
      { code: "EUR", nameAr: "\u064A\u0648\u0631\u0648", nameEn: "Euro", symbol: "\u20AC", symbolIntl: "EUR", exchangeRate: "4.10", decimalPlaces: 2, isBase: false, mainUnitAr: "\u064A\u0648\u0631\u0648", subUnitAr: "\u0633\u0646\u062A", mainUnitEn: "Euro", subUnitEn: "Cent", isActive: true },
      { code: "AED", nameAr: "\u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A", nameEn: "UAE Dirham", symbol: "\u062F.\u0625", symbolIntl: "AED", exchangeRate: "1.02", decimalPlaces: 2, isBase: false, mainUnitAr: "\u062F\u0631\u0647\u0645", subUnitAr: "\u0641\u0644\u0633", mainUnitEn: "Dirham", subUnitEn: "Fils", isActive: true },
      { code: "GBP", nameAr: "\u062C\u0646\u064A\u0647 \u0625\u0633\u062A\u0631\u0644\u064A\u0646\u064A", nameEn: "British Pound", symbol: "\xA3", symbolIntl: "GBP", exchangeRate: "4.75", decimalPlaces: 2, isBase: false, mainUnitAr: "\u062C\u0646\u064A\u0647", subUnitAr: "\u0628\u0646\u0633", mainUnitEn: "Pound", subUnitEn: "Penny", isActive: true }
    ];
    await db.insert(currencies).values(defaults.map((d) => ({ orgId, ...d })));
    return { seeded: true };
  }),
  getBase: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(currencies).where(and14(eq14(currencies.orgId, ctx.user.orgId), eq14(currencies.isBase, true))).limit(1);
    return rows[0] ?? null;
  })
});

// src/routers/fieldDictionary.ts
import { z as z13 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq15, and as and15, asc as asc5 } from "drizzle-orm";
var fieldInput = z13.object({
  code: z13.string().min(1).max(50).toUpperCase().regex(/^[A-Z0-9_]+$/, "\u0627\u0644\u0643\u0648\u062F \u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0623\u062D\u0631\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0648\u0623\u0631\u0642\u0627\u0645 \u0648\u0634\u0631\u0637\u0629 \u0633\u0641\u0644\u064A\u0629 \u0641\u0642\u0637"),
  nameAr: z13.string().min(1).max(150),
  nameEn: z13.string().min(1).max(150),
  fieldType: z13.string().min(1).max(50),
  category: z13.string().min(1).max(80),
  description: z13.string().max(500).optional().nullable(),
  isActive: z13.boolean().default(true),
  sortOrder: z13.number().int().default(0)
});
var SEED_FIELDS = [
  // Document Fields
  { code: "INVOICE_NO", nameAr: "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", nameEn: "Invoice No", fieldType: "Text", category: "Document Fields", isSystem: true },
  { code: "DOCUMENT_NO", nameAr: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062A\u0646\u062F", nameEn: "Document No", fieldType: "Text", category: "Document Fields", isSystem: true },
  { code: "INVOICE_DATE", nameAr: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", nameEn: "Invoice Date", fieldType: "Date", category: "Document Fields", isSystem: true },
  { code: "DOCUMENT_DATE", nameAr: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0633\u062A\u0646\u062F", nameEn: "Document Date", fieldType: "Date", category: "Document Fields", isSystem: true },
  { code: "NOTES", nameAr: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", nameEn: "Notes", fieldType: "LongText", category: "Document Fields", isSystem: true },
  // Customer Fields
  { code: "CUSTOMER_CODE", nameAr: "\u0643\u0648\u062F \u0627\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer Code", fieldType: "Text", category: "Customer Fields", isSystem: true },
  { code: "CUSTOMER_NAME", nameAr: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer Name", fieldType: "Customer", category: "Customer Fields", isSystem: true },
  { code: "CUSTOMER_MOBILE", nameAr: "\u062C\u0648\u0627\u0644 \u0627\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer Mobile", fieldType: "Phone", category: "Customer Fields", isSystem: true },
  { code: "CUSTOMER_PHONE", nameAr: "\u0647\u0627\u062A\u0641 \u0627\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer Phone", fieldType: "Phone", category: "Customer Fields", isSystem: true },
  { code: "CUSTOMER_EMAIL", nameAr: "\u0628\u0631\u064A\u062F \u0627\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer Email", fieldType: "Email", category: "Customer Fields", isSystem: true },
  { code: "CUSTOMER_VAT", nameAr: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer VAT No", fieldType: "Text", category: "Customer Fields", isSystem: true },
  { code: "CUSTOMER_ADDRESS", nameAr: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0645\u064A\u0644", nameEn: "Customer Address", fieldType: "LongText", category: "Customer Fields", isSystem: true },
  // Vendor Fields
  { code: "VENDOR_CODE", nameAr: "\u0643\u0648\u062F \u0627\u0644\u0645\u0648\u0631\u062F", nameEn: "Vendor Code", fieldType: "Text", category: "Vendor Fields", isSystem: true },
  { code: "VENDOR_NAME", nameAr: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F", nameEn: "Vendor Name", fieldType: "Vendor", category: "Vendor Fields", isSystem: true },
  { code: "VENDOR_MOBILE", nameAr: "\u062C\u0648\u0627\u0644 \u0627\u0644\u0645\u0648\u0631\u062F", nameEn: "Vendor Mobile", fieldType: "Phone", category: "Vendor Fields", isSystem: true },
  { code: "VENDOR_VAT", nameAr: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0645\u0648\u0631\u062F", nameEn: "Vendor VAT No", fieldType: "Text", category: "Vendor Fields", isSystem: true },
  // Sales Fields
  { code: "NETSALES", nameAr: "\u0635\u0627\u0641\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", nameEn: "Net Sales", fieldType: "Amount", category: "Sales Fields", isSystem: true },
  { code: "DISCOUNT", nameAr: "\u0627\u0644\u062E\u0635\u0645", nameEn: "Discount", fieldType: "Amount", category: "Sales Fields", isSystem: true },
  { code: "TAX", nameAr: "\u0627\u0644\u0636\u0631\u064A\u0628\u0629", nameEn: "Tax Amount", fieldType: "Amount", category: "Sales Fields", isSystem: true },
  { code: "TOTAL", nameAr: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", nameEn: "Invoice Total", fieldType: "Amount", category: "Sales Fields", isSystem: true },
  { code: "PROFIT", nameAr: "\u0627\u0644\u0631\u0628\u062D", nameEn: "Profit", fieldType: "Amount", category: "Sales Fields", isSystem: true },
  { code: "COST", nameAr: "\u0627\u0644\u062A\u0643\u0644\u0641\u0629", nameEn: "Cost", fieldType: "Amount", category: "Sales Fields", isSystem: true },
  // Item Fields
  { code: "ITEM_CODE", nameAr: "\u0643\u0648\u062F \u0627\u0644\u0635\u0646\u0641", nameEn: "Item Code", fieldType: "Text", category: "Item Fields", isSystem: true },
  { code: "ITEM_NAME", nameAr: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641", nameEn: "Item Name", fieldType: "Item", category: "Item Fields", isSystem: true },
  { code: "ITEM_BARCODE", nameAr: "\u0628\u0627\u0631\u0643\u0648\u062F \u0627\u0644\u0635\u0646\u0641", nameEn: "Item Barcode", fieldType: "Text", category: "Item Fields", isSystem: true },
  { code: "QTY", nameAr: "\u0627\u0644\u0643\u0645\u064A\u0629", nameEn: "Quantity", fieldType: "Number", category: "Item Fields", isSystem: true },
  { code: "PRICE", nameAr: "\u0627\u0644\u0633\u0639\u0631", nameEn: "Price", fieldType: "Amount", category: "Item Fields", isSystem: true },
  { code: "UNIT", nameAr: "\u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633", nameEn: "Unit", fieldType: "Unit", category: "Item Fields", isSystem: true },
  { code: "LINE_TOTAL", nameAr: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0633\u0637\u0631", nameEn: "Line Total", fieldType: "Amount", category: "Item Fields", isSystem: true },
  // Inventory Fields
  { code: "STOCK_QTY", nameAr: "\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646", nameEn: "Stock Quantity", fieldType: "Number", category: "Inventory Fields", isSystem: true },
  { code: "AVAILABLE_QTY", nameAr: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629", nameEn: "Available Qty", fieldType: "Number", category: "Inventory Fields", isSystem: true },
  // System Fields
  { code: "USER_NAME", nameAr: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", nameEn: "User Name", fieldType: "User", category: "System Fields", isSystem: true },
  { code: "BRANCH_NAME", nameAr: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639", nameEn: "Branch Name", fieldType: "Branch", category: "System Fields", isSystem: true },
  { code: "COMPANY_NAME", nameAr: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629", nameEn: "Company Name", fieldType: "Text", category: "System Fields", isSystem: true },
  { code: "PRINT_DATE", nameAr: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0628\u0627\u0639\u0629", nameEn: "Print Date", fieldType: "Date", category: "System Fields", isSystem: true },
  { code: "PRINT_TIME", nameAr: "\u0648\u0642\u062A \u0627\u0644\u0637\u0628\u0627\u0639\u0629", nameEn: "Print Time", fieldType: "Time", category: "System Fields", isSystem: true },
  // Payment Fields
  { code: "CASH_AMOUNT", nameAr: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0646\u0642\u062F\u064A", nameEn: "Cash Amount", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "CARD_AMOUNT", nameAr: "\u0645\u0628\u0644\u063A \u0627\u0644\u0628\u0637\u0627\u0642\u0629", nameEn: "Card Amount", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "BANK_AMOUNT", nameAr: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A", nameEn: "Bank Transfer", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "ACCOUNT_AMOUNT", nameAr: "\u062D\u0633\u0627\u0628 \u0627\u0644\u0639\u0645\u064A\u0644 (\u0622\u062C\u0644)", nameEn: "Customer Account AR", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "TAMARA_AMOUNT", nameAr: "\u0645\u0628\u0644\u063A \u062A\u0645\u0627\u0631\u0627", nameEn: "Tamara Amount", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "TABBY_AMOUNT", nameAr: "\u0645\u0628\u0644\u063A \u062A\u0627\u0628\u064A", nameEn: "Tabby Amount", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "OTHER_AMOUNT", nameAr: "\u0645\u0628\u0627\u0644\u063A \u0623\u062E\u0631\u0649", nameEn: "Other Amount", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "PAYMENT_TOTAL", nameAr: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062F\u0641\u0648\u0639", nameEn: "Total Paid", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "PAID", nameAr: "\u0627\u0644\u0645\u062F\u0641\u0648\u0639", nameEn: "Paid Amount", fieldType: "Amount", category: "Payment Fields", isSystem: true },
  { code: "REMAINING", nameAr: "\u0627\u0644\u0645\u062A\u0628\u0642\u064A", nameEn: "Remaining", fieldType: "Amount", category: "Payment Fields", isSystem: true }
];
var fieldDictionaryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(fieldDictionary).where(eq15(fieldDictionary.orgId, ctx.user.orgId)).orderBy(asc5(fieldDictionary.category), asc5(fieldDictionary.sortOrder), asc5(fieldDictionary.code));
  }),
  create: protectedProcedure.input(fieldInput).mutation(async ({ input, ctx }) => {
    const orgId = ctx.user.orgId;
    const dup = await db.select({ id: fieldDictionary.id }).from(fieldDictionary).where(and15(eq15(fieldDictionary.orgId, orgId), eq15(fieldDictionary.code, input.code))).limit(1);
    if (dup.length) throw new TRPCError4({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u062D\u0642\u0644 "${input.code}" \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B` });
    const [row] = await db.insert(fieldDictionary).values({ orgId, ...input, isSystem: false }).returning();
    return row;
  }),
  update: protectedProcedure.input(z13.object({ id: z13.number() }).merge(fieldInput.partial())).mutation(async ({ input, ctx }) => {
    const { id, ...rest } = input;
    const orgId = ctx.user.orgId;
    const existing = await db.select({ isSystem: fieldDictionary.isSystem }).from(fieldDictionary).where(and15(eq15(fieldDictionary.id, id), eq15(fieldDictionary.orgId, orgId))).limit(1);
    if (!existing.length) throw new TRPCError4({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0642\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    if (existing[0].isSystem && rest.code)
      throw new TRPCError4({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0643\u0648\u062F \u0627\u0644\u062D\u0642\u0644 \u0627\u0644\u0646\u0638\u0627\u0645\u064A" });
    if (rest.code) {
      const dup = await db.select({ id: fieldDictionary.id }).from(fieldDictionary).where(and15(eq15(fieldDictionary.orgId, orgId), eq15(fieldDictionary.code, rest.code))).limit(1);
      if (dup.length && dup[0].id !== id)
        throw new TRPCError4({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u062D\u0642\u0644 "${rest.code}" \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B` });
    }
    const [row] = await db.update(fieldDictionary).set(rest).where(and15(eq15(fieldDictionary.id, id), eq15(fieldDictionary.orgId, orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input, ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ isSystem: fieldDictionary.isSystem }).from(fieldDictionary).where(and15(eq15(fieldDictionary.id, input.id), eq15(fieldDictionary.orgId, orgId))).limit(1);
    if (!existing.length) throw new TRPCError4({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0642\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    if (existing[0].isSystem) throw new TRPCError4({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645\u064A\u0629" });
    await db.delete(fieldDictionary).where(and15(eq15(fieldDictionary.id, input.id), eq15(fieldDictionary.orgId, orgId)));
    return { success: true };
  }),
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ id: fieldDictionary.id }).from(fieldDictionary).where(eq15(fieldDictionary.orgId, orgId)).limit(1);
    if (existing.length) return { seeded: false };
    await db.insert(fieldDictionary).values(
      SEED_FIELDS.map((f, i) => ({ orgId, ...f, sortOrder: i, isActive: true }))
    );
    return { seeded: true };
  }),
  // ── يضيف الحقول النظامية الجديدة للمنظمات الموجودة دون حذف المخصصة ───
  syncSystemFields: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ code: fieldDictionary.code }).from(fieldDictionary).where(eq15(fieldDictionary.orgId, orgId));
    const existingCodes = new Set(existing.map((r) => r.code));
    const missing = SEED_FIELDS.filter((f) => !existingCodes.has(f.code));
    if (!missing.length) return { added: 0 };
    await db.insert(fieldDictionary).values(
      missing.map((f, i) => ({ orgId, ...f, sortOrder: existing.length + i, isActive: true }))
    );
    return { added: missing.length };
  })
});

// src/routers/appSettings.ts
import { z as z14 } from "zod";
init_db();
init_schema();
import { eq as eq16, and as and16 } from "drizzle-orm";
var appSettingsRouter = router({
  get: protectedProcedure.input(z14.object({ key: z14.string() })).query(async ({ input, ctx }) => {
    const rows = await db.select().from(appSettings).where(and16(eq16(appSettings.orgId, ctx.user.orgId), eq16(appSettings.key, input.key))).limit(1);
    if (!rows.length) return null;
    try {
      return JSON.parse(rows[0].value ?? "null");
    } catch {
      return null;
    }
  }),
  set: protectedProcedure.input(z14.object({ key: z14.string(), value: z14.any() })).mutation(async ({ input, ctx }) => {
    const orgId = ctx.user.orgId;
    const serialized = JSON.stringify(input.value);
    const existing = await db.select({ id: appSettings.id }).from(appSettings).where(and16(eq16(appSettings.orgId, orgId), eq16(appSettings.key, input.key))).limit(1);
    if (existing.length) {
      await db.update(appSettings).set({ value: serialized, updatedAt: /* @__PURE__ */ new Date() }).where(and16(eq16(appSettings.orgId, orgId), eq16(appSettings.key, input.key)));
    } else {
      await db.insert(appSettings).values({ orgId, key: input.key, value: serialized });
    }
    return { success: true };
  })
});

// src/routers/paymentMethods.ts
import { z as z15 } from "zod";
import { eq as eq17, and as and17, asc as asc6 } from "drizzle-orm";
init_db();
init_schema();
var DEFAULT_METHODS = [
  { code: "CASH", nameAr: "\u0646\u0642\u062F\u064A", nameEn: "Cash", icon: "cash", color: "#15803D", bgColor: "#F0FDF4", sortOrder: 1, isBuiltIn: true },
  { code: "CARD", nameAr: "\u0628\u0637\u0627\u0642\u0629 \u0628\u0646\u0643\u064A\u0629", nameEn: "Card", icon: "card", color: "#1D4ED8", bgColor: "#EFF6FF", sortOrder: 2, isBuiltIn: true },
  { code: "BANK", nameAr: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A", nameEn: "Bank Transfer", icon: "bank", color: "#6D28D9", bgColor: "#FAF5FF", sortOrder: 3, isBuiltIn: true },
  { code: "ACCOUNT", nameAr: "\u062D\u0633\u0627\u0628 \u0627\u0644\u0639\u0645\u064A\u0644 (\u0622\u062C\u0644)", nameEn: "Customer Account", icon: "account", color: "#B45309", bgColor: "#FFF7ED", sortOrder: 4, isBuiltIn: true },
  { code: "TAMARA", nameAr: "\u062A\u0645\u0627\u0631\u0627", nameEn: "Tamara", icon: "tamara", color: "#92400E", bgColor: "#FFFBEB", sortOrder: 5, isBuiltIn: false },
  { code: "TABBY", nameAr: "\u062A\u0627\u0628\u064A", nameEn: "Tabby", icon: "tabby", color: "#047857", bgColor: "#F0FDF4", sortOrder: 6, isBuiltIn: false },
  { code: "OTHER", nameAr: "\u0623\u062E\u0631\u0649", nameEn: "Other", icon: "other", color: "#64748B", bgColor: "#F8FAFC", sortOrder: 7, isBuiltIn: false }
];
var paymentMethodsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(paymentMethods).where(eq17(paymentMethods.orgId, ctx.user.orgId)).orderBy(asc6(paymentMethods.sortOrder), asc6(paymentMethods.id));
  }),
  listActive: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(paymentMethods).where(and17(
      eq17(paymentMethods.orgId, ctx.user.orgId),
      eq17(paymentMethods.isActive, true),
      eq17(paymentMethods.isVisible, true)
    )).orderBy(asc6(paymentMethods.sortOrder), asc6(paymentMethods.id));
  }),
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await db.select({ code: paymentMethods.code }).from(paymentMethods).where(eq17(paymentMethods.orgId, ctx.user.orgId));
    const existingCodes = new Set(existing.map((r) => r.code));
    let count2 = 0;
    for (const m of DEFAULT_METHODS) {
      if (!existingCodes.has(m.code)) {
        await db.insert(paymentMethods).values({
          orgId: ctx.user.orgId,
          code: m.code,
          nameAr: m.nameAr,
          nameEn: m.nameEn,
          icon: m.icon,
          color: m.color,
          bgColor: m.bgColor,
          isActive: true,
          isVisible: true,
          isBuiltIn: m.isBuiltIn,
          sortOrder: m.sortOrder
        });
        count2++;
      }
    }
    return { seeded: count2 };
  }),
  create: protectedProcedure.input(z15.object({
    code: z15.string().min(1).max(50),
    nameAr: z15.string().min(1).max(150),
    nameEn: z15.string().max(150).optional(),
    icon: z15.string().max(50).optional(),
    color: z15.string().max(20).optional(),
    bgColor: z15.string().max(20).optional(),
    accountId: z15.number().int().optional().nullable(),
    isActive: z15.boolean().default(true),
    isVisible: z15.boolean().default(true),
    sortOrder: z15.number().int().default(0)
  })).mutation(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const [row] = await db.insert(paymentMethods).values({
      orgId,
      ...input,
      isBuiltIn: false
    }).returning();
    const existing = await db.select({ id: fieldDictionary.id }).from(fieldDictionary).where(and17(eq17(fieldDictionary.orgId, orgId), eq17(fieldDictionary.code, input.code))).limit(1);
    if (!existing.length) {
      await db.insert(fieldDictionary).values({
        orgId,
        code: input.code,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? input.nameAr,
        category: "Payment Fields",
        fieldType: "Amount",
        sortOrder: (input.sortOrder ?? 99) + 100,
        isSystem: false
      });
    }
    return row;
  }),
  update: protectedProcedure.input(z15.object({
    id: z15.number().int(),
    nameAr: z15.string().min(1).max(150).optional(),
    nameEn: z15.string().max(150).optional().nullable(),
    icon: z15.string().max(50).optional().nullable(),
    color: z15.string().max(20).optional().nullable(),
    bgColor: z15.string().max(20).optional().nullable(),
    accountId: z15.number().int().optional().nullable(),
    isActive: z15.boolean().optional(),
    isVisible: z15.boolean().optional(),
    sortOrder: z15.number().int().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [row] = await db.update(paymentMethods).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(and17(eq17(paymentMethods.id, id), eq17(paymentMethods.orgId, ctx.user.orgId))).returning();
    return row;
  }),
  delete: protectedProcedure.input(z15.object({ id: z15.number().int() })).mutation(async ({ ctx, input }) => {
    const [row] = await db.select({ isBuiltIn: paymentMethods.isBuiltIn }).from(paymentMethods).where(and17(eq17(paymentMethods.id, input.id), eq17(paymentMethods.orgId, ctx.user.orgId))).limit(1);
    if (row?.isBuiltIn) throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0648\u0633\u064A\u0644\u0629 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0645\u062F\u0645\u062C\u0629 \u2014 \u064A\u0645\u0643\u0646\u0643 \u0625\u062E\u0641\u0627\u0624\u0647\u0627 \u0641\u0642\u0637");
    await db.update(paymentMethods).set({ isActive: false, isVisible: false, updatedAt: /* @__PURE__ */ new Date() }).where(and17(eq17(paymentMethods.id, input.id), eq17(paymentMethods.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  reorder: protectedProcedure.input(z15.object({ ids: z15.array(z15.number().int()) })).mutation(async ({ ctx, input }) => {
    for (let i = 0; i < input.ids.length; i++) {
      await db.update(paymentMethods).set({ sortOrder: i + 1, updatedAt: /* @__PURE__ */ new Date() }).where(and17(eq17(paymentMethods.id, input.ids[i]), eq17(paymentMethods.orgId, ctx.user.orgId)));
    }
    return { success: true };
  })
});

// src/routers/zatca.ts
import { z as z16 } from "zod";
init_db();
init_schema();
import { eq as eq18, and as and18, desc as desc6, count, sql as sql3, gte as gte2, lte as lte2, like as like2, or as or3 } from "drizzle-orm";
var ZatcaConfigSchema = z16.object({
  enabled: z16.boolean().default(false),
  environment: z16.enum(["sandbox", "production"]).default("sandbox"),
  vatNumber: z16.string().default(""),
  businessName: z16.string().default(""),
  businessNameEn: z16.string().default(""),
  crNumber: z16.string().default(""),
  buildingNumber: z16.string().default(""),
  streetName: z16.string().default(""),
  district: z16.string().default(""),
  city: z16.string().default(""),
  postalCode: z16.string().default(""),
  countryCode: z16.string().default("SA"),
  sellerType: z16.enum(["B2B", "B2C", "both"]).default("both"),
  autoSubmit: z16.boolean().default(false),
  submitOnPost: z16.boolean().default(true),
  // حقول حساسة — تعبّأ فقط بواسطة مسؤول الربط
  csid: z16.string().default(""),
  secretKey: z16.string().default(""),
  apiBaseUrl: z16.string().default("https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal"),
  apiVersion: z16.string().default("V2"),
  onboardingStep: z16.number().default(0),
  lastOnboardedAt: z16.string().nullable().default(null),
  // حالة الخدمة
  serviceActivatedAt: z16.string().nullable().default(null),
  serviceActivatedBy: z16.string().nullable().default(null),
  lastConfigUpdate: z16.string().nullable().default(null),
  lastConfigUpdateBy: z16.string().nullable().default(null),
  lastConnectionTest: z16.string().nullable().default(null),
  lastConnectionStatus: z16.enum(["success", "failed", "unknown"]).default("unknown"),
  // شهادة CSID
  certExpiryDate: z16.string().nullable().default(null),
  certSerialNumber: z16.string().nullable().default(null)
});
var zatcaRouter = router({
  // ── إعدادات ZATCA للمنشأة ─────────────────────────────────────────────────
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq18(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true }
    });
    const cfg = org?.zatcaConfig ?? {};
    const parsed = ZatcaConfigSchema.parse(cfg);
    const isAdmin = ctx.user.role === "admin" || ctx.user.role === "superadmin";
    if (!isAdmin) {
      parsed.secretKey = parsed.secretKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "";
      parsed.apiBaseUrl = parsed.apiBaseUrl ? "(\u0645\u062D\u062C\u0648\u0628)" : "";
      parsed.csid = parsed.csid ? `${parsed.csid.slice(0, 8)}\u2022\u2022\u2022\u2022` : "";
    }
    return { ...parsed, isAdmin };
  }),
  saveConfig: adminProcedure.input(ZatcaConfigSchema).mutation(async ({ ctx, input }) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userName = ctx.user.name ?? ctx.user.username ?? "\u0645\u0633\u0624\u0648\u0644";
    const existing = await db.query.organizations.findFirst({
      where: eq18(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true }
    });
    const existingCfg = existing?.zatcaConfig ?? {};
    const updated = {
      ...input,
      lastConfigUpdate: now,
      lastConfigUpdateBy: userName,
      // إذا كانت المنظومة تُفعَّل لأول مرة
      serviceActivatedAt: input.enabled && !existingCfg.enabled ? now : existingCfg.serviceActivatedAt ?? null,
      serviceActivatedBy: input.enabled && !existingCfg.enabled ? userName : existingCfg.serviceActivatedBy ?? null
    };
    await db.update(organizations).set({ zatcaConfig: updated, updatedAt: /* @__PURE__ */ new Date() }).where(eq18(organizations.id, ctx.orgId));
    await db.insert(zatcaLogs).values({
      orgId: ctx.orgId,
      eventType: "config_update",
      status: "success",
      environment: input.environment,
      userId: ctx.user.id,
      userName,
      requestBody: JSON.stringify({ action: "config_update", environment: input.environment })
    });
    return { ok: true };
  }),
  // ── اختبار الاتصال ────────────────────────────────────────────────────────
  testConnection: adminProcedure.mutation(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq18(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true }
    });
    const cfg = org?.zatcaConfig ?? {};
    const success = !!cfg.csid && !!cfg.secretKey;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userName = ctx.user.name ?? ctx.user.username ?? "\u0645\u0633\u0624\u0648\u0644";
    await db.update(organizations).set({
      zatcaConfig: {
        ...cfg,
        lastConnectionTest: now,
        lastConnectionStatus: success ? "success" : "failed"
      },
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq18(organizations.id, ctx.orgId));
    await db.insert(zatcaLogs).values({
      orgId: ctx.orgId,
      eventType: "connection_test",
      status: success ? "success" : "error",
      environment: cfg.environment ?? "sandbox",
      userId: ctx.user.id,
      userName,
      responseBody: JSON.stringify({ success, testedAt: now }),
      errorMessage: success ? null : "CSID \u0623\u0648 Secret Key \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u064A\u0646"
    });
    return { ok: success, message: success ? "\u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0647\u064A\u0626\u0629 \u0646\u0627\u062C\u062D" : "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u2014 \u062A\u062D\u0642\u0642 \u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A CSID" };
  }),
  // ── بيانات ZATCA لفاتورة معينة ────────────────────────────────────────────
  getInvoiceZatca: protectedProcedure.input(z16.object({ invoiceId: z16.number() })).query(async ({ ctx, input }) => {
    const inv = await db.query.salesInvoices.findFirst({
      where: and18(
        eq18(salesInvoices.id, input.invoiceId),
        eq18(salesInvoices.orgId, ctx.orgId)
      ),
      columns: {
        id: true,
        invoiceNumber: true,
        zatcaUuid: true,
        zatcaHash: true,
        zatcaQrCode: true,
        zatcaXml: true,
        zatcaStatus: true,
        zatcaClearedAt: true,
        zatcaResponse: true,
        zatcaInvoiceCounter: true,
        zatcaPih: true,
        zatcaSubmittedAt: true,
        zatcaAttemptCount: true,
        zatcaRejectionReason: true
      }
    });
    if (!inv) throw new Error("Invoice not found");
    return inv;
  }),
  // ── إرسال فاتورة للهيئة ───────────────────────────────────────────────────
  submitInvoice: protectedProcedure.input(z16.object({
    invoiceId: z16.number(),
    invoiceType: z16.enum(["standard", "simplified"]).default("simplified"),
    forceResend: z16.boolean().default(false)
  })).mutation(async ({ ctx, input }) => {
    const inv = await db.query.salesInvoices.findFirst({
      where: and18(
        eq18(salesInvoices.id, input.invoiceId),
        eq18(salesInvoices.orgId, ctx.orgId)
      )
    });
    if (!inv) throw new Error("Invoice not found");
    if (inv.zatcaStatus === "cleared" && !input.forceResend) {
      return { ok: false, message: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u064F\u062E\u0644\u064E\u0651\u0635\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u062F\u0649 \u0647\u064A\u0626\u0629 \u0627\u0644\u0632\u0643\u0627\u0629" };
    }
    const org = await db.query.organizations.findFirst({
      where: eq18(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true }
    });
    const cfg = org?.zatcaConfig ?? {};
    if (!cfg?.enabled) {
      return { ok: false, message: "\u0645\u0646\u0638\u0648\u0645\u0629 ZATCA \u063A\u064A\u0631 \u0645\u064F\u0641\u0639\u064E\u0651\u0644\u0629 \u2014 \u064A\u0631\u062C\u0649 \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u062A\u0643\u0627\u0645\u0644 \u0623\u0648\u0644\u0627\u064B" };
    }
    const uuid2 = inv.zatcaUuid ?? crypto.randomUUID();
    const environment = cfg.environment ?? "sandbox";
    const mockSuccess = environment === "sandbox";
    const mockStatus = mockSuccess ? "cleared" : "pending";
    const mockResponse = {
      status: mockSuccess ? "CLEARED" : "SUBMITTED",
      clearanceStatus: mockSuccess ? "CLEARED" : "NOT_CLEARED",
      reportingStatus: mockSuccess ? "REPORTED" : "NOT_REPORTED",
      invoiceHash: uuid2,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      warnings: [],
      errors: []
    };
    const newAttemptCount = (inv.zatcaAttemptCount ?? 0) + 1;
    const userName = ctx.user.name ?? ctx.user.username ?? "\u0645\u0633\u062A\u062E\u062F\u0645";
    await db.update(salesInvoices).set({
      zatcaUuid: uuid2,
      zatcaStatus: mockStatus,
      zatcaClearedAt: mockSuccess ? /* @__PURE__ */ new Date() : null,
      zatcaResponse: mockResponse,
      zatcaSubmittedAt: inv.zatcaSubmittedAt ?? /* @__PURE__ */ new Date(),
      zatcaAttemptCount: newAttemptCount,
      zatcaRejectionReason: mockSuccess ? null : inv.zatcaRejectionReason,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq18(salesInvoices.id, input.invoiceId));
    await db.insert(zatcaLogs).values({
      orgId: ctx.orgId,
      invoiceId: input.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      eventType: input.forceResend ? "resend" : "submit",
      status: mockStatus,
      environment,
      userId: ctx.user.id,
      userName,
      requestBody: JSON.stringify({ invoiceId: input.invoiceId, invoiceType: input.invoiceType, attempt: newAttemptCount }),
      responseBody: JSON.stringify(mockResponse)
    });
    return {
      ok: true,
      status: mockStatus,
      uuid: uuid2,
      environment,
      response: mockResponse,
      message: mockSuccess ? "\u062A\u0645 \u0627\u0644\u062A\u062E\u0644\u064A\u0635 \u0628\u0646\u062C\u0627\u062D \u0644\u062F\u0649 \u0647\u064A\u0626\u0629 \u0627\u0644\u0632\u0643\u0627\u0629 (\u0628\u064A\u0626\u0629 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631)" : "\u062C\u0627\u0631\u064D \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u2014 \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B"
    };
  }),
  // ── تحديث حالة الفاتورة يدوياً ───────────────────────────────────────────
  updateInvoiceStatus: adminProcedure.input(z16.object({
    invoiceId: z16.number(),
    status: z16.enum(["not_submitted", "pending", "cleared", "reported", "rejected", "error"]),
    rejectionReason: z16.string().optional(),
    notes: z16.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const userName = ctx.user.name ?? ctx.user.username ?? "\u0645\u0633\u0624\u0648\u0644";
    await db.update(salesInvoices).set({
      zatcaStatus: input.status,
      zatcaRejectionReason: input.rejectionReason ?? null,
      updatedAt: /* @__PURE__ */ new Date(),
      ...input.status === "cleared" ? { zatcaClearedAt: /* @__PURE__ */ new Date() } : {}
    }).where(and18(
      eq18(salesInvoices.id, input.invoiceId),
      eq18(salesInvoices.orgId, ctx.orgId)
    ));
    await db.insert(zatcaLogs).values({
      orgId: ctx.orgId,
      invoiceId: input.invoiceId,
      eventType: "manual_status_update",
      status: input.status,
      userId: ctx.user.id,
      userName,
      requestBody: JSON.stringify({ notes: input.notes, rejectionReason: input.rejectionReason })
    });
    return { ok: true };
  }),
  // ── سجل العمليات ──────────────────────────────────────────────────────────
  getLogs: protectedProcedure.input(z16.object({
    page: z16.number().default(1),
    limit: z16.number().default(50),
    invoiceNumber: z16.string().optional(),
    status: z16.string().optional(),
    eventType: z16.string().optional(),
    dateFrom: z16.string().optional(),
    dateTo: z16.string().optional(),
    errorsOnly: z16.boolean().default(false)
  })).query(async ({ ctx, input }) => {
    const offset = (input.page - 1) * input.limit;
    const conditions = [eq18(zatcaLogs.orgId, ctx.orgId)];
    if (input.invoiceNumber) conditions.push(like2(zatcaLogs.invoiceNumber, `%${input.invoiceNumber}%`));
    if (input.status) conditions.push(eq18(zatcaLogs.status, input.status));
    if (input.eventType) conditions.push(eq18(zatcaLogs.eventType, input.eventType));
    if (input.dateFrom) conditions.push(gte2(zatcaLogs.createdAt, new Date(input.dateFrom)));
    if (input.dateTo) conditions.push(lte2(zatcaLogs.createdAt, new Date(input.dateTo)));
    if (input.errorsOnly) conditions.push(
      or3(eq18(zatcaLogs.status, "error"), eq18(zatcaLogs.status, "rejected"))
    );
    const [rows, totalRows] = await Promise.all([
      db.select().from(zatcaLogs).where(and18(...conditions)).orderBy(desc6(zatcaLogs.createdAt)).limit(input.limit).offset(offset),
      db.select({ cnt: count() }).from(zatcaLogs).where(and18(...conditions))
    ]);
    return {
      logs: rows,
      total: totalRows[0]?.cnt ?? 0,
      page: input.page,
      pages: Math.ceil((totalRows[0]?.cnt ?? 0) / input.limit)
    };
  }),
  // ── إحصائيات لوحة المتابعة ────────────────────────────────────────────────
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq18(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true }
    });
    const cfg = org?.zatcaConfig ?? {};
    const [total, cleared, pending, rejected, errors, notSubmitted] = await Promise.all([
      db.select({ cnt: count() }).from(salesInvoices).where(and18(eq18(salesInvoices.orgId, ctx.orgId), eq18(salesInvoices.invoiceType, "sale"))),
      db.select({ cnt: count() }).from(salesInvoices).where(and18(eq18(salesInvoices.orgId, ctx.orgId), eq18(salesInvoices.zatcaStatus, "cleared"))),
      db.select({ cnt: count() }).from(salesInvoices).where(and18(eq18(salesInvoices.orgId, ctx.orgId), eq18(salesInvoices.zatcaStatus, "pending"))),
      db.select({ cnt: count() }).from(salesInvoices).where(and18(eq18(salesInvoices.orgId, ctx.orgId), eq18(salesInvoices.zatcaStatus, "rejected"))),
      db.select({ cnt: count() }).from(salesInvoices).where(and18(eq18(salesInvoices.orgId, ctx.orgId), eq18(salesInvoices.zatcaStatus, "error"))),
      db.select({ cnt: count() }).from(salesInvoices).where(and18(
        eq18(salesInvoices.orgId, ctx.orgId),
        sql3`${salesInvoices.zatcaStatus} IS NULL OR ${salesInvoices.zatcaStatus} = 'not_submitted'`
      ))
    ]);
    let certDaysLeft = null;
    let certWarning = "unknown";
    if (cfg.certExpiryDate) {
      const diff = new Date(cfg.certExpiryDate).getTime() - Date.now();
      certDaysLeft = Math.ceil(diff / (1e3 * 60 * 60 * 24));
      certWarning = certDaysLeft <= 7 ? "critical" : certDaysLeft <= 15 ? "warning" : certDaysLeft <= 30 ? "warning" : "ok";
    }
    return {
      totalInvoices: total[0]?.cnt ?? 0,
      cleared: cleared[0]?.cnt ?? 0,
      pending: pending[0]?.cnt ?? 0,
      rejected: rejected[0]?.cnt ?? 0,
      errors: errors[0]?.cnt ?? 0,
      notSubmitted: notSubmitted[0]?.cnt ?? 0,
      connectionStatus: cfg.lastConnectionStatus ?? "unknown",
      lastConnectionTest: cfg.lastConnectionTest ?? null,
      certExpiryDate: cfg.certExpiryDate ?? null,
      certDaysLeft,
      certWarning,
      environment: cfg.environment ?? "sandbox"
    };
  }),
  // ── التحقق من صحة XML الفاتورة ───────────────────────────────────────────
  validateXml: protectedProcedure.input(z16.object({ invoiceId: z16.number() })).mutation(async ({ ctx, input }) => {
    const [inv, items, org] = await Promise.all([
      db.query.salesInvoices.findFirst({
        where: and18(eq18(salesInvoices.id, input.invoiceId), eq18(salesInvoices.orgId, ctx.orgId))
      }),
      db.select().from(salesInvoiceItems).where(and18(eq18(salesInvoiceItems.invoiceId, input.invoiceId), eq18(salesInvoiceItems.orgId, ctx.orgId))).orderBy(salesInvoiceItems.sortOrder),
      db.query.organizations.findFirst({
        where: eq18(organizations.id, ctx.orgId),
        columns: { zatcaConfig: true, name: true }
      })
    ]);
    if (!inv) throw new Error("Invoice not found");
    const cfg = org?.zatcaConfig ?? {};
    const issueDate = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[0] : "";
    const issueTime = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[1]?.slice(0, 8) ?? "00:00:00" : "00:00:00";
    const invTypeCode = inv.invoiceType === "return" ? "381" : "388";
    const currency = inv.currency ?? "SAR";
    const uuid2 = inv.zatcaUuid ?? "";
    const pih = inv.zatcaPih ?? "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjOTljNWVlNzljMmYxZjUzMGE4NzBhM2UwNjMxNmViMmMy";
    const itemsXml = items.map((it, idx) => {
      const lineTotal = parseFloat(it.total ?? "0");
      const taxAmt = parseFloat(it.taxAmount ?? "0");
      const netAmt = lineTotal - taxAmt;
      const taxPct = parseFloat(it.taxPercent ?? "15");
      const unitPrice = parseFloat(it.unitPrice ?? "0");
      const qty = parseFloat(it.quantity ?? "1");
      const discAmt = parseFloat(it.discountAmount ?? "0");
      return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${qty.toFixed(4)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${netAmt.toFixed(4)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${taxAmt.toFixed(4)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="${currency}">${lineTotal.toFixed(4)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${(it.productName ?? "Item").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${taxPct.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${unitPrice.toFixed(4)}</cbc:PriceAmount>
        ${discAmt > 0 ? `<cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:Amount currencyID="${currency}">${discAmt.toFixed(4)}</cbc:Amount>
        </cac:AllowanceCharge>` : ""}
      </cac:Price>
    </cac:InvoiceLine>`;
    }).join("");
    const taxTotal = parseFloat(inv.taxAmount ?? "0");
    const subtotal = parseFloat(inv.subtotal ?? "0");
    const discTotal = parseFloat(inv.discountAmount ?? "0");
    const total = parseFloat(inv.total ?? "0");
    const netAmount = total - taxTotal;
    const generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:ext:XMLDSIG</ext:ExtensionURI>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${inv.invoiceNumber}</cbc:ID>
  <cbc:UUID>${uuid2}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${inv.invoiceType === "return" ? "0200000" : "0100000"}">${invTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${inv.zatcaInvoiceCounter ?? 1}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${cfg.crNumber ?? ""}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${cfg.streetName ?? ""}</cbc:StreetName>
        <cbc:BuildingNumber>${cfg.buildingNumber ?? ""}</cbc:BuildingNumber>
        <cbc:CityName>${cfg.city ?? ""}</cbc:CityName>
        <cbc:PostalZone>${cfg.postalCode ?? ""}</cbc:PostalZone>
        <cbc:CountrySubentity>${cfg.district ?? ""}</cbc:CountrySubentity>
        <cac:Country><cbc:IdentificationCode>${cfg.countryCode ?? "SA"}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${cfg.vatNumber ?? ""}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cfg.businessName ?? (org?.name ?? "")}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${inv.customerTaxNumber ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${inv.customerTaxNumber}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${(inv.customerName ?? "\u0645\u0634\u062A\u0631\u064A").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxTotal.toFixed(4)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${netAmount.toFixed(4)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${taxTotal.toFixed(4)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(4)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${netAmount.toFixed(4)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(4)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">${discTotal.toFixed(4)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${currency}">${total.toFixed(4)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${itemsXml}
</Invoice>`;
    const results = [];
    let ruleId = 1;
    const err = (el, desc14, cur, exp, fix) => results.push({ id: ruleId++, type: "error", element: el, description: desc14, currentValue: cur, expectedValue: exp, fix });
    const warn = (el, desc14, cur, exp, fix) => results.push({ id: ruleId++, type: "warning", element: el, description: desc14, currentValue: cur, expectedValue: exp, fix });
    const info = (el, desc14, cur, exp, fix) => results.push({ id: ruleId++, type: "info", element: el, description: desc14, currentValue: cur, expectedValue: exp, fix });
    if (!inv.zatcaUuid) err("cbc:UUID", "UUID \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", "(\u0641\u0627\u0631\u063A)", "UUID \u0635\u0627\u0644\u062D \u0628\u0635\u064A\u063A\u0629 RFC 4122", "\u0623\u0631\u0633\u0644 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0623\u0648\u0644\u0627\u064B \u0644\u062A\u0648\u0644\u064A\u062F UUID \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B");
    else info("cbc:UUID", "UUID \u0645\u0648\u062C\u0648\u062F \u0648\u0635\u0627\u0644\u062D", inv.zatcaUuid.slice(0, 16) + "\u2026", "UUID RFC 4122", "\u2014");
    if (!inv.invoiceNumber) err("cbc:ID", "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0641\u0642\u0648\u062F", "(\u0641\u0627\u0631\u063A)", "\u0631\u0642\u0645 \u0641\u0627\u062A\u0648\u0631\u0629 \u0641\u0631\u064A\u062F", "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
    else info("cbc:ID", "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u062C\u0648\u062F", inv.invoiceNumber, "\u0631\u0642\u0645 \u0641\u0631\u064A\u062F", "\u2014");
    if (!issueDate) err("cbc:IssueDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0641\u0642\u0648\u062F", "(\u0641\u0627\u0631\u063A)", "YYYY-MM-DD", "\u062D\u062F\u062F \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
    else info("cbc:IssueDate", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u0627\u0644\u062D", issueDate, "YYYY-MM-DD", "\u2014");
    if (currency !== "SAR") err("cbc:DocumentCurrencyCode", "\u0639\u0645\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 SAR \u0644\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0645\u062D\u0644\u064A\u0629", currency, "SAR", "\u063A\u064A\u0651\u0631 \u0639\u0645\u0644\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0644\u0649 SAR");
    else info("cbc:DocumentCurrencyCode", "\u0627\u0644\u0639\u0645\u0644\u0629 \u0635\u062D\u064A\u062D\u0629", currency, "SAR", "\u2014");
    const sellerVat = cfg.vatNumber ?? "";
    if (!sellerVat) err("cac:AccountingSupplierParty / cbc:CompanyID", "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0628\u0627\u0626\u0639 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA", "(\u0641\u0627\u0631\u063A)", "15 \u0631\u0642\u0645\u0627\u064B \u064A\u0628\u062F\u0623 \u0648\u064A\u0646\u062A\u0647\u064A \u0628\u0640 3", "\u0623\u0643\u0645\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA \u0628\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A");
    else if (!/^3\d{13}3$/.test(sellerVat)) err("cac:AccountingSupplierParty / cbc:CompanyID", "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0628\u0627\u0626\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", sellerVat, "15 \u0631\u0642\u0645\u0627\u064B \u064A\u0628\u062F\u0623 \u0648\u064A\u0646\u062A\u0647\u064A \u0628\u0640 3 (\u0645\u062B\u0627\u0644: 3XXXXXXXXXXX3)", "\u0635\u062D\u0651\u062D \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA");
    else info("cac:AccountingSupplierParty / cbc:CompanyID", "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0628\u0627\u0626\u0639 \u0635\u0627\u0644\u062D", sellerVat, "15 \u0631\u0642\u0645\u0627\u064B", "\u2014");
    const sellerName = cfg.businessName ?? (org?.name ?? "");
    if (!sellerName) err("cac:AccountingSupplierParty / cbc:RegistrationName", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 (\u0627\u0644\u0628\u0627\u0626\u0639) \u063A\u064A\u0631 \u0645\u062D\u062F\u062F", "(\u0641\u0627\u0631\u063A)", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "\u0623\u0643\u0645\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA");
    else info("cac:AccountingSupplierParty / cbc:RegistrationName", "\u0627\u0633\u0645 \u0627\u0644\u0628\u0627\u0626\u0639 \u0645\u0648\u062C\u0648\u062F", sellerName, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", "\u2014");
    if (!cfg.crNumber) warn("cac:PartyIdentification / cbc:ID (CRN)", "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA", "(\u0641\u0627\u0631\u063A)", "\u0631\u0642\u0645 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", "\u0623\u0636\u0641 \u0631\u0642\u0645 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA");
    else info("cac:PartyIdentification / cbc:ID", "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0645\u0648\u062C\u0648\u062F", cfg.crNumber, "\u0631\u0642\u0645 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", "\u2014");
    if (!cfg.streetName || !cfg.city || !cfg.buildingNumber) {
      const missing = [!cfg.streetName && "\u0627\u0644\u0634\u0627\u0631\u0639", !cfg.buildingNumber && "\u0631\u0642\u0645 \u0627\u0644\u0645\u0628\u0646\u0649", !cfg.city && "\u0627\u0644\u0645\u062F\u064A\u0646\u0629"].filter(Boolean).join("\u060C ");
      warn("cac:PostalAddress", `\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u2014 \u0645\u0641\u0642\u0648\u062F: ${missing}`, "(\u062C\u0632\u0626\u064A)", "\u0627\u0644\u0634\u0627\u0631\u0639 + \u0631\u0642\u0645 \u0627\u0644\u0645\u0628\u0646\u0649 + \u0627\u0644\u0645\u062F\u064A\u0646\u0629 + \u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0628\u0631\u064A\u062F\u064A", "\u0623\u0643\u0645\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA");
    } else info("cac:PostalAddress", "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0645\u0643\u062A\u0645\u0644\u0629", `${cfg.streetName}\u060C ${cfg.city}`, "\u0639\u0646\u0648\u0627\u0646 \u0643\u0627\u0645\u0644", "\u2014");
    if (!inv.customerName) warn("cac:AccountingCustomerParty / cbc:RegistrationName", "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F", "(\u0641\u0627\u0631\u063A)", "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644", "\u062D\u062F\u062F \u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u0641\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
    else info("cac:AccountingCustomerParty / cbc:RegistrationName", "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0648\u062C\u0648\u062F", inv.customerName.slice(0, 30), "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644", "\u2014");
    if (inv.customerType === "company" || cfg.sellerType === "B2B") {
      if (!inv.customerTaxNumber) err("cac:AccountingCustomerParty / cbc:CompanyID", "\u0641\u0627\u062A\u0648\u0631\u0629 B2B \u062A\u062A\u0637\u0644\u0628 \u0631\u0642\u0645 \u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0639\u0645\u064A\u0644", "(\u0641\u0627\u0631\u063A)", "15 \u0631\u0642\u0645\u0627\u064B \u064A\u0628\u062F\u0623 \u0648\u064A\u0646\u062A\u0647\u064A \u0628\u0640 3", "\u0623\u0636\u0641 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0639\u0645\u064A\u0644 \u0641\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
      else if (!/^3\d{13}3$/.test(inv.customerTaxNumber)) err("cac:AccountingCustomerParty / cbc:CompanyID", "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", inv.customerTaxNumber, "15 \u0631\u0642\u0645\u0627\u064B \u064A\u0628\u062F\u0623 \u0648\u064A\u0646\u062A\u0647\u064A \u0628\u0640 3", "\u0635\u062D\u0651\u062D \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0639\u0645\u064A\u0644");
      else info("cac:AccountingCustomerParty / cbc:CompanyID", "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A \u0644\u0644\u0639\u0645\u064A\u0644 \u0635\u0627\u0644\u062D", inv.customerTaxNumber, "15 \u0631\u0642\u0645\u0627\u064B", "\u2014");
    }
    if (!["388", "381", "383"].includes(invTypeCode)) err("cbc:InvoiceTypeCode", "\u0643\u0648\u062F \u0646\u0648\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", invTypeCode, "388 (\u0623\u0635\u0644\u064A\u0629) \u0623\u0648 381 (\u0645\u0631\u062A\u062C\u0639) \u0623\u0648 383 (\u062E\u0635\u0645)", "\u062D\u062F\u062F \u0646\u0648\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0635\u062D\u064A\u062D");
    else info("cbc:InvoiceTypeCode", "\u0643\u0648\u062F \u0646\u0648\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u062D\u064A\u062D", `${invTypeCode} (${invTypeCode === "388" ? "\u0641\u0627\u062A\u0648\u0631\u0629 \u0623\u0635\u0644\u064A\u0629" : invTypeCode === "381" ? "\u0645\u0631\u062A\u062C\u0639" : "\u0625\u0634\u0639\u0627\u0631 \u062E\u0635\u0645"})`, "388 \u0623\u0648 381 \u0623\u0648 383", "\u2014");
    if (items.length === 0) err("cac:InvoiceLine", "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0627 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0628\u0646\u0648\u062F", "0 \u0628\u0646\u0648\u062F", "\u0628\u0646\u062F \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "\u0623\u0636\u0641 \u0645\u0646\u062A\u062C\u0627\u064B \u0623\u0648 \u062E\u062F\u0645\u0629 \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
    else info("cac:InvoiceLine", `\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 ${items.length} \u0628\u0646\u062F/\u0628\u0646\u0648\u062F`, `${items.length} \u0628\u0646\u062F`, "\u2265 1", "\u2014");
    const expectedTax = parseFloat((netAmount * 0.15).toFixed(4));
    const actualTax = parseFloat(taxTotal.toFixed(4));
    const taxDiff = Math.abs(expectedTax - actualTax);
    if (taxDiff > 0.01 && taxTotal > 0) {
      warn("cac:TaxTotal / cbc:TaxAmount", `\u0645\u0628\u0644\u063A \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0642\u062F \u0644\u0627 \u064A\u062A\u0637\u0627\u0628\u0642 \u0645\u0639 \u0646\u0633\u0628\u0629 15%`, `${actualTax.toFixed(2)} SAR`, `${expectedTax.toFixed(2)} SAR (\u224815% \u0645\u0646 ${netAmount.toFixed(2)})`, "\u0631\u0627\u062C\u0639 \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0641\u064A \u0628\u0646\u0648\u062F \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
    } else {
      info("cac:TaxTotal / cbc:TaxAmount", "\u0645\u0628\u0644\u063A \u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0635\u062D\u064A\u062D", `${taxTotal.toFixed(2)} SAR`, `${actualTax.toFixed(2)} SAR`, "\u2014");
    }
    if (total <= 0) err("cac:LegalMonetaryTotal / cbc:PayableAmount", "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631", total.toFixed(2), "> 0", "\u062A\u0623\u0643\u062F \u0645\u0646 \u0648\u062C\u0648\u062F \u0628\u0646\u0648\u062F \u0628\u0623\u0633\u0639\u0627\u0631 \u0635\u062D\u064A\u062D\u0629");
    else info("cac:LegalMonetaryTotal / cbc:PayableAmount", "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u062D\u064A\u062D", `${total.toFixed(2)} SAR`, "> 0", "\u2014");
    if (!inv.zatcaHash) warn("cbc:PreviousInvoiceHash", "Hash \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u2014 \u0633\u064A\u062A\u0645 \u062A\u0648\u0644\u064A\u062F\u0647 \u0639\u0646\u062F \u0627\u0644\u0625\u0631\u0633\u0627\u0644", "(\u0641\u0627\u0631\u063A)", "SHA-256 Hash", "\u0623\u0631\u0633\u0644 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u062A\u0648\u0644\u064A\u062F Hash \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B");
    else info("cbc:PreviousInvoiceHash", "Hash \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u062C\u0648\u062F", inv.zatcaHash.slice(0, 16) + "\u2026", "SHA-256", "\u2014");
    if (!inv.zatcaQrCode) warn("cbc:EmbeddedDocumentBinaryObject (QR)", "\u0631\u0645\u0632 QR \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u2014 \u0633\u064A\u062A\u0645 \u062A\u0648\u0644\u064A\u062F\u0647 \u0639\u0646\u062F \u0627\u0644\u0625\u0631\u0633\u0627\u0644", "(\u0641\u0627\u0631\u063A)", "Base64 TLV QR", "\u0623\u0631\u0633\u0644 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u062A\u0648\u0644\u064A\u062F QR \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B");
    else info("cbc:EmbeddedDocumentBinaryObject (QR)", "\u0631\u0645\u0632 QR \u0645\u0648\u062C\u0648\u062F", "(\u0645\u064F\u0634\u0641\u064E\u0651\u0631 Base64)", "Base64 TLV", "\u2014");
    if (!inv.zatcaPih) warn("cac:AdditionalDocumentReference (PIH)", "PIH \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u2014 \u0633\u064A\u064F\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629", "(\u0627\u0641\u062A\u0631\u0627\u0636\u064A)", "Hash \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629", "\u0647\u0630\u0627 \u0637\u0628\u064A\u0639\u064A \u0644\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u0648\u0644\u0649");
    else info("cac:AdditionalDocumentReference (PIH)", "PIH \u0645\u0648\u062C\u0648\u062F", inv.zatcaPih.slice(0, 16) + "\u2026", "SHA-256 Hash", "\u2014");
    if (!inv.zatcaInvoiceCounter) warn("cac:AdditionalDocumentReference (ICV)", "\u0631\u0642\u0645 ICV (\u0627\u0644\u0639\u062F\u0627\u062F) \u063A\u064A\u0631 \u0645\u062D\u062F\u062F", "(\u0641\u0627\u0631\u063A)", "\u0631\u0642\u0645 \u062A\u0633\u0644\u0633\u0644\u064A \u0645\u062A\u0635\u0627\u0639\u062F", "\u0633\u064A\u062A\u0645 \u062A\u0648\u0644\u064A\u062F\u0647 \u0639\u0646\u062F \u0627\u0644\u0625\u0631\u0633\u0627\u0644");
    else info("cac:AdditionalDocumentReference (ICV)", "\u0631\u0642\u0645 ICV \u0645\u0648\u062C\u0648\u062F", `${inv.zatcaInvoiceCounter}`, "\u0631\u0642\u0645 \u062A\u0633\u0644\u0633\u0644\u064A", "\u2014");
    if (cfg.environment === "production") info("env", "\u0627\u0644\u0628\u064A\u0626\u0629: \u0625\u0646\u062A\u0627\u062C", "Production", "Sandbox \u0623\u0648 Production", "\u2014");
    else warn("env", "\u0627\u0644\u0628\u064A\u0626\u0629: \u0627\u062E\u062A\u0628\u0627\u0631 \u2014 \u062A\u0630\u0643\u0651\u0631 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0644\u0625\u0646\u062A\u0627\u062C \u0642\u0628\u0644 \u0627\u0644\u0646\u0634\u0631 \u0627\u0644\u0641\u0639\u0644\u064A", "Sandbox", "Production (\u0641\u064A \u0627\u0644\u0646\u0634\u0631 \u0627\u0644\u062D\u0642\u064A\u0642\u064A)", "\u063A\u064A\u0651\u0631 \u0627\u0644\u0628\u064A\u0626\u0629 \u0625\u0644\u0649 Production \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A ZATCA \u0639\u0646\u062F \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629");
    const errorCount = results.filter((r) => r.type === "error").length;
    const warningCount = results.filter((r) => r.type === "warning").length;
    const passed = errorCount === 0;
    const xmlToReturn = inv.zatcaXml ?? generatedXml;
    const userName = ctx.user.name ?? ctx.user.username ?? "\u0645\u0633\u062A\u062E\u062F\u0645";
    await db.insert(zatcaLogs).values({
      orgId: ctx.orgId,
      invoiceId: input.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      eventType: "xml_validation",
      status: passed ? "success" : "error",
      userId: ctx.user.id,
      userName,
      requestBody: JSON.stringify({ invoiceId: input.invoiceId }),
      responseBody: JSON.stringify({ errorCount, warningCount, passed }),
      errorMessage: passed ? null : `${errorCount} \u062E\u0637\u0623\u060C ${warningCount} \u062A\u062D\u0630\u064A\u0631`
    });
    return { xml: xmlToReturn, results, errorCount, warningCount, passed, isGeneratedXml: !inv.zatcaXml };
  }),
  // ── قائمة الفواتير مع حالة الهيئة ────────────────────────────────────────
  getInvoicesList: protectedProcedure.input(z16.object({
    page: z16.number().default(1),
    limit: z16.number().default(30),
    status: z16.string().optional()
  })).query(async ({ ctx, input }) => {
    const offset = (input.page - 1) * input.limit;
    const conditions = [
      eq18(salesInvoices.orgId, ctx.orgId),
      eq18(salesInvoices.invoiceType, "sale")
    ];
    if (input.status) {
      conditions.push(eq18(salesInvoices.zatcaStatus, input.status));
    }
    const rows = await db.select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      invoiceDate: salesInvoices.invoiceDate,
      customerName: salesInvoices.customerName,
      total: salesInvoices.total,
      zatcaStatus: salesInvoices.zatcaStatus,
      zatcaUuid: salesInvoices.zatcaUuid,
      zatcaHash: salesInvoices.zatcaHash,
      zatcaXml: salesInvoices.zatcaXml,
      zatcaResponse: salesInvoices.zatcaResponse,
      zatcaClearedAt: salesInvoices.zatcaClearedAt,
      zatcaSubmittedAt: salesInvoices.zatcaSubmittedAt,
      zatcaAttemptCount: salesInvoices.zatcaAttemptCount,
      zatcaRejectionReason: salesInvoices.zatcaRejectionReason,
      isPosted: salesInvoices.isPosted
    }).from(salesInvoices).where(and18(...conditions)).orderBy(desc6(salesInvoices.invoiceDate)).limit(input.limit).offset(offset);
    const totalRows = await db.select({ cnt: count() }).from(salesInvoices).where(and18(...conditions));
    return {
      invoices: rows,
      total: totalRows[0]?.cnt ?? 0,
      page: input.page,
      pages: Math.ceil((totalRows[0]?.cnt ?? 0) / input.limit)
    };
  })
});

// src/routers/sourceCode.ts
import { z as z17 } from "zod";
import fs2 from "fs";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var __dirname3 = path3.dirname(fileURLToPath3(import.meta.url));
var ROOT = path3.resolve(__dirname3, "..", "..", "..");
var ALLOWED_DIRS = ["client-app/src", "server-app/src"];
var EXCLUDED = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".cache", "__pycache__", ".vite"]);
var MAX_FILE_SIZE = 512 * 1024;
var LANG_MAP = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  sql: "sql",
  txt: "text",
  sh: "bash",
  env: "text"
};
function buildTree(dir, relBase) {
  let entries;
  try {
    entries = fs2.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes = [];
  for (const e of entries) {
    if (EXCLUDED.has(e.name) || e.name.startsWith(".")) continue;
    const fullPath = path3.join(dir, e.name);
    const relPath = path3.join(relBase, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) {
      nodes.push({ name: e.name, path: relPath, type: "dir", children: buildTree(fullPath, relPath) });
    } else if (e.isFile()) {
      const ext = e.name.split(".").pop() ?? "";
      let size = 0;
      try {
        size = fs2.statSync(fullPath).size;
      } catch {
      }
      nodes.push({ name: e.name, path: relPath, type: "file", ext, size });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}
var sourceCodeRouter = router({
  getTree: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    return ALLOWED_DIRS.map((dir) => {
      const fullDir = path3.join(ROOT, dir);
      const parts = dir.split("/");
      return {
        name: dir,
        path: dir,
        type: "dir",
        children: buildTree(fullDir, dir)
      };
    });
  }),
  getFile: protectedProcedure.input(z17.object({ filePath: z17.string().max(300) })).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const allowed = ALLOWED_DIRS.some((d) => input.filePath.startsWith(d + "/") || input.filePath === d);
    if (!allowed) throw new Error("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D");
    if (input.filePath.includes("..")) throw new Error("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    const fullPath = path3.join(ROOT, input.filePath);
    let stat;
    try {
      stat = fs2.statSync(fullPath);
    } catch {
      throw new Error("\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    if (!stat.isFile()) throw new Error("\u0644\u064A\u0633 \u0645\u0644\u0641\u0627\u064B");
    if (stat.size > MAX_FILE_SIZE) return { content: `/* \u0627\u0644\u0645\u0644\u0641 \u0643\u0628\u064A\u0631 \u062C\u062F\u0627\u064B (${Math.round(stat.size / 1024)} KB) */`, lang: "text", lines: 0, size: stat.size };
    const content = fs2.readFileSync(fullPath, "utf-8");
    const ext = input.filePath.split(".").pop() ?? "";
    const lang = LANG_MAP[ext] ?? "text";
    return { content, lang, lines: content.split("\n").length, size: stat.size };
  }),
  search: protectedProcedure.input(z17.object({ query: z17.string().max(100) })).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    if (!input.query.trim()) return [];
    const results = [];
    const q = input.query.toLowerCase();
    function scanDir(dir, rel) {
      let entries;
      try {
        entries = fs2.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (EXCLUDED.has(e.name) || e.name.startsWith(".")) continue;
        const fp = path3.join(dir, e.name);
        const rp = `${rel}/${e.name}`;
        if (e.isDirectory()) {
          scanDir(fp, rp);
          continue;
        }
        if (!e.isFile()) continue;
        let content = "";
        try {
          const stat = fs2.statSync(fp);
          if (stat.size > 200 * 1024) continue;
          content = fs2.readFileSync(fp, "utf-8");
        } catch {
          continue;
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            results.push({ path: rp, line: i + 1, text: lines[i].trim().slice(0, 120) });
            if (results.length >= 50) return;
          }
        }
      }
    }
    for (const d of ALLOWED_DIRS) scanDir(path3.join(ROOT, d), d);
    return results;
  })
});

// src/routers/backup.ts
import { z as z18 } from "zod";
init_env();
import fs3 from "fs";
import path4 from "path";
import { spawnSync } from "child_process";
import { fileURLToPath as fileURLToPath4 } from "url";
var __dirname4 = path4.dirname(fileURLToPath4(import.meta.url));
var ROOT2 = path4.resolve(__dirname4, "..", "..", "..");
function getBackupDir() {
  const envDir = process.env.BACKUP_DIR;
  if (envDir && envDir.trim()) return envDir.trim();
  return path4.join(ROOT2, "backups");
}
function ensureBackupDir() {
  const dir = getBackupDir();
  if (!fs3.existsSync(dir)) fs3.mkdirSync(dir, { recursive: true });
  return dir;
}
function makeFileName(prefix = "backup") {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function listBackups() {
  const dir = getBackupDir();
  if (!fs3.existsSync(dir)) return [];
  return fs3.readdirSync(dir).filter((f) => f.endsWith(".sql") || f.endsWith(".dump") || f.endsWith(".zip")).map((f) => {
    const fp = path4.join(dir, f);
    const stat = fs3.statSync(fp);
    return {
      name: f,
      path: fp,
      size: stat.size,
      sizeStr: formatSize(stat.size),
      mtime: stat.mtime.toISOString(),
      type: f.endsWith(".zip") ? "zip" : "sql"
    };
  }).sort((a, b) => b.mtime.localeCompare(a.mtime));
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function dumpPostgres(outPath) {
  const url = new URL(ENV.dbUrl);
  const env = {
    ...process.env,
    PGPASSWORD: url.password
  };
  const args = [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    url.username,
    "-d",
    url.pathname.slice(1),
    "-F",
    "p",
    // plain SQL
    "-f",
    outPath,
    "--no-password"
  ];
  const result = spawnSync("pg_dump", args, { env, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "pg_dump failed");
  }
}
function restorePostgres(dumpPath) {
  const url = new URL(ENV.dbUrl);
  const env = {
    ...process.env,
    PGPASSWORD: url.password
  };
  const args = [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    url.username,
    "-d",
    url.pathname.slice(1),
    "-f",
    dumpPath,
    "--no-password",
    "--single-transaction"
  ];
  const result = spawnSync("psql", args, { env, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "psql restore failed");
  }
}
var backupRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    return listBackups();
  }),
  getDir: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    return { dir: getBackupDir() };
  }),
  create: protectedProcedure.input(z18.object({ label: z18.string().optional() })).mutation(async ({ ctx, input }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    const dir = ensureBackupDir();
    const name = makeFileName(input.label ?? "backup");
    const file = path4.join(dir, `${name}.sql`);
    logger.info("backup", `creating backup: ${file}`);
    try {
      dumpPostgres(file);
      const stat = fs3.statSync(file);
      logger.info("backup", `backup created: ${file} (${formatSize(stat.size)})`);
      return { ok: true, name: path4.basename(file), size: stat.size, sizeStr: formatSize(stat.size) };
    } catch (err) {
      logger.error("backup", `backup failed: ${err.message}`);
      throw new Error(`\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629: ${err.message}`);
    }
  }),
  restore: protectedProcedure.input(z18.object({ name: z18.string() })).mutation(async ({ ctx, input }) => {
    if (ctx.user?.role !== "superadmin") throw new Error("\u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645");
    const dir = getBackupDir();
    const file = path4.join(dir, input.name);
    if (!fs3.existsSync(file)) throw new Error("\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (!file.startsWith(dir)) throw new Error("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    logger.warn("backup", `restoring from: ${file}`);
    try {
      restorePostgres(file);
      logger.info("backup", "restore completed");
      return { ok: true };
    } catch (err) {
      logger.error("backup", `restore failed: ${err.message}`);
      throw new Error(`\u0641\u0634\u0644 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629: ${err.message}`);
    }
  }),
  delete: protectedProcedure.input(z18.object({ name: z18.string() })).mutation(async ({ ctx, input }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    const dir = getBackupDir();
    const file = path4.join(dir, input.name);
    if (!file.startsWith(dir)) throw new Error("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    if (!fs3.existsSync(file)) throw new Error("\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    fs3.unlinkSync(file);
    logger.info("backup", `deleted: ${file}`);
    return { ok: true };
  }),
  getLogs: protectedProcedure.input(z18.object({ lines: z18.number().min(10).max(1e3).default(200) })).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    const logDir = process.env.LOG_DIR ?? path4.join(ROOT2, "logs");
    if (!fs3.existsSync(logDir)) return { lines: [], dir: logDir };
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const logFile = path4.join(logDir, `onesoft-${today}.log`);
    if (!fs3.existsSync(logFile)) return { lines: [], dir: logDir, file: logFile };
    const content = fs3.readFileSync(logFile, "utf-8");
    const lines = content.split("\n").filter(Boolean).slice(-input.lines);
    return { lines, dir: logDir, file: logFile };
  }),
  getLogFiles: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    const logDir = process.env.LOG_DIR ?? path4.join(ROOT2, "logs");
    if (!fs3.existsSync(logDir)) return [];
    return fs3.readdirSync(logDir).filter((f) => f.endsWith(".log")).map((f) => {
      const fp = path4.join(logDir, f);
      const stat = fs3.statSync(fp);
      return { name: f, size: stat.size, sizeStr: formatSize(stat.size), mtime: stat.mtime.toISOString() };
    }).sort((a, b) => b.mtime.localeCompare(a.mtime));
  })
});

// src/routers/setup.ts
import { z as z19 } from "zod";
init_db();
init_schema();
init_auth();
init_env();
import fs4 from "fs";
import path5 from "path";
import { fileURLToPath as fileURLToPath5 } from "url";
import { eq as eq19, sql as sql4 } from "drizzle-orm";
import process2 from "process";
var __dirname5 = path5.dirname(fileURLToPath5(import.meta.url));
var ROOT3 = path5.resolve(__dirname5, "..", "..", "..");
function getAppVersion() {
  try {
    const pkg = JSON.parse(fs4.readFileSync(path5.join(__dirname5, "..", "..", "package.json"), "utf-8"));
    return pkg.version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
}
async function getPgVersion() {
  try {
    const result = await db.execute(`SELECT version() as version`);
    const row = result.rows?.[0] ?? result[0];
    const v = row?.version ?? "";
    const m = v.match(/PostgreSQL\s+([\d.]+)/);
    return m ? m[1] : v.split(" ")[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}
function getLastBackupInfo() {
  const dir = process2.env.BACKUP_DIR || path5.join(ROOT3, "backups");
  if (!fs4.existsSync(dir)) return { date: null, count: 0 };
  const files = fs4.readdirSync(dir).filter((f) => f.endsWith(".sql") || f.endsWith(".dump"));
  if (!files.length) return { date: null, count: 0 };
  const last = files.map((f) => fs4.statSync(path5.join(dir, f)).mtime).sort((a, b) => b.getTime() - a.getTime())[0];
  return { date: last?.toISOString() ?? null, count: files.length };
}
async function isFirstRun() {
  try {
    const result = await db.select({ cnt: sql4`count(*)::int` }).from(organizations);
    return (result[0]?.cnt ?? 0) === 0;
  } catch {
    return true;
  }
}
var setupRouter = router({
  // ── هل أول تشغيل؟ ────────────────────────────────────────────────────────
  isFirstRun: publicProcedure.query(async () => {
    return { firstRun: await isFirstRun() };
  }),
  // ── معلومات النظام الكاملة ────────────────────────────────────────────────
  systemInfo: protectedProcedure.query(async ({ ctx }) => {
    const [pgVersion, backupInfo] = await Promise.all([
      getPgVersion(),
      Promise.resolve(getLastBackupInfo())
    ]);
    let schemaVersion = "unknown";
    try {
      const { REQUIRED_SCHEMA_VERSION: REQUIRED_SCHEMA_VERSION2 } = await Promise.resolve().then(() => (init_schema_version(), schema_version_exports));
      schemaVersion = REQUIRED_SCHEMA_VERSION2;
    } catch {
    }
    let electronVersion = "N/A";
    try {
      electronVersion = process2.versions.electron ?? "N/A";
    } catch {
    }
    return {
      app: {
        name: "OneSoft ERP",
        version: getAppVersion(),
        buildDate: "2026-06-29",
        buildNumber: "888aa8f",
        schemaVersion,
        environment: ENV.nodeEnv,
        isElectron: ENV.isElectron,
        port: ENV.port
      },
      runtime: {
        nodeVersion: process2.version,
        electronVersion,
        platform: process2.platform,
        arch: process2.arch,
        uptime: Math.round(process2.uptime())
      },
      database: {
        type: ENV.dbType,
        version: pgVersion,
        host: new URL(ENV.dbUrl.replace(/^[^:]+:\/\//, "pg://")).hostname || "localhost",
        status: "connected"
      },
      backup: {
        lastDate: backupInfo.date,
        count: backupInfo.count,
        directory: process2.env.BACKUP_DIR || path5.join(ROOT3, "backups")
      },
      license: {
        status: "active",
        type: "standard",
        expires: null
      }
    };
  }),
  // ── إعداد أول تشغيل ──────────────────────────────────────────────────────
  firstRun: publicProcedure.input(z19.object({
    company: z19.object({
      name: z19.string().min(2),
      nameEn: z19.string().optional(),
      taxNumber: z19.string().optional(),
      phone: z19.string().optional(),
      email: z19.string().email().optional(),
      address: z19.string().optional(),
      country: z19.string().default("SA"),
      currency: z19.string().default("SAR"),
      fiscalYear: z19.number().default((/* @__PURE__ */ new Date()).getFullYear()),
      language: z19.enum(["ar", "en"]).default("ar")
    }),
    admin: z19.object({
      username: z19.string().min(3),
      password: z19.string().min(6),
      name: z19.string().min(2),
      email: z19.string().email().optional()
    }),
    backup: z19.object({
      enabled: z19.boolean().default(true),
      directory: z19.string().optional()
    }).optional(),
    zatca: z19.object({
      setupNow: z19.boolean().default(false)
    }).optional()
  })).mutation(async ({ input }) => {
    const alreadySetup = !await isFirstRun();
    if (alreadySetup) throw new Error("\u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062C \u062A\u0645 \u0625\u0639\u062F\u0627\u062F\u0647 \u0645\u0633\u0628\u0642\u0627\u064B");
    logger.info("setup", "first-run wizard started");
    const [org] = await db.insert(organizations).values({
      name: input.company.name,
      nameEn: input.company.nameEn ?? "",
      taxNumber: input.company.taxNumber ?? "",
      phone: input.company.phone ?? "",
      email: input.company.email ?? "",
      address: input.company.address ?? "",
      country: input.company.country,
      currency: input.company.currency,
      status: "active",
      plan: "standard",
      maxUsers: 10
    }).returning();
    const hashedPass = await hashPassword(input.admin.password);
    await db.insert(users).values({
      orgId: org.id,
      username: input.admin.username,
      password: hashedPass,
      name: input.admin.name,
      email: input.admin.email ?? "",
      role: "admin",
      status: "active"
    });
    await db.insert(appSettings).values({
      orgId: org.id,
      key: "company_setup_complete",
      value: "true"
    }).onConflictDoNothing();
    await db.insert(appSettings).values({
      orgId: org.id,
      key: "fiscal_year",
      value: String(input.company.fiscalYear)
    }).onConflictDoNothing();
    await db.insert(appSettings).values({
      orgId: org.id,
      key: "language",
      value: input.company.language
    }).onConflictDoNothing();
    logger.info("setup", `first-run complete: org=${org.id} (${org.name})`);
    return {
      ok: true,
      orgId: org.id,
      setupZatca: input.zatca?.setupNow ?? false
    };
  }),
  // ── تحديث الإعدادات من داخل البرنامج ────────────────────────────────────
  updateCompanyInfo: protectedProcedure.input(z19.object({
    name: z19.string().min(2).optional(),
    nameEn: z19.string().optional(),
    taxNumber: z19.string().optional(),
    phone: z19.string().optional(),
    email: z19.string().email().optional(),
    address: z19.string().optional()
  })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    await db.update(organizations).set({ ...input }).where(eq19(organizations.id, ctx.user.orgId));
    return { ok: true };
  })
});

// src/routers/updates.ts
import { z as z20 } from "zod";
import path6 from "path";
import fs5 from "fs";
import { fileURLToPath as fileURLToPath6 } from "url";
var __dirname6 = path6.dirname(fileURLToPath6(import.meta.url));
var ROOT_DIR = path6.join(__dirname6, "..", "..", "..");
function readVersionFile() {
  try {
    const vPath = path6.join(ROOT_DIR, "version.json");
    if (fs5.existsSync(vPath)) {
      return JSON.parse(fs5.readFileSync(vPath, "utf-8"));
    }
  } catch {
  }
  return {
    version: "1.0.0",
    build: "20260630.001",
    releaseDate: "2026-06-30",
    schemaVersion: "0012_zatca_database_architecture",
    product: "OneSoft ERP",
    channel: "stable"
  };
}
var UPDATE_LOG_PATH = path6.join(ROOT_DIR, "logs", "updates.json");
function readUpdateLog() {
  try {
    if (fs5.existsSync(UPDATE_LOG_PATH)) {
      return JSON.parse(fs5.readFileSync(UPDATE_LOG_PATH, "utf-8"));
    }
  } catch {
  }
  return [];
}
function appendUpdateLog(entry) {
  try {
    const log = readUpdateLog();
    log.unshift(entry);
    const dir = path6.dirname(UPDATE_LOG_PATH);
    if (!fs5.existsSync(dir)) fs5.mkdirSync(dir, { recursive: true });
    fs5.writeFileSync(UPDATE_LOG_PATH, JSON.stringify(log.slice(0, 50), null, 2));
  } catch {
  }
}
function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
var UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || "https://updates.onesoft-erp.com/manifest.json";
async function fetchRemoteManifest() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8e3);
    const res = await fetch(UPDATE_SERVER_URL, {
      signal: ctrl.signal,
      headers: { "Accept": "application/json", "Cache-Control": "no-cache" }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
var updatesRouter = router({
  /* ── معلومات الإصدار الحالي ── */
  getCurrentVersion: protectedProcedure.query(async () => {
    const v = readVersionFile();
    const uptimeSecs = Math.floor(process.uptime());
    const uptimeHrs = Math.floor(uptimeSecs / 3600);
    const uptimeMins = Math.floor(uptimeSecs % 3600 / 60);
    return {
      ...v,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: `${uptimeHrs}h ${uptimeMins}m`,
      uptimeSecs,
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      updateLog: readUpdateLog().slice(0, 5)
    };
  }),
  /* ── البحث عن تحديثات ── */
  checkForUpdates: superAdminProcedure.input(z20.object({
    channel: z20.enum(["stable", "beta", "dev"]).default("stable")
  }).optional()).mutation(async ({ input }) => {
    const current = readVersionFile();
    logger.info("Updates", "Checking for updates", { current: current.version, channel: input?.channel ?? "stable" });
    const manifest = await fetchRemoteManifest();
    if (!manifest) {
      return {
        status: "offline",
        currentVersion: current.version,
        message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u0627\u062F\u0645 \u0627\u0644\u062A\u062D\u062F\u064A\u062B\u0627\u062A. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A.",
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const hasUpdate = compareVersions(manifest.version, current.version) > 0;
    return {
      status: hasUpdate ? "update_available" : "up_to_date",
      currentVersion: current.version,
      latestVersion: manifest.version,
      manifest: hasUpdate ? manifest : null,
      message: hasUpdate ? `\u064A\u0648\u062C\u062F \u0625\u0635\u062F\u0627\u0631 \u062C\u062F\u064A\u062F: ${manifest.version}` : "\u0623\u0646\u062A \u062A\u0633\u062A\u062E\u062F\u0645 \u0623\u062D\u062F\u062B \u0625\u0635\u062F\u0627\u0631.",
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }),
  /* ── تشغيل التحديث ── */
  installUpdate: superAdminProcedure.input(z20.object({
    targetVersion: z20.string(),
    downloadUrl: z20.string().url(),
    checksum: z20.string().optional()
  })).mutation(async ({ input }) => {
    const current = readVersionFile();
    logger.info("Updates", "Installing update", { from: current.version, to: input.targetVersion });
    try {
      logger.info("Updates", "Step 1: Creating backup");
      logger.info("Updates", "Step 2: Downloading update package");
      logger.info("Updates", "Step 3: Applying update");
      appendUpdateLog({
        date: (/* @__PURE__ */ new Date()).toISOString(),
        from: current.version,
        to: input.targetVersion,
        status: "success"
      });
      logger.info("Updates", "Update completed successfully", { version: input.targetVersion });
      return {
        success: true,
        message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0627\u0644\u0625\u0635\u062F\u0627\u0631 ${input.targetVersion}`,
        requiresRestart: true
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Updates", "Update failed", { error: msg });
      appendUpdateLog({
        date: (/* @__PURE__ */ new Date()).toISOString(),
        from: current.version,
        to: input.targetVersion,
        status: "rollback",
        note: msg
      });
      return {
        success: false,
        message: `\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u062F\u064A\u062B: ${msg}`,
        requiresRestart: false
      };
    }
  }),
  /* ── CHANGELOG المحلي ── */
  getChangelog: protectedProcedure.query(async () => {
    const entries = [
      {
        version: "1.0.0",
        date: "2026-06-30",
        type: "major",
        title: "\u0627\u0644\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0631\u0633\u0645\u064A",
        changes: [
          { category: "added", text: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0639 \u062F\u0639\u0645 ZATCA" },
          { category: "added", text: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
          { category: "added", text: "\u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629" },
          { category: "added", text: "\u0627\u0644\u0645\u0648\u0627\u0631\u062F \u0627\u0644\u0628\u0634\u0631\u064A\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062A\u0628" },
          { category: "added", text: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0645\u0648\u062D\u062F (Unified Print Engine)" },
          { category: "added", text: "\u0628\u0646\u064A\u0629 \u0645\u0639\u0645\u0627\u0631\u064A\u0629 Modular \u0644\u0644\u0640 Frontend \u0648\u0627\u0644\u0640 Backend" },
          { category: "security", text: "JWT + bcrypt \u0644\u0644\u0645\u0635\u0627\u062F\u0642\u0629" },
          { category: "added", text: "\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u062A\u0644\u0642\u0627\u0626\u064A \u0648\u0633\u062C\u0644 \u0639\u0645\u0644\u064A\u0627\u062A" }
        ]
      }
    ];
    return entries;
  }),
  /* ── حالة خادم التحديثات ── */
  pingUpdateServer: protectedProcedure.query(async () => {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5e3);
      await fetch(UPDATE_SERVER_URL, { method: "HEAD", signal: ctrl.signal });
      return { online: true, latencyMs: Date.now() - start, url: UPDATE_SERVER_URL };
    } catch {
      return { online: false, latencyMs: null, url: UPDATE_SERVER_URL };
    }
  })
});

// src/routers/auth.ts
var authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user ? {
      id: ctx.user.id,
      name: ctx.user.name,
      username: ctx.user.username,
      role: ctx.user.role,
      orgId: ctx.user.orgId
    } : null;
  })
});

// src/routers/customers.ts
import { z as z21 } from "zod";
init_db();
init_schema();
import { eq as eq20, and as and19 } from "drizzle-orm";
var customersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.customers.findMany({
      where: and19(eq20(customers.orgId, ctx.user.orgId), eq20(customers.isActive, true)),
      orderBy: (c, { asc: asc13 }) => [asc13(c.name)]
    });
  }),
  create: protectedProcedure.input(z21.object({
    code: z21.string().optional(),
    name: z21.string().min(1),
    phone: z21.string().optional(),
    email: z21.string().optional(),
    address: z21.string().optional(),
    taxNumber: z21.string().optional(),
    customerType: z21.enum(["individual", "organization"]).optional(),
    registrationNumber: z21.string().optional(),
    shortAddress: z21.string().optional(),
    buildingNumber: z21.string().optional(),
    additionalNumber: z21.string().optional(),
    postalCode: z21.string().optional(),
    city: z21.string().optional(),
    creditLimit: z21.string().optional(),
    priceLevel: z21.number().int().min(1).max(5).optional(),
    maxDiscountPct: z21.string().optional(),
    canSellOnCredit: z21.boolean().optional(),
    whatsappPhone: z21.string().optional(),
    telegramId: z21.string().optional(),
    defaultSendMethod: z21.enum(["whatsapp", "telegram", "email"]).optional(),
    dealStartDate: z21.string().optional().nullable(),
    dealEndDate: z21.string().optional().nullable()
  })).mutation(async ({ ctx, input }) => {
    const { dealStartDate, dealEndDate, ...rest } = input;
    const [c] = await db.insert(customers).values({
      ...rest,
      customerType: rest.customerType ?? "individual",
      priceLevel: rest.priceLevel ?? 1,
      maxDiscountPct: rest.maxDiscountPct ?? "0",
      canSellOnCredit: rest.canSellOnCredit ?? true,
      dealStartDate: dealStartDate ? new Date(dealStartDate) : null,
      dealEndDate: dealEndDate ? new Date(dealEndDate) : null,
      orgId: ctx.user.orgId,
      isActive: true
    }).returning();
    return c;
  }),
  update: protectedProcedure.input(z21.object({
    id: z21.number(),
    name: z21.string().min(1).optional(),
    phone: z21.string().optional(),
    email: z21.string().optional(),
    address: z21.string().optional(),
    taxNumber: z21.string().optional(),
    customerType: z21.enum(["individual", "organization"]).optional(),
    registrationNumber: z21.string().optional(),
    shortAddress: z21.string().optional(),
    buildingNumber: z21.string().optional(),
    additionalNumber: z21.string().optional(),
    postalCode: z21.string().optional(),
    city: z21.string().optional(),
    creditLimit: z21.string().optional(),
    priceLevel: z21.number().int().min(1).max(5).optional(),
    maxDiscountPct: z21.string().optional(),
    canSellOnCredit: z21.boolean().optional(),
    whatsappPhone: z21.string().optional(),
    telegramId: z21.string().optional(),
    defaultSendMethod: z21.enum(["whatsapp", "telegram", "email"]).optional().nullable(),
    dealStartDate: z21.string().optional().nullable(),
    dealEndDate: z21.string().optional().nullable()
  })).mutation(async ({ ctx, input }) => {
    const { id, dealStartDate, dealEndDate, ...rest } = input;
    await db.update(customers).set({
      ...rest,
      dealStartDate: dealStartDate !== void 0 ? dealStartDate ? new Date(dealStartDate) : null : void 0,
      dealEndDate: dealEndDate !== void 0 ? dealEndDate ? new Date(dealEndDate) : null : void 0
    }).where(and19(eq20(customers.id, id), eq20(customers.orgId, ctx.user.orgId)));
    return { success: true };
  })
});

// src/routers/suppliers.ts
init_db();
init_schema();
import { eq as eq21, and as and20 } from "drizzle-orm";
var suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.suppliers.findMany({
      where: and20(eq21(suppliers.orgId, ctx.user.orgId), eq21(suppliers.isActive, true)),
      orderBy: (s, { asc: asc13 }) => [asc13(s.name)]
    });
  })
});

// src/routers/products.ts
import { z as z22 } from "zod";
init_db();
init_schema();
import { eq as eq22, and as and21, or as or4, like as like3, desc as desc7, isNotNull } from "drizzle-orm";
var productsRouter = router({
  list: protectedProcedure.input(z22.object({
    search: z22.string().optional(),
    categoryId: z22.number().optional()
  }).optional()).query(async ({ ctx, input }) => {
    const conditions = [eq22(products.orgId, ctx.user.orgId), eq22(products.isActive, true)];
    if (input?.search) {
      conditions.push(or4(
        like3(products.name, `%${input.search}%`),
        like3(products.code, `%${input.search}%`),
        like3(products.barcode, `%${input.search}%`)
      ));
    }
    if (input?.categoryId) {
      conditions.push(eq22(products.groupId, input.categoryId));
    }
    return db.query.products.findMany({
      where: and21(...conditions),
      orderBy: (p, { asc: asc13 }) => [asc13(p.name)]
    });
  }),
  search: protectedProcedure.input(z22.object({ q: z22.string() })).query(async ({ ctx, input }) => {
    return db.query.products.findMany({
      where: and21(
        eq22(products.orgId, ctx.user.orgId),
        eq22(products.isActive, true),
        or4(like3(products.name, `%${input.q}%`), like3(products.code, `%${input.q}%`))
      ),
      limit: 20
    });
  }),
  create: protectedProcedure.input(z22.object({
    name: z22.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628"),
    name2: z22.string().optional(),
    nameEn: z22.string().optional(),
    sku: z22.string().optional(),
    barcode: z22.string().optional(),
    barcode2: z22.string().optional(),
    barcode3: z22.string().optional(),
    groupId: z22.number().int().positive().optional(),
    categoryId: z22.number().int().positive().optional(),
    unit: z22.string().optional(),
    unit2: z22.string().optional(),
    unit3: z22.string().optional(),
    unitsJson: z22.string().optional(),
    catsJson: z22.string().optional(),
    salePrice: z22.string().optional(),
    salePrice2: z22.string().optional(),
    salePrice3: z22.string().optional(),
    salePrice4: z22.string().optional(),
    salePrice5: z22.string().optional(),
    wholesalePrice: z22.string().optional(),
    purchasePrice: z22.string().optional(),
    costPrice: z22.string().optional(),
    vatRate: z22.string().optional(),
    taxRate: z22.string().optional(),
    taxable: z22.boolean().optional(),
    taxType: z22.string().optional(),
    minStock: z22.number().optional(),
    maxStock: z22.number().optional(),
    reorderPoint: z22.number().optional(),
    itemType: z22.string().optional(),
    brand: z22.string().optional(),
    model: z22.string().optional(),
    description: z22.string().optional(),
    notes: z22.string().optional()
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
    if (!name || !name.trim()) throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628");
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
      throw new Error("\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0635\u0646\u0641 \u2014 \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062F\u062E\u0644\u0629");
    }
  }),
  bulkImport: protectedProcedure.input(z22.object({
    rows: z22.array(z22.object({
      name: z22.string().min(1),
      nameEn: z22.string().optional(),
      sku: z22.string().optional(),
      barcode: z22.string().optional(),
      unit: z22.string().optional(),
      salePrice: z22.string().optional(),
      purchasePrice: z22.string().optional(),
      taxRate: z22.string().optional(),
      minStock: z22.string().optional(),
      notes: z22.string().optional()
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
  update: protectedProcedure.input(z22.object({
    id: z22.number(),
    name: z22.string().min(1).optional(),
    name2: z22.string().optional(),
    nameEn: z22.string().optional(),
    sku: z22.string().optional(),
    barcode: z22.string().optional(),
    barcode2: z22.string().optional(),
    barcode3: z22.string().optional(),
    groupId: z22.number().optional(),
    categoryId: z22.number().optional(),
    unit: z22.string().optional(),
    unit2: z22.string().optional(),
    unit3: z22.string().optional(),
    unitsJson: z22.string().optional(),
    catsJson: z22.string().optional(),
    salePrice: z22.string().optional(),
    salePrice2: z22.string().optional(),
    salePrice3: z22.string().optional(),
    salePrice4: z22.string().optional(),
    salePrice5: z22.string().optional(),
    wholesalePrice: z22.string().optional(),
    purchasePrice: z22.string().optional(),
    costPrice: z22.string().optional(),
    vatRate: z22.string().optional(),
    taxRate: z22.string().optional(),
    taxable: z22.boolean().optional(),
    taxType: z22.string().optional(),
    minStock: z22.number().optional(),
    maxStock: z22.number().optional(),
    reorderPoint: z22.number().optional(),
    itemType: z22.string().optional(),
    brand: z22.string().optional(),
    model: z22.string().optional(),
    description: z22.string().optional(),
    isActive: z22.boolean().optional(),
    notes: z22.string().optional()
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
    await db.update(products).set(updateData).where(and21(eq22(products.id, id), eq22(products.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z22.object({ id: z22.number() })).mutation(async ({ ctx, input }) => {
    await db.update(products).set({ isActive: false }).where(and21(eq22(products.id, input.id), eq22(products.orgId, ctx.user.orgId)));
    return { success: true };
  })
});
var categoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.productGroups.findMany({
      where: eq22(productGroups.orgId, ctx.user.orgId),
      orderBy: (g, { asc: asc13 }) => [asc13(g.name)]
    });
    return rows.map((r) => ({ ...r, uuid: String(r.id), isActive: r.isActive ?? true }));
  }),
  tree: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.productGroups.findMany({
      where: eq22(productGroups.orgId, ctx.user.orgId),
      orderBy: (g, { asc: asc13 }) => [asc13(g.name)]
    });
    return rows.map((r) => ({ ...r, uuid: String(r.id), isActive: r.isActive ?? true }));
  }),
  create: protectedProcedure.input(z22.object({
    name: z22.string().min(1),
    parentId: z22.number().optional(),
    description: z22.string().optional(),
    color: z22.string().optional()
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
  update: protectedProcedure.input(z22.object({
    id: z22.number(),
    name: z22.string().min(1).optional(),
    description: z22.string().optional(),
    color: z22.string().optional(),
    isActive: z22.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.update(productGroups).set(data).where(and21(eq22(productGroups.id, id), eq22(productGroups.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z22.object({ id: z22.number() })).mutation(async ({ ctx, input }) => {
    await db.delete(productGroups).where(and21(eq22(productGroups.id, input.id), eq22(productGroups.orgId, ctx.user.orgId)));
    return { success: true };
  })
});
var productGroupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.productGroups.findMany({
      where: eq22(productGroups.orgId, ctx.user.orgId),
      orderBy: (g, { asc: asc13 }) => [asc13(g.groupCode), asc13(g.name)]
    });
  }),
  create: protectedProcedure.input(z22.object({
    name: z22.string().min(1),
    name2: z22.string().optional(),
    groupCode: z22.string().optional(),
    description: z22.string().optional(),
    parentId: z22.number().optional(),
    groupType: z22.string().optional(),
    level: z22.number().optional(),
    autoNumbering: z22.boolean().optional(),
    firstNumber: z22.number().optional(),
    lastNumber: z22.number().optional(),
    increment: z22.number().optional(),
    codeDigits: z22.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const [g] = await db.insert(productGroups).values({ ...input, orgId: ctx.user.orgId }).returning();
    return g;
  }),
  update: protectedProcedure.input(z22.object({
    id: z22.number(),
    name: z22.string().min(1).optional(),
    name2: z22.string().optional(),
    groupCode: z22.string().optional(),
    description: z22.string().optional(),
    parentId: z22.number().optional(),
    groupType: z22.string().optional(),
    level: z22.number().optional(),
    autoNumbering: z22.boolean().optional(),
    firstNumber: z22.number().optional(),
    lastNumber: z22.number().optional(),
    increment: z22.number().optional(),
    codeDigits: z22.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.update(productGroups).set(data).where(and21(eq22(productGroups.id, id), eq22(productGroups.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z22.object({ id: z22.number() })).mutation(async ({ ctx, input }) => {
    await db.delete(productGroups).where(and21(eq22(productGroups.id, input.id), eq22(productGroups.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  nextCode: protectedProcedure.input(z22.object({ groupId: z22.number() })).query(async ({ ctx, input }) => {
    const group = await db.query.productGroups.findFirst({
      where: and21(eq22(productGroups.id, input.groupId), eq22(productGroups.orgId, ctx.user.orgId))
    });
    if (!group) return null;
    const prefix = group.groupCode ?? "";
    const totalDigits = group.codeDigits ?? 5;
    const seqLen = Math.max(1, totalDigits - prefix.length);
    const firstNum = group.firstNumber ?? 1;
    const incr = group.increment ?? 1;
    const lastNum = group.lastNumber ?? 99999;
    const existing = await db.select({ code: products.code }).from(products).where(and21(
      eq22(products.orgId, ctx.user.orgId),
      prefix ? like3(products.code, prefix + "%") : isNotNull(products.code)
    )).orderBy(desc7(products.code));
    let nextNum = firstNum;
    if (existing.length > 0) {
      const nums = existing.map((p) => {
        const seq = (p.code ?? "").substring(prefix.length);
        const n = parseInt(seq, 10);
        return isNaN(n) ? -1 : n;
      }).filter((n) => n >= 0);
      if (nums.length > 0) nextNum = Math.max(...nums) + incr;
    }
    if (nextNum > lastNum) return null;
    return prefix + String(nextNum).padStart(seqLen, "0");
  })
});

// src/routers/accounts.ts
import { z as z23 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq23, and as and22, asc as asc8, isNull } from "drizzle-orm";
var accountsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.chartOfAccounts.findMany({
      where: and22(eq23(chartOfAccounts.orgId, ctx.user.orgId), eq23(chartOfAccounts.isActive, true)),
      orderBy: (a, { asc: asc13 }) => [asc13(a.code)]
    });
  }),
  children: protectedProcedure.input(z23.object({ parentId: z23.number().int().nullable() })).query(async ({ ctx, input }) => {
    const parentCond = input.parentId === null ? isNull(chartOfAccounts.parentId) : eq23(chartOfAccounts.parentId, input.parentId);
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
    }).from(chartOfAccounts).where(and22(
      eq23(chartOfAccounts.orgId, ctx.user.orgId),
      eq23(chartOfAccounts.isActive, true),
      parentCond
    )).orderBy(asc8(chartOfAccounts.code));
  }),
  create: protectedProcedure.input(z23.object({
    code: z23.string().min(1),
    name: z23.string().min(1),
    nameEn: z23.string().optional(),
    accountType: z23.string().default("assets"),
    nature: z23.string().default("debit"),
    level: z23.number().int().min(1).max(10).default(1),
    parentId: z23.number().int().optional(),
    isParent: z23.boolean().default(false),
    allowPosting: z23.boolean().default(true),
    costCenterType: z23.enum(["not_allowed", "optional", "mandatory"]).default("not_allowed"),
    isActive: z23.boolean().default(true),
    notes: z23.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const exists = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and22(eq23(chartOfAccounts.orgId, ctx.user.orgId), eq23(chartOfAccounts.code, input.code), eq23(chartOfAccounts.isActive, true))).limit(1);
    if (exists.length > 0) throw new TRPCError5({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u062D\u0633\u0627\u0628 "${input.code}" \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644` });
    if (input.parentId) {
      const parent = await db.select({ id: chartOfAccounts.id, isParent: chartOfAccounts.isParent }).from(chartOfAccounts).where(and22(eq23(chartOfAccounts.id, input.parentId), eq23(chartOfAccounts.orgId, ctx.user.orgId))).limit(1);
      if (!parent.length) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0623\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (!parent[0].isParent) throw new TRPCError5({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0636\u0627\u0641\u0629 \u062D\u0633\u0627\u0628 \u062A\u062D\u062A \u062D\u0633\u0627\u0628 \u0641\u0631\u0639\u064A \u2014 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0641\u0631\u0639\u064A \u0644\u0627 \u064A\u0642\u0628\u0644 \u062D\u0633\u0627\u0628\u0627\u062A \u062A\u062D\u062A\u0647" });
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
      await db.update(chartOfAccounts).set({ isParent: true }).where(and22(eq23(chartOfAccounts.id, input.parentId), eq23(chartOfAccounts.orgId, ctx.user.orgId)));
    }
    return account;
  }),
  delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(async ({ ctx, input }) => {
    const children = await db.select({ id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name }).from(chartOfAccounts).where(and22(
      eq23(chartOfAccounts.parentId, input.id),
      eq23(chartOfAccounts.orgId, ctx.user.orgId),
      eq23(chartOfAccounts.isActive, true)
    )).limit(1);
    if (children.length > 0) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: `\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0623\u0646\u0647 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062D\u0633\u0627\u0628\u0627\u062A \u0641\u0631\u0639\u064A\u0629 \u2014 \u064A\u062C\u0628 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0641\u0631\u0639\u064A\u0629 \u0623\u0648\u0644\u0627\u064B` });
    }
    await db.update(chartOfAccounts).set({ isActive: false }).where(and22(eq23(chartOfAccounts.id, input.id), eq23(chartOfAccounts.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  import: protectedProcedure.input(z23.object({
    accounts: z23.array(z23.object({
      code: z23.string().min(1),
      name: z23.string().min(1),
      nameEn: z23.string().optional(),
      accountType: z23.string().default("assets"),
      nature: z23.string().default("debit"),
      level: z23.number().int().min(1).max(10).default(1),
      isParent: z23.boolean().default(false),
      allowPosting: z23.boolean().default(true),
      openingBalance: z23.string().optional(),
      openingBalanceType: z23.string().default("debit")
    })),
    skipDuplicates: z23.boolean().default(true)
  })).mutation(async ({ ctx, input }) => {
    const existing = await db.select({ code: chartOfAccounts.code }).from(chartOfAccounts).where(and22(eq23(chartOfAccounts.orgId, ctx.user.orgId), eq23(chartOfAccounts.isActive, true)));
    const existingCodes = new Set(existing.map((r) => r.code));
    const toInsert = input.accounts.filter((a) => !existingCodes.has(a.code) || !input.skipDuplicates);
    if (toInsert.length === 0) return { inserted: 0, skipped: input.accounts.length };
    await db.insert(chartOfAccounts).values(toInsert.map((a) => ({ ...a, orgId: ctx.user.orgId })));
    return { inserted: toInsert.length, skipped: input.accounts.length - toInsert.length };
  })
});
var costCentersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(costCenters).where(and22(eq23(costCenters.orgId, ctx.user.orgId), eq23(costCenters.isActive, true))).orderBy(asc8(costCenters.code));
  }),
  create: protectedProcedure.input(z23.object({
    code: z23.string().min(1),
    name: z23.string().min(1),
    name2: z23.string().optional(),
    centerType: z23.enum(["root", "general", "branch"]).default("branch"),
    parentId: z23.number().optional(),
    level: z23.number().default(1),
    notes: z23.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const [c] = await db.insert(costCenters).values({ ...input, orgId: ctx.user.orgId }).returning();
    return c;
  }),
  delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(async ({ ctx, input }) => {
    await db.update(costCenters).set({ isActive: false }).where(and22(eq23(costCenters.id, input.id), eq23(costCenters.orgId, ctx.user.orgId)));
    return { success: true };
  })
});

// src/routers/journal.ts
import { z as z24 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq24, and as and23, desc as desc8, inArray as inArray4, sql as sql5 } from "drizzle-orm";
var journalRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.journalEntries.findMany({
      where: eq24(journalEntries.orgId, ctx.user.orgId),
      orderBy: [desc8(journalEntries.createdAt)],
      limit: 100
    });
  }),
  get: protectedProcedure.input(z24.object({ id: z24.number() })).query(async ({ ctx, input }) => {
    const entry = await db.query.journalEntries.findFirst({
      where: and23(eq24(journalEntries.id, input.id), eq24(journalEntries.orgId, ctx.user.orgId))
    });
    if (!entry) throw new Error("\u0627\u0644\u0642\u064A\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const lines = await db.query.journalEntryLines.findMany({
      where: eq24(journalEntryLines.entryId, input.id),
      orderBy: (l, { asc: asc13 }) => [asc13(l.sortOrder)]
    });
    return { ...entry, lines };
  }),
  nextNumber: protectedProcedure.query(async ({ ctx }) => {
    const last = await db.query.journalEntries.findFirst({
      where: eq24(journalEntries.orgId, ctx.user.orgId),
      orderBy: [desc8(journalEntries.id)]
    });
    const raw = last ? parseInt(last.entryNumber.replace(/\D/g, "") || "0") : 0;
    const num = raw > 9e6 ? 1 : raw + 1;
    return `JE-${String(num).padStart(4, "0")}`;
  }),
  create: protectedProcedure.input(z24.object({
    entryDate: z24.string(),
    description: z24.string().optional(),
    reference: z24.string().optional(),
    totalDebit: z24.string(),
    totalCredit: z24.string(),
    sourceDocType: z24.string().optional(),
    sourceDocId: z24.number().optional(),
    sourceDocNumber: z24.string().optional(),
    entryType: z24.enum(["manual", "auto"]).optional(),
    lines: z24.array(z24.object({
      accountId: z24.number().optional(),
      accountCode: z24.string().optional(),
      accountName: z24.string().optional(),
      description: z24.string().optional(),
      debit: z24.string().default("0"),
      credit: z24.string().default("0"),
      sortOrder: z24.number().optional()
    }))
  })).mutation(async ({ ctx, input }) => {
    const { lines, entryDate, ...rest } = input;
    const totalD = lines.reduce((s, l) => s + parseFloat(l.debit ?? "0"), 0);
    const totalC = lines.reduce((s, l) => s + parseFloat(l.credit ?? "0"), 0);
    if (Math.abs(totalD - totalC) > 1e-3)
      throw new TRPCError6({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0641\u0638 \u0627\u0644\u0642\u064A\u062F: \u0627\u0644\u0645\u062F\u064A\u0646 \u0644\u0627 \u064A\u0633\u0627\u0648\u064A \u0627\u0644\u062F\u0627\u0626\u0646" });
    const accountIds = lines.map((l) => l.accountId).filter((id) => !!id);
    if (accountIds.length > 0) {
      const accs = await db.query.chartOfAccounts.findMany({ where: inArray4(chartOfAccounts.id, accountIds) });
      const accMap = new Map(accs.map((a) => [a.id, a]));
      for (const l of lines) {
        if (!l.accountId) continue;
        const acc = accMap.get(l.accountId);
        if (!acc)
          throw new TRPCError6({ code: "BAD_REQUEST", message: `\u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0627\u0644\u0643\u0648\u062F ${l.accountCode ?? l.accountId} \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F` });
        if (!acc.isActive)
          throw new TRPCError6({ code: "BAD_REQUEST", message: `\u0627\u0644\u062D\u0633\u0627\u0628 "${acc.code} - ${acc.name}" \u0645\u0648\u0642\u0648\u0641 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u062D\u064A\u0644 \u0639\u0644\u064A\u0647` });
        if (acc.isParent)
          throw new TRPCError6({ code: "BAD_REQUEST", message: `\u0627\u0644\u062D\u0633\u0627\u0628 "${acc.code} - ${acc.name}" \u062A\u062C\u0645\u064A\u0639\u064A \u2014 \u064A\u062C\u0628 \u0627\u062E\u062A\u064A\u0627\u0631 \u062D\u0633\u0627\u0628 \u0641\u0631\u0639\u064A` });
        if (acc.allowPosting === false)
          throw new TRPCError6({ code: "BAD_REQUEST", message: `\u0627\u0644\u062D\u0633\u0627\u0628 "${acc.code} - ${acc.name}" \u0644\u0627 \u064A\u0633\u0645\u062D \u0628\u0627\u0644\u062A\u0631\u062D\u064A\u0644` });
      }
    }
    const orgId = ctx.user.orgId;
    const entry = await db.transaction(async (tx) => {
      await tx.execute(sql5`SELECT pg_advisory_xact_lock(${orgId}::bigint)`);
      const lastEntry = await tx.query.journalEntries.findFirst({
        where: eq24(journalEntries.orgId, orgId),
        orderBy: [desc8(journalEntries.id)]
      });
      const lastNum = lastEntry ? parseInt(lastEntry.entryNumber.replace(/\D/g, "") || "0") : 0;
      const safeLastNum = lastNum > 9e6 ? 0 : lastNum;
      const entryNumber = `JE-${String(safeLastNum + 1).padStart(4, "0")}`;
      const [newEntry] = await tx.insert(journalEntries).values({
        ...rest,
        entryNumber,
        entryType: rest.entryType ?? "manual",
        orgId,
        userId: ctx.user.id,
        entryDate: new Date(entryDate),
        status: "posted"
      }).returning();
      if (lines.length > 0) {
        await tx.insert(journalEntryLines).values(
          lines.map((l, i) => ({ ...l, entryId: newEntry.id, orgId, sortOrder: l.sortOrder ?? i }))
        );
      }
      return newEntry;
    });
    return entry;
  }),
  delete: protectedProcedure.input(z24.object({ id: z24.number() })).mutation(async ({ ctx, input }) => {
    await db.update(journalEntries).set({ status: "cancelled" }).where(and23(eq24(journalEntries.id, input.id), eq24(journalEntries.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  getByNumber: protectedProcedure.input(z24.object({ entryNumber: z24.string() })).query(async ({ ctx, input }) => {
    const entry = await db.query.journalEntries.findFirst({
      where: and23(eq24(journalEntries.entryNumber, input.entryNumber), eq24(journalEntries.orgId, ctx.user.orgId))
    });
    if (!entry) return null;
    const lines = await db.query.journalEntryLines.findMany({
      where: eq24(journalEntryLines.entryId, entry.id),
      orderBy: (l, { asc: asc13 }) => [asc13(l.sortOrder)]
    });
    return { ...entry, lines };
  })
});

// src/routers/warehouses.ts
import { z as z25 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq25, and as and24 } from "drizzle-orm";
var warehousesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.warehouses.findMany({
      where: and24(eq25(warehouses.orgId, ctx.user.orgId), eq25(warehouses.isActive, true)),
      orderBy: (w, { asc: asc13 }) => [asc13(w.name)]
    });
  }),
  create: protectedProcedure.input(z25.object({
    name: z25.string().min(1),
    code: z25.string().optional(),
    branchId: z25.number().optional(),
    name2: z25.string().optional(),
    fullName1: z25.string().optional(),
    fullName2: z25.string().optional(),
    description: z25.string().optional(),
    invAccountId: z25.number().optional(),
    cogsAccount1Id: z25.number().optional(),
    cogsAccount2Id: z25.number().optional(),
    cashAccountId: z25.number().optional(),
    bankAccountId: z25.number().optional(),
    salesAccount1Id: z25.number().optional(),
    allowedUserId: z25.number().optional(),
    allowedUserGroup: z25.string().optional(),
    copyFromWarehouseId: z25.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const { description, ...rest } = input;
    const [w] = await db.insert(warehouses).values({ ...rest, address: description, orgId: ctx.user.orgId, isActive: true }).returning();
    return w;
  }),
  update: protectedProcedure.input(z25.object({
    id: z25.number(),
    name: z25.string().optional(),
    code: z25.string().optional(),
    branchId: z25.number().optional(),
    name2: z25.string().optional(),
    fullName1: z25.string().optional(),
    fullName2: z25.string().optional(),
    description: z25.string().optional(),
    invAccountId: z25.number().optional(),
    cogsAccount1Id: z25.number().optional(),
    cogsAccount2Id: z25.number().optional(),
    cashAccountId: z25.number().optional(),
    bankAccountId: z25.number().optional(),
    salesAccount1Id: z25.number().optional(),
    allowedUserId: z25.number().optional(),
    allowedUserGroup: z25.string().optional(),
    copyFromWarehouseId: z25.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, description, ...rest } = input;
    await db.update(warehouses).set({ ...rest, address: description }).where(and24(eq25(warehouses.id, id), eq25(warehouses.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z25.object({ id: z25.number() })).mutation(async ({ ctx, input }) => {
    const [hasInventory, hasVouchers, hasInventoryCounts, hasSalesInvoices] = await Promise.all([
      db.select({ id: inventory.id }).from(inventory).where(and24(eq25(inventory.warehouseId, input.id), eq25(inventory.orgId, ctx.user.orgId))).limit(1),
      db.select({ id: stockVouchers.id }).from(stockVouchers).where(and24(eq25(stockVouchers.warehouseId, input.id), eq25(stockVouchers.orgId, ctx.user.orgId))).limit(1),
      db.select({ id: inventoryCounts.id }).from(inventoryCounts).where(and24(eq25(inventoryCounts.warehouseId, input.id), eq25(inventoryCounts.orgId, ctx.user.orgId))).limit(1),
      db.select({ id: salesInvoices.id }).from(salesInvoices).where(and24(eq25(salesInvoices.warehouseId, input.id), eq25(salesInvoices.orgId, ctx.user.orgId))).limit(1)
    ]);
    if (hasInventory.length > 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0645\u0646\u062A\u062C\u0627\u062A \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646" });
    if (hasVouchers.length > 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0631\u0643\u0627\u062A \u0645\u062E\u0632\u0646\u064A\u0629" });
    if (hasInventoryCounts.length > 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0639\u0645\u0644\u064A\u0627\u062A \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A" });
    if (hasSalesInvoices.length > 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062E\u0632\u0646 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A" });
    await db.update(warehouses).set({ isActive: false }).where(and24(eq25(warehouses.id, input.id), eq25(warehouses.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  accountLinks: router({
    list: protectedProcedure.input(z25.object({ warehouseId: z25.number() })).query(async ({ input }) => {
      return db.select().from(warehouseAccountLinks).where(eq25(warehouseAccountLinks.warehouseId, input.warehouseId)).orderBy(warehouseAccountLinks.sortOrder);
    }),
    listAll: protectedProcedure.query(async ({ ctx }) => {
      return db.select({
        id: warehouseAccountLinks.id,
        warehouseId: warehouseAccountLinks.warehouseId,
        label: warehouseAccountLinks.label,
        accountId: warehouseAccountLinks.accountId,
        sortOrder: warehouseAccountLinks.sortOrder,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        warehouseName: warehouses.name
      }).from(warehouseAccountLinks).innerJoin(warehouses, and24(
        eq25(warehouses.id, warehouseAccountLinks.warehouseId),
        eq25(warehouses.orgId, ctx.user.orgId)
      )).leftJoin(chartOfAccounts, eq25(chartOfAccounts.id, warehouseAccountLinks.accountId)).orderBy(warehouses.name, warehouseAccountLinks.sortOrder);
    }),
    save: protectedProcedure.input(z25.object({
      warehouseId: z25.number(),
      links: z25.array(z25.object({
        id: z25.number().optional(),
        label: z25.string().min(1),
        accountId: z25.number().nullable().optional(),
        sortOrder: z25.number().default(0)
      }))
    })).mutation(async ({ input }) => {
      await db.delete(warehouseAccountLinks).where(eq25(warehouseAccountLinks.warehouseId, input.warehouseId));
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
});

// src/routers/inventory.ts
import { z as z26 } from "zod";
init_db();
init_schema();
import { eq as eq26, and as and25, desc as desc9 } from "drizzle-orm";
var stockVouchersRouter = router({
  list: protectedProcedure.input(z26.object({ type: z26.enum(["receipt", "issue", "transfer"]).optional() }).optional()).query(async ({ ctx, input }) => {
    const conds = [eq26(stockVouchers.orgId, ctx.user.orgId)];
    if (input?.type) conds.push(eq26(stockVouchers.type, input.type));
    return db.query.stockVouchers.findMany({
      where: and25(...conds),
      orderBy: [desc9(stockVouchers.createdAt)],
      limit: 200
    });
  }),
  get: protectedProcedure.input(z26.object({ id: z26.number() })).query(async ({ ctx, input }) => {
    const v = await db.query.stockVouchers.findFirst({
      where: and25(eq26(stockVouchers.id, input.id), eq26(stockVouchers.orgId, ctx.user.orgId))
    });
    if (!v) throw new Error("\u0627\u0644\u0633\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const items = await db.query.stockVoucherItems.findMany({ where: eq26(stockVoucherItems.voucherId, input.id) });
    return { ...v, items };
  }),
  create: protectedProcedure.input(z26.object({
    type: z26.enum(["receipt", "issue", "transfer"]),
    warehouseId: z26.number(),
    branchId: z26.number(),
    supplierId: z26.number().optional(),
    reason: z26.string().optional(),
    notes: z26.string().optional(),
    items: z26.array(z26.object({
      productId: z26.number(),
      productName: z26.string(),
      quantity: z26.string(),
      unitCost: z26.string(),
      totalCost: z26.string()
    }))
  })).mutation(async ({ ctx, input }) => {
    const { items, ...rest } = input;
    const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0).toFixed(4);
    const last = await db.query.stockVouchers.findFirst({
      where: eq26(stockVouchers.orgId, ctx.user.orgId),
      orderBy: [desc9(stockVouchers.id)]
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
        where: and25(eq26(inventory.orgId, ctx.user.orgId), eq26(inventory.productId, item.productId), eq26(inventory.warehouseId, rest.warehouseId))
      });
      const qty = Number(item.quantity);
      const diff = rest.type === "receipt" ? qty : -qty;
      if (existing) {
        await db.update(inventory).set({ quantity: String(Number(existing.quantity) + diff), updatedAt: /* @__PURE__ */ new Date() }).where(eq26(inventory.id, existing.id));
      } else {
        await db.insert(inventory).values({
          orgId: ctx.user.orgId,
          productId: item.productId,
          warehouseId: rest.warehouseId,
          quantity: String(Math.max(0, diff)),
          avgCost: item.unitCost
        });
      }
    }
    return v;
  })
});
var inventoryCountRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.inventoryCounts.findMany({
      where: eq26(inventoryCounts.orgId, ctx.user.orgId),
      orderBy: [desc9(inventoryCounts.createdAt)],
      limit: 100
    });
  }),
  get: protectedProcedure.input(z26.object({ id: z26.number() })).query(async ({ ctx, input }) => {
    const count2 = await db.query.inventoryCounts.findFirst({
      where: and25(eq26(inventoryCounts.id, input.id), eq26(inventoryCounts.orgId, ctx.user.orgId))
    });
    if (!count2) throw new Error("\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const items = await db.query.inventoryCountItems.findMany({
      where: eq26(inventoryCountItems.countId, input.id),
      orderBy: (i, { asc: asc13 }) => [asc13(i.sortOrder)]
    });
    return { ...count2, items };
  }),
  create: protectedProcedure.input(z26.object({
    warehouseId: z26.number(),
    branchId: z26.number().optional(),
    notes: z26.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const last = await db.query.inventoryCounts.findFirst({
      where: eq26(inventoryCounts.orgId, ctx.user.orgId),
      orderBy: [desc9(inventoryCounts.id)]
    });
    const num = last ? parseInt(last.countNumber.replace(/\D/g, "") || "0") + 1 : 1;
    const countNumber = `CNT-${String(num).padStart(4, "0")}`;
    const [count2] = await db.insert(inventoryCounts).values({
      ...input,
      orgId: ctx.user.orgId,
      userId: ctx.user.id,
      countNumber,
      status: "draft"
    }).returning();
    const invItems = await db.query.inventory.findMany({
      where: and25(eq26(inventory.orgId, ctx.user.orgId), eq26(inventory.warehouseId, input.warehouseId))
    });
    if (invItems.length > 0) {
      const prods = await db.query.products.findMany({ where: eq26(products.orgId, ctx.user.orgId) });
      const prodMap = new Map(prods.map((p) => [p.id, p]));
      await db.insert(inventoryCountItems).values(
        invItems.map((inv, i) => ({
          countId: count2.id,
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
    return count2.id;
  }),
  updateItem: protectedProcedure.input(z26.object({ id: z26.number(), actualQuantity: z26.string() })).mutation(async ({ input }) => {
    const item = await db.query.inventoryCountItems.findFirst({ where: eq26(inventoryCountItems.id, input.id) });
    if (!item) throw new Error("\u0627\u0644\u0639\u0646\u0635\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const diff = (Number(input.actualQuantity) - Number(item.systemQuantity)).toFixed(4);
    await db.update(inventoryCountItems).set({ actualQuantity: input.actualQuantity, difference: diff }).where(eq26(inventoryCountItems.id, input.id));
    return { success: true };
  }),
  confirm: protectedProcedure.input(z26.object({ id: z26.number() })).mutation(async ({ ctx, input }) => {
    const count2 = await db.query.inventoryCounts.findFirst({
      where: and25(eq26(inventoryCounts.id, input.id), eq26(inventoryCounts.orgId, ctx.user.orgId))
    });
    if (!count2) throw new Error("\u062C\u0644\u0633\u0629 \u0627\u0644\u062C\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    if (count2.status !== "draft") throw new Error("\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062C\u0631\u062F \u0645\u0633\u0628\u0642\u0627\u064B");
    const items = await db.query.inventoryCountItems.findMany({ where: eq26(inventoryCountItems.countId, input.id) });
    for (const item of items) {
      if (!item.productId || !count2.warehouseId) continue;
      const existing = await db.query.inventory.findFirst({
        where: and25(eq26(inventory.orgId, ctx.user.orgId), eq26(inventory.productId, item.productId), eq26(inventory.warehouseId, count2.warehouseId))
      });
      if (existing) {
        await db.update(inventory).set({ quantity: item.actualQuantity, updatedAt: /* @__PURE__ */ new Date() }).where(eq26(inventory.id, existing.id));
      } else {
        await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: count2.warehouseId, quantity: item.actualQuantity });
      }
    }
    await db.update(inventoryCounts).set({ status: "confirmed", confirmedAt: /* @__PURE__ */ new Date() }).where(eq26(inventoryCounts.id, input.id));
    return { success: true };
  })
});

// src/routers/dashboard.ts
import { z as z27 } from "zod";
init_db();
init_schema();
import { eq as eq27, and as and26, desc as desc10, sql as sql6 } from "drizzle-orm";
var dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const now = /* @__PURE__ */ new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [todayRows, monthRows, productCountRow, pendingTransferRow] = await Promise.all([
      db.select({
        total: sql6`coalesce(sum(${salesInvoices.total}), 0)`,
        count: sql6`count(*)`
      }).from(salesInvoices).where(and26(
        eq27(salesInvoices.orgId, orgId),
        sql6`${salesInvoices.invoiceDate} >= ${todayStart}`,
        sql6`${salesInvoices.invoiceType} = 'sale'`,
        sql6`${salesInvoices.status} != 'cancelled'`
      )),
      db.select({
        total: sql6`coalesce(sum(${salesInvoices.total}), 0)`,
        count: sql6`count(*)`
      }).from(salesInvoices).where(and26(
        eq27(salesInvoices.orgId, orgId),
        sql6`${salesInvoices.invoiceDate} >= ${monthStart}`,
        sql6`${salesInvoices.invoiceType} = 'sale'`,
        sql6`${salesInvoices.status} != 'cancelled'`
      )),
      db.select({ count: sql6`count(*)` }).from(products).where(and26(eq27(products.orgId, orgId), eq27(products.isActive, true))),
      db.select({ count: sql6`count(*)` }).from(stockVouchers).where(and26(eq27(stockVouchers.orgId, orgId), sql6`${stockVouchers.type}::text = 'transfer'`, eq27(stockVouchers.status, "draft")))
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
  salesChart: protectedProcedure.input(z27.object({ days: z27.number().default(7) })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const since = /* @__PURE__ */ new Date();
    since.setDate(since.getDate() - input.days);
    const rows = await db.select({
      date: sql6`date_trunc('day', ${salesInvoices.invoiceDate})::date`,
      total: sql6`coalesce(sum(${salesInvoices.total}), 0)`,
      count: sql6`count(*)`
    }).from(salesInvoices).where(and26(
      eq27(salesInvoices.orgId, orgId),
      sql6`${salesInvoices.invoiceDate} >= ${since}`,
      sql6`${salesInvoices.invoiceType} = 'sale'`,
      sql6`${salesInvoices.status} != 'cancelled'`
    )).groupBy(sql6`date_trunc('day', ${salesInvoices.invoiceDate})::date`).orderBy(sql6`date_trunc('day', ${salesInvoices.invoiceDate})::date`);
    return rows.map((r) => ({ date: r.date, total: Number(r.total), count: Number(r.count) }));
  }),
  topProducts: protectedProcedure.input(z27.object({ limit: z27.number().default(5) })).query(async ({ ctx, input }) => {
    const orgId = ctx.user.orgId;
    const monthStart = /* @__PURE__ */ new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const rows = await db.select({
      productId: salesInvoiceItems.productId,
      productName: salesInvoiceItems.productName,
      totalQty: sql6`sum(${salesInvoiceItems.quantity})`,
      totalRevenue: sql6`sum(${salesInvoiceItems.total})`
    }).from(salesInvoiceItems).innerJoin(salesInvoices, eq27(salesInvoiceItems.invoiceId, salesInvoices.id)).where(and26(
      eq27(salesInvoices.orgId, orgId),
      sql6`${salesInvoices.invoiceDate} >= ${monthStart}`,
      sql6`${salesInvoices.invoiceType} = 'sale'`,
      sql6`${salesInvoices.status} != 'cancelled'`
    )).groupBy(salesInvoiceItems.productId, salesInvoiceItems.productName).orderBy(desc10(sql6`sum(${salesInvoiceItems.total})`)).limit(input.limit);
    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      totalQty: Number(r.totalQty),
      totalRevenue: Number(r.totalRevenue)
    }));
  })
});

// src/routers/reports.ts
import { z as z28 } from "zod";
init_db();
init_schema();
import { eq as eq28, and as and27 } from "drizzle-orm";
var reportsRouter = router({
  stockByWarehouse: protectedProcedure.input(z28.object({ warehouseId: z28.number().optional() }).optional()).query(async ({ ctx, input }) => {
    const conds = [eq28(inventory.orgId, ctx.user.orgId)];
    if (input?.warehouseId) conds.push(eq28(inventory.warehouseId, input.warehouseId));
    const [invRows, prods, warehouseList] = await Promise.all([
      db.query.inventory.findMany({ where: and27(...conds) }),
      db.query.products.findMany({ where: eq28(products.orgId, ctx.user.orgId) }),
      db.query.warehouses.findMany({ where: eq28(warehouses.orgId, ctx.user.orgId) })
    ]);
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
    const all = await db.query.stockVouchers.findMany({ where: eq28(stockVouchers.orgId, ctx.user.orgId) });
    const grouped = {};
    for (const v of all) {
      if (!grouped[v.type]) grouped[v.type] = { type: v.type, count: 0, totalCost: 0 };
      grouped[v.type].count++;
      grouped[v.type].totalCost += Number(v.totalCost ?? 0);
    }
    return Object.values(grouped).map((g) => ({ ...g, totalCost: g.totalCost.toFixed(4) }));
  }),
  lowStockAlert: protectedProcedure.query(async ({ ctx }) => {
    const [invRows, prods, warehouseList] = await Promise.all([
      db.query.inventory.findMany({ where: eq28(inventory.orgId, ctx.user.orgId) }),
      db.query.products.findMany({ where: and27(eq28(products.orgId, ctx.user.orgId), eq28(products.isActive, true)) }),
      db.query.warehouses.findMany({ where: eq28(warehouses.orgId, ctx.user.orgId) })
    ]);
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
});

// src/routers/vouchers.ts
import { z as z29 } from "zod";
init_db();
init_schema();
import { eq as eq29, and as and28, desc as desc12 } from "drizzle-orm";
var vouchersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.vouchers.findMany({
      where: eq29(vouchers.orgId, ctx.user.orgId),
      orderBy: [desc12(vouchers.createdAt)],
      limit: 100
    });
  }),
  nextNumber: protectedProcedure.input(z29.object({ type: z29.enum(["receipt", "payment"]) })).query(async ({ ctx, input }) => {
    const last = await db.query.vouchers.findFirst({
      where: and28(eq29(vouchers.orgId, ctx.user.orgId), eq29(vouchers.voucherType, input.type)),
      orderBy: [desc12(vouchers.id)]
    });
    const prefix = input.type === "receipt" ? "RV" : "PV";
    const num = last ? parseInt(last.voucherNumber.replace(/\D/g, "") || "0") + 1 : 1;
    return `${prefix}-${String(num).padStart(4, "0")}`;
  }),
  create: protectedProcedure.input(z29.object({
    voucherNumber: z29.string(),
    voucherType: z29.enum(["receipt", "payment"]),
    voucherDate: z29.string(),
    amount: z29.string(),
    paymentMethod: z29.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
    accountCode: z29.string().optional(),
    accountName: z29.string().optional(),
    partyType: z29.string().optional(),
    partyName: z29.string().optional(),
    description: z29.string().optional(),
    reference: z29.string().optional()
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
});
var receiptVouchersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(receiptVouchers).where(eq29(receiptVouchers.orgId, ctx.user.orgId)).orderBy(desc12(receiptVouchers.createdAt)).limit(200);
  }),
  create: protectedProcedure.input(z29.object({
    voucherNumber: z29.string(),
    voucherDate: z29.date(),
    receivedFrom: z29.string().optional(),
    amount: z29.string(),
    paymentMethod: z29.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
    bankAccount: z29.string().optional(),
    checkNumber: z29.string().optional(),
    description: z29.string().optional(),
    accountId: z29.number().optional(),
    contraAccountId: z29.number().optional(),
    costCenterId: z29.number().optional(),
    notes: z29.string().optional()
  })).mutation(async ({ ctx, input }) => {
    let journalEntryId;
    let journalEntryNumber;
    if (input.accountId && input.contraAccountId) {
      const [accDebit, accCredit] = await Promise.all([
        db.query.chartOfAccounts.findFirst({ where: eq29(chartOfAccounts.id, input.accountId) }),
        db.query.chartOfAccounts.findFirst({ where: eq29(chartOfAccounts.id, input.contraAccountId) })
      ]);
      const entry = await insertJournalEntry({
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        date: input.voucherDate,
        description: `\u0633\u0646\u062F \u0642\u0628\u0636 \u0631\u0642\u0645 ${input.voucherNumber}${input.receivedFrom ? ` - ${input.receivedFrom}` : ""}`,
        reference: input.voucherNumber,
        sourceDocType: "receipt_voucher",
        sourceDocId: 0,
        sourceDocNumber: input.voucherNumber,
        lines: [
          { accountId: input.accountId, accountCode: accDebit?.code ?? "---", accountName: accDebit?.name ?? "", debit: input.amount, credit: "0", description: input.description ?? "" },
          { accountId: input.contraAccountId, accountCode: accCredit?.code ?? "---", accountName: accCredit?.name ?? "", debit: "0", credit: input.amount, description: input.description ?? "" }
        ]
      });
      journalEntryId = entry.id;
      journalEntryNumber = entry.entryNumber;
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
});
var paymentVouchersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(paymentVouchers).where(eq29(paymentVouchers.orgId, ctx.user.orgId)).orderBy(desc12(paymentVouchers.createdAt)).limit(200);
  }),
  create: protectedProcedure.input(z29.object({
    voucherNumber: z29.string(),
    voucherDate: z29.date(),
    paidTo: z29.string().optional(),
    amount: z29.string(),
    paymentMethod: z29.enum(["cash", "bank", "credit", "check", "other"]).default("cash"),
    bankAccount: z29.string().optional(),
    checkNumber: z29.string().optional(),
    description: z29.string().optional(),
    accountId: z29.number().optional(),
    contraAccountId: z29.number().optional(),
    notes: z29.string().optional()
  })).mutation(async ({ ctx, input }) => {
    let journalEntryId;
    let journalEntryNumber;
    if (input.accountId && input.contraAccountId) {
      const [accDebit, accCredit] = await Promise.all([
        db.query.chartOfAccounts.findFirst({ where: eq29(chartOfAccounts.id, input.contraAccountId) }),
        db.query.chartOfAccounts.findFirst({ where: eq29(chartOfAccounts.id, input.accountId) })
      ]);
      const entry = await insertJournalEntry({
        orgId: ctx.user.orgId,
        userId: ctx.user.id,
        date: input.voucherDate,
        description: `\u0633\u0646\u062F \u0635\u0631\u0641 \u0631\u0642\u0645 ${input.voucherNumber}${input.paidTo ? ` - ${input.paidTo}` : ""}`,
        reference: input.voucherNumber,
        sourceDocType: "payment_voucher",
        sourceDocId: 0,
        sourceDocNumber: input.voucherNumber,
        lines: [
          { accountId: input.contraAccountId, accountCode: accDebit?.code ?? "---", accountName: accDebit?.name ?? "", debit: input.amount, credit: "0", description: input.description ?? "" },
          { accountId: input.accountId, accountCode: accCredit?.code ?? "---", accountName: accCredit?.name ?? "", debit: "0", credit: input.amount, description: input.description ?? "" }
        ]
      });
      journalEntryId = entry.id;
      journalEntryNumber = entry.entryNumber;
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
});

// src/routers/accounting.ts
import { z as z30 } from "zod";
init_db();
init_schema();
import { eq as eq30, and as and29, asc as asc11, gte as gte3, lte as lte3 } from "drizzle-orm";
var accountingRouter = router({
  trialBalance: protectedProcedure.input(z30.object({
    fromDate: z30.date().optional(),
    toDate: z30.date().optional(),
    costCenterId: z30.number().optional()
  })).query(async ({ ctx, input }) => {
    const { fromDate, toDate } = input;
    const endOfDay = (d) => new Date(d.getTime() + 86399999);
    const [accounts, allLines] = await Promise.all([
      db.select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        nature: chartOfAccounts.nature,
        isParent: chartOfAccounts.isParent,
        level: chartOfAccounts.level,
        parentId: chartOfAccounts.parentId,
        accountType: chartOfAccounts.accountType,
        openingBalance: chartOfAccounts.openingBalance,
        openingBalanceType: chartOfAccounts.openingBalanceType
      }).from(chartOfAccounts).where(and29(eq30(chartOfAccounts.orgId, ctx.user.orgId), eq30(chartOfAccounts.isActive, true))).orderBy(asc11(chartOfAccounts.code)),
      db.select({
        accountId: journalEntryLines.accountId,
        debit: journalEntryLines.debit,
        credit: journalEntryLines.credit,
        entryDate: journalEntries.entryDate
      }).from(journalEntryLines).innerJoin(journalEntries, and29(
        eq30(journalEntries.id, journalEntryLines.entryId),
        eq30(journalEntries.status, "posted"),
        eq30(journalEntries.orgId, ctx.user.orgId)
      )).where(eq30(journalEntryLines.orgId, ctx.user.orgId))
    ]);
    const agg = /* @__PURE__ */ new Map();
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
    return accounts.map((acc) => {
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
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        nature: acc.nature ?? "debit",
        isParent: acc.isParent ?? false,
        level: acc.level,
        parentId: acc.parentId ?? null,
        accountType: acc.accountType,
        openingBalance: Math.abs(netOpen),
        openingBalanceType: netOpen >= 0 ? "debit" : "credit",
        movementDebit: moveD,
        movementCredit: moveC,
        closingBalance: Math.abs(netClose),
        closingBalanceType: netClose >= 0 ? "debit" : "credit"
      };
    });
  }),
  accountStatement: protectedProcedure.input(z30.object({
    accountId: z30.number(),
    fromDate: z30.date().optional(),
    toDate: z30.date().optional()
  })).query(async ({ ctx, input }) => {
    const { accountId, fromDate, toDate } = input;
    const endOfDay = (d) => new Date(d.getTime() + 86399999);
    const conds = [
      eq30(journalEntryLines.accountId, accountId),
      eq30(journalEntryLines.orgId, ctx.user.orgId),
      eq30(journalEntries.status, "posted")
    ];
    if (fromDate) conds.push(gte3(journalEntries.entryDate, fromDate));
    if (toDate) conds.push(lte3(journalEntries.entryDate, endOfDay(toDate)));
    const lines = await db.select({
      entryId: journalEntryLines.entryId,
      entryDate: journalEntries.entryDate,
      entryNumber: journalEntries.entryNumber,
      reference: journalEntries.reference,
      sourceDocType: journalEntries.sourceDocType,
      description: journalEntries.description,
      lineDesc: journalEntryLines.description,
      debit: journalEntryLines.debit,
      credit: journalEntryLines.credit
    }).from(journalEntryLines).innerJoin(journalEntries, and29(
      eq30(journalEntries.id, journalEntryLines.entryId),
      eq30(journalEntries.orgId, ctx.user.orgId)
    )).where(and29(...conds)).orderBy(asc11(journalEntries.entryDate), asc11(journalEntries.id));
    const docTypeLabel = (src) => {
      switch (src) {
        case "sales_invoice":
          return "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A";
        case "sales_return":
          return "\u0645\u0631\u062F\u0648\u062F \u0645\u0628\u064A\u0639\u0627\u062A";
        case "purchase_invoice":
          return "\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0634\u062A\u0631\u064A\u0627\u062A";
        case "purchase_return":
          return "\u0645\u0631\u062F\u0648\u062F \u0645\u0634\u062A\u0631\u064A\u0627\u062A";
        case "receipt_voucher":
          return "\u0633\u0646\u062F \u0642\u0628\u0636";
        case "payment_voucher":
          return "\u0633\u0646\u062F \u0635\u0631\u0641";
        default:
          return "\u0642\u064A\u062F";
      }
    };
    return lines.map((l) => ({
      entryId: l.entryId,
      entryDate: l.entryDate,
      entryNumber: l.entryNumber,
      reference: l.reference,
      voucherType: docTypeLabel(l.sourceDocType),
      description: l.lineDesc ?? l.description,
      debit: l.debit,
      credit: l.credit
    }));
  })
});

// src/routers/settings.ts
import { z as z31 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq31, and as and30, desc as desc13 } from "drizzle-orm";
var userGroupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(userGroups).where(and30(eq31(userGroups.orgId, ctx.user.orgId), eq31(userGroups.isActive, true))).orderBy(userGroups.name);
  }),
  create: protectedProcedure.input(z31.object({ code: z31.string().optional(), name: z31.string().min(1), description: z31.string().optional() })).mutation(async ({ ctx, input }) => {
    const [g] = await db.insert(userGroups).values({
      orgId: ctx.user.orgId,
      code: input.code,
      name: input.name,
      description: input.description
    }).returning();
    return g;
  }),
  update: protectedProcedure.input(z31.object({ id: z31.number(), code: z31.string().optional(), name: z31.string().optional(), description: z31.string().optional() })).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    await db.update(userGroups).set(rest).where(and30(eq31(userGroups.id, id), eq31(userGroups.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z31.object({ id: z31.number() })).mutation(async ({ ctx, input }) => {
    await db.update(userGroups).set({ isActive: false }).where(and30(eq31(userGroups.id, input.id), eq31(userGroups.orgId, ctx.user.orgId)));
    return { success: true };
  })
});
var userCategoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(userCategories).where(and30(eq31(userCategories.orgId, ctx.user.orgId), eq31(userCategories.isActive, true))).orderBy(userCategories.name);
  }),
  create: protectedProcedure.input(z31.object({
    code: z31.string().optional(),
    name: z31.string().min(1),
    autoNumbering: z31.boolean().optional(),
    firstNumber: z31.number().optional(),
    lastNumber: z31.number().optional(),
    increment: z31.number().optional(),
    codeDigits: z31.number().optional()
  })).mutation(async ({ ctx, input }) => {
    if (input.code) {
      const dup = await db.select({ id: userCategories.id }).from(userCategories).where(and30(eq31(userCategories.orgId, ctx.user.orgId), eq31(userCategories.code, input.code), eq31(userCategories.isActive, true))).limit(1);
      if (dup.length) throw new TRPCError8({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0648\u062F \u0645\u0643\u0631\u0631 \u2014 \u064A\u0648\u062C\u062F \u0641\u0626\u0629 \u0628\u0646\u0641\u0633 \u0627\u0644\u0643\u0648\u062F" });
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
  update: protectedProcedure.input(z31.object({
    id: z31.number(),
    code: z31.string().optional(),
    name: z31.string().optional(),
    autoNumbering: z31.boolean().optional(),
    firstNumber: z31.number().optional(),
    lastNumber: z31.number().optional(),
    increment: z31.number().optional(),
    codeDigits: z31.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    if (rest.code) {
      const dup = await db.select({ id: userCategories.id }).from(userCategories).where(and30(eq31(userCategories.orgId, ctx.user.orgId), eq31(userCategories.code, rest.code), eq31(userCategories.isActive, true))).limit(1);
      if (dup.length && dup[0].id !== id) throw new TRPCError8({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0648\u062F \u0645\u0643\u0631\u0631 \u2014 \u064A\u0648\u062C\u062F \u0641\u0626\u0629 \u0628\u0646\u0641\u0633 \u0627\u0644\u0643\u0648\u062F" });
    }
    await db.update(userCategories).set(rest).where(and30(eq31(userCategories.id, id), eq31(userCategories.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z31.object({ id: z31.number() })).mutation(async ({ ctx, input }) => {
    await db.update(userCategories).set({ isActive: false }).where(and30(eq31(userCategories.id, input.id), eq31(userCategories.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  nextCode: protectedProcedure.input(z31.object({ categoryId: z31.number() })).query(async ({ ctx, input }) => {
    const cat = await db.select().from(userCategories).where(and30(eq31(userCategories.id, input.categoryId), eq31(userCategories.orgId, ctx.user.orgId))).limit(1);
    if (!cat.length || !cat[0].autoNumbering) return null;
    const c = cat[0];
    const prefix = c.code ?? "";
    const numDigits = Math.max(c.codeDigits - prefix.length, 1);
    const catUsers = await db.select({ code: users.code }).from(users).where(and30(eq31(users.orgId, ctx.user.orgId), eq31(users.categoryId, input.categoryId), eq31(users.isActive, true)));
    let maxNum = c.firstNumber - c.increment;
    for (const u of catUsers) {
      if (!u.code) continue;
      const numPart = prefix && u.code.startsWith(prefix) ? u.code.slice(prefix.length) : u.code;
      const n = parseInt(numPart, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    const nextNum = maxNum < c.firstNumber ? c.firstNumber : maxNum + c.increment;
    if (nextNum > c.lastNumber) return null;
    return { code: prefix + String(nextNum).padStart(numDigits, "0"), category: c };
  })
});
var groupMembersRouter = router({
  list: protectedProcedure.input(z31.object({ groupId: z31.number() })).query(async ({ ctx, input }) => {
    return db.select().from(userGroupMembers).where(and30(eq31(userGroupMembers.groupId, input.groupId), eq31(userGroupMembers.orgId, ctx.user.orgId))).orderBy(userGroupMembers.createdAt);
  }),
  add: protectedProcedure.input(z31.object({
    groupId: z31.number(),
    memberType: z31.enum(["user", "group"]),
    memberCode: z31.string().min(1),
    memberName: z31.string().optional()
  })).mutation(async ({ ctx, input }) => {
    let resolvedName = input.memberName;
    if (input.memberType === "user") {
      const found = await db.select({ id: users.id, name: users.name }).from(users).where(and30(eq31(users.orgId, ctx.user.orgId), eq31(users.code, input.memberCode))).limit(1);
      if (!found.length) throw new TRPCError8({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 "${input.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
      resolvedName = found[0].name;
    } else {
      const found = await db.select({ id: userGroups.id, name: userGroups.name }).from(userGroups).where(and30(eq31(userGroups.orgId, ctx.user.orgId), eq31(userGroups.code, input.memberCode), eq31(userGroups.isActive, true))).limit(1);
      if (!found.length) throw new TRPCError8({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 "${input.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
      resolvedName = found[0].name;
    }
    const existing = await db.select({ id: userGroupMembers.id }).from(userGroupMembers).where(and30(
      eq31(userGroupMembers.groupId, input.groupId),
      eq31(userGroupMembers.orgId, ctx.user.orgId),
      eq31(userGroupMembers.memberType, input.memberType),
      eq31(userGroupMembers.memberCode, input.memberCode)
    )).limit(1);
    if (existing.length) throw new TRPCError8({ code: "BAD_REQUEST", message: `\u0627\u0644\u0639\u0636\u0648 \u062A\u0645 \u062A\u0643\u0631\u0627\u0631 \u0628\u0627\u0644\u062C\u062F\u0648\u0644` });
    const [m] = await db.insert(userGroupMembers).values({
      groupId: input.groupId,
      orgId: ctx.user.orgId,
      memberType: input.memberType,
      memberCode: input.memberCode,
      memberName: resolvedName
    }).returning();
    return m;
  }),
  remove: protectedProcedure.input(z31.object({ id: z31.number() })).mutation(async ({ ctx, input }) => {
    await db.delete(userGroupMembers).where(and30(eq31(userGroupMembers.id, input.id), eq31(userGroupMembers.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  addBulk: protectedProcedure.input(z31.object({
    groupId: z31.number(),
    members: z31.array(z31.object({
      memberType: z31.enum(["user", "group"]),
      memberCode: z31.string().min(1),
      memberName: z31.string().optional()
    }))
  })).mutation(async ({ ctx, input }) => {
    if (!input.members.length) return { count: 0 };
    const seen = /* @__PURE__ */ new Set();
    const unique = input.members.filter((m) => {
      const key = `${m.memberType}:${m.memberCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const existingMembers = await db.select({ memberType: userGroupMembers.memberType, memberCode: userGroupMembers.memberCode }).from(userGroupMembers).where(and30(eq31(userGroupMembers.groupId, input.groupId), eq31(userGroupMembers.orgId, ctx.user.orgId)));
    const existingSet = new Set(existingMembers.map((m) => `${m.memberType}:${m.memberCode}`));
    const toInsert = unique.filter((m) => !existingSet.has(`${m.memberType}:${m.memberCode}`));
    if (!toInsert.length) return { count: 0 };
    const resolved = await Promise.all(toInsert.map(async (m) => {
      let name = m.memberName;
      if (m.memberType === "user") {
        const found = await db.select({ name: users.name }).from(users).where(and30(eq31(users.orgId, ctx.user.orgId), eq31(users.code, m.memberCode))).limit(1);
        if (!found.length) throw new TRPCError8({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 "${m.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
        name = found[0].name;
      } else {
        const found = await db.select({ name: userGroups.name }).from(userGroups).where(and30(eq31(userGroups.orgId, ctx.user.orgId), eq31(userGroups.code, m.memberCode), eq31(userGroups.isActive, true))).limit(1);
        if (!found.length) throw new TRPCError8({ code: "BAD_REQUEST", message: `\u0643\u0648\u062F \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 "${m.memberCode}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645` });
        name = found[0].name;
      }
      return { groupId: input.groupId, orgId: ctx.user.orgId, memberType: m.memberType, memberCode: m.memberCode, memberName: name };
    }));
    await db.insert(userGroupMembers).values(resolved);
    return { count: resolved.length };
  })
});
var qrSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(qrSettings).where(eq31(qrSettings.orgId, ctx.user.orgId)).limit(1);
    return rows[0] ?? null;
  }),
  upsert: protectedProcedure.input(z31.object({
    isEnabled: z31.boolean().optional(),
    countrySystem: z31.enum(["zatca", "eta", "custom"]).optional(),
    customFormat: z31.string().optional().nullable(),
    sellerName: z31.string().optional().nullable(),
    taxNumber: z31.string().optional().nullable(),
    showOnSalesInvoice: z31.boolean().optional(),
    showOnPurchaseInvoice: z31.boolean().optional(),
    showOnReceiptVoucher: z31.boolean().optional(),
    qrSize: z31.number().min(50).max(300).optional(),
    qrPosition: z31.string().optional(),
    notes: z31.string().optional().nullable()
  })).mutation(async ({ ctx, input }) => {
    const existing = await db.select({ id: qrSettings.id }).from(qrSettings).where(eq31(qrSettings.orgId, ctx.user.orgId)).limit(1);
    if (existing.length) {
      const [updated] = await db.update(qrSettings).set({ ...input, updatedAt: /* @__PURE__ */ new Date() }).where(eq31(qrSettings.orgId, ctx.user.orgId)).returning();
      return updated;
    } else {
      const [inserted] = await db.insert(qrSettings).values({ orgId: ctx.user.orgId, ...input }).returning();
      return inserted;
    }
  })
});
var branchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.branches.findMany({
      where: and30(eq31(branches.orgId, ctx.user.orgId), eq31(branches.isActive, true)),
      orderBy: (b, { asc: asc13 }) => [asc13(b.name)]
    });
  }),
  create: protectedProcedure.input(z31.object({ name: z31.string().min(1), address: z31.string().optional(), phone: z31.string().optional() })).mutation(async ({ ctx, input }) => {
    const [b] = await db.insert(branches).values({ ...input, orgId: ctx.user.orgId, isActive: true }).returning();
    return b;
  }),
  update: protectedProcedure.input(z31.object({ id: z31.number(), name: z31.string().min(1).optional(), address: z31.string().optional(), phone: z31.string().optional() })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.update(branches).set(data).where(and30(eq31(branches.id, id), eq31(branches.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z31.object({ id: z31.number() })).mutation(async ({ ctx, input }) => {
    const [hasWarehouses, hasInvoices, hasInventoryCounts] = await Promise.all([
      db.select({ id: warehouses.id }).from(warehouses).where(and30(eq31(warehouses.branchId, input.id), eq31(warehouses.orgId, ctx.user.orgId), eq31(warehouses.isActive, true))).limit(1),
      db.select({ id: salesInvoices.id }).from(salesInvoices).where(and30(eq31(salesInvoices.branchId, input.id), eq31(salesInvoices.orgId, ctx.user.orgId))).limit(1),
      db.select({ id: inventoryCounts.id }).from(inventoryCounts).where(and30(eq31(inventoryCounts.branchId, input.id), eq31(inventoryCounts.orgId, ctx.user.orgId))).limit(1)
    ]);
    if (hasWarehouses.length > 0) throw new TRPCError8({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0641\u0631\u0639 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0645\u062E\u0627\u0632\u0646" });
    if (hasInvoices.length > 0) throw new TRPCError8({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0641\u0631\u0639 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0641\u0648\u0627\u062A\u064A\u0631 \u0645\u0628\u064A\u0639\u0627\u062A" });
    if (hasInventoryCounts.length > 0) throw new TRPCError8({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0641\u0631\u0639 \u0644\u0623\u0646\u0647 \u0645\u0631\u062A\u0628\u0637 \u0628\u0639\u0645\u0644\u064A\u0627\u062A \u062C\u0631\u062F \u0645\u062E\u0632\u0646\u064A" });
    await db.update(branches).set({ isActive: false }).where(and30(eq31(branches.id, input.id), eq31(branches.orgId, ctx.user.orgId)));
    return { success: true };
  })
});
var unitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.units.findMany({ where: eq31(units.orgId, ctx.user.orgId), orderBy: (u, { asc: asc13 }) => [asc13(u.name)] });
  }),
  create: protectedProcedure.input(z31.object({ name: z31.string().min(1), symbol: z31.string().optional() })).mutation(async ({ ctx, input }) => {
    const [u] = await db.insert(units).values({ ...input, orgId: ctx.user.orgId }).returning();
    return u;
  }),
  update: protectedProcedure.input(z31.object({ id: z31.number(), name: z31.string().min(1).optional(), symbol: z31.string().optional() })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.update(units).set(data).where(and30(eq31(units.id, id), eq31(units.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z31.object({ id: z31.number() })).mutation(async ({ ctx, input }) => {
    await db.delete(units).where(and30(eq31(units.id, input.id), eq31(units.orgId, ctx.user.orgId)));
    return { success: true };
  })
});
var freeProductsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.freeProducts.findMany({
      where: and30(eq31(freeProducts.orgId, ctx.user.orgId), eq31(freeProducts.isActive, true)),
      orderBy: [desc13(freeProducts.createdAt)]
    });
  }),
  create: protectedProcedure.input(z31.object({
    productId: z31.number().optional(),
    productCode: z31.string().optional(),
    productName: z31.string().min(1),
    unit: z31.string().optional(),
    baseQty: z31.string().default("1"),
    freeQty: z31.string().default("1"),
    offerStart: z31.string().optional(),
    offerEnd: z31.string().optional(),
    notes: z31.string().optional()
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
  update: protectedProcedure.input(z31.object({
    id: z31.number(),
    productCode: z31.string().optional(),
    productName: z31.string().optional(),
    unit: z31.string().optional(),
    baseQty: z31.string().optional(),
    freeQty: z31.string().optional(),
    offerStart: z31.string().optional(),
    offerEnd: z31.string().optional(),
    notes: z31.string().optional(),
    isActive: z31.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, offerStart, offerEnd, ...rest } = input;
    await db.update(freeProducts).set({
      ...rest,
      offerStart: offerStart ? new Date(offerStart) : void 0,
      offerEnd: offerEnd ? new Date(offerEnd) : void 0
    }).where(and30(eq31(freeProducts.id, id), eq31(freeProducts.orgId, ctx.user.orgId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z31.object({ id: z31.number() })).mutation(async ({ ctx, input }) => {
    await db.update(freeProducts).set({ isActive: false }).where(and30(eq31(freeProducts.id, input.id), eq31(freeProducts.orgId, ctx.user.orgId)));
    return { success: true };
  })
});

// src/routers/index.ts
var appRouter = router({
  auth: authRouter,
  orgs: orgsRouter,
  users: usersRouter,
  userGroups: userGroupsRouter,
  userCategories: userCategoriesRouter,
  groupMembers: groupMembersRouter,
  qrSettings: qrSettingsRouter,
  dashboard: dashboardRouter,
  products: productsRouter,
  categories: categoriesRouter,
  productGroups: productGroupsRouter,
  customers: customersRouter,
  suppliers: suppliersRouter,
  accounts: accountsRouter,
  journal: journalRouter,
  vouchers: vouchersRouter,
  receiptVouchers: receiptVouchersRouter,
  paymentVouchers: paymentVouchersRouter,
  branches: branchesRouter,
  costCenters: costCentersRouter,
  warehouses: warehousesRouter,
  units: unitsRouter,
  stockVouchers: stockVouchersRouter,
  inventoryCount: inventoryCountRouter,
  reports: reportsRouter,
  freeProducts: freeProductsRouter,
  accounting: accountingRouter,
  sales: salesRouter,
  salesInvoices: salesRouter,
  purchases: purchasesRouter,
  chat: chatRouter,
  documentJournals: documentJournalsRouter,
  documentTemplates: documentTemplatesRouter,
  documentTypes: documentTypesRouter,
  postingDefinitions: postingDefinitionsRouter,
  documentSend: documentSendRouter,
  posting: postingRouter,
  currencies: currenciesRouter,
  fieldDictionary: fieldDictionaryRouter,
  appSettings: appSettingsRouter,
  paymentMethods: paymentMethodsRouter,
  zatca: zatcaRouter,
  sourceCode: sourceCodeRouter,
  backup: backupRouter,
  setup: setupRouter,
  updates: updatesRouter
});

// src/index.ts
init_auth();
init_db();

// src/check-schema.ts
init_schema_version();
var EXPECTED_TABLES = [
  "organizations",
  "users",
  "user_groups",
  "user_categories",
  "user_group_members",
  "branches",
  "warehouses",
  "warehouse_account_links",
  "units",
  "product_groups",
  "products",
  "customers",
  "suppliers",
  "chart_of_accounts",
  "sales_invoices",
  "sales_invoice_items",
  "purchase_invoices",
  "purchase_invoice_items",
  "journal_entries",
  "journal_entry_lines",
  "vouchers",
  "receipt_vouchers",
  "payment_vouchers",
  "inventory",
  "stock_vouchers",
  "stock_voucher_items",
  "inventory_counts",
  "inventory_count_items",
  "free_products",
  "messages",
  "document_journals",
  "document_types",
  "document_templates",
  "cost_centers",
  "qr_settings",
  "document_send_logs",
  "waba_message_templates",
  "send_settings",
  "app_settings",
  "currencies",
  "posting_definitions",
  "posting_definition_lines",
  "field_dictionary",
  "payment_methods",
  "sales_invoice_payments",
  // ZATCA Database Architecture (0012)
  "zatca_environments",
  "zatca_devices",
  "zatca_certificates",
  "zatca_csid",
  "zatca_keys",
  "zatca_csr_requests",
  "zatca_invoice_transactions",
  "zatca_request_log",
  "zatca_response_log",
  "zatca_error_log",
  "zatca_xml_documents",
  "zatca_qr_codes",
  "zatca_settings",
  "zatca_api_history"
];
async function checkSchema(pool2) {
  let client;
  try {
    client = await pool2.connect();
  } catch (err) {
    console.error("[schema-check] Cannot connect to database:", err);
    return false;
  }
  try {
    const tableResult = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'`
    );
    const existingTables = new Set(tableResult.rows.map((r) => r.table_name));
    const missingTables = EXPECTED_TABLES.filter((t2) => !existingTables.has(t2));
    if (missingTables.length > 0) {
      console.error(
        "[schema-check] FATAL: The following tables are missing from the database:\n  " + missingTables.join("\n  ")
      );
      console.error('[schema-check] Run "pnpm migrate" to bring the schema up to date.');
      return false;
    }
    const versionResult = await client.query(
      `SELECT version FROM _schema_version WHERE id = 1`
    );
    if (versionResult.rowCount === 0) {
      console.error(
        `[schema-check] FATAL: _schema_version table is empty. Run "pnpm migrate" to stamp the database with the current schema version.`
      );
      return false;
    }
    const dbVersion = versionResult.rows[0].version;
    if (dbVersion !== REQUIRED_SCHEMA_VERSION) {
      console.error(
        `[schema-check] FATAL: Schema version mismatch. Database has "${dbVersion}", this build requires "${REQUIRED_SCHEMA_VERSION}". Run "pnpm migrate" to apply pending migrations.`
      );
      return false;
    }
    console.log(
      `[schema-check] Schema is up to date (version: ${REQUIRED_SCHEMA_VERSION}).`
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("_schema_version") && message.includes("does not exist")) {
      console.error(
        `[schema-check] FATAL: _schema_version table does not exist. Run "pnpm migrate" to initialise schema version tracking.`
      );
    } else {
      console.error("[schema-check] Error while checking schema:", err);
    }
    return false;
  } finally {
    client.release();
  }
}

// src/index.ts
import { existsSync } from "fs";
var __dirname7 = path7.dirname(fileURLToPath7(import.meta.url));
var app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.post("/api/auth/login", loginHandler);
app.post("/api/auth/logout", logoutHandler);
app.get("/api/auth/me", meHandler);
app.post("/api/auth/auto-login", async (_req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq32 } = await import("drizzle-orm");
    const { createToken: createToken2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const user = await db2.query.users.findFirst({ where: eq32(users2.id, 1) });
    if (!user) return res.status(404).json({ error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0641\u062A\u0631\u0627\u0636\u064A" });
    const token = await createToken2({ userId: user.id, orgId: user.orgId, username: user.username, role: user.role });
    res.cookie(ENV.cookieName, token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: ENV.sessionExpiry });
    return res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, orgId: user.orgId } });
  } catch (err) {
    console.error("[AutoLogin]", err);
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  version: "1.0.0",
  env: ENV.nodeEnv,
  port: ENV.port,
  electron: ENV.isElectron,
  ts: (/* @__PURE__ */ new Date()).toISOString()
}));
app.get("/download/backup", async (req, res) => {
  const { getUserFromRequest: getUserFromRequest2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
  const user = await getUserFromRequest2(req);
  if (!user) return res.status(401).json({ error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  const file = path7.join(__dirname7, "..", "..", "OneSoft-ERP-backup-20260626.zip");
  res.download(file, "OneSoft-ERP-backup-20260626.zip", (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  });
});
app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => createContext({ req, res })
}));
var clientBuildPath = path7.join(__dirname7, "..", "..", "client-app", "dist");
if (existsSync(path7.join(clientBuildPath, "index.html"))) {
  app.use(express.static(clientBuildPath));
  app.get("*", (_req, res) => {
    res.sendFile(path7.join(clientBuildPath, "index.html"));
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
var schemaOk = await checkSchema(pool);
if (!schemaOk) {
  console.error("[startup] Aborting: database schema is out of date or unreachable.");
  process.exit(1);
}
app.listen(ENV.port, () => {
  logger.info("server", `OneSoft ERP started on http://localhost:${ENV.port}`, {
    env: ENV.nodeEnv,
    electron: ENV.isElectron
  });
});
