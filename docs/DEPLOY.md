# 🚀 Cloudflare Pages + Supabase 部署指南

## 目录
1. [Supabase 设置](#1-supabase-设置)
2. [Cloudflare Pages 部署](#2-cloudflare-pages-部署)
3. [环境变量配置](#3-环境变量配置)
4. [常见问题](#4-常见问题)

---

## 1. Supabase 设置

### 1.1 创建项目

1. 访问 [Supabase Dashboard](https://app.supabase.com/)
2. 点击 **New Project** 创建新项目
3. 填写项目信息：
   - **Name**: vocab-app（或其他名称）
   - **Database Password**: 设置强密码并保存
   - **Region**: 选择离你最近的区域（如 Northeast Asia (Tokyo)）

### 1.2 执行 SQL 脚本

1. 进入项目后，点击左侧 **SQL Editor**
2. 点击 **New query**
3. 复制 `supabase/init.sql` 文件的全部内容，粘贴到编辑器
4. 点击 **Run** 执行脚本

### 1.3 获取 API 密钥

1. 点击左侧 **Settings** > **API**
2. 记录以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`（前端使用）
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`（后端使用，保密！）

### 1.4 数据库连接信息（可选，直接连接用）

在 **Settings** > **Database** 中可以看到：
- **Connection string** (URI): PostgreSQL 连接字符串

---

## 2. Cloudflare Pages 部署

### 方案 A: 使用 Cloudflare Pages（推荐）

#### 2.1 安装 Wrangler CLI

```bash
npm install -g wrangler
```

#### 2.2 登录 Cloudflare

```bash
wrangler login
```

#### 2.3 构建项目

项目需要配置为静态导出模式。创建以下配置：

**`next.config.mjs` 修改：**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // 静态导出
  images: {
    unoptimized: true,  // Cloudflare Pages 不支持 Next.js 图片优化
  },
  trailingSlash: true,  // 可选：URL 统一带 /
};

export default nextConfig;
```

#### 2.4 部署命令

```bash
# 构建
pnpm build

# 部署到 Cloudflare Pages
wrangler pages deploy out --project-name=vocab-app
```

### 方案 B: 使用 Cloudflare Workers + Node.js 运行时

如果你的应用需要服务端功能（如 API Routes），使用此方案：

#### 2.5 创建 `wrangler.toml`

```toml
name = "vocab-app"
main = ".worker-next/index.mjs"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[site]
bucket = ".worker-next/assets"

[vars]
ENVIRONMENT = "production"
```

#### 2.6 安装适配器

```bash
pnpm add -D @cloudflare/next-on-pages
```

#### 2.7 修改 `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Workers 适配
  experimental: {
    runtime: 'edge',
  },
};

export default nextConfig;
```

#### 2.8 构建 and 部署

```bash
# 构建 Cloudflare Workers 版本
npx @cloudflare/next-on-pages

# 部署
wrangler pages deploy
```

### 方案 C: 通过 GitHub 自动部署（最简单）

1. 将代码推送到 GitHub 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Workers & Pages** > **Create application** > **Pages**
4. 选择 **Connect to Git**
5. 授权 GitHub 并选择你的仓库
6. 配置构建设置：
   - **Framework preset**: Next.js
   - **Build command**: `pnpm build`
   - **Build output directory**: `out` 或 `.next`（根据配置）
7. 点击 **Save and Deploy**

---

## 3. 环境变量配置

### 3.1 在 Cloudflare Dashboard 设置

1. 进入你的 Pages 项目
2. 点击 **Settings** > **Environment variables**
3. 添加以下变量：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Production, Preview |
| `DATABASE_URL` | `postgresql://postgres:...` | Production, Preview |

### 3.2 本地开发配置

创建 `.env.local` 文件：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# 后端使用（保密）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# 数据库直连（可选）
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

---

## 4. 修改代码适配 Supabase

### 4.1 安装 Supabase 客户端

```bash
pnpm add @supabase/supabase-js
```

### 4.2 创建 Supabase 客户端

创建 `src/lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 前端客户端（使用 anon key）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 后端客户端（使用 service_role key，跳过 RLS）
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

---

## 5. 常见问题

### Q1: 部署后页面 404
**A**: 确保 `next.config.mjs` 中配置了 `output: 'export'`，且 `trailingSlash: true`

### Q2: API Routes 不工作
**A**: 静态导出模式不支持 API Routes。解决方案：
- 使用 Cloudflare Workers 方案
- 或将 API 迁移到 Supabase Edge Functions

### Q3: 图片不显示
**A**: 设置 `images: { unoptimized: true }`

### Q4: 数据库连接失败
**A**: 检查：
1. Supabase 项目是否暂停（免费版7天不活跃会暂停）
2. 环境变量是否正确设置
3. IP 是否被限制（Supabase 默认不限制）

### Q5: 如何更新管理员密码
**A**: 在 Supabase SQL Editor 执行：
```sql
UPDATE users SET password = '新密码' WHERE username = 'admin';
```

---

## 6. 部署检查清单

- [ ] Supabase 项目创建完成
- [ ] SQL 脚本执行成功
- [ ] 记录了 Project URL 和 API Keys
- [ ] Cloudflare 项目创建完成
- [ ] 环境变量配置完成
- [ ] 代码已推送到 GitHub（如使用自动部署）
- [ ] 构建成功
- [ ] 网站可访问
- [ ] 登录功能测试通过
- [ ] 管理员账户可登录

---

## 7. 推荐架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Next.js 应用                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │  首页     │  │  学习页   │  │  管理页   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   PostgreSQL   │  │     Auth       │  │   Storage    │  │
│  │   数据库       │  │   用户认证     │  │   文件存储   │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 安全建议

1. **不要**在客户端代码中使用 `service_role` key
2. 使用 Supabase RLS 保护数据
3. 定期更新管理员密码
4. 使用 HTTPS（Cloudflare 自动提供）
5. 考虑启用 Cloudflare WAF

---

## 需要帮助？

- [Supabase 文档](https://supabase.com/docs)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
