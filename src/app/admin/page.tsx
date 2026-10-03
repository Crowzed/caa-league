"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StatCard, SectionHeader } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Users,
  Swords,
  AlertCircle,
  Plus,
  ChevronRight,
  FileText,
  Calendar,
  Radio,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Guild, Match, Season, Division } from "@/types/database";

type UpcomingMatchWithGuilds = Match & {
  home_guild: Guild;
  away_guild: Guild;
  division?: Division;
};

export default function AdminDashboard() {
  const [counts, setCounts] = useState({
    guilds: 0,
    players: 0,
    matches: 0,
    pendingActions: 0,
  });
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [pendingGuilds, setPendingGuilds] = useState<Guild[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatchWithGuilds[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const loadDashboardData = useCallback(async () => {
    try {
      const [
        guildCountRes,
        playerCountRes,
        matchCountRes,
        pendingGuildsCountRes,
        pendingProtestsCountRes,
        seasonRes,
        pendingGuildsRes,
        upcomingMatchesRes,
      ] = await Promise.all([
        supabase.from("guilds").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("matches").select("*", { count: "exact", head: true }),
        supabase.from("guilds").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("protests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("seasons").select("*").eq("is_current", true).maybeSingle(),
        supabase
          .from("guilds")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("matches")
          .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*), division:divisions(*)")
          .in("status", ["live", "scheduled", "check_in"])
          .order("scheduled_at", { ascending: true })
          .limit(5),
      ]);

      const pendingTotal = (pendingGuildsCountRes.count || 0) + (pendingProtestsCountRes.count || 0);

      setCounts({
        guilds: guildCountRes.count || 0,
        players: playerCountRes.count || 0,
        matches: matchCountRes.count || 0,
        pendingActions: pendingTotal,
      });

      if (seasonRes.data) {
        setActiveSeason(seasonRes.data as Season);
      }

      if (pendingGuildsRes.data) {
        setPendingGuilds(pendingGuildsRes.data as Guild[]);
      }

      if (upcomingMatchesRes.data) {
        setUpcomingMatches(upcomingMatchesRes.data as unknown as UpcomingMatchWithGuilds[]);
      }
    } catch (err) {
      console.warn("Error loading admin dashboard stats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleApproveGuild = async (guildId: string) => {
    setActionLoadingId(guildId);
    setErrorMessage(null);
    try {
      // Find division for assignment if needed
      const { data: defaultDiv } = await supabase
        .from("divisions")
        .select("id")
        .order("tier", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from("guilds")
        .update({ 
          status: "active", 
          division_id: defaultDiv?.id || null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", guildId);

      if (error) {
        setErrorMessage(`Failed to approve guild: ${error.message}`);
        return;
      }

      // Initialize clean 0-0-0 standings and guild statistics for active season
      if (activeSeason) {
        if (defaultDiv?.id) {
          await supabase.from("standings").upsert({
            guild_id: guildId,
            division_id: defaultDiv.id,
            season_id: activeSeason.id,
            rank: 99,
            matches_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            maps_won: 0,
            maps_lost: 0,
            points: 0,
            form: "",
            streak: "",
            updated_at: new Date().toISOString(),
          }, { onConflict: "guild_id,division_id,season_id" });
        }

        await supabase.from("guild_statistics").upsert({
          guild_id: guildId,
          season_id: activeSeason.id,
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          maps_won: 0,
          maps_lost: 0,
          points: 0,
          longest_win_streak: 0,
          current_streak: 0,
          attack_wins: 0,
          defense_wins: 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "guild_id,season_id" });
      }

      setPendingGuilds((prev) => prev.filter((g) => g.id !== guildId));
      setCounts((prev) => ({
        ...prev,
        pendingActions: Math.max(0, prev.pendingActions - 1),
        guilds: prev.guilds + 1,
      }));
      setSuccessMessage("Guild application approved! Data and statistics cleanly initialized to 0-0-0.");
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch {
      setErrorMessage("Network error approving guild");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectGuild = async (guildId: string) => {
    setActionLoadingId(guildId);
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from("guilds")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", guildId);

      if (error) {
        setErrorMessage(`Failed to reject guild: ${error.message}`);
        return;
      }

      setPendingGuilds((prev) => prev.filter((g) => g.id !== guildId));
      setCounts((prev) => ({
        ...prev,
        pendingActions: Math.max(0, prev.pendingActions - 1),
      }));
      setSuccessMessage("Guild application marked as rejected.");
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch {
      setErrorMessage("Network error rejecting guild");
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatMatchTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard Overview"
        description={`CAA League Command Center — ${activeSeason ? activeSeason.name : "Active Season"}`}
      />

      {successMessage && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
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

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Guilds"
          value={isLoading ? "..." : counts.guilds}
          description="Registered combat teams"
          icon={<Shield className="h-4 w-4 text-blue-400" />}
        />
        <StatCard
          title="Active Players"
          value={isLoading ? "..." : counts.players}
          description="Roster member accounts"
          icon={<Users className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard
          title="Matches This Season"
          value={isLoading ? "..." : counts.matches}
          description={activeSeason ? activeSeason.name.split(" - ")[0] : "All Recorded"}
          icon={<Swords className="h-4 w-4 text-amber-400" />}
        />
        <StatCard
          title="Pending Actions"
          value={isLoading ? "..." : counts.pendingActions}
          description="Applications & protests"
          icon={<AlertCircle className={`h-4 w-4 ${counts.pendingActions > 0 ? "text-yellow-400 animate-pulse" : "text-slate-400"}`} />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Quick Actions */}
        <Card className="col-span-full bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Link href="/admin/seasons">
              <Button className="bg-yellow-600 hover:bg-yellow-700 text-white">
                <Plus className="mr-2 h-4 w-4" /> Create Season
              </Button>
            </Link>
            <Link href="/admin/schedule">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <Calendar className="mr-2 h-4 w-4" /> Schedule Generator
              </Button>
            </Link>
            <Link href="/admin/matches">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <Swords className="mr-2 h-4 w-4" /> Match Operations
              </Button>
            </Link>
            <Link href="/admin/news">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <FileText className="mr-2 h-4 w-4" /> Publish News
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Pending Guild Applications */}
        <Card className="col-span-full lg:col-span-4 bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Guild Applications</CardTitle>
              <CardDescription>
                {pendingGuilds.length === 0
                  ? "All guild registration applications reviewed"
                  : `${pendingGuilds.length} guild${pendingGuilds.length > 1 ? "s" : ""} waiting for approval`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/guilds">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingGuilds.length === 0 ? (
              <div className="py-8 text-center rounded-lg border border-dashed border-slate-800">
                <Shield className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-medium">No pending guild applications.</p>
                <p className="text-slate-600 text-xs mt-1">New registrations from /guilds/register will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingGuilds.map((guild) => (
                  <div
                    key={guild.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-slate-800 bg-slate-950/50 gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-sm shrink-0">
                        {guild.tag || "GLD"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-200">{guild.name}</p>
                          <Badge variant="outline" className="text-[10px] border-slate-700">
                            {guild.region || "Global"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {guild.description || "No description provided."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        size="sm"
                        disabled={actionLoadingId === guild.id}
                        onClick={() => handleApproveGuild(guild.id)}
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3"
                      >
                        {actionLoadingId === guild.id ? "Updating..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoadingId === guild.id}
                        onClick={() => handleRejectGuild(guild.id)}
                        className="h-8 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs px-3"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card className="col-span-full lg:col-span-3 bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Matches</CardTitle>
              <CardDescription>Live & Scheduled Fixtures</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/matches">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length === 0 ? (
              <div className="py-8 text-center rounded-lg border border-dashed border-slate-800">
                <Calendar className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-medium">No upcoming matches found.</p>
                <p className="text-slate-600 text-xs mt-1">Generate schedules in the Schedule Generator.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`flex flex-col p-3 rounded-lg border bg-slate-950/50 ${
                      match.status === "live"
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span suppressHydrationWarning>{formatMatchTime(match.scheduled_at)}</span>
                      </div>
                      {match.status === "live" ? (
                        <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] animate-pulse flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5" /> LIVE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                          {match.division?.name || match.round || "Sanctioned"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center font-medium text-sm">
                      <span className="text-slate-200 truncate max-w-[110px]" title={match.home_guild?.name}>
                        {match.home_guild?.name || "TBD"}
                      </span>
                      <span className="text-slate-500 text-xs font-semibold px-2">
                        {match.status === "live" ? `${match.home_score} - ${match.away_score}` : "vs"}
                      </span>
                      <span className="text-slate-200 truncate max-w-[110px] text-right" title={match.away_guild?.name}>
                        {match.away_guild?.name || "TBD"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
