import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureTrialState,
  getTrialMarkerPath,
  getTrialState,
  isTrialExpired,
  markTrialExpiredIfNeeded,
  TRIAL_DURATION_DAYS,
  updateTrialLicenseState,
} from '../lib/trial.js';

describe('machine trial lifecycle', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onesoft-trial-'));
    process.env.ONESOFT_DATA_DIR = dataDir;
  });

  afterEach(() => {
    delete process.env.ONESOFT_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  function writeInstallMarker(firstInstallAt: string) {
    fs.writeFileSync(
      getTrialMarkerPath(),
      JSON.stringify({ schema: 1, firstInstallAt }),
      'utf8',
    );
  }

  it('starts exactly 180 days from the first successful install marker', () => {
    writeInstallMarker('2026-08-15T04:16:00.000Z');

    const state = ensureTrialState();

    expect(TRIAL_DURATION_DAYS).toBe(180);
    expect(state.firstInstallAt).toBe('2026-08-15T04:16:00.000Z');
    expect(state.trialExpiresAt).toBe('2027-02-11T04:16:00.000Z');
    expect(isTrialExpired(state, new Date('2026-08-16T00:00:00.000Z'))).toBe(false);
  });

  it('does not reset the dates when the application is updated', () => {
    writeInstallMarker('2026-08-15T04:16:00.000Z');
    const first = ensureTrialState();

    const afterUpdate = ensureTrialState('2026-09-01T00:00:00.000Z');

    expect(afterUpdate).toEqual(first);
  });

  it('does not reset the dates when the program is removed and reinstalled', () => {
    writeInstallMarker('2026-08-15T04:16:00.000Z');
    const first = ensureTrialState();
    fs.rmSync(path.join(dataDir, 'device.prefs.json'), { force: true });

    const afterReinstall = ensureTrialState('2026-09-01T00:00:00.000Z');

    expect(afterReinstall.firstInstallAt).toBe(first.firstInstallAt);
    expect(afterReinstall.trialExpiresAt).toBe(first.trialExpiresAt);
  });

  it('preserves the marker when a newer version is installed over the current one', () => {
    writeInstallMarker('2026-08-15T04:16:00.000Z');
    const first = ensureTrialState();
    fs.rmSync(path.join(dataDir, 'device.prefs.json'), { force: true });

    const afterNewerInstall = ensureTrialState('2026-12-01T00:00:00.000Z');

    expect(afterNewerInstall).toEqual(first);
    expect(getTrialState()).toEqual(first);
  });

  it('persists the local license state without changing trial dates', () => {
    writeInstallMarker('2026-08-15T04:16:00.000Z');
    const trial = ensureTrialState();

    const licensed = updateTrialLicenseState(trial, 'licensed');

    expect(licensed.licenseState).toBe('licensed');
    expect(licensed.firstInstallAt).toBe(trial.firstInstallAt);
    expect(licensed.trialExpiresAt).toBe(trial.trialExpiresAt);
    expect(getTrialState()).toEqual(licensed);
  });

  it('keeps expiration terminal after the clock is moved backwards', () => {
    const trial = {
      firstInstallAt: '2026-01-01T00:00:00.000Z',
      trialExpiresAt: '2026-06-30T00:00:00.000Z',
      licenseState: 'trial' as const,
    };
    const expired = markTrialExpiredIfNeeded(trial, new Date('2026-07-01T00:00:00.000Z'));

    expect(isTrialExpired(expired, new Date('2026-01-02T00:00:00.000Z'))).toBe(true);
  });
});