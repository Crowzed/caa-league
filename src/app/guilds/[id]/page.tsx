'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { sampleGuilds, sampleProfiles, sampleMatches } from '@/lib/sample-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard, EmptyState } from '@/components/shared';
import { MatchCard } from '@/components/match-card';
import { Trophy, Users, Crosshair, Map, ShieldAlert, CheckCircle2, MessageSquare, Scale, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import type { Guild, Profile, Sanction } from '@/types/database';
import { getSanctionStatusBadge } from '@/app/discipline/[id]/page';

export default function GuildProfilePage() {
  const params = useParams();
  const guildId = params.id as string;
  const initialGuild = sampleGuilds.find(g => g.id === guildId) || null;
  const [guild, setGuild] = useState<Guild | null>(initialGuild);
  const [roster, setRoster] = useState<Array<{ id: string; role: string; joined_at: string; profile: Profile }>>([]);
  const [standing, setStanding] = useState<{ rank: number; points: number; form: string; wins: number; draws: number; losses: number } | null>(null);
  const [recentMatches, setRecentMatches] = useState<Array<Parameters<typeof MatchCard>[0]['match']>>(
    sampleMatches.filter(m => m.home_guild_id === guildId || m.away_guild_id === guildId)
  );
  const [guildSanctions, setGuildSanctions] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadGuild() {
      try {
        const { data, error } = await supabase
          .from('guilds')
          .select('*')
          .eq('id', guildId)
          .maybeSingle();

        if (!error && data) {
          setGuild(data as Guild);

          // Load roster from guild_members
          const { data: memberData } = await supabase
            .from('guild_members')
            .select('id, role, joined_at, profile:profiles(*)')
            .eq('guild_id', guildId);

          if (memberData && memberData.length > 0) {
            setRoster(memberData as unknown as Array<{ id: string; role: string; joined_at: string; profile: Profile }>);
          } else {
            // Fallback for sample profile preview
            const fallbackMembers = sampleProfiles
              .filter(p => (p as { guild_id?: string }).guild_id === guildId)
              .map(p => ({
                id: p.id,
                role: p.role === 'guild_captain' ? 'captain' : 'player',
                joined_at: p.created_at,
                profile: p,
              }));
            setRoster(fallbackMembers);
          }

          // Load current standing
          const { data: standData } = await supabase
            .from('standings')
            .select('*')
            .eq('guild_id', guildId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (standData) {
            setStanding(standData);
          }

          // Also load matches for this guild
          const { data: matchData } = await supabase
            .from('matches')
            .select('*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)')
            .or(`home_guild_id.eq.${guildId},away_guild_id.eq.${guildId}`)
            .order('scheduled_at', { ascending: false });

          if (matchData && matchData.length > 0) {
            setRecentMatches(matchData as unknown as Array<Parameters<typeof MatchCard>[0]['match']>);
          }

          // Load sanctions for this guild
          const { data: sanctionsData } = await supabase
            .from('sanctions')
            .select('*')
            .eq('guild_id', guildId)
            .order('issued_at', { ascending: false });

          if (sanctionsData) {
            setGuildSanctions(sanctionsData as Sanction[]);
          }
        } else if (initialGuild) {
          setGuild(initialGuild);
        }
      } catch (err) {
        console.warn('Guild load note:', err);
      } finally {
        setLoading(false);
      }
    }
    loadGuild();
  }, [guildId, supabase, initialGuild]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="container py-20 max-w-7xl mx-auto">
        <EmptyState 
          title="Guild Not Found" 
          description="The guild you are looking for does not exist or has been removed." 
          icon={<ShieldAlert className="h-12 w-12 text-destructive/50" />}
        />
        <div className="flex justify-center mt-6">
          <Button asChild>
            <Link href="/guilds">Back to Guilds</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      {/* Guild Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldAlert className="h-48 w-48" />
        </div>
        
        <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="h-32 w-32 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-4xl font-black text-primary">{guild.tag}</span>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tight">{guild.name}</h1>
                <Badge variant={guild.status === 'active' ? 'default' : 'secondary'}>
                  {guild.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="bg-background/50">[{guild.tag}]</Badge>
                {guild.region && (
                  <Badge variant="outline" className="bg-background/50">{guild.region}</Badge>
                )}
                <Badge variant="outline" className="bg-background/50">{guild.division?.name || 'Grand League'}</Badge>

                {/* Disciplinary Sanctions Status Indicators */}
                {guildSanctions.filter(s => s.status === 'active').map(s => {
                  const label = 
                    s.sanction_type === 'guild_probation' ? 'Probation' :
                    s.sanction_type.includes('suspension') || s.sanction_type.includes('ban') ? 'Under Suspension' :
                    s.sanction_type === 'roster_restriction' ? 'Roster Restricted' :
                    'Active Sanction';

                  return (
                    <Link key={s.id} href={`/discipline/${s.sanction_code}`}>
                      <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer">
                        <Scale className="w-3 h-3" />
                        {label} [{s.sanction_code}]
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </div>
            
            <p className="text-muted-foreground max-w-2xl">
              {guild.description || "A registered guild in the CAA League."}
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" />
              Discord
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Global Rank" 
          value={guild.ranking ? `#${guild.ranking}` : 'Unranked'} 
          icon={<Trophy className="h-4 w-4" />} 
        />
        <StatCard 
          title="Roster Size" 
          value={`${roster.length} Players`} 
          icon={<Users className="h-4 w-4" />} 
        />
        <StatCard 
          title="Season Record" 
          value={standing ? `${standing.wins} - ${standing.draws} - ${standing.losses}` : '0 - 0 - 0'} 
          description="W - D - L"
          icon={<Crosshair className="h-4 w-4" />} 
        />
        <StatCard 
          title="Win Rate" 
          value={
            standing && (standing.wins + standing.losses + standing.draws) > 0
              ? `${Math.round((standing.wins / (standing.wins + standing.losses + standing.draws)) * 100)}%`
              : '0.0%'
          } 
          icon={<CheckCircle2 className="h-4 w-4" />} 
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-12 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roster">Roster ({roster.length})</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="discipline">Disciplinary ({guildSanctions.length})</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>About {guild.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {guild.description || `${guild.name} is an official competitive esports guild participating in the CAA League.`}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Current Season</CardTitle>
                <CardDescription>Division Standing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Position</span>
                  <span className="font-bold">{standing ? `#${standing.rank}` : 'Unranked'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Points</span>
                  <span className="font-bold">{standing ? standing.points : 0} PTS</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Form</span>
                  <div className="flex gap-1">
                    {standing?.form ? (
                      standing.form.replace(/,/g, '').split('').slice(-5).map((res, i) => (
                        <Badge key={i} className={`px-1.5 py-0 h-5 border-none font-bold ${
                          res === 'W' ? 'bg-green-500/20 text-green-400' :
                          res === 'L' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {res}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">0-0-0 (New Guild)</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="roster">
          <Card>
            <CardHeader>
              <CardTitle>Active Roster</CardTitle>
              <CardDescription>Members currently playing for {guild.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {roster.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Roblox Handle</TableHead>
                      <TableHead>Discord</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((member) => {
                      const profile = member.profile || {
                        id: member.id,
                        username: 'Player',
                        display_name: 'Player',
                        roblox_username: 'roblox_player',
                        discord_username: 'discord#0000',
                      };
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
                                  {(profile.display_name || profile.username || 'P').substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Link href={`/players/${profile.id}`} className="hover:underline font-bold text-white block">
                                  {profile.display_name || profile.username}
                                </Link>
                                <span className="text-[11px] text-zinc-400">@{profile.username}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={member.role === 'captain' ? 'default' : member.role === 'co_captain' ? 'secondary' : 'outline'}
                              className={
                                member.role === 'captain' 
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                  : member.role === 'co_captain'
                                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  : member.role === 'substitute'
                                  ? 'border-zinc-700 text-zinc-400'
                                  : 'border-zinc-700 text-zinc-300'
                              }
                            >
                              {member.role.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-xs font-mono">
                            {profile.roblox_username || '—'}
                          </TableCell>
                          <TableCell className="text-zinc-400 text-xs font-mono">
                            {profile.discord_username || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/players/${profile.id}`}>View Profile</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="No players found" description="This guild currently has no active members on their roster." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="matches">
          <Card>
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
              <CardDescription>Latest results across all competitions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentMatches.length > 0 ? (
                <div className="space-y-4">
                  {recentMatches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No matches found" description="This guild hasn't played any matches yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* DISCIPLINARY TAB */}
        <TabsContent value="discipline">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-5 h-5 text-yellow-500" />
                    Official Guild Disciplinary Record
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sanctions, forfeits, and formal disciplinary rulings issued against this organization.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-950/20">
                    {guildSanctions.filter(s => s.status === 'active').length} Active
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground border-border bg-card">
                    {guildSanctions.filter(s => s.status !== 'active').length} Historical
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {guildSanctions.length > 0 ? (
                <div className="space-y-3">
                  {guildSanctions.map((sanction) => (
                    <div
                      key={sanction.id}
                      className={`p-4 rounded-xl border transition-all ${
                        sanction.status === 'active'
                          ? 'bg-card/90 border-red-500/30 ring-1 ring-red-500/10'
                          : 'bg-card/40 border-border/50'
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
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {sanction.sanction_type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <h4 className="font-semibold text-sm">{sanction.violation}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-muted-foreground" />
                            <span>{sanction.rule_number}: {sanction.rule_title}</span>
                          </p>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5 sm:text-right">
                          <div>Issued: <strong className="text-foreground">{new Date(sanction.issued_at).toLocaleDateString()}</strong></div>
                          {sanction.expires_at ? (
                            <div>Expires: <strong className="text-foreground">{new Date(sanction.expires_at).toLocaleDateString()}</strong></div>
                          ) : sanction.is_permanent ? (
                            <div className="text-red-400 font-semibold">Permanent Ruling</div>
                          ) : (
                            <div>Status: <span className="capitalize">{sanction.status}</span></div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                        <p className="line-clamp-2 leading-relaxed">{sanction.decision_summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Clean Disciplinary Record"
                  description="This guild has no recorded penalties, roster sanctions, or match forfeits on file."
                  icon={<ShieldCheck className="w-10 h-10 text-emerald-400" />}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>Season Statistics</CardTitle>
              <CardDescription>Performance metrics for the current season</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center border-dashed border-2 border-border/50 rounded-lg bg-card/50">
              <p className="text-muted-foreground flex items-center gap-2">
                <Map className="h-5 w-5" />
                Detailed statistics coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements">
          <Card>
            <CardHeader>
              <CardTitle>Guild Achievements</CardTitle>
              <CardDescription>Trophies and milestones earned</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex flex-col items-center justify-center p-6 text-center rounded-xl bg-card border border-border/50">
                    <Trophy className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h4 className="font-semibold text-sm">Achievement Locked</h4>
                    <p className="text-xs text-muted-foreground mt-1">Complete a season to earn.</p>
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
