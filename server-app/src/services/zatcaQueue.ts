import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import {
  salesInvoices,
  zatcaErrorLog,
  zatcaInvoiceTransactions,
  zatcaEnvironments,
  zatcaLogs,
  zatcaResponseLog,
  zatcaSubmissionAttempts,
  zatcaSubmissionQueue,
} from '../schema.js';
import {
  buildMockAuthorityResponse,
  canTransitionZatcaState,
  isFinalZatcaState,
  isUncertainZatcaState,
  stateForMockOutcome,
  type ZatcaLifecycleState,
  type ZatcaMockOutcome,
  type ZatcaOperation,
} from './zatcaLifecycle.js';

type QueueRow = {
  id: number;
  org_id: number;
  transaction_id: number;
  queue_key: string;
  operation: ZatcaOperation;
  uuid: string;
  invoice_counter: number;
  idempotency_key: string;
  mock_outcome: ZatcaMockOutcome;
  locked_by: string | null;
};

const WORKER_ID = `${process.pid}:${crypto.randomUUID()}`;
const RETRY_DELAY_MS = 5 * 60 * 1000;

export async function enqueueZatcaSubmission(input: {
  orgId: number;
  transactionId: number;
  posUnitId: number;
  deviceId: number;
  operation: ZatcaOperation;
  uuid: string;
  invoiceCounter: number;
  idempotencyKey: string;
  mockOutcome: ZatcaMockOutcome;
  availableAt?: Date;
  initialState?: 'queued' | 'retry_pending' | 'uncertain';
}) {
  const existing = await db.query.zatcaSubmissionQueue.findFirst({
    where: and(
      eq(zatcaSubmissionQueue.transactionId, input.transactionId),
      eq(zatcaSubmissionQueue.orgId, input.orgId),
    ),
  });
  const state = input.initialState ?? 'queued';
  if (existing) {
    await db.update(zatcaSubmissionQueue).set({
      posUnitId: input.posUnitId ?? existing.posUnitId,
      deviceId: input.deviceId ?? existing.deviceId,
      queueKey: `org:${input.orgId}:egs:${input.deviceId}`,
      operation: input.operation,
      uuid: input.uuid,
      invoiceCounter: input.invoiceCounter,
      idempotencyKey: input.idempotencyKey,
      mockOutcome: input.mockOutcome,
      state,
      availableAt: input.availableAt ?? new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(zatcaSubmissionQueue.id, existing.id));
    return existing.id;
  }
  const [row] = await db.insert(zatcaSubmissionQueue).values({
    orgId: input.orgId,
    transactionId: input.transactionId,
    posUnitId: input.posUnitId,
    deviceId: input.deviceId,
    queueKey: `org:${input.orgId}:egs:${input.deviceId}`,
    operation: input.operation,
    uuid: input.uuid,
    invoiceCounter: input.invoiceCounter,
    idempotencyKey: input.idempotencyKey,
    mockOutcome: input.mockOutcome,
    state,
    availableAt: input.availableAt ?? new Date(),
    updatedAt: new Date(),
  }).returning({ id: zatcaSubmissionQueue.id });
  return row?.id ?? null;
}

async function claimNextQueueItem(): Promise<QueueRow | null> {
  const result = await db.execute(sql`
    WITH candidate AS (
      SELECT q.id
      FROM zatca_submission_queue q
      WHERE q.state IN ('queued', 'retry_pending')
        AND q.available_at <= now()
        AND NOT EXISTS (
          SELECT 1
          FROM zatca_submission_queue processing
          WHERE processing.queue_key = q.queue_key
            AND processing.state = 'processing'
        )
        AND pg_try_advisory_xact_lock(hashtextextended(q.queue_key, 0))
      ORDER BY q.available_at ASC, q.id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE zatca_submission_queue q
       SET state = 'processing',
           locked_at = now(),
           locked_by = ${WORKER_ID},
           updated_at = now()
     WHERE q.id = (SELECT id FROM candidate)
     RETURNING q.id, q.org_id, q.transaction_id, q.queue_key, q.operation,
               q.uuid, q.invoice_counter, q.idempotency_key, q.mock_outcome, q.locked_by
  `);
  return (result.rows[0] as QueueRow | undefined) ?? null;
}

async function processQueueItem(item: QueueRow): Promise<void> {
  await db.transaction(async (tx) => {
    const transaction = await tx.query.zatcaInvoiceTransactions.findFirst({
      where: and(
        eq(zatcaInvoiceTransactions.id, item.transaction_id),
        eq(zatcaInvoiceTransactions.orgId, item.org_id),
      ),
    });
    const invoice = await tx.query.salesInvoices.findFirst({
      where: and(
        eq(salesInvoices.id, transaction?.invoiceId ?? -1),
        eq(salesInvoices.orgId, item.org_id),
      ),
    });
    const environment = transaction?.environmentId
      ? await tx.query.zatcaEnvironments.findFirst({
          where: and(
            eq(zatcaEnvironments.id, transaction.environmentId),
            eq(zatcaEnvironments.orgId, item.org_id),
            eq(zatcaEnvironments.isActive, true),
            eq(zatcaEnvironments.isDeleted, false),
          ),
          columns: { name: true },
        })
      : null;
    if (!transaction) {
      await tx.update(zatcaSubmissionQueue).set({
        state: 'failed',
        lastError: 'معاملة ZATCA غير موجودة',
        updatedAt: new Date(),
      }).where(eq(zatcaSubmissionQueue.id, item.id));
      return;
    }

    if (environment?.name === 'Simulation') {
      await tx.update(zatcaSubmissionQueue).set({
        state: 'failed',
        lastError: 'تم منع ناقل Mock: فواتير Simulation يجب أن تمر عبر Fatoora Simulation الرسمي',
        updatedAt: new Date(),
      }).where(eq(zatcaSubmissionQueue.id, item.id));
      return;
    }

    if (isFinalZatcaState(transaction.invoiceStatus)) {
      await tx.update(zatcaSubmissionQueue).set({
        state: 'completed',
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(zatcaSubmissionQueue.id, item.id));
      return;
    }

    const now = new Date();
    const attemptNumber = (transaction.attemptCount ?? 0) + 1;
    const [attempt] = await tx.insert(zatcaSubmissionAttempts).values({
      orgId: item.org_id,
      transactionId: item.transaction_id,
      attemptNumber,
      startedAt: now,
      requestId: transaction.correlationId,
      requestPayload: transaction.requestPayload,
      result: 'started',
    }).returning({
      id: zatcaSubmissionAttempts.id,
      attemptId: zatcaSubmissionAttempts.attemptId,
    });

    const currentState = (transaction.invoiceStatus ?? 'ready_to_submit') as ZatcaLifecycleState;
    const nextState = stateForMockOutcome(item.operation, item.mock_outcome);
    if (!canTransitionZatcaState(currentState, 'submitting')
      || !canTransitionZatcaState('submitting', nextState)) {
      throw new Error(`انتقال حالة ZATCA غير مسموح: ${currentState} → ${nextState}`);
    }

    const response = buildMockAuthorityResponse({
      operation: item.operation,
      outcome: item.mock_outcome,
      uuid: item.uuid,
      icv: item.invoice_counter,
      correlationId: transaction.correlationId ?? item.idempotency_key,
      now: now.toISOString(),
    });
    const safeResponse = response as Record<string, unknown>;
    const responseDate = response.receivedAt ? new Date(response.receivedAt) : null;
    const errorText = response.errors.length
      ? response.errors.map((error) => error.message).join('، ')
      : item.mock_outcome === 'connection_loss'
        ? 'انقطع الرد بعد إرسال الطلب وقبل وصول النتيجة النهائية'
        : item.mock_outcome === 'connection_issue' ? 'تعذر الاتصال بناقل Mock' : null;
    const queueState = isFinalZatcaState(nextState)
      ? 'completed'
      : item.mock_outcome === 'connection_issue'
        ? 'retry_pending'
        : 'uncertain';

    await tx.update(zatcaInvoiceTransactions).set({
      invoiceStatus: nextState,
      invoiceUuid: item.uuid,
      invoiceCounter: item.invoice_counter,
      idempotencyKey: item.idempotency_key,
      attemptCount: attemptNumber,
      httpStatus: response.httpStatus,
      authorityStatus: response.authorityStatus,
      responsePayload: safeResponse,
      responseDate,
      uncertainAt: isUncertainZatcaState(nextState) ? now : null,
      nextRetryAt: queueState === 'retry_pending' ? new Date(now.getTime() + RETRY_DELAY_MS) : null,
      lastError: errorText,
      lastAttemptAt: now,
      updatedAt: now,
    }).where(eq(zatcaInvoiceTransactions.id, item.transaction_id));

    if (invoice) {
      await tx.update(salesInvoices).set({
        zatcaStatus: nextState,
        zatcaUuid: item.uuid,
        zatcaInvoiceCounter: item.invoice_counter,
        zatcaAttemptCount: attemptNumber,
        zatcaResponse: safeResponse,
        zatcaRejectionReason: errorText,
        zatcaClearedAt: nextState === 'cleared' || nextState === 'reported' ? responseDate : null,
        updatedAt: now,
      }).where(and(eq(salesInvoices.id, invoice.id), eq(salesInvoices.orgId, item.org_id)));
    }

    if (response.receivedAt) {
      await tx.insert(zatcaResponseLog).values({
        orgId: item.org_id,
        transactionId: item.transaction_id,
        httpStatus: response.httpStatus,
        responseBody: JSON.stringify(safeResponse),
        responseTime: responseDate ?? now,
      });
    }
    if (errorText) {
      await tx.insert(zatcaErrorLog).values({
        orgId: item.org_id,
        transactionId: item.transaction_id,
        errorCode: item.mock_outcome === 'connection_loss' ? 'RESPONSE_LOST' : 'CONNECTION_ERROR',
        errorType: 'connection',
        errorMessage: errorText,
        retryCount: attemptNumber,
      });
    }
    await tx.update(zatcaSubmissionAttempts).set({
      finishedAt: new Date(),
      httpStatus: response.httpStatus,
      responsePayload: safeResponse,
      result: nextState,
      errorMessage: errorText,
    }).where(eq(zatcaSubmissionAttempts.id, attempt.id));
    await tx.update(zatcaSubmissionQueue).set({
      state: queueState,
      availableAt: queueState === 'retry_pending' ? new Date(now.getTime() + RETRY_DELAY_MS) : now,
      attemptId: attempt.attemptId,
      lastError: errorText,
      updatedAt: now,
    }).where(eq(zatcaSubmissionQueue.id, item.id));
    await tx.insert(zatcaLogs).values({
      orgId: item.org_id,
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      eventType: 'queue_worker',
      status: nextState,
      environment: 'sandbox',
      requestBody: JSON.stringify(transaction.requestPayload ?? {}),
      responseBody: JSON.stringify(safeResponse),
      errorMessage: errorText,
    });
  });
}

export async function recoverStaleZatcaQueue(): Promise<void> {
  await db.update(zatcaSubmissionQueue).set({
    state: 'queued',
    lockedAt: null,
    lockedBy: null,
    availableAt: new Date(),
    updatedAt: new Date(),
  }).where(sql`${zatcaSubmissionQueue.state} = 'processing' AND ${zatcaSubmissionQueue.lockedAt} < now() - interval '10 minutes'`);
}

export async function processDueZatcaQueue(limit = 10): Promise<number> {
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const item = await claimNextQueueItem();
    if (!item) break;
    try {
      await processQueueItem(item);
      processed++;
    } catch (error) {
      await db.update(zatcaSubmissionQueue).set({
        state: 'retry_pending',
        availableAt: new Date(Date.now() + RETRY_DELAY_MS),
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      }).where(and(eq(zatcaSubmissionQueue.id, item.id), eq(zatcaSubmissionQueue.lockedBy, WORKER_ID)));
    }
  }
  return processed;
}

export function startZatcaQueueWorker(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await recoverStaleZatcaQueue();
      await processDueZatcaQueue();
    } catch (error) {
      console.error('[zatca-queue] worker tick failed:', error);
    } finally {
      running = false;
    }
  };
  console.info('[zatca-queue] durable Sandbox Mock worker started');
  void tick();
  const timer = setInterval(() => void tick(), 15_000);
  timer.unref?.();
  return () => clearInterval(timer);
}