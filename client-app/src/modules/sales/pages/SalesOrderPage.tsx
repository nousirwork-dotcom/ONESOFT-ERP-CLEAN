import DocumentInvoicePage from "@/shared/components/DocumentInvoicePage";

export default function SalesOrderPage() {
  return (
    <DocumentInvoicePage config={{
      pageTitle: "أوامر البيع",
      docCategory: "sales",
      invoiceType: "order",
      journalDocType: "sales_order",
      docTypeFilter: "sales",
      partyLabel: "العميل",
      numberPrefix: "ORD",
      journalDropdownTitle: "دفاتر أوامر البيع",
      basedOnOptions: [
        { value: "quote", label: "عرض أسعار" },
      ],
      canPost: false,
      themeColor: "#2E7D32",
    }} />
  );
}
