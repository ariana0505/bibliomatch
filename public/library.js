import * as THREE from './vendor/three.module.mjs';
import { movePlayer, targetBook } from './library-controls.mjs';
import { demoBooks } from './library-demo.mjs';
import { AREAS, BAY_LENGTH, planLibrary, bayAt, findBooks, loadAllBooks, sectionFor } from './library-layout.mjs';
import { createWorld } from './library-world.mjs';

const $ = id => document.getElementById(id);
const demo = new URLSearchParams(location.search).get('demo') === '1';
const keys = new Set();
let world, layout, refreshing = false, lastRefresh = 0, markedId = null, searchLimit = 30;
const requestedIds = new Set();
const modalOpen = () => $('detail').open || $('finder').open;
let renderer, scene, camera, outline, currentTarget, selectedBook, csrf = '', user;
let ready = false, yaw = 0, pitch = 0, frameId, lastTime = 0, detailVersion = 0;
let books = [];
const ray = new THREE.Raycaster();
ray.far = 3;
const center = new THREE.Vector2(0, 0);

async function api(path, options = {}) {
  const headers = { Accept: 'application/json' };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrf;
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    if (response.status === 401) {
      ready = false;
      pause();
      $('enter-button').disabled = true;
      $('room-message').textContent = 'Tu sesión terminó. Vuelve al catálogo para ingresar.';
    }
    const error = new Error(data.error || 'No se pudo completar la operación.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function pause() {
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $('crosshair').hidden = true; $('target').hidden = true;
  if (!modalOpen()) $('welcome').hidden = false;
}

async function enter() {
  if (!ready || modalOpen()) return;
  try {
    await $('scene').requestPointerLock();
  } catch {
    $('room-message').textContent = 'No se pudo capturar el ratón. Pulsa de nuevo para continuar o permite el control del puntero en tu navegador.';
  }
}

function animate(time) {
  frameId = requestAnimationFrame(animate);
  const delta = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;
  const active = ready && layout && document.pointerLockElement === $('scene') && !modalOpen();
  if (active) {
    movePlayer(camera.position, Number(keys.has('KeyW')) - Number(keys.has('KeyS')), Number(keys.has('KeyD')) - Number(keys.has('KeyA')), yaw, delta, layout);
    world.update(camera.position.z);
    camera.rotation.set(pitch, yaw, 0);
    camera.updateMatrixWorld(); scene.updateMatrixWorld();
    ray.setFromCamera(center, camera);
    const target = targetBook(ray.intersectObjects(world.targets(), true));
    {
      currentTarget = target;
      $('target').hidden = !target;
      outline.visible = Boolean(target);
      if (target) {
        const book = target.userData.book;
        $('target-title').textContent = book.titulo;
        $('target-count').textContent = book.disponibles > 0 ? `${book.disponibles} ejemplar${book.disponibles === 1 ? '' : 'es'} disponible${book.disponibles === 1 ? '' : 's'}` : 'Todos los ejemplares están prestados';
        outline.setFromObject(target);
      }
    }
  }
  if (layout) {
    $('current-area').textContent = layout.bays[bayAt(layout, camera.position.z)].label;
    world.mark(markedId);
  }
  renderer.render(scene, camera);
}

function renderBook(book) {
  $('detail-area').textContent = AREAS[book.area] || 'Referencia';
  $('detail-title').textContent = book.titulo;
  $('detail-author').textContent = book.autor;
  $('detail-summary').textContent = book.sinopsis || 'Este libro todavía no tiene una descripción.';
  $('detail-count').textContent = book.disponibles > 0 ? `${book.disponibles} de ${book.ejemplares_total} ejemplares disponibles` : 'Sin ejemplares disponibles';
  $('detail-location').textContent = book.ubicacion || AREAS[sectionFor(book)];
  const cover = $('detail-cover'); cover.replaceChildren();
  if (book.foto && /^(https:\/\/covers\.openlibrary\.org\/|data:image\/(png|jpeg|webp);base64,)/.test(book.foto)) {
    const img = document.createElement('img'); img.src = book.foto; img.alt = `Portada de ${book.titulo}`; cover.append(img);
  } else {
    const title = document.createElement('strong'); title.textContent = book.titulo;
    const author = document.createElement('span'); author.textContent = book.autor;
    cover.append(title, author);
  }
  $('request-button').hidden = demo || user?.rol !== 'estudiante' || book.disponibles <= 0;
  $('request-button').disabled = !ready || requestedIds.has(book.id);
  $('request-button').textContent = requestedIds.has(book.id) ? 'Solicitud enviada' : 'Solicitar préstamo';
}

function renderReviews(items) {
  $('reviews-list').replaceChildren();
  if (!items.length) $('reviews-list').textContent = demo ? 'Esta ficha es de demostración. Las opiniones reales aparecerán al entrar desde tu catálogo.' : 'Todavía no hay opiniones. Puedes escribir la primera.';
  for (const item of items) {
    const article = document.createElement('article'); article.className = 'review';
    const author = document.createElement('strong'); author.textContent = `${item.apodo} · ${item.estrellas}/5`;
    const comment = document.createElement('p'); comment.textContent = item.comentario || 'Sin comentario';
    article.append(author, comment); $('reviews-list').append(article);
    if (item.propia) { $('stars').value = item.estrellas; $('comment').value = item.comentario || ''; }
  }
}

async function examine() {
  if (!currentTarget || modalOpen()) return;
  selectedBook = currentTarget.userData.book;
  const version = ++detailVersion;
  $('detail-message').textContent = demo ? 'Libro de demostración: no se crearán solicitudes ni opiniones.' : '';
  $('review-form').reset(); $('review-form').hidden = demo;
  renderBook(selectedBook);
  $('detail').showModal(); pause(); $('welcome').hidden = true;
  $('reviews-list').textContent = 'Cargando opiniones…';
  if (demo) return renderReviews([]);
  $('request-button').disabled = true;
  $('review-form').querySelector('button').disabled = true;
  try {
    const [detail, opinions] = await Promise.all([api(`/api/libros/${selectedBook.id}`), api(`/api/libros/${selectedBook.id}/opiniones`)]);
    if (version !== detailVersion || !$('detail').open) return;
    selectedBook = detail.libro;
    books = books.map(book => book.id === selectedBook.id ? {...book, ...selectedBook} : book);
    renderBook(selectedBook); renderReviews(opinions.opiniones);
    $('review-form').querySelector('button').disabled = false;
  } catch (error) {
    if (version === detailVersion) {
      $('detail-message').textContent = error.message; $('reviews-list').textContent = 'No se pudieron cargar las opiniones.';
      if (error.status === 404) books = books.filter(book => book.id !== selectedBook.id);
    }
  }
}

$('enter-button').addEventListener('click', enter);
$('pause-button').addEventListener('click', pause);
$('close-detail').addEventListener('click', () => $('detail').close());
$('detail').addEventListener('close', () => {
  detailVersion++; currentTarget = null; outline.visible = false;
  if (layout && ready) installCatalog(books);
  $('welcome-title').textContent = 'Seguimos explorando.';
  $('welcome-copy').textContent = 'Estás en el mismo lugar. Continúa buscando tu próxima lectura.';
  $('enter-button').textContent = 'Continuar recorrido →';
  $('welcome').hidden = false;
  $('enter-button').focus();
  refreshCatalog();
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === $('scene');
  keys.clear(); currentTarget = null;
  $('crosshair').hidden = !locked; $('target').hidden = true;
  if (outline) outline.visible = false;
  $('welcome').hidden = locked || modalOpen();
  if (locked) { $('scene').focus(); $('enter-button').textContent = 'Continuar recorrido →'; }
  else refreshCatalog();
});
document.addEventListener('pointerlockerror', () => { $('room-message').textContent = 'Pulsa «Entrar a la sala» para permitir el movimiento del ratón. Si acabas de pulsar Esc, espera un momento y vuelve a intentarlo.'; });
document.addEventListener('mousemove', event => {
  if (document.pointerLockElement !== $('scene') || modalOpen()) return;
  yaw -= event.movementX * .002;
  pitch = Math.max(-1.3, Math.min(1.3, pitch - event.movementY * .002));
});
document.addEventListener('keydown', event => {
  if (document.pointerLockElement !== $('scene') || modalOpen()) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyB', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyE' && !event.repeat) examine();
  if (event.code === 'KeyB' && !event.repeat) openFinder();
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else refreshCatalog(); });
window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
$('request-button').addEventListener('click', async () => {
  if (demo || !selectedBook || !ready) return;
  const id = selectedBook.id, version = detailVersion;
  $('request-button').disabled = true;
  try {
    await api('/api/solicitudes', { method: 'POST', body: { libro_id: id } });
    requestedIds.add(id);
    if (version === detailVersion) { $('detail-message').textContent = 'Solicitud enviada. El bibliotecario revisará tu préstamo.'; renderBook(selectedBook); }
  } catch (error) { if (version === detailVersion) { $('detail-message').textContent = error.message; $('request-button').disabled = !ready; } }
});
$('review-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (demo || !selectedBook || !ready) return;
  const version = detailVersion, id = selectedBook.id;
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try {
    await api(`/api/libros/${id}/opinion`, { method: 'PUT', body: { estrellas: Number($('stars').value), comentario: $('comment').value } });
    const opinions = await api(`/api/libros/${id}/opiniones`);
    if (version === detailVersion) { renderReviews(opinions.opiniones); $('detail-message').textContent = 'Tu opinión quedó guardada.'; }
  } catch (error) { if (version === detailVersion) $('detail-message').textContent = error.message; }
  finally { if (version === detailVersion) button.disabled = !ready; }
});
$('scene').addEventListener('webglcontextlost', event => {
  event.preventDefault(); ready = false; pause(); cancelAnimationFrame(frameId);
  $('enter-button').disabled = true; $('room-message').textContent = 'Se interrumpió la vista 3D. Recarga esta página para volver a entrar.';
});

function installCatalog(next) {
  const oldBay = layout && layout.bays[bayAt(layout, camera.position.z)];
  const relativeZ = oldBay ? camera.position.z + oldBay.offset : 3.8;
  const nextLayout = planLibrary(next);
  if (oldBay) {
    const oldSection = layout.sections.find(section => section.code === oldBay.code);
    const section = nextLayout.sections.find(section => section.code === oldBay.code);
    const newBay = section.firstBay + Math.min(oldBay.index - oldSection.firstBay, section.bays - 1);
    camera.position.z = Math.max(nextLayout.minZ, Math.min(nextLayout.maxZ, relativeZ - newBay * BAY_LENGTH));
  }
  books = next; layout = nextLayout; currentTarget = null;
  world.setLayout(layout); world.mark(markedId);
  $('collection-status').textContent = `${demo ? 'Demostración · ' : ''}${layout.books.length} títulos · ${layout.bays.length * 2} estanterías`;
  renderDirectory(); renderSearch();
}

async function refreshCatalog(force = false) {
  if (demo || refreshing || !ready || modalOpen() || (!force && Date.now() - lastRefresh < 60000)) return;
  refreshing = true; $('refresh-button').disabled = true;
  try {
    const next = await loadAllBooks(api);
    if (modalOpen()) return;
    const signature = items => JSON.stringify(items.map(book => [book.id, book.titulo, book.autor, book.area, book.disponibles, book.ejemplares_total, book.isbn]));
    if (signature(next) !== signature(books)) installCatalog(next);
    lastRefresh = Date.now();
    $('room-message').textContent = 'Catálogo actualizado. Los títulos están organizados según su disponibilidad.';
  } catch (error) { $('room-message').textContent = error.message; }
  finally { refreshing = false; $('refresh-button').disabled = false; }
}

function renderDirectory() {
  $('area-directory').replaceChildren();
  for (const section of layout.sections) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'area-button';
    button.textContent = `${section.name} · ${section.count} títulos`;
    button.addEventListener('click', () => {
      markedId = null; camera.position.set(0, 1.65, 2.2 - section.firstBay * BAY_LENGTH); yaw = 0; pitch = 0;
      camera.rotation.set(0, 0, 0); world.update(camera.position.z, true); $('finder').close();
      $('room-message').textContent = `Estás en ${section.name}. Pulsa «Continuar recorrido» para explorar.`;
    });
    $('area-directory').append(button);
  }
}

function renderSearch() {
  if (!layout) return;
  const matches = findBooks(layout, $('book-search').value, $('search-area').value);
  $('search-results').replaceChildren(); $('search-count').textContent = `${matches.length} títulos encontrados`;
  for (const book of matches.slice(0, searchLimit)) {
    const row = document.createElement('article'); row.className = 'search-result';
    const copy = document.createElement('div'), title = document.createElement('strong'), info = document.createElement('p');
    title.textContent = book.titulo;
    info.textContent = `${book.autor} · ${AREAS[sectionFor(book)]} · ${book.disponibles} disponibles`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Ir al estante'; button.dataset.bookId = book.id;
    button.addEventListener('click', () => locateBook(book.id));
    copy.append(title, info); row.append(copy, button); $('search-results').append(row);
  }
  $('more-results').hidden = matches.length <= searchLimit;
}

function openFinder() {
  if (!ready || $('detail').open) return;
  $('finder').showModal(); pause(); $('welcome').hidden = true; renderSearch(); $('book-search').focus();
}

function locateBook(id) {
  const position = layout.positions.get(id); if (!position) return;
  markedId = id; camera.position.set(position.side * .8, 1.65, position.z);
  yaw = -position.side * Math.PI / 2;
  pitch = Math.atan2(position.y - 1.65, Math.abs(position.x - camera.position.x));
  camera.rotation.set(pitch, yaw, 0); world.update(position.z, true); world.mark(id); $('finder').close();
  $('room-message').textContent = `${position.book.titulo} · ${layout.bays[position.bay].label}. El libro está resaltado en turquesa.`;
}

$('search-button').addEventListener('click', openFinder);
$('welcome-search').addEventListener('click', openFinder);
$('close-finder').addEventListener('click', () => $('finder').close());
$('finder').addEventListener('close', () => {
  $('welcome').hidden = false; $('enter-button').textContent = 'Continuar recorrido →'; $('enter-button').focus();
});
$('refresh-button').addEventListener('click', () => refreshCatalog(true));
$('book-search').addEventListener('input', () => { searchLimit = 30; renderSearch(); });
$('search-area').addEventListener('change', () => { searchLimit = 30; renderSearch(); });
$('more-results').addEventListener('click', () => { searchLimit += 30; renderSearch(); });
for (const [code, name] of Object.entries(AREAS)) {
  const option = document.createElement('option'); option.value = code; option.textContent = name; $('search-area').append(option);
}
const refreshTimer = setInterval(() => { if (!document.hidden) refreshCatalog(); }, 60000);
window.addEventListener('pagehide', () => { clearInterval(refreshTimer); cancelAnimationFrame(frameId); pause(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

async function start() {
  try {
    world = createWorld($('scene'));
    ({ renderer, scene, camera, outline } = world);
    if (!demo) {
      const me = await api('/api/me'); user = me.usuario; csrf = me.csrf;
      books = await loadAllBooks(api, (loaded, total) => { $('room-message').textContent = `Cargando catálogo: ${loaded} de ${total} títulos…`; });
      $('room-message').textContent = books.length ? 'Catálogo completo. Abre el buscador con B para localizar un libro.' : 'El catálogo está vacío. Las áreas están listas para recibir libros.';
      if (!books.length) $('demo-link').hidden = false;
    } else {
      books = demoBooks;
      $('room-message').textContent = 'Los ejemplares son de ejemplo. Esta prueba no modifica tu biblioteca.';
    }
    installCatalog(books); lastRefresh = Date.now(); ready = true; animate(0);
    if (!$('scene').requestPointerLock || matchMedia('(pointer: coarse)').matches) {
      ready = false; $('room-message').textContent = 'Abre esta prueba en una computadora con teclado y ratón y un navegador compatible con el control del puntero.';
    }
    $('enter-button').disabled = !ready;
    $('welcome-search').disabled = !ready; $('search-button').disabled = !ready;
    $('refresh-button').hidden = demo;
  } catch (error) {
    $('room-message').textContent = renderer ? error.message : 'No se pudo iniciar la vista 3D. Comprueba que tu navegador tenga la aceleración gráfica habilitada.';
    $('demo-link').hidden = !renderer || demo;
    $('collection-status').textContent = 'Biblioteca 3D';
  }
}
start();
