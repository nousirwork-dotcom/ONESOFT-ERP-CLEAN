import * as fs from 'fs';
import * as path from 'path';

export type UpgradeDiagnosticStatus = 'started' | 'success' | 'failure';

export interface UpgradeDiagnosticEntry {
  timestamp: string;
  stage: string;
  status: UpgradeDiagnosticStatus;
  error?: string;
  migration?: string;
}

const LOG_PATH = path.join(
  process.env['ProgramData'] || 'C:\\ProgramData',
  'OneSoft',
  'Logs',
  'upgrade.log',
);

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***')
    .replace(/password authentication failed for user ".*?"/gi, 'database authentication failed')
    .replace(/(password|secret|token|credential|api[-_]?key|private[-_]?key)\s*[:=]\s*\S+/gi, '$1=***');
}

/**
 * Durable, secret-free Upgrade Core diagnostics.
 *
 * This logger intentionally stores only the stage outcome, a sanitized error,
 * and (when applicable) a migration tag. It never receives connection
 * options, passwords, or raw child-process output.
 */
export class UpgradeDiagnosticLogger {
  static readonly path = LOG_PATH;

  record(
    stage: string,
    status: UpgradeDiagnosticStatus,
    details: { error?: unknown; migration?: string } = {},
  ): void {
    const entry: UpgradeDiagnosticEntry = {
      timestamp: new Date().toISOString(),
      stage,
      status,
    };

    if (details.error !== undefined) {
      entry.error = safeError(details.error);
    }
    if (details.migration) {
      entry.migration = details.migration;
    }

    try {
      fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
      fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
    } catch {
      // Diagnostics must never change the upgrade result.
    }
  }
}