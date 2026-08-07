import { describe, expect, it } from 'vitest';
import { extractComplianceRequestId } from '../services/zatcaFatooraSimulation.js';

describe('Compliance request reference', () => {
  it('uses body.requestID and never the transport requestId', () => {
    expect(extractComplianceRequestId({
      requestId: 'http-request-uuid',
      body: {
        requestID: 1786087496896,
      },
    })).toBe('1786087496896');
  });

  it('accepts the persisted JSON response shape used by Simulation and Production flows', () => {
    expect(extractComplianceRequestId(JSON.stringify({
      httpStatus: 200,
      requestId: 'transport-request-uuid',
      body: {
        requestID: '1786087496896',
        dispositionMessage: 'ISSUED',
      },
    }))).toBe('1786087496896');
  });

  it('does not fall back to a transport requestId or body.requestId', () => {
    expect(extractComplianceRequestId({
      requestId: 'http-request-uuid',
      body: { requestId: 'wrong-body-key' },
    })).toBeNull();
    expect(extractComplianceRequestId({
      requestId: 'http-request-uuid',
      body: {},
    })).toBeNull();
  });

  it('rejects missing, non-positive, and non-numeric body.requestID values', () => {
    expect(extractComplianceRequestId({ body: { requestID: '' } })).toBeNull();
    expect(extractComplianceRequestId({ body: { requestID: 0 } })).toBeNull();
    expect(extractComplianceRequestId({ body: { requestID: 'not-a-reference' } })).toBeNull();
  });
});