import { useState, useEffect, useCallback, useRef } from 'react';
import { shuffleArray, playWord, calculateNextReview, formatDate, getStudyDayDate, isDueForReview, getStudyDayString } from '@/lib/vocab-utils';
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
  console.log('[saveProgress] 保存进度:', { username, count: progress.length, progress });
  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, progress }),
    });
    const data = await res.json();
    console.log('[saveProgress] 响应:', data);
    if (!res.ok || data.error) {
      console.error('[saveProgress] 保存失败:', data);
    }
    return data;
  } catch (error) {
    console.error('[saveProgress] 请求错误:', error);
    throw error;
  }
}

async function recordStat(username: string, semesterId: number, type: 'new' | 'review') {
  await fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username, 
      semesterId, 
      date: getStudyDayString(), // 使用凌晨4点分界的日期
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
  const [sessionLimit, setSessionLimit] = useState(20);  // 单次复习上限
  const [unsavedCount, setUnsavedCount] = useState(0);
  const unsavedCountRef = useRef(0);  // 添加 ref 追踪最新值
  const [spellResult, setSpellResult] = useState<{ correct: boolean; needMore?: number; completed?: boolean } | null>(null);
  const [newWordsInSession, setNewWordsInSession] = useState(0);  // 当前会话已分配的新词数量
  const [keyboardHeight, setKeyboardHeight] = useState(0);  // 键盘高度(px)

  // 监听键盘弹出/收起，使用 visualViewport API 精确获取键盘高度
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      
      const viewportHeight = viewport.height;
      const windowHeight = window.innerHeight;
      // 键盘高度 = 窗口高度 - 视口高度
      const kbHeight = Math.max(0, windowHeight - viewportHeight);
      
      console.log('[Keyboard] viewportHeight:', viewportHeight, 'windowHeight:', windowHeight, 'keyboardHeight:', kbHeight);
      setKeyboardHeight(kbHeight);
    };
    
    // 使用 visualViewport API（W3C标准方案）
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', handleViewportChange);
      viewport.addEventListener('scroll', handleViewportChange);  // iOS有时触发scroll而非resize
      handleViewportChange();  // 初始化
    }
    
    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', handleViewportChange);
        viewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  // 同步 ref
  useEffect(() => {
    sessionWordsRef.current = sessionWords;
  }, [sessionWords]);
  
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  
  useEffect(() => {
    currentWordRef.current = currentWord;
    
    // 学习模式和选择题模式：显示单词时自动播放发音
    if (currentWord && mode !== 'spell') {
      // 小延迟确保DOM渲染完成
      setTimeout(() => {
        playWord(currentWord.word);
      }, 100);
    }
  }, [currentWord, mode]);

  useEffect(() => {
    unsavedCountRef.current = unsavedCount;
  }, [unsavedCount]);

  // 当用户返回 setup 页面时，重新获取进度数据
  useEffect(() => {
    async function refreshProgress() {
      if (currentView === 'setup' && isLoggedIn && username && selectedSemesterIds.length > 0) {
        try {
          const progressData = await fetchProgress(username, selectedSemesterIds);
          const progressMap = new Map(progressData.map(p => [p.word_id, p]));
          setAllWords(prev => prev.map(w => ({
            ...w,
            progress: progressMap.get(w.id),
          })));
        } catch (error) {
          console.error('Refresh progress error:', error);
        }
      }
    }
    refreshProgress();
  }, [currentView, isLoggedIn, username]);

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
    const total = allWords.length;
    
    // 已学习：有进度且状态不是'new'的单词
    const learnedCount = allWords.filter(w => 
      w.progress && w.progress.state !== 'new'
    ).length;
    
    // 使用凌晨4点分界的复习判断
    const reviewCount = allWords.filter(w => 
      w.progress && 
      w.progress.state !== 'new' && 
      w.progress.next_review && 
      isDueForReview(w.progress.next_review)
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
          learnedCount: categoryWords.filter(w => w.progress && w.progress.state !== 'new').length,
          reviewCount: categoryWords.filter(w => 
            w.progress && 
            w.progress.state !== 'new' && 
            w.progress.next_review && 
            isDueForReview(w.progress.next_review)
          ).length,
          hardCount: categoryWords.filter(w => w.progress && w.progress.failure_count > 3).length,
        };
      });
    
    return { total, learnedCount, reviewCount, hardCount, categoryStats };
  }, [allWords, semesters, selectedSemesterIds]);

  const stats = getStats();

  // Start learning session
  // type: 'normal' - 从主页开始，包含新词+复习词
  // type: 'extra' - 继续复习，只包含复习词（纯粹复习模式）
  const startSession = async (type: 'normal' | 'extra') => {
    if (allWords.length === 0) {
      alert('请先选择分类！');
      return;
    }

    setSessionType(type);

    let selectedWords: WordWithProgress[] = [];
    
    if (type === 'normal') {
      // 使用凌晨4点分界的复习判断，获取最紧急的复习词（限制数量）
      const allReviewWords = allWords.filter(w => 
        w.progress && 
        w.progress.state !== 'new' && 
        w.progress.next_review && 
        isDueForReview(w.progress.next_review)
      );
      
      // 按紧急程度排序（next_review最早的排前面）
      const sortedReviewWords = allReviewWords.sort((a, b) => {
        const dateA = new Date(a.progress!.next_review!).getTime();
        const dateB = new Date(b.progress!.next_review!).getTime();
        return dateA - dateB;
      });
      
      // 限制复习词数量（最紧急的sessionLimit个）
      const reviewWords = sortedReviewWords.slice(0, sessionLimit);
      
      // 新词只在主页开始时才分配，且不超过剩余额度
      const remainingSlots = Math.max(0, sessionLimit - reviewWords.length);
      const newWordsLimit = Math.min(dailyLimit - newWordsInSession, remainingSlots);
      
      const newWords = newWordsLimit > 0 
        ? allWords.filter(w => !w.progress || w.progress.state === 'new')
            .slice(0, newWordsLimit)
        : [];
      
      // 更新已分配的新词数量
      setNewWordsInSession(prev => prev + newWords.length);
      
      selectedWords = [...reviewWords, ...newWords];
    } else {
      // 纯粹复习模式：只复习旧词，不包含新词
      const allReviewWords = allWords.filter(w => 
        w.progress && 
        w.progress.state !== 'new' &&
        w.progress.next_review &&
        isDueForReview(w.progress.next_review)
      );
      
      // 按紧急程度排序，取最紧急的
      const sortedReviewWords = allReviewWords.sort((a, b) => {
        const dateA = new Date(a.progress!.next_review!).getTime();
        const dateB = new Date(b.progress!.next_review!).getTime();
        return dateA - dateB;
      });
      
      selectedWords = sortedReviewWords.slice(0, sessionLimit);
    }

    if (selectedWords.length === 0) {
      alert(type === 'extra' ? '没有更多需要复习的单词了！' : '今日任务已完成！');
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
      // 默写错误：进入惩罚模式，同时播放发音加深记忆
      playWord(currentWord.word);
      
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
    const currentFailureCount = word.progress?.failure_count ?? 0;
    
    // 判断是否为新词（之前没有进度或状态为 new）
    const isNewWord = !word.progress || word.progress.state === 'new';
    
    // 判断是否"从错题池答对"：有案底(failureCount>0)且正在惩罚中
    // 这是康复词的"双重验证"机制关键判断
    const isFromErrorPool = currentFailureCount > 0 && word.inPenalty;
    
    const { ef, interval, nextReview } = calculateNextReview(
      success, 
      currentEf, 
      currentInterval, 
      isNewWord,
      currentFailureCount,
      isFromErrorPool  // 传递是否从错题池答对
    );
    
    // HTML: w.state = success ? 'review' : 'learning'
    const newState = success ? 'review' : 'learning' as 'review' | 'learning';
    
    // 更新failureCount：答错+1，答对保持（学霸词保持0）
    const newFailureCount = success ? currentFailureCount : currentFailureCount + 1;
    
    const progressUpdate = {
      wordId: word.id,
      semesterId: word.semester_id,
      state: newState,
      nextReview: nextReview.toISOString(),
      ef,
      interval,
      failureCount: newFailureCount,
      penaltyProgress: 0,
      inPenalty: !success,
    };

    // 使用函数式更新确保计数正确
    const newCount = unsavedCountRef.current + 1;
    setUnsavedCount(newCount);
    unsavedCountRef.current = newCount;  // 立即同步 ref
    
    // 更新本地 sessionWords 中的 progress，确保 finishSession 能保存完整数据
    setSessionWords(prev => {
      const updated = prev.map(w => {
        if (w.id === word.id) {
          const newProgress = {
            ...w.progress,
            id: w.progress?.id ?? 0,
            username: w.progress?.username ?? username,
            word_id: w.id,
            semester_id: w.semester_id,
            state: newState,
            ef,
            interval,
            next_review: nextReview.toISOString(),
            failure_count: newFailureCount,
            penalty_progress: 0,
            in_penalty: !success,
            created_at: w.progress?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return {
            ...w,
            progress: newProgress as UserProgress,
          };
        }
        return w;
      });
      sessionWordsRef.current = updated;  // 同步更新 ref
      return updated;
    });
    
    // 使用 ref 检查，确保使用最新值
    if (newCount >= 4) {
      await saveProgress(username, [progressUpdate]);
      setUnsavedCount(0);
      unsavedCountRef.current = 0;
    }
  };

  const finishSession = async () => {
    // 使用 ref 获取最新的 sessionWords 数据
    const currentSessionWords = sessionWordsRef.current;
    
    console.log('[finishSession] 开始保存进度');
    console.log('[finishSession] sessionWords 数量:', currentSessionWords.length);
    console.log('[finishSession] sessionWords 详情:', currentSessionWords.map(w => ({
      id: w.id,
      word: w.word,
      tempStep: w.tempStep,
      progress: w.progress
    })));
    
    // 找出所有有进度更新的单词（包括新学的和已复习的）
    const progressToSave = currentSessionWords
      .filter(w => w.progress && w.progress.state !== 'new')
      .map(w => ({
        wordId: w.id,
        semesterId: w.semester_id,
        state: w.progress!.state,
        nextReview: w.progress!.next_review || new Date().toISOString(),
        ef: w.progress!.ef ?? 25,
        interval: w.progress!.interval ?? 0,
        failureCount: w.progress!.failure_count ?? 0,
        penaltyProgress: 0,
        inPenalty: false,
      }));
    
    console.log('[finishSession] progressToSave:', progressToSave);
    
    if (progressToSave.length > 0) {
      console.log('[finishSession] 调用 saveProgress');
      const result = await saveProgress(username, progressToSave);
      console.log('[finishSession] saveProgress 结果:', result);
      setUnsavedCount(0);
      unsavedCountRef.current = 0;
    } else {
      console.log('[finishSession] 没有进度需要保存');
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-indigo-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 登录页面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">📚</div>
            <h1 className="text-2xl font-bold text-indigo-900">中考词汇通</h1>
            <p className="text-indigo-500 mt-2">选择学期 · 智能复习</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-indigo-100">
            <h2 className="text-lg font-semibold text-indigo-800 mb-4">登录</h2>
            <p className="text-sm text-indigo-500 mb-4">
              输入用户名开始学习，换设备登录可继续进度
            </p>
            
            <div className="space-y-3">
              <input
                type="text"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="用户名"
                className="w-full p-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-indigo-900 placeholder:text-indigo-300"
                maxLength={20}
                autoFocus
              />
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="密码（可选，管理员必填）"
                className="w-full p-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-indigo-900 placeholder:text-indigo-300"
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm mt-2 text-center">{loginError}</p>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
            >
              登录
            </button>
            
            <p className="text-xs text-indigo-400 mt-4 text-center">
              支持：中文、字母、数字、下划线
            </p>
          </div>
          
          <p className="text-center text-indigo-400 text-sm mt-4">
            <a href="/admin" className="text-indigo-500 hover:text-indigo-700 hover:underline">管理员入口</a>
          </p>
        </div>
      </div>
    );
  }

  // Setup view
  if (currentView === 'setup') {
    return (
      <div className="min-h-screen p-3" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="max-w-lg mx-auto space-y-3">
          {/* Header with user info */}
          <div className="text-center py-3">
            <h1 className="text-2xl font-bold text-indigo-600">📚 中考词汇通</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-indigo-400 text-xs">用户：{username}</span>
              <button 
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                [退出]
              </button>
            </div>
          </div>

          {/* Dashboard - 紧凑2x2网格 */}
          {selectedSemesterIds.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-indigo-100">
                <div className="text-2xl font-bold text-indigo-900">{stats.total}</div>
                <div className="text-xs text-indigo-400">📚 总量</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-indigo-100">
                <div className="text-2xl font-bold text-green-500">{stats.learnedCount}</div>
                <div className="text-xs text-indigo-400">📖 已学习</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-indigo-100">
                <div className="text-2xl font-bold text-amber-500">{stats.reviewCount}</div>
                <div className="text-xs text-indigo-400">⏰ 待复习</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-indigo-100">
                <div className="text-2xl font-bold text-red-500">{stats.hardCount}</div>
                <div className="text-xs text-indigo-400">💀 困难</div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="text-center py-3 text-indigo-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="mt-1 text-xs">加载中...</p>
            </div>
          )}

          {/* Semester selection - 紧凑2列网格 */}
          <div className="bg-white rounded-xl p-3 shadow-sm border border-indigo-100">
            <h2 className="font-semibold text-indigo-700 mb-2 text-sm">选择分类</h2>
            <div className="grid grid-cols-2 gap-2">
              {semesters.map(semester => {
                const isSelected = selectedSemesterIds.includes(semester.id);
                const wordCount = allWords.filter(w => w.semester_id === semester.id).length;
                const categoryStat = stats.categoryStats?.find(cs => cs.id === semester.id);
                
                return (
                  <label 
                    key={semester.id}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSemester(semester.id)}
                      className="sr-only"
                    />
                    <span className={`font-medium text-sm ${isSelected ? 'text-white' : ''}`}>
                      {semester.name}
                    </span>
                    {isSelected && wordCount > 0 && (
                      <span className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`}>
                        {wordCount}词
                        {categoryStat && categoryStat.learnedCount > 0 && ` · 已${categoryStat.learnedCount}`}
                      </span>
                    )}
                    {!isSelected && (
                      <span className="text-xs text-indigo-400">{wordCount}词</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Settings - 紧凑两行 */}
          <div className="grid grid-cols-2 gap-2">
            {/* Daily limit */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-indigo-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-600">🎯 每日新词</span>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    setDailyLimit(isNaN(val) ? 0 : val);
                  }}
                  className="w-12 text-center border border-indigo-200 rounded py-1 text-sm text-indigo-700 focus:border-indigo-500"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            {/* Session limit */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-indigo-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-600">📦 复习上限</span>
                <select
                  value={sessionLimit}
                  onChange={(e) => setSessionLimit(parseInt(e.target.value))}
                  className="border border-indigo-200 rounded py-1 text-sm bg-white text-indigo-700 focus:border-indigo-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={40}>40</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action buttons - 紧凑排列 */}
          <button
            onClick={() => startSession('normal')}
            disabled={selectedSemesterIds.length === 0}
            className={`w-full py-3 rounded-xl text-white font-semibold shadow-lg transition-all ${
              selectedSemesterIds.length > 0
                ? 'bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] shadow-indigo-200'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            🚀 开始学习
          </button>

          {/* Secondary actions - 紧凑两列 */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView('stats')}
              className="flex-1 py-2 bg-indigo-50 rounded-lg text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              📊 统计
            </button>
            <button
              onClick={() => setCurrentView('list')}
              className="flex-1 py-2 bg-indigo-50 rounded-lg text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              📖 词表
            </button>
            {stats.hardCount > 0 && (
              <button
                onClick={() => setCurrentView('hard')}
                className="flex-1 py-2 bg-red-50 rounded-lg text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
              >
                💀 困难({stats.hardCount})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Study view - 使用fixed定位精确控制布局
  if (currentView === 'study' && currentWord) {
    const isSpellMode = mode === 'spell';
    
    // 根据答题结果决定动画类
    const resultAnimation = spellResult?.correct ? 'success-bounce' : (spellResult && !spellResult.correct ? 'error-shake' : '');
    
    // 内容区域的bottom值：按钮高度(56px) + 键盘高度
    const contentBottom = keyboardHeight > 0 ? `${keyboardHeight + 56}px` : '56px';
    
    return (
      <div 
        className="fixed inset-0 overflow-hidden" 
        style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}
      >
        {/* Header - 固定顶部 */}
        <div className="absolute top-0 left-0 right-0 bg-white/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between shadow-sm z-40 border-b border-indigo-100 h-12">
          <button
            onClick={() => {
              if (confirm('确定退出学习？进度会自动保存。')) {
                finishSession();
              }
            }}
            className="text-indigo-400 p-2 -ml-2 cursor-pointer text-sm hover:text-indigo-600"
          >
            ✕ 退出
          </button>
          <span className="text-xs text-indigo-500 font-medium">
            {sessionWords.filter(w => w.tempStep === 2).length}/{sessionWords.length}
          </span>
          <span className={`text-xs ${unsavedCount > 0 ? 'text-amber-500' : 'text-green-500'}`}>
            {unsavedCount > 0 ? `+${unsavedCount}` : '✓'}
          </span>
        </div>

        {/* 可滚动的内容区域 - fixed定位，精确控制top和bottom */}
        <div 
          className="absolute left-0 right-0 overflow-y-auto"
          style={{ 
            top: '48px',      // header高度
            bottom: contentBottom
          }}
        >
          {/* Penalty badge */}
          {currentWord.inPenalty && (
            <div className="bg-amber-50 text-amber-600 text-center py-1 text-xs font-medium">
              🔥 强化中 ({currentWord.penaltyProgress}/3)
            </div>
          )}

          {/* Main content */}
          <div className="p-3">
            <div className={`bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 sm:p-6 flex flex-col items-center ${resultAnimation}`}>
              {/* Word display */}
              {isSpellMode ? (
                <div className="text-center">
                  <div className="text-xl text-indigo-800 mb-2 font-medium">{currentWord.meaning}</div>
                  {/* 默写模式也显示音标，帮助记忆发音 */}
                  {currentWord.phonetic && (
                    <button
                      onClick={() => playWord(currentWord.word)}
                      className="flex items-center gap-1 bg-indigo-50 px-4 py-2 rounded-full text-indigo-600 hover:bg-indigo-100 cursor-pointer transition-colors"
                    >
                      <span>{currentWord.phonetic}</span>
                      <span>🔊</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold text-indigo-900 mb-2">{currentWord.word}</div>
                  {currentWord.phonetic && (
                    <button
                      onClick={() => playWord(currentWord.word)}
                      className="flex items-center gap-1 bg-indigo-50 px-4 py-2 rounded-full text-indigo-600 hover:bg-indigo-100 cursor-pointer transition-colors"
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
                  <div className="text-xl text-indigo-800">{currentWord.meaning}</div>
                  {currentWord.example_en && (
                    <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-left w-full border border-indigo-100">
                      <div className="text-indigo-900">{currentWord.example_en}</div>
                      {currentWord.example_cn && (
                        <div className="text-indigo-500 text-sm mt-1">{currentWord.example_cn}</div>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Spell input - 默写模式输入区 */}
            {isSpellMode && (
              <div className="w-full mt-4 space-y-3">
                <input
                  id="spell-input"
                  key={currentWord?.id}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="输入单词"
                  className={`w-full text-center text-2xl p-4 border-2 rounded-xl focus:border-indigo-500 outline-none transition-all ${
                    spellResult && !spellResult.correct ? 'border-red-500 bg-red-50' : ''
                  } ${
                    spellResult && spellResult.correct ? 'border-green-500 bg-green-50' : ''
                  }`}
                  autoFocus
                  disabled={spellResult?.correct !== undefined}
                  onFocus={() => {
                    // 键盘弹出时，等待一小会儿让键盘完全弹出，然后滚动到输入框
                    setTimeout(() => {
                      const input = document.getElementById('spell-input');
                      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !spellResult) {
                      const input = e.target as HTMLInputElement;
                      await handleSpellSubmit(input.value);
                    }
                  }}
                />
                
                {/* 默写结果反馈 */}
                {spellResult && !spellResult.correct && (
                  <div className="text-center">
                    <div className="text-red-500 font-medium text-lg error-shake">
                      ✗ 正确答案: {currentWord.word}
                    </div>
                  </div>
                )}
                {spellResult && spellResult.correct && spellResult.needMore && (
                  <div className="text-center text-green-600 font-medium success-bounce">
                    ✓ 正确！还需 {spellResult.needMore} 次巩固
                  </div>
                )}
                {spellResult && spellResult.correct && spellResult.completed && (
                  <div className="text-center text-green-600 font-medium text-lg success-bounce">
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
                    className="w-full p-4 text-left bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all border-2 border-transparent hover:border-indigo-300 cursor-pointer text-indigo-900"
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
                  currentWord.tempStep >= 1.5 ? 'text-green-600 success-bounce' : 'text-red-500 error-shake'
                }`}>
                  {currentWord.tempStep >= 1.5 ? '✓ 正确！' : `✗ 正确答案: ${currentWord.meaning}`}
                </div>
                {currentWord.example_en && (
                  <div className="p-4 bg-indigo-50 rounded-xl text-left w-full border border-indigo-100">
                    <div className="text-indigo-900">{currentWord.example_en}</div>
                    {currentWord.example_cn && (
                      <div className="text-indigo-500 text-sm mt-1">{currentWord.example_cn}</div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Action button - 绝对定位在底部，键盘弹出时上移 */}
        <div 
          className="absolute left-0 right-0 bg-white/95 backdrop-blur-sm px-3 py-3 border-t border-indigo-100 shadow-lg transition-all duration-200 z-50"
          style={{ 
            bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0'
          }}
        >
          {mode === 'learn' && (
            <button
              onClick={handleLearnNext}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold cursor-pointer hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
            >
              记住了，去测试 →
            </button>
          )}
          {mode === 'quiz' && showAnswer && (
            <button
              onClick={handleNext}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold cursor-pointer hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
            >
              下一题 →
            </button>
          )}
          {isSpellMode && !spellResult && (
            <button
              onClick={() => {
                const input = document.getElementById('spell-input') as HTMLInputElement;
                if (input) {
                  handleSpellSubmit(input.value);
                }
              }}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold cursor-pointer hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
            >
              提交
            </button>
          )}
          {isSpellMode && spellResult && (
            <button
              onClick={handleNext}
              className={`w-full py-3 rounded-xl font-semibold cursor-pointer active:scale-[0.98] transition-all shadow-sm ${
                spellResult.correct 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {spellResult.completed ? '太棒了！已掌握' : 
               spellResult.needMore ? `正确！还需 ${spellResult.needMore} 次巩固 →` : 
               '下一题 →'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Finish view
  if (currentView === 'finish') {
    // 计算是否还有更多待复习的单词
    const remainingReviewCount = allWords.filter(w => 
      w.progress && 
      w.progress.state !== 'new' && 
      w.progress.next_review && 
      isDueForReview(w.progress.next_review)
    ).length;
    
    return (
      <div className="min-h-screen p-4 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="text-center max-w-sm w-full">
          <div className="text-6xl mb-4 success-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">任务完成！</h2>
          <p className="text-indigo-600 mb-2">
            本组完成 {sessionWords.length} 个单词
          </p>
          
          {/* 显示进度摘要 */}
          <div className="bg-white rounded-xl p-4 mb-6 text-left border border-indigo-100 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-indigo-500">新词学习：</span>
              <span className="font-medium text-indigo-700">
                {sessionWords.filter(w => w.isNewThisSession).length} 个
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-indigo-500">旧词复习：</span>
              <span className="font-medium text-amber-600">
                {sessionWords.filter(w => !w.isNewThisSession).length} 个
              </span>
            </div>
            {remainingReviewCount > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-indigo-100">
                <span className="text-indigo-500">还待复习：</span>
                <span className="font-medium text-red-500">{remainingReviewCount} 个</span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {remainingReviewCount > 0 ? (
              <button
                onClick={() => startSession('extra')}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all"
              >
                🚀 继续复习下一组 ({Math.min(sessionLimit, remainingReviewCount)}个)
              </button>
            ) : (
              <div className="py-3 bg-green-100 text-green-700 rounded-2xl font-medium success-bounce">
                ✓ 今日复习任务全部完成！
              </div>
            )}
            <button
              onClick={() => setCurrentView('setup')}
              className="w-full py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-semibold hover:bg-indigo-100 active:scale-[0.98] transition-all"
            >
              返回主页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stats view
  if (currentView === 'stats') {
    return (
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-indigo-900">📊 学习统计</h1>
            <button
              onClick={() => setCurrentView('setup')}
              className="text-indigo-400 hover:text-indigo-600 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Total stats */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 border border-indigo-100">
            <h3 className="font-medium text-indigo-600 mb-3">总览</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-indigo-50 rounded-xl">
                <div className="text-2xl font-bold text-indigo-900">{stats.total}</div>
                <div className="text-xs text-indigo-500">总单词数</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <div className="text-2xl font-bold text-green-600">
                  {stats.learnedCount}
                </div>
                <div className="text-xs text-green-500">已学习</div>
              </div>
            </div>
          </div>

          {/* Per-category stats */}
          {stats.categoryStats && stats.categoryStats.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 border border-indigo-100">
              <h3 className="font-medium text-indigo-600 mb-3">分类统计</h3>
              <div className="space-y-3">
                {stats.categoryStats.map(cs => {
                  const progress = cs.total > 0 ? Math.round((cs.learnedCount / cs.total) * 100) : 0;
                  return (
                    <div key={cs.id} className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-indigo-900">{cs.name}</span>
                        <span className="text-sm text-indigo-500">{progress}%</span>
                      </div>
                      <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-indigo-400">
                        <span>总数: {cs.total}</span>
                        <span>已学习: {cs.learnedCount}</span>
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
            className="w-full mt-4 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-medium hover:bg-indigo-100 active:scale-[0.98] transition-all"
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
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-indigo-900">💀 困难单词</h1>
            <button
              onClick={() => setCurrentView('setup')}
              className="text-indigo-400 hover:text-indigo-600 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {hardWords.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center py-8 text-indigo-500 border border-indigo-100">
              <div className="text-4xl mb-2 success-bounce">🎉</div>
              <p>太棒了！没有困难单词</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(hardWordsBySemester.values()).map(({ semester, words }) => (
                <div key={semester.id}>
                  <h3 className="font-medium text-indigo-600 mb-2 px-1 flex items-center justify-between">
                    <span>{semester.name}</span>
                    <span className="text-sm text-indigo-400">{words.length}词</span>
                  </h3>
                  <div className="space-y-2">
                    {words.map(word => (
                      <div
                        key={word.id}
                        onClick={() => playWord(word.word)}
                        className="bg-white rounded-xl p-4 cursor-pointer hover:bg-indigo-50 border border-indigo-100 active:scale-[0.98] transition-all"
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-indigo-900">{word.word}</span>
                          <span className="text-indigo-400 text-xs">{word.phonetic}</span>
                          <span className="text-red-500 text-xs ml-auto">
                            错误 {word.progress?.failure_count} 次
                          </span>
                        </div>
                        <div className="text-indigo-600 text-sm">{word.meaning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setCurrentView('setup')}
            className="w-full mt-4 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-medium hover:bg-indigo-100 active:scale-[0.98] transition-all"
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
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(to bottom, #EEF2FF, #fff)' }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-indigo-900">📖 单词列表</h1>
            <button
              onClick={() => setCurrentView('setup')}
              className="text-indigo-400 hover:text-indigo-600 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {allWords.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center py-8 text-indigo-500 border border-indigo-100">
              请先选择分类
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(wordsBySemester.values()).map(({ semester, words }) => (
                <div key={semester.id}>
                  <h3 className="font-medium text-indigo-600 mb-2 px-1">{semester.name}</h3>
                  <div className="space-y-2">
                    {words.map(word => (
                      <div
                        key={word.id}
                        onClick={() => playWord(word.word)}
                        className="bg-white rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-indigo-50 border border-indigo-100 active:scale-[0.98] transition-all"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          !word.progress ? 'bg-indigo-300' :
                          word.progress.state === 'review' ? 'bg-green-500' :
                          word.progress.failure_count > 3 ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <span className="font-medium text-indigo-900">{word.word}</span>
                        <span className="text-indigo-400 text-xs">{word.phonetic}</span>
                        <span className="text-indigo-600 text-sm truncate flex-1 text-right">{word.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setCurrentView('setup')}
            className="w-full mt-4 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-medium hover:bg-indigo-100 active:scale-[0.98] transition-all"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return null;
}
