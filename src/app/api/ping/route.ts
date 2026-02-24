import { NextResponse } from 'next/server';

export const runtime = 'edge';

// 最简单的测试接口
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'API is working',
    time: new Date().toISOString()
  });
}
