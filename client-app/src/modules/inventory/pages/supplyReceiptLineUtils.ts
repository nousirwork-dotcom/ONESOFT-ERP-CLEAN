export type SupplyReceiptLineShape = {
  productId?: number;
  productCode: string;
  productName: string;
  unit: string;
  batchNumber: string;
  expiryDate: string;
  // Future product metadata should add tracksBatch/requiresBatch and requiresExpiryDate.
  // These fields will make batch/expiry validation and keyboard skipping product-specific.
};

export function lineHasContent(line: SupplyReceiptLineShape) {
  return Boolean(
    line.productId ||
    line.productCode.trim() ||
    line.productName.trim() ||
    line.unit.trim() ||
    line.batchNumber.trim() ||
    line.expiryDate.trim(),
  );
}

export function ensureSingleTrailingBlank<T extends SupplyReceiptLineShape>(lines: T[], emptyLine: () => T) {
  return [...lines.filter(lineHasContent), emptyLine()];
}

/**
 * Ctrl+Insert moves the existing trailing blank to the requested position.
 * The inserted blank is intentionally not appended again; selecting it later
 * runs ensureSingleTrailingBlank and creates the next single blank at the end.
 */
export function insertBlankLine<T extends SupplyReceiptLineShape>(
  lines: T[],
  index: number,
  emptyLine: () => T,
) {
  const usedLines = lines.filter(lineHasContent);
  const next = [...usedLines];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, emptyLine());
  return next;
}

export const SUPPLY_RECEIPT_NAVIGATION_COLUMNS = [
  "code",
  "name",
  "unit",
  "quantity",
  "unitCost",
  "batchNumber",
  "expiryDate",
] as const;

export function nextSupplyReceiptCell(
  row: number,
  column: number,
  rowCount: number,
  backwards = false,
) {
  const lastColumn = SUPPLY_RECEIPT_NAVIGATION_COLUMNS.length - 1;
  if (backwards) {
    if (column > 0) return { row, column: column - 1 };
    return row > 0 ? { row: row - 1, column: lastColumn } : null;
  }
  if (column < lastColumn) return { row, column: column + 1 };
  return row + 1 < rowCount ? { row: row + 1, column: 0 } : null;
}