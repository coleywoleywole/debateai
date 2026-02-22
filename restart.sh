#!/bin/bash
# Quick rebuild + restart for testing
pkill -f "next start" 2>/dev/null
cd /Users/spud/debateai
npx next build && npx next start --hostname 0.0.0.0
