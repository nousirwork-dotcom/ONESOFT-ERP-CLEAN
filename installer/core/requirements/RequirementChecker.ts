import type { RequirementResult, RequirementsReport } from '../types.js';
import { checkWindowsVersion }   from './checks/WindowsVersionCheck.js';
import { checkAdminPrivileges }  from './checks/AdminPrivilegeCheck.js';
import { checkDiskSpace }        from './checks/DiskSpaceCheck.js';
import { checkMemory }           from './checks/MemoryCheck.js';
import { checkNodeJs }           from './checks/NodeJsCheck.js';
import { checkPostgreSQL }       from './checks/PostgreSQLCheck.js';
import { checkPorts }            from './checks/PortsCheck.js';
import { checkPreviousVersion }  from './checks/PreviousVersionCheck.js';

export type ProgressCallback = (result: RequirementResult) => void;

// ─── RequirementChecker ───────────────────────────────────────────────────────
export class RequirementChecker {

  async checkAll(onProgress?: ProgressCallback): Promise<RequirementsReport> {
    const checks: Array<() => Promise<RequirementResult>> = [
      checkWindowsVersion,
      checkAdminPrivileges,
      checkDiskSpace,
      checkMemory,
      checkNodeJs,
      checkPostgreSQL,
      checkPorts,
      checkPreviousVersion,
    ];

    const results: RequirementResult[] = [];

    for (const check of checks) {
      const result = await check();
      results.push(result);
      onProgress?.(result);
    }

    const allPassed = results.every(r => r.status === 'pass' || r.status === 'warn');
    const canContinue = !results.some(r => r.status === 'fail' && !r.fixable);

    return { allPassed, canContinue, results };
  }
}
