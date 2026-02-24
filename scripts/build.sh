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

# 重命名 worker.js 为 _worker.js（Cloudflare Pages 入口文件名要求）
# 同时删除原始文件避免重复
if [ -f ".open-next/worker.js" ]; then
  mv .open-next/worker.js .open-next/_worker.js
  echo "Renamed worker.js to _worker.js for Cloudflare Pages"
fi
# 确保没有重复的 _worker.js
rm -f .open-next/worker.js 2>/dev/null || true

# 重要：确保静态资源在根目录的 _next 文件夹中
# Cloudflare Pages 需要静态文件直接在输出目录中
echo "Setting up static assets for Cloudflare Pages..."
if [ -d ".open-next/assets/_next" ] && [ ! -d ".open-next/_next" ]; then
  cp -r .open-next/assets/_next .open-next/
  echo "Copied assets/_next to root _next"
fi

# 复制其他静态文件到根目录
if [ -d ".open-next/assets" ]; then
  for item in .open-next/assets/*; do
    name=$(basename "$item")
    if [ "$name" != "_next" ]; then
      cp -r "$item" .open-next/ 2>/dev/null || true
    fi
  done
  echo "Copied other static assets to root"
fi

# 修复符号链接问题：Cloudflare Pages 无法访问指向输出目录外的链接
echo "Resolving symlinks for Cloudflare Pages compatibility..."
if [ -d ".open-next" ]; then
  # 记录当前目录
  PROJECT_ROOT=$(pwd)
  
  # 查找所有符号链接
  find .open-next -type l | while read -r link; do
    if [ -L "$link" ]; then
      # 获取链接的目标（相对路径）
      target=$(readlink "$link")
      link_dir=$(dirname "$link")
      
      # 解析为绝对路径
      abs_target=$(cd "$link_dir" && realpath -m "$target" 2>/dev/null || echo "")
      
      # 如果目标在 .open-next 目录内且存在，直接复制
      if [[ -n "$abs_target" && -e "$abs_target" ]]; then
        rm "$link"
        if [ -d "$abs_target" ]; then
          cp -r "$abs_target" "$link"
        else
          cp "$abs_target" "$link"
        fi
        echo "Resolved: $link"
      else
        # 目标在 .open-next 外，尝试从项目 node_modules 复制
        if [[ "$target" == .pnpm/* ]] || [[ "$target" == ../.pnpm/* ]]; then
          pkg_path="$PROJECT_ROOT/node_modules/$target"
          if [ -e "$pkg_path" ]; then
            rm "$link"
            if [ -d "$pkg_path" ]; then
              cp -r "$pkg_path" "$link"
            else
              cp "$pkg_path" "$link"
            fi
            echo "Resolved from project node_modules: $link"
          fi
        fi
      fi
    fi
  done
  
  # 统计剩余的符号链接
  remaining=$(find .open-next -type l | wc -l)
  echo "Symlinks resolved. Remaining: $remaining"
fi

# 列出最终输出目录结构
echo "=========================================="
echo "Final .open-next structure:"
ls -la .open-next/
echo ""
echo "Static chunks in root _next:"
ls -la .open-next/_next/static/chunks/ 2>/dev/null || echo "No chunks in root _next"
echo ""
echo "Static chunks in assets/_next:"
ls -la .open-next/assets/_next/static/chunks/ 2>/dev/null || echo "No chunks in assets/_next"
echo "=========================================="

echo "Build completed successfully!"

# 生成 _routes.json 文件，配置 Cloudflare Pages 的路由规则
# 这确保静态资源由 Cloudflare 的静态资源服务器处理，而不是 worker
echo "Generating _routes.json for Cloudflare Pages..."
cat > .open-next/_routes.json << 'EOF'
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_next/static/*",
    "/favicon.ico",
    "/*.svg",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.gif",
    "/*.webp",
    "/*.ico",
    "/*.woff",
    "/*.woff2",
    "/*.ttf",
    "/*.eot"
  ]
}
EOF
echo "Created _routes.json"
