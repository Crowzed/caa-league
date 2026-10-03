import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/invitations - Guild Captain invites a player
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { guildId, playerId, message } = body;

    if (!guildId || !playerId) {
      return NextResponse.json({ error: 'guildId and playerId are required.' }, { status: 400 });
    }

    // 1. Verify caller has captain permissions for this guild
    const { data: guild, error: guildErr } = await supabase
      .from('guilds')
      .select('*')
      .eq('id', guildId)
      .maybeSingle();

    if (guildErr || !guild) {
      return NextResponse.json({ error: 'Guild not found.' }, { status: 404 });
    }

    const isOwner = guild.owner_id === user.id;
    let isCaptainRole = false;

    if (!isOwner) {
      const { data: member } = await supabase
        .from('guild_members')
        .select('*')
        .eq('guild_id', guildId)
        .eq('player_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (member && (member.role === 'captain' || member.role === 'co_captain')) {
        isCaptainRole = true;
      }
    }

    if (!isOwner && !isCaptainRole) {
      return NextResponse.json({ error: 'Only guild captains can invite players.' }, { status: 403 });
    }

    // 2. Check guild roster capacity (max 6 players)
    const { count: activeMemberCount } = await supabase
      .from('guild_members')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId)
      .eq('is_active', true);

    if (activeMemberCount !== null && activeMemberCount >= 6) {
      return NextResponse.json({ error: 'Roster is full! Maximum 6 players allowed per guild.' }, { status: 400 });
    }

    // 3. Verify target player exists and is eligible
    const { data: targetPlayer, error: playerErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', playerId)
      .maybeSingle();

    if (playerErr || !targetPlayer) {
      return NextResponse.json({ error: 'Player profile not found.' }, { status: 404 });
    }

    if (targetPlayer.account_status === 'suspended') {
      return NextResponse.json({ error: 'This player is currently suspended and ineligible for invitations.' }, { status: 400 });
    }

    if (targetPlayer.account_status === 'retired') {
      return NextResponse.json({ error: 'This player is retired.' }, { status: 400 });
    }

    // 4. Verify player is not already an active member of ANY guild
    const { data: existingActiveMembership } = await supabase
      .from('guild_members')
      .select('*, guild:guilds(name, tag)')
      .eq('player_id', playerId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingActiveMembership) {
      const gName = (existingActiveMembership.guild as { name?: string })?.name || 'another guild';
      return NextResponse.json({ 
        error: `Player is currently registered to ${gName}. Players must leave their current guild before being invited.` 
      }, { status: 400 });
    }

    // 5. Verify no pending invitation already exists from this guild
    const { data: existingPendingInvite } = await supabase
      .from('guild_invitations')
      .select('*')
      .eq('guild_id', guildId)
      .eq('player_id', playerId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingPendingInvite) {
      return NextResponse.json({ error: 'An invitation is already pending for this player.' }, { status: 400 });
    }

    // 6. Create Guild Invitation record (valid for 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: newInvite, error: inviteErr } = await supabase
      .from('guild_invitations')
      .insert({
        guild_id: guildId,
        player_id: playerId,
        invited_by: user.id,
        status: 'pending',
        message: message?.trim() || null,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteErr) {
      return NextResponse.json({ error: 'Failed to create invitation: ' + inviteErr.message }, { status: 500 });
    }

    // 7. Update player's guild_status to 'pending_invitation' if currently unaffiliated
    if (!targetPlayer.guild_status || targetPlayer.guild_status === 'unaffiliated') {
      await supabase
        .from('profiles')
        .update({ guild_status: 'pending_invitation' })
        .eq('id', playerId);
    }

    // 8. Send notification to the invited player
    await supabase.from('notifications').insert({
      user_id: playerId,
      type: 'guild_invitation',
      title: 'New Guild Invitation',
      message: `${guild.name} [${guild.tag}] has invited you to join their official team roster.`,
      link: '/dashboard/invitations',
      is_read: false,
      created_at: new Date().toISOString(),
    });

    // 9. Record in audit_logs
    await supabase.from('audit_logs').insert({
      action: 'guild_invitation_sent',
      table_name: 'guild_invitations',
      record_id: newInvite.id,
      user_id: user.id,
      new_values: {
        guild_id: guildId,
        player_id: playerId,
        expires_at: expiresAt.toISOString(),
      },
    });

    return NextResponse.json({ success: true, invitation: newInvite });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/invitations - Captain cancels a pending invitation
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
    }

    // Fetch invitation
    const { data: invite, error: fetchErr } = await supabase
      .from('guild_invitations')
      .select('*, guild:guilds(*)')
      .eq('id', invitationId)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: `Cannot cancel invitation with status: ${invite.status}.` }, { status: 400 });
    }

    // Verify caller is inviter or guild owner
    const isInviter = invite.invited_by === user.id;
    const isOwner = (invite.guild as { owner_id?: string })?.owner_id === user.id;

    if (!isInviter && !isOwner) {
      return NextResponse.json({ error: 'Permission denied: Only the captain who sent this invite can cancel it.' }, { status: 403 });
    }

    // Update status to 'cancelled'
    const { error: updateErr } = await supabase
      .from('guild_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to cancel invitation.' }, { status: 500 });
    }

    // Reset player guild_status if they have no other pending invitations
    const { count: remainingPending } = await supabase
      .from('guild_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', invite.player_id)
      .eq('status', 'pending')
      .neq('id', invitationId);

    if (!remainingPending || remainingPending === 0) {
      await supabase
        .from('profiles')
        .update({ guild_status: 'unaffiliated' })
        .eq('id', invite.player_id);
    }

    return NextResponse.json({ success: true, message: 'Invitation cancelled.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
