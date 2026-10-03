import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('match_id');
    const myAssignments = searchParams.get('my');

    let query = supabase
      .from('referee_assignments')
      .select(`
        *,
        referee:referees(id, display_name, website_username, rank, status, roblox_username),
        match:matches(
          id, scheduled_at, status, format, round, week, server_info,
          home_guild:guilds!home_guild_id(id, name, tag, logo_url),
          away_guild:guilds!away_guild_id(id, name, tag, logo_url),
          division:divisions(id, name)
        )
      `)
      .order('assigned_at', { ascending: false });

    if (matchId) {
      query = query.eq('match_id', matchId);
    } else if (myAssignments === 'true') {
      // Find referee record for this user
      const { data: refRecord } = await supabase
        .from('referees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!refRecord) {
        return NextResponse.json({ assignments: [] });
      }
      query = query.eq('referee_id', refRecord.id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ assignments: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching assignments';
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { match_id, referee_id, role, bypass_conflict_warning } = body;

    if (!match_id || !referee_id) {
      return NextResponse.json({ error: 'Match ID and Referee ID are required' }, { status: 400 });
    }

    // 1. Fetch match and referee details to check conflict of interest
    const { data: match } = await supabase
      .from('matches')
      .select('*, home_guild:guilds!home_guild_id(id, name, tag), away_guild:guilds!away_guild_id(id, name, tag)')
      .eq('id', match_id)
      .single();

    const { data: referee } = await supabase
      .from('referees')
      .select('*')
      .eq('id', referee_id)
      .single();

    if (!match || !referee) {
      return NextResponse.json({ error: 'Match or Referee not found' }, { status: 404 });
    }

    // 2. Conflict of interest verification:
    // Check if referee's user_id belongs to either guild
    let conflictWarning: string | null = null;
    if (referee.user_id) {
      const { data: guildMembership } = await supabase
        .from('guild_members')
        .select('guild_id, guild:guilds(name)')
        .eq('player_id', referee.user_id)
        .eq('is_active', true)
        .in('guild_id', [match.home_guild_id, match.away_guild_id])
        .maybeSingle();

      if (guildMembership) {
        conflictWarning = `Conflict of Interest: Referee ${referee.display_name} is an active member of participating guild ${(guildMembership.guild as unknown as { name?: string })?.name || 'one of the guilds'}.`;
      }
    }

    // Check declared conflicts
    const { data: declaredConflicts } = await supabase
      .from('referee_conflicts')
      .select('*')
      .eq('referee_id', referee_id)
      .or(`guild_id.eq.${match.home_guild_id},guild_id.eq.${match.away_guild_id}`);

    if (declaredConflicts && declaredConflicts.length > 0) {
      conflictWarning = `Conflict of Interest: Referee has previously declared a conflict with a participating guild: ${declaredConflicts[0].description}`;
    }

    if (conflictWarning && !bypass_conflict_warning) {
      return NextResponse.json({
        conflict_detected: true,
        warning: conflictWarning,
        error: `${conflictWarning} Please confirm if you wish to override this warning.`,
      }, { status: 409 });
    }

    // 3. Create or update assignment
    const { data: newAssignment, error: assignError } = await supabase
      .from('referee_assignments')
      .insert({
        match_id,
        referee_id,
        role: role || 'primary',
        status: 'assigned',
        assigned_by: user.id,
      })
      .select()
      .single();

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }

    // If primary referee, update matches table primary_referee_id
    if (role === 'primary' || !role) {
      await supabase
        .from('matches')
        .update({ primary_referee_id: referee_id, referee_id: referee.user_id || null })
        .eq('id', match_id);
    }

    // 4. Send notification to referee
    if (referee.user_id) {
      const matchLabel = `${match.home_guild?.name || 'Home'} vs ${match.away_guild?.name || 'Away'}`;
      await supabase.from('notifications').insert({
        user_id: referee.user_id,
        title: 'New Match Assignment',
        message: `You have been assigned as the ${role || 'primary'} referee for ${matchLabel}. Please review and respond in your Referee Portal.`,
        type: 'match_reminder',
      });
    }

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      action: 'REFEREE_ASSIGNED',
      entity_type: 'match',
      entity_id: match_id,
      actor_id: user.id,
      details: {
        referee_id,
        referee_name: referee.display_name,
        role: role || 'primary',
        conflict_overridden: Boolean(conflictWarning && bypass_conflict_warning),
      },
    });

    return NextResponse.json({ assignment: newAssignment }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating assignment';
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

    const body = await request.json();
    const { assignment_id, action, decline_reason } = body; // action: 'accept' | 'decline'

    if (!assignment_id || !action) {
      return NextResponse.json({ error: 'Assignment ID and action are required' }, { status: 400 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    const { data: assignment, error: assignError } = await supabase
      .from('referee_assignments')
      .update({
        status: newStatus,
        decline_reason: action === 'decline' ? (decline_reason || 'Referee unavailable') : null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', assignment_id)
      .select('*, match:matches(*), referee:referees(*)')
      .single();

    if (assignError || !assignment) {
      return NextResponse.json({ error: assignError?.message || 'Assignment not found' }, { status: 500 });
    }

    // If declined, notify administrator / assigner
    if (action === 'decline' && assignment.assigned_by) {
      await supabase.from('notifications').insert({
        user_id: assignment.assigned_by,
        title: 'Referee Declined Assignment',
        message: `Referee ${assignment.referee?.display_name || 'Official'} declined the assignment for Match ${assignment.match_id}. Reason: "${decline_reason || 'Not specified'}". Please assign an alternate official.`,
        type: 'system',
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: action === 'accept' ? 'REFEREE_ASSIGNMENT_ACCEPTED' : 'REFEREE_ASSIGNMENT_DECLINED',
      entity_type: 'referee_assignment',
      entity_id: assignment_id,
      actor_id: user.id,
      details: { action, decline_reason },
    });

    return NextResponse.json({ assignment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating assignment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
