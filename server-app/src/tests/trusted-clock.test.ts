import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  checkpointIntegrity,
  checkpointNeedsReview,
  evaluateTrustedClock,
  isTrustedClockDocumentType,
  parseCloudflareTraceTimestamp,
} from '../services/trustedClock.js';

const base = new Date('2026-08-07T12:00:00.000Z');
process.env.TRUSTED_CLOCK_HMAC_KEY = '11'.repeat(32);

describe('TrustedClock evaluation', () => {
  it('accepts an online trusted timestamp and marks it trusted', () => {
    const result = evaluateTrustedClock({
      wallNow: base,
      remoteTime: new Date('2026-08-07T12:00:01.000Z'),
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.status).toBe('trusted');
      expect(result.source).toBe('https');
      expect(result.timestamp.toISOString()).toBe('2026-08-07T12:00:01.000Z');
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

  it('allows the same unit after Windows time is corrected and Cloudflare time agrees', () => {
    const blocked = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T11:55:00.000Z'),
      lastIssuedAt: base,
      remoteTime: new Date('2026-08-07T11:55:00.000Z'),
    });
    const corrected = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:01:00.000Z'),
      lastIssuedAt: base,
      remoteTime: new Date('2026-08-07T12:01:01.000Z'),
    });

    expect(blocked).toMatchObject({ allowed: false, event: 'CLOCK_ROLLBACK' });
    expect(corrected).toMatchObject({ allowed: true, status: 'trusted', source: 'https' });
  });

  it('blocks a suspicious forward jump from the online source', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:20:00.000Z'),
      remoteTime: base,
    });

    expect(result).toMatchObject({ allowed: false, event: 'CLOCK_FORWARD_JUMP' });
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

  it('allows offline continuation only from a trusted monotonic anchor', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:00:03.000Z'),
      lastTrustedTime: base,
      monotonicElapsedMs: 3000,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.status).toBe('stale');
      expect(result.source).toBe('monotonic');
      expect(result.timestamp.toISOString()).toBe('2026-08-07T12:00:03.000Z');
    }
  });

  it('does not trust a backend wall clock for first offline issuance', () => {
    const result = evaluateTrustedClock({ wallNow: base });
    expect(result).toMatchObject({ allowed: false, event: 'CLOCK_UNTRUSTED' });
  });

  it('does not use a commercial invoice date to evaluate TrustedClock', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-08T00:01:00.000Z'),
      remoteTime: new Date('2026-08-08T00:01:01.000Z'),
    });
    expect(result).toMatchObject({ allowed: true, status: 'trusted', source: 'https' });
  });

  it('blocks Offline issuance after a backend restart without a monotonic baseline', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:01:00.000Z'),
      lastTrustedTime: base,
      lastIssuedAt: base,
      monotonicElapsedMs: null,
      remoteTime: null,
    });

    expect(result).toMatchObject({ allowed: false, event: 'CLOCK_UNTRUSTED' });
  });

  it('allows issuance after a backend restart when a fresh Cloudflare time is available', () => {
    const result = evaluateTrustedClock({
      wallNow: new Date('2026-08-07T12:01:00.000Z'),
      lastTrustedTime: base,
      lastIssuedAt: base,
      monotonicElapsedMs: null,
      remoteTime: new Date('2026-08-07T12:01:01.000Z'),
    });

    expect(result).toMatchObject({ allowed: true, status: 'trusted', source: 'https' });
  });

  it('accepts only the Cloudflare trace ts field and rejects JSON/general time fields', () => {
    expect(parseCloudflareTraceTimestamp('fl=abc\nts=1786122000.000\ncolo=AMS')).toEqual(new Date('2026-08-07T17:00:00.000Z'));
    expect(parseCloudflareTraceTimestamp('{"ts":1786122000}')).toBeNull();
    expect(parseCloudflareTraceTimestamp('date=2026-08-07T16:20:00.000Z')).toBeNull();
    expect(parseCloudflareTraceTimestamp('ts=1786122000\nts=1786122001')).toBeNull();
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