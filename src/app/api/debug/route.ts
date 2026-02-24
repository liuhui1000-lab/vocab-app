import { NextResponse } from 'next/server';

export const runtime = 'edge';

// 简单的调试接口，检查环境配置
export async function GET(request: Request) {
  const debug: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  // 检查 request.env
  debug.checks.hasRequestEnv = typeof (request as any).env !== 'undefined';
  if ((request as any).env) {
    debug.checks.requestEnvKeys = Object.keys((request as any).env);
    debug.checks.hasDB = typeof (request as any).env?.DB !== 'undefined';
  }
  
  // 检查 globalThis
  debug.checks.hasGlobalDB = typeof (globalThis as any).DB !== 'undefined';
  
  // 检查 getRequestContext
  debug.checks.hasGetRequestContext = typeof (globalThis as any).getRequestContext !== 'undefined';
  
  if (typeof (globalThis as any).getRequestContext !== 'undefined') {
    try {
      const ctx = (globalThis as any).getRequestContext();
      debug.checks.hasContext = !!ctx;
      debug.checks.hasContextEnv = !!ctx?.env;
      if (ctx?.env) {
        debug.checks.contextEnvKeys = Object.keys(ctx.env);
        debug.checks.hasContextDB = !!ctx.env.DB;
      }
    } catch (e: any) {
      debug.checks.getRequestContextError = e.message;
    }
  }
  
  // 尝试获取 DB
  let db: any = null;
  let source = '';
  
  // 方式1
  if ((request as any).env?.DB) {
    db = (request as any).env.DB;
    source = 'request.env.DB';
  }
  // 方式2
  else if (typeof (globalThis as any).getRequestContext !== 'undefined') {
    try {
      const ctx = (globalThis as any).getRequestContext();
      if (ctx?.env?.DB) {
        db = ctx.env.DB;
        source = 'getRequestContext().env.DB';
      }
    } catch (e) {}
  }
  // 方式3
  else if ((globalThis as any).DB) {
    db = (globalThis as any).DB;
    source = 'globalThis.DB';
  }
  
  debug.dbFound = !!db;
  debug.dbSource = source;
  
  // 如果找到了数据库，尝试查询
  if (db) {
    try {
      const result = await db.prepare('SELECT 1 as test').first();
      debug.queryResult = result;
      
      // 查询学期数量
      const countResult = await db.prepare('SELECT COUNT(*) as count FROM semesters').first();
      debug.semesterCount = countResult?.count;
    } catch (e: any) {
      debug.queryError = e.message;
    }
  }
  
  return NextResponse.json(debug, { status: 200 });
}
