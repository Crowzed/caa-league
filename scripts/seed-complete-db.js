const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function seed() {
  console.log('Seeding database with live dummy data...');

  // 1. Seasons
  const s2Id = '44444444-4444-4444-4444-444444444402';
  const { error: s2Err } = await supabase.from('seasons').upsert({
    id: s2Id,
    name: 'Season 2 - Rising Storm',
    number: 2,
    start_date: '2026-08-01',
    end_date: '2026-11-15',
    status: 'group_stage',
    is_current: true,
    registration_deadline: '2026-07-25',
    updated_at: new Date().toISOString(),
  });
  if (s2Err) console.error('Season error:', s2Err);
  else console.log('✓ Season 2 (Active) ensured');

  // 2. Divisions
  const divisions = [
    { id: '55555555-5555-5555-5555-555555555501', season_id: s2Id, name: 'Grand League', tier: 1, max_teams: 8, playoff_spots: 4, promotion_spots: 0, relegation_spots: 2, description: 'The pinnacle of competitive CAA League.' },
    { id: '55555555-5555-5555-5555-555555555502', season_id: s2Id, name: 'Diamond League', tier: 2, max_teams: 8, playoff_spots: 4, promotion_spots: 2, relegation_spots: 2, description: 'High-tier semi-professional division.' },
    { id: '55555555-5555-5555-5555-555555555503', season_id: s2Id, name: 'Gold League', tier: 3, max_teams: 8, playoff_spots: 4, promotion_spots: 2, relegation_spots: 2, description: 'Competitive tier for emerging rosters.' },
    { id: '55555555-5555-5555-5555-555555555504', season_id: s2Id, name: 'Silver League', tier: 4, max_teams: 8, playoff_spots: 4, promotion_spots: 2, relegation_spots: 2, description: 'Intermediate proving grounds.' },
    { id: '55555555-5555-5555-5555-555555555505', season_id: s2Id, name: 'Bronze League', tier: 5, max_teams: 8, playoff_spots: 4, promotion_spots: 2, relegation_spots: 0, description: 'Open entry-level division.' },
  ];

  for (const div of divisions) {
    const { error } = await supabase.from('divisions').upsert(div);
    if (error) console.error('Division error:', error);
  }
  console.log('✓ 5 Divisions seeded');

  // 3. Guilds
  const { data: guildsData } = await supabase.from('guilds').select('id, name, tag').order('name');
  if (!guildsData || guildsData.length < 2) {
    console.error('Not enough guilds found!');
    return;
  }
  const grandDivId = divisions[0].id;
  // Assign guilds to Grand League
  for (const g of guildsData) {
    await supabase.from('guilds').update({ division_id: grandDivId }).eq('id', g.id);
  }
  console.log(`✓ ${guildsData.length} Guilds assigned to Grand League`);

  // 4. Standings
  const standingsRows = [
    { rank: 1, wins: 5, draws: 0, losses: 0, maps_won: 15, maps_lost: 2, points: 15, form: 'W,W,W,W,W', streak: '5W' },
    { rank: 2, wins: 4, draws: 0, losses: 1, maps_won: 13, maps_lost: 5, points: 12, form: 'W,W,L,W,W', streak: '2W' },
    { rank: 3, wins: 3, draws: 1, losses: 1, maps_won: 11, maps_lost: 7, points: 10, form: 'W,L,W,D,W', streak: '1W' },
    { rank: 4, wins: 3, draws: 0, losses: 2, maps_won: 10, maps_lost: 8, points: 9, form: 'L,W,W,L,W', streak: '1W' },
    { rank: 5, wins: 2, draws: 0, losses: 3, maps_won: 7, maps_lost: 11, points: 6, form: 'W,L,L,W,L', streak: '1L' },
    { rank: 6, wins: 1, draws: 1, losses: 3, maps_won: 5, maps_lost: 12, points: 4, form: 'L,D,L,L,W', streak: '1W' },
    { rank: 7, wins: 1, draws: 0, losses: 4, maps_won: 4, maps_lost: 13, points: 3, form: 'L,L,W,L,L', streak: '2L' },
    { rank: 8, wins: 0, draws: 0, losses: 5, maps_won: 2, maps_lost: 15, points: 0, form: 'L,L,L,L,L', streak: '5L' },
  ];

  for (let i = 0; i < guildsData.length && i < standingsRows.length; i++) {
    const sRow = standingsRows[i];
    const standingPayload = {
      guild_id: guildsData[i].id,
      division_id: grandDivId,
      season_id: s2Id,
      rank: sRow.rank,
      matches_played: sRow.wins + sRow.draws + sRow.losses,
      wins: sRow.wins,
      draws: sRow.draws,
      losses: sRow.losses,
      maps_won: sRow.maps_won,
      maps_lost: sRow.maps_lost,
      points: sRow.points,
      form: sRow.form,
      streak: sRow.streak,
      updated_at: new Date().toISOString(),
    };
    const { error: standErr } = await supabase.from('standings').upsert(standingPayload, { onConflict: 'guild_id,division_id,season_id' });
    if (standErr) console.error('Standings error:', standErr);
  }
  console.log('✓ Standings seeded for all guilds');

  // 5. Matches with valid UUIDs
  // Clear any existing matches to ensure clean state
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const refProfile = (await supabase.from('profiles').select('id').eq('role', 'referee').maybeSingle()).data;
  const refId = refProfile ? refProfile.id : null;

  const matchTemplates = [
    {
      id: '33333333-3333-3333-3333-333333333301',
      homeIdx: 0,
      awayIdx: 1,
      round: 'Week 6 - Feature Match',
      week: 6,
      status: 'live',
      format: 'bo5',
      home_score: 1,
      away_score: 1,
      scheduled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      server_info: 'CAA Tournament VIP 01',
      notes: 'Game 3 underway. Defense advantage currently contested.',
    },
    {
      id: '33333333-3333-3333-3333-333333333302',
      homeIdx: 2,
      awayIdx: 3,
      round: 'Week 6',
      week: 6,
      status: 'scheduled',
      format: 'bo5',
      home_score: 0,
      away_score: 0,
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      server_info: 'CAA Official Server 02',
      notes: 'Check-in opens 30 minutes prior to match time.',
    },
    {
      id: '33333333-3333-3333-3333-333333333303',
      homeIdx: 4,
      awayIdx: 5,
      round: 'Week 6',
      week: 6,
      status: 'scheduled',
      format: 'bo3',
      home_score: 0,
      away_score: 0,
      scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      server_info: 'CAA Official Server 03',
      notes: '',
    },
    {
      id: '33333333-3333-3333-3333-333333333304',
      homeIdx: 0,
      awayIdx: 2,
      round: 'Week 5',
      week: 5,
      status: 'completed',
      format: 'bo5',
      home_score: 3,
      away_score: 1,
      scheduled_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      server_info: 'Server CAA-01',
      notes: 'Verified by referee. Home victory.',
    },
    {
      id: '33333333-3333-3333-3333-333333333305',
      homeIdx: 1,
      awayIdx: 3,
      round: 'Week 5',
      week: 5,
      status: 'completed',
      format: 'bo5',
      home_score: 3,
      away_score: 2,
      scheduled_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 55 * 60 * 1000).toISOString(),
      server_info: 'Server CAA-02',
      notes: 'Full 5-game series concluded.',
    },
  ];

  for (const tm of matchTemplates) {
    const homeG = guildsData[tm.homeIdx];
    const awayG = guildsData[tm.awayIdx];
    if (!homeG || !awayG) continue;

    const winnerId = tm.status === 'completed' 
      ? (tm.home_score > tm.away_score ? homeG.id : awayG.id)
      : null;

    const matchRow = {
      id: tm.id,
      season_id: s2Id,
      division_id: grandDivId,
      week: tm.week,
      round: tm.round,
      home_guild_id: homeG.id,
      away_guild_id: awayG.id,
      scheduled_at: tm.scheduled_at,
      started_at: tm.started_at || null,
      completed_at: tm.completed_at || null,
      status: tm.status,
      format: tm.format,
      home_score: tm.home_score,
      away_score: tm.away_score,
      winner_id: winnerId,
      referee_id: refId,
      server_info: tm.server_info,
      notes: tm.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: mErr } = await supabase.from('matches').insert(matchRow);
    if (mErr) console.error('Match insert error:', mErr);
  }
  console.log('✓ Matches successfully seeded with valid UUIDs into Supabase');

  console.log('--- ALL SEEDING COMPLETE ---');
}

seed().catch(console.error);
