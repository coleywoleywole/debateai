# Backend Performance Audit - 2026-02-15

## Database Latency (D1)

✅ **List Debates (100 rows)**: 97.77ms
✅ **Get Single Debate (Avg 10)**: 102.34ms
✅ **Get Vote Counts**: 109.48ms
✅ **Get Leaderboard (Top 10)**: 109.26ms

## Stalled Debates Investigation

Checking for debates where the user sent the last message but AI did not respond (potential backend timeout/crash).

**Found 0 stalled debates in the last 50.**

✅ No stalled debates found in recent history. Backend seems to be responding.
