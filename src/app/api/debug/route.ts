import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@/lib/db';

interface Env {
  DB: D1Database;
}

export async function GET() {
  const result: any = {
    status: 'ok',
    time: new Date().toISOString(),
    runtime: 'edge',
  };
  
  try {
    const ctx = getCloudflareContext();
    result.hasContext = !!ctx;
    result.hasEnv = !!ctx?.env;
    result.envKeys = ctx?.env ? Object.keys(ctx.env) : [];
    
    const db = (ctx?.env as unknown as Env)?.DB;
    result.hasDB = !!db;
    
    if (db) {
      result.step = 'testing_db_query';
      const testResult = await db.prepare('SELECT 1 as value').first();
      result.queryTest = testResult;
      
      result.step = 'querying_semesters';
      const semesters = await db.prepare('SELECT COUNT(*) as count FROM semesters').first() as { count: number } | null;
      result.semesterCount = semesters?.count ?? 0;
      
      result.step = 'success';
      result.dbWorks = true;
    }
  } catch (error: any) {
    result.error = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    };
  }
  
  return NextResponse.json(result, { status: 200 });
}
