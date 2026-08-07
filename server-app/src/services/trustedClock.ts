import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { getOnesoftDataDir } from '../lib/deviceId.js';
import {
  zatcaClockEvents,
  zatcaClockPolicy,
  zatcaClockStates,
  zatcaInvoiceTransactions,
} from '../schema.js';

export type TrustedClockStatus = 'trusted' | 'stale' | 'suspicious';
export type TrustedClockEvent =
  | 'CLOCK_ROLLBACK'
  | 'CLOCK_FORWARD_JUMP'
  | 'CLOCK_UNTRUSTED'
  | 'RESTORE_SUSPECTED'
  | 'ZATCA_CHAIN_REVIEW_REQUIRED'
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
  version: 1;
  orgId: number;
  posUnitId: number;
  lastTrustedTime: string | null;
  lastIssuedAt: string | null;
  lastInvoiceCounter: number | null;
  lastInvoiceHash: string | null;
  lastInvoiceUuid: string | null;
};

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
  databaseLastInvoiceHash?: string | null;
  databaseLastInvoiceUuid?: string | null;
};

export type ClockEvaluation =
  | { allowed: true; status: TrustedClockStatus; timestamp: Date; source: TrustedIssuance['source'] }
  | { allowed: false; status: 'suspicious'; event: TrustedClockEvent; reason: string };

const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;
const FORWARD_JUMP_MS = 5 * 60 * 1000;
const REMOTE_TIMEOUT_MS = 1200;

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

async function readDurableRecord(orgId: number, posUnitId: number): Promise<DurableClockRecord | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(clockFile(orgId, posUnitId), 'utf8')) as DurableClockRecord;
    if (parsed?.version !== 1 || parsed.orgId !== orgId || parsed.posUnitId !== posUnitId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDurableRecord(record: DurableClockRecord): Promise<void> {
  const file = clockFile(record.orgId, record.posUnitId);
  const dir = path.dirname(file);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(record), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
}

async function fetchTrustedNetworkTime(): Promise<Date | null> {
  const url = process.env.TRUSTED_CLOCK_URL?.trim() || 'https://time.cloudflare.com/cdn-cgi/trace';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json, text/plain' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.text()).trim();
    const traceTimestamp = body.match(/(?:^|\n)ts=([0-9]+(?:\.[0-9]+)?)(?:\n|$)/)?.[1];
    const candidates = [
      body,
      (() => {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          const unix = parsed.unixtime ?? parsed.unixtimestamp ?? parsed.ts;
          return unix != null ? new Date(Number(unix) * 1000).toISOString() : String(
            parsed.utc_datetime ?? parsed.datetime ?? parsed.utc ?? parsed.time ?? '',
          );
        } catch {
          return '';
        }
      })(),
      traceTimestamp ? new Date(Number(traceTimestamp) * 1000).toISOString() : '',
    ];
    for (const candidate of candidates) {
      const date = asDate(candidate);
      if (date) return date;
    }
    return null;
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
  const existingTimestamp = asDate(input.existingIssueTimestamp);
  if (existingTimestamp) {
    return { timestamp: existingTimestamp, source: 'persisted', status: 'trusted' };
  }

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
    if (persistedInvoiceTimestamp) {
      return { timestamp: persistedInvoiceTimestamp, source: 'persisted' as const, status: 'trusted' as const };
    }
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
    if (state?.clockStatus === 'suspicious') {
      const reason = 'وحدة نقطة البيع في حالة اشتباه محفوظة؛ يلزم مراجعة سلسلة ZATCA قبل استئناف الإصدار.';
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
        metadata: { source: 'persisted_state' },
      });
      throw new TrustedClockError('ZATCA_CHAIN_REVIEW_REQUIRED', reason);
    }
    const durable = await readDurableRecord(input.orgId, input.posUnitId);
    const [chain] = input.deviceId == null
      ? [{ invoiceCounter: null as number | null, invoiceHash: null as string | null, invoiceUuid: null as string | null }]
      : await tx.select({
          invoiceCounter: zatcaInvoiceTransactions.invoiceCounter,
          invoiceHash: zatcaInvoiceTransactions.invoiceHash,
          invoiceUuid: zatcaInvoiceTransactions.invoiceUuid,
        }).from(zatcaInvoiceTransactions).where(and(
          eq(zatcaInvoiceTransactions.orgId, input.orgId),
          eq(zatcaInvoiceTransactions.deviceId, input.deviceId),
          eq(zatcaInvoiceTransactions.isActive, true),
          eq(zatcaInvoiceTransactions.isDeleted, false),
        )).orderBy(desc(zatcaInvoiceTransactions.invoiceCounter)).limit(1);
    const databaseLastInvoiceCounter = chain?.invoiceCounter
      ?? state?.lastInvoiceCounter
      ?? input.existingInvoiceCounter
      ?? null;
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
      databaseLastInvoiceCounter,
      databaseLastInvoiceHash: chain?.invoiceHash ?? state?.lastInvoiceHash ?? null,
      databaseLastInvoiceUuid: chain?.invoiceUuid?.toString() ?? state?.lastInvoiceUuid ?? null,
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

    const timestamp = evaluation.timestamp;
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
    updatedAt: new Date(),
  }).where(eq(zatcaClockStates.id, state.id));
  await writeDurableRecord({
    version: 1,
    orgId: input.orgId,
    posUnitId: input.posUnitId,
    lastTrustedTime: state.lastTrustedTime?.toISOString() ?? null,
    lastIssuedAt: state.lastIssuedAt?.toISOString() ?? null,
    lastInvoiceCounter: input.invoiceCounter,
    lastInvoiceHash: input.invoiceHash,
    lastInvoiceUuid: input.invoiceUuid,
  });
}