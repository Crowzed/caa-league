'use client';

import { motion } from 'framer-motion';
import { Trophy, Crown, Star, Award, Medal, Flame, Target, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Season, Guild, Achievement, Standing } from '@/types/database';

interface ChampionshipEntry {
  seasonName: string;
  year: string;
  guild: Guild;
  record: string;
  playoffResult: string;
}

export default function HallOfFamePage() {
  const [champions, setChampions] = useState<ChampionshipEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [topStanding, setTopStanding] = useState<Standing | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadHallOfFame() {
      try {
        setIsLoading(true);

        // 1. Current / Active Season
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('*')
          .eq('is_current', true)
          .maybeSingle();

        if (seasonData) {
          setCurrentSeason(seasonData as Season);
        }

        // 2. Completed seasons (Champions)
        const { data: completedSeasons } = await supabase
          .from('seasons')
          .select('*')
          .eq('status', 'completed')
          .order('end_date', { ascending: false });

        if (completedSeasons && completedSeasons.length > 0) {
          const champsList: ChampionshipEntry[] = [];
          for (const s of completedSeasons) {
            // Find #1 standing for this season
            const { data: winnerStanding } = await supabase
              .from('standings')
              .select('*, guild:guilds(*)')
              .eq('season_id', s.id)
              .eq('rank', 1)
              .maybeSingle();

            if (winnerStanding && winnerStanding.guild) {
              champsList.push({
                seasonName: s.name,
                year: s.start_date ? new Date(s.start_date).getFullYear().toString() : '2026',
                guild: winnerStanding.guild as unknown as Guild,
                record: `${winnerStanding.wins}W-${winnerStanding.draws}D-${winnerStanding.losses}L`,
                playoffResult: 'Grand Final Champions',
              });
            }
          }
          setChampions(champsList);
        }

        // 3. Top current standing for live league leader preview
        const { data: topRank } = await supabase
          .from('standings')
          .select('*, guild:guilds(*)')
          .order('points', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topRank) {
          setTopStanding(topRank as unknown as Standing);
        }

        // 4. Official League Achievements
        const { data: achievementsData } = await supabase
          .from('achievements')
          .select('*')
          .order('type', { ascending: true });

        if (achievementsData) {
          // Deduplicate by name
          const uniqueAchievements = achievementsData.filter(
            (item, index, self) => index === self.findIndex((t) => t.name === item.name)
          );
          setAchievements(uniqueAchievements);
        }
      } catch (err) {
        console.warn('Hall of Fame load note:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadHallOfFame();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <PageHeader
        title="Hall of Fame"
        description="Championship lineage, all-time league records, and historic competitive honors"
      />

      <div className="container mx-auto px-4 py-8">
        {/* Champions Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-6">
            <Crown className="h-6 w-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Championship History</h2>
          </div>

          {champions.length > 0 ? (
            champions.map((champ, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 backdrop-blur p-6 mb-4 glow-gold"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Badge className="bg-amber-500 text-black mb-3 font-bold">
                      <Trophy className="mr-1 h-3 w-3" />
                      Grand Champion
                    </Badge>
                    <h3 className="text-xl font-bold text-amber-400">{champ.seasonName}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{champ.year}</p>

                    <Link href={`/guilds/${champ.guild.id}`}>
                      <div className="flex items-center gap-3 mt-4 group">
                        <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-xl font-bold text-amber-400 border-2 border-amber-500/50">
                          {champ.guild.tag}
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                            {champ.guild.name}
                          </p>
                          <p className="text-sm text-zinc-400">[{champ.guild.tag}] — {champ.guild.region || 'Global'}</p>
                        </div>
                      </div>
                    </Link>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                      <span className="text-sm text-zinc-400">Regular Season Record</span>
                      <span className="text-sm font-medium text-white">{champ.record}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                      <span className="text-sm text-zinc-400">Playoffs Status</span>
                      <span className="text-sm font-medium text-amber-400">{champ.playoffResult}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-950 p-8 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Crown className="w-64 h-64 text-amber-400" />
              </div>

              <div className="max-w-2xl mx-auto space-y-4 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                  <Trophy className="w-8 h-8" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white">
                  Inaugural Championship Race Underway
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  The throne is vacant! The champion of{' '}
                  <span className="text-amber-400 font-semibold">{currentSeason?.name || 'Season 1'}</span>{' '}
                  will be forever immortalized in this Hall of Fame upon completion of the Grand Finals.
                </p>

                {topStanding?.guild && (
                  <div className="pt-2">
                    <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Current League Leader</p>
                    <div className="inline-flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 px-4 py-2 rounded-xl">
                      <span className="font-bold text-amber-400">[{topStanding.guild.tag}]</span>
                      <span className="text-white font-medium text-sm">{topStanding.guild.name}</span>
                      <Badge variant="success" className="text-xs">{topStanding.points} PTS</Badge>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex flex-wrap justify-center gap-3">
                  <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs">
                    <Link href="/league/standings">
                      View League Standings <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="text-xs border-zinc-700">
                    <Link href="/matches">
                      Watch Matches
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* League Records Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-6">
            <Star className="h-6 w-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">All-Time League Records</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Flame,
                label: 'Longest Win Streak',
                value: topStanding && topStanding.streak ? topStanding.streak : 'Underway',
                holder: topStanding?.guild ? topStanding.guild.name : 'Season 1 Contenders',
                season: currentSeason?.name.split(' - ')[0] || 'Season 1',
                color: 'text-red-400',
              },
              {
                icon: Target,
                label: 'Top Regular Record',
                value: topStanding ? `${topStanding.wins}W - ${topStanding.losses}L` : 'Awaiting Fixtures',
                holder: topStanding?.guild ? topStanding.guild.name : 'Season 1 Contenders',
                season: currentSeason?.name.split(' - ')[0] || 'Season 1',
                color: 'text-green-400',
              },
              {
                icon: Star,
                label: 'Most Maps Won',
                value: topStanding ? `${topStanding.maps_won} Maps` : '0 Maps',
                holder: topStanding?.guild ? topStanding.guild.name : 'Season 1 Contenders',
                season: currentSeason?.name.split(' - ')[0] || 'Season 1',
                color: 'text-amber-400',
              },
              {
                icon: Medal,
                label: 'Highest League Points',
                value: topStanding ? `${topStanding.points} PTS` : '0 PTS',
                holder: topStanding?.guild ? topStanding.guild.name : 'Season 1 Contenders',
                season: currentSeason?.name.split(' - ')[0] || 'Season 1',
                color: 'text-blue-400',
              },
              {
                icon: Trophy,
                label: 'Best Win Rate',
                value: topStanding && (topStanding.wins + topStanding.losses > 0)
                  ? `${Math.round((topStanding.wins / (topStanding.wins + topStanding.losses)) * 100)}%`
                  : '100%',
                holder: topStanding?.guild ? topStanding.guild.name : 'Active League',
                season: currentSeason?.name.split(' - ')[0] || 'Season 1',
                color: 'text-amber-400',
              },
              {
                icon: Award,
                label: 'Defensive Dominance',
                value: 'Top Tier',
                holder: 'Official CAA Defense',
                season: currentSeason?.name.split(' - ')[0] || 'Season 1',
                color: 'text-emerald-400',
              },
            ].map((record, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">{record.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${record.color}`}>{record.value}</p>
                    <p className="text-sm text-zinc-400 mt-1">{record.holder}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{record.season}</p>
                  </div>
                  <record.icon className={`h-5 w-5 ${record.color}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Official Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Award className="h-6 w-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Official League Achievements</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement, i) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-lg ${
                      achievement.type === 'championship'
                        ? 'bg-amber-500/10 text-amber-400'
                        : achievement.type === 'record'
                        ? 'bg-blue-500/10 text-blue-400'
                        : achievement.type === 'milestone'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-purple-500/10 text-purple-400'
                    }`}
                  >
                    {achievement.type === 'championship' ? (
                      <Trophy className="h-5 w-5" />
                    ) : achievement.type === 'record' ? (
                      <Star className="h-5 w-5" />
                    ) : achievement.type === 'milestone' ? (
                      <Medal className="h-5 w-5" />
                    ) : (
                      <Award className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{achievement.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{achievement.description}</p>
                    <Badge variant="outline" className="text-[10px] mt-2 capitalize border-zinc-700 text-zinc-400">
                      {achievement.type}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
