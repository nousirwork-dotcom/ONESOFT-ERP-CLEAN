import { describe, expect, it } from "vitest";
import {
  ensureSingleTrailingBlank,
  insertBlankLine,
  lineHasContent,
  nextSupplyReceiptCell,
  SUPPLY_RECEIPT_NAVIGATION_COLUMNS,
} from "./supplyReceiptLineUtils";

const blank = () => ({ productCode: "", productName: "", unit: "", batchNumber: "", expiryDate: "" });
const used = (id: number) => ({ ...blank(), productId: id, productCode: `P-${id}`, productName: `صنف ${id}`, unit: "وحدة" });

describe("supply receipt line invariants", () => {
  it("keeps exactly one trailing blank", () => {
    const result = ensureSingleTrailingBlank([used(1), blank(), blank()], blank);
    expect(result).toHaveLength(2);
    expect(result.filter(line => !lineHasContent(line))).toHaveLength(1);
  });

  it("moves the only blank when Ctrl+Insert is used between rows", () => {
    const result = insertBlankLine([used(1), used(2), blank()], 1, blank);
    expect(result.map(line => line.productId)).toEqual([1, undefined, 2]);
    expect(result.filter(line => !lineHasContent(line))).toHaveLength(1);
  });

  it("defines the complete seven-column navigation order", () => {
    expect(SUPPLY_RECEIPT_NAVIGATION_COLUMNS).toEqual([
      "code", "name", "unit", "quantity", "unitCost", "batchNumber", "expiryDate",
    ]);
    expect(nextSupplyReceiptCell(0, 0, 3)).toEqual({ row: 0, column: 1 });
    expect(nextSupplyReceiptCell(0, 6, 3)).toEqual({ row: 1, column: 0 });
    expect(nextSupplyReceiptCell(1, 0, 3, true)).toEqual({ row: 0, column: 6 });
    expect(nextSupplyReceiptCell(0, 0, 3, true)).toBeNull();
  });

  it("creates a new trailing blank after the inserted row is selected", () => {
    const inserted = insertBlankLine([used(1), used(2), blank()], 1, blank);
    const selected = inserted.map((line, index) => index === 1 ? { ...line, ...used(3) } : line);
    const result = ensureSingleTrailingBlank(selected, blank);
    expect(result.map(line => line.productId)).toEqual([1, 3, 2, undefined]);
    expect(result.filter(line => !lineHasContent(line))).toHaveLength(1);
  });
});