'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard, EmptyState } from '@/components/shared';
import { 
  Trophy, Gamepad2, Crosshair, CheckCircle2, User, MessageSquare, 
  ArrowLeft, Globe, Clock, ShieldCheck, History, Calendar, AlertCircle,
  Scale, ShieldAlert, BookOpen, ExternalLink, Lock
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Guild, PlayerStatistic, GuildMember, AccountStatus, PlayerGuildStatus, Sanction } from '@/types/database';
import { getAccountStatusBadge, getGuildStatusBadge } from '@/components/player-card';
import { getSanctionStatusBadge } from '@/app/discipline/[id]/page';

type EnrichedGuildMember = GuildMember & {
  guild?: Guild;
};

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.id as string;
  const [player, setPlayer] = useState<Profile | null>(null);
  const [playerGuild, setPlayerGuild] = useState<Guild | null>(null);
  const [membershipHistory, setMembershipHistory] = useState<EnrichedGuildMember[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStatistic | null>(null);
  const [playerSanctions, setPlayerSanctions] = useState<Sanction[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadPlayer() {
      try {
        setLoading(true);

        // Current session user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: uData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          if (uData) setCurrentUser(uData as Profile);
        }

        // 1. Fetch profile
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', playerId)
          .maybeSingle();

        if (!error && profileData) {
          setPlayer(profileData as Profile);

          // 2. Fetch all guild membership records (both active and historical)
          const { data: membersData } = await supabase
            .from('guild_members')
            .select('*, guild:guilds(*)')
            .eq('player_id', profileData.id)
            .order('joined_at', { ascending: false });

          if (membersData) {
            const history = membersData as unknown as EnrichedGuildMember[];
            setMembershipHistory(history);

            // Active membership
            const active = history.find(m => m.is_active);
            if (active && active.guild) {
              setPlayerGuild(active.guild);
            } else {
              // Check if player owns a guild
              const { data: ownedGuild } = await supabase
                .from('guilds')
                .select('*')
                .eq('owner_id', profileData.id)
                .maybeSingle();

              if (ownedGuild) {
                setPlayerGuild(ownedGuild as Guild);
              }
            }
          }

          // 3. Fetch Player Statistics
          const { data: statsData } = await supabase
            .from('player_statistics')
            .select('*')
            .eq('player_id', profileData.id)
            .maybeSingle();

          if (statsData) {
            setPlayerStats(statsData as PlayerStatistic);
          }

          // 4. Fetch Sanctions / Disciplinary records for this player
          const { data: sanctionsData } = await supabase
            .from('sanctions')
            .select('*')
            .eq('player_id', profileData.id)
            .order('issued_at', { ascending: false });

          if (sanctionsData) {
            setPlayerSanctions(sanctionsData as Sanction[]);
          }
        }
      } catch (err) {
        console.warn('Player load note:', err);
      } finally {
        setLoading(false);
      }
    }

    if (playerId) {
      loadPlayer();
    }
  }, [playerId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="container py-20 max-w-7xl mx-auto">
        <EmptyState 
          title="Player Not Found" 
          description="The player profile you are looking for does not exist in the official CAA database." 
          icon={<User className="h-12 w-12 text-destructive/50" />}
        />
        <div className="flex justify-center mt-6">
          <Button asChild>
            <Link href="/players">Back to Players</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isStaff = currentUser && ['admin', 'super_admin', 'moderator'].includes(currentUser.role);
  const activeSanctions = playerSanctions.filter(s => s.status === 'active');
  const historicalSanctions = playerSanctions.filter(s => s.status !== 'active');
  const hasActiveSuspension = activeSanctions.some(s => 
    s.sanction_type.includes('suspension') || s.sanction_type.includes('ban')
  );

  const matchesPlayed = playerStats?.matches_played || 0;
  const wins = playerStats?.wins || 0;
  const losses = playerStats?.losses || 0;
  const winRate = matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) + '%' : '0.0%';
  const mapsWon = playerStats?.maps_won || 0;
  const mapsLost = playerStats?.maps_lost || 0;

  const accountStatus = (player.account_status || (player.is_verified ? 'verified' : 'registered')) as AccountStatus;
  const guildStatus = (player.guild_status || (playerGuild ? 'active_member' : 'unaffiliated')) as PlayerGuildStatus;

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <div>
        <Link href="/players" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Players Directory
        </Link>
      </div>

      {/* Player Header */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-6 sm:p-8 shadow-sm">
        <div className="relative flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
          <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-zinc-800 shadow-xl bg-zinc-800 shrink-0">
            <AvatarImage src={player.avatar_url || ''} />
            <AvatarFallback className="text-3xl font-black text-blue-400">
              {player.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{player.display_name || player.username}</h1>
                <div className="flex flex-wrap items-center gap-1.5">
                  {getAccountStatusBadge(accountStatus)}
                  {getGuildStatusBadge(guildStatus, playerGuild ? { id: playerGuild.id, name: playerGuild.name, tag: playerGuild.tag } : undefined)}
                  {/* Distinct Competitive Eligibility vs Guild Membership distinction */}
                  {hasActiveSuspension ? (
                    <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/50 bg-red-950/30">
                      Competitive Eligibility: Suspended
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-950/20">
                      Competitive Eligibility: Eligible
                    </Badge>
                  )}
                  {activeSanctions.length > 0 && (
                    <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40 bg-amber-500/10 flex items-center gap-1">
                      <Scale className="w-2.5 h-2.5" />
                      Disciplinary: Active Sanction ({activeSanctions.length})
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono">@{player.username}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-400 pt-1">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Roblox Handle</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Gamepad2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  {player.roblox_username || '—'}
                </span>
                {player.roblox_id && (
                  <span className="text-[10px] text-zinc-500 font-mono">ID: {player.roblox_id}</span>
                )}
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Discord</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  {player.discord_username || '—'}
                </span>
                {player.discord_id && (
                  <span className="text-[10px] text-zinc-500 font-mono">ID: {player.discord_id}</span>
                )}
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Region / Country</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  {player.region || 'Global'} {player.country ? `(${player.country})` : ''}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Timezone</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  {player.timezone || 'UTC'}
                </span>
              </div>
            </div>

            {playerGuild ? (
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                <span className="text-xs text-zinc-400">Current Guild:</span>
                <Link href={`/guilds/${playerGuild.id}`} className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold text-sm">
                  <span className="bg-blue-600/20 border border-blue-500/30 px-1.5 py-0.5 rounded text-xs">
                    [{playerGuild.tag}]
                  </span>
                  {playerGuild.name}
                </Link>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/80">
                Current Affiliation: <span className="text-zinc-300 font-medium">Unaffiliated Competitor (Free Agent)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Matches Played" 
          value={String(matchesPlayed)} 
          subtitle="Official fixtures"
          icon={<Gamepad2 className="h-4 w-4 text-blue-400" />} 
        />
        <StatCard 
          title="Wins" 
          value={String(wins)} 
          subtitle="Match victories"
          icon={<Trophy className="h-4 w-4 text-amber-400" />} 
        />
        <StatCard 
          title="Losses" 
          value={String(losses)} 
          subtitle="Defeats"
          icon={<Crosshair className="h-4 w-4 text-red-400" />} 
        />
        <StatCard 
          title="Win Rate" 
          value={winRate} 
          subtitle="Career percentage"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} 
        />
      </div>

      {/* Profile Details Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-11 mb-8 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guild-history">Guild History</TabsTrigger>
          <TabsTrigger value="discipline">
            Disciplinary ({playerSanctions.length})
          </TabsTrigger>
          <TabsTrigger value="statistics">Career Stats</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-white text-base">Player Biography</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap">
                  {player.bio || "This competitor has not written a personal bio yet."}
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader>
                <CardTitle className="text-white text-base">Account & Competitive Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Account Status</span>
                  {getAccountStatusBadge(accountStatus)}
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Guild Status</span>
                  {getGuildStatusBadge(guildStatus, playerGuild ? { id: playerGuild.id, name: playerGuild.name, tag: playerGuild.tag } : undefined)}
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Eligibility</span>
                  <span className={`font-semibold text-xs ${hasActiveSuspension ? 'text-red-400' : 'text-emerald-400'}`}>
                    {hasActiveSuspension ? 'Suspended from Play' : 'Eligible for Competition'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Permanent Roblox ID</span>
                  <span className="font-mono text-zinc-300 text-xs">{player.roblox_id || 'Not linked'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Registered Date</span>
                  <span className="font-medium text-white">{new Date(player.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-zinc-400">Competitive Role</span>
                  <span className="font-medium text-white capitalize">{player.role.replace('_', ' ')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* GUILD MEMBERSHIP HISTORY TAB */}
        <TabsContent value="guild-history">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <div>
                  <CardTitle className="text-white text-base">Guild & Roster Career History</CardTitle>
                  <CardDescription className="text-zinc-400 text-xs">
                    Complete historical record of guild memberships across tournament seasons. Records are permanently archived.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {membershipHistory.length > 0 ? (
                <div className="space-y-4">
                  {membershipHistory.map((m) => (
                    <div 
                      key={m.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        m.is_active 
                          ? 'bg-zinc-900/80 border-emerald-500/30 ring-1 ring-emerald-500/20' 
                          : 'bg-zinc-950/60 border-zinc-800/80 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border ${
                            m.is_active 
                              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-400' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}>
                            {m.guild?.tag || 'GD'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-white text-sm">
                                {m.guild ? (
                                  <Link href={`/guilds/${m.guild.id}`} className="hover:text-blue-400 transition-colors">
                                    {m.guild.name}
                                  </Link>
                                ) : 'Guild'}
                              </h4>
                              {m.is_active ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                                  Active Member
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700 bg-zinc-800/40">
                                  Former Member
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Role: <span className="text-zinc-200 capitalize font-medium">{m.role.replace('_', ' ')}</span>
                              {m.joined_season && (
                                <> • Season: <span className="text-blue-400 font-medium">{m.joined_season}</span></>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-zinc-400 space-y-1 sm:text-right">
                          <div>
                            Joined: <span className="text-zinc-200">{new Date(m.joined_at).toLocaleDateString()}</span>
                          </div>
                          {m.left_at && (
                            <div>
                              Left: <span className="text-zinc-200">{new Date(m.left_at).toLocaleDateString()}</span>
                              {m.left_season && <span className="text-zinc-500 ml-1">({m.left_season})</span>}
                            </div>
                          )}
                          {m.removal_reason && (
                            <div className="text-zinc-500 italic text-[11px]">
                              Note: {m.removal_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!playerGuild && (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center text-xs text-zinc-500">
                      Currently unaffiliated free agent. Eligible to receive tournament guild invitations.
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState 
                  title="No guild history" 
                  description="This player has not yet joined any competitive guild rosters in the CAA League." 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISCIPLINARY RECORDS TAB */}
        <TabsContent value="discipline">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Scale className="w-5 h-5 text-yellow-500" />
                    Official Disciplinary Record
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs">
                    Sanctions and formal warnings issued by league officials.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-950/20">
                    {activeSanctions.length} Active
                  </Badge>
                  <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700 bg-zinc-800/40">
                    {historicalSanctions.length} Historical
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {playerSanctions.length > 0 ? (
                <div className="space-y-3">
                  {playerSanctions.map((sanction) => {
                    const isRecordPublic = sanction.is_public !== false || isStaff;
                    if (!isRecordPublic) return null;

                    return (
                      <div
                        key={sanction.id}
                        className={`p-4 rounded-xl border transition-all ${
                          sanction.status === 'active'
                            ? 'bg-zinc-900/80 border-red-500/30 ring-1 ring-red-500/10'
                            : 'bg-zinc-950/60 border-zinc-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/discipline/${sanction.sanction_code}`}
                                className="font-mono font-bold text-xs text-blue-400 hover:underline flex items-center gap-1"
                              >
                                {sanction.sanction_code}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                              {getSanctionStatusBadge(sanction.status)}
                              <Badge variant="outline" className="text-[10px] uppercase font-mono text-zinc-300">
                                {sanction.sanction_type.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-white text-sm">{sanction.violation}</h4>
                            <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                              <BookOpen className="w-3 h-3 text-zinc-500" />
                              <span>{sanction.rule_number}: {sanction.rule_title}</span>
                            </p>
                          </div>

                          <div className="text-xs text-zinc-400 space-y-0.5 sm:text-right">
                            <div>Issued: <strong className="text-zinc-200">{new Date(sanction.issued_at).toLocaleDateString()}</strong></div>
                            {sanction.expires_at ? (
                              <div>Expires: <strong className="text-zinc-200">{new Date(sanction.expires_at).toLocaleDateString()}</strong></div>
                            ) : sanction.is_permanent ? (
                              <div className="text-red-400 font-semibold">Permanent Ban</div>
                            ) : (
                              <div>Status: <span className="capitalize">{sanction.status}</span></div>
                            )}
                          </div>
                        </div>

                        {/* Public-safe decision summary */}
                        <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-300">
                          <p className="line-clamp-2 leading-relaxed">{sanction.decision_summary}</p>
                        </div>

                        {/* Staff-only confidential notice */}
                        {isStaff && sanction.additional_notes && (
                          <div className="mt-2 text-[11px] text-amber-300 bg-amber-950/20 p-2 rounded border border-amber-500/20 flex items-center gap-1.5">
                            <Lock className="w-3 h-3 shrink-0" />
                            <span>Staff Note: {sanction.additional_notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Clean Disciplinary Record"
                  description="This player has zero recorded penalties or rule infractions on file."
                  icon={<ShieldCheck className="w-10 h-10 text-emerald-400" />}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="statistics">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-white text-base">Season & Map Breakdown</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">Official telemetry recorded in CAA League fixtures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <p className="text-2xl font-black text-white">{mapsWon} - {mapsLost}</p>
                  <p className="text-xs text-zinc-400 mt-1">Maps Record (W - L)</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <p className="text-2xl font-black text-blue-400">{playerStats?.attack_wins || 0}</p>
                  <p className="text-xs text-zinc-400 mt-1">Attack Victories</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                  <p className="text-2xl font-black text-emerald-400">{playerStats?.defense_wins || 0}</p>
                  <p className="text-xs text-zinc-400 mt-1">Defense Victories</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-white text-base">Player Honors & Badges</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">Milestones unlocked during league tournament play</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'League Debutant', desc: 'Participate in your first official CAA League fixture' },
                  { name: 'Frontline Victor', desc: 'Secure a 2-0 map sweep during tournament group stage' },
                  { name: 'Flawless Tactician', desc: 'Maintain a 100% win rate through 3 series' },
                  { name: 'Iron Defender', desc: 'Win 5 defensive map assignments' },
                ].map((ach, i) => (
                  <div key={i} className="flex flex-col items-center justify-center p-5 text-center rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <Trophy className="h-8 w-8 text-zinc-600 mb-3" />
                    <h4 className="font-semibold text-xs text-white">{ach.name}</h4>
                    <p className="text-[11px] text-zinc-400 mt-1">{ach.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

