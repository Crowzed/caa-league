'use client';

import { motion } from 'framer-motion';
import { Trophy, TrendingUp, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { Guild } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GuildCardProps {
  guild: Guild;
  rank?: number;
  record?: { wins: number; losses: number; draws: number };
  showDivision?: boolean;
}

export function GuildCard({ guild, rank, record, showDivision = true }: GuildCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/guilds/${guild.id}`}>
        <div className="relative rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur p-4 hover:border-blue-500/30 transition-all group">
          {/* Rank badge */}
          {rank && (
            <div className={cn(
              'absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2',
              rank === 1 ? 'bg-amber-500 border-amber-400 text-black' :
              rank === 2 ? 'bg-zinc-400 border-zinc-300 text-black' :
              rank === 3 ? 'bg-amber-700 border-amber-600 text-white' :
              'bg-zinc-700 border-zinc-600 text-white'
            )}>
              {rank}
            </div>
          )}

          <div className="flex items-start gap-3">
            {/* Guild Logo */}
            <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center text-lg font-bold text-blue-400 border border-zinc-700 group-hover:border-blue-500/50 transition-colors shrink-0">
              {guild.tag}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                  {guild.name}
                </h3>
                <Badge variant="outline" className="text-xs shrink-0">
                  {guild.tag}
                </Badge>
              </div>

              {/* Info row */}
              <div className="flex items-center gap-3 mt-1">
                {guild.region && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {guild.region}
                  </span>
                )}
                {showDivision && guild.division && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    {guild.division.name}
                  </span>
                )}
              </div>

              {/* Record */}
              {record && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-green-400">{record.wins}W</span>
                  {record.draws > 0 && (
                    <span className="text-xs text-zinc-400">{record.draws}D</span>
                  )}
                  <span className="text-xs text-red-400">{record.losses}L</span>
                  <span className="text-xs text-zinc-500">
                    ({Math.round((record.wins / (record.wins + record.losses + record.draws)) * 100) || 0}%)
                  </span>
                </div>
              )}
            </div>

            {/* Arrow indicator */}
            <TrendingUp className="h-4 w-4 text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0 mt-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
