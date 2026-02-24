/**
 * D1 数据库适配器
 * 
 * 用于在 Cloudflare Pages Functions 中访问 D1 数据库
 */

import type { D1Database, D1PreparedStatement } from './db';

// Cloudflare Pages Functions 环境
interface Env {
  DB: D1Database;
}

// 声明 Cloudflare 的 getRequestContext
declare global {
  function getRequestContext(): { env: Env } | undefined;
}

// 获取请求中的 D1 数据库
export function getDB(request?: Request): D1Database {
  // 方式1: 使用 Cloudflare 的 getRequestContext (推荐)
  if (typeof getRequestContext !== 'undefined') {
    const ctx = getRequestContext();
    if (ctx?.env?.DB) {
      return ctx.env.DB;
    }
  }
  
  // 方式2: 从请求中获取
  if (request) {
    const env = (request as any).env as Env;
    if (env?.DB) {
      return env.DB;
    }
  }
  
  // 方式3: 从全局变量获取
  if (typeof globalThis !== 'undefined' && (globalThis as any).DB) {
    return (globalThis as any).DB;
  }
  
  throw new Error('D1 database not available. Please check D1 binding in Cloudflare Pages settings.');
}

// 辅助函数：准备并绑定语句
function prepareAndBind(db: D1Database, sql: string, params: unknown[] = []): D1PreparedStatement {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    return stmt.bind(...params);
  }
  return stmt;
}

// ============ 类型定义 ============

export interface SemesterRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  is_active: number;
  created_at: string;
}

export interface VocabWordRow {
  id: number;
  semester_id: number;
  word: string;
  phonetic: string | null;
  meaning: string;
  example_en: string | null;
  example_cn: string | null;
  order: number;
  created_at: string;
}

export interface UserProgressRow {
  id: number;
  username: string;
  word_id: number;
  semester_id: number;
  state: string;
  next_review: string | null;
  ef: number;
  interval: number;
  failure_count: number;
  penalty_progress: number;
  in_penalty: number;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: number;
  username: string;
  password: string | null;
  is_admin: number;
  created_at: string;
  last_login_at: string | null;
}

export interface StudyStatsRow {
  id: number;
  username: string;
  semester_id: number;
  date: string;
  new_count: number;
  review_count: number;
  created_at: string;
}

// ============ 查询辅助函数 ============

// 获取所有学期
export async function getSemesters(db: D1Database): Promise<SemesterRow[]> {
  const result = await db
    .prepare('SELECT * FROM semesters WHERE is_active = 1 ORDER BY "order" ASC')
    .all<SemesterRow>();
  return result.results;
}

// 获取指定学期的单词
export async function getVocabWords(db: D1Database, semesterId: number): Promise<VocabWordRow[]> {
  const result = await db
    .prepare('SELECT * FROM vocab_words WHERE semester_id = ? ORDER BY "order" ASC')
    .bind(semesterId)
    .all<VocabWordRow>();
  return result.results;
}

// 获取用户进度
export async function getUserProgress(
  db: D1Database, 
  username: string, 
  semesterIds: number[]
): Promise<UserProgressRow[]> {
  const placeholders = semesterIds.map(() => '?').join(',');
  const result = await db
    .prepare(`SELECT * FROM user_progress WHERE username = ? AND semester_id IN (${placeholders})`)
    .bind(username, ...semesterIds)
    .all<UserProgressRow>();
  return result.results;
}

// 获取用户
export async function getUser(db: D1Database, username: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first<UserRow>();
}

// 创建用户
export async function createUser(
  db: D1Database,
  username: string,
  password: string,
  isAdmin: boolean = false
): Promise<UserRow> {
  const result = await db
    .prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?) RETURNING *')
    .bind(username, password, isAdmin ? 1 : 0)
    .first<UserRow>();
  
  if (!result) {
    throw new Error('Failed to create user');
  }
  
  return result;
}

// 更新用户密码
export async function updateUserPassword(
  db: D1Database,
  username: string,
  newPassword: string
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE users SET password = ? WHERE username = ?')
    .bind(newPassword, username)
    .run();
  
  return result.meta?.changes ? result.meta.changes > 0 : false;
}

// 删除用户
export async function deleteUser(db: D1Database, username: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM users WHERE username = ?')
    .bind(username)
    .run();
  
  return result.meta?.changes ? result.meta.changes > 0 : false;
}

// 获取所有用户
export async function getAllUsers(db: D1Database): Promise<UserRow[]> {
  const result = await db
    .prepare('SELECT * FROM users ORDER BY created_at DESC')
    .all<UserRow>();
  return result.results;
}

// 插入单词
export async function insertVocabWord(
  db: D1Database,
  word: {
    semester_id: number;
    word: string;
    phonetic: string | null;
    meaning: string;
    example_en: string | null;
    example_cn: string | null;
    order: number;
  }
): Promise<VocabWordRow> {
  const result = await db
    .prepare(`
      INSERT INTO vocab_words (semester_id, word, phonetic, meaning, example_en, example_cn, "order")
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `)
    .bind(
      word.semester_id,
      word.word,
      word.phonetic,
      word.meaning,
      word.example_en,
      word.example_cn,
      word.order
    )
    .first<VocabWordRow>();
  
  if (!result) {
    throw new Error('Failed to insert word');
  }
  
  return result;
}

// 获取学习统计
export async function getStudyStats(
  db: D1Database,
  username: string
): Promise<StudyStatsRow[]> {
  const result = await db
    .prepare('SELECT * FROM study_stats WHERE username = ? ORDER BY date DESC')
    .bind(username)
    .all<StudyStatsRow>();
  return result.results;
}

// 记录学习统计
export async function recordStudyStats(
  db: D1Database,
  username: string,
  semesterId: number,
  date: string,
  type: 'new' | 'review'
): Promise<void> {
  const column = type === 'new' ? 'new_count' : 'review_count';
  
  await db
    .prepare(`
      INSERT INTO study_stats (username, semester_id, date, ${column})
      VALUES (?, ?, ?, 1)
      ON CONFLICT DO UPDATE SET ${column} = ${column} + 1
    `)
    .bind(username, semesterId, date)
    .run();
}

// 更新用户进度
export async function upsertUserProgress(
  db: D1Database,
  progress: {
    username: string;
    word_id: number;
    semester_id: number;
    state: string;
    next_review: string | null;
    ef: number;
    interval: number;
    failure_count: number;
    in_penalty: number;
  }
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO user_progress (username, word_id, semester_id, state, next_review, ef, "interval", failure_count, in_penalty, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(username, word_id) DO UPDATE SET
        state = excluded.state,
        next_review = excluded.next_review,
        ef = excluded.ef,
        "interval" = excluded."interval",
        failure_count = excluded.failure_count,
        in_penalty = excluded.in_penalty,
        updated_at = datetime('now')
    `)
    .bind(
      progress.username,
      progress.word_id,
      progress.semester_id,
      progress.state,
      progress.next_review,
      progress.ef,
      progress.interval,
      progress.failure_count,
      progress.in_penalty
    )
    .run();
}

// 获取或创建用户
export async function getOrCreateUser(
  db: D1Database,
  username: string,
  password?: string
): Promise<UserRow | null> {
  // 先查找用户
  const existing = await db
    .prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first<UserRow>();
  
  if (existing) {
    // 更新最后登录时间
    await db
      .prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?')
      .bind(existing.id)
      .run();
    return existing;
  }
  
  // 创建新用户
  const result = await db
    .prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, 0) RETURNING *')
    .bind(username, password || '')
    .first<UserRow>();
  
  return result;
}
