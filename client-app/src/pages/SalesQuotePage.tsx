import DocumentInvoicePage from "./DocumentInvoicePage";

export default function SalesQuotePage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "عروض أسعار المبيعات",
      docCategory: "sales",
      invoiceType: "quote",
      journalDocType: "sales_quote",
      docTypeFilter: "sales",
      partyLabel: "العميل",
      numberPrefix: "QTE",
      journalDropdownTitle: "دفاتر عروض الأسعار",
      canPost: false,
      themeColor: "#B45309",
    }} />
  );
}
