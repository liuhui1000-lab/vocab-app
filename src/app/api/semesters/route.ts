import { NextResponse } from 'next/server';
import { getDB, getSemesters } from '@/lib/db-helpers';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const db = getDB(request);
    const semesters = await getSemesters(db);
    
    return NextResponse.json({ 
      semesters: semesters.map(s => ({
        ...s,
        is_active: s.is_active === 1  // 转换为布尔值
      }))
    });
  } catch (error) {
    console.error('Error fetching semesters:', error);
    
    // 本地开发时的后备数据
    if (error instanceof Error && error.message.includes('not available')) {
      return NextResponse.json({
        semesters: [
          { id: 1, name: '七年级上册', slug: 'grade7-1', description: '七年级上学期词汇', order: 1, is_active: true },
          { id: 2, name: '七年级下册', slug: 'grade7-2', description: '七年级下学期词汇', order: 2, is_active: true },
          { id: 3, name: '八年级上册', slug: 'grade8-1', description: '八年级上学期词汇', order: 3, is_active: true },
          { id: 4, name: '八年级下册', slug: 'grade8-2', description: '八年级下学期词汇', order: 4, is_active: true },
          { id: 5, name: '九年级全册', slug: 'grade9', description: '九年级全册词汇', order: 5, is_active: true },
        ]
      });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
