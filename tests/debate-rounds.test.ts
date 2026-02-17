import { describe, it, expect } from 'vitest';
import { calculateRound, isDebateCompleted } from '../src/lib/debate-state';

describe('debate-state', () => {
  describe('calculateRound', () => {
    it('returns round 1 for 0-2 messages (system message counts as 1)', () => {
      // Message count includes system message
      expect(calculateRound(0)).toBe(1); // No messages, just starting
      expect(calculateRound(1)).toBe(1); // After system message
      expect(calculateRound(2)).toBe(1); // After user 1
    });

    it('returns round 2 for 3-4 messages', () => {
      expect(calculateRound(3)).toBe(2); // After AI 1
      expect(calculateRound(4)).toBe(2); // After user 2
    });

    it('returns round 3 for 5-6 messages', () => {
      expect(calculateRound(5)).toBe(3); // After AI 2
      expect(calculateRound(6)).toBe(3); // After user 3
    });

    it('caps at round 3', () => {
      expect(calculateRound(7)).toBe(3);
      expect(calculateRound(10)).toBe(3);
    });
  });

  describe('isDebateCompleted', () => {
    it('returns false before 7 messages', () => {
      expect(isDebateCompleted(0)).toBe(false);
      expect(isDebateCompleted(6)).toBe(false);
    });

    it('returns true for 7 or more messages', () => {
      expect(isDebateCompleted(7)).toBe(true);
      expect(isDebateCompleted(8)).toBe(true);
    });
  });
});
