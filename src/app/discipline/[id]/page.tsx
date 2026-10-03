'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Scale, ShieldAlert, AlertCircle, CheckCircle2, Clock, Calendar, 
  User, Shield, Swords, BookOpen, ExternalLink, ArrowLeft, Send, 
  FileText, Check, X, Loader2, Sparkles, MessageSquare, History,
  Lock, AlertTriangle, Eye, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import type { Sanction, SanctionEvent, Appeal, Profile } from '@/types/database';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface PageProps {
  params: Promise<{ id: string }>;
}

export function getSanctionStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">Active</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30">Pending</Badge>;
    case 'expired':
      return <Badge variant="outline" className="border-zinc-800 text-zinc-500">Expired</Badge>;
    case 'completed':
      return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Completed</Badge>;
    case 'overturned':
      return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30">Overturned</Badge>;
    case 'cancelled':
      return <Badge variant="outline" className="border-zinc-800 text-zinc-500">Cancelled</Badge>;
    case 'appealed':
      return <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">Under Appeal</Badge>;
    case 'upheld':
      return <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/30">Upheld on Appeal</Badge>;
    case 'reduced':
      return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30">Reduced on Appeal</Badge>;
    default:
      return <Badge variant="outline" className="border-zinc-800 text-zinc-400 capitalize">{status}</Badge>;
  }
}

export function getSanctionSeverityBadge(severity: string) {
  switch (severity.toLowerCase()) {
    case 'severe':
    case 'critical':
      return <Badge className="bg-red-950/80 text-red-400 border border-red-500/50">Severe</Badge>;
    case 'major':
      return <Badge className="bg-orange-950/80 text-orange-400 border border-orange-500/50">Major</Badge>;
    case 'moderate':
      return <Badge className="bg-amber-950/80 text-amber-400 border border-amber-500/50">Moderate</Badge>;
    case 'minor':
      return <Badge className="bg-blue-950/80 text-blue-400 border border-blue-500/50">Minor</Badge>;
    case 'warning':
    default:
      return <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700">Warning</Badge>;
  }
}

export default function SanctionDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const identifier = resolvedParams.id;

  const [sanction, setSanction] = useState<Sanction | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Appeal Modal State
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('New Evidence / Factual Error');
  const [appealStatement, setAppealStatement] = useState('');
  const [appealEvidenceUrl, setAppealEvidenceUrl] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [appealFeedback, setAppealFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const supabase = createClient();

  const loadSanction = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/sanctions/${identifier}`);
      const data = await res.json();

      if (!res.ok || !data.sanction) {
        setErrorMsg(data.error || 'Sanction record not found.');
      } else {
        setSanction(data.sanction);
      }

      // Check current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (pData) setCurrentUser(pData as Profile);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error loading record.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSanction();
  }, [identifier]);

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanction) return;
    setIsSubmittingAppeal(true);
    setAppealFeedback(null);

    try {
      const res = await fetch(`/api/sanctions/${sanction.id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: appealReason,
          statement: appealStatement.trim(),
          evidence: appealEvidenceUrl.trim() ? [{ url: appealEvidenceUrl.trim(), title: 'Appeal Evidence Attachment' }] : [],
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setAppealFeedback({ type: 'error', message: result.error || 'Failed to submit appeal.' });
      } else {
        setAppealFeedback({ type: 'success', message: 'Appeal submitted successfully! The League Committee has been notified.' });
        setTimeout(() => {
          setIsAppealModalOpen(false);
          loadSanction();
        }, 1800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting appeal';
      setAppealFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!sanction || errorMsg) {
    return (
      <div className="container py-20 max-w-4xl mx-auto text-center space-y-6">
        <EmptyState
          title="Sanction Record Not Found"
          description={errorMsg || "The requested disciplinary file does not exist or has restricted access."}
          icon={<Scale className="w-12 h-12 text-zinc-600" />}
        />
        <Button asChild variant="outline" className="border-zinc-800">
          <Link href="/admin/penalties">Back to Disciplinary Records</Link>
        </Button>
      </div>
    );
  }

  const isStaff = currentUser && ['admin', 'super_admin', 'moderator'].includes(currentUser.role);
  const isTargetPlayer = currentUser && sanction.target_type === 'player' && sanction.player_id === currentUser.id;
  const isTargetGuild = currentUser && sanction.target_type === 'guild' && sanction.guild?.owner_id === currentUser.id;
  const canAppeal = (isTargetPlayer || isTargetGuild) && sanction.status === 'active' && sanction.appeal_status === 'none';

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/admin/penalties" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Disciplinary Records
        </Link>
        {isStaff && (
          <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/40 bg-blue-500/10">
            Staff Access (Full Telemetry)
          </Badge>
        )}
      </div>

      {/* Primary Header Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
                {sanction.sanction_code}
              </span>
              {getSanctionStatusBadge(sanction.status)}
              {getSanctionSeverityBadge(sanction.severity)}
              <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-300 uppercase">
                {sanction.sanction_type.replace(/_/g, ' ')}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight pt-1">
              {sanction.violation}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Official Disciplinary Action • Issued {new Date(sanction.issued_at).toLocaleDateString()}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {canAppeal && (
              <Button
                onClick={() => setIsAppealModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-md"
              >
                <Scale className="w-3.5 h-3.5" />
                Appeal Sanction
              </Button>
            )}
          </div>
        </div>

        {/* Target Details Grid */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block uppercase text-[10px] tracking-wider">Sanction Target</span>
            {sanction.target_type === 'player' ? (
              <div className="pt-1">
                <Link href={`/players/${sanction.player_id}`} className="font-bold text-white hover:text-blue-400 transition-colors inline-flex items-center gap-1 text-sm">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  {sanction.player?.display_name || sanction.player?.username || 'Player'}
                </Link>
                <span className="text-zinc-400 block font-mono text-[11px]">@{sanction.player?.username}</span>
                {sanction.player?.roblox_username && (
                  <span className="text-zinc-500 block text-[11px]">Roblox: {sanction.player.roblox_username}</span>
                )}
              </div>
            ) : (
              <div className="pt-1">
                <Link href={`/guilds/${sanction.guild_id}`} className="font-bold text-white hover:text-blue-400 transition-colors inline-flex items-center gap-1 text-sm">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  {sanction.guild?.name || 'Guild'}
                </Link>
                <span className="text-zinc-400 block font-mono text-[11px]">[{sanction.guild?.tag}]</span>
              </div>
            )}
          </div>

          <div>
            <span className="text-zinc-500 block uppercase text-[10px] tracking-wider">Rule Reference</span>
            <div className="pt-1">
              <span className="font-bold text-white block">{sanction.rule_number || 'Rule Specific'}</span>
              <span className="text-zinc-300 block truncate">{sanction.rule_title || 'Competitive Regulation'}</span>
              <span className="text-zinc-500 block text-[11px] font-mono">{sanction.rule_version_name || 'Active Rulebook'}</span>
            </div>
          </div>

          <div>
            <span className="text-zinc-500 block uppercase text-[10px] tracking-wider">Effective Term</span>
            <div className="pt-1 space-y-0.5">
              <span className="text-zinc-300 block">
                Start: <strong className="text-white">{new Date(sanction.effective_at).toLocaleDateString()}</strong>
              </span>
              <span className="text-zinc-300 block">
                Expires: {sanction.is_permanent ? (
                  <strong className="text-red-400">Permanent Ban</strong>
                ) : sanction.expires_at ? (
                  <strong className="text-zinc-100">{new Date(sanction.expires_at).toLocaleDateString()}</strong>
                ) : (
                  <span className="text-zinc-500">Upon Completion</span>
                )}
              </span>
              {sanction.duration_days && (
                <span className="text-zinc-500 block text-[11px]">Duration: {sanction.duration_days} days</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 block uppercase text-[10px] tracking-wider">Case & Match Origin</span>
            <div className="pt-1 space-y-0.5">
              {sanction.case_code ? (
                <span className="text-zinc-300 block">
                  Case: <strong className="font-mono text-blue-400">{sanction.case_code}</strong>
                </span>
              ) : (
                <span className="text-zinc-500 block">Direct League Action</span>
              )}
              {sanction.match_id ? (
                <Link href={`/matches/${sanction.match_id}`} className="text-blue-400 hover:underline block truncate">
                  Fixture Reference <ExternalLink className="w-2.5 h-2.5 inline" />
                </Link>
              ) : (
                <span className="text-zinc-500 block">Non-match violation</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Decision & Evidence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Official Decision Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <FileText className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-white">Written Decision Summary</h2>
            </div>

            <div className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {sanction.decision_summary}
            </div>

            {sanction.description && (
              <div className="pt-3 border-t border-zinc-800/80">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Violation Description & Circumstances
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                  {sanction.description}
                </p>
              </div>
            )}

            {isStaff && sanction.additional_notes && (
              <div className="pt-3 border-t border-zinc-800/80">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Lock className="w-3 h-3" /> Internal Staff Notes (Confidential)
                </span>
                <p className="text-xs text-amber-200/90 leading-relaxed bg-amber-950/20 p-3 rounded-lg border border-amber-500/20">
                  {sanction.additional_notes}
                </p>
              </div>
            )}
          </div>

          {/* Evidence Attachments */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Submitted Evidence ({sanction.evidence?.length || 0})
            </h2>

            {sanction.evidence && sanction.evidence.length > 0 ? (
              <div className="space-y-2">
                {sanction.evidence.map((ev, i) => (
                  <div key={i} className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-white">{ev.title || `Evidence Item #${i + 1}`}</p>
                      {ev.description && <p className="text-zinc-400">{ev.description}</p>}
                    </div>
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Inspect <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No public evidence items attached to this sanction file.</p>
            )}
          </div>

          {/* Appeal Status Section */}
          {sanction.appeals && sanction.appeals.length > 0 && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/10 p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-400" />
                Appeals Filing Record
              </h2>

              <div className="space-y-3">
                {sanction.appeals.map((app) => (
                  <div key={app.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-400">{app.appeal_code || 'APL-RECORD'}</span>
                        <Badge variant="outline" className="capitalize text-[10px] text-zinc-300">
                          {app.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <span className="text-zinc-500">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>

                    <p className="text-zinc-300">
                      <strong>Grounds:</strong> {app.reason}
                    </p>

                    {app.statement && (
                      <p className="text-zinc-400 italic bg-zinc-900/60 p-2.5 rounded border border-zinc-800/80">
                        &ldquo;{app.statement}&rdquo;
                      </p>
                    )}

                    {app.decision && (
                      <div className="p-2.5 rounded bg-blue-950/40 border border-blue-500/30 text-blue-300">
                        <strong>Appeals Ruling:</strong> {app.decision}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Complete Disciplinary Timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                Disciplinary Timeline
              </h2>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Audited</span>
            </div>

            {/* Vertical Timeline */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
              {sanction.events && sanction.events.length > 0 ? (
                sanction.events.map((evt, idx) => (
                  <div key={evt.id || idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-zinc-900 bg-blue-500 ring-2 ring-blue-500/20 group-hover:scale-125 transition-transform" />
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white text-xs">{evt.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(evt.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug">
                        {evt.description}
                      </p>
                      {evt.actor_name && (
                        <span className="text-[10px] text-zinc-500 block">
                          Recorded by: <span className="text-zinc-400">{evt.actor_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-zinc-500 italic py-2">
                  No historical event milestones recorded.
                </div>
              )}
            </div>
          </div>

          {/* Legal Authority & Notice */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2 text-xs text-zinc-400">
            <h4 className="font-semibold text-zinc-300 flex items-center gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              League Enforcement Policy
            </h4>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Sanctions issued by authorized league officials are binding across all official tournament play. Decisions are subject to appeal only within the designated review period.
            </p>
          </div>
        </div>
      </div>

      {/* Appeal Submission Modal */}
      <Dialog open={isAppealModalOpen} onOpenChange={setIsAppealModalOpen}>
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Scale className="w-4 h-4 text-blue-400" />
              Appeal Disciplinary Sanction {sanction.sanction_code}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Submit your formal grounds and statement to the League Appeals Committee.
            </DialogDescription>
          </DialogHeader>

          {appealFeedback && (
            <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
              appealFeedback.type === 'error'
                ? 'bg-red-950/60 border border-red-800 text-red-300'
                : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
            }`}>
              {appealFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{appealFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleAppealSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="appeal_reason" className="text-xs">Appeal Grounds *</Label>
              <select
                id="appeal_reason"
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="New Evidence / Factual Error">New Evidence or Incorrect Facts</option>
                <option value="Disproportionate Penalty Severity">Penalty Is Too Harsh</option>
                <option value="Procedural / Telemetry Inconsistency">The Process or Rules Were Not Followed Correctly</option>
                <option value="Mitigating Circumstances">Important Circumstances Were Overlooked</option>
                <option value="Identity / Account Confusion">Wrong Player or Account</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appeal_statement" className="text-xs">Detailed Appeal Statement *</Label>
              <Textarea
                id="appeal_statement"
                rows={4}
                required
                value={appealStatement}
                onChange={(e) => setAppealStatement(e.target.value)}
                placeholder="Explain clearly why this sanction should be reduced, overturned, or reconsidered..."
                className="bg-zinc-900 border-zinc-700 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appeal_evidence" className="text-xs">Evidence Link (Video / Screenshot URL)</Label>
              <Input
                id="appeal_evidence"
                type="url"
                value={appealEvidenceUrl}
                onChange={(e) => setAppealEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="bg-zinc-900 border-zinc-700 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAppealModalOpen(false)}
                className="text-xs border-zinc-700"
                disabled={isSubmittingAppeal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingAppeal}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
              >
                {isSubmittingAppeal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Submit Appeal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

