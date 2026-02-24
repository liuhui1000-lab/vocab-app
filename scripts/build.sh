#!/bin/bash
set -Eeuo pipefail

# 检查是否在 OpenNext 构建流程中（避免无限循环）
if [ "${OPENNEXT_BUILD:-}" = "1" ]; then
  echo "Running Next.js build (called by OpenNext)..."
  cd "${COZE_WORKSPACE_PATH:-$(pwd)}"
  pnpm install --prefer-frozen-lockfile --prefer-offline
  exec next build
fi

# Cloudflare Pages 环境：执行完整 OpenNext 构建
echo "Building with OpenNext for Cloudflare Pages..."
cd "${COZE_WORKSPACE_PATH:-$(pwd)}"
export OPENNEXT_BUILD=1
npx opennextjs-cloudflare build
