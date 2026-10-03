"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, EmptyState } from "@/components/shared";
import { MatchCard } from "@/components/match-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Match, Guild, Division, Season } from "@/types/database";

type MatchWithGuilds = Match & { home_guild: Guild; away_guild: Guild };

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchWithGuilds[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadMatchesData() {
      try {
        setIsLoading(true);
        const [
          { data: matchData },
          { data: divData },
          { data: seasonData }
        ] = await Promise.all([
          supabase
            .from("matches")
            .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
            .order("scheduled_at", { ascending: true }),
          supabase
            .from("divisions")
            .select("*")
            .order("tier", { ascending: true }),
          supabase
            .from("seasons")
            .select("*")
            .order("number", { ascending: false })
        ]);

        if (matchData) {
          setMatches(matchData as unknown as MatchWithGuilds[]);
        } else {
          setMatches([]);
        }

        if (divData) {
          setDivisions(divData as Division[]);
        } else {
          setDivisions([]);
        }

        if (seasonData) {
          setSeasons(seasonData as Season[]);
          const current = seasonData.find((s) => s.is_current);
          if (current) {
            setSelectedSeason(current.id);
          } else if (seasonData.length > 0) {
            setSelectedSeason(seasonData[0].id);
          } else {
            setSelectedSeason("all");
          }
        } else {
          setSeasons([]);
          setSelectedSeason("all");
        }
      } catch (err) {
        console.warn("Matches load note:", err);
        setMatches([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadMatchesData();
  }, [supabase]);

  // Filter and deduplicate divisions by name so duplicates across seasons never appear
  const filteredDivisions = useMemo(() => {
    let divList = divisions;
    if (selectedSeason !== "all") {
      divList = divisions.filter((d) => d.season_id === selectedSeason);
    }
    // Deduplicate by division name to prevent duplicate tier entries
    const seen = new Set<string>();
    return divList.filter((d) => {
      const lowerName = d.name.toLowerCase();
      if (seen.has(lowerName)) return false;
      seen.add(lowerName);
      return true;
    });
  }, [divisions, selectedSeason]);

  const liveMatches = matches.filter((m) => m.status === "live");
  const upcomingMatches = matches.filter((m) => m.status === "scheduled" || m.status === "check_in");
  const completedMatches = matches.filter((m) => m.status === "completed" || m.status === "forfeit");

  const filterMatches = (matchList: MatchWithGuilds[]) => {
    return matchList.filter((match) => {
      const matchDiv = selectedDivision === "all" || match.division_id === selectedDivision;
      const matchSeason = selectedSeason === "all" || match.season_id === selectedSeason;

      const searchLower = searchQuery.toLowerCase();
      const matchSearch =
        searchQuery === "" ||
        (match.home_guild?.name || "").toLowerCase().includes(searchLower) ||
        (match.away_guild?.name || "").toLowerCase().includes(searchLower) ||
        (match.home_guild?.tag || "").toLowerCase().includes(searchLower) ||
        (match.away_guild?.tag || "").toLowerCase().includes(searchLower);

      return matchDiv && matchSeason && matchSearch;
    });
  };

  const filteredLive = filterMatches(liveMatches);
  const filteredUpcoming = filterMatches(upcomingMatches);
  const filteredCompleted = filterMatches(completedMatches);

  return (
    <div className="container mx-auto py-8 px-4">
      <PageHeader
        title="Matches"
        subtitle="Live broadcasts, upcoming fixtures, and verified series results"
      />

      <div className="bg-card border border-zinc-800 rounded-lg p-4 mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search guilds by name or tag..." 
            className="pl-9 bg-zinc-900 border-zinc-800"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <Select value={selectedDivision} onValueChange={setSelectedDivision}>
            <SelectTrigger className="w-[160px] bg-zinc-900 border-zinc-800">
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">All Divisions</SelectItem>
              {filteredDivisions.map((div) => (
                <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {seasons.length > 0 && (
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[160px] bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="all">All Seasons</SelectItem>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.name} {season.is_current ? "(Active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="mb-6 grid w-full max-w-md grid-cols-3 bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="live" className="relative">
              Live
              {filteredLive.length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-4 mt-0">
            {filteredLive.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLive.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <EmptyState 
                icon={<Trophy className="h-12 w-12 text-zinc-600" />}
                title="No Live Matches"
                description="There are currently no matches in progress."
              />
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4 mt-0">
            {filteredUpcoming.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUpcoming.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <EmptyState 
                icon={<Trophy className="h-12 w-12 text-zinc-600" />}
                title="No Upcoming Matches"
                description="There are currently no scheduled fixtures. New matchups will be scheduled soon."
              />
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-0">
            {filteredCompleted.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompleted.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <EmptyState 
                icon={<Trophy className="h-12 w-12 text-zinc-600" />}
                title="No Completed Matches"
                description="No match results have been recorded yet."
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
