// Friends tab: friend requests, gifts/sales to friends and team invites.
const Social = (() => {
  let trade = null;

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'onclick') node.addEventListener('click', v);
      else if (k === 'className') node.className = v;
      else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
    });
    children.flat().forEach(c => node.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return node;
  }

  const S = () => State.social || { friends: [], incoming: [], outgoing: [], offers: [], partyInvites: [] };
  const friend = id => S().friends.find(f => f.id === id);
  const isFriend = id => !!friend(id);
  const tierName = p => getTierInfo(p).name;

  function init() {
    document.getElementById('addFriendForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('addFriendInput');
      const name = input.value.trim();
      if (!name) return;
      Net.social.friendRequest(null, name);
      input.value = '';
    });
    document.getElementById('tradeForm').addEventListener('submit', onTradeSubmit);
    document.getElementById('tradeCancelBtn').addEventListener('click', closeTrade);
    document.getElementById('tradeItem').addEventListener('change', updateTradeAmount);
    document.addEventListener('click', e => {
      const menu = document.getElementById('playerMenu');
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !e.target.closest('.player-link') && e.target.id !== 'worldCanvas') {
        menu.classList.add('hidden');
      }
    });
    render();
  }

  function renderBadge() {
    const s = S();
    const incomingOffers = s.offers.filter(o => o.toId === State.playerId).length;
    const count = s.incoming.length + s.partyInvites.length + incomingOffers;
    const badge = document.getElementById('friendsBadge');
    badge.textContent = count;
    badge.classList.toggle('hidden', !count);
  }

  function render() {
    if (!State.player || !document.getElementById('friendsList')) return;
    const s = S();
    renderBadge();

    const requests = document.getElementById('friendRequests');
    requests.replaceChildren(...s.incoming.map(p => el('li', { className: 'social-row' },
      el('span', { className: 'social-name' }, `${p.name} wants to be friends`),
      el('button', { className: 'primary-btn', onclick: () => Net.social.friendRespond(p.id, true) }, 'Accept'),
      el('button', { className: 'danger-btn', onclick: () => Net.social.friendRespond(p.id, false) }, 'Decline'))));
    s.outgoing.forEach(p => requests.append(el('li', { className: 'social-row muted' },
      el('span', { className: 'social-name' }, `Waiting on ${p.name}…`),
      el('button', { className: 'danger-btn', onclick: () => Net.social.friendRemove(p.id) }, 'Cancel'))));
    s.partyInvites.forEach(inv => requests.append(el('li', { className: 'social-row invite' },
      el('span', { className: 'social-name' }, `⚔ ${inv.from ? inv.from.name : 'A friend'} invited you to team up`),
      el('button', { className: 'primary-btn', onclick: () => { Net.social.partyAccept(inv.partyId); UI.showTab('beasthunters'); } }, 'Join Team'),
      el('button', { className: 'danger-btn', onclick: () => Net.social.partyDecline(inv.partyId) }, 'Decline'))));
    s.offers.forEach(o => {
      const incoming = o.toId === State.playerId;
      requests.append(el('li', { className: 'social-row offer' },
        o.thumbnail ? el('img', { className: 'offer-thumb', src: o.thumbnail, alt: '' }) : '',
        el('span', { className: 'social-name' }, incoming
          ? `${o.fromName} is selling you ${o.name} for 💰${o.price}`
          : `You offered ${o.name} to ${o.toName} for 💰${o.price}`),
        ...(incoming
          ? [el('button', { className: 'buy-listing-btn', onclick: () => Net.social.offerRespond(o.id, true) }, 'Buy'),
             el('button', { className: 'danger-btn', onclick: () => Net.social.offerRespond(o.id, false) }, 'Decline')]
          : [el('button', { className: 'danger-btn', onclick: () => Net.social.offerCancel(o.id) }, 'Cancel')])));
    });
    if (!requests.children.length) requests.append(el('li', { className: 'empty-note' }, 'No requests, invites or offers right now.'));

    const list = document.getElementById('friendsList');
    const friends = [...s.friends].sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
    list.replaceChildren(...friends.map(f => {
      const inParty = State.party && State.party.members.some(m => m.id === f.id);
      return el('li', { className: 'friend-row' },
        el('div', { className: 'friend-head' },
          el('span', { className: 'dot ' + (f.online ? 'on' : 'off') }),
          el('strong', {}, f.name),
          el('span', { className: 'friend-meta' }, `${tierName(f)} · Beast lvl ${f.level}`)),
        el('div', { className: 'friend-actions' },
          el('button', { className: 'primary-btn', onclick: () => openTrade(f.id, 'gift') }, '🎁 Gift'),
          el('button', { className: 'buy-listing-btn', onclick: () => openTrade(f.id, 'sell') }, '💰 Sell'),
          f.online && !inParty ? el('button', { className: 'team-btn', onclick: () => Net.social.partyInvite(f.id) }, '⚔ Team Up') : '',
          f.online ? el('button', { className: 'danger-btn', onclick: () => visit(f.id) }, '📍 Visit') : '',
          el('button', { className: 'link-btn', onclick: () => { if (confirm(`Remove ${f.name} from your friends?`)) Net.social.friendRemove(f.id); } }, 'Remove')));
    }));
    if (!friends.length) list.append(el('li', { className: 'empty-note' }, 'No friends yet. Add someone by username, or click a player in the World.'));

  }

  function visit(id) {
    const p = State.onlinePlayers.find(x => x.id === id);
    if (!p || !p.world) return UI.toast('They are not in the World right now.');
    World.goTo(p.world.x, p.world.y);
  }

  // ---------- Player popup (World clicks / online list) ----------

  function openPlayerMenu(id, clientX, clientY) {
    const p = State.onlinePlayers.find(x => x.id === id) || friend(id);
    if (!p) return;
    const s = S();
    const menu = document.getElementById('playerMenu');
    const close = () => menu.classList.add('hidden');
    const act = (label, fn, cls) => el('button', { className: cls || '', onclick: () => { close(); fn(); } }, label);
    const items = [el('div', { className: 'menu-title' }, `${p.name} · ${tierName(p)}`)];
    if (isFriend(id)) {
      items.push(
        act('🎁 Gift', () => openTrade(id, 'gift'), 'primary-btn'),
        act('💰 Sell to', () => openTrade(id, 'sell'), 'buy-listing-btn'),
        act('⚔ Team Up', () => Net.social.partyInvite(id), 'team-btn'));
    } else if (s.incoming.some(r => r.id === id)) {
      items.push(act('✅ Accept Friend', () => Net.social.friendRespond(id, true), 'primary-btn'));
    } else if (s.outgoing.some(r => r.id === id)) {
      items.push(el('div', { className: 'empty-note' }, 'Friend request sent.'));
    } else {
      items.push(act('➕ Add Friend', () => Net.social.friendRequest(id), 'primary-btn'));
    }
    const online = State.onlinePlayers.find(x => x.id === id);
    if (online && online.world) items.push(act('📍 Go to', () => World.goTo(online.world.x, online.world.y), 'danger-btn'));
    menu.replaceChildren(...items);
    menu.classList.remove('hidden');
    const w = 190, h = menu.offsetHeight || 200;
    menu.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, clientX + 8)) + 'px';
    menu.style.top = Math.min(window.innerHeight - h - 8, Math.max(8, clientY + 8)) + 'px';
  }

  // ---------- Gift / sell modal ----------

  function tradeOptions(mode) {
    const p = State.player;
    const opts = [];
    if (mode === 'gift') opts.push({ value: 'cred:', label: `💰 Creds (you have ${p.cred})` });
    const countBy = arr => arr.reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {});
    [['weapon', 'weapons', State.catalog.weapons, '⚔'], ['powerup', 'powerups', State.catalog.powerups, '✨']].forEach(([kind, key, cat, icon]) => {
      const owned = countBy(p.inventory[key] || []);
      const equipped = countBy(p.equipped[key] || []);
      Object.entries(owned).forEach(([id, n]) => {
        const item = cat.find(x => x.id === id);
        const free = n - (equipped[id] || 0);
        if (item && free > 0) opts.push({ value: `${kind}:${id}`, label: `${icon} ${item.name} (${free} spare)` });
      });
    });
    p.builtItems.filter(b => !b.listed).forEach(b => opts.push({ value: `build:${b.id}`, label: `🧱 ${b.name}` }));
    return opts;
  }

  function openTrade(friendId, mode) {
    const f = friend(friendId);
    if (!f) return;
    const opts = tradeOptions(mode);
    if (!opts.length) return UI.toast(mode === 'sell' ? 'You have nothing spare to sell. Unequipped gear and creations can be sold.' : 'You have nothing to gift.');
    trade = { friendId, mode };
    document.getElementById('tradeTitle').textContent = mode === 'gift' ? `🎁 Gift to ${f.name}` : `💰 Sell to ${f.name}`;
    const select = document.getElementById('tradeItem');
    select.replaceChildren(...opts.map(o => el('option', { value: o.value }, o.label)));
    document.getElementById('tradeAmount').value = '';
    document.getElementById('tradeSubmit').textContent = mode === 'gift' ? 'Send Gift' : 'Send Offer';
    updateTradeAmount();
    document.getElementById('tradeModal').classList.remove('hidden');
  }

  function updateTradeAmount() {
    if (!trade) return;
    const isCred = document.getElementById('tradeItem').value === 'cred:';
    const needsAmount = trade.mode === 'sell' || isCred;
    const input = document.getElementById('tradeAmount');
    input.classList.toggle('hidden', !needsAmount);
    input.required = needsAmount;
    input.placeholder = trade.mode === 'sell' ? 'Price in creds' : 'How many creds?';
    document.getElementById('tradeHint').textContent = trade.mode === 'sell'
      ? 'Your friend gets an offer they can accept within 10 minutes.'
      : 'Gifts are sent instantly.';
  }

  function closeTrade() {
    trade = null;
    document.getElementById('tradeModal').classList.add('hidden');
  }

  function onTradeSubmit(e) {
    e.preventDefault();
    if (!trade) return;
    const value = document.getElementById('tradeItem').value;
    const i = value.indexOf(':');
    const kind = value.slice(0, i), itemId = value.slice(i + 1);
    const amount = Math.floor(Number(document.getElementById('tradeAmount').value));
    if ((trade.mode === 'sell' || kind === 'cred') && !(amount >= 1)) return UI.toast('Enter a valid amount.');
    if (kind === 'build') {
      const b = State.player.builtItems.find(x => x.id === itemId);
      const inUse = b && (State.player.home.houseBuildId === b.id || State.player.vehicleBuildId === b.id ||
        (State.player.home.art || []).includes(b.id) || (State.player.home.furniture || []).includes(b.id));
      if (inUse && !confirm(`"${b.name}" is in use in your home or garage. Send it anyway?`)) return;
    }
    if (trade.mode === 'gift') Net.social.gift(trade.friendId, kind, itemId, amount);
    else Net.social.offer(trade.friendId, kind, itemId, amount);
    closeTrade();
  }

  return { init, render, openPlayerMenu, isFriend };
})();
