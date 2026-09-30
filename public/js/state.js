const State = {
  playerId: null,
  player: null,
  account: null,
  catalog: null,
  listings: [],
  onlinePlayers: [],
  social: { friends: [], incoming: [], outgoing: [], offers: [], partyInvites: [] },
  party: null
};

function getTierInfo(player) {
  const tiers = State.catalog.tiers;
  let current = tiers[0];
  for (const t of tiers) {
    if (player.lifetimeCred >= t.threshold) current = t;
  }
  return current;
}

function weaponsById(ids) {
  return ids.map(id => State.catalog.weapons.find(w => w.id === id)).filter(Boolean);
}
function powerupsById(ids) {
  return ids.map(id => State.catalog.powerups.find(p => p.id === id)).filter(Boolean);
}

function getCombatStats(player) {
  const tier = getTierInfo(player);
  const equippedWeapons = weaponsById(player.equipped.weapons || []);
  const equippedPowerups = powerupsById(player.equipped.powerups || []);
  const homeStats = getHomeStats(player);
  const baseAttack = 5 + tier.bonusAttack;
  let attack = baseAttack + equippedWeapons.reduce((s, w) => s + w.attack, 0);
  let health = 100 + tier.bonusHealth + homeStats.bonusHealth;
  let defense = 0;
  let attackMult = 1;
  let regen = 0;
  let revive = 0;
  equippedPowerups.forEach(p => {
    if (p.health) health += p.health;
    if (p.defense) defense += p.defense;
    if (p.attackMult) attackMult *= p.attackMult;
    if (p.regen) regen += p.regen;
    if (p.revive) revive += p.revive;
  });
  attack = Math.round(attack * attackMult);
  const unarmedAttack = Math.round(baseAttack * attackMult);
  return { attack, unarmedAttack, health, defense, regen, revive, tier, homeStats };
}

function findBuild(player, id) {
  if (!id || !player || !player.builtItems) return null;
  return player.builtItems.find(b => b.id === id) || null;
}

// Comfort turns owned creations (built or bought) into real gameplay value.
function getHomeStats(player) {
  const h = (player && player.home) || {};
  const house = findBuild(player, h.houseBuildId);
  if (!house) return { comfort: 0, house: null, bonusHealth: 0, income: 0, art: 0, furniture: 0, size: 0 };
  const size = Math.min(60, Math.round((house.brickCount || 20) / 2));
  const art = (h.art || []).filter(id => findBuild(player, id)).length;
  const furniture = (h.furniture || []).filter(id => findBuild(player, id)).length;
  const comfort = size + art * 8 + furniture * 5;
  return {
    comfort, house, size, art, furniture,
    bonusHealth: comfort * 2,
    income: Math.max(1, Math.floor(comfort / 5))
  };
}

function getVehicleStats(player) {
  const vehicle = findBuild(player, player && player.vehicleBuildId);
  if (!vehicle) return { vehicle: null, speedMult: 1 };
  return { vehicle, speedMult: 1 + Math.min(1.2, (vehicle.brickCount || 10) / 40) };
}
