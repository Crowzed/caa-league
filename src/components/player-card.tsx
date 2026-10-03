'use client';

import { motion } from 'framer-motion';
import { User, Trophy, Gamepad2, TrendingUp, Globe, Shield, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { Profile, AccountStatus, PlayerGuildStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface PlayerWithGuild extends Profile {
  activeGuild?: {
    id: string;
    name: string;
    tag: string;
    divisionId?: string;
    divisionName?: string;
    role?: string;
  } | null;
}

interface PlayerCardProps {
  player: PlayerWithGuild;
  stats?: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

export function getAccountStatusBadge(status?: AccountStatus) {
  switch (status) {
    case 'verified':
      return <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/50 bg-blue-500/10">Verified</Badge>;
    case 'suspended':
      return <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/50 bg-red-500/10">Suspended</Badge>;
    case 'retired':
      return <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/50 bg-purple-500/10">Retired</Badge>;
    case 'inactive':
      return <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700 bg-zinc-800/50">Inactive</Badge>;
    case 'registered':
    default:
      return <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700 bg-zinc-800/30">Registered</Badge>;
  }
}

export function getGuildStatusBadge(status?: PlayerGuildStatus, guild?: PlayerWithGuild['activeGuild']) {
  if (guild || status === 'active_member') {
    return (
      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1">
        <Trophy className="w-2.5 h-2.5" />
        {guild?.tag ? `[${guild.tag}] ${guild.name}` : 'Active Member'}
      </Badge>
    );
  }

  switch (status) {
    case 'pending_invitation':
      return <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40 bg-amber-500/10">Pending Invite</Badge>;
    case 'former_member':
      return <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800 bg-zinc-900">Former Member</Badge>;
    case 'unaffiliated':
    default:
      return <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800 bg-zinc-900/60">Unaffiliated</Badge>;
  }
}

export function PlayerCard({ player, stats }: PlayerCardProps) {
  const accountStatus = player.account_status || (player.is_verified ? 'verified' : 'registered');
  const guildStatus = player.guild_status || (player.activeGuild ? 'active_member' : 'unaffiliated');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/players/${player.id}`}>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-4 hover:border-blue-500/40 transition-all group flex flex-col justify-between h-full shadow-sm hover:shadow-blue-500/5">
          <div>
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-blue-500/50 transition-colors shrink-0 overflow-hidden">
                {player.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={player.avatar_url} alt={player.display_name || player.username} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-zinc-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors text-sm">
                    {player.display_name || player.username}
                  </h3>
                  <TrendingUp className="h-3.5 w-3.5 text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
                <p className="text-xs text-zinc-500 font-mono truncate">@{player.username}</p>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {getAccountStatusBadge(accountStatus)}
                  {getGuildStatusBadge(guildStatus, player.activeGuild)}
                </div>
              </div>
            </div>

            {/* Competitor Metadata */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/80 text-xs">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Roblox</span>
                <span className="text-zinc-300 font-medium truncate flex items-center gap-1" title={player.roblox_username || 'Not linked'}>
                  <Gamepad2 className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="truncate">{player.roblox_username || '—'}</span>
                </span>
                {player.roblox_id && (
                  <span className="text-[10px] text-zinc-500 font-mono block truncate">ID: {player.roblox_id}</span>
                )}
              </div>

              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Region</span>
                <span className="text-zinc-300 font-medium truncate flex items-center gap-1">
                  <Globe className="w-3 h-3 text-cyan-500/70 shrink-0" />
                  <span className="truncate">{player.region || 'Global'} {player.country ? `(${player.country})` : ''}</span>
                </span>
                {player.timezone && (
                  <span className="text-[10px] text-zinc-500 block truncate">{player.timezone}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats if available */}
          {stats && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/60 text-xs">
              <span className="text-zinc-400">{stats.matches} matches</span>
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-medium">{stats.wins}W</span>
                <span className="text-red-400 font-medium">{stats.losses}L</span>
                <span className={cn(
                  'font-semibold',
                  stats.winRate >= 60 ? 'text-emerald-400' :
                  stats.winRate >= 40 ? 'text-blue-400' : 'text-zinc-400'
                )}>
                  {stats.winRate}%
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
