import { describe, expect, it } from "vitest";
import {
  filterProductLookupOptions,
  findExactProductLookupOption,
  resolveProductLookupKey,
  type ProductLookupOption,
} from "./ProductLookupCell";

const products: ProductLookupOption[] = [
  { id: 1, code: "P-100", name: "حاسبة مكتبية", barcode: "628100", unit: "قطعة" },
  { id: 2, code: "P-200", name: "طابعة ليزر", barcode: "628200", unit: "قطعة" },
];

describe("ProductLookupCell lookup rules", () => {
  it("searches by code, name, and barcode", () => {
    expect(filterProductLookupOptions(products, "P-100").map(product => product.id)).toEqual([1]);
    expect(filterProductLookupOptions(products, "طابعة").map(product => product.id)).toEqual([2]);
    expect(filterProductLookupOptions(products, "628200").map(product => product.id)).toEqual([2]);
  });

  it("finds exact code/name/barcode matches", () => {
    expect(findExactProductLookupOption(products, "p-100")?.id).toBe(1);
    expect(findExactProductLookupOption(products, "حاسبة مكتبية")?.id).toBe(1);
    expect(findExactProductLookupOption(products, "628200")?.id).toBe(2);
    expect(findExactProductLookupOption(products, "not-found")).toBeUndefined();
  });

  it("selects a highlighted suggestion on Enter or Tab", () => {
    expect(resolveProductLookupKey({
      key: "Enter", open: true, query: "P-", filteredLength: 2, highlighted: 0,
    })).toBe("select");
    expect(resolveProductLookupKey({
      key: "Tab", open: true, query: "P-", filteredLength: 2, highlighted: 1,
    })).toBe("select");
  });

  it("closes only the lookup menu on Escape", () => {
    expect(resolveProductLookupKey({
      key: "Escape", open: true, query: "P-", filteredLength: 1, highlighted: 0,
    })).toBe("close");
    expect(resolveProductLookupKey({
      key: "Escape", open: false, query: "", filteredLength: 0, highlighted: 0,
    })).toBe("navigate");
  });

  it("rejects unresolved text without navigating", () => {
    expect(resolveProductLookupKey({
      key: "Enter", open: false, query: "not-found", products, filteredLength: 0, highlighted: 0,
    })).toBe("invalid");
  });

  it("accepts an exact product code without navigating", () => {
    expect(resolveProductLookupKey({
      key: "Enter", open: false, query: "P-100", products, filteredLength: 0, highlighted: 0,
    })).toBe("select");
  });

  it("keeps Ctrl+Delete outside the lookup key handling path", () => {
    expect(resolveProductLookupKey({
      key: "Delete", open: false, query: "", filteredLength: 0, highlighted: 0,
    })).toBe("navigate");
  });
});