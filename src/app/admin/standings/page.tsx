'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, RotateCcw, Calculator, Plus, Edit2, 
  CheckCircle2, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import type { Standing, Season, Division, Guild } from '@/types/database';

type StandingWithGuild = Standing & { guild?: Guild };

export default function AdminStandingsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [standings, setStandings] = useState<StandingWithGuild[]>([]);
  const [availableGuilds, setAvailableGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dialogs
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [editingStanding, setEditingStanding] = useState<StandingWithGuild | null>(null);
  const [addTeamGuildId, setAddTeamGuildId] = useState<string>('');

  const [formValues, setFormValues] = useState({
    rank: 1,
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    maps_won: 0,
    maps_lost: 0,
    points: 0,
    form: '',
    streak: '',
  });

  const supabase = createClient();

  // 1. Initial Load: Seasons & Active Guilds
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const [seasonRes, guildRes] = await Promise.all([
          supabase.from('seasons').select('*').order('number', { ascending: false }),
          supabase.from('guilds').select('*').eq('status', 'active').order('name', { ascending: true }),
        ]);

        if (seasonRes.data && seasonRes.data.length > 0) {
          setSeasons(seasonRes.data as Season[]);
          const current = seasonRes.data.find((s) => s.is_current) || seasonRes.data[0];
          setSelectedSeasonId(current.id);
        }

        if (guildRes.data) {
          setAvailableGuilds(guildRes.data as Guild[]);
        }
      } catch (err) {
        console.warn('Error loading initial standings data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, [supabase]);

  // 2. Load Divisions for Selected Season
  useEffect(() => {
    async function loadDivisions() {
      if (!selectedSeasonId) return;
      try {
        const { data, error } = await supabase
          .from('divisions')
          .select('*')
          .eq('season_id', selectedSeasonId)
          .order('tier', { ascending: true });

        if (!error && data && data.length > 0) {
          setDivisions(data as Division[]);
          setSelectedDivisionId(data[0].id);
        } else {
          setDivisions([]);
          setSelectedDivisionId('');
        }
      } catch (err) {
        console.warn('Error loading divisions:', err);
      }
    }
    loadDivisions();
  }, [selectedSeasonId, supabase]);

  // 3. Load Standings for Selected Season & Division
  const loadStandings = useCallback(async () => {
    if (!selectedSeasonId || !selectedDivisionId) {
      setStandings([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('standings')
        .select('*, guild:guilds(*)')
        .eq('season_id', selectedSeasonId)
        .eq('division_id', selectedDivisionId)
        .order('rank', { ascending: true });

      if (!error && data) {
        setStandings(data as StandingWithGuild[]);
      }
    } catch (err) {
      console.warn('Error loading standings:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId, selectedDivisionId, supabase]);

  useEffect(() => {
    loadStandings();
  }, [loadStandings]);

  // Action: Reset All Teams in this Division to 0-0-0
  const handleResetStandings = async () => {
    if (!confirm('Are you sure you want to reset all team records in this division to 0-0-0? This will clear points, wins, and form.')) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updates = standings.map((st, idx) => ({
        id: st.id,
        guild_id: st.guild_id,
        division_id: st.division_id,
        season_id: st.season_id,
        rank: idx + 1,
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        maps_won: 0,
        maps_lost: 0,
        points: 0,
        form: '',
        streak: '',
        updated_at: new Date().toISOString(),
      }));

      for (const row of updates) {
        await supabase.from('standings').update(row).eq('id', row.id);
      }

      setSuccessMessage('Successfully reset all division standings to 0-0-0.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadStandings();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reset standings.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Recalculate Standings from Completed Matches
  const handleRecalculateFromMatches = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      // 1. Fetch completed matches in this season and division
      const { data: matches, error: mErr } = await supabase
        .from('matches')
        .select('*')
        .eq('season_id', selectedSeasonId)
        .eq('division_id', selectedDivisionId)
        .eq('status', 'completed');

      if (mErr) throw mErr;

      // 2. Aggregate stats per guild
      const statsMap: Record<string, {
        matches_played: number;
        wins: number;
        draws: number;
        losses: number;
        maps_won: number;
        maps_lost: number;
        points: number;
        form: string[];
      }> = {};

      for (const st of standings) {
        statsMap[st.guild_id] = {
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          maps_won: 0,
          maps_lost: 0,
          points: 0,
          form: [],
        };
      }

      if (matches && matches.length > 0) {
        for (const m of matches) {
          if (!statsMap[m.home_guild_id]) {
            statsMap[m.home_guild_id] = { matches_played: 0, wins: 0, draws: 0, losses: 0, maps_won: 0, maps_lost: 0, points: 0, form: [] };
          }
          if (!statsMap[m.away_guild_id]) {
            statsMap[m.away_guild_id] = { matches_played: 0, wins: 0, draws: 0, losses: 0, maps_won: 0, maps_lost: 0, points: 0, form: [] };
          }

          const homeStats = statsMap[m.home_guild_id];
          const awayStats = statsMap[m.away_guild_id];

          homeStats.matches_played += 1;
          awayStats.matches_played += 1;
          homeStats.maps_won += m.home_score;
          homeStats.maps_lost += m.away_score;
          awayStats.maps_won += m.away_score;
          awayStats.maps_lost += m.home_score;

          if (m.home_score > m.away_score) {
            homeStats.wins += 1;
            homeStats.points += 3;
            homeStats.form.push('W');
            awayStats.losses += 1;
            awayStats.form.push('L');
          } else if (m.away_score > m.home_score) {
            awayStats.wins += 1;
            awayStats.points += 3;
            awayStats.form.push('W');
            homeStats.losses += 1;
            homeStats.form.push('L');
          } else {
            homeStats.draws += 1;
            awayStats.draws += 1;
            homeStats.points += 1;
            awayStats.points += 1;
            homeStats.form.push('D');
            awayStats.form.push('D');
          }
        }
      }

      // 3. Rank teams by points, then map difference (maps_won - maps_lost), then maps_won
      const rankedGuildIds = Object.keys(statsMap).sort((a, b) => {
        const sa = statsMap[a];
        const sb = statsMap[b];
        if (sb.points !== sa.points) return sb.points - sa.points;
        const diffA = sa.maps_won - sa.maps_lost;
        const diffB = sb.maps_won - sb.maps_lost;
        if (diffB !== diffA) return diffB - diffA;
        return sb.maps_won - sa.maps_won;
      });

      // 4. Update standings records
      for (let i = 0; i < rankedGuildIds.length; i++) {
        const gid = rankedGuildIds[i];
        const s = statsMap[gid];
        const existing = standings.find((row) => row.guild_id === gid);
        const rank = i + 1;
        const formStr = s.form.slice(-5).join(',');

        if (existing) {
          await supabase.from('standings').update({
            rank: rank,
            matches_played: s.matches_played,
            wins: s.wins,
            draws: s.draws,
            losses: s.losses,
            maps_won: s.maps_won,
            maps_lost: s.maps_lost,
            points: s.points,
            form: formStr,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await supabase.from('standings').insert({
            id: crypto.randomUUID(),
            guild_id: gid,
            division_id: selectedDivisionId,
            season_id: selectedSeasonId,
            rank: rank,
            matches_played: s.matches_played,
            wins: s.wins,
            draws: s.draws,
            losses: s.losses,
            maps_won: s.maps_won,
            maps_lost: s.maps_lost,
            points: s.points,
            form: formStr,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      setSuccessMessage('Standings recalculated from official match records.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadStandings();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to recalculate standings.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Edit Standing Dialog
  const handleOpenEdit = (st: StandingWithGuild) => {
    setEditingStanding(st);
    setFormValues({
      rank: st.rank,
      matches_played: st.matches_played,
      wins: st.wins,
      draws: st.draws,
      losses: st.losses,
      maps_won: st.maps_won,
      maps_lost: st.maps_lost,
      points: st.points,
      form: st.form || '',
      streak: st.streak || '',
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStanding) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('standings')
        .update({
          ...formValues,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingStanding.id);

      if (error) throw error;

      setIsEditOpen(false);
      setSuccessMessage('Standing record updated.');
      setTimeout(() => setSuccessMessage(null), 2500);
      await loadStandings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating standing');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add Team to Division Standing
  const handleAddTeam = async () => {
    if (!addTeamGuildId || !selectedDivisionId || !selectedSeasonId) return;
    setIsProcessing(true);
    try {
      const newRank = standings.length + 1;
      const { error } = await supabase.from('standings').insert({
        id: crypto.randomUUID(),
        guild_id: addTeamGuildId,
        division_id: selectedDivisionId,
        season_id: selectedSeasonId,
        rank: newRank,
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        maps_won: 0,
        maps_lost: 0,
        points: 0,
        form: '',
        streak: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setIsAddTeamOpen(false);
      setAddTeamGuildId('');
      setSuccessMessage('Team added to division standing with fresh 0-0-0 record.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadStandings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add team.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const selectedDivision = divisions.find((d) => d.id === selectedDivisionId);

  return (
    <div className="container py-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader 
          title="League Standings Administration" 
          description="Manage division placements, reset team records to 0-0-0, and calculate points from match records." 
        />
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadStandings} 
            disabled={loading}
            className="border-zinc-700 text-zinc-300 gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Season & Division Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div>
          <Label className="text-xs text-zinc-400">Select Season</Label>
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger className="mt-1 bg-zinc-950 border-zinc-700 text-white">
              <SelectValue placeholder="Select Season" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.is_current ? '(Current Active)' : `(${s.status})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-zinc-400">Select Division</Label>
          <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId} disabled={divisions.length === 0}>
            <SelectTrigger className="mt-1 bg-zinc-950 border-zinc-700 text-white">
              <SelectValue placeholder={divisions.length > 0 ? "Select Division" : "No divisions for season"} />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} (Tier {d.tier})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Division Controls & Standings Table */}
      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              {selectedDivision?.name || 'Division'} Standings
            </CardTitle>
            <CardDescription className="text-zinc-400 text-xs">
              {selectedSeason?.name} • Tier {selectedDivision?.tier || 1} • {standings.length} Teams Enrolled
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetStandings}
              disabled={isProcessing || standings.length === 0}
              className="text-xs gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset to 0-0-0
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateFromMatches}
              disabled={isProcessing}
              className="text-xs gap-1.5 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
            >
              <Calculator className="w-3.5 h-3.5" /> Recalculate From Matches
            </Button>

            <Button
              size="sm"
              onClick={() => setIsAddTeamOpen(true)}
              className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" /> Add Team
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {standings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>Guild</TableHead>
                  <TableHead className="text-center">MP</TableHead>
                  <TableHead className="text-center text-green-400">W</TableHead>
                  <TableHead className="text-center text-yellow-400">D</TableHead>
                  <TableHead className="text-center text-red-400">L</TableHead>
                  <TableHead className="text-center">Maps</TableHead>
                  <TableHead className="text-center">Diff</TableHead>
                  <TableHead className="text-center font-bold text-white">PTS</TableHead>
                  <TableHead className="text-center">Form</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((st) => {
                  const guild = st.guild || { name: 'Unknown Guild', tag: 'UNK' };
                  const mapDiff = st.maps_won - st.maps_lost;
                  return (
                    <TableRow key={st.id} className="border-zinc-800 hover:bg-zinc-800/40">
                      <TableCell className="text-center font-bold text-zinc-300">
                        #{st.rank}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-400 text-xs">
                            [{guild.tag}]
                          </span>
                          <span className="font-medium text-white text-xs">{guild.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">{st.matches_played}</TableCell>
                      <TableCell className="text-center text-xs text-green-400 font-semibold">{st.wins}</TableCell>
                      <TableCell className="text-center text-xs text-yellow-400">{st.draws}</TableCell>
                      <TableCell className="text-center text-xs text-red-400">{st.losses}</TableCell>
                      <TableCell className="text-center text-xs text-zinc-400 font-mono">
                        {st.maps_won}-{st.maps_lost}
                      </TableCell>
                      <TableCell className={`text-center text-xs font-mono font-semibold ${
                        mapDiff > 0 ? 'text-green-400' : mapDiff < 0 ? 'text-red-400' : 'text-zinc-400'
                      }`}>
                        {mapDiff > 0 ? `+${mapDiff}` : mapDiff}
                      </TableCell>
                      <TableCell className="text-center text-sm font-black text-white">
                        {st.points}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          {st.form ? (
                            st.form.replace(/,/g, '').split('').slice(-5).map((f, i) => (
                              <span
                                key={i}
                                className={`text-[10px] w-4 h-4 rounded flex items-center justify-center font-bold ${
                                  f === 'W' ? 'bg-green-500/20 text-green-400' :
                                  f === 'L' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                              >
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-zinc-500">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(st)}
                          className="h-8 text-xs text-zinc-300 hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8">
              <EmptyState 
                title="No teams registered in this division" 
                description="Click 'Add Team' to assign a guild to this division standing, or recalculate from matches." 
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Standing Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Standing: {editingStanding?.guild?.name}</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Manually adjust points, ranks, and match records.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4 text-xs">
            <div>
              <Label className="text-zinc-400">Rank Position</Label>
              <Input 
                type="number" 
                min={1} 
                value={formValues.rank} 
                onChange={(e) => setFormValues(prev => ({ ...prev, rank: parseInt(e.target.value) || 1 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Total Points (PTS)</Label>
              <Input 
                type="number" 
                value={formValues.points} 
                onChange={(e) => setFormValues(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white font-bold" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Wins (W)</Label>
              <Input 
                type="number" 
                min={0} 
                value={formValues.wins} 
                onChange={(e) => setFormValues(prev => ({ ...prev, wins: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white text-green-400" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Losses (L)</Label>
              <Input 
                type="number" 
                min={0} 
                value={formValues.losses} 
                onChange={(e) => setFormValues(prev => ({ ...prev, losses: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white text-red-400" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Draws (D)</Label>
              <Input 
                type="number" 
                min={0} 
                value={formValues.draws} 
                onChange={(e) => setFormValues(prev => ({ ...prev, draws: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white text-yellow-400" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Matches Played (MP)</Label>
              <Input 
                type="number" 
                min={0} 
                value={formValues.matches_played} 
                onChange={(e) => setFormValues(prev => ({ ...prev, matches_played: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Maps Won</Label>
              <Input 
                type="number" 
                min={0} 
                value={formValues.maps_won} 
                onChange={(e) => setFormValues(prev => ({ ...prev, maps_won: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white" 
              />
            </div>

            <div>
              <Label className="text-zinc-400">Maps Lost</Label>
              <Input 
                type="number" 
                min={0} 
                value={formValues.maps_lost} 
                onChange={(e) => setFormValues(prev => ({ ...prev, maps_lost: parseInt(e.target.value) || 0 }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white" 
              />
            </div>

            <div className="col-span-2">
              <Label className="text-zinc-400">Form (e.g. W,W,L,W)</Label>
              <Input 
                value={formValues.form} 
                onChange={(e) => setFormValues(prev => ({ ...prev, form: e.target.value.toUpperCase() }))}
                className="mt-1 bg-zinc-950 border-zinc-700 text-white font-mono" 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="text-zinc-400">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Dialog */}
      <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team to Division Standing</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Select an active guild to register into {selectedDivision?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label className="text-xs text-zinc-400">Select Guild</Label>
              <Select value={addTeamGuildId} onValueChange={setAddTeamGuildId}>
                <SelectTrigger className="mt-1 bg-zinc-950 border-zinc-700 text-white">
                  <SelectValue placeholder="Select active guild" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                  {availableGuilds
                    .filter((g) => !standings.some((st) => st.guild_id === g.id))
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        [{g.tag}] {g.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddTeamOpen(false)} className="text-zinc-400">
              Cancel
            </Button>
            <Button onClick={handleAddTeam} disabled={!addTeamGuildId || isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white">
              Add to Standing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

