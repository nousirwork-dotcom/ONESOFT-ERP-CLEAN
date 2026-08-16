import type { PoolClient } from 'pg';

type Emit = (event: {
  level: 'info' | 'success' | 'warning';
  message: string;
  timestamp: string;
}) => void;

interface SequenceCandidate {
  tableSchema: string;
  tableName: string;
  columnName: string;
  sequenceSchema: string;
  sequenceName: string;
  lastValue: string | null;
}

export interface SequenceCompatibilityRepairResult {
  inspected: number;
  repaired: number;
  preserved: number;
}

function now(): string {
  return new Date().toISOString();
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unexpected PostgreSQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function parseInteger(value: string | null, label: string): bigint | null {
  if (value === null || value === '') return null;
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

/**
 * Repairs every serial/identity sequence that backs a single-column primary
 * key. Legacy backup/import paths can preserve rows but lose sequence state.
 *
 * The repair is intentionally monotonic:
 * - an empty table is never used to lower a sequence;
 * - a sequence at or above MAX(pk) is preserved;
 * - a sequence below MAX(pk) is advanced to MAX(pk), so the next nextval()
 *   returns MAX(pk) + 1.
 */
export async function synchronizePrimaryKeySequences(
  client: PoolClient,
  emit: Emit,
): Promise<SequenceCompatibilityRepairResult> {
  const candidatesResult = await client.query<SequenceCandidate>(`
    WITH primary_key_columns AS (
      SELECT
        ns.nspname AS table_schema,
        rel.relname AS table_name,
        attr.attname AS column_name
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS ns ON ns.oid = rel.relnamespace
      JOIN pg_attribute AS attr
        ON attr.attrelid = rel.oid
       AND attr.attnum = con.conkey[1]
       AND NOT attr.attisdropped
      WHERE con.contype = 'p'
        AND array_length(con.conkey, 1) = 1
        AND ns.nspname = 'public'
        AND rel.relkind IN ('r', 'p')
    )
    SELECT
      pk.table_schema AS "tableSchema",
      pk.table_name AS "tableName",
      pk.column_name AS "columnName",
      seq_ns.nspname AS "sequenceSchema",
      seq.relname AS "sequenceName",
      pg_seq.last_value::text AS "lastValue"
    FROM primary_key_columns AS pk
    JOIN pg_class AS seq
      ON seq.oid = pg_get_serial_sequence(
        format('%I.%I', pk.table_schema, pk.table_name),
        pk.column_name
      )::regclass
    JOIN pg_namespace AS seq_ns ON seq_ns.oid = seq.relnamespace
    LEFT JOIN pg_sequences AS pg_seq
      ON pg_seq.schemaname = seq_ns.nspname
     AND pg_seq.sequencename = seq.relname
    ORDER BY pk.table_name, pk.column_name;
  `);

  let repaired = 0;
  let preserved = 0;

  for (const candidate of candidatesResult.rows) {
    const table = `${quoteIdentifier(candidate.tableSchema)}.${quoteIdentifier(candidate.tableName)}`;
    const column = quoteIdentifier(candidate.columnName);
    const sequence = `${candidate.sequenceSchema}.${candidate.sequenceName}`;

    let maxResult;
    try {
      maxResult = await client.query<{ maxId: string | null }>(
        `SELECT MAX(${column})::text AS "maxId" FROM ${table}`,
      );
    } catch (error) {
      throw new Error(
        `Could not inspect ${table}.${candidate.columnName} for sequence ${sequence}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const maxId = parseInteger(maxResult.rows[0]?.maxId ?? null, `MAX(${table}.${candidate.columnName})`);
    const lastValue = parseInteger(candidate.lastValue, `${sequence}.last_value`);

    // No row means there is no safe target to raise to. In particular, never
    // call setval() with a lower value just because a table is empty.
    if (maxId === null) {
      preserved += 1;
      emit({
        level: 'info',
        message: `sequence compatibility: ${sequence} preserved (table empty)`,
        timestamp: now(),
      });
      continue;
    }

    if (lastValue !== null && lastValue >= maxId) {
      preserved += 1;
      emit({
        level: 'info',
        message: `sequence compatibility: ${sequence} preserved (current=${lastValue}, max=${maxId})`,
        timestamp: now(),
      });
      continue;
    }

    await client.query(
      'SELECT setval($1::regclass, $2::bigint, true)',
      [sequence, maxId.toString()],
    );
    repaired += 1;
    emit({
      level: 'success',
      message: `sequence compatibility: ${sequence} advanced from ${
        lastValue?.toString() ?? 'NULL'
      } to MAX(${candidate.tableName}.${candidate.columnName})=${maxId}; next id=${maxId + 1n}`,
      timestamp: now(),
    });
  }

  emit({
    level: 'info',
    message: `sequence compatibility complete: inspected=${candidatesResult.rows.length}, repaired=${repaired}, preserved=${preserved}`,
    timestamp: now(),
  });

  return {
    inspected: candidatesResult.rows.length,
    repaired,
    preserved,
  };
}