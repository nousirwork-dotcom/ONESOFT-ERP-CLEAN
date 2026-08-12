import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type PostgreSQLToolName = 'pg_dump' | 'pg_restore' | 'psql';

export interface PostgreSQLTools {
  pgDump: string;
  pgRestore: string;
  psql: string;
  sourceByTool: Record<PostgreSQLToolName, 'service' | 'program-files' | 'path'>;
}

export interface PostgreSQLToolsResolverOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  existsSync?: (filePath: string) => boolean;
  readdirSync?: (directory: string, options?: { withFileTypes: true }) => fs.Dirent[];
  runCommand?: (filePath: string, args: string[], env: NodeJS.ProcessEnv) => string;
  probeCommand?: (filePath: string, env: NodeJS.ProcessEnv) => boolean;
}

export interface PostgreSQLServerConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const POSTGRES_MIGRATOR_ROLE = 'onesoft_migrator';
export const POSTGRES_SCHEMA_OWNER_ROLE = 'onesoft_schema_owner';
export const POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG =
  `--role=${POSTGRES_SCHEMA_OWNER_ROLE}`;

export function buildPostgreSQLConnectionArgs(
  connection: PostgreSQLServerConnection,
  database = connection.database,
): string[] {
  return [
    '-h', connection.host,
    '-p', String(connection.port),
    '-U', connection.user,
    '-d', database,
    '--no-password',
  ];
}

/**
 * Build the administrative pg_dump command used by Upgrade/Foundation.
 *
 * The connection must remain authenticated as the migrator. The schema-owner
 * role is only a PostgreSQL session role for the dump; it must never become
 * the login/ownership credential.
 */
export function buildMigratorPgDumpArgs(
  connection: PostgreSQLServerConnection,
): string[] {
  if (connection.user !== POSTGRES_MIGRATOR_ROLE) {
    throw new Error(
      `Administrative pg_dump requires ${POSTGRES_MIGRATOR_ROLE}; received ${connection.user}`,
    );
  }

  const args = [
    ...buildPostgreSQLConnectionArgs(connection),
    POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG,
  ];
  if (!args.includes(POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG)) {
    throw new Error(
      `Administrative pg_dump arguments are missing ${POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG}`,
    );
  }
  return args;
}

export function buildPostgreSQLToolEnv(
  connection: PostgreSQLServerConnection,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return { ...baseEnv, PGPASSWORD: connection.password };
}

export const POSTGRESQL_TOOLS_MISSING_MESSAGE =
  'تعذر العثور على أدوات PostgreSQL اللازمة للنسخ الاحتياطي.';

export class PostgreSQLToolsResolutionError extends Error {
  readonly missingTools: PostgreSQLToolName[];

  constructor(missingTools: PostgreSQLToolName[]) {
    super(POSTGRESQL_TOOLS_MISSING_MESSAGE);
    this.name = 'PostgreSQLToolsResolutionError';
    this.missingTools = missingTools;
  }
}

/**
 * Resolves PostgreSQL client tools without relying on PATH.
 *
 * Windows installations commonly register only the PostgreSQL server service
 * and do not add PostgreSQL\bin to PATH. The service ImagePath is therefore
 * checked first, followed by both Program Files locations. PATH is deliberately
 * the final fallback so a globally installed client cannot mask the local
 * PostgreSQL installation.
 */
export class PostgreSQLToolsResolver {
  private readonly platform: NodeJS.Platform;
  private readonly filePath: typeof path.posix | typeof path.win32;
  private readonly env: NodeJS.ProcessEnv;
  private readonly exists: (filePath: string) => boolean;
  private readonly readdir: (directory: string, options?: { withFileTypes: true }) => fs.Dirent[];
  private readonly runCommand: (filePath: string, args: string[], env: NodeJS.ProcessEnv) => string;
  private readonly probeCommand: (filePath: string, env: NodeJS.ProcessEnv) => boolean;

  constructor(options: PostgreSQLToolsResolverOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.filePath = this.platform === 'win32' ? path.win32 : path.posix;
    this.env = options.env ?? process.env;
    this.exists = options.existsSync ?? fs.existsSync;
    this.readdir = options.readdirSync ?? ((directory) =>
      fs.readdirSync(directory, { withFileTypes: true }));
    this.runCommand = options.runCommand ?? ((filePath, args, env) =>
      execFileSync(filePath, args, { env, encoding: 'utf8', stdio: 'pipe', windowsHide: true }));
    this.probeCommand = options.probeCommand ?? ((filePath, env) => {
      const result = spawnSync(filePath, ['--version'], {
        env,
        encoding: 'utf8',
        stdio: 'pipe',
        windowsHide: true,
      });
      return result.error === undefined && result.status === 0;
    });
  }

  resolveAll(serverConnection?: PostgreSQLServerConnection): PostgreSQLTools {
    const tools: PostgreSQLToolName[] = ['pg_dump', 'pg_restore', 'psql'];
    const candidates = this.candidateDirectories();
    const serverMajor = serverConnection
      ? this.discoverServerMajor(candidates, serverConnection)
      : undefined;
    const selected = this.selectDirectory(candidates, serverMajor);

    if (!selected) {
      throw new PostgreSQLToolsResolutionError(tools);
    }

    const resolved = new Map(tools.map((tool) => [
      tool,
      this.executableIn(selected.path, tool)!,
    ]));

    return {
      pgDump: resolved.get('pg_dump')!,
      pgRestore: resolved.get('pg_restore')!,
      psql: resolved.get('psql')!,
      sourceByTool: {
        pg_dump: selected.source,
        pg_restore: selected.source,
        psql: selected.source,
      },
    };
  }

  version(tool: PostgreSQLToolName, serverConnection?: PostgreSQLServerConnection): string {
    const resolved = this.resolveAll(serverConnection);
    const executable = {
      pg_dump: resolved.pgDump,
      pg_restore: resolved.pgRestore,
      psql: resolved.psql,
    }[tool];
    return this.runCommand(executable, ['--version'], this.env).trim();
  }

  private selectDirectory(
    candidates: CandidateDirectory[],
    serverMajor: number | undefined,
  ): CandidateDirectory | null {
    const complete = candidates
      .map((candidate) => ({ candidate, inspection: this.inspectDirectory(candidate.path) }))
      .filter((item): item is {
        candidate: CandidateDirectory;
        inspection: DirectoryInspection;
      } => item.inspection !== null);

    const matching = serverMajor === undefined
      ? complete
      : complete.filter(({ inspection }) => inspection.major === serverMajor);

    if (matching.length === 0) return null;

    // With a live server connection, the matching major version is the
    // authority. Without one, never guess between multiple installations.
    const serviceMatches = matching.filter(({ candidate }) => candidate.source === 'service');
    if (serverMajor === undefined && serviceMatches.length === 1) {
      return serviceMatches[0]!.candidate;
    }
    if (matching.length === 1) {
      return matching[0]!.candidate;
    }
    return null;
  }

  private inspectDirectory(directory: string): DirectoryInspection | null {
    const tools: PostgreSQLToolName[] = ['pg_dump', 'pg_restore', 'psql'];
    const paths = new Map<PostgreSQLToolName, string>();
    const versions = new Map<PostgreSQLToolName, number>();

    for (const tool of tools) {
      const executable = this.executableIn(directory, tool);
      if (!executable || !this.isRunnable(executable)) return null;
      let major: number | null;
      try {
        major = parseToolMajor(this.runCommand(executable, ['--version'], this.env));
      } catch {
        return null;
      }
      if (major === null) return null;
      paths.set(tool, executable);
      versions.set(tool, major);
    }

    const majors = [...versions.values()];
    if (new Set(majors).size !== 1) return null;
    return { major: majors[0]!, paths };
  }

  private discoverServerMajor(
    candidates: CandidateDirectory[],
    connection: PostgreSQLServerConnection,
  ): number {
    for (const candidate of candidates) {
      const psql = this.executableIn(candidate.path, 'psql');
      if (!psql || !this.isRunnable(psql)) continue;
      try {
        const output = this.runCommand(
          psql,
          [
            ...buildPostgreSQLConnectionArgs(connection),
            '-X',
            '-q',
            '-tA',
            '-c',
            'SHOW server_version_num;',
          ],
          { ...this.env, PGPASSWORD: connection.password },
        );
        const major = parseServerMajor(output);
        if (major !== null) return major;
      } catch {
        // Try the next locally installed psql as a read-only probe.
      }
    }

    throw new Error('تعذر تحديد إصدار PostgreSQL Server الفعلي عبر اتصال OneSoft.');
  }

  private candidateDirectories(): CandidateDirectory[] {
    const candidates: CandidateDirectory[] = [];
    for (const directory of this.serviceBinDirectories()) {
      candidates.push({ path: directory, source: 'service' });
    }
    for (const directory of this.programFilesBinDirectories()) {
      candidates.push({ path: directory, source: 'program-files' });
    }
    for (const directory of this.pathDirectories()) {
      candidates.push({ path: directory, source: 'path' });
    }
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const key = this.platform === 'win32' ? candidate.path.toLowerCase() : candidate.path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private executableIn(directory: string, tool: PostgreSQLToolName): string | null {
    const executable = this.filePath.join(directory, this.platform === 'win32' ? `${tool}.exe` : tool);
    return this.exists(executable) ? executable : null;
  }

  private isRunnable(executable: string): boolean {
    try {
      return this.probeCommand(executable, this.env);
    } catch {
      return false;
    }
  }

  private serviceBinDirectories(): string[] {
    if (this.platform !== 'win32') return [];

    const services = this.runWindowsCommand('sc.exe', ['query', 'state=', 'all']);
    const names = [...services.matchAll(/SERVICE_NAME:\s*(\S+)/gi)].map((match) => match[1]!);
    const directories: string[] = [];
    for (const service of names.filter((name) => /postgres/i.test(name))) {
      const config = this.runWindowsCommand('sc.exe', ['qc', service]);
      const imagePath = config.match(/BINARY_PATH_NAME\s*:\s*(.+)/i)?.[1]?.trim();
      if (!imagePath) continue;
      const executable = extractExecutablePath(imagePath);
      if (executable) directories.push(this.filePath.dirname(executable));
    }
    return uniqueExistingDirectories(directories, this.exists);
  }

  private programFilesBinDirectories(): string[] {
    if (this.platform !== 'win32') return [];

    const roots = unique([
      this.env['ProgramW6432'],
      this.env['ProgramFiles'],
      this.env['PROGRAMFILES'],
      this.env['ProgramFiles(x86)'],
      this.env['PROGRAMFILES(X86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)',
    ].filter((value): value is string => Boolean(value)));

    const directories: string[] = [];
    for (const root of roots) {
      const postgresRoot = this.filePath.join(root, 'PostgreSQL');
      if (!this.exists(postgresRoot)) continue;
      let entries: fs.Dirent[] = [];
      try {
        entries = this.readdir(postgresRoot, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries
        .filter((candidate) => candidate.isDirectory() && /^\d+(?:\.\d+)?$/.test(candidate.name))
        .sort((a, b) => compareVersions(b.name, a.name))) {
        const bin = this.filePath.join(postgresRoot, entry.name, 'bin');
        if (this.exists(bin)) directories.push(bin);
      }
    }
    return uniqueExistingDirectories(directories, this.exists);
  }

  private pathDirectories(): string[] {
    const pathValue = this.env['PATH'] ?? this.env['Path'] ?? '';
    const delimiter = this.platform === 'win32' ? ';' : this.filePath.delimiter;
    return pathValue.split(delimiter).filter(Boolean);
  }

  private runWindowsCommand(filePath: string, args: string[]): string {
    try {
      return this.runCommand(filePath, args, this.env);
    } catch {
      return '';
    }
  }
}

function extractExecutablePath(imagePath: string): string | null {
  const quoted = imagePath.match(/"([^"]+\.exe)"/i)?.[1];
  if (quoted) return quoted;
  // `sc qc` may return an unquoted path even when it contains spaces.
  const unquoted = imagePath.match(/^\s*(.+?\\(?:postgres|postmaster)\.exe)(?:\s|$)/i)?.[1];
  return unquoted ?? null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueExistingDirectories(values: string[], exists: (filePath: string) => boolean): string[] {
  return unique(values).filter((value) => exists(value));
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

interface CandidateDirectory {
  path: string;
  source: PostgreSQLTools['sourceByTool'][PostgreSQLToolName];
}

interface DirectoryInspection {
  major: number;
  paths: Map<PostgreSQLToolName, string>;
}

function parseToolMajor(output: string): number | null {
  const match = output.match(/\b(\d+)\.(\d+)(?:\.\d+)?\b/);
  return match ? Number(match[1]) : null;
}

function parseServerMajor(output: string): number | null {
  const versionNum = Number(output.trim().split(/\s+/)[0]);
  if (!Number.isInteger(versionNum) || versionNum <= 0) return null;
  return versionNum >= 100000 ? Math.floor(versionNum / 10000) : Math.floor(versionNum / 10000);
}