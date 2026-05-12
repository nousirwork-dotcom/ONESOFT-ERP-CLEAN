import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import ERPToolbar from "@/components/ERPToolbar";

const paymentLabels: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل", credit: "آجل" };

export default function Invoices() {
  const [, navigate] = useLocation();
  const { data: invoices, isLoading } = trpc.invoices.list.useQuery({ limit: 100 });

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(Number(val));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">سجل جميع فواتير المبيعات</p>
        </div>
      </div>

      {/* ERP Toolbar */}
      <ERPToolbar
        pageTitle="قائمة الفواتير"
        hideStatusBar
        onNew={() => navigate("/pos")}
        onSearch={() => toast.info("بحث في الفواتير...")}
        onRefresh={() => window.location.reload()}
        onPrint={() => toast.info("طباعة القائمة...")}
      />

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
                      {new Date(inv.createdAt).toLocaleString("ar-SA")}
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
