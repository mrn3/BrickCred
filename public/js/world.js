const World = (() => {
  const WORLD_WIDTH = 2400;
  const WORLD_HEIGHT = 1600;
  const PLAYER_MARGIN = 40;
  let canvas;
  let px = 400, py = 300;
  let facing = 1;
  let moving = false;
  let phase = 0;
  let lastMoveSent = 0;
  const keys = {};
  // Normalized -1..1 vector from the on-screen touch stick.
  const stick = { x: 0, y: 0 };
  // Smoothed on-screen state for other players, keyed by player id.
  const remote = new Map();

  async function init() {
    canvas = document.getElementById('worldCanvas');
    px = State.player.world.x;
    py = State.player.world.y;
    await World3D.init(canvas);
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

  function playerAt(e) {
    return World3D.playerAt(e);
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

  function render() {
    if (!State.player || !State.catalog) return;
    const homeStats = getHomeStats(State.player);
    const localPlayer = {
      ...State.player,
      house: homeStats.house ? { name: homeStats.house.name, thumbnail: homeStats.house.thumbnail } : null,
      vehicle: getVehicleStats(State.player).vehicle
    };
    const remotePlayers = [];
    State.onlinePlayers.forEach(player => {
      const position = remote.get(player.id);
      if (player.id === State.playerId || !player.world || !position) return;
      remotePlayers.push({
        player,
        x: position.x,
        z: position.y,
        facing: position.facing,
        moving: position.moving,
        phase: position.phase
      });
    });
    World3D.updateScene(localPlayer, remotePlayers, px, py, facing, moving, phase);
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

  function loop(timestamp) {
    try {
      update(timestamp);
      render();
    } catch (err) {
      console.error('World render error:', err);
    }
    requestAnimationFrame(loop);
  }

  return { init, goTo };
})();
