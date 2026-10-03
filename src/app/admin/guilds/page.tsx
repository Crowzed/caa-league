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
import { Search, Filter, Plus, Edit2, Trash2, Check, X, ShieldAlert, AlertCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Guild, Division } from "@/types/database";

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default function GuildsAdmin() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGuild, setEditingGuild] = useState<Guild | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    tag: string;
    region: string;
    division_id: string;
    status: Guild["status"];
    description: string;
    discord_invite: string;
  }>({
    name: "",
    tag: "",
    region: "NA",
    division_id: "none",
    status: "active",
    description: "",
    discord_invite: "",
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [guildsRes, divisionsRes] = await Promise.all([
          supabase.from("guilds").select("*").order("created_at", { ascending: false }),
          supabase.from("divisions").select("*").order("tier", { ascending: true }),
        ]);

        if (!guildsRes.error && guildsRes.data) {
          setGuilds(guildsRes.data as Guild[]);
        }

        if (!divisionsRes.error && divisionsRes.data) {
          setDivisions(divisionsRes.data as Division[]);
        }
      } catch (err) {
        console.warn("Load guilds error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  const handleOpenCreate = () => {
    setEditingGuild(null);
    setErrorMessage(null);
    setFormData({
      name: "",
      tag: "",
      region: "NA",
      division_id: divisions[0]?.id || "none",
      status: "active",
      description: "",
      discord_invite: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (guild: Guild) => {
    setEditingGuild(guild);
    setErrorMessage(null);
    setFormData({
      name: guild.name,
      tag: guild.tag,
      region: guild.region || "NA",
      division_id: guild.division_id && isValidUUID(guild.division_id) ? guild.division_id : "none",
      status: guild.status,
      description: guild.description || "",
      discord_invite: guild.discord_invite || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const validDivisionId = isValidUUID(formData.division_id) ? formData.division_id : null;

    if (editingGuild) {
      try {
        const updatePayload = {
          name: formData.name,
          tag: formData.tag.toUpperCase(),
          region: formData.region,
          division_id: validDivisionId,
          status: formData.status,
          description: formData.description || null,
          discord_invite: formData.discord_invite || null,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("guilds")
          .update(updatePayload)
          .eq("id", editingGuild.id)
          .select()
          .single();

        if (error) {
          console.error("Update guild error:", error);
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = data as Guild;
        setGuilds((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        setSuccessMessage(`Guild "${updated.name}" updated successfully.`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsDialogOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update guild.";
        setErrorMessage(msg);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        const newGuildId = crypto.randomUUID();
        const insertPayload = {
          id: newGuildId,
          name: formData.name,
          tag: formData.tag.toUpperCase(),
          region: formData.region,
          division_id: validDivisionId,
          status: formData.status,
          description: formData.description || null,
          discord_invite: formData.discord_invite || null,
          logo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("guilds")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          console.error("Insert guild error:", error);
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const created = data as Guild;
        setGuilds((prev) => [created, ...prev]);
        setSuccessMessage(`Guild "${created.name}" created successfully.`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsDialogOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create guild.";
        setErrorMessage(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdateStatus = async (guildId: string, newStatus: Guild["status"]) => {
    try {
      const { error } = await supabase
        .from("guilds")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", guildId);

      if (error) {
        alert(`Error updating status: ${error.message}`);
        return;
      }

      if (newStatus === "active" || newStatus === "approved") {
        // Initialize clean stats and standings for current season
        const { data: currSeason } = await supabase
          .from("seasons")
          .select("id")
          .eq("is_current", true)
          .maybeSingle();

        const targetGuild = guilds.find((g) => g.id === guildId);
        const divId = targetGuild?.division_id || divisions[0]?.id;

        if (currSeason) {
          if (divId && isValidUUID(divId)) {
            await supabase.from("standings").upsert({
              guild_id: guildId,
              division_id: divId,
              season_id: currSeason.id,
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
            season_id: currSeason.id,
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
      }

      setGuilds((prev) =>
        prev.map((g) => (g.id === guildId ? { ...g, status: newStatus } : g))
      );
      setSuccessMessage(`Guild status changed to ${newStatus}. Clean statistics initialized.`);
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status.";
      alert(msg);
    }
  };

  const handleDelete = async (guildId: string, guildName: string) => {
    if (confirm(`Are you sure you want to delete "${guildName}"? This action cannot be undone.`)) {
      try {
        const { error } = await supabase.from("guilds").delete().eq("id", guildId);
        if (error) {
          alert(`Error deleting guild: ${error.message}`);
          return;
        }

        setGuilds((prev) => prev.filter((g) => g.id !== guildId));
        setSuccessMessage(`Guild "${guildName}" deleted.`);
        setTimeout(() => setSuccessMessage(null), 2500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete guild.";
        alert(msg);
      }
    }
  };

  const filteredGuilds = guilds.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.tag.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Guild["status"]) => {
    switch (status) {
      case "active":
      case "approved":
        return <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">Pending Review</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">Rejected</Badge>;
      case "inactive":
        return <Badge variant="outline" className="text-slate-400 border-slate-700">Suspended</Badge>;
      case "disbanded":
      default:
        return <Badge variant="outline" className="text-slate-600 border-slate-800">Disbanded</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guild Management"
        description="Review registrations, approve rosters, manage divisional allocations, and disciplinary states."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add Guild
          </Button>
        }
      />

      {successMessage && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search guilds by name or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="inactive">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Guild</TableHead>
                <TableHead className="text-slate-400">Region</TableHead>
                <TableHead className="text-slate-400">Division</TableHead>
                <TableHead className="text-slate-400">Discord</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Loading guilds...
                  </TableCell>
                </TableRow>
              ) : filteredGuilds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No guilds found matching the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGuilds.map((guild) => {
                  const divObj = divisions.find((d) => d.id === guild.division_id);
                  return (
                    <TableRow key={guild.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-yellow-500 text-xs">
                            {guild.tag}
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{guild.name}</div>
                            <div className="text-xs text-slate-500 font-normal">{guild.description}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono text-xs">{guild.region || "NA"}</TableCell>
                      <TableCell className="text-slate-300 text-sm">
                        {divObj ? (
                          <span className="font-medium text-blue-400">{divObj.name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        {guild.discord_invite ? (
                          <a
                            href={guild.discord_invite}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            Discord
                          </a>
                        ) : (
                          <span className="text-slate-600">None</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(guild.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          {guild.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateStatus(guild.id, "active")}
                                className="h-8 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 text-xs"
                                title="Approve Guild"
                              >
                                <Check className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateStatus(guild.id, "rejected")}
                                className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                                title="Reject Guild"
                              >
                                <X className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {guild.status === "active" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(guild.id, "inactive")}
                              className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              title="Suspend Guild"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          {guild.status === "inactive" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(guild.id, "active")}
                              className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              title="Reactivate Guild"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(guild)}
                            className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                            title="Edit Guild"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(guild.id, guild.name)}
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Delete Guild"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 text-slate-50 border-slate-800">
          <DialogHeader>
            <DialogTitle>{editingGuild ? "Edit Guild Details" : "Register New Guild"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update guild profile, division placement, and status.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="g_name">Guild Name</Label>
                <Input
                  id="g_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Crimson Vanguard"
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="g_tag">Tag (2-5 chars)</Label>
                <Input
                  id="g_tag"
                  value={formData.tag}
                  maxLength={5}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="CVG"
                  className="bg-slate-950 border-slate-800 uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="g_region">Region</Label>
                <Select
                  value={formData.region}
                  onValueChange={(val) => setFormData({ ...formData, region: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="NA">North America (NA)</SelectItem>
                    <SelectItem value="EU">Europe (EU)</SelectItem>
                    <SelectItem value="APAC">Asia-Pacific (APAC)</SelectItem>
                    <SelectItem value="SA">South America (SA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="g_division">Division</Label>
                <Select
                  value={formData.division_id}
                  onValueChange={(val) => setFormData({ ...formData, division_id: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="none">Unassigned / None</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="g_status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: Guild["status"]) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="inactive">Suspended</SelectItem>
                    <SelectItem value="disbanded">Disbanded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="g_discord">Discord Invite URL</Label>
                <Input
                  id="g_discord"
                  value={formData.discord_invite}
                  onChange={(e) => setFormData({ ...formData, discord_invite: e.target.value })}
                  placeholder="https://discord.gg/..."
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="g_desc">Guild Bio / Description</Label>
              <Input
                id="g_desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tactical specialty or history..."
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
                disabled={isSubmitting}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
              >
                {isSubmitting ? "Saving..." : editingGuild ? "Save Guild" : "Create Guild"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

