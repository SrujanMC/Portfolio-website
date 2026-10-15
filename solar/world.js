import * as THREE from "./vendor/build/three.module.js";
import { OrbitControls } from "./vendor/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "./vendor/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "./vendor/examples/jsm/postprocessing/ShaderPass.js";
import { BODY_ORDER, BODIES, findBody } from "./data.js";

const colorGradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.25 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float saturation; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722)); c.rgb=mix(vec3(l),c.rgb,saturation); gl_FragColor=c; }`,
};
const ASSET = "./solar-assets/";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(max-width: 760px)").matches;
const canvas = document.querySelector("#solar-canvas");
const loadingScreen = document.querySelector("#loading-screen");
const loadingStatus = document.querySelector("#loading-status");
const loadingBar = document.querySelector("#loading-bar");
const fallback = document.querySelector("#webgl-fallback");

if (!canvas || !detectWebGL()) {
  loadingScreen.classList.add("is-hidden");
  fallback.hidden = false;
} else {
  boot().catch((error) => {
    console.error(error);
    loadingScreen.classList.add("is-hidden");
    fallback.hidden = false;
  });
}

function detectWebGL() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060c);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 4000);
  const home = mobile ? new THREE.Vector3(210, 150, 250) : new THREE.Vector3(250, 175, 300);
  camera.position.copy(reducedMotion ? home : new THREE.Vector3(0, 520, 980));
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 1100;
  controls.minDistance = 8;
  controls.target.set(0, 0, 0);
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI - 0.12;
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => { loadingBar.style.width = `${Math.round(loaded / Math.max(total, 1) * 100)}%`; };
  manager.onLoad = () => { loadingBar.style.width = "100%"; setTimeout(() => loadingScreen.classList.add("is-hidden"), reducedMotion ? 0 : 350); };
  manager.onError = (url) => console.error("Unable to load solar system asset:", url);
  const loader = new THREE.TextureLoader(manager);
  const loadMap = (file) => { const texture = loader.load(`${ASSET}images/${file}`); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture; };
  scene.add(new THREE.AmbientLight(0x9caad4, 0.65));
  scene.add(new THREE.HemisphereLight(0xfff1cf, 0x20284a, 1.0));
  scene.add(new THREE.PointLight(0xfff4d2, 280, 0, 1.15));
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.72, 0.28));
  composer.addPass(new ShaderPass(colorGradeShader));
  const disposables = [];
  addBackdrop(scene, disposables);
  const stars = addStars(scene, mobile ? 2400 : 5800, disposables);
  const bodies = {};
  const focusables = [];
  const clock = new THREE.Clock();
  const pointer = new THREE.Vector2(2, 2);
  const raycaster = new THREE.Raycaster();
  const hoverLabel = document.querySelector("#hover-label");
  const sun = makeSun(scene, loadMap, disposables);
  bodies.sun = registerBody("sun", sun.mesh, 42, sun.mesh);
  makeHit(sun.mesh, "sun", 1.5);
  const planets = [
    spec("mercury", 2.5, 42, 0.0009, 0.012, "mercurymap.jpg", "mercurybump.jpg"),
    spec("venus", 6.1, 68, 0.0007, 0.004, "venusmap.jpg", "venusbump.jpg", { atmosphere: "venus_atmosphere.jpg", atmosphereColor: 0xffc27a }),
    spec("earth", 6.5, 96, 0.00055, 0.02, "earth_daymap.jpg", null, { atmosphere: "earth_atmosphere.jpg", atmosphereColor: 0x8fd0ff, night: "earth_nightmap.jpg" }),
    spec("mars", 3.5, 128, 0.00042, 0.018, "marsmap.jpg", "marsbump.jpg"),
    spec("jupiter", 16, 190, 0.00022, 0.04, "jupiter.jpg"),
    spec("saturn", 13.5, 255, 0.00016, 0.036, "saturnmap.jpg", null, { ring: "saturn_ring.png", ringInner: 17, ringOuter: 28 }),
    spec("uranus", 8, 320, 0.00011, 0.028, "uranus.jpg", null, { tilt: 82 }),
    spec("neptune", 7.8, 375, 0.00008, 0.026, "neptune.jpg", null, { atmosphereColor: 0x7eb6ff }),
  ];
  planets.forEach((planet) => {
    const made = makePlanet(scene, loadMap, disposables, planet);
    bodies[planet.id] = registerBody(planet.id, made.pivot, planet.size * 3.2, made.planet);
    makeHit(made.planet, planet.id, 2.1);
  });
  const moonSpecs = [
    ["earth", "moon", 1.7, 12, 0.004, "moonmap.jpg", "moonbump.jpg"],
    ["mars", "phobos", 0.7, 6.2, 0.008, "moon.jpg"], ["mars", "deimos", 0.5, 9.4, 0.005, "moonbump.jpg"],
    ["jupiter", "io", 1.5, 22, 0.0032, "jupiterIo.jpg"], ["jupiter", "europa", 1.35, 27, 0.0024, "jupiterEuropa.jpg"],
    ["jupiter", "ganymede", 1.9, 33, 0.0017, "jupiterGanymede.jpg"], ["jupiter", "callisto", 1.7, 39, 0.0012, "jupiterCallisto.jpg"],
    ["saturn", "titan", 1.8, 20, 0.0018, "moonmap.jpg"], ["uranus", "titania", 0.9, 12, 0.0022, "moon.jpg"],
    ["uranus", "oberon", 0.85, 16, 0.0015, "moonbump.jpg"], ["neptune", "triton", 1.2, 13, -0.002, "plutomap.jpg"],
  ];
  moonSpecs.forEach(([parentId, id, size, radius, speed, texture, bump]) => {
    const parent = bodies[parentId].object;
    const moon = makeMoon(parent, loadMap, disposables, { id, size, radius, speed, texture, bump });
    bodies[id] = registerBody(id, moon.pivot, Math.max(4.5, size * 5.5), moon.mesh, parentId);
    makeHit(moon.mesh, id, 3.0);
  });
  const belt = makeAsteroidBelt(scene, disposables, mobile ? 1200 : 3000);
  bodies.asteroid = { id: "asteroid", object: belt.meshes[0], focusRadius: 28, hits: belt.meshes };
  focusables.push(...belt.meshes);
  buildMenu();
  document.querySelector("#close-info").addEventListener("click", clearFocus);
  let running = !document.hidden;
  let elapsed = 0;
  let timeScale = reducedMotion ? 1 : 8;
  let focusId = null;
  let flight = null;
  let hoverId = null;
  let lastPointerDown = null;
  const drift = { x: 0, y: 0 };
  canvas.addEventListener("pointermove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    if (!reducedMotion && event.pointerType !== "touch") {
      drift.x += ((event.clientX / innerWidth) * 2 - 1 - drift.x) * 0.08;
      drift.y += ((event.clientY / innerHeight) * 2 - 1 - drift.y) * 0.08;
    }
    hoverLabel.style.left = `${event.clientX}px`;
    hoverLabel.style.top = `${event.clientY}px`;
  });
  canvas.addEventListener("pointerdown", (event) => { lastPointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId }; canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointerup", (event) => {
    canvas.style.cursor = hoverId ? "pointer" : "grab";
    const start = lastPointerDown;
    lastPointerDown = null;
    if (start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) selectAtPointer();
  });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") clearFocus(); });
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) { clock.getDelta(); requestAnimationFrame(frame); } });
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / Math.max(innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
  });
  window.addEventListener("pagehide", dispose);
  if (running) requestAnimationFrame(frame);

  function frame() {
    if (!running) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    const intro = reducedMotion ? 1 : smoothstep(elapsed / 4);
    if (!reducedMotion && !focusId) {
      timeScale = THREE.MathUtils.lerp(8, 3, intro);
      camera.position.lerp(sampleSwoop(intro), 0.08);
    } else if (focusId) timeScale = THREE.MathUtils.lerp(timeScale, 0.5, 0.04);
    else timeScale = 1;
    sun.mesh.rotation.y += delta * 0.08;
    sun.corona.material.rotation += delta * 0.15;
    sun.corona.lookAt(camera.position);
    stars.uniforms.uTime.value = elapsed;
    Object.values(bodies).forEach((body) => {
      if (!body.orbit) return;
      body.angle += delta * body.orbit.speed * timeScale * 8;
      body.object.position.set(Math.cos(body.angle) * body.orbit.radius, Math.sin(body.angle) * body.orbit.lift, Math.sin(body.angle) * body.orbit.radius);
      if (body.spin) body.spin.rotation.y += delta * body.orbit.spin * timeScale;
    });
    belt.update(delta, timeScale);
    if (!reducedMotion && !flight && !focusId) {
      const bob = Math.sin(elapsed * 0.23) * 8;
      const roll = Math.sin(elapsed * 0.11) * 0.03;
      controls.target.set(drift.x * 10, bob * 0.15, 0);
      camera.position.x += (home.x + drift.x * 18 - camera.position.x) * 0.01;
      camera.position.y += (home.y + bob + drift.y * -12 - camera.position.y) * 0.01;
      camera.up.set(Math.sin(roll), 1, 0).normalize();
    }
    if (flight) updateFlight(delta);
    updateHover();
    controls.update();
    composer.render();
    requestAnimationFrame(frame);
  }

  function registerBody(id, object, focusRadius, spin, parentId = null) {
    const record = { id, object, spin, focusRadius, hits: [], parentId, angle: Math.random() * Math.PI * 2, orbit: object.userData.orbit || null };
    bodies[id] = record;
    return record;
  }

  function makeHit(mesh, id, radiusScale = 1.8) {
    const radius = mesh.geometry?.parameters?.radius || 2;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * radiusScale, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.bodyId = id;
    mesh.add(hit);
    bodies[id].hits.push(hit);
    focusables.push(hit);
    disposables.push(hit.geometry, hit.material);
  }

  function updateHover() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(focusables, false)[0];
    const id = hit?.object.userData.bodyId || (hit?.object.isInstancedMesh ? "asteroid" : null);
    if (id !== hoverId) setHighlight(hoverId, false);
    setHighlight(id, true);
    hoverId = id;
    canvas.classList.toggle("is-hover", Boolean(id));
    if (!id) { hoverLabel.hidden = true; return; }
    hoverLabel.hidden = false;
    hoverLabel.textContent = findBody(id)?.title || "Small experiment";
  }

  function setHighlight(id, active) {
    const body = bodies[id];
    if (!body?.spin?.material) return;
    const material = body.spin.material;
    if (Array.isArray(material)) return;
    if (active) {
      if (material.emissive) material.emissive.set(0x554422);
      material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.7);
    } else if (material.emissive) {
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
    }
  }

  function selectAtPointer() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(focusables, false)[0];
    if (!hit) return;
    if (hit.object.isInstancedMesh) { focusOn("asteroid", hit.point); return; }
    if (hit.object.userData.bodyId) focusOn(hit.object.userData.bodyId);
  }

  function focusOn(id, point = null) {
    const body = bodies[id];
    const copy = findBody(id);
    if (!body || !copy) return;
    focusId = id;
    document.body.classList.add("is-focused");
    const world = point ? point.clone() : new THREE.Vector3();
    if (!point) body.object.getWorldPosition(world);
    const from = camera.position.clone();
    const offset = camera.position.clone().sub(controls.target).normalize();
    if (offset.lengthSq() < 0.01) offset.set(0.4, 0.35, 1).normalize();
    flight = { from, to: world.clone().add(offset.multiplyScalar(id === "asteroid" ? 22 : body.focusRadius)), lookFrom: controls.target.clone(), lookTo: world, t: 0, duration: reducedMotion ? 0.01 : 1.5 };
    showPanel(copy);
    document.querySelectorAll(".body-chip").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.id === id));
  }

  function updateFlight(delta) {
    flight.t = Math.min(1, flight.t + delta / flight.duration);
    const t = easeInOut(flight.t);
    camera.position.lerpVectors(flight.from, flight.to, t);
    controls.target.lerpVectors(flight.lookFrom, flight.lookTo, t);
    if (flight.t >= 1) flight = null;
  }

  function clearFocus() {
    focusId = null;
    flight = null;
    document.body.classList.remove("is-focused");
    hidePanel();
    const from = camera.position.clone();
    const lookFrom = controls.target.clone();
    flight = { from, to: home.clone(), lookFrom, lookTo: new THREE.Vector3(), t: 0, duration: reducedMotion ? 0.01 : 1.5 };
  }

  function showPanel(copy) {
    document.querySelector("#planetName").textContent = copy.title;
    document.querySelector("#planetTagline").textContent = copy.tagline;
    document.querySelector("#row-role").textContent = copy.role;
    document.querySelector("#row-strength").textContent = copy.strength;
    document.querySelector("#row-exploring").textContent = copy.exploring;
    document.querySelector("#row-fact").textContent = copy.fact;
    const chips = document.querySelector("#moon-chips");
    chips.replaceChildren();
    if (copy.moons?.length) {
      chips.hidden = false;
      copy.moons.forEach((moon) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "body-chip";
        button.textContent = moon.title;
        button.addEventListener("click", () => focusOn(moon.id));
        chips.appendChild(button);
      });
    } else chips.hidden = true;
    const panel = document.querySelector("#planetInfo");
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    document.querySelector("#close-info").focus({ preventScroll: true });
  }

  function hidePanel() {
    const panel = document.querySelector("#planetInfo");
    panel.classList.remove("is-open");
    panel.hidden = true;
    document.querySelectorAll(".body-chip").forEach((chip) => chip.classList.remove("is-active"));
  }

  function buildMenu() {
    const menu = document.querySelector("#body-menu");
    BODY_ORDER.forEach((id) => {
      const copy = findBody(id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `body-chip${BODIES[id] ? "" : " is-moon"}`;
      button.dataset.id = id;
      button.textContent = copy.title;
      button.addEventListener("click", () => focusOn(id));
      menu.appendChild(button);
    });
  }

  function dispose() {
    running = false;
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
          material.dispose?.();
        });
      }
    });
    disposables.forEach((item) => item.dispose?.());
    composer.dispose();
    renderer.dispose();
    controls.dispose();
  }

  function sampleSwoop(t) {
    const start = new THREE.Vector3(0, 520, 980);
    const mid = new THREE.Vector3(180, 260, 520);
    const a = start.clone().lerp(mid, t);
    const b = mid.clone().lerp(home, t);
    return a.lerp(b, t);
  }
}

function spec(id, size, radius, speed, spin, texture, bump = null, extra = {}) { return { id, size, radius, speed, spin, texture, bump, ...extra }; }

function makeSun(scene, loadMap, disposables) {
  const geometry = new THREE.SphereGeometry(18, 80, 80);
  const material = new THREE.MeshStandardMaterial({ map: loadMap("sun.jpg"), emissive: 0xffb45a, emissiveMap: loadMap("sun.jpg"), emissiveIntensity: 2.4, roughness: 1 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const coronaMaterial = new THREE.SpriteMaterial({ map: makeCoronaTexture(), color: 0xffc56a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 });
  const corona = new THREE.Sprite(coronaMaterial);
  corona.scale.setScalar(78);
  mesh.add(corona);
  disposables.push(geometry, material, coronaMaterial, coronaMaterial.map);
  return { mesh, corona };
}

function makePlanet(scene, loadMap, disposables, planet) {
  const pivot = new THREE.Group();
  pivot.userData.orbit = { radius: planet.radius, speed: planet.speed, spin: planet.spin, lift: Math.sin((planet.tilt || 4) * Math.PI / 180) * 4 };
  const geometry = new THREE.SphereGeometry(planet.size, 80, 80);
  const material = planet.night ? earthMaterial(loadMap, planet) : new THREE.MeshStandardMaterial({ map: loadMap(planet.texture), bumpMap: planet.bump ? textureLoaderBump(loadMap, planet.bump) : null, bumpScale: planet.bump ? 0.18 : 0, roughness: 0.82, metalness: 0.04, color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = ((planet.tilt || 18) * Math.PI) / 180;
  pivot.add(mesh);
  if (planet.atmosphere || planet.atmosphereColor) addAtmosphere(mesh, planet, loadMap, disposables);
  if (planet.ring) addRing(pivot, planet, loadMap, disposables);
  addOrbitLine(scene, planet.radius, disposables);
  scene.add(pivot);
  disposables.push(geometry, material);
  mesh.userData.bodyId = planet.id;
  return { pivot, planet: mesh };
}

function textureLoaderBump(loadMap, file) { const texture = loadMap(file); texture.colorSpace = THREE.LinearSRGBColorSpace; return texture; }

function earthMaterial(loadMap, planet) {
  const day = loadMap(planet.texture);
  const night = loadMap(planet.night);
  return new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: day }, nightMap: { value: night }, boost: { value: 1.25 } },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld; void main(){ vUv=uv; vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; vNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform float boost; varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld; void main(){ float light=smoothstep(-0.15,0.45,dot(normalize(vNormal),normalize(-vWorld))); vec3 day=texture2D(dayMap,vUv).rgb; vec3 night=texture2D(nightMap,vUv).rgb; gl_FragColor=vec4(mix(night*0.55,day,light)*boost,1.0); }`,
  });
}

function addAtmosphere(mesh, planet, loadMap, disposables) {
  const geometry = new THREE.SphereGeometry(planet.size * 1.08, 64, 64);
  const material = new THREE.MeshPhongMaterial({ map: planet.atmosphere ? loadMap(planet.atmosphere) : null, color: planet.atmosphereColor || 0xffffff, transparent: true, opacity: 0.28, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
  mesh.add(new THREE.Mesh(geometry, material));
  disposables.push(geometry, material);
}

function addRing(pivot, planet, loadMap, disposables) {
  const geometry = new THREE.RingGeometry(planet.ringInner, planet.ringOuter, 128);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) { vertex.fromBufferAttribute(position, i); uv.setXY(i, (vertex.length() - planet.ringInner) / (planet.ringOuter - planet.ringInner), 0.5); }
  const material = new THREE.MeshBasicMaterial({ map: loadMap(planet.ring), side: THREE.DoubleSide, transparent: true, alphaTest: 0.08, depthWrite: false });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = Math.PI / 2.4;
  ring.position.x = planet.radius;
  pivot.add(ring);
  disposables.push(geometry, material);
}

function addOrbitLine(scene, radius, disposables) {
  const geometry = new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, radius, 0, Math.PI * 2, false).getSpacedPoints(180).map((point) => new THREE.Vector3(point.x, 0, point.y)));
  const material = new THREE.LineBasicMaterial({ color: 0xf0d7a2, transparent: true, opacity: 0.16 });
  scene.add(new THREE.LineLoop(geometry, material));
  disposables.push(geometry, material);
}

function makeMoon(parent, loadMap, disposables, moon) {
  const pivot = new THREE.Group();
  pivot.position.x = parent.userData.orbit?.radius || parent.position.x;
  pivot.userData.orbit = { radius: moon.radius, speed: moon.speed, spin: 0.4, lift: (Math.random() - 0.5) * 1.4 };
  const geometry = new THREE.SphereGeometry(moon.size, 64, 64);
  const material = new THREE.MeshStandardMaterial({ map: loadMap(moon.texture), bumpMap: moon.bump ? textureLoaderBump(loadMap, moon.bump) : null, bumpScale: 0.12, roughness: 0.9, color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.bodyId = moon.id;
  pivot.add(mesh);
  parent.parent.add(pivot);
  disposables.push(geometry, material);
  return { pivot, mesh };
}

function makeAsteroidBelt(scene, disposables, count) {
  const meshes = [0, 1, 2].map((variant) => {
    const geometry = rockGeometry(variant);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.05, vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.ceil(count / 3));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    scene.add(mesh);
    disposables.push(geometry, material);
    return mesh;
  });
  const rocks = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0x9a9086, 0x8a6248, 0xb7a48c, 0x6e5144, 0xc4b6a2];
  for (let i = 0; i < count; i += 1) {
    const mesh = meshes[i % 3];
    const index = mesh.count++;
    const angle = Math.random() * Math.PI * 2;
    const radius = 158 + gaussian() * 12 + (Math.random() < 0.08 ? gaussian() * 20 : 0);
    const size = Math.pow(Math.random(), 2.4) * 1.7 + 0.18;
    const rotation = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    color.setHex(palette[Math.floor(Math.random() * palette.length)]).offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.13, (Math.random() - 0.5) * 0.16);
    mesh.setColorAt(index, color);
    const gap = Math.random() < 0.12 && Math.sin(angle * 13) > 0.82;
    rocks.push({ mesh, index, radius, angle, height: gaussian() * 8, inclination: gaussian() * 0.12, eccentricity: Math.random() * 0.045, size, rotation, tumble: new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8), speed: 0.15 / Math.sqrt(radius), gap });
  }
  meshes.forEach((mesh) => { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); });
  function update(delta, timeScale) {
    rocks.forEach((rock) => {
      rock.angle += delta * rock.speed * timeScale;
      if (rock.gap) { dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); }
      else {
        const radius = rock.radius * (1 - rock.eccentricity * Math.cos(rock.angle));
        const angle = rock.angle + rock.eccentricity * Math.sin(rock.angle);
        const y = rock.height + Math.sin(angle) * radius * Math.sin(rock.inclination);
        dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        rock.rotation.x += rock.tumble.x * delta;
        rock.rotation.y += rock.tumble.y * delta;
        rock.rotation.z += rock.tumble.z * delta;
        dummy.rotation.copy(rock.rotation);
        dummy.scale.setScalar(rock.size);
      }
      dummy.updateMatrix();
      rock.mesh.setMatrixAt(rock.index, dummy.matrix);
    });
    meshes.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  }
  return { meshes, update };
}

function rockGeometry(variant) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const noise = Math.sin(vertex.x * 4 + variant * 2.3) * Math.cos(vertex.y * 5 + variant) * Math.sin(vertex.z * 3 + variant * 1.7);
    vertex.multiplyScalar(1 + noise * 0.28);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals();
  const colors = [];
  for (let i = 0; i < position.count; i += 1) colors.push(0.85 + Math.random() * 0.2, 0.75 + Math.random() * 0.15, 0.62);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function addStars(scene, count, disposables) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const rates = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const radius = 900 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    colors[i * 3] = 0.75 + Math.random() * 0.25;
    colors[i * 3 + 1] = 0.75 + Math.random() * 0.25;
    colors[i * 3 + 2] = 0.85 + Math.random() * 0.15;
    phases[i] = Math.random() * Math.PI * 2;
    rates[i] = 0.5 + Math.random() * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aPhase; attribute float aRate; varying vec3 vColor; varying float vTwinkle; uniform float uTime; void main(){ vColor=color; vTwinkle=0.58+0.42*sin(uTime*aRate+aPhase); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(2.8*(300.0/-mv.z),1.1,4.0); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vTwinkle; void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p); float a=smoothstep(0.5,0.04,d)*vTwinkle; gl_FragColor=vec4(vColor,a); }`,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
  });
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aRate", new THREE.BufferAttribute(rates, 1));
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  disposables.push(geometry, material);
  return material;
}

function addBackdrop(scene, disposables) {
  const geometry = new THREE.SphereGeometry(1600, 48, 32);
  const material = new THREE.MeshBasicMaterial({ map: nebulaTexture(), side: THREE.BackSide, depthWrite: false });
  scene.add(new THREE.Mesh(geometry, material));
  disposables.push(geometry, material, material.map);
}

function nebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#07060c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  [["#3a2458", 180, 220, 260], ["#1d3d55", 620, 180, 300], ["#5a3424", 430, 300, 220], ["#24341f", 800, 340, 180]].forEach(([color, x, y, radius]) => {
    const gradient = context.createRadialGradient(x, y, 10, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCoronaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 20, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,244,210,0.95)");
  gradient.addColorStop(0.35, "rgba(255,176,70,0.45)");
  gradient.addColorStop(1, "rgba(255,140,40,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}
function smoothstep(value) { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
