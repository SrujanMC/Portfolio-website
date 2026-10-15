import * as THREE from "three";

const canvas = document.querySelector("#planet-canvas");
const status = document.querySelector("#planet-status");
const planetName = document.querySelector("#planet-name");
const planetDescriptor = document.querySelector("#planet-descriptor");
const planetCoordinates = document.querySelector("#planet-coordinates");
const planetNumber = document.querySelector("#planet-number");
const planetKicker = document.querySelector("#planet-kicker");
const planetDescription = document.querySelector("#planet-description");
const atlasIndex = document.querySelector("#atlas-index");
const planetPanel = document.querySelector("#planet-panel");
const planetTabs = [...document.querySelectorAll(".planet-tab")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const planetOrder = ["earth", "moon", "mars", "saturn", "sun"];

const planetData = {
  earth: {
    name: "Earth",
    descriptor: "WEB DEVELOPMENT",
    kicker: "IDEAS TAKE SHAPE",
    coordinates: "THE OPEN WEB · ALWAYS IN BETA",
    description: "I build thoughtful websites where useful details, movement, and feeling meet.",
    copy: "The web is a place to turn an idea into an experience — considered, useful, and alive with detail.",
    tint: "#72a8a0",
    size: 2.54,
  },
  moon: {
    name: "Moon",
    descriptor: "CHESS",
    kicker: "THE QUIET MOVE",
    coordinates: "LUNAR POSITION · STILLNESS",
    description: "Chess is patience made visible: a board of possibilities, one thoughtful move at a time.",
    copy: "A quieter orbit: studying a position, seeing a little further, and finding the move that matters.",
    tint: "#c4c2b5",
    size: 2.46,
  },
  mars: {
    name: "Mars",
    descriptor: "CYBERSECURITY",
    kicker: "CURIOSITY, WITH CARE",
    coordinates: "RED PLANET · ETHICAL BY DESIGN",
    description: "I’m learning how systems work — and how to help keep them resilient. Always learning, always ethical.",
    copy: "Exploring the systems beneath the surface, with care, curiosity, and respect for the people behind them.",
    tint: "#d47e5d",
    size: 2.52,
  },
  saturn: {
    name: "Saturn",
    descriptor: "MUSIC",
    kicker: "LISTEN CLOSER",
    coordinates: "RING SYSTEM · FIND THE RHYTHM",
    description: "Music brings another kind of focus: finding rhythm, making space, and following a feeling.",
    copy: "Making music means listening for what is almost there: a rhythm, a texture, a feeling ready to take shape.",
    tint: "#d1b988",
    size: 2.38,
  },
  sun: {
    name: "The Sun",
    descriptor: "THE CREATIVE CORE",
    kicker: "THE CREATIVE CORE",
    coordinates: "0° 00′ · OPEN CURIOSITY",
    description: "I’m Srujan M C — building websites, making music, playing chess, and staying curious about the systems around us.",
    copy: "Different interests, one instinct: make things, explore how they work, and keep learning along the way.",
    tint: "#efb55e",
    size: 2.52,
  },
};

let scene;
let camera;
let renderer;
let starfield;
let resizeObserver;
let animationFrame = 0;
let previousFrame = 0;
let disposed = false;
let currentPlanet = "sun";
let pointer = new THREE.Vector2();
let raycaster;
let activeGesture = null;
let ignoreNextClick = false;
const planetRotation = new THREE.Vector2();
const planetGroups = {};
const planetsByHit = [];

const vertexShader = `
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  void main() {
    vLocalPosition = position;
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const surfaceShader = `
  uniform float uTime;
  uniform float uType;
  uniform float uOpacity;
  uniform vec3 uLightDirection;
  uniform vec3 uTint;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash31(i);
    float b = hash31(i + vec3(1.0, 0.0, 0.0));
    float c = hash31(i + vec3(0.0, 1.0, 0.0));
    float d = hash31(i + vec3(1.0, 1.0, 0.0));
    float e = hash31(i + vec3(0.0, 0.0, 1.0));
    float f1 = hash31(i + vec3(1.0, 0.0, 1.0));
    float g = hash31(i + vec3(0.0, 1.0, 1.0));
    float h = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
      mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise3(p) * amplitude;
      p = p * 2.03 + vec3(13.1, 7.7, 5.3);
      amplitude *= 0.5;
    }
    return value;
  }

  float craterField(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    float closest = 10.0;
    vec3 center = vec3(0.5);
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 offset = vec3(float(x), float(y), float(z));
          vec3 id = cell + offset;
          vec3 point = offset + vec3(
            hash31(id + 4.1),
            hash31(id + 17.4),
            hash31(id + 31.8)
          );
          float distanceToCenter = length(local - point);
          if (distanceToCenter < closest) {
            closest = distanceToCenter;
            center = id + point;
          }
        }
      }
    }
    float radius = mix(0.12, 0.39, hash31(center + 8.3));
    return closest / radius;
  }

  void main() {
    vec3 spherePoint = normalize(vLocalPosition);
    float terrainA = fbm(spherePoint * 3.1 + vec3(0.7, 1.2, 0.3));
    float terrainB = fbm(spherePoint * 6.0 + vec3(4.0, 1.5, 2.0));
    float terrainFine = fbm(spherePoint * 23.0 + vec3(1.2, 8.0, 2.4));
    float relief = terrainA;
    vec3 color = vec3(0.0);

    if (uType < 0.5) {
      float warped = terrainA + (terrainB - 0.5) * 0.22;
      float coast = smoothstep(0.477, 0.506, warped);
      float shallow = smoothstep(0.425, 0.495, warped);
      vec3 ocean = mix(vec3(0.012, 0.055, 0.105), vec3(0.035, 0.19, 0.26), shallow);
      ocean += terrainFine * vec3(0.012, 0.039, 0.049);
      vec3 lowland = mix(vec3(0.10, 0.22, 0.12), vec3(0.24, 0.32, 0.16), terrainB);
      vec3 highland = mix(vec3(0.35, 0.31, 0.21), vec3(0.55, 0.48, 0.34), terrainFine);
      vec3 land = mix(lowland, highland, smoothstep(0.57, 0.78, terrainB));
      land += smoothstep(0.71, 0.82, terrainFine) * 0.09;
      color = mix(ocean, land, coast);
      color = mix(color, vec3(0.74, 0.79, 0.78), smoothstep(0.78, 0.93, abs(spherePoint.y)));
      color += vec3(0.025, 0.095, 0.105) * (1.0 - smoothstep(0.0, 0.035, abs(warped - 0.49)));
      relief = terrainA + coast * terrainFine * 0.035;
    } else if (uType < 1.5) {
      float basin = smoothstep(0.51, 0.66, fbm(spherePoint * 3.4 + 2.0));
      float crater = craterField(spherePoint * 22.0);
      float broadCrater = craterField(spherePoint * 8.0 + 7.2);
      float rim = exp(-pow((crater - 0.82) * 9.0, 2.0));
      float pit = 1.0 - smoothstep(0.33, 0.96, crater);
      color = mix(vec3(0.47, 0.47, 0.44), vec3(0.30, 0.32, 0.32), basin * 0.76);
      color += vec3((terrainFine - 0.5) * 0.12);
      color -= pit * vec3(0.105, 0.10, 0.09);
      color += rim * vec3(0.12, 0.115, 0.10);
      color -= (1.0 - smoothstep(0.28, 0.78, broadCrater)) * 0.075;
      relief = 0.45 + terrainFine * 0.18 - pit * 0.2 + rim * 0.12;
    } else if (uType < 2.5) {
      float redTerrain = fbm(spherePoint * 4.1 + vec3(2.8, 0.3, 1.2));
      float redDetail = fbm(spherePoint * 16.0);
      float crater = craterField(spherePoint * 15.0 + 3.4);
      float rim = exp(-pow((crater - 0.84) * 8.0, 2.0));
      float pit = 1.0 - smoothstep(0.24, 0.91, crater);
      float darkRegions = smoothstep(0.52, 0.68, fbm(spherePoint * 2.6 + vec3(4.5, 1.0, 3.2)));
      color = mix(vec3(0.39, 0.13, 0.073), vec3(0.75, 0.31, 0.13), redTerrain);
      color = mix(color, vec3(0.24, 0.11, 0.08), darkRegions * 0.55);
      color += vec3((redDetail - 0.48) * 0.14, (redDetail - 0.48) * 0.085, (redDetail - 0.48) * 0.055);
      color -= pit * vec3(0.16, 0.105, 0.071);
      color += rim * vec3(0.14, 0.095, 0.06);
      color = mix(color, vec3(0.79, 0.66, 0.52), smoothstep(0.90, 0.985, abs(spherePoint.y)));
      relief = redTerrain + redDetail * 0.09 - pit * 0.16 + rim * 0.1;
    } else if (uType < 3.5) {
      float latitude = abs(spherePoint.y);
      float bands = sin(spherePoint.y * 57.0 + terrainA * 8.0);
      float clouds = fbm(spherePoint * vec3(8.0, 35.0, 8.0) + vec3(0.0, uTime * 0.013, 3.0));
      float stripe = smoothstep(-0.76, 0.75, bands * 0.65 + (clouds - 0.5) * 1.2);
      color = mix(vec3(0.39, 0.30, 0.20), vec3(0.80, 0.69, 0.49), stripe);
      color = mix(color, vec3(0.85, 0.80, 0.66), smoothstep(0.84, 0.96, latitude));
      float storm = exp(-pow(length(vec2(spherePoint.x + 0.34, spherePoint.y - 0.18)) * 13.0, 2.0));
      color = mix(color, vec3(0.69, 0.39, 0.25), storm * 0.85);
      relief = terrainA + bands * 0.09 + clouds * 0.05;
    } else {
      float granules = fbm(spherePoint * 33.0 + vec3(0.0, uTime * 0.028, 0.0));
      float superGranules = fbm(spherePoint * 11.0 + vec3(0.0, -uTime * 0.009, 4.0));
      float flare = pow(max(0.0, sin(spherePoint.x * 37.0 + sin(spherePoint.z * 23.0 + uTime * 0.11))), 12.0);
      color = mix(vec3(0.67, 0.16, 0.035), vec3(1.0, 0.57, 0.13), granules);
      color = mix(color, vec3(1.0, 0.82, 0.35), superGranules * 0.65);
      color += flare * vec3(0.6, 0.28, 0.04);
      relief = granules + superGranules * 0.24;
    }

    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float lightAmount = max(dot(normal, normalize(uLightDirection)), 0.0);
    float ambient = uType > 3.5 ? 1.0 : 0.12 + lightAmount * 0.96;
    float nightEdge = smoothstep(-0.35, 0.28, dot(normal, normalize(uLightDirection)));
    float specular = pow(max(dot(reflect(-normalize(uLightDirection), normal), viewDirection), 0.0), 46.0);
    float atmosphere = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.2);
    color *= ambient;

    if (uType < 0.5) {
      float lights = smoothstep(0.72, 0.88, terrainFine) * (1.0 - smoothstep(0.477, 0.51, terrainA));
      color += lights * vec3(0.52, 0.34, 0.14) * (1.0 - nightEdge) * 0.62;
      color += specular * vec3(0.35, 0.57, 0.69);
      color += atmosphere * vec3(0.035, 0.20, 0.32);
    } else if (uType < 3.5) {
      color += specular * vec3(0.22, 0.18, 0.12);
      color += atmosphere * uTint * 0.25;
    } else if (uType < 4.5) {
      color += specular * vec3(0.7, 0.43, 0.17);
    }

    gl_FragColor = vec4(color, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ringVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ringFragmentShader = `
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    float radius = length(vUv - vec2(0.5)) * 2.0;
    float divisions = sin(radius * 690.0 + sin(radius * 91.0) * 2.0);
    float dust = sin(radius * 1700.0) * 0.045;
    float bands = smoothstep(-0.72, 0.62, divisions + dust);
    float gaps = smoothstep(0.14, 0.38, abs(sin(radius * 54.0 + 0.5)));
    float alpha = smoothstep(0.015, 0.08, radius) * (1.0 - smoothstep(0.90, 1.0, radius));
    alpha *= mix(0.11, 0.77, bands) * gaps;
    float lit = 0.34 + 0.66 * max(dot(normalize(vWorldNormal), normalize(vec3(-0.5, 0.8, 0.9))), 0.0);
    vec3 color = mix(vec3(0.24, 0.20, 0.15), vec3(0.86, 0.75, 0.56), bands);
    color *= lit;
    gl_FragColor = vec4(color, alpha * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPower;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), uPower);
    gl_FragColor = vec4(uColor, fresnel * uOpacity);
  }
`;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function createSurfaceMaterial(type, tint) {
  const uniforms = {
    uTime: { value: 0 },
    uType: { value: type },
    uOpacity: { value: 0 },
    uLightDirection: { value: new THREE.Vector3(-0.58, 0.68, 0.46).normalize() },
    uTint: { value: new THREE.Color(tint) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: surfaceShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  });
  return material;
}

function createAtmosphere(color, opacity, power, scale) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPower: { value: power },
    },
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(scale, 96, 72), material);
  mesh.renderOrder = 4;
  return mesh;
}

function createStars() {
  const count = window.innerWidth < 600 ? 750 : 1450;
  const positions = new Float32Array(count * 3);
  const random = (() => {
    let state = 98431;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  })();
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * 48;
    positions[index * 3 + 1] = (random() - 0.5) * 34;
    positions[index * 3 + 2] = -9 - random() * 30;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: "#d9d9cf",
      size: 0.028,
      transparent: true,
      opacity: 0.68,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  stars.renderOrder = -3;
  scene.add(stars);
  starfield = stars;
}

function createPlanet(key, index) {
  const data = planetData[key];
  const group = new THREE.Group();
  group.name = `${data.name} world`;
  group.position.set(2.55, 0.04, index * 0.006);
  group.rotation.z = key === "saturn" ? -0.24 : 0;
  group.userData.homeRotationZ = group.rotation.z;
  group.userData.planetKey = key;
  group.userData.opacity = 0;
  group.scale.setScalar(0.84);
  scene.add(group);

  if (key === "saturn") {
    const ringUniforms = {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    };
    const rings = new THREE.Mesh(
      new THREE.RingGeometry(data.size * 1.34, data.size * 2.05, 240, 12),
      new THREE.ShaderMaterial({
        uniforms: ringUniforms,
        vertexShader: ringVertexShader,
        fragmentShader: ringFragmentShader,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    rings.rotation.x = Math.PI * 0.39;
    rings.rotation.y = -Math.PI * 0.08;
    rings.renderOrder = 3;
    rings.userData.isRings = true;
    group.add(rings);
  }

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(data.size, 128, 96),
    createSurfaceMaterial(index, data.tint),
  );
  body.name = `${data.name} surface`;
  body.renderOrder = 2;
  body.userData.planetKey = key;
  group.add(body);
  planetsByHit.push(body);

  if (key !== "sun") {
    const atmosphereColor =
      key === "earth" ? "#54bbef" :
      key === "mars" ? "#e68a58" :
      key === "saturn" ? "#dec18a" : "#bec3c5";
    const atmo = createAtmosphere(atmosphereColor, key === "earth" ? 0.74 : 0.34, 2.0, data.size * 1.06);
    atmo.userData.isAtmosphere = true;
    group.add(atmo);
  } else {
    const coronaMaterial = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color("#ef782f") }, uOpacity: { value: 0.7 }, uPower: { value: 2.2 } },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const corona = new THREE.Mesh(new THREE.SphereGeometry(data.size * 1.3, 96, 72), coronaMaterial);
    corona.userData.isCorona = true;
    corona.renderOrder = 0;
    group.add(corona);
  }

  return group;
}

function setPlanet(key) {
  const data = planetData[key];
  if (!data) return;
  currentPlanet = key;
  const index = planetOrder.indexOf(key);
  planetName.textContent = data.name;
  planetDescriptor.textContent = data.descriptor;
  planetCoordinates.textContent = data.coordinates;
  planetNumber.textContent = String(index + 1).padStart(2, "0");
  planetKicker.textContent = data.kicker;
  planetDescription.textContent = data.copy;
  atlasIndex.textContent = String(index + 1).padStart(2, "0");
  planetPanel.setAttribute("aria-labelledby", `planet-${key}-tab`);

  planetTabs.forEach((tab) => {
    const active = tab.dataset.planet === key;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
}

planetTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => setPlanet(tab.dataset.planet));
  tab.addEventListener("keydown", (event) => {
    const forward = ["ArrowRight", "ArrowDown"];
    const backward = ["ArrowLeft", "ArrowUp"];
    if (!forward.includes(event.key) && !backward.includes(event.key)) return;
    event.preventDefault();
    const direction = forward.includes(event.key) ? 1 : -1;
    const nextIndex = (index + direction + planetTabs.length) % planetTabs.length;
    const nextTab = planetTabs[nextIndex];
    setPlanet(nextTab.dataset.planet);
    nextTab.focus();
  });
});

function resize() {
  if (!renderer || !camera || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const mobile = width < 600;
  camera.aspect = width / height;
  camera.position.set(0, mobile ? 0.15 : 0.12, mobile ? 20 : width < 900 ? 17.2 : 15.3);
  camera.fov = mobile ? 38 : 36;
  camera.updateProjectionMatrix();

  Object.values(planetGroups).forEach((group) => {
    group.position.x = mobile ? 0 : width < 900 ? 2.05 : 2.65;
    group.position.y = mobile ? -1.78 : 0.06;
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.75));
  renderer.setSize(width, height, false);
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(planetsByHit, false);
  const key = intersects[0]?.object.userData.planetKey;
  canvas.style.cursor = key ? "pointer" : "default";
}

function onPointerMove(event) {
  if (activeGesture && activeGesture.pointerId === event.pointerId) {
    const deltaX = event.clientX - activeGesture.x;
    const deltaY = event.clientY - activeGesture.y;
    const bounds = canvas.getBoundingClientRect();
    activeGesture.moved ||= Math.hypot(event.clientX - activeGesture.startX, event.clientY - activeGesture.startY) > 6;
    planetRotation.y += (deltaX / bounds.width) * 2.3;
    planetRotation.x = THREE.MathUtils.clamp(
      planetRotation.x + (deltaY / bounds.height) * 1.4,
      -0.38,
      0.38,
    );
    activeGesture.x = event.clientX;
    activeGesture.y = event.clientY;
  }
  updatePointer(event);
}

function onPointerDown(event) {
  activeGesture = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
}

function onPointerUp(event) {
  if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
  const gesture = activeGesture;
  activeGesture = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (gesture.pointerType !== "mouse" && Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
    const currentIndex = planetOrder.indexOf(currentPlanet);
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = (currentIndex + direction + planetOrder.length) % planetOrder.length;
    setPlanet(planetOrder[nextIndex]);
    return;
  }
  if (gesture.pointerType !== "mouse") {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(planetsByHit, false)[0]?.object.userData.planetKey;
    if (hit) setPlanet(hit);
  }
  ignoreNextClick = gesture.moved;
}

function onPointerClick(event) {
  if (ignoreNextClick || event.pointerType === "touch") {
    ignoreNextClick = false;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(planetsByHit, false)[0]?.object.userData.planetKey;
  if (hit) setPlanet(hit);
}

function animate(timestamp = 0) {
  if (disposed || document.hidden) return;
  animationFrame = window.requestAnimationFrame(animate);
  if (!reduceMotion.matches && timestamp - previousFrame < 30) return;
  previousFrame = timestamp;

  const time = timestamp * 0.001;
  const motion = reduceMotion.matches ? 0 : 1;
  if (starfield) {
    starfield.rotation.y = time * 0.002 * motion;
    starfield.rotation.x = Math.sin(time * 0.04) * 0.008 * motion;
  }

  for (const key of planetOrder) {
    const group = planetGroups[key];
    const visible = key === currentPlanet;
    const targetOpacity = visible ? 1 : 0;
    const targetScale = visible ? 1 : 0.82;
    group.userData.opacity += (targetOpacity - group.userData.opacity) * 0.055;
    group.visible = group.userData.opacity > 0.008 || visible;
    const scale = group.scale.x + (targetScale - group.scale.x) * 0.055;
    group.scale.setScalar(scale);
    group.rotation.y += (key === "sun" ? 0.0019 : 0.0013) * motion;
    group.rotation.y += ((visible ? planetRotation.y : 0) - group.rotation.y) * 0.012;
    group.rotation.x += ((visible ? planetRotation.x : 0) - group.rotation.x) * 0.015;

    group.traverse((object) => {
      const uniforms = object.material?.uniforms;
      if (!uniforms) return;
      if (uniforms.uOpacity) uniforms.uOpacity.value = group.userData.opacity;
      if (uniforms.uTime) uniforms.uTime.value = time;
    });
  }

  camera.position.x += (pointer.x * 0.23 - camera.position.x) * 0.014;
  camera.position.y += ((window.innerWidth < 600 ? 0.15 : 0.12) + pointer.y * 0.11 - camera.position.y) * 0.014;
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

function onContextLost(event) {
  event.preventDefault();
  window.cancelAnimationFrame(animationFrame);
  setStatus("The planetary view paused after a graphics interruption. Refresh the page to restore it.", true);
}

function dispose() {
  if (disposed) return;
  disposed = true;
  window.cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  document.removeEventListener("visibilitychange", onVisibilityChange);
  canvas.removeEventListener("webglcontextlost", onContextLost);
  window.removeEventListener("pagehide", dispose);
  canvas.removeEventListener("pointermove", onPointerMove);
  canvas.removeEventListener("pointerdown", onPointerDown);
  canvas.removeEventListener("pointerup", onPointerUp);
  canvas.removeEventListener("pointercancel", onPointerCancel);
  canvas.removeEventListener("pointerleave", onPointerLeave);
  canvas.removeEventListener("click", onPointerClick);
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material.uniforms ?? {}).forEach(({ value }) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  renderer?.dispose();
}

function onPointerLeave() {
  if (activeGesture) return;
  pointer.set(0, 0);
  canvas.style.cursor = "default";
}

function onPointerCancel(event) {
  if (activeGesture?.pointerId === event.pointerId) activeGesture = null;
}

function start() {
  if (!canvas) throw new Error("The planet canvas could not be found.");
  scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2("#080a0f", 0.008);
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.12, 15.3);
  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.1;

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: window.innerWidth > 600,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor("#080a0f", 0);

  scene.add(new THREE.HemisphereLight("#d8d9d2", "#10111b", 0.9));
  const keyLight = new THREE.DirectionalLight("#fff1d4", 2.7);
  keyLight.position.set(-5, 5, 9);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight("#86a9c8", 37, 35, 2);
  rimLight.position.set(6, 3, -5);
  scene.add(rimLight);
  const warmFill = new THREE.PointLight("#d08d52", 14, 22, 2);
  warmFill.position.set(-3, -5, 3);
  scene.add(warmFill);

  createStars();
  planetOrder.forEach((key, index) => {
    planetGroups[key] = createPlanet(key, index);
  });

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onPointerClick);
  canvas.addEventListener("webglcontextlost", onContextLost);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", dispose, { once: true });

  resize();
  setPlanet(currentPlanet);
  setStatus("PROCEDURAL PLANETARY MATERIALS · DRAG TO EXPLORE");
  animate();
}

try {
  start();
} catch (error) {
  console.error("Unable to start the interactive planetary portrait.", error);
  setStatus("The 3D planets could not start in this browser. The planet selector and profile details remain available.", true);
}
