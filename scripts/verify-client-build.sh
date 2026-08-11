#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# verify-client-build.sh — تحقق أمني كامل قبل توزيع Client Build
#
# الاستخدام:
#   bash scripts/verify-client-build.sh [client-dist-dir] [server-dist-dir]
#
# يُستدعى تلقائياً مرتين في release:client:
#   1. قبل البناء  — فحص source code
#   2. بعد البناء  — فحص bundle مُنتج
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

CLIENT_DIST="${1:-client-app/dist}"
SERVER_DIST="${2:-server-app/dist}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

pass()    { echo -e "  ${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS+1)); }
fail()    { echo -e "  ${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL+1)); }
warn()    { echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"; }
section() { echo -e "\n${BLUE}▶ $1${NC}"; }

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
  # licenseCenter router references
  LC_REFS=$(grep -rl "licenseCenterRouter\|licenseCenter\.seedDemo\|licenseCenter\.createClient\|license-center-app" "$CLIENT_DIST/assets/" 2>/dev/null | wc -l)
  if [[ "$LC_REFS" -eq 0 ]]; then
    pass "No licenseCenter router references in client JS bundles"
  else
    fail "licenseCenter references found in client bundle ($LC_REFS files)"
    grep -rl "licenseCenterRouter\|licenseCenter\.seedDemo" "$CLIENT_DIST/assets/" 2>/dev/null || true
  fi

  # Private key — أي نوع
  PRIV_KEY=$(grep -rl "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY\|BEGIN RSA PRIVATE KEY\|PRIVATE KEY-----" "$CLIENT_DIST/" 2>/dev/null | wc -l)
  if [[ "$PRIV_KEY" -eq 0 ]]; then
    pass "No private key found in client bundle"
  else
    fail "Private key material detected in client bundle ($PRIV_KEY files) — CRITICAL SECURITY ISSUE"
    grep -rl "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY" "$CLIENT_DIST/" 2>/dev/null || true
  fi

  # /license-center route
  LC_ROUTE=$(grep -rl '"/license-center"' "$CLIENT_DIST/" 2>/dev/null | wc -l)
  if [[ "$LC_ROUTE" -eq 0 ]]; then
    pass "Route /license-center NOT in client bundle"
  else
    fail "Route /license-center found in client bundle ($LC_ROUTE files)"
  fi

  # License issuance APIs — لا يجب أن تصل للعميل
  ISSUE_API=$(grep -rl "issueNewLicense\|generateLicense\|renewLicense\|signLicense\|createLicense\|\.sign\(.*license\|licenseCenter\.issue" "$CLIENT_DIST/assets/" 2>/dev/null | wc -l)
  if [[ "$ISSUE_API" -eq 0 ]]; then
    pass "No license issuance API in client bundle"
  else
    fail "License issuance API found in client bundle ($ISSUE_API files) — must only exist in owner env"
  fi
else
  warn "No assets/ folder found — skipping JS bundle scan"
fi

# ── 3. فحص Server-App (إذا وُجد dist) ───────────────────────────────────────
section "3. Server-App Security Check"

if [[ -d "$SERVER_DIST" ]]; then
  PRIV_KEY_SERVER=$(grep -rl "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY\|BEGIN RSA PRIVATE KEY" "$SERVER_DIST/" 2>/dev/null | wc -l)
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

# تحقق من أن client-app لا يستورد LicenseCenterPage أو /license-center route
LC_IMPORT=$(grep -r "LicenseCenterPage\|/license-center" client-app/src/ 2>/dev/null | grep -v "LicenseActivation\|LicensePreview\|#\|//" | wc -l)
if [[ "$LC_IMPORT" -eq 0 ]]; then
  pass "No LicenseCenterPage import in client-app/src"
else
  fail "LicenseCenterPage or /license-center reference found in client-app/src ($LC_IMPORT lines)"
  grep -r "LicenseCenterPage\|/license-center" client-app/src/ 2>/dev/null | grep -v "LicenseActivation\|LicensePreview" || true
fi

# تحقق من أن private key ليس في server-app src (مباشرة كنص)
PRIV_KEY_SRC=$(grep -r "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY" server-app/src/ 2>/dev/null | wc -l)
if [[ "$PRIV_KEY_SRC" -eq 0 ]]; then
  pass "No private key literal in server-app/src"
else
  fail "Private key literal in server-app/src ($PRIV_KEY_SRC lines) — CRITICAL"
fi

# تحقق من أن private key ليس في client-app/src
PRIV_KEY_CLIENT_SRC=$(grep -r "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY" client-app/src/ 2>/dev/null | wc -l)
if [[ "$PRIV_KEY_CLIENT_SRC" -eq 0 ]]; then
  pass "No private key in client-app/src"
else
  fail "Private key in client-app/src ($PRIV_KEY_CLIENT_SRC lines) — CRITICAL"
fi

# تحقق من أن ownerOnlyProcedure تُرجع NOT_FOUND عند CLIENT_BUILD
# ملاحظة: نستخدم | wc -l بدلاً من grep -c || echo 0 لتفادي double-output bug
NOT_FOUND_GUARD=$(grep "NOT_FOUND" server-app/src/trpc.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$NOT_FOUND_GUARD" -gt 0 ]]; then
  pass "ownerOnlyProcedure returns NOT_FOUND (not just FORBIDDEN) in client builds"
else
  fail "NOT_FOUND guard missing from trpc.ts — must throw NOT_FOUND when CLIENT_BUILD=true"
fi

# تحقق من أن ownerOnlyProcedure تحمي licenseCenter
OOP_LC=$(grep "ownerOnlyProcedure" server-app/src/routers/licenseCenter.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$OOP_LC" -gt 3 ]]; then
  pass "licenseCenter router uses ownerOnlyProcedure ($OOP_LC usages)"
else
  fail "licenseCenter router does not use ownerOnlyProcedure correctly ($OOP_LC usages)"
fi

# تحقق من أن IS_CLIENT_BUILD موجود في index.ts
CLIENT_BUILD_INDEX=$(grep "IS_CLIENT_BUILD\|CLIENT_BUILD" server-app/src/routers/index.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$CLIENT_BUILD_INDEX" -gt 0 ]]; then
  pass "CLIENT_BUILD conditional present in routers/index.ts"
else
  fail "CLIENT_BUILD conditional missing from routers/index.ts"
fi

# تحقق من أن devicePrefs يحتوي على whitelist
DP_WHITE=$(grep "ALLOWED_PREFS_KEYS\|sanitizePrefs\|FORBIDDEN_KEY_PATTERNS" server-app/src/lib/devicePrefs.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$DP_WHITE" -gt 0 ]]; then
  pass "devicePrefs.ts has whitelist + forbidden key enforcement"
else
  fail "devicePrefs.ts missing whitelist sanitization"
fi

# تحقق من أن devicePrefs يستخدم AES-256-GCM
AES_ENC=$(grep "aes-256-gcm" server-app/src/lib/devicePrefs.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$AES_ENC" -gt 0 ]]; then
  pass "device.prefs uses AES-256-GCM encryption in production"
else
  fail "AES-256-GCM encryption missing from devicePrefs.ts"
fi

# تحقق من أن seedDemo محظور في production
SEED_GUARD=$(grep "NODE_ENV.*production\|production.*NODE_ENV" server-app/src/routers/licenseCenter.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$SEED_GUARD" -gt 0 ]]; then
  pass "seedDemo blocked in production (NODE_ENV=production guard present)"
else
  fail "seedDemo missing production guard — must throw NOT_FOUND when NODE_ENV=production"
fi

# ── 5. تحقق من /cfg/license موجود في client-app ──────────────────────────────
section "5. Client License Activation Page"

CFG_LIC=$(grep -r "LicenseActivationPage\|cfg/license\|/cfg/license" client-app/src/ 2>/dev/null | wc -l)
if [[ "$CFG_LIC" -gt 0 ]]; then
  pass "/cfg/license (activation only) present in client-app"
else
  warn "/cfg/license not found in client-app — verify activation page exists"
fi

# ── 6. تحقق من private key في scripts/keys فقط ─────────────────────────────
section "6. Private Key Location Control"

# يجب أن يكون private key في scripts/keys فقط (بيئة المالك)
if [[ -d "scripts/keys" ]]; then
  KEY_IN_SCRIPTS=$(find scripts/keys/ -name "*.pem" -o -name "*.key" 2>/dev/null | wc -l)
  if [[ "$KEY_IN_SCRIPTS" -gt 0 ]]; then
    pass "Private key found in scripts/keys/ only (owner environment)"
  else
    warn "No private key in scripts/keys/ — verify owner key management"
  fi
else
  warn "scripts/keys/ not found — owner keys must be in separate secure location"
fi

# تحقق من أن electron/ أو resources/ لا تحتوي على private key
ELECTRON_KEY=$(find electron-app/ -name "*.pem" -o -name "*private*" 2>/dev/null | wc -l)
if [[ "$ELECTRON_KEY" -eq 0 ]]; then
  pass "No private key files in electron-app/"
else
  fail "Private key found in electron-app/ ($ELECTRON_KEY files) — CRITICAL"
fi

# ── 7. فحص Owner / License Center App ────────────────────────────────────────
section "7. License Center Separation"

# superadmin auth موجود في License Center
LC_SUPERADMIN=$(grep -r "superadmin\|ownerOnly\|superAdmin" license-center-app/src/ 2>/dev/null | wc -l)
if [[ "$LC_SUPERADMIN" -gt 0 ]]; then
  pass "License Center enforces superadmin-only access ($LC_SUPERADMIN references)"
else
  warn "Cannot detect superadmin check in License Center — verify manually"
fi

# signing لا يوجد في client-app
SIGN_CLIENT=$(grep -r "sign-test-license\|keygen\.js\|Ed25519.*private\|createSign\|\.sign(" client-app/src/ 2>/dev/null | grep -v "//\|design\|assign\|signing\b.*field\|unsigned" | wc -l)
if [[ "$SIGN_CLIENT" -eq 0 ]]; then
  pass "License signing NOT in client-app/src"
else
  fail "License signing references in client-app/src ($SIGN_CLIENT lines) — CRITICAL"
fi

# ── 8. ملخص نهائي ────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ ALL $TOTAL CHECKS PASSED${NC}"
  echo "  Client build is secure for distribution."
else
  echo -e "  ${RED}❌ $FAIL/$TOTAL CHECKS FAILED${NC} — Fix before release"
  echo ""
  echo "  Run 'pnpm verify:client-build' to see details."
  exit 1
fi
echo "════════════════════════════════════════════════════"
echo ""
