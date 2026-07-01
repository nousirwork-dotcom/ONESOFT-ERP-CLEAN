import { execSync } from 'child_process';
import * as path from 'path';
import type { ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class AccountSeeder {
  constructor(private readonly serverAppPath: string) {}

  async seed(databaseUrl: string, emit: Emit): Promise<void> {
    emit({ level: 'info', message: 'جارٍ تثبيت شجرة الحسابات الافتراضية...', timestamp: now() });

    const scriptPath = path.join(this.serverAppPath, 'scripts', 'seed-chart-of-accounts.ts');

    try {
      execSync(`npx tsx "${scriptPath}"`, {
        cwd: this.serverAppPath,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 60_000,
      });
      emit({ level: 'success', message: 'تم تثبيت شجرة الحسابات بنجاح', timestamp: now() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'warning', message: `تحذير: شجرة الحسابات — ${msg}`, timestamp: now() });
    }
  }
}

function now() { return new Date().toISOString(); }
