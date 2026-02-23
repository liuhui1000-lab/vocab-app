import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST - 修改密码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, currentPassword, newPassword } = body;

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: '新密码至少需要4个字符' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取用户信息
    const { data: user, error: fetchError } = await client
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 验证当前密码
    if (user.password && user.password !== currentPassword) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 401 });
    }

    // 更新密码
    const { error: updateError } = await client
      .from('users')
      .update({ password: newPassword })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ error: '密码更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
