import * as THREE from './vendor/three.module.mjs';
import {bayAt, BAY_LENGTH} from './library-layout.mjs';

const colors = [0x315a54, 0x913f38, 0xb88a42, 0x34465b, 0x745264, 0x64764c, 0xad6246, 0x436b79, 0xd0b786, 0x473d43, 0x8d9b8a, 0x9a794e];

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d1bd);
  scene.fog = new THREE.Fog(0xd9d1bd, 13, 23);
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .05, 24);
  camera.position.set(0, 1.65, 3.8);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xfff4df, 0x6c6555, 2.1));
  const sun = new THREE.DirectionalLight(0xffebc8, 2.1);
  sun.position.set(-3, 7, 3); scene.add(sun);
  const materials = new Map();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  // Shared procedural grain: no external images or extra texture per cabinet.
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 128; grainCanvas.height = 512;
  const grain = grainCanvas.getContext('2d');
  grain.fillStyle = '#e2c897'; grain.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 90; i++) {
    grain.strokeStyle = `rgba(106,72,37,${.025 + (i % 5) * .008})`;
    grain.beginPath();
    for (let y = 0; y <= 512; y += 8) {
      const x = i * 1.47 + Math.sin(y / 70 + i * .7) * 1.8;
      if (!y) grain.moveTo(x, y); else grain.lineTo(x, y);
    }
    grain.stroke();
  }
  const woodTexture = new THREE.CanvasTexture(grainCanvas);
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  woodTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const oak = new THREE.MeshStandardMaterial({color:0xd9bd8a, map:woodTexture, roughness:.68});
  const oakEdge = new THREE.MeshStandardMaterial({color:0xb99b69, map:woodTexture, roughness:.74});
  const glow = new THREE.MeshBasicMaterial({color:0xffedc7});
  const mat = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness:.8}));
    return materials.get(color);
  };
  function box(parent, w, h, d, x, y, z, color, solid = false) {
    const mesh = new THREE.Mesh(boxGeometry, color?.isMaterial ? color : mat(color));
    mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh);
    if (solid) parent.userData.solids.push(mesh);
    return mesh;
  }
  function label(parent, text, w, h, x, y, z, rotation = 0, bg = '#1b3c39', vertical = false) {
    // Spines keep a small fixed canvas (there are hundreds); sign plates match
    // their real aspect ratio so the lettering is neither stretched nor blurry.
    const canvas = document.createElement('canvas');
    canvas.width = vertical ? 512 : 1024;
    canvas.height = vertical ? 96 : Math.max(64, Math.min(256, Math.round(1024 * h / w)));
    const {width, height} = canvas, inset = Math.round(height / 12);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#edcf96'; ctx.lineWidth = Math.max(1, height / 48); ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    if (vertical) {
      ctx.fillStyle = '#ded4b9'; ctx.fillRect(17, 56, 34, 23);
      ctx.fillStyle = '#bba579'; ctx.fillRect(57, 10, 3, 76); ctx.fillRect(452, 10, 3, 76);
    }
    ctx.fillStyle = '#edcf96'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const maxWidth = width - inset * 5;
    let size = vertical ? 34 : Math.round(height * .6);
    do { ctx.font = `${size--}px Georgia`; } while (ctx.measureText(text).width > maxWidth && size > 10);
    ctx.fillText(text, width / 2, height / 2, maxWidth);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:texture}));
    mesh.position.set(x, y, z); mesh.rotation.y = rotation;
    if (vertical) mesh.rotation.z = Math.PI / 2;
    parent.add(mesh);
  }
  let layout, lastBay = -1;
  const loaded = new Map(), objects = new Map();
  const outline = new THREE.BoxHelper(new THREE.Object3D(), 0xffe4a4);
  const marker = new THREE.BoxHelper(new THREE.Object3D(), 0x71e4d0);
  outline.visible = false; marker.visible = false; scene.add(outline, marker);

  function buildBay(bay) {
    const group = new THREE.Group(); group.position.z = -bay.offset;
    group.userData.solids = []; scene.add(group);
    box(group, 5.4, .1, BAY_LENGTH, 0, -.05, -1, 0xa9997f);
    for (let i = 0; i < 18; i++) box(group, .29, .015, BAY_LENGTH, -2.55 + i * .3, 0, -1, [0xc4b69c, 0xbeb097, 0xcbbda4, 0xb9ab92][i % 4]);
    for (const side of [-1, 1]) {
      box(group, .15, 4.2, BAY_LENGTH, side * 2.75, 2.1, -1, 0xe8e1cf, true);
      box(group, .12, .15, BAY_LENGTH, side * 2.64, 3.95, -1, oakEdge);
      // Clerestory panes and mullions provide an airy reading-room backdrop.
      box(group, .035, .65, 3.9, side * 2.659, 3.4, -1, 0xc4d9d5);
      for (const z of [-2.95, -1.65, -.35, .95]) box(group, .065, .72, .055, side * 2.62, 3.4, z, 0xf1eadb);
      for (const y of [3.06, 3.74]) box(group, .065, .06, 4, side * 2.62, y, -1, 0xf1eadb);
      const x = side * 2.22;
      box(group, .1, 2.85, 5.1, side * 2.52, 1.45, -1, oakEdge, true);
      for (const z of [-3.5, 1.5]) box(group, .7, 2.85, .13, x, 1.45, z, oak, true);
      for (const y of [.25, .83, 1.41, 1.99, 2.63]) {
        box(group, .7, .09, 5.1, x, y, -1, oak, true);
        box(group, .025, .025, 4.94, side * 1.858, y + .025, -1, 0xe7d5af);
        // Baked-style contact shading below each shelf, without shadow-map cost.
        box(group, .012, .055, 4.94, side * 2.46, y - .07, -1, 0x826d4a);
      }
      // Divisions occupy the existing gaps, never moving or covering a book.
      const columns = [...new Set(bay.books.filter(book => layout.positions.get(book.id).side === side)
        .map(book => layout.positions.get(book.id).z + bay.offset))].sort((a,b) => a-b);
      const cuts = columns.length > 2 ? [Math.floor(columns.length / 3), Math.floor(columns.length * 2 / 3)] : [];
      for (const cut of new Set(cuts)) {
        if (cut < 1 || cut >= columns.length) continue;
        const gap = columns[cut] - columns[cut - 1] - .25;
        box(group, .66, 2.4, Math.min(.075, gap * .65), x, 1.45, (columns[cut] + columns[cut-1]) / 2, oak);
      }
      box(group, .75, .17, 5.2, x, 2.78, -1, oak, true);
      box(group, .66, .13, 5, x, .09, -1, oakEdge);
      label(group, bay.label.toUpperCase(), 2.5, .19, side * 1.838, 2.78, -1, -side * Math.PI / 2, bay.code === 'PRE' ? '#773d34' : '#294e46');
      label(group, `${bay.code}  /  ${String(bay.index + 1).padStart(2,'0')}`, .48, .11, side * 1.858, .83, .95, -side * Math.PI / 2, '#4a493e');
    }
    box(group, 5.6, .12, BAY_LENGTH, 0, 4.18, -1, 0xeee8db);
    box(group, 1.75, .016, BAY_LENGTH, 0, .022, -1, bay.code === 'PRE' ? 0x665763 : 0x536e62);
    for (const x of [-.77, .77]) box(group, .025, .004, BAY_LENGTH, x, .035, -1, 0xb9b08e);
    // Repeated timber frames distinguish rooms visually while preserving the path.
    for (const side of [-1, 1]) box(group, .19, 4.1, .18, side * 2.58, 2.05, 2.3, oakEdge);
    box(group, 5.3, .18, .18, 0, 3.98, 2.3, oakEdge);
    label(group, `${String(bay.index + 1).padStart(2,'0')}  /  ${bay.label.toUpperCase()}`, 2.15, .23, 0, 3.53, 2.3);
    box(group, .035, .65, .035, 0, 3.82, -1, 0x8b703c);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.36, .22, 24, 1, true), mat(0xb89956));
    shade.position.set(0, 3.4, -1); group.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), glow);
    bulb.position.set(0, 3.32, -1); group.add(bulb);
    if (bay.index === 0) {
      box(group, 5.4, .1, 2.4, 0, -.05, 3.8, 0x987048);
      box(group, 5.6, 4.2, .15, 0, 2.1, 5, 0x284f49, true);
      for (const x of [-2.75, 2.75]) box(group, .15, 4.2, 2.4, x, 2.1, 3.8, 0xd6c7aa, true);
    }
    if (bay.index === layout.bays.length - 1) {
      box(group, 5.4, .1, 1.5, 0, -.05, -5.3, 0x987048);
      box(group, 5.6, 4.2, .15, 0, 2.1, -6, 0x284f49, true);
      for (const x of [-2.75, 2.75]) box(group, .15, 4.2, 1.5, x, 2.1, -5.3, 0xd6c7aa, true);
      box(group, 2.3, 2.65, .1, 0, 2.25, -5.86, 0x382d25);
      box(group, 2.1, 2.43, .05, 0, 2.25, -5.79, 0xf5ddb0);
      box(group, .075, 2.45, .08, 0, 2.25, -5.73, 0x684832);
      box(group, 2.15, .07, .08, 0, 2.2, -5.73, 0x684832);
    }
    if (!bay.books.length) label(group, 'SIN TÍTULOS POR AHORA', 2.2, .25, -1.839, 1.66, -1, Math.PI / 2);
    bay.books.forEach((book, index) => {
      const p = layout.positions.get(book.id), object = new THREE.Group(); object.userData.book = book;
      object.position.set(p.x, p.y, p.z + bay.offset); object.rotation.y = -p.side * Math.PI / 2;
      group.add(object); group.userData.solids.push(object); objects.set(book.id, object);
      const color = colors[(index + bay.index) % colors.length];
      box(object, .25, p.height, .32, 0, 0, 0, color);
      box(object, .216, .012, .27, 0, p.height / 2 - .009, -.008, 0xe9dfc6);
      label(object, book.titulo, p.height - .12, .19, 0, .015, .165, 0, `#${new THREE.Color(color).getHexString()}`, true);
    });
    return group;
  }
  function unload(index) {
    const group = loaded.get(index); if (!group) return;
    for (const book of layout.bays[index].books) objects.delete(book.id);
    group.traverse(object => {
      if (object.geometry && object.geometry !== boxGeometry) object.geometry.dispose();
      if (object.material?.map && object.material.map !== woodTexture) { object.material.map.dispose(); object.material.dispose(); }
    });
    scene.remove(group); loaded.delete(index);
  }
  function update(z, force = false) {
    const index = bayAt(layout, z); if (index === lastBay && !force) return;
    lastBay = index; outline.visible = false;
    // Keep GPU memory bounded: distant shelves and title textures are released.
    for (const loadedIndex of loaded.keys()) if (Math.abs(loadedIndex - index) > 3) unload(loadedIndex);
    for (let i = Math.max(0, index - 3); i <= Math.min(layout.bays.length - 1, index + 3); i++) {
      if (!loaded.has(i)) loaded.set(i, buildBay(layout.bays[i]));
    }
    scene.updateMatrixWorld(true);
  }
  function setLayout(next) {
    for (const index of [...loaded.keys()]) unload(index);
    layout = next; lastBay = -1; outline.visible = false; marker.visible = false;
    update(camera.position.z, true);
  }
  function mark(id) {
    const object = objects.get(id); marker.visible = Boolean(object);
    if (object) marker.setFromObject(object);
  }
  return {renderer, scene, camera, outline, setLayout, update, mark,
    targets: () => [...loaded.values()].flatMap(group => group.userData.solids),
    object: id => objects.get(id),
  };
}
