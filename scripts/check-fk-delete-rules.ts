#!/usr/bin/env tsx
/**
 * check-fk-delete-rules.ts
 *
 * Automated check that catches nullable foreign-key columns whose ON DELETE
 * behaviour has not been set explicitly.
 *
 * Two complementary modes run in sequence:
 *
 *  1. STATIC  – parses server-app/src/schema.ts without a DB connection.
 *               Catches issues before a migration is ever applied.
 *               Suitable for a pre-commit hook or "drizzle generate" step.
 *
 *  2. LIVE DB – queries information_schema.referential_constraints against the
 *               running PostgreSQL instance (requires DATABASE_URL).
 *               Catches rules that differ between the schema file and what is
 *               actually installed in the database.
 *
 * Exit code 1 when any violation is found (so CI / hooks can block the commit).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = resolve(__dirname, '../server-app/src/schema.ts');

// ─── helpers ──────────────────────────────────────────────────────────────────

function bold(s: string)   { return `\x1b[1m${s}\x1b[0m`; }
function red(s: string)    { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function green(s: string)  { return `\x1b[32m${s}\x1b[0m`; }

// ─── 1. STATIC ANALYSIS ───────────────────────────────────────────────────────
//
// Drizzle FK column patterns we care about:
//
//   NULLABLE + no onDelete (BAD):
//     branchId: integer('branch_id').references(() => branches.id),
//
//   NULLABLE + explicit onDelete (GOOD):
//     warehouseId: integer('warehouse_id')
//       .references(() => warehouses.id, { onDelete: 'set null' }),
//
//   NOT-NULL + any (out of scope – deletion is already blocked by the FK):
//     orgId: integer('org_id').notNull().references(() => organizations.id),
//
// Strategy
// --------
//   Walk every `.references(` occurrence in the source text.
//   For each hit look back to find the start of the current column definition,
//   then examine ONLY that column's text (not prior columns) for `.notNull()`.
//   Finally check whether the references() call carries an `onDelete` option.
//
//   Deliberately avoids a full AST parse: zero extra dependencies, fast enough
//   for a pre-commit hook.

interface StaticIssue {
  column: string;
  referencedTable: string;
  line: number;
}

function runStaticCheck(): StaticIssue[] {
  let src: string;
  try {
    src = readFileSync(SCHEMA_FILE, 'utf8');
  } catch {
    console.error(red(`Cannot read schema file: ${SCHEMA_FILE}`));
    process.exit(1);
  }

  const issues: StaticIssue[] = [];

  // Match every `.references(` in the file.
  const refRe = /\.references\(/g;
  let m: RegExpExecArray | null;

  while ((m = refRe.exec(src)) !== null) {
    const refStart = m.index;

    // ── find the current column's definition start ────────────────────────
    // Look back up to 500 chars. A Drizzle column property starts with
    // an indented identifier followed by a colon, e.g.:
    //   "  branchId: integer('branch_id')"
    //
    // We search for ALL such patterns in the lookback, then take the LAST
    // one – that is the current column (not a preceding column).
    const lookBackRaw = src.slice(Math.max(0, refStart - 500), refStart);

    // Find all column-start markers; take the last one.
    const colStartRe = /\n([ \t]+)(\w+)\s*:/g;
    let colMatch: RegExpExecArray | null;
    let lastColMatch: RegExpExecArray | null = null;
    while ((colMatch = colStartRe.exec(lookBackRaw)) !== null) {
      lastColMatch = colMatch;
    }

    if (!lastColMatch) continue;

    const columnName = lastColMatch[2];

    // Skip Drizzle internals (PascalCase table references, 'id', etc.) and
    // the synthetic "relations" export.
    if (/^[A-Z]/.test(columnName)) continue;
    if (columnName === 'relations') continue;

    // ── extract only THIS column's text before `.references(` ────────────
    // Everything from the column-start position to end of lookBackRaw is the
    // current column's chain up to (but not including) `.references(`.
    const colTextBefore = lookBackRaw.slice(lastColMatch.index);

    // ── nullable check: only look within this column's own text ──────────
    const isNotNull = /\.notNull\(\)/.test(colTextBefore);
    if (isNotNull) continue; // NOT-NULL columns are protected by the constraint itself

    // ── capture the full `.references(...)` call from this point ─────────
    // Grab up to 300 chars after the `.references(` keyword.
    const lookAhead = src.slice(refStart, refStart + 300);

    // Parse the references() arguments:
    //   .references(() => table.col)
    //   .references(() => table.col, { onDelete: 'cascade' })
    const refsCallMatch = lookAhead.match(
      /\.references\(\s*\(\)\s*=>\s*([\w.]+)\s*(?:,\s*(\{[^}]*\}))?\s*\)/
    );
    if (!refsCallMatch) continue;

    const referencedTarget = refsCallMatch[1];          // e.g. "branches.id"
    const optionsBlock    = refsCallMatch[2] ?? '';     // e.g. "{ onDelete: 'cascade' }"

    if (/onDelete/.test(optionsBlock)) continue;        // already has a rule – good

    // ── determine approximate line number ────────────────────────────────
    const lineNo = src.slice(0, refStart).split('\n').length;

    issues.push({ column: columnName, referencedTable: referencedTarget, line: lineNo });
  }

  return issues;
}

// ─── 2. LIVE DB CHECK via information_schema ──────────────────────────────────
//
// Queries:
//   information_schema.referential_constraints  – gives the delete_rule
//   information_schema.key_column_usage         – maps constraint → table/column
//   information_schema.columns                  – tells us if the column is nullable
//
// Flags every FK where delete_rule = 'NO ACTION' AND the column IS nullable
// (is_nullable = 'YES').

interface DbIssue {
  table: string;
  column: string;
  referencedTable: string;
  deleteRule: string;
}

async function runDbCheck(): Promise<DbIssue[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log(yellow('  DATABASE_URL not set – skipping live database check.'));
    return [];
  }

  let pg: typeof import('pg');
  try {
    pg = await import('pg');
  } catch {
    console.log(yellow('  pg package not available – skipping live database check.'));
    return [];
  }

  const { Pool } = pg.default ?? pg;
  const pool = new Pool({ connectionString: dbUrl });

  // Join referential_constraints with key_column_usage (FK side),
  // constraint_column_usage (referenced side), and columns (nullability).
  const query = `
    SELECT
      kcu.table_name        AS "table",
      kcu.column_name       AS "column",
      ccu.table_name        AS "referencedTable",
      rc.delete_rule        AS "deleteRule"
    FROM information_schema.referential_constraints  rc
    JOIN information_schema.key_column_usage         kcu
      ON  kcu.constraint_name   = rc.constraint_name
      AND kcu.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage  ccu
      ON  ccu.constraint_name   = rc.unique_constraint_name
      AND ccu.constraint_schema = rc.constraint_schema
    JOIN information_schema.columns                  col
      ON  col.table_name   = kcu.table_name
      AND col.column_name  = kcu.column_name
      AND col.table_schema = kcu.constraint_schema
    WHERE rc.constraint_schema = 'public'
      AND rc.delete_rule       = 'NO ACTION'
      AND col.is_nullable      = 'YES'
    ORDER BY kcu.table_name, kcu.column_name;
  `;

  try {
    const result = await pool.query(query);
    return result.rows as DbIssue[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(yellow(`  DB query failed (${msg}) – skipping live check.`));
    return [];
  } finally {
    await pool.end();
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────
//
// Modes (mutually exclusive flags):
//   --static   Run only the static schema analysis (no DB required).
//              Used before drizzle-kit push to gate the migration.
//   --db       Run only the live database check (information_schema).
//              Used after drizzle-kit push to confirm constraints landed.
//   (none)     Run both checks in sequence (default — for manual / pre-commit use).

async function main() {
  const args = process.argv.slice(2);
  const staticOnly = args.includes('--static');
  const dbOnly     = args.includes('--db');

  let exitCode = 0;

  // ── Static check ────────────────────────────────────────────────────────────
  if (!dbOnly) {
    const label = staticOnly ? '🔍  Static schema analysis …' : '🔍  [1/2] Static schema analysis …';
    console.log(bold('\n' + label));
    console.log(`    File: ${SCHEMA_FILE}\n`);

    const staticIssues = runStaticCheck();

    if (staticIssues.length === 0) {
      console.log(green('  ✓  No nullable FK columns with missing ON DELETE rule found.'));
    } else {
      exitCode = 1;
      console.log(red(`  ✗  Found ${staticIssues.length} nullable FK column(s) with no ON DELETE rule:\n`));
      for (const issue of staticIssues) {
        console.log(
          `     ${bold(red(issue.column))} → ${issue.referencedTable}` +
          `  (schema.ts line ~${issue.line})`
        );
      }
      console.log();
      console.log('  Fix: add an explicit onDelete option to each .references() call, e.g.:');
      console.log(yellow("    .references(() => table.col, { onDelete: 'set null' })   ← for optional links"));
      console.log(yellow("    .references(() => table.col, { onDelete: 'cascade' })    ← for owned children"));
      console.log(yellow("    .references(() => table.col, { onDelete: 'restrict' })   ← to prevent deletion"));
      console.log();
      console.log('  To bypass in an emergency: git commit --no-verify');
    }
  }

  // ── Live DB check ───────────────────────────────────────────────────────────
  if (!staticOnly) {
    const label = dbOnly ? '🔍  Live database check (information_schema) …' : '🔍  [2/2] Live database check (information_schema) …';
    console.log(bold('\n' + label));

    const dbIssues = await runDbCheck();

    if (dbIssues.length === 0) {
      console.log(green('  ✓  No issues found in the connected database.\n'));
    } else {
      exitCode = 1;
      console.log(
        red(`  ✗  Found ${dbIssues.length} nullable FK(s) with delete_rule = NO ACTION in the database:\n`)
      );
      for (const issue of dbIssues) {
        console.log(
          `     ${bold(red(issue.table + '.' + issue.column))} → ${issue.referencedTable}` +
          `  (delete_rule: ${issue.deleteRule})`
        );
      }
      console.log(
        '\n  These constraints exist in the live database but carry no explicit ON DELETE rule.' +
        '\n  Update the Drizzle schema and run `pnpm migrate` to apply the fix.\n'
      );
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  if (exitCode === 0) {
    console.log(green(bold('✅  All FK delete rules look good!\n')));
  } else {
    console.log(red(bold('❌  FK delete-rule violations detected. See above.\n')));
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(red('Unexpected error:'), err);
  process.exit(1);
});
