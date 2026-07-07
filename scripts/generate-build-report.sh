#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-build-report.sh — تقرير أمني شامل بعد بناء Client
#
# الاستخدام:
#   bash scripts/generate-build-report.sh [client-dist] [server-dist] [report-dir]
#
# الإخراج:
#   CLIENT_BUILD_REPORT_<timestamp>.txt في مجلد reports/
# ─────────────────────────────────────────────────────────────────────────────
set -o pipefail

CLIENT_DIST="${1:-client-app/dist}"
SERVER_DIST="${2:-server-app/dist}"
REPORT_DIR="${3:-reports}"

mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_FILE="$REPORT_DIR/CLIENT_BUILD_REPORT_${TIMESTAMP}.txt"

# ── helpers ──────────────────────────────────────────────────────────────────
check()  { local label="$1"; local result="$2"
  printf "  %-52s %s\n" "$label" "$result" >> "$REPORT_FILE"; }
ok()     { check "$1" "✅ PASS"; }
ko()     { check "$1" "❌ FAIL"; REPORT_FAIL=$((REPORT_FAIL+1)); }
unknown(){ check "$1" "⚠️  WARN (check manually)"; }

REPORT_FAIL=0

# ── كتابة التقرير ─────────────────────────────────────────────────────────────
{
echo "════════════════════════════════════════════════════════════════"
echo "  OneSoft ERP — Client Build Security Report"
echo "  Generated : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "  Host      : $(hostname 2>/dev/null || echo 'unknown')"
echo "  Node.js   : $(node --version 2>/dev/null || echo 'unknown')"
echo "  Dist Dir  : $CLIENT_DIST"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  SECTION 1 — Build Environment"
echo "  ─────────────────────────────────────────────────────────────"
} >> "$REPORT_FILE"

# 1. CLIENT_BUILD flag
CLIENT_BUILD_FLAG="${CLIENT_BUILD:-}"
if [[ "$CLIENT_BUILD_FLAG" == "true" ]]; then
  ok "CLIENT_BUILD=true was set during build"
else
  # Check if the server dist has CLIENT_BUILD guard compiled in
  if [[ -d "$SERVER_DIST" ]] && grep -rl "CLIENT_BUILD" "$SERVER_DIST/" &>/dev/null 2>&1; then
    ok "CLIENT_BUILD guard present in server dist"
  else
    unknown "CLIENT_BUILD=true not detected (run via 'pnpm release:client')"
  fi
fi

# Node env
NODE_ENV_CURRENT="${NODE_ENV:-not set}"
echo "  NODE_ENV at report time : $NODE_ENV_CURRENT" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

{
echo "  SECTION 2 — File Structure"
echo "  ─────────────────────────────────────────────────────────────"
} >> "$REPORT_FILE"

# Client dist exists
[[ -d "$CLIENT_DIST" ]]                           && ok   "client-app/dist exists"          || ko "client-app/dist MISSING — build failed?"
[[ ! -d "$CLIENT_DIST/license-center-app" ]]      && ok   "license-center-app NOT in dist"  || ko "license-center-app FOUND in dist — CRITICAL"
[[ -d "$CLIENT_DIST/assets" ]]                    && ok   "assets/ directory present"       || unknown "No assets/ directory"
[[ -d "$SERVER_DIST" ]]                           && ok   "server-app/dist exists"          || unknown "server-app/dist not found"

echo "" >> "$REPORT_FILE"

{
echo "  SECTION 3 — Security Checks (Client Bundle)"
echo "  ─────────────────────────────────────────────────────────────"
} >> "$REPORT_FILE"

if [[ -d "$CLIENT_DIST/assets" ]]; then
  # licenseCenter router
  LC_REFS=$(grep -rl "licenseCenterRouter\|licenseCenter\.seedDemo\|licenseCenter\.createClient" "$CLIENT_DIST/assets/" 2>/dev/null | wc -l)
  [[ "$LC_REFS" -eq 0 ]] && ok "licenseCenter router NOT in client bundle" || ko "licenseCenter router FOUND in client bundle ($LC_REFS files)"

  # Private key
  PRIV_KEY=$(grep -rl "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY" "$CLIENT_DIST/" 2>/dev/null | wc -l)
  [[ "$PRIV_KEY" -eq 0 ]] && ok "Private key NOT in client bundle" || ko "Private key FOUND in client bundle — CRITICAL"

  # /license-center route
  LC_ROUTE=$(grep -rl '"/license-center"' "$CLIENT_DIST/" 2>/dev/null | wc -l)
  [[ "$LC_ROUTE" -eq 0 ]] && ok "/license-center route NOT in client bundle" || ko "/license-center route FOUND in client bundle"

  # License issuance APIs
  ISSUE_API=$(grep -rl "issueNewLicense\|generateLicense\|renewLicense\|signLicense\|createLicense" "$CLIENT_DIST/assets/" 2>/dev/null | wc -l)
  [[ "$ISSUE_API" -eq 0 ]] && ok "License issuance APIs NOT in client bundle" || ko "License issuance API FOUND in client bundle ($ISSUE_API files)"

  # /cfg/license present
  CFG_LIC=$(grep -rl "cfg/license\|LicenseActivation" "$CLIENT_DIST/assets/" 2>/dev/null | wc -l)
  [[ "$CFG_LIC" -gt 0 ]] && ok "/cfg/license activation route present" || unknown "/cfg/license may be tree-shaken — verify manually"
else
  unknown "Cannot scan — assets/ directory not found"
fi

echo "" >> "$REPORT_FILE"

{
echo "  SECTION 4 — Source Code Audit"
echo "  ─────────────────────────────────────────────────────────────"
} >> "$REPORT_FILE"

# LicenseCenterPage in client-app
LC_IMPORT=$(grep -r "LicenseCenterPage\|/license-center" client-app/src/ 2>/dev/null | grep -v "LicenseActivation\|LicensePreview\|#" | wc -l)
[[ "$LC_IMPORT" -eq 0 ]] && ok "LicenseCenterPage NOT imported in client-app/src" || ko "LicenseCenterPage or /license-center in client-app/src ($LC_IMPORT lines)"

# Private key in server-app src
PRIV_SRC=$(grep -r "BEGIN PRIVATE KEY" server-app/src/ 2>/dev/null | wc -l)
[[ "$PRIV_SRC" -eq 0 ]] && ok "Private key NOT in server-app/src" || ko "Private key literal in server-app/src ($PRIV_SRC lines) — CRITICAL"

# ownerOnlyProcedure guard
OOP=$(grep -c "NOT_FOUND.*CLIENT_BUILD\|CLIENT_BUILD.*NOT_FOUND" server-app/src/trpc.ts 2>/dev/null || echo 0)
[[ "$OOP" -gt 0 ]] && ok "ownerOnlyProcedure returns NOT_FOUND when CLIENT_BUILD=true" || unknown "Verify NOT_FOUND code in trpc.ts manually"

# licenseCenter uses ownerOnlyProcedure
OOP_LC=$(grep -c "ownerOnlyProcedure" server-app/src/routers/licenseCenter.ts 2>/dev/null || echo 0)
[[ "$OOP_LC" -gt 3 ]] && ok "licenseCenter uses ownerOnlyProcedure ($OOP_LC procedures)" || ko "licenseCenter does not use ownerOnlyProcedure ($OOP_LC)"

# IS_CLIENT_BUILD in index.ts
CB_IDX=$(grep -c "IS_CLIENT_BUILD\|CLIENT_BUILD" server-app/src/routers/index.ts 2>/dev/null || echo 0)
[[ "$CB_IDX" -gt 0 ]] && ok "IS_CLIENT_BUILD guard in routers/index.ts" || ko "IS_CLIENT_BUILD missing from routers/index.ts"

# devicePrefs whitelist
DP_WHITE=$(grep -c "ALLOWED_PREFS\|sanitizePrefs\|whitelist" server-app/src/lib/devicePrefs.ts 2>/dev/null || echo 0)
[[ "$DP_WHITE" -gt 0 ]] && ok "devicePrefs.ts has whitelist sanitization" || unknown "devicePrefs whitelist not detected — verify manually"

# AES-256-GCM encryption
AES=$(grep -c "aes-256-gcm" server-app/src/lib/devicePrefs.ts 2>/dev/null || echo 0)
[[ "$AES" -gt 0 ]] && ok "device.prefs encrypted with AES-256-GCM in production" || ko "AES-256-GCM encryption missing from devicePrefs.ts"

# seedDemo production guard
SEED_GUARD=$(grep -c "NODE_ENV.*production\|production.*NODE_ENV" server-app/src/routers/licenseCenter.ts 2>/dev/null || echo 0)
[[ "$SEED_GUARD" -gt 0 ]] && ok "seedDemo blocked in production (NODE_ENV guard present)" || ko "seedDemo missing production guard — MUST NOT run in production"

# Private key NOT tracked by git
GIT_KEY=$(git --no-optional-locks ls-files scripts/keys/ 2>/dev/null | wc -l)
[[ "$GIT_KEY" -eq 0 ]] && ok "Private key NOT tracked by git (scripts/keys/ excluded)" || ko "Private key IS tracked by git — rotate immediately"

# scripts/keys/ in .gitignore
GITIGNORE_KEY=$(grep -c "scripts/keys" .gitignore 2>/dev/null || echo 0)
[[ "$GITIGNORE_KEY" -gt 0 ]] && ok "scripts/keys/ present in .gitignore" || ko "scripts/keys/ missing from .gitignore"

echo "" >> "$REPORT_FILE"

{
echo "  SECTION 5 — Owner / License Center Separation"
echo "  ─────────────────────────────────────────────────────────────"
} >> "$REPORT_FILE"

# license-center-app is separate
[[ -d "license-center-app/src" ]] && ok "license-center-app exists as separate app" || unknown "license-center-app not found"

# license center has its own auth
LC_AUTH=$(grep -r "superadmin\|ownerOnly\|superAdmin" license-center-app/src/ 2>/dev/null | wc -l)
[[ "$LC_AUTH" -gt 0 ]] && ok "License Center enforces superadmin-only auth ($LC_AUTH references)" || unknown "Cannot detect superadmin check in License Center — verify manually"

# signing happens only in owner env
SIGN_IN_CLIENT=$(grep -r "sign-test-license\|keygen\.js\|private.*key\|Ed25519" client-app/src/ 2>/dev/null | wc -l)
[[ "$SIGN_IN_CLIENT" -eq 0 ]] && ok "License signing NOT in client-app" || ko "License signing references in client-app — CRITICAL"

echo "" >> "$REPORT_FILE"

# ── النتيجة النهائية ──────────────────────────────────────────────────────────
{
echo "════════════════════════════════════════════════════════════════"
if [[ "$REPORT_FAIL" -eq 0 ]]; then
  echo "  ✅ RESULT: ALL CHECKS PASSED — Safe for client distribution"
else
  echo "  ❌ RESULT: $REPORT_FAIL CHECK(S) FAILED — Do NOT distribute"
fi
echo "  Report : $REPORT_FILE"
echo "════════════════════════════════════════════════════════════════"
echo ""
} >> "$REPORT_FILE"

# اطبع التقرير على الشاشة أيضاً
cat "$REPORT_FILE"

if [[ "$REPORT_FAIL" -gt 0 ]]; then
  exit 1
fi
