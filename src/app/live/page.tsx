'use client';

import { motion } from 'framer-motion';
import { Radio, Wifi, Swords, Clock, Map, Trophy, Zap, Calendar, ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Match, Guild, Division, MatchMap, GameMap } from '@/types/database';

type LiveMatchData = Match & {
  home_guild: Guild;
  away_guild: Guild;
  division?: Division | null;
  match_maps?: (MatchMap & { map?: GameMap })[];
};

export default function LiveMatchPage() {
  const [liveMatches, setLiveMatches] = useState<LiveMatchData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<LiveMatchData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchLiveMatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_guild:guilds!home_guild_id(*),
          away_guild:guilds!away_guild_id(*),
          division:divisions(*),
          match_maps(*, map:maps(*))
        `)
        .eq('status', 'live')
        .order('started_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const typed = data as unknown as LiveMatchData[];
        setLiveMatches(typed);
        setSelectedMatch(typed[0]);
      } else {
        setLiveMatches([]);
        setSelectedMatch(null);
      }
    } catch (err) {
      console.warn('Live match load note:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLiveMatches();

    // Poll for live status every 15 seconds
    const pollInterval = setInterval(() => {
      fetchLiveMatches();
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [fetchLiveMatches]);

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }

  // If no live match currently in progress
  if (!selectedMatch) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <Radio className="h-8 w-8 animate-pulse" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white">No Live Matches Broadcast</h1>
            <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
              There are currently no official CAA League fixtures in progress. When referee check-in completes and a match goes live, real-time telemetry will appear here automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button asChild className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs font-semibold">
              <Link href="/matches">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                View Match Schedule
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 border-zinc-700 text-xs text-zinc-300">
              <Link href="/league">
                <Trophy className="w-3.5 h-3.5 mr-1.5" />
                League Standings
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const home = selectedMatch.home_guild;
  const away = selectedMatch.away_guild;
  const currentMaps = selectedMatch.match_maps || [];
  const activeMap = currentMaps.find((m) => m.status === 'in_progress') || currentMaps[0];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Live Header Banner */}
      <div className="bg-gradient-to-r from-red-950/60 via-zinc-900 to-zinc-950 border-b border-red-500/30">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="animate-pulse bg-red-600 text-white font-bold">
              <Wifi className="mr-1 h-3 w-3" />
              LIVE BROADCAST
            </Badge>
            <span className="text-sm text-zinc-300 font-medium">
              {selectedMatch.division?.name || 'Championship'} — {selectedMatch.round || 'Tournament Stage'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-red-400 font-bold bg-black/40 px-3 py-1 rounded-md border border-red-500/20">
              MATCH TIME: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLiveMatches}
              className="text-xs text-zinc-400 hover:text-white gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* If multiple live matches, show selector */}
        {liveMatches.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {liveMatches.map((m) => (
              <Button
                key={m.id}
                variant={selectedMatch.id === m.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMatch(m)}
                className="text-xs"
              >
                {m.home_guild.tag} vs {m.away_guild.tag}
              </Button>
            ))}
          </div>
        )}

        {/* Live Scoreboard */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-red-500/30 bg-zinc-900/80 backdrop-blur p-8 mb-8 shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {/* Home Guild */}
            <div className="text-center flex-1 max-w-[200px]">
              <Link href={`/guilds/${home.id}`} className="group inline-block">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-800 flex items-center justify-center text-2xl md:text-3xl font-black text-blue-400 border border-zinc-700 mx-auto group-hover:border-blue-500 transition-colors shadow-lg">
                  {home.tag}
                </div>
                <h2 className="text-lg md:text-xl font-bold text-white mt-3 group-hover:text-blue-400 transition-colors truncate">
                  {home.name}
                </h2>
                <p className="text-xs text-zinc-500">[{home.tag}] — Home</p>
              </Link>
            </div>

            {/* Score Center */}
            <div className="text-center">
              <div className="flex items-center gap-4">
                <span className="text-5xl md:text-7xl font-black text-white">{selectedMatch.home_score}</span>
                <div className="flex flex-col items-center">
                  <Swords className="h-8 w-8 text-zinc-600" />
                  <span className="text-xs text-zinc-500 font-bold mt-1">VS</span>
                </div>
                <span className="text-5xl md:text-7xl font-black text-white">{selectedMatch.away_score}</span>
              </div>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-300">
                  {selectedMatch.format.toUpperCase()} Series
                </Badge>
              </div>
            </div>

            {/* Away Guild */}
            <div className="text-center flex-1 max-w-[200px]">
              <Link href={`/guilds/${away.id}`} className="group inline-block">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-800 flex items-center justify-center text-2xl md:text-3xl font-black text-blue-400 border border-zinc-700 mx-auto group-hover:border-blue-500 transition-colors shadow-lg">
                  {away.tag}
                </div>
                <h2 className="text-lg md:text-xl font-bold text-white mt-3 group-hover:text-blue-400 transition-colors truncate">
                  {away.name}
                </h2>
                <p className="text-xs text-zinc-500">[{away.tag}] — Away</p>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Live Details Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Active Map / Game */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-red-400 animate-pulse" />
                <h3 className="text-lg font-bold text-white">Active Map Status</h3>
              </div>

              {activeMap ? (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <Map className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-white">{activeMap.map?.name || 'Tournament Battleground'}</p>
                    <p className="text-xs text-zinc-500">Game {activeMap.game_number || 1}</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <Clock className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-white">In Progress</p>
                    <p className="text-xs text-zinc-500">Active Map Round</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <Trophy className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-white">{activeMap.home_score ?? 0} - {activeMap.away_score ?? 0}</p>
                    <p className="text-xs text-zinc-500">Current Map Score</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">No specific map registered for this live session yet.</p>
              )}
            </div>

            {/* Match Center Quick Link */}
            <div className="flex justify-end">
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5">
                <Link href={`/matches/${selectedMatch.id}`}>
                  Full Match Center Details <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="font-bold text-white mb-3">Live Fixture Info</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Division</span>
                  <span className="text-white font-medium">{selectedMatch.division?.name || 'Premier'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Match Format</span>
                  <span className="text-white font-medium uppercase">{selectedMatch.format}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Scheduled Start</span>
                  <span className="text-white font-medium">
                    {new Date(selectedMatch.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
