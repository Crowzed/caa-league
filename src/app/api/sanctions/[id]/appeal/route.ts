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
      return NextResponse.json({ error: 'Unauthorized. Please sign in to submit an appeal.' }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const identifier = resolvedParams.id;
    const body = await request.json();
    const { reason, statement, evidence } = body;

    if (!reason || !statement) {
      return NextResponse.json({ error: 'Appeal reason and written statement are required.' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    // Fetch sanction
    const { data: sanction, error: fetchErr } = await supabase
      .from('sanctions')
      .select('*, guild:guilds(owner_id)')
      .match(isUuid ? { id: identifier } : { sanction_code: identifier })
      .maybeSingle();

    if (fetchErr || !sanction) {
      return NextResponse.json({ error: 'Sanction record not found.' }, { status: 404 });
    }

    // Authorization check: User must be the affected player or the owner/captain of the affected guild
    const isTargetPlayer = sanction.target_type === 'player' && sanction.player_id === user.id;
    const isGuildOwner = sanction.target_type === 'guild' && (sanction.guild as { owner_id?: string })?.owner_id === user.id;

    if (!isTargetPlayer && !isGuildOwner) {
      // Also check if user is captain of the guild
      if (sanction.guild_id) {
        const { data: member } = await supabase
          .from('guild_members')
          .select('role')
          .eq('guild_id', sanction.guild_id)
          .eq('player_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!member || (member.role !== 'captain' && member.role !== 'co_captain')) {
          return NextResponse.json({ error: 'Only the affected player or guild captain can submit an appeal.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Only the affected party can submit an appeal.' }, { status: 403 });
      }
    }

    // Generate appeal code: APL-2026-XXXX
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('appeals')
      .select('*', { count: 'exact', head: true });

    const appealCode = `APL-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    // Fetch user profile name
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .maybeSingle();

    const submitterName = userProfile?.display_name || userProfile?.username || 'Affected Competitor';

    // 1. Insert appeal record
    const { data: newAppeal, error: appealErr } = await supabase
      .from('appeals')
      .insert({
        appeal_code: appealCode,
        sanction_id: sanction.id,
        case_id: sanction.case_id,
        submitted_by: user.id,
        reason,
        statement,
        evidence: Array.isArray(evidence) ? evidence : [],
        status: 'pending',
        created_at: nowIso,
      })
      .select()
      .single();

    if (appealErr) {
      return NextResponse.json({ error: 'Failed to submit appeal: ' + appealErr.message }, { status: 500 });
    }

    // 2. Update sanction appeal_status to 'pending'
    await supabase
      .from('sanctions')
      .update({
        appeal_status: 'pending',
        updated_at: nowIso,
      })
      .eq('id', sanction.id);

    // 3. Append to sanction_events timeline
    await supabase.from('sanction_events').insert({
      sanction_id: sanction.id,
      event_type: 'appeal_submitted',
      title: 'Appeal Submitted',
      description: `Formal appeal ${appealCode} submitted by ${submitterName}. Grounds: "${reason}". Review pending with League Committee.`,
      actor_id: user.id,
      actor_name: submitterName,
      created_at: nowIso,
    });

    // 4. Create initial appeal_event
    await supabase.from('appeal_events').insert({
      appeal_id: newAppeal.id,
      event_type: 'appeal_filed',
      title: 'Appeal Filed',
      description: `Appeal submitted by ${submitterName}. Statement: "${statement.slice(0, 100)}${statement.length > 100 ? '...' : ''}"`,
      actor_id: user.id,
      actor_name: submitterName,
      created_at: nowIso,
    });

    // 5. Audit Log
    await supabase.from('audit_logs').insert({
      action: 'sanction_appeal_submitted',
      table_name: 'appeals',
      record_id: newAppeal.id,
      user_id: user.id,
      new_values: {
        appeal_code: appealCode,
        sanction_code: sanction.sanction_code,
        reason,
        statement,
      },
    });

    return NextResponse.json({ success: true, appeal: newAppeal });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

