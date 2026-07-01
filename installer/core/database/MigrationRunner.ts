import { execSync } from 'child_process';
import * as path from 'path';
import type { MigrationResult, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class MigrationRunner {
  constructor(private readonly serverAppPath: string) {}

  async runMigrations(databaseUrl: string, emit: Emit): Promise<MigrationResult> {
    emit({ level: 'info', message: 'جارٍ تشغيل Database Migrations...', timestamp: now() });

    const env = { ...process.env, DATABASE_URL: databaseUrl };

    try {
      // drizzle-kit push or migrate
      const output = execSync('pnpm drizzle-kit migrate', {
        cwd: this.serverAppPath,
        env,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120_000,
      });

      emit({ level: 'success', message: 'تم تطبيق جميع Migrations بنجاح', timestamp: now() });
      return { applied: parseApplied(output), skipped: [] };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      // Try drizzle-kit push as fallback
      try {
        execSync('pnpm drizzle-kit push', {
          cwd: this.serverAppPath,
          env,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 120_000,
        });
        emit({ level: 'success', message: 'تم تطبيق Schema بنجاح (push mode)', timestamp: now() });
        return { applied: ['schema-push'], skipped: [] };
      } catch (e2: unknown) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        emit({ level: 'error', message: `فشل Migrations: ${msg2}`, timestamp: now() });
        return { applied: [], skipped: [], failed: msg2 };
      }
    }
  }
}

function now() { return new Date().toISOString(); }

function parseApplied(output: string): string[] {
  const lines = output.split('\n').filter(l => l.includes('applied') || l.includes('migration'));
  return lines;
}
