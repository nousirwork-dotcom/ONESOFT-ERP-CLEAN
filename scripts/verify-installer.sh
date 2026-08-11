#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# verify-installer.sh — تحقق أمني من win-unpacked بعد بناء Electron Installer
#
# الاستخدام:
#   bash scripts/verify-installer.sh [win-unpacked-dir]
#
# مثال:
#   bash scripts/verify-installer.sh installer/release/win-unpacked
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

UNPACKED="${1:-installer/release/win-unpacked}"
RESOURCES="$UNPACKED/resources"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

pass()    { echo -e "  ${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS+1)); }
fail()    { echo -e "  ${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL+1)); }
warn()    { echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"; }
section() { echo -e "\n${BLUE}▶ $1${NC}"; }

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  OneSoft — Installer Security Verification (win-unpacked)"
echo "════════════════════════════════════════════════════════════"
echo "  Directory: $UNPACKED"
echo ""

# ── 0. التحقق من وجود الدليل ─────────────────────────────────────────────────
if [[ ! -d "$UNPACKED" ]]; then
  echo -e "${RED}❌ ERROR${NC}: win-unpacked directory not found: $UNPACKED"
  echo "   Run electron-builder first, then re-run this script."
  exit 1
fi

# ── 1. بنية الـ Installer ──────────────────────────────────────────────────
section "1. Installer Structure"

if [[ -d "$RESOURCES" ]]; then
  pass "resources/ directory found"
else
  fail "resources/ directory missing — unexpected build structure"
fi

# license-center-app يجب ألا يكون داخل الـ installer
if [[ ! -d "$UNPACKED/license-center-app" ]] && [[ ! -d "$RESOURCES/license-center-app" ]]; then
  pass "license-center-app NOT inside installer"
else
  fail "license-center-app found inside installer — must be excluded"
fi

# تحقق من وجود app.asar أو app/ مفككة
if [[ -f "$RESOURCES/app.asar" ]]; then
  pass "app.asar present (bundled — good)"
  ASAR_MODE=true
elif [[ -d "$RESOURCES/app" ]]; then
  pass "app/ directory present (unpacked mode)"
  ASAR_MODE=false
else
  warn "Neither app.asar nor app/ directory found — inspect $RESOURCES manually"
  ASAR_MODE=false
fi

# ── 2. فحص ملفات الـ Resources مباشرة ───────────────────────────────────────
section "2. Resources Directory Scan"

# البحث عن Private Key في resources (ملفات مكشوفة)
PRIV_KEY=$(grep -rl "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY\|BEGIN RSA PRIVATE KEY" "$RESOURCES/" 2>/dev/null | wc -l)
if [[ "$PRIV_KEY" -eq 0 ]]; then
  pass "No private key file in resources/"
else
  fail "Private key material found in resources/ ($PRIV_KEY files) — CRITICAL SECURITY ISSUE"
  grep -rl "BEGIN PRIVATE KEY\|BEGIN EC PRIVATE KEY" "$RESOURCES/" 2>/dev/null || true
fi

# البحث عن .pem أو .key ملفات في resources
PEM_FILES=$(find "$RESOURCES/" -name "*.pem" -o -name "*.key" -o -name "private*" 2>/dev/null | wc -l)
if [[ "$PEM_FILES" -eq 0 ]]; then
  pass "No .pem/.key private files in resources/"
else
  fail "Suspicious private key files in resources/ ($PEM_FILES files)"
  find "$RESOURCES/" -name "*.pem" -o -name "*.key" -o -name "private*" 2>/dev/null || true
fi

# ── 3. فحص app/ إذا كان اللبناء غير مضغوط ──────────────────────────────────
section "3. App Bundle Content Check"

if [[ "$ASAR_MODE" == "false" ]] && [[ -d "$RESOURCES/app" ]]; then
  APP_DIR="$RESOURCES/app"

  LC_REFS=$(grep -rl "licenseCenterRouter\|licenseCenter\.seedDemo\|licenseCenter\.createClient" "$APP_DIR/" 2>/dev/null | wc -l)
  if [[ "$LC_REFS" -eq 0 ]]; then
    pass "No licenseCenter router in unpacked app bundle"
  else
    fail "licenseCenter references in app bundle ($LC_REFS files)"
  fi

  PRIV_SRC=$(grep -rl "BEGIN PRIVATE KEY\|privateKeyPem" "$APP_DIR/" 2>/dev/null | wc -l)
  if [[ "$PRIV_SRC" -eq 0 ]]; then
    pass "No private key in app bundle"
  else
    fail "Private key found in app bundle ($PRIV_SRC files) — CRITICAL"
  fi

  LC_ROUTE=$(grep -rl '"/license-center"' "$APP_DIR/" 2>/dev/null | wc -l)
  if [[ "$LC_ROUTE" -eq 0 ]]; then
    pass "/license-center route NOT in app bundle"
  else
    fail "/license-center route found in app bundle ($LC_ROUTE files)"
  fi

  LICENSE_ISSUE=$(grep -rl "issueNewLicense\|generateLicense\|renewLicense\|signLicense\|createLicense" "$APP_DIR/" 2>/dev/null | wc -l)
  if [[ "$LICENSE_ISSUE" -eq 0 ]]; then
    pass "No license issuance APIs in app bundle"
  else
    fail "License issuance API found in app bundle ($LICENSE_ISSUE files) — must only exist in owner env"
  fi

elif [[ "$ASAR_MODE" == "true" ]]; then
  # إذا كان asar — نحاول استخدام asar CLI إذا كان متاحاً
  if command -v asar &>/dev/null; then
    TMP_EXTRACT=$(mktemp -d)
    asar extract "$RESOURCES/app.asar" "$TMP_EXTRACT" 2>/dev/null || true

    LC_REFS=$(grep -rl "licenseCenterRouter" "$TMP_EXTRACT/" 2>/dev/null | wc -l)
    PRIV_SRC=$(grep -rl "BEGIN PRIVATE KEY" "$TMP_EXTRACT/" 2>/dev/null | wc -l)
    LC_ROUTE=$(grep -rl '"/license-center"' "$TMP_EXTRACT/" 2>/dev/null | wc -l)
    LICENSE_ISSUE=$(grep -rl "issueNewLicense\|signLicense\|generateLicense" "$TMP_EXTRACT/" 2>/dev/null | wc -l)

    [[ "$LC_REFS"      -eq 0 ]] && pass "No licenseCenter router in asar"  || fail "licenseCenter refs in asar ($LC_REFS)"
    [[ "$PRIV_SRC"     -eq 0 ]] && pass "No private key in asar"           || fail "Private key in asar — CRITICAL"
    [[ "$LC_ROUTE"     -eq 0 ]] && pass "/license-center NOT in asar"      || fail "/license-center found in asar"
    [[ "$LICENSE_ISSUE" -eq 0 ]] && pass "No license issuance APIs in asar" || fail "License issuance in asar ($LICENSE_ISSUE files)"

    rm -rf "$TMP_EXTRACT"
  else
    warn "asar CLI not installed — cannot inspect app.asar contents"
    warn "Install with: npm install -g @electron/asar"
    warn "Then re-run: asar extract $RESOURCES/app.asar /tmp/app-extract && grep -r 'licenseCenter' /tmp/app-extract/"
  fi
else
  warn "Skipping bundle content check — no app/ directory or asar found"
fi

# ── 4. فحص خاص بـ License API (ممنوع في client build) ──────────────────────
section "4. License Issuance API — Client Must Not Have It"

# تحقق مباشر في resources الظاهرة
ISSUE_API=$(grep -rl "issueNewLicense\|generateLicense\|renewLicense\|signLicense" "$RESOURCES/" 2>/dev/null | wc -l)
if [[ "$ISSUE_API" -eq 0 ]]; then
  pass "No license issuance API in resources/"
else
  fail "License issuance API in resources/ ($ISSUE_API files) — MUST NOT ship to client"
fi

# ── 5. ملخص النهائي ──────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ ALL $TOTAL INSTALLER CHECKS PASSED${NC}"
  echo "  Installer is secure for client distribution."
else
  echo -e "  ${RED}❌ $FAIL/$TOTAL INSTALLER CHECKS FAILED${NC} — Do NOT distribute this build"
  exit 1
fi
echo "════════════════════════════════════════════════════════════"
echo ""
