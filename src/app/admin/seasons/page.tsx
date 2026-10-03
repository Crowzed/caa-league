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
import { Plus, Edit, Trash2, Calendar as CalendarIcon, CheckCircle2, Star, AlertCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sampleSeasons } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/client";
import type { Season } from "@/types/database";

function getDefaultDates() {
  const now = Date.now();
  return {
    start: new Date(now).toISOString().split("T")[0],
    end: new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    reg: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
}

export default function SeasonsAdmin() {
  const [seasons, setSeasons] = useState<Season[]>(sampleSeasons);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    number: number;
    start_date: string;
    end_date: string;
    registration_deadline: string;
    status: Season["status"];
    is_current: boolean;
  }>({
    name: "",
    number: 3,
    start_date: "",
    end_date: "",
    registration_deadline: "",
    status: "upcoming",
    is_current: false,
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadSeasons() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("seasons")
          .select("*")
          .order("number", { ascending: false });

        if (!error && data && data.length > 0) {
          setSeasons(data as Season[]);
        }
      } catch (err) {
        console.warn("Load seasons error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSeasons();
  }, [supabase]);

  const handleOpenCreate = () => {
    setEditingSeason(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    const defaults = getDefaultDates();
    setFormData({
      name: `Season ${seasons.length + 1}`,
      number: seasons.length + 1,
      start_date: defaults.start,
      end_date: defaults.end,
      registration_deadline: defaults.reg,
      status: "upcoming",
      is_current: false,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (season: Season) => {
    setEditingSeason(season);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      name: season.name,
      number: season.number,
      start_date: season.start_date || "",
      end_date: season.end_date || "",
      registration_deadline: season.registration_deadline || "",
      status: season.status,
      is_current: season.is_current,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: formData.name,
      number: Number(formData.number) || 1,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      registration_deadline: formData.registration_deadline || null,
      status: formData.status,
      is_current: formData.is_current,
      updated_at: new Date().toISOString(),
    };

    if (formData.is_current) {
      await supabase.from("seasons").update({ is_current: false }).neq("id", editingSeason ? editingSeason.id : "");
    }

    if (editingSeason) {
      try {
        const { data, error } = await supabase
          .from("seasons")
          .update(payload)
          .eq("id", editingSeason.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = (data as Season) || { ...editingSeason, ...payload };
        setSeasons(
          seasons.map((s) =>
            s.id === editingSeason.id
              ? updated
              : formData.is_current
              ? { ...s, is_current: false }
              : s
          )
        );
        setSuccessMessage("Season updated successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to update season");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newId = crypto.randomUUID();
      const insertPayload = {
        id: newId,
        rules_version_id: null,
        created_at: new Date().toISOString(),
        ...payload,
      };

      try {
        const { data, error } = await supabase
          .from("seasons")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const created = (data as Season) || insertPayload;
        if (formData.is_current) {
          setSeasons([created, ...seasons.map((s) => ({ ...s, is_current: false }))]);
        } else {
          setSeasons([created, ...seasons]);
        }
        setSuccessMessage("Season created successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to create season");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSetCurrent = async (seasonId: string) => {
    try {
      await supabase.from("seasons").update({ is_current: false }).neq("id", seasonId);
      const { error } = await supabase.from("seasons").update({ is_current: true }).eq("id", seasonId);
      if (error) {
        setErrorMessage(`Failed to set active season: ${error.message}`);
        return;
      }

      setSeasons(
        seasons.map((s) => ({
          ...s,
          is_current: s.id === seasonId,
        }))
      );
      setSuccessMessage("Active season updated!");
    } catch {
      setErrorMessage("Network error updating active season");
    }
  };

  const handleDelete = async (seasonId: string) => {
    if (!confirm("Are you sure you want to delete this season? This cannot be undone.")) return;

    try {
      const { error } = await supabase.from("seasons").delete().eq("id", seasonId);
      if (error) {
        setErrorMessage(`Failed to delete season: ${error.message}`);
        return;
      }
      setSeasons(seasons.filter((s) => s.id !== seasonId));
      setSuccessMessage("Season deleted successfully.");
    } catch {
      setErrorMessage("Network error deleting season");
    }
  };

  const getStatusBadge = (status: Season["status"]) => {
    switch (status) {
      case "group_stage":
      case "playoffs":
        return <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">Active Stage</Badge>;
      case "registration":
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30">Registration Open</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-slate-400 border-slate-700">Completed</Badge>;
      case "archived":
        return <Badge variant="outline" className="text-slate-600 border-slate-800">Archived</Badge>;
      case "upcoming":
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">Upcoming</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Season Management"
        description="Create and manage league seasons, registration periods, tournament stages, and status."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> New Season
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

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">#</TableHead>
                <TableHead className="text-slate-400">Season Name</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Active Timeline</TableHead>
                <TableHead className="text-slate-400">Registration</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Loading seasons from database...
                  </TableCell>
                </TableRow>
              ) : seasons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No seasons registered. Click &quot;New Season&quot; to begin.
                  </TableCell>
                </TableRow>
              ) : (
                seasons.map((season) => (
                  <TableRow key={season.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-mono text-yellow-500">
                      S{season.number}
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <span>{season.name}</span>
                        {season.is_current && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 text-[11px] py-0">
                            <Star className="w-3 h-3 fill-yellow-400" /> Current
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(season.status)}</TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {season.start_date || "TBD"} &rarr; {season.end_date || "TBD"}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {season.registration_deadline ? `Closes ${season.registration_deadline}` : "No deadline"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Link href="/admin/standings">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            title="Manage standings for this season"
                          >
                            <Trophy className="h-3.5 w-3.5 mr-1" /> Standings
                          </Button>
                        </Link>
                        {!season.is_current && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetCurrent(season.id)}
                            className="text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                            title="Set as active season"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Set Active
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(season)}
                          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(season.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

      {/* Create / Edit Season Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 text-slate-50 border-slate-800">
          <DialogHeader>
            <DialogTitle>{editingSeason ? "Edit Season" : "Create New Season"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure timeline, stages, and registration parameters for this season.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="s_name">Season Name</Label>
                <Input
                  id="s_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Season 2 - Rising Storm"
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s_number">Season #</Label>
                <Input
                  id="s_number"
                  type="number"
                  min={1}
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: parseInt(e.target.value) || 1 })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s_start">Start Date</Label>
                <Input
                  id="s_start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s_end">End Date</Label>
                <Input
                  id="s_end"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s_reg">Registration Deadline</Label>
                <Input
                  id="s_reg"
                  type="date"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="s_status">Current Stage</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: Season["status"]) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="registration">Registration Open</SelectItem>
                    <SelectItem value="group_stage">Group Stage</SelectItem>
                    <SelectItem value="playoffs">Playoffs</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_current"
                checked={formData.is_current}
                onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-yellow-500 focus:ring-yellow-500"
              />
              <Label htmlFor="is_current" className="text-sm font-normal text-slate-300">
                Designate as official Active Season for the league
              </Label>
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
                {isSubmitting ? "Saving..." : editingSeason ? "Save Season" : "Create Season"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

