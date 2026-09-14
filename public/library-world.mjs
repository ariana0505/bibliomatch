import * as THREE from './vendor/three.module.mjs';
import {bayAt, BAY_LENGTH} from './library-layout.mjs';

const colors = [0x35605b, 0x9b4941, 0xc2934c, 0x354c70, 0x7b5471, 0x687b47, 0xb16a44, 0x3e6f80];

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc2b69a);
  scene.fog = new THREE.Fog(0xc2b69a, 11, 20);
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .05, 24);
  camera.position.set(0, 1.65, 3.8);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xffedd1, 0x555443, 2.5));
  const sun = new THREE.DirectionalLight(0xffe0a2, 2.5);
  sun.position.set(-3, 7, 3); scene.add(sun);
  const materials = new Map();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const mat = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness:.8}));
    return materials.get(color);
  };
  function box(parent, w, h, d, x, y, z, color, solid = false) {
    const mesh = new THREE.Mesh(boxGeometry, mat(color));
    mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh);
    if (solid) parent.userData.solids.push(mesh);
    return mesh;
  }
  function label(parent, text, w, h, x, y, z, rotation = 0, bg = '#1b3c39', vertical = false) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = '#edcf96'; ctx.strokeRect(8, 8, 496, 80);
    ctx.fillStyle = '#edcf96'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = 34;
    do { ctx.font = `${size--}px Georgia`; } while (ctx.measureText(text).width > 470 && size > 10);
    ctx.fillText(text, 256, 48, 470);
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
    box(group, 5.4, .1, BAY_LENGTH, 0, -.05, -1, 0x987048);
    for (let i = 0; i < 18; i++) box(group, .29, .015, BAY_LENGTH, -2.55 + i * .3, 0, -1, [0x987048, 0xa77b50, 0x8e6744, 0xaf8356][i % 4]);
    for (const side of [-1, 1]) {
      box(group, .15, 4.2, BAY_LENGTH, side * 2.75, 2.1, -1, 0xd6c7aa, true);
      box(group, .12, .15, BAY_LENGTH, side * 2.64, 3.95, -1, 0x684832);
      box(group, .035, .65, 2.3, side * 2.659, 3.4, -1, 0xf2d9a3);
      const x = side * 2.22;
      box(group, .1, 2.85, 5.1, side * 2.52, 1.45, -1, 0x382d25, true);
      for (const z of [-3.5, 1.5]) box(group, .7, 2.85, .13, x, 1.45, z, 0x684832, true);
      for (const y of [.25, .83, 1.41, 1.99, 2.63]) box(group, .7, .09, 5.1, x, y, -1, 0x684832, true);
      box(group, .75, .17, 5.2, x, 2.78, -1, 0x382d25, true);
      label(group, bay.label.toUpperCase(), 3.7, .25, side * 1.838, 2.78, -1, -side * Math.PI / 2, bay.code === 'PRE' ? '#773d34' : '#1b3c39');
    }
    box(group, 5.6, .12, BAY_LENGTH, 0, 4.18, -1, 0xe4d8c0);
    box(group, 1.75, .016, BAY_LENGTH, 0, .022, -1, bay.code === 'PRE' ? 0x503d56 : 0x803f36);
    for (const x of [-.77, .77]) box(group, .045, .004, BAY_LENGTH, x, .035, -1, 0xc89a60);
    box(group, .035, .65, .035, 0, 3.82, -1, 0x8b703c);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.36, .22, 24, 1, true), mat(0xb89956));
    shade.position.set(0, 3.4, -1); group.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), mat(0xffe2a1));
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
      label(object, book.titulo, p.height - .04, .21, 0, 0, .161, 0, `#${new THREE.Color(color).getHexString()}`, true);
    });
    return group;
  }
  function unload(index) {
    const group = loaded.get(index); if (!group) return;
    for (const book of layout.bays[index].books) objects.delete(book.id);
    group.traverse(object => {
      if (object.geometry && object.geometry !== boxGeometry) object.geometry.dispose();
      if (object.material?.map) { object.material.map.dispose(); object.material.dispose(); }
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
