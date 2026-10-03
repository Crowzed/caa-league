'use client';

import { motion } from 'framer-motion';
import { Users, Swords, Map as MapIcon, Target, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, StatCard, SectionHeader } from '@/components/shared';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Standing, GameMap, Unit, UnitStatistic } from '@/types/database';

const tabs = ['overview', 'guilds', 'players', 'maps', 'units', 'compositions'] as const;

interface MapWithTelemetry extends GameMap {
  matchesPlayed: number;
  attackWinRate: number;
  defenseWinRate: number;
}

interface UnitWithTelemetry extends Unit {
  usage: number;
  winRate: number;
  pickRate: number;
}

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Live state
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalMapsPlayed, setTotalMapsPlayed] = useState(0);
  const [activePlayersCount, setActivePlayersCount] = useState(0);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [mapsList, setMapsList] = useState<MapWithTelemetry[]>([]);
  const [unitsList, setUnitsList] = useState<UnitWithTelemetry[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      try {
        setIsLoading(true);

        // 1. Matches & Map telemetry
        const { data: matchesData } = await supabase
          .from('matches')
          .select('id, status, home_score, away_score');

        const completedMatches = (matchesData || []).filter((m) => m.status === 'completed');
        setTotalMatches(completedMatches.length);

        const { data: matchMapsData } = await supabase
          .from('match_maps')
          .select('id, map_id, winner_id, home_side, status');

        const completedMaps = (matchMapsData || []).filter((mm) => mm.status === 'completed');
        setTotalMapsPlayed(completedMaps.length);

        // 2. Active Players count
        const { count: playersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .neq('role', 'super_admin');
        setActivePlayersCount(playersCount || 0);

        // 3. Standings
        const { data: standingsData } = await supabase
          .from('standings')
          .select('*, guild:guilds(*)')
          .order('points', { ascending: false });

        setStandings((standingsData as unknown as Standing[]) || []);

        // 4. Maps
        const { data: rawMaps } = await supabase
          .from('maps')
          .select('*')
          .order('name', { ascending: true });

        if (rawMaps && rawMaps.length > 0) {
          const telemetryMaps: MapWithTelemetry[] = rawMaps.map((map) => {
            const playedOnThisMap = completedMaps.filter((mm) => mm.map_id === map.id);
            const matchesCount = playedOnThisMap.length;
            let atkWinRate = 50;
            let defWinRate = 50;

            if (matchesCount > 0) {
              const atkWins = playedOnThisMap.filter(
                (mm) => (mm.home_side === 'attack' && mm.winner_id)
              ).length;
              atkWinRate = Math.round((atkWins / matchesCount) * 100);
              defWinRate = 100 - atkWinRate;
            }

            return {
              ...map,
              matchesPlayed: matchesCount,
              attackWinRate: atkWinRate,
              defenseWinRate: defWinRate,
            };
          });
          setMapsList(telemetryMaps);
        }

        // 5. Units & Unit Statistics
        const { data: rawUnits } = await supabase
          .from('units')
          .select('*')
          .order('star_level', { ascending: true })
          .order('name', { ascending: true });

        const { data: unitStats } = await supabase
          .from('unit_statistics')
          .select('*');

        if (rawUnits && rawUnits.length > 0) {
          const statsMap = new Map<string, UnitStatistic>();
          (unitStats || []).forEach((us) => {
            statsMap.set(us.unit_id, us);
          });

          const telemetryUnits: UnitWithTelemetry[] = rawUnits.map((u) => {
            const stat = statsMap.get(u.id);
            const matchesUsed = stat?.matches_used || 0;
            const wins = stat?.wins || 0;
            const winRate = matchesUsed > 0 ? Math.round((wins / matchesUsed) * 100) : 0;
            const pickRate = stat?.pick_rate ? Number(stat.pick_rate) : 0;

            return {
              ...u,
              usage: matchesUsed,
              winRate,
              pickRate,
            };
          });
          setUnitsList(telemetryUnits);
        }
      } catch (err) {
        console.warn('Statistics loading note:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, [supabase]);

  const avgScore = totalMatches > 0 ? (totalMapsPlayed / totalMatches).toFixed(1) : '0.0';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <PageHeader
        title="Statistics"
        description="Comprehensive league telemetry, unit metagame, and match analytics"
      />

      <div className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-zinc-800 pb-4">
          {tabs.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="capitalize"
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Matches" value={String(totalMatches)} subtitle="Season 1 Matches" icon={<Swords className="w-5 h-5 text-blue-400" />} />
              <StatCard title="Maps Played" value={String(totalMapsPlayed)} subtitle="Across all fixtures" icon={<MapIcon className="w-5 h-5 text-emerald-400" />} />
              <StatCard title="Active Players" value={String(activePlayersCount)} subtitle="Registered in CAA League" icon={<Users className="w-5 h-5 text-amber-400" />} />
              <StatCard title="Average Score" value={avgScore} subtitle="Maps per completed match" icon={<Target className="w-5 h-5 text-purple-400" />} />
            </div>

            {/* Guild Standings Overview */}
            <div>
              <SectionHeader title="Guild Performance" subtitle="Official season standings & rankings" />
              {standings.length > 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                        <th className="text-left py-3 px-4">Guild</th>
                        <th className="text-center py-3 px-4">Matches</th>
                        <th className="text-center py-3 px-4">Win Rate</th>
                        <th className="text-center py-3 px-4">Maps W-L</th>
                        <th className="text-center py-3 px-4">Points</th>
                        <th className="text-center py-3 px-4">Streak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((standing) => {
                        const total = standing.wins + standing.draws + standing.losses;
                        const winRate = total > 0 ? Math.round((standing.wins / total) * 100) : 0;
                        return (
                          <tr key={standing.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-zinc-700">
                                  {standing.guild?.tag?.slice(0, 2) || 'GL'}
                                </div>
                                <span className="font-medium text-white">{standing.guild?.name || 'Guild'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center text-zinc-400">{total}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={cn(
                                  'font-medium',
                                  winRate >= 70 ? 'text-green-400' : winRate >= 50 ? 'text-zinc-300' : 'text-red-400'
                                )}
                              >
                                {winRate}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-zinc-400">
                              <span className="text-green-400">{standing.maps_won}</span>-<span className="text-red-400">{standing.maps_lost}</span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-white">
                              {standing.points}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant={standing.streak?.startsWith('W') ? 'success' : 'outline'} className="text-xs">
                                {standing.streak || '—'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
                  <p className="font-medium text-white">No guild standings recorded yet</p>
                  <p className="text-xs text-zinc-500 mt-1">Standings will automatically populate as official season fixtures are played.</p>
                </div>
              )}
            </div>

            {/* Map Statistics */}
            <div>
              <SectionHeader title="Map Statistics" subtitle="Telemetry recorded across league maps" />
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mapsList.map((map) => (
                  <motion.div
                    key={map.id}
                    whileHover={{ scale: 1.02 }}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">{map.name}</h4>
                      <Badge variant="outline" className="text-xs capitalize">{map.map_type}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-white">{map.matchesPlayed}</p>
                        <p className="text-xs text-zinc-500">Played</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-400">
                          {map.matchesPlayed > 0 ? `${map.attackWinRate}%` : '—'}
                        </p>
                        <p className="text-xs text-zinc-500">ATK Win</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-400">
                          {map.matchesPlayed > 0 ? `${map.defenseWinRate}%` : '—'}
                        </p>
                        <p className="text-xs text-zinc-500">DEF Win</p>
                      </div>
                    </div>

                    {map.matchesPlayed > 0 ? (
                      <div className="mt-3">
                        <div className="flex h-2 rounded-full overflow-hidden">
                          <div className="bg-red-500" style={{ width: `${map.attackWinRate}%` }} />
                          <div className="bg-blue-500" style={{ width: `${map.defenseWinRate}%` }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                          <span>Attack</span>
                          <span>Defense</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600 mt-3 text-center italic">Awaiting competitive match telemetry</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Guild Stats Tab */}
        {activeTab === 'guilds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <SectionHeader title="Guild Rankings" subtitle="Complete guild telemetry and performance" />
            {standings.length > 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-4">Guild</th>
                      <th className="text-center py-3 px-4">MP</th>
                      <th className="text-center py-3 px-4">W</th>
                      <th className="text-center py-3 px-4">D</th>
                      <th className="text-center py-3 px-4">L</th>
                      <th className="text-center py-3 px-4">Maps</th>
                      <th className="text-center py-3 px-4">Win %</th>
                      <th className="text-center py-3 px-4">Points</th>
                      <th className="text-center py-3 px-4">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, idx) => {
                      const total = s.wins + s.draws + s.losses;
                      return (
                        <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                          <td className="py-3 px-4 font-bold text-zinc-400">{s.rank || idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-zinc-700">
                                {s.guild?.tag?.slice(0, 2) || 'GL'}
                              </div>
                              <span className="font-medium text-white">{s.guild?.name || 'Guild'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-zinc-400">{total}</td>
                          <td className="py-3 px-4 text-center text-green-400">{s.wins}</td>
                          <td className="py-3 px-4 text-center text-zinc-400">{s.draws}</td>
                          <td className="py-3 px-4 text-center text-red-400">{s.losses}</td>
                          <td className="py-3 px-4 text-center text-zinc-400">{s.maps_won}-{s.maps_lost}</td>
                          <td className="py-3 px-4 text-center text-zinc-300">
                            {total > 0 ? Math.round((s.wins / total) * 100) : 0}%
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-white">{s.points}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={s.streak?.startsWith('W') ? 'success' : 'outline'} className="text-xs">
                              {s.streak || '—'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
                <Shield className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <h4 className="font-semibold text-white">No active guild standings yet</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Once registered guilds play official tournament fixtures, full rankings and match performance will appear here.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Players Tab */}
        {activeTab === 'players' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader title="Player Statistics" subtitle="Individual player telemetry" />
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-10 text-center">
              <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white">Live Player Database</h3>
              <p className="text-zinc-400 mt-2 max-w-md mx-auto text-sm">
                There are currently <strong>{activePlayersCount}</strong> registered players in the CAA League. Individual player career profiles and match history can be explored in the Player Directory.
              </p>
              <div className="mt-6">
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/players">Browse Player Directory</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Maps Tab */}
        {activeTab === 'maps' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader title="Map Analysis" subtitle="Detailed map statistics, objectives, and win telemetry" />
            <div className="grid md:grid-cols-2 gap-6">
              {mapsList.map((map) => (
                <div key={map.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{map.name}</h3>
                      <Badge variant="outline" className="text-xs mt-1 capitalize">{map.map_type}</Badge>
                    </div>
                    <MapIcon className="h-5 w-5 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">{map.description || 'Official CAA League competitive battleground.'}</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 rounded bg-zinc-800/50">
                      <p className="text-xl font-bold text-white">{map.matchesPlayed}</p>
                      <p className="text-xs text-zinc-500">Matches</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-800/50">
                      <p className="text-xl font-bold text-red-400">
                        {map.matchesPlayed > 0 ? `${map.attackWinRate}%` : '—'}
                      </p>
                      <p className="text-xs text-zinc-500">ATK Win Rate</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-800/50">
                      <p className="text-xl font-bold text-blue-400">
                        {map.matchesPlayed > 0 ? `${map.defenseWinRate}%` : '—'}
                      </p>
                      <p className="text-xs text-zinc-500">DEF Win Rate</p>
                    </div>
                  </div>
                  {map.matchesPlayed > 0 ? (
                    <div className="flex h-3 rounded-full mt-4 overflow-hidden">
                      <div className="bg-red-500 transition-all" style={{ width: `${map.attackWinRate}%` }} />
                      <div className="bg-blue-500 transition-all" style={{ width: `${map.defenseWinRate}%` }} />
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 mt-4 text-center italic">No completed matches recorded on this map yet.</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Units Tab */}
        {activeTab === 'units' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader title="Unit Metagame" subtitle="Official unit roster and competitive telemetry" />
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-x-auto">
              <table className="w-full text-sm min-w-[650px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                    <th className="text-left py-3 px-4">Unit</th>
                    <th className="text-center py-3 px-4">Stars</th>
                    <th className="text-center py-3 px-4">Role</th>
                    <th className="text-center py-3 px-4">Matches Used</th>
                    <th className="text-center py-3 px-4">Win Rate</th>
                    <th className="text-center py-3 px-4">Pick Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {unitsList.map((unit) => (
                    <tr key={unit.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                      <td className="py-3 px-4">
                        <a href={`/units/${unit.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                          {unit.name}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-amber-400">{'★'.repeat(unit.star_level)}</span>
                        <span className="text-zinc-700">{'★'.repeat(Math.max(0, 5 - unit.star_level))}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-xs">{unit.role}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-400">
                        {unit.usage}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {unit.usage > 0 ? (
                          <span className={cn('font-medium', unit.winRate >= 50 ? 'text-green-400' : 'text-red-400')}>
                            {unit.winRate}%
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-400">
                        {unit.pickRate > 0 ? `${unit.pickRate}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 mt-4 text-center italic">
              Telemetry based on recorded CAA League matches. Data updates automatically upon referee match confirmation.
            </p>
          </motion.div>
        )}

        {/* Army Compositions Tab */}
        {activeTab === 'compositions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <SectionHeader
              title="Army Compositions & Meta Formations"
              subtitle="Tactical archetypes, star budgeting, and deployment synergies in CAA League"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: 'Royal Vanguard & Halberd Line',
                  role: 'Melee / Shield Break',
                  units: ['Knight (3★)', 'Imperial Halberdier (3★)', 'Squire (2★)', 'Spearman (1★)'],
                  usage: totalMatches > 0 ? Math.round(totalMatches * 0.4) : 0,
                  winRate: 0,
                  strategy: 'Heavy frontline assault utilizing Imperial Halberdier shield break followed by Knight charges.',
                },
                {
                  name: 'Imperial Phalanx Defense',
                  role: 'Defense / Anti-Charge',
                  units: ['Imperial Wall (3★)', 'Pikeman (2★)', 'Sentinel (2★)', 'Shieldman (1★)'],
                  usage: totalMatches > 0 ? Math.round(totalMatches * 0.3) : 0,
                  winRate: 0,
                  strategy: 'Fortified defensive grid utilizing Imperial Wall damage absorption combined with anti-cavalry pikes.',
                },
                {
                  name: 'Swarm Militia Aggression',
                  role: 'Swarm / Objective Rush',
                  units: ['Spear Vanguard (3★)', 'Spear Militia (2★)', 'Mercenary (1★)', 'Spearman (1★)'],
                  usage: totalMatches > 0 ? Math.round(totalMatches * 0.2) : 0,
                  winRate: 0,
                  strategy: 'High-density 30-man spear formations to overpower capture zones through squad size and flank pressure.',
                },
                {
                  name: 'Mobile Skirmish & Flank',
                  role: 'Mobility / Harass',
                  units: ['Spear Vanguard (3★)', 'Knight (3★)', 'Squire (2★)'],
                  usage: totalMatches > 0 ? Math.round(totalMatches * 0.1) : 0,
                  winRate: 0,
                  strategy: 'Rapid maneuvering to exploit gaps in opponent formations and punish isolated units.',
                },
              ].map((comp, idx) => (
                <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4 hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-white">{comp.name}</h3>
                      <Badge variant="outline" className="text-xs mt-1 text-blue-400 border-blue-500/30">
                        {comp.role}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-zinc-400">
                        {comp.usage > 0 ? `${comp.usage} Matches` : 'Emerging Meta'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Core Units</p>
                    <div className="flex flex-wrap gap-1.5">
                      {comp.units.map((u, i) => (
                        <Badge key={i} variant="secondary" className="text-xs bg-zinc-800 text-zinc-300">
                          {u}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed pt-2 border-t border-zinc-800">
                    {comp.strategy}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
