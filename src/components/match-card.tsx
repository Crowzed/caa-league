'use client';

import { motion } from 'framer-motion';
import { Trophy, Swords, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { Match, Guild } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: Match & { home_guild: Guild; away_guild: Guild };
  compact?: boolean;
}

export function MatchCard({ match, compact = false }: MatchCardProps) {
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';
  const isScheduled = match.status === 'scheduled';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/matches/${match.id}`}>
        <div
          className={cn(
            'relative rounded-lg border bg-zinc-900/50 backdrop-blur p-4 transition-all hover:border-zinc-600',
            isLive ? 'border-red-500/50 glow-red' : 'border-zinc-800',
            compact ? 'p-3' : 'p-4'
          )}
        >
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isLive && (
                <Badge variant="destructive" className="animate-pulse text-xs">
                  <span className="mr-1 h-2 w-2 rounded-full bg-white inline-block animate-ping" />
                  LIVE
                </Badge>
              )}
              {isScheduled && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="mr-1 h-3 w-3" />
                  Upcoming
                </Badge>
              )}
              {isCompleted && (
                <Badge variant="outline" className="text-xs">
                  <Trophy className="mr-1 h-3 w-3" />
                  Final
                </Badge>
              )}
              <span className="text-xs text-zinc-500">{match.format.toUpperCase()}</span>
            </div>
            {!compact && (
              <span className="text-xs text-zinc-500">
                {match.round || `Week ${match.week}`}
              </span>
            )}
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4">
            {/* Home Team */}
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-2">
                <div>
                  <p className={cn(
                    'font-semibold text-sm',
                    isCompleted && match.winner_id === match.home_guild_id
                      ? 'text-green-400'
                      : 'text-white'
                  )}>
                    {match.home_guild.name}
                  </p>
                  {!compact && (
                    <p className="text-xs text-zinc-500">[{match.home_guild.tag}]</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-blue-400 border border-zinc-700">
                  {match.home_guild.tag.slice(0, 2)}
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center min-w-[60px]">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-2xl font-bold',
                  isCompleted && match.winner_id === match.home_guild_id
                    ? 'text-green-400'
                    : 'text-white'
                )}>
                  {isScheduled ? '-' : match.home_score}
                </span>
                <Swords className="h-4 w-4 text-zinc-600" />
                <span className={cn(
                  'text-2xl font-bold',
                  isCompleted && match.winner_id === match.away_guild_id
                    ? 'text-green-400'
                    : 'text-white'
                )}>
                  {isScheduled ? '-' : match.away_score}
                </span>
              </div>
              {isScheduled && (
                <p className="text-xs text-zinc-400 mt-1">
                  <span suppressHydrationWarning>
                    {new Date(match.scheduled_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
              )}
              {isLive && (
                <p className="text-xs text-red-400 mt-1 animate-pulse">
                  In Progress
                </p>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-blue-400 border border-zinc-700">
                  {match.away_guild.tag.slice(0, 2)}
                </div>
                <div>
                  <p className={cn(
                    'font-semibold text-sm',
                    isCompleted && match.winner_id === match.away_guild_id
                      ? 'text-green-400'
                      : 'text-white'
                  )}>
                    {match.away_guild.name}
                  </p>
                  {!compact && (
                    <p className="text-xs text-zinc-500">[{match.away_guild.tag}]</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Match info footer */}
          {!compact && (
            <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-zinc-800">
              {match.referee && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Referee assigned
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
