'use client';

import React from 'react';
import Link from 'next/link';

const OPPONENTS = [
  {
    id: 'gemini',
    name: 'Gemini Pro',
    role: 'Speedster',
    difficulty: 'Easy',
    color: 'from-blue-400 to-cyan-500',
    avatar: '⚡',
    rewards: '100 XP'
  },
  {
    id: 'claude',
    name: 'Claude 3.5',
    role: 'Tactician',
    difficulty: 'Medium',
    color: 'from-orange-400 to-red-500',
    avatar: '🧠',
    rewards: '250 XP'
  },
  {
    id: 'gpt4',
    name: 'GPT-4o',
    role: 'Grandmaster',
    difficulty: 'Hard',
    color: 'from-purple-500 to-pink-600',
    avatar: '👑',
    rewards: '500 XP'
  }
];

export default function ArenaSelectionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-32">
      <header className="mb-8">
        <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent uppercase tracking-tighter">
          Arena Selection
        </h1>
        <p className="text-slate-400 mt-2">Choose your opponent and prove your logic.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {OPPONENTS.map((opp) => (
          <Link 
            href="/arena/battle" 
            key={opp.id}
            className="group relative bg-slate-900 rounded-2xl p-1 overflow-hidden transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${opp.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            <div className="relative bg-slate-900 rounded-xl p-6 h-full border border-slate-800 group-hover:border-transparent flex flex-col items-center text-center z-10">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${opp.color} flex items-center justify-center text-4xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                {opp.avatar}
              </div>
              
              <h2 className="text-2xl font-bold mb-1">{opp.name}</h2>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">{opp.role}</div>
              
              <div className="w-full bg-slate-800/50 rounded-lg p-3 mb-6">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Difficulty</span>
                  <span className={
                    opp.difficulty === 'Hard' ? 'text-red-400' : 
                    opp.difficulty === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                  }>{opp.difficulty}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Reward</span>
                  <span className="text-yellow-400 font-bold">{opp.rewards}</span>
                </div>
              </div>
              
              <div className="mt-auto w-full">
                <button className="w-full py-3 rounded-lg bg-slate-800 group-hover:bg-white group-hover:text-black font-bold transition-colors">
                  CHALLENGE
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-8 bg-slate-900/50 border border-slate-800 rounded-2xl max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <span className="text-3xl">🏆</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Rise Through the Ranks</h3>
        <p className="text-slate-400 mb-6">
          Every battle in the arena earns you points and contributes to your global standing.
        </p>
        <Link 
          href="/leaderboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-950 font-bold hover:bg-slate-200 transition-colors"
        >
          View Global Leaderboard
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
