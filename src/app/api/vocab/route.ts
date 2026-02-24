import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';

export const runtime = 'edge';

// POST - 批量导入单词
// 格式: { semesterId: number, words: Array<{w, p, m, ex, exc}> }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { semesterId, words, clearExisting } = body;

    if (!semesterId || !words || !Array.isArray(words)) {
      return NextResponse.json({ 
        error: 'Invalid request body. Required: semesterId, words[]' 
      }, { status: 400 });
    }

    const db = getDB(request);

    // 验证学期是否存在
    const semester = await db
      .prepare('SELECT id, name FROM semesters WHERE id = ?')
      .bind(semesterId)
      .first();

    if (!semester) {
      return NextResponse.json({ 
        error: 'Semester not found' 
      }, { status: 404 });
    }

    // 如果需要，清空现有单词
    if (clearExisting) {
      // 先删除相关进度
      await db
        .prepare('DELETE FROM user_progress WHERE semester_id = ?')
        .bind(semesterId)
        .run();
      
      // 再删除单词
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

    // 转换单词格式
    const wordsToInsert = words.map((w: any, idx: number) => ({
      semester_id: semesterId,
      word: w.w || w.word,
      phonetic: w.p || w.phonetic || null,
      meaning: w.m || w.meaning,
      example_en: w.ex || w.exampleEn || w.example_en || null,
      example_cn: w.exc || w.exampleCn || w.example_cn || null,
      order: startOrder + idx,
    }));

    // 过滤掉无效数据
    const validWords = wordsToInsert.filter(w => w.word && w.meaning);

    if (validWords.length === 0) {
      return NextResponse.json({ 
        error: 'No valid words to import' 
      }, { status: 400 });
    }

    // D1 不支持批量 INSERT，需要逐个插入
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

// GET - 获取某学期的单词列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');

    if (!semesterId) {
      return NextResponse.json({ 
        error: 'semesterId is required' 
      }, { status: 400 });
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

// DELETE - 删除某学期的所有单词
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');

    if (!semesterId) {
      return NextResponse.json({ 
        error: 'semesterId is required' 
      }, { status: 400 });
    }

    const db = getDB(request);

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
