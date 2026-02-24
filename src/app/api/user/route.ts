import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';


// GET - 获取所有用户（仅管理员）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const action = searchParams.get('action');

    const db = getDB();

    // 如果是检查用户名是否存在
    if (username && action !== 'list') {
      const user = await db
        .prepare('SELECT id, username, is_admin, created_at, last_login_at FROM users WHERE username = ?')
        .bind(username)
        .first();

      return NextResponse.json({ 
        exists: !!user,
        user: user ? { ...user, is_admin: (user as any).is_admin === 1 } : null
      });
    }

    // 列出所有用户（需要管理员权限）
    if (action === 'list') {
      const adminUsername = searchParams.get('admin');
      if (!adminUsername) {
        return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
      }

      // 验证管理员权限
      const admin = await db
        .prepare('SELECT is_admin FROM users WHERE username = ?')
        .bind(adminUsername)
        .first();

      if (!admin || (admin as any).is_admin !== 1) {
        return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
      }

      const result = await db
        .prepare('SELECT id, username, is_admin, created_at, last_login_at FROM users ORDER BY id ASC')
        .all();

      return NextResponse.json({ 
        users: result.results.map(u => {
          const user = u as Record<string, unknown>;
          return {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin === 1,
            created_at: user.created_at,
            last_login_at: user.last_login_at
          };
        })
      });
    }

    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - 登录/注册/管理员创建用户
export async function POST(request: Request) {
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

    const db = getDB();

    // 检查用户是否已存在
    const existingUser = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(trimmedUsername)
      .first();

    // 登录
    if (action === 'login') {
      if (!existingUser) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }

      // 验证密码（如果有设置）
      if ((existingUser as any).password) {
        if (!password) {
          return NextResponse.json({ error: '请输入密码' }, { status: 400 });
        }
        if (password !== (existingUser as any).password) {
          return NextResponse.json({ error: '密码错误' }, { status: 401 });
        }
      }

      // 更新最后登录时间
      await db
        .prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?')
        .bind((existingUser as any).id)
        .run();

      return NextResponse.json({ 
        success: true, 
        user: {
          id: (existingUser as any).id,
          username: (existingUser as any).username,
          isAdmin: (existingUser as any).is_admin === 1
        },
        isNew: false 
      });
    }

    // 管理员创建用户
    if (createdByAdmin) {
      // 验证管理员权限
      const adminUser = await db
        .prepare('SELECT is_admin FROM users WHERE username = ?')
        .bind(createdByAdmin)
        .first();

      if (!adminUser || (adminUser as any).is_admin !== 1) {
        return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
      }

      if (existingUser) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }

      // 创建新用户（可设置管理员权限）
      const result = await db
        .prepare('INSERT INTO users (username, password, is_admin, last_login_at) VALUES (?, ?, ?, datetime("now")) RETURNING *')
        .bind(trimmedUsername, password || null, isAdmin ? 1 : 0)
        .first();

      return NextResponse.json({ 
        success: true, 
        user: {
          id: (result as any).id,
          username: (result as any).username,
          isAdmin: (result as any).is_admin === 1
        },
        isNew: true 
      });
    }

    // 普通注册新用户
    if (existingUser) {
      return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
    }

    // 创建新用户
    const result = await db
      .prepare('INSERT INTO users (username, password, last_login_at) VALUES (?, ?, datetime("now")) RETURNING *')
      .bind(trimmedUsername, password || null)
      .first();

    return NextResponse.json({ 
      success: true, 
      user: {
        id: (result as any).id,
        username: (result as any).username,
        isAdmin: false
      },
      isNew: true 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - 更新用户信息（管理员操作）
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { adminUsername, targetUserId, newUsername, newPassword, newIsAdmin } = body;

    if (!adminUsername || !targetUserId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const db = getDB();

    // 验证操作者权限
    const operator = await db
      .prepare('SELECT id, is_admin FROM users WHERE username = ?')
      .bind(adminUsername)
      .first();

    if (!operator || (operator as any).is_admin !== 1) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 构建更新数据
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (newUsername) {
      if (newUsername.length < 2 || newUsername.length > 20) {
        return NextResponse.json({ error: '用户名长度需要在2-20个字符之间' }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newUsername)) {
        return NextResponse.json({ error: '用户名只能包含中文、字母、数字和下划线' }, { status: 400 });
      }
      
      // 检查新用户名是否已存在
      const existingUser = await db
        .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
        .bind(newUsername, targetUserId)
        .first();
      
      if (existingUser) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }
      
      updates.push('username = ?');
      params.push(newUsername);
    }

    if (newPassword !== undefined) {
      updates.push('password = ?');
      params.push(newPassword || null);
    }

    if (newIsAdmin !== undefined) {
      updates.push('is_admin = ?');
      params.push(newIsAdmin ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '没有要更新的内容' }, { status: 400 });
    }

    params.push(targetUserId);

    await db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - 删除用户（管理员操作）
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUsername = searchParams.get('admin');
    const targetUserId = searchParams.get('userId');

    if (!adminUsername || !targetUserId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const db = getDB();

    // 验证操作者权限
    const operator = await db
      .prepare('SELECT id, is_admin FROM users WHERE username = ?')
      .bind(adminUsername)
      .first();

    if (!operator || (operator as any).is_admin !== 1) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 不能删除自己
    if ((operator as any).id === parseInt(targetUserId)) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 });
    }

    // 删除用户进度
    await db
      .prepare('DELETE FROM user_progress WHERE username = (SELECT username FROM users WHERE id = ?)')
      .bind(parseInt(targetUserId))
      .run();

    // 删除用户
    await db
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(parseInt(targetUserId))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
