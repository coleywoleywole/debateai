/**
 * Zod schemas for API request validation.
 * 
 * All API routes should use these schemas to validate incoming requests.
 */

import { z } from 'zod';

// Common field schemas
const debateIdSchema = z.string().min(1, 'Debate ID is required').max(100);
const topicSchema = z.string().min(1, 'Topic is required').max(500);
const opponentSchema = z.string().max(100).optional();
const opponentStyleSchema = z.string().max(200).optional();
const messageSchema = z.object({
  role: z.enum(['user', 'ai', 'system']),
  content: z.string().max(15000),
  aiAssisted: z.boolean().optional(),
  citations: z.array(z.object({
    id: z.number(),
    url: z.string().url(),
    title: z.string().max(500),
  })).max(20).optional(),
});

/**
 * POST /api/debate/create
 */
export const createDebateSchema = z.object({
  debateId: debateIdSchema,
  topic: topicSchema,
  character: opponentSchema,
  opponentStyle: opponentStyleSchema,
});
export type CreateDebateInput = z.infer<typeof createDebateSchema>;

/**
 * POST /api/debate
 */
export const sendMessageSchema = z.object({
  debateId: debateIdSchema.optional(), // Optional for new debates
  character: z.string().min(1, 'Character is required').max(200),
  opponentStyle: opponentStyleSchema,
  topic: topicSchema,
  userArgument: z.string().min(1, 'Argument is required').max(10000),
  previousMessages: z.array(messageSchema).max(30).optional().default([]),
  isAIAssisted: z.boolean().optional().default(false),
  promptVariant: z.enum(['aggressive', 'default']).optional(),
  // New Mechanics
  activePowerup: z.string().max(100).optional(),
  comboCount: z.number().int().min(0).max(1000).optional().default(0),
  currentMood: z.string().max(50).optional().default('neutral'),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * POST /api/debate/takeover
 */
export const takeoverSchema = z.object({
  debateId: debateIdSchema,
  topic: topicSchema,
  opponentStyle: opponentStyleSchema,
  previousMessages: z.array(messageSchema).max(30).optional().default([]),
});
export type TakeoverInput = z.infer<typeof takeoverSchema>;

/**
 * POST /api/debate/score
 */
export const scoreDebateSchema = z.object({
  debateId: debateIdSchema,
  topic: topicSchema,
  messages: z.array(messageSchema).min(2, 'At least 2 messages required for scoring').max(30),
  opponentName: z.string().max(200).optional(),
});
export type ScoreDebateInput = z.infer<typeof scoreDebateSchema>;

/**
 * POST /api/debate/judge
 */
export const judgeDebateSchema = z.object({
  debateId: debateIdSchema,
  topic: topicSchema,
  messages: z.array(messageSchema).min(2, 'At least 2 messages required for judging').max(30),
});
export type JudgeDebateInput = z.infer<typeof judgeDebateSchema>;

/**
 * GET /api/debate/[debateId]
 * No body schema needed, debateId comes from URL params
 */

/**
 * GET /api/debates
 * Query params validation
 */
export const listDebatesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});
export type ListDebatesQuery = z.infer<typeof listDebatesQuerySchema>;

/**
 * POST /api/stripe/create-checkout
 */
export const createCheckoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required').max(200),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
