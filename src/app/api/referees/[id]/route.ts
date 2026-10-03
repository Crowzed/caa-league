import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: referee, error: refError } = await supabase
      .from('referees')
      .select('*, profile:profiles!user_id(*)')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    if (refError || !referee) {
      return NextResponse.json({ error: 'Referee not found' }, { status: 404 });
    }

    // Load availability
    const { data: availability } = await supabase
      .from('referee_availability')
      .select('*')
      .eq('referee_id', id)
      .maybeSingle();

    // Load recent assignments
    const { data: assignments } = await supabase
      .from('referee_assignments')
      .select(`
        *,
        match:matches(
          id, scheduled_at, status, format, home_score, away_score,
          home_guild:guilds!home_guild_id(name, tag, logo_url),
          away_guild:guilds!away_guild_id(name, tag, logo_url),
          division:divisions(name)
        )
      `)
      .eq('referee_id', id)
      .order('assigned_at', { ascending: false })
      .limit(10);

    // Load declared conflicts
    const { data: conflicts } = await supabase
      .from('referee_conflicts')
      .select('*, guild:guilds(name, tag)')
      .eq('referee_id', id);

    // Load recent decisions made
    const { data: decisions } = await supabase
      .from('match_decisions')
      .select('*, match:matches(id, round)')
      .eq('referee_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      referee,
      availability,
      assignments: assignments || [],
      conflicts: conflicts || [],
      decisions: decisions || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching referee details';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      rank, status, internal_notes, seasons_active,
      display_name, website_username, roblox_username, discord_username,
      region, timezone 
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (rank !== undefined) updates.rank = rank;
    if (status !== undefined) updates.status = status;
    if (internal_notes !== undefined) updates.internal_notes = internal_notes;
    if (seasons_active !== undefined) updates.seasons_active = seasons_active;
    if (display_name !== undefined) updates.display_name = display_name;
    if (website_username !== undefined) updates.website_username = website_username;
    if (roblox_username !== undefined) updates.roblox_username = roblox_username;
    if (discord_username !== undefined) updates.discord_username = discord_username;
    if (region !== undefined) updates.region = region;
    if (timezone !== undefined) updates.timezone = timezone;

    const { data: updatedRef, error: updateError } = await supabase
      .from('referees')
      .update(updates)
      .eq('id', id)
      .select('*, profile:profiles!user_id(*)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Synchronize to profiles table if referee has a linked user_id
    if (updatedRef.user_id) {
      const profileUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (display_name !== undefined) profileUpdates.display_name = display_name;
      if (website_username !== undefined) profileUpdates.username = website_username;
      if (roblox_username !== undefined) profileUpdates.roblox_username = roblox_username;
      if (discord_username !== undefined) profileUpdates.discord_username = discord_username;
      if (region !== undefined) profileUpdates.region = region;
      if (timezone !== undefined) profileUpdates.timezone = timezone;

      if (Object.keys(profileUpdates).length > 1) {
        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', updatedRef.user_id);
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'REFEREE_UPDATED',
      entity_type: 'referee',
      entity_id: id,
      actor_id: user.id,
      details: updates,
    });

    return NextResponse.json({ referee: updatedRef });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update referee';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
