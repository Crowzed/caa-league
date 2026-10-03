"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader, EmptyState } from "@/components/shared";
import { MatchCard } from "@/components/match-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Match, Guild, Division } from "@/types/database";

type MatchWithGuilds = Match & { home_guild: Guild; away_guild: Guild };

export default function SchedulePage() {
  const [matches, setMatches] = useState<MatchWithGuilds[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadSchedule() {
      try {
        setIsLoading(true);
        const [
          { data: matchData },
          { data: divData }
        ] = await Promise.all([
          supabase
            .from("matches")
            .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
            .order("week", { ascending: true })
            .order("scheduled_at", { ascending: true }),
          supabase
            .from("divisions")
            .select("*")
            .order("tier", { ascending: true })
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
      } catch (err) {
        console.warn("Schedule load note:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSchedule();
  }, [supabase]);

  const uniqueDivisions = useMemo(() => {
    const seen = new Set<string>();
    return divisions.filter((d) => {
      const lower = d.name.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }, [divisions]);

  // Group matches by week
  const matchesByWeek = useMemo(() => {
    return matches.reduce((acc, match) => {
      if (selectedDivision !== "all" && match.division_id !== selectedDivision) return acc;

      const week = match.week || 1;
      if (!acc[week]) {
        acc[week] = [];
      }
      acc[week].push(match);
      return acc;
    }, {} as Record<number, MatchWithGuilds[]>);
  }, [matches, selectedDivision]);

  const weeks = Object.keys(matchesByWeek).map(Number).sort((a, b) => a - b);

  return (
    <div className="container mx-auto py-8 px-4">
      <PageHeader
        title="League Schedule"
        subtitle="Official tournament fixture list and weekly scheduling"
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-4 rounded-xl border border-zinc-800 mb-8 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">Filter by Division:</span>
          <Select value={selectedDivision} onValueChange={setSelectedDivision}>
            <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800 text-white">
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">All Divisions</SelectItem>
              {uniqueDivisions.map((div) => (
                <SelectItem key={div.id} value={div.id}>
                  {div.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <Button 
            variant={viewMode === "list" ? "default" : "ghost"} 
            size="sm" 
            className="h-8 text-xs"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5 mr-1.5" /> List
          </Button>
          <Button 
            variant={viewMode === "calendar" ? "default" : "ghost"} 
            size="sm"
            className="h-8 text-xs"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Calendar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : weeks.length === 0 ? (
        <EmptyState 
          icon={<CalendarIcon className="h-12 w-12 text-zinc-600" />}
          title="No Matches Scheduled"
          description="There are currently no official fixtures scheduled in the database. Fixtures will be generated when a season is active."
        />
      ) : (
        <div className="space-y-12">
          {weeks.map((week) => (
            <div key={week} className="space-y-4">
              <h2 className="text-2xl font-bold border-b border-zinc-800 pb-2 flex items-center gap-2 text-white">
                Week {week}
                <span className="text-sm font-normal text-zinc-400">
                  ({matchesByWeek[week].length} matches)
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matchesByWeek[week].map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

