const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function seedProtestsAndPenalties() {
  console.log('Fetching dependencies for protests and penalties...');
  const [guildsRes, profilesRes, matchesRes] = await Promise.all([
    supabase.from('guilds').select('id, name').order('name'),
    supabase.from('profiles').select('id, username').order('username'),
    supabase.from('matches').select('id, round').order('scheduled_at'),
  ]);

  const guilds = guildsRes.data || [];
  const profiles = profilesRes.data || [];
  const matches = matchesRes.data || [];

  if (guilds.length < 2 || profiles.length < 2 || matches.length < 1) {
    console.error('Missing dependencies:', { guilds: guilds.length, profiles: profiles.length, matches: matches.length });
    return;
  }

  console.log('Seeding protests...');
  const protestRows = [
    {
      id: 'aaaa1111-1111-1111-1111-111111111101',
      match_id: matches[0].id,
      submitted_by: profiles[0].id,
      guild_id: guilds[0].id,
      type: 'player_eligibility',
      title: 'Unregistered Roster Player Fielding',
      description: 'Opposing team fielded a substitute who was not listed on their approved 5-man roster prior to check-in.',
      status: 'pending',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'aaaa1111-1111-1111-1111-111111111102',
      match_id: matches[1]?.id || matches[0].id,
      submitted_by: profiles[1].id,
      guild_id: guilds[1].id,
      type: 'exploit',
      title: 'Terrain Geometry Clip on Fortress Ridge',
      description: 'Player clipped artillery units inside an unpassable mountain collider during Game 2 defense.',
      status: 'under_review',
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'aaaa1111-1111-1111-1111-111111111103',
      match_id: matches[2]?.id || matches[0].id,
      submitted_by: profiles[2]?.id || profiles[0].id,
      guild_id: guilds[2]?.id || guilds[0].id,
      type: 'match_issue',
      title: 'Server Desync & Lag Disconnect',
      description: 'Host server experienced extreme network stutter causing two players to timeout in Game 1.',
      status: 'decision_made',
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const p of protestRows) {
    const { error } = await supabase.from('protests').upsert(p);
    if (error) console.error('Protest error:', error);
  }
  console.log('✓ Protests seeded');

  console.log('Seeding penalties...');
  const penaltyRows = [
    {
      id: 'bbbb1111-1111-1111-1111-111111111101',
      guild_id: guilds[0].id,
      player_id: null,
      type: 'warning',
      severity: 'minor',
      description: 'Late roster submission for Week 3 check-in.',
      starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: null,
      is_active: true,
      issued_by: profiles[0].id,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'bbbb1111-1111-1111-1111-111111111102',
      guild_id: null,
      player_id: profiles[1].id,
      type: 'match_ban',
      severity: 'moderate',
      description: 'Unsportsmanlike conduct in all-chat during Game 3.',
      starts_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      issued_by: profiles[0].id,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'bbbb1111-1111-1111-1111-111111111103',
      guild_id: guilds[1].id,
      player_id: null,
      type: 'point_deduction',
      severity: 'major',
      description: 'Unannounced match forfeit causing broadcast disruption.',
      starts_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: null,
      is_active: true,
      issued_by: profiles[0].id,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const pen of penaltyRows) {
    const { error } = await supabase.from('penalties').upsert(pen);
    if (error) console.error('Penalty error:', error);
  }
  console.log('✓ Penalties seeded');
}

seedProtestsAndPenalties().catch(console.error);
