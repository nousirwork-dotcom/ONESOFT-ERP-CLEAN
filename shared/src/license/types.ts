export interface LicensePayload {
  license_id: string;
  org_id: string;
  customer_name: string;
  package: string;
  license_type: "perpetual" | "subscription" | "trial";
  max_users: number;
  max_branches: number;
  max_pos: number;
  max_devices: number;
  max_web: number;
  modules: string[];
  issued_at: string;
  expires_at: string | null;
  issued_by: string;
  web_allowed: boolean;
  desktop_allowed: boolean;
  offline_allowed: boolean;
}

export interface SignedLicense {
  payload: LicensePayload;
  signature: string;
  version: number;
}
