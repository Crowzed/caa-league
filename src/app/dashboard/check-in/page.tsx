'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, Shield, Server, MapPin, 
  CheckCircle2, RefreshCw, Check, Play, AlertCircle, Lock,
  Scale, UserX
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/shared';
import { sampleMatches, sampleGuilds, sampleMaps } from '@/lib/sample-data';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Guild, Match, Profile, Sanction } from '@/types/database';

export default function MatchCheckInPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [userGuild, setUserGuild] = useState<Guild | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);

  // Disciplinary & Roster state
  const [rosterMembers, setRosterMembers] = useState<Array<{ id: string; player_id: string; role: string; player?: Profile }>>([]);
  const [suspendedPlayerSanctions, setSuspendedPlayerSanctions] = useState<Record<string, Sanction>>({});
  const [guildSanction, setGuildSanction] = useState<Sanction | null>(null);
  const [selectedStarters, setSelectedStarters] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const [homeCheckedIn, setHomeCheckedIn] = useState(false);
  const [awayCheckedIn, setAwayCheckedIn] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 mins in seconds

  const supabase = createClient();

  useEffect(() => {
    async function loadUserAndMatch() {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Check guild membership & role
          const { data: memberData } = await supabase
            .from('guild_members')
            .select('role, guild:guilds(*)')
            .eq('player_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          let targetGuild: Guild | null = null;
          let cap = false;

          if (memberData && memberData.guild) {
            targetGuild = memberData.guild as unknown as Guild;
            if (memberData.role === 'captain' || memberData.role === 'co_captain') {
              cap = true;
            }
          } else {
            // Check if user is owner of a guild
            const { data: ownedGuild } = await supabase
              .from('guilds')
              .select('*')
              .eq('owner_id', user.id)
              .maybeSingle();
            if (ownedGuild) {
              targetGuild = ownedGuild as Guild;
              cap = true;
            }
          }

          if (targetGuild) {
            if (targetGuild.owner_id === user.id) {
              cap = true;
            }
            setUserGuild(targetGuild);
            setIsCaptain(cap);

            // 1. Check if the guild itself is under an active Guild Suspension
            const { data: gSanction } = await supabase
              .from('sanctions')
              .select('*')
              .eq('guild_id', targetGuild.id)
              .eq('status', 'active')
              .in('sanction_type', ['guild_suspension', 'competitive_ban', 'tournament_ban', 'disqualification'])
              .maybeSingle();

            if (gSanction) {
              setGuildSanction(gSanction as Sanction);
            }

            // 2. Fetch actual guild roster
            const { data: mData } = await supabase
              .from('guild_members')
              .select('id, player_id, role, player:profiles!player_id(*)')
              .eq('guild_id', targetGuild.id)
              .eq('is_active', true);

            if (mData && mData.length > 0) {
              const list = mData as unknown as Array<{ id: string; player_id: string; role: string; player?: Profile }>;
              setRosterMembers(list);

              // 3. Query active player suspensions for each roster member
              const playerIds = list.map(m => m.player_id).filter(Boolean);
              if (playerIds.length > 0) {
                const { data: pSanctions } = await supabase
                  .from('sanctions')
                  .select('*')
                  .in('player_id', playerIds)
                  .eq('status', 'active')
                  .in('sanction_type', ['player_suspension', 'match_suspension', 'competitive_ban', 'tournament_ban', 'temporary_ban', 'permanent_ban']);

                const sMap: Record<string, Sanction> = {};
                if (pSanctions && pSanctions.length > 0) {
                  pSanctions.forEach(s => {
                    if (s.player_id) sMap[s.player_id] = s as Sanction;
                  });
                  setSuspendedPlayerSanctions(sMap);
                }

                // Default auto-select up to 4 eligible (non-suspended) players
                const eligible = list.filter(m => !sMap[m.player_id]);
                setSelectedStarters(eligible.slice(0, 4).map(m => m.player_id));
              }
            }

            // 4. Fetch active or upcoming match for this guild
            const { data: matchData } = await supabase
              .from('matches')
              .select('*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)')
              .or(`home_guild_id.eq.${targetGuild.id},away_guild_id.eq.${targetGuild.id}`)
              .in('status', ['check_in', 'scheduled', 'live'])
              .order('scheduled_at', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (matchData) {
              setActiveMatch(matchData as Match);
            }
          }
        }
      } catch (err) {
        console.warn('Check-in load note:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserAndMatch();
  }, [supabase]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSimulateAwayCheckIn = () => {
    setAwayCheckedIn(true);
  };

  const isBothCheckedIn = homeCheckedIn && awayCheckedIn;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // 1. If user does NOT belong to any guild
  if (!userGuild) {
    return (
      <div className="container py-8 max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Official Match Check-In"
          subtitle="Confirm guild readiness, roster validation, and join the match lobby"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Check-In' },
          ]}
        />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">No Guild Associated</h3>
            <p className="text-xs text-zinc-400">
              You must be registered as a member of a guild to access match check-ins. If you are a team captain, register your guild first.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/guilds/register">
              <Button className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium text-xs">
                Register a Guild
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="border-zinc-700 text-xs">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. If user is in a guild, but is NOT a captain / co-captain
  if (!isCaptain) {
    return (
      <div className="container py-8 max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Official Match Check-In"
          subtitle="Confirm guild readiness, roster validation, and join the match lobby"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Check-In' },
          ]}
        />
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">Captain Authorization Required</h3>
            <p className="text-xs text-zinc-300">
              You are currently registered as a team member of <strong>{userGuild.name}</strong>. Only the designated Guild Captain or Co-Captain has permission to submit official match check-ins.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/dashboard">
              <Button variant="outline" className="border-zinc-700 text-xs text-zinc-200">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. If Guild itself is under an active Guild Suspension
  if (guildSanction) {
    return (
      <div className="container py-8 max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Official Match Check-In"
          subtitle="Confirm guild readiness, roster validation, and join the match lobby"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Check-In' },
          ]}
        />
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
            <Scale className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <Badge variant="destructive" className="uppercase font-mono text-xs">
              {guildSanction.sanction_type.replace(/_/g, ' ')}
            </Badge>
            <h3 className="text-xl font-bold text-white">Guild Under Official League Suspension</h3>
            <p className="text-xs text-red-200">
              <strong>{userGuild.name}</strong> is currently serving an active disciplinary sanction (<span className="font-mono font-bold">{guildSanction.sanction_code}</span>).
            </p>
            <div className="p-4 bg-zinc-900/80 rounded-lg border border-red-500/20 text-xs text-zinc-300 text-left space-y-1">
              <p className="font-semibold text-white">Violation: {guildSanction.violation}</p>
              <p className="text-zinc-400 leading-relaxed">{guildSanction.decision_summary}</p>
              {guildSanction.expires_at && (
                <p className="text-[11px] text-zinc-500 pt-1">
                  Active until: {new Date(guildSanction.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Match check-ins and tournament server credentials are withheld until this sanction expires or is overturned by an official appeal.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link href={`/discipline/${guildSanction.sanction_code}`}>
              <Button className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs">
                View Sanction & File Appeal
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="border-zinc-700 text-xs text-zinc-300">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. User is Captain, but no matches currently requiring check-in
  const match = activeMatch || sampleMatches[0];
  const homeGuild = (match as { home_guild?: Guild })?.home_guild || userGuild;
  const awayGuild = (match as { away_guild?: Guild })?.away_guild || sampleGuilds[1] || null;

  if (!match || !awayGuild) {
    return (
      <div className="container py-8 max-w-6xl mx-auto space-y-8">
        <PageHeader
          title="Official Match Check-In"
          subtitle="Confirm guild readiness, roster validation, and join the match lobby"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Check-In' },
          ]}
        />
        <EmptyState
          icon={Shield}
          title="No Upcoming Matches Awaiting Check-In"
          description={`Your team (${userGuild.name}) does not have an active match scheduled in the check-in window. Check-in opens 15 minutes before official match start times.`}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title={`Official Match Check-In: ${match.round || 'Round 1'}`}
        subtitle={`Confirm guild readiness for ${homeGuild.name} vs ${awayGuild.name}, roster validation, and join the match lobby`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Check-In' },
        ]}
      />

      {/* Check-in Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-blue-400">
              Check-In Window
            </CardDescription>
            <CardTitle className="text-2xl font-mono flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              {formatCountdown(countdown)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-400">
              Window closes 5 minutes before scheduled match start time.
            </p>
          </CardContent>
        </Card>

        <Card className={cn("border-zinc-800", isBothCheckedIn ? "border-green-500/30 bg-green-500/5" : "bg-zinc-900/50")}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-zinc-400">
              Match Status
            </CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {isBothCheckedIn ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">Lobby Ready</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                  <span className="text-amber-400">Awaiting Check-Ins</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-400">
              {isBothCheckedIn ? 'Both captains have checked in. Server access granted.' : '1 of 2 guilds checked in.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider text-zinc-400">
              Assigned Referee
            </CardDescription>
            <CardTitle className="text-xl flex items-center gap-2 text-white">
              <Shield className="w-5 h-5 text-blue-400" />
              RefKnight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
              Referee Online & Ready
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Disciplinary Error / Validation Alert */}
      {selectionError && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/30 flex items-start gap-3 text-xs text-red-200 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-red-400 block mb-0.5">Disciplinary Ineligibility Warning</span>
            <span>{selectionError}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-6 px-2 text-zinc-400 hover:text-white"
            onClick={() => setSelectionError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Guild Check-in Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Home Guild */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-blue-400 border border-zinc-700">
                {homeGuild.tag}
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{homeGuild.name}</h3>
                <p className="text-xs text-zinc-400">Home Guild • {homeGuild.region || 'Official'}</p>
              </div>
            </div>
            {homeCheckedIn ? (
              <Badge variant="default" className="gap-1 bg-emerald-600 text-white">
                <Check className="w-3 h-3" /> Checked In
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-amber-400 border-amber-500/30">
                Pending Check-In
              </Badge>
            )}
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Starting Lineup ({homeCheckedIn ? '4/4 Confirmed' : `${selectedStarters.length}/4 Selected`})
              </span>
              {!homeCheckedIn && (
                <span className="text-[11px] text-zinc-400">
                  Select 4 eligible starters
                </span>
              )}
            </div>

            {/* Roster member selection list */}
            {rosterMembers.length > 0 ? (
              <div className="space-y-2">
                {rosterMembers.map((member) => {
                  const isSuspended = Boolean(suspendedPlayerSanctions[member.player_id]);
                  const sanction = suspendedPlayerSanctions[member.player_id];
                  const isSelected = selectedStarters.includes(member.player_id);
                  const playerName = member.player?.display_name || member.player?.username || 'Team Member';

                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        if (homeCheckedIn) return;
                        if (isSuspended) {
                          setSelectionError(
                            `Selection Denied: ${playerName} is suspended (${sanction.sanction_code}) for: ${sanction.violation}. Ineligible for official fixtures.`
                          );
                          return;
                        }
                        if (selectedStarters.includes(member.player_id)) {
                          setSelectedStarters(prev => prev.filter(id => id !== member.player_id));
                        } else {
                          if (selectedStarters.length >= 4) {
                            setSelectionError('A match roster permits exactly 4 active starters. Deselect another player first.');
                            return;
                          }
                          setSelectedStarters(prev => [...prev, member.player_id]);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer",
                        isSuspended
                          ? "bg-red-950/20 border-red-500/40 opacity-75 cursor-not-allowed"
                          : isSelected
                          ? "bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/30"
                          : "bg-zinc-800/40 border-zinc-800 hover:border-zinc-700"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {isSuspended ? (
                          <UserX className="w-4 h-4 text-red-400 shrink-0" />
                        ) : isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-zinc-600 shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{playerName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">@{member.player?.username}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 capitalize">{member.role}</span>
                        </div>
                      </div>

                      <div>
                        {isSuspended ? (
                          <Badge variant="destructive" className="text-[9px] uppercase font-mono">
                            Suspended ({sanction.sanction_code})
                          </Badge>
                        ) : isSelected ? (
                          <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                            Starter
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700">
                            Bench
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {['Player 1', 'Player 2', 'Player 3', 'Player 4'].map((name) => (
                  <div key={name} className="flex items-center gap-2 p-2 rounded bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            )}

            {!homeCheckedIn && (
              <div className="pt-2">
                <Button
                  className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={selectedStarters.length !== 4 && rosterMembers.length >= 4}
                  onClick={() => {
                    const hasSuspended = selectedStarters.some(id => suspendedPlayerSanctions[id]);
                    if (hasSuspended) {
                      setSelectionError('Lineup contains one or more suspended players. Replace them before check-in.');
                      return;
                    }
                    setHomeCheckedIn(true);
                    setSelectionError(null);
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Confirm 4-Player Lineup & Check In
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Away Guild */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-blue-400 border border-zinc-700">
                {awayGuild.tag}
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{awayGuild.name}</h3>
                <p className="text-xs text-zinc-400">Away Guild • {awayGuild.region || 'Official'}</p>
              </div>
            </div>
            {awayCheckedIn ? (
              <Badge variant="default" className="gap-1 bg-emerald-600 text-white">
                <Check className="w-3 h-3" /> Checked In
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-amber-400 border-amber-500/30">
                Pending Check-In
              </Badge>
            )}
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-4">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Roster Readiness
            </div>
            {awayCheckedIn ? (
              <div className="grid grid-cols-2 gap-2">
                {['Away Starter 1', 'Away Starter 2', 'Away Starter 3', 'Away Starter 4'].map((name) => (
                  <div key={name} className="flex items-center gap-2 p-2 rounded bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-zinc-800/20 border border-dashed border-zinc-800 text-center space-y-2">
                <p className="text-xs text-zinc-400">
                  Awaiting {awayGuild.name} captain check-in confirmation...
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs h-7"
                  onClick={handleSimulateAwayCheckIn}
                >
                  Simulate Away Guild Check-In
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Official Match Lobby (Revealed when both check in) */}
      {isBothCheckedIn && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-blue-500/40 bg-zinc-900/70 p-8 space-y-6 glow-blue"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="live">LOBBY ACTIVE</Badge>
                <span className="text-xs text-zinc-400">CAA Official Competition Server</span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Official Match Lobby</h2>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/live">
                <Button variant="default" className="gap-2">
                  <Play className="w-4 h-4" />
                  Open Live Match Center
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase">
                <Server className="w-4 h-4 text-blue-400" />
                Roblox Server Details
              </div>
              <p className="text-sm font-mono text-zinc-200">Server: CAA-COMP-US-01</p>
              <p className="text-xs text-zinc-500">Access Key: CAA-2026-LIVE</p>
              <Button size="sm" variant="outline" className="w-full text-xs mt-2">
                Copy Join Link
              </Button>
            </div>

            <div className="space-y-2 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase">
                <MapPin className="w-4 h-4 text-amber-400" />
                Official Map Pool (Competitive)
              </div>
              <p className="text-xs text-zinc-300">Game 1: Plains</p>
              <p className="text-xs text-zinc-300">Game 2: Thermopylae</p>
              <p className="text-xs text-zinc-300">Game 3: Castle</p>
              <p className="text-xs text-zinc-400">Game 4/5 (Tiebreaker): Fortress</p>
            </div>

            <div className="space-y-2 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase">
                <Shield className="w-4 h-4 text-green-400" />
                Official Referee Notes
              </div>
              <p className="text-xs text-zinc-400">
                &quot;Standard draft sequence. 3-minute warm-up before Game 1 launch.&quot;
              </p>
              <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                Rulebook Version 2.0
              </Badge>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
