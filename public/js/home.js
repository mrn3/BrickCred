// Ownership payoff: live in a house you built or bought, decorate it, and drive
// a vehicle you own. Everything here reads from State.player.builtItems, so
// creations bought from other players work exactly like ones you made.
const Home = (() => {
  const ART_SLOTS = 4;
  const FLOOR_SLOTS = 4;
  let canvas, ctx;
  const imgCache = new Map();

  function init() {
    canvas = document.getElementById('homeCanvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', onCanvasClick);
    document.getElementById('moveInBtn').addEventListener('click', moveIn);
    document.getElementById('moveOutBtn').addEventListener('click', moveOut);
    document.getElementById('driveBtn').addEventListener('click', drive);
    document.getElementById('parkBtn').addEventListener('click', park);
    document.getElementById('pickerCloseBtn').addEventListener('click', closePicker);
  }

  function home() {
    if (!State.player.home) State.player.home = { houseBuildId: null, art: [], furniture: [] };
    const h = State.player.home;
    h.art = h.art || [];
    h.furniture = h.furniture || [];
    while (h.art.length < ART_SLOTS) h.art.push(null);
    while (h.furniture.length < FLOOR_SLOTS) h.furniture.push(null);
    return h;
  }

  function ownedOf(category) {
    return State.player.builtItems.filter(b => (b.category || 'other') === category && !b.listed);
  }

  // ------------------------------------------------------------ slot layout
  function artSlots() {
    const out = [];
    for (let i = 0; i < ART_SLOTS; i++) {
      out.push({ i, x: 60 + i * 180, y: 55, w: 140, h: 110 });
    }
    return out;
  }
  function floorSlots() {
    const p = [[130, 300], [320, 340], [500, 300], [680, 340]];
    return p.map((c, i) => ({ i, x: c[0] - 65, y: c[1] - 50, w: 130, h: 100 }));
  }

  function onCanvasClick(e) {
    const h = home();
    if (!findBuild(State.player, h.houseBuildId)) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    for (const s of artSlots()) {
      if (hit(s, x, y)) return openPicker('art', s.i);
    }
    for (const s of floorSlots()) {
      if (hit(s, x, y)) return openPicker('furniture', s.i);
    }
  }
  const hit = (s, x, y) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;

  // ------------------------------------------------------------- the picker
  let pickerKind = null, pickerSlot = 0;
  function openPicker(kind, slot) {
    pickerKind = kind; pickerSlot = slot;
    const modal = document.getElementById('pickerModal');
    const list = document.getElementById('pickerList');
    document.getElementById('pickerTitle').textContent =
      kind === 'art' ? 'Hang art on this wall' : 'Place furniture here';
    list.innerHTML = '';
    const used = home()[kind];
    const options = ownedOf(kind).filter(b => !used.includes(b.id) || used[slot] === b.id);
    if (!options.length) {
      list.innerHTML = `<p class="hint">You don't own any ${kind} yet. Build some in the Build Studio or buy it from another player in the Marketplace.</p>`;
    }
    options.forEach(b => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<img class="thumb" src="${b.thumbnail}" alt="" /><div class="item-name">${b.name}</div>
        ${b.boughtFrom ? `<div class="item-stat">bought from ${b.boughtFrom}</div>` : ''}`;
      card.addEventListener('click', () => assign(b.id));
      list.appendChild(card);
    });
    if (used[slot]) {
      const rm = document.createElement('button');
      rm.className = 'danger-btn';
      rm.textContent = 'Take it down';
      rm.addEventListener('click', () => assign(null));
      list.appendChild(rm);
    }
    modal.classList.remove('hidden');
  }

  function closePicker() {
    document.getElementById('pickerModal').classList.add('hidden');
  }

  function assign(buildId) {
    home()[pickerKind][pickerSlot] = buildId;
    closePicker();
    Net.syncPlayer();
    UI.renderAll();
    UI.toast(buildId ? 'Looking good!' : 'Removed.');
  }

  // ------------------------------------------------------------ house/car
  function moveIn() {
    const id = document.getElementById('houseSelect').value;
    if (!id) return UI.toast('Pick a house first.');
    home().houseBuildId = id;
    Net.syncPlayer();
    UI.renderAll();
    UI.toast('🏠 You moved in! Hang up art and add furniture for bonuses.');
  }

  function moveOut() {
    const h = home();
    h.houseBuildId = null;
    h.art = h.art.map(() => null);
    h.furniture = h.furniture.map(() => null);
    Net.syncPlayer();
    UI.renderAll();
    UI.toast('You moved out.');
  }

  function drive() {
    const id = document.getElementById('vehicleSelect').value;
    if (!id) return UI.toast('Pick a vehicle first.');
    State.player.vehicleBuildId = id;
    Net.syncPlayer();
    UI.renderAll();
    UI.toast('🚗 Head to a road and press F to get in.');
  }

  function park() {
    State.player.vehicleBuildId = null;
    State.player.world.inVehicle = false;
    State.player.world.vehicleParked = false;
    Net.syncPlayer();
    UI.renderAll();
  }

  // -------------------------------------------------------------- rendering
  function image(src) {
    if (!src) return null;
    let img = imgCache.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => { if (isVisible()) drawRoom(); };
      img.src = src;
      imgCache.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }
  const isVisible = () => document.getElementById('tab-home').classList.contains('active');

  function render() {
    const h = home();
    const stats = getHomeStats(State.player);
    const vstats = getVehicleStats(State.player);

    const houses = ownedOf('house');
    fillSelect('houseSelect', houses, h.houseBuildId, 'Choose a house you own...');
    fillSelect('vehicleSelect', ownedOf('vehicle'), State.player.vehicleBuildId, 'Choose a vehicle you own...');

    document.getElementById('moveOutBtn').classList.toggle('hidden', !stats.house);
    document.getElementById('parkBtn').classList.toggle('hidden', !vstats.vehicle);

    const status = document.getElementById('homeStatus');
    if (!stats.house) {
      status.innerHTML = houses.length
        ? '<p class="hint">Pick one of your houses and move in.</p>'
        : '<p class="hint">You have nowhere to live yet. Build a house in the <b>Build Studio</b> (set its type to 🏠 House) or buy one from another player in the <b>Marketplace</b>.</p>';
    } else {
      status.innerHTML = `
        <div class="home-card">
          <img class="thumb big" src="${stats.house.thumbnail}" alt="" />
          <div>
            <div class="item-name">${stats.house.name}</div>
            <div class="item-stat">${stats.house.brickCount || '?'} bricks${stats.house.boughtFrom ? ` · bought from ${stats.house.boughtFrom}` : ''}</div>
            <div class="item-stat">🖼 ${stats.art}/${ART_SLOTS} art · 🛋 ${stats.furniture}/${FLOOR_SLOTS} furniture</div>
          </div>
        </div>`;
    }

    document.getElementById('homeBonuses').innerHTML = `
      <div class="bonus"><span>Comfort</span><b>${stats.comfort}</b></div>
      <div class="bonus"><span>Battle Health</span><b>+${stats.bonusHealth} HP</b></div>
      <div class="bonus"><span>Income</span><b>${stats.income}/min</b></div>
      <div class="bonus"><span>Move Speed</span><b>×${vstats.speedMult.toFixed(2)}</b></div>`;

    const vEl = document.getElementById('vehicleStatus');
    vEl.innerHTML = vstats.vehicle
      ? `<div class="home-card"><img class="thumb" src="${vstats.vehicle.thumbnail}" alt="" />
           <div><div class="item-name">${vstats.vehicle.name}</div>
           <div class="item-stat">Driving now · ×${vstats.speedMult.toFixed(2)} speed</div></div></div>`
      : '<p class="hint">Build a vehicle with wheels (Vehicle parts group) or buy one, then drive it.</p>';

    drawRoom();
  }

  function fillSelect(id, builds, current, placeholder) {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    builds.forEach(b => {
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name + (b.boughtFrom ? ` (from ${b.boughtFrom})` : '');
      if (b.id === current) o.selected = true;
      sel.appendChild(o);
    });
  }

  function drawRoom() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const h = home();
    const house = findBuild(State.player, h.houseBuildId);

    ctx.clearRect(0, 0, W, H);
    if (!house) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#64748b';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No home yet — move into a house to unlock your room.', W / 2, H / 2);
      return;
    }

    // walls + floor
    const wallBottom = 250;
    const g = ctx.createLinearGradient(0, 0, 0, wallBottom);
    g.addColorStop(0, '#f6e7cf');
    g.addColorStop(1, '#e6d2b3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, wallBottom);
    ctx.fillStyle = '#b4886a';
    ctx.fillRect(0, wallBottom - 14, W, 14);
    const fg = ctx.createLinearGradient(0, wallBottom, 0, H);
    fg.addColorStop(0, '#c98d5a');
    fg.addColorStop(1, '#9c6438');
    ctx.fillStyle = fg;
    ctx.fillRect(0, wallBottom, W, H - wallBottom);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let i = -6; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + (i * 60 - W / 2) * 0.35, wallBottom);
      ctx.lineTo(i * 100 - 200, H);
      ctx.stroke();
    }
    for (let y = wallBottom + 30; y < H; y += 38) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    floorSlots().forEach(s => {
      const id = h.furniture[s.i];
      const b = findBuild(State.player, id);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h - 6, s.w * 0.36, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (b) {
        const img = image(b.thumbnail);
        if (img) ctx.drawImage(img, s.x, s.y - 10, s.w, s.h);
        label(b.name, s.x + s.w / 2, s.y + s.h + 14);
      } else {
        dashed(s, '+ place furniture');
      }
    });

    artSlots().forEach(s => {
      const id = h.art[s.i];
      const b = findBuild(State.player, id);
      if (b) {
        ctx.fillStyle = '#7a4a24';
        ctx.fillRect(s.x - 8, s.y - 8, s.w + 16, s.h + 16);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
        const img = image(b.thumbnail);
        if (img) ctx.drawImage(img, s.x, s.y, s.w, s.h);
        label(b.name, s.x + s.w / 2, s.y + s.h + 24);
      } else {
        dashed(s, '+ hang art');
      }
    });

    ctx.fillStyle = 'rgba(15,23,42,0.65)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Click a frame or floor pad to place something you own.', 12, H - 12);
  }

  function dashed(s, text) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(30,41,59,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(30,41,59,0.55)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, s.x + s.w / 2, s.y + s.h / 2);
    ctx.restore();
  }

  function label(text, x, y) {
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text.length > 20 ? text.slice(0, 19) + '…' : text, x, y);
  }

  return { init, render, drawRoom };
})();
