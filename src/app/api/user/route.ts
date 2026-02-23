import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET - 检查用户名是否存在 / 获取用户信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      exists: !!data,
      user: data 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - 创建新用户 / 登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // 验证用户名格式
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      return NextResponse.json({ 
        error: '用户名长度需要在2-20个字符之间' 
      }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmedUsername)) {
      return NextResponse.json({ 
        error: '用户名只能包含中文、字母、数字和下划线' 
      }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 检查用户是否已存在
    const { data: existingUser } = await client
      .from('users')
      .select('*')
      .eq('username', trimmedUsername)
      .single();

    if (existingUser) {
      // 用户已存在，更新最后登录时间
      const { data, error } = await client
        .from('users')
        .update({ 
          last_login_at: new Date().toISOString() 
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        user: data,
        isNew: false 
      });
    }

    // 创建新用户
    const { data, error } = await client
      .from('users')
      .insert({ 
        username: trimmedUsername,
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      // 检查是否是唯一约束冲突
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: '该用户名已被使用，请换一个' 
        }, { status: 409 });
      }
      console.error('Error creating user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      user: data,
      isNew: true 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
