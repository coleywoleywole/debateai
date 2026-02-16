export function calculateRound(messageCount: number): number {
  // System (0)
  // Round 1: User (1), AI (2)
  // Round 2: User (3), AI (4)
  // Round 3: User (5), AI (6)
  // Formula: floor((messageCount - 1) / 2) + 1
  if (messageCount < 1) return 1;
  const round = Math.floor((messageCount - 1) / 2) + 1;
  return Math.max(1, Math.min(round, 3));
}

export function isDebateCompleted(messageCount: number): boolean {
  // Completed if we have System + 3 rounds (6 messages) = 7 total.
  return messageCount >= 7;
}
