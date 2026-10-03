import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Verify staff permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isStaff = profile && ['admin', 'super_admin', 'moderator'].includes(profile.role);
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Staff permissions required to decide appeals.' }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const appealId = resolvedParams.id;
    const body = await request.json();
    const { status, decision, modificationSummary } = body;

    if (!status || !decision) {
      return NextResponse.json({ error: 'Decision status and written explanation are required.' }, { status: 400 });
    }

    // Fetch appeal
    const { data: appeal, error: appealErr } = await supabase
      .from('appeals')
      .select('*, sanction:sanctions(*)')
      .eq('id', appealId)
      .maybeSingle();

    if (appealErr || !appeal) {
      return NextResponse.json({ error: 'Appeal not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // 1. Update appeal record
    const { error: updateAppealErr } = await supabase
      .from('appeals')
      .update({
        status,
        decision,
        decided_by: user.id,
        decided_at: now,
      })
      .eq('id', appealId);

    if (updateAppealErr) {
      return NextResponse.json({ error: updateAppealErr.message }, { status: 500 });
    }

    // 2. If associated with a sanction, update the sanction and append a timeline event
    if (appeal.sanction_id) {
      let newSanctionStatus = appeal.sanction?.status || 'active';
      let eventType = 'appeal_decided';
      let eventTitle = 'Appeal Decided';

      if (status === 'overturned') {
        newSanctionStatus = 'overturned';
        eventType = 'appeal_overturned';
        eventTitle = 'Appeal Rulings: Sanction Overturned';
      } else if (status === 'upheld') {
        eventType = 'appeal_upheld';
        eventTitle = 'Appeal Rulings: Sanction Upheld';
      } else if (status === 'reduced') {
        newSanctionStatus = 'reduced';
        eventType = 'appeal_reduced';
        eventTitle = 'Appeal Rulings: Penalty Reduced';
      }

      await supabase
        .from('sanctions')
        .update({
          status: newSanctionStatus,
          appeal_status: status,
          updated_at: now,
        })
        .eq('id', appeal.sanction_id);

      // Append immutable timeline event
      await supabase.from('sanction_events').insert({
        sanction_id: appeal.sanction_id,
        event_type: eventType,
        title: eventTitle,
        description: modificationSummary ? `${decision}\n\nModification: ${modificationSummary}` : decision,
        actor_id: user.id,
        created_at: now,
      });

      // Notify affected player or guild
      const targetUserId = appeal.submitted_by;
      if (targetUserId) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'disciplinary_appeal',
          title: `Appeal Decision: ${eventTitle}`,
          message: `Your appeal regarding sanction ${appeal.sanction?.sanction_code || 'ruling'} has been decided: ${status.toUpperCase()}.`,
          link: appeal.sanction?.sanction_code ? `/discipline/${appeal.sanction.sanction_code}` : '/dashboard',
          is_read: false,
          created_at: now,
        });
      }
    }

    // 3. Audit log
    await supabase.from('audit_logs').insert({
      action: 'appeal_decided',
      table_name: 'appeals',
      record_id: appealId,
      user_id: user.id,
      new_values: {
        status,
        decision,
        decided_by: user.id,
        sanction_id: appeal.sanction_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

