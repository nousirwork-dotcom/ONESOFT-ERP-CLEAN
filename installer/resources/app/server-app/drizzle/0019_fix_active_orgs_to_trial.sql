-- Migration 0019: Convert legacy 'active' orgs to 'trial' with 30-day expiry
-- Organizations created by older installers (pre-license system) had status='active'
-- with no subscription_expiry, which caused them to be blocked in production.
-- This migration auto-converts them to 'trial' so existing clients can continue
-- working until they receive a proper license from License Center.

UPDATE organizations
SET
  status             = 'trial',
  subscription_expiry = NOW() + INTERVAL '30 days',
  updated_at         = NOW()
WHERE
  status = 'active'
  AND code != 'SYSTEM'
  AND subscription_expiry IS NULL;
