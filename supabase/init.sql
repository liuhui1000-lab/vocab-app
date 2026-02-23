-- ============================================
-- Supabase 数据库初始化脚本
-- 中考词汇通 - PostgreSQL
-- ============================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 用户名唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username);

-- 2. 创建学期/分类表
CREATE TABLE IF NOT EXISTS semesters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS semesters_slug_idx ON semesters(slug);
CREATE INDEX IF NOT EXISTS semesters_order_idx ON semesters("order");

-- 3. 创建单词表
CREATE TABLE IF NOT EXISTS vocab_words (
    id SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    word VARCHAR(200) NOT NULL,
    phonetic VARCHAR(200),
    meaning TEXT NOT NULL,
    example_en TEXT,
    example_cn TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vocab_words_semester_id_idx ON vocab_words(semester_id);
CREATE INDEX IF NOT EXISTS vocab_words_word_idx ON vocab_words(word);

-- 4. 创建用户进度表
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    word_id INTEGER NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    state VARCHAR(20) NOT NULL DEFAULT 'new',
    next_review TIMESTAMP WITH TIME ZONE,
    ef INTEGER NOT NULL DEFAULT 25,
    "interval" INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    penalty_progress INTEGER NOT NULL DEFAULT 0,
    in_penalty BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_progress_username_idx ON user_progress(username);
CREATE INDEX IF NOT EXISTS user_progress_word_id_idx ON user_progress(word_id);
CREATE INDEX IF NOT EXISTS user_progress_semester_id_idx ON user_progress(semester_id);
CREATE INDEX IF NOT EXISTS user_progress_user_semester_idx ON user_progress(username, semester_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_progress_username_word_idx ON user_progress(username, word_id);

-- 5. 创建学习统计表
CREATE TABLE IF NOT EXISTS study_stats (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    new_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS study_stats_username_idx ON study_stats(username);
CREATE INDEX IF NOT EXISTS study_stats_date_idx ON study_stats(date);
CREATE INDEX IF NOT EXISTS study_stats_user_date_idx ON study_stats(username, date);

-- 6. 创建健康检查表（可选）
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 初始数据：插入默认分类
-- ============================================
INSERT INTO semesters (name, slug, description, "order", is_active) VALUES
('七年级上册', 'grade7-1', '七年级上学期词汇', 1, TRUE),
('七年级下册', 'grade7-2', '七年级下学期词汇', 2, TRUE),
('八年级上册', 'grade8-1', '八年级上学期词汇', 3, TRUE),
('八年级下册', 'grade8-2', '八年级下学期词汇', 4, TRUE),
('九年级全册', 'grade9', '九年级全册词汇', 5, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 创建管理员账户（密码需要你自己修改）
-- 默认密码: admin123（建议使用bcrypt加密）
-- ============================================
-- 注意：这里的密码是明文，实际部署时请使用加密密码
-- 你可以在应用注册后手动设置 is_admin = TRUE
INSERT INTO users (username, password, is_admin) VALUES
('admin', 'admin123', TRUE)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 权限设置：启用 RLS (Row Level Security)
-- ============================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_stats ENABLE ROW LEVEL SECURITY;

-- semesters: 所有人可读
CREATE POLICY "semesters_select_policy" ON semesters
    FOR SELECT USING (TRUE);

-- vocab_words: 所有人可读
CREATE POLICY "vocab_words_select_policy" ON vocab_words
    FOR SELECT USING (TRUE);

-- users: 只能查看和修改自己的数据（通过username匹配）
CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (username = current_user_username());

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT WITH CHECK (TRUE);  -- 允许注册

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE USING (username = current_user_username());

-- user_progress: 通过username控制访问
CREATE POLICY "user_progress_select_policy" ON user_progress
    FOR SELECT USING (username = current_user_username());

CREATE POLICY "user_progress_insert_policy" ON user_progress
    FOR INSERT WITH CHECK (username = current_user_username());

CREATE POLICY "user_progress_update_policy" ON user_progress
    FOR UPDATE USING (username = current_user_username());

-- study_stats: 通过username控制访问
CREATE POLICY "study_stats_select_policy" ON study_stats
    FOR SELECT USING (username = current_user_username());

CREATE POLICY "study_stats_insert_policy" ON study_stats
    FOR INSERT WITH CHECK (username = current_user_username());

CREATE POLICY "study_stats_update_policy" ON study_stats
    FOR UPDATE USING (username = current_user_username());

-- ============================================
-- 创建辅助函数：获取当前用户名
-- ============================================
CREATE OR REPLACE FUNCTION current_user_username()
RETURNS VARCHAR(50) AS $$
BEGIN
    -- 这个函数需要在应用层通过 Supabase Auth 设置
    -- 暂时返回 NULL，实际使用时需要配合 Supabase Auth
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 user_progress 添加更新触发器
DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 授权 Service Role 完全访问（用于后端 API）
-- ============================================
-- 注意：在 Supabase Dashboard 中执行以下 SQL
-- 或者使用 service_role key 跳过 RLS

-- 如果你想让后端 API 完全跳过 RLS：
-- 1. 在代码中使用 service_role key 而不是 anon key
-- 2. 或者创建以下策略允许 service_role 完全访问

-- 示例：允许所有操作（仅用于开发/测试，生产环境请细化权限）
CREATE POLICY "service_role_all_policy" ON users
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_policy_progress" ON user_progress
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_policy_stats" ON study_stats
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_policy_vocab" ON vocab_words
    FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ============================================
-- 完成提示
-- ============================================
-- 执行完成后，请：
-- 1. 修改 admin 用户密码
-- 2. 在 Supabase Dashboard > Settings > API 中获取：
--    - Project URL
--    - anon public key
--    - service_role key（后端使用）
-- 3. 将这些值配置到 Cloudflare 环境变量中
