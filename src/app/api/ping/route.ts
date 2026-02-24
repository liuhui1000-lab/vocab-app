import { NextResponse } from 'next/server';


// 健康检查接口 - 用于诊断 Cloudflare Pages Functions 配置
export async function GET(request: Request) {
  const diagnostics: Record<string, any> = {
    status: 'ok',
    time: new Date().toISOString(),
    runtime: 'edge',
  };
  
  try {
    // 检查全局 getRequestContext 函数
    diagnostics.hasGetRequestContext = typeof (globalThis as any).getRequestContext === 'function';
    
    // 尝试获取 Cloudflare 上下文
    if (typeof (globalThis as any).getRequestContext === 'function') {
      try {
        const ctx = (globalThis as any).getRequestContext();
        diagnostics.hasContext = !!ctx;
        diagnostics.hasContextEnv = !!ctx?.env;
        diagnostics.contextEnvKeys = ctx?.env ? Object.keys(ctx.env) : [];
        diagnostics.hasDB = !!ctx?.env?.DB;
      } catch (e: any) {
        diagnostics.getRequestContextError = e.message;
      }
    }
    
    // 检查 request.env
    diagnostics.hasRequestEnv = !!(request as any).env;
    if ((request as any).env) {
      diagnostics.requestEnvKeys = Object.keys((request as any).env);
    }
    
  } catch (error: any) {
    diagnostics.error = error.message;
    diagnostics.errorStack = error.stack?.split('\n').slice(0, 3);
  }
  
  return NextResponse.json(diagnostics, { status: 200 });
}
