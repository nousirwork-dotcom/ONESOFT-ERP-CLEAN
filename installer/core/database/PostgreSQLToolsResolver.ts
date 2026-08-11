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

  resolveAll(): PostgreSQLTools {
    const resolved = new Map<PostgreSQLToolName, { path: string; source: PostgreSQLTools['sourceByTool'][PostgreSQLToolName] }>();
    const tools: PostgreSQLToolName[] = ['pg_dump', 'pg_restore', 'psql'];

    for (const tool of tools) {
      const result = this.resolveOne(tool);
      if (result) resolved.set(tool, result);
    }

    const missing = tools.filter((tool) => !resolved.has(tool));
    if (missing.length > 0) {
      throw new PostgreSQLToolsResolutionError(missing);
    }

    return {
      pgDump: resolved.get('pg_dump')!.path,
      pgRestore: resolved.get('pg_restore')!.path,
      psql: resolved.get('psql')!.path,
      sourceByTool: {
        pg_dump: resolved.get('pg_dump')!.source,
        pg_restore: resolved.get('pg_restore')!.source,
        psql: resolved.get('psql')!.source,
      },
    };
  }

  version(tool: PostgreSQLToolName): string {
    const resolved = this.resolveOne(tool);
    if (!resolved) throw new PostgreSQLToolsResolutionError([tool]);
    return this.runCommand(resolved.path, ['--version'], this.env).trim();
  }

  private resolveOne(tool: PostgreSQLToolName): {
    path: string;
    source: PostgreSQLTools['sourceByTool'][PostgreSQLToolName];
  } | null {
    for (const directory of this.serviceBinDirectories()) {
      const executable = this.executableIn(directory, tool);
      if (executable && this.isRunnable(executable)) {
        return { path: executable, source: 'service' };
      }
    }

    for (const directory of this.programFilesBinDirectories()) {
      const executable = this.executableIn(directory, tool);
      if (executable && this.isRunnable(executable)) {
        return { path: executable, source: 'program-files' };
      }
    }

    const executable = this.pathFallback(tool);
    return executable ? { path: executable, source: 'path' } : null;
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

  private pathFallback(tool: PostgreSQLToolName): string | null {
    const pathValue = this.env['PATH'] ?? this.env['Path'] ?? '';
    const executableName = this.platform === 'win32' ? `${tool}.exe` : tool;
    const delimiter = this.platform === 'win32' ? ';' : this.filePath.delimiter;
    for (const directory of pathValue.split(delimiter).filter(Boolean)) {
      const executable = this.filePath.join(directory, executableName);
      if (this.exists(executable) && this.isRunnable(executable)) return executable;
    }
    return null;
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