import DocumentInvoicePage from "@/shared/components/DocumentInvoicePage";

export default function SalesCreditNotePage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "الإشعار الدائن",
      docCategory: "sales",
      invoiceType: "credit_note",
      journalDocType: "credit_note",
      docTypeFilter: "sales",
      partyLabel: "العميل",
      numberPrefix: "SCN",
      journalDropdownTitle: "دفاتر الإشعار الدائن",
      basedOnOptions: [{ value: "sale", label: "فاتورة مبيعات أصلية" }],
      requireReference: true,
      requireReason: true,
      canPost: true,
      themeColor: "#8B3A62",
    }} />
  );
}