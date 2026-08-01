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