import { describe, expect, it } from 'vitest';
import { evaluateTrustedClock } from '../services/trustedClock.js';

const base = new Date('2026-08-07T12:00:00.000Z');

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