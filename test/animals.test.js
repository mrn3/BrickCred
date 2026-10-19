const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Animals = require('../public/js/animals');
const catalog = require('../public/data/catalog.json');
const attachSocial = require('../social');

function player(animals = [], equipped = animals) {
  return {
    id: 'hunter', name: 'Hunter', online: true, friends: ['friend'],
    lifetimeCred: 0, cred: 100, hunt: { level: 1, runCred: 0 },
    inventory: { weapons: [], powerups: [], animals },
    equipped: { weapons: [], powerups: [], animals: equipped }
  };
}

function clientContext() {
  const context = vm.createContext({ Animals, Map });
  const source = fs.readFileSync(path.join(__dirname, '../public/js/state.js'), 'utf8');
  vm.runInContext(source + ';State.catalog = ' + JSON.stringify(catalog), context);
  context.stats = p => {
    context.player = p;
    return vm.runInContext('getCombatStats(player)', context);
  };
  return context;
}

test('more expensive animals always deal more damage', () => {
  assert.ok(catalog.animals.length >= 4);
  const byPrice = [...catalog.animals].sort((a, b) => a.cost - b.cost);
  for (let i = 1; i < byPrice.length; i++) {
    assert.ok(byPrice[i].cost > byPrice[i - 1].cost);
    assert.ok(byPrice[i].attack > byPrice[i - 1].attack);
  }
});

test('at most two owned animals can fight, including owned duplicates', () => {
  assert.deepEqual(Animals.equipped(player(), catalog), []);
  assert.deepEqual(Animals.equipped({}, catalog), []);
  assert.equal(Animals.equipped(player(['a_dog', 'a_wolf', 'a_lion']), catalog).length, 2);
  assert.equal(Animals.equipped(player(['a_dog'], ['a_dog', 'a_dog']), catalog).length, 1);
  assert.equal(Animals.equipped(player(['a_dog', 'a_dog']), catalog).length, 2);
  assert.equal(Animals.equipped(player([], ['a_lion']), catalog).length, 0);
  assert.equal(Animals.equipped(player(['unknown']), catalog).length, 0);
});

test('animals help fists and weapons without altering existing powerup bonuses', () => {
  const context = clientContext();
  const hunter = player(['a_dog', 'a_wolf']);
  hunter.equipped.weapons = ['w_sword_wood'];
  hunter.equipped.powerups = ['p_battle_potion', 'p_health_1'];
  const stats = context.stats(hunter);
  assert.equal(stats.animalAttack, 14);
  assert.equal(stats.attack, Math.round(10 * 1.15) + 14);
  assert.equal(stats.unarmedAttack, Math.round(5 * 1.15) + 14);
  assert.equal(stats.health, 130);
  hunter.equipped.animals = [];
  const unequipped = context.stats(hunter);
  assert.equal(unequipped.attack, Math.round(10 * 1.15));
  assert.equal(unequipped.unarmedAttack, Math.round(5 * 1.15));
  assert.equal(context.stats({ ...hunter, inventory: {}, equipped: { weapons: [], powerups: [] } }).animalAttack, 0);
});

test('legacy players receive empty animal inventory and loadout on joining', () => {
  const handlers = {};
  const context = {
    io: () => ({ on: (name, handler) => { handlers[name] = handler; }, emit() {} }),
    State: {}, Map
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/socketClient.js'), 'utf8');
  vm.runInNewContext(source + ';this.Net = Net', context);
  context.Net.init(() => {});
  const legacy = player();
  delete legacy.inventory.animals;
  delete legacy.equipped.animals;
  handlers.joined({ player: legacy, catalog, listings: [] });
  assert.equal(context.State.player.inventory.animals.length, 0);
  assert.equal(context.State.player.equipped.animals.length, 0);
});

for (const mode of ['fists', 'weapons']) {
  test(`team ${mode} hits use the same two-animal bonus as solo combat`, () => {
    const hunter = player(['a_dog', 'a_wolf', 'a_lion']);
    hunter.equipped.weapons = ['w_sword_wood'];
    hunter.equipped.powerups = ['p_battle_potion'];
    const friend = { ...player(), id: 'friend', name: 'Friend', friends: ['hunter'] };
    const players = { hunter, friend };
    const events = { hunter: [], friend: [] };
    const handlers = {};
    const social = attachSocial({
      io: { to: room => ({ emit: (event, data) => events[room.slice(7)].push({ event, data }) }) },
      db: { players }, store: {}, catalog,
      weaponById: Object.fromEntries(catalog.weapons.map(w => [w.id, w])),
      powerupById: Object.fromEntries(catalog.powerups.map(p => [p.id, p])),
      scheduleSave() {}, publicPlayer: p => p, releaseBuild() {}
    });
    for (const id of Object.keys(players)) {
      social.register({
        currentPlayerId: id,
        on: (event, handler) => { handlers[id + ':' + event] = handler; },
        emit: (event, data) => events[id].push({ event, data })
      });
    }
    try {
      handlers['hunter:partyInvite']({ to: 'friend' });
      const invite = events.friend.find(e => e.event === 'social').data.partyInvites[0];
      handlers['friend:partyAccept']({ partyId: invite.partyId });
      handlers['hunter:partyFightStart']();
      const start = events.hunter.filter(e => e.event === 'partyFight').at(-1).data;
      const member = start.members.find(m => m.id === 'hunter');
      assert.deepEqual(member.animals.map(a => a.id), ['a_dog', 'a_wolf']);
      handlers['hunter:partyHit']({ mode });
      const hit = events.hunter.filter(e => e.event === 'partyFight').at(-1).data.event;
      const stats = clientContext().stats(hunter);
      const attack = mode === 'fists' ? stats.unarmedAttack : stats.attack;
      assert.equal(hit.type, 'hit');
      assert.ok(hit.dmg >= Math.round(attack * 0.85));
      assert.ok(hit.dmg <= Math.round(attack * 1.15));
      assert.ok(hit.dmg > Math.round((attack - stats.animalAttack) * 1.15));
    } finally {
      handlers['hunter:partyLeave']();
      handlers['friend:partyLeave']();
    }
  });
}
