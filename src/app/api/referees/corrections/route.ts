import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('match_id');

    let query = supabase
      .from('result_corrections')
      .select(`
        *,
        match:matches(
          id, scheduled_at, status, format,
          home_guild:guilds!home_guild_id(id, name, tag),
          away_guild:guilds!away_guild_id(id, name, tag)
        ),
        requester:profiles!requested_by(display_name, username),
        decider:profiles!decided_by(display_name, username)
      `)
      .order('created_at', { ascending: false });

    if (matchId) {
      query = query.eq('match_id', matchId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ corrections: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching result corrections';
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
      requested_home_score,
      requested_away_score,
      requested_winner_id,
      reason,
      evidence_url,
    } = body;

    if (!match_id || requested_home_score === undefined || requested_away_score === undefined || !reason) {
      return NextResponse.json({ error: 'Match ID, requested scores, and justification reason are required' }, { status: 400 });
    }

    // Get current match result
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', match_id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const { data: correction, error: corError } = await supabase
      .from('result_corrections')
      .insert({
        match_id,
        original_home_score: match.home_score,
        original_away_score: match.away_score,
        original_winner_id: match.winner_id,
        requested_home_score,
        requested_away_score,
        requested_winner_id: requested_winner_id || (requested_home_score > requested_away_score ? match.home_guild_id : match.away_guild_id),
        reason,
        evidence_url: evidence_url || null,
        requested_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (corError) return NextResponse.json({ error: corError.message }, { status: 500 });

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'RESULT_CORRECTION_REQUESTED',
      entity_type: 'result_correction',
      entity_id: correction.id,
      actor_id: user.id,
      details: { match_id, requested_home_score, requested_away_score, reason },
    });

    return NextResponse.json({ correction }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error submitting correction request';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin / head referee permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Only administrators or head referees can decide result corrections' }, { status: 403 });
    }

    const body = await request.json();
    const { correction_id, status } = body; // 'approved' | 'rejected'

    if (!correction_id || !status) {
      return NextResponse.json({ error: 'Correction ID and status required' }, { status: 400 });
    }

    const { data: correction, error: fetchErr } = await supabase
      .from('result_corrections')
      .select('*')
      .eq('id', correction_id)
      .single();

    if (fetchErr || !correction) {
      return NextResponse.json({ error: 'Correction request not found' }, { status: 404 });
    }

    // Update correction record
    const { data: updatedCorrection, error: updateErr } = await supabase
      .from('result_corrections')
      .update({
        status,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', correction_id)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // If approved, update official match result
    if (status === 'approved') {
      await supabase
        .from('matches')
        .update({
          home_score: correction.requested_home_score,
          away_score: correction.requested_away_score,
          winner_id: correction.requested_winner_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', correction.match_id);

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'MATCH_RESULT_CORRECTED',
        entity_type: 'match',
        entity_id: correction.match_id,
        actor_id: user.id,
        details: {
          correction_id,
          new_home_score: correction.requested_home_score,
          new_away_score: correction.requested_away_score,
        },
      });
    }

    return NextResponse.json({ correction: updatedCorrection });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deciding correction';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
