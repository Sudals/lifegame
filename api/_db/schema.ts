import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  nickname: text('nickname').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saves = pgTable(
  'saves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .references(() => players.id, { onDelete: 'cascade' })
      .notNull(),
    slot: integer('slot').notNull(), // 1~3
    gameVersion: text('game_version').notNull(), // 세이브 마이그레이션용
    data: jsonb('data').notNull(), // 직렬화된 GameState
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('saves_player_slot_idx').on(t.playerId, t.slot)],
);

/** 엔딩 기록 = 랭킹 */
export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id').references(() => players.id, { onDelete: 'set null' }),
    nickname: text('nickname').notNull(),
    major: text('major').notNull(), // 'ai'
    labId: text('lab_id').notNull(),
    career: text('career').notNull(),
    score: integer('score').notNull(),
    grade: text('grade').notNull(),
    papers: jsonb('papers').notNull(), // [{venue, tier, authorOrder}]
    seed: text('seed').notNull(), // 검증/재현용
    finishedAt: timestamp('finished_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('runs_major_score_idx').on(t.major, t.score)],
);
