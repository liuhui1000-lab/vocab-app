import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证管理员权限
async function checkAdmin(client: any, username: string): Promise<{ success: boolean; error?: string }> {
  const { data: user } = await client
    .from('users')
    .select('is_admin')
    .eq('username', username)
    .single();

  if (!user?.is_admin) {
    return { success: false, error: '需要管理员权限' };
  }
  return { success: true };
}

// POST - 批量导入单词（仅管理员）
export async function POST(request: NextRequest) {
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

    const client = getSupabaseClient();

    // 验证管理员权限
    const adminCheck = await checkAdmin(client, adminUsername);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // 验证学期是否存在
    const { data: semester } = await client
      .from('semesters')
      .select('id, name')
      .eq('id', semesterId)
      .single();

    if (!semester) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 如果需要，清空现有单词
    if (clearExisting) {
      await client
        .from('user_progress')
        .delete()
        .eq('semester_id', semesterId);
      
      await client
        .from('vocab_words')
        .delete()
        .eq('semester_id', semesterId);
    }

    // 获取当前最大order
    const { data: existingWords } = await client
      .from('vocab_words')
      .select('order')
      .eq('semester_id', semesterId)
      .order('order', { ascending: false })
      .limit(1);

    let startOrder = 0;
    if (existingWords && existingWords.length > 0) {
      startOrder = (existingWords[0].order || 0) + 1;
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

    // 批量插入（每次最多100条）
    const batchSize = 100;
    let insertedCount = 0;
    const errors = [];

    for (let i = 0; i < validWords.length; i += batchSize) {
      const batch = validWords.slice(i, i + batchSize);
      const { data, error } = await client
        .from('vocab_words')
        .insert(batch)
        .select();

      if (error) {
        errors.push(`批次 ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        insertedCount += data?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      semester: semester.name,
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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');
    const adminUsername = searchParams.get('adminUsername');

    if (!semesterId) {
      return NextResponse.json({ error: 'semesterId is required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('vocab_words')
      .select('*')
      .eq('semester_id', parseInt(semesterId))
      .order('order', { ascending: true });

    if (error) {
      console.error('Error fetching words:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ words: data, count: data?.length || 0 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - 删除某分类的所有单词（仅管理员）
export async function DELETE(request: NextRequest) {
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

    const client = getSupabaseClient();

    // 验证管理员权限
    const adminCheck = await checkAdmin(client, adminUsername);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // 先删除相关进度
    await client
      .from('user_progress')
      .delete()
      .eq('semester_id', parseInt(semesterId));

    // 再删除单词
    const { error } = await client
      .from('vocab_words')
      .delete()
      .eq('semester_id', parseInt(semesterId));

    if (error) {
      console.error('Error deleting words:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
