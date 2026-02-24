'use client';

import { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface Semester {
  id: number;
  name: string;
  slug: string;
  wordCount?: number;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; isAdmin: boolean } | null>(null);
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'vocab' | 'users' | 'profile'>('vocab');
  const [users, setUsers] = useState<User[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [vocabJson, setVocabJson] = useState('');
  const [clearExisting, setClearExisting] = useState(false);
  
  // 编辑用户
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  
  // 创建新用户
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  
  // 修改当前管理员密码
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // 检查本地存储的登录状态
  useEffect(() => {
    const saved = localStorage.getItem('vocab_admin_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user.isAdmin) {
        setCurrentUser(user);
      }
    }
  }, []);

  // 加载用户列表和分类
  useEffect(() => {
    if (currentUser?.isAdmin) {
      loadUsers();
      loadSemesters();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      const res = await fetch(`/api/user?action=list&admin=${encodeURIComponent(currentUser!.username)}`);
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (e) {
      showMessage('error', '加载用户列表失败');
    }
  };

  const loadSemesters = async () => {
    try {
      const res = await fetch('/api/semesters');
      const data = await res.json();
      if (data.semesters) {
        const semestersWithCount = await Promise.all(
          data.semesters.map(async (s: Semester) => {
            try {
              const vocabRes = await fetch(`/api/vocab/${s.id}`);
              const vocabData = await vocabRes.json();
              return { ...s, wordCount: vocabData.words?.length || 0 };
            } catch {
              return { ...s, wordCount: 0 };
            }
          })
        );
        setSemesters(semestersWithCount);
      }
    } catch (e) {
      showMessage('error', '加载分类失败');
    }
  };

  const handleLogin = async () => {
    if (!inputUsername.trim()) {
      setLoginError('请输入用户名');
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: inputUsername.trim(), 
          password: inputPassword,
          action: 'login'
        }),
      });

      const data = await res.json();

      if (data.success && data.user.isAdmin) {
        setCurrentUser(data.user);
        localStorage.setItem('vocab_admin_user', JSON.stringify(data.user));
      } else if (data.success && !data.user.isAdmin) {
        setLoginError('您不是管理员，无法访问此页面');
      } else {
        setLoginError(data.error || '登录失败');
      }
    } catch (e) {
      setLoginError('网络错误');
    }

    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('vocab_admin_user');
    setCurrentUser(null);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ==================== 单词导入 ====================
  // ==================== 单词导入 ====================
  const handleImportVocab = async () => {
    if (!selectedSemester) {
      showMessage('error', '请选择分类');
      return;
    }

    // 逐行解析，精确定位错误
    const lines = vocabJson.trim().split('\n').filter(l => l.trim());
    const words: any[] = [];
    
    // 第一步：检查重复字段等常见问题
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // 检查重复字段
      const fieldMatches = line.match(/\b(w|p|m|ex|exc)\s*:/g);
      if (fieldMatches) {
        const fieldCounts: Record<string, number> = {};
        fieldMatches.forEach(f => {
          const fieldName = f.replace(/\s*:/, '').trim();
          fieldCounts[fieldName] = (fieldCounts[fieldName] || 0) + 1;
        });
        for (const [field, count] of Object.entries(fieldCounts)) {
          if (count > 1) {
            showMessage('error', '第 ' + lineNum + ' 行错误: 字段 "' + field + '" 重复出现\n\n' + line.trim());
            return;
          }
        }
      }
    }
    
    // 第二步：逐行解析
    const errors: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // 清理行尾逗号
      let cleanLine = line.trim().replace(/,\s*$/, '');
      
      // 跳过数组括号
      if (cleanLine === '[' || cleanLine === ']') continue;
      if (!cleanLine.startsWith('{')) continue;
      
      try {
        const obj = new Function('return ' + cleanLine)();
        if (obj && typeof obj === 'object') {
          words.push(obj);
        }
      } catch (e) {
        errors.push('第 ' + lineNum + ' 行: ' + (e as Error).message + '\n"' + line.trim().substring(0, 70) + '..."');
      }
    }
    
    if (errors.length > 0) {
      showMessage('error', '解析失败:\n\n' + errors.slice(0, 2).join('\n\n') + (errors.length > 2 ? '\n\n...还有 ' + (errors.length - 2) + ' 个错误' : ''));
      return;
    }

    if (words.length === 0) {
      showMessage('error', '没有找到有效的单词数据');
      return;
    }
    
    // 检查必填字段
    const invalidWords: string[] = [];
    words.forEach((w: any, idx: number) => {
      const word = w.w || w.word;
      const meaning = w.m || w.meaning;
      if (!word || !meaning) {
        invalidWords.push('第' + (idx + 1) + '个: ' + (word || '(缺少单词)'));
      }
    });
    
    if (invalidWords.length > 0) {
      showMessage('error', '缺少必填字段: ' + invalidWords.slice(0, 3).join(', ') + (invalidWords.length > 3 ? '...' : ''));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: currentUser!.username,
          semesterId: selectedSemester,
          words,
          clearExisting
        }),
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', `成功导入 ${data.imported} 个单词到 ${data.semester}`);
        setVocabJson('');
        loadSemesters();
      } else {
        showMessage('error', data.error || '导入失败');
      }
    } catch (e) {
      showMessage('error', '网络错误');
    }

    setLoading(false);
  };

  // ==================== 用户管理 ====================
  
  // 创建新用户
  const handleCreateUser = async () => {
    if (!newUsername.trim()) {
      showMessage('error', '请输入用户名');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword || undefined,
          isAdmin: newIsAdmin,
          createdByAdmin: currentUser!.username
        }),
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', `用户 "${newUsername}" 创建成功`);
        setNewUsername('');
        setNewPassword('');
        setNewIsAdmin(false);
        setShowCreateUser(false);
        loadUsers();
      } else {
        showMessage('error', data.error || '创建失败');
      }
    } catch (e) {
      showMessage('error', '网络错误');
    }

    setLoading(false);
  };

  // 更新用户
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setLoading(true);

    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: currentUser!.username,
          targetUserId: editingUser.id,
          newUsername: editUsername || undefined,
          newPassword: editPassword || undefined
        }),
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', '用户信息已更新');
        setEditingUser(null);
        setEditUsername('');
        setEditPassword('');
        loadUsers();
      } else {
        showMessage('error', data.error || '更新失败');
      }
    } catch (e) {
      showMessage('error', '网络错误');
    }

    setLoading(false);
  };

  // 删除用户
  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`确定删除用户 "${username}"？此操作不可恢复！`)) return;

    try {
      const res = await fetch(`/api/user?adminUsername=${encodeURIComponent(currentUser!.username)}&userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', '用户已删除');
        loadUsers();
      } else {
        showMessage('error', data.error || '删除失败');
      }
    } catch (e) {
      showMessage('error', '网络错误');
    }
  };

  // 删除分类单词
  const handleDeleteVocab = async (semesterId: number, semesterName: string) => {
    if (!confirm(`确定删除 "${semesterName}" 的所有单词？此操作不可恢复！`)) return;

    try {
      const res = await fetch(`/api/admin/vocab?adminUsername=${encodeURIComponent(currentUser!.username)}&semesterId=${semesterId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', '单词已删除');
        loadSemesters();
      } else {
        showMessage('error', data.error || '删除失败');
      }
    } catch (e) {
      showMessage('error', '网络错误');
    }
  };

  // ==================== 管理员修改密码 ====================
  const handleChangePassword = async () => {
    if (!currentPassword) {
      showMessage('error', '请输入当前密码');
      return;
    }
    if (!newAdminPassword) {
      showMessage('error', '请输入新密码');
      return;
    }
    if (newAdminPassword !== confirmPassword) {
      showMessage('error', '两次输入的密码不一致');
      return;
    }
    if (newAdminPassword.length < 4) {
      showMessage('error', '新密码至少需要4个字符');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser!.username,
          currentPassword,
          newPassword: newAdminPassword
        }),
      });

      const data = await res.json();

      if (data.success) {
        showMessage('success', '密码修改成功');
        setCurrentPassword('');
        setNewAdminPassword('');
        setConfirmPassword('');
      } else {
        showMessage('error', data.error || '修改失败');
      }
    } catch (e) {
      showMessage('error', '网络错误');
    }

    setLoading(false);
  };

  // ==================== 登录页面 ====================
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6">🔐 管理员登录</h1>
          
          <div className="space-y-4">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="用户名"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="密码"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}
            
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
          
          <p className="text-center text-gray-500 text-sm mt-6">
            <a href="/" className="text-blue-500 hover:underline">返回主页</a>
          </p>
        </div>
      </div>
    );
  }

  // ==================== 管理后台主界面 ====================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">⚙️ 管理后台</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">欢迎，<strong>{currentUser.username}</strong></span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-red-500 hover:bg-red-50 rounded"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`max-w-6xl mx-auto px-4 mt-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('vocab')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'vocab' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            📚 单词管理
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            👥 用户管理
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'profile' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔑 修改密码
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* ==================== 单词管理 ==================== */}
        {activeTab === 'vocab' && (
          <div className="space-y-6">
            {/* 分类列表 */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold mb-4">📁 现有分类</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {semesters.map(s => (
                  <div key={s.id} className="border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-lg">{s.name}</div>
                      <div className="text-sm text-gray-500">{s.wordCount || 0} 个单词</div>
                    </div>
                    <button
                      onClick={() => handleDeleteVocab(s.id, s.name)}
                      className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                    >
                      清空
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 导入单词 */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold mb-4">📥 导入单词</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">选择分类</label>
                  <select
                    value={selectedSemester || ''}
                    onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">-- 请选择分类 --</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">单词数据</label>
                  <textarea
                    value={vocabJson}
                    onChange={(e) => setVocabJson(e.target.value)}
                    placeholder={`字段说明：w=单词, p=音标, m=释义, ex=例句英文, exc=例句中文

格式示例（字段可不加引号）：
[
  { w: "after", p: "/ˈɑːftər/", m: "prep. 在…之后", ex: "We play football after school.", exc: "我们放学后踢足球。" },
  { w: "after school", p: "/'ɑ:ftə sku:l/", m: "phr. 放学后", ex: "I go home after school.", exc: "我放学后回家。" },
  { w: "age", p: "/eɪdʒ/", m: "n. 年龄", ex: "What is your age?", exc: "你多大了？" },
  { w: "always", p: "/ˈɔːlweɪz/", m: "adv. 总是", ex: "He is always late.", exc: "他总是迟到。" },
  { w: "centimetre", p: "/ˈsentɪmiːtər/", m: "n. 厘米", ex: "It is 10 centimetres long.", exc: "它有10厘米长。" }
]`}
                    className="w-full p-3 border rounded-lg h-64 font-mono text-sm"
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">清空该分类现有单词后导入</span>
                </label>

                <button
                  onClick={handleImportVocab}
                  disabled={loading}
                  className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '导入中...' : '🚀 开始导入'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 用户管理 ==================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* 创建用户按钮 */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">👥 用户列表</h2>
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  + 创建用户
                </button>
              </div>
              
              {users.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无用户数据</p>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-4 font-medium">ID</th>
                        <th className="text-left py-3 px-4 font-medium">用户名</th>
                        <th className="text-left py-3 px-4 font-medium">角色</th>
                        <th className="text-left py-3 px-4 font-medium">创建时间</th>
                        <th className="text-left py-3 px-4 font-medium">最后登录</th>
                        <th className="text-left py-3 px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{user.id}</td>
                          <td className="py-3 px-4 font-medium">{user.username}</td>
                          <td className="py-3 px-4">
                            {user.is_admin ? (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">管理员</span>
                            ) : (
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">普通用户</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditUsername(user.username);
                                  setEditPassword('');
                                }}
                                className="text-blue-500 hover:text-blue-700 text-sm"
                              >
                                编辑
                              </button>
                              {!user.is_admin && (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                  className="text-red-500 hover:text-red-700 text-sm"
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== 修改密码 ==================== */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow p-6 max-w-md mx-auto">
            <h2 className="text-lg font-bold mb-6">🔑 修改密码</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">当前密码</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="请输入当前密码"
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">新密码</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="请输入新密码"
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '修改中...' : '确认修改'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== 创建用户弹窗 ==================== */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">创建新用户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">用户名</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="请输入用户名（2-20字符）"
                  className="w-full p-3 border rounded-lg"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">密码（可选）</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="留空则无需密码登录"
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">设为管理员</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUsername('');
                  setNewPassword('');
                  setNewIsAdmin(false);
                }}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateUser}
                disabled={loading}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 编辑用户弹窗 ==================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">编辑用户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">用户名</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">新密码（留空不修改）</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="输入新密码以修改"
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingUser(null);
                  setEditUsername('');
                  setEditPassword('');
                }}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={loading}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
