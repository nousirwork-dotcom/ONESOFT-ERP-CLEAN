import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, Ref } from "react";

export type ProductLookupOption = {
  id: number;
  name: string;
  code?: string | null;
  barcode?: string | null;
  unit?: string | null;
  purchasePrice?: string | null;
  costPrice?: string | null;
};

type ProductLookupCellProps = {
  value: string;
  placeholder: string;
  products: ProductLookupOption[];
  onChange: (value: string) => void;
  onSelect: (product: ProductLookupOption) => void;
  onNavigate: (event: KeyboardEvent<HTMLInputElement>) => void;
  displayValue?: (product: ProductLookupOption) => string;
  onInvalid?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  readOnly?: boolean;
  className?: string;
  "data-focused-entity-type"?: string;
  "data-focused-entity-id"?: number;
};

function matches(product: ProductLookupOption, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [product.name, product.code, product.barcode]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(normalized));
}

function isExactMatch(product: ProductLookupOption, query: string) {
  const normalized = query.trim().toLowerCase();
  return [product.name, product.code, product.barcode]
    .filter(Boolean)
    .some(value => String(value).trim().toLowerCase() === normalized);
}

export default function ProductLookupCell({
  value,
  placeholder,
  products,
  onChange,
  onSelect,
  onNavigate,
  displayValue = product => product.name,
  onInvalid,
  onFocus,
  onBlur,
  inputRef,
  readOnly = false,
  className,
  "data-focused-entity-type": focusedEntityType,
  "data-focused-entity-id": focusedEntityId,
}: ProductLookupCellProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const internalRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const filtered = useMemo(() => products.filter(product => matches(product, query)).slice(0, 12), [products, query]);

  useEffect(() => setQuery(value), [value]);

  const focusInvalid = () => {
    onInvalid?.();
    requestAnimationFrame(() => {
      internalRef.current?.focus();
      internalRef.current?.select();
    });
  };

  const select = (product: ProductLookupOption) => {
    setQuery(displayValue(product));
    setOpen(false);
    setHighlighted(0);
    onSelect(product);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setHighlighted(current => event.key === "ArrowDown"
        ? Math.min(current + 1, Math.max(0, filtered.length - 1))
        : Math.max(current - 1, 0));
      return;
    }
    if (open && (event.key === "Enter" || event.key === "Tab") && filtered[highlighted]) {
      event.preventDefault();
      select(filtered[highlighted]);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if ((event.key === "Enter" || event.key === "Tab") && !readOnly && query.trim()) {
      const exact = products.find(product => isExactMatch(product, query));
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
        readOnly={readOnly}
        autoComplete="off"
        className={className}
        data-focused-entity-type={focusedEntityType}
        data-focused-entity-id={focusedEntityId}
        onFocus={() => { setOpen(!readOnly); setHighlighted(0); onFocus?.(); }}
        onChange={event => {
          const next = event.target.value;
          setQuery(next);
          setHighlighted(0);
          setOpen(!readOnly);
          onChange(next);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!readOnly && query.trim()) {
              const exact = products.find(product => isExactMatch(product, query));
              if (exact) select(exact);
              else focusInvalid();
            }
            setOpen(false);
            onBlur?.();
          }, 180);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && !readOnly && (
        <div ref={dropRef} className="supply-inline-lookup">
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
            </button>
          ))}
          {!filtered.length && <span className="supply-inline-lookup-empty">لا توجد أصناف مطابقة</span>}
        </div>
      )}
    </div>
  );
}