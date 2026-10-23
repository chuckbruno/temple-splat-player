// Temple courtyard player: a PINOC splat character walking, running and
// kicking inside a PINOC splat scene, with collision from the scene's splats.
import {
  Scene, Character, Animation, Environment, Keyboard, ThirdPersonCamera,
  SceneCollider, buildColliderData, environmentColliderFrame, SplatRelight,
  capsuleForWalker, minStepLimit, SceneColliderDebug,
} from '@viggle/splat-engine';

const ASSETS = {
  scene: 'assets/temple_courtyard.spz',
  character: 'assets/middle_aged_man.high.vsplat',
  motions: {
    idle: 'assets/motions/idle.glb',
    walk: 'assets/motions/walk.glb',
    run: 'assets/motions/run.glb',
    back: 'assets/motions/walk_back.glb',
    jump: 'assets/motions/jump.glb',
    frontKick: 'assets/motions/front_kick.glb',
    sideKick: 'assets/motions/side_kick.glb',
    roundKick: 'assets/motions/round_kick.glb',
  },
};

// Ground speeds measured from each clip's pelvis travel, so feet do not slide.
const SPEED = { walk: 1.55, run: 2.4, back: 0.8 };
// The capture point sits about 1.5 m above the floor (PINOC convention).
const EYE_HEIGHT_M = 1.5;
// This scene is a current-era SPZ: +Y is up, so down is -y.
const DOWN_SIGN = -1;
const WALKER_HEIGHT = 1.75;
// Collide only within this radius of the capture point. The whole outdoor
// capture is too large for a fine grid under the engine's 4M-cell ceiling.
const COLLIDER_RADIUS_M = 15;
const COLLIDER_VOXEL_M = 0.1;
// Extra scene scale on top of the floor calibration. The panorama behind this
// scene is AI-synthesised, so its camera height is not really 1.5 m; this
// factor is set so the hall door reads about 2.8 m tall. Tune live with [ and ].
const SCENE_SCALE_DEFAULT = 1.6;
const SCALE_KEY = 'temple.sceneScale';
let sceneScale = Number(localStorage.getItem(SCALE_KEY)) || SCENE_SCALE_DEFAULT;
const TURN_SPEED = 540; // deg/s
// The PINOC character's front is +z at rest, while movement treats yaw 0 as
// facing -z (the engine's camera convention). Turn the body to match.
const MODEL_YAW_OFFSET = 180;
const ONE_SHOTS = { KeyJ: 'frontKick', KeyK: 'sideKick', KeyL: 'roundKick', Space: 'jump' };

const canvas = document.getElementById('canvas');
const readout = document.getElementById('readout');
const loading = document.getElementById('loading');
const setStatus = (t) => { loading.textContent = t; };

const scene = await Scene.create(canvas, {
  fov: 55, near: 0.05, far: 400,
  bgColor: { r: 0.62, g: 0.78, b: 0.95, a: 1 },
});
scene.start();

// ---- Environment: load, then measure it into metres with the floor at y=0.
setStatus('加载场景…');
const env = await Environment.load(scene, ASSETS.scene);
const probe = env.probeGroundDepth(DOWN_SIGN);
const depth = probe?.depth ?? probe?.median ?? null;
let metresPerUnit = depth && depth > 0 ? EYE_HEIGHT_M / depth : 1;
// Scale the scene by metresPerUnit x mult and lift it so the floor stays at y=0.
function applyScale(mult = 1) {
  const s = metresPerUnit * mult;
  env.entity.setLocalScale(s, s, s);
  env.entity.setLocalPosition(0, EYE_HEIGHT_M * mult, 0);
}
applyScale();

// Collider from the splats near the courtyard only, at a fine voxel.
function buildCollider() {
  const frame = environmentColliderFrame(env);
  const full = env.sampleWorldSample(500000);
  const n = full.positions.length / 3;
  const pos = new Float32Array(full.positions.length);
  const alpha = full.alpha ? new Float32Array(n) : null;
  const r2 = COLLIDER_RADIUS_M * COLLIDER_RADIUS_M;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = full.positions[i * 3], y = full.positions[i * 3 + 1], z = full.positions[i * 3 + 2];
    if (x * x + z * z > r2) continue;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    if (alpha) alpha[k] = full.alpha[i];
    k++;
  }
  const sample = { positions: pos.subarray(0, k * 3), alpha: alpha ? alpha.subarray(0, k) : null };
  const data = buildColliderData(sample, frame, { voxelMetres: COLLIDER_VOXEL_M, samplePoints: 500000, bandBelowM: 0.5, bandAboveM: 2.2 });
  return data ? SceneCollider.fromData(data, () => environmentColliderFrame(env)) : null;
}

// The splat probe can misjudge the floor on a busy outdoor capture, so check
// it against the collider: the floor under the capture point must be at y=0.
setStatus('生成碰撞体…');
let collider = null;
let scaleFix = 1;
try {
  collider = buildCollider();
  const floorY = collider?.groundAt(0, 0, 1.2, 0.6);
  if (floorY != null && Math.abs(floorY) > 0.05) {
    scaleFix = Math.min(2.5, Math.max(0.5, EYE_HEIGHT_M / (EYE_HEIGHT_M - floorY)));
    metresPerUnit *= scaleFix;
  }
  applyScale(sceneScale);
  collider = buildCollider(); // rebuild at the final scale
} catch (e) { console.warn('collider build failed', e); }

// ---- Character and motions.
setStatus('加载角色和动作…');
const character = await Character.load(scene, ASSETS.character);
await Promise.all(Object.entries(ASSETS.motions).map(([name, url]) => Animation.loadGlb(scene, url, name)));
character.armature.rootMotionMode = 'off'; // clips play in place; we move the body

let capsule = collider
  ? capsuleForWalker(WALKER_HEIGHT, minStepLimit(collider.voxelMetres), collider.voxelMetres)
  : null;
let stepUp = collider ? minStepLimit(collider.voxelMetres) : 0;
const colliderDebug = collider ? SceneColliderDebug.create(scene, { mode: 'off' }) : null;
if (colliderDebug) colliderDebug.setCollider(collider);

// ---- Spawn: first free floor near the capture point.
function floorAt(x, z, fromY) {
  if (!collider) return 0;
  return collider.standAt(x, z, fromY, capsule);
}
function findSpawn() {
  const rings = [0, 1, 2, 3, 4];
  for (const r of rings) {
    for (let a = 0; a < 360; a += r === 0 ? 360 : 30) {
      const x = r * Math.sin(a * Math.PI / 180), z = -r * Math.cos(a * Math.PI / 180);
      const y = floorAt(x, z, 0.5);
      if (y !== null && Math.abs(y) < 0.25) return { x, y, z };
    }
  }
  return { x: 0, y: 0, z: 0 };
}
const spawn = findSpawn();
const pos = { ...spawn };
let facing = 0;
character.setPosition(pos.x, pos.y, pos.z);
character.setRotation(0, facing + MODEL_YAW_OFFSET, 0);
character.playAnimation('idle', { loop: true });
let current = 'idle';
let oneShot = null; // name of a non-looping clip in progress

// ---- Cast shadow. The scene keeps its baked lighting (strength 0) and only
// darkens where the character blocks the key light (shadowStrength). The key
// light matches the photo: a low winter sun behind the camera, slightly left,
// so shadows fall toward the hall and to the right.
const SUN = { azimuth: -25, elevation: 32 };
const relight = SplatRelight.create(scene, {
  strength: 0,
  shadowStrength: 0.75,
  receiveShadows: true,
  shadowBlurRadius: 2,
  light: { ...SUN, intensity: 1, shadowType: 'pcf5', shadowDistance: 30, shadowResolution: 2048 },
});
// The character only casts: its own colours stay as generated.
relight.add(character);
relight.setParams(character, { strength: 0, shadowStrength: 0 });
// The scene only receives, and only near the courtyard where people walk.
function relightBounds() {
  const r = COLLIDER_RADIUS_M;
  return { min: { x: -r, y: -1, z: -r }, max: { x: r, y: 4, z: r } };
}
relight.add(env, { bounds: relightBounds(), castShadows: false });
let shadowsOn = true;

// ---- Camera and input.
const camera = new ThirdPersonCamera({
  target: () => ({ x: pos.x, y: pos.y, z: pos.z }),
  distance: 3.4, height: 1.35, pitch: 12, mouseSensitivity: 0.18,
});
camera.attach({ canvas, cameraEntity: scene.cameraEntity });
camera.yaw = facing;

const keys = new Keyboard();
keys.attach(window);
for (const [code, clip] of Object.entries(ONE_SHOTS)) {
  keys.onKeyDown(code, () => {
    if (oneShot) return;
    oneShot = clip;
    play(clip, { loop: false, duration: 0.1 });
  });
}
keys.onKeyDown('KeyR', () => { Object.assign(pos, spawn); facing = 0; camera.yaw = 0; });

// [ and ] shrink or grow the scene around the character, 5% per press.
let rebuildTimer = 0;
function rescale(factor) {
  const next = Math.min(3, Math.max(0.4, sceneScale * factor));
  const k = next / sceneScale;
  sceneScale = next;
  localStorage.setItem(SCALE_KEY, String(sceneScale));
  applyScale(sceneScale);
  // Keep the character on the same spot of the scene, which scaled about the origin.
  pos.x *= k; pos.z *= k; spawn.x *= k; spawn.z *= k;
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    // The shadow receiver was voxelized at the old scale; rebuild it too.
    relight.remove(env);
    relight.add(env, { bounds: relightBounds(), castShadows: false });
    const next = buildCollider();
    if (!next) return;
    collider = next;
    capsule = capsuleForWalker(WALKER_HEIGHT, minStepLimit(collider.voxelMetres), collider.voxelMetres);
    stepUp = minStepLimit(collider.voxelMetres);
    if (colliderDebug) {
      colliderDebug.setCollider(collider);
      if (colliderDebug.mode !== 'off') colliderDebug.capsule = capsule;
    }
  }, 350);
}
keys.onKeyDown('BracketLeft', () => rescale(1 / 1.05));
keys.onKeyDown('BracketRight', () => rescale(1.05));
keys.onKeyDown('Backslash', () => rescale(SCENE_SCALE_DEFAULT / sceneScale));
keys.onKeyDown('KeyH', () => {
  shadowsOn = !shadowsOn;
  relight.enabled = shadowsOn;
});
keys.onKeyDown('KeyC', () => {
  if (!colliderDebug) return;
  colliderDebug.mode = colliderDebug.mode === 'off' ? 'top' : colliderDebug.mode === 'top' ? 'all' : 'off';
  colliderDebug.capsule = colliderDebug.mode === 'off' ? null : capsule;
});

function play(name, { loop = true, duration = 0.18 } = {}) {
  if (current === name && loop) return;
  character.crossfadeTo(name, { duration, loop });
  current = name;
}

const wrap = (a) => ((a + 540) % 360) - 180;
function turnToward(target, maxDelta) {
  const d = wrap(target - facing);
  facing = Math.abs(d) <= maxDelta ? wrap(target) : wrap(facing + Math.sign(d) * maxDelta);
}

// Move by (dx, dz) against the collider: slide along walls, follow the floor.
function moveBy(dx, dz) {
  const nx = pos.x + dx, nz = pos.z + dz;
  if (!collider) { pos.x = nx; pos.z = nz; return; }
  const ground = collider.groundAt(nx, nz, pos.y + stepUp, capsule.radius);
  if (ground === null) return; // edge of the scanned area
  const r = collider.resolve(nx, nz, ground, capsule);
  const y = collider.standAt(r.x, r.z, pos.y + stepUp, capsule);
  if (y === null) return;
  pos.x = r.x; pos.z = r.z;
  pos.y += (y - pos.y) * 0.5;
}

scene.app.on('update', (dt) => {
  dt = Math.min(dt, 0.05);
  camera.update(dt);

  if (oneShot) {
    if (character.isFinished) { oneShot = null; play('idle', { duration: 0.2 }); }
  } else {
    let ix = 0, iz = 0;
    if (keys.isKeyDown('KeyW')) iz -= 1;
    if (keys.isKeyDown('KeyS')) iz += 1;
    if (keys.isKeyDown('KeyA')) ix -= 1;
    if (keys.isKeyDown('KeyD')) ix += 1;
    const running = keys.isKeyDown('ShiftLeft') || keys.isKeyDown('ShiftRight');

    if (ix === 0 && iz > 0) {
      // Back-pedal: keep facing away from the camera and step backwards.
      turnToward(camera.yaw, TURN_SPEED * dt);
      const f = facing * Math.PI / 180;
      moveBy(Math.sin(f) * SPEED.back * dt, Math.cos(f) * SPEED.back * dt);
      play('back');
    } else if (ix !== 0 || iz !== 0) {
      turnToward(camera.yaw + Math.atan2(-ix, -iz) * 180 / Math.PI, TURN_SPEED * dt);
      const f = facing * Math.PI / 180;
      const v = running ? SPEED.run : SPEED.walk;
      moveBy(-Math.sin(f) * v * dt, -Math.cos(f) * v * dt);
      play(running ? 'run' : 'walk');
    } else {
      play('idle');
    }
  }

  character.setPosition(pos.x, pos.y, pos.z);
  character.setRotation(0, facing + MODEL_YAW_OFFSET, 0);
  if (colliderDebug) colliderDebug.capsuleAt = { ...pos };

  readout.textContent =
    `场景尺度  ${metresPerUnit.toFixed(3)} m/单位  (探针深度 ${depth?.toFixed(3) ?? '未测到'}, 平整度 ${probe?.flatness?.toFixed(2) ?? '-'}, 地面校正 ×${scaleFix.toFixed(2)})\n` +
    `场景缩放  ×${sceneScale.toFixed(2)}   ([ 缩小  ] 放大  反斜杠键 恢复默认)
` +
    `阴影      ${shadowsOn ? '开' : '关'}  (H 切换)
` +
    `碰撞体    ${collider ? `体素 ${collider.voxelMetres.toFixed(2)} m${collider.stats.coarsened ? ' (已粗化)' : ''}` : '无'}${colliderDebug ? `  显示 ${colliderDebug.mode}` : ''}\n` +
    `位置      x ${pos.x.toFixed(2)}  y ${pos.y.toFixed(2)}  z ${pos.z.toFixed(2)}   动作 ${current}`;
});

loading.classList.add('hidden');
// Expose for debugging in the browser console.
Object.assign(window, { scene, env, character, collider, camera, pos });
