"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Clock,
  Swords,
  Lock,
  Layers,
  SlidersHorizontal,
  Compass,
  History,
  FileCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOfficialMaps, OFFICIAL_MAP_NAMES } from "@/lib/maps/map-service";
import type { GameMap, CompetitionMapPool, Season, Division, MatchMap } from "@/types/database";

export default function MapsAdmin() {
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [mapPools, setMapPools] = useState<CompetitionMapPool[]>([]);
  const [historicalMaps, setHistoricalMaps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pool Configuration Filter State
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [tournamentFilter, setTournamentFilter] = useState<string>("");

  // Edit Map Modal State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMap, setEditingMap] = useState<GameMap | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: "",
    image_url: "",
    objectives: "",
    layout_info: "",
    status: "active" as "active" | "inactive" | "retired" | "maintenance",
    is_competitive: true,
  });

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Official Maps
      const mapsData = await getOfficialMaps(supabase);
      setMaps(mapsData);

      // 2. Fetch Seasons & Divisions
      const [{ data: sData }, { data: dData }, { data: poolData }, { data: histData }] = await Promise.all([
        supabase.from("seasons").select("*").order("number", { ascending: false }),
        supabase.from("divisions").select("*").order("tier", { ascending: true }),
        supabase.from("competition_map_pools").select("*, map:maps(*)"),
        supabase.from("match_maps").select(`
          id,
          game_number,
          home_score,
          away_score,
          map_score,
          start_time,
          end_time,
          status,
          match_status,
          map:maps(id, name),
          match:matches(id, round, home_guild:guilds!home_guild_id(name, tag), away_guild:guilds!away_guild_id(name, tag)),
          winner:guilds!match_maps_winner_id_fkey(name, tag),
          losing_guild:guilds!match_maps_losing_guild_id_fkey(name, tag),
          referee:profiles!match_maps_referee_id_fkey(display_name, username)
        `).order("created_at", { ascending: false }).limit(50),
      ]);

      setSeasons((sData as Season[]) || []);
      setDivisions((dData as Division[]) || []);
      setMapPools((poolData as CompetitionMapPool[]) || []);
      setHistoricalMaps((histData as any[]) || []);
    } catch (err: any) {
      console.error("Error loading map admin data:", err);
      setErrorMessage(err.message || "Failed to load map data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  // Open Edit Map Details
  const handleOpenEdit = (map: GameMap) => {
    setEditingMap(map);
    setEditFormData({
      description: map.description || "",
      image_url: map.image_url || "",
      objectives: map.objectives || "",
      layout_info: map.layout_info || "",
      status: (map.status as any) || (map.is_active ? "active" : "inactive"),
      is_competitive: map.is_competitive ?? true,
    });
    setIsEditDialogOpen(true);
  };

  // Save Map Edits
  const handleSaveMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMap) return;

    try {
      const { error } = await supabase
        .from("maps")
        .update({
          description: editFormData.description,
          image_url: editFormData.image_url || null,
          objectives: editFormData.objectives || null,
          layout_info: editFormData.layout_info || null,
          status: editFormData.status,
          is_active: editFormData.status === "active",
          is_competitive: editFormData.is_competitive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingMap.id);

      if (error) throw error;

      setSuccessMessage(`Map "${editingMap.name}" details updated.`);
      setIsEditDialogOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update map.");
    }
  };

  // Toggle Pool Availability for a Map
  const handleTogglePoolMap = async (mapId: string, currentAvailability: boolean) => {
    try {
      const seasonId = selectedSeasonId === "all" ? null : selectedSeasonId;
      const divisionId = selectedDivisionId === "all" ? null : selectedDivisionId;
      const format = selectedFormat === "all" ? null : selectedFormat;
      const compType = seasonId ? "season" : divisionId ? "division" : "global";

      // Check if entry already exists in competition_map_pools
      const existing = mapPools.find(
        (p) =>
          p.map_id === mapId &&
          (p.season_id || null) === seasonId &&
          (p.division_id || null) === divisionId &&
          (p.match_format || null) === format
      );

      if (existing) {
        const { error } = await supabase
          .from("competition_map_pools")
          .update({
            is_available: !currentAvailability,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("competition_map_pools").insert({
          competition_type: compType,
          season_id: seasonId,
          division_id: divisionId,
          match_format: format as any,
          map_id: mapId,
          is_available: !currentAvailability,
        });

        if (error) throw error;
      }

      setSuccessMessage("Competition map pool updated.");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update map pool.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Maps & Map Pool Management"
        description="The league supports exactly four official maps: Plains, Thermopylae, Castle, and Fortress. Configure competitive pools per season, division, or tournament."
      />

      {/* Notifications */}
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

      {/* Info Callout */}
      <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
        <Lock className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
        <div className="space-y-1 text-xs text-slate-300">
          <div className="font-semibold text-slate-100">Official Maps Integrity Policy</div>
          <div>
            The Command An Army League restricts competitive fixtures strictly to the 4 verified canon maps:
            <span className="font-semibold text-yellow-400"> Plains, Thermopylae, Castle, and Fortress</span>.
            Maps cannot be deleted or arbitrarily renamed to preserve historical match telemetry.
          </div>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="catalog" className="data-[state=active]:bg-slate-800 text-slate-300">
            <Compass className="h-4 w-4 mr-2 text-yellow-400" />
            Official Map Catalog (4)
          </TabsTrigger>
          <TabsTrigger value="pool" className="data-[state=active]:bg-slate-800 text-slate-300">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-blue-400" />
            Competition Map Pools
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-slate-800 text-slate-300">
            <History className="h-4 w-4 mr-2 text-purple-400" />
            Match Map Telemetry ({historicalMaps.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Official Maps Catalog */}
        <TabsContent value="catalog" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">Standard Competitive Arenas</CardTitle>
              <CardDescription className="text-slate-400">
                Official game arenas verified for Command An Army league play.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Map Name</TableHead>
                    <TableHead className="text-slate-400">Terrain / Arena Type</TableHead>
                    <TableHead className="text-slate-400 text-center">Status</TableHead>
                    <TableHead className="text-slate-400 text-center">Official Map</TableHead>
                    <TableHead className="text-slate-400 text-center">Competitive Enabled</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                        Loading maps catalog...
                      </TableCell>
                    </TableRow>
                  ) : (
                    maps.map((map) => (
                      <TableRow key={map.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell>
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            <span>{map.name}</span>
                            <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
                              Canon
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 max-w-sm mt-0.5 line-clamp-2">
                            {map.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                            {map.map_type || "Open Field"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              (map.status || "active") === "active"
                                ? "bg-green-500/20 text-green-400 border border-green-500/30 text-xs"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs"
                            }
                          >
                            {(map.status || "active").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Official
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {map.is_competitive ?? true ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-700 text-slate-500 text-xs">
                              Disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(map)}
                            className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            Edit Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Map Pool Configuration */}
        <TabsContent value="pool" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-blue-400" />
                    Configure Competition Map Pools
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Control which of the 4 official maps are available for specific Seasons, Divisions, or Formats without deleting map data.
                  </CardDescription>
                </div>
              </div>

              {/* Pool Context Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Target Season</Label>
                  <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectValue placeholder="All Seasons" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="all">All Seasons (Global Pool)</SelectItem>
                      {seasons.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} (Season {s.number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Target Division</Label>
                  <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectValue placeholder="All Divisions" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="all">All Divisions</SelectItem>
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} (Tier {d.tier})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Match Series Format</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectValue placeholder="All Formats" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="all">All Formats (BO3, BO5, BO7)</SelectItem>
                      <SelectItem value="bo1">Best of 1</SelectItem>
                      <SelectItem value="bo3">Best of 3</SelectItem>
                      <SelectItem value="bo5">Best of 5</SelectItem>
                      <SelectItem value="bo7">Best of 7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {maps.map((map) => {
                  // Find pool entry
                  const seasonId = selectedSeasonId === "all" ? null : selectedSeasonId;
                  const divisionId = selectedDivisionId === "all" ? null : selectedDivisionId;
                  const format = selectedFormat === "all" ? null : selectedFormat;

                  const poolEntry = mapPools.find(
                    (p) =>
                      p.map_id === map.id &&
                      (p.season_id || null) === seasonId &&
                      (p.division_id || null) === divisionId &&
                      (p.match_format || null) === format
                  );

                  const isAvailable = poolEntry ? poolEntry.is_available : true;

                  return (
                    <div
                      key={map.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isAvailable
                          ? "bg-slate-950/70 border-slate-800"
                          : "bg-slate-950/30 border-red-500/20 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-base">{map.name}</span>
                        <Switch
                          checked={isAvailable}
                          onCheckedChange={() => handleTogglePoolMap(map.id, isAvailable)}
                        />
                      </div>
                      <div className="mt-2 text-xs text-slate-400 line-clamp-2">
                        {map.description}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Pool Status:</span>
                        {isAvailable ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                            Available in Pool
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">
                            Excluded from Pool
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Historical Telemetry */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-purple-400" />
                Historical Match Map Telemetry
              </CardTitle>
              <CardDescription className="text-slate-400">
                Matches preserve the exact Map ID and official name played. Historical records remain immutable.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Game #</TableHead>
                    <TableHead className="text-slate-400">Official Map Name</TableHead>
                    <TableHead className="text-slate-400">Competing Guilds</TableHead>
                    <TableHead className="text-slate-400 text-center">Score</TableHead>
                    <TableHead className="text-slate-400">Winning Guild</TableHead>
                    <TableHead className="text-slate-400">Referee</TableHead>
                    <TableHead className="text-right text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalMaps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        No match map records found. Maps recorded by referees will appear here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historicalMaps.map((record) => (
                      <TableRow key={record.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="font-mono text-xs text-slate-300">
                          Game {record.game_number || 1}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-100">
                          {record.map?.name || "Official Arena"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">
                          {record.match?.home_guild?.name || "Home"} vs {record.match?.away_guild?.name || "Away"}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-amber-400">
                          {record.map_score || `${record.home_score || 0} - ${record.away_score || 0}`}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-green-400">
                          {record.winner?.name || "Undecided"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {record.referee?.display_name || record.referee?.username || "Official"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs">
                            {record.match_status || record.status || "Completed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Map Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <form onSubmit={handleSaveMap}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-yellow-500" />
                Edit Official Map: {editingMap?.name}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Update arena imagery, tactical descriptions, and competitive status.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="map_name">Map Name</Label>
                <Input
                  id="map_name"
                  value={editingMap?.name || ""}
                  disabled
                  className="bg-slate-950 border-slate-800 text-slate-400 font-bold"
                />
                <span className="text-[11px] text-slate-500">Official map names are protected from modification.</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  placeholder="https://... or /maps/..."
                  value={editFormData.image_url}
                  onChange={(e) => setEditFormData({ ...editFormData, image_url: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Map Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(val: any) => setEditFormData({ ...editFormData, status: val })}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Competitive Eligibility</Label>
                  <Select
                    value={editFormData.is_competitive ? "enabled" : "disabled"}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, is_competitive: val === "enabled" })
                    }
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue placeholder="Competitive" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="enabled">Competitive: Enabled</SelectItem>
                      <SelectItem value="disabled">Competitive: Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditDialogOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium">
                Save Map Configuration
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
