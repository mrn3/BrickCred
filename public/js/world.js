const World = (() => {
  const WORLD_WIDTH = 4200;
  const WORLD_HEIGHT = 3000;
  const PLAYER_MARGIN = 40;
  const WALK_SPEED = 2.4;
  // One world unit of travel per frame reads as 10 mph on the speedometer.
  const MPH_PER_UNIT = 10;
  const BASE_DRIVE_SPEED = 3;
  const BOOST_MULT = 1.75;
  const STOP_LINE = 44;
  const INTERSECTION_RANGE = 135;
  const TICKET_GRACE_MS = 12000;
  const PULLOVER_MS = 4200;
  const FINES = { red: 45, stop: 30, speed: 25 };
  let canvas;
  let px = 400, py = 300;
  let facing = 1;
  let moving = false;
  let phase = 0;
  let lastMoveSent = 0;
  let intersectionCache = null;
  const stoppedAt = new Map();
  const traffic = { prevX: 0, prevY: 0, speedingSince: 0, lastTicket: -Infinity, pullover: null, mph: 0, limit: 30, road: '' };
  const keys = {};
  // Normalized -1..1 vector from the on-screen touch stick.
  const stick = { x: 0, y: 0 };
  // Smoothed on-screen state for other players, keyed by player id.
  const remote = new Map();

  async function init() {
    canvas = document.getElementById('worldCanvas');
    px = State.player.world.x;
    py = State.player.world.y;
    traffic.prevX = px;
    traffic.prevY = py;
    await World3D.init(canvas);
    window.addEventListener('keydown', e => {
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'f' && !e.repeat && document.getElementById('tab-world').classList.contains('active')) {
        e.preventDefault();
        toggleVehicle();
        return;
      }
      keys[key] = true;
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => Object.keys(keys).forEach(k => { keys[k] = false; }));
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', e => {
      canvas.style.cursor = playerAt(e) ? 'pointer' : 'default';
    });
    document.getElementById('placeHomeBtn').addEventListener('click', placeHome);
    document.getElementById('toggleVehicleBtn').addEventListener('click', toggleVehicle);
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
    if (State.player.world.inVehicle) return UI.toast('Exit your vehicle before travelling to a player.');
    px = Math.min(WORLD_WIDTH - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, x + 120));
    py = Math.min(WORLD_HEIGHT - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, y));
    traffic.prevX = px;
    traffic.prevY = py;
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
    const inVehicle = !!State.player?.world?.inVehicle;
    const pulledOver = traffic.pullover && timestamp < traffic.pullover.until;
    if (traffic.pullover && !pulledOver) {
      traffic.pullover = null;
      World3D.setPoliceStop(false);
    }

    let dx = 0, dy = 0;
    if (!pulledOver) {
      if (keys['arrowleft'] || keys['a']) dx -= 1;
      if (keys['arrowright'] || keys['d']) dx += 1;
      if (keys['arrowup'] || keys['w']) dy -= 1;
      if (keys['arrowdown'] || keys['s']) dy += 1;
      if (stick.x || stick.y) {
        dx = stick.x;
        dy = stick.y;
      }
    }
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    moving = dx !== 0 || dy !== 0;
    if (dx !== 0) facing = dx > 0 ? 1 : -1;
    const limit = World3D.speedLimitAt(px, py);
    let speed = WALK_SPEED;
    if (inVehicle) {
      const top = BASE_DRIVE_SPEED * getVehicleStats(State.player).speedMult;
      // Cruising is governed to the posted limit; the boost key is how you break it.
      speed = keys['shift'] ? top * BOOST_MULT : Math.min(top, limit / MPH_PER_UNIT);
    }
    const nextX = Math.min(WORLD_WIDTH - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, px + dx * speed));
    const nextY = Math.min(WORLD_HEIGHT - PLAYER_MARGIN, Math.max(PLAYER_MARGIN, py + dy * speed));
    if (!inVehicle || World3D.isVehicleRoad(nextX, nextY)) {
      px = nextX;
      py = nextY;
    } else {
      const canSlideX = World3D.isVehicleRoad(nextX, py);
      const canSlideY = World3D.isVehicleRoad(px, nextY);
      if (canSlideX) px = nextX;
      if (canSlideY) py = nextY;
    }
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
    updateTraffic(timestamp, inVehicle, limit);
    updateRemote();
  }

  function intersections() {
    if (!intersectionCache) intersectionCache = World3D.listIntersections();
    return intersectionCache;
  }

  function nearestIntersection(x, y) {
    let best = null;
    let bestDist = Infinity;
    intersections().forEach(node => {
      const distance = Math.max(Math.abs(x - node.x), Math.abs(y - node.z));
      if (distance < bestDist) {
        bestDist = distance;
        best = node;
      }
    });
    return bestDist <= INTERSECTION_RANGE ? best : null;
  }

  function updateTraffic(timestamp, inVehicle, limit) {
    const stepX = px - traffic.prevX;
    const stepY = py - traffic.prevY;
    const step = Math.hypot(stepX, stepY);
    traffic.mph = Math.round(step * MPH_PER_UNIT);
    traffic.limit = limit;
    traffic.road = World3D.roadNameAt(px, py);
    if (traffic.pullover) World3D.setPoliceStop(true, px, py, facing);

    if (!inVehicle) {
      traffic.speedingSince = 0;
      traffic.prevX = px;
      traffic.prevY = py;
      return;
    }

    if (traffic.mph > limit + 3) {
      if (!traffic.speedingSince) traffic.speedingSince = timestamp;
      if (timestamp - traffic.speedingSince > 1100) {
        issueTicket(timestamp, `Speeding — ${traffic.mph} in a ${limit}`, FINES.speed + Math.round((traffic.mph - limit) / 2));
      }
    } else {
      traffic.speedingSince = 0;
    }

    const node = nearestIntersection(px, py);
    if (node) {
      const axis = Math.abs(stepY) >= Math.abs(stepX) ? 'ns' : 'ew';
      const along = axis === 'ns' ? Math.abs(py - node.z) : Math.abs(px - node.x);
      const prevAlong = axis === 'ns' ? Math.abs(traffic.prevY - node.z) : Math.abs(traffic.prevX - node.x);
      const lateral = axis === 'ns' ? Math.abs(px - node.x) : Math.abs(py - node.z);
      if (step < 0.35) stoppedAt.set(node.id, timestamp);
      if (lateral <= 45 && step > 0.2 && prevAlong > STOP_LINE && along <= STOP_LINE) {
        if (node.type === 'light') {
          if (World3D.signalFor(node.id)[axis] === 'red') issueTicket(timestamp, 'Ran a red light', FINES.red);
        } else if (timestamp - (stoppedAt.get(node.id) || -Infinity) > 2500) {
          issueTicket(timestamp, 'Ran a stop sign', FINES.stop);
        }
      }
    }

    traffic.prevX = px;
    traffic.prevY = py;
  }

  function issueTicket(timestamp, reason, fine) {
    if (traffic.pullover || timestamp - traffic.lastTicket < TICKET_GRACE_MS) return;
    traffic.lastTicket = timestamp;
    traffic.speedingSince = 0;
    traffic.pullover = { until: timestamp + PULLOVER_MS, reason, fine };
    State.player.cred = Math.max(0, State.player.cred - fine);
    Net.syncPlayer();
    UI.renderAll();
    UI.toast(`🚨 Brick City PD: ${reason}. Ticket -${fine} cred.`);
    World3D.setPoliceStop(true, px, py, facing);
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
      house: homeStats.house,
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
    World3D.updateScene(localPlayer, remotePlayers, px, py, facing, moving, phase, {
      inVehicle: !!State.player.world.inVehicle,
      mph: traffic.mph,
      limit: traffic.limit,
      road: traffic.road,
      ticket: traffic.pullover
    });
    updateVehicleButton(localPlayer.vehicle);
  }

  function placeHome() {
    const house = getHomeStats(State.player).house;
    if (!house) {
      UI.toast('Choose a house in My Home first.');
      return;
    }
    const placement = World3D.canPlaceHome(house, px, py);
    if (!placement.ok) return UI.toast(placement.message);
    Net.placeHome(px, py, result => {
      if (!result?.ok) return UI.toast(result?.error || 'Could not place your house.');
      State.player.world.homeX = px;
      State.player.world.homeY = py;
      State.player.world.homePlaced = true;
      UI.toast('Your brick-built house is placed on the grass.');
    });
  }

  function updateVehicleButton(vehicle) {
    const button = document.getElementById('toggleVehicleBtn');
    const usable = !!vehicle?.model?.length;
    button.classList.toggle('hidden', !usable);
    if (!usable) return;
    button.textContent = State.player.world.inVehicle ? 'Exit Vehicle (F)' : 'Enter Vehicle (F)';
  }

  function toggleVehicle() {
    if (!getVehicleStats(State.player).vehicle?.model?.length) {
      UI.toast('Choose a brick-built vehicle in My Home first.');
      return;
    }
    const inVehicle = !!State.player.world.inVehicle;
    Net.setVehicleMode(!inVehicle, result => {
      if (!result?.ok) return UI.toast(result?.error || 'Could not change vehicle mode.');
      State.player.world.inVehicle = result.inVehicle;
      UI.toast(result.inVehicle ? 'You got in your vehicle.' : 'You parked and got out.');
      UI.renderAll();
    });
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
