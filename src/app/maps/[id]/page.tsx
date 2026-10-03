'use client';

import { useState, useEffect, use } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/shared';
import { Map as MapIcon, ShieldAlert, Crosshair, Target, Flag, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { OFFICIAL_MAP_NAMES, OFFICIAL_MAP_DEFAULTS, OfficialMapName } from '@/lib/maps/map-service';
import type { GameMap, MatchMap, Guild } from '@/types/database';

interface GuildPerformance {
  guild: Guild;
  matches: number;
  wins: number;
  winRate: number;
}

export default function MapProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const mapId = resolvedParams.id;
  const [map, setMap] = useState<GameMap | null>(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [attackWinRate, setAttackWinRate] = useState(0);
  const [defenseWinRate, setDefenseWinRate] = useState(0);
  const [guildPerformances, setGuildPerformances] = useState<GuildPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadMapData() {
      try {
        setIsLoading(true);

        // 1. Fetch map by id or name
        const cleanName = decodeURIComponent(mapId).replace(/-/g, ' ');
        const { data: mapData } = await supabase
          .from('maps')
          .select('*')
          .or(`id.eq.${mapId},name.ilike.%${cleanName}%`)
          .maybeSingle();

        let targetMap: GameMap | null = null;
        if (mapData) {
          targetMap = mapData as GameMap;
          setMap(targetMap);
        } else {
          // Check if mapId matches an official map name or default
          const matchedName = OFFICIAL_MAP_NAMES.find(
            (n) => n.toLowerCase() === cleanName.toLowerCase()
          );
          if (matchedName) {
            const def = OFFICIAL_MAP_DEFAULTS[matchedName];
            targetMap = {
              id: mapId,
              name: matchedName,
              image_url: def.image_url,
              description: def.description,
              map_type: 'competitive',
              type: 'Official',
              objectives: def.objectives,
              layout_info: def.layout_info,
              status: 'active',
              is_official: true,
              is_competitive: true,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setMap(targetMap);
          }
        }

        if (targetMap) {
          // 2. Fetch match telemetry for this map
          const { data: matchMaps } = await supabase
            .from('match_maps')
            .select('*, match:matches(*)')
            .eq('map_id', targetMap.id);

          const completed = (matchMaps as unknown as MatchMap[] || []).filter(mm => mm.status === 'completed');
          setTotalMatches(completed.length);

          if (completed.length > 0) {
            const atkWins = completed.filter(mm => mm.home_side === 'attack' && mm.winner_id).length;
            const atkRate = Math.round((atkWins / completed.length) * 100);
            setAttackWinRate(atkRate);
            setDefenseWinRate(100 - atkRate);

            // Group guild performances
            const guildStatsMap = new Map<string, { matches: number; wins: number }>();
            for (const mm of completed) {
              if (mm.winner_id) {
                const cur = guildStatsMap.get(mm.winner_id) || { matches: 0, wins: 0 };
                cur.matches += 1;
                cur.wins += 1;
                guildStatsMap.set(mm.winner_id, cur);
              }
            }

            const guildIds = Array.from(guildStatsMap.keys());
            if (guildIds.length > 0) {
              const { data: guildsData } = await supabase
                .from('guilds')
                .select('*')
                .in('id', guildIds);

              if (guildsData) {
                const perfs: GuildPerformance[] = (guildsData as Guild[]).map(g => {
                  const s = guildStatsMap.get(g.id)!;
                  return {
                    guild: g,
                    matches: s.matches,
                    wins: s.wins,
                    winRate: Math.round((s.wins / s.matches) * 100),
                  };
                }).sort((a, b) => b.winRate - a.winRate);
                setGuildPerformances(perfs);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Map profile load note:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (mapId) {
      loadMapData();
    }
  }, [mapId, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!map) {
    return (
      <div className="container py-20 max-w-7xl mx-auto">
        <EmptyState 
          title="Map Not Found" 
          description="The competitive map you are looking for does not exist in the official CAA database." 
          icon={<ShieldAlert className="h-12 w-12 text-destructive/50" />}
        />
        <div className="flex justify-center mt-6">
          <Button asChild>
            <Link href="/maps">Back to Maps</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <div>
        <Link href="/maps" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Maps Pool
        </Link>
      </div>

      {/* Map Header */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm h-64 md:h-80">
        <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
          {map.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={map.image_url} alt={map.name} className="w-full h-full object-cover opacity-60" />
          ) : (
            <MapIcon className="h-32 w-32 text-zinc-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        </div>
        
        <div className="absolute bottom-0 left-0 p-8 w-full flex flex-col md:flex-row items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-zinc-900/80 backdrop-blur-md border-yellow-500/40 text-yellow-400 text-xs">
                Official Map
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                Status: {(map.status || 'Active').toUpperCase()}
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">
                Competitive: {map.is_competitive ?? true ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant="outline" className="bg-zinc-900/80 backdrop-blur-md border-zinc-700 text-zinc-300 text-xs">
                {(map.map_type || 'Competitive Arena').replace(/_/g, ' ')}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{map.name}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-white">Map Overview & Strategic Objectives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-zinc-400 leading-relaxed text-sm">
                {map.description || "Official CAA League tournament battleground. Features strategic chokepoints and key tactical sectors requiring disciplined frontline coordination."}
              </p>
              {map.objectives && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">Key Objectives</h4>
                  <p className="text-xs text-zinc-400">{map.objectives}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-white">Guild Performance</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">Top performing guilds on {map.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {guildPerformances.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Guild</TableHead>
                      <TableHead className="text-center text-zinc-400">Matches</TableHead>
                      <TableHead className="text-center text-zinc-400">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guildPerformances.map((perf, i) => (
                      <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-800/20">
                        <TableCell className="font-medium text-white">
                          <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded text-xs mr-2 border border-blue-500/30">
                            [{perf.guild.tag}]
                          </span>
                          {perf.guild.name}
                        </TableCell>
                        <TableCell className="text-center text-zinc-400">{perf.matches}</TableCell>
                        <TableCell className="text-center text-emerald-400 font-semibold">{perf.winRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-zinc-500 text-sm">
                  <p className="font-medium text-zinc-400">No match records on this map yet</p>
                  <p className="text-xs text-zinc-500 mt-1">Guild win rates will calculate automatically once official fixtures are recorded on this map.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-white">Map Telemetry</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">Side balance and match frequency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600/10 p-3 rounded-xl text-blue-400 border border-blue-500/20">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Total Matches</p>
                  <p className="text-2xl font-bold text-white">{totalMatches}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-red-500/10 p-3 rounded-xl text-red-400 border border-red-500/20">
                  <Flag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Attack Win Rate</p>
                  <p className="text-2xl font-bold text-red-400">
                    {totalMatches > 0 ? `${attackWinRate}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Crosshair className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Defense Win Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {totalMatches > 0 ? `${defenseWinRate}%` : '—'}
                  </p>
                </div>
              </div>

              {totalMatches > 0 ? (
                <div className="pt-2">
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-800">
                    <div className="bg-red-500" style={{ width: `${attackWinRate}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${defenseWinRate}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[11px] text-zinc-500">
                    <span>Attack ({attackWinRate}%)</span>
                    <span>Defense ({defenseWinRate}%)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center italic pt-2">
                  Awaiting tournament matches
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
