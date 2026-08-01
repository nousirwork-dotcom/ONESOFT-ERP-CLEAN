import DocumentInvoicePage from "@/shared/components/DocumentInvoicePage";

export default function SalesReturnPage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "مردود المبيعات",
      docCategory: "sales",
      invoiceType: "return",
      journalDocType: "sales_return",
      docTypeFilter: "sales",
      partyLabel: "العميل",
      numberPrefix: "SRN",
      journalDropdownTitle: "دفاتر مردود المبيعات",
      basedOnOptions: [
        { value: "sale", label: "فاتورة مبيعات" },
        { value: "order", label: "أمر بيع" },
      ],
      canPost: true,
      themeColor: "#C0392B",
    }} />
  );
}
