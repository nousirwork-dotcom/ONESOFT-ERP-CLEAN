import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { createHash } from 'crypto';
import * as pg from 'pg';
import type { ProgressEvent } from '../types.js';

const { Client } = pg;
type Emit = (event: ProgressEvent) => void;

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function foundationSnapshot(serverAppPath: string): string {
  const filePath = path.join(serverAppPath, 'src', 'foundation-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return createHash('sha256').update(raw).digest('hex');
}

async function getJson(
  port: number,
  route: string,
  timeoutMs = 5_000,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${port}${route}`, { timeout: timeoutMs }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
          resolve({
            status: response.statusCode ?? 0,
            body,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('health request timed out')));
    request.on('error', reject);
  });
}

async function waitForReady(port: number, emit: Emit): Promise<void> {
  const deadline = Date.now() + 90_000;
  let last = 'لا توجد استجابة';
  while (Date.now() < deadline) {
    try {
      const result = await getJson(port, '/api/health');
      last = `HTTP ${result.status}: ${JSON.stringify(result.body)}`;
      if (result.body.status === 'migration_failed') {
        throw new Error(`الخادم أعلن فشل الترحيل${result.body.migration ? ` عند ${String(result.body.migration)}` : ''}: ${String(result.body.message ?? 'خطأ غير محدد')}`);
      }
      if (result.status === 200 && result.body.ready === true) {
        emit({ level: 'success', message: `✅ الخادم جاهز: ${last}`, timestamp: now() });
        return;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000);
  }
  throw new Error(`الخادم لم يصل إلى health=200 و ready=true خلال 90 ثانية: ${last}`);
}

async function verifyForeignKeys(client: pg.Client): Promise<string[]> {
  const constraints = await client.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(`
    SELECT
      source.relname AS table_name,
      source_att.attname AS column_name,
      target.relname AS foreign_table_name,
      target_att.attname AS foreign_column_name
    FROM pg_constraint c
    JOIN pg_class source ON source.oid = c.conrelid
    JOIN pg_class target ON target.oid = c.confrelid
    JOIN pg_attribute source_att ON source_att.attrelid = c.conrelid AND source_att.attnum = c.conkey[1]
    JOIN pg_attribute target_att ON target_att.attrelid = c.confrelid AND target_att.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND source.relnamespace = 'public'::regnamespace
      AND target.relnamespace = 'public'::regnamespace
  `);
  const broken: string[] = [];
  for (const constraint of constraints.rows) {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM public.${quoteIdent(constraint.table_name)} source
        WHERE source.${quoteIdent(constraint.column_name)} IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM public.${quoteIdent(constraint.foreign_table_name)} target
             WHERE target.${quoteIdent(constraint.foreign_column_name)}
                   = source.${quoteIdent(constraint.column_name)}
          )`,
    );
    const count = result.rows[0]?.count ?? 0;
    if (count > 0) {
      broken.push(`${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}: ${count}`);
    }
  }
  return broken;
}

async function verifyFoundation(
  client: pg.Client,
  serverAppPath: string,
  expectedSchemaVersion: string,
  emit: Emit,
): Promise<void> {
  const snapshotHash = foundationSnapshot(serverAppPath);
  const version = await client.query<{ version: string }>(
    'SELECT version FROM _schema_version WHERE id = 1',
  );
  if (version.rows[0]?.version !== expectedSchemaVersion) {
    throw new Error(`إصدار المخطط بعد الترقية غير صحيح: ${version.rows[0]?.version ?? 'مفقود'} (المطلوب ${expectedSchemaVersion})`);
  }

  const organizations = await client.query<{
    id: number;
    code: string;
    foundation_status: string;
    foundation_snapshot_hash: string | null;
  }>(`
    SELECT id, code, foundation_status, foundation_snapshot_hash
      FROM organizations
     WHERE status IN ('active', 'trial')
  `);
  if (organizations.rowCount === 0) throw new Error('لا توجد مؤسسة قابلة للتحقق بعد الترقية');

  for (const org of organizations.rows) {
    if (org.foundation_status !== 'applied' || org.foundation_snapshot_hash !== snapshotHash) {
      throw new Error(`Foundation غير مكتمل للمؤسسة ${org.code}: status=${org.foundation_status}, hash=${org.foundation_snapshot_hash ?? 'مفقود'}`);
    }

    const duplicateRows = await client.query<{ foundation_key: string; count: number }>(`
      SELECT foundation_key, COUNT(*)::int AS count
        FROM (
          SELECT foundation_key FROM warehouses WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM branches WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM document_journals WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM document_types WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM document_templates WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM units WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM product_groups WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM payment_methods WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM cost_centers WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM currencies WHERE org_id = $1 AND foundation_key IS NOT NULL
          UNION ALL SELECT foundation_key FROM posting_definitions WHERE org_id = $1 AND foundation_key IS NOT NULL
        ) records
       GROUP BY foundation_key
      HAVING COUNT(*) > 1
    `, [org.id]);
    if (duplicateRows.rowCount) {
      throw new Error(`Foundation keys مكررة في ${org.code}: ${duplicateRows.rows.map((row: { foundation_key: string }) => row.foundation_key).join(', ')}`);
    }

    for (const key of ['wh.001', 'wh.002', 'wh.003', 'wh.004']) {
      const result = await client.query(
        'SELECT id FROM warehouses WHERE org_id = $1 AND foundation_key = $2',
        [org.id, key],
      );
      if (result.rowCount !== 1) throw new Error(`المخزن ${key} مفقود أو مكرر في ${org.code}`);
    }

    for (const code of ['INV.01.', 'INV.02.', 'INV.03.', 'INV.04.']) {
      const result = await client.query<{ id: number; warehouse_id: number | null }>(
        `SELECT id, warehouse_id
           FROM document_journals
          WHERE org_id = $1 AND UPPER(code) = $2`,
        [org.id, code],
      );
      if (result.rowCount !== 1) throw new Error(`دفتر ${code} مفقود أو مكرر في ${org.code}`);
      const journal = result.rows[0]!;
      const warehouse = await client.query(
        'SELECT id FROM warehouses WHERE org_id = $1 AND id = $2',
        [org.id, journal.warehouse_id],
      );
      if (warehouse.rowCount !== 1) throw new Error(`رابط دفتر ${code} إلى مخزن غير صالح في ${org.code}`);
    }
  }

  const broken = await verifyForeignKeys(client);
  if (broken.length) throw new Error(`مفاتيح FK مكسورة: ${broken.slice(0, 10).join('; ')}`);
  emit({ level: 'success', message: `✅ تحقق Foundation والمخطط والـFK ناجح (${organizations.rowCount} مؤسسة، hash=${snapshotHash.slice(0, 12)}...)`, timestamp: now() });
}

export async function verifyPostUpgrade(opts: {
  databaseUrl: string;
  backendPort: number;
  serverAppPath: string;
  expectedSchemaVersion: string;
}, emit: Emit): Promise<void> {
  await waitForReady(opts.backendPort, emit);
  const client = new Client({ connectionString: opts.databaseUrl, connectionTimeoutMillis: 15_000 });
  await client.connect();
  try {
    await verifyFoundation(client, opts.serverAppPath, opts.expectedSchemaVersion, emit);
  } finally {
    await client.end();
  }
}

function now(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}