'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Standing, Guild } from '@/types/database';

interface StandingsTableProps {
  standings: (Standing & { guild: Guild })[];
  showDivision?: boolean;
  compact?: boolean;
  highlightTop?: number;
  highlightBottom?: number;
  promotionSpots?: number;
  playoffSpots?: number;
  relegationSpots?: number;
  showLegend?: boolean;
}

export function StandingsTable({
  standings,
  compact = false,
  highlightTop,
  highlightBottom,
  promotionSpots,
  playoffSpots,
  relegationSpots,
  showLegend = true,
}: StandingsTableProps) {
  const sorted = [...standings].sort((a, b) => a.rank - b.rank);

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm">
        No standings recorded for this division yet.
      </div>
    );
  }

  // Determine qualification thresholds:
  // 1. Promotion (Green): Top N teams promote directly
  const numPromotion = typeof promotionSpots === 'number' ? Math.max(0, promotionSpots) : 0;

  // 2. Playoffs (Blue): Top N teams that advance to playoffs
  const numPlayoffs = typeof playoffSpots === 'number'
    ? Math.max(0, playoffSpots)
    : (typeof highlightTop === 'number' ? highlightTop : (promotionSpots !== undefined ? 0 : 4));

  // 3. Relegation (Red): Bottom N teams that get relegated
  const numRelegation = typeof relegationSpots === 'number'
    ? Math.max(0, relegationSpots)
    : (typeof highlightBottom === 'number' ? highlightBottom : 2);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
            <th className="text-left py-3 px-2 w-12">#</th>
            <th className="text-left py-3 px-2">Guild</th>
            {!compact && <th className="text-center py-3 px-2">MP</th>}
            <th className="text-center py-3 px-2">W</th>
            <th className="text-center py-3 px-2">D</th>
            <th className="text-center py-3 px-2">L</th>
            {!compact && <th className="text-center py-3 px-2">Maps</th>}
            <th className="text-center py-3 px-2">Pts</th>
            {!compact && <th className="text-center py-3 px-2">Form</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((standing, i) => {
            const guildName = standing.guild?.name || 'Unknown Guild';
            const guildTag = standing.guild?.tag || 'GLD';
            const formList = (standing.form || '')
              .replace(/,/g, '')
              .split('')
              .slice(-5);

            return (
              <motion.tr
                key={standing.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors',
                  standing.rank <= numPromotion && 'border-l-2 border-l-emerald-500',
                  standing.rank > numPromotion && standing.rank <= numPlayoffs && 'border-l-2 border-l-blue-500',
                  sorted.length > 0 && numRelegation > 0 && standing.rank > sorted.length - numRelegation && 'border-l-2 border-l-red-500'
                )}
              >
                <td className="py-3 px-2">
                  <span
                    className={cn(
                      'font-bold',
                      standing.rank === 1
                        ? 'text-amber-400'
                        : standing.rank === 2
                        ? 'text-zinc-300'
                        : standing.rank === 3
                        ? 'text-amber-600'
                        : 'text-zinc-500'
                    )}
                  >
                    {standing.rank}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-zinc-700">
                      {guildTag.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{guildName}</p>
                      {!compact && <p className="text-xs text-zinc-500">[{guildTag}]</p>}
                    </div>
                  </div>
                </td>
                {!compact && (
                  <td className="py-3 px-2 text-center text-zinc-400">
                    {standing.matches_played}
                  </td>
                )}
                <td className="py-3 px-2 text-center text-green-400 font-medium">
                  {standing.wins}
                </td>
                <td className="py-3 px-2 text-center text-zinc-400">
                  {standing.draws}
                </td>
                <td className="py-3 px-2 text-center text-red-400 font-medium">
                  {standing.losses}
                </td>
                {!compact && (
                  <td className="py-3 px-2 text-center text-zinc-400">
                    {standing.maps_won}-{standing.maps_lost}
                  </td>
                )}
                <td className="py-3 px-2 text-center font-bold text-white">
                  {standing.points}
                </td>
                {!compact && (
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {formList.length === 0 ? (
                        <span className="text-xs text-zinc-600">-</span>
                      ) : (
                        formList.map((result, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              'w-5 h-5 rounded-sm flex items-center justify-center text-xs font-bold',
                              result === 'W'
                                ? 'bg-green-600 text-white'
                                : result === 'L'
                                ? 'bg-red-600 text-white'
                                : 'bg-zinc-600 text-white'
                            )}
                          >
                            {result}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {showLegend && !compact && (numPromotion > 0 || numPlayoffs > numPromotion || numRelegation > 0) && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-zinc-800/60 bg-zinc-900/40 text-xs text-zinc-400">
          {numPromotion > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <span>Promotion ({numPromotion === 1 ? 'Rank 1' : `Top ${numPromotion}`})</span>
            </div>
          )}
          {numPlayoffs > numPromotion && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
              <span>
                Playoffs ({numPromotion > 0 ? (numPlayoffs === numPromotion + 1 ? `Rank ${numPlayoffs}` : `Ranks ${numPromotion + 1}–${numPlayoffs}`) : `Top ${numPlayoffs}`})
              </span>
            </div>
          )}
          {numRelegation > 0 && sorted.length > numRelegation && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
              <span>Relegation (Bottom {numRelegation})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
