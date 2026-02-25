// Utility functions for vocabulary app

// Format date to YYYY-MM-DD
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Calculate next review time based on SM-2 algorithm
// 复习逻辑：
// - 新词第一次答对：3天后复习
// - 复习词答对：间隔 × 2.5
// - 答错：间隔清零为1（明天复习），当天进入惩罚模式
export function calculateNextReview(
  success: boolean,
  currentEf: number,
  currentInterval: number,
  isNewWord: boolean = false
): { ef: number; interval: number; nextReview: Date } {
  let ef = currentEf;
  let interval = currentInterval;
  
  if (success) {
    if (isNewWord) {
      // 新词第一次答对：直接跳到 3天后
      interval = 3;
    } else if (interval === 0) {
      // 异常情况，当作新词处理
      interval = 3;
    } else {
      // 复习词答对：间隔 × EF（2.5倍）
      interval = Math.ceil(interval * (ef / 10));
    }
    // 增加 EF（最高 2.5）
    ef = Math.min(25, ef + 1);
  } else {
    // 答错：EF 降低（最低 1.3），间隔清零为 1
    ef = Math.max(13, ef - 2);
    interval = 1;
  }
  
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  
  return { ef, interval, nextReview };
}

// Get words to review today
export function getWordsToReview(words: WordWithProgress[]): WordWithProgress[] {
  const now = new Date();
  return words.filter(w => {
    if (!w.progress || w.progress.state === 'new') return false;
    if (!w.progress.next_review) return false;
    return new Date(w.progress.next_review) <= now;
  });
}

// Get new words
export function getNewWords(words: WordWithProgress[], limit: number): WordWithProgress[] {
  return words
    .filter(w => !w.progress || w.progress.state === 'new')
    .slice(0, limit);
}

// Shuffle array
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Play word pronunciation
export function playWord(word: string): void {
  if (typeof window === 'undefined') return;
  
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2&_t=${Date.now()}`;
  const audio = new Audio(url);
  audio.play().catch(() => {
    // Fallback to speech synthesis
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  });
}

import type { WordWithProgress } from '@/lib/types';
