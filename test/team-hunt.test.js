const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const attachSocial = require('../social');

test('friend presence updates the Beast Hunters invite panel after joining', () => {
  const handlers = {};
  let battleRenders = 0;
  const context = {
    io: () => ({ on: (event, handler) => { handlers[event] = handler; }, emit() {} }),
    State: { player: null, social: null },
    Social: { render() {} },
    Battle: { render() { battleRenders++; } },
    UI: { renderAll() {} },
    Map
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/socketClient.js'), 'utf8');
  vm.runInNewContext(source + ';this.Net = Net', context);
  context.Net.init(() => {});
  handlers.joined({ player: { id: 'hunter' }, catalog: {}, listings: [] });
  handlers.social({ friends: [{ id: 'friend', online: true }] });
  assert.equal(battleRenders, 1);
  assert.equal(context.State.social.friends[0].online, true);
});

test('friends can accept an invite and fight the same beast', () => {
  const players = {
    hunter: { id: 'hunter', name: 'Hunter', online: true, friends: ['friend'], hunt: { level: 1, runCred: 0 }, cred: 0, lifetimeCred: 0 },
    friend: { id: 'friend', name: 'Friend', online: true, friends: ['hunter'], hunt: { level: 1, runCred: 0 }, cred: 0, lifetimeCred: 0 }
  };
  const events = { hunter: [], friend: [] };
  const handlers = {};
  const io = { to: room => ({ emit: (event, data) => events[room.slice(7)].push({ event, data }) }) };
  const social = attachSocial({
    io, db: { players }, store: {}, catalog: { tiers: [{ threshold: 0, bonusAttack: 0, bonusHealth: 0 }] },
    weaponById: {}, powerupById: {}, scheduleSave() {}, publicPlayer: player => player, releaseBuild() {}
  });
  for (const id of Object.keys(players)) {
    const socket = { currentPlayerId: id, on: (event, handler) => { handlers[id + ':' + event] = handler; }, emit: (event, data) => events[id].push({ event, data }) };
    social.register(socket);
  }
  handlers['hunter:partyInvite']({ to: 'friend' });
  const invite = events.friend.find(entry => entry.event === 'social').data.partyInvites[0];
  assert.ok(invite.partyId);
  handlers['friend:partyAccept']({ partyId: invite.partyId });
  assert.equal(events.hunter.filter(entry => entry.event === 'party').at(-1).data.members.length, 2);
  handlers['hunter:partyFightStart']();
  assert.equal(events.friend.filter(entry => entry.event === 'partyFight').at(-1).data.event.type, 'start');
  handlers['friend:partyHit']({ mode: 'fists' });
  assert.equal(events.hunter.filter(entry => entry.event === 'partyFight').at(-1).data.event.by, 'friend');
  handlers['hunter:partyLeave']();
  handlers['friend:partyLeave']();
});