const UI = (() => {
  function showTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof Battle !== 'undefined' && Battle.isFighting() && btn.dataset.tab !== 'beasthunters') {
          toast('Finish your fight first!');
          return;
        }
        showTab(btn.dataset.tab);
      });
    });
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  function renderHeader() {
    if (!State.player) return;
    document.getElementById('playerName').textContent = State.player.name;
    document.getElementById('credAmount').textContent = State.player.cred;
    document.getElementById('tierBadge').textContent = getTierInfo(State.player).name;
  }

  function renderStore() {
    const wEl = document.getElementById('weaponList');
    const pEl = document.getElementById('powerupList');
    wEl.innerHTML = '';
    pEl.innerHTML = '';
    const tier = getTierInfo(State.player);

    State.catalog.weapons.forEach(w => {
      const owned = State.player.inventory.weapons.filter(id => id === w.id).length;
      const locked = tier.id < w.tierReq;
      const card = document.createElement('div');
      card.className = 'item-card' + (locked ? ' locked' : '');
      card.innerHTML = `
        <svg class="store-art" role="img" aria-label="${w.name}"><use href="/assets/item-art.svg#${w.id}"></use></svg>
        <div class="item-name">${w.name}</div>
        <div class="item-stat">⚔ Attack +${w.attack}</div>
        <div class="item-cost">💰${w.cost}</div>
        ${owned ? `<div class="owned-tag">Owned x${owned}</div>` : ''}
        ${locked
          ? `<div class="locked-tag">Requires ${State.catalog.tiers.find(t => t.id === w.tierReq).name}</div>`
          : `<button class="buy-btn" data-kind="weapon" data-id="${w.id}">Buy</button>`}`;
      wEl.appendChild(card);
    });

    State.catalog.powerups.forEach(p => {
      const owned = State.player.inventory.powerups.filter(id => id === p.id).length;
      const locked = tier.id < p.tierReq;
      const card = document.createElement('div');
      card.className = 'item-card' + (locked ? ' locked' : '');
      const stats = [];
      if (p.health) stats.push(`❤ +${p.health} HP`);
      if (p.defense) stats.push(`🛡 +${p.defense} DEF`);
      if (p.speed) stats.push(`⚡ +${p.speed} SPD`);
      if (p.regen) stats.push(`♻ +${p.regen} Regen`);
      if (p.attackMult) stats.push(`💥 x${p.attackMult} ATK`);
      if (p.revive) stats.push('✨ Revive');
      card.innerHTML = `
        <svg class="store-art" role="img" aria-label="${p.name}"><use href="/assets/item-art.svg#${p.id}"></use></svg>
        <div class="item-name">${p.name}</div>
        <div class="item-stat">${stats.join(' ')}</div>
        <div class="item-cost">💰${p.cost}</div>
        ${owned ? `<div class="owned-tag">Owned x${owned}</div>` : ''}
        ${locked
          ? `<div class="locked-tag">Requires ${State.catalog.tiers.find(t => t.id === p.tierReq).name}</div>`
          : `<button class="buy-btn" data-kind="powerup" data-id="${p.id}">Buy</button>`}`;
      pEl.appendChild(card);
    });

    wEl.querySelectorAll('.buy-btn').forEach(b => b.addEventListener('click', onBuyItem));
    pEl.querySelectorAll('.buy-btn').forEach(b => b.addEventListener('click', onBuyItem));
  }

  function onBuyItem(e) {
    const { kind, id } = e.target.dataset;
    const item = kind === 'weapon'
      ? State.catalog.weapons.find(w => w.id === id)
      : State.catalog.powerups.find(p => p.id === id);
    if (State.player.cred < item.cost) {
      toast('Not enough creds!');
      return;
    }
    State.player.cred -= item.cost;
    if (kind === 'weapon') State.player.inventory.weapons.push(id);
    else State.player.inventory.powerups.push(id);
    Net.buyItem(id, kind);
    Net.syncPlayer();
    renderAll();
    toast(`Bought ${item.name}!`);
  }

  function countBy(arr) {
    const map = {};
    arr.forEach(id => { map[id] = (map[id] || 0) + 1; });
    return map;
  }

  function renderInventory() {
    const ownedW = document.getElementById('ownedWeapons');
    const eqW = document.getElementById('equippedWeapons');
    const ownedP = document.getElementById('ownedPowerups');
    const eqP = document.getElementById('equippedPowerups');
    ownedW.innerHTML = ''; eqW.innerHTML = ''; ownedP.innerHTML = ''; eqP.innerHTML = '';

    const weaponCounts = countBy(State.player.inventory.weapons);
    Object.entries(weaponCounts).forEach(([id, count]) => {
      const w = State.catalog.weapons.find(x => x.id === id);
      const equippedCount = State.player.equipped.weapons.filter(x => x === id).length;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<div class="item-name">${w.name}</div><div class="item-stat">⚔ +${w.attack}</div><div>Owned: ${count} | Equipped: ${equippedCount}</div>
        <button class="equip-btn" data-kind="weapon" data-id="${id}">Equip</button>`;
      ownedW.appendChild(card);
    });
    State.player.equipped.weapons.forEach((id, idx) => {
      const w = State.catalog.weapons.find(x => x.id === id);
      const card = document.createElement('div');
      card.className = 'item-card equipped';
      card.innerHTML = `<div class="item-name">${w.name}</div><div class="item-stat">⚔ +${w.attack}</div>
        <button class="unequip-btn" data-kind="weapon" data-idx="${idx}">Unequip</button>`;
      eqW.appendChild(card);
    });

    const powerupCounts = countBy(State.player.inventory.powerups);
    Object.entries(powerupCounts).forEach(([id, count]) => {
      const p = State.catalog.powerups.find(x => x.id === id);
      const equippedCount = State.player.equipped.powerups.filter(x => x === id).length;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<div class="item-name">${p.name}</div><div>Owned: ${count} | Equipped: ${equippedCount}</div>
        <button class="equip-btn" data-kind="powerup" data-id="${id}">Equip</button>`;
      ownedP.appendChild(card);
    });
    State.player.equipped.powerups.forEach((id, idx) => {
      const p = State.catalog.powerups.find(x => x.id === id);
      const card = document.createElement('div');
      card.className = 'item-card equipped';
      card.innerHTML = `<div class="item-name">${p.name}</div>
        <button class="unequip-btn" data-kind="powerup" data-idx="${idx}">Unequip</button>`;
      eqP.appendChild(card);
    });

    [[ownedW, 'None yet — visit the Store.'], [ownedP, 'None yet — visit the Store.'], [eqW, 'Nothing equipped.'], [eqP, 'Nothing equipped.']]
      .forEach(([el, msg]) => { if (!el.children.length) el.innerHTML = `<div class="empty-note">${msg}</div>`; });

    ownedW.querySelectorAll('.equip-btn').forEach(b => b.addEventListener('click', onEquip));
    ownedP.querySelectorAll('.equip-btn').forEach(b => b.addEventListener('click', onEquip));
    eqW.querySelectorAll('.unequip-btn').forEach(b => b.addEventListener('click', onUnequip));
    eqP.querySelectorAll('.unequip-btn').forEach(b => b.addEventListener('click', onUnequip));
  }

  function onEquip(e) {
    const { kind, id } = e.target.dataset;
    const key = kind === 'weapon' ? 'weapons' : 'powerups';
    const maxSlots = kind === 'weapon' ? 3 : 2;
    const owned = State.player.inventory[key].filter(x => x === id).length;
    const equipped = State.player.equipped[key].filter(x => x === id).length;
    if (State.player.equipped[key].length >= maxSlots) {
      toast(`Max ${maxSlots} ${key} equipped.`);
      return;
    }
    if (equipped >= owned) {
      toast(`You don't own another unequipped ${kind}.`);
      return;
    }
    State.player.equipped[key].push(id);
    Net.syncPlayer();
    renderAll();
  }

  function onUnequip(e) {
    const { kind, idx } = e.target.dataset;
    const key = kind === 'weapon' ? 'weapons' : 'powerups';
    State.player.equipped[key].splice(Number(idx), 1);
    Net.syncPlayer();
    renderAll();
  }

  const CAT_LABEL = {
    house: '🏠 House', vehicle: '🚗 Vehicle', art: '🖼 Art',
    furniture: '🛋 Furniture', other: '🧱 Creation'
  };
  const CAT_USE = {
    house: 'Move into it from the My Home tab.',
    vehicle: 'Drive it for faster movement in the World.',
    art: 'Hang it on a wall in your home.',
    furniture: 'Place it on your floor for comfort.',
    other: 'Collect it or resell it.'
  };

  function buildUsage(b) {
    const p = State.player;
    const h = p.home || {};
    if (h.houseBuildId === b.id) return 'Living here';
    if ((h.art || []).includes(b.id)) return 'Hanging on your wall';
    if ((h.furniture || []).includes(b.id)) return 'In your room';
    if (p.vehicleBuildId === b.id) return 'Currently driving';
    return '';
  }

  function renderBuildsAndMarket() {
    const yourBuilds = document.getElementById('yourBuildsList');
    yourBuilds.innerHTML = '';
    if (!State.player.builtItems.length) {
      yourBuilds.innerHTML = '<p class="hint">Nothing built yet. Snap some bricks together above!</p>';
    }
    State.player.builtItems.forEach(b => {
      const cat = b.category || 'other';
      const use = buildUsage(b);
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<img class="thumb" src="${b.thumbnail}" alt="" />
        <div class="item-name">${b.name}</div>
        <div class="cat-badge">${CAT_LABEL[cat]}</div>
        <div class="item-stat">${b.brickCount ? b.brickCount + ' bricks' : 'legacy 2D build'}${b.boughtFrom ? ` · from ${b.boughtFrom}` : ''}</div>
        ${use ? `<div class="owned-tag">${use}</div>` : ''}
        ${b.listed ? '<div class="owned-tag">Listed for sale</div>' : ''}
        ${b.model ? `<button class="edit-build-btn" data-id="${b.id}">Open in Studio</button>` : ''}`;
      yourBuilds.appendChild(card);
    });
    yourBuilds.querySelectorAll('.edit-build-btn').forEach(btn => btn.addEventListener('click', e => {
      const b = State.player.builtItems.find(x => x.id === e.target.dataset.id);
      if (b) BuildStudio.loadForEditing(b);
    }));

    const select = document.getElementById('listBuildSelect');
    select.innerHTML = '<option value="">Choose a creation...</option>';
    State.player.builtItems.filter(b => !b.listed).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} — ${CAT_LABEL[b.category || 'other']}`;
      select.appendChild(opt);
    });

    const marketEl = document.getElementById('marketListings');
    marketEl.innerHTML = '';
    if (!State.listings.length) {
      marketEl.innerHTML = '<p class="hint">Nothing for sale right now.</p>';
    }
    State.listings.forEach(l => {
      const isMine = l.sellerId === State.playerId;
      const cat = l.category || 'other';
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<img class="thumb" src="${l.thumbnail}" alt="" /><div class="item-name">${l.name}</div>
        <div class="cat-badge">${CAT_LABEL[cat]}</div>
        <div class="item-stat">by ${l.sellerName}${l.brickCount ? ` · ${l.brickCount} bricks` : ''}</div>
        <div class="use-note">${CAT_USE[cat]}</div>
        <div class="item-cost">💰${l.price}</div>
        ${isMine
          ? `<button class="cancel-btn" data-id="${l.id}">Cancel</button>`
          : `<button class="buy-listing-btn" data-id="${l.id}">Buy</button>`}`;
      marketEl.appendChild(card);
    });
    marketEl.querySelectorAll('.cancel-btn').forEach(b => b.addEventListener('click', e => {
      Net.cancelListing(e.target.dataset.id);
    }));
    marketEl.querySelectorAll('.buy-listing-btn').forEach(b => b.addEventListener('click', e => {
      Net.buyListing(e.target.dataset.id);
    }));
  }

  function initMarketControls() {
    document.getElementById('listBuildBtn').addEventListener('click', () => {
      const select = document.getElementById('listBuildSelect');
      const priceInput = document.getElementById('listPriceInput');
      const buildId = select.value;
      const price = Number(priceInput.value);
      if (!buildId || !price || price <= 0) {
        toast('Choose a creation and set a valid price.');
        return;
      }
      const build = State.player.builtItems.find(b => b.id === buildId);
      const usage = buildUsage(build);
      if (usage && !confirm(`"${build.name}" is currently in use (${usage}). Sell it anyway?`)) return;
      Net.listBuild(build, price);
      priceInput.value = '';
    });
  }

  function renderOnlinePlayers() {
    const list = document.getElementById('onlinePlayersList');
    list.innerHTML = '';
    const me = State.player && State.player.world;
    const distanceTo = p => (me && p.world ? Math.round(Math.hypot(p.world.x - me.x, p.world.y - me.y)) : Infinity);
    State.onlinePlayers
      .filter(p => p.id !== State.playerId)
      .sort((a, b) => distanceTo(a) - distanceTo(b))
      .forEach(p => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'player-link';
        const d = distanceTo(p);
        btn.textContent = `${Social.isFriend(p.id) ? '★ ' : ''}${p.name} (${getTierInfo(p).name})${d === Infinity ? '' : ` · ${d}m`}`;
        btn.addEventListener('click', e => Social.openPlayerMenu(p.id, e.clientX, e.clientY));
        li.appendChild(btn);
        list.appendChild(li);
      });
    if (!list.children.length) list.innerHTML = '<li>No one else is online yet.</li>';
  }

  function renderAll() {
    renderHeader();
    renderStore();
    renderInventory();
    renderBuildsAndMarket();
    renderOnlinePlayers();
    if (typeof Home !== 'undefined') Home.render();
    if (typeof Battle !== 'undefined') Battle.render();
  }

  return { initTabs, showTab, toast, renderAll, initMarketControls, renderOnlinePlayers };
})();
