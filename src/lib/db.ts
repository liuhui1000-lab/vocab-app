/**
 * Cloudflare D1 数据库连接
 * 
 * 使用方式：
 * 1. 在 API Route 中：const db = getDB();
 * 2. 执行查询：const result = await db.prepare('SELECT * FROM users').all();
 */

// 类型定义
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

// Cloudflare Pages Functions 环境类型
interface CloudflareEnv {
  DB: D1Database;
}

// 获取 D1 数据库实例
export function getDB(): D1Database {
  // Cloudflare Workers 环境
  if (typeof globalThis !== 'undefined' && (globalThis as any).DB) {
    return (globalThis as any).DB;
  }
  
  // 开发环境或 Node.js 环境返回模拟实现
  // 实际部署时会被 Cloudflare 自动注入
  throw new Error('D1 database not available. This code must run in Cloudflare Workers environment.');
}

// 从请求中获取 DB（用于 API Routes）
export function getDBFromRequest(request: Request): D1Database {
  // Cloudflare Pages Functions 会将 env 注入到请求中
  const env = (request as any).env as CloudflareEnv;
  if (env?.DB) {
    return env.DB;
  }
  throw new Error('D1 database binding not found in request environment');
}

// 辅助函数：执行查询并返回结果
export async function queryOne<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(...params);
  }
  return stmt.first<T>();
}

// 辅助函数：执行查询并返回所有结果
export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(...params);
  }
  const result = await stmt.all<T>();
  return result.results;
}

// 辅助函数：执行 INSERT/UPDATE/DELETE
export async function execute(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(...params);
  }
  return stmt.run();
}

// 辅助函数：批量执行
export async function batch(db: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  return db.batch(statements);
}
