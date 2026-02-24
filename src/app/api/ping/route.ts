import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@/lib/db';

interface Env {
  DB: D1Database;
}

// 健康检查接口 - 用于诊断 Cloudflare Pages Functions 配置
export async function GET() {
  const diagnostics: Record<string, any> = {
    status: 'ok',
    time: new Date().toISOString(),
    runtime: 'edge',
  };
  
  try {
    // 使用 OpenNext Cloudflare 的 getCloudflareContext
    const ctx = getCloudflareContext();
    diagnostics.hasCloudflareContext = !!ctx;
    diagnostics.hasEnv = !!ctx?.env;
    diagnostics.envKeys = ctx?.env ? Object.keys(ctx.env) : [];
    
    const db = (ctx?.env as unknown as Env)?.DB;
    diagnostics.hasDB = !!db;
    
  } catch (error: any) {
    diagnostics.error = error.message;
    diagnostics.errorStack = error.stack?.split('\n').slice(0, 3);
  }
  
  return NextResponse.json(diagnostics, { status: 200 });
}
