-- ============================================
-- Cloudflare D1 数据库初始化脚本
-- 中考词汇通 - SQLite 版本
-- ============================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. 创建学期/分类表
CREATE TABLE IF NOT EXISTS semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_semesters_slug ON semesters(slug);
CREATE INDEX IF NOT EXISTS idx_semesters_order ON semesters("order");

-- 3. 创建单词表
CREATE TABLE IF NOT EXISTS vocab_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    phonetic TEXT,
    meaning TEXT NOT NULL,
    example_en TEXT,
    example_cn TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vocab_semester_id ON vocab_words(semester_id);
CREATE INDEX IF NOT EXISTS idx_vocab_word ON vocab_words(word);

-- 4. 创建用户进度表
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    word_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'new',
    next_review TEXT,
    ef INTEGER NOT NULL DEFAULT 25,
    "interval" INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    penalty_progress INTEGER NOT NULL DEFAULT 0,
    in_penalty INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (word_id) REFERENCES vocab_words(id) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_username ON user_progress(username);
CREATE INDEX IF NOT EXISTS idx_progress_word_id ON user_progress(word_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_username_word ON user_progress(username, word_id);

-- 5. 创建学习统计表
CREATE TABLE IF NOT EXISTS study_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    semester_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    new_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    UNIQUE(username, semester_id, date)
);

CREATE INDEX IF NOT EXISTS idx_stats_username ON study_stats(username);
CREATE INDEX IF NOT EXISTS idx_stats_date ON study_stats(date);

-- ============================================
-- 初始数据：插入默认分类（6个学期）
-- ============================================
INSERT INTO semesters (name, slug, description, "order", is_active) VALUES
('六年级', 'grade6', '六年级词汇', 1, 1),
('七年级', 'grade7', '七年级词汇', 2, 1),
('八年级上', 'grade8-1', '八年级上学期词汇', 3, 1),
('八年级下', 'grade8-2', '八年级下学期词汇', 4, 1),
('九年级上', 'grade9-1', '九年级上学期词汇', 5, 1),
('九年级下', 'grade9-2', '九年级下学期词汇', 6, 1);

-- ============================================
-- 创建管理员账户
-- 密码: admin123（请在首次登录后修改！）
-- ============================================
INSERT INTO users (username, password, is_admin) VALUES
('admin', 'admin123', 1);

-- ============================================
-- 示例单词数据（可选）
-- ============================================
-- INSERT INTO vocab_words (semester_id, word, phonetic, meaning, example_en, example_cn, "order") VALUES
-- (1, 'hello', '/həˈləʊ/', '你好', 'Hello, how are you?', '你好，你好吗？', 1),
-- (1, 'world', '/wɜːld/', '世界', 'The world is beautiful.', '世界是美丽的。', 2);
