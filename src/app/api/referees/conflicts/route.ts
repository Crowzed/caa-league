import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { referee_id, guild_id, player_id, match_id, conflict_type, description } = body;

    if (!referee_id || !conflict_type || !description) {
      return NextResponse.json({ error: 'Referee ID, conflict type, and description are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('referee_conflicts')
      .insert({
        referee_id,
        guild_id: guild_id || null,
        player_id: player_id || null,
        match_id: match_id || null,
        conflict_type,
        description,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log to audit log
    await supabase.from('audit_logs').insert({
      action: 'REFEREE_CONFLICT_DECLARED',
      entity_type: 'referee',
      entity_id: referee_id,
      actor_id: user.id,
      details: { conflict_type, description, guild_id, player_id, match_id },
    });

    return NextResponse.json({ conflict: data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error declaring conflict';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
