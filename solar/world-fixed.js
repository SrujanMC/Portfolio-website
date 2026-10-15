import * as THREE from "./vendor/build/three.module.js";
import { OrbitControls } from "./vendor/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "./vendor/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "./vendor/examples/jsm/postprocessing/ShaderPass.js";
import { BODY_ORDER, BODIES, findBody } from "./data.js";

const colorGradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.25 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      gl_FragColor = color;
    }
  `,
};

const ASSET = "solar-system/";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = window.matchMedia("(max-width: 760px)").matches;
const canvas = document.querySelector("#solar-canvas");
const loadingScreen = document.querySelector("#loading-screen");
const loadingStatus = document.querySelector("#loading-status");
const loadingBar = document.querySelector("#loading-bar");
const fallback = document.querySelector("#webgl-fallback");

function hideLoading() {
  loadingScreen.classList.add("is-hidden");
}

if (!canvas || !detectWebGL()) {
  hideLoading();
  fallback.hidden = false;
} else {
  boot().catch((error) => {
    console.error(error);
    loadingStatus.textContent = "The solar system could not start.";
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060c);
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 4000);
  const home = mobile ? new THREE.Vector3(210, 150, 250) : new THREE.Vector3(250, 175, 300);
  camera.position.copy(reducedMotion ? home : new THREE.Vector3(0, 520, 980));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 1100;
  controls.minDistance = 8;
  controls.target.set(0, 0, 0);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    const ratio = total ? loaded / total : 0;
    loadingBar.style.width = `${Math.round(ratio * 100)}%`;
  };
  manager.onLoad = () => {
    loadingBar.style.width = "100%";
    window.setTimeout(hideLoading, reducedMotion ? 0 : 350);
  };
  manager.onError = (url) => console.error("Unable to load solar system asset:", url);
  const textureLoader = new THREE.TextureLoader(manager);
  const loadMap = (file) => {
    const texture = textureLoader.load(`${ASSET}images/${file}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };

  scene.add(new THREE.AmbientLight(0x8ea0c8, 0.55));
  scene.add(new THREE.HemisphereLight(0xfff1cf, 0x1a2040, 0.85));
  const sunLight = new THREE.PointLight(0xfff4d2, 280, 0, 1.15);
  scene.add(sunLight);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.72, 0.28);
  composer.addPass(bloom);
  const grade = new ShaderPass(colorGradeShader);
  composer.addPass(grade);

  addBackdrop(scene);
  addStars(scene, mobile ? 2200 : 5600);

  const disposables = [];
  const bodies = {};
  const focusables = [];
  const clock = new THREE.Clock();
  const pointer = new THREE.Vector2(2, 2);
  const raycaster = new THREE.Raycaster();
  raycaster.params.Mesh = { threshold: 0 };
  const hoverLabel = document.querySelector("#hover-label");

  const sun = makeSun(scene, loadMap, disposables);
  bodies.sun = registerBody("sun", sun.mesh, 28, sun.mesh);
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
    made.moons = [];
  });

  const moonSpecs = [
    ["earth", "moon", 1.7, 12, 0.004, "moonmap.jpg", "moonbump.jpg"],
    ["mars", "phobos", 0.7, 6.2, 0.008, "moon.jpg"],
    ["mars", "deimos", 0.5, 9.4, 0.005, "moonbump.jpg"],
    ["jupiter", "io", 1.5, 22, 0.0032, "jupiterIo.jpg"],
    ["jupiter", "europa", 1.35, 27, 0.0024, "jupiterEuropa.jpg"],
    ["jupiter", "ganymede", 1.9, 33, 0.0017, "jupiterGanymede.jpg"],
    ["jupiter", "callisto", 1.7, 39, 0.0012, "jupiterCallisto.jpg"],
    ["saturn", "titan", 1.8, 20, 0.0018, "moonmap.jpg"],
    ["uranus", "titania", 0.9, 12, 0.0022, "moon.jpg"],
    ["uranus", "oberon", 0.85, 16, 0.0015, "moonbump.jpg"],
    ["neptune", "triton", 1.2, 13, -0.002, "plutomap.jpg"],
  ];
  moonSpecs.forEach(([parentId, id, size, radius, speed, texture, bump]) => {
    const parent = bodies[parentId].object;
    const moon = makeMoon(parent, loadMap, disposables, { id, size, radius, speed, texture, bump, phase: Math.random() * Math.PI * 2 });
    bodies[id] = registerBody(id, moon.pivot, Math.max(3.5, size * 4), moon.mesh, parentId);
  });

  const belt = makeAsteroidBelt(scene, disposables, mobile ? 1200 : 3000);
  bodies.asteroid = {
    id: "asteroid",
    object: belt.mesh,
    focusRadius: 18,
    hits: [belt.mesh],
  };
  focusables.push(belt.mesh);

  buildMenu();
  wireUi();

  let running = true;
  let elapsed = 0;
  let timeScale = reducedMotion ? 1 : 8;
  let focusId = null;
  let flight = null;
  let hoverId = null;
  const drift = { x: 0, y: 0 };

  window.addEventListener("pointermove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    drift.x += ((event.clientX / window.innerWidth) * 2 - 1 - drift.x) * 0.08;
    drift.y += ((event.clientY / window.innerHeight) * 2 - 1 - drift.y) * 0.08;
    hoverLabel.style.left = `${event.clientX}px`;
    hoverLabel.style.top = `${event.clientY}px`;
  });
  canvas.addEventListener("pointerdown", () => {
    canvas.style.cursor = "grabbing";
  });
  window.addEventListener("pointerup", (event) => {
    canvas.style.cursor = hoverId ? "pointer" : "grab";
    if (event.target === canvas) selectAtPointer();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearFocus();
  });
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      clock.getDelta();
      requestAnimationFrame(frame);
    }
  });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener("pagehide", dispose);

  requestAnimationFrame(frame);

  function frame() {
    if (!running) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    const intro = reducedMotion ? 1 : smoothstep(elapsed / 4);
    if (!reducedMotion && !focusId) {
      timeScale = THREE.MathUtils.lerp(8, 3, intro);
      const swoop = sampleSwoop(intro);
      camera.position.lerp(swoop, 0.08);
    } else if (focusId) {
      timeScale = THREE.MathUtils.lerp(timeScale, 0.5, 0.04);
    } else {
      timeScale = 1;
    }

    sun.mesh.rotation.y += delta * 0.08;
    sun.corona.material.rotation += delta * 0.15;
    sun.corona.lookAt(camera.position);

    Object.values(bodies).forEach((body) => {
      if (!body.orbit) return;
      body.angle += delta * body.orbit.speed * timeScale * 8;
      const radius = body.orbit.radius;
      body.object.position.set(Math.cos(body.angle) * radius, Math.sin(body.angle) * body.orbit.lift, Math.sin(body.angle) * radius);
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
    const data = findBody(id);
    const record = {
      id,
      object,
      spin,
      focusRadius,
      hits: [],
      parentId,
      angle: Math.random() * Math.PI * 2,
      orbit: object.userData.orbit || null,
    };
    bodies[id] = record;
    return record;
  }

  function makeHit(mesh, id, radiusScale = 1.8) {
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(mesh.geometry?.parameters?.radius ? mesh.geometry.parameters.radius * radiusScale : 2, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    mesh.add(hit);
    hit.userData.bodyId = id;
    bodies[id].hits.push(hit);
    focusables.push(hit);
    disposables.push(hit.geometry, hit.material);
  }

  function updateHover() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(focusables, false)[0];
    const id = hit?.object.userData.bodyId || (hit?.object === belt.mesh ? "asteroid" : null);
    hoverId = id;
    canvas.classList.toggle("is-hover", Boolean(id));
    if (!id) {
      hoverLabel.hidden = true;
      return;
    }
    hoverLabel.hidden = false;
    hoverLabel.textContent = findBody(id)?.title || "Small experiment";
  }

  function selectAtPointer() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(focusables, false)[0];
    if (!hit) return;
    if (hit.object === belt.mesh || hit.object.userData.bodyId === "asteroid") {
      const point = hit.point;
      focusOn("asteroid", point);
      return;
    }
    const id = hit.object.userData.bodyId;
    if (id) focusOn(id);
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
    const distance = id === "asteroid" ? 22 : body.focusRadius;
    const to = world.clone().add(offset.multiplyScalar(distance));
    flight = { from, to, lookFrom: controls.target.clone(), lookTo: world, t: 0, duration: reducedMotion ? 0.01 : 1.5 };
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
    flight = { from, to: home.clone(), lookFrom, lookTo: new THREE.Vector3(), t: 0, duration: reducedMotion ? 0.01 : 1.5, overview: true };
    const originalUpdate = updateFlight;
    updateFlight = (delta) => {
      originalUpdate(delta);
      if (!flight) updateFlight = originalUpdate;
    };
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
    } else {
      chips.hidden = true;
    }
    const panel = document.querySelector("#planetInfo");
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
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

  function wireUi() {
    document.querySelector("#close-info").addEventListener("click", clearFocus);
  }

  function dispose() {
    running = false;
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
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
    const end = home;
    const a = start.clone().lerp(mid, t);
    const b = mid.clone().lerp(end, t);
    return a.lerp(b, t);
  }
}

function spec(id, size, radius, speed, spin, texture, bump = null, extra = {}) {
  return { id, size, radius, speed, spin, texture, bump, ...extra };
}

function makeSun(scene, loadMap, disposables) {
  const geometry = new THREE.SphereGeometry(18, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: loadMap("sun.jpg"),
    emissive: 0xffb45a,
    emissiveMap: loadMap("sun.jpg"),
    emissiveIntensity: 2.4,
    roughness: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const coronaMaterial = new THREE.SpriteMaterial({
    map: makeCoronaTexture(),
    color: 0xffc56a,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.95,
  });
  const corona = new THREE.Sprite(coronaMaterial);
  corona.scale.setScalar(78);
  mesh.add(corona);
  disposables.push(geometry, material, coronaMaterial, coronaMaterial.map);
  return { mesh, corona };
}

function makePlanet(scene, loadMap, disposables, planet) {
  const pivot = new THREE.Group();
  pivot.userData.orbit = { radius: planet.radius, speed: planet.speed, spin: planet.spin, lift: Math.sin((planet.tilt || 4) * Math.PI / 180) * 4 };
  const geometry = new THREE.SphereGeometry(planet.size, 64, 64);
  const material = planet.night
    ? earthMaterial(loadMap, planet)
    : new THREE.MeshStandardMaterial({
        map: loadMap(planet.texture),
        bumpMap: planet.bump ? textureLoaderBump(loadMap, planet.bump) : null,
        bumpScale: planet.bump ? 0.18 : 0,
        roughness: 0.82,
        metalness: 0.04,
        color: 0xffffff,
      });
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

function textureLoaderBump(loadMap, file) {
  const texture = loadMap(file);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  return texture;
}

function earthMaterial(loadMap, planet) {
  const day = loadMap(planet.texture);
  const night = loadMap(planet.night);
  return new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: day }, nightMap: { value: night }, boost: { value: 1.25 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform float boost;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        float light = smoothstep(-0.15, 0.45, dot(normalize(vNormal), normalize(-vWorld)));
        vec3 day = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;
        gl_FragColor = vec4(mix(night * 0.55, day, light) * boost, 1.0);
      }
    `,
  });
}

function addAtmosphere(mesh, planet, loadMap, disposables) {
  const geometry = new THREE.SphereGeometry(planet.size * 1.08, 64, 64);
  const material = new THREE.MeshPhongMaterial({
    map: planet.atmosphere ? loadMap(planet.atmosphere) : null,
    color: planet.atmosphereColor || 0xffffff,
    transparent: true,
    opacity: 0.28,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(geometry, material);
  mesh.add(glow);
  disposables.push(geometry, material);
}

function addRing(pivot, planet, loadMap, disposables) {
  const geometry = new THREE.RingGeometry(planet.ringInner, planet.ringOuter, 128);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v3.fromBufferAttribute(position, i);
    uv.setXY(i, (v3.length() - planet.ringInner) / (planet.ringOuter - planet.ringInner), 0.5);
  }
  const material = new THREE.MeshBasicMaterial({
    map: loadMap(planet.ring),
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = Math.PI / 2.4;
  ring.position.x = planet.radius;
  pivot.add(ring);
  disposables.push(geometry, material);
}

function addOrbitLine(scene, radius, disposables) {
  const geometry = new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, radius, 0, Math.PI * 2, false).getSpacedPoints(180).map((point) => new THREE.Vector3(point.x, 0, point.y)));
  const material = new THREE.LineBasicMaterial({ color: 0xf0d7a2, transparent: true, opacity: 0.16 });
  const line = new THREE.LineLoop(geometry, material);
  scene.add(line);
  disposables.push(geometry, material);
}

function makeMoon(parent, loadMap, disposables, moon) {
  const pivot = new THREE.Group();
  pivot.position.x = parent.userData.orbit?.radius || parent.position.x;
  pivot.userData.orbit = { radius: moon.radius, speed: moon.speed, spin: 0.4, lift: (Math.random() - 0.5) * 1.4 };
  const geometry = new THREE.SphereGeometry(moon.size, 48, 32);
  const material = new THREE.MeshStandardMaterial({
    map: loadMap(moon.texture),
    bumpMap: moon.bump ? textureLoaderBump(loadMap, moon.bump) : null,
    bumpScale: 0.12,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.bodyId = moon.id;
  pivot.add(mesh);
  parent.parent.add(pivot);
  disposables.push(geometry, material);
  return { pivot, mesh };
}

function makeAsteroidBelt(scene, disposables, count) {
  const variants = [0, 1, 2].map((variant) => rockGeometry(variant));
  variants.forEach((geometry) => disposables.push(geometry));
  const meshes = variants.map((geometry) => {
    const material = new THREE.MeshStandardMaterial({ color: 0xb7a48c, roughness: 0.92, metalness: 0.05, vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.ceil(count / 3));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    scene.add(mesh);
    disposables.push(material);
    return mesh;
  });
  const rocks = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0x9a9086, 0x8a6248, 0xb7a48c, 0x6e5144, 0xc4b6a2];
  for (let i = 0; i < count; i += 1) {
    const variant = i % 3;
    const mesh = meshes[variant];
    const index = mesh.count++;
    const center = 158;
    const radius = center + gaussian() * 14 + (Math.random() < 0.08 ? gaussian() * 22 : 0);
    const height = gaussian() * 7.5;
    const angle = Math.random() * Math.PI * 2;
    const inclination = gaussian() * 0.08;
    const size = Math.pow(Math.random(), 2.4) * 1.7 + 0.18;
    const spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar((Math.random() - 0.5) * 1.4);
    color.setHex(palette[i % palette.length]).offsetHSL(0, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08);
    mesh.setColorAt(index, color);
    rocks.push({ mesh, index, radius, height, angle, inclination, size, spin, speed: 0.15 / Math.sqrt(radius) });
  }
  meshes.forEach((mesh) => {
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  });

  function update(delta, timeScale) {
    rocks.forEach((rock) => {
      rock.angle += delta * rock.speed * timeScale;
      const y = rock.height + Math.sin(rock.angle) * rock.radius * Math.sin(rock.inclination);
      dummy.position.set(Math.cos(rock.angle) * rock.radius, y, Math.sin(rock.angle) * rock.radius);
      dummy.rotation.x += rock.spin.x * delta;
      dummy.rotation.y += rock.spin.y * delta;
      dummy.rotation.z += rock.spin.z * delta;
      dummy.scale.setScalar(rock.size);
      dummy.updateMatrix();
      rock.mesh.setMatrixAt(rock.index, dummy.matrix);
    });
    meshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  return { mesh: meshes[0], meshes, update };
}

function rockGeometry(variant) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const noise = Math.sin(vertex.x * 4 + variant) * Math.cos(vertex.y * 5) * Math.sin(vertex.z * 3 + variant);
    vertex.multiplyScalar(1 + noise * 0.28);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals();
  const colors = [];
  for (let i = 0; i < position.count; i += 1) colors.push(0.85 + Math.random() * 0.2, 0.75 + Math.random() * 0.15, 0.62);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function addStars(scene, count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
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
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  scene.add(new THREE.Points(geometry, material));
}

function addBackdrop(scene) {
  const geometry = new THREE.SphereGeometry(1600, 48, 32);
  const material = new THREE.MeshBasicMaterial({ map: nebulaTexture(), side: THREE.BackSide, depthWrite: false });
  scene.add(new THREE.Mesh(geometry, material));
}

function nebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#07060c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const blobs = [
    ["#3a2458", 180, 220, 260],
    ["#1d3d55", 620, 180, 300],
    ["#5a3424", 430, 300, 220],
    ["#24341f", 800, 340, 180],
  ];
  blobs.forEach(([color, x, y, radius]) => {
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

function smoothstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}




