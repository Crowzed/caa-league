'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  Scale, Plus, Search, AlertCircle, CheckCircle2, 
  User, Shield, BookOpen, ExternalLink, 
  Eye, Edit2, Check, Loader2, ChevronRight
} from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import type { 
  Sanction, SanctionSeverity, SanctionType, SanctionStatus, 
  Guild, Profile, Rule, RuleVersion, Match, Case, Appeal 
} from '@/types/database';
import { getSanctionStatusBadge, getSanctionSeverityBadge } from '@/app/discipline/[id]/page';

const SANCTION_TYPES: { id: SanctionType; label: string; targets: ('player' | 'guild')[] }[] = [
  { id: 'official_warning', label: 'Official Warning', targets: ['player', 'guild'] },
  { id: 'written_warning', label: 'Written Warning', targets: ['player', 'guild'] },
  { id: 'match_forfeit', label: 'Match Forfeit', targets: ['guild'] },
  { id: 'map_forfeit', label: 'Map Forfeit', targets: ['guild'] },
  { id: 'score_penalty', label: 'Score Penalty', targets: ['guild'] },
  { id: 'point_deduction', label: 'Point Deduction', targets: ['guild'] },
  { id: 'match_suspension', label: 'Match Suspension', targets: ['player', 'guild'] },
  { id: 'player_suspension', label: 'Player Suspension', targets: ['player'] },
  { id: 'guild_suspension', label: 'Guild Suspension', targets: ['guild'] },
  { id: 'roster_restriction', label: 'Roster Restriction', targets: ['guild'] },
  { id: 'player_removal', label: 'Player Removal from Roster', targets: ['player'] },
  { id: 'guild_probation', label: 'Guild Probation', targets: ['guild'] },
  { id: 'competitive_ban', label: 'Competitive Ban', targets: ['player', 'guild'] },
  { id: 'tournament_ban', label: 'Tournament Ban', targets: ['player', 'guild'] },
  { id: 'temporary_ban', label: 'Temporary Ban', targets: ['player'] },
  { id: 'permanent_ban', label: 'Permanent Ban', targets: ['player', 'guild'] },
  { id: 'disqualification', label: 'Tournament Disqualification', targets: ['guild'] },
  { id: 'other', label: 'Other Sanction', targets: ['player', 'guild'] },
];

export default function PenaltiesAdminPage() {
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleVersions, setRuleVersions] = useState<RuleVersion[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'records' | 'appeals'>('active');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sanctionTypeFilter, setSanctionTypeFilter] = useState('all');

  // Multi-step "Issue Sanction" Wizard Dialog
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueStep, setIssueStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(0);

  // Form Data for New Sanction
  const [formData, setFormData] = useState<{
    targetType: 'player' | 'guild';
    playerId: string;
    guildId: string;
    caseId: string;
    matchId: string;
    ruleId: string;
    severity: SanctionSeverity;
    sanctionType: SanctionType | string;
    violation: string;
    decisionSummary: string;
    description: string;
    evidenceUrl: string;
    effectiveAt: string;
    durationDays: number;
    isPermanent: boolean;
    isPublic: boolean;
  }>({
    targetType: 'player',
    playerId: '',
    guildId: '',
    caseId: '',
    matchId: '',
    ruleId: '',
    severity: 'minor',
    sanctionType: 'official_warning',
    violation: '',
    decisionSummary: '',
    description: '',
    evidenceUrl: '',
    effectiveAt: new Date().toISOString().split('T')[0],
    durationDays: 14,
    isPermanent: false,
    isPublic: true,
  });

  // Action Dialog (Status modify: Overturn, Cancel, Reduce)
  const [selectedSanction, setSelectedSanction] = useState<Sanction | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState<SanctionStatus>('overturned');
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Appeal Decision Modal
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [isAppealDecisionModalOpen, setIsAppealDecisionModalOpen] = useState(false);
  const [appealDecisionStatus, setAppealDecisionStatus] = useState<'accepted' | 'rejected' | 'partially_upheld'>('accepted');
  const [appealDecisionText, setAppealDecisionText] = useState('');
  const [appealModificationSummary, setAppealModificationSummary] = useState('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (p) setCurrentUser(p as Profile);
      }

      // Fetch sanctions with joined relations
      const res = await fetch('/api/sanctions');
      const data = await res.json();
      if (data.sanctions) {
        setSanctions(data.sanctions);
      } else if (data.error) {
        console.error('Failed to load sanctions:', data.error);
      }

      // Fetch appeals
      const { data: appealsData } = await supabase
        .from('appeals')
        .select('*, submitter:profiles!submitted_by(username, display_name), sanction:sanctions(*)')
        .order('created_at', { ascending: false });
      if (appealsData) setAppeals(appealsData as unknown as Appeal[]);

      // Fetch lookup lists
      const [playersRes, guildsRes, rulesRes, ruleVersionsRes, matchesRes, casesRes] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, roblox_username, role').order('username'),
        supabase.from('guilds').select('id, name, tag, status').order('name'),
        supabase.from('rules').select('*').eq('is_active', true).order('number'),
        supabase.from('rule_versions').select('*').order('created_at', { ascending: false }),
        supabase.from('matches').select('id, scheduled_at, home_guild:guilds!home_guild_id(name, tag), away_guild:guilds!away_guild_id(name, tag)').order('scheduled_at', { ascending: false }).limit(25),
        supabase.from('cases').select('*').order('created_at', { ascending: false }).limit(25),
      ]);

      if (playersRes.data) setPlayers(playersRes.data as Profile[]);
      if (guildsRes.data) setGuilds(guildsRes.data as Guild[]);
      if (rulesRes.data) setRules(rulesRes.data as Rule[]);
      if (ruleVersionsRes.data) setRuleVersions(ruleVersionsRes.data as RuleVersion[]);
      if (matchesRes.data) setMatches(matchesRes.data as unknown as Match[]);
      if (casesRes.data) setCases(casesRes.data as Case[]);
    } catch (err) {
      console.warn('Load disciplinary data note:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setNowTimestamp(Date.now());
    loadData();
  }, [loadData]);

  const isStaff = currentUser && ['admin', 'super_admin', 'moderator'].includes(currentUser.role);

  // Statistics
  const stats = useMemo(() => {
    const active = sanctions.filter(s => s.status === 'active');
    const playerSanctions = sanctions.filter(s => s.target_type === 'player');
    const guildSanctions = sanctions.filter(s => s.target_type === 'guild');
    const pendingAppeals = appeals.filter(a => a.status === 'pending');
    const expiringSoon = active.filter(s => {
      if (!s.expires_at || s.is_permanent || !nowTimestamp) return false;
      const daysLeft = (new Date(s.expires_at).getTime() - nowTimestamp) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft <= 7;
    });

    return {
      activeCount: active.length,
      totalCount: sanctions.length,
      playerCount: playerSanctions.length,
      guildCount: guildSanctions.length,
      pendingAppealsCount: pendingAppeals.length,
      expiringSoonCount: expiringSoon.length,
    };
  }, [sanctions, appeals, nowTimestamp]);

  // Filtering
  const activeSanctions = useMemo(() => {
    return sanctions.filter(s => s.status === 'active');
  }, [sanctions]);

  const currentList = activeTab === 'active' ? activeSanctions : sanctions;

  const filteredSanctions = useMemo(() => {
    return currentList.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesCode = (s.sanction_code || '').toLowerCase().includes(q);
        const matchesCase = (s.case_code || '').toLowerCase().includes(q);
        const matchesViolation = (s.violation || '').toLowerCase().includes(q);
        const matchesRule = (s.rule_number || '').toLowerCase().includes(q) || (s.rule_title || '').toLowerCase().includes(q);
        const matchesPlayer = (s.player?.display_name || '').toLowerCase().includes(q) || (s.player?.username || '').toLowerCase().includes(q) || (s.player?.roblox_username || '').toLowerCase().includes(q);
        const matchesGuild = (s.guild?.name || '').toLowerCase().includes(q) || (s.guild?.tag || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesCase && !matchesViolation && !matchesRule && !matchesPlayer && !matchesGuild) {
          return false;
        }
      }

      if (targetTypeFilter !== 'all' && s.target_type !== targetTypeFilter) return false;
      if (severityFilter !== 'all' && s.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (sanctionTypeFilter !== 'all' && s.sanction_type !== sanctionTypeFilter) return false;

      return true;
    });
  }, [currentList, searchQuery, targetTypeFilter, severityFilter, statusFilter, sanctionTypeFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setTargetTypeFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setSanctionTypeFilter('all');
  };

  // Open Issue Sanction Modal
  const handleOpenIssueModal = () => {
    setFeedback(null);
    setIssueStep(1);
    setFormData({
      targetType: 'player',
      playerId: players[0]?.id || '',
      guildId: guilds[0]?.id || '',
      caseId: '',
      matchId: '',
      ruleId: rules[0]?.id || '',
      severity: 'minor',
      sanctionType: 'official_warning',
      violation: '',
      decisionSummary: '',
      description: '',
      evidenceUrl: '',
      effectiveAt: new Date().toISOString().split('T')[0],
      durationDays: 14,
      isPermanent: false,
      isPublic: true,
    });
    setIsIssueModalOpen(true);
  };

  // Submit New Sanction
  const handleIssueSanction = async () => {
    if (!formData.violation.trim() || !formData.decisionSummary.trim()) {
      setFeedback({ type: 'error', message: 'Violation summary and written decision are mandatory.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      // Selected rule details
      const selectedRule = rules.find(r => r.id === formData.ruleId);
      const activeVersion = ruleVersions.find(rv => rv.is_current) || ruleVersions[0];

      // Expiration calculation
      let expiresAt: string | null = null;
      if (!formData.isPermanent && formData.durationDays > 0) {
        const expDate = new Date(formData.effectiveAt);
        expDate.setDate(expDate.getDate() + formData.durationDays);
        expiresAt = expDate.toISOString();
      }

      const payload = {
        targetType: formData.targetType,
        playerId: formData.targetType === 'player' ? formData.playerId : null,
        guildId: formData.targetType === 'guild' ? formData.guildId : null,
        caseId: formData.caseId || null,
        matchId: formData.matchId || null,
        ruleId: formData.ruleId || null,
        ruleNumber: selectedRule ? `Rule ${selectedRule.number}` : 'Rule Unspecified',
        ruleTitle: selectedRule?.title || 'League Code of Conduct',
        ruleVersionId: activeVersion?.id || null,
        ruleVersionName: activeVersion?.name || 'Active Rulebook',
        violation: formData.violation.trim(),
        severity: formData.severity,
        sanctionType: formData.sanctionType,
        description: formData.description.trim() || null,
        decisionSummary: formData.decisionSummary.trim(),
        evidence: formData.evidenceUrl.trim() ? [{ url: formData.evidenceUrl.trim(), title: 'Sanction Evidence Link' }] : [],
        effectiveAt: new Date(formData.effectiveAt).toISOString(),
        expiresAt,
        durationDays: formData.isPermanent ? null : formData.durationDays,
        isPermanent: formData.isPermanent,
        isPublic: formData.isPublic,
      };

      const res = await fetch('/api/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setFeedback({ type: 'error', message: result.error || 'Failed to issue sanction.' });
      } else {
        setFeedback({ type: 'success', message: `Sanction ${result.sanction.sanction_code} issued successfully!` });
        await loadData();
        setTimeout(() => {
          setIsIssueModalOpen(false);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating sanction';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sanction Status Modification (Overturn, Cancel, Reduce)
  const handleModifyStatus = async () => {
    if (!selectedSanction || !actionReason.trim()) {
      alert('A valid reason is required to modify or overturn a sanction.');
      return;
    }

    try {
      setIsProcessingAction(true);
      const res = await fetch(`/api/sanctions/${selectedSanction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionStatus,
          reason: actionReason.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || 'Failed to modify sanction.');
      } else {
        setIsActionModalOpen(false);
        setActionReason('');
        await loadData();
      }
    } catch (err) {
      console.warn('Status modify note:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Appeal Decision
  const handleDecideAppeal = async () => {
    if (!selectedAppeal || !appealDecisionText.trim()) {
      alert('A written decision explanation is required.');
      return;
    }

    try {
      setIsProcessingAction(true);
      const res = await fetch(`/api/appeals/${selectedAppeal.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: appealDecisionStatus,
          decision: appealDecisionText.trim(),
          modificationSummary: appealModificationSummary.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || 'Failed to decide appeal.');
      } else {
        setIsAppealDecisionModalOpen(false);
        setAppealDecisionText('');
        setAppealModificationSummary('');
        await loadData();
      }
    } catch (err) {
      console.warn('Appeal decision note:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <PageHeader
            title="Sanctions & Disciplinary Records"
            description="Command An Army League official disciplinary archive, rule violation investigations, active sanctions, and appeals."
          />
        </div>
        {isStaff && (
          <Button
            onClick={handleOpenIssueModal}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium text-xs sm:text-sm gap-2 shadow-lg shadow-yellow-600/10"
          >
            <Plus className="w-4 h-4" /> Issue Sanction
          </Button>
        )}
      </div>

      {/* Disciplinary Dashboard Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Active Sanctions</span>
          <p className="text-2xl font-black text-red-400">{stats.activeCount}</p>
          <span className="text-[10px] text-zinc-500">Currently enforced</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Total Recorded</span>
          <p className="text-2xl font-black text-white">{stats.totalCount}</p>
          <span className="text-[10px] text-zinc-500">Permanent archives</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Player Targets</span>
          <p className="text-2xl font-black text-blue-400">{stats.playerCount}</p>
          <span className="text-[10px] text-zinc-500">Individual competitors</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Guild Targets</span>
          <p className="text-2xl font-black text-amber-400">{stats.guildCount}</p>
          <span className="text-[10px] text-zinc-500">Team sanctions</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Pending Appeals</span>
          <p className="text-2xl font-black text-cyan-400">{stats.pendingAppealsCount}</p>
          <span className="text-[10px] text-zinc-500">Awaiting committee review</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Expiring Soon</span>
          <p className="text-2xl font-black text-orange-400">{stats.expiringSoonCount}</p>
          <span className="text-[10px] text-zinc-500">Within next 7 days</span>
        </div>
      </div>

      {/* Main Sections Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'records' | 'appeals')} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="bg-zinc-900 border border-zinc-800 h-10 p-1">
            <TabsTrigger value="active" className="text-xs px-4">
              Active Sanctions ({stats.activeCount})
            </TabsTrigger>
            <TabsTrigger value="records" className="text-xs px-4">
              Disciplinary Records ({stats.totalCount})
            </TabsTrigger>
            <TabsTrigger value="appeals" className="text-xs px-4">
              Appeals Queue ({appeals.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filter and Search Bar (Used for both Active and Records) */}
        {activeTab !== 'appeals' && (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder="Search by Sanction ID, Case ID, Player, Guild, Rule, or Match..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 text-xs h-10"
                />
              </div>
              {(searchQuery || targetTypeFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all' || sanctionTypeFilter !== 'all') && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={resetFilters} 
                  className="text-xs text-zinc-400 hover:text-white border-zinc-700 h-10 shrink-0"
                >
                  Reset Filters
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-zinc-500">Target Type</label>
                <select
                  value={targetTypeFilter}
                  onChange={(e) => setTargetTypeFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Targets</option>
                  <option value="player">Players Only</option>
                  <option value="guild">Guilds Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-zinc-500">Severity Level</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Severities</option>
                  <option value="warning">Warning</option>
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="major">Major</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-zinc-500">Sanction Type</label>
                <select
                  value={sanctionTypeFilter}
                  onChange={(e) => setSanctionTypeFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Sanction Types</option>
                  {SANCTION_TYPES.map(st => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-zinc-500">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="completed">Completed</option>
                  <option value="overturned">Overturned</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="appealed">Appealed</option>
                  <option value="upheld">Upheld</option>
                  <option value="reduced">Reduced</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 1: Active Sanctions & SECTION 2: Disciplinary Records */}
        <TabsContent value="active" className="space-y-4 m-0">
          <SanctionTable
            sanctions={filteredSanctions}
            isLoading={isLoading}
            isStaff={Boolean(isStaff)}
            onSelectAction={(s) => {
              setSelectedSanction(s);
              setIsActionModalOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="records" className="space-y-4 m-0">
          <SanctionTable
            sanctions={filteredSanctions}
            isLoading={isLoading}
            isStaff={Boolean(isStaff)}
            onSelectAction={(s) => {
              setSelectedSanction(s);
              setIsActionModalOpen(true);
            }}
          />
        </TabsContent>

        {/* SECTION 3: Appeals Queue */}
        <TabsContent value="appeals" className="space-y-4 m-0">
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="border-b border-zinc-800 bg-zinc-950/40">
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Appeal ID</TableHead>
                    <TableHead className="text-zinc-400">Related Sanction</TableHead>
                    <TableHead className="text-zinc-400">Submitted By</TableHead>
                    <TableHead className="text-zinc-400">Grounds / Reason</TableHead>
                    <TableHead className="text-zinc-400">Date Filed</TableHead>
                    <TableHead className="text-zinc-400 text-center">Status</TableHead>
                    {isStaff && <TableHead className="text-zinc-400 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-zinc-500 text-xs">
                        No appeals currently pending review.
                      </TableCell>
                    </TableRow>
                  ) : (
                    appeals.map((appeal) => (
                      <TableRow key={appeal.id} className="border-zinc-800 hover:bg-zinc-800/30 text-xs">
                        <TableCell className="font-mono font-bold text-blue-400">
                          {appeal.appeal_code || 'APL-RECORD'}
                        </TableCell>
                        <TableCell>
                          {appeal.sanction ? (
                            <Link href={`/discipline/${appeal.sanction.sanction_code}`} className="font-mono text-zinc-200 hover:text-blue-400 underline">
                              {appeal.sanction.sanction_code}
                            </Link>
                          ) : (
                            <span className="text-zinc-500 font-mono">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {appeal.submitter?.display_name || appeal.submitter?.username || 'Competitor'}
                        </TableCell>
                        <TableCell className="text-zinc-300 max-w-xs truncate" title={appeal.reason}>
                          {appeal.reason}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {new Date(appeal.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="capitalize text-[10px] text-zinc-300">
                            {appeal.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        {isStaff && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAppeal(appeal);
                                setIsAppealDecisionModalOpen(true);
                              }}
                              className="text-xs h-7 border-zinc-700 hover:bg-zinc-800"
                            >
                              Rule on Appeal
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================================================================== */}
      {/* MULTI-STEP "ISSUE SANCTION" MODAL */}
      {/* ===================================================================== */}
      {isStaff && (
        <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
          <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Scale className="w-5 h-5 text-yellow-500" />
                Issue Official Disciplinary Sanction (Step {issueStep} of 3)
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Formal penalty record for confirmed rule violations in the Command An Army League.
              </DialogDescription>
            </DialogHeader>

            {feedback && (
              <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                feedback.type === 'error'
                  ? 'bg-red-950/60 border border-red-800 text-red-300'
                  : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              }`}>
                {feedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* STEP 1: Target & Context Selection */}
            {issueStep === 1 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-zinc-400">Target Type *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, targetType: 'player' })}
                      className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                        formData.targetType === 'player'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400 ring-1 ring-blue-500/40'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <User className="w-4 h-4" /> Individual Player
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, targetType: 'guild' })}
                      className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                        formData.targetType === 'guild'
                          ? 'bg-amber-600/20 border-amber-500 text-amber-400 ring-1 ring-amber-500/40'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <Shield className="w-4 h-4" /> Entire Guild / Team
                    </button>
                  </div>
                </div>

                {formData.targetType === 'player' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="target_player" className="text-xs">Select Player *</Label>
                    <select
                      id="target_player"
                      value={formData.playerId}
                      onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}
                      className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name || p.username} (@{p.username}) {p.roblox_username ? `[Roblox: ${p.roblox_username}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="target_guild" className="text-xs">Select Guild *</Label>
                    <select
                      id="target_guild"
                      value={formData.guildId}
                      onChange={(e) => setFormData({ ...formData, guildId: e.target.value })}
                      className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      {guilds.map((g) => (
                        <option key={g.id} value={g.id}>
                          [{g.tag}] {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="related_case" className="text-xs">Related Case (Optional)</Label>
                    <select
                      id="related_case"
                      value={formData.caseId}
                      onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
                      className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">No formal case (Direct administrative sanction)</option>
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.case_code || 'CASE'} — {c.title || c.decision || 'Investigation File'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="related_match" className="text-xs">Related Match Fixture (Optional)</Label>
                    <select
                      id="related_match"
                      value={formData.matchId}
                      onChange={(e) => setFormData({ ...formData, matchId: e.target.value })}
                      className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Non-match related violation</option>
                      {matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {new Date(m.scheduled_at).toLocaleDateString()} — {m.home_guild?.name || 'T1'} vs {m.away_guild?.name || 'T2'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Rule, Severity, & Sanction Type */}
            {issueStep === 2 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rule_select" className="text-xs">Rule Violated *</Label>
                  <select
                    id="rule_select"
                    value={formData.ruleId}
                    onChange={(e) => setFormData({ ...formData, ruleId: e.target.value })}
                    className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                  >
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        Rule {r.number} — {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="severity_select" className="text-xs">Severity Level *</Label>
                    <select
                      id="severity_select"
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value as SanctionSeverity })}
                      className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none capitalize"
                    >
                      <option value="warning">Warning</option>
                      <option value="minor">Minor</option>
                      <option value="moderate">Moderate</option>
                      <option value="major">Major</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sanction_type_select" className="text-xs">Sanction Type *</Label>
                    <select
                      id="sanction_type_select"
                      value={formData.sanctionType}
                      onChange={(e) => setFormData({ ...formData, sanctionType: e.target.value })}
                      className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      {SANCTION_TYPES
                        .filter(st => st.targets.includes(formData.targetType))
                        .map(st => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="violation_title" className="text-xs">Violation Summary Title *</Label>
                  <Input
                    id="violation_title"
                    value={formData.violation}
                    onChange={(e) => setFormData({ ...formData, violation: e.target.value })}
                    placeholder="e.g. Exploiting Teleport Glitch in Group Stage Game 2"
                    className="bg-zinc-900 border-zinc-700 text-xs h-9"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="effective_date" className="text-xs">Effective Date *</Label>
                    <Input
                      id="effective_date"
                      type="date"
                      value={formData.effectiveAt}
                      onChange={(e) => setFormData({ ...formData, effectiveAt: e.target.value })}
                      className="bg-zinc-900 border-zinc-700 text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="duration_days" className="text-xs">Duration (Days)</Label>
                    <Input
                      id="duration_days"
                      type="number"
                      disabled={formData.isPermanent}
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 0 })}
                      className="bg-zinc-900 border-zinc-700 text-xs h-9"
                      min={1}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="is_permanent"
                      checked={formData.isPermanent}
                      onChange={(e) => setFormData({ ...formData, isPermanent: e.target.checked })}
                      className="rounded bg-zinc-900 border-zinc-700 text-yellow-600 focus:ring-yellow-500"
                    />
                    <Label htmlFor="is_permanent" className="text-xs font-normal text-zinc-300">
                      Permanent Sanction
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Written Decision, Evidence, & Review */}
            {issueStep === 3 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="decision_summary" className="text-xs">Written Decision Summary & Explanation *</Label>
                  <Textarea
                    id="decision_summary"
                    rows={4}
                    required
                    value={formData.decisionSummary}
                    onChange={(e) => setFormData({ ...formData, decisionSummary: e.target.value })}
                    placeholder="State clearly why this sanction was issued, telemetry reviewed, and competitive penalty applied..."
                    className="bg-zinc-900 border-zinc-700 text-xs"
                  />
                  <p className="text-[11px] text-zinc-500">A sanction must always include an official explanation for the target.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="circumstances_desc" className="text-xs">Incident Circumstances (Optional)</Label>
                  <Textarea
                    id="circumstances_desc"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Specific timing, map round, in-game context..."
                    className="bg-zinc-900 border-zinc-700 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="evidence_link" className="text-xs">Attach Evidence Link (Optional)</Label>
                  <Input
                    id="evidence_link"
                    type="url"
                    value={formData.evidenceUrl}
                    onChange={(e) => setFormData({ ...formData, evidenceUrl: e.target.value })}
                    placeholder="https://..."
                    className="bg-zinc-900 border-zinc-700 text-xs h-9"
                  />
                </div>

                {/* Review Summary Box */}
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1.5 text-zinc-300">
                  <span className="font-semibold text-white uppercase text-[10px] tracking-wider block">Summary of Sanction to Issue</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Target: <strong className="text-white capitalize">{formData.targetType}</strong></div>
                    <div>Severity: <strong className="text-yellow-400 capitalize">{formData.severity}</strong></div>
                    <div>Type: <strong className="text-white">{formData.sanctionType.replace(/_/g, ' ')}</strong></div>
                    <div>Term: <strong className="text-white">{formData.isPermanent ? 'Permanent' : `${formData.durationDays} Days`}</strong></div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-zinc-800 flex justify-between">
              {issueStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIssueStep(issueStep - 1)}
                  className="text-xs border-zinc-700"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              )}
              {issueStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIssueStep(issueStep + 1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs ml-auto"
                >
                  Continue <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleIssueSanction}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs gap-1.5 ml-auto font-medium"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Issue Sanction & Notify
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ===================================================================== */}
      {/* STATUS MODIFY MODAL (Overturn / Cancel / Upheld) */}
      {/* ===================================================================== */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-400" />
              Modify Sanction {selectedSanction?.sanction_code}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Never delete records: disciplinary actions can be Overturned, Cancelled, or Completed with full historical auditing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">New Sanction Status *</Label>
              <select
                value={actionStatus}
                onChange={(e) => setActionStatus(e.target.value as SanctionStatus)}
                className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none capitalize"
              >
                <option value="overturned">Overturned (Appeal / Error)</option>
                <option value="cancelled">Cancelled (Procedural Reason)</option>
                <option value="completed">Completed (Served Full Term)</option>
                <option value="reduced">Reduced (Partial Leniency)</option>
                <option value="active">Active (Re-instate)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Status Change *</Label>
              <Textarea
                rows={3}
                required
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Explain why this sanction status was changed. This will be permanently recorded in the public and audited timeline..."
                className="bg-zinc-900 border-zinc-700 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActionModalOpen(false)}
              className="text-xs border-zinc-700"
              disabled={isProcessingAction}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleModifyStatus}
              disabled={isProcessingAction || !actionReason.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Status Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* APPEAL DECISION MODAL */}
      {/* ===================================================================== */}
      <Dialog open={isAppealDecisionModalOpen} onOpenChange={setIsAppealDecisionModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-400" />
              Rule on Appeal {selectedAppeal?.appeal_code}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Deliver official League Appeals Committee decision.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Ruling Decision *</Label>
              <select
                value={appealDecisionStatus}
                onChange={(e) => setAppealDecisionStatus(e.target.value as 'accepted' | 'rejected' | 'partially_upheld')}
                className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="accepted">Accepted (Sanction Overturned)</option>
                <option value="rejected">Rejected (Sanction Upheld)</option>
                <option value="partially_upheld">Partially Upheld (Sanction Reduced)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Official Ruling Explanation *</Label>
              <Textarea
                rows={3}
                required
                value={appealDecisionText}
                onChange={(e) => setAppealDecisionText(e.target.value)}
                placeholder="State the Committee's factual basis for upholding, reducing, or overturning the sanction..."
                className="bg-zinc-900 border-zinc-700 text-xs"
              />
            </div>

            {appealDecisionStatus === 'partially_upheld' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reduction Details (e.g. Reduced from 5 matches to 2)</Label>
                <Input
                  value={appealModificationSummary}
                  onChange={(e) => setAppealModificationSummary(e.target.value)}
                  placeholder="e.g. Suspension reduced to 2 match fixtures."
                  className="bg-zinc-900 border-zinc-700 text-xs h-9"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAppealDecisionModalOpen(false)}
              className="text-xs border-zinc-700"
              disabled={isProcessingAction}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDecideAppeal}
              disabled={isProcessingAction || !appealDecisionText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Publish Appeal Ruling
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reusable Sanction Table component
function SanctionTable({
  sanctions,
  isLoading,
  isStaff,
  onSelectAction,
}: {
  sanctions: Sanction[];
  isLoading: boolean;
  isStaff: boolean;
  onSelectAction: (s: Sanction) => void;
}) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="border-b border-zinc-800 bg-zinc-950/40">
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-400">Sanction ID</TableHead>
              <TableHead className="text-zinc-400">Target</TableHead>
              <TableHead className="text-zinc-400">Violation & Rule</TableHead>
              <TableHead className="text-zinc-400">Sanction Type</TableHead>
              <TableHead className="text-zinc-400">Severity</TableHead>
              <TableHead className="text-zinc-400 text-center">Status</TableHead>
              <TableHead className="text-zinc-400">Term</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-zinc-500 text-xs">
                  Loading disciplinary archives...
                </TableCell>
              </TableRow>
            ) : sanctions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-zinc-500 text-xs">
                  No disciplinary records match your criteria.
                </TableCell>
              </TableRow>
            ) : (
              sanctions.map((sanction) => (
                <TableRow key={sanction.id} className="border-zinc-800 hover:bg-zinc-800/30 text-xs">
                  <TableCell className="font-mono font-bold text-blue-400">
                    <Link href={`/discipline/${sanction.sanction_code}`} className="hover:underline flex items-center gap-1">
                      {sanction.sanction_code}
                      <ExternalLink className="w-3 h-3 text-zinc-600" />
                    </Link>
                  </TableCell>

                  <TableCell>
                    {sanction.target_type === 'player' ? (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <div>
                          <Link href={`/players/${sanction.player_id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                            {sanction.player?.display_name || sanction.player?.username || 'Player'}
                          </Link>
                          <span className="text-[10px] text-zinc-500 block font-mono">@{sanction.player?.username}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div>
                          <Link href={`/guilds/${sanction.guild_id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                            {sanction.guild?.name || 'Guild'}
                          </Link>
                          <span className="text-[10px] text-zinc-500 block font-mono">[{sanction.guild?.tag}]</span>
                        </div>
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="max-w-xs">
                    <div className="font-medium text-white truncate" title={sanction.violation}>
                      {sanction.violation}
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <BookOpen className="w-3 h-3 text-zinc-500" />
                      <span>{sanction.rule_number}: {sanction.rule_title}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300 font-mono capitalize">
                      {sanction.sanction_type.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {getSanctionSeverityBadge(sanction.severity)}
                  </TableCell>

                  <TableCell className="text-center">
                    {getSanctionStatusBadge(sanction.status)}
                  </TableCell>

                  <TableCell className="text-zinc-400 text-[11px]">
                    {sanction.is_permanent ? (
                      <span className="text-red-400 font-medium">Permanent</span>
                    ) : sanction.expires_at ? (
                      <span>Expires {new Date(sanction.expires_at).toLocaleDateString()}</span>
                    ) : (
                      <span>Issued {new Date(sanction.issued_at).toLocaleDateString()}</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800">
                        <Link href={`/discipline/${sanction.sanction_code}`} title="View Full Decision & Timeline">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                      {isStaff && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectAction(sanction)}
                          className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/30"
                          title="Modify Sanction Status"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

