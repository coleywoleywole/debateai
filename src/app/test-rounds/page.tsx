"use client";

import { Suspense } from "react";
import DebateClient from "../debate/[debateId]/DebateClient";

export default function TestRoundsPage() {
  const mockDebate = {
    id: "test-rounds",
    topic: "Is pineapple on pizza a crime?",
    opponent: "gordon-ramsay",
    character: "gordon-ramsay",
    opponentStyle: "Gordon Ramsay",
    messages: [
      { role: "system", content: "Welcome to the kitchen arena!" },
      { role: "user", content: "I love pineapple on pizza. It's delicious." }
    ],
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Suspense fallback={<div>Loading...</div>}>
        <DebateClient 
          initialDebate={mockDebate as any}
          initialMessages={mockDebate.messages as any}
          initialIsOwner={true}
        />
      </Suspense>
    </div>
  );
}
