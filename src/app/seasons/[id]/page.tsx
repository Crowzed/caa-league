'use client';

import { use } from 'react';
import { 
  Trophy, Map, Award, Users, 
  Swords, Shield, Newspaper, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/shared';
import { StandingsTable } from '@/components/standings-table';
import { MatchCard } from '@/components/match-card';
import { 
  sampleSeasons, sampleStandings, sampleMatches, 
  sampleGuilds, sampleMaps, sampleNews 
} from '@/lib/sample-data';

export default function SeasonArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const season = sampleSeasons.find((s) => s.id === resolvedParams.id) || sampleSeasons[0];
  const championGuild = sampleGuilds[0];

  if (!season) {
    return (
      <div className="container py-8 max-w-7xl mx-auto space-y-8">
        <div>
          <Link href="/seasons" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Season Archives
          </Link>
          <PageHeader
            title="Season Archive"
            subtitle="Archive records and standings"
            breadcrumbs={[
              { label: 'Seasons', href: '/seasons' },
              { label: 'Details' },
            ]}
          />
        </div>
        <EmptyState
          icon={Trophy}
          title="Season Not Found"
          description="There are currently no archived records for this season."
        />
      </div>
    );
  }

  const seasonMatches = sampleMatches.filter((m) => m.season_id === season.id);
  const seasonStandings = sampleStandings;

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <div>
        <Link href="/seasons" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Season Archives
        </Link>
        <PageHeader
          title={season.name}
          subtitle={`Official archive for Season #${season.number} • Status: ${season.status.toUpperCase()}`}
          breadcrumbs={[
            { label: 'Seasons', href: '/seasons' },
            { label: season.name },
          ]}
        />
      </div>

      {/* Champion Banner if completed */}
      {season.status === 'completed' && championGuild && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 flex flex-col md:flex-row items-center justify-between gap-6 glow-gold">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <Badge className="bg-amber-500 text-black text-xs font-bold mb-1">
                SEASON {season.number} CHAMPION
              </Badge>
              <h2 className="text-3xl font-black text-white">{championGuild.name}</h2>
              <p className="text-xs text-zinc-400">
                Grand League Finalist: defeated Nova Strikers 3-1 in Grand Final
              </p>
            </div>
          </div>
          <Link href={`/guilds/${championGuild.id}`}>
            <Button variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
              View Champion Profile
            </Button>
          </Link>
        </div>
      )}

      {/* Tabbed Archive Data */}
      <Tabs defaultValue="standings" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="standings" className="gap-2">
            <Trophy className="w-4 h-4" /> Standings
          </TabsTrigger>
          <TabsTrigger value="matches" className="gap-2">
            <Swords className="w-4 h-4" /> Matches
          </TabsTrigger>
          <TabsTrigger value="mappool" className="gap-2">
            <Map className="w-4 h-4" /> Map Pool
          </TabsTrigger>
          <TabsTrigger value="awards" className="gap-2">
            <Award className="w-4 h-4" /> Awards
          </TabsTrigger>
          <TabsTrigger value="news" className="gap-2">
            <Newspaper className="w-4 h-4" /> News & Recaps
          </TabsTrigger>
        </TabsList>

        {/* STANDINGS */}
        <TabsContent value="standings" className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Final Regular Season Standings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <StandingsTable standings={seasonStandings} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATCHES */}
        <TabsContent value="matches" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seasonMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </TabsContent>

        {/* MAP POOL */}
        <TabsContent value="mappool" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleMaps.map((map) => (
              <Card key={map.id} className="border-zinc-800 bg-zinc-900/40">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{map.name}</CardTitle>
                    <Badge variant="outline">{map.map_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-400">{map.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AWARDS */}
        <TabsContent value="awards" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-zinc-800 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm uppercase text-amber-400 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Season MVP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-white">ShadowCommander</p>
                <p className="text-xs text-zinc-400">Shadow Legion • 87% Map Winrate</p>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm uppercase text-blue-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Best Defensive Guild
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-white">Crimson Vanguard</p>
                <p className="text-xs text-zinc-400">12 Wins on Defense</p>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm uppercase text-green-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Rookie of the Season
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-white">StormBreaker</p>
                <p className="text-xs text-zinc-400">Shadow Legion</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* NEWS */}
        <TabsContent value="news" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sampleNews.map((article) => (
              <Card key={article.id} className="border-zinc-800 bg-zinc-900/40">
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2 text-xs">{article.category}</Badge>
                  <CardTitle className="text-base text-white">{article.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-400 line-clamp-2">{article.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
