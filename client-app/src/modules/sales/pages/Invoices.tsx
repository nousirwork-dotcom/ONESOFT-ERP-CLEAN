import { fmtDate } from "@/shared/utils/dateUtils";
import { Badge } from "@/core/ui/badge";
import { Card, CardContent } from "@/core/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { trpc } from "@/shared/lib/trpc";
import { ClipboardCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useToolbarActions } from "@/components/unified-toolbar/ToolbarActionsContext";
import { useMemo } from "react";

const paymentLabels: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل", credit: "آجل" };

export default function Invoices() {
  const [, navigate] = useLocation();
  const { data: invoices, isLoading } = trpc.invoices.list.useQuery({ limit: 100 });

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(Number(val));

  const toolbarActions = useMemo(() => ({
    save:      { supported: false as const, disabledReason: "القائمة للعرض فقط — افتح فاتورة للحفظ" },
    draft:     { supported: false as const, disabledReason: "غير مستخدم في قائمة الفواتير" },
    new:       { supported: true as const, allowed: true, stateEnabled: true, onClick: () => navigate("/pos") },
    duplicate: { supported: false as const, disabledReason: "افتح فاتورة أولًا لنسخها" },
    tools:     { supported: false as const, disabledReason: "لا توجد أدوات متاحة في قائمة الفواتير" },
    edit:      { supported: false as const, disabledReason: "اضغط مرتين على فاتورة لفتحها" },
    delete:    { supported: false as const, disabledReason: "افتح فاتورة أولًا لحذفها" },
    first:     { supported: false as const, disabledReason: "التنقل يتم داخل نافذة الفاتورة" },
    previous:  { supported: false as const, disabledReason: "التنقل يتم داخل نافذة الفاتورة" },
    next:      { supported: false as const, disabledReason: "التنقل يتم داخل نافذة الفاتورة" },
    last:      { supported: false as const, disabledReason: "التنقل يتم داخل نافذة الفاتورة" },
    approve:   { supported: false as const, disabledReason: "غير مستخدم في قائمة الفواتير" },
    cancel: { supported: false as const, disabledReason: "غير مستخدم في قائمة الفواتير" },
    preview:   { supported: false as const, disabledReason: "اضغط مرتين على فاتورة لمطالعتها" },
    send:      { supported: false as const, disabledReason: "افتح فاتورة أولًا للإرسال" },
    print:     { supported: true as const, allowed: true, stateEnabled: true, onClick: () => { toast.info("طباعة القائمة..."); } },
    exit:      { supported: false as const, disabledReason: "أغلق التبويب من شريط التبويبات العلوي" },
  }), [navigate]);

  useToolbarActions(toolbarActions);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">سجل جميع فواتير المبيعات</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">رقم الفاتورة</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">طريقة الدفع</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>لا توجد فواتير</p>
                  </TableCell>
                </TableRow>
              ) : (
                invoices?.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {inv.type === "sale" ? "بيع" : "مرتجع"}
                      </Badge>
                    </TableCell>
                    <TableCell>{paymentLabels[inv.paymentMethod ?? "cash"] ?? inv.paymentMethod}</TableCell>
                    <TableCell className="font-bold text-primary">{formatCurrency(inv.total)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "completed" ? "default" : "secondary"} className="text-xs">
                        {inv.status === "completed" ? "مكتملة" : inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtDate(inv.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
