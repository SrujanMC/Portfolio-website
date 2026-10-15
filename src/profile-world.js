import * as THREE from "three";

const canvas = document.querySelector("#profile-world-canvas");
const status = document.querySelector("#world-status");
const chapterTitle = document.querySelector("#chapter-title");
const chapterCopy = document.querySelector("#chapter-copy");
const chapterIndex = document.querySelector("#chapter-index");
const chapterPanel = document.querySelector("#world-chapter-panel");
const chapterButtons = [...document.querySelectorAll(".world-chapter")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const chapters = {
  chess: {
    index: "01 / 04",
    title: "The quiet move",
    copy: "Chess is patience made visible: a board of possibilities, one thoughtful move at a time.",
  },
  security: {
    index: "02 / 04",
    title: "Curiosity, with care",
    copy: "Learning how systems work — and how to help keep them resilient. Always learning, always ethical.",
  },
  web: {
    index: "03 / 04",
    title: "Ideas take shape",
    copy: "Building thoughtful websites where useful details, motion, and feeling meet.",
  },
  music: {
    index: "04 / 04",
    title: "Listen closer",
    copy: "Music brings another kind of focus: finding rhythm, making space, and following a feeling.",
  },
};

let scene;
let camera;
let renderer;
let world;
let nodes = {};
let animationFrame = 0;
let resizeObserver;
let activeChapter = "chess";
let pointer = new THREE.Vector2();
let hoveredChapter = "";
let disposed = false;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function selectChapter(key, moveFocus = false) {
  const chapter = chapters[key];
  if (!chapter) return;

  activeChapter = key;
  chapterIndex.textContent = chapter.index;
  chapterTitle.textContent = chapter.title;
  chapterCopy.textContent = chapter.copy;
  chapterPanel.setAttribute("aria-labelledby", `tab-${key}`);

  chapterButtons.forEach((button) => {
    const selected = button.dataset.world === key;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) button.focus();
  });
}

chapterButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectChapter(button.dataset.world));
  button.addEventListener("keydown", (event) => {
    const nextKeys = ["ArrowRight", "ArrowDown"];
    const previousKeys = ["ArrowLeft", "ArrowUp"];
    if (!nextKeys.includes(event.key) && !previousKeys.includes(event.key)) return;
    event.preventDefault();
    const direction = nextKeys.includes(event.key) ? 1 : -1;
    const next = (index + direction + chapterButtons.length) % chapterButtons.length;
    const nextButton = chapterButtons[next];
    selectChapter(nextButton.dataset.world, true);
  });
});

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.55,
    roughness: options.roughness ?? 0.34,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    flatShading: options.flatShading ?? false,
  });
}

const brass = material("#b8a16f", { metalness: 0.82, roughness: 0.24 });
const paleMetal = material("#d8dfce", { metalness: 0.8, roughness: 0.26 });
const darkMetal = material("#18221d", { metalness: 0.7, roughness: 0.3 });
const greenLight = material("#a9c790", {
  metalness: 0.46,
  roughness: 0.25,
  emissive: "#527747",
  emissiveIntensity: 0.62,
});
const glass = material("#22342c", {
  metalness: 0.48,
  roughness: 0.2,
  transparent: true,
  opacity: 0.79,
});

function addMesh(parent, geometry, meshMaterial, position = [0, 0, 0], rotation) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function makeGroup(parent, position, key) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.userData.chapterKey = key;
  group.userData.homePosition = group.position.clone();
  group.userData.phase = Object.keys(chapters).indexOf(key) * 1.6;
  parent.add(group);
  return group;
}

function addNodeHalo(group, color) {
  const halo = addMesh(
    group,
    new THREE.TorusGeometry(1.45, 0.012, 6, 100),
    material(color, {
      metalness: 0.6,
      roughness: 0.25,
      emissive: color,
      emissiveIntensity: 0.48,
      transparent: true,
      opacity: 0.68,
    }),
    [0, 0, -0.2],
    [0.3, 0, 0.25],
  );
  halo.userData.chapterKey = group.userData.chapterKey;
}

function createChess(group) {
  const board = new THREE.Group();
  board.rotation.x = -0.16;
  board.position.y = -0.45;
  group.add(board);
  addMesh(board, new THREE.BoxGeometry(2.52, 0.12, 2.52), darkMetal, [0, 0, 0]);

  const paleTile = material("#a9ad98", { metalness: 0.25, roughness: 0.62 });
  const darkTile = material("#303b32", { metalness: 0.35, roughness: 0.56 });
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const tileMaterial = (row + column) % 2 === 0 ? paleTile : darkTile;
      addMesh(
        board,
        new THREE.BoxGeometry(0.302, 0.025, 0.302),
        tileMaterial,
        [-1.06 + column * 0.303, 0.075, -1.06 + row * 0.303],
      );
    }
  }

  const pieces = new THREE.Group();
  group.add(pieces);
  const z = 0.28;
  addMesh(pieces, new THREE.CylinderGeometry(0.32, 0.42, 0.16, 32), brass, [0, 0.03, z]);
  addMesh(pieces, new THREE.CylinderGeometry(0.19, 0.27, 0.22, 24), brass, [0, 0.22, z]);
  addMesh(pieces, new THREE.CylinderGeometry(0.13, 0.19, 0.58, 24), brass, [0, 0.6, z]);
  addMesh(pieces, new THREE.SphereGeometry(0.18, 24, 16), brass, [0, 0.98, z]);
  addMesh(pieces, new THREE.CylinderGeometry(0.09, 0.14, 0.16, 20), brass, [0, 1.16, z]);
  addMesh(pieces, new THREE.BoxGeometry(0.095, 0.48, 0.095), paleMetal, [0, 1.48, z]);
  addMesh(pieces, new THREE.BoxGeometry(0.31, 0.095, 0.095), paleMetal, [0, 1.48, z]);
  addMesh(pieces, new THREE.CylinderGeometry(0.25, 0.31, 0.13, 24), paleMetal, [-0.73, 0.16, 0.88]);
  addMesh(pieces, new THREE.SphereGeometry(0.15, 20, 16), paleMetal, [-0.73, 0.31, 0.88]);
  addNodeHalo(group, "#b8a16f");
}

function createShield(group) {
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0, 1.35);
  shieldShape.quadraticCurveTo(0.78, 0.9, 0.9, 0.92);
  shieldShape.lineTo(0.79, 0.14);
  shieldShape.quadraticCurveTo(0.55, -0.82, 0, -1.18);
  shieldShape.quadraticCurveTo(-0.55, -0.82, -0.79, 0.14);
  shieldShape.lineTo(-0.9, 0.92);
  shieldShape.quadraticCurveTo(-0.78, 0.9, 0, 1.35);
  const shieldGeometry = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.055,
    bevelThickness: 0.055,
  });
  addMesh(group, shieldGeometry, greenLight, [0, -0.05, 0]);
  addMesh(
    group,
    new THREE.TorusGeometry(0.3, 0.075, 12, 32, Math.PI),
    paleMetal,
    [0, 0.05, 0.22],
    [0, 0, 0],
  );
  addMesh(group, new THREE.BoxGeometry(0.72, 0.62, 0.19), darkMetal, [0, -0.42, 0.22]);
  addMesh(group, new THREE.SphereGeometry(0.07, 16, 12), greenLight, [0, -0.4, 0.34]);
  addMesh(group, new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), paleMetal, [0, -0.52, 0.34]);
  const network = new THREE.Group();
  group.add(network);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const bead = addMesh(
      network,
      new THREE.IcosahedronGeometry(0.055, 1),
      paleMetal,
      [Math.cos(angle) * 1.5, Math.sin(angle) * 1.2, -0.1],
    );
    bead.userData.chapterKey = "security";
  }
  addNodeHalo(group, "#88aa75");
}

function screenTexture() {
  const screen = document.createElement("canvas");
  screen.width = 640;
  screen.height = 420;
  const context = screen.getContext("2d");
  if (!context) throw new Error("Canvas texture is unavailable.");
  context.fillStyle = "#101a16";
  context.fillRect(0, 0, screen.width, screen.height);
  context.fillStyle = "#b8cca5";
  context.fillRect(0, 0, screen.width, 46);
  context.fillStyle = "#26362d";
  context.font = "500 18px monospace";
  context.fillText("SRUJAN / STUDIO", 25, 30);
  context.fillStyle = "#84907f";
  context.font = "15px monospace";
  context.fillText("const ideas = curiosity.map(make);", 38, 109);
  context.fillText("interface  {", 38, 153);
  context.fillText("  feeling: detail,", 38, 197);
  context.fillText("  motion: intention,", 38, 241);
  context.fillText("  result: something alive", 38, 285);
  context.fillText("}", 38, 329);
  context.fillStyle = "#d9c48c";
  context.fillText("return build(world);", 38, 373);
  const texture = new THREE.CanvasTexture(screen);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWeb(group) {
  addMesh(group, new THREE.BoxGeometry(2.55, 1.8, 0.12), brass, [0, 0.05, 0]);
  addMesh(group, new THREE.BoxGeometry(2.36, 1.6, 0.04), darkMetal, [0, 0.05, 0.085]);
  const screen = addMesh(
    group,
    new THREE.PlaneGeometry(2.25, 1.48),
    new THREE.MeshBasicMaterial({ map: screenTexture() }),
    [0, 0.05, 0.112],
  );
  screen.userData.chapterKey = "web";
  addMesh(group, new THREE.BoxGeometry(1.1, 0.1, 0.58), brass, [0, -1.02, -0.02]);
  addMesh(group, new THREE.BoxGeometry(1.75, 0.08, 0.45), paleMetal, [0, -0.9, -0.01]);
  addNodeHalo(group, "#89b29b");
}

function createMusic(group) {
  const record = new THREE.Group();
  group.add(record);
  record.position.set(0, 0.06, 0);
  record.rotation.x = 0.18;
  addMesh(record, new THREE.CylinderGeometry(1.12, 1.12, 0.12, 64), darkMetal, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let radius = 0.34; radius < 1.02; radius += 0.12) {
    addMesh(
      record,
      new THREE.TorusGeometry(radius, 0.008, 4, 80),
      material("#667369", { metalness: 0.65, roughness: 0.32 }),
      [0, 0, 0.072],
    );
  }
  addMesh(record, new THREE.CylinderGeometry(0.29, 0.29, 0.025, 48), brass, [0, 0, 0.087], [0, 0, 0]);
  addMesh(record, new THREE.CircleGeometry(0.075, 24), paleMetal, [0, 0, 0.104]);
  record.userData.isRecord = true;

  const bars = new THREE.Group();
  group.add(bars);
  for (let index = 0; index < 17; index += 1) {
    const x = -1.55 + index * 0.19;
    const height = 0.18 + Math.abs(Math.sin(index * 1.21)) * 0.82;
    const bar = addMesh(
      bars,
      new THREE.BoxGeometry(0.045, height, 0.045),
      index % 4 === 0 ? brass : greenLight,
      [x, -1.35 + height / 2, 0.2],
    );
    bar.userData.baseHeight = height;
    bar.userData.waveIndex = index;
  }
  addNodeHalo(group, "#c5a978");
}

function createNodes() {
  nodes.chess = makeGroup(world, [-3.7, 1.15, 0.2], "chess");
  nodes.security = makeGroup(world, [3.65, 1.35, -0.25], "security");
  nodes.web = makeGroup(world, [-3.55, -2.15, -1.2], "web");
  nodes.music = makeGroup(world, [3.6, -2.15, -0.7], "music");
  createChess(nodes.chess);
  createShield(nodes.security);
  createWeb(nodes.web);
  createMusic(nodes.music);
}

function createCore() {
  const core = new THREE.Group();
  world.add(core);
  const crystal = addMesh(
    core,
    new THREE.IcosahedronGeometry(1.34, 2),
    material("#93aa8a", {
      metalness: 0.58,
      roughness: 0.19,
      emissive: "#243d30",
      emissiveIntensity: 0.62,
      flatShading: true,
    }),
  );
  crystal.userData.isCore = true;
  addMesh(core, new THREE.IcosahedronGeometry(1.6, 1), glass);
  const ringA = addMesh(
    core,
    new THREE.TorusGeometry(2.18, 0.018, 8, 128),
    brass,
    [0, 0, 0],
    [0.86, 0.14, 0.24],
  );
  ringA.userData.ringSpeed = 0.12;
  const ringB = addMesh(
    core,
    new THREE.TorusGeometry(2.64, 0.009, 6, 140),
    greenLight,
    [0, 0, 0],
    [1.13, -0.4, 0.6],
  );
  ringB.userData.ringSpeed = -0.08;
  addMesh(
    core,
    new THREE.TorusGeometry(0.52, 0.018, 8, 80),
    paleMetal,
    [0, 0, 1.63],
    [0.25, 0.1, 0],
  );
  core.userData.isCore = true;
  return core;
}

function createStars() {
  const count = window.innerWidth < 600 ? 520 : 900;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 34;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 23;
    positions[index * 3 + 2] = -9 - Math.random() * 23;
    sizes[index] = 0.35 + Math.random() * 1.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: "#cad4be",
      size: 0.025,
      transparent: true,
      opacity: 0.68,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  scene.add(stars);
}

function resize() {
  if (!canvas || !renderer || !camera) return;
  const { width, height } = canvas.getBoundingClientRect();
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  camera.aspect = safeWidth / safeHeight;
  camera.position.z = safeWidth < 560 ? 21 : safeWidth < 850 ? 19 : 17.5;
  camera.fov = safeWidth < 560 ? 41 : 37;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, safeWidth < 600 ? 1.35 : 1.7));
  renderer.setSize(safeWidth, safeHeight, false);
}

function chapterFromIntersection(intersection) {
  let object = intersection?.object;
  while (object) {
    if (object.userData.chapterKey) return object.userData.chapterKey;
    object = object.parent;
  }
  return "";
}

function raycast(pointerEvent, shouldSelect = false) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((pointerEvent.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((pointerEvent.clientY - bounds.top) / bounds.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(Object.values(nodes), true);
  const key = chapterFromIntersection(intersections[0]);
  hoveredChapter = key;
  canvas.style.cursor = key ? "pointer" : "default";
  if (shouldSelect && key) selectChapter(key);
}

function onPointerMove(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycast(event);
}

function onPointerLeave() {
  hoveredChapter = "";
  canvas.style.cursor = "default";
  pointer.set(0, 0);
}

function onPointerClick(event) {
  raycast(event, true);
}

function animate() {
  if (disposed || document.hidden) return;
  animationFrame = window.requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  const motion = reduceMotion.matches ? 0 : 1;

  world.rotation.y += (pointer.x * 0.055 - world.rotation.y) * 0.018;
  world.rotation.x += (-pointer.y * 0.024 - world.rotation.x) * 0.018;
  camera.position.x += (pointer.x * 0.42 - camera.position.x) * 0.018;
  camera.position.y += (3.3 + pointer.y * 0.2 - camera.position.y) * 0.018;

  world.children.forEach((object) => {
    if (object.userData.isCore) {
      object.rotation.y = time * 0.14 * motion;
      object.rotation.x = Math.sin(time * 0.22) * 0.08 * motion;
      object.children.forEach((child) => {
        if (child.userData.ringSpeed) child.rotation.z += child.userData.ringSpeed * 0.008 * motion;
        if (child.userData.isCore) child.rotation.y = -time * 0.05 * motion;
      });
      return;
    }

    const key = object.userData.chapterKey;
    const isActive = key === activeChapter;
    const isHovered = key === hoveredChapter;
    const home = object.userData.homePosition;
    const lift = isActive ? 0.12 : isHovered ? 0.08 : 0;
    const scale = isActive ? 1.04 : isHovered ? 0.99 : 0.88;
    object.position.y += (home.y + lift + Math.sin(time * 0.7 + object.userData.phase) * 0.055 * motion - object.position.y) * 0.035;
    object.scale.x += (scale - object.scale.x) * 0.06;
    object.scale.y += (scale - object.scale.y) * 0.06;
    object.scale.z += (scale - object.scale.z) * 0.06;
    object.rotation.y += ((isActive ? 0.16 : 0.07) * motion - object.rotation.y) * 0.025;
    object.children.forEach((child) => {
      if (child.userData.isRecord) child.rotation.y += 0.004 * motion;
      if (child.userData.waveIndex !== undefined) {
        const height = child.userData.baseHeight * (0.82 + Math.sin(time * 2.3 + child.userData.waveIndex * 0.7) * 0.18 * motion);
        child.scale.y += (height / child.userData.baseHeight - child.scale.y) * 0.1;
        child.position.y = -1.35 + height / 2;
      }
    });
  });

  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

function onVisibilityChange() {
  if (document.hidden) {
    window.cancelAnimationFrame(animationFrame);
    return;
  }
  window.cancelAnimationFrame(animationFrame);
  animationFrame = window.requestAnimationFrame(animate);
}

function dispose() {
  disposed = true;
  window.cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pagehide", dispose);
  canvas.removeEventListener("pointermove", onPointerMove);
  canvas.removeEventListener("pointerleave", onPointerLeave);
  canvas.removeEventListener("click", onPointerClick);
  scene?.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
    else object.material?.dispose();
  });
  renderer?.dispose();
}

function start() {
  if (!canvas) throw new Error("The 3D scene canvas was not found.");
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#080d0c", 0.018);
  camera = new THREE.PerspectiveCamera(37, 1, 0.1, 90);
  camera.position.set(0, 3.3, 17.5);

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: window.innerWidth > 600,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;

  scene.add(new THREE.HemisphereLight("#c6d5bc", "#101710", 1.1));
  const keyLight = new THREE.PointLight("#e4d5ac", 72, 25, 2);
  keyLight.position.set(-5, 6, 8);
  scene.add(keyLight);
  const greenLightSource = new THREE.PointLight("#75a67d", 48, 22, 2);
  greenLightSource.position.set(6, 2, 3);
  scene.add(greenLightSource);
  const rimLight = new THREE.DirectionalLight("#c4d0bc", 1.15);
  rimLight.position.set(0, 7, -4);
  scene.add(rimLight);

  world = new THREE.Group();
  scene.add(world);
  createCore();
  createNodes();
  createStars();

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onPointerClick);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", dispose, { once: true });
  window.addEventListener("webglcontextlost", () => {
    setStatus("The 3D scene paused because the graphics context was interrupted. Refresh to restore it.", true);
  });
  resize();
  selectChapter(activeChapter);
  setStatus("Move across the scene · Select a world to explore");
  animate();
}

try {
  start();
} catch (error) {
  console.error("Unable to start the interactive profile scene.", error);
  setStatus("This browser could not start the 3D scene. The profile chapters and contact link are still available.", true);
}
