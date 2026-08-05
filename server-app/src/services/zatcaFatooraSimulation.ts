import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const FATOORA_SIMULATION_BASE =
  'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';

const REQUEST_TIMEOUT_MS = 30_000;

export type SimulationApiPath =
  | '/compliance'
  | '/compliance/invoices'
  | '/production/csids'
  | '/invoices/reporting/single'
  | '/invoices/clearance/single';

export type CsrInput = {
  commonName: string;
  organizationName: string;
  organizationUnitName: string;
  serialNumber: string;
  vatNumber: string;
  branchLocation: string;
  businessCategory: string;
  solutionName: string;
  model: string;
  branchName: string;
  taxpayerProvidedId: string;
};

export type GeneratedSimulationCsr = {
  privateKeyPem: string;
  publicKeyPem: string;
  csrPem: string;
  csrBase64: string;
  fingerprint: string;
};

export type FatooraResponse = {
  url: string;
  httpStatus: number | null;
  requestId: string | null;
  body: Record<string, unknown> | string | null;
};

export function getSimulationUrl(apiPath: SimulationApiPath): string {
  return `${FATOORA_SIMULATION_BASE}${apiPath}`;
}

export function assertSimulationUrl(value: string): URL {
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'gw-fatoora.zatca.gov.sa'
    || !parsed.pathname.startsWith('/e-invoicing/simulation/')
    || parsed.pathname.includes('/e-invoicing/core')
  ) {
    throw new Error('عنوان Fatoora غير مسموح؛ هذه الخدمة مقيدة ببيئة Simulation فقط');
  }
  return parsed;
}

/**
 * Transport-only probe. It intentionally does not send OTP, CSR, credentials,
 * or invoice data and therefore cannot create or modify an EGS registration.
 * A 4xx response still proves that the Simulation gateway is reachable; the
 * API/authentication result is handled by the onboarding calls themselves.
 */
export async function probeFatooraSimulation(): Promise<{
  reachable: boolean;
  httpStatus: number | null;
}> {
  const url = assertSimulationUrl(getSimulationUrl('/compliance'));
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'Accept-Version': 'V2' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { reachable: response.status < 500, httpStatus: response.status };
  } catch {
    return { reachable: false, httpStatus: null };
  }
}

function configValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, ' ')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .trim();
}

function runOpenSsl(args: string[], cwd: string): void {
  const result = spawnSync('openssl', args, {
    cwd,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('تعذر إنشاء CSR على الخادم');
  }
}

export function generateSimulationCsr(input: CsrInput): GeneratedSimulationCsr {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onesoft-zatca-'));
  const configPath = path.join(workDir, 'csr.cnf');
  const privateKeyPath = path.join(workDir, 'private-key.pem');
  const publicKeyPath = path.join(workDir, 'public-key.pem');
  const csrPath = path.join(workDir, 'request.csr');

  const serial = configValue(
    `1-${input.solutionName}|2-${input.model}|3-${input.serialNumber}`,
  );
  const config = [
    'oid_section = OIDs',
    '',
    '[OIDs]',
    'certificateTemplateName = 1.3.6.1.4.1.311.20.2',
    '',
    '[req]',
    'prompt = no',
    'distinguished_name = dn',
    'req_extensions = v3_req',
    'default_md = sha256',
    '',
    '[dn]',
    `C = ${configValue('SA')}`,
    `O = ${configValue(input.organizationName)}`,
    `OU = ${configValue(input.organizationUnitName)}`,
    `CN = ${configValue(input.commonName)}`,
    '',
    '[v3_req]',
    'certificateTemplateName = ASN1:PRINTABLESTRING:PREZATCA-Code-Signing',
    'subjectAltName = dirName:alt_names',
    'basicConstraints = CA:FALSE',
    'keyUsage = digitalSignature, nonRepudiation, keyEncipherment',
    '',
    '[alt_names]',
    `SN = ${serial}`,
    `UID = ${configValue(input.vatNumber)}`,
    'title = 1100',
    `registeredAddress = ${configValue(input.branchLocation)}`,
    `businessCategory = ${configValue(input.businessCategory)}`,
    '',
  ].join('\n');

  try {
    fs.writeFileSync(configPath, config, { encoding: 'utf8', mode: 0o600 });
    runOpenSsl(['ecparam', '-name', 'secp256k1', '-genkey', '-noout', '-out', privateKeyPath], workDir);
    runOpenSsl(['ec', '-in', privateKeyPath, '-pubout', '-out', publicKeyPath], workDir);
    runOpenSsl(['req', '-new', '-sha256', '-key', privateKeyPath, '-out', csrPath, '-config', configPath, '-utf8'], workDir);

    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
    const csrPem = fs.readFileSync(csrPath, 'utf8');
    const publicKeyDer = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });

    return {
      privateKeyPem,
      publicKeyPem,
      csrPem,
      csrBase64: Buffer.from(csrPem, 'utf8').toString('base64'),
      fingerprint: crypto.createHash('sha256').update(publicKeyDer).digest('hex'),
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function basicAuth(binarySecurityToken: string, secret: string): string {
  return `Basic ${Buffer.from(`${binarySecurityToken}:${secret}`, 'utf8').toString('base64')}`;
}

function responseBody(raw: string): Record<string, unknown> | string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : raw;
  } catch {
    return raw;
  }
}

export async function postFatooraSimulation(input: {
  apiPath: SimulationApiPath;
  body: Record<string, unknown>;
  otp?: string;
  binarySecurityToken?: string;
  secret?: string;
  clearance?: boolean;
  clearanceStatus?: '0' | '1';
  correlationId?: string;
  idempotencyKey?: string;
}): Promise<FatooraResponse> {
  const url = assertSimulationUrl(getSimulationUrl(input.apiPath));
  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-language': 'en',
    'Accept-Version': 'V2',
    'Content-Type': 'application/json',
  };
  if (input.otp) headers.OTP = input.otp;
  if (input.clearanceStatus) headers['Clearance-Status'] = input.clearanceStatus;
  else if (input.clearance) headers['Clearance-Status'] = '1';
  if (input.correlationId) headers['x-correlation-id'] = input.correlationId;
  if (input.idempotencyKey) headers['idempotency-key'] = input.idempotencyKey;
  if (input.binarySecurityToken && input.secret) {
    headers.Authorization = basicAuth(input.binarySecurityToken, input.secret);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { url: url.toString(), httpStatus: null, requestId: null, body: null };
  }

  const raw = await response.text();
  const parsed = responseBody(raw);
  const requestId =
    response.headers.get('request-id')
    ?? response.headers.get('x-request-id')
    ?? (parsed && typeof parsed === 'object'
      ? String(parsed.requestID ?? parsed.requestId ?? '') || null
      : null);

  return {
    url: url.toString(),
    httpStatus: response.status,
    requestId,
    body: parsed,
  };
}