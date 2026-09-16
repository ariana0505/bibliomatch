"use strict";

const AREAS = {
  MAT: ["Matemática", "#2563eb"],
  CIE: ["Ciencias", "#15803d"],
  TEC: ["Tecnología", "#a16207"],
  LIT: ["Literatura", "#dc2626"],
  HIS: ["Historia", "#92400e"],
  ART: ["Arte", "#9333ea"],
  REF: ["Referencia", "#64748b"],
};

const BOOK_COVER_ART = {
  "9791399000016": ["☁️", "#31588a", "#b9dff2"],
  "9791399000023": ["🐦", "#125f61", "#f2b95b"],
  "9791399000030": ["🔭", "#172554", "#7c6fca"],
  "9791399000047": ["🤖", "#334155", "#60a5fa"],
  "9791399000054": ["✉️", "#875a44", "#efd9bc"],
  "9791399000061": ["🗺️", "#6f451f", "#d6ad60"],
  "9791399000078": ["🎨", "#713c7c", "#f08cad"],
  "9791399000085": ["🔤", "#374151", "#a7b6c8"],
  "9791399000092": ["🔦", "#17466f", "#f3c44e"],
  "9791399000108": ["🌻", "#37633c", "#efd05d"],
  "9791399000115": ["💻", "#18355b", "#41c7a5"],
  "9791399000122": ["🕰️", "#4b315f", "#c6a9d6"],
  "9791399000139": ["⚓", "#66402c", "#d88952"],
  "9791399000146": ["🎵", "#315c45", "#a9d28f"],
  "9791399000153": ["🏝️", "#17637a", "#e7bf68"],
  "9791399000160": ["📐", "#2453a6", "#edb95a"],
  "9791399000177": ["🌊", "#125a78", "#70c7d4"],
  "9791399000184": ["☀️", "#a34719", "#f7c64d"],
  "9791399000191": ["🚂", "#25304f", "#d9a441"],
  "9791399000207": ["🏛️", "#68462d", "#cda96c"],
};

const AREA_COVER_ART = {
  MAT: ["∑", "#1e3a8a", "#60a5fa"],
  CIE: ["🔬", "#14532d", "#86c77a"],
  TEC: ["⚙️", "#374151", "#f0a94b"],
  LIT: ["📖", "#7f1d1d", "#e88d79"],
  HIS: ["🏺", "#78350f", "#d6ad60"],
  ART: ["✦", "#6b217e", "#e879b2"],
  REF: ["🔎", "#334155", "#94a3b8"],
};

const COURSES = [
  ["Matemática", "🔢"], ["Comunicación", "🗣️"], ["Lectura", "📚"],
  ["Inglés", "🇬🇧"], ["Biología", "🧬"], ["Química", "⚗️"],
  ["Física", "🍎"], ["CCSS", "🏛️"], ["Arte", "🎨"],
];

const QUIZ = [
  ["Cuando estudias un tema nuevo, ¿qué te ayuda primero?", { V: "Ver un esquema o video", A: "Escuchar una explicación", R: "Leer y tomar apuntes", K: "Resolver un ejemplo" }],
  ["Para recordar una idea importante prefieres…", { V: "Usar colores y diagramas", A: "Repetirla en voz alta", R: "Escribirla con tus palabras", K: "Relacionarla con una actividad" }],
  ["Si debes llegar a un lugar nuevo eliges…", { V: "Mirar un mapa", A: "Pedir indicaciones habladas", R: "Leer los pasos", K: "Ir probando el camino" }],
  ["En una exposición grupal disfrutas más…", { V: "Diseñar las diapositivas", A: "Explicar al público", R: "Redactar el guion", K: "Hacer una demostración" }],
  ["Una clase se te queda mejor cuando…", { V: "Tiene imágenes", A: "Hay conversación", R: "Tiene un texto claro", K: "Incluye práctica" }],
  ["Al usar una aplicación nueva sueles…", { V: "Mirar capturas", A: "Pedir que te expliquen", R: "Leer el tutorial", K: "Probar los botones" }],
  ["Para un examen con poco tiempo prefieres…", { V: "Repasar mapas mentales", A: "Explicarte el tema", R: "Releer tus notas", K: "Resolver preguntas" }],
  ["Cuando aparece una palabra desconocida…", { V: "Buscas una imagen", A: "Preguntas su significado", R: "Lees la definición", K: "La usas en una frase" }],
];

const STYLE_NAMES = { V: "Visual", A: "Auditivo", R: "Lectoescritor", K: "Práctico" };

const initialState = () => ({
  user: null,
  csrf: "",
  view: "catalog",
  books: [],
  loans: [],
  requests: [],
  users: [],
  userFilters: { q: "", rol: "", grado: "", activo: "" },
  userTotal: 0,
  userPage: 1,
  userPages: 1,
  progress: [],
  stats: null,
  catalogFilters: { q: "", area: "", disponible: false, orden: "titulo" },
  catalogTotal: 0,
  catalogPage: 1,
  catalogPages: 1,
  selectedBook: null,
  opinions: [],
  course: null,
  style: "",
  material: null,
  recommendations: null,
  aiAvailable: false,
  aiQuestionsRemaining: 8,
  loading: false,
});
const state = initialState();
let sessionGeneration = 0;

const byId = (id) => document.getElementById(id);
const panels = () => document.querySelectorAll("[data-panel]");
const isStaff = () => ["bibliotecario", "admin"].includes(state.user?.rol);
const isAdmin = () => state.user?.rol === "admin";
const isHost = () => Boolean(state.user?.es_anfitrion);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function coverTitleLines(title = "") {
  const words = String(title).trim().split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const current = lines.at(-1);
    if (current && `${current} ${word}`.length > 25 && lines.length < 3) lines.push(word);
    else lines[lines.length - 1] = current ? `${current} ${word}` : word;
  }
  return lines.slice(0, 3);
}

function referenceCover(book) {
  const [symbol, dark, light] = BOOK_COVER_ART[book.isbn] || AREA_COVER_ART[book.area] || AREA_COVER_ART.REF;
  const titleLines = coverTitleLines(book.titulo);
  const area = AREAS[book.area]?.[0] || "Biblioteca";
  const title = titleLines.map((line, index) => `<text x="300" y="${555 + index * 48}" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="${titleLines.length > 2 ? 31 : 35}" font-weight="700">${escapeXml(line)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" role="img" aria-label="Portada ilustrada de ${escapeXml(book.titulo)}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>
    <rect width="600" height="800" fill="url(#g)"/>
    <circle cx="72" cy="128" r="135" fill="#fff" opacity=".09"/><circle cx="555" cy="350" r="190" fill="#fff" opacity=".08"/>
    <path d="M0 430 Q150 365 300 430 T600 430 V800 H0Z" fill="#08111f" opacity=".23"/>
    <text x="48" y="70" fill="#fff" opacity=".9" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">${escapeXml(area.toUpperCase())}</text>
    <circle cx="300" cy="300" r="142" fill="#fff" opacity=".16"/><circle cx="300" cy="300" r="116" fill="#fff" opacity=".12"/>
    <text x="300" y="355" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Arial, sans-serif" font-size="142">${escapeXml(symbol)}</text>
    ${title}
    <text x="300" y="738" text-anchor="middle" fill="#fff" opacity=".78" font-family="Arial, sans-serif" font-size="22">${escapeXml(book.autor || "Bibliomatch")}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function futureDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function showToast(message, error = false) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function setFormError(formId, message = "") {
  const element = document.querySelector(`[data-error-for="${formId}"]`);
  if (element) element.textContent = message;
}

async function api(path, options = {}) {
  const generation = sessionGeneration;
  const settings = { credentials: "same-origin", ...options };
  settings.headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body && typeof options.body !== "string") {
    settings.headers["Content-Type"] = "application/json";
    settings.body = JSON.stringify(options.body);
  }
  if (settings.method && !["GET", "HEAD"].includes(settings.method.toUpperCase()) && state.csrf) {
    settings.headers["X-CSRF-Token"] = state.csrf;
  }
  const response = await fetch(path, settings);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : {};
  if (generation !== sessionGeneration) throw new Error("La sesión cambió; vuelve a realizar la operación.");
  if (!response.ok) {
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    if (response.status === 401 && path !== "/api/login") showAuth();
    throw error;
  }
  return data;
}

function showAuth(tab = "login") {
  sessionGeneration += 1;
  Object.assign(state, initialState());
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  panels().forEach((panel) => { panel.innerHTML = ""; });
  byId("book-dialog-content").innerHTML = "";
  document.querySelectorAll("dialog form").forEach((form) => form.reset());
  byId("app-shell").classList.add("hidden");
  byId("auth-screen").classList.remove("hidden");
  switchAuthTab(tab);
}

function showApp() {
  byId("auth-screen").classList.add("hidden");
  byId("app-shell").classList.remove("hidden");
  byId("user-chip").textContent = `${state.user.apodo} · ${state.user.rol}`;
  byId("management-nav").classList.toggle("hidden", !isStaff());
  changeView("catalog");
  if (state.user.debe_cambiar_contrasena) {
    showToast("Debes reemplazar la contraseña temporal.");
    setTimeout(() => byId("password-dialog").showModal(), 250);
  }
}

function switchAuthTab(tab) {
  const login = tab === "login";
  byId("login-form").classList.toggle("hidden", !login);
  byId("register-form").classList.toggle("hidden", login);
  byId("login-tab").classList.toggle("active", login);
  byId("register-tab").classList.toggle("active", !login);
  byId("login-tab").setAttribute("aria-selected", String(login));
  byId("register-tab").setAttribute("aria-selected", String(!login));
  setFormError("login-form");
  setFormError("register-form");
}

async function boot() {
  applyTheme(localStorage.getItem("bibliomatch-theme") || "light");
  try {
    const data = await api("/api/me");
    state.user = data.usuario;
    state.csrf = data.csrf;
    state.aiAvailable = Boolean(data.ia);
    showApp();
  } catch (error) {
    showAuth();
    if (error.status === 503) setFormError("login-form", error.message);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  byId("theme-toggle").textContent = theme === "dark" ? "☀️" : "🌙";
  byId("theme-toggle").setAttribute("aria-label", theme === "dark" ? "Usar tema claro" : "Usar tema oscuro");
  localStorage.setItem("bibliomatch-theme", theme);
}

function changeView(view) {
  if (view === "management" && !isStaff()) view = "catalog";
  state.view = view;
  panels().forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== view));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view && button.classList.contains("nav-item"));
  });
  if (view === "catalog") loadBooks();
  if (view === "learning") loadLearning();
  if (view === "management") loadManagement();
  if (view === "profile") loadProfile();
  byId("contenido").focus();
}

async function loadBooks(filters = null, page = state.catalogPage) {
  if (filters) {
    state.catalogFilters = { ...state.catalogFilters, ...filters };
    page = 1;
  }
  state.catalogPage = page;
  const params = new URLSearchParams();
  params.set("pagina", String(page));
  if (state.catalogFilters.q) params.set("q", state.catalogFilters.q);
  if (state.catalogFilters.area) params.set("area", state.catalogFilters.area);
  if (state.catalogFilters.disponible) params.set("disponible", "1");
  if (state.catalogFilters.orden !== "titulo") params.set("orden", state.catalogFilters.orden);
  const query = params.toString();
  const view = byId("catalog-view");
  view.innerHTML = catalogShell('<div class="loading">Cargando catálogo…</div>');
  try {
    const data = await api(`/api/libros${query ? `?${query}` : ""}`);
    state.books = data.libros;
    state.catalogTotal = data.total;
    state.catalogPages = data.paginas;
    if (page > data.paginas) return loadBooks(null, data.paginas);
    renderCatalog();
  } catch (error) {
    view.innerHTML = catalogShell(`<div class="error-panel">${escapeHtml(error.message)}</div>`);
  }
}

function catalogShell(content) {
  const filters = state.catalogFilters;
  return `
    <div class="page-heading">
      <div><p class="eyebrow">Catálogo escolar</p><h1>Encuentra tu próxima lectura</h1><p class="muted">Consulta disponibilidad y solicita un ejemplar.</p></div>
      ${isStaff() ? '<button class="primary" type="button" data-action="new-book">+ Registrar libro</button>' : ""}
    </div>
    ${recommendationPanel()}
    <form id="catalog-filter" class="toolbar" role="search">
      <div class="search-wrap"><label class="hidden" for="catalog-search">Buscar libros</label><input id="catalog-search" name="q" value="${escapeHtml(filters.q)}" placeholder="Título, autor, ISBN, ubicación o donante" maxlength="100"></div>
      <label class="hidden" for="catalog-area">Área</label>
      <select id="catalog-area" name="area"><option value="">Todas las áreas</option>${Object.entries(AREAS).map(([code, item]) => `<option value="${code}" ${filters.area === code ? "selected" : ""}>${item[0]}</option>`).join("")}</select>
      <label class="hidden" for="catalog-order">Ordenar catálogo</label>
      <select id="catalog-order" name="orden"><option value="titulo" ${filters.orden === "titulo" ? "selected" : ""}>Título</option><option value="autor" ${filters.orden === "autor" ? "selected" : ""}>Autor</option><option value="recientes" ${filters.orden === "recientes" ? "selected" : ""}>Más recientes</option><option value="disponibilidad" ${filters.orden === "disponibilidad" ? "selected" : ""}>Más disponibles</option></select>
      <label class="availability-check"><input type="checkbox" name="disponible" value="1" ${filters.disponible ? "checked" : ""}> Solo disponibles</label>
      <div class="filter-actions"><button class="primary" type="submit">Buscar</button><button class="ghost-button" type="button" data-action="clear-catalog">Limpiar</button></div>
    </form>
    ${content}
    <section class="library-entry" aria-labelledby="library-entry-title"><div><p class="eyebrow">Un nuevo modo de explorar</p><h2 id="library-entry-title">Entra a la biblioteca 3D</h2><p>Recorre todas las áreas, encuentra un libro y consulta los títulos disponibles y prestados.</p></div><div class="button-row"><a class="primary library-link" href="/library.html">Entrar a la biblioteca 3D →</a><a class="library-demo-link" href="/library.html?demo=1">Ver demostración</a></div></section>`;
}

function recommendationPanel() {
  if (!state.aiAvailable) return "";
  const result = state.recommendations;
  const recommendations = result?.recomendaciones || [];
  return `<section class="recommendation-panel" aria-labelledby="recommendation-title">
    <div class="recommendation-copy">
      <p class="eyebrow">BiblioMatch IA</p>
      <h2 id="recommendation-title">¿Qué te gustaría leer?</h2>
      <p class="muted">Cuéntanos tus intereses y te sugeriremos libros disponibles de este catálogo.</p>
    </div>
    <form id="recommendation-form" class="recommendation-form">
      <label class="hidden" for="recommendation-interests">Intereses de lectura</label>
      <input id="recommendation-interests" name="intereses" maxlength="300" placeholder="Ejemplo: aventuras, astronomía y protagonistas valientes" required>
      <button class="primary" type="submit">✨ Recomendarme libros</button>
      <p class="form-error" data-error-for="recommendation-form" role="alert"></p>
    </form>
    ${recommendations.length ? `<div class="recommendation-results"><p>${escapeHtml(result.introduccion || "Estas lecturas pueden interesarte.")}</p><div class="recommendation-grid">${recommendations.map(recommendationCard).join("")}</div><p class="ai-note">Sugerencias generadas con IA a partir del catálogo, tu grado y tu historial de préstamos. Revisa siempre la ficha del libro.</p></div>` : ""}
  </section>`;
}

function recommendationCard(item) {
  const book = item.libro;
  return `<article class="recommendation-card">
    <div class="recommendation-cover">${cover(book)}</div>
    <div><span class="badge success">${book.disponibles} disponible${book.disponibles === 1 ? "" : "s"}</span><h3>${escapeHtml(book.titulo)}</h3><p class="muted">${escapeHtml(book.autor || "Autor desconocido")}</p><p>${escapeHtml(item.razon)}</p><button class="ghost-button" type="button" data-action="open-book" data-id="${book.id}">Ver detalles</button></div>
  </article>`;
}

function renderCatalog() {
  const summary = `<p class="results-summary" role="status">${state.catalogTotal} ${state.catalogTotal === 1 ? "libro encontrado" : "libros encontrados"}</p>`;
  const content = state.books.length
    ? `<div class="books-grid">${state.books.map(bookCard).join("")}</div>`
    : '<div class="empty-state"><div class="cover-placeholder">📭</div><h2>No hay libros para mostrar</h2><p>Prueba otros filtros o registra el primer libro.</p></div>';
  const pagination = state.catalogPages > 1 ? `<nav class="button-row" aria-label="Páginas del catálogo"><button type="button" class="secondary" data-action="catalog-previous" ${state.catalogPage <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${state.catalogPage} de ${state.catalogPages}</span><button type="button" class="secondary" data-action="catalog-next" ${state.catalogPage >= state.catalogPages ? "disabled" : ""}>Siguiente</button></nav>` : "";
  byId("catalog-view").innerHTML = catalogShell(summary + content + pagination);
}

function cover(book, className = "") {
  const source = book.foto || referenceCover(book);
  return `<img class="book-cover-image ${className}" src="${escapeHtml(source)}" alt="Portada referencial de ${escapeHtml(book.titulo)}" loading="lazy" decoding="async">`;
}

function bookCard(book) {
  const available = book.disponibles > 0;
  return `<article class="book-card">
    <div class="book-cover">${cover(book)}</div>
    <div class="book-body">
      <span class="badge neutral">${escapeHtml(AREAS[book.area]?.[0] || book.area)}</span>
      <h2>${escapeHtml(book.titulo)}</h2>
      <p class="muted">${escapeHtml(book.autor || "Autor desconocido")}</p>
      <span class="badge ${available ? "success" : "warning"}">${available ? `${book.disponibles} disponible${book.disponibles === 1 ? "" : "s"}` : "Sin disponibilidad"}</span>
      <button class="ghost-button" type="button" data-action="open-book" data-id="${book.id}">Ver detalles</button>
    </div>
  </article>`;
}

async function openBook(bookId) {
  state.selectedBook = state.books.find((book) => book.id === bookId)
    || state.recommendations?.recomendaciones?.find((item) => item.libro.id === bookId)?.libro;
  if (!state.selectedBook) return;
  state.opinions = [];
  renderBookDialog(true);
  if (!byId("book-dialog").open) byId("book-dialog").showModal();
  try {
    const data = await api(`/api/libros/${bookId}/opiniones`);
    state.opinions = data.opiniones;
    renderBookDialog(false);
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderBookDialog(loading = false) {
  const book = state.selectedBook;
  if (!book) return;
  const own = state.opinions.find((item) => item.propia);
  const reviews = loading
    ? '<div class="loading">Cargando opiniones…</div>'
    : state.opinions.length
      ? state.opinions.map((item) => `<article class="review"><strong>${escapeHtml(item.apodo)}</strong> <span class="stars" aria-label="${item.estrellas} de 5 estrellas">${"★".repeat(item.estrellas)}${"☆".repeat(5 - item.estrellas)}</span><p>${escapeHtml(item.comentario || "Sin comentario")}</p></article>`).join("")
      : '<p class="muted">Todavía no hay opiniones.</p>';
  byId("book-dialog-content").innerHTML = `
    <div class="dialog-heading"><div><p class="eyebrow">${escapeHtml(AREAS[book.area]?.[0] || book.area)}</p><h2 id="book-dialog-title">${escapeHtml(book.titulo)}</h2></div><button class="icon-button" type="button" data-close-dialog="book-dialog" aria-label="Cerrar">✕</button></div>
    <div class="book-detail">
      <div class="book-cover detail-cover">${cover(book, "detail-cover")}</div>
      <div>
        <p><strong>${escapeHtml(book.autor)}</strong></p>
        <div class="detail-meta"><span class="badge ${book.disponibles ? "success" : "warning"}">${book.disponibles} de ${book.ejemplares_total} disponibles</span>${book.isbn ? `<span class="badge neutral">ISBN ${escapeHtml(book.isbn)}</span>` : ""}</div>
        <p>${escapeHtml(book.sinopsis || "Sin sinopsis.")}</p>
        <p class="muted">Ubicación: ${escapeHtml(book.ubicacion || "por definir")}<br>Donante: ${escapeHtml(book.donante || "sin registrar")}</p>
        <div class="button-row">
          ${book.disponibles && !isStaff() ? `<button class="primary" type="button" data-action="request-book" data-id="${book.id}">Solicitar préstamo</button>` : ""}
          ${isStaff() ? `<button class="secondary" type="button" data-action="edit-book" data-id="${book.id}">Editar</button>` : ""}
          ${isAdmin() ? `<button class="danger-button" type="button" data-action="delete-book" data-id="${book.id}">Eliminar</button>` : ""}
        </div>
      </div>
    </div>
    <section class="reviews">
      <h3>Opiniones</h3>${reviews}
      <form id="review-form" class="stack">
        <input type="hidden" name="book_id" value="${book.id}">
        <label for="review-stars">Tu puntuación</label>
        <select id="review-stars" name="estrellas" required>${[5,4,3,2,1].map((n) => `<option value="${n}" ${own?.estrellas === n ? "selected" : ""}>${n} estrella${n === 1 ? "" : "s"}</option>`).join("")}</select>
        <label for="review-comment">Comentario</label>
        <textarea id="review-comment" name="comentario" rows="3" maxlength="1000">${escapeHtml(own?.comentario || "")}</textarea>
        <button class="primary" type="submit">${own ? "Actualizar opinión" : "Publicar opinión"}</button>
        <p class="form-error" data-error-for="review-form" role="alert"></p>
      </form>
    </section>`;
}

function openBookForm(book = null) {
  const form = byId("book-form");
  form.reset();
  form.elements.id.value = book?.id || "";
  form.elements.titulo.value = book?.titulo || "";
  form.elements.autor.value = book?.autor || "";
  form.elements.isbn.value = book?.isbn || "";
  form.elements.area.value = book?.area || "LIT";
  form.elements.ejemplares_total.value = book?.ejemplares_total || 1;
  form.elements.sinopsis.value = book?.sinopsis || "";
  form.elements.ubicacion.value = book?.ubicacion || "";
  form.elements.donante.value = book?.donante || "";
  form.elements.foto.value = "";
  byId("book-form-title").textContent = book ? "Editar libro" : "Registrar libro";
  byId("book-ai-button").classList.toggle("hidden", !state.aiAvailable);
  setFormError("book-form");
  byId("book-form-dialog").showModal();
}

function openApproveForm(requestId) {
  const item = state.requests.find((request) => request.id === requestId);
  const form = byId("approve-form");
  form.elements.solicitud_id.value = requestId;
  byId("approve-summary").textContent = item ? `${item.titulo} · ${item.apodo}` : "";
  byId("approve-due").min = new Date().toISOString().slice(0, 10);
  byId("approve-due").value = futureDate(30);
  setFormError("approve-form");
  byId("approve-dialog").showModal();
}

function openLoanForm() {
  const available = state.books.filter((book) => book.disponibles > 0);
  byId("loan-book").innerHTML = available.map((book) => `<option value="${book.id}">${escapeHtml(book.titulo)} (${book.disponibles})</option>`).join("");
  byId("loan-due").min = new Date().toISOString().slice(0, 10);
  byId("loan-due").value = futureDate(30);
  byId("loan-form").elements.apodo.value = "";
  setFormError("loan-form");
  byId("loan-dialog").showModal();
}

async function loadLoanBooks() {
  const result = await api("/api/libros?por_pagina=250&disponible=1&formato=3d");
  for (let page = 2; page <= result.paginas; page += 1) {
    const next = await api(`/api/libros?por_pagina=250&disponible=1&formato=3d&pagina=${page}`);
    result.libros.push(...next.libros);
  }
  return result;
}

async function loadManagement() {
  const view = byId("management-view");
  view.innerHTML = '<div class="loading">Cargando gestión…</div>';
  try {
    const calls = [loadLoanBooks(), api("/api/prestamos?estado=activo"), api("/api/solicitudes?estado=pendiente"), api("/api/estadisticas")];
    if (isAdmin()) calls.push(api(`/api/usuarios?${userQuery()}`));
    const [books, loans, requests, stats, users] = await Promise.all(calls);
    state.books = books.libros;
    state.loans = loans.prestamos;
    state.requests = requests.solicitudes;
    state.stats = stats;
    state.users = users?.usuarios || [];
    state.userTotal = users?.total || 0;
    state.userPages = users?.paginas || 1;
    renderManagement();
  } catch (error) {
    view.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`;
  }
}

function renderManagement() {
  const stats = state.stats;
  byId("management-view").innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Administración</p><h1>Gestión de biblioteca</h1><p class="muted">Inventario, circulación y usuarios en un solo lugar.</p></div><div class="button-row"><button class="secondary" type="button" data-action="new-loan">+ Préstamo</button><button class="primary" type="button" data-action="new-book">+ Libro</button></div></div>
    <div class="dashboard-grid">
      <div class="stat-card"><span class="muted">Ejemplares</span><strong>${stats.total_ejemplares}</strong></div>
      <div class="stat-card"><span class="muted">Disponibles</span><strong>${stats.disponibles}</strong></div>
      <div class="stat-card"><span class="muted">Prestados</span><strong>${stats.prestados}</strong></div>
      <div class="stat-card"><span class="muted">Vencidos</span><strong>${stats.vencidos}</strong></div>
    </div>
    <section class="management-section"><div class="section-heading"><h2>Solicitudes pendientes</h2><span class="badge neutral">${state.requests.length}</span></div>${requestTable()}</section>
    <section class="management-section"><div class="section-heading"><h2>Préstamos activos</h2><span class="badge neutral">${state.loans.length}</span></div>${loanTable()}</section>
    <section class="management-section"><div class="section-heading"><h2>Libros más leídos</h2></div>${topBooks()}</section>
    ${isAdmin() ? `<section class="management-section"><div class="section-heading"><h2>Usuarios</h2><span class="badge neutral">${state.userTotal}</span></div>${userFilterForm()}${userTable()}${userPagination()}</section>` : ""}`;
}

function userQuery() {
  const params = new URLSearchParams();
  params.set("pagina", String(state.userPage));
  for (const [key, value] of Object.entries(state.userFilters)) if (value) params.set(key, value);
  return params.toString();
}

async function loadUsers(filters = null, page = state.userPage) {
  if (filters) { state.userFilters = { ...state.userFilters, ...filters }; page = 1; }
  state.userPage = page;
  const data = await api(`/api/usuarios?${userQuery()}`);
  state.users = data.usuarios;
  state.userTotal = data.total;
  state.userPages = data.paginas;
  if (page > data.paginas) return loadUsers(null, data.paginas);
  renderManagement();
  byId("user-search")?.focus();
}

function userFilterForm() {
  const f = state.userFilters;
  const option = (value, label, current) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`;
  return `<form id="user-filter" class="toolbar user-toolbar" role="search">
    <div class="search-wrap"><label class="hidden" for="user-search">Buscar usuario</label><input id="user-search" name="q" value="${escapeHtml(f.q)}" placeholder="Apodo" maxlength="24"></div>
    <label class="hidden" for="user-role">Rol</label><select id="user-role" name="rol">${option("", "Todos los roles", f.rol)}${["estudiante", "bibliotecario", "admin"].map((role) => option(role, role, f.rol)).join("")}</select>
    <label class="hidden" for="user-grade">Grado</label><select id="user-grade" name="grado">${option("", "Todos los grados", f.grado)}${["1°", "2°", "3°", "4°", "5°"].map((grade) => option(grade, grade, f.grado)).join("")}</select>
    <label class="hidden" for="user-state">Estado</label><select id="user-state" name="activo">${option("", "Activos e inactivos", f.activo)}${option("1", "Solo activos", f.activo)}${option("0", "Solo inactivos", f.activo)}</select>
    <div class="filter-actions"><button class="primary" type="submit">Buscar</button><button class="ghost-button" type="button" data-action="clear-users">Limpiar</button></div>
  </form>`;
}

function userPagination() {
  if (state.userPages <= 1) return "";
  return `<nav class="button-row" aria-label="Páginas de usuarios"><button type="button" class="secondary" data-action="users-previous" ${state.userPage <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${state.userPage} de ${state.userPages}</span><button type="button" class="secondary" data-action="users-next" ${state.userPage >= state.userPages ? "disabled" : ""}>Siguiente</button></nav>`;
}

function requestTable() {
  if (!state.requests.length) return '<div class="empty-state">No hay solicitudes pendientes.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Libro</th><th>Estudiante</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${state.requests.map((item) => `<tr><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.apodo)}</td><td>${formatDate(item.creado_en)}</td><td><div class="button-row"><button class="secondary" type="button" data-action="approve-request" data-id="${item.id}">Aprobar</button><button class="danger-button" type="button" data-action="reject-request" data-id="${item.id}">Rechazar</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function loanTable() {
  if (!state.loans.length) return '<div class="empty-state">No hay préstamos activos.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Libro</th><th>Estudiante</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${state.loans.map((item) => `<tr><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.apodo)}</td><td>${formatDate(item.vence_en)}</td><td><span class="badge ${item.vencido ? "warning" : "success"}">${item.vencido ? "Vencido" : "Al día"}</span></td><td><button class="secondary" type="button" data-action="return-loan" data-id="${item.id}">Devolver</button></td></tr>`).join("")}</tbody></table></div>`;
}

function topBooks() {
  if (!state.stats.mas_leidos.length) return '<p class="muted">Aún no hay historial suficiente.</p>';
  return `<div class="item-list">${state.stats.mas_leidos.map((item) => `<div class="list-item"><span>${escapeHtml(item.titulo)}</span><strong>${item.veces} préstamo${item.veces === 1 ? "" : "s"}</strong></div>`).join("")}</div>`;
}

function userTable() {
  if (!state.users.length) return '<div class="empty-state">No hay usuarios que coincidan con la búsqueda.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Apodo</th><th>Grado</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>${state.users.map((user) => {
    const protectedAdmin = user.rol === "admin" && !isHost();
    const locked = user.id === state.user.id || user.es_anfitrion || protectedAdmin;
    const roles = isHost() ? ["estudiante", "bibliotecario", "admin"] : ["estudiante", "bibliotecario"];
    return `<tr><td>${escapeHtml(user.apodo)}${user.es_anfitrion ? ' <span class="badge success">anfitriona</span>' : ""}${user.debe_cambiar_contrasena ? ' <span class="badge warning">clave temporal</span>' : ""}</td><td>${escapeHtml([user.grado, user.seccion].filter(Boolean).join(" ") || "—")}</td><td><label class="hidden" for="role-${user.id}">Rol de ${escapeHtml(user.apodo)}</label><select id="role-${user.id}" data-action="change-role" data-id="${user.id}" ${locked ? "disabled" : ""}>${roles.map((role) => `<option value="${role}" ${role === user.rol ? "selected" : ""}>${role}</option>`).join("")}${!roles.includes(user.rol) ? `<option value="${user.rol}" selected>${user.rol}</option>` : ""}</select></td><td><div class="button-row">${isHost() && user.rol === "admin" && !user.es_anfitrion ? `<button class="danger-button" type="button" data-action="revoke-admin" data-id="${user.id}" data-name="${escapeHtml(user.apodo)}">Revocar administrador</button>` : ""}<button class="${user.activo ? "danger-button" : "secondary"}" type="button" data-action="toggle-user" data-id="${user.id}" data-active="${user.activo}" ${locked ? "disabled" : ""}>${user.activo ? "Desactivar" : "Activar"}</button><button class="ghost-button" type="button" data-action="reset-password" data-id="${user.id}" ${locked || !user.activo ? "disabled" : ""}>Nueva clave</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

async function loadProfile() {
  const view = byId("profile-view");
  view.innerHTML = '<div class="loading">Cargando perfil…</div>';
  try {
    const [loans, requests, progress] = await Promise.all([api("/api/prestamos?propios=1"), api("/api/solicitudes?propios=1"), api("/api/progreso")]);
    state.loans = loans.prestamos;
    state.requests = requests.solicitudes;
    state.progress = progress.progreso;
    state.aiQuestionsRemaining = progress.preguntas_ia_restantes ?? 8;
    renderProfile();
  } catch (error) {
    view.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`;
  }
}

function renderProfile() {
  const activeLoans = state.loans.filter((item) => item.estado === "activo");
  const pending = state.requests.filter((item) => item.estado === "pendiente");
  const history = state.requests.filter((item) => item.estado !== "pendiente").slice(0, 10);
  const REQUEST_STATES = { aprobada: ["Aprobada", "success"], rechazada: ["Rechazada", "warning"], cancelada: ["Cancelada", "neutral"] };
  byId("profile-view").innerHTML = `
    <div class="page-heading"><div class="profile-header"><div class="avatar">${escapeHtml(state.user.apodo[0].toUpperCase())}</div><div><h1>${escapeHtml(state.user.apodo)}</h1><p class="muted">${escapeHtml(state.user.rol)}${state.user.es_anfitrion ? " · anfitriona" : ""}${state.user.grado ? ` · ${escapeHtml(state.user.grado)} ${escapeHtml(state.user.seccion || "")}` : ""}</p></div></div><div class="button-row"><button class="ghost-button" type="button" data-action="change-password">Cambiar contraseña</button>${!isAdmin() ? '<button class="danger-button" type="button" data-action="delete-account">Eliminar cuenta</button>' : ""}<button class="danger-button" type="button" data-action="logout">Cerrar sesión</button></div></div>
    <div class="profile-grid">
      <section class="profile-card"><div class="section-heading"><h2>Mis préstamos</h2><span class="badge neutral">${activeLoans.length}</span></div>${activeLoans.length ? `<div class="item-list">${activeLoans.map((item) => `<div class="list-item"><span>${escapeHtml(item.titulo)}</span><span class="${item.vencido ? "badge warning" : "muted"}">${item.vencido ? "Vencido" : `hasta ${formatDate(item.vence_en)}`}</span></div>`).join("")}</div>` : '<p class="muted">No tienes préstamos activos.</p>'}</section>
      <section class="profile-card"><div class="section-heading"><h2>Mis solicitudes</h2><span class="badge neutral">${pending.length}</span></div>${pending.length ? `<div class="item-list">${pending.map((item) => `<div class="list-item"><span>${escapeHtml(item.titulo)}</span><button class="danger-button" type="button" data-action="cancel-request" data-id="${item.id}">Cancelar</button></div>`).join("")}</div>` : '<p class="muted">No tienes solicitudes pendientes.</p>'}${history.length ? `<h3 class="muted">Historial</h3><div class="item-list">${history.map((item) => { const [label, tone] = REQUEST_STATES[item.estado] || [item.estado, "neutral"]; return `<div class="list-item"><span>${escapeHtml(item.titulo)}<br><small class="muted">${formatDate(item.resuelto_en || item.creado_en)}</small></span><span class="badge ${tone}">${label}</span></div>`; }).join("")}</div>` : ""}</section>
    </div>
    <section class="profile-card"><div class="section-heading"><h2>Mi aprendizaje</h2></div>${state.progress.length ? `<div class="item-list">${state.progress.map((item) => `<div class="list-item"><span>${escapeHtml(item.curso)}</span><strong>${escapeHtml(item.estilo ? item.estilo.split("").map((letter) => STYLE_NAMES[letter]).join(" + ") : "Sin test")}${item.mejor_puntaje != null ? ` · ${item.mejor_puntaje}/${item.total}` : ""}</strong></div>`).join("")}</div>` : '<p class="muted">Completa un test en Aprender para guardar tu resultado.</p>'}</section>
    ${state.user.rol === "estudiante" ? `<section class="profile-card"><div class="section-heading"><h2>Solicitar ser administrador</h2></div><p class="muted">La anfitriona revisará tu solicitud. Explica por qué quieres ayudar a administrar BiblioMatch.</p><form id="admin-request-form" class="stack"><label for="admin-request-reason">Motivo de la solicitud</label><textarea id="admin-request-reason" name="motivo" rows="5" minlength="20" maxlength="1000" placeholder="Cuéntanos por qué quieres ser administrador y cómo ayudarías a la biblioteca…" required></textarea><button class="primary" type="submit">Enviar solicitud por correo</button><p class="field-help">Se abrirá tu aplicación de correo con el mensaje dirigido a penaariana075@gmail.com.</p><p class="form-error" data-error-for="admin-request-form" role="alert"></p></form></section>` : ""}
    <section class="profile-card" aria-labelledby="profile-library-title">
      <div class="section-heading"><h2 id="profile-library-title">Tu biblioteca, una nueva experiencia</h2></div>
      <p class="muted">Recorre los estantes y descubre tu próxima lectura en un espacio 3D.</p>
      <a class="profile-library-link" href="/library.html">Explorar la biblioteca 3D →</a>
    </section>`;
}

async function loadLearning() {
  try {
    const data = await api("/api/progreso");
    state.progress = data.progreso;
    state.aiQuestionsRemaining = data.preguntas_ia_restantes ?? 8;
  } catch (error) {
    showToast(error.message, true);
  }
  renderLearning();
}

function renderLearning() {
  const view = byId("learning-view");
  if (!state.course) {
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Herramientas de estudio</p><h1>Aprende a tu manera</h1><p class="muted">El test es orientativo: combina estrategias y conserva las que te funcionen.</p></div></div><div class="course-grid">${COURSES.map(([course, emoji]) => `<button class="course-card" type="button" data-action="start-quiz" data-course="${escapeHtml(course)}"><span aria-hidden="true">${emoji}</span><strong>${escapeHtml(course)}</strong><p class="muted">Test de preferencias</p></button>`).join("")}</div>`;
    return;
  }
  const saved = state.progress.find((item) => item.curso === state.course);
  view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(state.course)}</p><h1>Preferencias de estudio</h1><p class="muted">No es un diagnóstico: úsalo para probar técnicas distintas.</p></div><button class="ghost-button" type="button" data-action="back-courses">← Cursos</button></div>
    ${state.style ? learningResult(saved) : quizForm()}`;
}

function quizForm() {
  return `<form id="learning-quiz" class="learning-card"><ol>${QUIZ.map(([question, choices], index) => `<li class="quiz-question"><p><strong>${escapeHtml(question)}</strong></p><div class="quiz-options">${Object.entries(choices).map(([letter, answer]) => `<label><input type="radio" name="q${index}" value="${letter}" required> ${escapeHtml(answer)}</label>`).join("")}</div></li>`).join("")}</ol><button class="primary" type="submit">Ver resultado</button><p class="form-error" data-error-for="learning-quiz" role="alert"></p></form>`;
}

function learningResult(saved) {
  const names = state.style.split("").map((letter) => STYLE_NAMES[letter]).join(" + ");
  const questionsLeft = state.aiQuestionsRemaining;
  const aiTool = state.aiAvailable
    ? `<h3>Pregunta a tu tutor de IA</h3><p class="muted">La respuesta usará por separado tu nivel (${escapeHtml(state.user.grado || "secundaria")}) y tu forma de aprender (${escapeHtml(names)}).</p><p class="question-counter"><strong>${questionsLeft}</strong> de 8 preguntas disponibles hoy</p>${questionsLeft > 0 ? `<form id="material-form" class="stack"><label for="material-topic">¿Qué quieres preguntar sobre ${escapeHtml(state.course)}?</label><textarea id="material-topic" name="tema" rows="6" maxlength="3000" placeholder="Ejemplo: Explícame las leyes de Newton…" required></textarea><button class="primary" type="submit">✨ Preguntar a la IA</button><p class="form-error" data-error-for="material-form" role="alert"></p></form>` : '<div class="info-panel"><strong>Límite diario alcanzado</strong><p>Ya utilizaste tus 8 preguntas. Podrás volver a preguntar mañana.</p></div>'}`
    : '<div class="info-panel"><strong>Asistente de IA no disponible</strong><p>La biblioteca todavía no ha configurado este servicio. Tu resultado de aprendizaje sí quedó guardado.</p></div>';
  return `<section class="learning-card"><div class="result-card"><p class="eyebrow">Resultado orientativo</p><h2>${escapeHtml(names)}</h2><p>Prueba una mezcla de estas estrategias y evalúa con cuál recuerdas y comprendes mejor.</p></div>
    ${aiTool}
    ${state.material ? renderMaterial(state.material) : ""}
    ${saved ? `<div class="section-heading saved-learning"><p class="muted">Resultado guardado · ${saved.intentos || 0} prácticas registradas</p><button class="ghost-button" type="button" data-action="retake-quiz">Repetir test</button></div>` : ""}</section>`;
}

function renderMaterial(material) {
  return `<div class="result-card"><h3>${escapeHtml(material.titulo || "Guía de estudio")}</h3><p>${escapeHtml(material.resumen || "")}</p>${material.ejemplo ? `<h3>Ejemplo</h3><p>${escapeHtml(material.ejemplo)}</p>` : ""}${material.actividad ? `<h3>Prueba tú</h3><p>${escapeHtml(material.actividad)}</p>` : ""}${Array.isArray(material.puntos) ? `<h3>Ideas clave</h3><ul>${material.puntos.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}${Array.isArray(material.preguntas) ? `<h3>Comprueba lo aprendido</h3><ol>${material.preguntas.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol>` : ""}</div>`;
}

async function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  try {
    if (action === "catalog-previous") await loadBooks(null, Math.max(1, state.catalogPage - 1));
    if (action === "catalog-next") await loadBooks(null, Math.min(state.catalogPages, state.catalogPage + 1));
    if (action === "new-book") openBookForm();
    if (action === "users-previous") await loadUsers(null, Math.max(1, state.userPage - 1));
    if (action === "users-next") await loadUsers(null, Math.min(state.userPages, state.userPage + 1));
    if (action === "clear-users") await loadUsers({ q: "", rol: "", grado: "", activo: "" });
    if (action === "clear-catalog") {
      await loadBooks({ q: "", area: "", disponible: false, orden: "titulo" });
    }
    if (action === "open-book") await openBook(id);
    if (action === "edit-book") { byId("book-dialog").close(); openBookForm(state.selectedBook?.id === id ? state.selectedBook : state.books.find((book) => book.id === id)); }
    if (action === "request-book") {
      button.disabled = true;
      await api("/api/solicitudes", { method: "POST", body: { libro_id: id } });
      showToast("Solicitud enviada.");
      byId("book-dialog").close();
      await loadBooks();
    }
    if (action === "delete-book" && confirm("¿Eliminar este libro y sus opiniones?")) {
      await api(`/api/libros/${id}`, { method: "DELETE" });
      byId("book-dialog").close();
      showToast("Libro eliminado.");
      await loadBooks();
    }
    if (action === "new-loan") openLoanForm();
    if (action === "return-loan" && confirm("¿Marcar este préstamo como devuelto?")) {
      await api(`/api/prestamos/${id}/devolver`, { method: "POST", body: {} });
      showToast("Devolución registrada.");
      await loadManagement();
    }
    if (action === "approve-request") openApproveForm(id);
    if (action === "reject-request" && confirm("¿Rechazar esta solicitud?")) {
      await api(`/api/solicitudes/${id}/resolver`, { method: "POST", body: { accion: "rechazar" } });
      showToast("Solicitud rechazada.");
      await loadManagement();
    }
    if (action === "toggle-user") {
      await api(`/api/usuarios/${id}`, { method: "PATCH", body: { activo: button.dataset.active !== "true" } });
      showToast("Usuario actualizado.");
      await loadManagement();
    }
    if (action === "reset-password" && confirm("¿Generar una contraseña temporal y cerrar las sesiones de esta cuenta?")) {
      const result = await api(`/api/usuarios/${id}/restablecer-contrasena`, { method: "POST", body: {} });
      prompt("Copia esta contraseña y entrégala por un canal seguro. Solo se mostrará ahora:", result.contrasena_temporal);
      await loadManagement();
    }
    if (action === "revoke-admin" && confirm(`¿Revocar el permiso de administrador de ${button.dataset.name}? Volverá a ser estudiante.`)) {
      await api(`/api/usuarios/${id}`, { method: "PATCH", body: { rol: "estudiante" } });
      showToast("Permiso revocado; la cuenta volvió a ser estudiante.");
      await loadManagement();
    }
    if (action === "cancel-request" && confirm("¿Cancelar esta solicitud?")) {
      await api(`/api/solicitudes/${id}`, { method: "DELETE" });
      showToast("Solicitud cancelada.");
      await loadProfile();
    }
    if (action === "change-password") byId("password-dialog").showModal();
    if (action === "logout") {
      await api("/api/logout", { method: "POST", body: {} });
      showAuth();
    }
    if (action === "delete-account") {
      const password = prompt("Para eliminar tu cuenta, escribe tu contraseña actual:");
      if (password) {
        await api("/api/cuenta", { method: "DELETE", body: { contrasena: password } });
        showToast("Cuenta eliminada.");
        showAuth();
      }
    }
    if (action === "start-quiz") {
      state.course = button.dataset.course;
      state.style = state.progress.find((item) => item.curso === state.course)?.estilo || "";
      state.material = null;
      renderLearning();
    }
    if (action === "retake-quiz") { state.style = ""; state.material = null; renderLearning(); }
    if (action === "back-courses") { state.course = null; state.style = ""; state.material = null; renderLearning(); }
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
  }
}

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) changeView(viewButton.dataset.view);
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) await handleAction(actionButton);
  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) byId(closeButton.dataset.closeDialog).close();
});

document.addEventListener("change", async (event) => {
  if (event.target.closest("#catalog-filter, #user-filter") && event.target.matches("select, input[type=checkbox]")) {
    event.target.form.requestSubmit();
    return;
  }
  const select = event.target.closest('[data-action="change-role"]');
  if (!select) return;
  try {
    await api(`/api/usuarios/${select.dataset.id}`, { method: "PATCH", body: { rol: select.value } });
    showToast("Rol actualizado.");
    await loadManagement();
  } catch (error) {
    showToast(error.message, true);
    await loadManagement();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id === "admin-request-form") {
    event.preventDefault();
    const reason = new FormData(form).get("motivo").trim();
    const subject = `Solicitud de administrador de ${state.user.apodo}`;
    const body = `Hola Ariana,\n\nSoy ${state.user.apodo} y solicito permiso para ser administrador de BiblioMatch.\n\nMotivo:\n${reason}\n\nGracias.`;
    window.location.href = `mailto:penaariana075@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast("Solicitud preparada en tu aplicación de correo.");
    return;
  }
  if (form.id === "recommendation-form") {
    event.preventDefault();
    setFormError(form.id);
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Buscando lecturas…";
    try {
      const interests = new FormData(form).get("intereses").trim();
      state.recommendations = await api("/api/generar", {
        method: "POST",
        body: { tipo: "recomendaciones", intereses: interests },
      });
      renderCatalog();
    } catch (error) {
      setFormError(form.id, error.message);
      submit.disabled = false;
      submit.textContent = "✨ Recomendarme libros";
    }
    return;
  }
  if (form.id === "user-filter") {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await loadUsers({ q: String(data.q || "").trim(), rol: String(data.rol || ""), grado: String(data.grado || ""), activo: String(data.activo || "") });
    } catch (error) { showToast(error.message, true); }
    return;
  }
  if (form.id === "catalog-filter") {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    await loadBooks({
      q: String(data.q || "").trim(),
      area: String(data.area || ""),
      disponible: data.disponible === "1",
      orden: String(data.orden || "titulo"),
    });
  }
  if (form.id === "review-form") {
    event.preventDefault();
    setFormError(form.id);
    const data = Object.fromEntries(new FormData(form));
    try {
      await api(`/api/libros/${data.book_id}/opinion`, { method: "PUT", body: { estrellas: Number(data.estrellas), comentario: data.comentario } });
      showToast("Opinión guardada.");
      await openBook(data.book_id);
    } catch (error) { setFormError(form.id, error.message); }
  }
  if (form.id === "learning-quiz") {
    event.preventDefault();
    setFormError(form.id);
    const data = new FormData(form);
    const counts = { V: 0, A: 0, R: 0, K: 0 };
    for (let index = 0; index < QUIZ.length; index += 1) counts[data.get(`q${index}`)] += 1;
    const maximum = Math.max(...Object.values(counts));
    const calculatedStyle = Object.keys(counts).filter((letter) => counts[letter] === maximum).join("");
    try {
      await api(`/api/progreso/${encodeURIComponent(state.course)}`, { method: "PUT", body: { estilo: calculatedStyle } });
      const progress = await api("/api/progreso");
      state.progress = progress.progreso;
      state.aiQuestionsRemaining = progress.preguntas_ia_restantes ?? 8;
      const saved = state.progress.find((item) => item.curso === state.course);
      if (!saved?.estilo) throw new Error("El servidor no confirmó el resultado del test.");
      state.style = saved.estilo;
      renderLearning();
    } catch (error) {
      state.style = "";
      setFormError(form.id, `No se pudo guardar el test: ${error.message}`);
    }
  }
  if (form.id === "material-form") {
    event.preventDefault();
    setFormError(form.id);
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Creando guía…";
    try {
      const data = Object.fromEntries(new FormData(form));
      const result = await api("/api/generar", { method: "POST", body: { tipo: "material", curso: state.course, tema: data.tema } });
      state.material = result.material;
      state.aiQuestionsRemaining = result.preguntas_restantes;
      renderLearning();
    } catch (error) {
      setFormError(form.id, error.message);
      submit.disabled = false;
      submit.textContent = "✨ Preguntar a la IA";
    }
  }
});

byId("login-tab").addEventListener("click", () => switchAuthTab("login"));
byId("register-tab").addEventListener("click", () => switchAuthTab("register"));
byId("theme-toggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

byId("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("login-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const data = await api("/api/login", { method: "POST", body: values });
    state.user = data.usuario;
    state.csrf = data.csrf;
    state.aiAvailable = Boolean(data.ia);
    form.reset();
    showApp();
  } catch (error) {
    setFormError("login-form", error.message);
  } finally { submit.disabled = false; }
});

byId("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("register-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const data = await api("/api/registro", { method: "POST", body: values });
    state.user = data.usuario;
    state.csrf = data.csrf;
    state.aiAvailable = Boolean(data.ia);
    form.reset();
    showApp();
  } catch (error) {
    setFormError("register-form", error.message);
  } finally { submit.disabled = false; }
});

const COVER_MAX_BYTES = 750_000;
const COVER_MAX_HEIGHT = 900;

// Photos from a phone are several megabytes; a cover is displayed at a few
// hundred pixels, so the browser shrinks and re-encodes it before uploading.
async function compressCover(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("No se pudo leer la imagen. Usa un archivo PNG, JPG o WebP.");
  const scale = Math.min(1, COVER_MAX_HEIGHT / bitmap.height, (COVER_MAX_HEIGHT * 2) / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff"; // transparent PNGs become white, not black, in JPEG
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [0.86, 0.75, 0.62, 0.5]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length * 0.75 <= COVER_MAX_BYTES) return dataUrl;
  }
  throw new Error("La portada sigue siendo demasiado grande; prueba con una imagen más pequeña.");
}

byId("book-photo").addEventListener("change", async (event) => {
  const input = event.target;
  const file = input.files?.[0];
  const form = byId("book-form");
  if (!file) return;
  setFormError("book-form");
  input.disabled = true;
  try {
    const original = file.size <= COVER_MAX_BYTES && ["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); })
      : null;
    form.elements.foto.value = original || await compressCover(file);
    if (!original) showToast(`Portada ajustada a ${Math.round(form.elements.foto.value.length * 0.75 / 1024)} KB.`);
  } catch (error) {
    form.elements.foto.value = "";
    input.value = "";
    setFormError("book-form", error.message);
  } finally { input.disabled = false; }
});

byId("book-ai-button").addEventListener("click", async () => {
  const form = byId("book-form");
  const title = form.elements.titulo.value.trim();
  if (!title) return setFormError("book-form", "Escribe primero el título.");
  const button = byId("book-ai-button");
  button.disabled = true;
  button.textContent = "Buscando…";
  try {
    const data = await api("/api/generar", { method: "POST", body: { tipo: "libro", titulo: title, isbn: form.elements.isbn.value.trim() } });
    form.elements.autor.value = data.autor || "";
    form.elements.area.value = data.area || "LIT";
    form.elements.sinopsis.value = data.sinopsis || "";
    showToast("Información generada; revísala antes de guardar.");
  } catch (error) { setFormError("book-form", error.message); }
  finally { button.disabled = false; button.textContent = "✨ Completar con IA"; }
});

byId("book-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("book-form");
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  delete values.foto_archivo;
  values.ejemplares_total = Number(values.ejemplares_total);
  const id = values.id;
  if (id && !values.foto) delete values.foto; // keep the current cover when editing
  delete values.id;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await api(id ? `/api/libros/${id}` : "/api/libros", { method: id ? "PUT" : "POST", body: values });
    byId("book-form-dialog").close();
    showToast(id ? "Libro actualizado." : "Libro registrado.");
    if (state.view === "management") await loadManagement(); else await loadBooks();
  } catch (error) { setFormError("book-form", error.message); }
  finally { submit.disabled = false; }
});

byId("loan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("loan-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    await api("/api/prestamos", { method: "POST", body: values });
    byId("loan-dialog").close();
    showToast("Préstamo registrado.");
    await loadManagement();
  } catch (error) { setFormError("loan-form", error.message); }
  finally { submit.disabled = false; }
});

byId("approve-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("approve-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    await api(`/api/solicitudes/${values.solicitud_id}/resolver`, { method: "POST", body: { accion: "aprobar", vence_en: values.vence_en } });
    byId("approve-dialog").close();
    showToast(`Solicitud aprobada; préstamo hasta el ${formatDate(values.vence_en)}.`);
    await loadManagement();
  } catch (error) { setFormError("approve-form", error.message); }
  finally { submit.disabled = false; }
});

byId("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("password-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await api("/api/cuenta/contrasena", { method: "POST", body: Object.fromEntries(new FormData(form)) });
    form.reset();
    byId("password-dialog").close();
    state.user.debe_cambiar_contrasena = false;
    showToast("Contraseña actualizada.");
  } catch (error) { setFormError("password-form", error.message); }
  finally { submit.disabled = false; }
});

boot();
