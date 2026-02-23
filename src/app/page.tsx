'use client';

import { useState, useEffect, useCallback } from 'react';
import { shuffleArray, playWord, calculateNextReview, formatDate } from '@/lib/vocab-utils';
import type { Semester, VocabWord, UserProgress, WordWithProgress, SessionWord } from '@/lib/types';

// API helper functions
async function fetchSemesters() {
  const res = await fetch('/api/semesters');
  const data = await res.json();
  return data.semesters as Semester[];
}

async function fetchVocabWords(semesterId: number) {
  const res = await fetch(`/api/vocab/${semesterId}`);
  const data = await res.json();
  return data.words as VocabWord[];
}

async function fetchProgress(username: string, semesterIds: number[]) {
  const res = await fetch(`/api/progress?username=${encodeURIComponent(username)}&semesterIds=${semesterIds.join(',')}`);
  const data = await res.json();
  return data.progress as UserProgress[];
}

async function saveProgress(username: string, progress: any[]) {
  await fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, progress }),
  });
}

async function recordStat(username: string, semesterId: number, type: 'new' | 'review') {
  await fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username, 
      semesterId, 
      date: formatDate(new Date()), 
      type 
    }),
  });
}

async function initSampleData() {
  const res = await fetch('/api/init-data', { method: 'POST' });
  return res.json();
}

async function loginOrRegister(username: string): Promise<{ success: boolean; user?: any; error?: string; isNew?: boolean }> {
  try {
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: '网络错误' };
  }
}

export default function VocabApp() {
  // User state
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [inputUsername, setInputUsername] = useState('');

  // Data state
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterIds, setSelectedSemesterIds] = useState<number[]>([]);
  const [allWords, setAllWords] = useState<WordWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Learning session state
  const [currentView, setCurrentView] = useState<'setup' | 'study' | 'finish' | 'stats' | 'list'>('setup');
  const [sessionWords, setSessionWords] = useState<SessionWord[]>([]);
  const [queue, setQueue] = useState<SessionWord[]>([]);
  const [currentWord, setCurrentWord] = useState<SessionWord | null>(null);
  const [mode, setMode] = useState<'learn' | 'quiz' | 'spell'>('learn');
  const [options, setOptions] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionType, setSessionType] = useState<'normal' | 'extra'>('normal');
  const [dailyLimit, setDailyLimit] = useState(20);
  const [unsavedCount, setUnsavedCount] = useState(0);

  // 初始化 - 检查本地存储的用户名
  useEffect(() => {
    const savedUsername = localStorage.getItem('vocab_username');
    if (savedUsername) {
      // 验证用户名是否有效
      loginOrRegister(savedUsername).then(result => {
        if (result.success) {
          setUsername(savedUsername);
          setIsLoggedIn(true);
        } else {
          // 用户名无效，清除
          localStorage.removeItem('vocab_username');
        }
        setIsCheckingAuth(false);
      });
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  // 加载学期数据
  useEffect(() => {
    async function loadSemesters() {
      try {
        let semesterData = await fetchSemesters();
        
        if (!semesterData || semesterData.length === 0) {
          await initSampleData();
          semesterData = await fetchSemesters();
        }
        
        setSemesters(semesterData);
      } catch (error) {
        console.error('Load semesters error:', error);
      }
    }
    
    if (isLoggedIn) {
      loadSemesters();
    }
  }, [isLoggedIn]);

  // 加载保存的学期选择
  useEffect(() => {
    if (isLoggedIn && semesters.length > 0) {
      const savedSelection = localStorage.getItem(`vocab_selected_semesters_${username}`);
      if (savedSelection) {
        setSelectedSemesterIds(JSON.parse(savedSelection));
      }
    }
  }, [isLoggedIn, username, semesters]);

  // 加载单词和进度
  useEffect(() => {
    async function loadWords() {
      if (selectedSemesterIds.length === 0 || !username) {
        setAllWords([]);
        return;
      }

      setIsLoading(true);
      try {
        const wordsPromises = selectedSemesterIds.map(id => fetchVocabWords(id));
        const wordsArrays = await Promise.all(wordsPromises);
        const allWordsFlat = wordsArrays.flat();

        const progressData = await fetchProgress(username, selectedSemesterIds);
        const progressMap = new Map(progressData.map(p => [p.word_id, p]));

        const wordsWithProgress: WordWithProgress[] = allWordsFlat.map(w => ({
          ...w,
          progress: progressMap.get(w.id),
        }));

        setAllWords(wordsWithProgress);
      } catch (error) {
        console.error('Load words error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isLoggedIn && username) {
      loadWords();
    }
  }, [isLoggedIn, username, selectedSemesterIds]);

  // 保存学期选择
  useEffect(() => {
    if (username && selectedSemesterIds.length > 0) {
      localStorage.setItem(`vocab_selected_semesters_${username}`, JSON.stringify(selectedSemesterIds));
    }
  }, [username, selectedSemesterIds]);

  // 登录处理
  const handleLogin = async () => {
    if (!inputUsername.trim()) {
      setLoginError('请输入用户名');
      return;
    }

    setLoginError('');
    const result = await loginOrRegister(inputUsername.trim());
    
    if (result.success) {
      setUsername(inputUsername.trim());
      setIsLoggedIn(true);
      localStorage.setItem('vocab_username', inputUsername.trim());
    } else {
      setLoginError(result.error || '登录失败');
    }
  };

  // 退出登录
  const handleLogout = () => {
    if (confirm('确定退出登录？您的进度会保存在服务器上，下次登录可继续。')) {
      localStorage.removeItem('vocab_username');
      setUsername('');
      setIsLoggedIn(false);
      setSelectedSemesterIds([]);
      setAllWords([]);
    }
  };

  // Get dashboard stats
  const getStats = useCallback(() => {
    const now = new Date();
    const total = allWords.length;
    
    const newCount = allWords.filter(w => 
      !w.progress || w.progress.state === 'new'
    ).length;
    
    const reviewCount = allWords.filter(w => 
      w.progress && 
      w.progress.state !== 'new' && 
      w.progress.next_review && 
      new Date(w.progress.next_review) <= now
    ).length;
    
    const hardCount = allWords.filter(w => 
      w.progress && w.progress.failure_count > 3
    ).length;
    
    return { total, newCount, reviewCount, hardCount };
  }, [allWords]);

  const stats = getStats();

  // Start learning session
  const startSession = async (type: 'normal' | 'extra') => {
    if (allWords.length === 0) {
      alert('请先选择分类！');
      return;
    }

    setSessionType(type);
    const now = new Date();

    let selectedWords: WordWithProgress[] = [];
    
    if (type === 'normal') {
      const reviewWords = allWords.filter(w => 
        w.progress && 
        w.progress.state !== 'new' && 
        w.progress.next_review && 
        new Date(w.progress.next_review) <= now
      );
      
      const newWords = allWords.filter(w => !w.progress || w.progress.state === 'new')
        .slice(0, dailyLimit);
      
      selectedWords = [...reviewWords, ...newWords];
    } else {
      const learnedWords = allWords.filter(w => w.progress && w.progress.state !== 'new');
      selectedWords = shuffleArray(learnedWords).slice(0, 20);
    }

    if (selectedWords.length === 0) {
      alert('今日任务已完成！');
      return;
    }

    const session: SessionWord[] = shuffleArray(selectedWords).map(w => ({
      ...w,
      tempStep: 0,
      inPenalty: false,
      penaltyProgress: 0,
      isNewThisSession: !w.progress || w.progress.state === 'new',
    }));

    setSessionWords(session);
    setQueue(session.slice(0, 30));
    setCurrentView('study');
    nextCard(session, session.slice(0, 30));
  };

  // Next card logic
  const nextCard = (currentSessionWords: SessionWord[], currentQueue: SessionWord[]) => {
    const pending = currentQueue.filter(w => w.tempStep < 2);
    
    if (pending.length === 0) {
      const remaining = currentSessionWords.filter(w => w.tempStep < 2);
      if (remaining.length === 0) {
        finishSession();
        return;
      }
      const newQueue = remaining.slice(0, 30);
      setQueue(newQueue);
      nextCard(currentSessionWords, newQueue);
      return;
    }

    const candidates = pending.filter(w => w.id !== currentWord?.id);
    const next = candidates.length > 0 
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : pending[0];

    setCurrentWord(next);
    setShowAnswer(false);
    
    if (!next.progress || next.progress.state === 'new') {
      if (next.tempStep === 0) {
        setMode('learn');
      } else {
        setMode('quiz');
      }
    } else {
      if (next.tempStep === 0) {
        setMode('quiz');
      } else {
        setMode('spell');
      }
    }

    if (next.tempStep === 0 || next.tempStep === 1) {
      generateOptions(next);
    }
  };

  const generateOptions = (word: SessionWord) => {
    const correct = word.meaning;
    const others = allWords
      .filter(w => w.id !== word.id)
      .map(w => w.meaning);
    
    const shuffled = shuffleArray(others).slice(0, 3);
    setOptions(shuffleArray([correct, ...shuffled]));
  };

  const handleLearnNext = () => {
    if (!currentWord) return;
    
    const updatedSessionWords = sessionWords.map(w => 
      w.id === currentWord.id ? { ...w, tempStep: 1 } : w
    );
    setSessionWords(updatedSessionWords);
    setCurrentWord({ ...currentWord, tempStep: 1 });
    setMode('quiz');
    setShowAnswer(false);
  };

  const handleQuizAnswer = async (answer: string) => {
    if (!currentWord || showAnswer) return;
    
    const isCorrect = answer === currentWord.meaning;
    setShowAnswer(true);

    if (isCorrect) {
      playWord(currentWord.word);
      const updated = sessionWords.map(w => 
        w.id === currentWord.id ? { ...w, tempStep: 1.5 } : w
      );
      setSessionWords(updated);
      await updateWordState(currentWord, true);
    } else {
      const updated = sessionWords.map(w => 
        w.id === currentWord.id ? { 
          ...w, 
          tempStep: 0, 
          inPenalty: true, 
          penaltyProgress: 0 
        } : w
      );
      setSessionWords(updated);
      setCurrentWord({ ...currentWord, tempStep: 0, inPenalty: true, penaltyProgress: 0 });
      await updateWordState(currentWord, false);
    }
  };

  const handleSpellSubmit = async (input: string) => {
    if (!currentWord) return { correct: false };
    
    const isCorrect = input.trim().toLowerCase() === currentWord.word.toLowerCase();
    
    if (isCorrect) {
      playWord(currentWord.word);
      
      if (currentWord.inPenalty) {
        const newPenaltyProgress = currentWord.penaltyProgress + 1;
        if (newPenaltyProgress >= 3) {
          const updated = sessionWords.map(w => 
            w.id === currentWord.id ? { 
              ...w, 
              tempStep: 2, 
              inPenalty: false, 
              penaltyProgress: 0 
            } : w
          );
          setSessionWords(updated);
          await updateWordState(currentWord, true);
          await recordStat(username, currentWord.semester_id, 'review');
        } else {
          const updated = sessionWords.map(w => 
            w.id === currentWord.id ? { ...w, penaltyProgress: newPenaltyProgress } : w
          );
          setSessionWords(updated);
          setCurrentWord({ ...currentWord, penaltyProgress: newPenaltyProgress });
        }
      } else {
        const updated = sessionWords.map(w => 
          w.id === currentWord.id ? { ...w, tempStep: 2 } : w
        );
        setSessionWords(updated);
        await updateWordState(currentWord, true);
        await recordStat(username, currentWord.semester_id, currentWord.isNewThisSession ? 'new' : 'review');
      }
      
      return { correct: true };
    } else {
      const updated = sessionWords.map(w => 
        w.id === currentWord.id ? { 
          ...w, 
          tempStep: 0, 
          inPenalty: true, 
          penaltyProgress: 0 
        } : w
      );
      setSessionWords(updated);
      setCurrentWord({ ...currentWord, tempStep: 0, inPenalty: true, penaltyProgress: 0 });
      await updateWordState(currentWord, false);
      
      return { correct: false };
    }
  };

  const updateWordState = async (word: SessionWord, success: boolean) => {
    const currentEf = word.progress?.ef ?? 25;
    const currentInterval = word.progress?.interval ?? 0;
    
    const { ef, interval, nextReview } = calculateNextReview(success, currentEf, currentInterval);
    
    const progressUpdate = {
      wordId: word.id,
      semesterId: word.semester_id,
      state: success ? 'review' : 'learning',
      nextReview: nextReview.toISOString(),
      ef,
      interval,
      failureCount: success ? (word.progress?.failure_count ?? 0) : (word.progress?.failure_count ?? 0) + 1,
      penaltyProgress: 0,
      inPenalty: !success,
    };

    setUnsavedCount(c => c + 1);
    
    if (unsavedCount >= 4) {
      await saveProgress(username, [progressUpdate]);
      setUnsavedCount(0);
    }
  };

  const finishSession = async () => {
    if (unsavedCount > 0) {
      const progressToSave = sessionWords.map(w => ({
        wordId: w.id,
        semesterId: w.semester_id,
        state: w.progress?.state ?? 'new',
        nextReview: w.progress?.next_review,
        ef: w.progress?.ef ?? 25,
        interval: w.progress?.interval ?? 0,
        failureCount: w.progress?.failure_count ?? 0,
        penaltyProgress: 0,
        inPenalty: false,
      }));
      await saveProgress(username, progressToSave);
      setUnsavedCount(0);
    }

    if (selectedSemesterIds.length > 0) {
      const progressData = await fetchProgress(username, selectedSemesterIds);
      const progressMap = new Map(progressData.map(p => [p.word_id, p]));
      const wordsWithProgress = allWords.map(w => ({
        ...w,
        progress: progressMap.get(w.id),
      }));
      setAllWords(wordsWithProgress);
    }

    setCurrentView('finish');
  };

  const handleNext = () => {
    nextCard(sessionWords, queue);
  };

  const toggleSemester = (id: number) => {
    setSelectedSemesterIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id].sort((a, b) => a - b)
    );
  };

  // 检查登录状态
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 登录页面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">📚</div>
            <h1 className="text-2xl font-bold text-gray-800">中考词汇通</h1>
            <p className="text-gray-500 mt-2">选择学期 · 智能复习</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">设置用户名</h2>
            <p className="text-sm text-gray-500 mb-4">
              输入用户名即可保存学习进度，换设备登录可继续学习
            </p>
            
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="请输入用户名（2-20字符）"
              className="w-full p-4 border-2 rounded-xl text-center text-lg focus:border-blue-500 outline-none"
              maxLength={20}
              autoFocus
            />
            
            {loginError && (
              <p className="text-red-500 text-sm mt-2 text-center">{loginError}</p>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full mt-4 py-4 bg-blue-500 text-white rounded-xl font-semibold text-lg hover:bg-blue-600 active:scale-98"
            >
              开始使用
            </button>
            
            <p className="text-xs text-gray-400 mt-4 text-center">
              支持：中文、字母、数字、下划线
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Setup view
  if (currentView === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="max-w-lg mx-auto">
          {/* Header with user info */}
          <div className="text-center py-6">
            <h1 className="text-3xl font-bold text-blue-600">📚 中考词汇通</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-gray-500 text-sm">用户：{username}</span>
              <button 
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                [退出]
              </button>
            </div>
          </div>

          {/* Dashboard */}
          {selectedSemesterIds.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-gray-500">📚 总量</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-500">{stats.newCount}</div>
                  <div className="text-xs text-gray-500">📖 待学习</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-500">{stats.reviewCount}</div>
                  <div className="text-xs text-gray-500">⏰ 待复习</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-500">{stats.hardCount}</div>
                  <div className="text-xs text-gray-500">💀 困难</div>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="text-center py-4 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-sm">加载中...</p>
            </div>
          )}

          {/* Semester selection */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
            <h2 className="font-semibold text-gray-700 mb-4">选择分类</h2>
            <div className="space-y-2">
              {semesters.map(semester => (
                <label 
                  key={semester.id}
                  className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                    selectedSemesterIds.includes(semester.id)
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSemesterIds.includes(semester.id)}
                    onChange={() => toggleSemester(semester.id)}
                    className="w-5 h-5 rounded text-blue-500"
                  />
                  <span className="ml-3 flex-1">
                    <span className="font-medium">{semester.name}</span>
                  </span>
                  <span className="text-sm text-gray-400">
                    {allWords.filter(w => w.semester_id === semester.id).length || 0} 词
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Daily limit */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">🎯 每日新词</span>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 20)}
                className="w-20 text-center border rounded-lg p-2"
                min="1"
                max="100"
              />
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => startSession('normal')}
            disabled={selectedSemesterIds.length === 0}
            className={`w-full py-4 rounded-2xl text-white font-semibold text-lg shadow-lg transition-all ${
              selectedSemesterIds.length > 0
                ? 'bg-blue-500 hover:bg-blue-600 active:scale-98'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            🚀 开始学习
          </button>

          {/* Secondary actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setCurrentView('stats')}
              className="flex-1 py-3 bg-gray-100 rounded-xl text-gray-600 font-medium hover:bg-gray-200"
            >
              📊 统计
            </button>
            <button
              onClick={() => setCurrentView('list')}
              className="flex-1 py-3 bg-gray-100 rounded-xl text-gray-600 font-medium hover:bg-gray-200"
            >
              📖 词表
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Study view
  if (currentView === 'study' && currentWord) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            onClick={() => {
              if (confirm('确定退出学习？进度会自动保存。')) {
                finishSession();
              }
            }}
            className="text-gray-500"
          >
            ✕ 退出
          </button>
          <span className="text-sm text-gray-500">
            {sessionWords.filter(w => w.tempStep === 2).length} / {sessionWords.length}
          </span>
          <span className={`text-sm ${unsavedCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            {unsavedCount > 0 ? `+${unsavedCount} 未存` : '已同步'}
          </span>
        </div>

        {/* Penalty badge */}
        {currentWord.inPenalty && (
          <div className="bg-orange-50 text-orange-600 text-center py-1 text-sm font-medium">
            🔥 强化中 ({currentWord.penaltyProgress}/3)
          </div>
        )}

        {/* Card area */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="bg-white rounded-2xl shadow-sm p-6 flex-1 flex flex-col items-center justify-center">
            {/* Word display */}
            {mode === 'spell' ? (
              <div className="text-center">
                <div className="text-xl text-gray-700 mb-4">{currentWord.meaning}</div>
              </div>
            ) : (
              <>
                <div className="text-4xl font-bold text-gray-800 mb-2">{currentWord.word}</div>
                {currentWord.phonetic && (
                  <button
                    onClick={() => playWord(currentWord.word)}
                    className="flex items-center gap-1 bg-gray-100 px-4 py-2 rounded-full text-gray-600 hover:bg-gray-200"
                  >
                    <span>{currentWord.phonetic}</span>
                    <span>🔊</span>
                  </button>
                )}
              </>
            )}

            {/* Meaning (learn mode) */}
            {mode === 'learn' && (
              <div className="mt-6 text-center">
                <div className="text-xl text-gray-700">{currentWord.meaning}</div>
                {currentWord.example_en && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl text-left w-full">
                    <div className="text-gray-800">{currentWord.example_en}</div>
                    {currentWord.example_cn && (
                      <div className="text-gray-500 text-sm mt-1">{currentWord.example_cn}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Spell input */}
            {mode === 'spell' && (
              <div className="w-full mt-4">
                <input
                  id="spell-input"
                  type="text"
                  placeholder="输入单词"
                  className="w-full text-center text-2xl p-4 border-2 rounded-xl focus:border-blue-500 outline-none"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const result = await handleSpellSubmit((e.target as HTMLInputElement).value);
                      if (result.correct) {
                        setTimeout(handleNext, 500);
                      }
                    }
                  }}
                />
                {currentWord.inPenalty && !showAnswer && (
                  <div className="mt-2 text-center text-gray-400">
                    提示: {currentWord.word[0]}_{currentWord.word.slice(-1)}
                  </div>
                )}
                {showAnswer && (
                  <div className="mt-2 text-center text-red-500 font-medium">
                    正确答案: {currentWord.word}
                  </div>
                )}
              </div>
            )}

            {/* Quiz options */}
            {mode === 'quiz' && !showAnswer && (
              <div className="w-full mt-6 space-y-3">
                {options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuizAnswer(opt)}
                    className="w-full p-4 text-left bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border-2 border-transparent"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Quiz result */}
            {mode === 'quiz' && showAnswer && (
              <div className="mt-6 text-center">
                <div className="text-gray-700 mb-4">
                  {currentWord.meaning}
                </div>
                {currentWord.example_en && (
                  <div className="p-4 bg-blue-50 rounded-xl text-left w-full">
                    <div className="text-gray-800">{currentWord.example_en}</div>
                    {currentWord.example_cn && (
                      <div className="text-gray-500 text-sm mt-1">{currentWord.example_cn}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="mt-4">
            {mode === 'learn' && (
              <button
                onClick={handleLearnNext}
                className="w-full py-4 bg-blue-500 text-white rounded-2xl font-semibold text-lg"
              >
                记住了，去测试 →
              </button>
            )}
            {mode === 'quiz' && showAnswer && (
              <button
                onClick={handleNext}
                className="w-full py-4 bg-blue-500 text-white rounded-2xl font-semibold text-lg"
              >
                下一题 →
              </button>
            )}
            {mode === 'spell' && showAnswer && (
              <button
                onClick={() => {
                  setShowAnswer(false);
                  const input = document.getElementById('spell-input') as HTMLInputElement;
                  if (input) input.value = '';
                }}
                className="w-full py-4 bg-blue-500 text-white rounded-2xl font-semibold text-lg"
              >
                再试一次 →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Finish view
  if (currentView === 'finish') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">任务完成！</h2>
          <p className="text-gray-600 mb-8">
            {sessionType === 'extra' 
              ? `本次巩固 ${sessionWords.length} 个单词`
              : `今日完成 ${sessionWords.length} 个单词`
            }
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => setCurrentView('setup')}
              className="w-full py-4 bg-blue-500 text-white rounded-2xl font-semibold text-lg"
            >
              返回主页
            </button>
            <button
              onClick={() => startSession('extra')}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold"
            >
              🔄 再复习 20 个
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stats view
  if (currentView === 'stats') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">📊 学习统计</h1>
            <button
              onClick={() => setCurrentView('setup')}
              className="text-gray-500"
            >
              ✕
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📈</div>
              <p>统计功能开发中...</p>
              <p className="text-sm mt-2">将在下次更新中提供详细的学习统计</p>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('setup')}
            className="w-full mt-4 py-4 bg-gray-100 rounded-2xl font-medium"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  // Word list view
  if (currentView === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">📖 单词列表</h1>
            <button
              onClick={() => setCurrentView('setup')}
              className="text-gray-500"
            >
              ✕
            </button>
          </div>

          {allWords.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center py-8 text-gray-500">
              请先选择分类
            </div>
          ) : (
            <div className="space-y-2">
              {allWords.map(word => (
                <div
                  key={word.id}
                  onClick={() => playWord(word.word)}
                  className="bg-white rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    !word.progress ? 'bg-gray-300' :
                    word.progress.state === 'review' ? 'bg-green-500' :
                    word.progress.failure_count > 3 ? 'bg-red-500' : 'bg-orange-500'
                  }`} />
                  <span className="font-medium flex-1">{word.word}</span>
                  <span className="text-gray-500 text-sm truncate max-w-[200px]">{word.meaning}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setCurrentView('setup')}
            className="w-full mt-4 py-4 bg-gray-100 rounded-2xl font-medium"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return null;
}
