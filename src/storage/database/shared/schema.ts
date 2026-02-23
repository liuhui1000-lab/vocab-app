import { pgTable, serial, timestamp, varchar, integer, text, boolean, index, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// ============================================
// 系统健康检查表（保留）
// ============================================
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============================================
// 学期表
// ============================================
export const semesters = pgTable(
  "semesters",
  {
    id: serial().notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),
    order: integer("order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("semesters_slug_idx").on(table.slug),
    index("semesters_order_idx").on(table.order),
  ]
);

// ============================================
// 单词表
// ============================================
export const vocabWords = pgTable(
  "vocab_words",
  {
    id: serial().notNull(),
    semesterId: integer("semester_id").notNull(),
    word: varchar("word", { length: 200 }).notNull(),
    phonetic: varchar("phonetic", { length: 200 }),
    meaning: text("meaning").notNull(),
    exampleEn: text("example_en"),
    exampleCn: text("example_cn"),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("vocab_words_semester_id_idx").on(table.semesterId),
    index("vocab_words_word_idx").on(table.word),
  ]
);

// ============================================
// 用户进度表
// ============================================
export const userProgress = pgTable(
  "user_progress",
  {
    id: serial().notNull(),
    userId: varchar("user_id", { length: 100 }).notNull(),
    wordId: integer("word_id").notNull(),
    semesterId: integer("semester_id").notNull(),
    state: varchar("state", { length: 20 }).notNull().default('new'),
    nextReview: timestamp("next_review", { withTimezone: true, mode: 'string' }),
    ef: integer("ef").notNull().default(25), // 记忆因子 * 10 (2.5 = 25)
    interval: integer("interval").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    penaltyProgress: integer("penalty_progress").notNull().default(0),
    inPenalty: boolean("in_penalty").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_progress_user_id_idx").on(table.userId),
    index("user_progress_word_id_idx").on(table.wordId),
    index("user_progress_semester_id_idx").on(table.semesterId),
    index("user_progress_user_semester_idx").on(table.userId, table.semesterId),
  ]
);

// ============================================
// 学习统计表
// ============================================
export const studyStats = pgTable(
  "study_stats",
  {
    id: serial().notNull(),
    userId: varchar("user_id", { length: 100 }).notNull(),
    semesterId: integer("semester_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    newCount: integer("new_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("study_stats_user_id_idx").on(table.userId),
    index("study_stats_date_idx").on(table.date),
    index("study_stats_user_date_idx").on(table.userId, table.date),
  ]
);

// ============================================
// Zod Schemas
// ============================================
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Semester schemas
export const insertSemesterSchema = createCoercedInsertSchema(semesters).pick({
  name: true,
  slug: true,
  description: true,
  order: true,
});

export const updateSemesterSchema = createCoercedInsertSchema(semesters)
  .pick({
    name: true,
    description: true,
    order: true,
    isActive: true,
  })
  .partial();

// VocabWord schemas
export const insertVocabWordSchema = createCoercedInsertSchema(vocabWords).pick({
  semesterId: true,
  word: true,
  phonetic: true,
  meaning: true,
  exampleEn: true,
  exampleCn: true,
  order: true,
});

// UserProgress schemas
export const insertUserProgressSchema = createCoercedInsertSchema(userProgress).pick({
  userId: true,
  wordId: true,
  semesterId: true,
  state: true,
});

export const updateUserProgressSchema = createCoercedInsertSchema(userProgress)
  .pick({
    state: true,
    nextReview: true,
    ef: true,
    interval: true,
    failureCount: true,
    penaltyProgress: true,
    inPenalty: true,
  })
  .partial();

// StudyStats schemas
export const insertStudyStatsSchema = createCoercedInsertSchema(studyStats).pick({
  userId: true,
  semesterId: true,
  date: true,
  newCount: true,
  reviewCount: true,
});

// ============================================
// TypeScript Types
// ============================================
export type Semester = typeof semesters.$inferSelect;
export type InsertSemester = z.infer<typeof insertSemesterSchema>;
export type UpdateSemester = z.infer<typeof updateSemesterSchema>;

export type VocabWord = typeof vocabWords.$inferSelect;
export type InsertVocabWord = z.infer<typeof insertVocabWordSchema>;

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UpdateUserProgress = z.infer<typeof updateUserProgressSchema>;

export type StudyStats = typeof studyStats.$inferSelect;
export type InsertStudyStats = z.infer<typeof insertStudyStatsSchema>;
