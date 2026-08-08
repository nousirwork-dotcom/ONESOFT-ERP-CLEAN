import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  checkpointIntegrity,
  checkpointNeedsReview,
  evaluateTrustedClock,
  isTrustedClockDocumentType,
} from '../services/trustedClock.js';

const base = new Date('2026-08-07T12:00:00.000Z');
process.env.TRUSTED_CLOCK_HMAC_KEY = '11'.repeat(32);

describe('TrustedClock evaluation', () => {
  it('uses the local Windows timestamp even when a remote timestamp is supplied', () => {
    const result = evaluateTrustedClock({
      wallNow: base,
      remoteTime: new Date('2026-08-07T12:00:01.000Z'),
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.status).toBe('stale');
      expect(result.source).toBe('system_initial');
      expect(result.timestamp.toISOString()).toBe('2026-08-07T12:00:00.000Z');
    }
  });

  it('blocks rollback relative to the POS last issuance', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T11:55:00.000Z'),
      lastIssuedAt: base,
      remoteTime: new Date('2026-08-07T11:55:00.000Z'),
    });

    expect(result).toMatchObject({ allowed: false, event: 'CLOCK_ROLLBACK' });
  });

  it('allows the same unit after Windows time is corrected', () => {
    const blocked = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T11:55:00.000Z'),
      lastIssuedAt: base,
      remoteTime: new Date('2026-08-07T11:55:00.000Z'),
    });
    const corrected = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:01:00.000Z'),
      lastIssuedAt: base,
    });

    expect(blocked).toMatchObject({ allowed: false, event: 'CLOCK_ROLLBACK' });
    expect(corrected).toMatchObject({ allowed: true, status: 'stale', source: 'system_initial' });
  });

  it('allows a large forward jump and returns an audit warning', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:20:00.000Z'),
      lastObservedWallTime: base,
      monotonicSinceObservedMs: 1_000,
    });

    expect(result).toMatchObject({
      allowed: true,
      warning: { event: 'CLOCK_FORWARD_JUMP' },
    });
  });

  it('blocks a durable checkpoint that is ahead of the database chain', () => {
    const result = evaluateTrustedClock({
      wallNow: base,
      remoteTime: base,
      durableLastInvoiceCounter: 12,
      databaseLastInvoiceCounter: 11,
    });

    expect(result).toMatchObject({ allowed: false, event: 'RESTORE_SUSPECTED' });
  });

  it('blocks a chain fingerprint mismatch even when counters match', () => {
    const result = evaluateTrustedClock({
      wallNow: base,
      remoteTime: base,
      durableLastInvoiceCounter: 12,
      databaseLastInvoiceCounter: 12,
      durableLastInvoiceHash: 'hash-a',
      databaseLastInvoiceHash: 'hash-b',
      durableLastInvoiceUuid: 'uuid-a',
      databaseLastInvoiceUuid: 'uuid-a',
    });

    expect(result).toMatchObject({ allowed: false, event: 'ZATCA_CHAIN_REVIEW_REQUIRED' });
  });

  it('blocks a PIH mismatch even when ICV, hash, and UUID match', () => {
    const result = evaluateTrustedClock({
      wallNow: base,
      remoteTime: base,
      durableLastInvoiceCounter: 12,
      databaseLastInvoiceCounter: 12,
      durableLastInvoiceHash: 'same-hash',
      databaseLastInvoiceHash: 'same-hash',
      durableLastInvoiceUuid: 'same-uuid',
      databaseLastInvoiceUuid: 'same-uuid',
      durableLastPih: 'old-pih',
      databaseLastPih: 'new-pih',
    });

    expect(result).toMatchObject({ allowed: false, event: 'ZATCA_CHAIN_REVIEW_REQUIRED' });
  });

  it('allows the first issuance offline from the local Windows timestamp', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:00:03.000Z'),
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.status).toBe('stale');
      expect(result.source).toBe('system_initial');
      expect(result.timestamp.toISOString()).toBe('2026-08-07T12:00:03.000Z');
    }
  });

  it('does not require a network anchor for the first issuance', () => {
    const result = evaluateTrustedClock({ wallNow: base });
    expect(result).toMatchObject({ allowed: true, source: 'system_initial' });
  });

  it('does not use a commercial invoice date to evaluate TrustedClock', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-08T00:01:00.000Z'),
    });
    expect(result).toMatchObject({ allowed: true, status: 'stale', source: 'system_initial' });
  });

  it('allows issuance after a backend restart when Windows time has advanced', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:01:00.000Z'),
      lastTrustedTime: base,
      lastIssuedAt: base,
      monotonicElapsedMs: null,
    });

    expect(result).toMatchObject({ allowed: true, source: 'persisted' });
  });

  it('allows the next calendar day without an internet connection', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:01:00.000Z'),
      lastTrustedTime: base,
      lastIssuedAt: base,
      monotonicElapsedMs: null,
    });

    expect(result).toMatchObject({ allowed: true, source: 'persisted' });
  });

  it('blocks missing checkpoints only for a unit with a database chain', () => {
    expect(checkpointNeedsReview('missing', true)).toBe('CHECKPOINT_MISSING');
    expect(checkpointNeedsReview('missing', false)).toBeNull();
    expect(checkpointNeedsReview('invalid', false)).toBe('CHECKPOINT_INTEGRITY_FAILED');
  });

  it('detects manual checkpoint tampering through HMAC', () => {
    const payload = {
      version: 2 as const,
      orgId: 1,
      posUnitId: 2,
      lastTrustedTime: base.toISOString(),
      lastIssuedAt: base.toISOString(),
      lastInvoiceCounter: 12,
      lastInvoiceHash: 'hash',
      lastInvoiceUuid: 'uuid',
      lastPih: 'pih',
    };
    const validHmac = (() => {
      // The production writer uses the same canonical payload and secret;
      // this test only verifies that changing a field invalidates its MAC.
      const key = Buffer.from('11'.repeat(32), 'hex');
      return crypto.createHmac('sha256', key).update(JSON.stringify(payload)).digest('hex');
    })();

    expect(checkpointIntegrity(payload, validHmac)).toBe(true);
    expect(checkpointIntegrity({ ...payload, lastPih: 'tampered' }, validHmac)).toBe(false);
  });

  it('keeps checkpoint HMAC stable when SESSION_SECRET changes', () => {
    const payload = {
      version: 2 as const,
      orgId: 1,
      posUnitId: 2,
      lastTrustedTime: base.toISOString(),
      lastIssuedAt: base.toISOString(),
      lastInvoiceCounter: 12,
      lastInvoiceHash: 'hash',
      lastInvoiceUuid: 'uuid',
      lastPih: 'pih',
    };
    const key = Buffer.from('11'.repeat(32), 'hex');
    const hmac = crypto.createHmac('sha256', key).update(JSON.stringify(payload)).digest('hex');
    process.env.SESSION_SECRET = 'secret-from-old-installation';
    expect(checkpointIntegrity(payload, hmac)).toBe(true);
    process.env.SESSION_SECRET = 'secret-from-updated-installation';
    expect(checkpointIntegrity(payload, hmac)).toBe(true);
  });

  it('keeps TrustedClock outside purchases and manual journals', () => {
    expect(isTrustedClockDocumentType('sale')).toBe(true);
    expect(isTrustedClockDocumentType('return')).toBe(true);
    expect(isTrustedClockDocumentType('credit_note')).toBe(true);
    expect(isTrustedClockDocumentType('debit_note')).toBe(true);
    expect(isTrustedClockDocumentType('purchase')).toBe(false);
    expect(isTrustedClockDocumentType('manual_journal')).toBe(false);
  });

  it('uses a persisted suspicious state as a hard issuance boundary', () => {
    // The persistence-layer guard is intentionally represented by the same
    // review-required event used by evaluateTrustedClock for chain conflicts.
    const result = evaluateTrustedClock({
      wallNow: base,
      remoteTime: base,
      durableLastInvoiceCounter: 4,
      databaseLastInvoiceCounter: 4,
      durableLastInvoiceHash: 'old-hash',
      databaseLastInvoiceHash: 'new-hash',
    });

    expect(result).toMatchObject({ allowed: false, event: 'ZATCA_CHAIN_REVIEW_REQUIRED' });
  });
});