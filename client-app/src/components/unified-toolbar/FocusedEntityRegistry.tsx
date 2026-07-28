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

  useEffect(() => {
    const readMarker = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.closest<HTMLElement>("[data-focused-entity-type]");
    };
    const updateFromMarker = (marker: HTMLElement | null) => {
      if (!marker) return;
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
    if (!focusedEntity || focusedEntity.entityId === "" || focusedEntity.entityId == null) {
      toast.error("اختر سجلًا صحيحًا أولًا حتى يمكن فتح الكارت.");
      return;
    }
    previewFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
        <DialogContent className="w-[min(560px,calc(100%-2rem))] p-0" dir="rtl">
          {previewEntity && (
            <>
              <DialogHeader className="border-b px-5 py-4 text-right">
                <DialogTitle className="text-base">
                  بطاقة {ENTITY_LABELS[previewEntity.entityType]}
                </DialogTitle>
                <div className="text-xs text-muted-foreground">
                  معاينة قراءة فقط — {entityTitle(previewEntity)}
                </div>
              </DialogHeader>
              <div className="space-y-3 px-5 py-4">
                <div className="rounded border bg-muted/30 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">السجل المحدد</div>
                  <div className="font-semibold">{entityTitle(previewEntity)}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    ID: {String(previewEntity.entityId)}
                  </div>
                </div>
                {previewEntity.details?.length ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {previewEntity.details.map((detail) => (
                      <div key={detail.label} className="rounded border px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">{detail.label}</div>
                        <div className="truncate">{detail.value == null || detail.value === "" ? "—" : String(detail.value)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="text-[11px] text-muted-foreground">
                  الشاشة: {previewEntity.sourceScreen}
                  {previewEntity.rowId ? ` — السطر: ${previewEntity.rowId}` : ""}
                </div>
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