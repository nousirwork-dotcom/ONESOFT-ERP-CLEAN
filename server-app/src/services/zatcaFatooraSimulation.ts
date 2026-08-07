import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export type FatooraEnvironment = 'simulation' | 'production';

export const FATOORA_BASE_URLS: Readonly<Record<FatooraEnvironment, string>> = {
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

const REQUEST_TIMEOUT_MS = 30_000;

export type FatooraApiPath =
  | '/compliance'
  | '/compliance/invoices'
  | '/production/csids'
  | '/invoices/reporting/single'
  | '/invoices/clearance/single';

/** @deprecated Use FatooraApiPath in environment-neutral transport code. */
export type SimulationApiPath = FatooraApiPath;

const FATOORA_API_PATHS: ReadonlySet<string> = new Set([
  '/compliance',
  '/compliance/invoices',
  '/production/csids',
  '/invoices/reporting/single',
  '/invoices/clearance/single',
]);

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

/**
 * The operational-CSID endpoint expects the numeric requestID returned inside
 * the successful Compliance response body. The transport requestId (HTTP
 * header/request UUID) identifies the HTTP exchange only and is not a valid
 * Compliance reference.
 *
 * Keep this extraction strict and shared by every environment flow:
 * - read body.requestID only;
 * - accept a positive integer or its decimal-string representation;
 * - never fall back to response.requestId or body.requestId.
 */
export function extractComplianceRequestId(payload: unknown): string | null {
  let value: unknown = payload;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const body = (value as Record<string, unknown>).body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const requestId = (body as Record<string, unknown>).requestID;
  if (typeof requestId === 'number') {
    return Number.isSafeInteger(requestId) && requestId > 0 ? String(requestId) : null;
  }
  if (typeof requestId === 'string') {
    const normalized = requestId.trim();
    return /^\d+$/.test(normalized) && BigInt(normalized) > 0n ? normalized : null;
  }
  return null;
}

/**
 * The Simulation /compliance response returns the Compliance certificate in
 * binarySecurityToken. It is a Base64-encoded DER X.509 certificate, while
 * the invoice signer expects PEM. Keep the transport token unchanged for
 * Basic auth and normalize only the certificate copy.
 */
export function complianceCertificatePem(
  binarySecurityToken: string,
  privateKeyPem?: string,
): string {
  const value = binarySecurityToken.trim();
  if (!value) throw new Error('شهادة Compliance غير مستلمة');

  let certificate: crypto.X509Certificate | undefined;
  try {
    if (value.includes('BEGIN CERTIFICATE')) {
      certificate = new crypto.X509Certificate(value);
    } else {
      let decoded = Buffer.from(value.replace(/\s+/g, ''), 'base64');
      if (!decoded.length) throw new Error('شهادة Compliance فارغة');

      // Some Simulation responses contain the DER certificate encoded as
      // Base64 twice. Accept that transport quirk, but never decode
      // unbounded/arbitrary content.
      for (let layer = 0; layer < 2 && decoded[0] !== 0x30; layer += 1) {
        const text = decoded.toString('utf8').trim();
        if (text.includes('BEGIN CERTIFICATE')) {
          certificate = new crypto.X509Certificate(text);
          break;
        }
        if (!/^[A-Za-z0-9+/=\s]+$/.test(text) || text.length < 32) {
          throw new Error('صيغة شهادة Compliance غير صالحة');
        }
        decoded = Buffer.from(text.replace(/\s+/g, ''), 'base64');
      }

      if (!certificate) {
        if (decoded[0] !== 0x30) throw new Error('صيغة شهادة Compliance غير صالحة');
        const pem = [
          '-----BEGIN CERTIFICATE-----',
          decoded.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '',
          '-----END CERTIFICATE-----',
        ].join('\n');
        certificate = new crypto.X509Certificate(pem);
      }
    }
  } catch {
    throw new Error('تعذر قراءة شهادة Compliance بصيغة X.509');
  }

  if (privateKeyPem?.trim()) {
    try {
      const certificatePublicKey = certificate.publicKey.export({ type: 'spki', format: 'der' });
      const privateKeyPublicKey = crypto.createPublicKey(privateKeyPem).export({
        type: 'spki',
        format: 'der',
      });
      if (!Buffer.from(certificatePublicKey).equals(Buffer.from(privateKeyPublicKey))) {
        throw new Error('شهادة Compliance لا تطابق المفتاح الخاص المحفوظ');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('لا تطابق')) throw error;
      throw new Error('تعذر مطابقة شهادة Compliance بالمفتاح الخاص المحفوظ');
    }
  }

  return certificate.toString();
}

export function getFatooraUrl(environment: FatooraEnvironment, apiPath: FatooraApiPath): string {
  return `${FATOORA_BASE_URLS[environment]}${apiPath}`;
}

export function assertFatooraUrl(value: string, environment: FatooraEnvironment): URL {
  const parsed = new URL(value);
  const expectedBase = new URL(FATOORA_BASE_URLS[environment]);
  const expectedPrefix = `${expectedBase.pathname}/`;
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== expectedBase.hostname
    || parsed.port !== expectedBase.port
    || !parsed.pathname.startsWith(expectedPrefix)
    || !FATOORA_API_PATHS.has(parsed.pathname.slice(expectedBase.pathname.length))
  ) {
    throw new Error(`عنوان Fatoora غير مسموح لبيئة ${environment}`);
  }
  return parsed;
}

export function getSimulationUrl(apiPath: SimulationApiPath): string {
  return getFatooraUrl('simulation', apiPath);
}

/** @deprecated Use assertFatooraUrl(value, environment). */
export function assertSimulationUrl(value: string): URL {
  return assertFatooraUrl(value, 'simulation');
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
  const url = assertFatooraUrl(getFatooraUrl('simulation', '/compliance'), 'simulation');
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

export type FatooraCredentials = {
  binarySecurityToken: string;
  secret: string;
};

export async function postFatoora(input: {
  environment: FatooraEnvironment;
  apiPath: FatooraApiPath;
  body: Record<string, unknown>;
  otp?: string;
  credentials?: FatooraCredentials;
  clearance?: boolean;
  clearanceStatus?: '0' | '1';
  correlationId?: string;
  idempotencyKey?: string;
}): Promise<FatooraResponse> {
  const url = assertFatooraUrl(
    getFatooraUrl(input.environment, input.apiPath),
    input.environment,
  );
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
  if (input.credentials?.binarySecurityToken && input.credentials.secret) {
    headers.Authorization = basicAuth(
      input.credentials.binarySecurityToken,
      input.credentials.secret,
    );
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

/** @deprecated Use postFatoora with an explicit environment and credentials. */
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
  return postFatoora({
    environment: 'simulation',
    apiPath: input.apiPath,
    body: input.body,
    otp: input.otp,
    credentials: input.binarySecurityToken && input.secret
      ? { binarySecurityToken: input.binarySecurityToken, secret: input.secret }
      : undefined,
    clearance: input.clearance,
    clearanceStatus: input.clearanceStatus,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
}