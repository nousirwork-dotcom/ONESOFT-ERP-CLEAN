import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, Ref } from "react";
import "./ProductLookupCell.css";

export type ProductLookupOption = {
  id: number;
  name: string;
  code?: string | null;
  barcode?: string | null;
  unit?: string | null;
  purchasePrice?: string | null;
  costPrice?: string | null;
  salePrice?: string | number | null;
  taxRate?: string | number | null;
  itemType?: string | null;
};

export type ProductLookupSearch = (
  query: string,
  products: ProductLookupOption[],
) => ProductLookupOption[];

export type ProductLookupCellProps = {
  value: string;
  placeholder: string;
  products?: ProductLookupOption[];
  onChange: (value: string) => void;
  onSelect: (product: ProductLookupOption) => void;
  onNavigate: (event: KeyboardEvent<HTMLInputElement>) => void;
  displayValue?: (product: ProductLookupOption) => string;
  getDisplayValue?: (product: ProductLookupOption) => string;
  searchProducts?: ProductLookupSearch;
  onInvalid?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onOpenChange?: (open: boolean) => void;
  selectOnInvalid?: boolean;
  isEditing?: boolean;
  openOnValueChange?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  readOnly?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  menuClassName?: string;
  "data-focused-entity-type"?: string;
  "data-focused-entity-id"?: number;
};

export function filterProductLookupOptions(productList: ProductLookupOption[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return productList;
  return productList.filter(product => [product.name, product.code, product.barcode]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(normalized)));
}

export function findExactProductLookupOption(productList: ProductLookupOption[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return undefined;
  return productList.find(product => [product.name, product.code, product.barcode]
    .filter(Boolean)
    .some(value => String(value).trim().toLowerCase() === normalized));
}

export type ProductLookupKeyAction = "navigate" | "open" | "highlight-next" | "highlight-previous" | "select" | "close" | "invalid";

export function resolveProductLookupKey(input: {
  key: string;
  open: boolean;
  query: string;
  readOnly?: boolean;
  products?: ProductLookupOption[];
  filteredLength: number;
  highlighted: number;
}) : ProductLookupKeyAction {
  const { key, open, query, readOnly = false, products = [], filteredLength, highlighted } = input;
  if (readOnly) return "navigate";
  if (!open && query.trim() && key === "ArrowDown") return "open";
  if (open && key === "ArrowDown") return "highlight-next";
  if (open && key === "ArrowUp") return "highlight-previous";
  if (open && query.trim() && (key === "Enter" || key === "Tab") && highlighted < filteredLength) return "select";
  if (open && key === "Escape") return "close";
  if ((key === "Enter" || key === "Tab") && !readOnly && query.trim()) {
    return findExactProductLookupOption(products, query) ? "select" : "invalid";
  }
  return "navigate";
}

export default function ProductLookupCell({
  value,
  placeholder,
  products = [],
  onChange,
  onSelect,
  onNavigate,
  displayValue = product => product.name,
  getDisplayValue = displayValue,
  searchProducts,
  onInvalid,
  onFocus,
  onBlur,
  onMouseDown,
  onKeyDown: externalOnKeyDown,
  onOpenChange,
  selectOnInvalid = true,
  isEditing = true,
  openOnValueChange = false,
  inputRef,
  readOnly = false,
  disabled = false,
  autoFocus = false,
  className,
  menuClassName,
  "data-focused-entity-type": focusedEntityType,
  "data-focused-entity-id": focusedEntityId,
}: ProductLookupCellProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const internalRef = useRef<HTMLInputElement | null>(null);
  const filtered = useMemo(() => (searchProducts
    ? searchProducts(query, products)
    : filterProductLookupOptions(products, query)
  ).slice(0, 12), [products, query, searchProducts]);

  useEffect(() => {
    setQuery(value);
    if (isEditing && openOnValueChange && value.trim()) {
      setOpen(true);
      onOpenChange?.(true);
    }
    if (!isEditing) {
      setOpen(false);
      onOpenChange?.(false);
    }
  }, [isEditing, onOpenChange, openOnValueChange, value]);
  useEffect(() => {
    if (autoFocus && !disabled && !readOnly) internalRef.current?.focus();
  }, [autoFocus, disabled, readOnly]);

  const focusInvalid = () => {
    onInvalid?.();
    requestAnimationFrame(() => {
      internalRef.current?.focus();
      if (selectOnInvalid) internalRef.current?.select();
    });
  };

  const select = (product: ProductLookupOption) => {
    setQuery(getDisplayValue(product));
    setOpen(false);
    setHighlighted(0);
    onOpenChange?.(false);
    onSelect(product);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    externalOnKeyDown?.(event);
    if (event.defaultPrevented) return;
    const action = resolveProductLookupKey({
      key: event.key,
      open,
      query,
      readOnly,
      products,
      filteredLength: filtered.length,
      highlighted,
    });
    if (isEditing && !open && (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End")) {
      return;
    }
    if (action === "highlight-next" || action === "highlight-previous") {
      event.preventDefault();
      setHighlighted(current => action === "highlight-next"
        ? Math.min(current + 1, Math.max(0, filtered.length - 1))
        : Math.max(current - 1, 0));
      return;
    }
    if (action === "open") {
      event.preventDefault();
      setOpen(true);
      setHighlighted(0);
      onOpenChange?.(true);
      return;
    }
    if (action === "select") {
      const selected = open ? filtered[highlighted] : findExactProductLookupOption(products, query);
      if (selected) {
        event.preventDefault();
        select(selected);
        return;
      }
    }
    if (action === "close") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      onOpenChange?.(false);
      return;
    }
    if (action === "invalid") {
      const exact = findExactProductLookupOption(products, query);
      if (exact) {
        event.preventDefault();
        select(exact);
        return;
      }
      event.preventDefault();
      focusInvalid();
      return;
    }
    onNavigate(event);
  };

  return (
    <div className="product-lookup-cell">
      <input
        ref={element => {
          internalRef.current = element;
          if (typeof inputRef === "function") inputRef(element);
          else if (inputRef && "current" in inputRef) inputRef.current = element;
        }}
        value={query}
        placeholder={placeholder}
         readOnly={readOnly || !isEditing}
        disabled={disabled}
        autoComplete="off"
        className={className}
        data-focused-entity-type={focusedEntityType}
        data-focused-entity-id={focusedEntityId}
        onMouseDown={onMouseDown}
        onFocus={() => {
          if (!(isEditing && openOnValueChange && query.trim())) {
            setOpen(false);
            onOpenChange?.(false);
            setHighlighted(0);
          }
          onFocus?.();
        }}
        onChange={event => {
          const next = event.target.value;
          setQuery(next);
          setHighlighted(0);
          setOpen(!readOnly && !disabled && Boolean(next.trim()));
           onOpenChange?.(!readOnly && !disabled && Boolean(next.trim()));
          onChange(next);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!readOnly && !disabled && query.trim()) {
              const exact = findExactProductLookupOption(products, query);
              if (exact) select(exact);
              else focusInvalid();
            }
            setOpen(false);
            onOpenChange?.(false);
            onBlur?.();
          }, 180);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && query.trim() && !readOnly && !disabled && (
        <div className={menuClassName ?? "product-lookup-menu"}>
          {filtered.map((product, index) => (
            <button
              type="button"
              key={product.id}
              className={index === highlighted ? "active" : ""}
              onMouseDown={event => event.preventDefault()}
              onClick={() => select(product)}
            >
              <b>{product.code ?? product.barcode ?? "—"}</b>
              <span>{product.name}</span>
              <small>{product.unit ?? "وحدة"}</small>
              {product.barcode && <small className="product-lookup-barcode">{product.barcode}</small>}
            </button>
          ))}
          {!filtered.length && <span className="product-lookup-empty">لا توجد أصناف مطابقة</span>}
        </div>
      )}
    </div>
  );
}