// Three.js environment and avatar renderer for the World tab.
const World3D = (() => {
  const SCALE = 0.1;
  const MAP_WIDTH = 240;
  const MAP_DEPTH = 160;
  const ROAD_X = [24, 72, 120, 168, 216];
  const ROAD_Z = [22, 70, 118];
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
      new THREE.PlaneGeometry(330, 250),
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

  function nearRoad(x, z, margin = 7) {
    return ROAD_X.some(road => Math.abs(x - road) < margin) || ROAD_Z.some(road => Math.abs(z - road) < margin);
  }

  function addParks() {
    const parks = [
      { x: 96, z: 94, w: 22, d: 19 },
      { x: 190, z: 46, w: 22, d: 19 },
      { x: 48, z: 142, w: 22, d: 16 }
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

  function buildHouses(random) {
    const bodyColors = ['#e8c98d', '#d9e0cf', '#e4aa7d', '#9fc6c2', '#e9d5cf'];
    const roofColors = ['#a9503c', '#596e70', '#b97748'];
    const possible = [];
    const occupied = [State.player, ...State.onlinePlayers]
      .filter(player => player && player.world)
      .map(player => ({ x: player.world.x * SCALE, z: player.world.y * SCALE }));
    for (let x = 10; x < MAP_WIDTH - 8; x += 20) {
      for (let z = 10; z < MAP_DEPTH - 8; z += 18) {
        const playerNearby = occupied.some(position => Math.hypot(x - position.x, z - position.z) < 13);
        if (!playerNearby && !nearRoad(x, z, 8) && random() < 0.62) possible.push({ x, z });
      }
    }
    possible.forEach(({ x, z }, index) => {
      const group = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColors[index % bodyColors.length], roughness: 0.9 });
      const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColors[index % roofColors.length], roughness: 0.87 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.9, 2.9, 4.5), bodyMaterial);
      body.position.y = 1.55;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.25, 4), roofMaterial);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 4.05;
      roof.castShadow = true;
      group.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.55, 0.13), shared.door);
      door.position.set(0, 0.85, 2.32);
      group.add(door);
      [-1.25, 1.25].forEach(side => {
        const window = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.7, 0.12), shared.window);
        window.position.set(side, 1.8, 2.34);
        group.add(window);
      });
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.55), shared.sidewalk);
      step.position.set(0, 0.15, 2.72);
      group.add(step);
      group.position.set(x, 0, z);
      scene.add(group);
    });
    return possible;
  }

  function addTreesAndShrubs(random, houseLots) {
    const trees = [];
    const shrubs = [];
    for (let x = 6; x < MAP_WIDTH - 5; x += 7.5) {
      for (let z = 6; z < MAP_DEPTH - 5; z += 7) {
        const tx = x + (random() - 0.5) * 4;
        const tz = z + (random() - 0.5) * 3;
        if (nearRoad(tx, tz, 7.2) || houseLots.some(lot => Math.hypot(tx - lot.x, tz - lot.z) < 7)) continue;
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
    addParks();
    const random = seededRandom();
    const houseLots = buildHouses(random);
    addTreesAndShrubs(random, houseLots);
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
    const vehicle = makeVehicle();
    vehicle.position.set(0.95, 0, 0.25);
    vehicle.visible = !!player.vehicle;
    root.add(vehicle);
    root.userData.parts = { legs, leftArm, rightArm, bodyMaterial, legMaterial, vehicle };
    root.traverse(object => {
      if (object.isMesh) object.userData.playerId = local ? null : id;
    });
    scene.add(root);
    return root;
  }

  function makeVehicle() {
    const group = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color: '#e6a82d', roughness: 0.55, metalness: 0.08 });
    const glass = new THREE.MeshStandardMaterial({ color: '#8dcbd3', roughness: 0.28, metalness: 0.12 });
    const tire = new THREE.MeshStandardMaterial({ color: '#30373b', roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.35, 1.65), shell);
    base.position.y = 0.48;
    base.castShadow = true;
    group.add(base);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.28, 0.5), shell);
    hood.position.set(0, 0.7, 0.58);
    group.add(hood);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.08), glass);
    windshield.position.set(0, 0.83, -0.13);
    group.add(windshield);
    [-0.62, 0.62].forEach(x => [-0.5, 0.5].forEach(z => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 10), tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.33, z);
      group.add(wheel);
    }));
    group.traverse(object => { if (object.isMesh) object.castShadow = true; });
    return group;
  }

  function refreshAvatar(root, player, x, z, facing, moving, phase) {
    const tier = getTierInfo(player);
    root.position.set(x * SCALE, 0, z * SCALE);
    root.rotation.y = facing < 0 ? -Math.PI / 2 : Math.PI / 2;
    const parts = root.userData.parts;
    parts.bodyMaterial.color.set(tier.bodyColor);
    parts.legMaterial.color.set(tier.legColor);
    parts.vehicle.visible = !!player.vehicle;
    const swing = moving ? Math.sin(phase) * 0.48 : 0;
    parts.legs[0].rotation.x = swing;
    parts.legs[1].rotation.x = -swing;
    parts.leftArm.rotation.x = -swing * 0.72;
    parts.rightArm.rotation.x = swing * 0.72;
  }

  function createHome(id, player) {
    const group = new THREE.Group();
    const palettes = ['#d9bb88', '#b9d0c0', '#e1ae88', '#b5c7d8'];
    let hash = 0;
    String(id).split('').forEach(char => { hash = (hash * 31 + char.charCodeAt(0)) >>> 0; });
    const wall = new THREE.MeshStandardMaterial({ color: palettes[hash % palettes.length], roughness: 0.9 });
    const roof = new THREE.MeshStandardMaterial({ color: ['#a64f40', '#657a76', '#b57c49'][hash % 3], roughness: 0.84 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.5, 5.1), wall);
    body.position.y = 1.9;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.6, 4), roof);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.position.y = 4.9;
    roofMesh.castShadow = true;
    group.add(roofMesh);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.85, 0.14), shared.door);
    door.position.set(0, 1.02, 2.62);
    group.add(door);
    [-1.5, 1.5].forEach(side => {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.76, 0.13), shared.window);
      window.position.set(side, 2.05, 2.64);
      group.add(window);
    });
    const porch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1.4), shared.sidewalk);
    porch.position.set(0, 0.16, 3.05);
    group.add(porch);
    group.userData.playerId = id;
    group.traverse(object => { if (object.isMesh) object.castShadow = true; });
    scene.add(group);
    return group;
  }

  function playerAt(event) {
    if (!renderer || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(pointer.current, camera);
    const remoteGroups = [...avatars.entries()].filter(([id]) => id !== '__local__').map(([, group]) => group);
    const hits = raycaster.current.intersectObjects(remoteGroups, true);
    return hits.find(hit => hit.object.userData.playerId)?.object.userData.playerId || null;
  }

  function updateScene(localPlayer, remotePlayers, px, py, facing, moving, phase) {
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
      if (!player.house || !player.world || !Number.isFinite(player.world.homeX) || !Number.isFinite(player.world.homeY)) return;
      liveHomes.add(player.id);
      let home = homes.get(player.id);
      if (!home) {
        home = createHome(player.id, player);
        homes.set(player.id, home);
      }
      home.position.set(player.world.homeX * SCALE, 0, player.world.homeY * SCALE);
    });
    for (const [id, home] of homes) {
      if (!liveHomes.has(id)) {
        scene.remove(home);
        homes.delete(id);
      }
    }

    camera.position.set(localX + 15, 18.5, localZ + 20);
    camera.lookAt(localX, 0.7, localZ);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    drawHud(localPlayer, remotePlayers, px, py);
  }

  function drawHud(localPlayer, remotePlayers, px, py) {
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

  return { init, playerAt, updateScene };
})();
globalThis.World3D = World3D;