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
  const [currentUser, setCurrentUser] = useState<{ username: string; isAdmin: boolean } | null>(null);
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'vocab' | 'users'>('vocab');
  const [users, setUsers] = useState<User[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [vocabJson, setVocabJson] = useState('');
  const [clearExisting, setClearExisting] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
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
    const res = await fetch(`/api/user?action=list&admin=${encodeURIComponent(currentUser!.username)}`);
    const data = await res.json();
    if (data.users) {
      setUsers(data.users);
    }
  };

  const loadSemesters = async () => {
    const res = await fetch('/api/semesters');
    const data = await res.json();
    if (data.semesters) {
      // 获取每个分类的单词数量
      const semestersWithCount = await Promise.all(
        data.semesters.map(async (s: Semester) => {
          const vocabRes = await fetch(`/api/vocab/${s.id}`);
          const vocabData = await vocabRes.json();
          return { ...s, wordCount: vocabData.words?.length || 0 };
        })
      );
      setSemesters(semestersWithCount);
    }
  };

  const handleLogin = async () => {
    if (!inputUsername.trim()) {
      setLoginError('请输入用户名');
      return;
    }

    setLoading(true);
    setLoginError('');

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

    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('vocab_admin_user');
    setCurrentUser(null);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 导入单词
  const handleImportVocab = async () => {
    if (!selectedSemester) {
      showMessage('error', '请选择分类');
      return;
    }

    let words;
    try {
      words = JSON.parse(vocabJson);
    } catch {
      showMessage('error', 'JSON格式错误');
      return;
    }

    setLoading(true);

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

    setLoading(false);
  };

  // 更新用户
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setLoading(true);

    const res = await fetch('/api/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminUsername: currentUser!.username,
        targetUserId: editingUser.id,
        newUsername: newUsername || undefined,
        newPassword: newPassword || undefined
      }),
    });

    const data = await res.json();

    if (data.success) {
      showMessage('success', '用户信息已更新');
      setEditingUser(null);
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    } else {
      showMessage('error', data.error || '更新失败');
    }

    setLoading(false);
  };

  // 删除用户
  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`确定删除用户 "${username}"？此操作不可恢复！`)) return;

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
  };

  // 删除分类单词
  const handleDeleteVocab = async (semesterId: number, semesterName: string) => {
    if (!confirm(`确定删除 "${semesterName}" 的所有单词？此操作不可恢复！`)) return;

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
  };

  // 登录页面
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">⚙️ 管理后台</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">欢迎，{currentUser.username}</span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-500"
            >
              退出
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
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('vocab')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'vocab' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
            }`}
          >
            📚 单词管理
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
            }`}
          >
            👥 用户管理
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'vocab' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">📚 单词导入</h2>
            
            {/* 分类列表 */}
            <div className="mb-6">
              <h3 className="font-medium mb-2">现有分类：</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {semesters.map(s => (
                  <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm text-gray-500">{s.wordCount || 0} 词</div>
                    </div>
                    <button
                      onClick={() => handleDeleteVocab(s.id, s.name)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      清空
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 导入表单 */}
            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">导入新单词：</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">选择分类</label>
                  <select
                    value={selectedSemester || ''}
                    onChange={(e) => setSelectedSemester(parseInt(e.target.value))}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">请选择分类</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">单词JSON数据</label>
                  <textarea
                    value={vocabJson}
                    onChange={(e) => setVocabJson(e.target.value)}
                    placeholder={`格式示例：
[
  {"w": "apple", "p": "/ˈæpl/", "m": "n. 苹果", "ex": "I eat an apple.", "exc": "我吃苹果。"},
  {"w": "book", "p": "/bʊk/", "m": "n. 书", "ex": "This is a book.", "exc": "这是一本书。"}
]`}
                    className="w-full p-3 border rounded-lg h-48 font-mono text-sm"
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">清空现有单词后导入</span>
                </label>

                <button
                  onClick={handleImportVocab}
                  disabled={loading}
                  className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '导入中...' : '导入单词'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">👥 用户管理</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">ID</th>
                    <th className="text-left py-2 px-3">用户名</th>
                    <th className="text-left py-2 px-3">角色</th>
                    <th className="text-left py-2 px-3">创建时间</th>
                    <th className="text-left py-2 px-3">最后登录</th>
                    <th className="text-left py-2 px-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{user.id}</td>
                      <td className="py-2 px-3 font-medium">{user.username}</td>
                      <td className="py-2 px-3">
                        {user.is_admin ? (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">管理员</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">普通用户</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-500">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setNewUsername(user.username);
                              setNewPassword('');
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
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">编辑用户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">用户名</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">新密码（留空不修改）</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  placeholder="输入新密码"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingUser(null);
                  setNewUsername('');
                  setNewPassword('');
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
