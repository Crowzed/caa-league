"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { StandingsTable } from "@/components/standings-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Division, Standing, Season, Guild } from "@/types/database";

type StandingWithGuild = Standing & { guild: Guild };

export default function StandingsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [standings, setStandings] = useState<StandingWithGuild[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
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

  // 2. Fetch divisions and standings for selected season
  useEffect(() => {
    if (!selectedSeason) return;

    async function loadSeasonStandings() {
      try {
        const [divRes, standRes] = await Promise.all([
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
        ]);

        if (divRes.data) {
          setDivisions(divRes.data as Division[]);
        } else {
          setDivisions([]);
        }

        if (standRes.data) {
          setStandings(standRes.data as unknown as StandingWithGuild[]);
        } else {
          setStandings([]);
        }
      } catch (err) {
        console.warn("Season standings load error:", err);
      }
    }

    loadSeasonStandings();
  }, [supabase, selectedSeason]);

  const activeSeason = seasons.find((s) => s.id === selectedSeason);

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <PageHeader
        title="League Standings"
        subtitle={`Official divisional rankings — ${activeSeason ? activeSeason.name : "All Seasons"}`}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 border border-slate-800 p-4 rounded-xl gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300">Filter by Season:</span>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger className="w-[240px] bg-slate-950 border-slate-700 text-slate-200">
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

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span>Playoffs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span>Promotion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <span>Relegation</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : divisions.length > 0 ? (
        <div className="grid grid-cols-1 gap-10">
          {divisions.map((division) => {
            const divisionStandings = standings.filter(
              (s) => s.division_id === division.id && s.season_id === selectedSeason
            );

            return (
              <div key={division.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-400" />
                      {division.name}
                    </h2>
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      Tier {division.tier}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    {divisionStandings.length} Teams Enrolled
                  </span>
                </div>

                <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
                  <CardContent className="p-0">
                    <StandingsTable
                      standings={divisionStandings}
                      promotionSpots={typeof division.promotion_spots === 'number' ? division.promotion_spots : (division.tier === 1 ? 0 : 2)}
                      playoffSpots={typeof division.playoff_spots === 'number' ? division.playoff_spots : 4}
                      relegationSpots={typeof division.relegation_spots === 'number' ? division.relegation_spots : (division.tier === 5 ? 0 : 2)}
                    />
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-200">No Standings Recorded</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            No divisional standings have been published yet for {activeSeason?.name || 'an active season'}.
          </p>
        </div>
      )}
    </div>
  );
}
