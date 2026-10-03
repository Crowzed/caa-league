'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Shield, UserCheck, CheckCircle2, AlertTriangle, AlertCircle,
  Calendar, Award, Scale, Edit2, Loader2, X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, StatCard, EmptyState } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import type { 
  Referee, RefereeApplication, 
  ResultCorrection, Match 
} from '@/types/database';

export default function AdminRefereeManagementPage() {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [applications, setApplications] = useState<RefereeApplication[]>([]);
  const [corrections, setCorrections] = useState<ResultCorrection[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Application Review Modal
  const [selectedApp, setSelectedApp] = useState<RefereeApplication | null>(null);
  const [appReviewNotes, setAppReviewNotes] = useState('');
  const [appAssignedRank, setAppAssignedRank] = useState('Trial Referee');
  const [isProcessingApp, setIsProcessingApp] = useState(false);

  // Match Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignMatchId, setAssignMatchId] = useState('');
  const [assignRefId, setAssignRefId] = useState('');
  const [assignRole, setAssignRole] = useState<'primary' | 'assistant' | 'head'>('primary');
  const [assignConflictWarning, setAssignConflictWarning] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Edit Referee Modal
  const [editingRef, setEditingRef] = useState<Referee | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editWebsiteUsername, setEditWebsiteUsername] = useState('');
  const [editRobloxUsername, setEditRobloxUsername] = useState('');
  const [editDiscordUsername, setEditDiscordUsername] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [editRank, setEditRank] = useState('Referee');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'on_leave' | 'suspended' | 'retired'>('active');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const supabase = createClient();

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);

      // Load referees
      const { data: refData } = await supabase
        .from('referees')
        .select('*, profile:profiles!user_id(id, username, display_name, roblox_username, discord_username, avatar_url, is_verified, region, timezone)')
        .order('matches_officiated', { ascending: false });

      if (refData) setReferees(refData as Referee[]);

      // Load applications
      const { data: appData } = await supabase
        .from('referee_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (appData) setApplications(appData as RefereeApplication[]);

      // Load result corrections
      const { data: corData } = await supabase
        .from('result_corrections')
        .select(`
          *,
          match:matches(id, home_score, away_score, home_guild:guilds!home_guild_id(name, tag), away_guild:guilds!away_guild_id(name, tag))
        `)
        .order('created_at', { ascending: false });

      if (corData) setCorrections(corData as unknown as ResultCorrection[]);

      // Load upcoming matches for assignment
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          id, scheduled_at, status, format, round,
          home_guild:guilds!home_guild_id(name, tag),
          away_guild:guilds!away_guild_id(name, tag)
        `)
        .in('status', ['scheduled', 'check_in', 'live'])
        .order('scheduled_at', { ascending: true });

      if (matchData) setMatches(matchData as unknown as Match[]);
    } catch (err) {
      console.warn('Error loading referee admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleReviewApplication = async (status: 'approved' | 'rejected') => {
    if (!selectedApp) return;
    setIsProcessingApp(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/referees/applications/${selectedApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewer_notes: appReviewNotes,
          initial_rank: appAssignedRank,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'Failed to process application.' });
      } else {
        setFeedback({
          type: 'success',
          message: `Application marked as ${status.toUpperCase()}! Candidate has been updated.`,
        });
        setSelectedApp(null);
        setAppReviewNotes('');
        await loadAdminData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing application';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsProcessingApp(false);
    }
  };

  const handleAssignMatch = async (bypass = false) => {
    if (!assignMatchId || !assignRefId) return;
    setIsAssigning(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/referees/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: assignMatchId,
          referee_id: assignRefId,
          role: assignRole,
          bypass_conflict_warning: bypass,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.conflict_detected) {
        setAssignConflictWarning(data.warning);
      } else if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'Failed to assign match.' });
      } else {
        setFeedback({ type: 'success', message: 'Match successfully assigned to referee.' });
        setShowAssignModal(false);
        setAssignConflictWarning(null);
        setAssignMatchId('');
        setAssignRefId('');
        await loadAdminData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error assigning match';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsAssigning(false);
    }
  };


  const handleSaveEditReferee = async () => {
    if (!editingRef) return;
    setIsSavingEdit(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/referees/${editingRef.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rank: editRank,
          status: editStatus,
          internal_notes: editNotes,
          display_name: editDisplayName.trim() || undefined,
          website_username: editWebsiteUsername.trim() || undefined,
          roblox_username: editRobloxUsername.trim() || undefined,
          discord_username: editDiscordUsername.trim() || undefined,
          region: editRegion.trim() || undefined,
          timezone: editTimezone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'Failed to update referee.' });
      } else {
        setFeedback({ type: 'success', message: 'Referee details saved successfully.' });
        setEditingRef(null);
        await loadAdminData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving referee';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleQuickStatusChange = async (refereeId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/referees/${refereeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: `Referee status updated to ${newStatus.replace('_', ' ')}.` });
        await loadAdminData();
      } else {
        const data = await res.json();
        setFeedback({ type: 'error', message: data.error || 'Failed to update referee status.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      setFeedback({ type: 'error', message: msg });
    }
  };

  const handleDecideCorrection = async (correctionId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/referees/corrections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correction_id: correctionId, status }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: `Correction request marked as ${status}.` });
        await loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingApps = applications.filter(a => a.status === 'pending' || a.status === 'under_review');
  const activeRefs = referees.filter(r => r.status === 'active');
  const pendingCorrections = corrections.filter(c => c.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-800">
        <div>
          <PageHeader
            title="Referee & Officials Management"
            description="Manage officiating personnel, review referee applications, assign match officials, and audit decisions."
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            size="sm"
            onClick={() => setShowAssignModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" /> Assign Referee
          </Button>

          {/* <Link href="/admin/players">
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:text-white text-xs gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-400" /> Assign Referee via Players
            </Button>
          </Link> */}
        </div>
      </div>

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Referees" value={referees.length} subtitle="Certified officials" icon={Shield} color="blue" />
        <StatCard title="Active Duty" value={activeRefs.length} subtitle="Ready for assignment" icon={CheckCircle2} color="green" />
        <StatCard title="Applications" value={pendingApps.length} subtitle="Awaiting review" icon={UserCheck} color="gold" />
        <StatCard title="Correction Requests" value={pendingCorrections.length} subtitle="Score amendments" icon={Scale} color="default" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="applications">Applications ({pendingApps.length})</TabsTrigger>
          <TabsTrigger value="referees">All Referees ({referees.length})</TabsTrigger>
          <TabsTrigger value="corrections">Result Corrections ({pendingCorrections.length})</TabsTrigger>
          <TabsTrigger value="performance">Quality Control & Performance</TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-4 mt-4">
          {applications.length > 0 ? (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row justify-between md:items-center gap-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{app.display_name}</span>
                      <span className="text-zinc-500 font-mono">(@{app.website_username})</span>
                      <Badge variant="outline" className={`uppercase font-mono text-[10px] ${
                        app.status === 'approved' ? 'text-emerald-400 border-emerald-500/30' :
                        app.status === 'rejected' ? 'text-red-400 border-red-500/30' :
                        'text-amber-400 border-amber-500/30'
                      }`}>
                        {app.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <p className="text-zinc-300">
                      Roblox: <strong className="text-white font-mono">{app.roblox_username}</strong> • Region: <strong className="text-white">{app.region}</strong> • Timezone: <strong className="text-white">{app.timezone}</strong>
                    </p>

                    <p className="text-zinc-400 line-clamp-1 italic">
                      &ldquo;{app.motivation}&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {app.status === 'pending' || app.status === 'under_review' ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setAppReviewNotes(app.reviewer_notes || '');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
                      >
                        Review Application
                      </Button>
                    ) : (
                      <span className="text-zinc-500 text-[11px]">Reviewed on {new Date(app.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No Referee Applications" description="No candidate applications have been submitted." />
          )}
        </TabsContent>

        {/* Referees Tab */}
        <TabsContent value="referees" className="space-y-4 mt-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center text-xs text-zinc-400">
              <span className="font-semibold text-white">Registered League Referees</span>
              <span>{referees.length} Total</span>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {referees.map((ref) => {
                const liveDisplayName = ref.profile?.display_name || ref.display_name || ref.profile?.username || ref.website_username;
                const liveUsername = ref.profile?.username || ref.website_username;
                const liveRoblox = ref.profile?.roblox_username || ref.roblox_username || '';
                const liveDiscord = ref.profile?.discord_username || ref.discord_username || '';
                const liveRegion = ref.region || ref.profile?.region || 'Asia/Pacific';
                const liveTimezone = ref.timezone || ref.profile?.timezone || 'WIB (UTC+7)';

                return (
                  <div key={ref.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs hover:bg-zinc-800/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{liveDisplayName}</span>
                        <span className="text-zinc-500 font-mono">(@{liveUsername})</span>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">
                          {ref.rank}
                        </Badge>
                        <select
                          value={ref.status}
                          onChange={(e) => handleQuickStatusChange(ref.id, e.target.value)}
                          className={`h-6 px-2 text-[10px] rounded-md font-semibold border bg-zinc-950 transition-colors cursor-pointer outline-none ${
                            ref.status === 'active'
                              ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                              : ref.status === 'on_leave'
                              ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                              : ref.status === 'suspended'
                              ? 'text-red-400 border-red-500/40 bg-red-500/10'
                              : ref.status === 'retired'
                              ? 'text-purple-400 border-purple-500/40 bg-purple-500/10'
                              : 'text-zinc-400 border-zinc-700 bg-zinc-800/40'
                          }`}
                          title="Click to quickly change referee status"
                        >
                          <option value="active">Active</option>
                          <option value="on_leave">On Leave</option>
                          <option value="suspended">Suspended</option>
                          <option value="retired">Retired</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>

                      <p className="text-zinc-400">
                        Region: {liveRegion} ({liveTimezone}) • Roblox: <strong className="text-zinc-300">{liveRoblox || 'N/A'}</strong> • Matches: <strong className="text-white">{ref.matches_officiated}</strong> • Warnings: <strong className="text-amber-400">{ref.warnings_issued}</strong> • Reports: <strong className="text-emerald-400">{ref.reports_submitted}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRef(ref);
                          setEditDisplayName(liveDisplayName);
                          setEditWebsiteUsername(liveUsername);
                          setEditRobloxUsername(liveRoblox);
                          setEditDiscordUsername(liveDiscord);
                          setEditRegion(liveRegion);
                          setEditTimezone(liveTimezone);
                          setEditRank(ref.rank);
                          setEditStatus(ref.status);
                          setEditNotes(ref.internal_notes || '');
                        }}
                        className="h-8 text-xs border-zinc-700 text-zinc-300"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Link href={`/referees/${ref.id}`}>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-blue-400 hover:text-white">
                          Profile →
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Result Corrections Tab */}
        <TabsContent value="corrections" className="space-y-4 mt-4">
          {corrections.length > 0 ? (
            <div className="space-y-3">
              {corrections.map((cor) => {
                const m = (cor as unknown as { match: { home_score: number; away_score: number; home_guild: { name: string; tag: string }; away_guild: { name: string; tag: string } } }).match;

                return (
                  <div key={cor.id} className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {m?.home_guild?.tag || 'GD1'} vs {m?.away_guild?.tag || 'GD2'}
                        </span>
                        <Badge variant="outline" className={`uppercase font-mono text-[10px] ${
                          cor.status === 'approved' ? 'text-emerald-400 border-emerald-500/30' :
                          cor.status === 'rejected' ? 'text-red-400 border-red-500/30' :
                          'text-amber-400 border-amber-500/30'
                        }`}>
                          {cor.status}
                        </Badge>
                      </div>
                      <span className="text-zinc-500">{new Date(cor.created_at).toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <div>
                        <span className="text-zinc-500 block mb-0.5">Original Score</span>
                        <span className="font-mono text-zinc-300">{cor.original_home_score} - {cor.original_away_score}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block mb-0.5">Requested Score</span>
                        <span className="font-mono font-bold text-amber-400">{cor.requested_home_score} - {cor.requested_away_score}</span>
                      </div>
                    </div>

                    <p className="text-zinc-300">
                      <strong className="text-zinc-400">Justification: </strong>
                      {cor.reason}
                    </p>

                    {cor.status === 'pending' && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                        <Button
                          size="sm"
                          onClick={() => handleDecideCorrection(cor.id, 'approved')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                        >
                          Approve Correction
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecideCorrection(cor.id, 'rejected')}
                          className="border-zinc-700 text-zinc-300 text-xs"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No Correction Requests" description="All match results remain officially finalized without pending amendment requests." />
          )}
        </TabsContent>

        {/* Performance & Quality Control Tab */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" /> Officiating Quality Audit Table
            </h3>
            <p className="text-xs text-zinc-400">
              Internal referee performance metrics used for promotion considerations, tournament staffing, and training reviews. Not published publicly.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="pb-3 font-semibold">Referee</th>
                    <th className="pb-3 font-semibold">Rank</th>
                    <th className="pb-3 font-semibold">Officiated</th>
                    <th className="pb-3 font-semibold">Warnings</th>
                    <th className="pb-3 font-semibold">Reports</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {referees.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/20">
                      <td className="py-3 font-semibold text-white">{r.display_name}</td>
                      <td className="py-3 text-zinc-300 font-mono">{r.rank}</td>
                      <td className="py-3 font-mono">{r.matches_officiated}</td>
                      <td className="py-3 font-mono text-amber-400">{r.warnings_issued}</td>
                      <td className="py-3 font-mono text-emerald-400">{r.reports_submitted}</td>
                      <td className="py-3 capitalize text-zinc-400">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Application Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Review Referee Candidate</h3>
              <button onClick={() => setSelectedApp(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <p><span className="text-zinc-500">Applicant: </span><strong className="text-white">{selectedApp.display_name}</strong> (@{selectedApp.website_username})</p>
                <p><span className="text-zinc-500">Roblox Handle: </span><strong className="text-white font-mono">{selectedApp.roblox_username}</strong></p>
                <p><span className="text-zinc-500">Discord: </span><strong className="text-white font-mono">{selectedApp.discord_username || 'None'}</strong></p>
                <p><span className="text-zinc-500">Region & Timezone: </span><strong className="text-white">{selectedApp.region} ({selectedApp.timezone})</strong></p>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Previous Experience</Label>
                <p className="p-3 mt-1 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300">{selectedApp.experience}</p>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Availability & Preferred Slots</Label>
                <p className="p-3 mt-1 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300">{selectedApp.availability} — {selectedApp.preferred_match_times}</p>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Motivation</Label>
                <p className="p-3 mt-1 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300">{selectedApp.motivation}</p>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Initial Assigned Rank</Label>
                <Select value={appAssignedRank} onValueChange={setAppAssignedRank}>
                  <SelectTrigger className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-white text-xs">
                    <SelectItem value="Trial Referee">Trial Referee (Level 1)</SelectItem>
                    <SelectItem value="Junior Referee">Junior Referee (Level 2)</SelectItem>
                    <SelectItem value="Referee">Referee (Level 3)</SelectItem>
                    <SelectItem value="Senior Referee">Senior Referee (Level 4)</SelectItem>
                    <SelectItem value="Head Referee">Head Referee (Level 5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Staff Review Feedback / Notes</Label>
                <Textarea
                  rows={2}
                  value={appReviewNotes}
                  onChange={(e) => setAppReviewNotes(e.target.value)}
                  placeholder="Notes sent to applicant..."
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                variant="destructive"
                size="sm"
                disabled={isProcessingApp}
                onClick={() => handleReviewApplication('rejected')}
                className="text-xs"
              >
                Reject Application
              </Button>
              <Button
                size="sm"
                disabled={isProcessingApp}
                onClick={() => handleReviewApplication('approved')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Approve & Promote to Referee
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Match Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" /> Assign Referee
              </h3>
              <button onClick={() => { setShowAssignModal(false); setAssignConflictWarning(null); }} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignConflictWarning && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Conflict Warning</span>
                </div>
                <p>{assignConflictWarning}</p>
                <div className="pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleAssignMatch(true)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                  >
                    Staff Override: Assign Anyway
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-zinc-400">Select Scheduled Match *</Label>
                <select
                  value={assignMatchId}
                  onChange={(e) => setAssignMatchId(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="">-- Choose Match --</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m as unknown as { home_guild?: { tag: string } }).home_guild?.tag || 'Home'} vs {(m as unknown as { away_guild?: { tag: string } }).away_guild?.tag || 'Away'} ({new Date(m.scheduled_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Select Official *</Label>
                <select
                  value={assignRefId}
                  onChange={(e) => setAssignRefId(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="">-- Choose Referee --</option>
                  {referees.filter(r => r.status === 'active').map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.display_name} ({r.rank} - {r.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Assignment Role</Label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as 'primary' | 'assistant' | 'head')}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="primary">Primary Referee</option>
                  <option value="assistant">Assistant Referee</option>
                  <option value="head">Head Referee (Supervisory)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleAssignMatch(false)}
                disabled={!assignMatchId || !assignRefId || isAssigning}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Assignment'}
              </Button>
            </div>
          </div>
        </div>
      )}



      {/* Edit Referee Modal */}
      {editingRef && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Edit Referee: {editingRef.display_name}</h3>
              <button onClick={() => setEditingRef(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-zinc-400">Display Name</Label>
                  <Input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Display Name"
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Website Username</Label>
                  <Input
                    value={editWebsiteUsername}
                    onChange={(e) => setEditWebsiteUsername(e.target.value)}
                    placeholder="username"
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-zinc-400">Roblox Username</Label>
                  <Input
                    value={editRobloxUsername}
                    onChange={(e) => setEditRobloxUsername(e.target.value)}
                    placeholder="Roblox Username"
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Discord Username</Label>
                  <Input
                    value={editDiscordUsername}
                    onChange={(e) => setEditDiscordUsername(e.target.value)}
                    placeholder="name#0000"
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-zinc-400">Region</Label>
                  <Input
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    placeholder="Asia/Pacific"
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Timezone</Label>
                  <Input
                    value={editTimezone}
                    onChange={(e) => setEditTimezone(e.target.value)}
                    placeholder="WIB (UTC+7)"
                    className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Rank</Label>
                <select
                  value={editRank}
                  onChange={(e) => setEditRank(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="Trial Referee">Trial Referee</option>
                  <option value="Junior Referee">Junior Referee</option>
                  <option value="Referee">Referee</option>
                  <option value="Senior Referee">Senior Referee</option>
                  <option value="Head Referee">Head Referee</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Status</Label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive' | 'on_leave' | 'suspended' | 'retired')}
                  className="mt-1 w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-white text-xs px-3"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Internal Staff Notes</Label>
                <Textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Confidential referee notes..."
                  className="mt-1 bg-zinc-950 border-zinc-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleSaveEditReferee}
                disabled={isSavingEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
