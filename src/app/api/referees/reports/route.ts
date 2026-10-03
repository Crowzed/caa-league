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

    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is staff (to view internal_staff_notes)
    let isStaff = false;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profile && ['referee', 'moderator', 'admin', 'super_admin'].includes(profile.role)) {
        isStaff = true;
      }
    }

    const { data: report, error } = await supabase
      .from('referee_reports')
      .select('*, referee:referees(display_name, rank, website_username)')
      .eq('match_id', matchId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!report) return NextResponse.json({ report: null });

    // Sanitize internal_staff_notes if not staff
    if (!isStaff) {
      delete (report as { internal_staff_notes?: string }).internal_staff_notes;
    }

    return NextResponse.json({ report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching referee report';
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
      summary,
      start_time,
      end_time,
      technical_issues,
      sportsmanship_rating,
      referee_notes,
      internal_staff_notes,
      evidence_urls,
    } = body;

    if (!match_id || !summary) {
      return NextResponse.json({ error: 'Match ID and report summary are required' }, { status: 400 });
    }

    // Find referee record
    const { data: refRecord } = await supabase
      .from('referees')
      .select('id, reports_submitted')
      .eq('user_id', user.id)
      .maybeSingle();

    // 24 hour deadline calculation
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const reportPayload = {
      match_id,
      referee_id: refRecord?.id || null,
      summary,
      start_time: start_time || null,
      end_time: end_time || new Date().toISOString(),
      technical_issues: technical_issues || null,
      sportsmanship_rating: sportsmanship_rating || 'Excellent',
      referee_notes: referee_notes || null,
      internal_staff_notes: internal_staff_notes || null,
      evidence_urls: evidence_urls || [],
      deadline,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: report, error: repError } = await supabase
      .from('referee_reports')
      .upsert(reportPayload, { onConflict: 'match_id' })
      .select()
      .single();

    if (repError) return NextResponse.json({ error: repError.message }, { status: 500 });

    // Increment reports_submitted on referee record
    if (refRecord) {
      await supabase
        .from('referees')
        .update({ reports_submitted: (refRecord.reports_submitted || 0) + 1 })
        .eq('id', refRecord.id);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'REFEREE_REPORT_SUBMITTED',
      entity_type: 'referee_report',
      entity_id: report.id,
      actor_id: user.id,
      details: { match_id, summary },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error submitting referee report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
