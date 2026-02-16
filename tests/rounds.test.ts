import { describe, it, expect } from 'vitest';
import { calculateRound, isDebateCompleted } from '../src/lib/debate-state';

describe('Round Calculation', () => {
  it('should be Round 1 for first message (sys present)', () => {
    // Message count 1 (System)
    expect(calculateRound(1)).toBe(1);
  });

  it('should be Round 1 for second message (user present)', () => {
    // Message count 2 (System, User)
    // Round is 1 (floor((2-1)/2) + 1 = floor(0.5)+1 = 1)
    expect(calculateRound(2)).toBe(1);
  });

  it('should be Round 2 for third message (user + ai present)', () => {
    // Message count 3 (System, User, AI)
    // Round is 2 (floor((3-1)/2) + 1 = floor(1)+1 = 2)
    expect(calculateRound(3)).toBe(2);
  });

  it('should be Round 2 for fourth message (sys, u, a, u)', () => {
    // Message count 4
    expect(calculateRound(4)).toBe(2);
  });

  it('should be Round 3 for fifth message (sys, u, a, u, a)', () => {
    // Message count 5
    expect(calculateRound(5)).toBe(3);
  });

  it('should be Round 3 for sixth message (sys, u, a, u, a, u)', () => {
    // Message count 6
    expect(calculateRound(6)).toBe(3);
  });

  it('should cap at Round 3', () => {
    expect(calculateRound(7)).toBe(3);
    expect(calculateRound(10)).toBe(3);
  });
});

describe('Completion Logic', () => {
  it('should not be complete with 6 messages', () => {
    // Sys + 3U + 2AI = 6
    expect(isDebateCompleted(6)).toBe(false);
  });

  it('should be complete with 7 messages', () => {
    // Sys + 3U + 3AI = 7
    expect(isDebateCompleted(7)).toBe(true);
  });

  it('should be complete with > 7 messages', () => {
    expect(isDebateCompleted(8)).toBe(true);
  });
});
