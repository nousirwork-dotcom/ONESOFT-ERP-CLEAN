/**
 * check-no-date-inputs.mjs
 * يمنع إضافة <input type="date"> جديدة خارج الحقول المخفية المسموح بها.
 *
 * الاستثناء الوحيد: الأسطر التي تحتوي على opacity:0 أو opacity: 0
 * (حقول backing للتقويم الأصلي، مثل SalesInvoicePage.tsx)
 *
 * الاستخدام: node scripts/check-no-date-inputs.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SRC_DIR = new URL("../src", import.meta.url).pathname;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      yield full;
    }
  }
}

const DATE_INPUT_RE = /type=["']date["']/;
const HIDDEN_RE = /opacity\s*:\s*0/;

const violations = [];

for await (const file of walk(SRC_DIR)) {
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (DATE_INPUT_RE.test(line) && !HIDDEN_RE.test(line)) {
      violations.push(`  ${file.replace(SRC_DIR, "src")}:${i + 1}  →  ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("\n❌ وُجدت حقول تاريخ قديمة غير مصرح بها:\n");
  violations.forEach(v => console.error(v));
  console.error(`
استخدم DateSegmentInput بدلاً من <input type="date">.
الاستثناء الوحيد المسموح: أسطر تحتوي على "opacity: 0" (حقول مخفية للتقويم).
`);
  process.exit(1);
} else {
  console.log("✅ لا توجد حقول تاريخ قديمة — جميع حقول التاريخ تستخدم DateSegmentInput.");
}
