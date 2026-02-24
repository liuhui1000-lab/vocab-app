import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';

export const runtime = 'edge';

// 验证管理员权限
async function checkAdmin(db: any, username: string): Promise<{ success: boolean; error?: string }> {
  const user = await db
    .prepare('SELECT is_admin FROM users WHERE username = ?')
    .bind(username)
    .first();

  if (!user || (user as any).is_admin !== 1) {
    return { success: false, error: '需要管理员权限' };
  }
  return { success: true };
}

// POST - 批量导入单词（仅管理员）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminUsername, semesterId, words, clearExisting } = body;

    if (!adminUsername) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    if (!semesterId || !words || !Array.isArray(words)) {
      return NextResponse.json({ 
        error: 'Invalid request body. Required: semesterId, words[]' 
      }, { status: 400 });
    }

    const db = getDB(request);

    // 验证管理员权限
    const adminCheck = await checkAdmin(db, adminUsername);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // 验证学期是否存在
    const semester = await db
      .prepare('SELECT id, name FROM semesters WHERE id = ?')
      .bind(semesterId)
      .first();

    if (!semester) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 如果需要，清空现有单词
    if (clearExisting) {
      await db
        .prepare('DELETE FROM user_progress WHERE semester_id = ?')
        .bind(semesterId)
        .run();
      
      await db
        .prepare('DELETE FROM vocab_words WHERE semester_id = ?')
        .bind(semesterId)
        .run();
    }

    // 获取当前最大order
    const maxOrderResult = await db
      .prepare('SELECT MAX("order") as max_order FROM vocab_words WHERE semester_id = ?')
      .bind(semesterId)
      .first();
    
    let startOrder = 0;
    if (maxOrderResult && (maxOrderResult as any).max_order !== null) {
      startOrder = (maxOrderResult as any).max_order + 1;
    }

    // 转换单词格式 - 支持多种格式
    const wordsToInsert = words.map((w: any, idx: number) => ({
      semester_id: semesterId,
      word: w.w || w.word || w.wordText,
      phonetic: w.p || w.phonetic || w.phoneticText || null,
      meaning: w.m || w.meaning || w.meaningText,
      example_en: w.ex || w.exampleEn || w.example_en || w.example || null,
      example_cn: w.exc || w.exampleCn || w.example_cn || w.exampleCnText || null,
      order: startOrder + idx,
    }));

    // 过滤掉无效数据
    const validWords = wordsToInsert.filter(w => w.word && w.meaning);

    if (validWords.length === 0) {
      return NextResponse.json({ 
        error: '没有有效的单词数据' 
      }, { status: 400 });
    }

    // 批量插入（D1 不支持批量 INSERT，需要逐个插入）
    let insertedCount = 0;
    const errors = [];

    for (const word of validWords) {
      try {
        await db
          .prepare(`
            INSERT INTO vocab_words (semester_id, word, phonetic, meaning, example_en, example_cn, "order")
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            word.semester_id,
            word.word,
            word.phonetic,
            word.meaning,
            word.example_en,
            word.example_cn,
            word.order
          )
          .run();
        
        insertedCount++;
      } catch (err) {
        errors.push(`单词 "${word.word}": ${String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      semester: (semester as any).name,
      imported: insertedCount,
      total: validWords.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - 获取某分类的单词列表（管理员可看详情）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');

    if (!semesterId) {
      return NextResponse.json({ error: 'semesterId is required' }, { status: 400 });
    }

    const db = getDB(request);

    const result = await db
      .prepare('SELECT * FROM vocab_words WHERE semester_id = ? ORDER BY "order" ASC')
      .bind(parseInt(semesterId))
      .all();

    return NextResponse.json({ words: result.results, count: result.results.length });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - 删除某分类的所有单词（仅管理员）
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');
    const adminUsername = searchParams.get('adminUsername');

    if (!adminUsername) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    if (!semesterId) {
      return NextResponse.json({ error: 'semesterId is required' }, { status: 400 });
    }

    const db = getDB(request);

    // 验证管理员权限
    const adminCheck = await checkAdmin(db, adminUsername);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // 先删除相关进度
    await db
      .prepare('DELETE FROM user_progress WHERE semester_id = ?')
      .bind(parseInt(semesterId))
      .run();

    // 再删除单词
    await db
      .prepare('DELETE FROM vocab_words WHERE semester_id = ?')
      .bind(parseInt(semesterId))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
