'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Calendar, ArrowRight, Zap, Shield,
  Newspaper, Globe, Users
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatchCard } from '@/components/match-card';
import { GuildCard } from '@/components/guild-card';
import { StandingsTable } from '@/components/standings-table';
import { StatCard, SectionHeader } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import type { Match, Guild, Standing, NewsArticle, Season } from '@/types/database';

type MatchWithGuilds = Match & { home_guild: Guild; away_guild: Guild };
type StandingWithGuild = Standing & { guild: Guild };

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function HomePage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [liveMatches, setLiveMatches] = useState<MatchWithGuilds[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MatchWithGuilds[]>([]);
  const [recentResults, setRecentResults] = useState<MatchWithGuilds[]>([]);
  const [standings, setStandings] = useState<StandingWithGuild[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [counts, setCounts] = useState({
    guilds: 0,
    players: 0,
    matches: 0,
    divisions: 0,
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadHomepageData() {
      try {

        // 1. Fetch Current Season
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('*')
          .eq('is_current', true)
          .maybeSingle();

        if (seasonData) {
          setSeason(seasonData as Season);
        } else {
          // Check for latest season
          const { data: latestSeason } = await supabase
            .from('seasons')
            .select('*')
            .order('number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestSeason) {
            setSeason(latestSeason as Season);
          } else {
            setSeason(null);
          }
        }

        // 2. Fetch Matches with Guilds
        const { data: matchData } = await supabase
          .from('matches')
          .select('*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)')
          .order('scheduled_at', { ascending: true });

        if (matchData) {
          const typedMatches = matchData as unknown as MatchWithGuilds[];
          setLiveMatches(typedMatches.filter((m) => m.status === 'live'));
          setUpcomingMatches(typedMatches.filter((m) => m.status === 'scheduled' || m.status === 'check_in'));
          setRecentResults(
            typedMatches
              .filter((m) => m.status === 'completed')
              .sort(
                (a, b) =>
                  new Date(b.completed_at || b.scheduled_at || 0).getTime() -
                  new Date(a.completed_at || a.scheduled_at || 0).getTime()
              )
          );
        } else {
          setLiveMatches([]);
          setUpcomingMatches([]);
          setRecentResults([]);
        }

        // 3. Fetch Standings with Guilds for Current Season
        let standingsQuery = supabase
          .from('standings')
          .select('*, guild:guilds(*)')
          .order('rank', { ascending: true });

        if (seasonData) {
          standingsQuery = standingsQuery.eq('season_id', seasonData.id);
        }

        const { data: standingsData } = await standingsQuery;
        setStandings((standingsData as unknown as StandingWithGuild[]) || []);

        // 4. Fetch Approved Guilds (Unapproved guilds should not be listed)
        const { data: guildsData } = await supabase
          .from('guilds')
          .select('*')
          .in('status', ['approved', 'active'])
          .order('created_at', { ascending: false });

        setGuilds((guildsData as Guild[]) || []);

        // 5. Fetch News
        const { data: newsData } = await supabase
          .from('news')
          .select('*')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(4);

        setNews((newsData as NewsArticle[]) || []);

        // 6. Fetch Stat Counts (Connected directly to database)
        const [
          { count: guildCount },
          { count: playerCount },
          { count: matchCount },
          { count: divisionCount },
        ] = await Promise.all([
          supabase
            .from('guilds')
            .select('*', { count: 'exact', head: true })
            .in('status', ['approved', 'active']),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .neq('role', 'super_admin'),
          supabase.from('matches').select('*', { count: 'exact', head: true }),
          supabase.from('divisions').select('*', { count: 'exact', head: true }),
        ]);

        setCounts({
          guilds: guildCount || 0,
          players: playerCount || 0,
          matches: matchCount || 0,
          divisions: divisionCount || 0,
        });
      } catch (err) {
        console.warn('Home data load note:', err);
      }
    }

    loadHomepageData();
  }, [supabase]);

  const hasLiveMatch = liveMatches.length > 0;
  const topGuildStanding = standings[0];
  const topGuild = topGuildStanding?.guild;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 25px 25px, white 2%, transparent 0%), radial-gradient(circle at 75px 75px, white 2%, transparent 0%)',
              backgroundSize: '100px 100px',
            }}
          />
        </div>

        <div className="container relative mx-auto px-4 py-20 md:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-400 mb-6">
              <Zap className="h-3.5 w-3.5" />
              <span>Command An Army — Official League</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto">
              COMMAND AN ARMY{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                LEAGUE
              </span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-zinc-400 max-w-2xl mx-auto">
              The premier competitive league for Command An Army. Battle across divisions, manage rosters, and fight for glory.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/league">
                <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Trophy className="h-4 w-4" />
                  View League
                </Button>
              </Link>
              <Link href="/matches">
                <Button variant="outline" size="lg" className="gap-2 border-zinc-700 text-zinc-200">
                  <Calendar className="h-4 w-4" />
                  Match Schedule
                </Button>
              </Link>
              <Link href="/guilds/register">
                <Button variant="secondary" size="lg" className="gap-2 bg-zinc-800 hover:bg-zinc-700 text-white">
                  <Shield className="h-4 w-4" />
                  Register Guild
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-3xl mx-auto"
          >
            <div className="text-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <p className="text-2xl font-bold text-white">{counts.guilds}</p>
              <p className="text-xs text-zinc-400">Active Guilds</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <p className="text-2xl font-bold text-white">{counts.players}</p>
              <p className="text-xs text-zinc-400">Registered Players</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <p className="text-2xl font-bold text-white">{counts.matches}</p>
              <p className="text-xs text-zinc-400">Total Matches</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <p className="text-2xl font-bold text-white">{counts.divisions}</p>
              <p className="text-xs text-zinc-400">Divisions</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Match Banner */}
      {hasLiveMatch && (
        <section className="border-b border-red-500/30 bg-red-500/5">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Badge variant="destructive" className="animate-pulse">
                  <span className="mr-1 h-2 w-2 rounded-full bg-white inline-block" />
                  LIVE NOW
                </Badge>
                <span className="text-sm text-zinc-400">{liveMatches[0]?.round || 'Live Match Broadcast'}</span>
              </div>
              <Link href="/live">
                <Button size="sm" variant="default" className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Open Live Match Center
                </Button>
              </Link>
            </div>
            <div className="grid gap-4">
              {liveMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-12"
      >
        {/* Standings + Upcoming Matches Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Standings */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <SectionHeader
              title="League Standings"
              subtitle={season ? `${season.name} — Current Stage` : 'Official Tournament Rankings'}
              action={
                <Link href="/league">
                  <Button variant="ghost" size="sm" className="gap-1">
                    Full Standings <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur overflow-hidden">
              {standings.length > 0 ? (
                <StandingsTable standings={standings} />
              ) : (
                <div className="p-10 text-center text-zinc-500 text-sm">
                  <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-zinc-400">No standings recorded yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Standings will automatically update as tournament matches are confirmed.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Upcoming Matches */}
          <motion.div variants={itemVariants}>
            <SectionHeader
              title="Upcoming Fixtures"
              subtitle="Next scheduled battles"
              action={
                <Link href="/matches">
                  <Button variant="ghost" size="sm" className="gap-1">
                    All Matches <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            <div className="space-y-3">
              {upcomingMatches.slice(0, 3).map((match) => (
                <MatchCard key={match.id} match={match} compact />
              ))}
              {upcomingMatches.length === 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                  <Calendar className="h-8 w-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-zinc-400">No upcoming fixtures</p>
                  <p className="text-xs text-zinc-500 mt-1">Matches will be listed once tournament schedule is published.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Recent Results */}
        <motion.div variants={itemVariants} className="mb-12">
          <SectionHeader
            title="Recent Results"
            subtitle="Latest completed fixtures"
            action={
              <Link href="/matches">
                <Button variant="ghost" size="sm" className="gap-1">
                  All Results <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            }
          />
          {recentResults.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentResults.slice(0, 3).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500 text-sm">
              No completed match results recorded yet.
            </div>
          )}
        </motion.div>

        {/* Featured Guilds */}
        <motion.div variants={itemVariants} className="mb-12">
          <SectionHeader
            title="Registered Guilds"
            subtitle="Official combat organizations competing in CAA League"
            action={
              <Link href="/guilds">
                <Button variant="ghost" size="sm" className="gap-1">
                  All Guilds <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            }
          />
          {guilds.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guilds.slice(0, 6).map((guild) => {
                const standing = standings.find((s) => s.guild_id === guild.id);
                return (
                  <GuildCard
                    key={guild.id}
                    guild={guild}
                    rank={standing?.rank}
                    record={standing ? { wins: standing.wins, losses: standing.losses, draws: standing.draws } : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500 text-sm">
              <Shield className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-zinc-400">No approved guilds listed yet</p>
              <p className="text-xs text-zinc-500 mt-1">Register your guild today to be approved for upcoming seasons!</p>
              <div className="mt-4">
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/guilds/register">Register Guild</Link>
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        {/* News Section */}
        <motion.div variants={itemVariants} className="mb-12">
          <SectionHeader
            title="Latest League News"
            subtitle="Updates, match reports, and announcements"
            action={
              <Link href="/news">
                <Button variant="ghost" size="sm" className="gap-1">
                  All News <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            }
          />
          {news.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {news.map((article) => (
                <Link key={article.id} href={`/news/${article.slug}`}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur overflow-hidden group hover:border-blue-500/30 transition-all h-full flex flex-col"
                  >
                    <div className="h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                      <Newspaper className="h-8 w-8 text-zinc-600" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <Badge variant="secondary" className="text-xs mb-2">
                          {article.category.replace('_', ' ')}
                        </Badge>
                        <h3 className="font-semibold text-white text-sm group-hover:text-blue-400 transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                          {article.excerpt}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-600 mt-4">
                        <span suppressHydrationWarning>
                          {article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500 text-sm">
              <Newspaper className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-zinc-400">No news published yet</p>
              <p className="text-xs text-zinc-500 mt-1">Official league announcements and tournament recaps will be published here.</p>
            </div>
          )}
        </motion.div>

        {/* Season Info + Quick Links */}
        <motion.div variants={itemVariants}>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Season Status"
              value={season ? season.name.split(' - ')[0] || season.name : 'Upcoming'}
              subtitle={season ? season.status.replace('_', ' ').toUpperCase() : 'Season Underway'}
              icon={<Globe className="w-5 h-5 text-blue-400" />}
            />
            <StatCard
              title="Divisional Tiers"
              value={`${counts.divisions} Divisions`}
              subtitle="Competitive tiers"
              icon={<Calendar className="w-5 h-5 text-purple-400" />}
            />
            <StatCard
              title="Top Ranked Guild"
              value={topGuild?.name || 'Awaiting Fixtures'}
              subtitle={topGuildStanding ? `${topGuildStanding.points} pts (${topGuildStanding.wins}W ${topGuildStanding.draws}D ${topGuildStanding.losses}L)` : 'Season Rankings'}
              icon={<Trophy className="w-5 h-5 text-amber-400" />}
            />
            <StatCard
              title="Registered Players"
              value={`${counts.players} Players`}
              subtitle="Active combatants"
              icon={<Users className="w-5 h-5 text-emerald-400" />}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
