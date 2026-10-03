'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Calendar, Clock, CheckCircle,
  Play, Check, RefreshCw, ArrowRight, AlertTriangle,
  FileText, Plus, X, UserCheck, CheckCircle2, ChevronRight, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatCard, EmptyState } from '@/components/shared';
import { MatchCard } from '@/components/match-card';
import { sampleMatches } from '@/lib/sample-data';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Referee, RefereeAssignment, RefereeReport, Match } from '@/types/database';

export default function RefereeDashboardPage() {
  const [matches, setMatches] = useState<Array<Parameters<typeof MatchCard>[0]['match']>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [currentReferee, setCurrentReferee] = useState<Referee | null>(null);
  const [myAssignments, setMyAssignments] = useState<RefereeAssignment[]>([]);
  const [pendingReports, setPendingReports] = useState<RefereeReport[]>([]);
  const [nowTimestamp, setNowTimestamp] = useState<number>(0);

  // Decline Dialog State
  const [decliningAssignmentId, setDecliningAssignmentId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isProcessingDecline, setIsProcessingDecline] = useState(false);

  // Availability Quick Settings Dialog State
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availableDays, setAvailableDays] = useState('Friday, Saturday, Sunday');
  const [availableHours, setAvailableHours] = useState('18:00 - 23:00 WIB');
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  // Conflict Declaration Dialog State
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictType, setConflictType] = useState('guild_membership');
  const [conflictDesc, setConflictDesc] = useState('');
  const [isSavingConflict, setIsSavingConflict] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch referee profile
        const { data: refRecord } = await supabase
          .from('referees')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (refRecord) {
          setCurrentReferee(refRecord);

          // Fetch availability
          const { data: avail } = await supabase
            .from('referee_availability')
            .select('*')
            .eq('referee_id', refRecord.id)
            .maybeSingle();

          if (avail) {
            setAvailableDays(avail.available_days?.join(', ') || 'Friday, Saturday, Sunday');
            setAvailableHours(avail.available_hours || '18:00 - 23:00 WIB');
          }

          // Fetch my assignments
          const { data: assigns } = await supabase
            .from('referee_assignments')
            .select(`
              *,
              match:matches(
                id, scheduled_at, status, format, round, week, server_info,
                home_guild:guilds!home_guild_id(name, tag, logo_url),
                away_guild:guilds!away_guild_id(name, tag, logo_url),
                division:divisions(name)
              )
            `)
            .eq('referee_id', refRecord.id)
            .order('assigned_at', { ascending: false });

          if (assigns) {
            setMyAssignments(assigns as unknown as RefereeAssignment[]);
          }
        }
      }

      // Fetch matches from supabase
      const { data: matchData, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_guild:guilds!home_guild_id(id, name, tag, logo_url, region),
          away_guild:guilds!away_guild_id(id, name, tag, logo_url, region),
          division:divisions(id, name, tier)
        `)
        .order('scheduled_at', { ascending: true });

      if (!error && matchData && matchData.length > 0) {
        setMatches(matchData as unknown as Array<Parameters<typeof MatchCard>[0]['match']>);
      } else {
        setMatches(sampleMatches);
      }

      // Fetch pending reports
      const { data: reports } = await supabase
        .from('referee_reports')
        .select('*, match:matches(*)')
        .eq('status', 'draft');

      if (reports) {
        setPendingReports(reports as unknown as RefereeReport[]);
      }
    } catch (err) {
      console.warn('Error loading referee dashboard data:', err);
      setMatches(sampleMatches);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setNowTimestamp(Date.now());
    loadData();
  }, [loadData]);

  const handleStartMatch = async (matchId: string) => {
    setActionLoadingId(matchId);
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (!error) {
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, status: 'live' as const } : m))
        );
      }
    } catch (err) {
      console.error('Failed to start match:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRespondAssignment = async (assignmentId: string, action: 'accept' | 'decline') => {
    if (action === 'decline') {
      setDecliningAssignmentId(assignmentId);
      return;
    }

    try {
      const res = await fetch('/api/referees/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, action: 'accept' }),
      });

      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to accept assignment:', err);
    }
  };

  const submitDeclineAssignment = async () => {
    if (!decliningAssignmentId || !declineReason.trim()) return;
    setIsProcessingDecline(true);
    try {
      const res = await fetch('/api/referees/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: decliningAssignmentId,
          action: 'decline',
          decline_reason: declineReason,
        }),
      });

      if (res.ok) {
        setDecliningAssignmentId(null);
        setDeclineReason('');
        await loadData();
      }
    } catch (err) {
      console.error('Failed to decline assignment:', err);
    } finally {
      setIsProcessingDecline(false);
    }
  };

  const handleSaveAvailability = async () => {
    if (!currentReferee) return;
    setIsSavingAvailability(true);
    try {
      const days = availableDays.split(',').map((d) => d.trim()).filter(Boolean);
      await fetch('/api/referees/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referee_id: currentReferee.id,
          available_days: days,
          available_hours: availableHours,
          timezone: currentReferee.timezone,
        }),
      });
      setShowAvailabilityModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleSaveConflict = async () => {
    if (!currentReferee || !conflictDesc.trim()) return;
    setIsSavingConflict(true);
    try {
      await fetch('/api/referees/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referee_id: currentReferee.id,
          conflict_type: conflictType,
          description: conflictDesc,
        }),
      });
      setShowConflictModal(false);
      setConflictDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingConflict(false);
    }
  };

  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled' || m.status === 'check_in');
  const completedMatches = matches.filter((m) => m.status === 'completed');

  // Next upcoming assignment
  const nextAssignment = myAssignments.find((a) => a.status === 'assigned' || a.status === 'accepted');

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Referee Command Desk</h1>
                  {currentReferee && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs font-mono">
                      {currentReferee.rank}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  {currentReferee 
                    ? `Logged in as ${currentReferee.display_name} • Status: ${currentReferee.status.toUpperCase()} • Region: ${currentReferee.region}`
                    : 'Official Match Operations & Live Tournament Adjudication'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {currentReferee && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowAvailabilityModal(true)}
                    className="gap-1.5 border-zinc-700 text-zinc-300 text-xs"
                  >
                    <Clock className="w-3.5 h-3.5" /> Set Availability
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowConflictModal(true)}
                    className="gap-1.5 border-zinc-700 text-zinc-300 text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> Declare Conflict
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData} 
                disabled={loading}
                className="gap-2 border-zinc-700 text-zinc-300 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Spotlight: Upcoming Assignment Card */}
        {nextAssignment && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold">
                    UPCOMING ASSIGNMENT
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono uppercase border-zinc-700 text-zinc-300">
                    Role: {nextAssignment.role} Referee
                  </Badge>
                  {nextAssignment.status === 'assigned' && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/40 text-amber-400 animate-pulse">
                      Action Required: Accept / Decline
                    </Badge>
                  )}
                </div>

                {nextAssignment.match ? (
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      {(nextAssignment.match as unknown as { home_guild?: { name: string } }).home_guild?.name || 'Nightfall'} vs {(nextAssignment.match as unknown as { away_guild?: { name: string } }).away_guild?.name || 'Eclipse'}
                    </h2>
                    <p className="text-xs text-zinc-300 mt-1">
                      {(nextAssignment.match as unknown as { division?: { name: string } }).division?.name || 'Grand League'} • Format: {nextAssignment.match.format?.toUpperCase() || 'BO5'} Series • Scheduled: {new Date(nextAssignment.match.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-white">Nightfall vs Eclipse</h2>
                    <p className="text-xs text-zinc-400">Grand League — Week 4 • Best of 5 Series</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5 items-center">
                {nextAssignment.status === 'assigned' ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleRespondAssignment(nextAssignment.id, 'accept')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept Assignment
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespondAssignment(nextAssignment.id, 'decline')}
                      className="border-zinc-700 text-zinc-300 hover:text-white text-xs gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" /> Decline
                    </Button>
                  </>
                ) : (
                  <Link href={`/referee/match/${nextAssignment.match_id}`}>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs">
                      <Play className="w-4 h-4" /> Open Match Center
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Match Alert Banner */}
        {liveMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/50 bg-red-500/10 p-5 shadow-2xl relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Badge variant="destructive" className="animate-pulse px-3 py-1 font-bold text-xs">
                  ACTIVE LIVE MATCH
                </Badge>
                <span className="text-xs text-zinc-300 font-mono">
                  {liveMatches[0].home_guild.tag} vs {liveMatches[0].away_guild.tag} ({liveMatches[0].format.toUpperCase()})
                </span>
              </div>
              <Link href={`/referee/match/${liveMatches[0].id}`}>
                <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs">
                  <Play className="h-3.5 w-3.5" /> Open Live Controls
                </Button>
              </Link>
            </div>
            <MatchCard match={liveMatches[0]} />
          </motion.div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Fixtures" value={matches.length} subtitle="Season schedule" icon={Calendar} color="blue" />
          <StatCard title="Active Live" value={liveMatches.length} subtitle="In progress" icon={Play} color="red" />
          <StatCard title="My Assignments" value={myAssignments.length} subtitle="Assigned matches" icon={Shield} color="gold" />
          <StatCard title="Completed" value={completedMatches.length} subtitle="Official results" icon={CheckCircle} color="green" />
        </div>

        {/* Main Content Tabs */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="assignments" className="w-full">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="assignments">My Assignments ({myAssignments.length})</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming ({upcomingMatches.length})</TabsTrigger>
                <TabsTrigger value="live">Live Matches ({liveMatches.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedMatches.length})</TabsTrigger>
              </TabsList>

              {/* My Assignments Tab */}
              <TabsContent value="assignments" className="space-y-4 mt-4">
                {myAssignments.length > 0 ? (
                  myAssignments.map((assign) => {
                    const m = (assign as unknown as { match: { id: string; scheduled_at: string; status: string; format: string; round: string; home_guild: { name: string; tag: string }; away_guild: { name: string; tag: string } } }).match;
                    if (!m) return null;

                    return (
                      <div key={assign.id} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">
                                {m.home_guild?.name} vs {m.away_guild?.name}
                              </span>
                              <Badge variant="outline" className="text-xs uppercase font-mono text-blue-400 border-blue-500/30">
                                {assign.role}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {new Date(m.scheduled_at).toLocaleString()} • Format: {m.format?.toUpperCase() || 'BO5'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {assign.status === 'assigned' ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleRespondAssignment(assign.id, 'accept')}
                                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRespondAssignment(assign.id, 'decline')}
                                  className="h-8 text-xs border-zinc-700 text-zinc-300"
                                >
                                  Decline
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline" className="capitalize text-xs text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                                {assign.status}
                              </Badge>
                            )}

                            <Link href={`/referee/match/${assign.match_id}`}>
                              <Button size="sm" className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-white">
                                Open Desk <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState 
                    title="No Match Assignments" 
                    description="You do not currently have any active match assignments. League administrators assign referees for upcoming tournament rounds." 
                  />
                )}
              </TabsContent>

              {/* Upcoming Matches */}
              <TabsContent value="upcoming" className="space-y-4 mt-4">
                {upcomingMatches.length > 0 ? (
                  upcomingMatches.map((match) => (
                    <div key={match.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                      <MatchCard match={match} compact />
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                        <span>Round: <strong className="text-zinc-200">{match.round || 'Regular'}</strong></span>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleStartMatch(match.id)}
                            disabled={actionLoadingId === match.id}
                            className="h-8 text-xs gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                          >
                            <Play className="h-3 w-3" /> Start Match Live
                          </Button>
                          <Link href={`/referee/match/${match.id}`}>
                            <Button size="sm" className="h-8 text-xs gap-1 bg-zinc-800 hover:bg-zinc-700 text-white">
                              Referee Desk <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No upcoming matches" description="There are currently no scheduled matches awaiting referee action." />
                )}
              </TabsContent>

              {/* Live Matches */}
              <TabsContent value="live" className="space-y-4 mt-4">
                {liveMatches.length > 0 ? (
                  liveMatches.map((match) => (
                    <div key={match.id} className="rounded-xl border border-red-500/30 bg-zinc-900/80 p-4 space-y-3">
                      <MatchCard match={match} compact />
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs">
                        <span className="text-red-400 font-mono font-bold animate-pulse">● LIVE SERIES IN PROGRESS</span>
                        <Link href={`/referee/match/${match.id}`}>
                          <Button size="sm" className="h-8 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white font-bold">
                            Open Match Controls <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No live matches" description="No matches are currently active on official game servers." />
                )}
              </TabsContent>

              {/* Completed Matches */}
              <TabsContent value="completed" className="space-y-4 mt-4">
                {completedMatches.length > 0 ? (
                  completedMatches.map((match) => (
                    <div key={match.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                      <MatchCard match={match} compact />
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                        <span>Final Score: <strong className="text-white">{match.home_score} - {match.away_score}</strong></span>
                        <Link href={`/referee/match/${match.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-zinc-300 hover:text-white">
                            View Official Record <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No completed matches" description="Matches completed this season will appear here." />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Pending Reports & Guidelines */}
          <div className="space-y-6">
            {/* Post-Match Reports Due */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Pending Match Reports
                </h3>
                <span className="text-xs text-zinc-500">{pendingReports.length}</span>
              </div>

              {pendingReports.length > 0 ? (
                <div className="space-y-2.5">
                  {pendingReports.map((rep) => {
                    const isOverdue = rep.deadline && nowTimestamp > 0 && new Date(rep.deadline).getTime() < nowTimestamp;
                    return (
                      <div key={rep.id} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white">Match {rep.match_id.substring(0, 8)}</span>
                          {isOverdue ? (
                            <Badge variant="destructive" className="text-[10px]">REPORT OVERDUE</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Due in 24h</Badge>
                          )}
                        </div>
                        <Link href={`/referee/match/${rep.match_id}`}>
                          <Button size="sm" variant="outline" className="w-full h-7 text-[11px] border-zinc-700">
                            Submit Official Report
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>All post-match reports are up to date!</span>
                </div>
              )}
            </div>

            {/* Quick Rules Checklist */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <h3 className="font-bold text-white text-sm">Official Referee Guidelines</h3>
              <div className="space-y-2.5 text-xs text-zinc-300">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Verify both rosters & suspension eligibility before starting series.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Log all technical pauses or disconnect incidents promptly.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Confirm map results after each individual round.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Submit final results to automatically synchronize standings.</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-xs text-zinc-400 space-y-2">
              <span className="font-bold text-white">Need Administrative Assistance?</span>
              <p>For match forfeit rulings, major exploit investigations, or schedule reassignments, contact a Senior Referee or Administrator.</p>
              <Link href="/referees">
                <Button variant="ghost" size="sm" className="w-full text-xs text-blue-400 hover:text-white p-0 h-auto justify-start">
                  View All Certified Referees →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Decline Reason Modal */}
      {decliningAssignmentId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Decline Match Assignment</h3>
            <p className="text-xs text-zinc-400">
              Please specify the reason you are unable to officiate this match. League administration will be notified immediately to reassign another referee.
            </p>

            <div>
              <Label className="text-xs text-zinc-400">Reason for Declining *</Label>
              <Textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Work conflict, unavailable during scheduled hours, personal emergency..."
                className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDecliningAssignmentId(null)}
                className="border-zinc-700 text-zinc-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!declineReason.trim() || isProcessingDecline}
                onClick={submitDeclineAssignment}
                className="text-xs"
              >
                Confirm Decline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Modal */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Configure Availability</h3>
              <button onClick={() => setShowAvailabilityModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Set the days and hours you are available to officiate fixtures. This assists administrators when drafting match assignments.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-zinc-400">Available Days (comma-separated)</Label>
                <Input
                  value={availableDays}
                  onChange={(e) => setAvailableDays(e.target.value)}
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Operating Hours</Label>
                <Input
                  value={availableHours}
                  onChange={(e) => setAvailableHours(e.target.value)}
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleSaveAvailability}
                disabled={isSavingAvailability}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Save Availability
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Declare Conflict of Interest
              </h3>
              <button onClick={() => setShowConflictModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Declare any competitive affiliations or personal ties. The league will warn administrators before assigning you to affected fixtures.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-zinc-400">Conflict Type</Label>
                <select
                  value={conflictType}
                  onChange={(e) => setConflictType(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="guild_membership">Active / Former Guild Membership</option>
                  <option value="prior_management">Prior Guild Management</option>
                  <option value="personal_relationship">Personal Relationship with Player</option>
                  <option value="other">Other Conflict</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Description *</Label>
                <Textarea
                  rows={3}
                  value={conflictDesc}
                  onChange={(e) => setConflictDesc(e.target.value)}
                  placeholder="Detail the guild, player, or circumstance..."
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleSaveConflict}
                disabled={!conflictDesc.trim() || isSavingConflict}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                Submit Conflict Declaration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
