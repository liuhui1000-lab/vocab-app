// Utility functions for vocabulary app

// 获取当前学习日的基准时间（凌晨4点作为一天的分界）
// 如果当前时间 < 04:00，则算作"昨天"的学习日
export function getStudyDayDate(): Date {
  const now = new Date();
  if (now.getHours() < 4) {
    // 凌晨4点前，算作昨天
    now.setDate(now.getDate() - 1);
  }
  return now;
}

// 判断给定日期是否在当前学习日或之前（用于待复习判断）
// 基于凌晨4点分界：凌晨4点前算作"昨天"
export function isDueForReview(reviewDateStr: string): boolean {
  // 从 ISO 字符串中提取日期部分 (YYYY-MM-DD)
  const reviewDatePart = reviewDateStr.split('T')[0];
  
  // 获取当前学习日的日期字符串
  const studyDayString = getStudyDayString();
  
  // 比较日期字符串：如果复习日期 <= 当前学习日，则需要复习
  return reviewDatePart <= studyDayString;
}

// Format date to YYYY-MM-DD（本地时间，用于存储和比较）
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取格式化的学习日日期（用于统计表）
export function getStudyDayString(): string {
  return formatDate(getStudyDayDate());
}

// Calculate next review time based on SM-2 algorithm
// EF（易遗忘因子）规则：
//   - 初始值：2.5（内部存储为25，计算时除以10）
//   - 答对：+0.1（内部+1），最高2.5
//   - 答错：-0.2（内部-2），最低1.3
//   - 惩罚模式完成：EF不变（答错时已-0.2）
//
// 惩罚模式规则：
//   - 当天答错 → 必须连续3次正确才能过
//   - 惩罚模式通过后 → interval=1，第二天正常复习
//
// 正常复习规则：
//   - 一遍过 → 先EF+0.1，再用新EF计算interval
//   - 答错 → EF-0.2，进入当天的惩罚模式，interval=1
export function calculateNextReview(
  success: boolean,
  currentEf: number,      // 内部存储值，25表示2.5
  currentInterval: number,
  isNewWord: boolean = false,
  failureCount: number = 0,
  justFinishedPenalty: boolean = false  // 刚完成惩罚模式
): { ef: number; interval: number; nextReview: string } {
  let ef = currentEf;
  let interval = currentInterval;
  
  if (success) {
    if (justFinishedPenalty) {
      // 惩罚模式完成：EF不变，interval=1
      // 注意：EF在第一次答错时已经-0.2了
      interval = 1;
    } else {
      // 先更新EF（答对+0.1）
      ef = Math.min(25, ef + 1);
      
      if (isNewWord) {
        // 新词第一次答对：interval固定为3
        interval = 3;
      } else {
        // 正常复习答对：用新的EF计算interval
        interval = Math.ceil(interval * (ef / 10));
      }
    }
  } else {
    // 答错：EF-0.2，interval=1
    ef = Math.max(13, ef - 2);
    interval = 1;
  }
  
  // 计算下次复习日期
  const baseDate = getStudyDayDate();
  const nextReviewDate = new Date(baseDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  const nextReview = formatDate(nextReviewDate);
  
  console.log('[calculateNextReview]', {
    success,
    isNewWord,
    justFinishedPenalty,
    currentEf: currentEf / 10,
    newEf: ef / 10,
    currentInterval,
    newInterval: interval,
    nextReview
  });
  
  return { ef, interval, nextReview };
}

// Get words to review today (基于凌晨4点分界的自然天)
export function getWordsToReview(words: WordWithProgress[]): WordWithProgress[] {
  return words.filter(w => {
    if (!w.progress || w.progress.state === 'new') return false;
    if (!w.progress.next_review) return false;
    return isDueForReview(w.progress.next_review);
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

// 智能答案比对函数
// 规则：
// 1. 多个点（...）或多个空格都视为单词分隔符，标准化为单个空格
// 2. 括号内容（如 "(be)"）是可选的，有无都可
// 3. 专有名词（首字母大写）必须大小写正确，其他单词忽略大小写
export function checkSpellingAnswer(input: string, correctAnswer: string): boolean {
  // 标准化输入和答案
  const normalizedInput = normalizeAnswer(input);
  const normalizedAnswer = normalizeAnswer(correctAnswer);
  
  // 检查是否是专有名词（首字母大写）
  const isProperNoun = /^[A-Z]/.test(correctAnswer.trim());
  
  if (isProperNoun) {
    // 专有名词：大小写必须正确
    return normalizedInput === normalizedAnswer;
  } else {
    // 普通单词：忽略大小写
    return normalizedInput.toLowerCase() === normalizedAnswer.toLowerCase();
  }
}

// 标准化答案字符串
// 1. 将多个点（...）替换为单个空格
// 2. 将多个空格替换为单个空格
// 3. 处理括号内容（生成多个可能的答案）
function normalizeAnswer(answer: string): string {
  let normalized = answer.trim();
  
  // 移除全角括号和半角括号中的内容，但同时保留原内容（括号内容可选）
  // 例如 "(be) responsible for" → ["be responsible for", "responsible for"]
  // 我们生成两种形式，后面会处理
  
  // 将多个点（两个或以上）替换为单个空格
  normalized = normalized.replace(/\.{2,}/g, ' ');
  
  // 将多个空格替换为单个空格
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}

// 获取答案的所有可能正确形式（用于显示正确答案）
export function getAnswerVariants(correctAnswer: string): string[] {
  const variants: string[] = [];
  const trimmed = correctAnswer.trim();
  
  // 添加原始答案
  variants.push(trimmed);
  
  // 检查是否有括号内容
  const bracketMatch = trimmed.match(/\(([^)]+)\)/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1];
    const withoutBracket = trimmed.replace(/\([^)]+\)\s*/g, '').replace(/\s+/g, ' ').trim();
    const withBracketContent = trimmed.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
    
    if (withoutBracket && !variants.includes(withoutBracket)) {
      variants.push(withoutBracket);
    }
    if (withBracketContent && !variants.includes(withBracketContent)) {
      variants.push(withBracketContent);
    }
  }
  
  return variants;
}

// 检查输入是否匹配任一正确答案形式
export function checkSpellingAnswerWithVariants(input: string, correctAnswer: string): boolean {
  const variants = getAnswerVariants(correctAnswer);
  
  for (const variant of variants) {
    if (checkSpellingAnswer(input, variant)) {
      return true;
    }
  }
  
  return false;
}

import type { WordWithProgress } from '@/lib/types';
