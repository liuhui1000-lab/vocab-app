import { NextResponse } from 'next/server';


export async function GET(request: Request) {
  try {
    // 测试：直接返回成功，确认路由工作
    const testResult = {
      message: 'API is working',
      hasEnv: typeof (request as any).env !== 'undefined',
      hasGlobalDB: typeof (globalThis as any).DB !== 'undefined',
    };
    
    // 尝试获取数据库
    let db = null;
    let dbSource = '';
    
    // 方式1: getRequestContext
    try {
      if (typeof (globalThis as any).getRequestContext !== 'undefined') {
        const ctx = (globalThis as any).getRequestContext();
        if (ctx?.env?.DB) {
          db = ctx.env.DB;
          dbSource = 'getRequestContext';
        }
      }
    } catch (e) {
      // ignore
    }
    
    // 方式2: request.env
    if (!db && (request as any).env?.DB) {
      db = (request as any).env.DB;
      dbSource = 'request.env';
    }
    
    // 方式3: globalThis
    if (!db && (globalThis as any).DB) {
      db = (globalThis as any).DB;
      dbSource = 'globalThis';
    }
    
    if (!db) {
      return NextResponse.json({ 
        error: 'D1 database not found',
        debug: testResult,
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
      })),
      debug: {
        ...testResult,
        dbSource,
        rowCount: result.results.length
      }
    });
  } catch (error) {
    console.error('Error in semesters API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
