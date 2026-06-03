/**
 * InvoicePrintModal.tsx — نافذة معاينة وطباعة فاتورة المبيعات مع QR Code
 */
import { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import QRCodeDisplay from "./QRCodeDisplay";
import { generateQrContent, type QrSettings, type QrInvoiceData } from "@/lib/qrUtils";

export interface PrintInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime?: string;
  customerName: string;
  customerCode?: string;
  customerTaxNumber?: string;
  salesperson?: string;
  paymentType: "cash" | "credit";
  currency: string;
  notes?: string;
  lines: {
    productCode: string;
    productName: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPct: string;
    taxPct: string;
    taxAmt: string;
    total: string;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  sellerName: string;
  sellerTaxNumber: string;
  sellerAddress?: string;
  sellerPhone?: string;
}

interface InvoicePrintModalProps {
  open: boolean;
  onClose: () => void;
  data: PrintInvoiceData;
  qrSettings?: QrSettings | null;
}

export default function InvoicePrintModal({ open, onClose, data, qrSettings }: InvoicePrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const showQR =
    qrSettings?.isEnabled &&
    qrSettings?.showOnSalesInvoice;

  const qrInvoiceData: QrInvoiceData = {
    sellerName: qrSettings?.sellerName || data.sellerName,
    taxNumber: qrSettings?.taxNumber || data.sellerTaxNumber,
    invoiceDateTime: `${data.invoiceDate}T${data.invoiceTime ?? "00:00:00"}`,
    totalAmount: data.grandTotal,
    vatAmount: data.taxTotal,
    invoiceNumber: data.invoiceNumber,
    buyerName: data.customerName,
    buyerTaxNumber: data.customerTaxNumber,
  };

  const qrContent = showQR
    ? generateQrContent(
        qrSettings!.countrySystem,
        qrInvoiceData,
        qrSettings?.customFormat
      )
    : "";

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8"/>
<title>فاتورة ${data.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Tahoma', 'Arial', sans-serif; font-size: 11px; color: #000; background: #fff; direction: rtl; }
  .inv-wrap { padding: 16px; max-width: 780px; margin: auto; }
  .inv-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #406B93; padding-bottom: 10px; margin-bottom: 10px; }
  .inv-company { flex: 1; }
  .inv-company h1 { font-size: 18px; color: #406B93; font-weight: bold; }
  .inv-company p { font-size: 10px; color: #555; margin-top: 2px; }
  .inv-title { text-align: center; flex: 1; }
  .inv-title h2 { font-size: 20px; font-weight: bold; color: #222; }
  .inv-title .inv-no { font-size: 14px; color: #406B93; font-weight: bold; margin-top: 4px; }
  .inv-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin-bottom: 10px; font-size: 10px; }
  .meta-row { display: flex; gap: 4px; }
  .meta-label { color: #555; min-width: 80px; }
  .meta-val { font-weight: bold; color: #222; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
  th { background: #406B93; color: #fff; padding: 5px 4px; text-align: center; font-size: 10px; }
  td { padding: 4px; border: 1px solid #e0e0e0; text-align: center; }
  tr:nth-child(even) td { background: #f9fafc; }
  .totals-wrap { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8px; }
  .totals-table { width: 260px; border: 1px solid #ddd; }
  .totals-table td { padding: 4px 8px; font-size: 11px; }
  .totals-table .lbl { color: #555; text-align: right; }
  .totals-table .val { font-weight: bold; text-align: left; }
  .grand-row td { background: #406B93; color: #fff; font-size: 13px; font-weight: bold; }
  .qr-section { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .qr-label { font-size: 9px; color: #888; text-align: center; }
  .notes-section { border: 1px solid #eee; border-radius: 4px; padding: 6px 10px; margin-top: 8px; font-size: 10px; color: #555; }
  .footer { text-align: center; margin-top: 16px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 6px; }
  @media print { body { margin: 0; } .inv-wrap { padding: 8px; } }
</style>
</head>
<body>
<div class="inv-wrap">${printContent}</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0" dir="rtl">
        {/* شريط الأدوات */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-[#406B93]">
          <span className="text-white font-bold text-sm">معاينة الطباعة — فاتورة {data.invoiceNumber}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="bg-white text-[#406B93] hover:bg-gray-100 h-7 px-3 text-xs font-bold">
              <Printer className="w-3.5 h-3.5 ml-1" />طباعة
            </Button>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* محتوى الطباعة */}
        <div className="p-4 bg-gray-50">
          <div
            ref={printRef}
            className="bg-white shadow-md rounded border border-gray-200 p-5 max-w-[780px] mx-auto text-[11px]"
            style={{ fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl" }}
          >
            {/* رأس الفاتورة */}
            <div className="flex justify-between items-start border-b-2 border-[#406B93] pb-3 mb-3">
              <div className="flex-1">
                <h1 className="text-lg font-bold text-[#406B93]">{data.sellerName}</h1>
                {data.sellerAddress && <p className="text-[10px] text-gray-500 mt-0.5">{data.sellerAddress}</p>}
                {data.sellerPhone && <p className="text-[10px] text-gray-500">{data.sellerPhone}</p>}
                {data.sellerTaxNumber && <p className="text-[10px] text-gray-500">الرقم الضريبي: {data.sellerTaxNumber}</p>}
              </div>
              <div className="text-center flex-1">
                <h2 className="text-xl font-bold text-gray-800">فاتورة ضريبية</h2>
                <div className="text-sm font-bold text-[#406B93] mt-1">#{data.invoiceNumber}</div>
              </div>
              <div className="flex-1 flex flex-col items-end">
                {showQR && qrContent && (
                  <div className="flex flex-col items-center gap-1">
                    <QRCodeDisplay content={qrContent} size={qrSettings?.qrSize ?? 100} />
                    <span className="text-[8px] text-gray-400">
                      {qrSettings?.countrySystem === 'zatca' ? 'ZATCA QR' :
                       qrSettings?.countrySystem === 'eta' ? 'ETA QR' : 'QR Code'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* بيانات الفاتورة */}
            <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded p-2 mb-3 text-[10px]">
              <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">العميل:</span><span className="font-bold">{data.customerName}</span></div>
              <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">التاريخ:</span><span className="font-bold">{data.invoiceDate}</span></div>
              {data.customerCode && <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">كود العميل:</span><span className="font-bold">{data.customerCode}</span></div>}
              {data.customerTaxNumber && <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">رقم ضريبي:</span><span className="font-bold">{data.customerTaxNumber}</span></div>}
              <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">نوع الدفع:</span><span className="font-bold">{data.paymentType === 'cash' ? 'نقداً' : 'آجل'}</span></div>
              <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">العملة:</span><span className="font-bold">{data.currency}</span></div>
              {data.salesperson && <div className="flex gap-1"><span className="text-gray-500 min-w-[80px]">مندوب المبيعات:</span><span className="font-bold">{data.salesperson}</span></div>}
            </div>

            {/* جدول الأصناف */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", marginBottom: "8px" }}>
              <thead>
                <tr style={{ background: "#406B93", color: "#fff" }}>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>#</th>
                  <th style={{ padding: "5px 4px", textAlign: "right" }}>الصنف</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>الكمية</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>الوحدة</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>سعر الوحدة</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>خصم%</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>ضريبة%</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>ضريبة</th>
                  <th style={{ padding: "5px 4px", textAlign: "center" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((ln, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafc" }}>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "right" }}>
                      {ln.productCode && <span style={{ color: "#406B93", fontWeight: 600, marginLeft: 4 }}>{ln.productCode}</span>}
                      {ln.productName}
                    </td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{ln.quantity}</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{ln.unit}</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{ln.unitPrice}</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{ln.discountPct}%</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{ln.taxPct}%</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center" }}>{ln.taxAmt}</td>
                    <td style={{ padding: "4px", border: "1px solid #e0e0e0", textAlign: "center", fontWeight: 600 }}>{ln.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* الإجماليات */}
            <div className="flex justify-between items-end mt-2">
              {/* ملاحظات */}
              <div className="flex-1">
                {data.notes && (
                  <div className="border border-gray-200 rounded p-2 text-[10px] text-gray-600 max-w-xs">
                    <span className="font-bold text-gray-700">ملاحظات: </span>{data.notes}
                  </div>
                )}
              </div>

              {/* جدول الإجماليات */}
              <table style={{ width: 260, border: "1px solid #ddd", fontSize: "11px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 8px", color: "#555", textAlign: "right" }}>المجموع قبل الخصم</td>
                    <td style={{ padding: "4px 8px", fontWeight: 600, textAlign: "left" }}>{data.subtotal.toFixed(3)} {data.currency}</td>
                  </tr>
                  {data.discountTotal > 0 && (
                    <tr>
                      <td style={{ padding: "4px 8px", color: "#555", textAlign: "right" }}>إجمالي الخصم</td>
                      <td style={{ padding: "4px 8px", fontWeight: 600, color: "#dc2626", textAlign: "left" }}>({data.discountTotal.toFixed(3)}) {data.currency}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: "4px 8px", color: "#555", textAlign: "right" }}>الضريبة المضافة</td>
                    <td style={{ padding: "4px 8px", fontWeight: 600, textAlign: "left" }}>{data.taxTotal.toFixed(3)} {data.currency}</td>
                  </tr>
                  <tr style={{ background: "#406B93" }}>
                    <td style={{ padding: "5px 8px", color: "#fff", fontWeight: "bold", fontSize: "13px", textAlign: "right" }}>الإجمالي</td>
                    <td style={{ padding: "5px 8px", color: "#fff", fontWeight: "bold", fontSize: "13px", textAlign: "left" }}>{data.grandTotal.toFixed(3)} {data.currency}</td>
                  </tr>
                  {data.paymentType === 'cash' && (
                    <>
                      <tr>
                        <td style={{ padding: "4px 8px", color: "#555", textAlign: "right" }}>المبلغ المدفوع</td>
                        <td style={{ padding: "4px 8px", fontWeight: 600, color: "#16a34a", textAlign: "left" }}>{data.paidAmount.toFixed(3)} {data.currency}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 8px", color: "#555", textAlign: "right" }}>المتبقي</td>
                        <td style={{ padding: "4px 8px", fontWeight: 600, color: data.remainingAmount > 0 ? "#dc2626" : "#16a34a", textAlign: "left" }}>{data.remainingAmount.toFixed(3)} {data.currency}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* تذييل */}
            <div className="text-center mt-4 pt-2 border-t border-gray-100 text-[9px] text-gray-400">
              تم إنشاء هذه الفاتورة بواسطة OneSoft ERP — {new Date().toLocaleDateString('ar-SA')}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
