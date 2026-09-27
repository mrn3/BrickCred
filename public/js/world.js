const World = (() => {
  const WORLD_WIDTH = 2400;
  const WORLD_HEIGHT = 1600;
  const PLAYER_MARGIN = 40;
  let canvas, ctx;
  let px = 400, py = 300;
  let cameraX = 0, cameraY = 0;
  let facing = 1;
  let moving = false;
  let phase = 0;
  let lastMoveSent = 0;
  const keys = {};
  // Normalized -1..1 vector from the on-screen touch stick.
  const stick = { x: 0, y: 0 };
  // Smoothed on-screen state for other players, keyed by player id.
  const remote = new Map();

  function init() {
    canvas = document.getElementById('worldCanvas');
    ctx = canvas.getContext('2d');
    px = State.player.world.x;
    py = State.player.world.y;
    window.addEventListener('keydown', e => {
      if (isTyping(e.target)) return;
      keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => Object.keys(keys).forEach(k => { keys[k] = false; }));
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', e => {
      canvas.style.cursor = playerAt(e) ? 'pointer' : 'default';
    });
    document.getElementById('placeHomeBtn').addEventListener('click', placeHome);
    document.getElementById('worldChatForm').addEventListener('submit', sendChat);
    initJoystick();
    requestAnimationFrame(loop);
  }

  function initJoystick() {
    const pad = document.getElementById('worldJoystick');
    const knob = pad.querySelector('.joystick-knob');
    let activeId = null;

    const setKnob = (x, y) => {
      knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const reset = () => {
      activeId = null;
      stick.x = 0;
      stick.y = 0;
      setKnob(0, 0);
    };
    const track = e => {
      const r = pad.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = e.clientX - (r.left + radius);
      let dy = e.clientY - (r.top + radius);
      const dist = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(dist, radius);
      dx = (dx / dist) * clamped;
      dy = (dy / dist) * clamped;
      setKnob(dx, dy);
      const dead = radius * 0.2;
      if (clamped < dead) {
        stick.x = 0;
        stick.y = 0;
      } else {
        stick.x = dx / radius;
        stick.y = dy / radius;
      }
    };

    pad.addEventListener('pointerdown', e => {
      activeId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      track(e);
      e.preventDefault();
    });
    pad.addEventListener('pointermove', e => {
      if (e.pointerId !== activeId) return;
      track(e);
      e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      pad.addEventListener(type, e => {
        if (e.pointerId === activeId) reset();
      });
    });
    window.addEventListener('blur', reset);
  }

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function playerAt(e) {
    const { x, y } = canvasPoint(e);
    for (const [id, r] of remote) {
      const sx = r.x - cameraX, sy = r.y - cameraY;
      if (Math.abs(x - sx) < 35 && y > sy - 75 && y < sy + 80) return id;
    }
    return null;
  }

  function onCanvasClick(e) {
    const id = playerAt(e);
    if (id) Social.openPlayerMenu(id, e.clientX, e.clientY);
    else document.getElementById('playerMenu').classList.add('hidden');
  }

  function goTo(x, y) {
    px = Math.min(WORLD_WIDTH - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, x + 120));
    py = Math.min(WORLD_HEIGHT - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, y));
    State.player.world.x = px;
    State.player.world.y = py;
    Net.moveWorld(px, py);
    UI.showTab('world');
    UI.renderOnlinePlayers();
  }

  function isTyping(el) {
    const t = el && el.tagName;
    return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA';
  }

  const imgCache = new Map();
  function image(src) {
    if (!src) return null;
    let img = imgCache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      imgCache.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  function update(timestamp) {
    let dx = 0, dy = 0;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (stick.x || stick.y) {
      dx = stick.x;
      dy = stick.y;
    }
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    moving = dx !== 0 || dy !== 0;
    if (dx !== 0) facing = dx > 0 ? 1 : -1;
    const speed = 3 * (State.player ? getVehicleStats(State.player).speedMult : 1);
    px = Math.min(WORLD_WIDTH - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, px + dx * speed));
    py = Math.min(WORLD_HEIGHT - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, py + dy * speed));
    cameraX = Math.min(WORLD_WIDTH - canvas.width, Math.max(0, px - canvas.width / 2));
    cameraY = Math.min(WORLD_HEIGHT - canvas.height, Math.max(0, py - canvas.height / 2));
    if (moving) {
      phase += 0.25;
      State.player.world.x = px;
      State.player.world.y = py;
      if (timestamp - lastMoveSent >= 100) {
        Net.moveWorld(px, py);
        lastMoveSent = timestamp;
      }
    } else {
      phase = 0;
    }
    updateRemote();
  }

  function updateRemote() {
    const seen = new Set();
    State.onlinePlayers.forEach(p => {
      if (p.id === State.playerId || !p.world) return;
      seen.add(p.id);
      let r = remote.get(p.id);
      if (!r) {
        r = { x: p.world.x, y: p.world.y, facing: 1, phase: 0, moving: false };
        remote.set(p.id, r);
      }
      const dx = p.world.x - r.x, dy = p.world.y - r.y;
      r.moving = Math.hypot(dx, dy) > 1.5;
      if (Math.abs(dx) > 1) r.facing = dx > 0 ? 1 : -1;
      r.x += dx * 0.2;
      r.y += dy * 0.2;
      r.phase = r.moving ? r.phase + 0.25 : 0;
    });
    for (const id of remote.keys()) if (!seen.has(id)) remote.delete(id);
  }

  function drawGround() {
    ctx.fillStyle = '#7fd858';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    const startX = -(cameraX % 40);
    const startY = -(cameraY % 40);
    for (let x = startX; x < canvas.width; x += 40) {
      for (let y = startY; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.arc(x + 20, y + 20, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(30,41,59,0.65)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`World ${Math.round(px)}, ${Math.round(py)}`, 12, 22);
  }

  function drawHouse(player) {
    if (!player.house || !player.world) return;
    const img = image(player.house.thumbnail);
    const x = player.world.homeX - cameraX;
    const y = player.world.homeY - cameraY;
    if (img) ctx.drawImage(img, x - 85, y - 85, 170, 170);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${player.name}'s home`, x, y + 92);
  }

  function drawBubble(message, x, y) {
    const text = message.length > 34 ? message.slice(0, 33) + '…' : message;
    ctx.font = '12px sans-serif';
    const width = Math.min(240, ctx.measureText(text).width + 18);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillRect(x - width / 2, y - 18, width, 24);
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 2);
  }

  function drawPlayer(player, isLocal) {
    const r = isLocal ? null : remote.get(player.id);
    if (!isLocal && !r) return;
    const worldX = isLocal ? px : r.x;
    const worldY = isLocal ? py : r.y;
    const x = worldX - cameraX;
    const y = worldY - cameraY;
    if (player.vehicle) {
      const vehicleImg = image(player.vehicle.thumbnail);
      if (vehicleImg) ctx.drawImage(vehicleImg, x - 70, y - 40, 140, 140);
    }
    const tier = getTierInfo(player);
    const friend = !isLocal && Social.isFriend(player.id);
    if (friend) {
      ctx.fillStyle = 'rgba(250,204,21,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y + 74, 30, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawMinifig(ctx, x, y, {
      scale: 1.4,
      walkPhase: isLocal ? phase : r.phase,
      bodyColor: tier.bodyColor,
      legColor: tier.legColor,
      glow: tier.glow,
      facing: isLocal ? facing : r.facing,
      weapon: isLocal && (State.player.equipped.weapons || []).length > 0,
      cape: tier.id >= 4
    });
    ctx.fillStyle = isLocal ? '#1e293b' : friend ? '#92400e' : '#1e3a8a';
    ctx.font = isLocal ? '14px sans-serif' : 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${friend ? '★ ' : ''}${player.name} · ${tier.name}`, x, y - 60);
    const chat = [...State.chatMessages].reverse().find(m => m.id === player.id && Date.now() - m.receivedAt < 6000);
    if (chat) drawBubble(chat.message, x, y - 82);
  }

  // Arrows at the screen edge pointing to players outside the view.
  function drawOffscreenMarkers() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    for (const [id, r] of remote) {
      const sx = r.x - cameraX, sy = r.y - cameraY;
      if (sx > -20 && sx < canvas.width + 20 && sy > -60 && sy < canvas.height + 40) continue;
      const player = State.onlinePlayers.find(p => p.id === id);
      if (!player) continue;
      const angle = Math.atan2(sy - cy, sx - cx);
      const scale = Math.min((cx - 30) / Math.abs(Math.cos(angle) || 1e-6), (cy - 24) / Math.abs(Math.sin(angle) || 1e-6));
      const ax = cx + Math.cos(angle) * scale, ay = cy + Math.sin(angle) * scale;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.fillStyle = Social.isFriend(id) ? '#f59e0b' : '#2563eb';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const dist = Math.round(Math.hypot(r.x - px, r.y - py));
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const label = `${player.name} ${dist}m`;
      const lx = Math.min(canvas.width - 50, Math.max(50, ax - Math.cos(angle) * 30));
      const ly = Math.min(canvas.height - 8, Math.max(14, ay - Math.sin(angle) * 22));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(lx - ctx.measureText(label).width / 2 - 4, ly - 11, ctx.measureText(label).width + 8, 15);
      ctx.fillStyle = '#111827';
      ctx.fillText(label, lx, ly);
    }
  }

  function render() {
    drawGround();
    if (!State.player || !State.catalog) return;
    const homeStats = getHomeStats(State.player);
    const localPlayer = {
      ...State.player,
      house: homeStats.house ? { name: homeStats.house.name, thumbnail: homeStats.house.thumbnail } : null,
      vehicle: getVehicleStats(State.player).vehicle
    };
    State.onlinePlayers.filter(player => player.id !== State.playerId).forEach(player => drawHouse(player));
    drawHouse(localPlayer);
    State.onlinePlayers
      .filter(player => player.id !== State.playerId && player.world)
      .forEach(player => drawPlayer(player, false));
    drawPlayer(localPlayer, true);
    drawOffscreenMarkers();
  }

  function placeHome() {
    if (!getHomeStats(State.player).house) {
      UI.toast('Choose a house in My Home first.');
      return;
    }
    State.player.world.homeX = px;
    State.player.world.homeY = Math.max(110, py - 100);
    Net.placeHome(State.player.world.homeX, State.player.world.homeY);
    UI.toast('Your home has been placed here.');
  }

  function sendChat(event) {
    event.preventDefault();
    const input = document.getElementById('worldChatInput');
    const message = input.value.trim();
    if (!message) return;
    Net.chat(message);
    input.value = '';
  }

  function renderChat() {
    const box = document.getElementById('worldChatBox');
    if (!box) return;
    box.innerHTML = '';
    State.chatMessages.slice(-8).forEach(message => {
      const line = document.createElement('div');
      line.className = 'chat-line';
      const name = document.createElement('strong');
      name.textContent = `${message.name}: `;
      line.append(name, document.createTextNode(message.message));
      box.appendChild(line);
    });
    box.scrollTop = box.scrollHeight;
  }

  function loop(timestamp) {
    try {
      update(timestamp);
      render();
    } catch (err) {
      console.error('World render error:', err);
    }
    requestAnimationFrame(loop);
  }

  return { init, renderChat, goTo };
})();
