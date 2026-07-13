import { router } from '../trpc.js';

// ─── Routers ──────────────────────────────────────────────────────────────────
import { orgsRouter }               from './orgs.js';
import { usersRouter }              from './users.js';
import { salesRouter }              from './sales.js';
import { purchasesRouter }          from './purchases.js';
import { chatRouter }               from './chat.js';
import { documentJournalsRouter }   from './documentJournals.js';
import { documentTemplatesRouter }  from './documentTemplates.js';
import { postingDefinitionsRouter } from './postingDefinitions.js';
import { documentTypesRouter }      from './documentTypes.js';
import { documentSendRouter }       from './documentSend.js';
import { postingRouter }            from './posting.js';
import { currenciesRouter }         from './currencies.js';
import { fieldDictionaryRouter }    from './fieldDictionary.js';
import { appSettingsRouter }        from './appSettings.js';
import { uiPrefsRouter }            from './uiPrefs.js';
import { paymentMethodsRouter }     from './paymentMethods.js';
import { zatcaRouter }              from './zatca.js';
import { sourceCodeRouter }         from './sourceCode.js';
import { backupRouter }             from './backup.js';
import { setupRouter }              from './setup.js';
import { updatesRouter }            from './updates.js';
import { brandingRouter }           from './branding.js';
import { licenseRouter }            from './license.js';
import { aiRouter }                 from './ai.js';
import { supportTicketsRouter }     from './supportTickets.js';
import { custodyTrackingRouter }    from './custodyTracking.js';
import { licenseCenterRouter }      from './licenseCenter.js';
import { authRouter }               from './auth.js';
import { recoveryRouter }           from './recovery.js';
import { customersRouter }          from './customers.js';
import { suppliersRouter }          from './suppliers.js';
import { productsRouter, categoriesRouter, productGroupsRouter } from './products.js';
import { accountsRouter, costCentersRouter }                     from './accounts.js';
import { journalRouter }            from './journal.js';
import { warehousesRouter }         from './warehouses.js';
import { stockVouchersRouter, inventoryCountRouter }             from './inventory.js';
import { dashboardRouter }          from './dashboard.js';
import { reportsRouter }            from './reports.js';
import { vouchersRouter, receiptVouchersRouter, paymentVouchersRouter } from './vouchers.js';
import { accountingRouter }         from './accounting.js';
import {
  userGroupsRouter, userCategoriesRouter, groupMembersRouter,
  qrSettingsRouter, branchesRouter, unitsRouter, freeProductsRouter,
} from './settings.js';

// ─── Build mode ───────────────────────────────────────────────────────────────
//
//  CLIENT_BUILD=true  → نسخة العميل (Installer)
//    • licenseCenter router مُستثنى تماماً من appRouter
//    • /api/trpc/licenseCenter.* يُرجع 404 على مستوى HTTP
//    • ownerOnlyProcedure أيضاً يُرجع NOT_FOUND كطبقة ثانية
//
//  (بدون CLIENT_BUILD)  → بيئة المالك / License Center
//    • licenseCenter router مُضمَّن
//    • ownerOnlyProcedure يتحقق من دور superadmin
//
const IS_CLIENT_BUILD = process.env.CLIENT_BUILD === 'true';

// ─── Base config (مشترك بين النسختين) ───────────────────────────────────────
const baseConfig = {
  auth:                authRouter,
  recovery:            recoveryRouter,
  orgs:                orgsRouter,
  users:               usersRouter,
  userGroups:          userGroupsRouter,
  userCategories:      userCategoriesRouter,
  groupMembers:        groupMembersRouter,
  qrSettings:          qrSettingsRouter,
  dashboard:           dashboardRouter,
  products:            productsRouter,
  categories:          categoriesRouter,
  productGroups:       productGroupsRouter,
  customers:           customersRouter,
  suppliers:           suppliersRouter,
  accounts:            accountsRouter,
  journal:             journalRouter,
  vouchers:            vouchersRouter,
  receiptVouchers:     receiptVouchersRouter,
  paymentVouchers:     paymentVouchersRouter,
  branches:            branchesRouter,
  costCenters:         costCentersRouter,
  warehouses:          warehousesRouter,
  units:               unitsRouter,
  stockVouchers:       stockVouchersRouter,
  inventoryCount:      inventoryCountRouter,
  reports:             reportsRouter,
  freeProducts:        freeProductsRouter,
  accounting:          accountingRouter,
  sales:               salesRouter,
  salesInvoices:       salesRouter,
  purchases:           purchasesRouter,
  chat:                chatRouter,
  documentJournals:    documentJournalsRouter,
  documentTemplates:   documentTemplatesRouter,
  documentTypes:       documentTypesRouter,
  postingDefinitions:  postingDefinitionsRouter,
  documentSend:        documentSendRouter,
  posting:             postingRouter,
  currencies:          currenciesRouter,
  fieldDictionary:     fieldDictionaryRouter,
  appSettings:         appSettingsRouter,
  uiPrefs:             uiPrefsRouter,
  paymentMethods:      paymentMethodsRouter,
  zatca:               zatcaRouter,
  sourceCode:          sourceCodeRouter,
  backup:              backupRouter,
  setup:               setupRouter,
  updates:             updatesRouter,
  branding:            brandingRouter,
  license:             licenseRouter,
  ai:                  aiRouter,
  supportTickets:      supportTicketsRouter,
  custodyTracking:     custodyTrackingRouter,
};

// ─── Full config (يشمل licenseCenter — للمالك فقط) ──────────────────────────
const fullConfig = {
  ...baseConfig,
  licenseCenter: licenseCenterRouter,
};

// ─── Runtime router ───────────────────────────────────────────────────────────
// نسخة العميل: لا تحتوي على licenseCenter إطلاقاً
// نسخة المالك: تحتوي على licenseCenter (محمي بـ ownerOnlyProcedure)
export const appRouter = IS_CLIENT_BUILD
  ? router(baseConfig)
  : router(fullConfig);

// ─── Type export ──────────────────────────────────────────────────────────────
// IMPORTANT: _typeOnlyFullRouter must NOT call router(fullConfig) in CLIENT_BUILD.
// In CLIENT_BUILD, the CI pipeline replaces licenseCenter.js with a null stub,
// so router({licenseCenter: null}) would crash at server startup.
//
// • Owner build (IS_CLIENT_BUILD=false): uses fullConfig → AppRouter includes licenseCenter
//   → license-center-app can use tRPC types correctly.
// • Client build (IS_CLIENT_BUILD=true): uses baseConfig → no null crash.
//   license-center-app is never built in CLIENT_BUILD, so type omission is safe.
const _typeOnlyFullRouter = IS_CLIENT_BUILD ? router(baseConfig) : router(fullConfig);
export type AppRouter = typeof _typeOnlyFullRouter;
