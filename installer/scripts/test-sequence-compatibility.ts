import type { PoolClient, QueryResult } from 'pg';
import { synchronizePrimaryKeySequences } from '../core/database/SequenceCompatibilityRepair.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

type Candidate = {
  tableSchema: string;
  tableName: string;
  columnName: string;
  sequenceSchema: string;
  sequenceName: string;
  lastValue: string | null;
};

const candidates: Candidate[] = [
  {
    tableSchema: 'public',
    tableName: 'warehouses',
    columnName: 'id',
    sequenceSchema: 'public',
    sequenceName: 'warehouses_id_seq',
    lastValue: '2',
  },
  {
    tableSchema: 'public',
    tableName: 'document_journals',
    columnName: 'id',
    sequenceSchema: 'public',
    sequenceName: 'document_journals_id_seq',
    lastValue: '42',
  },
  {
    tableSchema: 'public',
    tableName: 'sales_invoices',
    columnName: 'id',
    sequenceSchema: 'public',
    sequenceName: 'sales_invoices_id_seq',
    lastValue: '7',
  },
  {
    tableSchema: 'public',
    tableName: 'users',
    columnName: 'id',
    sequenceSchema: 'public',
    sequenceName: 'users_id_seq',
    lastValue: null,
  },
  {
    tableSchema: 'public',
    tableName: 'chart_of_accounts',
    columnName: 'id',
    sequenceSchema: 'public',
    sequenceName: 'chart_of_accounts_id_seq',
    lastValue: '99',
  },
];

const maxIds: Record<string, string> = {
  warehouses: '6',
  document_journals: '42',
  sales_invoices: '3',
  users: '12',
  chart_of_accounts: '4',
};

const setvalCalls: Array<[string, string]> = [];
const client = {
  async query<T = unknown>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    if (text.includes('primary_key_columns')) {
      return { rows: candidates, rowCount: candidates.length } as QueryResult<T>;
    }
    if (text.includes('SELECT setval')) {
      setvalCalls.push([String(values?.[0]), String(values?.[1])]);
      return { rows: [], rowCount: 1 } as QueryResult<T>;
    }
    const table = Object.keys(maxIds).find((name) => text.includes(`"public"."${name}"`));
    if (!table) throw new Error(`Unexpected SQL in test: ${text}`);
    return {
      rows: [{ maxId: maxIds[table] }],
      rowCount: 1,
    } as QueryResult<T>;
  },
} as unknown as PoolClient;

async function main(): Promise<void> {
  const events: string[] = [];
  const result = await synchronizePrimaryKeySequences(client, (event) => {
    events.push(event.message);
  });

  assert(result.inspected === 5, 'all serial/identity primary-key candidates are inspected');
  assert(result.repaired === 2, 'only stale or uninitialized sequences are repaired');
  assert(result.preserved === 3, 'ahead/equal sequences are preserved');
  assert(
    setvalCalls.some(([sequence, value]) => sequence === 'public.warehouses_id_seq' && value === '6'),
    'warehouses_id_seq advances from 2 to 6 so the next id is 7',
  );
  assert(
    setvalCalls.some(([sequence, value]) => sequence === 'public.users_id_seq' && value === '12'),
    'an uninitialized sequence is raised to the existing maximum',
  );
  assert(
    !setvalCalls.some(([sequence]) => sequence === 'public.document_journals_id_seq') &&
      !setvalCalls.some(([sequence]) => sequence === 'public.sales_invoices_id_seq') &&
      !setvalCalls.some(([sequence]) => sequence === 'public.chart_of_accounts_id_seq'),
    'sequences at or above MAX(primary key) are never lowered or rewritten',
  );
  assert(
    events.some((message) => message.includes('next id=7')),
    'repair diagnostics report the next generated warehouse id',
  );

  console.log('SEQUENCE COMPATIBILITY TESTS: PASS');
}

void main();