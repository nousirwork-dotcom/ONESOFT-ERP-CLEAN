import { fmtDate } from "@/utils/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import POSReceiptModal, { parsePosConfig, type POSReceiptData } from "@/components/POSReceiptModal";
import type { QrSettings } from "@/lib/qrUtils";
import {
  Barcode,
  ChevronDown,
  ChevronUp,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CartItem = {
  productId: number;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  total: number;
};

const DEFAULT_WAREHOUSE_ID = 2;
const DEFAULT_BRANCH_ID = 1;

export default function POS() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "credit">("cash");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [paidAmount, setPaidAmount]       = useState(0);
  const [showReceipt, setShowReceipt]     = useState(false);
  const [receiptData, setReceiptData]     = useState<POSReceiptData | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: products }  = trpc.products.list.useQuery(
    { search: search.length >= 1 ? search : undefined, categoryId: activeCategory },
    { staleTime: 30000 }
  );
  const { data: categories }       = trpc.categories.list.useQuery(undefined, { staleTime: 60000 });
  const { data: customers }        = trpc.customers.list.useQuery(undefined, { staleTime: 60000 });
  const { data: orgData }          = trpc.orgs.currentOrg.useQuery();
  const { data: qrSettingsData }   = trpc.qrSettings.get.useQuery();
  const { data: posTemplateData }  = trpc.documentTemplates.getDefault.useQuery({ docType: "pos_receipt" });
  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => {
      utils.dashboard.stats.invalidate();
      utils.invoices.list.invalidate();
    },
  });

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F2") { e.preventDefault(); handleCheckout(); }
      if (e.key === "Escape") { e.preventDefault(); setSearch(""); searchRef.current?.focus(); }
      if (e.key === "Delete" && e.ctrlKey) { e.preventDefault(); setCart([]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, discount, paymentMethod]);

  const addToCart = useCallback((product: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice - i.discount }
            : i
        );
      }
      const price = Number(product.salePrice);
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode ?? undefined,
          quantity: 1,
          unitPrice: price,
          costPrice: Number(product.costPrice ?? 0),
          discount: 0,
          total: price,
        },
      ];
    });
    setSearch("");
    searchRef.current?.focus();
  }, []);

  const updateQty = useCallback((productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null;
          return { ...i, quantity: newQty, total: newQty * i.unitPrice - i.discount };
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.total, 0), [cart]);
  const totalDiscount = discount;
  const total = Math.max(0, subtotal - totalDiscount);

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error("السلة فارغة"); return; }
    setIsSubmitting(true);
    try {
      const id = await createInvoice.mutateAsync({
        warehouseId: DEFAULT_WAREHOUSE_ID,
        branchId: DEFAULT_BRANCH_ID,
        customerId: selectedCustomerId,
        items: cart.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          barcode: i.barcode,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
          costPrice: String(i.costPrice),
          discount: String(i.discount),
          total: String(i.total),
        })),
        subtotal: String(subtotal),
        discount: String(totalDiscount),
        total: String(total),
        paymentMethod,
        notes: notes || undefined,
      });
      toast.success(`تم حفظ الفاتورة #${id} بنجاح ✓`);
      const now = new Date();
      const customerName = selectedCustomerId
        ? customers?.find(c => c.id === selectedCustomerId)?.name
        : undefined;
      const rData: POSReceiptData = {
        invoiceNumber: id,
        invoiceDate: fmtDate(now),
        invoiceTime: now.toTimeString().slice(0, 8),
        cashierName: user?.name ?? (user as any)?.username ?? undefined,
        branchName: "الفرع الرئيسي",
        customerName: customerName ?? undefined,
        paymentMethod,
        lines: cart.map(i => ({
          productCode: i.barcode ?? "",
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          total: i.total,
        })),
        subtotal,
        discountTotal: totalDiscount,
        grandTotal: total,
        paidAmount: paidAmount > 0 ? paidAmount : (paymentMethod === "cash" ? total : 0),
        changeAmount: paidAmount > total ? paidAmount - total : 0,
        sellerName: orgData?.name ?? "OneSoft ERP",
        sellerTaxNumber: orgData?.taxNumber ?? undefined,
        sellerAddress: orgData?.address ?? undefined,
        sellerPhone: orgData?.phone ?? undefined,
        currency: "SAR",
      };
      setReceiptData(rData);
      setShowReceipt(true);
      setCart([]);
      setDiscount(0);
      setPaidAmount(0);
      setNotes("");
      setSelectedCustomerId(undefined);
      searchRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message ?? "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Barcode detection: if search matches a barcode exactly, add product
  useEffect(() => {
    if (!search || !products) return;
    const exact = products.find((p) => p.barcode === search);
    if (exact) {
      addToCart(exact);
    }
  }, [search, products]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] gap-0 -m-4 md:-m-6">
      {/* POS Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border">
        <ShoppingCart className="w-5 h-5 text-primary" />
        <h1 className="font-bold text-foreground">نقطة البيع</h1>
        <Badge variant="outline" className="text-xs">
          <Zap className="w-3 h-3 ml-1 text-amber-500" />
          F1: بحث | F2: دفع | Esc: مسح
        </Badge>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Products Panel */}
        <div className="flex-1 flex flex-col border-l border-border overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 border-b border-border bg-card">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الباركود... (F1)"
                className="pr-9 pl-9 h-10 text-sm bg-background"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto">
            <button
              onClick={() => setActiveCategory(undefined)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !activeCategory ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              الكل
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? undefined : cat.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 p-3">
              {products?.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="pos-product-card text-right group"
                >
                  <div className="w-full aspect-square rounded-lg bg-secondary/50 flex items-center justify-center mb-2 group-hover:bg-primary/5 transition-colors">
                    <Package className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{product.barcode ?? "—"}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatCurrency(Number(product.salePrice))}</p>
                </button>
              ))}
              {products?.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">لا توجد أصناف</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Cart Panel */}
        <div className="w-80 xl:w-96 flex flex-col bg-card border-r border-border">
          {/* Cart Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">السلة</span>
              {cart.length > 0 && (
                <Badge className="text-[10px] h-4 px-1.5">{cart.length}</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-destructive h-7 px-2 text-xs">
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                مسح الكل
              </Button>
            )}
          </div>

          {/* Cart Items */}
          <ScrollArea className="flex-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">السلة فارغة</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map((item) => (
                  <div key={item.productId} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{item.productName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.unitPrice)} / وحدة</p>
                      </div>
                      <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-primary">{formatCurrency(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Cart Footer */}
          <div className="border-t border-border p-3 space-y-3">
            {/* Customer */}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select
                value={selectedCustomerId ? String(selectedCustomerId) : "walk-in"}
                onValueChange={(v) => setSelectedCustomerId(v === "walk-in" ? undefined : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="عميل عابر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">عميل عابر</SelectItem>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-4 gap-1">
              {(["cash", "card", "transfer", "credit"] as const).map((method) => {
                const labels = { cash: "نقدي", card: "بطاقة", transfer: "تحويل", credit: "آجل" };
                return (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      paymentMethod === method
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {labels[method]}
                  </button>
                );
              })}
            </div>

            {/* Discount */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">خصم:</Label>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0"
                className="h-8 text-xs"
                min={0}
                max={subtotal}
              />
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>المجموع الفرعي</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>الخصم</span>
                  <span>- {formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border">
                <span>الإجمالي</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Cash Received */}
            {paymentMethod === "cash" && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground shrink-0">المبلغ المستلم:</Label>
                  <Input
                    type="number"
                    value={paidAmount || ""}
                    onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                    placeholder={formatCurrency(total)}
                    className="h-8 text-xs"
                    min={0}
                  />
                </div>
                {paidAmount > 0 && paidAmount >= total && (
                  <div className="flex justify-between text-sm font-bold text-green-600 bg-green-50 rounded px-2 py-1">
                    <span>الباقي للعميل</span>
                    <span>{formatCurrency(paidAmount - total)}</span>
                  </div>
                )}
              </>
            )}

            {/* Checkout Button */}
            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isSubmitting}
              className="w-full h-11 text-sm font-bold gap-2"
            >
              {isSubmitting ? (
                <span className="animate-pulse">جاري الحفظ...</span>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  حفظ وطباعة (F2)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* POS Receipt Modal */}
      {showReceipt && receiptData && (
        <POSReceiptModal
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
          data={receiptData}
          templateConfig={parsePosConfig(posTemplateData?.layoutJson)}
          qrSettings={qrSettingsData ? {
            isEnabled: qrSettingsData.isEnabled,
            countrySystem: qrSettingsData.countrySystem as any,
            sellerName: qrSettingsData.sellerName ?? undefined,
            taxNumber: qrSettingsData.taxNumber ?? undefined,
            customFormat: qrSettingsData.customFormat ?? undefined,
            showOnSalesInvoice: qrSettingsData.showOnSalesInvoice,
            showOnPurchaseInvoice: qrSettingsData.showOnPurchaseInvoice,
            showOnReceiptVoucher: qrSettingsData.showOnReceiptVoucher,
            qrSize: qrSettingsData.qrSize,
            qrPosition: qrSettingsData.qrPosition,
          } as QrSettings : null}
        />
      )}
    </div>
  );
}
