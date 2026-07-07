#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# verify-client-build.sh — تحقق من أن build العميل لا يحتوي على مكونات المالك
#
# الاستخدام:
#   bash scripts/verify-client-build.sh [client-dist-dir] [server-dist-dir]
#
# مثال:
#   bash scripts/verify-client-build.sh client-app/dist server-app/dist
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

CLIENT_DIST="${1:-client-app/dist}"
SERVER_DIST="${2:-server-app/dist}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "  ${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"; }
section() { echo -e "\n${YELLOW}▶ $1${NC}"; }

echo ""
echo "════════════════════════════════════════════════════"
echo "  OneSoft — Client Build Security Verification"
echo "════════════════════════════════════════════════════"

# ── 1. بنية الملفات ──────────────────────────────────────────────────────────
section "1. File Structure"

if [[ -d "$CLIENT_DIST" ]]; then
  pass "Client dist exists: $CLIENT_DIST"
else
  warn "Client dist not found — run 'pnpm build:client' first: $CLIENT_DIST"
fi

if [[ ! -d "$CLIENT_DIST/license-center-app" ]]; then
  pass "license-center-app NOT inside client dist"
else
  fail "license-center-app found inside client dist — must be excluded from installer"
fi

# ── 2. فحص ملفات JavaScript للعميل ──────────────────────────────────────────
section "2. Client-App JS Bundle Scan"

if [[ -d "$CLIENT_DIST/assets" ]]; then
  LC_REFS=$(grep -rl "licenseCenterRouter\|licenseCenter\.seedDemo\|licenseCenter\.createClient\|license-center-app" "$CLIENT_DIST/assets/" 2>/dev/null | wc -l)
  if [[ "$LC_REFS" -eq 0 ]]; then
    pass "No licenseCenter router references in client JS bundles"
  else
    fail "licenseCenter references found in client bundle ($LC_REFS files)"
    grep -rl "licenseCenterRouter\|licenseCenter\.seedDemo" "$CLIENT_DIST/assets/" 2>/dev/null || true
  fi

  PRIV_KEY=$(grep -rl "BEGIN PRIVATE KEY\|PRIVATE KEY-----" "$CLIENT_DIST/" 2>/dev/null | wc -l)
  if [[ "$PRIV_KEY" -eq 0 ]]; then
    pass "No private key found in client bundle"
  else
    fail "Private key material detected in client bundle ($PRIV_KEY files) — CRITICAL"
  fi

  LC_ROUTE=$(grep -rl '"/license-center"' "$CLIENT_DIST/" 2>/dev/null | wc -l)
  if [[ "$LC_ROUTE" -eq 0 ]]; then
    pass "Route /license-center NOT in client bundle"
  else
    fail "Route /license-center found in client bundle ($LC_ROUTE files)"
  fi
else
  warn "No assets/ folder found — skipping JS bundle scan"
fi

# ── 3. فحص Server-App (إذا وُجد dist) ───────────────────────────────────────
section "3. Server-App Security Check"

if [[ -d "$SERVER_DIST" ]]; then
  PRIV_KEY_SERVER=$(grep -rl "BEGIN PRIVATE KEY\|-----BEGIN EC PRIVATE KEY" "$SERVER_DIST/" 2>/dev/null | wc -l)
  if [[ "$PRIV_KEY_SERVER" -eq 0 ]]; then
    pass "No private key in server dist"
  else
    fail "Private key found in server dist ($PRIV_KEY_SERVER files) — CRITICAL"
  fi

  CLIENT_BUILD_ENV=$(grep -rl "CLIENT_BUILD" "$SERVER_DIST/" 2>/dev/null | wc -l)
  if [[ "$CLIENT_BUILD_ENV" -gt 0 ]]; then
    pass "CLIENT_BUILD guard present in server dist ($CLIENT_BUILD_ENV files)"
  else
    warn "CLIENT_BUILD guard not detected in server dist (may be tree-shaken)"
  fi
else
  warn "No server dist found — check server-app build setup"
fi

# ── 4. فحص Source Code ────────────────────────────────────────────────────────
section "4. Source Code Audit"

# تحقق من أن client-app لا يستورد LicenseCenterPage
LC_IMPORT=$(grep -r "LicenseCenterPage\|/license-center" client-app/src/ 2>/dev/null | grep -v "LicenseActivation\|LicensePreview" | wc -l)
if [[ "$LC_IMPORT" -eq 0 ]]; then
  pass "No LicenseCenterPage import in client-app/src"
else
  fail "LicenseCenterPage or /license-center reference found in client-app/src ($LC_IMPORT lines)"
  grep -r "LicenseCenterPage\|/license-center" client-app/src/ 2>/dev/null | grep -v "LicenseActivation\|LicensePreview" || true
fi

# تحقق من أن private key ليس في server-app src
PRIV_KEY_SRC=$(grep -r "BEGIN PRIVATE KEY\|privateKeyPem\s*=\s*['\`]" server-app/src/ 2>/dev/null | grep -v "NEVER\|comment\|schema" | wc -l)
if [[ "$PRIV_KEY_SRC" -eq 0 ]]; then
  pass "No private key literal in server-app/src"
else
  fail "Possible private key literal in server-app/src ($PRIV_KEY_SRC lines) — review manually"
fi

# تحقق من أن ownerOnlyProcedure تحمي licenseCenter
OOP_GUARD=$(grep -c "ownerOnlyProcedure\|CLIENT_BUILD" server-app/src/trpc.ts 2>/dev/null || echo 0)
if [[ "$OOP_GUARD" -gt 0 ]]; then
  pass "ownerOnlyProcedure with CLIENT_BUILD guard present in trpc.ts"
else
  fail "CLIENT_BUILD guard missing from trpc.ts"
fi

# تحقق من أن licenseCenter router يستخدم ownerOnlyProcedure
OOP_LC=$(grep -c "ownerOnlyProcedure" server-app/src/routers/licenseCenter.ts 2>/dev/null || echo 0)
if [[ "$OOP_LC" -gt 3 ]]; then
  pass "licenseCenter router uses ownerOnlyProcedure ($OOP_LC usages)"
else
  fail "licenseCenter router does not use ownerOnlyProcedure correctly ($OOP_LC usages)"
fi

# تحقق من أن IS_CLIENT_BUILD موجود في index.ts
CLIENT_BUILD_INDEX=$(grep -c "IS_CLIENT_BUILD\|CLIENT_BUILD" server-app/src/routers/index.ts 2>/dev/null || echo 0)
if [[ "$CLIENT_BUILD_INDEX" -gt 0 ]]; then
  pass "CLIENT_BUILD conditional present in routers/index.ts"
else
  fail "CLIENT_BUILD conditional missing from routers/index.ts"
fi

# ── 5. تحقق من /cfg/license موجود في client-app ──────────────────────────────
section "5. Client License Activation Page"

CFG_LIC=$(grep -r "LicenseActivationPage\|/cfg/license" client-app/src/ 2>/dev/null | wc -l)
if [[ "$CFG_LIC" -gt 0 ]]; then
  pass "/cfg/license (activation only) present in client-app"
else
  warn "/cfg/license not found in client-app — verify activation page exists"
fi

# ── 6. ملخص ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ ALL $TOTAL CHECKS PASSED${NC}"
  echo "  Client build is secure for distribution."
else
  echo -e "  ${RED}❌ $FAIL/$TOTAL CHECKS FAILED${NC} — Fix before release"
  exit 1
fi
echo "════════════════════════════════════════════════════"
echo ""
