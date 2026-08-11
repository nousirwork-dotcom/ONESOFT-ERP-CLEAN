export interface UpgradePreflight {
  migrationCredentialValid: boolean;
  legacyAdminCredentialValid: boolean;
}

export type UpgradeLaunchMode = 'silent' | 'interactive';

/**
 * The NSIS installer is the single upgrade implementation. This policy only
 * decides whether NSIS may run headlessly or must show the one-time bootstrap
 * wizard before entering that same Upgrade Core.
 */
export function chooseUpgradeLaunchMode(preflight: UpgradePreflight): UpgradeLaunchMode {
  return preflight.migrationCredentialValid || preflight.legacyAdminCredentialValid
    ? 'silent'
    : 'interactive';
}