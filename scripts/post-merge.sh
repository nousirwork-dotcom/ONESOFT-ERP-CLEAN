#!/bin/bash
set -e

cd server-app && pnpm install --frozen-lockfile=false
cd ../client-app && pnpm install --frozen-lockfile=false
