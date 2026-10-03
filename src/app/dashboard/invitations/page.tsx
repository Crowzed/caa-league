'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Mail, CheckCircle2, Clock, AlertCircle, 
  ArrowLeft, Check, X, Loader2, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import type { GuildInvitation, Guild, Profile } from '@/types/database';

type EnrichedInvitation = GuildInvitation & {
  guild?: Guild;
  inviter?: Profile;
};

export default function PlayerInvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<EnrichedInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(0);

  const supabase = createClient();

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('guild_invitations')
        .select('*, guild:guilds(*), inviter:profiles!invited_by(*)')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
      } else if (data) {
        setInvitations(data as unknown as EnrichedInvitation[]);
      }
    } catch (err) {
      console.warn('Invitations load note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setNowTimestamp(Date.now());
    loadInvitations();
  }, [supabase]);

  const handleRespond = async (invitationId: string, action: 'accept' | 'decline') => {
    setFeedback(null);
    setProcessingId(invitationId);

    try {
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const result = await res.json();

      if (!res.ok) {
        setFeedback({ type: 'error', message: result.error || 'Failed to process invitation.' });
      } else {
        setFeedback({ 
          type: 'success', 
          message: action === 'accept' 
            ? 'Invitation accepted! You have officially joined the guild roster.' 
            : 'Invitation declined.' 
        });
        await loadInvitations();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingInvitations = invitations.filter(i => i.status === 'pending');
  const pastInvitations = invitations.filter(i => i.status !== 'pending');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <PageHeader 
            title="Guild Invitations" 
            description="Review team offers to join competitive tournament rosters." 
          />
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
          <span className="leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* Pending Invitations Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Pending Team Invitations ({pendingInvitations.length})</h2>
        </div>

        {pendingInvitations.length > 0 ? (
          <div className="space-y-4">
            {pendingInvitations.map((invite) => {
              const isProcessing = processingId === invite.id;
              const expiresDate = invite.expires_at ? new Date(invite.expires_at) : null;
              const isExpiringSoon = expiresDate && nowTimestamp > 0 && (expiresDate.getTime() - nowTimestamp < 86400000 * 2);

              return (
                <div 
                  key={invite.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur p-6 shadow-md hover:border-blue-500/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6 md:items-center">
                    <div className="flex items-start gap-4">
                      {/* Guild Logo / Tag */}
                      <div className="w-14 h-14 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-black text-blue-400 text-lg shrink-0">
                        {invite.guild?.tag || 'GD'}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">
                            {invite.guild?.name || 'Tournament Guild'}
                          </h3>
                          <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/40 bg-blue-500/10 font-mono">
                            [{invite.guild?.tag || 'TAG'}]
                          </Badge>
                        </div>

                        <p className="text-sm text-zinc-300">
                          Invited by <strong className="text-white">{invite.inviter?.display_name || invite.inviter?.username || 'Team Captain'}</strong>
                        </p>

                        {invite.message && (
                          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300 italic flex items-start gap-2 max-w-lg">
                            <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                            <span>&ldquo;{invite.message}&rdquo;</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-1">
                          <span>Received: {new Date(invite.created_at).toLocaleDateString()}</span>
                          {expiresDate && (
                            <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-amber-400' : ''}`}>
                              <Clock className="w-3 h-3" />
                              Expires: {expiresDate.toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex sm:flex-col gap-2.5 shrink-0">
                      <Button
                        onClick={() => handleRespond(invite.id, 'accept')}
                        disabled={isProcessing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-5 py-2.5 h-auto rounded-xl flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Accept Invitation</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleRespond(invite.id, 'decline')}
                        disabled={isProcessing}
                        className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs px-5 py-2.5 h-auto rounded-xl flex items-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState 
            title="No Pending Invitations" 
            description="You do not have any pending guild invitations right now. Guild captains can invite you from their dashboard."
            icon={<Mail className="w-10 h-10 text-zinc-600" />}
          />
        )}
      </div>

      {/* Past Invitations History */}
      {pastInvitations.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-zinc-800/80">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Past Invitations History</h2>
          <div className="space-y-2.5">
            {pastInvitations.map((invite) => {
              return (
                <div 
                  key={invite.id} 
                  className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 border border-zinc-700">
                      {invite.guild?.tag || 'GD'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{invite.guild?.name || 'Guild'}</span>
                        <span className="text-zinc-500 font-mono">[{invite.guild?.tag || 'TAG'}]</span>
                      </div>
                      <span className="text-zinc-500 text-[11px]">
                        Received {new Date(invite.created_at).toLocaleDateString()}
                        {invite.responded_at && ` • Responded ${new Date(invite.responded_at).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>

                  <div>
                    {invite.status === 'accepted' && (
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                        Accepted
                      </Badge>
                    )}
                    {invite.status === 'declined' && (
                      <Badge variant="outline" className="text-zinc-400 border-zinc-700 bg-zinc-800/50">
                        Declined
                      </Badge>
                    )}
                    {invite.status === 'cancelled' && (
                      <Badge variant="outline" className="text-red-400 border-red-500/40 bg-red-500/10">
                        Cancelled by Captain
                      </Badge>
                    )}
                    {invite.status === 'expired' && (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40 bg-amber-500/10">
                        Expired
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
