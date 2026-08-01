import { describe, expect, it } from 'vitest';
import {
  buildMockAuthorityResponse,
  canTransitionZatcaState,
  finalStateFor,
  isFinalZatcaState,
  isUncertainZatcaState,
  redactZatcaPayload,
  stateForMockOutcome,
} from '../services/zatcaLifecycle.js';

describe('ZATCA submission lifecycle', () => {
  it('does not treat a sent request as a final result', () => {
    expect(stateForMockOutcome('clearance', 'delayed')).toBe('submitted_pending');
    expect(stateForMockOutcome('reporting', 'connection_issue')).toBe('connection_issue');
    expect(stateForMockOutcome('reporting', 'connection_loss')).toBe('uncertain');
    expect(isFinalZatcaState('submitted_pending')).toBe(false);
    expect(isUncertainZatcaState('submitted_pending')).toBe(true);
  });

  it('keeps a lost response uncertain without inventing an authority result', () => {
    const response = buildMockAuthorityResponse({
      operation: 'clearance',
      outcome: 'connection_loss',
      uuid: 'uuid-lost',
      icv: 44,
      correlationId: 'corr-lost',
      now: '2026-08-01T00:00:00.000Z',
    });
    expect(stateForMockOutcome('clearance', 'connection_loss')).toBe('uncertain');
    expect(response).toMatchObject({
      uuid: 'uuid-lost',
      icv: 44,
      correlationId: 'corr-lost',
      final: false,
      authorityStatus: 'UNKNOWN',
      receivedAt: null,
      httpStatus: null,
    });
    expect(isFinalZatcaState(response.authorityStatus)).toBe(false);
  });

  it('does not allow a final result to transition into retry', () => {
    for (const finalState of ['cleared', 'reported', 'accepted_with_warnings', 'rejected'] as const) {
      expect(isFinalZatcaState(finalState)).toBe(true);
      expect(canTransitionZatcaState(finalState, 'retry_pending')).toBe(false);
    }
  });

  it('allows the first submission to pass through sending before a final result', () => {
    expect(canTransitionZatcaState('not_submitted', 'submitting')).toBe(true);
    expect(canTransitionZatcaState('submitting', 'cleared')).toBe(true);
    expect(canTransitionZatcaState('not_submitted', 'cleared')).toBe(false);
  });

  it('maps accepted outcomes to the operation-specific final state', () => {
    expect(finalStateFor('clearance', 'accepted')).toBe('cleared');
    expect(finalStateFor('reporting', 'accepted')).toBe('reported');
    expect(finalStateFor('clearance', 'accepted_with_warnings')).toBe('accepted_with_warnings');
    expect(isFinalZatcaState('accepted_with_warnings')).toBe(true);
  });

  it('preserves correlation data in mock responses', () => {
    const response = buildMockAuthorityResponse({
      operation: 'reporting',
      outcome: 'accepted',
      uuid: 'uuid-1',
      icv: 12,
      correlationId: 'corr-1',
      now: '2026-08-01T00:00:00.000Z',
    });
    expect(response).toMatchObject({
      uuid: 'uuid-1',
      icv: 12,
      correlationId: 'corr-1',
      authorityStatus: 'REPORTED',
      final: true,
    });
  });

  it('redacts credentials recursively without removing audit fields', () => {
    expect(redactZatcaPayload({
      uuid: 'uuid-1',
      headers: { authorization: 'Bearer secret' },
      nested: { privateKey: 'key', message: 'kept' },
    })).toEqual({
      uuid: 'uuid-1',
      headers: { authorization: '[REDACTED]' },
      nested: { privateKey: '[REDACTED]', message: 'kept' },
    });
  });
});