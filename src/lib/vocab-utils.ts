// Utility functions for vocabulary app

// Generate or get user ID
export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  
  let userId = localStorage.getItem('vocab_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('vocab_user_id', userId);
  }
  return userId;
}

// Format date to YYYY-MM-DD
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Calculate next review time based on SM-2 algorithm
export function calculateNextReview(
  success: boolean,
  currentEf: number,
  currentInterval: number
): { ef: number; interval: number; nextReview: Date } {
  let ef = currentEf;
  let interval = currentInterval;
  
  if (success) {
    if (interval === 0) {
      interval = 1;
    } else {
      interval = Math.ceil(interval * (ef / 10));
    }
    ef = Math.min(25, ef + 1); // max 2.5
  } else {
    ef = Math.max(13, ef - 2); // min 1.3
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

import type { WordWithProgress } from './types';
