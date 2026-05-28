#!/bin/bash
set -e

cd server-app && pnpm install --frozen-lockfile=false
cd ../client-app && pnpm install --frozen-lockfile=false
cd ../server-app && pnpm check-fk:static && pnpm exec drizzle-kit push --force && pnpm check-fk:db
