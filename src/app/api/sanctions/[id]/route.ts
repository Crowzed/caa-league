import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const resolvedParams = await context.params;
    const identifier = resolvedParams.id;

    // Check if UUID or sanction_code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    let query = supabase
      .from('sanctions')
      .select(`
        *,
        player:profiles!player_id(*),
        guild:guilds!guild_id(*),
        match:matches!match_id(*, home_guild:guilds!home_guild_id(name, tag), away_guild:guilds!away_guild_id(name, tag)),
        rule:rules!rule_id(*),
        case:cases!case_id(*),
        events:sanction_events(*),
        appeals:appeals!sanction_id(*, submitter:profiles!submitted_by(username, display_name))
      `);

    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('sanction_code', identifier);
    }

    const { data: sanction, error } = await query.maybeSingle();

    if (error || !sanction) {
      return NextResponse.json({ error: 'Sanction record not found.' }, { status: 404 });
    }

    // Sort timeline events chronologically
    if (sanction.events) {
      sanction.events.sort((a: { created_at: string }, b: { created_at: string }) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return NextResponse.json({ sanction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { data: caller } = await supabase
      .from('profiles')
      .select('id, username, display_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'super_admin', 'moderator'];
    if (!caller || !allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Permission denied: Only league administrators can modify sanctions.' }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const identifier = resolvedParams.id;
    const body = await request.json();
    const { status, reason, isPublic, additionalNotes } = body;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    // Fetch existing sanction
    const { data: existing, error: fetchErr } = await supabase
      .from('sanctions')
      .select('*')
      .match(isUuid ? { id: identifier } : { sanction_code: identifier })
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Sanction not found.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const staffName = caller.display_name || caller.username || 'League Official';

    const updates: Record<string, unknown> = {
      updated_at: nowIso,
    };

    if (status) updates.status = status;
    if (typeof isPublic === 'boolean') updates.is_public = isPublic;
    if (additionalNotes) updates.additional_notes = additionalNotes;

    const { data: updatedSanction, error: updateErr } = await supabase
      .from('sanctions')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Append to sanction_events timeline
    const eventType = status ? `status_${status}` : 'sanction_updated';
    const eventTitle = status ? `Status Changed: ${status.toUpperCase()}` : 'Record Updated';

    await supabase.from('sanction_events').insert({
      sanction_id: existing.id,
      event_type: eventType,
      title: eventTitle,
      description: reason?.trim() || `Status updated from ${existing.status} to ${status || existing.status} by ${staffName}.`,
      actor_id: user.id,
      actor_name: staffName,
      created_at: nowIso,
    });

    // Record in audit_logs
    await supabase.from('audit_logs').insert({
      action: 'sanction_status_modified',
      table_name: 'sanctions',
      record_id: existing.id,
      user_id: user.id,
      old_values: { status: existing.status, is_public: existing.is_public },
      new_values: { status: status || existing.status, is_public: isPublic ?? existing.is_public, reason },
    });

    // If sanction overturned or completed, restore player account_status if they have no other active suspensions
    if ((status === 'overturned' || status === 'completed' || status === 'expired' || status === 'cancelled') && existing.player_id) {
      const { count: remainingActiveSanctions } = await supabase
        .from('sanctions')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', existing.player_id)
        .eq('status', 'active')
        .neq('id', existing.id);

      if (!remainingActiveSanctions || remainingActiveSanctions === 0) {
        await supabase
          .from('profiles')
          .update({ account_status: 'registered' })
          .eq('id', existing.player_id);
      }
    }

    return NextResponse.json({ success: true, sanction: updatedSanction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

