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
      .from('match_incidents')
      .select('*, reporter:profiles!reported_by(display_name, username), player:profiles!player_id(display_name, username), guild:guilds!guild_id(name, tag)')
      .eq('match_id', matchId)
      .order('incident_time', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ incidents: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching incidents';
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
      player_id,
      guild_id,
      incident_type,
      description,
      evidence_url,
      severity,
      submit_for_review,
    } = body;

    if (!match_id || !incident_type || !description) {
      return NextResponse.json({ error: 'Match ID, incident type, and description are required' }, { status: 400 });
    }

    const status = submit_for_review ? 'submitted_for_review' : 'recorded';

    const { data: incident, error: incError } = await supabase
      .from('match_incidents')
      .insert({
        match_id,
        game_number: game_number || null,
        reported_by: user.id,
        player_id: player_id || null,
        guild_id: guild_id || null,
        incident_type,
        description,
        evidence_url: evidence_url || null,
        severity: severity || 'minor',
        status,
      })
      .select()
      .single();

    if (incError) return NextResponse.json({ error: incError.message }, { status: 500 });

    // If submitted for review, create a linked Case in cases table if cases table exists
    if (submit_for_review) {
      const caseCode = `CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await supabase.from('cases').insert({
        case_code: caseCode,
        title: `Match Incident: ${incident_type.replace('_', ' ').toUpperCase()} (${description.slice(0, 50)})`,
        match_id,
        guild_id: guild_id || null,
        player_id: player_id || null,
        status: 'pending',
        notes: `Automatically escalated from Match Referee Incident ID: ${incident.id}. Description: ${description}`,
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'MATCH_INCIDENT_RECORDED',
      entity_type: 'match_incident',
      entity_id: incident.id,
      actor_id: user.id,
      details: { match_id, incident_type, severity, submit_for_review },
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error recording incident';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
