import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';


// POST - 修改密码
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, currentPassword, newPassword } = body;

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: '新密码至少需要4个字符' }, { status: 400 });
    }

    const db = getDB();

    // 获取用户信息
    const user = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 验证当前密码
    if ((user as any).password && (user as any).password !== currentPassword) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 401 });
    }

    // 更新密码
    await db
      .prepare('UPDATE users SET password = ? WHERE id = ?')
      .bind(newPassword, (user as any).id)
      .run();

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
