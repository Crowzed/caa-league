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
import { Plus, Edit2, Trash2, Users, ArrowUpRight, ArrowDownRight, Trophy, AlertCircle, CheckCircle2 } from "lucide-react";
import { sampleDivisions, sampleSeasons } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/client";
import type { Division, Season } from "@/types/database";

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default function DivisionsAdmin() {
  const [divisions, setDivisions] = useState<Division[]>(sampleDivisions);
  const [seasons, setSeasons] = useState<Season[]>(sampleSeasons);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    tier: 1,
    max_teams: 8,
    promotion_spots: 2,
    relegation_spots: 2,
    playoff_spots: 4,
    description: "",
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [divRes, seasRes] = await Promise.all([
          supabase.from("divisions").select("*").order("tier", { ascending: true }),
          supabase.from("seasons").select("*").order("number", { ascending: false }),
        ]);

        if (seasRes.data && seasRes.data.length > 0) {
          const loadedSeasons = seasRes.data as Season[];
          setSeasons(loadedSeasons);
          const current = loadedSeasons.find((s) => s.is_current);
          setSelectedSeason(current ? current.id : loadedSeasons[0].id);
        }

        if (divRes.data && divRes.data.length > 0) {
          setDivisions(divRes.data as Division[]);
        }
      } catch (err) {
        console.warn("Load divisions error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  const handleOpenCreate = () => {
    setEditingDivision(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      name: "",
      tier: divisions.length + 1,
      max_teams: 8,
      promotion_spots: 2,
      relegation_spots: 2,
      playoff_spots: 4,
      description: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (div: Division) => {
    setEditingDivision(div);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      name: div.name,
      tier: div.tier,
      max_teams: div.max_teams || 8,
      promotion_spots: div.promotion_spots || 0,
      relegation_spots: div.relegation_spots || 0,
      playoff_spots: div.playoff_spots || 4,
      description: div.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const validSeasonId = isValidUUID(selectedSeason) ? selectedSeason : seasons[0]?.id;
    if (!validSeasonId) {
      setErrorMessage("Please select a valid season for this division.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name: formData.name,
      tier: Number(formData.tier) || 1,
      max_teams: Number(formData.max_teams) || 8,
      promotion_spots: Number(formData.promotion_spots) || 0,
      relegation_spots: Number(formData.relegation_spots) || 0,
      playoff_spots: Number(formData.playoff_spots) || 4,
      description: formData.description || null,
    };

    if (editingDivision) {
      try {
        const { data, error } = await supabase
          .from("divisions")
          .update(payload)
          .eq("id", editingDivision.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = (data as Division) || { ...editingDivision, ...payload };
        setDivisions(divisions.map((d) => (d.id === editingDivision.id ? updated : d)));
        setSuccessMessage("Division updated successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to update division");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newId = crypto.randomUUID();
      const insertPayload = {
        id: newId,
        season_id: validSeasonId,
        created_at: new Date().toISOString(),
        ...payload,
      };

      try {
        const { data, error } = await supabase
          .from("divisions")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const created = (data as Division) || insertPayload;
        setDivisions([...divisions, created]);
        setSuccessMessage("Division created successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to create division");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this division?")) return;

    try {
      const { error } = await supabase.from("divisions").delete().eq("id", id);
      if (error) {
        setErrorMessage(`Failed to delete division: ${error.message}`);
        return;
      }
      setDivisions(divisions.filter((d) => d.id !== id));
      setSuccessMessage("Division deleted successfully.");
    } catch {
      setErrorMessage("Network error deleting division");
    }
  };

  const filteredDivisions = divisions.filter((d) => !selectedSeason || d.season_id === selectedSeason);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Division Management"
        description="Configure tier structures, team limits, playoff slots, and promotion/relegation thresholds."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add Division
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

      {/* Season Selector Filter */}
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <span className="text-sm font-medium text-slate-400">Filter by Season:</span>
        <div className="flex gap-2 flex-wrap">
          {seasons.map((season) => (
            <Button
              key={season.id}
              variant={selectedSeason === season.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSeason(season.id)}
              className={
                selectedSeason === season.id
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }
            >
              {season.name} {season.is_current && "(Active)"}
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Tier</TableHead>
                <TableHead className="text-slate-400">Division Name</TableHead>
                <TableHead className="text-slate-400 text-center">Max Guilds</TableHead>
                <TableHead className="text-slate-400 text-center">Playoff Spots</TableHead>
                <TableHead className="text-slate-400 text-center">Promotion</TableHead>
                <TableHead className="text-slate-400 text-center">Relegation</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Loading divisions from database...
                  </TableCell>
                </TableRow>
              ) : filteredDivisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No divisions configured for this season.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDivisions.map((division) => (
                  <TableRow key={division.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell>
                      <Badge variant="outline" className="border-slate-700 text-yellow-500">
                        Tier {division.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-200">
                      <div>{division.name}</div>
                      <div className="text-xs text-slate-500 font-normal">{division.description}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {division.max_teams}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-400 font-medium">
                        <Trophy className="w-3.5 h-3.5" />
                        {division.playoff_spots}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {division.promotion_spots > 0 ? (
                        <div className="inline-flex items-center gap-0.5 text-xs text-green-400 font-medium bg-green-500/10 px-2 py-0.5 rounded-full">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Top {division.promotion_spots}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {division.relegation_spots > 0 ? (
                        <div className="inline-flex items-center gap-0.5 text-xs text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded-full">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          Bottom {division.relegation_spots}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(division)}
                          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(division.id)}
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

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 text-slate-50 border-slate-800">
          <DialogHeader>
            <DialogTitle>{editingDivision ? "Edit Division" : "Create New Division"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure parameters for this division in the CAA League.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Division Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Grand League"
                className="bg-slate-950 border-slate-800"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tier">Tier Level</Label>
                <Input
                  id="tier"
                  type="number"
                  min={1}
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: parseInt(e.target.value) || 1 })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_teams">Max Guilds</Label>
                <Input
                  id="max_teams"
                  type="number"
                  min={2}
                  value={formData.max_teams}
                  onChange={(e) => setFormData({ ...formData, max_teams: parseInt(e.target.value) || 8 })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="playoff_spots">Playoffs</Label>
                <Input
                  id="playoff_spots"
                  type="number"
                  min={0}
                  value={formData.playoff_spots}
                  onChange={(e) => setFormData({ ...formData, playoff_spots: parseInt(e.target.value) || 0 })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="promotion_spots">Promote</Label>
                <Input
                  id="promotion_spots"
                  type="number"
                  min={0}
                  value={formData.promotion_spots}
                  onChange={(e) => setFormData({ ...formData, promotion_spots: parseInt(e.target.value) || 0 })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="relegation_spots">Relegate</Label>
                <Input
                  id="relegation_spots"
                  type="number"
                  min={0}
                  value={formData.relegation_spots}
                  onChange={(e) => setFormData({ ...formData, relegation_spots: parseInt(e.target.value) || 0 })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Top flight competitive division..."
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
                {isSubmitting ? "Saving..." : editingDivision ? "Save Changes" : "Create Division"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

