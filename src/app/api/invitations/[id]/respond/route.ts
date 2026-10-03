import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const invitationId = resolvedParams.id;
    const body = await request.json();
    const { action } = body; // 'accept' | 'decline'

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'Invalid action. Must be accept or decline.' }, { status: 400 });
    }

    // 1. Fetch invitation with joined guild
    const { data: invite, error: fetchErr } = await supabase
      .from('guild_invitations')
      .select('*, guild:guilds(*)')
      .eq('id', invitationId)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    // 2. Verify caller is the invited player
    if (invite.player_id !== user.id) {
      return NextResponse.json({ error: 'You are not the recipient of this invitation.' }, { status: 403 });
    }

    // 3. Verify invitation is still pending and not expired
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: `This invitation is no longer active (status: ${invite.status}).` }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('guild_invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);

      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 400 });
    }

    const guild = invite.guild as { id: string; name: string; tag: string; owner_id: string } | null;
    if (!guild) {
      return NextResponse.json({ error: 'Associated guild was not found.' }, { status: 404 });
    }

    // Fetch player profile
    const { data: playerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const playerName = playerProfile?.display_name || playerProfile?.username || 'Player';

    // =========================================================================
    // CASE A: ACCEPT INVITATION (Strict Server-Side Validation)
    // =========================================================================
    if (action === 'accept') {
      // Validation 1: Verify player is not currently an active member of ANY guild
      const { data: activeMembership } = await supabase
        .from('guild_members')
        .select('*, guild:guilds(name, tag)')
        .eq('player_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (activeMembership) {
        const curGuildName = (activeMembership.guild as { name?: string })?.name || 'another guild';
        return NextResponse.json({
          error: `You are already an active member of ${curGuildName}. You must leave your current guild before accepting a new invitation.`
        }, { status: 400 });
      }

      // Validation 2: Verify player eligibility
      if (playerProfile?.account_status === 'suspended') {
        return NextResponse.json({ error: 'Your account is suspended and ineligible for guild roster registration.' }, { status: 403 });
      }

      // Validation 3: Verify the guild still has an available roster slot (max 6)
      const { count: activeCount } = await supabase
        .from('guild_members')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guild.id)
        .eq('is_active', true);

      if (activeCount !== null && activeCount >= 6) {
        return NextResponse.json({
          error: `Roster limit reached: ${guild.name} currently has 6 active players. Please contact the captain.`
        }, { status: 400 });
      }

      // Get current season name
      const { data: currentSeason } = await supabase
        .from('seasons')
        .select('name')
        .eq('is_current', true)
        .maybeSingle();

      const seasonName = currentSeason?.name || 'Current Season';

      // Validation PASSED -> Execute Membership Creation
      const nowIso = new Date().toISOString();

      // 1. Update invitation status to 'accepted'
      const { error: inviteUpdateErr } = await supabase
        .from('guild_invitations')
        .update({
          status: 'accepted',
          responded_at: nowIso,
        })
        .eq('id', invitationId);

      if (inviteUpdateErr) {
        return NextResponse.json({ error: 'Failed to update invitation status: ' + inviteUpdateErr.message }, { status: 500 });
      }

      // 2. Create guild_members record
      const { data: newMember, error: memberErr } = await supabase
        .from('guild_members')
        .insert({
          guild_id: guild.id,
          player_id: user.id,
          role: 'player',
          status: 'active',
          is_active: true,
          joined_at: nowIso,
          joined_season: seasonName,
          added_by: invite.invited_by,
        })
        .select()
        .single();

      if (memberErr) {
        return NextResponse.json({ error: 'Failed to join guild roster: ' + memberErr.message }, { status: 500 });
      }

      // 3. Update player's guild status and guild_id in profiles
      await supabase
        .from('profiles')
        .update({
          guild_status: 'active_member',
          guild_id: guild.id,
          updated_at: nowIso,
        })
        .eq('id', user.id);

      // 4. Cancel any other pending invitations for this player (since they joined this guild)
      await supabase
        .from('guild_invitations')
        .update({ status: 'cancelled' })
        .eq('player_id', user.id)
        .eq('status', 'pending')
        .neq('id', invitationId);

      // 5. Notify the guild captain / inviter
      const captainRecipientId = invite.invited_by || guild.owner_id;
      if (captainRecipientId) {
        await supabase.from('notifications').insert({
          user_id: captainRecipientId,
          type: 'guild_invitation',
          title: 'Invitation Accepted!',
          message: `${playerName} has accepted your invitation and joined ${guild.name}'s active roster.`,
          link: '/dashboard',
          is_read: false,
          created_at: nowIso,
        });
      }

      // 6. Record in audit_logs
      await supabase.from('audit_logs').insert({
        action: 'guild_invitation_accepted',
        table_name: 'guild_members',
        record_id: newMember.id,
        user_id: user.id,
        new_values: {
          guild_id: guild.id,
          player_id: user.id,
          invitation_id: invitationId,
          joined_at: nowIso,
          season: seasonName,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'accepted',
        message: `Congratulations! You have officially joined ${guild.name}.`,
        membership: newMember,
      });
    }

    // =========================================================================
    // CASE B: DECLINE INVITATION
    // =========================================================================
    if (action === 'decline') {
      const nowIso = new Date().toISOString();

      // 1. Update invitation status to 'declined'
      await supabase
        .from('guild_invitations')
        .update({
          status: 'declined',
          responded_at: nowIso,
        })
        .eq('id', invitationId);

      // 2. Check if player has other pending invitations
      const { count: remainingInvites } = await supabase
        .from('guild_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', user.id)
        .eq('status', 'pending');

      if (!remainingInvites || remainingInvites === 0) {
        await supabase
          .from('profiles')
          .update({ guild_status: 'unaffiliated' })
          .eq('id', user.id);
      }

      // 3. Notify the guild captain / inviter
      const captainRecipientId = invite.invited_by || guild.owner_id;
      if (captainRecipientId) {
        await supabase.from('notifications').insert({
          user_id: captainRecipientId,
          type: 'guild_invitation',
          title: 'Invitation Declined',
          message: `${playerName} has declined the invitation to join ${guild.name}.`,
          link: '/dashboard',
          is_read: false,
          created_at: nowIso,
        });
      }

      return NextResponse.json({
        success: true,
        action: 'declined',
        message: `You declined the invitation from ${guild.name}.`,
      });
    }

    return NextResponse.json({ error: 'Unhandled request.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
