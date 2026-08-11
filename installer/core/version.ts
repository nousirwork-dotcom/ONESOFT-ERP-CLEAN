import * as versionInfo from '../../version.json';

export const APP_VERSION = String(versionInfo.version);
export const APP_SCHEMA_VERSION = String(versionInfo.schemaVersion);
export const APP_BUILD = String(versionInfo.build);

export const VERSION_INFO = {
  version: APP_VERSION,
  schemaVersion: APP_SCHEMA_VERSION,
  build: APP_BUILD,
  releaseDate: String(versionInfo.releaseDate),
  product: String(versionInfo.product),
  channel: String(versionInfo.channel),
} as const;