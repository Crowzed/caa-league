import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SanctionTargetType, SanctionSeverity, SanctionStatus } from '@/types/database';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const targetType = searchParams.get('target_type');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const playerId = searchParams.get('player_id');
    const guildId = searchParams.get('guild_id');
    const matchId = searchParams.get('match_id');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = supabase
      .from('sanctions')
      .select(`
        *,
        player:profiles!player_id(id, username, display_name, roblox_username, avatar_url),
        guild:guilds!guild_id(id, name, tag, logo_url, division_id),
        match:matches!match_id(id, scheduled_at, home_guild_id, away_guild_id, status),
        rule:rules!rule_id(id, number, title, section),
        case:cases!case_id(id, case_code, title)
      `)
      .order('issued_at', { ascending: false });

    if (targetType && targetType !== 'all') {
      query = query.eq('target_type', targetType);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (playerId) {
      query = query.eq('player_id', playerId);
    }

    if (guildId) {
      query = query.eq('guild_id', guildId);
    }

    if (matchId) {
      query = query.eq('match_id', matchId);
    }

    if (search) {
      const s = search.trim();
      query = query.or(`sanction_code.ilike.%${s}%,case_code.ilike.%${s}%,violation.ilike.%${s}%,rule_number.ilike.%${s}%,rule_title.ilike.%${s}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-update expired sanctions in-memory or on retrieval
    const now = new Date();
    const updated = (data || []).map((sanction) => {
      if (
        sanction.status === 'active' && 
        sanction.expires_at && 
        new Date(sanction.expires_at) < now &&
        !sanction.is_permanent
      ) {
        return { ...sanction, status: 'expired' as SanctionStatus };
      }
      return sanction;
    });

    return NextResponse.json({ sanctions: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // 1. Verify staff role
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, username, display_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'super_admin', 'moderator', 'referee'];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Permission denied: Only authorized league officials can issue sanctions.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      targetType,
      playerId,
      guildId,
      caseId,
      matchId,
      seasonId,
      divisionId,
      ruleId,
      ruleNumber,
      ruleTitle,
      ruleVersionId,
      ruleVersionName,
      violation,
      severity,
      sanctionType,
      description,
      decisionSummary,
      additionalNotes,
      evidence,
      effectiveAt,
      expiresAt,
      durationDays,
      isPermanent,
      isPublic = true,
    } = body;

    if (!targetType || !decisionSummary || !violation || !sanctionType) {
      return NextResponse.json({ error: 'Target type, violation, sanction type, and decision summary are required.' }, { status: 400 });
    }

    if (targetType === 'player' && !playerId) {
      return NextResponse.json({ error: 'Player target requires selecting a valid player.' }, { status: 400 });
    }

    if (targetType === 'guild' && !guildId) {
      return NextResponse.json({ error: 'Guild target requires selecting a valid guild.' }, { status: 400 });
    }

    // 2. Generate unique sanction code: SAN-2026-XXXX
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('sanctions')
      .select('*', { count: 'exact', head: true });

    const nextIndex = (count || 0) + 1;
    const sanctionCode = `SAN-${year}-${String(nextIndex).padStart(4, '0')}`;

    // Look up case code if caseId provided
    let caseCode: string | null = null;
    if (caseId) {
      const { data: cData } = await supabase
        .from('cases')
        .select('case_code')
        .eq('id', caseId)
        .maybeSingle();
      caseCode = cData?.case_code || null;
    }

    // Fetch rule details if ruleId provided
    let rNumber = ruleNumber;
    let rTitle = ruleTitle;
    const rVersionName = ruleVersionName;

    if (ruleId && (!rNumber || !rTitle)) {
      const { data: rData } = await supabase
        .from('rules')
        .select('number, title')
        .eq('id', ruleId)
        .maybeSingle();
      if (rData) {
        rNumber = rData.number ? `Rule ${rData.number}` : rNumber;
        rTitle = rData.title || rTitle;
      }
    }

    const issuedByName = callerProfile.display_name || callerProfile.username || 'League Official';
    const nowIso = new Date().toISOString();

    // 3. Insert Sanction record
    const { data: newSanction, error: insertErr } = await supabase
      .from('sanctions')
      .insert({
        sanction_code: sanctionCode,
        case_id: caseId || null,
        case_code: caseCode,
        target_type: targetType as SanctionTargetType,
        player_id: targetType === 'player' ? playerId : null,
        guild_id: targetType === 'guild' ? guildId : (body.associatedGuildId || null),
        match_id: matchId || null,
        season_id: seasonId || null,
        division_id: divisionId || null,
        rule_id: ruleId || null,
        rule_number: rNumber || 'Rule Unspecified',
        rule_title: rTitle || 'League Regulation',
        rule_version_id: ruleVersionId || null,
        rule_version_name: rVersionName || 'Current Active Rules',
        violation,
        severity: (severity as SanctionSeverity) || 'minor',
        sanction_type: sanctionType,
        description: description?.trim() || null,
        decision_summary: decisionSummary.trim(),
        additional_notes: additionalNotes?.trim() || null,
        evidence: Array.isArray(evidence) ? evidence : [],
        issued_by: user.id,
        issued_by_name: issuedByName,
        issued_at: nowIso,
        effective_at: effectiveAt || nowIso,
        expires_at: isPermanent ? null : (expiresAt || null),
        duration_days: durationDays || null,
        is_permanent: Boolean(isPermanent),
        status: 'active',
        appeal_status: 'none',
        is_public: isPublic !== false,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to issue sanction: ' + insertErr.message }, { status: 500 });
    }

    // 4. Create Initial Timeline Events
    await supabase.from('sanction_events').insert([
      {
        sanction_id: newSanction.id,
        event_type: 'sanction_issued',
        title: 'Sanction Issued',
        description: `Disciplinary sanction ${sanctionCode} officially issued by ${issuedByName}. Severity: ${severity.toUpperCase()}. Type: ${sanctionType.replace(/_/g, ' ')}.`,
        actor_id: user.id,
        actor_name: issuedByName,
        created_at: nowIso,
      },
      {
        sanction_id: newSanction.id,
        event_type: 'sanction_activated',
        title: 'Sanction Activated',
        description: `Punishment activated effective ${new Date(effectiveAt || nowIso).toLocaleDateString()}. Status: ACTIVE.`,
        actor_id: user.id,
        actor_name: 'League System',
        created_at: nowIso,
      }
    ]);

    // 5. Automatic Audit Log Entry
    await supabase.from('audit_logs').insert({
      action: 'sanction_issued',
      table_name: 'sanctions',
      record_id: newSanction.id,
      user_id: user.id,
      new_values: {
        sanction_code: sanctionCode,
        case_id: caseId,
        target_type: targetType,
        target_id: targetType === 'player' ? playerId : guildId,
        violation,
        severity,
        sanction_type: sanctionType,
        staff: issuedByName,
        effective_at: effectiveAt || nowIso,
      },
    });

    // 6. Automatic Notification
    const sanctionTypeFormatted = (sanctionType || 'warning').replace(/_/g, ' ').toUpperCase();
    if (targetType === 'player' && playerId) {
      await supabase.from('notifications').insert({
        user_id: playerId,
        type: 'system',
        title: `Disciplinary Action: ${sanctionTypeFormatted}`,
        message: `An official ${sanctionTypeFormatted.toLowerCase()} (${sanctionCode}) has been issued for "${violation}". Click to review the ruling and appeal options.`,
        link: `/discipline/${sanctionCode}`,
        is_read: false,
        created_at: nowIso,
      });

      // Update player profile account_status if suspension or ban
      if (sanctionType.includes('ban') || sanctionType.includes('suspension')) {
        await supabase
          .from('profiles')
          .update({ account_status: 'suspended' })
          .eq('id', playerId);
      }
    } else if (targetType === 'guild' && guildId) {
      // Find guild owner/captains to notify
      const { data: targetGuild } = await supabase
        .from('guilds')
        .select('name, owner_id')
        .eq('id', guildId)
        .maybeSingle();

      if (targetGuild?.owner_id) {
        await supabase.from('notifications').insert({
          user_id: targetGuild.owner_id,
          type: 'system',
          title: `Guild Disciplinary Action: ${sanctionTypeFormatted}`,
          message: `Your guild [${targetGuild.name}] has received an official ${sanctionTypeFormatted.toLowerCase()} (${sanctionCode}) for "${violation}". Click to review the ruling and appeal options.`,
          link: `/discipline/${sanctionCode}`,
          is_read: false,
          created_at: nowIso,
        });
      }
    }

    // 7. If match forfeit or map forfeit: update match record
    if (matchId && (sanctionType === 'match_forfeit' || sanctionType === 'forfeit_match')) {
      await supabase
        .from('matches')
        .update({
          status: 'forfeit',
          notes: `Result awarded by disciplinary sanction ${sanctionCode}: ${decisionSummary}`,
        })
        .eq('id', matchId);
    }

    return NextResponse.json({ success: true, sanction: newSanction });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

