import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';

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

// POST - 新增单个单词
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminUsername, word, semesterId } = body;

    if (!adminUsername) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    if (!word || !word.word || !word.meaning || !semesterId) {
      return NextResponse.json({ 
        error: '缺少必填字段：word(单词), meaning(释义), semesterId(分类ID)' 
      }, { status: 400 });
    }

    const db = getDB();

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

    // 获取当前最大order
    const maxOrderResult = await db
      .prepare('SELECT MAX("order") as max_order FROM vocab_words WHERE semester_id = ?')
      .bind(semesterId)
      .first();
    
    const order = (maxOrderResult && (maxOrderResult as any).max_order !== null) 
      ? (maxOrderResult as any).max_order + 1 
      : 0;

    // 插入新单词
    const result = await db
      .prepare(`
        INSERT INTO vocab_words (semester_id, word, phonetic, meaning, example_en, example_cn, "order")
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .bind(
        semesterId,
        word.word,
        word.phonetic || null,
        word.meaning,
        word.example_en || word.exampleEn || null,
        word.example_cn || word.exampleCn || null,
        order
      )
      .first();

    return NextResponse.json({
      success: true,
      id: (result as any).id,
      message: '单词创建成功'
    });
  } catch (error) {
    console.error('Error creating word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - 更新单个单词
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { adminUsername, id, word } = body;

    if (!adminUsername) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    if (!id || !word) {
      return NextResponse.json({ error: '缺少 id 或 word 数据' }, { status: 400 });
    }

    const db = getDB();

    // 验证管理员权限
    const adminCheck = await checkAdmin(db, adminUsername);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // 检查单词是否存在
    const existing = await db
      .prepare('SELECT id FROM vocab_words WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return NextResponse.json({ error: '单词不存在' }, { status: 404 });
    }

    // 构建更新字段
    const updates: string[] = [];
    const values: any[] = [];

    if (word.word !== undefined) {
      updates.push('word = ?');
      values.push(word.word);
    }
    if (word.phonetic !== undefined) {
      updates.push('phonetic = ?');
      values.push(word.phonetic || null);
    }
    if (word.meaning !== undefined) {
      updates.push('meaning = ?');
      values.push(word.meaning);
    }
    if (word.example_en !== undefined || word.exampleEn !== undefined) {
      updates.push('example_en = ?');
      values.push(word.example_en || word.exampleEn || null);
    }
    if (word.example_cn !== undefined || word.exampleCn !== undefined) {
      updates.push('example_cn = ?');
      values.push(word.example_cn || word.exampleCn || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    // 执行更新
    await db
      .prepare(`UPDATE vocab_words SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return NextResponse.json({
      success: true,
      message: '单词更新成功'
    });
  } catch (error) {
    console.error('Error updating word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - 删除单个单词
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const adminUsername = searchParams.get('adminUsername');

    if (!adminUsername) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getDB();

    // 验证管理员权限
    const adminCheck = await checkAdmin(db, adminUsername);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // 先删除相关进度
    await db
      .prepare('DELETE FROM user_progress WHERE word_id = ?')
      .bind(parseInt(id))
      .run();

    // 再删除单词
    await db
      .prepare('DELETE FROM vocab_words WHERE id = ?')
      .bind(parseInt(id))
      .run();

    return NextResponse.json({ success: true, message: '单词已删除' });
  } catch (error) {
    console.error('Error deleting word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - 获取单个单词详情
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getDB();

    const word = await db
      .prepare('SELECT * FROM vocab_words WHERE id = ?')
      .bind(parseInt(id))
      .first();

    if (!word) {
      return NextResponse.json({ error: '单词不存在' }, { status: 404 });
    }

    return NextResponse.json({ word });
  } catch (error) {
    console.error('Error fetching word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
