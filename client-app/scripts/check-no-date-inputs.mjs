/**
 * check-no-date-inputs.mjs
 * فحص اتفاقيات واجهة المستخدم — يمنع:
 *   1. <input type="date"> جديدة خارج الحقول المخفية المسموح بها.
 *   2. background: "#ECE7DD" المكتوبة يدوياً (يجب استخدام var(--background) أو bg-background).
 *
 * الاستثناءات:
 *   - type="date": فقط الأسطر التي تحتوي على opacity:0 أو opacity: 0 (حقول backing مخفية)
 *   - #ECE7DD: BrandingContext.tsx يُعرِّف هذه القيمة كقيمة افتراضية (مسموح)
 *
 * الاستخدام: node scripts/check-no-date-inputs.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));

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

const DATE_INPUT_RE    = /type=["']date["']/;
const HIDDEN_RE        = /opacity\s*:\s*0/;
const HARDCODED_BG_RE  = /#[Ee][Cc][Ee]7[Dd][Dd]/;

const violations = [];

for await (const file of walk(SRC_DIR)) {
  const rel = file.replace(SRC_DIR, "src");

  // BrandingContext يعرّف هذه القيمة كافتراضي — مسموح
  const isBrandingCtx = rel.includes("BrandingContext");

  const content = await readFile(file, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. type="date" خارج الحقول المخفية
    if (DATE_INPUT_RE.test(line) && !HIDDEN_RE.test(line)) {
      violations.push({ kind: "date-input", file: rel, ln: i + 1, line: line.trim() });
    }

    // 2. لون الخلفية الرئيسي مكتوباً يدوياً بدل var(--background)
    if (!isBrandingCtx && HARDCODED_BG_RE.test(line)) {
      violations.push({ kind: "hardcoded-bg", file: rel, ln: i + 1, line: line.trim() });
    }
  }
}

if (violations.length > 0) {
  const dateViolations = violations.filter(v => v.kind === "date-input");
  const bgViolations   = violations.filter(v => v.kind === "hardcoded-bg");

  if (dateViolations.length > 0) {
    console.error("\n❌ حقول تاريخ قديمة غير مصرح بها:\n");
    dateViolations.forEach(v => console.error(`  ${v.file}:${v.ln}  →  ${v.line}`));
    console.error("\nاستخدم DateSegmentInput بدلاً من <input type=\"date\">.");
    console.error("الاستثناء الوحيد المسموح: أسطر تحتوي على \"opacity: 0\" (حقول مخفية للتقويم).\n");
  }

  if (bgViolations.length > 0) {
    console.error("\n❌ خلفيات مكتوبة يدوياً (#ECE7DD) غير مصرح بها:\n");
    bgViolations.forEach(v => console.error(`  ${v.file}:${v.ln}  →  ${v.line}`));
    console.error("\nاستخدم var(--background) أو bg-background بدلاً من كتابة كود اللون يدوياً.");
    console.error("هذا يضمن تغيير جميع الشاشات تلقائياً عند تعديل لون الثيم.\n");
  }

  process.exit(1);
} else {
  console.log("✅ لا توجد حقول تاريخ قديمة — جميع حقول التاريخ تستخدم DateSegmentInput.");
  console.log("✅ لا توجد خلفيات مكتوبة يدوياً — جميع الخلفيات تستخدم var(--background).");
}
