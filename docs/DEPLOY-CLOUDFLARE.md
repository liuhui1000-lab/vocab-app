# Cloudflare Pages + D1 部署指南

本项目使用 Cloudflare Pages + D1 数据库架构，提供 5GB 存储和每月 500 万次读取的免费额度。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **构建适配器**: OpenNext for Cloudflare
- **数据库**: Cloudflare D1 (SQLite)
- **部署平台**: Cloudflare Pages

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
wrangler d1 create vocab-app-db
```

执行后会返回数据库 ID，记下这个 ID。

### 2. 更新 wrangler.toml
将返回的 `database_id` 填入 `wrangler.toml` 文件：

```toml
name = "vocab-app"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".open-next"

[[d1_databases]]
binding = "DB"
database_name = "vocab-app-db"
database_id = "你的数据库ID"
```

## 三、初始化数据库

### 1. 执行初始化脚本（创建表结构）
```bash
wrangler d1 execute vocab-app-db --remote --file=./d1/schema.sql
```

### 2. 验证表创建成功
```bash
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
   - 框架预设：Next.js
   - 构建命令：`pnpm run build`
   - 构建输出目录：`.open-next`

4. **绑定 D1 数据库（重要！）**
   - 部署完成后，进入项目设置 → Functions → D1 database bindings
   - 添加绑定：
     - Variable name: `DB`
     - D1 database: 选择之前创建的 `vocab-app-db`
   
5. **设置兼容性标志**
   - 进入项目设置 → Functions → Compatibility flags
   - 添加 `nodejs_compat` 标志

6. **重新部署**
   - 绑定数据库后，需要重新部署一次才能生效

### 方式二：通过 CLI 部署

```bash
# 构建
pnpm run build

# 部署
npx wrangler pages deploy .open-next --project-name=vocab-app
```

然后在 Dashboard 中绑定 D1 数据库。

## 五、初始化示例数据

部署成功后，访问以下接口初始化示例数据：

```bash
curl -X POST https://你的域名.pages.dev/api/init-data
```

这会创建：
- 6 个学期分类（六年级、七年级、八年级上、八年级下、九年级上、九年级下）
- 每个分类 15 个示例单词（共 90 个单词）

## 六、创建管理员账户

```bash
wrangler d1 execute vocab-app-db --remote --command="INSERT INTO users (username, password, is_admin) VALUES ('admin', 'admin123', 1);"
```

## 七、常见问题

### Q: 部署后访问页面显示 404

1. 检查 D1 数据库是否正确绑定
2. 检查 `nodejs_compat` 兼容性标志是否添加
3. 查看函数日志排查错误

### Q: API 返回 500 错误

1. 检查 D1 数据库绑定是否正确
2. 检查数据库表是否已创建
3. 查看函数日志：Dashboard → Pages → 项目 → Functions → Logs

### Q: 构建失败

1. 确保 Node.js 版本 >= 18
2. 使用 pnpm 作为包管理器
3. 检查 `open-next.config.ts` 配置是否正确

## 八、费用说明

Cloudflare D1 免费额度：
- 存储：5GB
- 读取行数：500万/月
- 写入行数：10万/月

Cloudflare Pages 免费额度：
- 无限请求
- 无限带宽

完全足够中小型单词应用使用。
