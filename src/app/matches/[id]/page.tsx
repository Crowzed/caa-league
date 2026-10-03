"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionHeader } from "@/components/shared";
import { format } from "date-fns";
import { Calendar, Clock, Trophy, Map, Users, AlertCircle, PlayCircle, ShieldAlert, Scale, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Match, Guild, Division, Sanction } from "@/types/database";

type MatchWithGuilds = Match & { home_guild?: Guild; away_guild?: Guild };

export default function MatchCenterPage() {
  const params = useParams();
  const matchId = typeof params.id === "string" ? params.id : "";
  const [match, setMatch] = useState<MatchWithGuilds | null>(null);
  const [division, setDivision] = useState<Division | null>(null);
  const [matchSanctions, setMatchSanctions] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadMatch() {
      try {
        const { data, error } = await supabase
          .from("matches")
          .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
          .eq("id", matchId)
          .maybeSingle();

        if (!error && data) {
          setMatch(data as unknown as MatchWithGuilds);
          if (data.division_id) {
            const { data: divData } = await supabase
              .from("divisions")
              .select("*")
              .eq("id", data.division_id)
              .maybeSingle();
            if (divData) setDivision(divData as Division);
          }
        }

        // Check if any disciplinary actions affected this match
        const { data: sData } = await supabase
          .from("sanctions")
          .select("*")
          .eq("match_id", matchId);
        
        if (sData) {
          setMatchSanctions(sData as Sanction[]);
        }
      } catch (err) {
        console.warn("Match load note:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [matchId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container mx-auto py-16 px-4">
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="Match Not Found"
          description="The match you are looking for does not exist or has been removed."
        />
      </div>
    );
  }

  const homeGuild = match.home_guild;
  const awayGuild = match.away_guild;
  const matchDate = new Date(match.scheduled_at || (match as { scheduled_time?: string }).scheduled_time || '');

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Official Disciplinary Notice Banners if affected by a sanction */}
      {matchSanctions.length > 0 && (
        <div className="space-y-3">
          {matchSanctions.map((sanction) => (
            <div 
              key={sanction.id} 
              className="rounded-xl border border-red-500/40 bg-red-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-red-500/20 text-red-400 shrink-0">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-red-400 uppercase tracking-wide">
                      Official Disciplinary Action
                    </span>
                    <Badge variant="destructive" className="text-[10px] uppercase font-mono">
                      {sanction.sanction_type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">({sanction.sanction_code})</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono border-red-500/30 text-red-300">
                      Status: {sanction.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {sanction.violation}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {sanction.decision_summary}
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
                <Button asChild size="sm" variant="outline" className="border-red-500/30 hover:bg-red-500/10 text-xs w-full sm:w-auto">
                  <Link href={`/discipline/${sanction.sanction_code}`} className="flex items-center gap-1.5">
                    <span>View Disciplinary Ruling</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match Header */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-lg relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-900/20 via-background to-red-900/20 opacity-50"></div>
        
        <div className="relative p-6 sm:p-10 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-8">
            <Badge variant="outline" className="bg-background">
              {division?.name} - Week {match.week}
            </Badge>
            
            <div className="flex gap-2">
              {match.status === "live" && (
                <Badge variant="destructive" className="animate-pulse flex gap-1">
                  <PlayCircle className="h-3 w-3" /> Live
                </Badge>
              )}
              {match.status === "completed" && (
                <Badge variant="secondary">Final</Badge>
              )}
              {match.status === "scheduled" && (
                <Badge variant="outline">Scheduled</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center w-full gap-8 sm:gap-16">
            {/* Home Guild */}
            <Link href={`/guilds/${match.home_guild_id}`} className="flex flex-col items-center gap-4 group">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-muted flex items-center justify-center border-2 border-transparent group-hover:border-primary transition-colors overflow-hidden">
                {homeGuild?.logo_url ? (
                  <Image src={homeGuild.logo_url} alt={homeGuild?.name || 'Home Guild'} width={128} height={128} className="object-cover" />
                ) : (
                  <Trophy className="h-12 w-12 text-muted-foreground opacity-50" />
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-center">{homeGuild?.name || 'Home Guild'}</h2>
            </Link>

            {/* Score / VS */}
            <div className="flex flex-col items-center">
              {match.status === "scheduled" ? (
                <div className="text-4xl sm:text-5xl font-black text-muted-foreground/30">VS</div>
              ) : (
                <div className="flex items-center gap-4 text-5xl sm:text-7xl font-black tabular-nums">
                  <span className={cn(
                    match.home_score > match.away_score ? "text-primary" : "text-foreground"
                  )}>{match.home_score}</span>
                  <span className="text-3xl text-muted-foreground">-</span>
                  <span className={cn(
                    match.away_score > match.home_score ? "text-primary" : "text-foreground"
                  )}>{match.away_score}</span>
                </div>
              )}
              
              <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2" suppressHydrationWarning>
                  <Calendar className="h-4 w-4" />
                  <span>{format(matchDate, "EEEE, MMMM do, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2" suppressHydrationWarning>
                  <Clock className="h-4 w-4" />
                  <span>{format(matchDate, "h:mm a")}</span>
                </div>
              </div>
            </div>

            {/* Away Guild */}
            <Link href={`/guilds/${match.away_guild_id}`} className="flex flex-col items-center gap-4 group">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-muted flex items-center justify-center border-2 border-transparent group-hover:border-primary transition-colors overflow-hidden">
                {awayGuild?.logo_url ? (
                  <Image src={awayGuild.logo_url} alt={awayGuild?.name || 'Away Guild'} width={128} height={128} className="object-cover" />
                ) : (
                  <Trophy className="h-12 w-12 text-muted-foreground opacity-50" />
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-center">{awayGuild?.name || 'Away Guild'}</h2>
            </Link>
          </div>
        </div>
      </div>

      {match.status === "live" && (
        <div className="bg-blue-950/30 border border-blue-900 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-400">Match in Progress</h4>
            <p className="text-sm text-blue-200/70">Scores and stats are updated automatically. Refreshing the page is not necessary.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Match Info Details */}
          <section>
            <SectionHeader title="Match Information" />
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 p-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Format</div>
                    <div className="font-medium">Best of 5</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Referee</div>
                    <div className="font-medium">RefUser123</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Server</div>
                    <div className="font-medium">US East</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Caster</div>
                    <div className="font-medium">Not Assigned</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Maps Section */}
          <section>
            <SectionHeader title="Maps & Results" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((num) => {
                const isPlayed = num <= match.home_score + match.away_score;
                return (
                  <Card key={num} className={cn(!isPlayed && "opacity-60")}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded bg-muted flex items-center justify-center font-bold text-lg">
                        M{num}
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Map className="h-4 w-4" /> Map {num} Name
                        </h4>
                        <div className="text-sm text-muted-foreground">Mode • Map Type</div>
                      </div>
                      <div className="flex-shrink-0 font-bold tabular-nums">
                        {isPlayed ? "Completed" : "Not Played"}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Rosters */}
          <section>
            <SectionHeader title="Rosters" />
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> Active Lineups
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex">
                  <div className="flex-1 border-r border-border p-4">
                    <h5 className="font-semibold text-center mb-4 text-sm truncate">{homeGuild?.name || 'Home Guild'}</h5>
                    <ul className="space-y-2 text-sm">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <li key={i} className="flex justify-between items-center">
                          <span>Player {i + 1}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex-1 p-4">
                    <h5 className="font-semibold text-center mb-4 text-sm truncate">{awayGuild?.name || 'Away Guild'}</h5>
                    <ul className="space-y-2 text-sm">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <li key={i} className="flex justify-between items-center">
                          <span className="text-right w-full">Player {i + 1}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Timeline / Events Placeholder */}
          <section>
            <SectionHeader title="Match Events" />
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[200px]">
                <Clock className="h-8 w-8 mb-2 opacity-20" />
                <p>Event timeline will be available during and after the match.</p>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
