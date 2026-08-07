import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { getOnesoftDataDir } from '../lib/deviceId.js';
import {
  zatcaClockEvents,
  zatcaClockPolicy,
  zatcaClockStates,
  zatcaInvoiceTransactions,
  zatcaDevices,
  salesInvoices,
} from '../schema.js';

export type TrustedClockStatus = 'trusted' | 'stale' | 'suspicious';
export type TrustedClockEvent =
  | 'CLOCK_ROLLBACK'
  | 'CLOCK_FORWARD_JUMP'
  | 'CLOCK_UNTRUSTED'
  | 'RESTORE_SUSPECTED'
  | 'ZATCA_CHAIN_REVIEW_REQUIRED'
  | 'CHECKPOINT_MISSING'
  | 'CHECKPOINT_INTEGRITY_FAILED'
  | 'CLOCK_RECHECK_PASSED'
  | 'ISSUANCE_RESERVED';

export class TrustedClockError extends Error {
  constructor(
    public readonly code: TrustedClockEvent,
    message: string,
  ) {
    super(message);
    this.name = 'TrustedClockError';
  }
}

export type TrustedIssuance = {
  timestamp: Date;
  source: 'https' | 'monotonic' | 'system_initial' | 'persisted';
  status: TrustedClockStatus;
};

type DurableClockRecord = {
  version: 2;
  orgId: number;
  posUnitId: number;
  lastTrustedTime: string | null;
  lastIssuedAt: string | null;
  lastInvoiceCounter: number | null;
  lastInvoiceHash: string | null;
  lastInvoiceUuid: string | null;
  lastPih: string | null;
  hmac: string;
};

type DurableReadResult =
  | { status: 'ok'; record: DurableClockRecord }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string };

export type ClockEvaluationInput = {
  wallNow: Date;
  lastTrustedTime?: Date | null;
  lastIssuedAt?: Date | null;
  lastObservedWallTime?: Date | null;
  monotonicElapsedMs?: number | null;
  monotonicSinceObservedMs?: number | null;
  remoteTime?: Date | null;
  durableLastIssuedAt?: Date | null;
  durableLastInvoiceCounter?: number | null;
  databaseLastInvoiceCounter?: number | null;
  durableLastInvoiceHash?: string | null;
  durableLastInvoiceUuid?: string | null;
  durableLastPih?: string | null;
  databaseLastInvoiceHash?: string | null;
  databaseLastInvoiceUuid?: string | null;
  databaseLastPih?: string | null;
};

export type ClockEvaluation =
  | { allowed: true; status: TrustedClockStatus; timestamp: Date; source: TrustedIssuance['source'] }
  | { allowed: false; status: 'suspicious'; event: TrustedClockEvent; reason: string };

export type CheckpointStatus = DurableReadResult['status'];

export function isTrustedClockDocumentType(invoiceType: string | null | undefined): boolean {
  return invoiceType === 'sale'
    || invoiceType === 'return'
    || invoiceType === 'credit_note'
    || invoiceType === 'debit_note';
}

const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;
const FORWARD_JUMP_MS = 5 * 60 * 1000;
const REMOTE_TIMEOUT_MS = 1200;
const TRUSTED_CLOCK_URL = 'https://time.cloudflare.com/cdn-cgi/trace';

// Monotonic time is process-local by design. The durable record handles
// restarts and backup restores; this baseline handles wall-clock edits while
// the backend remains running.
const processBaselines = new Map<string, { wall: number; monotonic: number }>();

function key(orgId: number, posUnitId: number): string {
  return `${orgId}:${posUnitId}`;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clockFile(orgId: number, posUnitId: number): string {
  return path.join(getOnesoftDataDir(), 'zatca-clock', `${orgId}-${posUnitId}.json`);
}

function checkpointKeyFile(): string {
  return path.join(getOnesoftDataDir(), 'zatca-clock', 'hmac.key');
}

function checkpointKey(): Buffer | null {
  // Tests may inject a deterministic key. Production never uses SESSION_SECRET
  // for signing; the production key is generated once and kept in machine-level
  // OneSoft data that survives application updates and normal reinstalls.
  if (process.env.NODE_ENV === 'test' && process.env.TRUSTED_CLOCK_HMAC_KEY?.trim()) {
    const configured = process.env.TRUSTED_CLOCK_HMAC_KEY.trim();
    if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
    return null;
  }

  const file = checkpointKeyFile();
  try {
    const existing = fsSync.readFileSync(file, 'utf8').trim();
    if (/^[a-f0-9]{64}$/i.test(existing)) return Buffer.from(existing, 'hex');
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') return null;
  }

  try {
    fsSync.mkdirSync(path.dirname(file), { recursive: true });
    const key = crypto.randomBytes(32);
    const fd = fsSync.openSync(file, 'wx', 0o600);
    try {
      fsSync.writeFileSync(fd, key.toString('hex'), { encoding: 'utf8' });
    } finally {
      fsSync.closeSync(fd);
    }
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') return null;
    try {
      const existing = fsSync.readFileSync(file, 'utf8').trim();
      return /^[a-f0-9]{64}$/i.test(existing) ? Buffer.from(existing, 'hex') : null;
    } catch {
      return null;
    }
  }
}

function legacyCheckpointKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) return null;
  return crypto.createHash('sha256').update(`onesoft-zatca-clock:v2:${secret}`).digest();
}

function checkpointPayload(record: Omit<DurableClockRecord, 'hmac'>): string {
  return JSON.stringify({
    version: record.version,
    orgId: record.orgId,
    posUnitId: record.posUnitId,
    lastTrustedTime: record.lastTrustedTime,
    lastIssuedAt: record.lastIssuedAt,
    lastInvoiceCounter: record.lastInvoiceCounter,
    lastInvoiceHash: record.lastInvoiceHash,
    lastInvoiceUuid: record.lastInvoiceUuid,
    lastPih: record.lastPih,
  });
}

function checkpointHmac(record: Omit<DurableClockRecord, 'hmac'>): string | null {
  const key = checkpointKey();
  if (!key) return null;
  return crypto.createHmac('sha256', key).update(checkpointPayload(record)).digest('hex');
}

function checkpointHmacWithKey(record: Omit<DurableClockRecord, 'hmac'>, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(checkpointPayload(record)).digest('hex');
}

export function checkpointIntegrity(record: Omit<DurableClockRecord, 'hmac'>, hmac: string): boolean {
  const expected = checkpointHmac(record);
  return Boolean(expected)
    && expected.length === hmac.length
    && crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(hmac, 'utf8'));
}

export function checkpointNeedsReview(
  status: CheckpointStatus,
  hasDatabaseChain: boolean,
): TrustedClockEvent | null {
  if (status === 'invalid') return 'CHECKPOINT_INTEGRITY_FAILED';
  if (status === 'missing' && hasDatabaseChain) return 'CHECKPOINT_MISSING';
  return null;
}

export function parseCloudflareTraceTimestamp(body: string): Date | null {
  const lines = body.split(/\r?\n/).filter(Boolean);
  const timestampLines = lines.filter((candidate) => candidate.startsWith('ts='));
  const line = timestampLines[0];
  if (
    lines.length === 0
    || timestampLines.length !== 1
    || !lines.every((candidate) => /^[a-z][a-z0-9_]*=.*$/.test(candidate))
    || !line
    || !/^ts=[0-9]+(?:\.[0-9]+)?$/.test(line)
  ) return null;
  const seconds = Number(line.slice(3));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readDurableRecord(orgId: number, posUnitId: number): Promise<DurableReadResult> {
  const key = checkpointKey();
  if (!key) return { status: 'invalid', reason: 'مفتاح ZATCA Clock HMAC غير متوفر للتحقق من checkpoint.' };
  try {
    const parsed = JSON.parse(await fs.readFile(clockFile(orgId, posUnitId), 'utf8')) as DurableClockRecord;
    if (parsed?.version !== 2 || parsed.orgId !== orgId || parsed.posUnitId !== posUnitId || typeof parsed.hmac !== 'string') {
      return { status: 'invalid', reason: 'نسخة checkpoint أو هويته غير صالحة.' };
    }
    const { hmac, ...payload } = parsed;
    if (!checkpointIntegrity(payload, hmac)) {
      // One-time compatibility bridge for checkpoints written by the previous
      // implementation. SESSION_SECRET is used only to verify and re-sign the
      // record with the independent persistent key; it is never used for new
      // checkpoint signatures.
      const legacyKey = legacyCheckpointKey();
      const legacyHmac = legacyKey ? checkpointHmacWithKey(payload, legacyKey) : null;
      if (!legacyHmac
        || legacyHmac.length !== hmac.length
        || !crypto.timingSafeEqual(Buffer.from(legacyHmac, 'utf8'), Buffer.from(hmac, 'utf8'))) {
        return { status: 'invalid', reason: 'فشل التحقق من سلامة checkpoint.' };
      }
      await writeDurableRecord(payload);
      const migrated = JSON.parse(await fs.readFile(clockFile(orgId, posUnitId), 'utf8')) as DurableClockRecord;
      return { status: 'ok', record: migrated };
    }
    return { status: 'ok', record: parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { status: 'missing' };
    return { status: 'invalid', reason: 'تعذر قراءة checkpoint.' };
  }
}

async function writeDurableRecord(record: Omit<DurableClockRecord, 'hmac'>): Promise<void> {
  if (!checkpointKey()) throw new TrustedClockError('CHECKPOINT_INTEGRITY_FAILED', 'مفتاح ZATCA Clock HMAC غير متوفر لحماية checkpoint.');
  const payload = {
    version: record.version,
    orgId: record.orgId,
    posUnitId: record.posUnitId,
    lastTrustedTime: record.lastTrustedTime,
    lastIssuedAt: record.lastIssuedAt,
    lastInvoiceCounter: record.lastInvoiceCounter,
    lastInvoiceHash: record.lastInvoiceHash,
    lastInvoiceUuid: record.lastInvoiceUuid,
    lastPih: record.lastPih,
  };
  const hmac = checkpointHmac(payload);
  if (!hmac) throw new TrustedClockError('CHECKPOINT_INTEGRITY_FAILED', 'تعذر توقيع checkpoint بمفتاح حماية مستقل.');
  const signedRecord: DurableClockRecord = { ...payload, hmac };
  const file = clockFile(signedRecord.orgId, signedRecord.posUnitId);
  const dir = path.dirname(file);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(signedRecord), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
}

async function fetchTrustedNetworkTime(): Promise<Date | null> {
  const url = process.env.NODE_ENV === 'test'
    ? process.env.TRUSTED_CLOCK_URL?.trim() || TRUSTED_CLOCK_URL
    : TRUSTED_CLOCK_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json, text/plain' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseCloudflareTraceTimestamp(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function evaluateTrustedClock(input: ClockEvaluationInput): ClockEvaluation {
  const wallMs = input.wallNow.getTime();
  const lastTrustedMs = input.lastTrustedTime?.getTime() ?? null;
  const lastIssuedMs = input.lastIssuedAt?.getTime() ?? null;
  const durableIssuedMs = input.durableLastIssuedAt?.getTime() ?? null;

  if (
    input.durableLastInvoiceCounter != null
    && input.durableLastInvoiceCounter > 0
    && (input.databaseLastInvoiceCounter == null
      || input.durableLastInvoiceCounter !== input.databaseLastInvoiceCounter)
  ) {
    return {
      allowed: false,
      status: 'suspicious',
      event: 'RESTORE_SUSPECTED',
      reason: 'تم اكتشاف اختلاف بين عداد سجل الساعة المحلي وعداد سلسلة قاعدة البيانات؛ قد تكون قاعدة البيانات أو ملفات الجهاز استُعيدت من نسخة أقدم.',
    };
  }
  if (
    input.durableLastInvoiceCounter != null
    && input.databaseLastInvoiceCounter != null
    && input.durableLastInvoiceCounter === input.databaseLastInvoiceCounter
    && (
      input.durableLastInvoiceHash !== input.databaseLastInvoiceHash
      || input.durableLastInvoiceUuid !== input.databaseLastInvoiceUuid
      || input.durableLastPih !== input.databaseLastPih
    )
  ) {
    return {
      allowed: false,
      status: 'suspicious',
      event: 'ZATCA_CHAIN_REVIEW_REQUIRED',
      reason: 'عداد السلسلة متطابق لكن بصمة آخر فاتورة لا تتطابق بين سجل الساعة وقاعدة البيانات.',
    };
  }

  const remoteMs = input.remoteTime?.getTime() ?? null;
  if (remoteMs != null && Math.abs(wallMs - remoteMs) > CLOCK_TOLERANCE_MS) {
    const event = wallMs < remoteMs ? 'CLOCK_ROLLBACK' : 'CLOCK_FORWARD_JUMP';
    return {
      allowed: false,
      status: 'suspicious',
      event,
      reason: event === 'CLOCK_ROLLBACK'
        ? 'تاريخ ووقت الجهاز أقدم من مصدر الوقت الموثوق.'
        : 'تاريخ ووقت الجهاز متقدم بشكل غير طبيعي عن مصدر الوقت الموثوق.',
    };
  }

  if (lastIssuedMs != null && wallMs < lastIssuedMs - CLOCK_TOLERANCE_MS) {
    return {
      allowed: false,
      status: 'suspicious',
      event: 'CLOCK_ROLLBACK',
      reason: 'تاريخ ووقت الجهاز أقدم من آخر مستند ZATCA صادر على وحدة نقطة البيع.',
    };
  }
  if (durableIssuedMs != null && wallMs < durableIssuedMs - CLOCK_TOLERANCE_MS) {
    return {
      allowed: false,
      status: 'suspicious',
      event: 'CLOCK_ROLLBACK',
      reason: 'تاريخ ووقت الجهاز أقدم من آخر وقت إصدار محفوظ خارج قاعدة البيانات.',
    };
  }

  if (input.monotonicSinceObservedMs != null && input.lastObservedWallTime) {
    const wallDelta = wallMs - input.lastObservedWallTime.getTime();
    const drift = wallDelta - input.monotonicSinceObservedMs;
    if (drift < -CLOCK_TOLERANCE_MS) {
      return {
        allowed: false,
        status: 'suspicious',
        event: 'CLOCK_ROLLBACK',
        reason: 'تم اكتشاف رجوع ساعة Windows مقارنة بالساعة monotonic أثناء تشغيل الخادم.',
      };
    }
    if (drift > FORWARD_JUMP_MS) {
      return {
        allowed: false,
        status: 'suspicious',
        event: 'CLOCK_FORWARD_JUMP',
        reason: 'تم اكتشاف قفزة كبيرة إلى الأمام في ساعة Windows.',
      };
    }
  }

  // A backend wall clock is not a trusted source on its own. The first
  // issuance must establish a network anchor, and an offline process restart
  // cannot safely advance the anchor because monotonic time is process-local.
  if (!input.remoteTime && (lastTrustedMs == null || input.monotonicElapsedMs == null)) {
    return {
      allowed: false,
      status: 'suspicious',
      event: 'CLOCK_UNTRUSTED',
      reason: 'لم يتم تأسيس وقت موثوق بعد، ولا يمكن الاعتماد على ساعة الخادم وحدها لأول إصدار.',
    };
  }

  const timestamp = input.remoteTime
    ?? (lastTrustedMs != null && input.monotonicElapsedMs != null
      ? new Date(lastTrustedMs + Math.max(0, input.monotonicElapsedMs))
      : input.wallNow);
  if (lastIssuedMs != null && timestamp.getTime() < lastIssuedMs) {
    return {
      allowed: false,
      status: 'suspicious',
      event: 'CLOCK_ROLLBACK',
      reason: 'وقت الإصدار الجديد أقدم من آخر وقت إصدار محفوظ.',
    };
  }

  return {
    allowed: true,
    status: input.remoteTime ? 'trusted' : lastTrustedMs != null ? 'stale' : 'stale',
    timestamp,
    source: input.remoteTime
      ? 'https'
      : lastTrustedMs != null && input.monotonicElapsedMs != null
        ? 'monotonic'
        : 'system_initial',
  };
}

/**
 * Compliance fixtures use the same clock validation/evaluation engine but do
 * not create a POS state, durable issuance checkpoint, or commercial invoice
 * timestamp. This keeps the test chain isolated from live issuance.
 */
export async function trustedTimeForIsolatedFixture(): Promise<TrustedIssuance> {
  const wallNow = new Date();
  const remoteTime = await fetchTrustedNetworkTime();
  const evaluation = evaluateTrustedClock({ wallNow, remoteTime });
  if (!evaluation.allowed) {
    const denied = evaluation as Extract<ClockEvaluation, { allowed: false }>;
    throw new TrustedClockError(denied.event, 'تعذر الحصول على وقت موثوق لاختبار المطابقة.');
  }
  return {
    timestamp: evaluation.timestamp,
    source: evaluation.source,
    status: evaluation.status,
  };
}

export async function reserveTrustedIssuance(input: {
  orgId: number;
  posUnitId: number;
  invoiceId: number;
  userId: number;
  deviceId?: number | null;
  existingIssueTimestamp?: Date | string | null;
  existingInvoiceCounter?: number | null;
  invoiceCreatedAt?: Date | string | null;
  requestedWallTime?: Date;
}): Promise<TrustedIssuance> {
  const unitKey = key(input.orgId, input.posUnitId);
  const baseline = processBaselines.get(unitKey);
  const wallNow = input.requestedWallTime ? new Date(input.requestedWallTime) : new Date();
  const monotonicNow = performance.now();
  const monotonicElapsedMs = baseline ? Math.max(0, monotonicNow - baseline.monotonic) : null;
  const monotonicSinceObservedMs = baseline ? Math.max(0, monotonicNow - baseline.monotonic) : null;
  const processObservedWallTime = baseline ? new Date(baseline.wall) : null;
  processBaselines.set(unitKey, { wall: wallNow.getTime(), monotonic: monotonicNow });
  const remoteTime = await fetchTrustedNetworkTime();

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${unitKey}, 0))`);
    // Lock the invoice row in the same transaction as the POS clock state.
    // Two concurrent submissions must observe the same immutable timestamp.
    const lockedInvoice = await tx.execute(sql`
      SELECT zatca_issue_timestamp
      FROM sales_invoices
      WHERE id = ${input.invoiceId} AND org_id = ${input.orgId}
      FOR UPDATE
    `);
    const persistedInvoiceTimestamp = asDate(
      (lockedInvoice.rows[0] as { zatca_issue_timestamp?: Date | string | null } | undefined)
        ?.zatca_issue_timestamp,
    );
    const [policy] = await tx.select().from(zatcaClockPolicy).where(eq(zatcaClockPolicy.id, 1)).limit(1);
    const createdAt = asDate(input.invoiceCreatedAt);
    if (policy?.activatedAt && createdAt && createdAt < policy.activatedAt) {
      throw new TrustedClockError(
        'CLOCK_UNTRUSTED',
        'لا يمكن إصدار مستند ZATCA قديم بعد تفعيل حماية TrustedClock؛ لم يتم تعديل المستند القديم.',
      );
    }
    const [state] = await tx.select().from(zatcaClockStates).where(and(
      eq(zatcaClockStates.orgId, input.orgId),
      eq(zatcaClockStates.posUnitId, input.posUnitId),
    )).limit(1);
    const durableResult = await readDurableRecord(input.orgId, input.posUnitId);
    const [chain] = input.deviceId == null
      ? [{ invoiceCounter: null as number | null, invoiceHash: null as string | null, invoiceUuid: null as string | null, pih: null as string | null }]
      : await tx.select({
          invoiceCounter: zatcaInvoiceTransactions.invoiceCounter,
          invoiceHash: zatcaInvoiceTransactions.invoiceHash,
          invoiceUuid: zatcaInvoiceTransactions.invoiceUuid,
          pih: salesInvoices.zatcaPih,
        }).from(zatcaInvoiceTransactions).where(and(
          eq(zatcaInvoiceTransactions.orgId, input.orgId),
          eq(zatcaInvoiceTransactions.deviceId, input.deviceId),
          eq(zatcaInvoiceTransactions.isActive, true),
          eq(zatcaInvoiceTransactions.isDeleted, false),
        )).leftJoin(salesInvoices, eq(salesInvoices.id, zatcaInvoiceTransactions.invoiceId))
        .orderBy(desc(zatcaInvoiceTransactions.invoiceCounter)).limit(1);
    const databaseLastInvoiceCounter = chain?.invoiceCounter
      ?? state?.lastInvoiceCounter
      ?? input.existingInvoiceCounter
      ?? null;
    const durable = durableResult.status === 'ok' ? durableResult.record : null;
    const databaseLastPih = chain?.pih ?? state?.lastPih ?? null;

    const latestEvent = await tx.query.zatcaClockEvents.findFirst({
      where: and(
        eq(zatcaClockEvents.orgId, input.orgId),
        eq(zatcaClockEvents.posUnitId, input.posUnitId),
      ),
      orderBy: desc(zatcaClockEvents.detectedAt),
    });
    const hasDatabaseChain = databaseLastInvoiceCounter != null
      && databaseLastInvoiceCounter > 0;

    const checkpointEvent = checkpointNeedsReview(durableResult.status, hasDatabaseChain);
    const checkpointProblem: { code: TrustedClockEvent; reason: string } | null = checkpointEvent
      ? {
          code: checkpointEvent,
          reason: checkpointEvent === 'CHECKPOINT_MISSING'
            ? 'اختفى checkpoint لوحدة سبق أن أصدرت مستندات ZATCA؛ لا يمكن اعتبار الوحدة جديدة.'
            : durableResult.status === 'invalid'
              ? durableResult.reason
              : 'فشل التحقق من سلامة checkpoint.',
        }
      : null;

    const hardSuspiciousEvent = latestEvent?.eventType === 'RESTORE_SUSPECTED'
      || latestEvent?.eventType === 'ZATCA_CHAIN_REVIEW_REQUIRED'
      || latestEvent?.eventType === 'CHECKPOINT_MISSING'
      || latestEvent?.eventType === 'CHECKPOINT_INTEGRITY_FAILED';

    if (state?.clockStatus === 'suspicious' && hardSuspiciousEvent) {
      const reason = 'وحدة نقطة البيع في حالة اشتباه بسبب تعارض سلسلة أو سلامة checkpoint؛ يلزم إجراء مراجعة فنية.';
      await tx.insert(zatcaClockEvents).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        invoiceId: input.invoiceId,
        userId: input.userId,
        eventType: 'ZATCA_CHAIN_REVIEW_REQUIRED',
        clockStatus: 'suspicious',
        detectedSystemTime: wallNow,
        trustedTime: state.lastTrustedTime,
        lastIssuedAt: state.lastIssuedAt,
        reason,
        metadata: { source: 'persisted_state', blockedBy: latestEvent?.eventType ?? null },
      });
      throw new TrustedClockError('ZATCA_CHAIN_REVIEW_REQUIRED', reason);
    }

    if (checkpointProblem) {
      await tx.insert(zatcaClockEvents).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        invoiceId: input.invoiceId,
        userId: input.userId,
        eventType: checkpointProblem.code,
        clockStatus: 'suspicious',
        detectedSystemTime: wallNow,
        trustedTime: state?.lastTrustedTime ?? null,
        lastIssuedAt: state?.lastIssuedAt ?? null,
        reason: checkpointProblem.reason,
        metadata: { source: 'local_checkpoint' },
      });
      await tx.insert(zatcaClockStates).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        clockStatus: 'suspicious',
        lastTrustedTime: state?.lastTrustedTime ?? null,
        lastTrustedTimeSource: state?.lastTrustedTimeSource ?? null,
        lastTrustedTimeCheckedAt: new Date(),
        lastObservedWallTime: wallNow,
        lastIssuedAt: state?.lastIssuedAt ?? null,
        lastInvoiceCounter: state?.lastInvoiceCounter ?? databaseLastInvoiceCounter,
        lastInvoiceHash: state?.lastInvoiceHash ?? chain?.invoiceHash ?? null,
        lastInvoiceUuid: state?.lastInvoiceUuid ?? chain?.invoiceUuid?.toString() ?? null,
        lastPih: state?.lastPih ?? databaseLastPih,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [zatcaClockStates.orgId, zatcaClockStates.posUnitId],
        set: {
          clockStatus: 'suspicious',
          lastTrustedTimeCheckedAt: new Date(),
          lastObservedWallTime: wallNow,
          updatedAt: new Date(),
        },
      });
      throw new TrustedClockError(checkpointProblem.code, checkpointProblem.reason);
    }

    const evaluation = evaluateTrustedClock({
      wallNow,
      lastTrustedTime: state?.lastTrustedTime,
      lastIssuedAt: state?.lastIssuedAt,
      lastObservedWallTime: processObservedWallTime ?? state?.lastObservedWallTime,
      monotonicElapsedMs,
      monotonicSinceObservedMs,
      remoteTime,
      durableLastIssuedAt: asDate(durable?.lastIssuedAt),
      durableLastInvoiceCounter: durable?.lastInvoiceCounter,
      durableLastInvoiceHash: durable?.lastInvoiceHash,
      durableLastInvoiceUuid: durable?.lastInvoiceUuid,
      durableLastPih: durable?.lastPih,
      databaseLastInvoiceCounter,
      databaseLastInvoiceHash: chain?.invoiceHash ?? state?.lastInvoiceHash ?? null,
      databaseLastInvoiceUuid: chain?.invoiceUuid?.toString() ?? state?.lastInvoiceUuid ?? null,
      databaseLastPih,
    });

    const checkedAt = new Date();
    if (!evaluation.allowed) {
      const denied = evaluation as Extract<ClockEvaluation, { allowed: false }>;
      await tx.insert(zatcaClockEvents).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        invoiceId: input.invoiceId,
        userId: input.userId,
        eventType: denied.event,
        clockStatus: evaluation.status,
        detectedSystemTime: wallNow,
        trustedTime: remoteTime ?? state?.lastTrustedTime ?? null,
        lastIssuedAt: state?.lastIssuedAt ?? asDate(durable?.lastIssuedAt),
        reason: denied.reason,
        metadata: { source: remoteTime ? 'https' : 'offline' },
      });
      await tx.update(zatcaClockStates).set({
        clockStatus: 'suspicious',
        lastTrustedTime: remoteTime ?? state?.lastTrustedTime ?? null,
        lastTrustedTimeSource: remoteTime ? 'https' : state?.lastTrustedTimeSource ?? 'persisted',
        lastTrustedTimeCheckedAt: checkedAt,
        lastObservedWallTime: wallNow,
        updatedAt: checkedAt,
      }).where(and(
        eq(zatcaClockStates.orgId, input.orgId),
        eq(zatcaClockStates.posUnitId, input.posUnitId),
      ));
      await tx.insert(zatcaClockStates).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        clockStatus: 'suspicious',
        lastTrustedTime: remoteTime ?? state?.lastTrustedTime ?? null,
        lastTrustedTimeSource: remoteTime ? 'https' : state?.lastTrustedTimeSource ?? 'persisted',
        lastTrustedTimeCheckedAt: checkedAt,
        lastObservedWallTime: wallNow,
        lastIssuedAt: state?.lastIssuedAt ?? asDate(durable?.lastIssuedAt),
        lastInvoiceCounter: state?.lastInvoiceCounter ?? durable?.lastInvoiceCounter ?? null,
        lastInvoiceHash: state?.lastInvoiceHash ?? durable?.lastInvoiceHash ?? null,
        lastInvoiceUuid: state?.lastInvoiceUuid ?? durable?.lastInvoiceUuid ?? null,
        lastPih: state?.lastPih ?? durable?.lastPih ?? null,
        createdAt: checkedAt,
        updatedAt: checkedAt,
      }).onConflictDoNothing();
      throw new TrustedClockError(
        denied.event,
        denied.event === 'RESTORE_SUSPECTED' || denied.event === 'ZATCA_CHAIN_REVIEW_REQUIRED'
          ? 'تم اكتشاف حالة قد تشير إلى استعادة نسخة احتياطية أقدم. يجب التحقق من سلامة سلسلة الفوترة الإلكترونية قبل الإصدار.'
          : 'تاريخ ووقت الجهاز غير متوافقين مع سجل الفوترة الإلكترونية. يرجى تصحيح تاريخ ووقت الجهاز قبل إصدار المستند.',
      );
    }

    const wasClockSuspicious = state?.clockStatus === 'suspicious'
      && (latestEvent?.eventType === 'CLOCK_ROLLBACK' || latestEvent?.eventType === 'CLOCK_FORWARD_JUMP');
    const timestamp = persistedInvoiceTimestamp ?? evaluation.timestamp;
    const issueDate = timestamp.toISOString().slice(0, 10);
    const issueTime = timestamp.toISOString().slice(11, 19);
    const nextState = {
      orgId: input.orgId,
      posUnitId: input.posUnitId,
      lastTrustedTime: timestamp,
      lastTrustedTimeSource: evaluation.source,
      lastTrustedTimeCheckedAt: checkedAt,
      clockStatus: evaluation.status,
      lastObservedWallTime: wallNow,
      lastIssuedAt: timestamp,
      lastIssueDate: issueDate,
      lastIssueTime: issueTime,
      updatedAt: checkedAt,
    };
    await tx.insert(zatcaClockStates).values({
      ...nextState,
      createdAt: checkedAt,
    }).onConflictDoUpdate({
      target: [zatcaClockStates.orgId, zatcaClockStates.posUnitId],
      set: nextState,
    });
    if (wasClockSuspicious && evaluation.source === 'https') {
      await tx.insert(zatcaClockEvents).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        invoiceId: input.invoiceId,
        userId: input.userId,
        eventType: 'CLOCK_RECHECK_PASSED',
        clockStatus: 'trusted',
        detectedSystemTime: wallNow,
        trustedTime: evaluation.timestamp,
        lastIssuedAt: state?.lastIssuedAt ?? null,
        reason: 'تم تصحيح ساعة Windows والتحقق من مصدر Cloudflare وسلامة السلسلة.',
        metadata: { source: evaluation.source },
      });
    }
    await tx.execute(sql`
      UPDATE sales_invoices
      SET zatca_issue_timestamp = ${timestamp}, updated_at = ${checkedAt}
      WHERE id = ${input.invoiceId}
        AND org_id = ${input.orgId}
        AND zatca_issue_timestamp IS NULL
    `);
    await tx.insert(zatcaClockEvents).values({
      orgId: input.orgId,
      posUnitId: input.posUnitId,
      invoiceId: input.invoiceId,
      userId: input.userId,
      eventType: 'ISSUANCE_RESERVED',
      clockStatus: evaluation.status,
      detectedSystemTime: wallNow,
      trustedTime: timestamp,
      lastIssuedAt: timestamp,
      reason: 'تم حجز وقت إصدار ZATCA من TrustedClock قبل بناء XML.',
      metadata: { source: evaluation.source, issueDate, issueTime },
    });
    return { timestamp, source: evaluation.source, status: evaluation.status };
  });
}

export async function commitTrustedIssuance(input: {
  orgId: number;
  posUnitId: number;
  invoiceCounter: number;
  invoiceHash: string;
  invoiceUuid: string;
  lastPih: string | null;
}): Promise<void> {
  const [state] = await db.select().from(zatcaClockStates).where(and(
    eq(zatcaClockStates.orgId, input.orgId),
    eq(zatcaClockStates.posUnitId, input.posUnitId),
  )).limit(1);
  if (!state) return;
  await db.update(zatcaClockStates).set({
    lastInvoiceCounter: input.invoiceCounter,
    lastInvoiceHash: input.invoiceHash,
    lastInvoiceUuid: input.invoiceUuid,
    lastPih: input.lastPih,
    updatedAt: new Date(),
  }).where(eq(zatcaClockStates.id, state.id));
  await writeDurableRecord({
    version: 2,
    orgId: input.orgId,
    posUnitId: input.posUnitId,
    lastTrustedTime: state.lastTrustedTime?.toISOString() ?? null,
    lastIssuedAt: state.lastIssuedAt?.toISOString() ?? null,
    lastInvoiceCounter: input.invoiceCounter,
    lastInvoiceHash: input.invoiceHash,
    lastInvoiceUuid: input.invoiceUuid,
    lastPih: input.lastPih,
  });
}

export async function recheckTrustedClock(input: {
  orgId: number;
  posUnitId: number;
  userId: number;
}): Promise<{
  ok: true;
  status: 'trusted';
  source: 'https';
  event: 'CLOCK_RECHECK_PASSED';
} | {
  ok: false;
  status: 'blocked';
  code: TrustedClockEvent;
  message: string;
}> {
  const unitKey = key(input.orgId, input.posUnitId);
  const wallNow = new Date();
  const remoteTime = await fetchTrustedNetworkTime();
  if (!remoteTime) {
    return {
      ok: false,
      status: 'blocked',
      code: 'CLOCK_UNTRUSTED',
      message: 'تعذر الحصول على Trusted Time جديد من Cloudflare؛ لم يتم فك حالة الحظر.',
    };
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${unitKey}, 0))`);
    const [state] = await tx.select().from(zatcaClockStates).where(and(
      eq(zatcaClockStates.orgId, input.orgId),
      eq(zatcaClockStates.posUnitId, input.posUnitId),
    )).limit(1);
    if (!state) {
      return { ok: false as const, status: 'blocked' as const, code: 'CLOCK_UNTRUSTED' as const, message: 'لا توجد حالة TrustedClock لهذه الوحدة.' };
    }

    const [chain] = await tx.select({
      invoiceCounter: zatcaInvoiceTransactions.invoiceCounter,
      invoiceHash: zatcaInvoiceTransactions.invoiceHash,
      invoiceUuid: zatcaInvoiceTransactions.invoiceUuid,
      pih: salesInvoices.zatcaPih,
    }).from(zatcaInvoiceTransactions)
      .innerJoin(zatcaDevices, eq(zatcaDevices.id, zatcaInvoiceTransactions.deviceId))
      .leftJoin(salesInvoices, eq(salesInvoices.id, zatcaInvoiceTransactions.invoiceId))
      .where(and(
        eq(zatcaInvoiceTransactions.orgId, input.orgId),
        eq(zatcaDevices.posUnitId, input.posUnitId),
        eq(zatcaInvoiceTransactions.isActive, true),
        eq(zatcaInvoiceTransactions.isDeleted, false),
      ))
      .orderBy(desc(zatcaInvoiceTransactions.invoiceCounter))
      .limit(1);

    const databaseLastInvoiceCounter = chain?.invoiceCounter ?? state.lastInvoiceCounter ?? null;
    const hasDatabaseChain = databaseLastInvoiceCounter != null
      && databaseLastInvoiceCounter > 0;
    const durableResult = await readDurableRecord(input.orgId, input.posUnitId);
    const checkpointEvent = checkpointNeedsReview(durableResult.status, hasDatabaseChain);
    if (checkpointEvent) {
      const message = checkpointEvent === 'CHECKPOINT_MISSING'
        ? 'اختفى checkpoint لوحدة سبق أن أصدرت مستندات ZATCA.'
        : durableResult.status === 'invalid'
          ? durableResult.reason
          : 'فشل التحقق من سلامة checkpoint.';
      await tx.insert(zatcaClockEvents).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        userId: input.userId,
        eventType: checkpointEvent,
        clockStatus: 'suspicious',
        detectedSystemTime: wallNow,
        trustedTime: remoteTime,
        lastIssuedAt: state.lastIssuedAt,
        reason: message,
        metadata: { source: 'recheck' },
      });
      await tx.update(zatcaClockStates).set({
        clockStatus: 'suspicious',
        lastTrustedTimeCheckedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(zatcaClockStates.id, state.id));
      return { ok: false as const, status: 'blocked' as const, code: checkpointEvent, message };
    }

    const durable = durableResult.status === 'ok' ? durableResult.record : null;
    const latestEvent = await tx.query.zatcaClockEvents.findFirst({
      where: and(
        eq(zatcaClockEvents.orgId, input.orgId),
        eq(zatcaClockEvents.posUnitId, input.posUnitId),
      ),
      orderBy: desc(zatcaClockEvents.detectedAt),
    });
    const evaluation = evaluateTrustedClock({
      wallNow,
      lastTrustedTime: state.lastTrustedTime,
      lastIssuedAt: state.lastIssuedAt,
      remoteTime,
      durableLastIssuedAt: asDate(durable?.lastIssuedAt),
      durableLastInvoiceCounter: durable?.lastInvoiceCounter,
      durableLastInvoiceHash: durable?.lastInvoiceHash,
      durableLastInvoiceUuid: durable?.lastInvoiceUuid,
      durableLastPih: durable?.lastPih,
      databaseLastInvoiceCounter,
      databaseLastInvoiceHash: chain?.invoiceHash ?? state.lastInvoiceHash ?? null,
      databaseLastInvoiceUuid: chain?.invoiceUuid?.toString() ?? state.lastInvoiceUuid ?? null,
      databaseLastPih: chain?.pih ?? state.lastPih ?? null,
    });
    if (!evaluation.allowed) {
      const denied = evaluation as Extract<ClockEvaluation, { allowed: false }>;
      const hardChain = denied.event === 'RESTORE_SUSPECTED'
        || denied.event === 'ZATCA_CHAIN_REVIEW_REQUIRED';
      await tx.insert(zatcaClockEvents).values({
        orgId: input.orgId,
        posUnitId: input.posUnitId,
        userId: input.userId,
        eventType: denied.event,
        clockStatus: 'suspicious',
        detectedSystemTime: wallNow,
        trustedTime: remoteTime,
        lastIssuedAt: state.lastIssuedAt,
        reason: denied.reason,
        metadata: { source: 'recheck' },
      });
      await tx.update(zatcaClockStates).set({
        clockStatus: 'suspicious',
        lastTrustedTimeCheckedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(zatcaClockStates.id, state.id));
      return {
        ok: false as const,
        status: 'blocked' as const,
        code: hardChain ? 'ZATCA_CHAIN_REVIEW_REQUIRED' as const : denied.event,
        message: denied.reason,
      };
    }

    const lastEventWasClock = latestEvent?.eventType === 'CLOCK_ROLLBACK'
      || latestEvent?.eventType === 'CLOCK_FORWARD_JUMP';
    if (state.clockStatus === 'suspicious' && !lastEventWasClock) {
      return {
        ok: false as const,
        status: 'blocked' as const,
        code: 'ZATCA_CHAIN_REVIEW_REQUIRED' as const,
        message: 'الحالة المشبوهة ليست خطأ ساعة فقط؛ يلزم مراجعة فنية.',
      };
    }

    const checkedAt = new Date();
    await tx.update(zatcaClockStates).set({
      lastTrustedTime: evaluation.timestamp,
      lastTrustedTimeSource: 'https',
      lastTrustedTimeCheckedAt: checkedAt,
      clockStatus: 'trusted',
      lastObservedWallTime: wallNow,
      updatedAt: checkedAt,
    }).where(eq(zatcaClockStates.id, state.id));
    await tx.insert(zatcaClockEvents).values({
      orgId: input.orgId,
      posUnitId: input.posUnitId,
      userId: input.userId,
      eventType: 'CLOCK_RECHECK_PASSED',
      clockStatus: 'trusted',
      detectedSystemTime: wallNow,
      trustedTime: evaluation.timestamp,
      lastIssuedAt: state.lastIssuedAt,
      reason: 'تم تصحيح وقت النظام والتحقق من Cloudflare وسلامة سلسلة ZATCA.',
      metadata: { source: 'https' },
    });
    return { ok: true as const, status: 'trusted' as const, source: 'https' as const, event: 'CLOCK_RECHECK_PASSED' as const };
  });
}