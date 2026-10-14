import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- 1. SZENE, KAMERA & RENDERER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Minecraft Himmelblau

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(14, 12, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Beleuchtung
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

// Boden-Hilfsgitter
const gridHelper = new THREE.GridHelper(200, 200, 0x444444, 0x222222);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// --- 2. FLUG-STEUERUNG ---
const controls = new PointerLockControls(camera, renderer.domElement);
document.getElementById('flyBtn').addEventListener('click', () => controls.lock());
renderer.domElement.addEventListener('click', () => controls.lock());

const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, Space: false, ShiftLeft: false };
let flySpeed = 20;

document.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  if (e.code === 'ArrowUp') changeLayerBy(1);
  if (e.code === 'ArrowDown') changeLayerBy(-1);
});

document.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

// --- 3. ORIGINAL MINECRAFT TEXTUREN LADEN ---
const materialCache = new Map();
const iconUrlCache = new Map();

// Öffentliche Quelle für originale Minecraft-Blocktexturen (wird automatisch geladen)
const REMOTE_TEXTURE_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/assets/assets/minecraft/textures/block/';

// Übersetzt Blocknamen (wie "oak_stairs" oder "brick_wall") in die richtige PNG-Texturdatei
function resolveTextureFileName(cleanName) {
  const exactMap = {
    grass_block: 'grass_block_side',
    dirt_path: 'dirt_path_side',
    podzol: 'podzol_side',
    mycelium: 'mycelium_side',
    snow_block: 'snow',
    quartz_block: 'quartz_block_side',
    smooth_quartz: 'quartz_block_bottom',
    smooth_sandstone: 'sandstone_top',
    smooth_red_sandstone: 'red_sandstone_top',
    water: 'water_still',
    lava: 'lava_still',
    hay_block: 'hay_block_side',
    barrel: 'barrel_side',
    crafting_table: 'crafting_table_front',
    furnace: 'furnace_front',
    blast_furnace: 'blast_furnace_front',
    smoker: 'smoker_front',
    tnt: 'tnt_side',
    melon: 'melon_side',
    pumpkin: 'pumpkin_side',
    carved_pumpkin: 'carved_pumpkin',
    jack_o_lantern: 'jack_o_lantern',
    magma_block: 'magma',
    wall_torch: 'torch',
    soul_wall_torch: 'soul_torch',
    redstone_wall_torch: 'redstone_torch'
  };
  if (exactMap[cleanName]) return exactMap[cleanName];

  // Holz-Treppen, -Stufen, -Zäune usw. nutzen in Minecraft die Planks-Textur
  const woods = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
  for (const w of woods) {
    if (
      cleanName === `${w}_stairs` || cleanName === `${w}_slab` ||
      cleanName === `${w}_fence` || cleanName === `${w}_fence_gate` ||
      cleanName === `${w}_button` || cleanName === `${w}_pressure_plate`
    ) {
      return `${w}_planks`;
    }
    if (cleanName === `${w}_wood`) return `${w}_log`;
    if (cleanName === `stripped_${w}_wood`) return `stripped_${w}_log`;
  }

  // Glas-Scheiben -> Glas-Textur
  if (cleanName === 'glass_pane') return 'glass';
  if (cleanName.endsWith('_stained_glass_pane')) return cleanName.replace('_pane', '');

  // Teppich -> Wolle-Textur
  if (cleanName.endsWith('_carpet') && !cleanName.includes('moss')) {
    return cleanName.replace('_carpet', '_wool');
  }

  // Ziegel- und Stein-Varianten (Singular -> Plural in Minecrafts Textur-Dateien)
  let base = cleanName
    .replace('_stairs', '')
    .replace('_slab', '')
    .replace('_wall', '')
    .replace('_fence', '')
    .replace('_button', '')
    .replace('_pressure_plate', '');

  const pluralFixes = {
    brick: 'bricks',
    stone_brick: 'stone_bricks',
    mossy_stone_brick: 'mossy_stone_bricks',
    deepslate_brick: 'deepslate_bricks',
    deepslate_tile: 'deepslate_tiles',
    mud_brick: 'mud_bricks',
    nether_brick: 'nether_bricks',
    red_nether_brick: 'red_nether_bricks',
    prismarine_brick: 'prismarine_bricks',
    end_stone_brick: 'end_stone_bricks',
    polished_blackstone_brick: 'polished_blackstone_bricks',
    quartz_brick: 'quartz_bricks'
  };
  if (pluralFixes[base]) return pluralFixes[base];

  return base;
}

// Erstellt eine Ersatz-Textur, bis das echte PNG geladen ist
function createFallbackCanvas(cleanName) {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(0, 0, 16, 16);
  return canvas;
}

// Lädt ein Bild (versucht erst lokalen Ordner, dann automatisch originales Minecraft-Repo)
function loadOriginalTextureImage(texFile, onSuccess) {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => onSuccess(img);
  img.onerror = () => {
    // Falls lokal nicht vorhanden, direkt die originale Minecraft-Textur aus dem Netz laden
    const remoteImg = new Image();
    remoteImg.crossOrigin = 'Anonymous';
    remoteImg.onload = () => onSuccess(remoteImg);
    remoteImg.src = `${REMOTE_TEXTURE_BASE}${texFile}.png`;
  };
  img.src = `./textures/block/${texFile}.png`;
}

function getBlockMaterial(rawBlockName) {
  const cleanName = rawBlockName.replace('minecraft:', '').split('[')[0];
  if (materialCache.has(cleanName)) return materialCache.get(cleanName);

  const isTransparent =
    cleanName.includes('glass') || cleanName.includes('leaves') ||
    cleanName.includes('water') || cleanName.includes('ice') ||
    cleanName.includes('trapdoor') || cleanName.includes('lantern') ||
    cleanName.includes('torch') || cleanName.includes('bars');

  const texFile = resolveTextureFileName(cleanName);
  const fallbackCanvas = createFallbackCanvas(cleanName);
  const placeholderTex = new THREE.CanvasTexture(fallbackCanvas);
  placeholderTex.magFilter = THREE.NearestFilter;
  placeholderTex.minFilter = THREE.NearestFilter;
  placeholderTex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshLambertMaterial({
    map: placeholderTex,
    transparent: isTransparent,
    opacity: cleanName.includes('glass') || cleanName.includes('water') ? 0.65 : 1.0,
    alphaTest: isTransparent ? 0.1 : 0
  });

  loadOriginalTextureImage(texFile, (img) => {
    // Auf 16x16 Pixel zeichnen (schneidet bei animierten Texturen wie Wasser/Lava das 1. Bild aus)
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);

    // Laubblätter (außer Kirsch/Birke) sind in den Rohdateien grau -> Original-Grünton drüberlegen
    if (cleanName.includes('leaves') && !cleanName.includes('cherry')) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#59ae30';
      ctx.fillRect(0, 0, 16, 16);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);
      ctx.globalCompositeOperation = 'source-over';
    }

    const finalTex = new THREE.CanvasTexture(canvas);
    finalTex.magFilter = THREE.NearestFilter; // Scharfe Minecraft-Pixel!
    finalTex.minFilter = THREE.NearestFilter;
    finalTex.colorSpace = THREE.SRGBColorSpace;

    material.map = finalTex;
    material.needsUpdate = true;

    // Speichert das fertige 16x16 Bild als Icon für die Material-Liste
    const dataUrl = canvas.toDataURL();
    iconUrlCache.set(cleanName, dataUrl);
    document.querySelectorAll(`img[data-block="${cleanName}"]`).forEach((el) => {
      el.src = dataUrl;
    });
  });

  materialCache.set(cleanName, material);
  return material;
}

// Formatiert "oak_planks" zu "Oak Planks"
function formatBlockName(cleanName) {
  return cleanName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// --- 4. BUILDING, LAYER & MATERIAL-LISTE ---
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);

let allBlocks = [];
let maxLayerY = 0;

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const layerSlider = document.getElementById('layerSlider');
const layerVal = document.getElementById('layerVal');
const layerMode = document.getElementById('layerMode');
const onlyVisibleLayerCheck = document.getElementById('onlyVisibleLayerCheck');

function setBuildingData(blocksArray) {
  allBlocks = blocksArray;
  maxLayerY = 0;
  for (const b of allBlocks) {
    if (b.y > maxLayerY) maxLayerY = b.y;
  }
  layerSlider.max = maxLayerY;
  layerSlider.value = maxLayerY;
  updateBuildingView();
}

function updateBuildingView() {
  while (buildingGroup.children.length > 0) {
    const mesh = buildingGroup.children[0];
    mesh.dispose();
    buildingGroup.remove(mesh);
  }

  const mode = layerMode.value;
  const targetY = parseInt(layerSlider.value, 10);
  layerVal.textContent = mode === 'all' ? `Alle (0 - ${maxLayerY})` : `${targetY} / ${maxLayerY}`;

  const groupedVisible = new Map();
  for (const b of allBlocks) {
    const cleanName = b.type.replace('minecraft:', '').split('[')[0];
    if (mode === 'upTo' && b.y > targetY) continue;
    if (mode === 'single' && b.y !== targetY) continue;

    if (!groupedVisible.has(cleanName)) groupedVisible.set(cleanName, []);
    groupedVisible.get(cleanName).push(b);
  }

  const dummy = new THREE.Object3D();
  for (const [cleanName, positions] of groupedVisible.entries()) {
    const mat = getBlockMaterial(cleanName);
    const instancedMesh = new THREE.InstancedMesh(boxGeo, mat, positions.length);
    
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    buildingGroup.add(instancedMesh);
  }

  updateMaterialListUI(groupedVisible);
}

// Aktualisiert die Material-Anzeige rechts im Bild
function updateMaterialListUI(groupedVisible) {
  const countMap = new Map();
  let totalBlocks = 0;

  if (onlyVisibleLayerCheck.checked) {
    for (const [cleanName, list] of groupedVisible.entries()) {
      countMap.set(cleanName, list.length);
      totalBlocks += list.length;
    }
  } else {
    for (const b of allBlocks) {
      const cleanName = b.type.replace('minecraft:', '').split('[')[0];
      getBlockMaterial(cleanName); // Stellt sicher, dass das Icon geladen wird
      countMap.set(cleanName, (countMap.get(cleanName) || 0) + 1);
      totalBlocks++;
    }
  }

  document.getElementById('totalBlocksBadge').textContent = `${totalBlocks} Blöcke`;

  // Absteigend nach Anzahl sortieren
  const sortedEntries = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
  const listContainer = document.getElementById('materialList');
  listContainer.innerHTML = '';

  for (const [cleanName, count] of sortedEntries) {
    const stacks = Math.floor(count / 64);
    const remainder = count % 64;
    let stackText = '';
    if (stacks > 0 && remainder > 0) {
      stackText = `${stacks} Stack${stacks > 1 ? 's' : ''} + ${remainder}`;
    } else if (stacks > 0) {
      stackText = `${stacks} Stack${stacks > 1 ? 's' : ''}`;
    } else {
      stackText = `${remainder} Stück`;
    }

    const texFile = resolveTextureFileName(cleanName);
    const iconSrc = iconUrlCache.get(cleanName) || `${REMOTE_TEXTURE_BASE}${texFile}.png`;

    const row = document.createElement('div');
    row.className = 'mat-item';
    row.innerHTML = `
      <div class="mat-left">
        <img class="mat-icon" data-block="${cleanName}" src="${iconSrc}" alt="${cleanName}">
        <div class="mat-name" title="${formatBlockName(cleanName)}">${formatBlockName(cleanName)}</div>
      </div>
      <div class="mat-right">
        <div class="mat-count">${count}x</div>
        <div class="mat-stacks">${stackText}</div>
      </div>
    `;
    listContainer.appendChild(row);
  }
}

function changeLayerBy(delta) {
  if (layerMode.value === 'all') layerMode.value = 'upTo';
  const next = Math.max(0, Math.min(maxLayerY, parseInt(layerSlider.value, 10) + delta));
  layerSlider.value = next;
  updateBuildingView();
}

layerSlider.addEventListener('input', () => {
  if (layerMode.value === 'all') layerMode.value = 'upTo';
  updateBuildingView();
});
layerMode.addEventListener('change', updateBuildingView);
onlyVisibleLayerCheck.addEventListener('change', updateBuildingView);

document.getElementById('speedSlider').addEventListener('input', (e) => {
  flySpeed = parseFloat(e.target.value);
  document.getElementById('speedVal').textContent = flySpeed;
});

// --- 5. NBT & .SCHEM PARSER ---
function parseNBT(Uint8Buf) {
  const view = new DataView(Uint8Buf.buffer, Uint8Buf.byteOffset, Uint8Buf.byteLength);
  let offset = 0;

  function readString() {
    const len = view.getUint16(offset, false);
    offset += 2;
    const str = new TextDecoder('utf-8').decode(Uint8Buf.subarray(offset, offset + len));
    offset += len;
    return str;
  }

  function readPayload(type) {
    switch (type) {
      case 1: return view.getInt8(offset++);
      case 2: { const v = view.getInt16(offset, false); offset += 2; return v; }
      case 3: { const v = view.getInt32(offset, false); offset += 4; return v; }
      case 4: { const v = view.getBigInt64(offset, false); offset += 8; return v; }
      case 5: { const v = view.getFloat32(offset, false); offset += 4; return v; }
      case 6: { const v = view.getFloat64(offset, false); offset += 8; return v; }
      case 7: {
        const len = view.getInt32(offset, false); offset += 4;
        const arr = Uint8Buf.subarray(offset, offset + len); offset += len;
        return arr;
      }
      case 8: return readString();
      case 9: {
        const itemType = view.getUint8(offset++);
        const len = view.getInt32(offset, false); offset += 4;
        const list = [];
        for (let i = 0; i < len; i++) list.push(readPayload(itemType));
        return list;
      }
      case 10: {
        const obj = {};
        while (true) {
          const nextType = view.getUint8(offset++);
          if (nextType === 0) break;
          const name = readString();
          obj[name] = readPayload(nextType);
        }
        return obj;
      }
      case 11: {
        const len = view.getInt32(offset, false); offset += 4;
        const arr = [];
        for (let i = 0; i < len; i++) { arr.push(view.getInt32(offset, false)); offset += 4; }
        return arr;
      }
      case 12: {
        const len = view.getInt32(offset, false); offset += 4;
        offset += len * 8;
        return [];
      }
      default: throw new Error('Unbekannter NBT Tag: ' + type);
    }
  }

  const rootType = view.getUint8(offset++);
  if (rootType !== 10) throw new Error('Kein gültiges NBT Format');
  readString();
  return readPayload(10);
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const inflated = window.pako.ungzip(new Uint8Array(arrayBuffer));
    const nbt = parseNBT(inflated);
    
    const schem = nbt.Schematic ? nbt.Schematic : nbt;
    const width = schem.Width;
    const height = schem.Height;
    const length = schem.Length;

    const paletteObj = schem.Palette || (schem.Blocks && schem.Blocks.Palette);
    const blockData = schem.BlockData || (schem.Blocks && schem.Blocks.Data);

    if (!paletteObj || !blockData) {
      alert('Format nicht erkannt. Bitte nutze eine .schem Datei.');
      return;
    }

    const idToBlock = {};
    for (const [blockName, id] of Object.entries(paletteObj)) {
      idToBlock[id] = blockName;
    }

    const decodedBlocks = [];
    let i = 0;
    let blockIndex = 0;
    while (i < blockData.length) {
      let value = 0;
      let varintLength = 0;
      while (true) {
        const byte = blockData[i++];
        value |= (byte & 127) << (varintLength++ * 7);
        if ((byte & 128) !== 128) break;
      }

      const blockName = idToBlock[value] || 'minecraft:air';
      if (!blockName.endsWith(':air') && blockName !== 'air' && !blockName.includes('cave_air')) {
        const y = Math.floor(blockIndex / (width * length));
        const z = Math.floor((blockIndex % (width * length)) / width);
        const x = blockIndex % width;
        decodedBlocks.push({
          x: x - Math.floor(width / 2),
          y: y,
          z: z - Math.floor(length / 2),
          type: blockName
        });
      }
      blockIndex++;
    }

    setBuildingData(decodedBlocks);
  } catch (err) {
    console.error(err);
    alert('Fehler beim Laden der Datei: ' + err.message);
  }
});

// --- 6. DEMO-HAUS BEIM START ---
function createDemoHouse() {
  const blocks = [];
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      blocks.push({ x, y: 0, z, type: 'cobblestone' });
      if (Math.abs(x) === 4 || Math.abs(z) === 4) {
        for (let y = 1; y <= 4; y++) {
          const isCorner = Math.abs(x) === 4 && Math.abs(z) === 4;
          const isWindow = y === 2 && (x === 0 || z === 0);
          const isDoor = (y === 1 || y === 2) && z === 4 && x === 0;
          if (isDoor) continue;
          blocks.push({
            x, y, z,
            type: isCorner ? 'oak_log' : (isWindow ? 'glass' : 'oak_planks')
          });
        }
      }
    }
  }
  for (let step = 0; step <= 4; step++) {
    for (let x = -4 + step; x <= 4 - step; x++) {
      for (let z = -4 + step; z <= 4 - step; z++) {
        blocks.push({ x, y: 5 + step, z, type: 'bricks' });
      }
    }
  }
  setBuildingData(blocks);
}
createDemoHouse();

// --- 7. RENDER-LOOP ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (controls.isLocked) {
    const moveDist = flySpeed * delta;
    if (keys.KeyW) controls.moveForward(moveDist);
    if (keys.KeyS) controls.moveForward(-moveDist);
    if (keys.KeyD) controls.moveRight(moveDist);
    if (keys.KeyA) controls.moveRight(-moveDist);
    if (keys.Space) camera.position.y += moveDist;
    if (keys.ShiftLeft) camera.position.y -= moveDist;
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});