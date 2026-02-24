import { NextResponse } from 'next/server';
import { getDB, getVocabWords } from '@/lib/db-helpers';


export async function GET(
  request: Request,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const { semesterId } = await params;
    const db = getDB();
    const words = await getVocabWords(db, parseInt(semesterId));
    
    return NextResponse.json({ words });
  } catch (error) {
    console.error('Error fetching vocab words:', error);
    
    // 本地开发时的后备数据
    if (error instanceof Error && error.message.includes('not available')) {
      return NextResponse.json({ words: [] });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
