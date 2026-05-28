import DocumentInvoicePage from "./DocumentInvoicePage";

export default function PurchaseOrderPage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "أوامر الشراء",
      docCategory: "purchase",
      invoiceType: "order",
      journalDocType: "purchase_order",
      docTypeFilter: "purchases",
      partyLabel: "المورد",
      numberPrefix: "POD",
      journalDropdownTitle: "دفاتر أوامر الشراء",
      canPost: false,
      themeColor: "#1565C0",
    }} />
  );
}
