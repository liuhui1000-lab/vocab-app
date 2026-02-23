-- ============================================
-- Supabase 数据库初始化脚本（简化版）
-- 中考词汇通 - 无 RLS 版本
-- 适合快速部署和测试
-- ============================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

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
-- 创建管理员账户
-- 密码: admin123（请在首次登录后修改！）
-- ============================================
INSERT INTO users (username, password, is_admin) VALUES
('admin', 'admin123', TRUE)
ON CONFLICT (username) DO NOTHING;

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

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 完成！
-- ============================================
-- 接下来请：
-- 1. 在 Supabase Dashboard > Settings > API 获取：
--    - Project URL
--    - anon public key  
--    - service_role key
-- 2. 将这些值配置到 Cloudflare 环境变量
