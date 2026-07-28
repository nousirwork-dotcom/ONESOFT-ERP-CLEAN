import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import { ProductCard, productToForm, type ProductForm } from "@/modules/inventory/pages/Products";

export type FocusedEntityType =
  | "product"
  | "warehouse"
  | "customer"
  | "supplier"
  | "account"
  | "user"
  | "documentBook"
  | "salesInvoice"
  | "purchaseInvoice"
  | "journalEntry"
  | "costCenter"
  | "sourceDocument";

export interface FocusedEntity {
  entityType: FocusedEntityType;
  entityId: number | string;
  fieldName: string;
  sourceScreen: string;
  rowId?: string;
  title: string;
  subtitle?: string;
  details?: Array<{ label: string; value: string | number | null | undefined }>;
}

interface FocusedEntityRegistryValue {
  focusedEntity: FocusedEntity | null;
  focusEntity: (entity: FocusedEntity | null) => void;
  previewFocusedEntity: () => void;
}

const FocusedEntityRegistryContext =
  createContext<FocusedEntityRegistryValue | null>(null);

const ENTITY_LABELS: Record<FocusedEntityType, string> = {
  product: "الصنف",
  warehouse: "المخزن",
  customer: "العميل",
  supplier: "المورد",
  account: "الحساب",
  user: "المستخدم",
  documentBook: "دفتر المستند",
  salesInvoice: "فاتورة المبيعات",
  purchaseInvoice: "فاتورة المشتريات",
  journalEntry: "القيد اليومي",
  costCenter: "مركز التكلفة",
  sourceDocument: "المستند المرتبط",
};

function entityTitle(entity: FocusedEntity): string {
  return entity.title || `${ENTITY_LABELS[entity.entityType]} ${entity.entityId}`;
}

export function FocusedEntityProvider({ children }: { children: ReactNode }) {
  const [focusedEntity, setFocusedEntity] = useState<FocusedEntity | null>(null);
  const [previewEntity, setPreviewEntity] = useState<FocusedEntity | null>(null);
  const previewFocusRef = useRef<HTMLElement | null>(null);
  const lastEntityElementRef = useRef<HTMLElement | null>(null);
  const previewProductId = previewEntity?.entityType === "product"
    ? Number(previewEntity.entityId)
    : 0;
  const { data: previewProduct, isLoading: isProductLoading } =
    trpc.products.getById.useQuery(
      { id: previewProductId },
      { enabled: previewProductId > 0, staleTime: 30000 },
    );
  const { data: categories } = trpc.categories.list.useQuery(undefined, {
    enabled: previewProductId > 0,
    staleTime: 60000,
  });
  const { data: groups } = trpc.productGroups.list.useQuery(undefined, {
    enabled: previewProductId > 0,
    staleTime: 60000,
  });
  const [previewProductForm, setPreviewProductForm] = useState<ProductForm>(productToForm(null));

  useEffect(() => {
    setPreviewProductForm(productToForm(previewProduct));
  }, [previewProduct]);

  useEffect(() => {
    const readMarker = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.closest<HTMLElement>("[data-focused-entity-type]");
    };
    const updateFromMarker = (marker: HTMLElement | null) => {
      if (!marker) return;
      lastEntityElementRef.current = marker;
      const rawId = marker.dataset.focusedEntityId ?? "";
      if (!rawId) {
        setFocusedEntity(null);
        return;
      }
      setFocusedEntity({
        entityType: marker.dataset.focusedEntityType as FocusedEntityType,
        entityId: rawId,
        fieldName: marker.dataset.focusedField ?? "",
        sourceScreen: marker.dataset.focusedSource ?? "",
        rowId: marker.dataset.focusedRow,
        title: marker.dataset.focusedEntityTitle ?? "",
        subtitle: marker.dataset.focusedEntitySubtitle,
      });
    };
    const onFocusIn = (event: FocusEvent) => {
      updateFromMarker(readMarker(event.target) ?? null);
    };
    const onPointerDown = (event: PointerEvent) => {
      updateFromMarker(readMarker(event.target) ?? null);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const focusEntity = useCallback((entity: FocusedEntity | null) => {
    setFocusedEntity(entity);
  }, []);

  const previewFocusedEntity = useCallback(() => {
    if (
      !focusedEntity ||
      focusedEntity.entityType !== "product" ||
      focusedEntity.entityId === "" ||
      focusedEntity.entityId == null
    ) {
      toast.error("اختر صنفًا صحيحًا أولًا.");
      return;
    }
    previewFocusRef.current = lastEntityElementRef.current;
    setPreviewEntity(focusedEntity);
  }, [focusedEntity]);

  const value = useMemo(
    () => ({ focusedEntity, focusEntity, previewFocusedEntity }),
    [focusedEntity, focusEntity, previewFocusedEntity],
  );

  return (
    <FocusedEntityRegistryContext.Provider value={value}>
      {children}
      <Dialog
        open={!!previewEntity}
        onOpenChange={(open) => {
          if (open) return;
          setPreviewEntity(null);
          requestAnimationFrame(() => previewFocusRef.current?.focus());
        }}
      >
        <DialogContent className="w-[min(1100px,calc(100%-2rem))] max-w-none p-0" dir="rtl">
          {previewEntity?.entityType === "product" && (
            <>
              <DialogHeader className="border-b px-5 py-4 text-right">
                <DialogTitle className="text-base">
                  بطاقة الصنف
                </DialogTitle>
              </DialogHeader>
              <div className="h-[min(720px,calc(100vh-7rem))] min-h-[420px] overflow-hidden">
                {isProductLoading || !previewProduct ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    جاري تحميل بطاقة الصنف...
                  </div>
                ) : (
                  <ProductCard
                    form={previewProductForm}
                    setForm={setPreviewProductForm}
                    categories={categories}
                    groups={groups as any}
                    productId={previewProductId}
                    readOnly
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </FocusedEntityRegistryContext.Provider>
  );
}

export function useFocusedEntityRegistry(): FocusedEntityRegistryValue {
  const context = useContext(FocusedEntityRegistryContext);
  if (!context) {
    throw new Error("useFocusedEntityRegistry must be used within FocusedEntityProvider");
  }
  return context;
}

export function useFocusedEntityRegistrySafe(): FocusedEntityRegistryValue {
  const context = useContext(FocusedEntityRegistryContext);
  return context ?? {
    focusedEntity: null,
    focusEntity: () => {},
    previewFocusedEntity: () => {
      toast.error("لا يوجد كارت مرتبط بالحقل الحالي.");
    },
  };
}

export function getFocusedEntityLabel(type: FocusedEntityType): string {
  return ENTITY_LABELS[type];
}