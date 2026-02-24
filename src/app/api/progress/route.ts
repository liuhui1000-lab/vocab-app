import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';


// GET user progress for selected semesters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const semesterIds = searchParams.get('semesterIds');

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const db = getDB();

    let result;
    if (semesterIds) {
      const ids = semesterIds.split(',').map(id => parseInt(id));
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM user_progress WHERE username = ? AND semester_id IN (${placeholders})`;
      const params = [username, ...ids];
      result = await (db.prepare(sql) as any).bind(...params).all();
    } else {
      result = await db
        .prepare('SELECT * FROM user_progress WHERE username = ?')
        .bind(username)
        .all();
    }

    return NextResponse.json({ progress: result.results });
  } catch (error) {
    console.error('Error fetching progress:', error);
    
    // 本地开发时的后备数据
    if (error instanceof Error && error.message.includes('not available')) {
      return NextResponse.json({ progress: [] });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - save user progress
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, progress } = body;

    console.log('[API /progress POST] 收到请求:', { 
      username, 
      progressCount: progress?.length,
      progress 
    });

    if (!username || !progress || !Array.isArray(progress)) {
      console.error('[API /progress POST] 参数无效:', { username, progress });
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDB();
    const results = [];
    const errors = [];

    for (const item of progress) {
      try {
        console.log('[API /progress POST] 保存项目:', item);
        
        const result = await db
          .prepare(`
            INSERT INTO user_progress (username, word_id, semester_id, state, next_review, ef, "interval", failure_count, in_penalty, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(username, word_id) DO UPDATE SET
              state = excluded.state,
              next_review = excluded.next_review,
              ef = excluded.ef,
              "interval" = excluded."interval",
              failure_count = excluded.failure_count,
              in_penalty = excluded.in_penalty,
              updated_at = datetime('now')
          `)
          .bind(
            username,
            item.wordId,
            item.semesterId,
            item.state,
            item.nextReview,
            item.ef,
            item.interval,
            item.failureCount,
            item.inPenalty ? 1 : 0
          )
          .run();
        
        console.log('[API /progress POST] 保存结果:', result);
        results.push({ wordId: item.wordId, result });
      } catch (err) {
        console.error('[API /progress POST] 保存错误:', err);
        errors.push({ wordId: item.wordId, error: String(err) });
      }
    }

    console.log('[API /progress POST] 完成:', { saved: results.length, errors: errors.length });
    
    return NextResponse.json({ 
      success: true, 
      saved: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[API /progress POST] 全局错误:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// DELETE - reset user progress for a semester
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const semesterId = searchParams.get('semesterId');

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const db = getDB();

    if (semesterId) {
      await db
        .prepare('DELETE FROM user_progress WHERE username = ? AND semester_id = ?')
        .bind(username, semesterId)
        .run();
    } else {
      await db
        .prepare('DELETE FROM user_progress WHERE username = ?')
        .bind(username)
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
