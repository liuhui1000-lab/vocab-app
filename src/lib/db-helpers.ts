/**
 * D1 数据库适配器
 * 
 * 用于在 OpenNext for Cloudflare 环境中访问 D1 数据库
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database, D1PreparedStatement } from './db';

// Cloudflare 环境类型（包含我们的 D1 绑定）
interface Env {
  DB: D1Database;
}

// 获取 D1 数据库
export function getDB(): D1Database {
  try {
    const { env } = getCloudflareContext();
    const typedEnv = env as unknown as Env;
    if (typedEnv?.DB) {
      return typedEnv.DB;
    }
  } catch (error) {
    console.error('Failed to get Cloudflare context:', error);
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
