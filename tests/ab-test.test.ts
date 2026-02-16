import { describe, it, expect } from 'vitest';

describe('A/B Variant Assignment', () => {
  const getVariant = (userId: string) => {
    const lastChar = userId.slice(-1);
    return lastChar.charCodeAt(0) % 2 === 0 ? 'aggressive' : 'default';
  };

  it('should assign variants deterministically based on userId', () => {
    // Ends in even ASCII
    expect(getVariant('user_0')).toBe('aggressive'); // '0' = 48
    expect(getVariant('user_2')).toBe('aggressive'); // '2' = 50
    expect(getVariant('user_b')).toBe('aggressive'); // 'b' = 98
    
    // Ends in odd ASCII
    expect(getVariant('user_1')).toBe('default');    // '1' = 49
    expect(getVariant('user_3')).toBe('default');    // '3' = 51
    expect(getVariant('user_a')).toBe('default');    // 'a' = 97
  });

  it('should handle guest IDs (UUIDs)', () => {
    // UUIDs end in a random hex char
    expect(getVariant('guest_...0')).toBe('aggressive');
    expect(getVariant('guest_...1')).toBe('default');
  });
});
