'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Shield, Play, Pause, AlertTriangle, CheckCircle2, AlertCircle,
  ArrowLeft, Check, Save, Trophy, MapPin, Plus, Lock, 
  FileText, Clock, Users, UserX, AlertOctagon, Scale, 
  ExternalLink, ChevronRight, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sampleMatches } from '@/lib/sample-data';
import { createClient } from '@/lib/supabase/client';
import { getCompetitionMapPool, recordMatchMap } from '@/lib/maps/map-service';
import type { 
  Match, Guild, Division, MatchIncident, MatchWarning, 
  MatchDecision, RefereeAssignment, Sanction, GameMap 
} from '@/types/database';

interface MatchMapRecord {
  id?: string;
  game_number: number;
  map_name: string;
  home_score: number;
  away_score: number;
  winner_tag: string;
  winner_id?: string;
  duration_minutes?: number;
}

type MatchWithGuilds = Match & {
  home_guild: Guild;
  away_guild: Guild;
  division?: Division;
  pre_match_checks?: Record<string, boolean>;
  is_result_locked?: boolean;
};

interface RosterPlayerCheck {
  id: string;
  username: string;
  display_name: string;
  roblox_username: string;
  guild_id: string;
  guild_tag: string;
  is_starter: boolean;
  is_suspended: boolean;
  suspension_reason?: string;
}

export default function RefereeMatchCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const matchId = resolvedParams.id;

  const [match, setMatch] = useState<MatchWithGuilds | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [matchStatus, setMatchStatus] = useState<string>('scheduled');
  const [isResultLocked, setIsResultLocked] = useState(false);
  const [serverInfo, setServerInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pre-match checks
  const [preChecks, setPreChecks] = useState<Record<string, boolean>>({
    guild_a_checkin: false,
    guild_b_checkin: false,
    rosters_verified: false,
    eligibility_verified: false,
    map_verified: false,
    server_ready: false,
    rules_acknowledged: false,
  });
  const [adminOverride, setAdminOverride] = useState(false);

  // Rosters & Suspension Check
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayerCheck[]>([]);
  const [ineligiblePlayers, setIneligiblePlayers] = useState<RosterPlayerCheck[]>([]);

  // Maps Log & Official Pool
  const [mapsList, setMapsList] = useState<MatchMapRecord[]>([]);
  const [availableOfficialMaps, setAvailableOfficialMaps] = useState<GameMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [mapStartTime, setMapStartTime] = useState<string>('');
  const [newMapGameNumber, setNewMapGameNumber] = useState(1);
  const [newMapHomeScore, setNewMapHomeScore] = useState(3);
  const [newMapAwayScore, setNewMapAwayScore] = useState(1);

  // Incidents, Warnings, Decisions
  const [incidents, setIncidents] = useState<MatchIncident[]>([]);
  const [warnings, setWarnings] = useState<MatchWarning[]>([]);
  const [decisions, setDecisions] = useState<MatchDecision[]>([]);
  const [officials, setOfficials] = useState<RefereeAssignment[]>([]);

  // Modals & Forms State
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [newIncidentType, setNewIncidentType] = useState('rule_violation');
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState('minor');
  const [newIncidentEscalate, setNewIncidentEscalate] = useState(false);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [newWarnType, setNewWarnType] = useState<'verbal' | 'official' | 'gameplay' | 'conduct'>('official');
  const [newWarnRule, setNewWarnRule] = useState('Rule 4.2 - Exploiting');
  const [newWarnReason, setNewWarnReason] = useState('');
  const [newWarnTarget, setNewWarnTarget] = useState<'home' | 'away'>('home');

  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [newDecisionType, setNewDecisionType] = useState('Map Restart');
  const [newDecisionRule, setNewDecisionRule] = useState('Rule 8.2 - Technical Issues');
  const [newDecisionText, setNewDecisionText] = useState('');
  const [newDecisionReason, setNewDecisionReason] = useState('');

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('technical_issue');
  const [pauseRequester, setPauseRequester] = useState('');

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [corHomeScore, setCorHomeScore] = useState(0);
  const [corAwayScore, setCorAwayScore] = useState(0);
  const [corReason, setCorReason] = useState('');

  // Post Match Report State
  const [reportSummary, setReportSummary] = useState('');
  const [refereePublicNotes, setRefereePublicNotes] = useState('');
  const [internalStaffNotes, setInternalStaffNotes] = useState('');
  const [sportsmanship, setSportsmanship] = useState('Excellent');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [isReportSubmitted, setIsReportSubmitted] = useState(false);

  const supabase = createClient();

  const checkRosterEligibility = useCallback(async (
    homeGuildId: string, 
    awayGuildId: string,
    homeTag = 'HOME',
    awayTag = 'AWAY'
  ) => {
    try {
      // Get members of both guilds
      const { data: members } = await supabase
        .from('guild_members')
        .select('*, player:profiles!player_id(*)')
        .in('guild_id', [homeGuildId, awayGuildId])
        .eq('is_active', true);

      // Get active sanctions that suspend players
      const { data: activeSanctions } = await supabase
        .from('sanctions')
        .select('*')
        .eq('status', 'active')
        .not('player_id', 'is', null);

      const suspendedPlayerIds = new Map<string, string>();
      if (activeSanctions) {
        activeSanctions.forEach((s) => {
          if (s.player_id && (s.sanction_type.toLowerCase().includes('ban') || s.sanction_type.toLowerCase().includes('suspension'))) {
            suspendedPlayerIds.set(s.player_id, `${s.sanction_type}: ${s.violation}`);
          }
        });
      }

      const rosterList: RosterPlayerCheck[] = [];
      const ineligibles: RosterPlayerCheck[] = [];

      if (members) {
        members.forEach((m) => {
          const p = m.player as { id: string; username: string; display_name: string; roblox_username: string };
          if (!p) return;
          const isSuspended = suspendedPlayerIds.has(p.id);
          const reason = suspendedPlayerIds.get(p.id);

          const record: RosterPlayerCheck = {
            id: p.id,
            username: p.username,
            display_name: p.display_name || p.username,
            roblox_username: p.roblox_username || 'Not Linked',
            guild_id: m.guild_id,
            guild_tag: m.guild_id === homeGuildId ? homeTag : awayTag,
            is_starter: m.role === 'captain' || m.role === 'player',
            is_suspended: isSuspended,
            suspension_reason: reason,
          };

          rosterList.push(record);
          if (isSuspended) ineligibles.push(record);
        });
      }

      setRosterPlayers(rosterList);
      setIneligiblePlayers(ineligibles);
    } catch (err) {
      console.warn('Error checking roster eligibility:', err);
    }
  }, [supabase]);

  const loadMatchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_guild:guilds!home_guild_id(*),
          away_guild:guilds!away_guild_id(*),
          division:divisions(*)
        `)
        .eq('id', matchId)
        .maybeSingle();

      if (!error && data) {
        setMatch(data as MatchWithGuilds);
        setHomeScore(data.home_score || 0);
        setAwayScore(data.away_score || 0);
        setMatchStatus(data.status);
        setIsResultLocked(Boolean(data.is_result_locked || data.status === 'completed'));
        setServerInfo(data.server_info || 'CAA Tournament Server 01');

        if (data.pre_match_checks) {
          setPreChecks(data.pre_match_checks as Record<string, boolean>);
        }

        // Fetch maps
        const { data: mapData } = await supabase
          .from('match_maps')
          .select('*, map:maps(name)')
          .eq('match_id', matchId)
          .order('game_number', { ascending: true });

        if (mapData && mapData.length > 0) {
          setMapsList(mapData.map((m) => ({
            id: m.id,
            game_number: m.game_number,
            map_name: m.map?.name || `Map ${m.game_number}`,
            home_score: m.home_score,
            away_score: m.away_score,
            winner_tag: m.winner_id === data.home_guild_id ? data.home_guild?.tag : data.away_guild?.tag,
            winner_id: m.winner_id || undefined,
          })));
          setNewMapGameNumber(mapData.length + 1);
        }

        // Fetch official competition map pool
        const pool = await getCompetitionMapPool(supabase, {
          seasonId: data.season_id,
          divisionId: data.division_id,
          matchFormat: data.format,
        });
        const activePoolMaps = pool.filter((p) => p.isAvailable).map((p) => p.map);
        setAvailableOfficialMaps(activePoolMaps);
        if (activePoolMaps.length > 0) {
          setSelectedMapId(activePoolMaps[0].id);
        }

        // Fetch officials assigned
        const { data: officialsData } = await supabase
          .from('referee_assignments')
          .select('*, referee:referees(*)')
          .eq('match_id', matchId);

        if (officialsData) {
          setOfficials(officialsData as unknown as RefereeAssignment[]);
        }

        // Fetch incidents
        const { data: incData } = await supabase
          .from('match_incidents')
          .select('*, reporter:profiles!reported_by(display_name, username)')
          .eq('match_id', matchId)
          .order('incident_time', { ascending: false });

        if (incData) setIncidents(incData as MatchIncident[]);

        // Fetch warnings
        const { data: warnData } = await supabase
          .from('match_warnings')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false });

        if (warnData) setWarnings(warnData as MatchWarning[]);

        // Fetch decisions
        const { data: decData } = await supabase
          .from('match_decisions')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false });

        if (decData) setDecisions(decData as MatchDecision[]);

        // Fetch report
        const { data: repData } = await supabase
          .from('referee_reports')
          .select('*')
          .eq('match_id', matchId)
          .maybeSingle();

        if (repData) {
          setReportSummary(repData.summary || '');
          setRefereePublicNotes(repData.referee_notes || '');
          setInternalStaffNotes(repData.internal_staff_notes || '');
          setTechnicalNotes(repData.technical_issues || '');
          setIsReportSubmitted(repData.status === 'submitted');
        }

        // Load guild roster members and check sanctions
        await checkRosterEligibility(data.home_guild_id, data.away_guild_id, data.home_guild?.tag, data.away_guild?.tag);
      } else {
        // Fallback to sample
        const sample = sampleMatches.find((m) => m.id === matchId) || sampleMatches[0];
        if (sample) {
          setMatch(sample as unknown as MatchWithGuilds);
          setHomeScore(sample.home_score);
          setAwayScore(sample.away_score);
          setMatchStatus(sample.status);
          setIsResultLocked(sample.status === 'completed');
        }
      }
    } catch (err) {
      console.warn('Error loading match referee data:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId, supabase, checkRosterEligibility]);

  useEffect(() => {
    loadMatchData();

    // Subscribe to realtime updates on this match
    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        const updated = payload.new as Match;
        if (updated) {
          setMatchStatus(updated.status);
          setHomeScore(updated.home_score);
          setAwayScore(updated.away_score);
          setIsResultLocked(Boolean((updated as unknown as { is_result_locked?: boolean }).is_result_locked || updated.status === 'completed'));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, loadMatchData, supabase]);

  const toggleCheck = async (key: string) => {
    if (isResultLocked) return;
    const updatedChecks = { ...preChecks, [key]: !preChecks[key] };
    setPreChecks(updatedChecks);

    try {
      await supabase
        .from('matches')
        .update({ pre_match_checks: updatedChecks })
        .eq('id', matchId);
    } catch (err) {
      console.error(err);
    }
  };

  const allMandatoryChecksPassed = 
    preChecks.guild_a_checkin &&
    preChecks.guild_b_checkin &&
    preChecks.rosters_verified &&
    preChecks.eligibility_verified &&
    preChecks.map_verified &&
    preChecks.server_ready;

  const canStartMatch = (allMandatoryChecksPassed && ineligiblePlayers.length === 0) || adminOverride;

  const handleStartMatch = async () => {
    if (!match) return;
    if (!canStartMatch) {
      setFeedback({
        type: 'error',
        message: 'Cannot start official match. Complete all pre-match checklist items and verify zero ineligible players.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
          server_info: serverInfo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      if (!error) {
        setMatchStatus('live');
        setFeedback({ type: 'success', message: 'Match status is now LIVE on game servers.' });

        // Audit log
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
          action: 'MATCH_STARTED',
          entity_type: 'match',
          entity_id: match.id,
          actor_id: user?.id || null,
          details: { server_info: serverInfo, checks: preChecks },
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordMap = async () => {
    if (!match || isResultLocked) return;
    if (!selectedMapId) {
      setFeedback({ type: 'error', message: 'Please select an authorized official map.' });
      return;
    }

    const winnerId = newMapHomeScore > newMapAwayScore ? match.home_guild_id : match.away_guild_id;
    const losingId = newMapHomeScore > newMapAwayScore ? match.away_guild_id : match.home_guild_id;
    const winnerTag = newMapHomeScore > newMapAwayScore ? match.home_guild.tag : match.away_guild.tag;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const recordRes = await recordMatchMap(supabase, {
        matchId: match.id,
        mapId: selectedMapId,
        gameNumber: newMapGameNumber,
        homeScore: newMapHomeScore,
        awayScore: newMapAwayScore,
        winnerId,
        losingGuildId: losingId,
        refereeId: user?.id || null,
        startTime: mapStartTime ? new Date(mapStartTime).toISOString() : null,
        endTime: new Date().toISOString(),
        status: 'completed',
      });

      if (!recordRes.success || !recordRes.data) {
        setFeedback({ type: 'error', message: recordRes.error || 'Failed to record official map.' });
        return;
      }

      const verifiedMapName = recordRes.data.map?.name || 'Official Map';

      const newMapRecord: MatchMapRecord = {
        id: recordRes.data.id,
        game_number: newMapGameNumber,
        map_name: verifiedMapName,
        home_score: newMapHomeScore,
        away_score: newMapAwayScore,
        winner_tag: winnerTag,
        winner_id: winnerId,
      };

      setMapsList((prev) => [...prev, newMapRecord]);
      setNewMapGameNumber((prev) => prev + 1);

      // Update series score
      let newHome = homeScore;
      let newAway = awayScore;
      if (newMapHomeScore > newMapAwayScore) {
        newHome += 1;
        setHomeScore(newHome);
      } else if (newMapAwayScore > newMapHomeScore) {
        newAway += 1;
        setAwayScore(newAway);
      }

      await supabase
        .from('matches')
        .update({ home_score: newHome, away_score: newAway, updated_at: new Date().toISOString() })
        .eq('id', match.id);

      setFeedback({ type: 'success', message: `Game ${newMapGameNumber} (${verifiedMapName}) recorded: Winner ${winnerTag}.` });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to record official map result.' });
    }
  };

  const targetWins = match?.format === 'bo7' ? 4 : match?.format === 'bo3' ? 2 : 3;
  const isSeriesThresholdReached = homeScore >= targetWins || awayScore >= targetWins;

  const handleConfirmFinal = async () => {
    if (!match) return;
    if (homeScore === awayScore) {
      setFeedback({ type: 'error', message: 'A tournament series cannot end in a draw. Please record the decider map.' });
      return;
    }

    if (!isSeriesThresholdReached && !adminOverride) {
      setFeedback({
        type: 'error',
        message: `Format ${match.format?.toUpperCase() || 'BO5'} requires ${targetWins} map wins to conclude. Current: ${homeScore} - ${awayScore}.`,
      });
      return;
    }

    const winnerId = homeScore > awayScore ? match.home_guild_id : match.away_guild_id;
    const loserId = homeScore > awayScore ? match.away_guild_id : match.home_guild_id;
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);

    setIsSaving(true);
    try {
      const { error: matchErr } = await supabase
        .from('matches')
        .update({
          status: 'completed',
          home_score: homeScore,
          away_score: awayScore,
          winner_id: winnerId,
          completed_at: new Date().toISOString(),
          is_result_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      if (matchErr) throw matchErr;

      // Synchronize standings
      if (match.season_id && match.division_id) {
        const { data: winStand } = await supabase
          .from('standings')
          .select('*')
          .eq('guild_id', winnerId)
          .eq('season_id', match.season_id)
          .eq('division_id', match.division_id)
          .maybeSingle();

        if (winStand) {
          await supabase.from('standings').update({
            matches_played: (winStand.matches_played || 0) + 1,
            wins: (winStand.wins || 0) + 1,
            maps_won: (winStand.maps_won || 0) + winnerScore,
            maps_lost: (winStand.maps_lost || 0) + loserScore,
            points: (winStand.points || 0) + 3,
            form: `${winStand.form || ''}W`.slice(-10),
            updated_at: new Date().toISOString(),
          }).eq('id', winStand.id);
        }

        const { data: loseStand } = await supabase
          .from('standings')
          .select('*')
          .eq('guild_id', loserId)
          .eq('season_id', match.season_id)
          .eq('division_id', match.division_id)
          .maybeSingle();

        if (loseStand) {
          await supabase.from('standings').update({
            matches_played: (loseStand.matches_played || 0) + 1,
            losses: (loseStand.losses || 0) + 1,
            maps_won: (loseStand.maps_won || 0) + loserScore,
            maps_lost: (loseStand.maps_lost || 0) + winnerScore,
            form: `${loseStand.form || ''}L`.slice(-10),
            updated_at: new Date().toISOString(),
          }).eq('id', loseStand.id);
        }
      }

      setIsResultLocked(true);
      setMatchStatus('completed');
      setFeedback({
        type: 'success',
        message: 'Official match result locked and submitted. Standings and statistics have been synchronized.',
      });

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        action: 'MATCH_RESULT_SUBMITTED',
        entity_type: 'match',
        entity_id: match.id,
        actor_id: user?.id || null,
        details: { home_score: homeScore, away_score: awayScore, winner_id: winnerId },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error confirming result';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateIncident = async () => {
    if (!newIncidentDesc.trim()) return;
    try {
      const res = await fetch('/api/referees/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          game_number: mapsList.length + 1,
          incident_type: newIncidentType,
          description: newIncidentDesc,
          severity: newIncidentSeverity,
          submit_for_review: newIncidentEscalate,
        }),
      });

      if (res.ok) {
        setShowIncidentModal(false);
        setNewIncidentDesc('');
        await loadMatchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIssueWarning = async () => {
    if (!newWarnReason.trim() || !match) return;
    const targetGuildId = newWarnTarget === 'home' ? match.home_guild_id : match.away_guild_id;

    try {
      const res = await fetch('/api/referees/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          guild_id: targetGuildId,
          warning_type: newWarnType,
          rule_name: newWarnRule,
          reason: newWarnReason,
        }),
      });

      if (res.ok) {
        setShowWarningModal(false);
        setNewWarnReason('');
        await loadMatchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordDecision = async () => {
    if (!newDecisionText.trim() || !newDecisionReason.trim()) return;
    try {
      const res = await fetch('/api/referees/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          game_number: mapsList.length,
          decision_type: newDecisionType,
          rule_name: newDecisionRule,
          decision: newDecisionText,
          reason: newDecisionReason,
        }),
      });

      if (res.ok) {
        setShowDecisionModal(false);
        setNewDecisionText('');
        setNewDecisionReason('');
        await loadMatchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportSummary.trim()) {
      setFeedback({ type: 'error', message: 'Report summary cannot be empty.' });
      return;
    }

    try {
      const res = await fetch('/api/referees/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          summary: reportSummary,
          referee_notes: refereePublicNotes,
          internal_staff_notes: internalStaffNotes,
          technical_issues: technicalNotes,
          sportsmanship_rating: sportsmanship,
        }),
      });

      if (res.ok) {
        setIsReportSubmitted(true);
        setFeedback({ type: 'success', message: 'Official Match Report filed successfully.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestCorrection = async () => {
    if (!corReason.trim()) return;
    try {
      const res = await fetch('/api/referees/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          requested_home_score: corHomeScore,
          requested_away_score: corAwayScore,
          reason: corReason,
        }),
      });

      if (res.ok) {
        setShowCorrectionModal(false);
        setCorReason('');
        setFeedback({
          type: 'success',
          message: 'Result correction request submitted for Administrator / Head Referee review.',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container py-20 max-w-4xl mx-auto">
        <EmptyState title="Match Not Found" description="The match specified could not be loaded." />
      </div>
    );
  }

  const homeGuild = match.home_guild || { name: 'Home Guild', tag: 'HOME' };
  const awayGuild = match.away_guild || { name: 'Away Guild', tag: 'AWAY' };

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* Header bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 py-6 mb-8">
        <div className="container max-w-7xl mx-auto px-4 space-y-3">
          <Link href="/referee" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Referee Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <Shield className="w-6 h-6 text-blue-400" /> Match Referee Center
                </h1>
                {isResultLocked && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs font-mono flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Result Locked
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Match ID: <span className="font-mono text-zinc-300">{match.id.substring(0, 8)}</span> • Division: <strong className="text-white">{match.division?.name || 'Grand League'}</strong> • Format: <strong className="text-blue-400 uppercase">{match.format || 'BO5'}</strong> • Rulebook: <strong className="text-zinc-200">v2.4 (2026 Season)</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge 
                variant={matchStatus === 'live' ? 'destructive' : matchStatus === 'completed' ? 'success' : 'outline'}
                className="text-xs uppercase font-mono px-3 py-1"
              >
                Status: {matchStatus}
              </Badge>

              {matchStatus !== 'live' && matchStatus !== 'completed' && (
                <Button 
                  size="sm" 
                  onClick={handleStartMatch} 
                  disabled={!canStartMatch}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 text-xs"
                >
                  <Play className="w-3.5 h-3.5" /> Start Match Live
                </Button>
              )}

              {isResultLocked && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowCorrectionModal(true)}
                  className="border-zinc-700 text-zinc-300 text-xs gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5 text-amber-400" /> Request Result Correction
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 space-y-8">
        {feedback && (
          <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Ineligible Players Alert Banner */}
        {ineligiblePlayers.length > 0 && (
          <div className="p-5 rounded-2xl border border-red-500/50 bg-red-500/10 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertOctagon className="w-5 h-5 shrink-0" />
              <span>INELIGIBLE PLAYERS DETECTED ON ROSTER</span>
            </div>
            <p className="text-xs text-zinc-300">
              The system cross-referenced submitted rosters with the active Disciplinary & Sanctions database. The following players cannot participate in official tournament fixtures:
            </p>
            <div className="space-y-2">
              {ineligiblePlayers.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-zinc-950/80 border border-red-500/30 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white">[{p.guild_tag}] {p.display_name}</span>
                    <span className="font-mono text-zinc-400 ml-2">(@{p.username})</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    {p.suspension_reason || 'Active Match Suspension'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Scoreboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-zinc-900/60 p-8 rounded-2xl border border-zinc-800 shadow-xl">
          {/* Home */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center font-bold text-2xl text-blue-400 border border-zinc-700 mx-auto">
              {homeGuild.tag}
            </div>
            <h3 className="font-bold text-lg text-white">{homeGuild.name}</h3>
            <div className="flex justify-center items-center gap-3">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setHomeScore((s) => Math.max(0, s - 1))}
                disabled={isResultLocked}
                className="h-9 w-9 text-lg font-bold border-zinc-700 text-zinc-300"
              >
                -
              </Button>
              <span className="text-5xl font-black text-white w-14 text-center">{homeScore}</span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setHomeScore((s) => s + 1)}
                disabled={isResultLocked}
                className="h-9 w-9 text-lg font-bold border-zinc-700 text-zinc-300"
              >
                +
              </Button>
            </div>
          </div>

          {/* Center */}
          <div className="text-center space-y-4 border-y md:border-y-0 md:border-x border-zinc-800 py-6 md:py-0 px-4">
            <Badge variant={matchStatus === 'live' ? 'destructive' : 'outline'} className={matchStatus === 'live' ? 'animate-pulse' : ''}>
              {matchStatus === 'live' ? 'SERIES IN PROGRESS' : matchStatus.toUpperCase()}
            </Badge>
            <p className="text-xs text-zinc-400">
              Format: {match.format?.toUpperCase() || 'BO5'} • Target: First to {targetWins} wins
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowPauseModal(true)}
                disabled={matchStatus !== 'live'}
                className="text-xs gap-1.5 border-zinc-700 text-zinc-300"
              >
                <Pause className="w-3.5 h-3.5 text-amber-400" /> Log Pause / Tech
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowWarningModal(true)}
                disabled={isResultLocked}
                className="text-xs gap-1.5 border-zinc-700 text-zinc-300"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> Issue Warning
              </Button>
            </div>
          </div>

          {/* Away */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center font-bold text-2xl text-blue-400 border border-zinc-700 mx-auto">
              {awayGuild.tag}
            </div>
            <h3 className="font-bold text-lg text-white">{awayGuild.name}</h3>
            <div className="flex justify-center items-center gap-3">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setAwayScore((s) => Math.max(0, s - 1))}
                disabled={isResultLocked}
                className="h-9 w-9 text-lg font-bold border-zinc-700 text-zinc-300"
              >
                -
              </Button>
              <span className="text-5xl font-black text-white w-14 text-center">{awayScore}</span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setAwayScore((s) => s + 1)}
                disabled={isResultLocked}
                className="h-9 w-9 text-lg font-bold border-zinc-700 text-zinc-300"
              >
                +
              </Button>
            </div>
          </div>
        </div>

        {/* Tabbed Operations Workspace */}
        <Tabs defaultValue="precheck" className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="precheck">Pre-Match Verification</TabsTrigger>
            <TabsTrigger value="maps">Map Management ({mapsList.length})</TabsTrigger>
            <TabsTrigger value="rosters">Verified Rosters ({rosterPlayers.length})</TabsTrigger>
            <TabsTrigger value="incidents">Incidents & Warnings ({incidents.length + warnings.length})</TabsTrigger>
            <TabsTrigger value="report">Post-Match Report</TabsTrigger>
          </TabsList>

          {/* Pre-Match Verification Tab */}
          <TabsContent value="precheck" className="space-y-6 mt-4">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-white">Pre-Match Mandatory Verification Checklist</h3>
                  <p className="text-xs text-zinc-400">
                    All mandatory checks must be certified by the assigned referee before beginning official competitive play.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={adminOverride}
                    onChange={(e) => setAdminOverride(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-blue-600"
                  />
                  <span>Staff Override Mode</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'guild_a_checkin', label: `${homeGuild.name} checked in & captain present` },
                  { key: 'guild_b_checkin', label: `${awayGuild.name} checked in & captain present` },
                  { key: 'rosters_verified', label: 'Match rosters verified against guild registrations' },
                  { key: 'eligibility_verified', label: 'Zero active suspensions or ineligible players detected' },
                  { key: 'map_verified', label: 'Map pool, draft order, and bans confirmed by teams' },
                  { key: 'server_ready', label: 'Tournament VIP server configured with official settings' },
                  { key: 'rules_acknowledged', label: 'Both team captains briefed on pause rules & sportsmanship' },
                ].map((item) => (
                  <label
                    key={item.key}
                    onClick={() => toggleCheck(item.key)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      preChecks[item.key]
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-medium">{item.label}</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      preChecks[item.key]
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-zinc-700 bg-zinc-900'
                    }`}>
                      {preChecks[item.key] && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">Tournament Server:</span>
                  <Input
                    value={serverInfo}
                    onChange={(e) => setServerInfo(e.target.value)}
                    disabled={isResultLocked}
                    className="h-8 w-64 bg-zinc-950 border-zinc-700 text-white text-xs"
                  />
                </div>

                {matchStatus !== 'live' && matchStatus !== 'completed' && (
                  <Button
                    onClick={handleStartMatch}
                    disabled={!canStartMatch}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" /> Start Match
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Map Management Tab */}
          <TabsContent value="maps" className="space-y-6 mt-4">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-400" /> Map-by-Map Series Log
                  </h3>
                  <p className="text-xs text-zinc-400">Record rounds, winners, and scores for each individual map</p>
                </div>
                <span className="text-xs font-mono text-zinc-400">{mapsList.length} Games Logged</span>
              </div>

              {mapsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mapsList.map((m, i) => (
                    <div key={i} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-blue-400">Game {m.game_number}</span>
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
                          Winner: {m.winner_tag}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-white text-sm">{m.map_name}</h4>
                      <div className="flex justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800/80">
                        <span>{homeGuild.tag}: <strong className="text-white">{m.home_score}</strong></span>
                        <span>{awayGuild.tag}: <strong className="text-white">{m.away_score}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                  No individual maps logged yet for this series.
                </div>
              )}

              {/* Add Game Form */}
              {!isResultLocked && (
                <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-400" /> Record Next Game (Game {newMapGameNumber})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-zinc-400">Official Map (Pool)</Label>
                      <Select value={selectedMapId} onValueChange={setSelectedMapId}>
                        <SelectTrigger className="mt-1 h-9 text-xs bg-zinc-900 border-zinc-700 text-white">
                          <SelectValue placeholder="Select official map..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                          {availableOfficialMaps.map((map) => (
                            <SelectItem key={map.id} value={map.id}>
                              {map.name} (Official)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-zinc-400">{homeGuild.tag} Score</Label>
                      <Input 
                        type="number"
                        min={0}
                        value={newMapHomeScore}
                        onChange={(e) => setNewMapHomeScore(parseInt(e.target.value) || 0)}
                        className="mt-1 h-9 text-xs bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-zinc-400">{awayGuild.tag} Score</Label>
                      <Input 
                        type="number"
                        min={0}
                        value={newMapAwayScore}
                        onChange={(e) => setNewMapAwayScore(parseInt(e.target.value) || 0)}
                        className="mt-1 h-9 text-xs bg-zinc-900 border-zinc-700 text-white"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button 
                        onClick={handleRecordMap}
                        className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        Log Map Result
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm Result Bar */}
              <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="text-xs text-zinc-400">
                  <span>Current Series Score: </span>
                  <strong className="text-white font-mono">{homeScore} - {awayScore}</strong>
                  {isSeriesThresholdReached && (
                    <Badge variant="outline" className="ml-2 text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-[10px]">
                      Series Match Point Met ({targetWins} wins)
                    </Badge>
                  )}
                </div>

                {!isResultLocked && (
                  <Button
                    onClick={handleConfirmFinal}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Submit Official Match Result & Lock
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Rosters Tab */}
          <TabsContent value="rosters" className="space-y-6 mt-4">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" /> Official Guild Rosters & Eligibility
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Referees cannot manually inject arbitrary players. All participants must exist in official registrations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Home Guild Roster */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <span>{homeGuild.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">[{homeGuild.tag}]</Badge>
                  </h4>
                  <div className="space-y-2">
                    {rosterPlayers.filter(p => p.guild_tag === homeGuild.tag).map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-white">{p.display_name}</p>
                          <p className="text-[11px] text-zinc-500 font-mono">Roblox: {p.roblox_username}</p>
                        </div>
                        {p.is_suspended ? (
                          <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">Eligible</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Away Guild Roster */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <span>{awayGuild.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">[{awayGuild.tag}]</Badge>
                  </h4>
                  <div className="space-y-2">
                    {rosterPlayers.filter(p => p.guild_tag === awayGuild.tag).map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-white">{p.display_name}</p>
                          <p className="text-[11px] text-zinc-500 font-mono">Roblox: {p.roblox_username}</p>
                        </div>
                        {p.is_suspended ? (
                          <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">Eligible</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Incidents & Warnings Tab */}
          <TabsContent value="incidents" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Incidents */}
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Match Incidents ({incidents.length})
                  </h3>
                  <Button size="sm" onClick={() => setShowIncidentModal(true)} className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="w-3 h-3 mr-1" /> Log Incident
                  </Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {incidents.length > 0 ? (
                    incidents.map((inc) => (
                      <div key={inc.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-400 uppercase font-mono">{inc.incident_type.replace('_', ' ')}</span>
                          <span className="text-[10px] text-zinc-500">{new Date(inc.incident_time).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-zinc-300">{inc.description}</p>
                        <div className="flex gap-2 pt-1 text-[10px] text-zinc-500">
                          <span>Severity: <strong className="text-zinc-300 capitalize">{inc.severity}</strong></span>
                          <span>•</span>
                          <span>Status: <strong className="text-zinc-300 capitalize">{inc.status.replace('_', ' ')}</strong></span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-6 text-center">No infractions or incidents logged.</p>
                  )}
                </div>
              </div>

              {/* Warnings */}
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-400" /> In-Match Warnings ({warnings.length})
                  </h3>
                  <Button size="sm" onClick={() => setShowWarningModal(true)} className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-3 h-3 mr-1" /> Issue Warning
                  </Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {warnings.length > 0 ? (
                    warnings.map((w) => (
                      <div key={w.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
                            {w.warning_type.toUpperCase()} WARNING
                          </Badge>
                          <span className="text-[10px] text-zinc-500">{new Date(w.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-white font-medium">{w.reason}</p>
                        <p className="text-[11px] text-zinc-400">Rule: {w.rule_name || 'Official Rules'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-6 text-center">No official warnings issued.</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Post Match Report Tab */}
          <TabsContent value="report" className="space-y-6 mt-4">
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" /> Official Referee Post-Match Report
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Mandatory report filed within 24 hours of match completion for league archive and quality audit.
                  </p>
                </div>
                {isReportSubmitted && (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-xs">
                    Report Filed & Archived
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-zinc-400">Match Executive Summary *</Label>
                  <Textarea
                    rows={3}
                    value={reportSummary}
                    onChange={(e) => setReportSummary(e.target.value)}
                    placeholder="Provide a comprehensive summary of how the match proceeded, game flow, and sportsmanship..."
                    className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-zinc-400">Technical Issues / Disconnects</Label>
                    <Input
                      value={technicalNotes}
                      onChange={(e) => setTechnicalNotes(e.target.value)}
                      placeholder="e.g. 1 technical pause in Game 2, reconnected in 2m"
                      className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-zinc-400">Overall Sportsmanship Rating</Label>
                    <Select value={sportsmanship} onValueChange={setSportsmanship}>
                      <SelectTrigger className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-xs">
                        <SelectItem value="Exceptional">Exceptional</SelectItem>
                        <SelectItem value="Excellent">Excellent</SelectItem>
                        <SelectItem value="Standard">Standard / Acceptable</SelectItem>
                        <SelectItem value="Poor">Poor (Minor Hostility)</SelectItem>
                        <SelectItem value="Unacceptable">Unacceptable (Severe Misconduct)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-zinc-400">Public Referee Notes (Visible to Guilds & Community)</Label>
                  <Textarea
                    rows={2}
                    value={refereePublicNotes}
                    onChange={(e) => setRefereePublicNotes(e.target.value)}
                    placeholder="Concluding remarks visible on the public match center..."
                    className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                  />
                </div>

                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                    <Lock className="w-3.5 h-3.5" /> Internal Staff Notes (Confidential to League Officials)
                  </div>
                  <Textarea
                    rows={2}
                    value={internalStaffNotes}
                    onChange={(e) => setInternalStaffNotes(e.target.value)}
                    placeholder="Notes for administrators, referee performance evaluations, or disciplinary recommendations..."
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSubmitReport}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    {isReportSubmitted ? 'Update Official Report' : 'Submit Official Match Report'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Incident Modal */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Record Match Incident
              </h3>
              <button onClick={() => setShowIncidentModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-zinc-400">Incident Type</Label>
                <select
                  value={newIncidentType}
                  onChange={(e) => setNewIncidentType(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="rule_violation">Rule Violation</option>
                  <option value="exploit">Map / Unit Exploit</option>
                  <option value="unauthorized_player">Unauthorized Player</option>
                  <option value="disconnect">Player Disconnect</option>
                  <option value="technical_issue">Technical Issue</option>
                  <option value="unsportsmanlike_conduct">Unsportsmanlike Conduct</option>
                  <option value="server_issue">Server Issue</option>
                  <option value="match_delay">Match Delay</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Severity</Label>
                <select
                  value={newIncidentSeverity}
                  onChange={(e) => setNewIncidentSeverity(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Description *</Label>
                <Textarea
                  rows={3}
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                  placeholder="Detail the event, timestamps, affected rounds..."
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={newIncidentEscalate}
                  onChange={(e) => setNewIncidentEscalate(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-700 text-blue-600"
                />
                <span>Escalate to League Disciplinary Staff for Sanction Review</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={handleCreateIncident} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                Log Incident
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Issue Official In-Match Warning
              </h3>
              <button onClick={() => setShowWarningModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-zinc-400">Target Team</Label>
                <select
                  value={newWarnTarget}
                  onChange={(e) => setNewWarnTarget(e.target.value as 'home' | 'away')}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="home">{homeGuild.name} [{homeGuild.tag}]</option>
                  <option value="away">{awayGuild.name} [{awayGuild.tag}]</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Warning Category</Label>
                <select
                  value={newWarnType}
                  onChange={(e) => setNewWarnType(e.target.value as 'verbal' | 'official' | 'gameplay' | 'conduct')}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="verbal">Verbal Warning</option>
                  <option value="official">Official Written Warning</option>
                  <option value="gameplay">Gameplay / Rule Infraction</option>
                  <option value="conduct">Conduct / Sportsmanship Warning</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Rule Reference</Label>
                <Input
                  value={newWarnRule}
                  onChange={(e) => setNewWarnRule(e.target.value)}
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Reason / Infraction Description *</Label>
                <Textarea
                  rows={3}
                  value={newWarnReason}
                  onChange={(e) => setNewWarnReason(e.target.value)}
                  placeholder="Specify what rule was broken and what corrective action was instructed..."
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={handleIssueWarning} className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs">
                Issue Warning
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Result Correction Request Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" /> Result Correction Request
              </h3>
              <button onClick={() => setShowCorrectionModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Submitted results are locked to preserve integrity. Submit a formal correction request for Administrator or Head Referee authorization.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-400">Proposed {homeGuild.tag} Score</Label>
                  <Input
                    type="number"
                    value={corHomeScore}
                    onChange={(e) => setCorHomeScore(parseInt(e.target.value) || 0)}
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Proposed {awayGuild.tag} Score</Label>
                  <Input
                    type="number"
                    value={corAwayScore}
                    onChange={(e) => setCorAwayScore(parseInt(e.target.value) || 0)}
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Correction Reason & Evidence *</Label>
                <Textarea
                  rows={3}
                  value={corReason}
                  onChange={(e) => setCorReason(e.target.value)}
                  placeholder="Detail the error, map discrepancy, or screenshot evidence..."
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={handleRequestCorrection} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                Submit Correction Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
