"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords, Calendar, Sparkles, Check, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Guild, Match, Season, Division } from "@/types/database";

interface GeneratedFixture {
  week: number;
  home_guild: Guild;
  away_guild: Guild;
  scheduled_at: string;
  format: Match["format"];
}

function getInitialStartDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScheduleAdmin() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);

  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [format, setFormat] = useState<Match["format"]>("bo5");
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [fixtures, setFixtures] = useState<GeneratedFixture[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        const [seaRes, divRes, guiRes] = await Promise.all([
          supabase.from("seasons").select("*").order("number", { ascending: false }),
          supabase.from("divisions").select("*").order("tier", { ascending: true }),
          supabase.from("guilds").select("*").order("name", { ascending: true }),
        ]);

        if (seaRes.data && seaRes.data.length > 0) {
          const loadedSeas = seaRes.data as Season[];
          setSeasons(loadedSeas);
          const current = loadedSeas.find((s) => s.is_current);
          setSelectedSeason(current ? current.id : loadedSeas[0].id);
        }
        if (divRes.data && divRes.data.length > 0) {
          const loadedDivs = divRes.data as Division[];
          setDivisions(loadedDivs);
          setSelectedDivision(loadedDivs[0].id);
        }
        if (guiRes.data && guiRes.data.length > 0) {
          setGuilds(guiRes.data as Guild[]);
        }
      } catch (err) {
        console.warn("Load schedule data error:", err);
      }
    }

    loadData();
  }, [supabase]);

  const divisionGuilds = guilds.filter(
    (g) => g.division_id === selectedDivision || selectedDivision === "all"
  );

  const generateRoundRobin = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const teams = [...divisionGuilds];
    if (teams.length < 2) {
      setErrorMessage("At least 2 guilds are required in this division to generate a schedule.");
      return;
    }

    // If odd number, add a bye placeholder
    if (teams.length % 2 !== 0) {
      teams.push({ id: "bye", name: "BYE", tag: "BYE" } as Guild);
    }

    const n = teams.length;
    const rounds = n - 1;
    const half = n / 2;
    const generated: GeneratedFixture[] = [];

    const baseDate = new Date(startDate);

    for (let round = 0; round < rounds; round++) {
      const matchDate = new Date(baseDate.getTime() + round * 7 * 24 * 60 * 60 * 1000);
      matchDate.setHours(19, 0, 0, 0);

      for (let i = 0; i < half; i++) {
        const homeIdx = (round + i) % (n - 1);
        let awayIdx = (n - 1 - i + round) % (n - 1);
        if (i === 0) awayIdx = n - 1;

        const home = teams[homeIdx];
        const away = teams[awayIdx];

        if (home.id !== "bye" && away.id !== "bye") {
          generated.push({
            week: round + 1,
            home_guild: home,
            away_guild: away,
            scheduled_at: matchDate.toISOString(),
            format,
          });
        }
      }
    }

    setFixtures(generated);
    setSuccessMessage(`Successfully generated ${generated.length} fixtures across ${rounds} match weeks!`);
  };

  const handleSaveToDatabase = async () => {
    if (fixtures.length === 0) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const matchRows = fixtures.map((f) => ({
        id: crypto.randomUUID(),
        season_id: selectedSeason,
        division_id: selectedDivision === "all" ? divisions[0]?.id : selectedDivision,
        week: f.week,
        round: `Week ${f.week}`,
        home_guild_id: f.home_guild.id,
        away_guild_id: f.away_guild.id,
        scheduled_at: f.scheduled_at,
        format: f.format,
        status: "scheduled" as const,
        home_score: 0,
        away_score: 0,
        server_info: "CAA Official Server",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("matches").insert(matchRows);
      if (error) {
        setErrorMessage(`Database error: ${error.message}`);
        return;
      }

      setSuccessMessage(`Published ${fixtures.length} matches to official league schedule!`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setIsSaving(false);
    }
  };

  // Group by week
  const weeksMap: { [key: number]: GeneratedFixture[] } = {};
  fixtures.forEach((f) => {
    if (!weeksMap[f.week]) weeksMap[f.week] = [];
    weeksMap[f.week].push(f);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule Generator"
        description="Automated round-robin match scheduler. Pair division rosters and publish official season fixtures."
      />

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-xs text-red-400 hover:text-white"
          >
            Dismiss
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/40 p-4 rounded-xl flex items-center gap-3 text-green-300">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-xs text-green-400 hover:text-white"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Generator Configuration Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" /> Algorithm Parameters
          </CardTitle>
          <CardDescription className="text-slate-400">
            Generate round-robin fixtures ensuring balanced home/away parity for all participating guilds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Season</label>
              <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectValue placeholder="Select Season" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.is_current && "(Active)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Division</label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="all">All Available Guilds</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} (Tier {d.tier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Series Format</label>
              <Select value={format} onValueChange={(val: Match["format"]) => setFormat(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="bo3">Best of 3 (BO3)</SelectItem>
                  <SelectItem value="bo5">Best of 5 (BO5)</SelectItem>
                  <SelectItem value="bo7">Best of 7 (BO7)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Opening Kickoff Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Guilds detected in tier:</span>
              <Badge variant="outline" className="border-slate-700 text-yellow-500 font-mono">
                {divisionGuilds.length} Teams
              </Badge>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                onClick={generateRoundRobin}
                disabled={divisionGuilds.length < 2}
                className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Generate Pairings
              </Button>
              {fixtures.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setFixtures([])}
                  className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Schedule Preview */}
      {fixtures.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Generated Fixtures
                <Badge className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                  {fixtures.length} Total Matches
                </Badge>
              </h2>
              <p className="text-xs text-slate-400">
                Review generated fixtures before committing to the live tournament database.
              </p>
            </div>

            <Button
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              <Check className="w-4 h-4 mr-2" />
              {isSaving ? "Publishing Matches..." : "Commit Schedule to League"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(weeksMap).map((weekStr) => {
              const weekNum = parseInt(weekStr);
              const weekFixtures = weeksMap[weekNum];

              return (
                <Card key={weekNum} className="bg-slate-900/60 border-slate-800">
                  <CardHeader className="py-3 px-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-200">
                      Week {weekNum}
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] border-slate-700 text-slate-400">
                      {weekFixtures.length} Matches
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {weekFixtures.map((f, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">{f.home_guild.name}</span>
                          <Swords className="w-3 h-3 text-slate-500" />
                          <span className="font-medium text-slate-200">{f.away_guild.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="uppercase font-mono text-[10px] text-yellow-500">{f.format}</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span suppressHydrationWarning>
                              {new Date(f.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

