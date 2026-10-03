const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

// 28 Official CAA League Units
const unitDefinitions = [
  // 1. Mercenary Line
  { id: '10000000-0000-0000-0000-000000000001', name: 'Mercenary', star_level: 1, role: 'Melee', evolution_from: null, description: 'Starter unit — cheap frontline unit designed to fill the army when the star budget is limited. Balanced stats and flexible positioning make it a general-purpose infantry unit. Evolves into Squire, then Knight.' },
  { id: '10000000-0000-0000-0000-000000000002', name: 'Squire', star_level: 2, role: 'Melee', evolution_from: '10000000-0000-0000-0000-000000000001', description: 'Evolution of Mercenary — stronger version of Mercenary with improved durability and combat performance. Acts as the middle stage of the Mercenary evolution line. Evolves into Knight.' },
  { id: '10000000-0000-0000-0000-000000000003', name: 'Knight', star_level: 3, role: 'Melee', evolution_from: '10000000-0000-0000-0000-000000000002', description: 'Final Mercenary evolution — armored all-rounder designed for frontline fighting and sustained melee engagements. Has better durability and charge potential than the earlier Mercenary forms.' },

  // 2. Shieldman Line
  { id: '10000000-0000-0000-0000-000000000004', name: 'Shieldman', star_level: 1, role: 'Defense', evolution_from: null, description: 'Starter unit — defensive frontline unit that uses its shield to absorb incoming attacks, particularly ranged fire. Primarily protects ranged units and holds positions. Evolves into Sentinel, then Imperial Wall.' },
  { id: '10000000-0000-0000-0000-000000000005', name: 'Sentinel', star_level: 2, role: 'Defense', evolution_from: '10000000-0000-0000-0000-000000000004', description: 'Evolution of Shieldman — stronger defensive unit with improved survivability and shielding. Designed to maintain a defensive line and protect units positioned behind it. Evolves into Imperial Wall.' },
  { id: '10000000-0000-0000-0000-000000000006', name: 'Imperial Wall', star_level: 3, role: 'Defense', evolution_from: '10000000-0000-0000-0000-000000000005', description: 'Final Shieldman evolution — highly specialized defensive unit focused on absorbing attacks and protecting an area. Has extremely strong blocking capability and is particularly effective against ranged pressure, but has relatively limited reach.' },

  // 3. Spearman Line
  { id: '10000000-0000-0000-0000-000000000007', name: 'Spearman', star_level: 1, role: 'Polearm', evolution_from: null, description: 'Starter unit — inexpensive anti-cavalry infantry. Uses its spear\'s reach to stop mounted units and punish cavalry charges. Evolves into Pikeman.' },
  { id: '10000000-0000-0000-0000-000000000008', name: 'Pikeman', star_level: 2, role: 'Polearm', evolution_from: '10000000-0000-0000-0000-000000000007', description: 'Evolution of Spearman — stronger anti-cavalry unit with improved reach, durability, and anti-charge capability. Designed to form a defensive spear line against Cavalry and Lancer units.' },

  // 4. Halberdier Line
  { id: '10000000-0000-0000-0000-000000000009', name: 'Halberdier', star_level: 2, role: 'Polearm', evolution_from: null, description: 'Standard unit — heavy polearm infantry specialized in dealing damage to shields and defensive formations. Has strong block damage and is particularly useful against shield-heavy formations. Exact star cost can vary by balance patch. Evolves into Imperial Halberdier.' },
  { id: '10000000-0000-0000-0000-000000000010', name: 'Imperial Halberdier', star_level: 3, role: 'Polearm', evolution_from: '10000000-0000-0000-0000-000000000009', description: 'Evolved Halberdier — elite polearm unit with strong reach, damage, and block-damage capability. Designed to break heavily protected formations and punish shield-based defenses.' },

  // 5. Spear Militia Line
  { id: '10000000-0000-0000-0000-000000000011', name: 'Spear Militia', star_level: 2, role: 'Polearm', evolution_from: null, description: 'Standard/banner unit — summons a large group of spear infantry, with reported squad sizes around 30. Relies on numbers and formation density to apply pressure. Evolves into Spear Vanguard.' },
  { id: '10000000-0000-0000-0000-000000000012', name: 'Spear Vanguard', star_level: 3, role: 'Polearm', evolution_from: '10000000-0000-0000-0000-000000000011', description: 'Evolution of Spear Militia — faster and more offensive spear formation with greater reach than the basic militia. Provides anti-cavalry pressure while being more mobile than defensive shield units.' },

  // 6. Archer Line
  { id: '10000000-0000-0000-0000-000000000013', name: 'Archer', star_level: 1, role: 'Ranged', evolution_from: null, description: 'Starter/banner unit — inexpensive ranged support that attacks from behind the frontline. Provides broad ranged coverage while relying on melee units to protect it. Evolves into Longbowman, then Flaming Archers.' },
  { id: '10000000-0000-0000-0000-000000000014', name: 'Longbowman', star_level: 2, role: 'Ranged', evolution_from: '10000000-0000-0000-0000-000000000013', description: 'Evolution of Archer — improved ranged unit with greater attack range and stronger ranged pressure. Intended to stay behind the frontline while continuously attacking enemy units. Evolves into Flaming Archers.' },
  { id: '10000000-0000-0000-0000-000000000015', name: 'Flaming Archers', star_level: 3, role: 'Ranged', evolution_from: '10000000-0000-0000-0000-000000000014', description: 'Final Archer evolution — ranged unit whose attacks apply burn damage over time. Designed for sustained area pressure and damaging groups of enemies from a distance. Community documentation reports its range around 300 after a previous range reduction.' },

  // 7. Crossbowman (No evolution)
  { id: '10000000-0000-0000-0000-000000000016', name: 'Crossbowman', star_level: 3, role: 'Ranged', evolution_from: null, description: 'Standard/banner unit — direct ranged damage dealer with stronger individual projectile pressure than basic Archer. Effective against valuable melee targets but vulnerable if cavalry or enemy ranged units reach its position. No documented evolution path.' },

  // 8. Javelineer Line
  { id: '10000000-0000-0000-0000-000000000017', name: 'Javelineer', star_level: 2, role: 'Ranged', evolution_from: null, description: 'Update 1/banner unit — ranged projectile unit designed to pressure shielded targets. Its reworked attacks reportedly ignore shield damage reduction, making it particularly useful against defensive formations. Evolves into Elite Javelineer.' },
  { id: '10000000-0000-0000-0000-000000000018', name: 'Elite Javelineer', star_level: 3, role: 'Ranged', evolution_from: '10000000-0000-0000-0000-000000000017', description: 'Evolution of Javelineer — upgraded anti-shield ranged unit with stronger projectile pressure. Designed to attack protected targets while remaining behind the main frontline.' },

  // 9. Scout Rider Line
  { id: '10000000-0000-0000-0000-000000000019', name: 'Scout Rider', star_level: 2, role: 'Cavalry', evolution_from: null, description: 'Standard/banner unit — fast mounted unit designed for flanking, chasing ranged units, changing lanes, and quickly pressuring objectives. Evolves into Cavalryman, then Lancer.' },
  { id: '10000000-0000-0000-0000-000000000020', name: 'Cavalryman', star_level: 3, role: 'Cavalry', evolution_from: '10000000-0000-0000-0000-000000000019', description: 'Evolution of Scout Rider — stronger mounted unit with improved charge power and survivability. Retains the mobility of Scout Rider while becoming more effective at breaking enemy formations. Evolves into Lancer.' },
  { id: '10000000-0000-0000-0000-000000000021', name: 'Lancer', star_level: 4, role: 'Cavalry', evolution_from: '10000000-0000-0000-0000-000000000020', description: 'Final Scout Rider evolution — elite cavalry focused on high-speed charges and line breaking. Particularly effective when attacking exposed ranged units and vulnerable backlines. Currently documented as the final form of the Scout Rider evolution chain.' },

  // 10. Special Elites (No evolution)
  { id: '10000000-0000-0000-0000-000000000022', name: 'Spartan', star_level: 4, role: 'Special Melee', evolution_from: null, description: 'Standard/banner elite — heavily equipped spear-and-shield frontline unit designed for holding objectives and surviving prolonged engagements. Strong defensive presence and especially effective when maintaining a formation around an objective. No documented evolution path.' },
  { id: '10000000-0000-0000-0000-000000000023', name: 'Immortal', star_level: 4, role: 'Special Melee', evolution_from: null, description: 'Standard/banner elite — durable offensive melee unit designed for frontal pushes and clearing mixed enemy formations. High survivability allows it to remain in combat longer than fragile damage-focused units. No documented evolution path.' },
  { id: '10000000-0000-0000-0000-000000000024', name: 'Samurai', star_level: 4, role: 'Special Melee', evolution_from: null, description: 'Standard/banner elite — high-damage melee unit that summons a large group of Samurai soldiers. Designed to overwhelm enemy lines through concentrated melee pressure. Has relatively lower durability against concentrated ranged attacks. No documented evolution path.' },
  { id: '10000000-0000-0000-0000-000000000025', name: 'Berserker', star_level: 4, role: 'Special Melee', evolution_from: null, description: 'Standard/banner elite — high-DPS melee unit designed to overwhelm targets through aggressive close-range attacks. Extremely strong offensive pressure but comparatively fragile against ranged damage and heavily protected defensive units. No documented evolution path.' },

  // 11. Mace (No evolution)
  { id: '10000000-0000-0000-0000-000000000026', name: 'Mace', star_level: 3, role: 'Melee', evolution_from: null, description: 'Update 1/banner unit — shield-breaking melee unit with confirmed block-damage capability. Designed specifically to damage shield-heavy formations and defensive units. Does not currently have a documented evolution chain and can instead be strengthened through ascension.' },

  // 12. Rapier Line
  { id: '10000000-0000-0000-0000-000000000027', name: 'Rapier', star_level: 3, role: 'Melee', evolution_from: null, description: 'Update 2 unit — fast melee unit with a Parry trait. Parry allows it to negate or block a portion of incoming attacks. The September 21 balance update reduced its attack interval/intensity from earlier values, while its exact star cost and summon rate remain undocumented. Evolves into Rapier Knight.' },
  { id: '10000000-0000-0000-0000-000000000028', name: 'Rapier Knight', star_level: 4, role: 'Melee', evolution_from: '10000000-0000-0000-0000-000000000027', description: 'Rapier evolution — upgraded Rapier unit that retains the Parry mechanic while providing stronger combat performance. The September 21 balance update increased its reported Parry chance from 20% to 30% while reducing its attack interval/intensity.' },
];

async function seedUnitsAndRosters() {
  console.log('Seeding updated units and 6-player rosters...');

  // 1. Clear old units & insert new 28 units
  await supabase.from('units').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert root units first (no evolution_from)
  const rootUnits = unitDefinitions.filter(u => !u.evolution_from);
  for (const u of rootUnits) {
    const { error } = await supabase.from('units').insert({
      id: u.id,
      name: u.name,
      star_level: u.star_level,
      role: u.role,
      description: u.description,
      image_url: null,
      evolution_from: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Error inserting root unit ${u.name}:`, error);
  }

  // Insert evolved units
  const evolvedUnits = unitDefinitions.filter(u => u.evolution_from);
  for (const u of evolvedUnits) {
    const { error } = await supabase.from('units').insert({
      id: u.id,
      name: u.name,
      star_level: u.star_level,
      role: u.role,
      description: u.description,
      image_url: null,
      evolution_from: u.evolution_from,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(`Error inserting evolved unit ${u.name}:`, error);
  }
  console.log(`✓ Seeded ${unitDefinitions.length} official units with evolution paths!`);

  // 2. Fetch all active guilds
  const { data: guilds, error: gErr } = await supabase
    .from('guilds')
    .select('id, name, tag')
    .eq('status', 'active');

  if (gErr) {
    console.error('Error fetching guilds:', gErr);
    return;
  }

  console.log(`Found ${guilds.length} active guilds. Seeding 6 players per roster...`);

  // Clear existing guild_members to prevent duplicates
  await supabase.from('guild_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const rosterRoles = ['captain', 'co_captain', 'player', 'player', 'player', 'substitute'];

  for (let gIdx = 0; gIdx < guilds.length; gIdx++) {
    const guild = guilds[gIdx];
    const prefix = guild.tag.toLowerCase();

    for (let pIdx = 0; pIdx < 6; pIdx++) {
      const role = rosterRoles[pIdx];
      const memberUuid = `a0000000-${String(gIdx + 1).padStart(4, '0')}-0000-0000-${String(pIdx + 1).padStart(12, '0')}`;
      const profileUuid = `b0000000-${String(gIdx + 1).padStart(4, '0')}-0000-0000-${String(pIdx + 1).padStart(12, '0')}`;

      const username = `${prefix}_${role === 'captain' ? 'captain' : role === 'co_captain' ? 'cocap' : role === 'substitute' ? 'sub' : 'p' + pIdx}`;
      const displayName = `${guild.tag} ${role === 'captain' ? 'Captain' : role === 'co_captain' ? 'Co-Cap' : role === 'substitute' ? 'Sub' : 'Member ' + pIdx}`;
      const robloxUser = `rbx_${username}`;
      const discordUser = `${username}#${1000 + gIdx * 10 + pIdx}`;

      // Upsert profile
      await supabase.from('profiles').upsert({
        id: profileUuid,
        username: username,
        display_name: displayName,
        roblox_username: robloxUser,
        discord_username: discordUser,
        role: role === 'captain' ? 'guild_captain' : 'guild_member',
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Insert guild_member
      const { error: mErr } = await supabase.from('guild_members').insert({
        id: memberUuid,
        guild_id: guild.id,
        player_id: profileUuid,
        role: role,
        joined_at: new Date(Date.now() - (60 - pIdx * 5) * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      });

      if (mErr) console.error(`Error adding member for ${guild.tag}:`, mErr);
    }
  }

  console.log(`✓ Successfully seeded 6 players for every active guild (${guilds.length * 6} total roster members)!`);

  // Ensure referee profile exists
  const refUuid = '88888888-8888-8888-8888-888888888888';
  await supabase.from('profiles').upsert({
    id: refUuid,
    username: 'ref_knight',
    display_name: 'RefKnight — Head Referee',
    roblox_username: 'rbx_refknight',
    discord_username: 'RefKnight#0001',
    role: 'referee',
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Assign referee to matches if not assigned
  await supabase
    .from('matches')
    .update({ referee_id: refUuid })
    .is('referee_id', null);

  console.log('✓ Head Referee profile verified and assigned to matches');
}

seedUnitsAndRosters().catch(console.error);
