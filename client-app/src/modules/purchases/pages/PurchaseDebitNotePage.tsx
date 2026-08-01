import DocumentInvoicePage from "@/shared/components/DocumentInvoicePage";

export default function PurchaseDebitNotePage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "الإشعار المدين",
      docCategory: "purchase",
      invoiceType: "debit_note",
      journalDocType: "debit_note",
      docTypeFilter: "purchases",
      partyLabel: "المورد",
      numberPrefix: "PDN",
      journalDropdownTitle: "دفاتر الإشعار المدين",
      requireReference: true,
      requireReason: true,
      canPost: true,
      themeColor: "#7C4A03",
    }} />
  );
}