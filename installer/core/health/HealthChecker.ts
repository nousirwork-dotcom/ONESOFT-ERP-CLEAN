import type { HealthCheckResult, HealthReport, DatabaseConnectionOptions } from '../types.js';
import { checkPostgresHealth }      from './checks/PostgreSQLHealthCheck.js';
import { checkBackendHealth }       from './checks/BackendHealthCheck.js';
import { checkDatabaseConnection }  from './checks/DatabaseConnectionCheck.js';
import { checkPortsHealth }         from './checks/PortsHealthCheck.js';
import { checkServicesHealth }      from './checks/ServicesHealthCheck.js';

export type HealthProgressCallback = (result: HealthCheckResult) => void;

export class HealthChecker {
  async runAll(opts: {
    dbOpts: DatabaseConnectionOptions;
    backendPort: number;
    /** @deprecated لم تعد هناك خدمة Frontend منفصلة — يُحتفَظ بالحقل للتوافق مع الاستدعاءات القديمة فقط، وقيمته تُهمَل هنا */
    frontendPort?: number;
  }, onProgress?: HealthProgressCallback): Promise<HealthReport> {

    const checks: Array<() => Promise<HealthCheckResult>> = [
      () => checkPostgresHealth(),
      () => checkDatabaseConnection(opts.dbOpts),
      () => checkBackendHealth(opts.backendPort),
      () => checkPortsHealth([opts.backendPort]),
      () => checkServicesHealth(),
    ];

    const results: HealthCheckResult[] = [];

    for (const check of checks) {
      const result = await check();
      results.push(result);
      onProgress?.(result);
    }

    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const allHealthy = results.every(r => r.status === 'healthy' || r.status === 'warning' || r.status === 'skipped');

    return {
      allHealthy,
      passedCount: healthyCount,
      totalCount: results.length,
      results,
      checkedAt: new Date().toISOString(),
    };
  }
}
