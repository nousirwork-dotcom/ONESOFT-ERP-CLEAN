import { router } from '../trpc.js';

// ─── Existing extracted routers ───────────────────────────────────────────────
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
import { paymentMethodsRouter }     from './paymentMethods.js';
import { zatcaRouter }              from './zatca.js';
import { sourceCodeRouter }         from './sourceCode.js';
import { backupRouter }             from './backup.js';
import { setupRouter }              from './setup.js';
import { updatesRouter }            from './updates.js';
import { brandingRouter }           from './branding.js';
import { licenseRouter }            from './license.js';
import { licenseCenterRouter }     from './licenseCenter.js';

// ─── Newly extracted routers ──────────────────────────────────────────────────
import { authRouter }                                                           from './auth.js';
import { customersRouter }                                                      from './customers.js';
import { suppliersRouter }                                                      from './suppliers.js';
import { productsRouter, categoriesRouter, productGroupsRouter }                from './products.js';
import { accountsRouter, costCentersRouter }                                    from './accounts.js';
import { journalRouter }                                                        from './journal.js';
import { warehousesRouter }                                                     from './warehouses.js';
import { stockVouchersRouter, inventoryCountRouter }                            from './inventory.js';
import { dashboardRouter }                                                      from './dashboard.js';
import { reportsRouter }                                                        from './reports.js';
import { vouchersRouter, receiptVouchersRouter, paymentVouchersRouter }         from './vouchers.js';
import { accountingRouter }                                                     from './accounting.js';
import {
  userGroupsRouter,
  userCategoriesRouter,
  groupMembersRouter,
  qrSettingsRouter,
  branchesRouter,
  unitsRouter,
  freeProductsRouter,
} from './settings.js';

// ─── App Router (pure aggregator) ────────────────────────────────────────────
export const appRouter = router({
  auth:                authRouter,
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
  paymentMethods:      paymentMethodsRouter,
  zatca:               zatcaRouter,
  sourceCode:          sourceCodeRouter,
  backup:              backupRouter,
  setup:               setupRouter,
  updates:             updatesRouter,
  branding:            brandingRouter,
  license:             licenseRouter,
  licenseCenter:       licenseCenterRouter,
});

export type AppRouter = typeof appRouter;
