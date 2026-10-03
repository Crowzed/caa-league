"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionHeader, StatCard } from "@/components/shared";
import { StandingsTable } from "@/components/standings-table";
import { MatchCard } from "@/components/match-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Trophy, ArrowUpCircle, ArrowDownCircle, Info, Calendar, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import type { Division, Standing, Match, Season, Guild } from "@/types/database";

type StandingWithGuild = Standing & { guild: Guild };
type MatchWithGuilds = Match & { home_guild: Guild; away_guild: Guild };

export default function LeaguePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [standings, setStandings] = useState<StandingWithGuild[]>([]);
  const [matches, setMatches] = useState<MatchWithGuilds[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // 1. Fetch seasons on mount
  useEffect(() => {
    async function loadSeasons() {
      try {
        setIsLoading(true);
        const { data: seasonData } = await supabase
          .from("seasons")
          .select("*")
          .order("number", { ascending: false });

        if (seasonData && seasonData.length > 0) {
          setSeasons(seasonData as Season[]);
          const current = seasonData.find((s) => s.is_current) || seasonData[0];
          setSelectedSeason(current.id);
        }
      } catch (err) {
        console.warn("Seasons load error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSeasons();
  }, [supabase]);

  // 2. Fetch divisions, standings, and matches for the selected season
  useEffect(() => {
    if (!selectedSeason) return;

    async function loadSeasonData() {
      try {
        const [divRes, standRes, matchRes] = await Promise.all([
          supabase
            .from("divisions")
            .select("*")
            .eq("season_id", selectedSeason)
            .order("tier", { ascending: true }),
          supabase
            .from("standings")
            .select("*, guild:guilds(*)")
            .eq("season_id", selectedSeason)
            .order("rank", { ascending: true }),
          supabase
            .from("matches")
            .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
            .eq("season_id", selectedSeason)
            .order("scheduled_at", { ascending: true }),
        ]);

        if (divRes.data) {
          const loadedDivs = divRes.data as Division[];
          setDivisions(loadedDivs);
          if (loadedDivs.length > 0) {
            setSelectedDivision(loadedDivs[0].id);
          } else {
            setSelectedDivision("");
          }
        }

        if (standRes.data) {
          setStandings(standRes.data as unknown as StandingWithGuild[]);
        } else {
          setStandings([]);
        }

        if (matchRes.data) {
          setMatches(matchRes.data as unknown as MatchWithGuilds[]);
        } else {
          setMatches([]);
        }
      } catch (err) {
        console.warn("Season data load error:", err);
      }
    }

    loadSeasonData();
  }, [supabase, selectedSeason]);

  const activeSeason = seasons.find((s) => s.id === selectedSeason);
  const activeDivision = divisions.find((d) => d.id === selectedDivision) || divisions[0];

  return (
    <div className="container mx-auto py-8 px-4">
      <PageHeader
        title="League Overview"
        subtitle="Current standings, schedules, and divisional information"
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">Season:</span>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger className="w-[220px] bg-slate-900 border-slate-700 text-slate-200">
              <SelectValue placeholder="Select Season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {season.name} {season.is_current ? "(Current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <Link href="/league/standings">Full Standings</Link>
          </Button>
          <Button variant="outline" asChild className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <Link href="/league/schedule">Full Schedule</Link>
          </Button>
          <Button variant="default" asChild className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
            <Link href="/league/playoffs">Playoff Bracket</Link>
          </Button>
          <Button variant="outline" asChild className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <Link href="/seasons">Season Archives</Link>
          </Button>
        </div>
      </div>

      {activeSeason && (
        <Alert className="mb-8 bg-blue-950/30 border-blue-900 text-slate-200">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-blue-400 font-semibold">{activeSeason.name}</AlertTitle>
          <AlertDescription className="text-blue-200/80">
            Status: <span className="font-semibold capitalize">{activeSeason.status.replace("_", " ")}</span>
            {activeSeason.is_current ? " • This is the active championship season." : " • Historical season records."}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : divisions.length > 0 && activeDivision ? (
        <Tabs value={activeDivision.id} onValueChange={setSelectedDivision} className="w-full">
          <TabsList className="w-full flex justify-start overflow-x-auto bg-slate-900/60 border border-slate-800 p-1 rounded-xl">
            {divisions.map((div) => (
              <TabsTrigger
                key={div.id}
                value={div.id}
                className="min-w-[120px] data-[state=active]:bg-yellow-600 data-[state=active]:text-white text-slate-300 font-medium"
              >
                {div.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {divisions.map((div) => {
            const divStandings = standings.filter(
              (s) => s.division_id === div.id && s.season_id === selectedSeason
            );
            const divMatches = matches.filter(
              (m) => m.division_id === div.id && (m.status === "scheduled" || m.status === "check_in" || m.status === "live")
            );

            const promSpots = typeof div.promotion_spots === 'number'
              ? div.promotion_spots
              : (div.tier === 1 ? 0 : 2);

            const playSpots = typeof div.playoff_spots === 'number'
              ? div.playoff_spots
              : 4;

            const relegSpots = typeof div.relegation_spots === 'number'
              ? div.relegation_spots
              : (div.tier === 5 ? 0 : 2);

            return (
              <TabsContent key={div.id} value={div.id} className="mt-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard
                    title="Playoff Spots"
                    value={playSpots === 0 ? "None" : `Top ${playSpots}`}
                    icon={<Trophy className="h-5 w-5 text-yellow-500" />}
                    description="Advance to divisional playoffs"
                  />
                  <StatCard
                    title="Promotion"
                    value={promSpots === 0 ? "None" : `Top ${promSpots}`}
                    icon={<ArrowUpCircle className="h-5 w-5 text-green-500" />}
                    description={promSpots === 0 ? "Highest division" : "Promoted to higher division"}
                  />
                  <StatCard
                    title="Relegation"
                    value={relegSpots === 0 ? "None" : `Bottom ${relegSpots}`}
                    icon={<ArrowDownCircle className="h-5 w-5 text-red-500" />}
                    description={relegSpots === 0 ? "Lowest division" : "Relegated to lower division"}
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2 space-y-4">
                    <SectionHeader
                      title={`${div.name} Standings`}
                      description={`${activeSeason?.name} • ${divStandings.length} Teams`}
                    />
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur overflow-hidden">
                      <StandingsTable
                        standings={divStandings}
                        promotionSpots={promSpots}
                        playoffSpots={playSpots}
                        relegationSpots={relegSpots}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <SectionHeader title="Division Matches" className="mb-0" />
                      <Button variant="ghost" size="sm" asChild className="text-xs text-blue-400 hover:text-white">
                        <Link href={`/matches?division=${div.id}`}>View All</Link>
                      </Button>
                    </div>

                    {divMatches.length > 0 ? (
                      <div className="space-y-4">
                        {divMatches.slice(0, 4).map((match) => (
                          <MatchCard key={match.id} match={match} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-500 flex flex-col items-center">
                        <Calendar className="h-8 w-8 mb-2 opacity-20 text-slate-400" />
                        <p className="text-sm font-medium text-slate-400">No scheduled matches for this division.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-200">No Divisions Configured</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            No divisional tiers have been allocated for {activeSeason?.name || 'this season'}. Admins can initialize divisions in the Admin Panel.
          </p>
        </div>
      )}
    </div>
  );
}
