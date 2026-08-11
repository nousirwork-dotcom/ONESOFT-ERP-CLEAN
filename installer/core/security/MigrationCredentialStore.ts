import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { APP_VERSION } from '../version.js';
import type { DatabaseConnectionOptions } from '../types.js';

export interface MigrationCredential extends DatabaseConnectionOptions {
  role: string;
  createdByVersion: string;
}

const ROLE_NAME = 'onesoft_migrator';

function securityDir(): string {
  const base = process.platform === 'win32'
    ? process.env['ProgramData'] || 'C:\\ProgramData'
    : process.env['HOME'] || '/tmp';
  return path.join(base, 'OneSoft', 'Security');
}

function credentialPath(): string {
  return path.join(securityDir(), 'migration-credential.bin');
}

const POWERSHELL_SCRIPT = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class OneSoftDpapi {
  [StructLayout(LayoutKind.Sequential)]
  public struct DATA_BLOB { public int cbData; public IntPtr pbData; }
  [DllImport("crypt32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool CryptProtectData(ref DATA_BLOB input, string description, IntPtr entropy, IntPtr reserved, IntPtr prompt, uint flags, ref DATA_BLOB output);
  [DllImport("crypt32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool CryptUnprotectData(ref DATA_BLOB input, IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, uint flags, ref DATA_BLOB output);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern IntPtr LocalFree(IntPtr hMem);
  static DATA_BLOB Blob(byte[] bytes) {
    var blob = new DATA_BLOB();
    blob.cbData = bytes.Length;
    blob.pbData = Marshal.AllocHGlobal(bytes.Length);
    Marshal.Copy(bytes, 0, blob.pbData, bytes.Length);
    return blob;
  }
  public static byte[] Protect(byte[] clear) {
    var input = Blob(clear); var output = new DATA_BLOB();
    try {
      if (!CryptProtectData(ref input, "OneSoft migration credential", IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0x4, ref output))
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      var result = new byte[output.cbData];
      Marshal.Copy(output.pbData, result, 0, output.cbData);
      return result;
    } finally {
      if (input.pbData != IntPtr.Zero) Marshal.FreeHGlobal(input.pbData);
      if (output.pbData != IntPtr.Zero) LocalFree(output.pbData);
    }
  }
  public static byte[] Unprotect(byte[] encrypted) {
    var input = Blob(encrypted); var output = new DATA_BLOB();
    try {
      if (!CryptUnprotectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0, ref output))
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      var result = new byte[output.cbData];
      Marshal.Copy(output.pbData, result, 0, output.cbData);
      return result;
    } finally {
      if (input.pbData != IntPtr.Zero) Marshal.FreeHGlobal(input.pbData);
      if (output.pbData != IntPtr.Zero) LocalFree(output.pbData);
    }
  }
}
"@
$inputText = [Console]::In.ReadToEnd()
$inputBytes = [Convert]::FromBase64String($inputText.Trim())
if ($env:ONESOFT_DPAPI_ACTION -eq "protect") {
  [Convert]::ToBase64String([OneSoftDpapi]::Protect($inputBytes))
} elseif ($env:ONESOFT_DPAPI_ACTION -eq "unprotect") {
  [Text.Encoding]::UTF8.GetString([OneSoftDpapi]::Unprotect($inputBytes))
} else {
  throw "Invalid DPAPI action"
}
`;

function runDpapi(action: 'protect' | 'unprotect', input: Buffer): Buffer | string {
  if (process.platform !== 'win32') {
    throw new Error('Windows DPAPI is available only on Windows');
  }
  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL_SCRIPT],
    {
      input: action === 'protect'
        ? input.toString('base64')
        : input.toString('base64'),
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ONESOFT_DPAPI_ACTION: action },
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Windows DPAPI operation failed (exit ${result.status ?? 'unknown'})`);
  }
  const output = String(result.stdout ?? '').trim();
  if (!output) throw new Error('Windows DPAPI returned no data');
  return action === 'protect'
    ? Buffer.from(output, 'base64')
    : Buffer.from(output, 'utf8').toString('utf8');
}

function restrictAcl(filePath: string): void {
  const directory = path.dirname(filePath);
  const directoryResult = spawnSync(
    'icacls.exe',
    [
      directory,
      '/inheritance:r',
      '/grant:r', '*S-1-5-18:(OI)(CI)(F)', '*S-1-5-32-544:(OI)(CI)(F)',
      '/remove:g', '*S-1-5-11', '*S-1-5-32-545', '*S-1-1-0',
    ],
    { encoding: 'utf8', windowsHide: true, stdio: 'pipe' },
  );
  if (directoryResult.status !== 0) {
    throw new Error('Could not apply the Windows ACL to the migration credential directory');
  }
  const result = spawnSync(
    'icacls.exe',
    [
      filePath,
      '/inheritance:r',
      '/grant:r', '*S-1-5-18:(F)', '*S-1-5-32-544:(F)',
      '/remove:g', '*S-1-5-11', '*S-1-5-32-545', '*S-1-1-0',
    ],
    { encoding: 'utf8', windowsHide: true, stdio: 'pipe' },
  );
  if (result.status !== 0) {
    throw new Error('Could not apply the Windows ACL to the migration credential store');
  }
}

export class MigrationCredentialStore {
  static readonly role = ROLE_NAME;
  static readonly path = credentialPath;

  static exists(): boolean {
    return process.platform === 'win32' && fs.existsSync(credentialPath());
  }

  static save(credential: MigrationCredential): void {
    if (process.platform !== 'win32') {
      throw new Error('Migration credentials can only be stored on Windows');
    }
    fs.mkdirSync(securityDir(), { recursive: true });
    const payload = Buffer.from(JSON.stringify({
      ...credential,
      role: ROLE_NAME,
      createdByVersion: APP_VERSION,
    }), 'utf8');
    const encrypted = runDpapi('protect', payload) as Buffer;
    fs.writeFileSync(credentialPath(), encrypted, { mode: 0o600 });
    restrictAcl(credentialPath());
  }

  static load(): MigrationCredential | null {
    if (!this.exists()) return null;
    try {
      const encrypted = fs.readFileSync(credentialPath());
      const raw = runDpapi('unprotect', encrypted) as string;
      const parsed = JSON.parse(raw) as MigrationCredential;
      if (parsed.role !== ROLE_NAME || parsed.user !== ROLE_NAME || !parsed.password) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static remove(): void {
    if (process.platform === 'win32' && fs.existsSync(credentialPath())) {
      fs.rmSync(credentialPath(), { force: true });
    }
  }
}