import DocumentInvoicePage from "./DocumentInvoicePage";

export default function PurchaseReturnPage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "مردود المشتريات",
      docCategory: "purchase",
      invoiceType: "return",
      journalDocType: "purchase_return",
      docTypeFilter: "purchases",
      partyLabel: "المورد",
      numberPrefix: "PRN",
      journalDropdownTitle: "دفاتر مردود المشتريات",
      canPost: false,
      themeColor: "#C0392B",
    }} />
  );
}
