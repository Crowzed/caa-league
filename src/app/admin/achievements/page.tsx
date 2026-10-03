"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Search, Trophy, Award, Star, Shield, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { sampleAchievements } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/client";
import type { Achievement } from "@/types/database";

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default function AchievementsAdmin() {
  const [achievements, setAchievements] = useState<Achievement[]>(sampleAchievements);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    icon: string;
    type: Achievement["type"];
  }>({
    name: "",
    description: "",
    icon: "trophy",
    type: "championship",
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadAchievements() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("achievements")
          .select("*")
          .order("created_at", { ascending: true });

        if (!error && data) {
          setAchievements(data as Achievement[]);
        } else if (error) {
          console.error("Load achievements error:", error.message);
          setErrorMessage(`Failed to load achievements: ${error.message}`);
        }
      } catch (err) {
        console.warn("Load achievements error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAchievements();
  }, [supabase]);

  const handleOpenCreate = () => {
    setEditingAchievement(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      name: "",
      description: "",
      icon: "trophy",
      type: "championship",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (ach: Achievement) => {
    setEditingAchievement(ach);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({
      name: ach.name,
      description: ach.description,
      icon: ach.icon || "trophy",
      type: ach.type,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      type: formData.type,
    };

    if (editingAchievement) {
      if (!isValidUUID(editingAchievement.id)) {
        setErrorMessage(`Invalid achievement ID "${editingAchievement.id}". Cannot update.`);
        setIsSubmitting(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("achievements")
          .update(payload)
          .eq("id", editingAchievement.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updated = (data as Achievement) || { ...editingAchievement, ...payload };
        setAchievements(
          achievements.map((a) => (a.id === editingAchievement.id ? updated : a))
        );
        setSuccessMessage("Achievement badge updated successfully!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to update achievement");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newId = crypto.randomUUID();
      const insertPayload = {
        id: newId,
        criteria: {},
        created_at: new Date().toISOString(),
        ...payload,
      };

      try {
        const { data, error } = await supabase
          .from("achievements")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          setErrorMessage(`Database error: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const created = (data as Achievement) || insertPayload;
        setAchievements([...achievements, created]);
        setSuccessMessage("Achievement created successfully in database!");
        setIsDialogOpen(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to insert achievement");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!isValidUUID(id)) {
      setErrorMessage(`Invalid achievement ID "${id}". Cannot delete.`);
      return;
    }
    if (!confirm("Are you sure you want to delete this achievement badge?")) return;

    try {
      const { error } = await supabase.from("achievements").delete().eq("id", id);
      if (error) {
        setErrorMessage(`Failed to delete achievement: ${error.message}`);
        return;
      }
      setAchievements(achievements.filter((a) => a.id !== id));
      setSuccessMessage("Achievement deleted successfully.");
    } catch {
      setErrorMessage("Network error deleting achievement");
    }
  };

  const getIconComponent = (icon: string | null) => {
    switch (icon) {
      case "star": return <Star className="w-4 h-4 text-yellow-400" />;
      case "shield": return <Shield className="w-4 h-4 text-blue-400" />;
      case "award": return <Award className="w-4 h-4 text-purple-400" />;
      case "zap": return <Zap className="w-4 h-4 text-amber-400" />;
      case "trophy":
      default:
        return <Trophy className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getTypeBadge = (type: Achievement["type"]) => {
    switch (type) {
      case "championship":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">Championship</Badge>;
      case "milestone":
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/40">Milestone</Badge>;
      case "record":
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/40">Record</Badge>;
      case "special":
      default:
        return <Badge variant="outline" className="border-slate-700 text-slate-300">Special</Badge>;
    }
  };

  const filteredAchievements = achievements.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || a.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievement Badges"
        description="Configure league trophies, milestone medals, and season accolades for players and guilds."
        action={
          <Button onClick={handleOpenCreate} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add Achievement
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
            placeholder="Search achievements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
            className={filterType === "all" ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-800"}
          >
            All Types
          </Button>
          <Button
            variant={filterType === "championship" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("championship")}
            className={filterType === "championship" ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-800"}
          >
            Championships
          </Button>
          <Button
            variant={filterType === "milestone" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("milestone")}
            className={filterType === "milestone" ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-800"}
          >
            Milestones
          </Button>
          <Button
            variant={filterType === "record" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("record")}
            className={filterType === "record" ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-800"}
          >
            Records
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Badge</TableHead>
                <TableHead className="text-slate-400">Title & Description</TableHead>
                <TableHead className="text-slate-400">Tier / Type</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    Loading achievements from database...
                  </TableCell>
                </TableRow>
              ) : filteredAchievements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No achievements found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAchievements.map((ach) => (
                  <TableRow key={ach.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                        {getIconComponent(ach.icon)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-200">{ach.name}</div>
                      <div className="text-xs text-slate-400">{ach.description}</div>
                    </TableCell>
                    <TableCell>{getTypeBadge(ach.type)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(ach)}
                          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(ach.id)}
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
            <DialogTitle>{editingAchievement ? "Edit Achievement" : "Register Achievement"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set name, unlock criteria, icon, and trophy category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="a_name">Achievement Name</Label>
              <Input
                id="a_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Flawless Season"
                className="bg-slate-950 border-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="a_type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: Achievement["type"]) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="championship">Championship</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="record">Record</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="a_icon">Icon Symbol</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(val) => setFormData({ ...formData, icon: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Icon" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="trophy">Trophy</SelectItem>
                    <SelectItem value="star">Star</SelectItem>
                    <SelectItem value="shield">Shield</SelectItem>
                    <SelectItem value="award">Ribbon Award</SelectItem>
                    <SelectItem value="zap">Lightning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="a_desc">Description / Unlock Requirement</Label>
              <Textarea
                id="a_desc"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Win all matches in the regular season without conceding a loss..."
                className="bg-slate-950 border-slate-800 text-slate-100"
                required
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
                {isSubmitting ? "Saving..." : editingAchievement ? "Save Changes" : "Create Badge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

