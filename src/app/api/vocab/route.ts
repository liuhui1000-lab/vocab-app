import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST - 批量导入单词
// 格式: { semesterId: number, words: Array<{w, p, m, ex, exc}> }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { semesterId, words, clearExisting } = body;

    if (!semesterId || !words || !Array.isArray(words)) {
      return NextResponse.json({ 
        error: 'Invalid request body. Required: semesterId, words[]' 
      }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 验证学期是否存在
    const { data: semester } = await client
      .from('semesters')
      .select('id, name')
      .eq('id', semesterId)
      .single();

    if (!semester) {
      return NextResponse.json({ 
        error: 'Semester not found' 
      }, { status: 404 });
    }

    // 如果需要，清空现有单词
    if (clearExisting) {
      // 先删除相关进度
      await client
        .from('user_progress')
        .delete()
        .eq('semester_id', semesterId);
      
      // 再删除单词
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
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
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

// GET - 获取某学期的单词列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');

    if (!semesterId) {
      return NextResponse.json({ 
        error: 'semesterId is required' 
      }, { status: 400 });
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

// DELETE - 删除某学期的所有单词
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');

    if (!semesterId) {
      return NextResponse.json({ 
        error: 'semesterId is required' 
      }, { status: 400 });
    }

    const client = getSupabaseClient();

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
