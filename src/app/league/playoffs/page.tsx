'use client';

import { useState } from 'react';
import { Trophy, Crown, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared';
import { sampleGuilds, currentSeason } from '@/lib/sample-data';
import { cn } from '@/lib/utils';

export default function PlayoffBracketPage() {
  const [selectedDivision, setSelectedDivision] = useState('Grand League');

  const fallbackGuild = (name: string, tag: string) => ({
    id: tag.toLowerCase(),
    name,
    tag,
    logo_url: null,
    description: null,
    region: 'NA',
    discord_invite: null,
    owner_id: null,
    status: 'active' as const,
    division_id: null,
    created_at: '',
    updated_at: '',
  });

  const g0 = sampleGuilds[0] || fallbackGuild('TBD', 'TBD');
  const g1 = sampleGuilds[1] || fallbackGuild('TBD', 'TBD');
  const g2 = sampleGuilds[2] || fallbackGuild('TBD', 'TBD');
  const g3 = sampleGuilds[3] || fallbackGuild('TBD', 'TBD');

  // Interactive playoff bracket data
  const bracketData = {
    semifinals: [
      {
        id: 'semi-1',
        title: 'Semifinal A (Bo5)',
        status: 'scheduled',
        date: 'TBD',
        team1: { guild: g0, score: 0, isWinner: false, seed: 1 },
        team2: { guild: g3, score: 0, isWinner: false, seed: 4 },
      },
      {
        id: 'semi-2',
        title: 'Semifinal B (Bo5)',
        status: 'scheduled',
        date: 'TBD',
        team1: { guild: g1, score: 0, isWinner: false, seed: 2 },
        team2: { guild: g2, score: 0, isWinner: false, seed: 3 },
      },
    ],
    thirdPlace: {
      id: 'third-place',
      title: '3rd Place Decider (Bo5)',
      status: 'scheduled',
      date: 'TBD',
      team1: { guild: g3, score: 0, isWinner: false, seed: 4 },
      team2: { guild: g2, score: 0, isWinner: false, seed: 3 },
    },
    grandFinal: {
      id: 'grand-final',
      title: 'Grand Championship Final (Bo7)',
      status: 'scheduled',
      date: 'TBD',
      team1: { guild: g0, score: 0, isWinner: false, seed: 1 },
      team2: { guild: g1, score: 0, isWinner: false, seed: 2 },
    },
  };

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Championship Playoff Bracket"
        subtitle={`${currentSeason?.name || 'Upcoming Season'} — Visual Single Elimination Tournament Bracket`}
        breadcrumbs={[
          { label: 'League', href: '/league' },
          { label: 'Playoffs' },
        ]}
        action={
          <div className="flex gap-2">
            {['Grand League', 'Diamond League'].map((div) => (
              <Button
                key={div}
                variant={selectedDivision === div ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDivision(div)}
              >
                {div}
              </Button>
            ))}
          </div>
        }
      />

      {/* Bracket Visualizer Container */}
      <div className="relative overflow-x-auto py-8">
        <div className="min-w-[900px] flex items-center justify-between gap-12 px-6">
          
          {/* SEMIFINALS COLUMN */}
          <div className="flex-1 space-y-12">
            <div className="text-center font-bold text-sm tracking-wider uppercase text-zinc-400 border-b border-zinc-800 pb-2">
              Semifinals (Bo5)
            </div>

            {bracketData.semifinals.map((match) => (
              <div key={match.id} className="relative group">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-lg hover:border-blue-500/50 transition-all">
                  <div className="bg-zinc-950/70 px-3 py-1.5 border-b border-zinc-800 text-[11px] flex justify-between items-center text-zinc-400">
                    <span>{match.title}</span>
                    <Badge variant={match.status === 'completed' ? 'outline' : 'secondary'} className="text-[10px] h-4">
                      {match.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="p-3 space-y-2">
                    {/* Team 1 */}
                    <div className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-colors",
                      match.team1.isWinner ? "bg-blue-600/10 border border-blue-500/20 text-white font-bold" : "text-zinc-400"
                    )}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">#{match.team1.seed}</span>
                        <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-blue-400">
                          {match.team1.guild.tag}
                        </div>
                        <span className="text-sm">{match.team1.guild.name}</span>
                      </div>
                      <span className="text-lg font-black text-white">{match.team1.score}</span>
                    </div>

                    {/* Team 2 */}
                    <div className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-colors",
                      match.team2.isWinner ? "bg-blue-600/10 border border-blue-500/20 text-white font-bold" : "text-zinc-400"
                    )}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">#{match.team2.seed}</span>
                        <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-blue-400">
                          {match.team2.guild.tag}
                        </div>
                        <span className="text-sm">{match.team2.guild.name}</span>
                      </div>
                      <span className="text-lg font-black text-white">{match.team2.score}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CONNECTOR LINES VISUAL */}
          <div className="hidden lg:flex flex-col justify-around h-64 text-zinc-700">
            <ArrowRight className="w-8 h-8 opacity-40" />
            <ArrowRight className="w-8 h-8 opacity-40" />
          </div>

          {/* GRAND FINAL COLUMN */}
          <div className="flex-1 space-y-8">
            <div className="text-center font-bold text-sm tracking-wider uppercase text-amber-400 border-b border-amber-500/30 pb-2 flex items-center justify-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              Championship Grand Final (Bo7)
            </div>

            <div className="relative group">
              <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/5 overflow-hidden shadow-2xl glow-gold">
                <div className="bg-amber-950/40 px-4 py-2 border-b border-amber-500/30 text-xs flex justify-between items-center text-amber-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    {bracketData.grandFinal.title}
                  </span>
                  <Badge className="bg-amber-500 text-black text-[10px] font-bold">
                    CHAMPIONSHIP
                  </Badge>
                </div>

                <div className="p-4 space-y-3">
                  {/* Finalist 1 */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-amber-400 font-mono">#1</span>
                      <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center font-bold text-amber-400 border border-amber-500/40">
                        {bracketData.grandFinal.team1.guild.tag}
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">{bracketData.grandFinal.team1.guild.name}</p>
                        <p className="text-xs text-zinc-400">Regular Season Champion</p>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-zinc-500">-</span>
                  </div>

                  <div className="text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
                    VS
                  </div>

                  {/* Finalist 2 */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-amber-400 font-mono">#2</span>
                      <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center font-bold text-amber-400 border border-amber-500/40">
                        {bracketData.grandFinal.team2.guild.tag}
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">{bracketData.grandFinal.team2.guild.name}</p>
                        <p className="text-xs text-zinc-400">Challenger</p>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-zinc-500">-</span>
                  </div>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-amber-400 font-mono">
                      Scheduled: {bracketData.grandFinal.date}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3rd Place Decider Match */}
            <div className="pt-4">
              <div className="text-xs uppercase font-bold text-zinc-400 mb-2">
                Bronze Match (3rd Place)
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 flex justify-between items-center text-xs">
                <span>{bracketData.thirdPlace.team1.guild.tag} vs {bracketData.thirdPlace.team2.guild.tag}</span>
                <span className="text-zinc-500 font-mono">{bracketData.thirdPlace.date}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
