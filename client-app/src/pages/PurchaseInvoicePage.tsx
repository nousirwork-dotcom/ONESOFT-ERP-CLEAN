import DocumentInvoicePage from "./DocumentInvoicePage";

export default function PurchaseInvoicePage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "فواتير المشتريات",
      docCategory: "purchase",
      invoiceType: "invoice",
      journalDocType: "purchase_invoice",
      docTypeFilter: "purchases",
      partyLabel: "المورد",
      numberPrefix: "PUR",
      journalDropdownTitle: "دفاتر فاتورة المشتريات",
      canPost: false,
      themeColor: "#4A5568",
    }} />
  );
}
