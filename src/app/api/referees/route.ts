import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const rank = searchParams.get('rank');
    const status = searchParams.get('status');
    const region = searchParams.get('region');
    const search = searchParams.get('search');

    let query = supabase
      .from('referees')
      .select('*, profile:profiles!user_id(id, username, display_name, roblox_username, discord_username, avatar_url, is_verified, region, timezone)')
      .order('matches_officiated', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      query = query.neq('status', 'inactive');
    }
    if (rank && rank !== 'all') {
      query = query.eq('rank', rank);
    }
    if (region && region !== 'all') {
      query = query.ilike('region', `%${region}%`);
    }
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,website_username.ilike.%${search}%,roblox_username.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ referees: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch referees';
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

    // Check admin permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create referees' }, { status: 403 });
    }

    const body = await request.json();
    const {
      user_id,
      website_username,
      display_name,
      discord_username,
      roblox_username,
      region,
      timezone,
      rank,
      status,
      internal_notes,
    } = body;

    if (!website_username || !display_name) {
      return NextResponse.json({ error: 'Website username and display name are required' }, { status: 400 });
    }

    let resolvedUserId = user_id || null;
    if (!resolvedUserId && website_username) {
      const { data: matchedProfile } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .ilike('username', website_username.trim())
        .maybeSingle();

      if (matchedProfile) {
        resolvedUserId = matchedProfile.id;
      }
    }

    const { data: newRef, error: insertError } = await supabase
      .from('referees')
      .insert({
        user_id: resolvedUserId,
        website_username,
        display_name,
        discord_username: discord_username || null,
        roblox_username: roblox_username || null,
        region: region || 'Global',
        timezone: timezone || 'UTC',
        rank: rank || 'Trial Referee',
        status: status || 'active',
        internal_notes: internal_notes || null,
        matches_officiated: 0,
        current_season_matches: 0,
        completed_matches: 0,
        cancelled_matches: 0,
        warnings_issued: 0,
        reports_submitted: 0,
        seasons_active: ['Season 1'],
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Auto-assign referee role in user_roles if linked to an existing user account
    if (resolvedUserId && newRef) {
      const roleSlugMap: Record<string, string> = {
        'Head Referee': 'head_referee',
        'Senior Referee': 'senior_referee',
        'Referee': 'referee',
        'Junior Referee': 'junior_referee',
        'Trial Referee': 'trial_referee',
      };
      const targetSlug = roleSlugMap[rank || ''] || 'referee';
      const { data: matchedRole } = await supabase
        .from('roles')
        .select('id')
        .eq('slug', targetSlug)
        .maybeSingle();

      if (matchedRole) {
        await supabase
          .from('user_roles')
          .insert({
            user_id: resolvedUserId,
            role_id: matchedRole.id,
            status: 'active',
            assigned_by: user.id,
            reason: 'Assigned via official referee creation',
          });
      }
    }

    // Initialize default availability
    if (newRef) {
      await supabase.from('referee_availability').insert({
        referee_id: newRef.id,
        available_days: ['Friday', 'Saturday', 'Sunday'],
        available_hours: '18:00 - 23:00',
        timezone: newRef.timezone || 'WIB (UTC+7)',
        preferred_match_times: 'Weekend evening prime time',
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'REFEREE_CREATED',
        entity_type: 'referee',
        entity_id: newRef.id,
        actor_id: user.id,
        details: { website_username, rank: newRef.rank, status: newRef.status },
      });
    }

    return NextResponse.json({ referee: newRef }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error creating referee';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
