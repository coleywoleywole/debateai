import { z } from 'zod';

// --- Types ---

export type StatusEffectType = 'stunned' | 'enraged' | 'silenced' | 'shielded' | 'burning' | 'frozen';

export interface StatusEffect {
  type: StatusEffectType;
  duration: number; // turns remaining
  intensity?: number; // e.g. amount of shield or damage
}

export interface ArenaState {
  userHp: number;
  aiHp: number;
  maxHp: number;
  comboCount: number;
  userEffects: StatusEffect[];
  aiEffects: StatusEffect[];
  turnCount: number;
  lastAction?: string;
}

// --- Zod Schemas ---

export const statusEffectSchema = z.object({
  type: z.enum(['stunned', 'enraged', 'silenced', 'shielded', 'burning', 'frozen']),
  duration: z.number().int().min(1),
  intensity: z.number().optional(),
});

export const arenaStateSchema = z.object({
  userHp: z.number().int().min(0),
  aiHp: z.number().int().min(0),
  maxHp: z.number().int().positive().default(100),
  comboCount: z.number().int().min(0).default(0),
  userEffects: z.array(statusEffectSchema).default([]),
  aiEffects: z.array(statusEffectSchema).default([]),
  turnCount: z.number().int().min(0).default(0),
  lastAction: z.string().optional(),
});

export type ArenaStateInput = z.infer<typeof arenaStateSchema>;

// For API endpoints that update arena state
export const updateArenaSchema = z.object({
  debateId: z.string().max(100),
  action: z.enum(['attack', 'defend', 'heal', 'special']),
  damage: z.number().min(0).max(50).optional(),
  cost: z.number().max(50).optional(),
});
