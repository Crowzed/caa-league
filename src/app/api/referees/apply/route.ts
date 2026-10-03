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
    const status = searchParams.get('status');
    const myApp = searchParams.get('my');

    if (myApp === 'true') {
      const { data, error } = await supabase
        .from('referee_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ applications: data || [] });
    }

    // Otherwise must be admin/moderator
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('referee_applications')
      .select('*, user:profiles!user_id(avatar_url, is_verified), reviewer:profiles!reviewed_by(display_name, username)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ applications: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching referee applications';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to apply' }, { status: 401 });
    }

    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found. Please complete registration first.' }, { status: 400 });
    }

    // Check if user already has an active pending/review application
    const { data: existingApp } = await supabase
      .from('referee_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'under_review', 'interview_trial'])
      .maybeSingle();

    if (existingApp) {
      return NextResponse.json({
        error: `You already have an active application under status: ${existingApp.status.toUpperCase()}. Please wait for league staff to review it.`,
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      region,
      timezone,
      experience,
      availability,
      preferred_match_times,
      motivation,
      relevant_experience,
      rules_agreed,
      discord_username,
      roblox_username,
    } = body;

    if (!experience || !availability || !preferred_match_times || !motivation || !rules_agreed) {
      return NextResponse.json({
        error: 'Please complete all required application questions and agree to the referee rules.',
      }, { status: 400 });
    }

    const { data: newApplication, error: appError } = await supabase
      .from('referee_applications')
      .insert({
        user_id: user.id,
        website_username: profile.username,
        display_name: profile.display_name || profile.username,
        roblox_username: roblox_username || profile.roblox_username || 'Not Provided',
        discord_username: discord_username || profile.discord_username || null,
        region: region || 'Global',
        timezone: timezone || 'UTC',
        experience,
        availability,
        preferred_match_times,
        motivation,
        relevant_experience: relevant_experience || null,
        rules_agreed: Boolean(rules_agreed),
        status: 'pending',
      })
      .select()
      .single();

    if (appError) {
      return NextResponse.json({ error: appError.message }, { status: 500 });
    }

    // Create notification for staff
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Referee Application Submitted',
      message: 'Your referee application has been submitted and is currently pending review by league administrators.',
      type: 'system',
    });

    return NextResponse.json({ application: newApplication }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error submitting application';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
