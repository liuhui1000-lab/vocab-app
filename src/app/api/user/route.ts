import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET - 获取所有用户（仅管理员）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const action = searchParams.get('action');

    const client = getSupabaseClient();

    // 如果是检查用户名是否存在
    if (username && action !== 'list') {
      const { data, error } = await client
        .from('users')
        .select('id, username, is_admin, created_at, last_login_at')
        .eq('username', username)
        .single();

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        exists: !!data,
        user: data 
      });
    }

    // 列出所有用户（需要管理员权限）
    if (action === 'list') {
      const adminUsername = searchParams.get('admin');
      if (!adminUsername) {
        return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
      }

      // 验证管理员权限
      const { data: admin } = await client
        .from('users')
        .select('is_admin')
        .eq('username', adminUsername)
        .single();

      if (!admin?.is_admin) {
        return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
      }

      const { data, error } = await client
        .from('users')
        .select('id, username, is_admin, created_at, last_login_at')
        .order('id', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ users: data });
    }

    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - 登录/注册/管理员创建用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, action, isAdmin, createdByAdmin } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      return NextResponse.json({ error: '用户名长度需要在2-20个字符之间' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: '用户名只能包含中文、字母、数字和下划线' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 检查用户是否已存在
    const { data: existingUser } = await client
      .from('users')
      .select('*')
      .eq('username', trimmedUsername)
      .single();

    // 登录
    if (action === 'login') {
      if (!existingUser) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }

      // 验证密码（如果有设置）
      if (existingUser.password) {
        if (!password) {
          return NextResponse.json({ error: '请输入密码' }, { status: 400 });
        }
        if (password !== existingUser.password) {
          return NextResponse.json({ error: '密码错误' }, { status: 401 });
        }
      }

      // 更新最后登录时间
      await client
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', existingUser.id);

      return NextResponse.json({ 
        success: true, 
        user: {
          id: existingUser.id,
          username: existingUser.username,
          isAdmin: existingUser.is_admin
        },
        isNew: false 
      });
    }

    // 管理员创建用户
    if (createdByAdmin) {
      // 验证管理员权限
      const { data: adminUser } = await client
        .from('users')
        .select('is_admin')
        .eq('username', createdByAdmin)
        .single();

      if (!adminUser?.is_admin) {
        return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
      }

      if (existingUser) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }

      // 创建新用户（可设置管理员权限）
      const { data, error } = await client
        .from('users')
        .insert({ 
          username: trimmedUsername,
          password: password || null,
          is_admin: isAdmin || false,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        user: {
          id: data.id,
          username: data.username,
          isAdmin: data.is_admin
        },
        isNew: true 
      });
    }

    // 普通注册新用户
    if (existingUser) {
      return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
    }

    // 创建新用户
    const { data, error } = await client
      .from('users')
      .insert({ 
        username: trimmedUsername,
        password: password || null,
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: data.id,
        username: data.username,
        isAdmin: data.is_admin
      },
      isNew: true 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - 更新用户信息（管理员操作）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUsername, targetUserId, newUsername, newPassword } = body;

    if (!adminUsername || !targetUserId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 验证操作者权限
    const { data: operator } = await client
      .from('users')
      .select('id, is_admin')
      .eq('username', adminUsername)
      .single();

    if (!operator?.is_admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 构建更新数据
    const updateData: any = {};
    
    if (newUsername) {
      if (newUsername.length < 2 || newUsername.length > 20) {
        return NextResponse.json({ error: '用户名长度需要在2-20个字符之间' }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newUsername)) {
        return NextResponse.json({ error: '用户名只能包含中文、字母、数字和下划线' }, { status: 400 });
      }
      
      // 检查新用户名是否已存在
      const { data: existingUser } = await client
        .from('users')
        .select('id')
        .eq('username', newUsername)
        .single();

      if (existingUser && existingUser.id !== targetUserId) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }
      
      updateData.username = newUsername;
    }

    if (newPassword !== undefined) {
      updateData.password = newPassword || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有要更新的内容' }, { status: 400 });
    }

    // 执行更新
    const { error } = await client
      .from('users')
      .update(updateData)
      .eq('id', targetUserId);

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '用户信息已更新' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - 删除用户（管理员操作）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUsername = searchParams.get('adminUsername');
    const userId = searchParams.get('userId');

    if (!adminUsername || !userId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 验证管理员权限
    const { data: admin } = await client
      .from('users')
      .select('id, is_admin')
      .eq('username', adminUsername)
      .single();

    if (!admin?.is_admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 不能删除自己
    if (admin.id === parseInt(userId)) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 });
    }

    // 获取目标用户信息
    const { data: targetUser } = await client
      .from('users')
      .select('username, is_admin')
      .eq('id', parseInt(userId))
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 不能删除其他管理员
    if (targetUser.is_admin) {
      return NextResponse.json({ error: '不能删除其他管理员账户' }, { status: 403 });
    }

    // 删除用户进度
    await client
      .from('user_progress')
      .delete()
      .eq('username', targetUser.username);

    // 删除用户统计
    await client
      .from('study_stats')
      .delete()
      .eq('username', targetUser.username);

    // 删除用户
    const { error } = await client
      .from('users')
      .delete()
      .eq('id', parseInt(userId));

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
