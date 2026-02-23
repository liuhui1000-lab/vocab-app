// Types for the vocabulary app

export interface Semester {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  is_active: boolean;
  created_at: string;
}

export interface VocabWord {
  id: number;
  semester_id: number;
  word: string;
  phonetic: string | null;
  meaning: string;
  example_en: string | null;
  example_cn: string | null;
  order: number;
  created_at: string;
}

export interface UserProgress {
  id: number;
  username: string;
  word_id: number;
  semester_id: number;
  state: 'new' | 'learning' | 'review';
  next_review: string | null;
  ef: number;
  interval: number;
  failure_count: number;
  penalty_progress: number;
  in_penalty: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudyStats {
  id: number;
  username: string;
  semester_id: number;
  date: string;
  new_count: number;
  review_count: number;
  created_at: string;
}

// Word with progress for learning session
export interface WordWithProgress extends VocabWord {
  progress?: UserProgress;
  tempStep?: number;
  inPenalty?: boolean;
  penaltyProgress?: number;
  isNewThisSession?: boolean;
}

// App state
export interface AppState {
  username: string;
  selectedSemesters: number[];
  words: WordWithProgress[];
  progress: UserProgress[];
  stats: StudyStats[];
}

// Session word for learning
export interface SessionWord extends WordWithProgress {
  tempStep: number;
  inPenalty: boolean;
  penaltyProgress: number;
  isNewThisSession: boolean;
}
