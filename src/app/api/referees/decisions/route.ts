import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('match_id');

    let query = supabase
      .from('match_decisions')
      .select('*, referee:referees(display_name, rank), affected_guild:guilds(name, tag), affected_player:profiles(display_name, username)')
      .order('created_at', { ascending: false });

    if (matchId) {
      query = query.eq('match_id', matchId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ decisions: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching decisions';
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
      game_number,
      decision_type,
      rule_id,
      rule_name,
      decision,
      reason,
      affected_guild_id,
      affected_player_id,
      evidence_url,
    } = body;

    if (!match_id || !decision_type || !decision || !reason) {
      return NextResponse.json({ error: 'Match ID, decision type, decision text, and reason are required' }, { status: 400 });
    }

    // Get referee record
    const { data: refRecord } = await supabase
      .from('referees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: newDecision, error: decError } = await supabase
      .from('match_decisions')
      .insert({
        match_id,
        game_number: game_number || null,
        referee_id: refRecord?.id || null,
        decision_type,
        rule_id: rule_id || null,
        rule_name: rule_name || 'Official Match Rules',
        decision,
        reason,
        affected_guild_id: affected_guild_id || null,
        affected_player_id: affected_player_id || null,
        evidence_url: evidence_url || null,
        status: 'final',
      })
      .select()
      .single();

    if (decError) return NextResponse.json({ error: decError.message }, { status: 500 });

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'MATCH_DECISION_RECORDED',
      entity_type: 'match_decision',
      entity_id: newDecision.id,
      actor_id: user.id,
      details: { match_id, decision_type, decision, reason },
    });

    return NextResponse.json({ decision: newDecision }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error recording decision';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
