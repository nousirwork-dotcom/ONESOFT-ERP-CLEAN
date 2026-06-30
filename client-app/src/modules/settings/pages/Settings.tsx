import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { trpc } from "@/shared/lib/trpc";
import { useAuth } from "@/core/hooks/useAuth";
import { Clock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const { data: pendingSync } = trpc.sync.pending.useQuery(undefined, { refetchInterval: 10000 });
  const markDone = trpc.sync.markDone.useMutation();

  const handleSync = async () => {
    if (!isOnline) { toast.error("لا يوجد اتصال بالإنترنت"); return; }
    setIsSyncing(true);
    try {
      if (pendingSync && pendingSync.length > 0) {
        for (const item of pendingSync) {
          await markDone.mutateAsync({ id: item.id });
        }
        utils.sync.pending.invalidate();
        toast.success(`تمت مزامنة ${pendingSync.length} عملية`);
      } else {
        toast.success("كل البيانات محدّثة");
      }
    } catch (e: any) {
      toast.error(e.message ?? "فشلت المزامنة");
    } finally {
      setIsSyncing(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "مدير النظام",
    cashier: "كاشير",
    warehouse_manager: "مدير مخزن",
    user: "مستخدم",
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground text-sm mt-0.5">إعدادات النظام والمزامنة</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">معلومات الحساب</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">الاسم</span>
            <span className="text-sm font-medium">{user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">البريد الإلكتروني</span>
            <span className="text-sm font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">الدور</span>
            <Badge variant="outline" className="text-xs">
              {roleLabels[user?.role ?? "user"] ?? user?.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">حالة الاتصال والمزامنة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline
                ? <Wifi className="w-4 h-4 text-emerald-500" />
                : <WifiOff className="w-4 h-4 text-red-500" />}
              <span className="text-sm">{isOnline ? "متصل بالإنترنت" : "غير متصل"}</span>
            </div>
            <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
              {isOnline ? "أونلاين" : "أوفلاين"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm">عمليات معلقة للمزامنة</span>
            </div>
            <Badge variant={pendingSync && pendingSync.length > 0 ? "destructive" : "default"} className="text-xs">
              {pendingSync?.length ?? 0} عملية
            </Badge>
          </div>
          <Button onClick={handleSync} disabled={isSyncing || !isOnline} className="w-full gap-2">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "جاري المزامنة..." : "مزامنة الآن"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">معلومات النظام</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "إصدار النظام", value: "1.0.0" },
            { label: "قاعدة البيانات", value: "MySQL (Cloud)" },
            { label: "المزامنة", value: "تلقائية عند الاتصال" },
            { label: "النسخ الاحتياطي", value: "يومي تلقائي" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
