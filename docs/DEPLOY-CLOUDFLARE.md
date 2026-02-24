# Cloudflare Pages + D1 部署指南

本项目已从 Supabase 迁移至 Cloudflare D1 数据库，部署流程如下。

## 一、前置准备

### 1. 安装 Wrangler CLI
```bash
pnpm add -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```

## 二、创建 D1 数据库

### 1. 创建数据库
```bash
# 创建生产环境数据库
wrangler d1 create vocab-app-db

# 创建预览环境数据库（可选）
wrangler d1 create vocab-app-db-preview
```

执行后会返回数据库 ID，例如：
```
✅ Successfully created DB 'vocab-app-db'
[[d1_databases]]
binding = "DB"
database_name = "vocab-app-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml
将返回的 `database_id` 填入 `wrangler.toml` 文件：

```toml
name = "vocab-app"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "vocab-app-db"
database_id = "你的数据库ID"

# 预览环境（可选）
[[d1_databases.preview]]
binding = "DB"
database_name = "vocab-app-db-preview"
database_id = "你的预览数据库ID"
```

## 三、初始化数据库

### 1. 执行初始化脚本
```bash
# 本地执行
wrangler d1 execute vocab-app-db --local --file=./d1/schema.sql

# 远程执行（生产环境）
wrangler d1 execute vocab-app-db --remote --file=./d1/schema.sql
```

### 2. 验证表创建成功
```bash
# 本地验证
wrangler d1 execute vocab-app-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# 远程验证
wrangler d1 execute vocab-app-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## 四、部署到 Cloudflare Pages

### 方式一：通过 Git 集成（推荐）

1. **推送代码到 GitHub/GitLab**

2. **在 Cloudflare Dashboard 创建 Pages 项目**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 Pages → 创建项目 → 连接 Git
   - 选择你的仓库

3. **配置构建设置**
   - 构建命令：`pnpm run build`
   - 构建输出目录：`.next`
   - 根目录：`/`

4. **绑定 D1 数据库**
   - 进入项目设置 → Functions → D1 database bindings
   - 添加绑定：
     - Variable name: `DB`
     - D1 database: 选择之前创建的 `vocab-app-db`

5. **配置环境变量**（如需要）
   - 进入项目设置 → Environment variables
   - 添加必要的环境变量

### 方式二：通过 CLI 部署

1. **构建项目**
```bash
pnpm run build
```

2. **部署**
```bash
wrangler pages deploy .next --project-name=vocab-app
```

## 五、本地开发

### 1. 使用本地 D1 数据库
```bash
# 启动开发服务器（带本地 D1）
wrangler pages dev .next --compatibility-flag=nodejs_compat --d1=DB=vocab-app-db --local
```

### 2. 或者使用 Next.js 开发服务器（需要适配层）
```bash
# 先构建一次
pnpm run build

# 使用 wrangler 启动
wrangler pages dev .next --compatibility-flag=nodejs_compat --d1=DB=vocab-app-db --local --port=5000
```

### 3. 简化开发流程
创建开发脚本 `dev.sh`:
```bash
#!/bin/bash
# 启动 Cloudflare Pages 本地开发环境
wrangler pages dev .next \
  --compatibility-flag=nodejs_compat \
  --d1=DB=vocab-app-db \
  --local \
  --port=5000 \
  --live-reload
```

## 六、数据迁移

### 1. 从 Supabase 导出数据
在 Supabase SQL Editor 中执行：
```sql
-- 导出用户
SELECT * FROM users;

-- 导出学期
SELECT * FROM semesters;

-- 导出单词
SELECT * FROM vocab_words;

-- 导出进度
SELECT * FROM user_progress;
```

### 2. 转换数据格式
将导出的 CSV 转换为 SQLite 兼容的 INSERT 语句，或直接导入：
```bash
# 使用 sqlite3 导入
sqlite3 local.db < data/import.sql
```

### 3. 推送到 D1
```bash
# 先导出为 SQL
sqlite3 local.db .dump > d1/migration.sql

# 执行到 D1
wrangler d1 execute vocab-app-db --remote --file=./d1/migration.sql
```

## 七、API 迁移指南

### 主要变化

1. **运行时声明**
   所有 API 路由需要添加：
   ```typescript
   export const runtime = 'edge';
   ```

2. **获取数据库连接**
   ```typescript
   // 旧方式 (Supabase)
   const client = getSupabaseClient();
   const { data, error } = await client.from('table').select('*');
   
   // 新方式 (D1)
   import { getDB, getSemesters } from '@/lib/db-helpers';
   export const runtime = 'edge';
   
   export async function GET(request: Request) {
     const db = getDB(request);
     const data = await getSemesters(db);
     // ...
   }
   ```

3. **SQL 查询**
   D1 使用原生 SQL 而非 ORM：
   ```typescript
   // 查询
   const result = await db
     .prepare('SELECT * FROM users WHERE username = ?')
     .bind(username)
     .all();
   
   // 单行查询
   const user = await db
     .prepare('SELECT * FROM users WHERE id = ?')
     .bind(id)
     .first();
   
   // 插入/更新
   await db
     .prepare('INSERT INTO users (username) VALUES (?)')
     .bind(username)
     .run();
   ```

### 需要修改的文件

| 文件 | 主要修改 |
|------|---------|
| `src/app/api/semesters/route.ts` | 使用 `getDB` + `getSemesters` |
| `src/app/api/vocab/[id]/route.ts` | 使用 `getDB` + `getVocabWords` |
| `src/app/api/auth/route.ts` | 使用 `getDB` + `getOrCreateUser` |
| `src/app/api/progress/route.ts` | 使用 `getDB` + `getUserProgress` |
| `src/app/api/learn/route.ts` | 使用 `getDB` + `upsertUserProgress` |
| `src/app/api/stats/route.ts` | 使用 `getDB` + 聚合查询 |
| `src/app/api/admin/users/route.ts` | 使用 `getDB` + `getAllUsers` |
| `src/app/api/admin/password/route.ts` | 使用 `getDB` + `updateUserPassword` |
| `src/app/api/admin/import/route.ts` | 使用 `getDB` + `insertVocabWord` |

### 示例：修改 auth 路由

```typescript
// src/app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { getDB, getOrCreateUser } from '@/lib/db-helpers';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    
    const db = getDB(request);
    const user = await getOrCreateUser(db, username, password);
    
    if (!user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      user: {
        ...user,
        is_admin: user.is_admin === 1
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 八、常见问题

### Q: 本地开发时出现 "D1 database not available" 错误
A: 这是正常的，因为本地 Next.js 开发服务器无法直接访问 D1。解决方案：
1. 使用 `wrangler pages dev` 启动（推荐）
2. 或在 API 路由中添加本地后备数据

### Q: 部署后 API 返回 500 错误
A: 检查以下几点：
1. D1 数据库绑定是否正确（变量名必须为 `DB`）
2. 数据库表是否已创建
3. 查看 Cloudflare Pages 的日志（在 Dashboard → Pages → 项目 → Logs）

### Q: 如何查看生产环境数据
A: 使用 wrangler 命令：
```bash
# 查看所有用户
wrangler d1 execute vocab-app-db --remote --command="SELECT * FROM users;"

# 查看进度统计
wrangler d1 execute vocab-app-db --remote --command="SELECT COUNT(*) FROM user_progress;"
```

### Q: 如何备份数据库
A: 导出为 SQL：
```bash
wrangler d1 export vocab-app-db --remote --output=backup.sql
```

## 九、费用说明

Cloudflare D1 免费额度：
- 存储：5GB
- 读取行数：500万/月
- 写入行数：10万/月

这对于中小型单词应用完全足够，且相比 Supabase 的 500MB 存储限制更加宽裕。

## 十、环境变量配置（可选）

如果需要添加额外的环境变量：

```bash
# 本地开发
echo "MY_VAR=value" > .dev.vars

# 生产环境
wrangler pages secret put MY_VAR --project-name=vocab-app
```

在代码中使用：
```typescript
const myVar = request.env?.MY_VAR;
```
