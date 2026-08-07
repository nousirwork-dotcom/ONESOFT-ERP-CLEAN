export const ZATCA_LIFECYCLE_STATES = [
  'ready_to_submit',
  'reporting_pending',
  'clearance_pending',
  'submitting',
  'submitted_pending',
  'cleared',
  'reported',
  'accepted_with_warnings',
  'rejected',
  'connection_issue',
  'retry_pending',
  'uncertain',
] as const;

export type ZatcaLifecycleState = typeof ZATCA_LIFECYCLE_STATES[number];
export type ZatcaOperation = 'clearance' | 'reporting';
export type ZatcaMockOutcome =
  | 'accepted'
  | 'accepted_with_warnings'
  | 'rejected'
  | 'delayed'
  | 'uncertain'
  | 'connection_issue'
  | 'connection_loss';

export const FINAL_ZATCA_STATES: readonly ZatcaLifecycleState[] = [
  'cleared',
  'reported',
  'accepted_with_warnings',
  'rejected',
];

export const UNCERTAIN_ZATCA_STATES: readonly ZatcaLifecycleState[] = [
  'submitted_pending',
  'uncertain',
];

const ALLOWED_ZATCA_TRANSITIONS: Readonly<Record<ZatcaLifecycleState, readonly ZatcaLifecycleState[]>> = {
  ready_to_submit: ['submitting', 'retry_pending'],
  reporting_pending: ['submitting', 'retry_pending'],
  clearance_pending: ['submitting', 'retry_pending'],
  submitting: ['submitted_pending', 'cleared', 'reported', 'accepted_with_warnings', 'rejected', 'connection_issue', 'uncertain'],
  submitted_pending: ['retry_pending', 'cleared', 'reported', 'accepted_with_warnings', 'rejected', 'uncertain'],
  cleared: [],
  reported: [],
  accepted_with_warnings: [],
  rejected: [],
  connection_issue: ['retry_pending', 'uncertain'],
  retry_pending: ['submitting', 'submitted_pending', 'cleared', 'reported', 'accepted_with_warnings', 'rejected', 'uncertain'],
  uncertain: ['retry_pending', 'cleared', 'reported', 'accepted_with_warnings', 'rejected'],
};

export function canTransitionZatcaState(
  from: string | null | undefined,
  to: ZatcaLifecycleState,
): boolean {
  const normalizedFrom =
    from === 'not_submitted' || from == null ? 'ready_to_submit'
      : from === 'pending' || from === 'error' ? 'retry_pending'
      : from;
  return normalizedFrom === to
    || (ZATCA_LIFECYCLE_STATES.includes(normalizedFrom as ZatcaLifecycleState)
      && ALLOWED_ZATCA_TRANSITIONS[normalizedFrom as ZatcaLifecycleState].includes(to));
}

export function isFinalZatcaState(state: string | null | undefined): boolean {
  return state != null && FINAL_ZATCA_STATES.includes(state as ZatcaLifecycleState);
}

export function isUncertainZatcaState(state: string | null | undefined): boolean {
  return state != null && UNCERTAIN_ZATCA_STATES.includes(state as ZatcaLifecycleState);
}

export function finalStateFor(operation: ZatcaOperation, outcome: 'accepted' | 'accepted_with_warnings'): ZatcaLifecycleState {
  return outcome === 'accepted_with_warnings'
    ? 'accepted_with_warnings'
    : operation === 'clearance' ? 'cleared' : 'reported';
}

export function redactZatcaPayload(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactZatcaPayload);
  if (typeof value !== 'object') return value;

  const sensitive = /secret|password|private.?key|authorization|token|certificate|csid|otp/i;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    sensitive.test(key) ? '[REDACTED]' : redactZatcaPayload(child),
  ]));
}

export function buildMockAuthorityResponse(input: {
  operation: ZatcaOperation;
  outcome: ZatcaMockOutcome;
  uuid: string;
  icv: number;
  correlationId: string;
  now: string;
}) {
  const { operation, outcome, uuid, icv, correlationId, now } = input;
  const accepted = outcome === 'accepted' || outcome === 'accepted_with_warnings';
  const final = accepted || outcome === 'rejected';
  const warnings = outcome === 'accepted_with_warnings'
    ? [{ code: 'MOCK_WARNING', message: 'تحذير تجريبي من ناقل Mock' }]
    : [];
  const errors = outcome === 'rejected'
    ? [{ code: 'MOCK_REJECTED', message: 'رفض تجريبي من ناقل Mock' }]
    : [];

  return {
    requestId: correlationId,
    correlationId,
    uuid,
    icv,
    operation,
    httpStatus: outcome === 'connection_issue' || outcome === 'connection_loss'
      ? null
      : final ? (accepted ? 200 : 400) : 202,
    authorityStatus: final
      ? accepted ? (warnings.length ? 'ACCEPTED_WITH_WARNINGS' : operation === 'clearance' ? 'CLEARED' : 'REPORTED') : 'REJECTED'
      : outcome === 'delayed' ? 'PENDING' : 'UNKNOWN',
    final,
    warnings,
    errors,
    receivedAt: outcome === 'connection_issue' || outcome === 'connection_loss' || outcome === 'uncertain' ? null : now,
  };
}

export function stateForMockOutcome(
  operation: ZatcaOperation,
  outcome: ZatcaMockOutcome,
): ZatcaLifecycleState {
  if (outcome === 'accepted') return finalStateFor(operation, 'accepted');
  if (outcome === 'accepted_with_warnings') return 'accepted_with_warnings';
  if (outcome === 'rejected') return 'rejected';
  if (outcome === 'delayed') return 'submitted_pending';
  if (outcome === 'uncertain') return 'uncertain';
  if (outcome === 'connection_loss') return 'uncertain';
  return 'connection_issue';
}

export function nextRetryState(state: ZatcaLifecycleState): ZatcaLifecycleState {
  if (state === 'rejected' || isFinalZatcaState(state)) return state;
  return 'retry_pending';
}