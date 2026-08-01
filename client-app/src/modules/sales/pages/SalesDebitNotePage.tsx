import DocumentInvoicePage from "@/shared/components/DocumentInvoicePage";

export default function SalesDebitNotePage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "الإشعار المدين",
      docCategory: "sales",
      invoiceType: "debit_note",
      journalDocType: "debit_note",
      docTypeFilter: "sales",
      partyLabel: "العميل",
      numberPrefix: "SDN",
      journalDropdownTitle: "دفاتر الإشعار المدين",
      basedOnOptions: [{ value: "sale", label: "فاتورة مبيعات أصلية" }],
      requireReference: true,
      requireReason: true,
      canPost: true,
      themeColor: "#2F6B57",
    }} />
  );
}