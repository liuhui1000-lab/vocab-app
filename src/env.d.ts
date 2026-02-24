/// <reference types="@cloudflare/next-on-pages" />

// Cloudflare D1 数据库类型
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
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

// Cloudflare 环境变量类型
interface CloudflareEnv {
  DB: D1Database;
  ENVIRONMENT?: string;
}

// 扩展 Next.js 的 NextFetchRequestContext
declare module 'next' {
  interface NextFetchRequestContext {
    env?: CloudflareEnv;
    waitUntil?: (promise: Promise<unknown>) => void;
  }
}

// 扩展 Request 类型
declare global {
  interface Request {
    env?: CloudflareEnv;
  }
}

export {};
