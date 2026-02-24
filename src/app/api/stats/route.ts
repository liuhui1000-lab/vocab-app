import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';


// GET study stats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const year = searchParams.get('year');
    const semesterId = searchParams.get('semesterId');

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const db = getDB();

    let sql = 'SELECT * FROM study_stats WHERE username = ?';
    const params: (string | number)[] = [username];

    if (year) {
      sql += ' AND date LIKE ?';
      params.push(`${year}%`);
    }

    if (semesterId) {
      sql += ' AND semester_id = ?';
      params.push(parseInt(semesterId));
    }

    sql += ' ORDER BY date ASC';

    const stmt = db.prepare(sql).bind(...params);
    const result = await stmt.all();

    return NextResponse.json({ stats: result.results });
  } catch (error) {
    console.error('Error fetching stats:', error);
    
    // 本地开发时的后备数据
    if (error instanceof Error && error.message.includes('not available')) {
      return NextResponse.json({ stats: [] });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - record study stats
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, semesterId, date, type } = body;

    console.log('[API /stats POST] 收到请求:', body);

    if (!username || !semesterId || !date || !type) {
      console.error('[API /stats POST] 参数无效:', body);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDB();
    const updateField = type === 'new' ? 'new_count' : 'review_count';

    console.log('[API /stats POST] 尝试 UPSERT:', { username, semesterId, date, type, updateField });

    // SQLite 的 UPSERT 语法
    const result = await db
      .prepare(`
        INSERT INTO study_stats (username, semester_id, date, new_count, review_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(username, semester_id, date) DO UPDATE SET
          ${updateField} = ${updateField} + 1
      `)
      .bind(
        username,
        semesterId,
        date,
        type === 'new' ? 1 : 0,
        type === 'review' ? 1 : 0
      )
      .run();

    console.log('[API /stats POST] 结果:', result);
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { raw: String(error) };
    console.error('[API /stats POST] 错误:', errorDetails);
    return NextResponse.json({ error: 'Internal server error', details: errorDetails }, { status: 500 });
  }
}
