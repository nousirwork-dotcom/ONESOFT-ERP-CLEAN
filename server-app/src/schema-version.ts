/**
 * The canonical schema version this build of the server requires.
 *
 * When you add a new migration file to server-app/drizzle/, update this
 * constant to match the new filename (without the .sql extension), then
 * run `pnpm migrate` so the live database is stamped with the new version.
 */
export const REQUIRED_SCHEMA_VERSION = '0081_zatca_environment_device_separation';
