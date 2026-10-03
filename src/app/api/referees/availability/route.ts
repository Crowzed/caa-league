import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const refereeId = searchParams.get('referee_id');

    if (!refereeId) {
      return NextResponse.json({ error: 'Referee ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('referee_availability')
      .select('*')
      .eq('referee_id', refereeId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ availability: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching availability';
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
    const { referee_id, available_days, available_hours, timezone, unavailable_dates, preferred_match_times } = body;

    if (!referee_id) {
      return NextResponse.json({ error: 'Referee ID required' }, { status: 400 });
    }

    const payload = {
      referee_id,
      available_days: available_days || ['Friday', 'Saturday', 'Sunday'],
      available_hours: available_hours || '18:00 - 23:00',
      timezone: timezone || 'WIB (UTC+7)',
      unavailable_dates: unavailable_dates || [],
      preferred_match_times: preferred_match_times || 'Evening slots',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('referee_availability')
      .upsert(payload, { onConflict: 'referee_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ availability: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error saving availability';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
