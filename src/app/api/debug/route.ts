import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const result: any = {
    step: 'start',
    timestamp: new Date().toISOString()
  };
  
  try {
    result.step = 'checking_request_env';
    result.hasRequestEnv = !!(request as any).env;
    
    if ((request as any).env) {
      result.requestEnvKeys = Object.keys((request as any).env);
      result.hasDBInRequestEnv = !!(request as any).env?.DB;
    }
    
    result.step = 'checking_global';
    result.hasGlobalGetRequestContext = typeof (globalThis as any).getRequestContext === 'function';
    
    if (typeof (globalThis as any).getRequestContext === 'function') {
      result.step = 'calling_getRequestContext';
      try {
        const ctx = (globalThis as any).getRequestContext();
        result.hasContext = !!ctx;
        result.hasContextEnv = !!ctx?.env;
        if (ctx?.env) {
          result.contextEnvKeys = Object.keys(ctx.env);
          result.hasDBInContext = !!ctx.env.DB;
          
          if (ctx.env.DB) {
            result.step = 'testing_db_query';
            const db = ctx.env.DB;
            const testResult = await db.prepare('SELECT 1 as value').first();
            result.queryTest = testResult;
            
            result.step = 'querying_semesters';
            const semesters = await db.prepare('SELECT COUNT(*) as count FROM semesters').first();
            result.semesterCount = semesters?.count;
            
            result.step = 'success';
            result.dbWorks = true;
          }
        }
      } catch (e: any) {
        result.getRequestContextError = {
          message: e.message,
          stack: e.stack?.split('\n').slice(0, 3)
        };
      }
    }
    
    result.step = 'checking_globalThis_DB';
    result.hasGlobalDB = !!(globalThis as any).DB;
    
  } catch (error: any) {
    result.step = 'error';
    result.error = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    };
  }
  
  return NextResponse.json(result, { status: 200 });
}
