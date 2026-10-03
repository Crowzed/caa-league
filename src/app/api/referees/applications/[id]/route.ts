import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
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
    const { status, reviewer_notes, initial_rank } = body;

    // Fetch existing application
    const { data: application, error: appError } = await supabase
      .from('referee_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Update application
    const { data: updatedApp, error: updateError } = await supabase
      .from('referee_applications')
      .update({
        status,
        reviewed_by: user.id,
        reviewer_notes: reviewer_notes || application.reviewer_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If approved, promote user to referee!
    if (status === 'approved') {
      const assignedRank = initial_rank || 'Trial Referee';

      // Check if referee record already exists
      const { data: existingRef } = await supabase
        .from('referees')
        .select('id')
        .eq('user_id', application.user_id)
        .maybeSingle();

      let refereeId = existingRef?.id;

      if (!existingRef) {
        const { data: newRef, error: refError } = await supabase
          .from('referees')
          .insert({
            user_id: application.user_id,
            website_username: application.website_username,
            display_name: application.display_name,
            discord_username: application.discord_username,
            roblox_username: application.roblox_username,
            region: application.region,
            timezone: application.timezone,
            rank: assignedRank,
            status: 'active',
            matches_officiated: 0,
            current_season_matches: 0,
            completed_matches: 0,
            cancelled_matches: 0,
            warnings_issued: 0,
            reports_submitted: 0,
            seasons_active: ['Season 1'],
            internal_notes: `Application approved by staff on ${new Date().toLocaleDateString()}. Initial Rank: ${assignedRank}.`,
          })
          .select()
          .single();

        if (!refError && newRef) {
          refereeId = newRef.id;
          // Set initial availability
          await supabase.from('referee_availability').insert({
            referee_id: newRef.id,
            available_days: ['Friday', 'Saturday', 'Sunday'],
            available_hours: application.availability || '18:00 - 23:00',
            timezone: application.timezone,
            preferred_match_times: application.preferred_match_times,
          });
        }
      } else {
        // Reactivate and update rank
        await supabase
          .from('referees')
          .update({
            status: 'active',
            rank: assignedRank,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRef.id);
      }

      // Update profile role if standard player
      await supabase
        .from('profiles')
        .update({ role: 'referee' })
        .eq('id', application.user_id)
        .eq('role', 'player');

      // Send congratulations notification
      await supabase.from('notifications').insert({
        user_id: application.user_id,
        title: 'Referee Application Approved!',
        message: `Congratulations! Your referee application has been approved as ${assignedRank}. You now have access to the Referee Portal and match assignments.`,
        type: 'system',
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'REFEREE_APPLICATION_APPROVED',
        entity_type: 'referee_application',
        entity_id: id,
        actor_id: user.id,
        details: { applicant_id: application.user_id, rank: assignedRank, referee_id: refereeId },
      });
    } else if (status === 'rejected') {
      // Send rejection notification
      await supabase.from('notifications').insert({
        user_id: application.user_id,
        title: 'Referee Application Update',
        message: `Your referee application has been reviewed. At this time, the application was not approved. Feedback: ${reviewer_notes || 'No specific feedback provided.'}`,
        type: 'system',
      });
    }

    return NextResponse.json({ application: updatedApp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error reviewing application';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
