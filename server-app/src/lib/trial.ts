/**
 * trial.ts — machine-level trial state
 *
 * The installer creates a one-time marker in ProgramData after the install
 * payload has been copied. On first server startup that marker is migrated into
 * the encrypted device preferences file. The marker is intentionally kept as
 * a recovery anchor so an installer/update cannot silently reset the trial.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  getOnesoftDataDir,
} from './deviceId.js';
import {
  loadDevicePrefs,
  saveDevicePrefs,
} from './devicePrefs.js';

export const TRIAL_DURATION_DAYS = 180;
export type TrialLicenseState = 'trial' | 'expired' | 'licensed';

export interface TrialState {
  firstInstallAt: string;
  trialExpiresAt: string;
  licenseState: TrialLicenseState;
}

interface InstallerTrialMarker {
  firstInstallAt?: unknown;
}

const MARKER_FILE = 'trial-install-marker.json';

export function getTrialMarkerPath(): string {
  return path.join(getOnesoftDataDir(), MARKER_FILE);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function makeState(firstInstallAt: Date, licenseState: TrialLicenseState = 'trial'): TrialState {
  const expires = new Date(firstInstallAt.getTime());
  expires.setUTCDate(expires.getUTCDate() + TRIAL_DURATION_DAYS);
  return {
    firstInstallAt: firstInstallAt.toISOString(),
    trialExpiresAt: expires.toISOString(),
    licenseState,
  };
}

function fromPrefs(): TrialState | null {
  const prefs = loadDevicePrefs();
  const first = parseDate(prefs.trialFirstInstallAt);
  const expiry = parseDate(prefs.trialExpiresAt);
  const licenseState = prefs.trialLicenseState;
  if (!first || !expiry) return null;
  if (licenseState !== 'trial' && licenseState !== 'expired' && licenseState !== 'licensed') {
    return null;
  }
  return {
    firstInstallAt: first.toISOString(),
    trialExpiresAt: expiry.toISOString(),
    licenseState,
  };
}

function readInstallerMarker(): Date | null {
  try {
    const raw = fs.readFileSync(getTrialMarkerPath(), 'utf8');
    const marker = JSON.parse(raw) as InstallerTrialMarker;
    return parseDate(marker.firstInstallAt);
  } catch {
    return null;
  }
}

function saveState(state: TrialState): void {
  saveDevicePrefs({
    trialFirstInstallAt: state.firstInstallAt,
    trialExpiresAt: state.trialExpiresAt,
    trialLicenseState: state.licenseState,
  });
}

/**
 * Returns the persisted state, migrating the installer's one-time marker into
 * encrypted device prefs when necessary.
 */
export function getTrialState(): TrialState | null {
  const persisted = fromPrefs();
  if (persisted) return persisted;

  const markerDate = readInstallerMarker();
  if (!markerDate) return null;
  const state = makeState(markerDate);
  saveState(state);
  return state;
}

/**
 * Initializes the state exactly once. legacyFirstInstallAt is only used when
 * upgrading an installation created before the marker existed; it prevents a
 * 1.0.41 upgrade from resetting an existing trial.
 */
export function ensureTrialState(legacyFirstInstallAt?: Date | string | null): TrialState {
  const existing = getTrialState();
  if (existing) return existing;

  const candidates = [
    readInstallerMarker(),
    parseDate(legacyFirstInstallAt),
  ].filter((value): value is Date => value !== null);
  const firstInstallAt = candidates.length > 0
    ? new Date(Math.min(...candidates.map(value => value.getTime())))
    : new Date();
  const state = makeState(firstInstallAt);
  saveState(state);
  return state;
}

export function updateTrialLicenseState(state: TrialState, licenseState: TrialLicenseState): TrialState {
  const next = { ...state, licenseState };
  saveState(next);
  return next;
}

export function isTrialExpired(state: TrialState, now = new Date()): boolean {
  if (state.licenseState === 'expired') return true;
  if (state.licenseState !== 'trial') return false;
  return now.getTime() >= new Date(state.trialExpiresAt).getTime();
}

export function markTrialExpiredIfNeeded(state: TrialState, now = new Date()): TrialState {
  if (state.licenseState === 'trial' && isTrialExpired(state, now)) {
    return updateTrialLicenseState(state, 'expired');
  }
  return state;
}

export function trialDatesForPayload(state: TrialState): {
  startDate: string;
  expiryDate: string;
} {
  return {
    startDate: dateOnly(state.firstInstallAt),
    expiryDate: dateOnly(state.trialExpiresAt),
  };
}