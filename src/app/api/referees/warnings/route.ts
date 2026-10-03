import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('match_id');

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('match_warnings')
      .select('*, issuer:profiles!issued_by(display_name, username), player:profiles!player_id(display_name, username), guild:guilds!guild_id(name, tag)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ warnings: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching warnings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      match_id,
      player_id,
      guild_id,
      warning_type,
      rule_id,
      rule_name,
      reason,
    } = body;

    if (!match_id || !reason) {
      return NextResponse.json({ error: 'Match ID and reason are required' }, { status: 400 });
    }

    const { data: warning, error: warnError } = await supabase
      .from('match_warnings')
      .insert({
        match_id,
        player_id: player_id || null,
        guild_id: guild_id || null,
        warning_type: warning_type || 'official',
        rule_id: rule_id || null,
        rule_name: rule_name || 'Official League Rulebook',
        reason,
        issued_by: user.id,
      })
      .select()
      .single();

    if (warnError) return NextResponse.json({ error: warnError.message }, { status: 500 });

    // Increment warnings_issued on referee record if referee
    const { data: refRecord } = await supabase
      .from('referees')
      .select('id, warnings_issued')
      .eq('user_id', user.id)
      .maybeSingle();

    if (refRecord) {
      await supabase
        .from('referees')
        .update({ warnings_issued: (refRecord.warnings_issued || 0) + 1 })
        .eq('id', refRecord.id);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'MATCH_WARNING_ISSUED',
      entity_type: 'match_warning',
      entity_id: warning.id,
      actor_id: user.id,
      details: { match_id, player_id, guild_id, warning_type, rule_name, reason },
    });

    return NextResponse.json({ warning }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error issuing warning';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
