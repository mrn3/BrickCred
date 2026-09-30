// Three.js environment and avatar renderer for the World tab.
const World3D = (() => {
  const SCALE = 0.1;
  const MAP_WIDTH = 420;
  const MAP_DEPTH = 300;
  const ROAD_X = [30, 90, 150, 210, 270, 330, 390];
  const ROAD_Z = [30, 90, 150, 210, 270];
  // Named north/south avenues (one per ROAD_X) and east/west streets (one per ROAD_Z).
  const AVENUE_NAMES = ['Baseplate Ave', 'Minifig Ave', 'Stud Ave', 'Grand Brick Blvd', 'Sprocket Ave', 'Tile Ave', 'Harbor Ave'];
  const STREET_NAMES = ['Clutch St', 'Hinge St', 'Cogwheel Blvd', 'Axle St', 'Lantern St'];
  const BOULEVARD_X = 3;
  const BOULEVARD_Z = 2;
  const SPEED_LIMIT_NORMAL = 30;
  const SPEED_LIMIT_BOULEVARD = 45;
  const LIGHT_CYCLE = 16;
  const MODEL_SCALE = 0.018;
  const ROAD_HALF_WIDTH_WORLD = 30;
  const GRASS_CLEARANCE_WORLD = 45;
  const VEHICLE_CLEARANCE_WORLD = 20;
  let THREE;
  let scene;
  let camera;
  let renderer;
  let canvas;
  let stage;
  let hud;
  let hudContext;
  let resizeObserver;
  const raycaster = { current: null };
  const pointer = { current: null };
  const avatars = new Map();
  const homes = new Map();
  const vehicles = new Map();
  const buildModels = new Map();
  const intersections = [];
  const intersectionsById = new Map();
  const signTextures = new Map();
  const police = { group: null, lights: [] };
  const shared = {};

  async function init(targetCanvas) {
    THREE = await import('/vendor/three/three.module.js');
    canvas = targetCanvas;
    stage = canvas.parentElement;
    hud = document.getElementById('worldHud');
    hudContext = hud.getContext('2d');

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#b8d9e5');
    scene.fog = new THREE.Fog('#b8d9e5', 108, 235);
    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 420);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor('#b8d9e5', 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    raycaster.current = new THREE.Raycaster();
    pointer.current = new THREE.Vector2();

    addLighting();
    makeSharedAssets();
    buildLandscape();
    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    window.addEventListener('resize', resize);
  }

  function addLighting() {
    scene.add(new THREE.HemisphereLight('#e5f6ff', '#718456', 2.05));
    const sun = new THREE.DirectionalLight('#fff1cd', 3.1);
    sun.position.set(-34, 62, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(sun.target);
  }

  function makeSharedAssets() {
    shared.grass = new THREE.MeshStandardMaterial({ color: '#78bd5b', roughness: 1 });
    shared.parkGrass = new THREE.MeshStandardMaterial({ color: '#88c96d', roughness: 1 });
    shared.asphalt = new THREE.MeshStandardMaterial({ color: '#414b52', roughness: 0.94 });
    shared.sidewalk = new THREE.MeshStandardMaterial({ color: '#d0c9ad', roughness: 0.92 });
    shared.curb = new THREE.MeshStandardMaterial({ color: '#b4ad96', roughness: 0.9 });
    shared.paint = new THREE.MeshStandardMaterial({ color: '#f6e7b1', roughness: 0.8 });
    shared.bush = new THREE.MeshStandardMaterial({ color: '#438d48', roughness: 1 });
    shared.leaf = new THREE.MeshStandardMaterial({ color: '#5b9b50', roughness: 1 });
    shared.trunk = new THREE.MeshStandardMaterial({ color: '#75543a', roughness: 1 });
    shared.window = new THREE.MeshStandardMaterial({ color: '#9ed9df', roughness: 0.32, metalness: 0.08 });
    shared.door = new THREE.MeshStandardMaterial({ color: '#754934', roughness: 0.9 });
    shared.signPost = new THREE.MeshStandardMaterial({ color: '#6b767a', metalness: 0.5, roughness: 0.55 });
    shared.signalBox = new THREE.MeshStandardMaterial({ color: '#2f3a33', roughness: 0.7 });
    shared.stopLine = new THREE.MeshStandardMaterial({ color: '#f4f1e2', roughness: 0.8 });
  }

  function plane(width, depth, material, x, z, y = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function makeLandscapeBase() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_WIDTH + 110, MAP_DEPTH + 110),
      new THREE.MeshStandardMaterial({ color: '#6eaeb8', roughness: 0.42, metalness: 0.08 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(MAP_WIDTH / 2, -0.8, MAP_DEPTH / 2);
    scene.add(water);
    plane(MAP_WIDTH, MAP_DEPTH, shared.grass, MAP_WIDTH / 2, MAP_DEPTH / 2, -0.16);

    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#9caa91', roughness: 1 });
    const boundary = new THREE.Mesh(new THREE.BoxGeometry(MAP_WIDTH + 2, 0.4, MAP_DEPTH + 2), edgeMaterial);
    boundary.position.set(MAP_WIDTH / 2, -0.42, MAP_DEPTH / 2);
    boundary.receiveShadow = true;
    scene.add(boundary);
  }

  function addRoads() {
    ROAD_X.forEach(x => {
      plane(6, MAP_DEPTH, shared.asphalt, x, MAP_DEPTH / 2, 0.015);
      [-1, 1].forEach(side => {
        plane(1.5, MAP_DEPTH, shared.sidewalk, x + side * 3.8, MAP_DEPTH / 2, 0.04);
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, MAP_DEPTH), shared.curb);
        curb.position.set(x + side * 3, 0.11, MAP_DEPTH / 2);
        curb.receiveShadow = true;
        scene.add(curb);
      });
    });
    ROAD_Z.forEach(z => {
      plane(MAP_WIDTH, 6, shared.asphalt, MAP_WIDTH / 2, z, 0.02);
      [-1, 1].forEach(side => {
        plane(MAP_WIDTH, 1.5, shared.sidewalk, MAP_WIDTH / 2, z + side * 3.8, 0.045);
        const curb = new THREE.Mesh(new THREE.BoxGeometry(MAP_WIDTH, 0.2, 0.16), shared.curb);
        curb.position.set(MAP_WIDTH / 2, 0.11, z + side * 3);
        curb.receiveShadow = true;
        scene.add(curb);
      });
    });

    const dashPositions = [];
    ROAD_X.forEach(x => {
      for (let z = 5; z < MAP_DEPTH - 3; z += 6) {
        if (!ROAD_Z.some(crossing => Math.abs(z - crossing) < 8)) dashPositions.push([x, z, 0]);
      }
    });
    ROAD_Z.forEach(z => {
      for (let x = 5; x < MAP_WIDTH - 3; x += 6) {
        if (!ROAD_X.some(crossing => Math.abs(x - crossing) < 8)) dashPositions.push([x, z, 1]);
      }
    });
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.025, 2.2), shared.paint, dashPositions.length);
    const dummy = new THREE.Object3D();
    dashPositions.forEach(([x, z, horizontal], index) => {
      dummy.position.set(x, 0.06, z);
      dummy.rotation.set(0, horizontal ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(index, dummy.matrix);
    });
    dashes.receiveShadow = true;
    scene.add(dashes);

    const crosswalks = [];
    ROAD_X.forEach(x => ROAD_Z.forEach(z => {
      for (let stripe = -2; stripe <= 2; stripe++) {
        crosswalks.push([x + stripe * 0.78, z - 4.35, 0]);
        crosswalks.push([x + stripe * 0.78, z + 4.35, 0]);
        crosswalks.push([x - 4.35, z + stripe * 0.78, 1]);
        crosswalks.push([x + 4.35, z + stripe * 0.78, 1]);
      }
    }));
    const stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.025, 0.22), shared.paint, crosswalks.length);
    crosswalks.forEach(([x, z, turn], index) => {
      dummy.position.set(x, 0.065, z);
      dummy.rotation.set(0, turn ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      stripes.setMatrixAt(index, dummy.matrix);
    });
    scene.add(stripes);
  }

  function seededRandom() {
    let seed = 48617;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  function clockSeconds() {
    return performance.now() / 1000;
  }

  function speedLimitFor(roadIndex, vertical) {
    const boulevard = vertical ? BOULEVARD_X : BOULEVARD_Z;
    return roadIndex === boulevard ? SPEED_LIMIT_BOULEVARD : SPEED_LIMIT_NORMAL;
  }

  function signTexture(key, draw) {
    let texture = signTextures.get(key);
    if (texture) return texture;
    const surface = document.createElement('canvas');
    surface.width = 256;
    surface.height = 128;
    const context = surface.getContext('2d');
    draw(context, surface.width, surface.height);
    texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    signTextures.set(key, texture);
    return texture;
  }

  function streetNameTexture(name) {
    return signTexture(`street:${name}`, (context, width, height) => {
      context.fillStyle = '#1f6b3f';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = '#f2f6f1';
      context.lineWidth = 6;
      context.strokeRect(9, 9, width - 18, height - 18);
      context.fillStyle = '#f7fbf6';
      context.font = '700 42px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(name.toUpperCase(), width / 2, height / 2 + 2);
    });
  }

  function stopSignTexture() {
    return signTexture('stop', (context, width, height) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#b3241f';
      context.beginPath();
      const radius = height / 2 - 2;
      for (let corner = 0; corner < 8; corner++) {
        const angle = (corner / 8) * Math.PI * 2 + Math.PI / 8;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        corner ? context.lineTo(x, y) : context.moveTo(x, y);
      }
      context.closePath();
      context.fill();
      context.strokeStyle = '#f4f1e8';
      context.lineWidth = 5;
      context.stroke();
      context.fillStyle = '#fbf7ee';
      context.font = '700 44px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('STOP', width / 2, height / 2 + 3);
    });
  }

  function speedSignTexture(limit) {
    return signTexture(`speed:${limit}`, (context, width, height) => {
      context.fillStyle = '#f6f4ec';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = '#2b3138';
      context.lineWidth = 7;
      context.strokeRect(10, 8, width - 20, height - 16);
      context.fillStyle = '#2b3138';
      context.textAlign = 'center';
      context.font = '700 24px system-ui, sans-serif';
      context.fillText('SPEED LIMIT', width / 2, 42);
      context.font = '700 58px system-ui, sans-serif';
      context.fillText(String(limit), width / 2, 104);
    });
  }

  function signPost(x, z, height) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, height, 6), shared.signPost);
    post.position.set(x, height / 2, z);
    post.castShadow = true;
    scene.add(post);
    return post;
  }

  function signPanel(texture, width, height, x, y, z, rotationY) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, side: THREE.DoubleSide, transparent: true })
    );
    panel.position.set(x, y, z);
    panel.rotation.y = rotationY;
    scene.add(panel);
    return panel;
  }

  function addStreetNameSign(node) {
    const x = node.x + 4.6;
    const z = node.z + 4.6;
    signPost(x, z, 4.2);
    const avenue = streetNameTexture(node.nsName);
    const street = streetNameTexture(node.ewName);
    signPanel(avenue, 2.5, 0.62, x, 4.05, z, Math.PI / 2);
    signPanel(street, 2.5, 0.62, x, 3.32, z, 0);
  }

  function addSignalHead(node, x, z, rotationY, axis) {
    signPost(x, z, 3.6);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.32, 0.34), shared.signalBox);
    housing.position.set(x, 4.05, z);
    housing.rotation.y = rotationY;
    housing.castShadow = true;
    scene.add(housing);
    const colors = ['#ff3b30', '#ffcc33', '#35d16a'];
    const lamps = colors.map((color, index) => {
      const material = new THREE.MeshStandardMaterial({ color: '#171a1c', emissive: color, emissiveIntensity: 0.06 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), material);
      const forward = new THREE.Vector3(0, 0, 0.28).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      lamp.position.set(x + forward.x, 4.47 - index * 0.42, z + forward.z);
      scene.add(lamp);
      return material;
    });
    node.lamps[axis].push(lamps);
  }

  function addStopSign(x, z, rotationY) {
    signPost(x, z, 2.5);
    signPanel(stopSignTexture(), 1.15, 1.15, x, 2.92, z, rotationY);
  }

  function addIntersectionControls(node) {
    addStreetNameSign(node);
    if (node.type === 'light') {
      addSignalHead(node, node.x + 4.4, node.z - 5.2, 0, 'ns');
      addSignalHead(node, node.x - 4.4, node.z + 5.2, Math.PI, 'ns');
      addSignalHead(node, node.x - 5.2, node.z - 4.4, -Math.PI / 2, 'ew');
      addSignalHead(node, node.x + 5.2, node.z + 4.4, Math.PI / 2, 'ew');
    } else {
      addStopSign(node.x + 4.4, node.z - 5.2, 0);
      addStopSign(node.x - 4.4, node.z + 5.2, Math.PI);
      addStopSign(node.x - 5.2, node.z - 4.4, Math.PI / 2);
      addStopSign(node.x + 5.2, node.z + 4.4, Math.PI / 2);
    }
    const stopLines = [
      [node.x + 1.5, node.z - 5.1, 3, 0.26],
      [node.x - 1.5, node.z + 5.1, 3, 0.26],
      [node.x - 5.1, node.z - 1.5, 0.26, 3],
      [node.x + 5.1, node.z + 1.5, 0.26, 3]
    ];
    stopLines.forEach(([x, z, w, d]) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), shared.stopLine);
      line.position.set(x, 0.07, z);
      scene.add(line);
    });
  }

  function addSpeedLimitSigns() {
    ROAD_X.forEach((x, index) => {
      const limit = speedLimitFor(index, true);
      for (let z = 60; z < MAP_DEPTH - 20; z += 120) {
        signPost(x + 4.9, z, 2.6);
        signPanel(speedSignTexture(limit), 1.05, 1.3, x + 4.9, 3.32, z, Math.PI / 2);
      }
    });
    ROAD_Z.forEach((z, index) => {
      const limit = speedLimitFor(index, false);
      for (let x = 60; x < MAP_WIDTH - 20; x += 120) {
        signPost(x, z + 4.9, 2.6);
        signPanel(speedSignTexture(limit), 1.05, 1.3, x, 3.32, z + 4.9, 0);
      }
    });
  }

  function buildIntersections() {
    ROAD_X.forEach((x, i) => ROAD_Z.forEach((z, j) => {
      const node = {
        id: `${i}-${j}`,
        x, z,
        type: (i + j) % 2 === 0 ? 'light' : 'stop',
        offset: ((i * 3 + j) % 4) * 4,
        nsName: AVENUE_NAMES[i],
        ewName: STREET_NAMES[j],
        lamps: { ns: [], ew: [] }
      };
      intersections.push(node);
      intersectionsById.set(node.id, node);
      addIntersectionControls(node);
    }));
    addSpeedLimitSigns();
  }

  // Signals run on a shared wall clock so every client sees the same colours.
  function signalPhase(node, time) {
    const t = (time + node.offset) % LIGHT_CYCLE;
    if (t < 6) return { ns: 'green', ew: 'red' };
    if (t < 7.5) return { ns: 'yellow', ew: 'red' };
    if (t < 8) return { ns: 'red', ew: 'red' };
    if (t < 14) return { ns: 'red', ew: 'green' };
    if (t < 15.5) return { ns: 'red', ew: 'yellow' };
    return { ns: 'red', ew: 'red' };
  }

  function updateSignals() {
    const time = clockSeconds();
    intersections.forEach(node => {
      if (node.type !== 'light') return;
      const phase = signalPhase(node, time);
      ['ns', 'ew'].forEach(axis => {
        const lit = phase[axis] === 'red' ? 0 : phase[axis] === 'yellow' ? 1 : 2;
        node.lamps[axis].forEach(lamps => {
          lamps.forEach((material, index) => {
            material.emissiveIntensity = index === lit ? 2.4 : 0.06;
          });
        });
      });
    });
  }

  function listIntersections() {
    return intersections.map(node => ({
      id: node.id,
      type: node.type,
      x: node.x / SCALE,
      z: node.z / SCALE,
      nsName: node.nsName,
      ewName: node.ewName
    }));
  }

  function signalFor(id) {
    const node = intersectionsById.get(id);
    if (!node || node.type !== 'light') return { ns: 'green', ew: 'green' };
    return signalPhase(node, clockSeconds());
  }

  function nearestRoadIndex(value, roads) {
    let best = 0;
    roads.forEach((road, index) => {
      if (Math.abs(value - road) < Math.abs(value - roads[best])) best = index;
    });
    return best;
  }

  // x/z arrive in world units (scene units divided by SCALE).
  function speedLimitAt(x, z) {
    const sx = x * SCALE;
    const sz = z * SCALE;
    const xi = nearestRoadIndex(sx, ROAD_X);
    const zi = nearestRoadIndex(sz, ROAD_Z);
    const onAvenue = Math.abs(sx - ROAD_X[xi]) <= Math.abs(sz - ROAD_Z[zi]);
    return onAvenue ? speedLimitFor(xi, true) : speedLimitFor(zi, false);
  }

  function roadNameAt(x, z) {
    const sx = x * SCALE;
    const sz = z * SCALE;
    const xi = nearestRoadIndex(sx, ROAD_X);
    const zi = nearestRoadIndex(sz, ROAD_Z);
    const dx = Math.abs(sx - ROAD_X[xi]);
    const dz = Math.abs(sz - ROAD_Z[zi]);
    if (dx > 6 && dz > 6) return 'Brickfield Commons';
    if (dx <= 6 && dz <= 6) return `${AVENUE_NAMES[xi]} & ${STREET_NAMES[zi]}`;
    return dx <= dz ? AVENUE_NAMES[xi] : STREET_NAMES[zi];
  }

  function createPoliceCar() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 3.9), new THREE.MeshStandardMaterial({ color: '#20304a', roughness: 0.5 }));
    body.position.y = 0.72;
    group.add(body);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.4, 1.6), new THREE.MeshStandardMaterial({ color: '#f1f3f6', roughness: 0.6 }));
    door.position.set(0, 0.72, 0.2);
    group.add(door);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 1.8), new THREE.MeshStandardMaterial({ color: '#9fd0e4', roughness: 0.3, metalness: 0.1 }));
    cabin.position.set(0, 1.4, -0.2);
    group.add(cabin);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.34), new THREE.MeshStandardMaterial({ color: '#2b3138' }));
    bar.position.set(0, 1.79, -0.2);
    group.add(bar);
    police.lights = [-0.38, 0.38].map((side, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: '#2a2f33',
        emissive: index ? '#3a7bff' : '#ff2f2f',
        emissiveIntensity: 0
      });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.36), material);
      lamp.position.set(side, 1.85, -0.2);
      group.add(lamp);
      return material;
    });
    [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#23272b' }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.38, wz);
      group.add(wheel);
    });
    group.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = true; });
    return group;
  }

  // x/z arrive in world units; the cruiser parks just behind the offender.
  function setPoliceStop(active, x, z, facing) {
    if (!active) {
      if (police.group) {
        scene.remove(police.group);
        police.group = null;
        police.lights = [];
      }
      return;
    }
    if (!police.group) {
      police.group = createPoliceCar();
      scene.add(police.group);
    }
    police.group.position.set(x * SCALE - facing * 4.6, 0, z * SCALE + 1.2);
    police.group.rotation.y = facing < 0 ? -Math.PI / 2 : Math.PI / 2;
    const flash = Math.floor(clockSeconds() * 4) % 2;
    police.lights.forEach((material, index) => {
      material.emissiveIntensity = index === flash ? 3.4 : 0;
    });
  }

  function nearRoad(x, z, margin = 7) {
    return ROAD_X.some(road => Math.abs(x - road) < margin) || ROAD_Z.some(road => Math.abs(z - road) < margin);
  }

  function addParks() {
    const parks = [
      { x: 120, z: 120, w: 26, d: 22 },
      { x: 240, z: 60, w: 24, d: 20 },
      { x: 60, z: 240, w: 24, d: 20 },
      { x: 300, z: 180, w: 26, d: 22 },
      { x: 180, z: 240, w: 24, d: 20 },
      { x: 360, z: 120, w: 24, d: 20 }
    ];
    parks.forEach((park, index) => {
      plane(park.w, park.d, shared.parkGrass, park.x, park.z, -0.08);
      const pathMaterial = new THREE.MeshStandardMaterial({ color: '#d9d1b6', roughness: 0.94 });
      plane(park.w - 4, 1.25, pathMaterial, park.x, park.z, -0.01);
      plane(1.25, park.d - 4, pathMaterial, park.x, park.z, -0.005);
      if (index === 0) addFountain(park.x, park.z);
      addBench(park.x - 5, park.z + 4);
      addBench(park.x + 5, park.z - 4);
    });
  }

  function addFountain(x, z) {
    const stone = new THREE.MeshStandardMaterial({ color: '#b8c4bd', roughness: 0.76 });
    const water = new THREE.MeshStandardMaterial({ color: '#54b9c7', roughness: 0.25, metalness: 0.16 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.55, 12), stone);
    basin.position.set(x, 0.3, z);
    basin.castShadow = true;
    basin.receiveShadow = true;
    scene.add(basin);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.92, 1.92, 0.12, 16), water);
    pool.position.set(x, 0.62, z);
    scene.add(pool);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.25, 8), water);
    jet.position.set(x, 1.2, z);
    scene.add(jet);
  }

  function addBench(x, z) {
    const wood = new THREE.MeshStandardMaterial({ color: '#a56e42', roughness: 0.88 });
    const metal = new THREE.MeshStandardMaterial({ color: '#3d5661', metalness: 0.55, roughness: 0.45 });
    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.55), wood);
    seat.position.y = 0.62;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.16), wood);
    back.position.set(0, 1.02, -0.2);
    group.add(back);
    [-0.78, 0.78].forEach(side => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.4), metal);
      leg.position.set(side, 0.3, 0);
      group.add(leg);
    });
    group.position.set(x, 0, z);
    group.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = true; });
    scene.add(group);
  }

  function addTreesAndShrubs(random) {
    const trees = [];
    const shrubs = [];
    for (let x = 6; x < MAP_WIDTH - 5; x += 7.5) {
      for (let z = 6; z < MAP_DEPTH - 5; z += 7) {
        const tx = x + (random() - 0.5) * 4;
        const tz = z + (random() - 0.5) * 3;
        if (nearRoad(tx, tz, 7.2)) continue;
        if (random() < 0.58) trees.push({ x: tx, z: tz, scale: 0.72 + random() * 0.58, shade: random() });
        else if (random() < 0.85) shrubs.push({ x: tx, z: tz, scale: 0.65 + random() * 0.75, shade: random() });
      }
    }
    addTreeInstances(trees);
    addShrubInstances(shrubs);
    addStreetLamps(random);
  }

  function addTreeInstances(trees) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 1.6, 7), shared.trunk, trees.length);
    const foliageGeometry = new THREE.ConeGeometry(1.55, 1.8, 7);
    const foliage = [
      new THREE.InstancedMesh(foliageGeometry, new THREE.MeshStandardMaterial({ color: '#5da652', roughness: 1 }), trees.length),
      new THREE.InstancedMesh(foliageGeometry, new THREE.MeshStandardMaterial({ color: '#76b862', roughness: 1 }), trees.length),
      new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.72, 0), new THREE.MeshStandardMaterial({ color: '#87c76e', roughness: 1 }), trees.length)
    ];
    const dummy = new THREE.Object3D();
    trees.forEach((tree, index) => {
      const size = tree.scale;
      dummy.position.set(tree.x, 0.83 * size, tree.z);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      trunk.setMatrixAt(index, dummy.matrix);
      foliage.forEach((mesh, tier) => {
        dummy.position.set(tree.x, (1.85 + tier * 0.85) * size, tree.z);
        dummy.scale.set(size * (1 - tier * 0.17), size, size * (1 - tier * 0.17));
        dummy.rotation.set(0, tree.shade * Math.PI + tier * 0.38, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
    });
    [trunk, ...foliage].forEach(mesh => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
    });
  }

  function addShrubInstances(shrubs) {
    const geo = new THREE.DodecahedronGeometry(0.52, 0);
    const materials = [
      new THREE.MeshStandardMaterial({ color: '#377d43', roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: '#4d9849', roughness: 1 })
    ];
    materials.forEach((material, variant) => {
      const selection = shrubs.filter((_, index) => index % 2 === variant);
      const mesh = new THREE.InstancedMesh(geo, material, selection.length);
      const dummy = new THREE.Object3D();
      selection.forEach((shrub, index) => {
        dummy.position.set(shrub.x, 0.42 * shrub.scale, shrub.z);
        dummy.rotation.set(shrub.shade * 0.2, shrub.shade * Math.PI, 0);
        dummy.scale.set(1.25 * shrub.scale, shrub.scale, shrub.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });
  }

  function addStreetLamps(random) {
    const positions = [];
    ROAD_X.forEach(x => {
      for (let z = 12; z < MAP_DEPTH - 8; z += 22) {
        if (!ROAD_Z.some(crossing => Math.abs(z - crossing) < 8)) positions.push([x + 4.9, z]);
      }
    });
    ROAD_Z.forEach(z => {
      for (let x = 12; x < MAP_WIDTH - 8; x += 24) {
        if (!ROAD_X.some(crossing => Math.abs(x - crossing) < 8)) positions.push([x, z + 4.9]);
      }
    });
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#59676a', metalness: 0.6, roughness: 0.5 });
    const lampMaterial = new THREE.MeshStandardMaterial({ color: '#ffe6a3', emissive: '#b57c28', emissiveIntensity: 0.25 });
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 3.4, 6), poleMaterial, positions.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 8, 6), lampMaterial, positions.length);
    const dummy = new THREE.Object3D();
    positions.forEach(([x, z], index) => {
      dummy.position.set(x, 1.7, z);
      dummy.updateMatrix();
      pole.setMatrixAt(index, dummy.matrix);
      dummy.position.set(x, 3.45, z);
      dummy.updateMatrix();
      head.setMatrixAt(index, dummy.matrix);
    });
    pole.castShadow = true;
    scene.add(pole, head);
  }

  function addGardenDetails(random) {
    const flowers = [];
    for (let x = 5; x < MAP_WIDTH - 5; x += 8) {
      for (let z = 5; z < MAP_DEPTH - 5; z += 8) {
        if (!nearRoad(x, z, 7) && random() > 0.91) flowers.push({ x, z, color: random() });
      }
    }
    const materials = ['#f3d26a', '#ef9c72', '#f0e6d5'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    materials.forEach((material, variant) => {
      const selection = flowers.filter((_, index) => index % materials.length === variant);
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 5, 4), material, selection.length);
      const dummy = new THREE.Object3D();
      selection.forEach((flower, index) => {
        dummy.position.set(flower.x, 0.22, flower.z);
        dummy.scale.set(1, 1.35, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      scene.add(mesh);
    });
  }

  function buildLandscape() {
    makeLandscapeBase();
    addRoads();
    buildIntersections();
    addParks();
    const random = seededRandom();
    addTreesAndShrubs(random);
    addGardenDetails(random);
  }

  function resize() {
    if (!renderer || !stage) return;
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    hud.width = Math.round(width * pixelRatio);
    hud.height = Math.round(height * pixelRatio);
    hudContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function createAvatar(id, player, local) {
    const root = new THREE.Group();
    root.userData.playerId = local ? null : id;
    root.userData.local = local;
    const tier = getTierInfo(player);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: tier.bodyColor, roughness: 0.72 });
    const legMaterial = new THREE.MeshStandardMaterial({ color: tier.legColor, roughness: 0.76 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: '#303940', roughness: 0.65 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: '#ffd763', roughness: 0.55 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.86, 0.5), bodyMaterial);
    torso.position.y = 1.14;
    torso.castShadow = true;
    root.add(torso);

    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    [-1, 1].forEach((side, index) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.34), bodyMaterial);
      arm.position.y = -0.35;
      arm.castShadow = true;
      (index ? rightArm : leftArm).add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), headMaterial);
      hand.position.y = -0.73;
      (index ? rightArm : leftArm).add(hand);
    });
    leftArm.position.set(-0.58, 1.48, 0);
    rightArm.position.set(0.58, 1.48, 0);
    root.add(leftArm, rightArm);

    const legs = [];
    [-0.23, 0.23].forEach(x => {
      const leg = new THREE.Group();
      leg.position.set(x, 0.73, 0);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.74, 0.38), legMaterial);
      lower.position.y = -0.35;
      lower.castShadow = true;
      leg.add(lower);
      root.add(leg);
      legs.push(leg);
    });

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.5, 12), headMaterial);
    head.position.y = 1.91;
    head.castShadow = true;
    root.add(head);
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.1, 10), headMaterial);
    stud.position.y = 2.21;
    root.add(stud);
    [-0.105, 0.105].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), darkMaterial);
      eye.position.set(x, 1.98, 0.298);
      root.add(eye);
    });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 4, 12, Math.PI), darkMaterial);
    smile.position.set(0, 1.84, 0.298);
    smile.rotation.z = Math.PI;
    root.add(smile);

    if (tier.id >= 4) {
      const capeMaterial = new THREE.MeshStandardMaterial({ color: '#c73535', side: THREE.DoubleSide, roughness: 0.85 });
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.88, 0.08), capeMaterial);
      cape.position.set(0, 1.08, -0.31);
      cape.castShadow = true;
      root.add(cape);
    }
    if (local && (player.equipped.weapons || []).length) {
      const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 0.12), darkMaterial);
      weapon.position.set(0.75, 0.88, 0.08);
      weapon.rotation.z = -0.18;
      root.add(weapon);
    }

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.88, 20),
      new THREE.MeshBasicMaterial({ color: '#273841', transparent: true, opacity: 0.2, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.9, 28),
      new THREE.MeshBasicMaterial({ color: local ? '#f4c744' : '#f4c744', transparent: true, opacity: local ? 0.58 : 0.34, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.035;
    root.add(halo);
    root.userData.parts = { legs, leftArm, rightArm, bodyMaterial, legMaterial };
    root.traverse(object => {
      if (object.isMesh) object.userData.playerId = local ? null : id;
    });
    scene.add(root);
    return root;
  }

  function refreshAvatar(root, player, x, z, facing, moving, phase) {
    const tier = getTierInfo(player);
    root.position.set(x * SCALE, 0, z * SCALE);
    root.rotation.y = facing < 0 ? -Math.PI / 2 : Math.PI / 2;
    const parts = root.userData.parts;
    root.visible = !player.world?.inVehicle;
    parts.bodyMaterial.color.set(tier.bodyColor);
    parts.legMaterial.color.set(tier.legColor);
    const swing = moving ? Math.sin(phase) * 0.48 : 0;
    parts.legs[0].rotation.x = swing;
    parts.legs[1].rotation.x = -swing;
    parts.leftArm.rotation.x = -swing * 0.72;
    parts.rightArm.rotation.x = swing * 0.72;
  }

  function buildBounds(build) {
    if (!build?.model?.length) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    build.model.forEach(brick => {
      const part = Parts.BY_ID[brick.partId];
      if (!part) return;
      const footprint = Parts.footprint(brick);
      minX = Math.min(minX, brick.x);
      minZ = Math.min(minZ, brick.z);
      maxX = Math.max(maxX, brick.x + footprint.w);
      maxZ = Math.max(maxZ, brick.z + footprint.d);
    });
    return Number.isFinite(minX) ? { minX, minZ, maxX, maxZ } : null;
  }

  function createBrickModel(build) {
    if (!build?.model?.length) return null;
    const cacheKey = build.id || build.name;
    let template = buildModels.get(cacheKey);
    if (!template) {
      const occupied = new Set(build.model.flatMap(brick => Parts.cells(brick)));
      const faces = build.model.flatMap(brick => Parts.faces(brick, {
        covered(dx, dz) {
          const part = Parts.BY_ID[brick.partId];
          const [worldX, worldZ] = Parts.localColumnToWorld(brick, dx, dz);
          return occupied.has(`${worldX},${brick.y + part.h},${worldZ}`);
        }
      }));
      const vertices = faces.flatMap(face => face.v);
      if (!vertices.length) return null;
      const bounds = vertices.reduce((box, vertex) => ({
        minX: Math.min(box.minX, vertex[0]),
        minY: Math.min(box.minY, vertex[1]),
        minZ: Math.min(box.minZ, vertex[2]),
        maxX: Math.max(box.maxX, vertex[0]),
        maxZ: Math.max(box.maxZ, vertex[2])
      }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity });
      const { minX, minY, minZ, maxX, maxZ } = bounds;
      const byColor = new Map();
      faces.forEach(face => {
        if (face.a !== undefined && face.a < 1) return;
        const color = face.c || '#9aa3ae';
        const positions = byColor.get(color) || [];
        for (let index = 1; index < face.v.length - 1; index++) {
          [face.v[0], face.v[index], face.v[index + 1]].forEach(vertex => {
            positions.push(
              (vertex[0] - (minX + maxX) / 2) * MODEL_SCALE,
              (vertex[1] - minY) * MODEL_SCALE,
              (vertex[2] - (minZ + maxZ) / 2) * MODEL_SCALE
            );
          });
        }
        byColor.set(color, positions);
      });
      template = new THREE.Group();
      byColor.forEach((positions, color) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.04 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        template.add(mesh);
      });
      buildModels.set(cacheKey, template);
    }
    return template.clone(true);
  }

  function roadDistanceWorld(x, z) {
    const xRoads = ROAD_X.map(value => value / SCALE);
    const zRoads = ROAD_Z.map(value => value / SCALE);
    return Math.min(...xRoads.map(value => Math.abs(x - value)), ...zRoads.map(value => Math.abs(z - value)));
  }

  function isVehicleRoad(x, z) {
    return roadDistanceWorld(x, z) <= VEHICLE_CLEARANCE_WORLD;
  }

  function canPlaceHome(build, x, z) {
    const bounds = buildBounds(build);
    if (!bounds) return { ok: false, message: 'This creation has no brick model to place.' };
    const halfWidth = ((bounds.maxX - bounds.minX) * Parts.STUD * MODEL_SCALE / SCALE) / 2;
    const halfDepth = ((bounds.maxZ - bounds.minZ) * Parts.STUD * MODEL_SCALE / SCALE) / 2;
    const xRoads = ROAD_X.map(value => value / SCALE);
    const zRoads = ROAD_Z.map(value => value / SCALE);
    if (xRoads.some(road => Math.abs(x - road) <= GRASS_CLEARANCE_WORLD + halfWidth) ||
        zRoads.some(road => Math.abs(z - road) <= GRASS_CLEARANCE_WORLD + halfDepth)) {
      return { ok: false, message: 'That house would overlap a road or sidewalk. Find a wider patch of grass.' };
    }
    if (x - halfWidth < 85 || x + halfWidth > MAP_WIDTH / SCALE - 85 || z - halfDepth < 85 || z + halfDepth > MAP_DEPTH / SCALE - 85) {
      return { ok: false, message: 'The whole house must fit on the grass inside the town.' };
    }
    return { ok: true };
  }

  function isPlacedHome(player) {
    return !!player.house && !!player.world && (
      player.world.homePlaced === true ||
      (player.world.homePlaced === undefined && (player.world.homeX !== 125 || player.world.homeY !== 155))
    );
  }

  function updateVehicle(id, player, x, z, facing, shouldShow) {
    let entry = vehicles.get(id);
    if (!shouldShow || !player.vehicle?.model?.length) {
      if (entry) {
        scene.remove(entry.group);
        vehicles.delete(id);
      }
      return;
    }
    if (!entry || entry.buildId !== player.vehicle.id) {
      if (entry) scene.remove(entry.group);
      const group = createBrickModel(player.vehicle);
      if (!group) {
        vehicles.delete(id);
        return;
      }
      entry = { buildId: player.vehicle.id, group };
      entry.group.userData.playerId = id === '__local__' ? null : id;
      entry.group.traverse(object => { if (object.isMesh) object.userData.playerId = id === '__local__' ? null : id; });
      vehicles.set(id, entry);
      scene.add(group);
    }
    entry.group.position.set(x * SCALE, 0, z * SCALE);
    entry.group.rotation.y = facing < 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  function playerAt(event) {
    if (!renderer || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(pointer.current, camera);
    const remoteGroups = [
      ...[...avatars.entries()].filter(([id]) => id !== '__local__').map(([, group]) => group),
      ...[...vehicles.entries()].filter(([id]) => id !== '__local__').map(([, entry]) => entry.group)
    ];
    const hits = raycaster.current.intersectObjects(remoteGroups, true);
    return hits.find(hit => hit.object.userData.playerId)?.object.userData.playerId || null;
  }

  function updateScene(localPlayer, remotePlayers, px, py, facing, moving, phase, drive) {
    const localX = px * SCALE;
    const localZ = py * SCALE;
    const local = avatars.get('__local__') || createAvatar('__local__', localPlayer, true);
    avatars.set('__local__', local);
    refreshAvatar(local, localPlayer, px, py, facing, moving, phase);

    const seen = new Set();
    remotePlayers.forEach(({ player, x, z, facing: direction, moving: isMoving, phase: walkPhase }) => {
      if (!player.world) return;
      seen.add(player.id);
      let avatar = avatars.get(player.id);
      if (!avatar) {
        avatar = createAvatar(player.id, player, false);
        avatars.set(player.id, avatar);
      }
      refreshAvatar(avatar, player, x, z, direction, isMoving, walkPhase);
    });
    for (const [id, avatar] of avatars) {
      if (id !== '__local__' && !seen.has(id)) {
        scene.remove(avatar);
        avatars.delete(id);
      }
    }

    const residents = [localPlayer, ...remotePlayers.map(entry => entry.player)];
    const liveHomes = new Set();
    residents.forEach(player => {
      if (!isPlacedHome(player) || !Number.isFinite(player.world.homeX) || !Number.isFinite(player.world.homeY)) return;
      liveHomes.add(player.id);
      let home = homes.get(player.id);
      if (!home || home.buildId !== player.house.id) {
        if (home) scene.remove(home.group);
        const group = createBrickModel(player.house);
        if (!group) {
          homes.delete(player.id);
          return;
        }
        home = { buildId: player.house.id, group };
        homes.set(player.id, home);
        scene.add(group);
      }
      home.group.position.set(player.world.homeX * SCALE, 0, player.world.homeY * SCALE);
    });
    for (const [id, home] of homes) {
      if (!liveHomes.has(id)) {
        scene.remove(home.group);
        homes.delete(id);
      }
    }

    updateVehicle('__local__', localPlayer,
      localPlayer.world.inVehicle ? px : localPlayer.world.vehicleX,
      localPlayer.world.inVehicle ? py : localPlayer.world.vehicleY,
      facing, !!localPlayer.world.inVehicle || !!localPlayer.world.vehicleParked);
    remotePlayers.forEach(({ player, x, z, facing: direction }) => {
      const inVehicle = !!player.world.inVehicle;
      updateVehicle(player.id, player,
        inVehicle ? x : player.world.vehicleX,
        inVehicle ? z : player.world.vehicleY,
        direction, inVehicle || !!player.world.vehicleParked);
    });

    camera.position.set(localX + 15, 18.5, localZ + 20);
    camera.lookAt(localX, 0.7, localZ);
    camera.updateMatrixWorld();
    updateSignals();
    renderer.render(scene, camera);
    drawHud(localPlayer, remotePlayers, px, py, drive);
  }

  function drawDriveHud(width, drive) {
    if (!drive) return;
    hudContext.textAlign = 'left';
    hudContext.font = '700 12px system-ui, sans-serif';
    hudContext.fillStyle = 'rgba(22, 38, 40, 0.72)';
    hudContext.fillRect(14, 48, 198, drive.inVehicle ? 46 : 26);
    hudContext.fillStyle = '#d8ecdf';
    hudContext.fillText(drive.road || '', 24, 65);
    if (drive.inVehicle) {
      const over = drive.mph > drive.limit;
      hudContext.fillStyle = over ? '#ff8d7a' : '#ffffff';
      hudContext.fillText(`${drive.mph} mph`, 24, 85);
      hudContext.fillStyle = '#c9d6cf';
      hudContext.fillText(`limit ${drive.limit}`, 96, 85);
    }
    if (!drive.ticket) return;
    const flashing = Math.floor(clockSeconds() * 4) % 2 === 0;
    const boxWidth = 300;
    const x = width / 2 - boxWidth / 2;
    hudContext.fillStyle = flashing ? 'rgba(178, 36, 32, 0.92)' : 'rgba(34, 66, 158, 0.92)';
    hudContext.fillRect(x, 24, boxWidth, 62);
    hudContext.textAlign = 'center';
    hudContext.fillStyle = '#ffffff';
    hudContext.font = '700 16px system-ui, sans-serif';
    hudContext.fillText('PULLED OVER', width / 2, 46);
    hudContext.font = '600 13px system-ui, sans-serif';
    hudContext.fillText(drive.ticket.reason, width / 2, 65);
    hudContext.fillText(`Ticket: -${drive.ticket.fine} cred`, width / 2, 81);
  }

  function drawHud(localPlayer, remotePlayers, px, py, drive) {
    const width = hud.clientWidth;
    const height = hud.clientHeight;
    hudContext.clearRect(0, 0, width, height);
    hudContext.save();
    hudContext.font = '700 12px system-ui, sans-serif';
    hudContext.textAlign = 'left';
    hudContext.fillStyle = 'rgba(22, 38, 40, 0.72)';
    hudContext.fillRect(14, 14, 122, 28);
    hudContext.fillStyle = '#ffffff';
    hudContext.fillText(`WORLD  ${Math.round(px)}, ${Math.round(py)}`, 24, 32);
    drawDriveHud(width, drive);

    const labels = [{ player: localPlayer, x: px, z: py, local: true }, ...remotePlayers.map(entry => ({ player: entry.player, x: entry.x, z: entry.z, local: false }))];
    labels.forEach(({ player, x, z, local }) => {
      const point = new THREE.Vector3(x * SCALE, 2.75, z * SCALE).project(camera);
      const sx = (point.x * 0.5 + 0.5) * width;
      const sy = (-point.y * 0.5 + 0.5) * height;
      const visible = point.z > -1 && point.z < 1 && sx > 8 && sx < width - 8 && sy > 12 && sy < height - 8;
      if (visible) {
        const tier = getTierInfo(player);
        const title = `${player.name} · ${tier.name}`;
        hudContext.font = `${local ? '700' : '600'} 12px system-ui, sans-serif`;
        hudContext.textAlign = 'center';
        hudContext.lineWidth = 3;
        hudContext.strokeStyle = 'rgba(24, 38, 36, 0.88)';
        hudContext.strokeText(title, sx, sy);
        hudContext.fillStyle = local ? '#fff0ae' : Social.isFriend(player.id) ? '#ffe08a' : '#ffffff';
        hudContext.fillText(title, sx, sy);
      } else if (!local) {
        drawOffscreenMarker(player, sx, sy, width, height, Math.hypot(x - px, z - py));
      }
    });
    hudContext.restore();
  }

  function drawOffscreenMarker(player, x, y, width, height, distance) {
    const centerX = width / 2;
    const centerY = height / 2;
    const angle = Math.atan2(y - centerY, x - centerX);
    const edge = Math.min((centerX - 28) / Math.max(Math.abs(Math.cos(angle)), 0.001), (centerY - 28) / Math.max(Math.abs(Math.sin(angle)), 0.001));
    const ax = centerX + Math.cos(angle) * edge;
    const ay = centerY + Math.sin(angle) * edge;
    hudContext.save();
    hudContext.translate(ax, ay);
    hudContext.rotate(angle);
    hudContext.fillStyle = Social.isFriend(player.id) ? '#f4c744' : '#e8f2ef';
    hudContext.beginPath();
    hudContext.moveTo(12, 0);
    hudContext.lineTo(-7, -7);
    hudContext.lineTo(-7, 7);
    hudContext.closePath();
    hudContext.fill();
    hudContext.restore();
    hudContext.font = '700 11px system-ui, sans-serif';
    hudContext.textAlign = 'center';
    hudContext.fillStyle = 'rgba(22, 38, 40, 0.82)';
    hudContext.fillText(`${player.name}  ${Math.round(distance * 10)}m`, ax, ay + 18);
  }

  return {
    init, playerAt, updateScene, isVehicleRoad, canPlaceHome,
    listIntersections, signalFor, speedLimitAt, roadNameAt, setPoliceStop
  };
})();
globalThis.World3D = World3D;