"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit2, Trash2, Swords, Radio, CheckCircle, Clock, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isRefereeMatchConflicted } from "@/lib/auth/permissions";
import type { Match, Guild, Division, Season, Profile } from "@/types/database";

type MatchWithGuilds = Match & { home_guild?: Guild; away_guild?: Guild };

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getInitialScheduledAt() {
  return new Date().toISOString().slice(0, 16);
}

export default function MatchesAdmin() {
  const [matches, setMatches] = useState<MatchWithGuilds[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [referees, setReferees] = useState<Profile[]>([]);
  const [refereeConflict, setRefereeConflict] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchWithGuilds | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    season_id: string;
    division_id: string;
    week: number;
    round: string;
    home_guild_id: string;
    away_guild_id: string;
    scheduled_at: string;
    format: Match["format"];
    status: Match["status"];
    home_score: number;
    away_score: number;
    winner_id: string | null;
    referee_id: string | null;
    server_info: string;
    notes: string;
  }>({
    season_id: "",
    division_id: "",
    week: 1,
    round: "Week 1",
    home_guild_id: "",
    away_guild_id: "",
    scheduled_at: getInitialScheduledAt(),
    format: "bo5",
    status: "scheduled",
    home_score: 0,
    away_score: 0,
    winner_id: null,
    referee_id: null,
    server_info: "Server CAA-01",
    notes: "",
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [matchRes, guildRes, divRes, seaRes, profRes] = await Promise.all([
          supabase
            .from("matches")
            .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
            .order("scheduled_at", { ascending: false }),
          supabase.from("guilds").select("*").order("name", { ascending: true }),
          supabase.from("divisions").select("*").order("tier", { ascending: true }),
          supabase.from("seasons").select("*").order("number", { ascending: false }),
          supabase.from("profiles").select("*").order("username", { ascending: true }),
        ]);

        if (!guildRes.error && guildRes.data) {
          setGuilds(guildRes.data as Guild[]);
        }
        if (!divRes.error && divRes.data) {
          setDivisions(divRes.data as Division[]);
        }
        if (!seaRes.error && seaRes.data) {
          setSeasons(seaRes.data as Season[]);
        }
        if (!profRes.error && profRes.data) {
          setReferees(profRes.data as Profile[]);
        }
        if (!matchRes.error && matchRes.data) {
          setMatches(matchRes.data as MatchWithGuilds[]);
        } else if (matchRes.error) {
          console.error("Failed to load matches from database:", matchRes.error.message);
          setErrorMessage(`Error loading matches: ${matchRes.error.message}`);
        }
      } catch (err) {
        console.warn("Error loading match admin data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  useEffect(() => {
    async function checkConflict() {
      if (formData.referee_id && (formData.home_guild_id || formData.away_guild_id)) {
        const res = await isRefereeMatchConflicted(
          supabase,
          formData.referee_id,
          formData.home_guild_id,
          formData.away_guild_id
        );
        setRefereeConflict(
          res.isConflicted
            ? (res.reason || "Conflict of interest: Referee is affiliated with a competing guild.")
            : null
        );
      } else {
        setRefereeConflict(null);
      }
    }
    checkConflict();
  }, [formData.referee_id, formData.home_guild_id, formData.away_guild_id, supabase]);

  const handleOpenCreate = () => {
    setEditingMatch(null);
    setRefereeConflict(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    const defaultSeasonId = seasons[0]?.id || "";
    const defaultDivisionId = divisions[0]?.id || "";
    const defaultHomeId = guilds[0]?.id || "";
    const defaultAwayId = guilds[1]?.id || guilds[0]?.id || "";

    setFormData({
      season_id: defaultSeasonId,
      division_id: defaultDivisionId,
      week: 1,
      round: "Week 1",
      home_guild_id: defaultHomeId,
      away_guild_id: defaultAwayId,
      scheduled_at: getInitialScheduledAt(),
      format: "bo5",
      status: "scheduled",
      home_score: 0,
      away_score: 0,
      winner_id: null,
      referee_id: null,
      server_info: "Server CAA-01",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (match: MatchWithGuilds) => {
    setEditingMatch(match);
    setErrorMessage(null);
    setSuccessMessage(null);

    setFormData({
      season_id: match.season_id,
      division_id: match.division_id,
      week: match.week,
      round: match.round || "Regular Season",
      home_guild_id: match.home_guild_id,
      away_guild_id: match.away_guild_id,
      scheduled_at: match.scheduled_at ? new Date(match.scheduled_at).toISOString().slice(0, 16) : getInitialScheduledAt(),
      format: match.format,
      status: match.status,
      home_score: match.home_score,
      away_score: match.away_score,
      winner_id: match.winner_id,
      referee_id: match.referee_id,
      server_info: match.server_info || "",
      notes: match.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    // Validate foreign keys
    const validSeasonId = isValidUUID(formData.season_id) ? formData.season_id : seasons[0]?.id;
    const validDivisionId = isValidUUID(formData.division_id) ? formData.division_id : divisions[0]?.id;
    const validHomeId = isValidUUID(formData.home_guild_id) ? formData.home_guild_id : guilds[0]?.id;
    const validAwayId = isValidUUID(formData.away_guild_id) ? formData.away_guild_id : guilds[1]?.id;
    const validRefereeId = isValidUUID(formData.referee_id) ? formData.referee_id : null;
    const validWinnerId = isValidUUID(formData.winner_id) ? formData.winner_id : null;

    if (!validSeasonId || !validDivisionId || !validHomeId || !validAwayId) {
      setErrorMessage("Please ensure Season, Division, and both Teams are selected.");
      setIsSubmitting(false);
      return;
    }

    if (validHomeId === validAwayId) {
      setErrorMessage("Home team and Away team cannot be the same.");
      setIsSubmitting(false);
      return;
    }

    if (refereeConflict) {
      setErrorMessage(`Conflict of Interest Error: ${refereeConflict}. Referees cannot officiate matches involving their own guild.`);
      setIsSubmitting(false);
      return;
    }

    const homeG = guilds.find((g) => g.id === validHomeId);
    const awayG = guilds.find((g) => g.id === validAwayId);

    const payload = {
      season_id: validSeasonId,
      division_id: validDivisionId,
      week: Number(formData.week) || 1,
      round: formData.round,
      home_guild_id: validHomeId,
      away_guild_id: validAwayId,
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      format: formData.format,
      status: formData.status,
      home_score: Number(formData.home_score) || 0,
      away_score: Number(formData.away_score) || 0,
      winner_id: validWinnerId,
      referee_id: validRefereeId,
      server_info: formData.server_info || null,
      notes: formData.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (editingMatch) {
      try {
        const { data, error } = await supabase
          .from("matches")
          .update(payload)
          .eq("id", editingMatch.id)
          .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
          .single();

        if (error) {
          console.error("Match update error:", error);
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = (data as MatchWithGuilds) || {
          ...editingMatch,
          ...payload,
          home_guild: homeG,
          away_guild: awayG,
        };

        setMatches(matches.map((m) => (m.id === editingMatch.id ? updated : m)));
        setSuccessMessage("Match updated successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to update match");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newId = crypto.randomUUID();
      const insertPayload = {
        id: newId,
        ...payload,
        started_at: formData.status === "live" ? new Date().toISOString() : null,
        completed_at: formData.status === "completed" ? new Date().toISOString() : null,
        is_playoff: false,
        bracket_round: null,
        bracket_position: null,
        created_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from("matches")
          .insert(insertPayload)
          .select("*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*)")
          .single();

        if (error) {
          console.error("Match insert error:", error);
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const createdMatch = (data as MatchWithGuilds) || {
          ...insertPayload,
          home_guild: homeG,
          away_guild: awayG,
        };

        setMatches([createdMatch, ...matches]);
        setSuccessMessage("New match scheduled successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to insert match");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleQuickStatus = async (matchId: string, status: Match["status"]) => {
    if (!isValidUUID(matchId)) {
      setErrorMessage(`Cannot update status: Invalid match ID "${matchId}".`);
      return;
    }
    try {
      const updates: Partial<Match> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "live") {
        updates.started_at = new Date().toISOString();
      }
      if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
      if (error) {
        setErrorMessage(`Failed to update status: ${error.message}`);
        return;
      }

      setMatches(
        matches.map((m) => (m.id === matchId ? ({ ...m, ...updates } as MatchWithGuilds) : m))
      );
      setSuccessMessage(`Match status changed to ${status}`);
    } catch {
      setErrorMessage("Network error updating match status");
    }
  };

  const handleDelete = async (matchId: string) => {
    if (!isValidUUID(matchId)) {
      setErrorMessage(`Cannot delete match: Invalid match ID "${matchId}".`);
      return;
    }
    if (!confirm("Are you sure you want to permanently delete this match fixture?")) return;

    try {
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) {
        setErrorMessage(`Failed to delete match: ${error.message}`);
        return;
      }
      setMatches(matches.filter((m) => m.id !== matchId));
      setSuccessMessage("Match deleted successfully from database.");
    } catch {
      setErrorMessage("Network error deleting match");
    }
  };

  const getStatusBadge = (status: Match["status"]) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1.5 animate-pulse">
            <Radio className="w-3 h-3" /> LIVE
          </Badge>
        );
      case "completed":
        return <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">Completed</Badge>;
      case "check_in":
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30">Check-In</Badge>;
      case "cancelled":
      case "forfeit":
        return <Badge variant="outline" className="border-red-800 text-red-500">Forfeit</Badge>;
      case "scheduled":
      default:
        return <Badge variant="outline" className="border-slate-700 text-slate-400">Scheduled</Badge>;
    }
  };

  const filteredMatches = matches.filter((m) => {
    const homeName = m.home_guild?.name || "";
    const awayName = m.away_guild?.name || "";
    const matchesSearch =
      homeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      awayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.round || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    const matchesDivision = divisionFilter === "all" || m.division_id === divisionFilter;
    return matchesSearch && matchesStatus && matchesDivision;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match Operations"
        description="Schedule fixtures, assign certified referees, broadcast live servers, and verify official results."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Schedule Match
          </Button>
        }
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

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search teams or week..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="check_in">Check-in</SelectItem>
              <SelectItem value="live">Live Now</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="forfeit">Forfeit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Matchup</TableHead>
                <TableHead className="text-slate-400 text-center">Score</TableHead>
                <TableHead className="text-slate-400">Stage / Round</TableHead>
                <TableHead className="text-slate-400">Scheduled Time</TableHead>
                <TableHead className="text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Loading matches from database...
                  </TableCell>
                </TableRow>
              ) : filteredMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No matches found matching the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map((match) => (
                  <TableRow key={match.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          {match.home_guild?.name || "Team 1"}
                        </span>
                        <Swords className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-200">
                          {match.away_guild?.name || "Team 2"}
                        </span>
                        <Badge variant="outline" className="border-slate-800 text-[10px] text-yellow-500 uppercase ml-1">
                          {match.format}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {match.server_info || "Server unassigned"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-base text-yellow-500">
                      {match.home_score} - {match.away_score}
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">
                      {match.round}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span suppressHydrationWarning>
                          {new Date(match.scheduled_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(match.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {match.status === "scheduled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuickStatus(match.id, "live")}
                            className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                            title="Go Live"
                          >
                            <Radio className="h-3.5 w-3.5 mr-1" /> Start Live
                          </Button>
                        )}
                        {match.status === "live" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuickStatus(match.id, "completed")}
                            className="h-8 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 text-xs"
                            title="Finalize Match"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Finish
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(match)}
                          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                          title="Edit Match"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(match.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete Match"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Match Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[540px] bg-slate-900 text-slate-50 border-slate-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMatch ? "Update Match Details" : "Schedule New Match"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure teams, dates, format, referee assignments, and results.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="m_home">Home Team</Label>
                <Select
                  value={formData.home_guild_id}
                  onValueChange={(val) => setFormData({ ...formData, home_guild_id: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Home Team" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-56">
                    {guilds.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.tag})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="m_away">Away Team</Label>
                <Select
                  value={formData.away_guild_id}
                  onValueChange={(val) => setFormData({ ...formData, away_guild_id: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Away Team" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-56">
                    {guilds.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.tag})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="m_sea">Season</Label>
                <Select
                  value={formData.season_id}
                  onValueChange={(val) => setFormData({ ...formData, season_id: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Season" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="m_div">Division</Label>
                <Select
                  value={formData.division_id}
                  onValueChange={(val) => setFormData({ ...formData, division_id: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="m_round">Round / Stage</Label>
                <Input
                  id="m_round"
                  value={formData.round}
                  onChange={(e) => setFormData({ ...formData, round: e.target.value })}
                  placeholder="Week 1"
                  className="bg-slate-950 border-slate-800 text-slate-200"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="m_fmt">Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(val: Match["format"]) => setFormData({ ...formData, format: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="bo3">Best of 3</SelectItem>
                    <SelectItem value="bo5">Best of 5</SelectItem>
                    <SelectItem value="bo7">Best of 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="m_status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: Match["status"]) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="check_in">Check-in</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="forfeit">Forfeit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="m_sched">Scheduled Time</Label>
                <Input
                  id="m_sched"
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="m_ref">Assigned Referee</Label>
                <Select
                  value={formData.referee_id || "none"}
                  onValueChange={(val) => setFormData({ ...formData, referee_id: val === "none" ? null : val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Referee" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-56">
                    <SelectItem value="none">No Referee Assigned</SelectItem>
                    {referees.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name || p.username} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {refereeConflict && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                <span>
                  <strong>Conflict of Interest:</strong> {refereeConflict}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="grid gap-2">
                <Label htmlFor="h_score">Home Score</Label>
                <Input
                  id="h_score"
                  type="number"
                  min={0}
                  max={7}
                  value={formData.home_score}
                  onChange={(e) => setFormData({ ...formData, home_score: parseInt(e.target.value) || 0 })}
                  className="bg-slate-900 border-slate-800 font-mono text-center font-bold"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="a_score">Away Score</Label>
                <Input
                  id="a_score"
                  type="number"
                  min={0}
                  max={7}
                  value={formData.away_score}
                  onChange={(e) => setFormData({ ...formData, away_score: parseInt(e.target.value) || 0 })}
                  className="bg-slate-900 border-slate-800 font-mono text-center font-bold"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="m_server">Server Info / Roblox VIP Link</Label>
              <Input
                id="m_server"
                value={formData.server_info}
                onChange={(e) => setFormData({ ...formData, server_info: e.target.value })}
                placeholder="Server CAA-01 or VIP Server link..."
                className="bg-slate-950 border-slate-800"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-slate-700 text-slate-300"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving to Database..." : editingMatch ? "Save Match" : "Schedule Match"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

