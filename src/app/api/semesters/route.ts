import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@/lib/db';

interface Env {
  DB: D1Database;
}

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as unknown as Env).DB;
    
    if (!db) {
      return NextResponse.json({ 
        error: 'D1 database not found',
        hint: 'Please check D1 binding in Cloudflare Pages Settings > Functions > D1 database bindings'
      }, { status: 500 });
    }
    
    // 测试查询
    const result = await db
      .prepare('SELECT * FROM semesters WHERE is_active = 1 ORDER BY "order" ASC')
      .all();
    
    return NextResponse.json({ 
      semesters: result.results.map((s: any) => ({
        ...s,
        is_active: s.is_active === 1
      }))
    });
  } catch (error) {
    console.error('Error in semesters API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
