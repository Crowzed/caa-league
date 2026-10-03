'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Calendar, Users, Swords, Bell, Shield, Settings,
  Plus, ArrowRight, MessageSquare, ClipboardCheck, Trash2, UserPlus, 
  AlertCircle, CheckCircle, Loader2, Sparkles, Search, X, Check, 
  Clock, Send, Globe, Gamepad2, Mail, ExternalLink, Scale
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatCard, SectionHeader } from '@/components/shared';
import { MatchCard } from '@/components/match-card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { 
  Guild, Standing, Match, Season, Division, GuildMemberRole, 
  Profile, GuildInvitation, Sanction 
} from '@/types/database';
import { getAccountStatusBadge } from '@/components/player-card';

type MatchWithGuilds = Match & {
  home_guild: Guild;
  away_guild: Guild;
  division?: Division;
};

interface MemberWithPlayer {
  player_id: string;
  role: string | null;
  player?: {
    username: string;
    display_name: string | null;
    roblox_username?: string | null;
    roblox_id?: string | null;
    avatar_url?: string | null;
    region?: string | null;
  } | null;
}

interface RosterMember {
  id: string;
  name: string;
  role: string;
  rawRole: string;
  status: string;
  roblox_username?: string | null;
  roblox_id?: string | null;
  avatar_url?: string | null;
}

interface SearchedPlayerProfile extends Profile {
  active_membership?: {
    id: string;
    guild_id: string;
    is_active: boolean;
    guild?: {
      id: string;
      name: string;
      tag: string;
    };
  }[];
}

type EnrichedGuildInvitation = GuildInvitation & {
  player?: Profile;
  guild?: Guild;
  inviter?: Profile;
};

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<GuildMemberRole | 'owner' | null>(null);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [liveMatches, setLiveMatches] = useState<MatchWithGuilds[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MatchWithGuilds[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchWithGuilds[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [activeSanctions, setActiveSanctions] = useState<Sanction[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<EnrichedGuildInvitation[]>([]);
  const [outgoingPendingInvitations, setOutgoingPendingInvitations] = useState<EnrichedGuildInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Roster Management Modal State (Captains only)
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedPlayerProfile[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInvitingPlayerId, setIsInvitingPlayerId] = useState<string | null>(null);
  const [rosterFeedback, setRosterFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isCancellingInviteId, setIsCancellingInviteId] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const supabase = createClient();

  const isCaptain = Boolean(
    guild && (
      userRole === 'captain' || 
      userRole === 'co_captain' || 
      userRole === 'owner' || 
      guild.owner_id === userProfile?.id
    )
  );

  const fetchGuildRoster = useCallback(async (guildId: string) => {
    const { data: membersData } = await supabase
      .from('guild_members')
      .select('*, player:profiles!player_id(*)')
      .eq('guild_id', guildId)
      .eq('is_active', true);

    if (membersData && membersData.length > 0) {
      setRoster(
        (membersData as unknown as MemberWithPlayer[]).map((m) => ({
          id: m.player_id,
          name: m.player?.display_name || m.player?.username || 'Roster Member',
          role: m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1).replace('_', ' ') : 'Player',
          rawRole: m.role || 'player',
          status: 'Active',
          roblox_username: m.player?.roblox_username,
          roblox_id: m.player?.roblox_id,
          avatar_url: m.player?.avatar_url,
        }))
      );
    } else {
      setRoster([]);
    }
  }, [supabase]);

  const fetchOutgoingInvitations = useCallback(async (guildId: string) => {
    const { data: inviteData } = await supabase
      .from('guild_invitations')
      .select('*, player:profiles!player_id(*)')
      .eq('guild_id', guildId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (inviteData) {
      setOutgoingPendingInvitations(inviteData as unknown as EnrichedGuildInvitation[]);
    }
  }, [supabase]);

  const fetchIncomingInvitations = useCallback(async (userId: string) => {
    const { data: inviteData } = await supabase
      .from('guild_invitations')
      .select('*, guild:guilds(*), inviter:profiles!invited_by(*)')
      .eq('player_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (inviteData) {
      setIncomingInvitations(inviteData as unknown as EnrichedGuildInvitation[]);
    }
  }, [supabase]);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Get current season
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      if (seasonData) {
        setSeason(seasonData as Season);
      }

      // 2. Identify target guild strictly for the logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      let targetGuild: Guild | null = null;
      let detectedRole: GuildMemberRole | 'owner' | null = null;

      if (user) {
        // Fetch current user's profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData) {
          setUserProfile(profileData as Profile);
        }

        // Check if user is an active member of any guild
        const { data: memberData } = await supabase
          .from('guild_members')
          .select('*, guild:guilds(*)')
          .eq('player_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (memberData && memberData.guild) {
          targetGuild = memberData.guild as unknown as Guild;
          detectedRole = (memberData.role as GuildMemberRole) || 'player';
        } else {
          // Check if user is a guild owner in guilds table
          const { data: ownedGuild } = await supabase
            .from('guilds')
            .select('*')
            .eq('owner_id', user.id)
            .maybeSingle();

          if (ownedGuild) {
            targetGuild = ownedGuild as Guild;
            detectedRole = 'captain';
          }
        }

        // Fetch Unread Notifications
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        setUnreadNotificationsCount(count || 0);

        // Fetch user's incoming pending invitations
        await fetchIncomingInvitations(user.id);
      }

      // Strictly assign the user's guild
      setGuild(targetGuild);
      setUserRole(detectedRole);

      // Fetch Active Disciplinary Sanctions on player or guild
      if (user) {
        try {
          let sQuery = supabase
            .from('sanctions')
            .select('*')
            .eq('status', 'active');

          if (targetGuild) {
            sQuery = sQuery.or(`player_id.eq.${user.id},guild_id.eq.${targetGuild.id}`);
          } else {
            sQuery = sQuery.eq('player_id', user.id);
          }

          const { data: sData } = await sQuery.order('issued_at', { ascending: false });
          if (sData) {
            setActiveSanctions(sData as Sanction[]);
          }
        } catch (sErr) {
          console.warn('Load active sanctions note:', sErr);
        }
      }

      if (targetGuild) {
        // 3. Fetch Standing for this guild
        const { data: standingData } = await supabase
          .from('standings')
          .select('*')
          .eq('guild_id', targetGuild.id)
          .maybeSingle();

        if (standingData) {
          setStanding(standingData as Standing);
        }

        // 4. Fetch Matches for this guild
        const { data: matchData } = await supabase
          .from('matches')
          .select('*, home_guild:guilds!home_guild_id(*), away_guild:guilds!away_guild_id(*), division:divisions(*)')
          .or(`home_guild_id.eq.${targetGuild.id},away_guild_id.eq.${targetGuild.id}`)
          .order('scheduled_at', { ascending: true });

        if (matchData) {
          const typed = matchData as unknown as MatchWithGuilds[];
          setLiveMatches(typed.filter((m) => m.status === 'live'));
          setUpcomingMatches(typed.filter((m) => m.status === 'scheduled' || m.status === 'check_in'));
          setRecentMatches(
            typed
              .filter((m) => m.status === 'completed')
              .sort((a, b) => new Date(b.completed_at || b.scheduled_at || 0).getTime() - new Date(a.completed_at || a.scheduled_at || 0).getTime())
          );
        }

        // 5. Fetch Roster & Outgoing Invitations
        await fetchGuildRoster(targetGuild.id);
        await fetchOutgoingInvitations(targetGuild.id);
      } else {
        setStanding(null);
        setLiveMatches([]);
        setUpcomingMatches([]);
        setRecentMatches([]);
        setRoster([]);
        setOutgoingPendingInvitations([]);
      }
    } catch (err) {
      console.warn('Dashboard load note:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, fetchGuildRoster, fetchOutgoingInvitations, fetchIncomingInvitations]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Search registered players in database for roster invitation
  const handleSearchPlayers = async (queryText: string) => {
    setPlayerSearchQuery(queryText);
    const clean = queryText.trim().toLowerCase();

    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearchingPlayers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, active_membership:guild_members!player_id(id, guild_id, is_active, guild:guilds(id, name, tag))')
        .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%,roblox_username.ilike.%${clean}%,roblox_id.ilike.%${clean}%`)
        .limit(8);

      if (!error && data) {
        setSearchResults(data as unknown as SearchedPlayerProfile[]);
      }
    } catch (err) {
      console.warn('Player search note:', err);
    } finally {
      setIsSearchingPlayers(false);
    }
  };

  // Send invitation to an unaffiliated registered player
  const handleSendInvitation = async (playerId: string) => {
    if (!guild || !isCaptain) return;
    setRosterFeedback(null);
    setIsInvitingPlayerId(playerId);

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: guild.id,
          playerId,
          message: inviteMessage.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setRosterFeedback({ type: 'error', message: result.error || 'Failed to send invitation.' });
      } else {
        setRosterFeedback({ 
          type: 'success', 
          message: 'Official invitation sent! The player has been notified and must accept to join your active roster.' 
        });
        setInviteMessage('');
        await fetchOutgoingInvitations(guild.id);
        if (playerSearchQuery) {
          handleSearchPlayers(playerSearchQuery);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending invitation.';
      setRosterFeedback({ type: 'error', message: msg });
    } finally {
      setIsInvitingPlayerId(null);
    }
  };

  // Cancel outgoing pending invitation
  const handleCancelInvitation = async (invitationId: string) => {
    if (!guild || !isCaptain) return;
    setRosterFeedback(null);
    setIsCancellingInviteId(invitationId);

    try {
      const res = await fetch(`/api/invitations?id=${invitationId}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (!res.ok) {
        setRosterFeedback({ type: 'error', message: result.error || 'Failed to cancel invitation.' });
      } else {
        setRosterFeedback({ type: 'success', message: 'Invitation cancelled successfully.' });
        await fetchOutgoingInvitations(guild.id);
        if (playerSearchQuery) {
          handleSearchPlayers(playerSearchQuery);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cancelling invitation.';
      setRosterFeedback({ type: 'error', message: msg });
    } finally {
      setIsCancellingInviteId(null);
    }
  };

  // Remove player from roster - preserves complete historical record
  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    if (!guild || !isCaptain) return;
    const reason = window.prompt(`Enter reason for removing ${playerName} from the roster (e.g. Inactive, Transfer, Disciplinary):`);
    if (reason === null) return; // User cancelled prompt

    try {
      setIsProcessingAction(true);
      const nowIso = new Date().toISOString();
      const seasonName = season?.name || 'Current Season';

      // 1. Mark membership inactive and preserve historical telemetry
      const { error: memberErr } = await supabase
        .from('guild_members')
        .update({
          is_active: false,
          status: 'inactive',
          left_at: nowIso,
          left_season: seasonName,
          removed_by: userProfile?.id,
          removal_reason: reason.trim() || 'Removed by captain',
        })
        .eq('guild_id', guild.id)
        .eq('player_id', playerId)
        .eq('is_active', true);

      if (memberErr) throw memberErr;

      // 2. Set player's guild status back to unaffiliated
      await supabase
        .from('profiles')
        .update({
          guild_status: 'unaffiliated',
          guild_id: null,
          updated_at: nowIso,
        })
        .eq('id', playerId);

      // 3. Record in audit_logs
      await supabase.from('audit_logs').insert({
        action: 'guild_member_removed',
        table_name: 'guild_members',
        user_id: userProfile?.id,
        new_values: {
          guild_id: guild.id,
          player_id: playerId,
          reason: reason.trim() || 'Removed by captain',
          left_at: nowIso,
          season: seasonName,
        },
      });

      await fetchGuildRoster(guild.id);
      setRosterFeedback({ type: 'success', message: `${playerName} removed from active roster and safely archived in guild history.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove player.';
      setRosterFeedback({ type: 'error', message: msg });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Respond to incoming invitation (for players)
  const handleRespondToIncomingInvite = async (invitationId: string, action: 'accept' | 'decline') => {
    try {
      setIsProcessingAction(true);
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || 'Failed to process invitation.');
      } else {
        alert(action === 'accept' ? 'Congratulations! You joined the guild roster.' : 'Invitation declined.');
        await loadDashboard();
      }
    } catch (err) {
      console.warn('Respond invitation note:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const currentRank = standing?.rank ?? 1;
  const wins = standing?.wins ?? 0;
  const draws = standing?.draws ?? 0;
  const losses = standing?.losses ?? 0;
  const points = standing?.points ?? 0;
  const mapsWon = standing?.maps_won ?? 0;
  const mapsLost = standing?.maps_lost ?? 0;
  const formChars = standing?.form ? standing.form.split(',').filter(Boolean) : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // ==========================================================================
  // VIEW A: USER DOES NOT OWN OR BELONG TO ANY GUILD (FREE AGENT DASHBOARD)
  // ==========================================================================
  if (!guild) {
    return (
      <div className="min-h-screen bg-zinc-950">
        {/* Dashboard Header for Free Agent */}
        <div className="border-b border-zinc-800 bg-zinc-900/50">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-xl font-bold text-amber-400 border border-zinc-700 shadow-inner">
                  {userProfile?.display_name ? userProfile.display_name.charAt(0).toUpperCase() : userProfile?.username ? userProfile.username.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {userProfile?.display_name || userProfile?.username || 'Player Dashboard'}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 bg-amber-500/5">
                      Free Agent
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Unaffiliated Competitor
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/invitations">
                  <Button variant="outline" size="sm" className="relative gap-2 border-zinc-700 text-xs">
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    <span>Guild Invitations</span>
                    {incomingInvitations.length > 0 && (
                      <span className="w-5 h-5 bg-blue-600 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                        {incomingInvitations.length}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link href="/dashboard/settings">
                  <Button variant="ghost" size="icon" title="Settings"><Settings className="h-4 w-4" /></Button>
                </Link>
                <Link href="/dashboard/notifications">
                  <Button variant="ghost" size="icon" className="relative" title="Notifications">
                    <Bell className="h-4 w-4" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
          {/* Active Disciplinary Sanctions Banner */}
          {activeSanctions.length > 0 && (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/25 p-5 space-y-3.5 shadow-lg shadow-red-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 shrink-0 border border-red-500/30">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      Active Disciplinary Sanction Notice
                      <Badge variant="destructive" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {activeSanctions.length} Active
                      </Badge>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      The League Disciplinary Committee has issued official sanction(s) affecting your account or roster.
                    </p>
                  </div>
                </div>
                <Link href="/dashboard/notifications" className="text-xs text-red-400 hover:text-red-300 font-medium inline-flex items-center gap-1 shrink-0 self-end sm:self-center">
                  Notification Center <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeSanctions.map((s) => (
                  <div key={s.id} className="p-3.5 rounded-xl border border-red-500/30 bg-zinc-950/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-red-400">
                        <span>{s.sanction_code}</span>
                        <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400 uppercase">
                          {s.sanction_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <Badge className="text-[9px] bg-red-600/80 text-white capitalize">
                        {s.severity}
                      </Badge>
                    </div>

                    <p className="text-xs text-zinc-200 font-medium line-clamp-2">
                      &ldquo;{s.violation}&rdquo;
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                      <span>{s.rule_number ? `${s.rule_number}: ${s.rule_title}` : 'Official Rulebook'}</span>
                      <Link href={`/discipline/${s.sanction_code}`}>
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] text-blue-400 hover:text-white p-0 gap-1">
                          View & Appeal <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incoming Pending Invitations Banner */}
          {incomingInvitations.length > 0 && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-base">You Have {incomingInvitations.length} Pending Guild Invitation{incomingInvitations.length > 1 ? 's' : ''}!</h3>
                </div>
                <Link href="/dashboard/invitations" className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingInvitations.map((invite) => (
                  <div key={invite.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/90 flex flex-col justify-between gap-3 shadow-md">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
                          {invite.guild?.tag || 'GD'}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{invite.guild?.name}</h4>
                          <p className="text-xs text-zinc-400">Invited by {invite.inviter?.display_name || invite.inviter?.username || 'Captain'}</p>
                        </div>
                      </div>
                      {invite.message && (
                        <p className="text-xs text-zinc-300 italic mt-2.5 p-2 rounded bg-zinc-950/60 border border-zinc-800">
                          &ldquo;{invite.message}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <Button
                        size="sm"
                        disabled={isProcessingAction}
                        onClick={() => handleRespondToIncomingInvite(invite.id, 'accept')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessingAction}
                        onClick={() => handleRespondToIncomingInvite(invite.id, 'decline')}
                        className="flex-1 border-zinc-700 text-zinc-300 text-xs h-8 gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Free Agent Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 sm:p-12 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <h2 className="text-2xl font-bold text-white">Competitive Competitor Status: Free Agent</h2>
              <p className="text-sm text-zinc-400">
                You are registered in the CAA League players directory. To participate in tournament fixtures, you can either accept a team invitation from a guild captain or register your own guild as a founder.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link href="/guilds/register">
                <Button className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold gap-2 shadow-md">
                  <Plus className="w-4 h-4" />
                  Register New Guild
                </Button>
              </Link>
              <Link href="/guilds">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white gap-2">
                  <Users className="w-4 h-4" />
                  Browse Active Guilds
                </Button>
              </Link>
              <Link href="/players">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white gap-2">
                  <Globe className="w-4 h-4" />
                  Players Directory
                </Button>
              </Link>
            </div>
          </div>

          {/* Player Identity Summary & Next Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Your Registered Competitor Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Roblox Handle</span>
                  <span className="font-medium text-zinc-200 truncate block">{userProfile?.roblox_username || 'Not linked'}</span>
                  {userProfile?.roblox_id && (
                    <span className="text-[10px] text-zinc-500 font-mono">ID: {userProfile.roblox_id}</span>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Discord</span>
                  <span className="font-medium text-zinc-200 truncate block">{userProfile?.discord_username || 'Not linked'}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Region & Timezone</span>
                  <span className="font-medium text-zinc-200 truncate block">{userProfile?.region || 'Global'}</span>
                  <span className="text-[10px] text-zinc-500 truncate block">{userProfile?.timezone || 'UTC'}</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Player Biography</span>
                <p className="text-xs text-zinc-400 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/80 italic">
                  {userProfile?.bio || 'No bio provided. Update your competitor profile in Settings.'}
                </p>
              </div>
              <div className="pt-2">
                <Link href="/dashboard/settings">
                  <Button variant="outline" size="sm" className="gap-2 text-xs border-zinc-800 text-zinc-300 hover:text-white">
                    <Settings className="w-3.5 h-3.5" />
                    Edit Profile Settings
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
              <h3 className="font-semibold text-white">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/dashboard/invitations" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs border-zinc-800 text-zinc-300 hover:text-white" size="sm">
                    <Mail className="h-4 w-4 text-blue-400" />
                    Guild Invitations ({incomingInvitations.length})
                  </Button>
                </Link>
                <Link href="/guilds/register" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs border-zinc-800 text-zinc-300 hover:text-white" size="sm">
                    <Plus className="h-4 w-4 text-amber-400" />
                    Register Your Guild
                  </Button>
                </Link>
                <Link href="/guilds" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs border-zinc-800 text-zinc-300 hover:text-white" size="sm">
                    <Users className="h-4 w-4 text-blue-400" />
                    Explore Active Guilds
                  </Button>
                </Link>
                <Link href="/rules" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs border-zinc-800 text-zinc-300 hover:text-white" size="sm">
                    <Shield className="h-4 w-4 text-zinc-400" />
                    League Rules & Format
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW B: USER IS IN A REGISTERED GUILD (CAPTAIN OR REGULAR MEMBER)
  // ==========================================================================
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Dashboard Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-600/20">
                {guild.tag}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{guild.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {guild.tag}
                  </Badge>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {guild.status}
                  </Badge>
                  {isCaptain ? (
                    <Badge variant="default" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">
                      Team Captain
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
                      Roster Member
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/invitations">
                <Button variant="outline" size="sm" className="relative gap-2 border-zinc-700 text-xs">
                  <Mail className="h-3.5 w-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Invitations</span>
                  {incomingInvitations.length > 0 && (
                    <span className="w-5 h-5 bg-blue-600 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                      {incomingInvitations.length}
                    </span>
                  )}
                </Button>
              </Link>
              {isCaptain && (
                <Link href="/dashboard/settings">
                  <Button variant="ghost" size="icon" title="Guild Settings"><Settings className="h-4 w-4" /></Button>
                </Link>
              )}
              <Link href="/dashboard/notifications">
                <Button variant="ghost" size="icon" className="relative" title="Notifications">
                  <Bell className="h-4 w-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            title="Rank"
            value={`#${currentRank}`}
            subtitle="Current Position"
            icon={<Trophy className="h-4 w-4 text-amber-400" />}
          />
          <StatCard
            title="Points"
            value={String(points)}
            subtitle="Season Total"
            icon={<Shield className="h-4 w-4 text-blue-400" />}
          />
          <StatCard
            title="Record"
            value={`${wins}-${draws}-${losses}`}
            subtitle="W - D - L"
            icon={<Swords className="h-4 w-4 text-green-400" />}
          />
          <StatCard
            title="Maps"
            value={`${mapsWon} - ${mapsLost}`}
            subtitle="Won - Lost"
            icon={<Swords className="h-4 w-4 text-purple-400" />}
          />
          <StatCard
            title="Roster"
            value={`${roster.length}/6`}
            subtitle="Active Players"
            icon={<Users className="h-4 w-4 text-yellow-400" />}
          />
          <StatCard
            title="Live Matches"
            value={String(liveMatches.length)}
            subtitle="In Progress"
            icon={<Calendar className="h-4 w-4 text-red-400" />}
          />
        </div>

        {/* Live Matches Banner */}
        {liveMatches.length > 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h2 className="text-lg font-bold text-white">Live Matches Now</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming Matches */}
            <div>
              <SectionHeader
                title="Upcoming Matches"
                description="Next scheduled fixtures for your guild"
              />
              <div className="mt-4 space-y-3">
                {upcomingMatches.length > 0 ? (
                  upcomingMatches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center text-zinc-400">
                    No upcoming matches scheduled.
                  </div>
                )}
              </div>
            </div>

            {/* Recent Match Results */}
            <div>
              <SectionHeader
                title="Recent Results"
                description="Latest completed tournament matches"
              />
              <div className="mt-4 space-y-3">
                {recentMatches.length > 0 ? (
                  recentMatches.slice(0, 3).map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center text-zinc-400">
                    No recent match results.
                  </div>
                )}
              </div>
            </div>

            {/* Official Active Roster */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Team Roster ({roster.length}/6)</h3>
                  <p className="text-xs text-zinc-400">Active roster members registered for tournament competition</p>
                </div>
                {isCaptain ? (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-sm"
                    onClick={() => {
                      setRosterFeedback(null);
                      setPlayerSearchQuery('');
                      setSearchResults([]);
                      setIsRosterModalOpen(true);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Manage Roster & Invitations
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-800">
                    Captains Only: Roster Management
                  </Badge>
                )}
              </div>

              {/* Roster Table */}
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Roblox Handle</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      {isCaptain && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {roster.map((member, index) => (
                      <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-white flex items-center gap-3">
                          <span className="text-xs text-zinc-500 font-mono w-4">#{index + 1}</span>
                          <Link href={`/players/${member.id}`} className="hover:text-blue-400 transition-colors flex items-center gap-2">
                            <span>{member.name}</span>
                            <ExternalLink className="w-3 h-3 text-zinc-500" />
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-400 text-xs">
                          {member.roblox_username ? (
                            <span className="flex items-center gap-1">
                              <Gamepad2 className="w-3 h-3 text-zinc-500" />
                              {member.roblox_username}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={member.rawRole.includes('captain') ? 'default' : 'outline'} className="text-xs capitalize">
                            {member.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                            Active
                          </Badge>
                        </td>
                        {isCaptain && (
                          <td className="px-4 py-3.5 text-right">
                            {member.id !== userProfile?.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-7 px-2 text-xs"
                                onClick={() => handleRemovePlayer(member.id, member.name)}
                                title="Remove player from roster"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Remove
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={isCaptain ? 5 : 4} className="py-8 text-center text-zinc-500 text-sm">
                          <p className="font-medium text-zinc-400">No active roster members registered.</p>
                          {isCaptain ? (
                            <p className="text-xs text-zinc-500 mt-1">Click &ldquo;Manage Roster & Invitations&rdquo; above to invite registered players.</p>
                          ) : (
                            <p className="text-xs text-zinc-500 mt-1">Your team captain has not registered roster members yet.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
              <h3 className="font-semibold text-white">Guild Quick Actions</h3>
              <div className="space-y-2">
                {isCaptain ? (
                  <Link href="/dashboard/check-in" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2 text-xs" size="sm">
                      <ClipboardCheck className="h-4 w-4 text-green-400" />
                      Match Check-In
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled className="w-full justify-start gap-2 opacity-50 cursor-not-allowed text-zinc-500 text-xs" size="sm" title="Only captains can perform match check-in">
                    <ClipboardCheck className="h-4 w-4 text-zinc-600" />
                    Match Check-In (Captains Only)
                  </Button>
                )}

                <Link href="/dashboard/protest" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs" size="sm">
                    <MessageSquare className="h-4 w-4" />
                    Submit Match Protest
                  </Button>
                </Link>

                <Link href={`/guilds/${guild.id}`} className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs" size="sm">
                    <Shield className="h-4 w-4" />
                    View Public Guild Profile
                  </Button>
                </Link>

                <Link href="/players" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 text-xs" size="sm">
                    <Users className="h-4 w-4 text-blue-400" />
                    Search Free Agents & Players
                  </Button>
                </Link>
              </div>
            </div>

            {/* Current Standing Position */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
              <h3 className="font-semibold text-white mb-2 text-sm">League Position</h3>
              <p className="text-4xl font-black text-amber-400">{standing ? `#${currentRank}` : '—'}</p>
              <p className="text-sm text-zinc-300 mt-1 font-medium">{guild.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{season ? season.name : 'Current Season'}</p>
              {formChars.length > 0 && (
                <div className="flex justify-center gap-1.5 mt-3 pt-3 border-t border-zinc-800">
                  {formChars.map((r, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold',
                        r.trim() === 'W' ? 'bg-green-600 text-white' : r.trim() === 'L' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-white'
                      )}
                    >
                      {r.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Season Info */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
              <h3 className="font-semibold text-white text-sm">Season Status</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800">
                  <span className="text-zinc-400">Current Season</span>
                  <span className="text-white font-medium">{season ? season.name : 'Season 2'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800">
                  <span className="text-zinc-400">Stage</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {season ? season.status.replace('_', ' ') : 'Active'}
                  </Badge>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Roster Limit</span>
                  <span className="text-white font-medium">Max 6 Players</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CAPTAIN ROSTER SEARCH & INVITATION MODAL */}
      {/* ===================================================================== */}
      {isCaptain && (
        <Dialog open={isRosterModalOpen} onOpenChange={setIsRosterModalOpen}>
          <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Users className="h-5 w-5 text-blue-400" />
                Manage Roster & Player Invitations — {guild.name} ({roster.length}/6)
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Search registered competitors in the CAA database to invite them to your active roster. Players must accept your invitation before joining.
              </DialogDescription>
            </DialogHeader>

            {rosterFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  rosterFeedback.type === 'error'
                    ? 'bg-red-950/60 border border-red-800 text-red-300'
                    : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                }`}
              >
                {rosterFeedback.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{rosterFeedback.message}</span>
              </div>
            )}

            {/* Current Active Roster Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Current Active Roster ({roster.length}/6)
              </h4>
              <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
                {roster.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 font-mono w-4">#{index + 1}</span>
                      <div>
                        <p className="font-semibold text-white">{member.name}</p>
                        <p className="text-[11px] text-zinc-400">
                          Roblox: {member.roblox_username || '—'} {member.roblox_id ? `(ID: ${member.roblox_id})` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.rawRole.includes('captain') ? 'default' : 'outline'} className="text-[10px]">
                        {member.role}
                      </Badge>
                      {member.id !== userProfile?.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-7 text-xs px-2"
                          onClick={() => handleRemovePlayer(member.id, member.name)}
                          title="Remove player from active roster"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sent Pending Invitations Section with Cancel Button */}
            {outgoingPendingInvitations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Sent Pending Invitations ({outgoingPendingInvitations.length})
                  </h4>
                  <span className="text-[11px] text-zinc-500">Awaiting player acceptance</span>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 overflow-hidden divide-y divide-zinc-800/60">
                  {outgoingPendingInvitations.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white overflow-hidden shrink-0 border border-zinc-700">
                          {invite.player?.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={invite.player.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            invite.player?.username?.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{invite.player?.display_name || invite.player?.username}</span>
                            <span className="text-zinc-500 font-mono text-[11px]">@{invite.player?.username}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            Sent {new Date(invite.created_at).toLocaleDateString()}
                            {invite.expires_at && ` • Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                          Pending
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isCancellingInviteId === invite.id}
                          onClick={() => handleCancelInvitation(invite.id)}
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2"
                        >
                          {isCancellingInviteId === invite.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <X className="w-3 h-3 mr-1" />
                          )}
                          Cancel Invitation
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLAYER SEARCH & INVITATION SECTION */}
            <div className="space-y-4 pt-3 border-t border-zinc-800">
              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="h-4 w-4 text-blue-400" />
                  Search & Invite Registered Competitors
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Search by Website Username, Display Name, Roblox Username, or Roblox User ID.
                </p>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  value={playerSearchQuery}
                  onChange={(e) => handleSearchPlayers(e.target.value)}
                  placeholder="e.g. shadow_player, 182746284, Viper..."
                  className="pl-9 bg-zinc-900 border-zinc-700 text-xs h-10"
                />
                {isSearchingPlayers && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 animate-spin" />
                )}
              </div>

              {/* Optional Custom Invitation Message */}
              <div className="space-y-1">
                <Label htmlFor="inviteMessage" className="text-[11px] text-zinc-400">
                  Custom Invitation Message (Optional)
                </Label>
                <Input
                  id="inviteMessage"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="e.g. We'd like you to join as our Starting DPS for Season 2!"
                  className="bg-zinc-900 border-zinc-700 text-xs h-9"
                  maxLength={150}
                />
              </div>

              {/* Search Results Display */}
              {playerSearchQuery.trim().length >= 2 && (
                <div className="space-y-2">
                  <span className="text-[11px] text-zinc-400 font-medium">Search Results ({searchResults.length})</span>
                  <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/80 bg-zinc-900/40 max-h-72 overflow-y-auto">
                    {searchResults.map((player) => {
                      // Check if already on current guild roster
                      const isOnThisRoster = roster.some(r => r.id === player.id);
                      
                      // Check active membership
                      const activeMembership = player.active_membership?.find(m => m.is_active);
                      const isMemberOfOtherGuild = activeMembership && activeMembership.guild_id !== guild.id;
                      const otherGuildName = activeMembership?.guild?.name || 'another guild';

                      // Check pending invitation from this guild
                      const hasPendingInvite = outgoingPendingInvitations.some(i => i.player_id === player.id);

                      // Ineligible states
                      const isSuspended = player.account_status === 'suspended';
                      const isRetired = player.account_status === 'retired';
                      const isRosterFull = roster.length >= 6;
                      const isInviting = isInvitingPlayerId === player.id;

                      return (
                        <div key={player.id} className="p-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-zinc-900/80 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden border border-zinc-700">
                              {player.avatar_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                player.username.substring(0, 2).toUpperCase()
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-white text-xs">{player.display_name || player.username}</span>
                                <span className="text-zinc-500 font-mono text-[11px]">@{player.username}</span>
                                {getAccountStatusBadge(player.account_status)}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                                <span className="flex items-center gap-1">
                                  <Gamepad2 className="w-3 h-3 text-zinc-500" />
                                  Roblox: <strong className="text-zinc-300">{player.roblox_username || '—'}</strong>
                                  {player.roblox_id && <span className="font-mono text-zinc-500">({player.roblox_id})</span>}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-cyan-500/70" />
                                  {player.region || 'Global'}
                                </span>
                              </div>

                              {/* Affiliation status */}
                              {isMemberOfOtherGuild ? (
                                <p className="text-[11px] text-amber-400 font-medium">
                                  Player is currently registered to {otherGuildName}.
                                </p>
                              ) : isOnThisRoster ? (
                                <p className="text-[11px] text-emerald-400 font-medium">
                                  Already an active member of your roster.
                                </p>
                              ) : hasPendingInvite ? (
                                <p className="text-[11px] text-amber-400 font-medium">
                                  Invitation Pending from your guild.
                                </p>
                              ) : (
                                <p className="text-[11px] text-zinc-500">
                                  Unaffiliated Free Agent • Ready to invite
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0 flex items-center justify-end">
                            {isOnThisRoster ? (
                              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                On Roster
                              </Badge>
                            ) : hasPendingInvite ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isCancellingInviteId === player.id}
                                onClick={() => {
                                  const inv = outgoingPendingInvitations.find(i => i.player_id === player.id);
                                  if (inv) handleCancelInvitation(inv.id);
                                }}
                                className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-950/30 h-8"
                              >
                                Invitation Pending (Cancel)
                              </Button>
                            ) : isMemberOfOtherGuild ? (
                              <Badge variant="outline" className="text-[11px] text-zinc-500 border-zinc-800 bg-zinc-950">
                                In Another Guild
                              </Badge>
                            ) : isSuspended ? (
                              <Badge variant="outline" className="text-[11px] text-red-400 border-red-500/30 bg-red-950/20" title="Player suspended by league officials">
                                Suspended (Ineligible)
                              </Badge>
                            ) : isRetired ? (
                              <Badge variant="outline" className="text-[11px] text-purple-400 border-purple-500/30 bg-purple-950/20">
                                Retired Player
                              </Badge>
                            ) : isRosterFull ? (
                              <Badge variant="outline" className="text-[11px] text-zinc-500 border-zinc-800" title="Roster has reached max 6 players">
                                Roster Full (6/6)
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                disabled={isInviting}
                                onClick={() => handleSendInvitation(player.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-8 gap-1.5 px-3 rounded-lg"
                              >
                                {isInviting ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                <span>Invite to Guild</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {searchResults.length === 0 && !isSearchingPlayers && (
                      <div className="p-6 text-center text-xs text-zinc-500">
                        No registered player profiles matched &ldquo;{playerSearchQuery}&rdquo;.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-zinc-800/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRosterModalOpen(false)}
                className="text-xs border-zinc-700"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
