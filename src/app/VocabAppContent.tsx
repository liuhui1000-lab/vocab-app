import { useState, useEffect, useCallback, useRef } from 'react';
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

async function loginOrRegister(username: string, password?: string): Promise<{ success: boolean; user?: any; error?: string; isNew?: boolean }> {
  try {
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        password: password || '',
        action: 'login' 
      }),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: '网络错误' };
  }
}

export function VocabAppContent() {
  // User state
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');

  // Data state
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterIds, setSelectedSemesterIds] = useState<number[]>([]);
  const [allWords, setAllWords] = useState<WordWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Learning session state
  const [currentView, setCurrentView] = useState<'setup' | 'study' | 'finish' | 'stats' | 'list' | 'hard'>('setup');
  const [sessionWords, setSessionWords] = useState<SessionWord[]>([]);
  const sessionWordsRef = useRef<SessionWord[]>([]);
  const [queue, setQueue] = useState<SessionWord[]>([]);
  const queueRef = useRef<SessionWord[]>([]);
  const [currentWord, setCurrentWord] = useState<SessionWord | null>(null);
  const currentWordRef = useRef<SessionWord | null>(null);  // 添加 currentWord ref
  const [mode, setMode] = useState<'learn' | 'quiz' | 'spell'>('learn');
  const [options, setOptions] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionType, setSessionType] = useState<'normal' | 'extra'>('normal');
  const [dailyLimit, setDailyLimit] = useState(20);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [spellResult, setSpellResult] = useState<{ correct: boolean; needMore?: number; completed?: boolean } | null>(null);

  // 同步 ref
  useEffect(() => {
    sessionWordsRef.current = sessionWords;
  }, [sessionWords]);
  
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  
  useEffect(() => {
    currentWordRef.current = currentWord;
  }, [currentWord]);

  // 初始化 - 检查本地存储的用户名
  useEffect(() => {
    const savedUsername = localStorage.getItem('vocab_username');
    if (savedUsername) {
      // 仅验证用户名存在，实际登录在 handleLogin 时进行
      setUsername(savedUsername);
      setIsLoggedIn(true);
    }
    setIsCheckingAuth(false);
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
    const result = await loginOrRegister(inputUsername.trim(), inputPassword);
    
    if (result.success) {
      setUsername(inputUsername.trim());
      setIsLoggedIn(true);
      localStorage.setItem('vocab_username', inputUsername.trim());
      // 如果是管理员，存储管理员标识
      if (result.user?.isAdmin) {
        localStorage.setItem('vocab_is_admin', 'true');
      }
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

    // Per-category stats
    const categoryStats = semesters
      .filter(s => selectedSemesterIds.includes(s.id))
      .map(s => {
        const categoryWords = allWords.filter(w => w.semester_id === s.id);
        return {
          id: s.id,
          name: s.name,
          total: categoryWords.length,
          newCount: categoryWords.filter(w => !w.progress || w.progress.state === 'new').length,
          reviewCount: categoryWords.filter(w => 
            w.progress && 
            w.progress.state !== 'new' && 
            w.progress.next_review && 
            new Date(w.progress.next_review) <= now
          ).length,
          hardCount: categoryWords.filter(w => w.progress && w.progress.failure_count > 3).length,
        };
      });
    
    return { total, newCount, reviewCount, hardCount, categoryStats };
  }, [allWords, semesters, selectedSemesterIds]);

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

    const initialQueue = session.slice(0, 30);
    setSessionWords(session);
    sessionWordsRef.current = session;  // 同步更新 ref
    setQueue(initialQueue);
    queueRef.current = initialQueue;  // 同步更新 ref
    setCurrentView('study');
    nextCard(session, initialQueue);
  };

  // Next card logic - 完全沿用HTML逻辑
  // tempStep: 0=初始, 1=已学习, 1.5=已通过选择题, 2=完成
  const nextCard = (currentSessionWords: SessionWord[], currentQueue: SessionWord[], waiting: boolean = false) => {
    // 如果正在等待状态，不重置
    if (!waiting) {
      setShowAnswer(false);
      setSpellResult(null);
    }
    
    const pending = currentQueue.filter(w => w.tempStep < 2);
    
    if (pending.length === 0) {
      const remaining = currentSessionWords.filter(w => w.tempStep < 2);
      if (remaining.length === 0) {
        finishSession();
        return;
      }
      const newQueue = remaining.slice(0, 30);
      setQueue(newQueue);
      queueRef.current = newQueue;
      nextCard(currentSessionWords, newQueue);
      return;
    }

    // 避免连续出现同一个单词
    const currentWordId = currentWordRef.current?.id;
    const candidates = pending.filter(w => w.id !== currentWordId);
    const next = candidates.length > 0 
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : pending[0];

    setCurrentWord(next);
    currentWordRef.current = next;
    setShowAnswer(false);
    setSpellResult(null);
    
    // 模式判断逻辑（完全沿用HTML）
    // HTML: if (w.state === 'new' && w.tempStep === 0) this.modeLearn();
    //       else if ((w.state === 'new' && w.tempStep === 1) || (w.state !== 'new' && w.tempStep === 0)) this.modeQuiz();
    //       else this.modeSpell();
    // 注意：HTML中的 state 是持久状态（'new'/'learning'/'review'），React中对应 progress?.state
    const wordState = next.progress?.state;  // undefined = 从未学习过，相当于 'new'
    const isNewWord = !wordState || wordState === 'new';  // 相当于 HTML 中的 state === 'new'
    
    let newMode: 'learn' | 'quiz' | 'spell';
    if (isNewWord && next.tempStep === 0) {
      // 新单词第一次：学习模式
      newMode = 'learn';
    } else if ((isNewWord && next.tempStep === 1) || (!isNewWord && next.tempStep === 0)) {
      // 新单词第二次 或 已学单词第一次：选择题模式
      newMode = 'quiz';
    } else {
      // 其他情况：默写模式
      newMode = 'spell';
    }
    
    setMode(newMode);

    // 生成选择题选项
    if (newMode === 'quiz') {
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

  // 学习模式下一步 - 完全沿用HTML逻辑
  const handleLearnNext = () => {
    if (!currentWord) return;
    
    // HTML: this.currentCard.tempStep = 1; this.nextCard();
    const currentSessionWords = sessionWordsRef.current;
    const currentQueue = queueRef.current;
    
    const updatedSessionWords = currentSessionWords.map(w => 
      w.id === currentWord.id ? { ...w, tempStep: 1 } : w
    );
    setSessionWords(updatedSessionWords);
    sessionWordsRef.current = updatedSessionWords;
    
    // 更新 queue 中的 tempStep
    const updatedQueue = currentQueue.map(w =>
      w.id === currentWord.id ? { ...w, tempStep: 1 } : w
    );
    setQueue(updatedQueue);
    queueRef.current = updatedQueue;
    
    nextCard(updatedSessionWords, updatedQueue);
  };

  // 选择题答案处理 - 完全沿用HTML逻辑
  const handleQuizAnswer = async (answer: string) => {
    if (!currentWord || showAnswer) return;
    
    const isCorrect = answer === currentWord.meaning;
    setShowAnswer(true);

    if (isCorrect) {
      // HTML: this.currentCard.tempStep = 1.5; 
      playWord(currentWord.word);
      
      const currentSessionWords = sessionWordsRef.current;
      const currentQueue = queueRef.current;
      
      const updated = currentSessionWords.map(w => 
        w.id === currentWord.id ? { ...w, tempStep: 1.5 } : w
      );
      setSessionWords(updated);
      sessionWordsRef.current = updated;
      
      const updatedQueue = currentQueue.map(w =>
        w.id === currentWord.id ? { ...w, tempStep: 1.5 } : w
      );
      setQueue(updatedQueue);
      queueRef.current = updatedQueue;
      
      setCurrentWord({ ...currentWord, tempStep: 1.5 });
      // HTML: waiting = true，等待点击"下一题"
    } else {
      // HTML: this.currentCard.inPenalty = true; this.currentCard.penaltyProgress = 0;
      //       this.currentCard.tempStep = 0; this.updateState(false);
      const currentSessionWords = sessionWordsRef.current;
      const currentQueue = queueRef.current;
      
      const updated = currentSessionWords.map(w => 
        w.id === currentWord.id ? { 
          ...w, 
          tempStep: 0, 
          inPenalty: true, 
          penaltyProgress: 0 
        } : w
      );
      setSessionWords(updated);
      sessionWordsRef.current = updated;
      
      const updatedQueue = currentQueue.map(w =>
        w.id === currentWord.id ? { ...w, tempStep: 0, inPenalty: true, penaltyProgress: 0 } : w
      );
      setQueue(updatedQueue);
      queueRef.current = updatedQueue;
      
      setCurrentWord({ ...currentWord, tempStep: 0, inPenalty: true, penaltyProgress: 0 });
      await updateWordState(currentWord, false);
    }
  };

  // 默写检查 - 完全沿用HTML的checkSpelling逻辑
  // 返回更新后的 sessionWords 供 handleNext 使用
  const handleSpellSubmit = async (input: string): Promise<{ 
    correct: boolean; 
    needMore?: number; 
    completed?: boolean;
    updatedSessionWords?: SessionWord[];
  }> => {
    if (!currentWord || spellResult?.correct) return { correct: false };
    
    const currentSessionWords = sessionWordsRef.current;
    const currentQueue = queueRef.current;
    const isCorrect = input.trim().toLowerCase() === currentWord.word.toLowerCase();
    
    if (isCorrect) {
      // 播放发音
      playWord(currentWord.word);
      
      if (currentWord.inPenalty) {
        // 惩罚模式：需要连续3次正确
        const newPenaltyProgress = currentWord.penaltyProgress + 1;
        if (newPenaltyProgress >= 3) {
          // HTML: this.currentCard.tempStep = 2; this.currentCard.inPenalty = false;
          //       this.currentCard.penaltyProgress = 0; this.recordProgress('review');
          const updated = currentSessionWords.map(w => 
            w.id === currentWord.id ? { 
              ...w, 
              tempStep: 2, 
              inPenalty: false, 
              penaltyProgress: 0 
            } : w
          );
          setSessionWords(updated);
          sessionWordsRef.current = updated;
          
          const updatedQueue = currentQueue.map(w =>
            w.id === currentWord.id ? { ...w, tempStep: 2, inPenalty: false, penaltyProgress: 0 } : w
          );
          setQueue(updatedQueue);
          queueRef.current = updatedQueue;
          
          setCurrentWord({ ...currentWord, tempStep: 2, inPenalty: false, penaltyProgress: 0 });
          setSpellResult({ correct: true, completed: true });
          await updateWordState(currentWord, true);
          await recordStat(username, currentWord.semester_id, 'review');
          return { correct: true, completed: true, updatedSessionWords: updated };
        } else {
          // HTML: document.getElementById('next-btn').textContent = `正确！还需 ${3 - this.currentCard.penaltyProgress} 次巩固 →`;
          //       this.unsavedChanges++;
          const updated = currentSessionWords.map(w => 
            w.id === currentWord.id ? { ...w, penaltyProgress: newPenaltyProgress } : w
          );
          setSessionWords(updated);
          sessionWordsRef.current = updated;
          
          const updatedQueue = currentQueue.map(w =>
            w.id === currentWord.id ? { ...w, penaltyProgress: newPenaltyProgress } : w
          );
          setQueue(updatedQueue);
          queueRef.current = updatedQueue;
          
          setCurrentWord({ ...currentWord, penaltyProgress: newPenaltyProgress });
          setSpellResult({ correct: true, needMore: 3 - newPenaltyProgress });
          // 不更新进度，继续下一个单词
          return { correct: true, needMore: 3 - newPenaltyProgress, updatedSessionWords: updated };
        }
      } else {
        // 正常模式：默写正确，完成！
        // HTML: this.currentCard.tempStep = 2; this.recordProgress(type); this.updateState(true);
        const updated = currentSessionWords.map(w => 
          w.id === currentWord.id ? { ...w, tempStep: 2 } : w
        );
        setSessionWords(updated);
        sessionWordsRef.current = updated;
        
        const updatedQueue = currentQueue.map(w =>
          w.id === currentWord.id ? { ...w, tempStep: 2 } : w
        );
        setQueue(updatedQueue);
        queueRef.current = updatedQueue;
        
        setCurrentWord({ ...currentWord, tempStep: 2 });
        setSpellResult({ correct: true, completed: true });
        await updateWordState(currentWord, true);
        await recordStat(username, currentWord.semester_id, currentWord.isNewThisSession ? 'new' : 'review');
        return { correct: true, completed: true, updatedSessionWords: updated };
      }
    } else {
      // 默写错误：进入惩罚模式
      // HTML: this.currentCard.inPenalty = true; this.currentCard.penaltyProgress = 0;
      //       this.currentCard.tempStep = 0; this.updateState(false);
      const updated = currentSessionWords.map(w => 
        w.id === currentWord.id ? { 
          ...w, 
          tempStep: 0, 
          inPenalty: true, 
          penaltyProgress: 0 
        } : w
      );
      setSessionWords(updated);
      sessionWordsRef.current = updated;
      
      const updatedQueue = currentQueue.map(w =>
        w.id === currentWord.id ? { ...w, tempStep: 0, inPenalty: true, penaltyProgress: 0 } : w
      );
      setQueue(updatedQueue);
      queueRef.current = updatedQueue;
      
      setCurrentWord({ ...currentWord, tempStep: 0, inPenalty: true, penaltyProgress: 0 });
      setSpellResult({ correct: false });
      await updateWordState(currentWord, false);
      return { correct: false, updatedSessionWords: updated };
    }
  };

  const updateWordState = async (word: SessionWord, success: boolean) => {
    const currentEf = word.progress?.ef ?? 25;
    const currentInterval = word.progress?.interval ?? 0;
    
    const { ef, interval, nextReview } = calculateNextReview(success, currentEf, currentInterval);
    
    // HTML: w.state = success ? 'review' : 'learning'
    const newState = success ? 'review' : 'learning' as 'review' | 'learning';
    
    const progressUpdate = {
      wordId: word.id,
      semesterId: word.semester_id,
      state: newState,
      nextReview: nextReview.toISOString(),
      ef,
      interval,
      failureCount: success ? (word.progress?.failure_count ?? 0) : (word.progress?.failure_count ?? 0) + 1,
      penaltyProgress: 0,
      inPenalty: !success,
    };

    setUnsavedCount(c => c + 1);
    
    // 更新本地 sessionWords 中的 progress.state，确保 nextCard 能正确判断
    setSessionWords(prev => {
      const updated = prev.map(w => {
        if (w.id === word.id) {
          return {
            ...w,
            progress: w.progress ? { ...w.progress, state: newState } : undefined,
          };
        }
        return w;
      });
      sessionWordsRef.current = updated;  // 同步更新 ref
      return updated;
    });
    
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

  // handleNext - 完全沿用HTML逻辑
  const handleNext = () => {
    // 使用 ref 获取最新值
    const currentSessionWords = sessionWordsRef.current;
    const currentQueue = queueRef.current;
    
    // HTML: if (this.currentMode === 'learn') { this.currentCard.tempStep = 1; this.nextCard(); }
    if (mode === 'learn') {
      handleLearnNext();
    }
    // HTML: else if (this.currentMode === 'spell') { this.waiting ? this.nextCard() : this.checkSpelling(); }
    else if (mode === 'spell') {
      // waiting 表示已完成默写结果的处理（正确或错误都算waiting）
      if (spellResult) {
        // 已处理完，进入下一题
        nextCard(currentSessionWords, currentQueue);
      }
      // 否则不处理，由 onKeyDown 触发 checkSpelling
    }
    // HTML: else if (this.waiting) { this.nextCard(); }
    else if (mode === 'quiz' && showAnswer) {
      // 选择题已作答，进入下一题
      nextCard(currentSessionWords, currentQueue);
    }
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
            <h2 className="text-lg font-semibold text-gray-700 mb-4">登录</h2>
            <p className="text-sm text-gray-500 mb-4">
              输入用户名开始学习，换设备登录可继续进度
            </p>
            
            <div className="space-y-3">
              <input
                type="text"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="用户名"
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                maxLength={20}
                autoFocus
              />
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="密码（可选，管理员必填）"
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm mt-2 text-center">{loginError}</p>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600"
            >
              登录
            </button>
            
            <p className="text-xs text-gray-400 mt-4 text-center">
              支持：中文、字母、数字、下划线
            </p>
          </div>
          
          <p className="text-center text-gray-400 text-sm mt-4">
            <a href="/admin" className="text-blue-500 hover:underline">管理员入口</a>
          </p>
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
              {/* Total stats */}
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
              
              {/* Per-category breakdown */}
              {stats.categoryStats && stats.categoryStats.length > 1 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs text-gray-500 mb-2">分类详情：</div>
                  <div className="space-y-2">
                    {stats.categoryStats.map(cs => (
                      <div key={cs.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{cs.name}</span>
                        <div className="flex gap-3 text-xs">
                          <span>{cs.total}词</span>
                          {cs.newCount > 0 && <span className="text-blue-500">新{cs.newCount}</span>}
                          {cs.reviewCount > 0 && <span className="text-orange-500">复{cs.reviewCount}</span>}
                          {cs.hardCount > 0 && <span className="text-red-500">难{cs.hardCount}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          
          {/* Hard words section */}
          {stats.hardCount > 0 && (
            <button
              onClick={() => setCurrentView('hard')}
              className="w-full mt-3 py-3 bg-red-50 rounded-xl text-red-600 font-medium hover:bg-red-100"
            >
              💀 困难单词 ({stats.hardCount})
            </button>
          )}
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
                  key={currentWord?.id}  // 当单词变化时，强制重新创建输入框，清空内容
                  type="text"
                  placeholder="输入单词"
                  className={`w-full text-center text-2xl p-4 border-2 rounded-xl focus:border-blue-500 outline-none ${
                    spellResult && !spellResult.correct ? 'border-red-500 bg-red-50' : ''
                  } ${
                    spellResult && spellResult.correct ? 'border-green-500 bg-green-50' : ''
                  }`}
                  autoFocus
                  disabled={spellResult?.correct !== undefined}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !spellResult) {
                      const input = e.target as HTMLInputElement;
                      await handleSpellSubmit(input.value);
                    }
                  }}
                />
                {/* 默写结果反馈 */}
                {spellResult && !spellResult.correct && (
                  <div className="mt-3 text-center">
                    <div className="text-red-500 font-medium text-lg mb-2">
                      ✗ 正确答案: {currentWord.word}
                    </div>
                  </div>
                )}
                {spellResult && spellResult.correct && spellResult.needMore && (
                  <div className="mt-3 text-center text-green-600 font-medium">
                    ✓ 正确！还需 {spellResult.needMore} 次巩固
                  </div>
                )}
                {spellResult && spellResult.correct && spellResult.completed && (
                  <div className="mt-3 text-center text-green-600 font-medium text-lg">
                    ✓ 太棒了！已掌握
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
                <div className={`text-xl font-medium mb-4 ${
                  currentWord.tempStep >= 1.5 ? 'text-green-600' : 'text-red-500'
                }`}>
                  {currentWord.tempStep >= 1.5 ? '✓ 正确！' : `✗ 正确答案: ${currentWord.meaning}`}
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

          {/* Action button - 完全沿用HTML逻辑 */}
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
            {mode === 'spell' && !spellResult && (
              <button
                onClick={() => {
                  const input = document.getElementById('spell-input') as HTMLInputElement;
                  if (input) {
                    handleSpellSubmit(input.value);
                  }
                }}
                className="w-full py-4 bg-blue-500 text-white rounded-2xl font-semibold text-lg"
              >
                提交
              </button>
            )}
            {mode === 'spell' && spellResult && (
              <button
                onClick={handleNext}
                className={`w-full py-4 rounded-2xl font-semibold text-lg ${
                  spellResult.correct 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-500 text-white'
                }`}
              >
                {spellResult.completed ? '太棒了！已掌握' : 
                 spellResult.needMore ? `正确！还需 ${spellResult.needMore} 次巩固 →` : 
                 '下一题 →'}
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

          {/* Total stats */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <h3 className="font-medium text-gray-600 mb-3">总览</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-gray-500">总单词数</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total - stats.newCount}
                </div>
                <div className="text-xs text-gray-500">已学习</div>
              </div>
            </div>
          </div>

          {/* Per-category stats */}
          {stats.categoryStats && stats.categoryStats.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <h3 className="font-medium text-gray-600 mb-3">分类统计</h3>
              <div className="space-y-3">
                {stats.categoryStats.map(cs => {
                  const learned = cs.total - cs.newCount;
                  const progress = cs.total > 0 ? Math.round((learned / cs.total) * 100) : 0;
                  return (
                    <div key={cs.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{cs.name}</span>
                        <span className="text-sm text-gray-500">{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>总数: {cs.total}</span>
                        <span>待学习: {cs.newCount}</span>
                        <span>待复习: {cs.reviewCount}</span>
                        <span>困难: {cs.hardCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

  // Hard words view
  if (currentView === 'hard') {
    const hardWords = allWords.filter(w => w.progress && w.progress.failure_count > 3);
    
    // Group by semester
    const hardWordsBySemester = new Map<number, { semester: Semester; words: WordWithProgress[] }>();
    semesters.forEach(s => {
      const words = hardWords.filter(w => w.semester_id === s.id);
      if (words.length > 0) {
        hardWordsBySemester.set(s.id, { semester: s, words });
      }
    });

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">💀 困难单词</h1>
            <button
              onClick={() => setCurrentView('setup')}
              className="text-gray-500"
            >
              ✕
            </button>
          </div>

          {hardWords.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🎉</div>
              <p>太棒了！没有困难单词</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(hardWordsBySemester.values()).map(({ semester, words }) => (
                <div key={semester.id}>
                  <h3 className="font-medium text-gray-600 mb-2 px-1 flex items-center justify-between">
                    <span>{semester.name}</span>
                    <span className="text-sm text-gray-400">{words.length}词</span>
                  </h3>
                  <div className="space-y-2">
                    {words.map(word => (
                      <div
                        key={word.id}
                        onClick={() => playWord(word.word)}
                        className="bg-white rounded-xl p-4 cursor-pointer hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium">{word.word}</span>
                          <span className="text-gray-400 text-xs">{word.phonetic}</span>
                          <span className="text-red-500 text-xs ml-auto">
                            错误 {word.progress?.failure_count} 次
                          </span>
                        </div>
                        <div className="text-gray-500 text-sm">{word.meaning}</div>
                      </div>
                    ))}
                  </div>
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

  // Word list view
  if (currentView === 'list') {
    // Group words by semester for better organization
    const wordsBySemester = new Map<number, { semester: Semester; words: WordWithProgress[] }>();
    
    semesters
      .filter(s => selectedSemesterIds.includes(s.id))
      .forEach(s => {
        const words = allWords.filter(w => w.semester_id === s.id);
        if (words.length > 0) {
          wordsBySemester.set(s.id, { semester: s, words });
        }
      });

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
            <div className="space-y-4">
              {Array.from(wordsBySemester.values()).map(({ semester, words }) => (
                <div key={semester.id}>
                  <h3 className="font-medium text-gray-600 mb-2 px-1">{semester.name}</h3>
                  <div className="space-y-2">
                    {words.map(word => (
                      <div
                        key={word.id}
                        onClick={() => playWord(word.word)}
                        className="bg-white rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          !word.progress ? 'bg-gray-300' :
                          word.progress.state === 'review' ? 'bg-green-500' :
                          word.progress.failure_count > 3 ? 'bg-red-500' : 'bg-orange-500'
                        }`} />
                        <span className="font-medium">{word.word}</span>
                        <span className="text-gray-400 text-xs">{word.phonetic}</span>
                        <span className="text-gray-500 text-sm truncate flex-1 text-right">{word.meaning}</span>
                      </div>
                    ))}
                  </div>
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
