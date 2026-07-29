/**
 * Foundation Template Data
 *
 * AUTO-GENERATED on 2026-07-16T01:30:11.860Z by foundationAdmin.exportTemplate
 * Exported by: superadmin (org: 1)
 *
 * DO NOT EDIT MANUALLY — run "تصدير قالب التأسيس" from the superadmin panel.
 * Total records: 16
 *
 * FK refs (_xxx_fk fields) are embedded for automatic resolution when applying.
 */

export type FoundationRecord = Record<string, unknown> & {
  foundationKey: string;
  recordPolicy: 'protected' | 'editable' | 'flexible';
};

export interface FoundationData {
  documentJournals:   FoundationRecord[];
  documentTypes:      FoundationRecord[];
  branches:           FoundationRecord[];
  warehouses:         FoundationRecord[];
  units:              FoundationRecord[];
  productGroups:      FoundationRecord[];
  paymentMethods:     FoundationRecord[];
  costCenters:        FoundationRecord[];
  currencies:         FoundationRecord[];
  documentTemplates:  FoundationRecord[];
  postingDefinitions: FoundationRecord[];
  exportedAt: string;
  totalRecords: number;
}

export const FOUNDATION_DATA: FoundationData = {
  "documentJournals": [
    {
      "docType": "sales_invoice",
      "code": "inv.02.",
      "name": "فاتورة مبيعات فرع 2",
      "name2": "Sales Invoice Br. 2",
      "description": null,
      "numberPrefix": "inv.02.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": null,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": false,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.sales_invoice.inv.02.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0
    },
    {
      "docType": "suppliers_journal",
      "code": "SU.04.",
      "name": "دفتر موردين فرع4",
      "name2": "Suppliers Book Branch 3",
      "description": null,
      "numberPrefix": "SU.04.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 11,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.suppliers_journal.su.04.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "purchase_invoice",
      "code": "P03.",
      "name": "فاتورة مشــــتريات فرع 3",
      "name2": "Purch. Invoice Br. 3",
      "description": null,
      "numberPrefix": "P03.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": null,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.purchase_invoice.p03.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0
    },
    {
      "docType": "purchase_order",
      "code": "PO.01.",
      "name": "أمـــــــر شــــــراء فرع 1",
      "name2": "Purch. Order Br. 1",
      "description": null,
      "numberPrefix": "PO.01.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": null,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.purchase_order.po.01.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0
    },
    {
      "docType": "purchase_order",
      "code": "PO.02.",
      "name": "أمـــــــر شــــــراء فرع2",
      "name2": "Copy of Purch. Order Br. 2",
      "description": null,
      "numberPrefix": "PO.02.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": null,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.purchase_order.po.02.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0
    },
    {
      "docType": "sales_order",
      "code": "SO.03.",
      "name": "أمــــــر بيــع فرع 3",
      "name2": "Sales Order Br. 3",
      "description": null,
      "numberPrefix": "SO.03.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": null,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.sales_order.so.03.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0
    },
    {
      "docType": "stock_transfer",
      "code": "TR01.",
      "name": "سند تحويل فرع 1",
      "name2": "Stock Transfer Br. 1",
      "description": null,
      "numberPrefix": "TR01.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": false,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_transfer.tr01.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_issue_items",
      "code": "MI01.",
      "name": "صرف يــدوى فرع 1",
      "name2": "Manual Issue Br. 1",
      "description": null,
      "numberPrefix": "MI01.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": null,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_issue_items.mi01.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0
    },
    {
      "docType": "stock_transfer",
      "code": "TR04.",
      "name": "سند تحويل فرع 4",
      "name2": "Stock Transfer Br. 4",
      "description": null,
      "numberPrefix": "TR04.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 13,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_transfer.tr04.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "MR03.",
      "name": "توريد يدوى فرع 3",
      "name2": "Manual Receipt Br. 3",
      "description": null,
      "numberPrefix": "MR03.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.mr03.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "MR02.",
      "name": "توريد يدوى فرع 2",
      "name2": "Manual Receipt Br. 2",
      "description": null,
      "numberPrefix": "MR02.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.mr02.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "MR01.",
      "name": "توريد يدوى فرع 1",
      "name2": "Manual Receipt Br. 1",
      "description": null,
      "numberPrefix": "MR01.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.mr01.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "MR04.",
      "name": "توريد يدوى فرع 4",
      "name2": "Manual Receipt Br. 4",
      "description": null,
      "numberPrefix": "MR04.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.mr04.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "SR02.",
      "name": "توريد نظـام فرع 2",
      "name2": "System Receipt Br. 2",
      "description": null,
      "numberPrefix": "SR02.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.sr02.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "SR03.",
      "name": "توريد نظـام فرع 3",
      "name2": "System Receipt Br. 3",
      "description": null,
      "numberPrefix": "SR03.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.sr03.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    },
    {
      "docType": "stock_receipt_items",
      "code": "SR04.",
      "name": "توريد نظـام فرع 4",
      "name2": "System Receipt Br. 4",
      "description": null,
      "numberPrefix": "SR04.",
      "firstNumber": 1,
      "lastNumber": 999999,
      "increment": 1,
      "numDigits": 6,
      "includeYear": false,
      "currentSeq": 0,
      "warehouseId": 10,
      "branchId": null,
      "salesAccountId": null,
      "cashAccountId": null,
      "creditAccountId": null,
      "taxAccountId": null,
      "discountAccountId": null,
      "purchaseAccountId": null,
      "supplierAccountId": null,
      "inventoryAccountId": null,
      "cogsAccountId": null,
      "defaultCurrency": "SAR",
      "defaultPayMethod": "cash",
      "allowedUserGroup": null,
      "allowedUserId": null,
      "printTemplate": null,
      "printTemplate2": null,
      "resetFrequency": "none",
      "autoSerial": true,
      "printOnSave": false,
      "customersJournal": null,
      "suppliersJournal": null,
      "postingMode": "manual",
      "allowUnpost": true,
      "allowEditAfterPost": false,
      "paymentTypesConfig": {
        "types": [
          {
            "id": "1",
            "codeAr": "نقدا",
            "codeEn": "cash",
            "nameAr": "نقدا",
            "nameEn": "نقدا"
          },
          {
            "id": "2",
            "codeAr": "آجل",
            "codeEn": "cridt",
            "nameAr": "آجل",
            "nameEn": "آجل"
          }
        ],
        "accountLinks": [
          {
            "id": "default-1",
            "accountId": null,
            "description": "الصندوق / النقد",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-2",
            "accountId": null,
            "description": "صافي المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-3",
            "accountId": null,
            "description": "الضريبة (VAT)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-4",
            "accountId": null,
            "description": "السلعة / التكلفة",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-5",
            "accountId": null,
            "description": "ذمم العملاء (آجل)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-6",
            "accountId": null,
            "description": "الخصم الممنوح",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-7",
            "accountId": null,
            "description": "مردود المبيعات",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-8",
            "accountId": null,
            "description": "مصاريف أخرى",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-9",
            "accountId": null,
            "description": "بند إضافي (1)",
            "postingName": "",
            "postingSide": ""
          },
          {
            "id": "default-10",
            "accountId": null,
            "description": "بند إضافي (2)",
            "postingName": "",
            "postingSide": ""
          }
        ]
      },
      "issuanceConfig": null,
      "optionsConfig": {
        "noTax": false,
        "itemStats": false,
        "requireNote": false,
        "showUnitCol": true,
        "colWidthUnit": "12",
        "thermalPrint": false,
        "thermalWidth": "80mm",
        "editItemNames": false,
        "maxUnitsCount": "3",
        "printPageSize": "A4",
        "salesmanStats": false,
        "trackQuantity": false,
        "allowOverdraft": false,
        "autoCalcPrices": false,
        "colWidthAccount": "25",
        "colWidthItemCode": "0",
        "colWidthItemName": "32",
        "editServiceNames": false,
        "returnPeriodDays": "0",
        "showWarehouseCol": true,
        "currentQtyDisplay": "show",
        "usePriceUnitsOnly": false,
        "documentComponents": [],
        "suggestedSalesUnit": "",
        "availableQtyDisplay": "show",
        "preventEditIfLinked": false,
        "requireCustomerCode": false,
        "requireEmployeeCode": false,
        "suggestLastBuyPrice": false,
        "allowForeignCurrency": false,
        "customerSupplierStats": false,
        "preventNegativeInventory": false,
        "suggestLastPurchaseOrder": false
      },
      "notes": null,
      "recordPolicy": "editable",
      "foundationKey": "dj.stock_receipt_items.sr04.",
      "includeInFoundation": true,
      "recordOrigin": "user",
      "foundationTemplateVersion": null,
      "isActive": true,
      "sortOrder": 0,
      "_warehouseId_fk": null
    }
  ],
  "documentTypes": [],
  "branches": [],
  "warehouses": [],
  "units": [],
  "productGroups": [],
  "paymentMethods": [],
  "costCenters": [],
  "currencies": [],
  "documentTemplates": [],
  "postingDefinitions": [],
  "exportedAt": "2026-07-16T01:30:11.860Z",
  "totalRecords": 16
};
