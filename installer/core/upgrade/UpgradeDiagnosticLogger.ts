import * as fs from 'fs';
import * as path from 'path';

export type UpgradeDiagnosticStatus = 'started' | 'success' | 'failure';

export interface FoundationDiagnostic {
  executable: string;
  command: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  schemaVersion: string;
  foundationHash: string | null;
  foundationVersion: string | null;
  stdout: string;
  stderr: string;
  stdoutTail: string;
  stderrTail: string;
}

export interface RollbackStageDiagnostic {
  status: string;
  error?: string;
}

export interface UpgradeDiagnosticEntry {
  timestamp: string;
  stage: string;
  status: UpgradeDiagnosticStatus;
  error?: string;
  migration?: string;
  ownershipViolations?: Array<{
    schema: string;
    objectName: string;
    objectType: string;
    currentOwner: string;
    expectedOwner: string;
  }>;
  foundation?: FoundationDiagnostic;
  rollbackStages?: Record<string, RollbackStageDiagnostic>;
}

const LOG_PATH = path.join(
  process.env['ProgramData'] || 'C:\\ProgramData',
  'OneSoft',
  'Logs',
  'upgrade.log',
);

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return sanitizeText(raw);
}

function sanitizeText(raw: string): string {
  return raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***')
    .replace(/(DATABASE_URL|ONESOFT_UPGRADE_DATABASE_URL|PGPASSWORD)\s*[:=]\s*[^\r\n\s]+/gi, '$1=***')
    .replace(/password authentication failed for user ".*?"/gi, 'database authentication failed')
    .replace(/(password|secret|token|credential|api[-_]?key|private[-_]?key)\s*[:=]\s*\S+/gi, '$1=***');
}

/**
 * Durable, secret-free Upgrade Core diagnostics.
 *
 * This logger stores stage outcomes plus sanitized Foundation child-process
 * diagnostics when available. It never receives connection options or
 * passwords, and raw child output is sanitized before it is persisted.
 */
export class UpgradeDiagnosticLogger {
  static readonly path = LOG_PATH;

  constructor(private readonly logPath: string = LOG_PATH) {}

  record(
    stage: string,
    status: UpgradeDiagnosticStatus,
    details: {
      error?: unknown;
      migration?: string;
      ownershipViolations?: UpgradeDiagnosticEntry['ownershipViolations'];
      foundation?: FoundationDiagnostic;
      rollbackStages?: Record<string, RollbackStageDiagnostic>;
    } = {},
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
    if (details.ownershipViolations?.length) {
      entry.ownershipViolations = details.ownershipViolations.slice(0, 20);
    }
    if (details.foundation) {
      entry.foundation = {
        ...details.foundation,
        executable: sanitizeText(details.foundation.executable),
        command: sanitizeText(details.foundation.command),
        stdout: sanitizeText(details.foundation.stdout),
        stderr: sanitizeText(details.foundation.stderr),
        stdoutTail: sanitizeText(details.foundation.stdoutTail),
        stderrTail: sanitizeText(details.foundation.stderrTail),
        foundationHash: details.foundation.foundationHash
          ? sanitizeText(details.foundation.foundationHash)
          : null,
        foundationVersion: details.foundation.foundationVersion
          ? sanitizeText(details.foundation.foundationVersion)
          : null,
        schemaVersion: sanitizeText(details.foundation.schemaVersion),
      };
    }
    if (details.rollbackStages) {
      entry.rollbackStages = Object.fromEntries(
        Object.entries(details.rollbackStages).map(([stage, result]) => [
          stage,
          {
            status: sanitizeText(result.status),
            ...(result.error ? { error: sanitizeText(result.error) } : {}),
          },
        ]),
      );
    }

    try {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
      // Write an explicit UTF-8 buffer. This avoids relying on platform
      // defaults when the log is inspected by Windows PowerShell/tools.
      fs.appendFileSync(this.logPath, Buffer.from(`${JSON.stringify(entry)}\n`, 'utf8'), {
        mode: 0o600,
      });
    } catch {
      // Diagnostics must never change the upgrade result.
    }
  }
}